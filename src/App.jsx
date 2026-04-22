import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword
} from 'firebase/auth'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import Dashboard from './Dashboard.jsx'
import { auth, db } from './firebase'

const HOUSEHOLD_ID = 'SJH-SGB'

const ACCOUNTS = {
  yhhojt970: {
    name: '엄마',
    role: 'admin',
    badge: '관리자',
    accent: '#ff8fb1',
    background: 'linear-gradient(135deg, #ffe4ec, #fff7d6)'
  },
  sjh150717: {
    name: '손지희',
    role: 'child',
    badge: '지희',
    accent: '#7c9cff',
    background: 'linear-gradient(135deg, #e8f0ff, #fff0fb)'
  },
  sgb170101: {
    name: '손가빈',
    role: 'child',
    badge: '가빈',
    accent: '#42c99b',
    background: 'linear-gradient(135deg, #e8fff5, #fff8df)'
  }
}

const normalizeIdToEmail = (id) => `${(id || '').trim()}@kidschedule.local`

export default function App() {
  const [authUser, setAuthUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [household, setHousehold] = useState(null)
  const [mode, setMode] = useState('login')
  const [loginId, setLoginId] = useState('')
  const [loginPw, setLoginPw] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const unsubRef = useRef({ profile: null, household: null })

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setAuthUser(nextUser || null)
      setMessage('')
    })

    return () => unsub()
  }, [])

  useEffect(() => {
    if (unsubRef.current.profile) unsubRef.current.profile()
    if (unsubRef.current.household) unsubRef.current.household()
    unsubRef.current = { profile: null, household: null }
    setProfile(null)
    setHousehold(null)

    if (!authUser?.uid) return

    const profileRef = doc(db, 'users', authUser.uid)
    unsubRef.current.profile = onSnapshot(profileRef, (snap) => {
      setProfile(snap.exists() ? snap.data() : null)
    })

    return () => {
      if (unsubRef.current.profile) unsubRef.current.profile()
      if (unsubRef.current.household) unsubRef.current.household()
      unsubRef.current = { profile: null, household: null }
    }
  }, [authUser?.uid])

  useEffect(() => {
    if (unsubRef.current.household) unsubRef.current.household()
    unsubRef.current.household = null
    setHousehold(null)

    if (!profile?.householdId) return

    const householdRef = doc(db, 'households', profile.householdId)
    unsubRef.current.household = onSnapshot(householdRef, (snap) => {
      setHousehold(snap.exists() ? snap.data() : null)
    })

    return () => {
      if (unsubRef.current.household) unsubRef.current.household()
      unsubRef.current.household = null
    }
  }, [profile?.householdId])

  const allUsers = useMemo(() => household?.people || {}, [household?.people])

  const user = useMemo(() => {
    if (!profile?.name) return null
    return { id: profile.name, role: profile.role }
  }, [profile?.name, profile?.role])

  const selectedAccount = ACCOUNTS[(loginId || '').trim()]

  const ensureProfile = async (rawId) => {
    const account = ACCOUNTS[rawId]
    if (!account || !auth.currentUser?.uid) return

    const people = Object.fromEntries(
      Object.entries(ACCOUNTS).map(([id, info]) => [info.name, { role: info.role, loginId: id }])
    )

    await setDoc(
      doc(db, 'users', auth.currentUser.uid),
      {
        loginId: rawId,
        name: account.name,
        role: account.role,
        householdId: HOUSEHOLD_ID,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      },
      { merge: true }
    )

    await setDoc(
      doc(db, 'households', HOUSEHOLD_ID),
      {
        people,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      },
      { merge: true }
    )

    await setDoc(
      doc(db, 'households', HOUSEHOLD_ID, 'kids', account.name),
      {
        role: account.role,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    )
  }

  const handleLogin = async () => {
    const rawId = (loginId || '').trim()
    if (!rawId || !loginPw) {
      setMessage('아이디와 비밀번호를 입력해 주세요.')
      return
    }

    if (!ACCOUNTS[rawId]) {
      setMessage('가족용으로 정한 아이디만 로그인할 수 있어요.')
      return
    }

    setBusy(true)
    setMessage('')
    try {
      await signInWithEmailAndPassword(auth, normalizeIdToEmail(rawId), loginPw)
      await ensureProfile(rawId)
    } catch (error) {
      console.error(error)
      setMessage('로그인에 실패했어요. 비밀번호를 한 번 더 확인해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  const handleRegister = async () => {
    const rawId = (loginId || '').trim()
    if (!rawId || !loginPw) {
      setMessage('아이디와 비밀번호를 입력해 주세요.')
      return
    }

    if (!ACCOUNTS[rawId]) {
      setMessage('이 앱에서는 정해진 3개 아이디만 사용할 수 있어요.')
      return
    }

    setBusy(true)
    setMessage('')
    try {
      await createUserWithEmailAndPassword(auth, normalizeIdToEmail(rawId), loginPw)
      await ensureProfile(rawId)
      setMessage('계정이 만들어졌어요. 이제 같은 아이디로 로그인하면 돼요.')
      setMode('login')
    } catch (error) {
      console.error(error)
      setMessage('계정 생성에 실패했어요. 이미 계정이 있거나 비밀번호가 너무 짧을 수 있어요.')
    } finally {
      setBusy(false)
    }
  }

  const handleChangePassword = async (currentPassword, nextPassword) => {
    if (!auth.currentUser || !profile?.loginId) {
      return { ok: false, message: '로그인 상태를 다시 확인해 주세요.' }
    }

    try {
      const credential = EmailAuthProvider.credential(
        normalizeIdToEmail(profile.loginId),
        currentPassword
      )
      await reauthenticateWithCredential(auth.currentUser, credential)
      await updatePassword(auth.currentUser, nextPassword)
      return { ok: true, message: '비밀번호가 바뀌었어요.' }
    } catch (error) {
      console.error(error)
      if (error?.code === 'auth/invalid-credential' || error?.code === 'auth/wrong-password') {
        return { ok: false, message: '현재 비밀번호가 맞지 않아요.' }
      }
      if (error?.code === 'auth/weak-password') {
        return { ok: false, message: '새 비밀번호는 6자 이상으로 해 주세요.' }
      }
      return { ok: false, message: '비밀번호 변경에 실패했어요. 잠시 후 다시 시도해 주세요.' }
    }
  }

  const handleLogout = async () => {
    await signOut(auth)
  }

  if (!authUser?.uid || !user) {
    return (
      <div className="login-shell">
        <div className="login-spark login-spark-a" />
        <div className="login-spark login-spark-b" />
        <div className="login-spark login-spark-c" />

        <div className="login-layout">
          <section className="login-hero">
            <div className="login-title-chip">우리 가족 시간표</div>
            <h1 className="login-title">귀엽고 쉽게, 매일 보는 스케줄</h1>
            <p className="login-copy">
              엄마와 아이들이 같은 화면을 보면서 오늘 할 일을 챙길 수 있게 만들었어요.
              먼저 내 카드를 누르고 비밀번호만 입력하면 됩니다.
            </p>

            <div className="account-grid">
              {Object.entries(ACCOUNTS).map(([id, info]) => (
                <button
                  key={id}
                  type="button"
                  className={`account-card ${loginId === id ? 'account-card-active' : ''}`}
                  style={{ background: info.background }}
                  onClick={() => {
                    setLoginId(id)
                    setMessage('')
                  }}
                >
                  <div className="account-badge" style={{ color: info.accent }}>
                    {info.badge}
                  </div>
                  <div className="account-name">{info.name}</div>
                  <div className="account-id">{id}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="login-panel glass">
            <div className="login-panel-inner">
              <div className="login-panel-tabs">
                <button className={mode === 'login' ? 'btn-primary' : 'btn-secondary'} onClick={() => setMode('login')}>
                  로그인
                </button>
                <button className={mode === 'register' ? 'btn-primary' : 'btn-secondary'} onClick={() => setMode('register')}>
                  처음 계정 만들기
                </button>
              </div>

              <div className="login-panel-box">
                <div className="login-panel-heading">
                  {mode === 'login' ? '어서 와, 오늘도 반가워' : '처음 한 번만 비밀번호 만들기'}
                </div>
                <div className="login-panel-subtext">
                  아이디는 고정이에요. 카드 선택 후 비밀번호만 입력하면 됩니다.
                </div>

                <div className="login-input-stack">
                  <input className="input-field cute-input" placeholder="아이디" value={loginId} onChange={(e) => setLoginId(e.target.value)} />
                  <input className="input-field cute-input" placeholder="비밀번호" type="password" value={loginPw} onChange={(e) => setLoginPw(e.target.value)} />
                </div>

                {selectedAccount && (
                  <div className="login-hint">
                    선택한 계정: <strong>{selectedAccount.name}</strong>
                  </div>
                )}

                {message && (
                  <div className={`login-message ${message.includes('실패') || message.includes('맞지') || message.includes('정해진') ? 'login-message-error' : 'login-message-ok'}`}>
                    {message}
                  </div>
                )}

                <button className="login-submit" disabled={busy} onClick={mode === 'login' ? handleLogin : handleRegister}>
                  {busy ? '잠깐만 기다려 줘' : mode === 'login' ? '로그인하기' : '계정 만들기'}
                </button>

                <div className="login-mini-note">
                  비밀번호를 바꾸고 싶을 때는 로그인 후 `설정`에서 직접 바꿀 수 있어요.
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    )
  }

  return (
    <Dashboard
      user={user}
      onLogout={handleLogout}
      onUpdateUser={() => {}}
      onChangePassword={handleChangePassword}
      allUsers={allUsers}
      cloud={{ db, householdId: HOUSEHOLD_ID }}
    />
  )
}
