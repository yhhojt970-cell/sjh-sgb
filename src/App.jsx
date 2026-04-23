import React, { useEffect, useRef, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from 'firebase/auth'
import { doc, onSnapshot, serverTimestamp, setDoc, getDoc } from 'firebase/firestore'
import Dashboard from './Dashboard.jsx'
import { auth, db } from './firebase'

const normalizeIdToEmail = (id, familyId) => {
  const cleanId = (id || '').trim().toLowerCase()
  if (!familyId || familyId === 'SJH-SGB') return `${cleanId}@kidschedule.local`
  return `${cleanId}@${familyId.toLowerCase()}.local`
}

export default function App() {
  const [authUser, setAuthUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [household, setHousehold] = useState(null)
  const [loading, setLoading] = useState(true)
  
  const [mode, setMode] = useState('login')
  const [loginFamilyId, setLoginFamilyId] = useState('')
  const [loginId, setLoginId] = useState('')
  const [loginPw, setLoginPw] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const unsubRef = useRef({ profile: null, household: null })

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setAuthUser(u || null)
      if (!u) {
        setLoading(false)
        setProfile(null)
        setHousehold(null)
      }
    })
  }, [])

  useEffect(() => {
    if (unsubRef.current.profile) unsubRef.current.profile()
    setProfile(null)
    if (!authUser?.uid) return

    const ref = doc(db, 'users', authUser.uid)
    unsubRef.current.profile = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setProfile(data)
        if (!data.householdId) setLoading(false)
      } else {
        setProfile(null)
        setLoading(false)
      }
    }, () => setLoading(false))

    return () => { if (unsubRef.current.profile) unsubRef.current.profile() }
  }, [authUser?.uid])

  useEffect(() => {
    if (unsubRef.current.household) unsubRef.current.household()
    setHousehold(null)
    if (!profile?.householdId) return

    const ref = doc(db, 'households', profile.householdId)
    unsubRef.current.household = onSnapshot(ref, (snap) => {
      if (snap.exists()) setHousehold(snap.data())
      setLoading(false)
    }, () => setLoading(false))

    return () => { if (unsubRef.current.household) unsubRef.current.household() }
  }, [profile?.householdId])

  const handleLogin = async () => {
    if (!loginFamilyId || !loginId || !loginPw) { setMessage('모든 정보를 입력해 주세요.'); return }
    setBusy(true); setMessage('')
    try {
      await signInWithEmailAndPassword(auth, normalizeIdToEmail(loginId, loginFamilyId), loginPw)
    } catch (e) { 
      console.error(e); setMessage('로그인 실패! 코드나 비번을 확인해 주세요.') 
    } finally { setBusy(false) }
  }

  const handleCreateFamily = async () => {
    if (!loginId || !loginPw || !familyName) { setMessage('정보를 모두 입력해 주세요.'); return }
    setBusy(true)
    try {
      const familyId = Math.random().toString(36).substr(2, 6).toUpperCase()
      const userRes = await createUserWithEmailAndPassword(auth, normalizeIdToEmail(loginId, familyId), loginPw)
      await setDoc(doc(db, 'households', familyId), { id: familyId, name: familyName, adminUid: userRes.user.uid, people: { [loginId]: { role: 'admin', loginId, displayName: '엄마' } }, createdAt: serverTimestamp() })
      await setDoc(doc(db, 'users', userRes.user.uid), { uid: userRes.user.uid, loginId, householdId: familyId, role: 'admin', name: loginId, displayName: '엄마', createdAt: serverTimestamp() })
    } catch (e) { setMessage('방 만들기 실패!') } finally { setBusy(false) }
  }

  if (loading) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 'bold', color: '#ff4d6d' }}>잠시만 기다려 주세요... 🌷</div>
  }

  if (!authUser || !profile) {
    return (
      <div style={{ padding: '40px 20px', maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ color: '#ff4d6d', marginBottom: '30px' }}>우리 가족 스케줄</h1>
        <div style={{ display: 'flex', gap: '5px', marginBottom: '20px' }}>
            <button onClick={() => setMode('login')} style={{ flex: 1, padding: '10px', background: mode === 'login' ? '#ff4d6d' : '#eee', color: mode === 'login' ? 'white' : 'black', border: 'none', borderRadius: '10px' }}>로그인</button>
            <button onClick={() => setMode('create')} style={{ flex: 1, padding: '10px', background: mode === 'create' ? '#ff4d6d' : '#eee', color: mode === 'create' ? 'white' : 'black', border: 'none', borderRadius: '10px' }}>방 만들기</button>
        </div>
        <div style={{ display: 'grid', gap: '10px' }}>
            {mode === 'login' && <input style={{ padding: '15px', borderRadius: '10px', border: '1px solid #ddd' }} placeholder="가족 코드 (예: SJH-SGB)" value={loginFamilyId} onChange={e => setLoginFamilyId(e.target.value.toUpperCase())} />}
            {mode === 'create' && <input style={{ padding: '15px', borderRadius: '10px', border: '1px solid #ddd' }} placeholder="가족 이름" value={familyName} onChange={e => setFamilyName(e.target.value)} />}
            <input style={{ padding: '15px', borderRadius: '10px', border: '1px solid #ddd' }} placeholder="아이디" value={loginId} onChange={e => setLoginId(e.target.value)} />
            <input style={{ padding: '15px', borderRadius: '10px', border: '1px solid #ddd' }} type="password" placeholder="비밀번호" value={loginPw} onChange={e => setLoginPw(e.target.value)} />
            <button onClick={mode === 'login' ? handleLogin : handleCreateFamily} disabled={busy} style={{ padding: '15px', background: '#ff4d6d', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>{busy ? '처리 중...' : '확인'}</button>
            {message && <div style={{ color: 'red', fontSize: '13px' }}>{message}</div>}
        </div>
      </div>
    )
  }

  return (
    <Dashboard
      user={{ id: profile.name || profile.loginId, role: profile.role }}
      onLogout={() => { setLoading(true); signOut(auth); }}
      allUsers={household?.people || {}}
      cloud={{ db, householdId: profile.householdId }}
    />
  )
}
