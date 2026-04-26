import React, { useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CalendarX, Check, Clock, Edit3, Heart, MessageSquare, Play, RotateCcw, Save, Sparkles, Star, Trash2, UserX, X } from 'lucide-react'

const PRIMARY_PINK = '#ff4d6d'
const LIGHT_PINK = '#fff0f3'
const BASE_HOURS = Array.from({ length: 18 }, (_, index) => index + 7)
const MOBILE_EMPTY_SLOT_HEIGHT = 50
const MOBILE_TASK_CARD_HEIGHT = 112
const MOBILE_SLOT_PADDING_Y = 20
const DESKTOP_EMPTY_SLOT_HEIGHT = 55
const DESKTOP_TASK_SLOT_HEIGHT = 110

const buildExpectedEndTime = (startTime, duration = 50) => {
  const [hour, minute] = String(startTime || '00:00').split(':').map(Number)
  const total = hour * 60 + minute + Number(duration || 0)
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function TimeSlot({ hour, tasks, doneLogs, todayStr, onUpdateTask, onDeleteTask, isAdmin, isMobile, onAddSpecialEvent, essentialChecklist = [] }) {
  const { isOver, setNodeRef } = useDroppable({ id: `hour-${hour}`, data: { hour } })
  const [activeSlot, setActiveSlot] = useState(false)
  const hourTasks = useMemo(
    () => tasks.filter((task) => parseInt(String(task.startTime || '00:00').split(':')[0], 10) === hour),
    [tasks, hour]
  )
  const slotMinHeight = useMemo(() => {
    if (hourTasks.length === 0) return isMobile ? MOBILE_EMPTY_SLOT_HEIGHT : DESKTOP_EMPTY_SLOT_HEIGHT
    if (!isMobile) return DESKTOP_TASK_SLOT_HEIGHT
    return MOBILE_SLOT_PADDING_Y + (hourTasks.length * MOBILE_TASK_CARD_HEIGHT) + (Math.max(0, hourTasks.length - 1) * 10)
  }, [hourTasks.length, isMobile])

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
        minHeight: `${slotMinHeight}px`,
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

      <div style={{ flex: 1, minWidth: 0, padding: '10px', boxSizing: 'border-box', display: 'flex', flexDirection: isMobile ? 'column' : 'row', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-start' }}>
        {hourTasks.map((task) => (
          <div key={task.id} style={{ flex: isMobile ? '0 0 auto' : '1 1 calc(33.333% - 10px)', width: isMobile ? '100%' : 'auto', minWidth: isMobile ? 0 : '220px', maxWidth: isMobile ? '100%' : 'calc(33.333% - 7px)', boxSizing: 'border-box' }}>
            <TaskCard task={task} doneLogs={doneLogs} todayStr={todayStr} onUpdateTask={onUpdateTask} onDeleteTask={onDeleteTask} isAdmin={isAdmin} isMobile={isMobile} essentialChecklist={essentialChecklist} />
          </div>
        ))}
      </div>
    </div>
  )
}

function TaskCard({ task, doneLogs = [], todayStr, onUpdateTask, onDeleteTask, isAdmin, isMobile, essentialChecklist = [] }) {
  const getTaskCoins = (targetTask) => {
    if (!targetTask) return 0
    const hasCoins = targetTask?.coins !== undefined && targetTask?.coins !== null && targetTask?.coins !== ''
    const parsedCoins = Number(targetTask?.coins)
    if (hasCoins && !Number.isNaN(parsedCoins)) return parsedCoins
    return targetTask?.type === 'study' ? 1 : 0
  }

  const [isEditing, setIsEditing] = useState(false)
  const [showMemo, setShowMemo] = useState(false)
  const [draftName, setDraftName] = useState(task.name || '')
  const [draftStartTime, setDraftStartTime] = useState(task.startTime || '07:00')
  const [draftDuration, setDraftDuration] = useState(Number(task.duration || 50))
  const [draftMemo, setDraftMemo] = useState(task.memo || task.note || '')
  const [draftColor, setDraftColor] = useState(task.color || PRIMARY_PINK)
  const [draftCoins, setDraftCoins] = useState(getTaskCoins(task))
  const [draftStartDate, setDraftStartDate] = useState(task.startDate || task.classStartDate || '')
  const [draftEndDate, setDraftEndDate] = useState(task.endDate || task.classEndDate || '')

  useEffect(() => {
    setDraftName(task.name || '')
    setDraftStartTime(task.startTime || '07:00')
    setDraftDuration(Number(task.duration || 50))
    setDraftMemo(task.memo || task.note || '')
    setDraftColor(task.color || PRIMARY_PINK)
    setDraftCoins(getTaskCoins(task))
    setDraftStartDate(task.startDate || task.classStartDate || '')
    setDraftEndDate(task.endDate || task.classEndDate || '')
  }, [task])

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { type: 'task', task },
    disabled: isEditing || isMobile || (task.type === 'class' && !isAdmin)
  })

  const memo = task.memo || task.note || ''
  const todayLog = useMemo(() => doneLogs.find(l => String(l.taskId) === String(task.id) && l.date === todayStr), [doneLogs, task.id, todayStr])
  const isEssential = useMemo(() => {
    const taskNameLower = String(task.name || '').trim().toLowerCase()
    return essentialChecklist.some(item => taskNameLower.includes(String(item.name || '').trim().toLowerCase()))
  }, [task.name, essentialChecklist])
  const isClassTask = task.type === 'class'
  const currentStatus = isClassTask ? (todayLog?.status || '') : ''
  const actualStart = todayLog?.startTimeActual || task.actualStartTime || task.startTimeActual || ''
  const actualEnd = todayLog?.endTimeActual || task.actualEndTime || task.endTimeActual || ''
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
  const taskCoins = getTaskCoins(task)
  const canManageTask = isAdmin || task.type !== 'class'
  const [tick, setTick] = useState(Date.now())
  const [overtimePopup, setOvertimePopup] = useState(false)
  const [extended, setExtended] = useState(false)
  const autoCompletedRef = useRef(false)

  const isDone = todayLog?.status === 'completed' || (task.completed && task.date === todayStr)
  const editRequested = todayLog?.editRequested || false

  useEffect(() => {
    if (task.type === 'class' || isDone || !actualStart) return
    autoCompletedRef.current = false
    const timer = setInterval(() => setTick(Date.now()), 10000)
    return () => clearInterval(timer)
  }, [task.type, isDone, actualStart])

  const liveDuration = isDone ? (todayLog?.durationActual || actualDuration) : (actualStart ? computeDuration(actualStart, format(new Date(tick), 'HH:mm')) : null)

  const buildCompletionUpdates = (coins) => {
    const nowDate = new Date()
    const now = format(nowDate, 'HH:mm')
    const updates = { completed: true, status: 'completed', endTimeActual: now, actualEndTime: now, coins }
    if (actualStart) {
      const [h, m] = actualStart.split(':').map(Number)
      const startedAt = new Date()
      startedAt.setHours(h, m, 0, 0)
      const minutes = Math.max(0, Math.round((nowDate - startedAt) / 60000))
      updates.durationActual = minutes
      updates.actualDuration = minutes
      updates.durationMinutes = minutes
    }
    return updates
  }

  useEffect(() => {
    if (task.type === 'class' || isDone || !actualStart || liveDuration === null) return
    if (liveDuration >= 240 && !autoCompletedRef.current) {
      autoCompletedRef.current = true
      onUpdateTask(task.id, { ...buildCompletionUpdates(0), autoCompleted: true })
      return
    }
    if (!extended && liveDuration >= 120 && !overtimePopup) setOvertimePopup(true)
    if (extended && liveDuration >= 240 && !autoCompletedRef.current) {
      autoCompletedRef.current = true
      onUpdateTask(task.id, { ...buildCompletionUpdates(0), autoCompleted: true })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveDuration, isDone, actualStart, extended, overtimePopup, task.type])

  const handleStartTimer = () => {
    if (actualStart) return
    const now = format(new Date(), 'HH:mm')
    onUpdateTask(task.id, { startTimeActual: now, actualStartTime: now, status: 'studying' })
  }

  const handleComplete = () => {
    onUpdateTask(task.id, buildCompletionUpdates(taskCoins))
  }

  const handleOvertimeComplete = () => {
    setOvertimePopup(false)
    const isActualToday = task.date === format(new Date(), 'yyyy-MM-dd')
    const coins = isActualToday ? taskCoins : 0
    onUpdateTask(task.id, {
      ...buildCompletionUpdates(coins),
      ...(isActualToday ? {} : { autoCompleted: true })
    })
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
    background: isDone ? '#f8fafc' : (isClassTask ? 'linear-gradient(135deg, #f7f9ff 0%, #f3f7ff 100%)' : 'linear-gradient(135deg, #ffffff 0%, #fff8fb 100%)'),
    borderLeft: `6px solid ${task.color || PRIMARY_PINK}`,
    borderRadius: '15px',
    padding: isMobile ? '8px 10px' : '15px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
    position: 'relative',
    border: isDone ? '1px solid #e2e8f0' : (isClassTask ? '1.5px dashed #b7c8ff' : `1px solid ${(task.color || PRIMARY_PINK)}20`),
    height: isMobile ? 'auto' : '100%',
    boxSizing: 'border-box',
    maxWidth: '100%'
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
    <div id={`task-${task.id}`} ref={setNodeRef} style={{ ...style, touchAction: isMobile ? 'auto' : 'manipulation' }} {...(isEditing || isMobile ? {} : attributes)} {...(isEditing || isMobile ? {} : listeners)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: isMobile ? '6px' : '10px', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
            {isClassTask ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '4px', background: '#dbe7ff', color: '#355eb5', borderRadius: '999px', padding: '2px 8px', fontSize: '10px', fontWeight: 900 }}>
                고정 수업
              </div>
            ) : null}
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
              title={task.name}
            >
              {task.name} {isDone && (isEssential
                ? <Heart size={14} color={PRIMARY_PINK} fill={PRIMARY_PINK} style={{ display: 'inline', marginLeft: '4px' }} />
                : <Star size={14} color="#fbbf24" fill="#fbbf24" style={{ display: 'inline', marginLeft: '4px' }} />
              )}
            </div>
            {editRequested && <div style={{ fontSize: '10px', color: PRIMARY_PINK, fontWeight: 900, marginTop: '2px' }}>⚠️ 수정 요청 중</div>}
            <div style={{ fontSize: '12px', color: '#666' }}>
              {task.startTime} ~ {task.expectedEndTime} ({task.duration}분){(isClassTask || taskCoins > 0) ? ` · ${taskCoins}코인` : ''}
            </div>
          </div>
        </div>
        {(canManageTask || (isClassTask && currentStatus && !isAdmin)) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            {canManageTask && isAdmin && task.type === 'class' && (
              <button
                onPointerDown={(event) => {
                  event.stopPropagation()
                  onUpdateTask(task.id, { completed: false, status: '', coins: taskCoins })
                }}
                style={{ color: '#666', border: 'none', background: '#f1f5f9', borderRadius: '8px', padding: '5px', cursor: 'pointer' }}
                title="상태 초기화"
              >
                <RotateCcw size={14} />
              </button>
            )}
            {canManageTask && (
              <button onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setIsEditing((prev) => !prev) }} style={{ color: '#666', border: 'none', background: '#f1f5f9', borderRadius: '8px', padding: '5px', cursor: 'pointer' }}>
                <Edit3 size={14} />
              </button>
            )}
            {isClassTask && currentStatus && !isAdmin && (
              <button 
                onPointerDown={(event) => event.stopPropagation()} 
                onClick={(event) => { 
                  event.stopPropagation(); 
                  if (editRequested) return;
                  if (window.confirm('수정을 요청할까요? 엄마가 확인 후 수정할 수 있게 해줄 거예요.')) {
                    onUpdateTask(task.id, { status: currentStatus, editRequested: true });
                  }
                }} 
                style={{ color: editRequested ? '#ccc' : PRIMARY_PINK, border: `1px solid ${editRequested ? '#eee' : PRIMARY_PINK}`, background: 'white', borderRadius: '8px', padding: '4px 6px', cursor: editRequested ? 'default' : 'pointer', fontSize: '10px', fontWeight: 900 }}
              >
                {editRequested ? '요청됨' : '수정요청'}
              </button>
            )}
            {canManageTask && (
              <button onPointerDown={(event) => { event.stopPropagation(); onDeleteTask(task.id) }} style={{ color: '#ff4d6d', border: 'none', background: 'none', cursor: 'pointer' }}>
                <Trash2 size={16} />
              </button>
            )}
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

      <div style={{ display: 'flex', gap: '6px', marginTop: isMobile ? '6px' : '10px' }}>
        {task.type === 'class' ? (
          <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
              <button
                onPointerDown={(event) => { 
                  if (currentStatus) return;
                  event.stopPropagation(); 
                  onUpdateTask(task.id, { completed: true, status: 'completed', coins: taskCoins }) 
                }}
                title="완료"
                aria-label="완료"
                style={{ width: isMobile ? '32px' : '40px', height: isMobile ? '32px' : '40px', borderRadius: '10px', background: currentStatus === 'completed' ? '#42c99b' : '#f1f5f9', color: currentStatus === 'completed' ? 'white' : '#666', border: 'none', cursor: currentStatus ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: currentStatus && currentStatus !== 'completed' ? 0.3 : 1 }}
                disabled={!!currentStatus}
              >
                <Check size={18} />
              </button>
              <button
                onPointerDown={(event) => { 
                  if (currentStatus) return;
                  event.stopPropagation(); 
                  onUpdateTask(task.id, { completed: false, status: 'holiday' }) 
                }}
                title="휴강"
                aria-label="휴강"
                style={{ width: isMobile ? '32px' : '40px', height: isMobile ? '32px' : '40px', borderRadius: '10px', background: currentStatus === 'holiday' ? '#3b82f6' : '#f1f5f9', color: currentStatus === 'holiday' ? 'white' : '#666', border: 'none', cursor: currentStatus ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: currentStatus && currentStatus !== 'holiday' ? 0.3 : 1 }}
                disabled={!!currentStatus}
              >
                <CalendarX size={18} />
              </button>
              <button
                onPointerDown={(event) => { 
                  if (currentStatus) return;
                  event.stopPropagation(); 
                  onUpdateTask(task.id, { completed: false, status: 'absent' }) 
                }}
                title="결석"
                aria-label="결석"
                style={{ width: isMobile ? '32px' : '40px', height: isMobile ? '32px' : '40px', borderRadius: '10px', background: currentStatus === 'absent' ? '#ef4444' : '#f1f5f9', color: currentStatus === 'absent' ? 'white' : '#666', border: 'none', cursor: currentStatus ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: currentStatus && currentStatus !== 'absent' ? 0.3 : 1 }}
                disabled={!!currentStatus}
              >
                <UserX size={18} />
              </button>
            </div>
          </div>
        ) : (
          <>
            {!isDone && !actualStart && <button onPointerDown={(event) => { event.stopPropagation(); handleStartTimer() }} style={{ flex: 1, padding: '8px', borderRadius: '10px', background: PRIMARY_PINK, color: 'white', border: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer', fontSize: isMobile ? '12px' : '13px' }}><Play size={14} />공부 시작</button>}
            {actualStart && !isDone && <button onPointerDown={(event) => { event.stopPropagation(); handleComplete() }} style={{ flex: 1, padding: '8px', borderRadius: '10px', background: '#3b82f6', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: isMobile ? '12px' : '13px' }}>공부중</button>}
            {isDone && (
              <div style={{ fontSize: '11px', fontWeight: 'bold', lineHeight: 1.2, color: todayLog?.autoCompleted ? '#94a3b8' : '#42c99b' }}>
                {todayLog?.autoCompleted
                  ? `⏰ 자동 완료됨 · 코인 미적립`
                  : (actualStart && (todayLog?.endTimeActual || task.endTimeActual || actualEnd)
                      ? `✨ ${actualStart} ~ ${todayLog?.endTimeActual || task.endTimeActual || actualEnd} (${liveDuration ?? '-'}분)`
                      : '✨ 완료')}
              </div>
            )}
            {!isDone && actualStart && (
              <div style={{ fontSize: '11px', color: '#ff4d6d', fontWeight: 'bold', lineHeight: 1.2 }}>
                ⏱ 진행 중 {liveDuration ?? 0}분
              </div>
            )}
          </>
        )}
      </div>

      {overtimePopup && !isDone && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setOvertimePopup(false)}>
          <div style={{ background: 'white', borderRadius: '24px', padding: '28px 24px', maxWidth: '320px', width: '100%', boxShadow: '0 24px 60px rgba(0,0,0,0.25)', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>⏰</div>
            <h3 style={{ fontWeight: 900, color: '#334155', margin: '0 0 8px', fontSize: '17px' }}>아직 공부 중인가요?</h3>
            <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 20px', lineHeight: 1.6 }}>
              <strong>{task.name}</strong>을 시작한 지<br />
              <strong>2시간</strong>이 지났어요.
            </p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button
                onClick={handleOvertimeComplete}
                style={{ flex: 1, padding: '12px', borderRadius: '12px', background: PRIMARY_PINK, color: 'white', border: 'none', fontWeight: 900, fontSize: '14px', cursor: 'pointer' }}
              >
                완료했어요
              </button>
              {!extended && (
                <button
                  onClick={() => { setExtended(true); setOvertimePopup(false) }}
                  style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #7c9cff', background: 'white', color: '#355eb5', fontWeight: 900, fontSize: '14px', cursor: 'pointer' }}
                >
                  조금 더 할게요
                </button>
              )}
            </div>
            <p style={{ color: '#94a3b8', fontSize: '11px', margin: 0, lineHeight: 1.5 }}>
              연장은 한 번만 가능해요.<br />총 4시간이 지나면 자동으로 완료되며 코인은 적립되지 않아요.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function TimeGrid({ tasks, doneLogs, todayStr, onUpdateTask, onDeleteTask, isAdmin, isMobile, onAddSpecialEvent, essentialChecklist = [] }) {
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
            const matchName = String(item.name || '').trim().toLowerCase();
            const matchingLog = doneLogs.find((log) => String(log.name || '').trim().toLowerCase().includes(matchName) && log.status === 'completed' && log.date === todayStr)
            const matchingTask = !matchingLog && tasks.find((task) => String(task.name || '').trim().toLowerCase().includes(matchName) && task.completed && task.date === todayStr)
            const isDone = !!matchingLog || !!matchingTask
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
          <TimeSlot key={hour} hour={hour} tasks={tasks} doneLogs={doneLogs} todayStr={todayStr} onUpdateTask={onUpdateTask} onDeleteTask={onDeleteTask} isAdmin={isAdmin} isMobile={isMobile} onAddSpecialEvent={onAddSpecialEvent} essentialChecklist={essentialChecklist} />
        ))}
      </div>
    </div>
  )
}
