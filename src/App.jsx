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
  'yhhojt970': { name: '엄마', role: 'admin', badge: 'Manager', mascot: '👩‍🏫', background: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)', accent: '#e11d48', displayName: '엄마' },
  'sjh123': { name: '손지희', role: 'child', badge: 'Student', mascot: '🌸', background: 'linear-gradient(135deg, #fff5f7 0%, #fff0f3 100%)', accent: '#db2777', displayName: '손지희' },
  'sgb456': { name: '손가빈', role: 'child', badge: 'Student', mascot: '🐥', background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', accent: '#d97706', displayName: '손가빈' }
}

const normalizeIdToEmail = (id) => `${id.trim().toLowerCase()}@kidschedule.local`

export default function App() {
  const [authUser, setAuthUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [allUsers, setAllUsers] = useState({})
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('login') 
  const [loginId, setLoginId] = useState('')
  const [loginPw, setLoginPw] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const unsubRef = useRef({ profile: null, household: null })

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setAuthUser(nextUser || null)
      if (!nextUser) {
        setLoading(false)
        setProfile(null)
      }
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (unsubRef.current.profile) unsubRef.current.profile()
    if (unsubRef.current.household) unsubRef.current.household()
    unsubRef.current = { profile: null, household: null }
    setProfile(null)
    setAllUsers({})

    if (!authUser?.uid) return

    const profileRef = doc(db, 'users', authUser.uid)
    unsubRef.current.profile = onSnapshot(profileRef, (snap) => {
      if (snap.exists()) {
        setProfile(snap.data())
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    const householdRef = doc(db, 'households', HOUSEHOLD_ID)
    unsubRef.current.household = onSnapshot(householdRef, (snap) => {
      if (snap.exists()) {
        setAllUsers(snap.data().people || {})
      }
      setLoading(false)
    })

    return () => {
      if (unsubRef.current.profile) unsubRef.current.profile()
      if (unsubRef.current.household) unsubRef.current.household()
    }
  }, [authUser?.uid])

  const user = useMemo(() => {
    if (!profile?.name) return null
    return { id: profile.name, role: profile.role }
  }, [profile?.name, profile?.role])

  const handleLogin = async () => {
    const rawId = (loginId || '').trim()
    if (!rawId || !loginPw) {
      setMessage('카드 선택 후 비밀번호를 입력해 주세요.')
      return
    }
    setBusy(true); setMessage('')
    try {
      await signInWithEmailAndPassword(auth, normalizeIdToEmail(rawId), loginPw)
    } catch (error) {
      setMessage('로그인 실패! 비밀번호를 확인해 주세요.')
    } finally { setBusy(false) }
  }

  const handleRegister = async () => {
    const rawId = (loginId || '').trim()
    if (!rawId || !loginPw) { setMessage('카드 선택 후 비밀번호를 입력해 주세요.'); return }
    setBusy(true); setMessage('')
    try {
      const userRes = await createUserWithEmailAndPassword(auth, normalizeIdToEmail(rawId), loginPw)
      const acc = ACCOUNTS[rawId]
      await setDoc(doc(db, 'users', userRes.user.uid), {
        uid: userRes.user.uid, loginId: rawId, householdId: HOUSEHOLD_ID,
        role: acc.role, name: acc.name, createdAt: serverTimestamp()
      })
      setMessage('계정 생성 성공! 이제 로그인 하세요.'); setMode('login')
    } catch (error) { setMessage('실패! 이미 계정이 있을 수 있습니다.'); } finally { setBusy(false) }
  }

  if (loading) return <div style={{height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'#ff4d6d', fontWeight:'bold'}}>로딩 중... 🌷</div>

  if (!authUser?.uid || !user) {
    return (
      <div className="login-shell">
        <div className="login-layout">
          <section className="login-hero">
            <h1 className="login-title">우리 가족 시간표</h1>
            <div className="account-grid">
              {Object.entries(ACCOUNTS).map(([id, info]) => (
                <button key={id} className={`account-card ${loginId === id ? 'account-card-active' : ''}`} style={{ background: info.background }} onClick={() => setLoginId(id)}>
                  <div className="account-mascot">{info.mascot}</div>
                  <div className="account-name">{info.displayName}</div>
                </button>
              ))}
            </div>
          </section>
          <section className="login-panel glass">
            <div className="login-panel-tabs">
                <button className={mode === 'login' ? 'btn-primary' : 'btn-secondary'} onClick={() => setMode('login')}>로그인</button>
                <button className={mode === 'register' ? 'btn-primary' : 'btn-secondary'} onClick={() => setMode('register')}>계정 만들기</button>
            </div>
            <div className="login-panel-box">
              <input className="input-field cute-input" placeholder="비밀번호" type="password" value={loginPw} onChange={(e) => setLoginPw(e.target.value)} />
              {message && <div style={{color:'#ff4d6d', fontSize:'12px', marginTop:'10px'}}>{message}</div>}
              <button className="login-submit" disabled={busy} onClick={mode === 'login' ? handleLogin : handleRegister}>{busy ? '잠깐만...' : '들어가기'}</button>
            </div>
          </section>
        </div>
      </div>
    )
  }

  return (
    <Dashboard
      user={user}
      onLogout={() => signOut(auth)}
      allUsers={allUsers}
      cloud={{ db, householdId: HOUSEHOLD_ID }}
    />
  )
}
