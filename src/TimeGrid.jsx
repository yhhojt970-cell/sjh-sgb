import React, { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { Clock, Edit3, Heart, MessageSquare, Play, RotateCcw, Save, Sparkles, Star, Trash2, X } from 'lucide-react'

const PRIMARY_PINK = '#ff4d6d'
const LIGHT_PINK = '#fff0f3'
const BASE_HOURS = Array.from({ length: 18 }, (_, index) => index + 7)

const buildExpectedEndTime = (startTime, duration = 50) => {
  const [hour, minute] = String(startTime || '00:00').split(':').map(Number)
  const total = hour * 60 + minute + Number(duration || 0)
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

const normalizeClassStatus = (status, completed) => {
  const value = String(status || '').trim().toLowerCase()
  if (value === 'completed' || value === '완료' || completed) return 'completed'
  if (value === 'holiday' || value === '휴강') return 'holiday'
  if (value === 'absent' || value === '결석') return 'absent'
  return ''
}

function TimeSlot({ hour, tasks, onUpdateTask, onDeleteTask, isAdmin, isMobile, onAddSpecialEvent }) {
  const { isOver, setNodeRef } = useDroppable({ id: `hour-${hour}`, data: { hour } })
  const [activeSlot, setActiveSlot] = useState(false)
  const hourTasks = useMemo(
    () => tasks.filter((task) => parseInt(String(task.startTime || '00:00').split(':')[0], 10) === hour),
    [tasks, hour]
  )

  useEffect(() => {
    if (!isMobile || !activeSlot) return
    const timer = setTimeout(() => setActiveSlot(false), 2200)
    return () => clearTimeout(timer)
  }, [activeSlot, isMobile])

  return (
    <div
      ref={setNodeRef}
      onClick={() => isAdmin && setActiveSlot((prev) => !prev)}
      onMouseEnter={() => !isMobile && setActiveSlot(true)}
      onMouseLeave={() => !isMobile && setActiveSlot(false)}
      style={{
        display: 'flex',
        minHeight: hourTasks.length > 0 ? (isMobile ? '92px' : '110px') : (isMobile ? '50px' : '55px'),
        borderBottom: '1px solid rgba(0,0,0,0.05)',
        background: isOver ? 'rgba(255,77,109,0.05)' : 'transparent',
        transition: 'all 0.2s ease',
        position: 'relative',
        cursor: isAdmin ? 'pointer' : 'default'
      }}
    >
      <div style={{ width: '60px', padding: '15px 0', fontSize: '13px', color: '#999', fontWeight: 'bold', borderRight: '1px solid rgba(0,0,0,0.03)', textAlign: 'center' }}>
        {String(hour).padStart(2, '0')}:00
      </div>

      {isAdmin && activeSlot && (
        <button
          onClick={(event) => {
            event.stopPropagation()
            onAddSpecialEvent(hour)
            setActiveSlot(false)
          }}
          style={{ position: 'absolute', right: '10px', top: '8px', zIndex: 10, background: '#fbbf24', color: 'white', border: 'none', borderRadius: '10px', padding: isMobile ? '7px 11px' : '6px 12px', fontSize: isMobile ? '12px' : '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', boxShadow: '0 4px 10px rgba(251,191,36,0.4)' }}
        >
          <Star size={14} fill="white" />
          특별 일정 추가
        </button>
      )}

      <div style={{ flex: 1, padding: '10px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-start' }}>
        {hourTasks.map((task) => (
          <div key={task.id} style={{ flex: isMobile ? '1 1 100%' : '1 1 calc(33.333% - 10px)', minWidth: isMobile ? '100%' : '220px', maxWidth: isMobile ? '100%' : 'calc(33.333% - 7px)' }}>
            <TaskCard task={task} onUpdateTask={onUpdateTask} onDeleteTask={onDeleteTask} isAdmin={isAdmin} isMobile={isMobile} />
          </div>
        ))}
      </div>
    </div>
  )
}

function TaskCard({ task, onUpdateTask, onDeleteTask, isAdmin, isMobile }) {
  const [isEditing, setIsEditing] = useState(false)
  const [showMemo, setShowMemo] = useState(false)
  const [draftName, setDraftName] = useState(task.name || '')
  const [draftStartTime, setDraftStartTime] = useState(task.startTime || '07:00')
  const [draftDuration, setDraftDuration] = useState(Number(task.duration || 50))
  const [draftMemo, setDraftMemo] = useState(task.memo || task.note || '')
  const [draftColor, setDraftColor] = useState(task.color || PRIMARY_PINK)
  const [draftCoins, setDraftCoins] = useState(Number(task.coins || (task.type === 'study' ? 1 : 0)))
  const [draftStartDate, setDraftStartDate] = useState(task.startDate || task.classStartDate || '')
  const [draftEndDate, setDraftEndDate] = useState(task.endDate || task.classEndDate || '')

  useEffect(() => {
    setDraftName(task.name || '')
    setDraftStartTime(task.startTime || '07:00')
    setDraftDuration(Number(task.duration || 50))
    setDraftMemo(task.memo || task.note || '')
    setDraftColor(task.color || PRIMARY_PINK)
    setDraftCoins(Number(task.coins || (task.type === 'study' ? 1 : 0)))
    setDraftStartDate(task.startDate || task.classStartDate || '')
    setDraftEndDate(task.endDate || task.classEndDate || '')
  }, [task])

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { type: 'task', task },
    disabled: isEditing || isMobile
  })

  const memo = task.memo || task.note || ''
  const actualStart = task.actualStartTime || task.startTimeActual || ''
  const actualEnd = task.actualEndTime || task.endTimeActual || ''
  const parseClockToMinutes = (value) => {
    if (!value || typeof value !== 'string' || !value.includes(':')) return null
    const [h, m] = value.split(':').map((n) => parseInt(n, 10))
    if (Number.isNaN(h) || Number.isNaN(m)) return null
    return h * 60 + m
  }
  const computeDuration = (startClock, endClock) => {
    const startMin = parseClockToMinutes(startClock)
    const endMin = parseClockToMinutes(endClock)
    if (startMin === null || endMin === null) return null
    let diff = endMin - startMin
    if (diff < 0) diff += 24 * 60
    return diff
  }
  const persistedDuration = [
    task.durationActual,
    task.actualDuration,
    task.durationMinutes,
    task.elapsedMinutes,
    task.spentMinutes
  ]
    .map((value) => (value === '' || value === null || value === undefined ? null : Number(value)))
    .find((value) => value !== null && !Number.isNaN(value))
  const actualDuration = persistedDuration ?? computeDuration(actualStart, actualEnd)
  const classStatus = normalizeClassStatus(task.status, task.completed)
  const canManageTask = isAdmin || task.type !== 'class'
  const [tick, setTick] = useState(Date.now())

  useEffect(() => {
    if (task.type === 'class' || task.completed || !actualStart) return
    const timer = setInterval(() => setTick(Date.now()), 10000)
    return () => clearInterval(timer)
  }, [task.type, task.completed, actualStart])

  const liveDuration = task.completed ? actualDuration : (actualStart ? computeDuration(actualStart, format(new Date(tick), 'HH:mm')) : null)

  const handleStartTimer = () => {
    if (actualStart) return
    const now = format(new Date(), 'HH:mm')
    onUpdateTask(task.id, { startTimeActual: now, actualStartTime: now, status: 'studying' })
  }

  const handleComplete = () => {
    const nowDate = new Date()
    const now = format(nowDate, 'HH:mm')
    const updates = { completed: true, status: 'completed', endTimeActual: now, actualEndTime: now }
    if (actualStart) {
      const [h, m] = actualStart.split(':').map(Number)
      const startedAt = new Date()
      startedAt.setHours(h, m, 0, 0)
      const minutes = Math.max(0, Math.round((nowDate - startedAt) / 60000))
      updates.durationActual = minutes
      updates.actualDuration = minutes
      updates.durationMinutes = minutes
    }
    onUpdateTask(task.id, updates)
  }

  const saveEdit = () => {
    const safeName = draftName.trim()
    if (!safeName) return

    const safeDuration = Math.max(1, Number(draftDuration || 0))
    onUpdateTask(task.id, {
      name: safeName,
      startTime: draftStartTime,
      duration: safeDuration,
      expectedEndTime: buildExpectedEndTime(draftStartTime, safeDuration),
      memo: draftMemo.trim(),
      note: draftMemo.trim(),
      color: draftColor || task.color || PRIMARY_PINK,
      coins: Math.max(0, Number(draftCoins || 0)),
      startDate: draftStartDate || null,
      endDate: draftEndDate || null,
      classStartDate: draftStartDate || null,
      classEndDate: draftEndDate || null
    })
    setIsEditing(false)
  }

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    background: task.completed ? '#f8fafc' : 'linear-gradient(135deg, #ffffff 0%, #fff8fb 100%)',
    borderLeft: `6px solid ${task.color || PRIMARY_PINK}`,
    borderRadius: '15px',
    padding: isMobile ? '10px' : '15px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
    position: 'relative',
    border: task.completed ? '1px solid #e2e8f0' : `1px solid ${(task.color || PRIMARY_PINK)}20`,
    height: '100%'
  }

  if (task.type === 'event') {
    return (
      <div style={{ ...style, borderLeft: '6px solid #fbbf24', background: '#fffbeb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Star size={20} color="#fbbf24" fill="#fbbf24" />
            <div>
              <div style={{ fontWeight: 900, fontSize: '15px' }}>{task.name}</div>
              <div style={{ fontSize: '12px', color: '#999' }}>특별 일정</div>
            </div>
          </div>
          {isAdmin && <button onPointerDown={(event) => { event.stopPropagation(); onDeleteTask(task.id) }} style={{ color: '#ff4d6d', border: 'none', background: 'none', cursor: 'pointer' }}><Trash2 size={18} /></button>}
        </div>
      </div>
    )
  }

  return (
    <div ref={setNodeRef} style={{ ...style, touchAction: isMobile ? 'auto' : 'manipulation' }} {...(isEditing || isMobile ? {} : attributes)} {...(isEditing || isMobile ? {} : listeners)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
            <div
              onClick={(event) => {
                if (!memo) return
                event.stopPropagation()
                setShowMemo((prev) => !prev)
              }}
              style={{
                fontWeight: 900,
                color: '#333',
                fontSize: '15px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                cursor: memo ? 'pointer' : 'default',
                textDecorationLine: memo ? 'underline' : 'none',
                textDecorationStyle: memo ? 'dotted' : 'solid',
                textUnderlineOffset: memo ? '3px' : 0
              }}
              title={memo ? '클릭해서 메모 보기' : ''}
            >
              {task.name} {task.completed && <Sparkles size={14} color="#fbbf24" style={{ display: 'inline' }} />}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {task.startTime} ~ {task.expectedEndTime} ({task.duration}분)
            </div>
          </div>
        </div>
        {canManageTask && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {isAdmin && task.type === 'class' && (
              <button
                onPointerDown={(event) => {
                  event.stopPropagation()
                  onUpdateTask(task.id, { completed: false, status: '', coins: task.coins || 1 })
                }}
                style={{ color: '#666', border: 'none', background: '#f1f5f9', borderRadius: '8px', padding: '5px', cursor: 'pointer' }}
                title="상태 초기화"
              >
                <RotateCcw size={14} />
              </button>
            )}
            <button onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setIsEditing((prev) => !prev) }} style={{ color: '#666', border: 'none', background: '#f1f5f9', borderRadius: '8px', padding: '5px', cursor: 'pointer' }}>
              <Edit3 size={14} />
            </button>
            <button onPointerDown={(event) => { event.stopPropagation(); onDeleteTask(task.id) }} style={{ color: '#ff4d6d', border: 'none', background: 'none', cursor: 'pointer' }}>
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>

      {isEditing && canManageTask ? (
        <div style={{ display: 'grid', gap: '6px', marginBottom: '10px', background: '#fff7fa', border: '1px solid #ffdbe5', borderRadius: '10px', padding: '10px' }}>
          <input className="input-field" value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="일정 이름" />
          <div style={{ display: 'flex', gap: '6px' }}>
            <input className="input-field" type="time" value={draftStartTime} onChange={(event) => setDraftStartTime(event.target.value)} />
            <input className="input-field" type="number" min="1" value={draftDuration} onChange={(event) => setDraftDuration(Number(event.target.value || 0))} placeholder="분" />
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input type="color" value={draftColor} onChange={(event) => setDraftColor(event.target.value)} style={{ width: '42px', height: '42px', border: '1px solid #ffdbe5', borderRadius: '10px', background: '#fff', padding: '3px', cursor: 'pointer' }} />
            <input className="input-field" type="number" min="0" value={draftCoins} onChange={(event) => setDraftCoins(Number(event.target.value || 0))} placeholder="코인" />
          </div>
          <textarea className="input-field" value={draftMemo} onChange={(event) => setDraftMemo(event.target.value)} placeholder="메모(선택)" style={{ minHeight: '68px', resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: '6px' }}>
            <input className="input-field" type="date" value={draftStartDate} onChange={(event) => setDraftStartDate(event.target.value)} placeholder="수업 시작 날짜" />
            <input className="input-field" type="date" value={draftEndDate} onChange={(event) => setDraftEndDate(event.target.value)} placeholder="수업 종료 날짜" />
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); saveEdit() }} className="btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              <Save size={14} /> 저장
            </button>
            <button onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setIsEditing(false) }} style={{ flex: 1, border: '1px solid #ddd', background: 'white', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
              <X size={14} style={{ verticalAlign: 'middle' }} /> 취소
            </button>
          </div>
        </div>
      ) : null}

      {memo && showMemo ? (
        <div style={{ border: '1px solid #ffe0ea', background: 'linear-gradient(135deg, #fffef8 0%, #fff5f9 100%)', borderRadius: '10px', padding: '10px', marginBottom: '10px', fontSize: '12px', lineHeight: 1.5, color: '#444', whiteSpace: 'pre-wrap', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
          <MessageSquare size={13} style={{ marginTop: '2px', color: '#d6336c', flexShrink: 0 }} />
          {memo}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
        {task.type === 'class' ? (
          <div style={{ width: '100%' }}>
            <div style={{ display: 'grid', gap: '6px', width: '100%', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            <button onPointerDown={(event) => { event.stopPropagation(); onUpdateTask(task.id, { completed: true, status: 'completed', coins: 1 }) }} style={{ padding: '8px', borderRadius: '10px', background: classStatus === 'completed' ? '#42c99b' : '#f1f5f9', color: classStatus === 'completed' ? 'white' : '#666', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: isMobile ? '12px' : '13px' }}>완료</button>
            <button onPointerDown={(event) => { event.stopPropagation(); onUpdateTask(task.id, { completed: false, status: 'holiday' }) }} style={{ padding: '8px', borderRadius: '10px', background: classStatus === 'holiday' ? '#3b82f6' : '#f1f5f9', color: classStatus === 'holiday' ? 'white' : '#666', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: isMobile ? '12px' : '13px' }}>휴강</button>
            <button onPointerDown={(event) => { event.stopPropagation(); onUpdateTask(task.id, { completed: false, status: 'absent' }) }} style={{ padding: '8px', borderRadius: '10px', background: classStatus === 'absent' ? '#ef4444' : '#f1f5f9', color: classStatus === 'absent' ? 'white' : '#666', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: isMobile ? '12px' : '13px' }}>결석</button>
            </div>
          </div>
        ) : (
          <>
            {!task.completed && !actualStart && <button onPointerDown={(event) => { event.stopPropagation(); handleStartTimer() }} style={{ flex: 1, padding: '8px', borderRadius: '10px', background: PRIMARY_PINK, color: 'white', border: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer', fontSize: isMobile ? '12px' : '13px' }}><Play size={14} />공부 시작</button>}
            {actualStart && !task.completed && <button onPointerDown={(event) => { event.stopPropagation(); handleComplete() }} style={{ flex: 1, padding: '8px', borderRadius: '10px', background: '#42c99b', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: isMobile ? '12px' : '13px' }}>완료</button>}
            {task.completed && (
              <div style={{ fontSize: '11px', color: '#42c99b', fontWeight: 'bold', lineHeight: 1.2 }}>
                {actualStart && actualEnd ? `✨ ${actualStart} ~ ${actualEnd} (${actualDuration ?? '-'}분)` : '✨ 완료'}
              </div>
            )}
            {!task.completed && actualStart && (
              <div style={{ fontSize: '11px', color: '#ff4d6d', fontWeight: 'bold', lineHeight: 1.2 }}>
                ⏱ 진행 중 {liveDuration ?? 0}분
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function TimeGrid({ tasks, onUpdateTask, onDeleteTask, isAdmin, isMobile, onAddSpecialEvent, essentialChecklist = [] }) {
  const hours = useMemo(() => {
    const taskHours = (tasks || [])
      .map((task) => {
        const hour = parseInt(String(task?.startTime || '').split(':')[0], 10)
        return Number.isNaN(hour) ? null : Math.max(0, Math.min(23, hour))
      })
      .filter((hour) => hour !== null)
    return [...new Set([...BASE_HOURS, ...taskHours])].sort((a, b) => a - b)
  }, [tasks])

  return (
    <div style={{ background: 'linear-gradient(135deg, #fffef7 0%, #fff4f8 100%)', borderRadius: '24px', overflow: 'hidden', border: '1px solid #ffdeeb', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
      <div style={{ padding: '20px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 900, color: '#333', whiteSpace: 'nowrap' }}>
          <Clock color={PRIMARY_PINK} /> 꼭
        </div>
        <div style={{ flex: 1, display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '5px', scrollbarWidth: 'none' }}>
          {essentialChecklist.map((item) => {
            const isDone = tasks.some((task) => task.name.includes(item.name) && task.completed)
            return (
              <div key={item.id} style={{ flexShrink: 0, padding: '6px 12px', background: isDone ? LIGHT_PINK : '#fff', border: isDone ? `1px solid ${PRIMARY_PINK}` : '1px solid #ffdeeb', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', color: isDone ? PRIMARY_PINK : '#999', display: 'flex', alignItems: 'center', gap: '5px' }}>
                {isDone ? <Heart size={12} fill={PRIMARY_PINK} color={PRIMARY_PINK} /> : null}
                {item.name}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ maxHeight: '800px', overflowY: 'auto' }}>
        {hours.map((hour) => (
          <TimeSlot key={hour} hour={hour} tasks={tasks} onUpdateTask={onUpdateTask} onDeleteTask={onDeleteTask} isAdmin={isAdmin} isMobile={isMobile} onAddSpecialEvent={onAddSpecialEvent} />
        ))}
      </div>
    </div>
  )
}
