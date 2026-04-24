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

const getStorageKey = (kidId) => `kid_app_subjects_${kidId || 'default'}`

function PaletteItem({
  subject,
  onSave,
  onDelete,
  allowDrag = true,
  canEditName = true,
  canEditColor = true,
  canEditCoins = true,
  canDelete = true
}) {
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

  const canEditAny = canEditName || canEditColor || canEditCoins
  const safeCoins = Number(subject.coins || 0)

  if (isEditing && canEditAny) {
    return (
      <div style={{ ...style, cursor: 'default', display: 'grid', gap: '8px' }}>
        {canEditName ? (
          <input className="input-field" style={{ padding: '8px 10px', fontSize: '12px' }} value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="과목 이름" />
        ) : (
          <div style={{ fontSize: '13px', fontWeight: 900 }}>{subject.name}</div>
        )}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {canEditColor ? (
            <input type="color" value={draftColor} onChange={(event) => setDraftColor(event.target.value)} style={{ width: '30px', height: '30px', border: 'none', background: 'none', padding: 0 }} />
          ) : null}
          {canEditCoins ? (
            <input type="number" className="input-field" style={{ width: '68px', padding: '6px 8px', fontSize: '12px' }} value={draftCoins} onChange={(event) => setDraftCoins(parseInt(event.target.value, 10) || 0)} placeholder="코인" />
          ) : null}
          <button
            type="button"
            style={{ border: 'none', background: '#42c99b20', color: '#42c99b', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer' }}
            onClick={() => {
              const nextName = (canEditName ? draftName : subject.name).trim()
              if (!nextName) return
              onSave(subject.name, {
                ...subject,
                name: nextName,
                color: canEditColor ? draftColor : subject.color,
                coins: canEditCoins ? draftCoins : (subject.coins || 1)
              })
              setIsEditing(false)
            }}
          >
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
        <span style={{ display: 'flex', gap: '4px' }}>
          {canEditCoins ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}>
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                  onSave(subject.name, { ...subject, coins: Math.max(0, safeCoins - 1) })
                }}
                style={{ border: 'none', background: 'rgba(0,0,0,0.06)', color: '#666', borderRadius: '6px', padding: '2px 6px', fontWeight: 900, cursor: 'pointer' }}
                title="코인 -1"
              >
                -
              </button>
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                  onSave(subject.name, { ...subject, coins: safeCoins + 1 })
                }}
                style={{ border: 'none', background: '#ff4d6d20', color: '#ff4d6d', borderRadius: '6px', padding: '2px 6px', fontWeight: 900, cursor: 'pointer' }}
                title="코인 +1"
              >
                +
              </button>
            </span>
          ) : null}
          {canEditAny ? (
            <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setIsEditing(true) }} style={{ border: 'none', background: 'rgba(0,0,0,0.04)', color: '#999', borderRadius: '6px', padding: '4px' }}>
              <Edit2 size={12} />
            </button>
          ) : null}
          {canDelete ? (
            <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onDelete(subject.name) }} style={{ border: 'none', background: 'rgba(239,68,68,0.08)', color: '#ef4444', borderRadius: '6px', padding: '4px' }}>
              <Trash2 size={12} />
            </button>
          ) : null}
        </span>
      </div>
    </div>
  )
}

