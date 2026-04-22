import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'

const DEFAULT_SUBJECTS = [
  { name: '피아노', color: '#8b5cf6' },
  { name: '영어', color: '#3b82f6' },
  { name: '수학', color: '#22c55e' },
  { name: '국어', color: '#f97316' },
  { name: '독서', color: '#ef4444' }
]

function PaletteItem({ subject }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette-${subject.name}`,
    data: subject
  })

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.7 : 1,
    border: `1px solid rgba(0,0,0,0.06)`,
    borderLeft: `6px solid ${subject.color}`,
    background: 'white',
    borderRadius: '12px',
    padding: '10px 12px',
    cursor: 'grab',
    userSelect: 'none',
    fontWeight: 800,
    fontSize: '13px'
  }

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {subject.name}
    </div>
  )
}

export function SubjectPalette({ cloud }) {
  const isCloud = !!cloud?.db && !!cloud?.householdId
  const lastSyncedRef = useRef('')
  const readyRef = useRef(false)

  const [subjects, setSubjects] = useState(() => {
    if (isCloud) return DEFAULT_SUBJECTS
    try {
      const saved = localStorage.getItem('kid_app_subjects')
      if (saved) return JSON.parse(saved)
    } catch (e) {
      console.error(e)
    }
    return DEFAULT_SUBJECTS
  })

  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#8b5cf6')

  const persist = (next) => {
    setSubjects(next)
    if (!isCloud) localStorage.setItem('kid_app_subjects', JSON.stringify(next))
  }

  useEffect(() => {
    if (!isCloud) return
    readyRef.current = false
    lastSyncedRef.current = ''

    const ref = doc(cloud.db, 'households', cloud.householdId, 'meta', 'subjects')
    return onSnapshot(ref, (snap) => {
      const data = snap.exists() ? snap.data() : {}
      const next = Array.isArray(data?.subjects) ? data.subjects : DEFAULT_SUBJECTS
      const json = JSON.stringify(next || [])
      lastSyncedRef.current = json
      readyRef.current = true
      setSubjects(next)
    })
  }, [isCloud, cloud?.db, cloud?.householdId])

  useEffect(() => {
    if (!isCloud) return
    if (!readyRef.current) return

    const json = JSON.stringify(subjects || [])
    if (json === lastSyncedRef.current) return

    const t = setTimeout(async () => {
      const ref = doc(cloud.db, 'households', cloud.householdId, 'meta', 'subjects')
      await setDoc(ref, { subjects: subjects || [], updatedAt: serverTimestamp() }, { merge: true })
      lastSyncedRef.current = json
    }, 400)

    return () => clearTimeout(t)
  }, [isCloud, cloud?.db, cloud?.householdId, subjects])

  const list = useMemo(() => (subjects || []).filter((s) => s?.name), [subjects])

  return (
    <div style={{ padding: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '900' }}>과목 팔레트</h3>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>드래그해서 시간표에 놓기</span>
      </div>

      <div style={{ display: 'grid', gap: '10px', marginBottom: '14px' }}>
        {list.map((s) => (
          <PaletteItem key={s.name} subject={s} />
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          className="input-field"
          style={{ flex: 1 }}
          placeholder="과목 추가"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} style={{ width: '46px', height: '40px', border: 'none', background: 'none' }} />
      </div>
      <button
        className="btn-primary"
        style={{ width: '100%', marginTop: '8px' }}
        onClick={() => {
          const name = newName.trim()
          if (!name) return
          persist([...(subjects || []), { name, color: newColor }])
          setNewName('')
        }}
      >
        과목 추가
      </button>
    </div>
  )
}
