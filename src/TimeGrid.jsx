import React, { useState } from 'react'
import { format, isWithinInterval, parseISO, startOfDay } from 'date-fns'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { Clock, CheckCircle2, Circle, Trash2, Play, Square, AlertCircle, Book, Music, Calculator, Languages, Palette, Activity, Coffee, User, Star, Edit2, Check, X, ExternalLink, Info, Calendar, Copy, CalendarOff, UserMinus, Heart } from 'lucide-react'

const ICON_MAP = {
  Book, Music, Calculator, Languages, Palette, Activity, Coffee, User, Star
}

const HOURS = Array.from({ length: 18 }, (_, i) => i + 7) // 7 to 24

function TimeSlot({ hour, tasks, onUpdateTask, onDeleteTask, isAdmin }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `hour-${hour}`,
    data: { hour }
  })

  const hourTasks = tasks.filter(t => parseInt(t.startTime.split(':')[0]) === hour)

  return (
    <div
      ref={setNodeRef}
      style={{
        display: 'flex',
        minHeight: hourTasks.length > 0 ? '100px' : '45px',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
        background: isOver
          ? 'rgba(139, 92, 246, 0.08)'
          : hourTasks.length
            ? 'transparent'
            : 'linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255, 244, 248, 0.9))',
        transition: 'all 0.2s ease'
      }}
    >
      <div style={{
        width: '70px',
        padding: hourTasks.length > 0 ? '15px 10px' : '12px 10px',
        fontSize: '13px',
        fontWeight: '700',
        color: 'var(--text-muted)',
        borderRight: '1px solid rgba(0,0,0,0.05)',
        textAlign: 'right'
      }}>
        {hour < 10 ? `0${hour}` : hour}:00
      </div>
      <div className="time-slot-body" style={{ flex: 1, padding: hourTasks.length > 0 ? '10px' : '4px 10px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
        {hourTasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            onUpdate={onUpdateTask}
            onDelete={onDeleteTask}
            isAdmin={isAdmin}
          />
        ))}
      </div>
    </div>
  )
}

