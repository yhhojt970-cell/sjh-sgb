import React, { useEffect, useMemo, useRef, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import Dashboard from './Dashboard.jsx'
import { auth, db } from './firebase'

// ORIGINAL ACCOUNT MAPPING FOR SJH-SGB
const ACCOUNTS = {
  yhhojt970: { name: '엄마', displayName: '엄마', mascot: '🌷', role: 'admin', badge: '관리자' },
  sjh150717: { name: '지희', displayName: '손지희', mascot: '🫧', role: 'child', badge: '지희' },
  sgb170101: { name: '가빈', displayName: '손가빈', mascot: '🐱', role: 'child', badge: '가빈' }
}

export default function App() {
  const [authUser, setAuthUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [household, setHousehold] = useState(null)

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
        // If user has a householdId, we use it. Otherwise default to SJH-SGB
        const hid = data.householdId || 'SJH-SGB'
        onSnapshot(doc(db, 'households', hid), (hSnap) => {
           if (hSnap.exists()) setHousehold(hSnap.data())
           setLoading(false)
        })
      } else { setLoading(false); }
    }, () => setLoading(false))
  }, [authUser?.uid])

  const handleLogin = async (loginId) => {
    const pw = prompt(`${ACCOUNTS[loginId].name}님, 비밀번호를 입력하세요.`)
    if (!pw) return
    try {
      const email = `${loginId.toLowerCase()}@kidschedule.local`
      await signInWithEmailAndPassword(auth, email, pw)
    } catch (e) { alert('비밀번호가 틀렸어요!') }
  }

  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff4d6d', fontWeight: 'bold' }}>🌷 아이들의 기록을 불러오는 중...</div>

  if (!authUser || !profile) {
    return (
      <div style={{ padding: '60px 20px', maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ color: '#ff4d6d', marginBottom: '40px', fontWeight: '900' }}>지희 가빈 스케줄</h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
          {Object.entries(ACCOUNTS).map(([id, info]) => (
            <div key={id} onClick={() => handleLogin(id)} style={{ padding: '20px', background: 'white', borderRadius: '20px', border: '1px solid #ffdeeb', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '40px', marginBottom: '10px' }}>{info.mascot}</div>
              <div style={{ fontWeight: 'bold' }}>{info.name}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <Dashboard
      user={{ id: profile.loginId || profile.name, role: profile.role }}
      onLogout={() => { signOut(auth); setLoading(false); }}
      allUsers={household?.people || ACCOUNTS}
      cloud={{ db, householdId: profile.householdId || 'SJH-SGB' }}
    />
  )
}
