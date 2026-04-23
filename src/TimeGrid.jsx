import React, { useState, useEffect, useRef } from 'react'
import { format, isWithinInterval, parseISO, startOfDay } from 'date-fns'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { Clock, CheckCircle2, Circle, Trash2, Play, Square, AlertCircle, Book, Music, Calculator, Languages, Palette, Activity, Coffee, User, Star, Edit2, Check, X, ExternalLink, Info, Calendar, Copy, CalendarOff, UserMinus, Sparkles, Heart } from 'lucide-react'

const ICON_MAP = { Book, Music, Calculator, Languages, Palette, Activity, Coffee, User, Star }
const HOURS = Array.from({ length: 18 }, (_, i) => i + 7) // 7 to 24

function TimeSlot({ hour, tasks, onUpdateTask, onDeleteTask, isAdmin, onAddSpecialEvent }) {
  const { isOver, setNodeRef } = useDroppable({ id: `hour-${hour}`, data: { hour } })
  const hourTasks = tasks.filter(t => parseInt(t.startTime.split(':')[0]) === hour)
  
  const timerRef = useRef(null)
  const handleMouseDown = () => {
    if (!isAdmin) return
    timerRef.current = setTimeout(() => onAddSpecialEvent(hour), 1000)
  }
  const handleMouseUp = () => clearTimeout(timerRef.current)

  return (
    <div ref={setNodeRef} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onTouchStart={handleMouseDown} onTouchEnd={handleMouseUp} style={{ display: 'flex', minHeight: hourTasks.length > 0 ? '110px' : '45px', borderBottom: '1px solid rgba(0,0,0,0.05)', background: isOver ? 'rgba(255, 77, 109, 0.05)' : 'transparent', transition: 'all 0.2s ease' }}>
      <div style={{ width: '50px', padding: '12px 0', fontSize: '12px', color: '#999', fontWeight: 'bold', borderRight: '1px solid rgba(0,0,0,0.03)', textAlign: 'center' }}>{hour.toString().padStart(2, '0')}:00</div>
      <div style={{ flex: 1, padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {hourTasks.map(t => (
          <TaskCard key={t.id} task={t} onUpdateTask={onUpdateTask} onDeleteTask={onDeleteTask} isAdmin={isAdmin} />
        ))}
      </div>
    </div>
  )
}

function TaskCard({ task, onUpdateTask, onDeleteTask, isAdmin }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, data: { type: 'task', task } })
  const Icon = ICON_MAP[task.icon] || Book

  const handleStartTimer = () => { if(!task.startTimeActual) onUpdateTask(task.id, { startTimeActual: format(new Date(), 'HH:mm'), status: 'studying' }) }
  const handleComplete = () => {
    const now = new Date()
    const up = { completed: true, status: 'completed', endTimeActual: format(now, 'HH:mm') }
    if (task.startTimeActual) {
       const [sh, sm] = task.startTimeActual.split(':').map(Number); const start = new Date(); start.setHours(sh, sm); const duration = Math.round((now - start) / 60000)
       up.durationActual = duration
    }
    onUpdateTask(task.id, up)
  }

  const style = { transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, opacity: isDragging ? 0.5 : 1, background: task.completed ? '#f8fafc' : 'white', borderLeft: `6px solid ${task.color || PRIMARY_PINK}`, borderRadius: '15px', padding: '15px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', position: 'relative', border: task.completed ? '1px solid #e2e8f0' : `1px solid ${task.color}20` }

  if (task.type === 'event') {
    return (
      <div style={{ ...style, borderLeft: '6px solid #fbbf24', background: '#fffbeb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Star size={20} color="#fbbf24" fill="#fbbf24" /><div><div style={{ fontWeight: '900', fontSize: '15px' }}>{task.name}</div><div style={{ fontSize: '12px', color: '#999' }}>특별 일정</div></div></div>
          {isAdmin && <button onPointerDown={(e) => { e.stopPropagation(); onDeleteTask(task.id) }} style={{ color: '#ff4d6d', border: 'none', background: 'none' }}><Trash2 size={18}/></button>}
        </div>
      </div>
    )
  }

  return (
    <div ref={setNodeRef} {...attributes} {...listeners} style={style}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ padding: '8px', background: `${task.color}15`, borderRadius: '10px', color: task.color }}><Icon size={18} /></div>
          <div>
            <div style={{ fontWeight: '900', color: '#333', fontSize: '15px' }}>{task.name} {task.completed && <Sparkles size={14} color="#fbbf24" style={{display:'inline'}}/>}</div>
            <div style={{ fontSize: '12px', color: '#666' }}>{task.startTime} ~ {task.expectedEndTime} ({task.duration}분)</div>
          </div>
        </div>
        {isAdmin && <button onPointerDown={(e) => { e.stopPropagation(); onDeleteTask(task.id) }} style={{ color: '#ff4d6d', border: 'none', background: 'none' }}><Trash2 size={16}/></button>}
      </div>

      <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
        {task.type === 'class' ? (
          <>
            <button onPointerDown={(e) => { e.stopPropagation(); onUpdateTask(task.id, { completed: !task.completed, status: 'completed', coins: 1 }) }} style={{ flex: 1, padding: '8px', borderRadius: '10px', background: task.status === 'completed' ? '#42c99b' : '#f1f5f9', color: task.status === 'completed' ? 'white' : '#666', border: 'none', fontWeight: 'bold' }}>완료</button>
            <button onPointerDown={(e) => { e.stopPropagation(); onUpdateTask(task.id, { completed: false, status: 'holiday' }) }} style={{ flex: 1, padding: '8px', borderRadius: '10px', background: task.status === 'holiday' ? '#3b82f6' : '#f1f5f9', color: task.status === 'holiday' ? 'white' : '#666', border: 'none', fontWeight: 'bold' }}>휴강</button>
            <button onPointerDown={(e) => { e.stopPropagation(); onUpdateTask(task.id, { completed: false, status: 'absent' }) }} style={{ flex: 1, padding: '8px', borderRadius: '10px', background: task.status === 'absent' ? '#ef4444' : '#f1f5f9', color: task.status === 'absent' ? 'white' : '#666', border: 'none', fontWeight: 'bold' }}>결석</button>
          </>
        ) : (
          <>
            {!task.completed && !task.startTimeActual && <button onPointerDown={(e) => { e.stopPropagation(); handleStartTimer() }} style={{ flex: 1, padding: '8px', borderRadius: '10px', background: PRIMARY_PINK, color: 'white', border: 'none', fontWeight: 'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'4px' }}><Play size={14}/> 공부 시작</button>}
            {task.startTimeActual && !task.completed && <button onPointerDown={(e) => { e.stopPropagation(); handleComplete() }} style={{ flex: 1, padding: '8px', borderRadius: '10px', background: '#42c99b', color: 'white', border: 'none', fontWeight: 'bold' }}>완료</button>}
            {task.completed && <div style={{ fontSize: '12px', color: '#42c99b', fontWeight: 'bold' }}>✨ {task.startTimeActual} ~ {task.endTimeActual} ({task.durationActual}분 공부 완료!)</div>}
          </>
        )}
      </div>
    </div>
  )
}

const PRIMARY_PINK = '#ff4d6d'

export default function TimeGrid({ tasks, onUpdateTask, onDeleteTask, isAdmin, onAddSpecialEvent, essentialChecklist = [] }) {
  return (
    <div style={{ background: 'white', borderRadius: '24px', overflow: 'hidden', border: '1px solid #ffdeeb' }}>
      <div style={{ padding: '20px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '900', color: '#333', whiteSpace: 'nowrap' }}><Clock color={PRIMARY_PINK} /> 꼭</div>
        
        {/* 'MUST' (꼭!) Checklist - Linked with Tasks (Heart Effect) */}
        <div style={{ flex: 1, display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '5px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
           {essentialChecklist.map(item => {
             const isDone = tasks.some(t => t.name.includes(item.name) && t.completed)
             return (
               <div key={item.id} style={{ flexShrink: 0, padding: '6px 12px', background: isDone ? LIGHT_PINK : '#fff', border: isDone ? `1px solid ${PRIMARY_PINK}` : '1px solid #ffdeeb', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', color: isDone ? PRIMARY_PINK : '#999', boxShadow: '0 2px 6px rgba(255, 77, 109, 0.05)', display: 'flex', alignItems: 'center', gap: '5px', transition: 'all 0.3s ease' }}>
                 {isDone ? <Heart size={12} fill={PRIMARY_PINK} color={PRIMARY_PINK}/> : null} {item.name}
               </div>
             )
           })}
        </div>
        
        <div style={{ fontSize: '10px', color: '#999', whiteSpace: 'nowrap' }}>💡 꾹 누르면 특별일정</div>
      </div>
      <div style={{ maxHeight: '800px', overflowY: 'auto' }}>
        {HOURS.map(hour => (
          <TimeSlot key={hour} hour={hour} tasks={tasks} onUpdateTask={onUpdateTask} onDeleteTask={onDeleteTask} isAdmin={isAdmin} onAddSpecialEvent={onAddSpecialEvent} />
        ))}
      </div>
    </div>
  )
}
