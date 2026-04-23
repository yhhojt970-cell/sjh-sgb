import React, { useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import Dashboard from './Dashboard.jsx'
import { auth, db } from './firebase'

const ACCOUNTS = {
  yhhojt970: { name: '엄마', displayName: '엄마', mascot: '🌷', role: 'admin', accent: '#ff8fb1' },
  sjh150717: { name: '손지희', displayName: '손지희', mascot: '🫧', role: 'child', accent: '#7c9cff' },
  sgb170101: { name: '손가빈', displayName: '손가빈', mascot: '🐱', role: 'child', accent: '#42c99b' }
}

export default function App() {
  const [authUser, setAuthUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [household, setHousehold] = useState(null)
  
  const [selectedId, setSelectedId] = useState(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => { if (loading) setLoading(false) }, 3000)
    return () => clearTimeout(t)
  }, [loading])

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setAuthUser(u || null)
      if (!u) { setLoading(false); setProfile(null); setHousehold(null); }
    })
  }, [])

  useEffect(() => {
    if (!authUser?.uid) return
    const ref = doc(db, 'users', authUser.uid)
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setProfile(data)
        const hid = data.householdId || 'SJH-SGB'
        onSnapshot(doc(db, 'households', hid), (hSnap) => {
           if (hSnap.exists()) setHousehold(hSnap.data())
           setLoading(false)
        })
      } else { setLoading(false); }
    }, () => setLoading(false))
  }, [authUser?.uid])

  const handleLogin = async () => {
    if (!selectedId || !password) return
    setBusy(true)
    try {
      const email = `${selectedId.toLowerCase()}@kidschedule.local`
      await signInWithEmailAndPassword(auth, email, password)
    } catch (e) { 
      alert('비밀번호가 틀렸어요! 다시 확인해 주세요.') 
    } finally {
      setBusy(false)
    }
  }

  const globalBgStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #fff9e6 0%, #fff0f3 100%)',
    transition: 'all 0.5s ease'
  }

  if (loading) return (
    <div style={{ ...globalBgStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff4d6d', fontWeight: '900', fontSize: '18px' }}>
      🌷 따뜻한 공간으로 이동 중...
    </div>
  )

  if (!authUser || !profile) {
    return (
      <div style={globalBgStyle}>
        <div style={{ padding: '60px 20px', maxWidth: '450px', margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ color: '#ff4d6d', marginBottom: '10px', fontWeight: '900', fontSize: '28px' }}>지희 가빈 스케줄</h1>
          <p style={{ color: '#999', fontSize: '14px', marginBottom: '40px' }}>오늘도 우리 가족의 소중한 하루를 기록해요!</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '30px' }}>
            {Object.entries(ACCOUNTS).map(([id, info]) => (
              <div key={id} onClick={() => setSelectedId(id)} style={{ padding: '20px 10px', background: 'white', borderRadius: '24px', border: selectedId === id ? `3px solid ${info.accent}` : '1px solid #ffdeeb', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: selectedId === id ? `0 8px 20px ${info.accent}30` : '0 4px 12px rgba(0,0,0,0.05)', transform: selectedId === id ? 'translateY(-5px)' : 'none' }}>
                <div style={{ fontSize: '42px', marginBottom: '10px' }}>{info.mascot}</div>
                <div style={{ fontWeight: '900', fontSize: '15px', color: '#333' }}>{info.name}</div>
              </div>
            ))}
          </div>

          {selectedId && (
            <div className="animate-fade-in" style={{ background: 'white', padding: '25px', borderRadius: '24px', border: '1px solid #ffdeeb', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
              <div style={{ fontWeight: '900', marginBottom: '15px', color: '#333' }}>{ACCOUNTS[selectedId].name}님, 비밀번호를 입력하세요 🌷</div>
              <input type="password" className="input-field" placeholder="비밀번호 입력" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} autoFocus style={{ textAlign: 'center', fontSize: '20px', letterSpacing: '5px', marginBottom: '15px' }} />
              <button onClick={handleLogin} disabled={busy} className="btn-primary" style={{ width: '100%', padding: '15px', fontSize: '18px' }}>{busy ? '로그인 중...' : '시작하기'}</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={globalBgStyle}>
      <Dashboard
        user={{ id: profile.loginId || profile.name, role: profile.role }}
        onLogout={() => { signOut(auth); setLoading(false); setPassword(''); setSelectedId(null); }}
        allUsers={household?.people || ACCOUNTS}
        cloud={{ db, householdId: profile.householdId || 'SJH-SGB' }}
      />
    </div>
  )
}
