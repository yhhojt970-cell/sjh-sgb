import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { Check, Edit2, Trash2, X } from 'lucide-react'

const DEFAULT_SUBJECTS = [
  { name: '피아노', color: '#8b5cf6' },
  { name: '영어', color: '#3b82f6' },
  { name: '수학', color: '#22c55e' },
  { name: '국어', color: '#f97316' },
  { name: '독서', color: '#ef4444' }
]

function PaletteItem({ subject, onSave, onDelete, isAdmin }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette-${subject.name}`,
    data: {
      type: 'palette',
      subject: { ...subject, coins: subject.coins || 1 }
    }
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

  if (isEditing && isAdmin) {
    return (
      <div style={{ ...style, cursor: 'default', display: 'grid', gap: '8px' }}>
        <input
          className="input-field"
          style={{ padding: '8px 10px', fontSize: '12px' }}
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          placeholder="과목 이름"
        />
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="color"
            value={draftColor}
            onChange={(e) => setDraftColor(e.target.value)}
            style={{ width: '30px', height: '30px', border: 'none', background: 'none', padding: 0 }}
          />
          <input
            type="number"
            className="input-field"
            style={{ width: '60px', padding: '6px 8px', fontSize: '12px' }}
            value={draftCoins}
            onChange={(e) => setDraftCoins(parseInt(e.target.value) || 0)}
            placeholder="코인"
          />
          <button
            type="button"
            style={{ border: 'none', background: '#42c99b20', color: '#42c99b', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer' }}
            onClick={() => {
              const nextName = draftName.trim()
              if (!nextName) return
              onSave(subject.name, { ...subject, name: nextName, color: draftColor, coins: draftCoins })
              setIsEditing(false)
            }}
          >
            <Check size={14} />
          </button>
          <button
            type="button"
            style={{ border: 'none', background: 'rgba(0,0,0,0.06)', color: '#666', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer' }}
            onClick={() => setIsEditing(false)}
          >
            <X size={14} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>{subject.name}</span>
          <span style={{ fontSize: '11px', color: '#ff4d6d', fontWeight: 'bold' }}>+{subject.coins || 1}💰</span>
        </div>
        {isAdmin && (
          <span style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
              style={{ border: 'none', background: 'rgba(0,0,0,0.04)', color: '#999', borderRadius: '6px', padding: '4px' }}
            >
              <Edit2 size={12} />
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onDelete(subject.name); }}
              style={{ border: 'none', background: 'rgba(239,68,68,0.08)', color: '#ef4444', borderRadius: '6px', padding: '4px' }}
            >
              <Trash2 size={12} />
            </button>
          </span>
        )}
      </div>
    </div>
  )
}

export function SubjectPalette({ cloud, isAdmin }) {
  const isCloud = !!cloud?.db && !!cloud?.householdId
  const lastSyncedRef = useRef('')
  const readyRef = useRef(false)

  const [subjects, setSubjects] = useState(() => {
    if (isCloud) return DEFAULT_SUBJECTS
    try {
      const saved = localStorage.getItem('kid_app_subjects')
      if (saved) return JSON.parse(saved)
    } catch (e) { console.error(e) }
    return DEFAULT_SUBJECTS
  })

  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#8b5cf6')
  const [newCoins, setNewCoins] = useState(1)

  const persist = (nextOrUpdater) => {
    setSubjects((prev) => {
      const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(prev || []) : nextOrUpdater
      if (!isCloud) localStorage.setItem('kid_app_subjects', JSON.stringify(next))
      return next
    })
  }

  const updateSubject = (prevName, nextSubject) => {
    persist((subjects || []).map((item) => (item.name === prevName ? nextSubject : item)))
  }

  const deleteSubject = (name) => {
    persist((subjects || []).filter((item) => item.name !== name))
  }

  useEffect(() => {
    if (!isCloud) return
    readyRef.current = false
    lastSyncedRef.current = ''
    const ref = doc(cloud.db, 'households', cloud.householdId, 'meta', 'subjects')
    return onSnapshot(ref, (snap) => {
      const data = snap.exists() ? snap.data() : {}
      const next = Array.isArray(data?.subjects) ? data.subjects : DEFAULT_SUBJECTS
      lastSyncedRef.current = JSON.stringify(next || [])
      readyRef.current = true
      setSubjects(next)
    })
  }, [isCloud, cloud?.db, cloud?.householdId])

  useEffect(() => {
    if (!isCloud || !readyRef.current) return
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
        <span style={{ fontSize: '11px', color: '#999' }}>드래그해서 시간표에 놓기</span>
      </div>

      <div style={{ display: 'grid', gap: '10px', marginBottom: '18px' }}>
        {list.map((s) => (
          <PaletteItem key={s.name} subject={s} onSave={updateSubject} onDelete={deleteSubject} isAdmin={isAdmin} />
        ))}
      </div>

      {isAdmin && (
        <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '18px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input className="input-field" style={{ flex: 1 }} placeholder="과목 추가" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} style={{ width: '40px', height: '40px', border: 'none', background: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="number" className="input-field" style={{ flex: 1 }} placeholder="코인" value={newCoins} onChange={(e) => setNewCoins(parseInt(e.target.value) || 0)} />
            <button
              className="btn-primary"
              style={{ flex: 1 }}
              onClick={() => {
                const name = newName.trim()
                if (!name) return
                persist([...(subjects || []), { name, color: newColor, coins: newCoins }])
                setNewName(''); setNewCoins(1);
              }}
            >
              과목 추가
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