export function SubjectPalette({
  cloud,
  isAdmin,
  allowDrag = true,
  activeKidId = '',
  kids = [],
  kidLabels = {},
  onCoinChange
}) {
  const isCloud = !!cloud?.db && !!cloud?.householdId
  const targetKidIds = useMemo(() => {
    if (isAdmin) {
      const list = (kids || []).filter(Boolean)
      if (list.length > 0) return list
    }
    return activeKidId ? [activeKidId] : []
  }, [isAdmin, kids, activeKidId])

  const [subjectsByKid, setSubjectsByKid] = useState({})
  const [draftByKid, setDraftByKid] = useState({})

  const readyRef = useRef({})
  const lastSyncedRef = useRef({})
  const initialRef = useRef({})

  const patchDraft = (kidId, patch) => {
    setDraftByKid((prev) => ({
      ...prev,
      [kidId]: { name: '', color: '#8b5cf6', coins: 1, ...(prev[kidId] || {}), ...patch }
    }))
  }

  const updateKidSubjects = (kidId, nextOrUpdater) => {
    setSubjectsByKid((prev) => {
      const current = prev[kidId] || DEFAULT_SUBJECTS
      const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(current) : nextOrUpdater
      if (!isCloud) localStorage.setItem(getStorageKey(kidId), JSON.stringify(next))
      return { ...prev, [kidId]: next }
    })
  }

  useEffect(() => {
    if (isCloud || targetKidIds.length === 0) return
    const next = {}
    targetKidIds.forEach((kidId) => {
      try {
        const saved = localStorage.getItem(getStorageKey(kidId))
        next[kidId] = saved ? JSON.parse(saved) : DEFAULT_SUBJECTS
      } catch (error) {
        console.error(error)
        next[kidId] = DEFAULT_SUBJECTS
      }
    })
    setSubjectsByKid(next)
  }, [isCloud, targetKidIds.join('|')])

  useEffect(() => {
    if (!isCloud || targetKidIds.length === 0) return
    let cancelled = false
    const unsubs = []

    const setupKid = async (kidId) => {
      const kidRef = doc(cloud.db, 'households', cloud.householdId, 'kids', kidId)
      const legacyRef = doc(cloud.db, 'households', cloud.householdId, 'meta', 'subjects')

      const kidSnap = await getDoc(kidRef)
      let next = null
      if (kidSnap.exists()) {
        const kidData = kidSnap.data() || {}
        if (Array.isArray(kidData.subjects) && kidData.subjects.length > 0) next = kidData.subjects
      }
      if (!next) {
        const legacySnap = await getDoc(legacyRef)
        const legacyData = legacySnap.exists() ? legacySnap.data() : {}
        if (Array.isArray(legacyData?.subjects) && legacyData.subjects.length > 0) next = legacyData.subjects
      }
      if (!next) next = DEFAULT_SUBJECTS
      if (cancelled) return

      readyRef.current[kidId] = true
      initialRef.current[kidId] = next
      lastSyncedRef.current[kidId] = JSON.stringify(next || [])
      setSubjectsByKid((prev) => ({ ...prev, [kidId]: next }))

      const unsub = onSnapshot(kidRef, (snap) => {
        const data = snap.exists() ? snap.data() : {}
        const kidSubjects = Array.isArray(data?.subjects) && data.subjects.length > 0 ? data.subjects : (initialRef.current[kidId] || DEFAULT_SUBJECTS)
        readyRef.current[kidId] = true
        lastSyncedRef.current[kidId] = JSON.stringify(kidSubjects || [])
        setSubjectsByKid((prev) => ({ ...prev, [kidId]: kidSubjects }))
      })
      unsubs.push(unsub)
    }

    targetKidIds.forEach((kidId) => {
      setupKid(kidId).catch(console.error)
    })

    return () => {
      cancelled = true
      unsubs.forEach((unsub) => unsub && unsub())
    }
  }, [isCloud, cloud?.db, cloud?.householdId, targetKidIds.join('|')])

  useEffect(() => {
    if (!isCloud || targetKidIds.length === 0) return
    const timer = setTimeout(async () => {
      await Promise.all(
        targetKidIds.map(async (kidId) => {
          if (!readyRef.current[kidId]) return
          const subjects = subjectsByKid[kidId] || DEFAULT_SUBJECTS
          const json = JSON.stringify(subjects || [])
          if (json === lastSyncedRef.current[kidId]) return
          const ref = doc(cloud.db, 'households', cloud.householdId, 'kids', kidId)
          await setDoc(ref, { subjects, updatedAt: serverTimestamp() }, { merge: true })
          lastSyncedRef.current[kidId] = json
        })
      )
    }, 350)
    return () => clearTimeout(timer)
  }, [isCloud, cloud?.db, cloud?.householdId, targetKidIds.join('|'), subjectsByKid])

  const renderSection = (kidId) => {
    const list = (subjectsByKid[kidId] || DEFAULT_SUBJECTS).filter((subject) => subject?.name)
    const draft = draftByKid[kidId] || { name: '', color: '#8b5cf6', coins: 1 }
    const title = kidLabels[kidId] || kidId
    const allowKidDrag = allowDrag && (isAdmin ? false : true)

    return (
      <div key={kidId} style={{ marginBottom: '18px', border: '1px solid #ffe1ea', borderRadius: '14px', padding: '12px' }}>
        {isAdmin ? <div style={{ fontSize: '13px', fontWeight: 900, marginBottom: '10px', color: '#ff4d6d' }}>{title}</div> : null}
        <div style={{ display: 'grid', gap: '10px', marginBottom: '12px' }}>
          {list.map((subject) => (
            <PaletteItem
              key={`${kidId}-${subject.name}`}
              subject={subject}
              onSave={(previousName, nextSubject) => {
                const beforeCoins = Number(subject.coins || 0)
                const afterCoins = Number(nextSubject.coins || 0)
                updateKidSubjects(kidId, (items) => (items || []).map((item) => (item.name === previousName ? nextSubject : item)))
                if (typeof onCoinChange === 'function' && beforeCoins !== afterCoins) {
                  onCoinChange({ kidId, subjectName: nextSubject.name || previousName, beforeCoins, afterCoins })
                }
              }}
              onDelete={(name) => updateKidSubjects(kidId, (items) => (items || []).filter((item) => item.name !== name))}
              allowDrag={allowKidDrag}
              canEditName
              canEditColor={isAdmin}
              canEditCoins={isAdmin}
              canDelete
            />
          ))}
        </div>

        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input className="input-field" style={{ flex: 1 }} placeholder="과목 추가" value={draft.name} onChange={(event) => patchDraft(kidId, { name: event.target.value })} />
            {isAdmin ? (
              <input type="color" value={draft.color} onChange={(event) => patchDraft(kidId, { color: event.target.value })} style={{ width: '40px', height: '40px', border: 'none', background: 'none' }} />
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {isAdmin ? (
              <input type="number" className="input-field" style={{ width: '90px' }} placeholder="코인" value={draft.coins} onChange={(event) => patchDraft(kidId, { coins: parseInt(event.target.value, 10) || 0 })} />
            ) : null}
            <button
              className="btn-primary"
              style={{ flex: 1 }}
              onClick={() => {
                const name = (draft.name || '').trim()
                if (!name) return
                updateKidSubjects(kidId, [...(subjectsByKid[kidId] || []), { name, color: draft.color || '#8b5cf6', coins: isAdmin ? (draft.coins || 1) : 1 }])
                patchDraft(kidId, { name: '', coins: 1 })
              }}
            >
              과목 추가
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 900 }}>{isAdmin ? '과목 총관리' : '내 과목 팔레트'}</h3>
        <span style={{ fontSize: '11px', color: '#999' }}>
          {isAdmin ? '아이별 과목/코인 관리' : (allowDrag ? '드래그해서 시간표에 넣기' : '과목 이름 관리')}
        </span>
      </div>

      {targetKidIds.map((kidId) => renderSection(kidId))}
    </div>
  )
}
