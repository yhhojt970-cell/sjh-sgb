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

  // --- FORCE LOAD FALLBACK (3 Seconds) ---
  useEffect(() => {
    if (loading) {
      const t = setTimeout(() => {
        console.log("Force loading entry...")
        setLoading(false)
      }, 3000)
      return () => clearTimeout(t)
    }
  }, [loading])

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
      } else { setLoading(false); }
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
    if (!loginId || !loginPw) { setMessage('아이디와 비밀번호를 입력하세요.'); return }
    setBusy(true); setMessage('')
    try {
      const email = `${loginId.trim().toLowerCase()}@kidschedule.local`
      await signInWithEmailAndPassword(auth, email, loginPw)
    } catch (e) { setMessage('로그인 정보를 확인해 주세요!') } finally { setBusy(false) }
  }

  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff4d6d', fontWeight: 'bold', background: '#fff5f7' }}>잠시만 기다려 주세요... 🌷</div>

  if (!authUser || !profile) {
    return (
      <div style={{ padding: '60px 20px', maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ color: '#ff4d6d', fontSize: '28px', fontWeight: '900', marginBottom: '40px' }}>지희 가빈 스케줄</h1>
        <div style={{ display: 'grid', gap: '12px' }}>
            <input style={{ padding: '16px', borderRadius: '15px', border: '1px solid #ffdeeb', outline: 'none' }} placeholder="아이디" value={loginId} onChange={e => setLoginId(e.target.value)} />
            <input style={{ padding: '16px', borderRadius: '15px', border: '1px solid #ffdeeb', outline: 'none' }} type="password" placeholder="비밀번호" value={loginPw} onChange={e => setLoginPw(e.target.value)} />
            <button onClick={handleLogin} disabled={busy} style={{ padding: '16px', background: '#ff4d6d', color: 'white', border: 'none', borderRadius: '15px', fontWeight: '900', fontSize: '18px', cursor: 'pointer' }}>로그인</button>
            {message && <div style={{ color: '#ff4d6d', fontSize: '14px', marginTop: '10px', fontWeight: 'bold' }}>{message}</div>}
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
