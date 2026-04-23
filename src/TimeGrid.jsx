import React, { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { Clock, Heart, Play, Sparkles, Star, Trash2 } from 'lucide-react'

const PRIMARY_PINK = '#ff4d6d'
const LIGHT_PINK = '#fff0f3'
const HOURS = Array.from({ length: 18 }, (_, index) => index + 7)

function TimeSlot({ hour, tasks, onUpdateTask, onDeleteTask, isAdmin, isMobile, onAddSpecialEvent }) {
  const { isOver, setNodeRef } = useDroppable({ id: `hour-${hour}`, data: { hour } })
  const [activeSlot, setActiveSlot] = useState(false)
  const hourTasks = tasks.filter((task) => parseInt(task.startTime.split(':')[0], 10) === hour)

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
      style={{ display: 'flex', minHeight: hourTasks.length > 0 ? '110px' : '55px', borderBottom: '1px solid rgba(0,0,0,0.05)', background: isOver ? 'rgba(255,77,109,0.05)' : 'transparent', transition: 'all 0.2s ease', position: 'relative', cursor: isAdmin ? 'pointer' : 'default' }}
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
          <div key={task.id} style={{ flex: isMobile ? '1 1 100%' : '1 1 calc(33.333% - 10px)', minWidth: isMobile ? '100%' : '260px', maxWidth: isMobile ? '100%' : 'calc(33.333% - 7px)' }}>
            <TaskCard task={task} onUpdateTask={onUpdateTask} onDeleteTask={onDeleteTask} isAdmin={isAdmin} isMobile={isMobile} />
          </div>
        ))}
      </div>
    </div>
  )
}

function TaskCard({ task, onUpdateTask, onDeleteTask, isAdmin, isMobile }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, data: { type: 'task', task } })

  const actualStart = task.actualStartTime || task.startTimeActual || ''
  const actualEnd = task.actualEndTime || task.endTimeActual || ''
  const actualDuration = task.durationActual || task.actualDuration || ''
  const classStatus = task.status || (task.completed ? 'completed' : '')

  const handleStartTimer = () => {
    if (actualStart) return
    const now = format(new Date(), 'HH:mm')
    onUpdateTask(task.id, { startTimeActual: now, actualStartTime: now, status: 'studying' })
  }

  const handleComplete = () => {
    const nowDate = new Date()
    const now = format(nowDate, 'HH:mm')
    const updates = { completed: true, status: 'completed', endTimeActual: now, actualEndTime: now }
    const startValue = actualStart

    if (startValue) {
      const [h, m] = startValue.split(':').map(Number)
      const startedAt = new Date()
      startedAt.setHours(h, m, 0, 0)
      const minutes = Math.max(0, Math.round((nowDate - startedAt) / 60000))
      updates.durationActual = minutes
      updates.actualDuration = minutes
    }

    onUpdateTask(task.id, updates)
  }

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    background: task.completed ? '#f8fafc' : 'white',
    borderLeft: `6px solid ${task.color || PRIMARY_PINK}`,
    borderRadius: '15px',
    padding: '15px',
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
    <div ref={setNodeRef} {...attributes} {...listeners} style={style}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div>
            <div style={{ fontWeight: 900, color: '#333', fontSize: '15px' }}>
              {task.name} {task.completed && <Sparkles size={14} color="#fbbf24" style={{ display: 'inline' }} />}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {task.startTime} ~ {task.expectedEndTime} ({task.duration}분)
            </div>
          </div>
        </div>
        {isAdmin && <button onPointerDown={(event) => { event.stopPropagation(); onDeleteTask(task.id) }} style={{ color: '#ff4d6d', border: 'none', background: 'none', cursor: 'pointer' }}><Trash2 size={16} /></button>}
      </div>

      <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
        {task.type === 'class' ? (
          <>
            <button onPointerDown={(event) => { event.stopPropagation(); onUpdateTask(task.id, { completed: !task.completed, status: 'completed', coins: 1 }) }} style={{ flex: 1, padding: '8px', borderRadius: '10px', background: classStatus === 'completed' ? '#42c99b' : '#f1f5f9', color: classStatus === 'completed' ? 'white' : '#666', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: isMobile ? '12px' : '13px' }}>완료</button>
            <button onPointerDown={(event) => { event.stopPropagation(); onUpdateTask(task.id, { completed: false, status: 'holiday' }) }} style={{ flex: 1, padding: '8px', borderRadius: '10px', background: classStatus === 'holiday' ? '#3b82f6' : '#f1f5f9', color: classStatus === 'holiday' ? 'white' : '#666', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: isMobile ? '12px' : '13px' }}>휴강</button>
            <button onPointerDown={(event) => { event.stopPropagation(); onUpdateTask(task.id, { completed: false, status: 'absent' }) }} style={{ flex: 1, padding: '8px', borderRadius: '10px', background: classStatus === 'absent' ? '#ef4444' : '#f1f5f9', color: classStatus === 'absent' ? 'white' : '#666', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: isMobile ? '12px' : '13px' }}>결석</button>
          </>
        ) : (
          <>
            {!task.completed && !actualStart && <button onPointerDown={(event) => { event.stopPropagation(); handleStartTimer() }} style={{ flex: 1, padding: '8px', borderRadius: '10px', background: PRIMARY_PINK, color: 'white', border: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer', fontSize: isMobile ? '12px' : '13px' }}><Play size={14} />공부 시작</button>}
            {actualStart && !task.completed && <button onPointerDown={(event) => { event.stopPropagation(); handleComplete() }} style={{ flex: 1, padding: '8px', borderRadius: '10px', background: '#42c99b', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: isMobile ? '12px' : '13px' }}>완료</button>}
            {task.completed && (
              <div style={{ fontSize: '11px', color: '#42c99b', fontWeight: 'bold', lineHeight: 1.2 }}>
                {actualStart && actualEnd ? `✨ ${actualStart} ~ ${actualEnd} (${actualDuration || '-'}분)` : '✨ 완료'}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function TimeGrid({ tasks, onUpdateTask, onDeleteTask, isAdmin, isMobile, onAddSpecialEvent, essentialChecklist = [] }) {
  return (
    <div style={{ background: 'white', borderRadius: '24px', overflow: 'hidden', border: '1px solid #ffdeeb', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
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
        {HOURS.map((hour) => (
          <TimeSlot key={hour} hour={hour} tasks={tasks} onUpdateTask={onUpdateTask} onDeleteTask={onDeleteTask} isAdmin={isAdmin} isMobile={isMobile} onAddSpecialEvent={onAddSpecialEvent} />
        ))}
      </div>
    </div>
  )
}
