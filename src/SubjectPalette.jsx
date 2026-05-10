import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { Check, ChevronDown, ChevronRight, Edit2, Trash2, X, ArrowUp, ArrowDown } from 'lucide-react'

const DEFAULT_SUBJECTS = [
  { name: '피아노', color: '#8b5cf6', coins: 1 },
  { name: '영어', color: '#3b82f6', coins: 1 },
  { name: '수학', color: '#22c55e', coins: 1 },
  { name: '국어', color: '#f97316', coins: 1 },
  { name: '독서', color: '#ef4444', coins: 1 }
]

const getStorageKey = (kidId) => `kid_app_subjects_${kidId || 'default'}`

const getSubjectCoinValue = (subject, fallback = 1) => {
  const rawCoins = typeof subject === 'object' ? subject?.coins : subject
  const normalizedCoins = typeof rawCoins === 'string' ? rawCoins.trim() : rawCoins
  if (normalizedCoins === undefined || normalizedCoins === null || normalizedCoins === '') return fallback
  const parsedCoins = Number(normalizedCoins)
  return Number.isNaN(parsedCoins) ? fallback : Math.max(0, parsedCoins)
}

const getSubjectColorValue = (subject, index = 0) => (
  subject?.color || DEFAULT_SUBJECTS[index % DEFAULT_SUBJECTS.length]?.color || '#8b5cf6'
)

// Stable JSON for comparison — always name/color/coins/category order
const stableSubjectsJSON = (arr) =>
  JSON.stringify((arr || []).map((s) => {
    const obj = { name: s.name, color: s.color, coins: Number(s.coins ?? 1) }
    if (s.category) obj.category = s.category
    return obj
  }))

const normalizeSubjectList = (subjects) => {
  const source = Array.isArray(subjects) && subjects.length > 0 ? subjects : DEFAULT_SUBJECTS
  return source.map((subject, index) => {
    const normalized = {
      name: String(subject.name || ''),
      color: getSubjectColorValue(subject, index),
      coins: getSubjectCoinValue(subject)
    }
    if (subject.category) normalized.category = subject.category
    return normalized
  })
}

