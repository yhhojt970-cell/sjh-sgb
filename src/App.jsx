import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import Dashboard from './Dashboard.jsx'
import { auth, db } from './firebase'

const HOUSEHOLD_ID = 'SJH-SGB'

const ACCOUNTS = {
  yhhojt970: { name: '엄마', role: 'admin' },
  sjh150717: { name: '손지희', role: 'child' },
  sgb170101: { name: '손가빈', role: 'child' }
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
        people: {
          ...Object.fromEntries(Object.entries(ACCOUNTS).map(([id, info]) => [info.name, { role: info.role, loginId: id }]))
        },
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
      setMessage('허용된 아이디만 로그인할 수 있어요.')
      return
    }

    setBusy(true)
    setMessage('')
    try {
      await signInWithEmailAndPassword(auth, normalizeIdToEmail(rawId), loginPw)
      await ensureProfile(rawId)
    } catch (error) {
      console.error(error)
      setMessage('로그인에 실패했어요. 아이디나 비밀번호를 확인해 주세요.')
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
      setMessage('계정이 만들어졌어요. 이제 이 아이디로 로그인하면 됩니다.')
      setMode('login')
    } catch (error) {
      console.error(error)
      setMessage('계정 생성에 실패했어요. 이미 만들어진 아이디일 수 있어요.')
    } finally {
      setBusy(false)
    }
  }

  const handleLogout = async () => {
    await signOut(auth)
  }

  if (!authUser?.uid || !user) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px' }}>
        <div className="glass" style={{ width: 'min(520px, 100%)', padding: '24px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '900', marginBottom: '10px' }}>가족 스케줄 로그인</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            아이디는 3개만 사용합니다. `yhhojt970`, `sjh150717`, `sgb170101`
          </p>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <button className={mode === 'login' ? 'btn-primary' : 'btn-secondary'} onClick={() => setMode('login')}>
              로그인
            </button>
            <button className={mode === 'register' ? 'btn-primary' : 'btn-secondary'} onClick={() => setMode('register')}>
              처음 계정 만들기
            </button>
          </div>

          <div style={{ display: 'grid', gap: '10px' }}>
            <input className="input-field" placeholder="아이디" value={loginId} onChange={(e) => setLoginId(e.target.value)} />
            <input className="input-field" placeholder="비밀번호" type="password" value={loginPw} onChange={(e) => setLoginPw(e.target.value)} />
          </div>

          {selectedAccount && (
            <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
              선택된 계정: {selectedAccount.name} ({selectedAccount.role === 'admin' ? '관리자' : '아이'})
            </div>
          )}

          {message && (
            <div style={{ marginTop: '12px', fontSize: '12px', fontWeight: '800', color: message.includes('실패') || message.includes('허용') ? '#ef4444' : 'var(--accent)' }}>
              {message}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
            {mode === 'login' ? (
              <button className="btn-primary" style={{ flex: 1, opacity: busy ? 0.7 : 1 }} disabled={busy} onClick={handleLogin}>
                로그인
              </button>
            ) : (
              <button className="btn-primary" style={{ flex: 1, opacity: busy ? 0.7 : 1 }} disabled={busy} onClick={handleRegister}>
                계정 만들기
              </button>
            )}
          </div>

          <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
            처음 한 번만 각자 계정을 만들고, 이후에는 같은 아이디/비밀번호로 로그인하면 됩니다.
          </div>
        </div>
      </div>
    )
  }

  return <Dashboard user={user} onLogout={handleLogout} onUpdateUser={() => {}} allUsers={allUsers} cloud={{ db, householdId: HOUSEHOLD_ID }} />
}
