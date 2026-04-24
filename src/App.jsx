import React, { useEffect, useMemo, useRef, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import Dashboard from './Dashboard.jsx'
import { auth, db } from './firebase'

const HOUSEHOLD_ID = 'SJH-SGB'

const ACCOUNTS = {
  yhhojt970: { name: '엄마', displayName: '엄마', mascot: '🌷', role: 'admin', accent: '#ff8fb1' },
  sjh150717: { name: '지희', displayName: '손지희', mascot: '🌸', role: 'child', accent: '#7c9cff' },
  sgb170101: { name: '가빈', displayName: '손가빈', mascot: '🐱', role: 'child', accent: '#42c99b' }
}

const ACCOUNT_NAME_ALIASES = Object.fromEntries(
  Object.entries(ACCOUNTS).flatMap(([loginId, info]) => [
    [info.name, loginId],
    [info.displayName, loginId]
  ])
)

export default function App() {
  const [authUser, setAuthUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [household, setHousehold] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const unsubRef = useRef({ profile: null, household: null })

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setAuthUser(nextUser || null)
      setLoading(!!nextUser)

      if (!nextUser) {
        if (unsubRef.current.profile) unsubRef.current.profile()
        if (unsubRef.current.household) unsubRef.current.household()
        unsubRef.current = { profile: null, household: null }
        setProfile(null)
        setHousehold(null)
      }
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
    unsubRef.current.profile = onSnapshot(
      profileRef,
      (snap) => {
        setProfile(snap.exists() ? snap.data() : null)
        if (!snap.exists()) setLoading(false)
      },
      () => setLoading(false)
    )

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

    const householdId = profile?.householdId || HOUSEHOLD_ID
    if (!authUser?.uid || !householdId) return

    const householdRef = doc(db, 'households', householdId)
    unsubRef.current.household = onSnapshot(
      householdRef,
      (snap) => {
        setHousehold(snap.exists() ? snap.data() : null)
        setLoading(false)
      },
      () => setLoading(false)
    )

    return () => {
      if (unsubRef.current.household) unsubRef.current.household()
      unsubRef.current.household = null
    }
  }, [authUser?.uid, profile?.householdId])

  const allUsers = useMemo(() => {
    const people = household?.people || {}

    return Object.fromEntries(
      Object.entries(ACCOUNTS).map(([loginId, info]) => {
        const matchedEntry = Object.entries(people).find(([personName, person]) => {
          const matchedLoginId = person?.loginId || ACCOUNT_NAME_ALIASES[personName]
          return matchedLoginId === loginId || personName === info.name || personName === info.displayName
        })

        return [
          loginId,
          {
            role: matchedEntry?.[1]?.role || info.role,
            loginId,
            name: info.name,
            displayName: info.displayName,
            mascot: info.mascot,
            accent: info.accent
          }
        ]
      })
    )
  }, [household?.people])

  const user = useMemo(() => {
    if (!profile) return null
    const mappedName = ACCOUNTS[profile.loginId]?.name || profile.name
    return mappedName ? { id: mappedName, role: profile.role } : null
  }, [profile])

  const handleLogin = async () => {
    const loginId = (selectedId || '').trim()
    if (!loginId || !password) return

    setBusy(true)
    try {
      await signInWithEmailAndPassword(auth, `${loginId.toLowerCase()}@kidschedule.local`, password)
    } catch (error) {
      console.error(error)
      alert('비밀번호가 틀렸어요. 다시 확인해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  const handleLogout = async () => {
    await signOut(auth)
    setPassword('')
    setSelectedId('')
  }

  const globalBgStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #fff9e6 0%, #fff0f3 100%)',
    transition: 'all 0.5s ease'
  }

  if (loading) {
    return (
      <div style={{ ...globalBgStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff4d6d', fontWeight: 900, fontSize: '18px' }}>
        🌷 따뜻한 공간으로 이동 중...
      </div>
    )
  }

  if (!authUser?.uid || !user) {
    return (
      <div style={globalBgStyle}>
        <div style={{ padding: '60px 20px', maxWidth: '450px', margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ color: '#ff4d6d', marginBottom: '10px', fontWeight: 900, fontSize: '28px' }}>지희 가빈 스케줄</h1>
          <p style={{ color: '#999', fontSize: '14px', marginBottom: '40px' }}>오늘도 우리 가족의 소중한 하루를 기록해요!</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '30px' }}>
            {Object.entries(ACCOUNTS).map(([id, info]) => (
              <div
                key={id}
                onClick={() => setSelectedId(id)}
                style={{
                  padding: '20px 10px',
                  background: 'white',
                  borderRadius: '24px',
                  border: selectedId === id ? `3px solid ${info.accent}` : '1px solid #ffdeeb',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: selectedId === id ? `0 8px 20px ${info.accent}30` : '0 4px 12px rgba(0,0,0,0.05)',
                  transform: selectedId === id ? 'translateY(-5px)' : 'none'
                }}
              >
                <div style={{ fontSize: '42px', marginBottom: '10px' }}>{info.mascot}</div>
                <div style={{ fontWeight: 900, fontSize: '15px', color: '#333' }}>{info.displayName}</div>
              </div>
            ))}
          </div>

          {selectedId && (
            <div className="animate-fade-in" style={{ background: 'white', padding: '25px', borderRadius: '24px', border: '1px solid #ffdeeb', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
              <div style={{ fontWeight: 900, marginBottom: '15px', color: '#333' }}>
                {ACCOUNTS[selectedId].displayName}, 비밀번호를 입력하세요
              </div>
              <input
                type="password"
                className="input-field"
                placeholder="비밀번호 입력"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                autoFocus
                style={{ textAlign: 'center', fontSize: '20px', letterSpacing: '5px', marginBottom: '15px' }}
              />
              <button onClick={handleLogin} disabled={busy} className="btn-primary" style={{ width: '100%', padding: '15px', fontSize: '18px' }}>
                {busy ? '로그인 중...' : '시작하기'}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={globalBgStyle}>
      <Dashboard
        user={user}
        onLogout={handleLogout}
        allUsers={allUsers}
        cloud={{ db, householdId: profile?.householdId || HOUSEHOLD_ID }}
      />
    </div>
  )
}