// ──────────────────────────── PaletteItem ────────────────────────────
function PaletteItem({
  subject,
  onSave,
  onDelete,
  onMoveUp,
  onMoveDown,
  allowDrag = true,
  canEditName = true,
  canEditColor = true,
  canEditCoins = true,
  canDelete = true,
  showMoveButtons = false,
  existingCategories = []
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette-${subject.name}`,
    data: { type: 'palette', subject: { ...subject, coins: getSubjectCoinValue(subject) } },
    disabled: !allowDrag
  })

  const [isEditing, setIsEditing] = useState(false)
  const [draftName, setDraftName] = useState(subject.name)
  const [draftColor, setDraftColor] = useState(subject.color)
  const [draftCoins, setDraftCoins] = useState(getSubjectCoinValue(subject))
  const [draftCategory, setDraftCategory] = useState(subject.category || '')
  const [coinScopeDialog, setCoinScopeDialog] = useState(null)

  useEffect(() => {
    setDraftName(subject.name)
    setDraftColor(getSubjectColorValue(subject))
    setDraftCoins(getSubjectCoinValue(subject))
    setDraftCategory(subject.category || '')
  }, [subject.name, subject.color, subject.coins, subject.category])

  const safeCoins = getSubjectCoinValue(subject)
  const canEditAny = canEditName || canEditColor || canEditCoins

  const adjustCoinDraft = (delta) => {
    setCoinScopeDialog((prev) => {
      const cur = prev?.newCoins ?? safeCoins
      return { newCoins: Math.max(0, cur + delta) }
    })
  }

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.7 : 1,
    border: '1px solid rgba(0,0,0,0.06)',
    borderLeft: `6px solid ${getSubjectColorValue(subject)}`,
    background: 'white',
    borderRadius: '12px',
    padding: '10px 12px',
    cursor: allowDrag ? 'grab' : 'default',
    userSelect: 'none',
    fontWeight: 800,
    fontSize: '13px'
  }

  if (isEditing && canEditAny) {
    return (
      <div style={{ ...style, cursor: 'default', display: 'grid', gap: '8px' }}>
        {canEditName ? (
          <input
            className="input-field"
            style={{ padding: '8px 10px', fontSize: '12px' }}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="과목 이름"
          />
        ) : (
          <div style={{ fontSize: '13px', fontWeight: 900 }}>{subject.name}</div>
        )}

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          {canEditColor && (
            <input
              type="color"
              value={draftColor || getSubjectColorValue(subject)}
              onChange={(e) => setDraftColor(e.target.value)}
              style={{ width: '30px', height: '30px', border: 'none', background: 'none', padding: 0 }}
            />
          )}
          {canEditCoins && (
            <input
              type="number"
              className="input-field"
              style={{ width: '70px', padding: '6px 8px', fontSize: '12px' }}
              placeholder="코인"
              value={draftCoins}
              onChange={(e) => setDraftCoins(Math.max(0, parseInt(e.target.value, 10) || 0))}
            />
          )}
          <input
            className="input-field"
            style={{ flex: 1, minWidth: '80px', padding: '6px 8px', fontSize: '12px' }}
            placeholder="카테고리 (선택)"
            value={draftCategory}
            onChange={(e) => setDraftCategory(e.target.value)}
            list={`categories-${subject.name}`}
          />
          {existingCategories.length > 0 && (
            <datalist id={`categories-${subject.name}`}>
              {existingCategories.map((c) => <option key={c} value={c} />)}
            </datalist>
          )}
          <button
            type="button"
            style={{ border: 'none', background: '#42c99b20', color: '#42c99b', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer' }}
            onClick={() => {
              const nextName = (canEditName ? draftName : subject.name).trim()
              if (!nextName) return
              onSave(subject.name, {
                ...subject,
                name: nextName,
                color: canEditColor ? (draftColor || getSubjectColorValue(subject)) : getSubjectColorValue(subject),
                coins: canEditCoins ? draftCoins : safeCoins,
                ...(draftCategory.trim() ? { category: draftCategory.trim() } : { category: undefined })
              })
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
    <div ref={setNodeRef} style={style} {...(allowDrag ? listeners : {})} {...(allowDrag ? attributes : {})}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subject.name}</span>
          <span style={{ fontSize: '11px', color: '#ff4d6d', fontWeight: 'bold', flexShrink: 0 }}>+{safeCoins}코인</span>
        </div>
        <span style={{ display: 'flex', gap: '3px', alignItems: 'center', flexShrink: 0 }}>
          {showMoveButtons && (
            <>
              {onMoveUp && (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onMoveUp() }}
                  style={{ border: 'none', background: 'rgba(0,0,0,0.04)', color: '#aaa', borderRadius: '6px', padding: '3px 5px', cursor: 'pointer', lineHeight: 1 }}
                  title="위로"
                >
                  <ArrowUp size={11} />
                </button>
              )}
              {onMoveDown && (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onMoveDown() }}
                  style={{ border: 'none', background: 'rgba(0,0,0,0.04)', color: '#aaa', borderRadius: '6px', padding: '3px 5px', cursor: 'pointer', lineHeight: 1 }}
                  title="아래로"
                >
                  <ArrowDown size={11} />
                </button>
              )}
            </>
          )}
          {canEditCoins && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); adjustCoinDraft(-1) }}
                style={{ border: 'none', background: 'rgba(0,0,0,0.06)', color: '#666', borderRadius: '6px', padding: '2px 6px', fontWeight: 900, cursor: 'pointer' }}
              >−</button>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); adjustCoinDraft(1) }}
                style={{ border: 'none', background: '#ff4d6d20', color: '#ff4d6d', borderRadius: '6px', padding: '2px 6px', fontWeight: 900, cursor: 'pointer' }}
              >+</button>
            </span>
          )}
          {canEditAny && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setIsEditing(true) }}
              style={{ border: 'none', background: 'rgba(0,0,0,0.04)', color: '#999', borderRadius: '6px', padding: '4px' }}
            >
              <Edit2 size={12} />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onDelete(subject.name) }}
              style={{ border: 'none', background: 'rgba(239,68,68,0.08)', color: '#ef4444', borderRadius: '6px', padding: '4px' }}
            >
              <Trash2 size={12} />
            </button>
          )}
        </span>
      </div>

      {coinScopeDialog !== null && (
        <div style={{ marginTop: '8px', padding: '10px', background: '#fff7fa', border: '1px solid #ffd6e0', borderRadius: '10px' }}>
          <div style={{ fontSize: '11px', fontWeight: 900, color: '#333', marginBottom: '8px' }}>
            {safeCoins} → {coinScopeDialog.newCoins}코인 · 어디에 적용할까요?
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
            {[
              { label: '기본 설정만', scope: 'template' },
              { label: '오늘 일정도', scope: 'today' },
              { label: '전체 일정도', scope: 'all' }
            ].map(({ label, scope }) => (
              <button
                key={scope}
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  onSave(subject.name, { ...subject, coins: coinScopeDialog.newCoins }, scope)
                  setCoinScopeDialog(null)
                }}
                style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid #ffd6e0', background: 'white', color: '#333', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setCoinScopeDialog(null) }}
              style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#666', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────── SubjectPalette ────────────────────────────
export function SubjectPalette({
  cloud,
  isAdmin,
  allowDrag = true,
  activeKidId = '',
  kids = [],
  kidLabels = {},
  onCoinChange,
  collapsibleAdminSections = false
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
  const [openByKid, setOpenByKid] = useState({})
  // sortMode per kid: 'manual' | 'name' | 'coins'
  const [sortModeByKid, setSortModeByKid] = useState({})
  // expanded categories per kid: { [kidId]: Set<string> }
  const [expandedCatsByKid, setExpandedCatsByKid] = useState({})

  const readyRef = useRef({})
  const lastSyncedRef = useRef({})

  const patchDraft = (kidId, patch) => {
    setDraftByKid((prev) => ({
      ...prev,
      [kidId]: { name: '', color: '#8b5cf6', coins: 1, category: '', ...(prev[kidId] || {}), ...patch }
    }))
  }

  const persistKidSubjects = async (kidId, subjects) => {
    // Never write an empty list or DEFAULT_SUBJECTS as a silent fallback
    if (!subjects || subjects.length === 0) return

    const normalizedSubjects = normalizeSubjectList(subjects)
    // Strip undefined category fields before writing
    const cleanSubjects = normalizedSubjects.map((s) => {
      const obj = { name: s.name, color: s.color, coins: s.coins }
      if (s.category) obj.category = s.category
      return obj
    })
    const json = stableSubjectsJSON(cleanSubjects)

    if (!isCloud) {
      localStorage.setItem(getStorageKey(kidId), JSON.stringify(cleanSubjects))
      lastSyncedRef.current[kidId] = json
      return
    }

    const ref = doc(cloud.db, 'households', cloud.householdId, 'kids', kidId)
    await setDoc(ref, { subjects: cleanSubjects, updatedAt: serverTimestamp() }, { merge: true })
    lastSyncedRef.current[kidId] = json
  }

  const updateKidSubjects = (kidId, nextOrUpdater) => {
    const current = subjectsByKid[kidId] || []
    const raw = typeof nextOrUpdater === 'function' ? nextOrUpdater(current) : nextOrUpdater
    const next = Array.isArray(raw) && raw.length > 0 ? normalizeSubjectList(raw) : []
    setSubjectsByKid((prev) => ({ ...prev, [kidId]: next.length > 0 ? next : prev[kidId] || [] }))
    if (next.length > 0) persistKidSubjects(kidId, next).catch(console.error)
    return next
  }

  const moveSubject = (kidId, subjectName, direction) => {
    const current = subjectsByKid[kidId] || []
    const idx = current.findIndex((s) => s.name === subjectName)
    if (idx < 0) return
    const next = [...current]
    const swapIdx = idx + direction
    if (swapIdx < 0 || swapIdx >= next.length) return
    ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
    updateKidSubjects(kidId, next)
  }

  // ── LocalStorage sync (offline) ──
  useEffect(() => {
    if (isCloud || targetKidIds.length === 0) return
    const next = {}
    targetKidIds.forEach((kidId) => {
      try {
        const saved = localStorage.getItem(getStorageKey(kidId))
        const parsed = saved ? JSON.parse(saved) : null
        next[kidId] = parsed && parsed.length > 0 ? normalizeSubjectList(parsed) : normalizeSubjectList(DEFAULT_SUBJECTS)
      } catch {
        next[kidId] = normalizeSubjectList(DEFAULT_SUBJECTS)
      }
    })
    setSubjectsByKid(next)
  }, [isCloud, targetKidIds.join('|')])

  // ── Firestore sync ──
  useEffect(() => {
    if (!isCloud || targetKidIds.length === 0) return
    let cancelled = false
    const unsubs = []

    const setupKid = async (kidId) => {
      const kidRef = doc(cloud.db, 'households', cloud.householdId, 'kids', kidId)
      const legacyRef = doc(cloud.db, 'households', cloud.householdId, 'meta', 'subjects')

      // Initial load
      const kidSnap = await getDoc(kidRef)
      let initialSubjects = null
      if (kidSnap.exists()) {
        const kidData = kidSnap.data() || {}
        if (Array.isArray(kidData.subjects) && kidData.subjects.length > 0) {
          initialSubjects = kidData.subjects
        }
      }
      if (!initialSubjects) {
        const legacySnap = await getDoc(legacyRef)
        const legacyData = legacySnap.exists() ? legacySnap.data() : {}
        if (Array.isArray(legacyData?.subjects) && legacyData.subjects.length > 0) {
          initialSubjects = legacyData.subjects
        }
      }

      const initial = normalizeSubjectList(initialSubjects || DEFAULT_SUBJECTS)
      if (cancelled) return

      readyRef.current[kidId] = true
      lastSyncedRef.current[kidId] = stableSubjectsJSON(initial)
      setSubjectsByKid((prev) => ({ ...prev, [kidId]: initial }))

      // Live updates — only update state from Firestore when subjects actually changed
      const unsub = onSnapshot(kidRef, (snap) => {
        if (!snap.exists()) return
        const data = snap.data() || {}

        if (!Array.isArray(data.subjects) || data.subjects.length === 0) {
          // Firestore snapshot has no subjects — do NOT override local state
          return
        }

        const next = normalizeSubjectList(data.subjects)
        const nextJSON = stableSubjectsJSON(next)

        // Only update local state if Firestore has genuinely different subjects
        if (nextJSON !== lastSyncedRef.current[kidId]) {
          lastSyncedRef.current[kidId] = nextJSON
          setSubjectsByKid((prev) => ({ ...prev, [kidId]: next }))
        }
      })
      unsubs.push(unsub)
    }

    targetKidIds.forEach((kidId) => setupKid(kidId).catch(console.error))

    return () => {
      cancelled = true
      unsubs.forEach((unsub) => unsub && unsub())
    }
  }, [isCloud, cloud?.db, cloud?.householdId, targetKidIds.join('|')])

  // ── Collapsible admin sections ──
  useEffect(() => {
    if (!isAdmin || !collapsibleAdminSections) return
    setOpenByKid((prev) => {
      const next = { ...prev }
      targetKidIds.forEach((kidId) => {
        if (typeof next[kidId] !== 'boolean') next[kidId] = true
      })
      return next
    })
  }, [isAdmin, collapsibleAdminSections, targetKidIds.join('|')])

  const getSortMode = (kidId) => sortModeByKid[kidId] || 'manual'
  const setSortMode = (kidId, mode) => setSortModeByKid((prev) => ({ ...prev, [kidId]: mode }))

  const isCategoryExpanded = (kidId, category) => {
    const set = expandedCatsByKid[kidId]
    if (!set) return true // default expanded
    return set.has(category)
  }

  const toggleCategory = (kidId, category) => {
    setExpandedCatsByKid((prev) => {
      const set = new Set(prev[kidId] ?? [])
      if (set.has(category)) {
        // If current is missing, it means all expanded; build a set with all except this one
        if (!prev[kidId]) {
          // Initialize with all categories except this one (so this one becomes collapsed)
          const allCats = [...new Set((subjectsByKid[kidId] || []).map((s) => s.category).filter(Boolean))]
          const newSet = new Set(allCats.filter((c) => c !== category))
          return { ...prev, [kidId]: newSet }
        }
        set.delete(category)
      } else {
        set.add(category)
      }
      return { ...prev, [kidId]: set }
    })
  }

  const renderSection = (kidId) => {
    const raw = subjectsByKid[kidId] || []
    const displayList = raw.length > 0 ? raw : DEFAULT_SUBJECTS
    const sortMode = getSortMode(kidId)
    const draft = draftByKid[kidId] || { name: '', color: '#8b5cf6', coins: 1, category: '' }
    const title = kidLabels[kidId] || kidId
    const allowKidDrag = allowDrag && !isAdmin
    const isOpen = collapsibleAdminSections && isAdmin ? openByKid[kidId] !== false : true

    // Sorted display
    const sortedList = sortMode === 'name'
      ? [...displayList].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
      : sortMode === 'coins'
      ? [...displayList].sort((a, b) => b.coins - a.coins)
      : displayList

    // Group by category
    const categoryOrder = []
    const byCategory = {}
    const uncategorized = []

    for (const subject of sortedList) {
      const cat = subject.category || ''
      if (cat) {
        if (!byCategory[cat]) {
          byCategory[cat] = []
          categoryOrder.push(cat)
        }
        byCategory[cat].push(subject)
      } else {
        uncategorized.push(subject)
      }
    }

    // Existing categories for autocomplete
    const existingCategories = [...new Set(displayList.map((s) => s.category).filter(Boolean))]

    const onSave = (previousName, nextSubject, scope = 'template') => {
      const beforeCoins = getSubjectCoinValue(subjectsByKid[kidId]?.find((s) => s.name === previousName) || {})
      const afterCoins = getSubjectCoinValue(nextSubject)
      // Remove category field if empty
      const clean = { ...nextSubject }
      if (!clean.category) delete clean.category
      updateKidSubjects(kidId, (items) => (items || []).map((item) => (item.name === previousName ? clean : item)))
      if (typeof onCoinChange === 'function' && beforeCoins !== afterCoins) {
        onCoinChange({ kidId, subjectName: clean.name || previousName, previousSubjectName: previousName, beforeCoins, afterCoins, scope })
      }
    }

    const renderItem = (subject, idx, groupList) => (
      <PaletteItem
        key={`${kidId}-${subject.name}`}
        subject={subject}
        onSave={onSave}
        onDelete={(name) => updateKidSubjects(kidId, (items) => (items || []).filter((item) => item.name !== name))}
        onMoveUp={sortMode === 'manual' && idx > 0 ? () => moveSubject(kidId, subject.name, -1) : null}
        onMoveDown={sortMode === 'manual' && idx < groupList.length - 1 ? () => moveSubject(kidId, subject.name, 1) : null}
        allowDrag={allowKidDrag}
        canEditName
        canEditColor
        canEditCoins={isAdmin}
        canDelete
        showMoveButtons={sortMode === 'manual'}
        existingCategories={existingCategories}
      />
    )

    return (
      <div key={kidId} style={{ marginBottom: '18px', border: '1px solid #ffe1ea', borderRadius: '14px', padding: '12px' }}>
        {isAdmin && (
          <button
            onClick={() => {
              if (!collapsibleAdminSections) return
              setOpenByKid((prev) => ({ ...prev, [kidId]: !isOpen }))
            }}
            style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'left', fontSize: '13px', fontWeight: 900, marginBottom: '10px', color: '#ff4d6d', cursor: collapsibleAdminSections ? 'pointer' : 'default', padding: 0 }}
          >
            {collapsibleAdminSections ? `${isOpen ? '▼' : '▶'} ${title}` : title}
          </button>
        )}

        {isOpen && (
          <>
            {/* Sort controls */}
            <div style={{ display: 'flex', gap: '5px', marginBottom: '10px', flexWrap: 'wrap' }}>
              {[
                { key: 'manual', label: '직접정렬' },
                { key: 'name', label: '이름순' },
                { key: 'coins', label: '코인순' }
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSortMode(kidId, key)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    border: `1px solid ${sortMode === key ? '#ff4d6d' : '#e2e8f0'}`,
                    background: sortMode === key ? '#ff4d6d10' : 'white',
                    color: sortMode === key ? '#ff4d6d' : '#888',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
              {/* Categorized groups */}
              {categoryOrder.map((cat) => {
                const groupItems = byCategory[cat]
                const expanded = isCategoryExpanded(kidId, cat)
                return (
                  <div key={cat}>
                    <button
                      type="button"
                      onClick={() => toggleCategory(kidId, cat)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        border: 'none',
                        background: '#f8f0ff',
                        borderRadius: '8px',
                        padding: '6px 10px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 900,
                        color: '#7c3aed',
                        marginBottom: expanded ? '6px' : 0,
                        textAlign: 'left'
                      }}
                    >
                      {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      {cat}
                      <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#a78bfa', fontWeight: 700 }}>
                        {groupItems.length}개
                      </span>
                    </button>
                    {expanded && (
                      <div style={{ display: 'grid', gap: '6px', paddingLeft: '10px' }}>
                        {groupItems.map((subject, idx) => renderItem(subject, idx, groupItems))}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Uncategorized */}
              {uncategorized.map((subject, idx) => renderItem(subject, idx, uncategorized))}
            </div>

            {/* Add form */}
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  className="input-field"
                  style={{ flex: 1 }}
                  placeholder="과목 추가"
                  value={draft.name}
                  onChange={(e) => patchDraft(kidId, { name: e.target.value })}
                />
                <input
                  type="color"
                  value={draft.color || '#8b5cf6'}
                  onChange={(e) => patchDraft(kidId, { color: e.target.value })}
                  style={{ width: '40px', height: '40px', border: 'none', background: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                {isAdmin && (
                  <input
                    type="number"
                    className="input-field"
                    style={{ width: '80px' }}
                    placeholder="코인"
                    value={draft.coins}
                    onChange={(e) => patchDraft(kidId, { coins: parseInt(e.target.value, 10) || 0 })}
                  />
                )}
                <input
                  className="input-field"
                  style={{ flex: 1 }}
                  placeholder="카테고리 (선택)"
                  value={draft.category || ''}
                  onChange={(e) => patchDraft(kidId, { category: e.target.value })}
                  list={`new-categories-${kidId}`}
                />
                {existingCategories.length > 0 && (
                  <datalist id={`new-categories-${kidId}`}>
                    {existingCategories.map((c) => <option key={c} value={c} />)}
                  </datalist>
                )}
              </div>
              <button
                className="btn-primary"
                style={{ width: '100%' }}
                onClick={() => {
                  const name = (draft.name || '').trim()
                  if (!name) return
                  const newSubject = {
                    name,
                    color: draft.color || '#8b5cf6',
                    coins: isAdmin ? (parseInt(String(draft.coins), 10) || 1) : 1
                  }
                  if (draft.category?.trim()) newSubject.category = draft.category.trim()
                  updateKidSubjects(kidId, [...(subjectsByKid[kidId] || []), newSubject])
                  patchDraft(kidId, { name: '', coins: 1, category: '' })
                }}
              >
                과목 추가
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 900 }}>
          {isAdmin ? '과목 총관리' : '내 과목 팔레트'}
        </h3>
        <span style={{ fontSize: '11px', color: '#999' }}>
          {isAdmin ? '아이별 과목/코인 관리' : (allowDrag ? '드래그해서 시간표에 넣기' : '과목/색상 관리')}
        </span>
      </div>

      {targetKidIds.map((kidId) => renderSection(kidId))}
    </div>
  )
}