function TaskCard({ task, onUpdate, onDelete, isAdmin }) {
  const [isEditing, setIsEditing] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [editData, setEditData] = useState({ ...task })
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `task-${task.id}`,
    data: {
      type: 'task',
      task
    }
  })

  const isFixed = task.type === 'class'
  const hasNotes = Boolean(task.notes)

  const handleStart = () => {
    onUpdate(task.id, { actualStartTime: format(new Date(), 'HH:mm') })
  }

  const handleEnd = () => {
    const end = format(new Date(), 'HH:mm')
    onUpdate(task.id, {
      actualEndTime: end,
      completed: true,
      status: 'done'
    })
  }

  const setStatus = (status) => {
    onUpdate(task.id, {
      status,
      completed: status === 'done' || status === 'absent' || status === 'off'
    })
  }

  const handleSave = () => {
    onUpdate(task.id, { ...editData })
    setIsEditing(false)
  }

  const getStatusStyle = () => {
    switch (task.status) {
      case 'done': return { bg: '#f0fff4', color: '#2f855a', border: '#c6f6d5', label: '완료' }
      case 'absent': return { bg: '#fff5f5', color: '#c53030', border: '#fed7d7', label: '결석' }
      case 'off': return { bg: '#f7fafc', color: '#4a5568', border: '#edf2f7', label: '휴강' }
      default: return null
    }
  }

  const statusStyle = getStatusStyle()

  if (isDragging) return <div ref={setNodeRef} style={{ width: '200px', height: '80px', opacity: 0.5, background: '#eee', borderRadius: '15px' }} />

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`task-card ${isFixed ? 'fixed' : ''} ${task.completed ? 'completed' : ''}`}
      style={{
        padding: '12px 15px',
        borderRadius: '18px',
        background: 'white',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        minWidth: '220px',
        position: 'relative',
        border: isFixed ? '2px dashed #ffb7d5' : '1px solid #eee',
        cursor: 'grab'
      }}
    >
      {isEditing ? (
        <div onClick={e => e.stopPropagation()} style={{ display: 'grid', gap: '8px' }}>
          <input className="input-field" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} />
          <div style={{ display: 'flex', gap: '5px' }}>
            <input className="input-field" type="time" value={editData.startTime} onChange={e => setEditData({ ...editData, startTime: e.target.value })} />
            <input className="input-field" type="number" value={editData.duration} onChange={e => setEditData({ ...editData, duration: parseInt(e.target.value) })} />
          </div>
          <div style={{ display: 'flex', gap: '5px' }}>
            <button className="btn-primary" onClick={handleSave} style={{ flex: 1, padding: '5px' }}><Check size={14} /></button>
            <button className="btn-primary" onClick={() => setIsEditing(false)} style={{ flex: 1, padding: '5px', background: '#eee', color: '#333' }}><X size={14} /></button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ padding: '6px', borderRadius: '10px', background: `${task.color}20`, color: task.color }}>
                  {React.createElement(ICON_MAP[task.icon || 'Book'] || Book, { size: 16 })}
                </div>
                <span style={{ fontWeight: '800', fontSize: '15px', color: '#333' }}>{task.name}</span>
              </div>
            </div>
            {(isAdmin || !isFixed) && (
              <div style={{ display: 'flex', gap: '5px' }}>
                <button onClick={() => setIsEditing(true)} style={{ background: 'none', border: 'none', color: '#cbd5e0' }}><Edit2 size={14} /></button>
                <button onClick={() => onDelete(task.id)} style={{ background: 'none', border: 'none', color: '#feb2b2' }}><Trash2 size={14} /></button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#718096', fontSize: '12px', background: '#f7fafc', padding: '6px 10px', borderRadius: '10px', marginBottom: '10px' }}>
            <Clock size={12} />
            <span>{task.startTime} ~ {task.expectedEndTime} ({task.duration}분)</span>
          </div>

          {statusStyle ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', background: statusStyle.bg, color: statusStyle.color, borderRadius: '12px', fontSize: '13px', fontWeight: '800', border: `1px solid ${statusStyle.border}` }}>
              {statusStyle.label}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '5px' }}>
              <button onClick={handleEnd} style={{ flex: 1, padding: '8px', borderRadius: '10px', border: '1.5px solid #4ade80', background: 'white', color: '#4ade80', fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}><Check size={14} /> 완료</button>
              {isFixed && (
                <>
                  <button onClick={() => setStatus('off')} style={{ flex: 1, padding: '8px', borderRadius: '10px', border: '1.5px solid #cbd5e0', background: 'white', color: '#718096', fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}><CalendarOff size={14} /> 휴강</button>
                  <button onClick={() => setStatus('absent')} style={{ flex: 1, padding: '8px', borderRadius: '10px', border: '1.5px solid #f87171', background: 'white', color: '#f87171', fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}><UserMinus size={14} /> 결석</button>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function TimeGrid({ tasks, onUpdateTask, onDeleteTask, isAdmin, essentialChecklist }) {
  return (
    <div className="glass time-grid-shell" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'white' }}>
      <div className="time-grid-header" style={{ padding: '15px 20px', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff9fb' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: 1, minWidth: 0 }}>
          <div style={{ background: '#ffdeeb', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Clock size={20} style={{ color: '#ff4d6d' }} />
          </div>

          {essentialChecklist && essentialChecklist.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 12px', background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(255, 77, 109, 0.1)', overflowX: 'auto', scrollbarWidth: 'none', flex: 1 }}>
              <span style={{ fontSize: '13px', fontWeight: '900', color: '#ff4d6d', whiteSpace: 'nowrap' }}>꼭!</span>
              <div style={{ display: 'flex', gap: '10px' }}>
                {essentialChecklist.map(e => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}>
                    {e.completed ? <Heart size={14} fill="#ff4d6d" color="#ff4d6d" className="animate-pulse" /> : <div style={{ width: '12px', height: '12px', borderRadius: '3px', border: '1.5px solid #ff4d6d', opacity: 0.4 }} />}
                    <span style={{ fontSize: '13px', fontWeight: '800', color: e.completed ? '#ff4d6d' : '#666' }}>{e.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="time-grid-scroll" style={{ maxHeight: '700px', overflowY: 'auto' }}>
        {HOURS.map(hour => (
          <TimeSlot key={hour} hour={hour} tasks={tasks} onUpdateTask={onUpdateTask} onDeleteTask={onDeleteTask} isAdmin={isAdmin} />
        ))}
      </div>
    </div>
  )
}

export default TimeGrid
