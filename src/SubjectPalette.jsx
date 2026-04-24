import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { Check, Edit2, Trash2, X } from 'lucide-react'

const DEFAULT_SUBJECTS = [
  { name: '피아노', color: '#8b5cf6', coins: 1 },
  { name: '영어', color: '#3b82f6', coins: 1 },
  { name: '수학', color: '#22c55e', coins: 1 },
  { name: '국어', color: '#f97316', coins: 1 },
  { name: '독서', color: '#ef4444', coins: 1 }
]

function PaletteItem({ subject, onSave, onDelete, isAdmin, allowDrag = true }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette-${subject.name}`,
    data: { type: 'palette', subject: { ...subject, coins: subject.coins || 1 } },
    disabled: !allowDrag
  })

  const [isEditing, setIsEditing] = useState(false)
  const [draftName, setDraftName] = useState(subject.name)
  const [draftColor, setDraftColor] = useState(subject.color)
  const [draftCoins, setDraftCoins] = useState(subject.coins || 1)

  useEffect(() => {
    setDraftName(subject.name)
    setDraftColor(subject.color)
    setDraftCoins(subject.coins || 1)
  }, [subject.name, subject.color, subject.coins])

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.7 : 1,
    border: '1px solid rgba(0,0,0,0.06)',
    borderLeft: `6px solid ${subject.color}`,
    background: 'white',
    borderRadius: '12px',
    padding: '10px 12px',
    cursor: allowDrag ? 'grab' : 'default',
    userSelect: 'none',
    fontWeight: 800,
    fontSize: '13px'
  }

  if (isEditing && isAdmin) {
    return (
      <div style={{ ...style, cursor: 'default', display: 'grid', gap: '8px' }}>
        <input className="input-field" style={{ padding: '8px 10px', fontSize: '12px' }} value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="과목 이름" />
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input type="color" value={draftColor} onChange={(event) => setDraftColor(event.target.value)} style={{ width: '30px', height: '30px', border: 'none', background: 'none', padding: 0 }} />
          <input type="number" className="input-field" style={{ width: '60px', padding: '6px 8px', fontSize: '12px' }} value={draftCoins} onChange={(event) => setDraftCoins(parseInt(event.target.value, 10) || 0)} placeholder="코인" />
          <button type="button" style={{ border: 'none', background: '#42c99b20', color: '#42c99b', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer' }} onClick={() => { const nextName = draftName.trim(); if (!nextName) return; onSave(subject.name, { ...subject, name: nextName, color: draftColor, coins: draftCoins }); setIsEditing(false); }}>
            <Check size={14} />
          </button>
          <button type="button" style={{ border: 'none', background: 'rgba(0,0,0,0.06)', color: '#666', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer' }} onClick={() => setIsEditing(false)}>
            <X size={14} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={setNodeRef} style={style} {...(allowDrag ? listeners : {})} {...(allowDrag ? attributes : {})}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>{subject.name}</span>
          <span style={{ fontSize: '11px', color: '#ff4d6d', fontWeight: 'bold' }}>+{subject.coins || 1}코인</span>
        </div>
        {isAdmin && (
          <span style={{ display: 'flex', gap: '4px' }}>
            <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setIsEditing(true); }} style={{ border: 'none', background: 'rgba(0,0,0,0.04)', color: '#999', borderRadius: '6px', padding: '4px' }}>
              <Edit2 size={12} />
            </button>
            <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onDelete(subject.name); }} style={{ border: 'none', background: 'rgba(239,68,68,0.08)', color: '#ef4444', borderRadius: '6px', padding: '4px' }}>
              <Trash2 size={12} />
            </button>
          </span>
        )}
      </div>
    </div>
  )
}

export function SubjectPalette({ cloud, isAdmin, allowDrag = true, activeKidId = '' }) {
  const isCloud = !!cloud?.db && !!cloud?.householdId
  const lastSyncedRef = useRef('')
  const readyRef = useRef(false)
  const initialSubjectsRef = useRef(DEFAULT_SUBJECTS)

  const [subjects, setSubjects] = useState(() => {
    if (isCloud) return DEFAULT_SUBJECTS
    try {
      const saved = localStorage.getItem(`kid_app_subjects_${activeKidId || 'default'}`)
      if (saved) return JSON.parse(saved)
    } catch (error) {
      console.error(error)
    }
    return DEFAULT_SUBJECTS
  })

  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#8b5cf6')
  const [newCoins, setNewCoins] = useState(1)

  const persist = (nextOrUpdater) => {
    setSubjects((previous) => {
      const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(previous || []) : nextOrUpdater
      if (!isCloud) localStorage.setItem(`kid_app_subjects_${activeKidId || 'default'}`, JSON.stringify(next))
      return next
    })
  }

  const updateSubject = (previousName, nextSubject) => {
    persist((subjects || []).map((item) => (item.name === previousName ? nextSubject : item)))
  }

  const deleteSubject = (name) => {
    persist((subjects || []).filter((item) => item.name !== name))
  }

  useEffect(() => {
    if (isCloud) return
    try {
      const saved = localStorage.getItem(`kid_app_subjects_${activeKidId || 'default'}`)
      setSubjects(saved ? JSON.parse(saved) : DEFAULT_SUBJECTS)
    } catch (error) {
      console.error(error)
      setSubjects(DEFAULT_SUBJECTS)
    }
  }, [isCloud, activeKidId])

  useEffect(() => {
    if (!isCloud || !activeKidId) return
    readyRef.current = false
    lastSyncedRef.current = ''
    let unsub = null
    let cancelled = false

    const kidRef = doc(cloud.db, 'households', cloud.householdId, 'kids', activeKidId)
    const legacyRef = doc(cloud.db, 'households', cloud.householdId, 'meta', 'subjects')

    const bootstrap = async () => {
      const kidSnap = await getDoc(kidRef)
      let next = null
      if (kidSnap.exists()) {
        const kidData = kidSnap.data() || {}
        if (Array.isArray(kidData.subjects) && kidData.subjects.length > 0) {
          next = kidData.subjects
        }
      }

      if (!next) {
        const legacySnap = await getDoc(legacyRef)
        const legacyData = legacySnap.exists() ? legacySnap.data() : {}
        if (Array.isArray(legacyData?.subjects) && legacyData.subjects.length > 0) {
          next = legacyData.subjects
        }
      }

      if (!next) next = DEFAULT_SUBJECTS
      if (cancelled) return
      initialSubjectsRef.current = next
      lastSyncedRef.current = JSON.stringify(next || [])
      readyRef.current = true
      setSubjects(next)

      unsub = onSnapshot(kidRef, (snap) => {
        const data = snap.exists() ? snap.data() : {}
        const kidSubjects = Array.isArray(data?.subjects) && data.subjects.length > 0 ? data.subjects : initialSubjectsRef.current
        lastSyncedRef.current = JSON.stringify(kidSubjects || [])
        readyRef.current = true
        setSubjects(kidSubjects)
      })
    }

    bootstrap().catch(console.error)

    return () => {
      cancelled = true
      if (unsub) unsub()
    }
  }, [isCloud, cloud?.db, cloud?.householdId, activeKidId])

  useEffect(() => {
    if (!isCloud || !readyRef.current || !activeKidId) return
    const json = JSON.stringify(subjects || [])
    if (json === lastSyncedRef.current) return

    const timer = setTimeout(async () => {
      const ref = doc(cloud.db, 'households', cloud.householdId, 'kids', activeKidId)
      await setDoc(ref, { subjects: subjects || [], updatedAt: serverTimestamp() }, { merge: true })
      lastSyncedRef.current = json
    }, 400)

    return () => clearTimeout(timer)
  }, [isCloud, cloud?.db, cloud?.householdId, activeKidId, subjects])

  const list = useMemo(() => (subjects || []).filter((subject) => subject?.name), [subjects])

  return (
    <div style={{ padding: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 900 }}>과목 팔레트</h3>
        <span style={{ fontSize: '11px', color: '#999' }}>{allowDrag ? '드래그해서 시간표에 넣기' : '코인/색상 설정'}</span>
      </div>

      <div style={{ display: 'grid', gap: '10px', marginBottom: '18px' }}>
        {list.map((subject) => (
          <PaletteItem key={subject.name} subject={subject} onSave={updateSubject} onDelete={deleteSubject} isAdmin={isAdmin} allowDrag={allowDrag} />
        ))}
      </div>

      {isAdmin && (
        <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '18px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input className="input-field" style={{ flex: 1 }} placeholder="과목 추가" value={newName} onChange={(event) => setNewName(event.target.value)} />
            <input type="color" value={newColor} onChange={(event) => setNewColor(event.target.value)} style={{ width: '40px', height: '40px', border: 'none', background: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="number" className="input-field" style={{ flex: 1 }} placeholder="코인" value={newCoins} onChange={(event) => setNewCoins(parseInt(event.target.value, 10) || 0)} />
            <button className="btn-primary" style={{ flex: 1 }} onClick={() => { const name = newName.trim(); if (!name) return; persist([...(subjects || []), { name, color: newColor, coins: newCoins }]); setNewName(''); setNewCoins(1); }}>
              과목 추가
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
