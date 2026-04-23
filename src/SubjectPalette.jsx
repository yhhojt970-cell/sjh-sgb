import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { Check, Edit2, Trash2, X } from 'lucide-react'

const DEFAULT_SUBJECTS = [
  { name: '피아노', color: '#8b5cf6' },
  { name: '영어', color: '#3b82f6' },
  { name: '수학', color: '#22c55e' },
  { name: '국어', color: '#f97316' },
  { name: '독서', color: '#ef4444' }
]

function PaletteItem({ subject, onSave, onDelete }) {
  const itemId = `palette-${subject.name}-${subject.kidId || 'shared'}`
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: itemId,
    data: { type: 'palette', subject }
  })

  const [isEditing, setIsEditing] = useState(false)
  const [draftName, setDraftName] = useState(subject.name)
  const [draftColor, setDraftColor] = useState(subject.color)

  useEffect(() => {
    setDraftName(subject.name); setDraftColor(subject.color)
  }, [subject.name, subject.color])

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    border: `1px solid rgba(0,0,0,0.06)`,
    borderLeft: `6px solid ${subject.color}`,
    background: 'white',
    borderRadius: '12px',
    padding: '10px 12px',
    cursor: 'grab',
    userSelect: 'none',
    fontWeight: 800,
    fontSize: '13px',
    zIndex: isDragging ? 999 : 1
  }

  if (isEditing) {
    return (
      <div style={{ ...style, cursor: 'default', display: 'grid', gap: '8px' }}>
        <input className="input-field" style={{ padding: '8px 10px', fontSize: '12px' }} value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="과목 이름" />
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input type="color" value={draftColor} onChange={(e) => setDraftColor(e.target.value)} style={{ width: '42px', height: '34px', border: 'none', background: 'none' }} />
          <button type="button" style={{ border: 'none', background: 'rgba(66, 201, 155, 0.14)', color: 'var(--accent)', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer' }} onClick={() => { const nextName = draftName.trim(); if (!nextName) return; onSave(subject.name, subject.kidId, { ...subject, name: nextName, color: draftColor }); setIsEditing(false); }}><Check size={14} /></button>
          <button type="button" style={{ border: 'none', background: 'rgba(0,0,0,0.06)', color: 'var(--text-muted)', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer' }} onClick={() => { setDraftName(subject.name); setDraftColor(subject.color); setIsEditing(false); }}><X size={14} /></button>
        </div>
      </div>
    )
  }

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span>{subject.name}</span>
        <span style={{ display: 'flex', gap: '6px' }}>
          <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} style={{ border: 'none', background: 'rgba(0,0,0,0.06)', color: 'var(--text-muted)', borderRadius: '8px', padding: '4px 6px', cursor: 'pointer' }}><Edit2 size={12} /></button>
          <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDelete(subject.name, subject.kidId); }} style={{ border: 'none', background: 'rgba(239,68,68,0.12)', color: '#ef4444', borderRadius: '8px', padding: '4px 6px', cursor: 'pointer' }}><Trash2 size={12} /></button>
        </span>
      </div>
    </div>
  )
}

export function SubjectPalette({ cloud, activeKidId, kids, onSubjectsChange }) {
  const isCloud = !!cloud?.db && !!cloud?.householdId
  const lastSyncedRef = useRef('')
  const readyRef = useRef(false)

  const [subjects, setSubjects] = useState(() => {
    if (isCloud) return []
    try {
      const saved = localStorage.getItem('kid_app_subjects')
      if (saved) return JSON.parse(saved)
    } catch (e) { console.error(e) }
    return DEFAULT_SUBJECTS
  })

  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#8b5cf6')

  useEffect(() => { if (onSubjectsChange) onSubjectsChange(subjects) }, [subjects, onSubjectsChange])

  const persist = (nextOrUpdater) => {
    setSubjects((prev) => {
      const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(prev || []) : nextOrUpdater
      if (!isCloud) localStorage.setItem('kid_app_subjects', JSON.stringify(next))
      return next
    })
  }

  const updateSubject = (prevName, prevKidId, nextSubject) => {
    persist((subjects || []).map((item) => (item.name === prevName && item.kidId === prevKidId) ? nextSubject : item))
  }

  const deleteSubject = (name, kidId) => {
    persist((subjects || []).filter((item) => !(item.name === name && item.kidId === kidId)))
  }

  useEffect(() => {
    if (!isCloud) return
    readyRef.current = false
    lastSyncedRef.current = ''

    const ref = doc(cloud.db, 'households', cloud.householdId, 'meta', 'subjects')
    return onSnapshot(ref, async (snap) => {
      const data = snap.exists() ? snap.data() : {}
      const raw = Array.isArray(data?.subjects) ? data.subjects : DEFAULT_SUBJECTS
      
      // Migration Fix: Ensure we write back to Firestore if shared subjects are found
      if (kids && kids.length > 0 && raw.some(s => !s.kidId)) {
        const migrated = []
        raw.forEach(s => {
          if (!s.kidId) kids.forEach(kid => migrated.push({ ...s, kidId: kid }))
          else migrated.push(s)
        })
        console.log('Migrating and saving subjects to Firestore...')
        await setDoc(ref, { subjects: migrated, updatedAt: serverTimestamp() }, { merge: true })
        // The snapshot listener will trigger again with the migrated data.
        return
      }

      const json = JSON.stringify(raw || [])
      lastSyncedRef.current = json
      readyRef.current = true
      setSubjects(raw)
    })
  }, [isCloud, cloud?.db, cloud?.householdId, kids])

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

  const list = useMemo(() => (subjects || []).filter((s) => s?.name && s.kidId === activeKidId), [subjects, activeKidId])
  const listIds = useMemo(() => list.map(s => `palette-${s.name}-${s.kidId || 'shared'}`), [list])

  return (
    <div style={{ padding: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: '900' }}>과목 팔레트</h3>
          <div style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: '700' }}>대상: {activeKidId}</div>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>드래그로 순서 변경</span>
      </div>

      <div style={{ display: 'grid', gap: '10px', marginBottom: '14px' }}>
        <SortableContext items={listIds} strategy={verticalListSortingStrategy}>
          {list.map((s) => (
            <PaletteItem key={`${s.name}-${s.kidId}`} subject={s} onSave={updateSubject} onDelete={deleteSubject} />
          ))}
        </SortableContext>
        {list.length === 0 && <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '10px', background: 'rgba(0,0,0,0.02)', borderRadius: '8px' }}>등록된 과목이 없습니다.</div>}
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <input className="input-field" style={{ flex: 1 }} placeholder="과목 추가" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} style={{ width: '46px', height: '40px', border: 'none', background: 'none' }} />
      </div>
      <button className="btn-primary" style={{ width: '100%', marginTop: '8px' }} onClick={() => {
        const name = newName.trim(); if (!name) return;
        if (!activeKidId || activeKidId === '엄마') { alert('아이를 선택해 주세요!'); return; }
        if (list.some(s => s.name === name)) { alert('이미 있는 이름입니다.'); return; }
        persist([...(subjects || []), { name, color: newColor, kidId: activeKidId }]); setNewName('');
      }}>과목 추가</button>
    </div>
  )
}
