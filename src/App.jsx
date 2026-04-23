import React, { useEffect, useRef, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import Dashboard from './Dashboard.jsx'
import { auth, db } from './firebase'

export default function App() {
  const [authUser, setAuthUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [household, setHousehold] = useState(null)
  const [loading, setLoading] = useState(true)
  
  const [loginId, setLoginId] = useState('')
  const [loginPw, setLoginPw] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const unsubRef = useRef({ profile: null, household: null })

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setAuthUser(u || null)
      if (!u) { setLoading(false); setProfile(null); setHousehold(null); }
    })
  }, [])

  useEffect(() => {
    if (unsubRef.current.profile) unsubRef.current.profile()
    if (!authUser?.uid) return
    const ref = doc(db, 'users', authUser.uid)
    unsubRef.current.profile = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setProfile(data)
        if (!data.householdId) setLoading(false)
      } else { setProfile(null); setLoading(false); }
    }, () => setLoading(false))
  }, [authUser?.uid])

  useEffect(() => {
    if (unsubRef.current.household) unsubRef.current.household()
    if (!profile?.householdId) return
    const ref = doc(db, 'households', profile.householdId)
    unsubRef.current.household = onSnapshot(ref, (snap) => {
      if (snap.exists()) setHousehold(snap.data())
      setLoading(false)
    }, () => setLoading(false))
  }, [profile?.householdId])

  const handleLogin = async () => {
    if (!loginId || !loginPw) { setMessage('정보를 입력해 주세요.'); return }
    setBusy(true); setMessage('')
    try {
      // Compatibility for legacy SJH-SGB accounts
      const email = `${loginId.trim().toLowerCase()}@kidschedule.local`
      await signInWithEmailAndPassword(auth, email, loginPw)
    } catch (e) { setMessage('로그인 실패!') } finally { setBusy(false) }
  }

  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff4d6d', fontWeight: 'bold' }}>정보를 불러오는 중... 🌷</div>

  if (!authUser || !profile) {
    return (
      <div style={{ padding: '40px 20px', maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ color: '#ff4d6d', fontSize: '24px', fontWeight: '900', marginBottom: '30px' }}>지희 가빈 스케줄</h1>
        <div style={{ display: 'grid', gap: '10px' }}>
            <input style={{ padding: '15px', borderRadius: '12px', border: '1px solid #ddd' }} placeholder="아이디" value={loginId} onChange={e => setLoginId(e.target.value)} />
            <input style={{ padding: '15px', borderRadius: '12px', border: '1px solid #ddd' }} type="password" placeholder="비밀번호" value={loginPw} onChange={e => setLoginPw(e.target.value)} />
            <button onClick={handleLogin} disabled={busy} style={{ padding: '15px', background: '#ff4d6d', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold' }}>로그인</button>
            {message && <div style={{ color: 'red', fontSize: '13px' }}>{message}</div>}
        </div>
      </div>
    )
  }

  return (
    <Dashboard
      user={{ id: profile.name || profile.loginId, role: profile.role }}
      onLogout={() => { signOut(auth); setLoading(false); }}
      allUsers={household?.people || {}}
      cloud={{ db, householdId: profile.householdId }}
    />
  )
}
