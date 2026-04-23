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
import { doc, onSnapshot, serverTimestamp, setDoc, getDoc } from 'firebase/firestore'
import Dashboard from './Dashboard.jsx'
import { auth, db } from './firebase'
import { Star, User, Heart, ShieldCheck, Plus, LogIn, Users, Sparkles, X } from 'lucide-react'

// IMPORTANT: Keep existing accounts compatible
const normalizeIdToEmail = (id, familyId) => {
  const cleanId = id.trim().toLowerCase()
  // If it's the old SJH-SGB family or no familyId, use the old format
  if (!familyId || familyId === 'SJH-SGB') return `${cleanId}@kidschedule.local`
  // New families get their own domain suffix
  return `${cleanId}@${familyId.toLowerCase()}.local`
}

export default function App() {
  const [authUser, setAuthUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [household, setHousehold] = useState(null)
  const [mode, setMode] = useState('login') 
  const [loginFamilyId, setLoginFamilyId] = useState('')
  const [loginId, setLoginId] = useState('')
  const [loginPw, setLoginPw] = useState('')
  const [familyName, setFamilyName] = useState('')
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
    }
  }, [profile?.householdId])

  const handleCreateFamily = async () => {
    if (!loginId || !loginPw || !familyName) {
      setMessage('모든 항목을 입력해 주세요.')
      return
    }
    setBusy(true)
    try {
      const familyId = Math.random().toString(36).substr(2, 6).toUpperCase()
      const email = normalizeIdToEmail(loginId, familyId)
      
      const userRes = await createUserWithEmailAndPassword(auth, email, loginPw)
      const uid = userRes.user.uid

      await setDoc(doc(db, 'households', familyId), {
        id: familyId,
        name: familyName,
        adminUid: uid,
        people: {
          [loginId]: { role: 'admin', loginId, displayName: '엄마' }
        },
        createdAt: serverTimestamp()
      })

      await setDoc(doc(db, 'users', uid), {
        uid,
        loginId,
        householdId: familyId,
        role: 'admin',
        name: loginId,
        displayName: '엄마',
        createdAt: serverTimestamp()
      })

      setMessage(`가족 방 성공! 코드: ${familyId}`)
      alert(`우리 가족 코드: ${familyId}\n이 코드를 아이들에게 알려주세요!`)
    } catch (error) {
      console.error(error)
      setMessage('방 생성 실패! 이미 있는 아이디일 수 있습니다.')
    } finally { setBusy(false) }
  }

  const handleLogin = async () => {
    if (!loginFamilyId || !loginId || !loginPw) {
      setMessage('가족 코드, 아이디, 비밀번호를 입력해 주세요.')
      return
    }
    setBusy(true)
    try {
      const email = normalizeIdToEmail(loginId, loginFamilyId)
      await signInWithEmailAndPassword(auth, email, loginPw)
    } catch (error) {
      console.error(error)
      setMessage('로그인 실패! 코드나 비밀번호를 확인해 주세요.')
    } finally { setBusy(false) }
  }

  const handleRegister = async () => {
    if (!loginFamilyId || !loginId || !loginPw) {
      setMessage('정보를 모두 입력해 주세요.')
      return
    }
    setBusy(true)
    try {
      const houseSnap = await getDoc(doc(db, 'households', loginFamilyId))
      if (!houseSnap.exists()) {
        setMessage('존재하지 않는 가족 코드입니다.')
        setBusy(false); return
      }
      const houseData = houseSnap.data()
      const person = houseData.people[loginId]
      if (!person) {
        setMessage('엄마가 먼저 이름을 등록해줘야 가입할 수 있어요.')
        setBusy(false); return
      }

      const email = normalizeIdToEmail(loginId, loginFamilyId)
      const userRes = await createUserWithEmailAndPassword(auth, email, loginPw)
      
      await setDoc(doc(db, 'users', userRes.user.uid), {
        uid: userRes.user.uid,
        loginId,
        householdId: loginFamilyId,
        role: person.role || 'child',
        name: loginId,
        displayName: person.displayName || loginId,
        createdAt: serverTimestamp()
      })

      setMessage('가입 성공! 이제 로그인해 보세요.')
      setMode('login')
    } catch (error) {
      console.error(error)
      setMessage('가입 실패! 이미 계정이 있을 수 있습니다.')
    } finally { setBusy(false) }
  }

  const handleLogout = () => signOut(auth)

  const handleChangePassword = async (currentPassword, nextPassword) => {
    if (!auth.currentUser || !profile?.loginId || !profile?.householdId) return { ok: false, message: '오류 발생' }
    try {
      const credential = EmailAuthProvider.credential(normalizeIdToEmail(profile.loginId, profile.householdId), currentPassword)
      await reauthenticateWithCredential(auth.currentUser, credential)
      await updatePassword(auth.currentUser, nextPassword)
      return { ok: true, message: '비밀번호 변경 완료' }
    } catch (e) { return { ok: false, message: '비밀번호 변경 실패' } }
  }

  if (!authUser?.uid || !profile) {
    return (
      <div className="login-shell">
        <div className="login-spark login-spark-a" />
        <div className="login-spark login-spark-b" />
        <div className="login-layout">
          <section className="login-hero">
            <div className="login-title-chip">우리가족 스케줄러</div>
            <h1 className="login-title">함께 계획하고<br/>함께 성장해요</h1>
            <p className="login-copy">
              엄마와 아이가 소통하는 우리만의 공간입니다.<br/>
              가족 코드로 입장하여 오늘의 코인을 모아보세요!
            </p>
          </section>

          <section className="login-panel glass">
            <div className="login-panel-inner">
              <div className="login-panel-tabs">
                <button className={mode === 'login' ? 'btn-primary' : 'btn-secondary'} onClick={() => setMode('login')}>로그인</button>
                <button className={mode === 'register' ? 'btn-primary' : 'btn-secondary'} onClick={() => setMode('register')}>아이 가입</button>
                <button className={mode === 'createFamily' ? 'btn-primary' : 'btn-secondary'} onClick={() => setMode('createFamily')}>새 방 만들기</button>
              </div>

              <div className="login-panel-box">
                <div className="login-panel-heading">
                  {mode === 'login' ? '로그인' : mode === 'register' ? '아이 계정 만들기' : '새 가족 방 만들기'}
                </div>
                
                <div className="login-input-stack">
                  {(mode === 'login' || mode === 'register') && (
                    <div style={{ position: 'relative' }}>
                      <input className="input-field cute-input" placeholder="가족 코드 (SJH-SGB)" value={loginFamilyId} onChange={(e) => setLoginFamilyId(e.target.value.toUpperCase())} />
                      <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '9px', color: '#ff4d6d', fontWeight: '900' }}>코드 필수!</div>
                    </div>
                  )}
                  {mode === 'createFamily' && (
                    <input className="input-field cute-input" placeholder="가족 이름 (예: 지희네집)" value={familyName} onChange={(e) => setFamilyName(e.target.value)} />
                  )}
                  <input className="input-field cute-input" placeholder="아이디" value={loginId} onChange={(e) => setLoginId(e.target.value)} />
                  <input className="input-field cute-input" placeholder="비밀번호" type="password" value={loginPw} onChange={(e) => setLoginPw(e.target.value)} />
                </div>

                {message && (
                  <div className={`login-message ${message.includes('실패') || message.includes('않는') ? 'login-message-error' : 'login-message-ok'}`}>
                    {message}
                  </div>
                )}

                <button className="login-submit" disabled={busy} onClick={mode === 'login' ? handleLogin : mode === 'register' ? handleRegister : handleCreateFamily}>
                  {busy ? '처리 중...' : mode === 'login' ? '로그인하기' : mode === 'register' ? '계정 만들기' : '가족 방 만들기'}
                </button>

                <div className="login-mini-note">
                  {mode === 'login' ? '가족 코드는 엄마에게 물어보세요! (기존: SJH-SGB)' : mode === 'register' ? '엄마가 미리 이름을 등록해줘야 가입할 수 있어요.' : '가입 후 발급되는 가족 코드를 꼭 메모하세요.'}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    )
  }

  const user = { id: profile.name, role: profile.role }

  return (
    <Dashboard
      user={user}
      onLogout={handleLogout}
      onUpdateUser={() => {}}
      onChangePassword={handleChangePassword}
      allUsers={household?.people || {}}
      cloud={{ db, householdId: profile.householdId }}
    />
  )
}
