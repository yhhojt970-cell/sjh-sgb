import React, { useEffect, useMemo, useRef, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { deleteField, doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import Dashboard from './Dashboard.jsx'
import { auth, db } from './firebase'

const normalizeIdToEmail = (id) => {
  const trimmed = (id || '').trim()
  if (!trimmed) return ''
  if (trimmed.includes('@')) return trimmed
  return `${trimmed}@kidschedule.local`
}

const randomCode = (len = 8) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

export default function App() {
  const [authUser, setAuthUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [household, setHousehold] = useState(null)

  const [loginId, setLoginId] = useState('')
  const [loginPw, setLoginPw] = useState('')
  const [authError, setAuthError] = useState('')
  const [busy, setBusy] = useState(false)

  const [joinMode, setJoinMode] = useState('join') // join | create
  const [householdCode, setHouseholdCode] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('child') // admin | child
  const [joinError, setJoinError] = useState('')

  const unsubRef = useRef({ profile: null, household: null })

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthUser(u || null)
      setAuthError('')
      setJoinError('')
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (unsubRef.current.profile) unsubRef.current.profile()
    if (unsubRef.current.household) unsubRef.current.household()
    unsubRef.current.profile = null
    unsubRef.current.household = null

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
      unsubRef.current.profile = null
      unsubRef.current.household = null
    }
  }, [authUser?.uid])

  useEffect(() => {
    if (unsubRef.current.household) unsubRef.current.household()
    unsubRef.current.household = null
    setHousehold(null)

    const householdId = profile?.householdId
    if (!authUser?.uid || !householdId) return

    const householdRef = doc(db, 'households', householdId)
    unsubRef.current.household = onSnapshot(householdRef, (snap) => {
      setHousehold(snap.exists() ? snap.data() : null)
    })

    return () => {
      if (unsubRef.current.household) unsubRef.current.household()
      unsubRef.current.household = null
    }
  }, [authUser?.uid, profile?.householdId])

  const allUsers = useMemo(() => household?.people || {}, [household?.people])

  const user = useMemo(() => {
    if (!profile?.name) return null
    return { id: profile.name, role: profile.role || 'child' }
  }, [profile?.name, profile?.role])

  const doLogin = async () => {
    setAuthError('')
    const email = normalizeIdToEmail(loginId)
    if (!email || !loginPw) return setAuthError('아이디/비밀번호를 입력해 주세요.')
    setBusy(true)
    try {
      await signInWithEmailAndPassword(auth, email, loginPw)
    } catch (e) {
      setAuthError('로그인에 실패했어요. 아이디/비밀번호를 확인해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  const doRegister = async () => {
    setAuthError('')
    const email = normalizeIdToEmail(loginId)
    if (!email || !loginPw) return setAuthError('아이디/비밀번호를 입력해 주세요.')
    setBusy(true)
    try {
      await createUserWithEmailAndPassword(auth, email, loginPw)
    } catch (e) {
      setAuthError('회원가입에 실패했어요. (이미 존재하는 아이디일 수 있어요)')
    } finally {
      setBusy(false)
    }
  }

  const doLogout = async () => {
    await signOut(auth)
  }

  const validateName = () => {
    const safeName = (name || '').trim()
    if (!safeName) {
      setJoinError('이름(예: 지희/가빈/엄마)을 입력해 주세요.')
      return null
    }
    if (safeName.includes('.') || safeName.includes('/')) {
      setJoinError('이름에는 . 또는 / 문자를 사용할 수 없어요.')
      return null
    }
    return safeName
  }

  const doJoin = async () => {
    const code = (householdCode || '').trim().toUpperCase()
    if (!code) return setJoinError('그룹 코드를 입력해 주세요.')
    if (!authUser?.uid) return
    const safeName = validateName()
    if (!safeName) return

    setBusy(true)
    setJoinError('')
    try {
      const householdRef = doc(db, 'households', code)
      const householdSnap = await getDoc(householdRef)
      if (!householdSnap.exists()) {
        setJoinError('그룹 코드가 존재하지 않아요.')
        return
      }

      const profileRef = doc(db, 'users', authUser.uid)
      await setDoc(
        profileRef,
        {
          householdId: code,
          name: safeName,
          role,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        },
        { merge: true }
      )

      await updateDoc(householdRef, { [`people.${safeName}`]: { role }, updatedAt: serverTimestamp() })

      await setDoc(doc(db, 'households', code, 'kids', safeName), { role, updatedAt: serverTimestamp() }, { merge: true })
    } catch (e) {
      console.error(e)
      const profileRef = doc(db, 'users', authUser.uid)
      await setDoc(profileRef, { householdId: deleteField() }, { merge: true })
      setJoinError('그룹 참가에 실패했어요.')
    } finally {
      setBusy(false)
    }
  }

  const doCreate = async () => {
    if (!authUser?.uid) return
    const safeName = validateName()
    if (!safeName) return
    setBusy(true)
    setJoinError('')
    try {
      const code = randomCode(8)
      const profileRef = doc(db, 'users', authUser.uid)
      await setDoc(
        profileRef,
        {
          householdId: code,
          name: safeName,
          role,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        },
        { merge: true }
      )

      const householdRef = doc(db, 'households', code)
      await setDoc(householdRef, { people: { [safeName]: { role } }, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
      await setDoc(doc(db, 'households', code, 'kids', safeName), { role, updatedAt: serverTimestamp() }, { merge: true })
      setHouseholdCode(code)
    } finally {
      setBusy(false)
    }
  }

  if (!authUser?.uid) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px' }}>
        <div className="glass" style={{ width: 'min(520px, 100%)', padding: '24px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: '900', marginBottom: '10px' }}>스케줄 로그인</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '18px' }}>
            아이디/비밀번호로 로그인하면 여러 기기에서 같은 데이터로 동기화됩니다.
          </p>

          <div style={{ display: 'grid', gap: '10px' }}>
            <input className="input-field" placeholder="아이디(예: mom / jh / gb)" value={loginId} onChange={(e) => setLoginId(e.target.value)} />
            <input className="input-field" placeholder="비밀번호" type="password" value={loginPw} onChange={(e) => setLoginPw(e.target.value)} />
          </div>

          {authError && <div style={{ marginTop: '10px', fontSize: '12px', color: '#ef4444', fontWeight: '800' }}>{authError}</div>}

          <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
            <button className="btn-primary" style={{ flex: 1, opacity: busy ? 0.7 : 1 }} disabled={busy} onClick={doLogin}>
              로그인
            </button>
            <button className="btn-secondary" style={{ flex: 1, opacity: busy ? 0.7 : 1 }} disabled={busy} onClick={doRegister}>
              회원가입
            </button>
          </div>

          <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
            * 아이디에 @가 없으면 자동으로 내부 이메일로 변환해서 사용합니다.
          </div>
        </div>
      </div>
    )
  }

  if (!profile?.householdId) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px' }}>
        <div className="glass" style={{ width: 'min(560px, 100%)', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <h1 style={{ fontSize: '18px', fontWeight: '900' }}>그룹 연결</h1>
            <button className="btn-secondary" onClick={doLogout}>
              로그아웃
            </button>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>
            같은 그룹 코드를 쓰는 사람끼리 일정이 실시간으로 공유됩니다.
          </p>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button className={joinMode === 'join' ? 'btn-primary' : 'btn-secondary'} onClick={() => setJoinMode('join')}>
              기존 그룹 참가
            </button>
            <button className={joinMode === 'create' ? 'btn-primary' : 'btn-secondary'} onClick={() => setJoinMode('create')}>
              새 그룹 만들기
            </button>
          </div>

          <div style={{ display: 'grid', gap: '10px' }}>
            {joinMode === 'join' && (
              <input className="input-field" placeholder="그룹 코드" value={householdCode} onChange={(e) => setHouseholdCode(e.target.value)} />
            )}
            <input className="input-field" placeholder="이름(예: 지희/가빈/엄마)" value={name} onChange={(e) => setName(e.target.value)} />
            <select className="input-field" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="child">아이</option>
              <option value="admin">관리자</option>
            </select>
          </div>

          {joinError && <div style={{ marginTop: '10px', fontSize: '12px', color: '#ef4444', fontWeight: '800' }}>{joinError}</div>}

          <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
            {joinMode === 'join' ? (
              <button className="btn-primary" style={{ flex: 1, opacity: busy ? 0.7 : 1 }} disabled={busy} onClick={doJoin}>
                참가하기
              </button>
            ) : (
              <button className="btn-primary" style={{ flex: 1, opacity: busy ? 0.7 : 1 }} disabled={busy} onClick={doCreate}>
                만들고 시작하기
              </button>
            )}
          </div>

          <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
            그룹 코드는 공유해도 괜찮지만, 계정 비밀번호는 공유하지 마세요.
          </div>
        </div>
      </div>
    )
  }

  return (
    <Dashboard
      user={user}
      onLogout={doLogout}
      onUpdateUser={() => {}}
      allUsers={allUsers}
      cloud={{ db, householdId: profile.householdId }}
    />
  )
}
