import React, { useState, useRef } from 'react'
import { format, differenceInMinutes, parse } from 'date-fns'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { Clock, CheckCircle2, Circle, Trash2, Play, Square, AlertCircle, Book, Music, Calculator, Languages, Palette, Activity, Coffee, User, Star, Edit2, Check, X, ExternalLink, Info, Calendar, Copy, CalendarOff, UserMinus, Heart, Timer, Coins } from 'lucide-react'

const ICON_MAP = {
  Book, Music, Calculator, Languages, Palette, Activity, Coffee, User, Star
}

const HOURS = Array.from({ length: 18 }, (_, i) => i + 7) // 7 to 24

const getDurationText = (start, end) => {
  if (!start || !end) return ''
  try {
    const s = parse(start, 'HH:mm', new Date())
    const e = parse(end, 'HH:mm', new Date())
    const diff = differenceInMinutes(e, s)
    return `${start} ~ ${end} (총 ${diff}분)`
  } catch (err) {
    return `${start} ~ ${end}`
  }
}

function TimeSlot({ hour, tasks, onUpdateTask, onDeleteTask, isAdmin, onAddEvent }) {
  const timerRef = useRef(null)
  const { isOver, setNodeRef } = useDroppable({
    id: `hour-${hour}`,
    data: { hour }
  })

  const hourTasks = tasks.filter(t => parseInt(t.startTime.split(':')[0]) === hour)

  // Long press handler for Admin
  const handlePointerDown = () => {
    if (!isAdmin) return
    timerRef.current = setTimeout(() => {
      onAddEvent(hour)
    }, 1000)
  }

  const handlePointerUp = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  return (
    <div 
      ref={setNodeRef}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{
        display: 'flex',
        minHeight: hourTasks.length > 0 ? '100px' : '45px',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
        background: isOver ? 'rgba(124, 156, 255, 0.05)' : 'transparent',
        transition: 'all 0.2s ease',
        cursor: isAdmin ? 'cell' : 'default'
      }}
    >
      <div style={{
        width: '65px',
        padding: '12px 10px',
        fontSize: '13px',
        fontWeight: '800',
        color: '#94a3b8',
        borderRight: '1px solid rgba(0,0,0,0.05)',
        textAlign: 'right',
        userSelect: 'none'
      }}>
        {hour < 10 ? `0${hour}` : hour}:00
      </div>
      <div className="time-slot-body" style={{ flex: 1, padding: '8px 12px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
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
  const [editData, setEditData] = useState({ ...task })
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `task-${task.id}`,
    data: { type: 'task', task }
  })
  
  const isFixed = task.type === 'class'
  const isSpecialEvent = task.type === 'event'
  
  const handleStart = (e) => {
    e.stopPropagation()
    onUpdate(task.id, { actualStartTime: format(new Date(), 'HH:mm') })
  }

  const handleEnd = (e) => {
    e.stopPropagation()
    const now = format(new Date(), 'HH:mm')
    onUpdate(task.id, { 
      actualEndTime: now,
      completed: true,
      status: 'done'
    })
  }

  const setStatus = (status) => {
    onUpdate(task.id, { status, completed: true })
  }

  const handleSave = () => {
    onUpdate(task.id, { ...editData })
    setIsEditing(false)
  }

  if (isDragging) return <div ref={setNodeRef} style={{ width: '220px', height: '80px', opacity: 0.5, background: '#eee', borderRadius: '15px' }} />

  return (
    <div 
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`task-card ${isFixed ? 'fixed' : ''} ${task.completed ? 'completed' : ''} ${isSpecialEvent ? 'special-event' : ''}`}
      style={{
        padding: '12px 15px',
        borderRadius: '18px',
        background: isSpecialEvent ? '#fffdf0' : 'white',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        minWidth: '220px',
        position: 'relative',
        border: isSpecialEvent ? '2px solid #facc15' : (isFixed ? '2px dashed #ffb7d5' : '1px solid #eee'),
        cursor: 'grab'
      }}
    >
      {isEditing ? (
        <div onClick={e => e.stopPropagation()} style={{ display: 'grid', gap: '8px' }}>
          <input className="input-field" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} />
          <div style={{ display: 'flex', gap: '5px' }}>
            <input className="input-field" type="time" value={editData.startTime} onChange={e => setEditData({...editData, startTime: e.target.value})} />
            <input className="input-field" type="number" value={editData.duration} onChange={e => setEditData({...editData, duration: parseInt(e.target.value)})} />
          </div>
          {isAdmin && !isSpecialEvent && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px', background: '#fef3c7', borderRadius: '8px' }}>
              <Coins size={14} color="#d97706" />
              <span style={{ fontSize: '12px', fontWeight: '800' }}>코인:</span>
              <input type="number" style={{ width: '40px', border: 'none', background: 'none', fontWeight: '900' }} value={editData.coins || 1} onChange={e => setEditData({...editData, coins: parseInt(e.target.value)})} />
            </div>
          )}
          <div style={{ display: 'flex', gap: '5px' }}>
            <button className="btn-primary" onClick={handleSave} style={{ flex: 1, padding: '5px' }}><Check size={14}/></button>
            <button className="btn-primary" onClick={() => setIsEditing(false)} style={{ flex: 1, padding: '5px', background: '#eee', color: '#333' }}><X size={14}/></button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ padding: '6px', borderRadius: '10px', background: isSpecialEvent ? '#fef3c7' : `${task.color}20`, color: isSpecialEvent ? '#facc15' : task.color }}>
                   {React.createElement(ICON_MAP[task.icon || (isSpecialEvent ? 'Star' : 'Book')] || Book, { size: 16 })}
                </div>
                <span style={{ fontWeight: '900', fontSize: '15px', color: isSpecialEvent ? '#854d0e' : '#334155' }}>{task.name}</span>
              </div>
            </div>
            {(isAdmin || !isFixed) && (
              <div style={{ display: 'flex', gap: '5px' }}>
                <button onClick={() => setIsEditing(true)} style={{ background: 'none', border: 'none', color: '#cbd5e0' }}><Edit2 size={14}/></button>
                <button onClick={() => onDelete(task.id)} style={{ background: 'none', border: 'none', color: '#feb2b2' }}><Trash2 size={14}/></button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '12px', background: isSpecialEvent ? '#fefce8' : '#f8fafc', padding: '6px 10px', borderRadius: '10px', marginBottom: '10px' }}>
             <Clock size={12} />
             <span style={{ fontWeight: '700' }}>{task.startTime} ~ {task.expectedEndTime} ({task.duration}분)</span>
             {!isSpecialEvent && task.coins > 0 && (
               <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '3px', color: '#d97706' }}>
                 <Coins size={12} />
                 <span>{task.coins}</span>
               </div>
             )}
          </div>

          {!isSpecialEvent && (
            <div onClick={e => e.stopPropagation()}>
              {task.completed ? (
                <div style={{ padding: '8px', borderRadius: '12px', textAlign: 'center', fontSize: '13px', fontWeight: '800', 
                  background: task.status === 'off' ? '#f1f5f9' : task.status === 'absent' ? '#fff1f2' : '#f0fdf4',
                  color: task.status === 'off' ? '#475569' : task.status === 'absent' ? '#e11d48' : '#16a34a',
                  border: `1px solid ${task.status === 'off' ? '#e2e8f0' : task.status === 'absent' ? '#ffe4e6' : '#dcfce7'}`
                }}>
                  {task.status === 'off' ? '😴 휴강' : task.status === 'absent' ? '❌ 결석' : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                        <span>✅ 완료</span>
                        {task.coins > 0 && <span style={{ color: '#d97706', fontSize: '11px' }}>+{task.coins} 코인!</span>}
                      </div>
                      {!isFixed && task.actualStartTime && (
                        <span style={{ fontSize: '10px', opacity: 0.8 }}>실제: {getDurationText(task.actualStartTime, task.actualEndTime)}</span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '5px' }}>
                  {isFixed ? (
                    <>
                      <button onClick={() => setStatus('done')} style={{ flex: 1, padding: '8px', borderRadius: '10px', border: '1.5px solid #4ade80', background: 'white', color: '#16a34a', fontSize: '12px', fontWeight: '800' }}>완료</button>
                      <button onClick={() => setStatus('off')} style={{ flex: 1, padding: '8px', borderRadius: '10px', border: '1.5px solid #cbd5e0', background: 'white', color: '#475569', fontSize: '12px', fontWeight: '800' }}>휴강</button>
                      <button onClick={() => setStatus('absent')} style={{ flex: 1, padding: '8px', borderRadius: '10px', border: '1.5px solid #f87171', background: 'white', color: '#e11d48', fontSize: '12px', fontWeight: '800' }}>결석</button>
                    </>
                  ) : (
                    <>
                      {!task.actualStartTime ? (
                        <button onClick={handleStart} style={{ flex: 1, padding: '8px', borderRadius: '10px', background: 'var(--primary)', color: 'white', border: 'none', fontSize: '13px', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <Play size={14} fill="white"/> 공부 시작
                        </button>
                      ) : (
                        <button onClick={handleEnd} style={{ flex: 1, padding: '8px', borderRadius: '10px', background: '#4ade80', color: 'white', border: 'none', fontSize: '13px', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <Check size={16}/> 완료 (진행중...)
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function TimeGrid({ tasks, onUpdateTask, onDeleteTask, isAdmin, essentialChecklist, onAddSpecialEvent }) {
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
        {isAdmin && <div style={{ fontSize: '10px', color: '#ff4d6d', fontWeight: '800' }}>💡 시간 꾹 누르면 특별일정 추가</div>}
      </div>
      <div className="time-grid-scroll" style={{ maxHeight: '700px', overflowY: 'auto' }}>
        {HOURS.map(hour => (
          <TimeSlot key={hour} hour={hour} tasks={tasks} onUpdateTask={onUpdateTask} onDeleteTask={onDeleteTask} isAdmin={isAdmin} onAddEvent={onAddSpecialEvent} />
        ))}
      </div>
    </div>
  )
}

export default TimeGrid
