import React, { useState } from 'react'
import { format, isWithinInterval, parseISO, startOfDay } from 'date-fns'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { Clock, CheckCircle2, Circle, Trash2, Play, Square, AlertCircle, Book, Music, Calculator, Languages, Palette, Activity, Coffee, User, Star, Edit2, Check, X, ExternalLink, Info, Calendar, Copy, CalendarOff, UserMinus } from 'lucide-react'

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
    const updates = !isAdmin && isFixed
      ? {
          notes: editData.notes || '',
          startDate: editData.startDate || '',
          endDate: editData.endDate || ''
        }
      : editData

    onUpdate(task.id, updates)
    setIsEditing(false)
  }

  const calculateActualDiff = (start, end) => {
    if (!start || !end) return 0
    const [sH, sM] = start.split(':').map(Number)
    const [eH, eM] = end.split(':').map(Number)
    return (eH * 60 + eM) - (sH * 60 + sM)
  }

  const canEditAll = isAdmin || !isFixed
  const canEditNotesOnly = !isAdmin && isFixed
  const canEnterEdit = canEditAll || canEditNotesOnly
  const canDelete = canEditAll

  const copyNotes = async () => {
    if (!task.notes) return
    try {
      await navigator.clipboard.writeText(task.notes)
    } catch (e) {
      alert('메모 복사에 실패했어요.')
    }
  }

  const renderStatusButtons = () => {
    if (isFixed) {
      return (
        <div style={{ display: 'flex', gap: '5px' }}>
          <button 
            onClick={() => setStatus('done')} 
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: task.status === 'done' ? 'var(--accent)' : 'white', color: task.status === 'done' ? 'white' : 'var(--accent)', border: `1px solid var(--accent)`, padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
          >
            <Check size={14} /> 완료
          </button>
          <button 
            onClick={() => setStatus('off')} 
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: task.status === 'off' ? '#94a3b8' : 'white', color: task.status === 'off' ? 'white' : '#94a3b8', border: `1px solid #94a3b8`, padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
          >
            <CalendarOff size={14} /> 휴강
          </button>
          <button 
            onClick={() => setStatus('absent')} 
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: task.status === 'absent' ? '#ef4444' : 'white', color: task.status === 'absent' ? 'white' : '#ef4444', border: `1px solid #ef4444`, padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
          >
            <UserMinus size={14} /> 결석
          </button>
        </div>
      )
    }

    // Study Timer Logic
    if (!task.actualStartTime) {
      return (
        <button onClick={handleStart} disabled={task.completed} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', background: 'var(--accent)', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
          <Play size={14} fill="white" /> 공부 시작
        </button>
      )
    } else if (!task.actualEndTime) {
      return (
        <div style={{ display: 'flex', gap: '5px' }}>
           <div style={{ flex: 1, background: 'rgba(52, 211, 153, 0.1)', color: 'var(--accent)', padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', textAlign: 'center' }}>진행중... ({task.actualStartTime}~)</div>
           <button onClick={handleEnd} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', background: '#ef4444', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
            <Square size={14} fill="white" /> 종료
          </button>
        </div>
      )
    } else {
      return (
        <div style={{ background: 'rgba(52, 211, 153, 0.1)', padding: '10px', borderRadius: '8px' }}>
           <div style={{ color: 'var(--accent)', fontWeight: '800', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <CheckCircle2 size={14} /> 공부 완료!
           </div>
           <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              실제: {task.actualStartTime} ~ {task.actualEndTime} ({calculateActualDiff(task.actualStartTime, task.actualEndTime)}분 소요)
           </div>
        </div>
      )
    }
  }

  return (
    <div ref={setNodeRef} className="glass animate-fade-in task-card" {...(!isEditing ? listeners : {})} {...(!isEditing ? attributes : {})} style={{
      padding: '14px',
      borderRadius: 'var(--radius-md)',
      background: isFixed ? 'rgba(139, 92, 246, 0.04)' : 'white',
      borderLeft: `6px solid ${task.color}`,
      minWidth: '280px',
      boxShadow: 'var(--shadow)',
      position: 'relative',
      opacity: isDragging ? 0.35 : (task.completed && !isFixed) ? 0.7 : 1,
      border: isFixed ? '1px dashed var(--primary-light)' : '1px solid rgba(255,255,255,0.5)',
      transition: 'all 0.3s ease',
      cursor: isEditing ? 'default' : 'grab',
      transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined
    }}>
      {isFixed && (
        <div style={{ position: 'absolute', top: '-10px', right: '10px', background: 'var(--primary)', color: 'white', fontSize: '10px', padding: '2px 8px', borderRadius: '10px', fontWeight: '700', zIndex: 10 }}>
          {task.status === 'off' ? '휴강됨' : task.status === 'absent' ? '결석처리' : '고정 수업'}
        </div>
      )}

      {isEditing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <fieldset disabled={canEditNotesOnly} style={{ border: 'none', padding: 0, margin: 0, opacity: canEditNotesOnly ? 0.6 : 1 }}>
          <div style={{ display: 'flex', gap: '5px' }}>
            <input className="input-field" style={{padding:'4px 8px', fontSize:'13px'}} value={editData.name} onChange={(e)=>setEditData({...editData, name: e.target.value})} placeholder="과목명" />
            <input type="color" style={{width:'30px', height:'30px', padding:0, border:'none', background:'none'}} value={editData.color} onChange={(e)=>setEditData({...editData, color: e.target.value})} />
          </div>
          <div style={{ display: 'flex', gap: '5px', alignItems:'center' }}>
            <input type="time" className="input-field" style={{padding:'4px', fontSize:'12px'}} value={editData.startTime} onChange={(e)=>setEditData({...editData, startTime: e.target.value})} />
            <input type="number" className="input-field" style={{padding:'4px', fontSize:'12px', width:'50px'}} value={editData.duration} onChange={(e)=>setEditData({...editData, duration: parseInt(e.target.value)})} placeholder="분" />
            <select className="input-field" style={{padding:'4px', fontSize:'12px'}} value={editData.icon} onChange={(e)=>setEditData({...editData, icon: e.target.value})}>
               {Object.keys(ICON_MAP).map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          </fieldset>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
             <label style={{fontSize:'10px', color:'var(--text-muted)'}}>수업 기간 (선택)</label>
             <div style={{ display: 'flex', gap: '5px' }}>
                <input type="date" className="input-field" style={{padding:'4px', fontSize:'11px'}} value={editData.startDate || ''} onChange={(e)=>setEditData({...editData, startDate: e.target.value})} />
                <input type="date" className="input-field" style={{padding:'4px', fontSize:'11px'}} value={editData.endDate || ''} onChange={(e)=>setEditData({...editData, endDate: e.target.value})} />
             </div>
          </div>
          <textarea 
            className="input-field" 
            style={{padding:'8px', fontSize:'12px', height:'60px'}} 
            value={editData.notes || ''} 
            onChange={(e)=>setEditData({...editData, notes: e.target.value})}
            placeholder="수업 링크, 비밀번호 등 메모"
          />
          <div style={{ display: 'flex', gap: '5px', justifyContent:'flex-end' }}>
             <button onClick={() => setIsEditing(false)} style={{ background:'#eee', border:'none', padding:'5px 10px', borderRadius:'6px', cursor:'pointer' }}><X size={14}/></button>
             <button onClick={handleSave} style={{ background:'var(--primary)', color:'white', border:'none', padding:'5px 10px', borderRadius:'6px', cursor:'pointer' }}><Check size={14}/></button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div 
              onClick={() => hasNotes && setShowNotes(!showNotes)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: hasNotes ? 'pointer' : 'default' }}
            >
              {task.icon && ICON_MAP[task.icon] ? React.createElement(ICON_MAP[task.icon], { size: 18, style: { color: task.color } }) : <Circle size={18} />}
              <span style={{ fontWeight: '800', fontSize: '15px', color: 'var(--text-main)', borderBottom: hasNotes ? '2px dashed var(--primary-light)' : 'none', opacity: task.status === 'off' ? 0.5 : 1 }}>
                {task.name}
              </span>
              {hasNotes && <Info size={14} style={{ color: 'var(--primary)', opacity: 0.6 }} />}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {canEnterEdit && (
                <button onClick={() => setIsEditing(true)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--primary)', opacity: 0.6 }}>
                  <Edit2 size={16} />
                </button>
              )}
              {canDelete && (
                <button onClick={() => onDelete(task.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', opacity: 0.6 }}>
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>

          {hasNotes && showNotes && (
            <div className="animate-fade-in" style={{ 
              background: 'rgba(139, 92, 246, 0.05)', 
              padding: '10px', 
              borderRadius: '8px', 
              fontSize: '12px', 
              marginBottom: '10px',
              border: '1px solid rgba(139, 92, 246, 0.1)',
              wordBreak: 'break-all',
              whiteSpace: 'pre-wrap'
            }}>
               <div style={{ fontWeight: '700', color: 'var(--primary)', marginBottom: '5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '5px' }}>
                 <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                   <ExternalLink size={12} /> 수업 메모
                 </span>
                 {hasNotes && (
                   <button onClick={copyNotes} style={{ border: 'none', background: 'rgba(0,0,0,0.06)', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                     <Copy size={12} /> 복사
                   </button>
                 )}
               </div>
               {task.notes}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ background: 'rgba(0,0,0,0.03)', padding: '8px', borderRadius: '8px' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                 <Clock size={14} />
                 <span style={{ fontWeight: '600' }}>{task.startTime} ~ {task.expectedEndTime} ({task.duration}분)</span>
               </div>
               {(task.startDate || task.endDate) && (
                 <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: 'var(--text-muted)', opacity: 0.8 }}>
                   <Calendar size={12} />
                   <span>{task.startDate || '시작미정'} ~ {task.endDate || '종료미정'}</span>
                 </div>
               )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {renderStatusButtons()}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function TimeGrid({ tasks, onUpdateTask, onDeleteTask, isAdmin }) {
  return (
    <div className="glass time-grid-shell" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'white' }}>
      <div className="time-grid-header" style={{ padding: '20px', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-gradient)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Clock size={20} style={{ color: 'var(--primary)' }} />
        </div>
        {tasks.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-muted)' }}>
             <AlertCircle size={14} /> 왼쪽에서 공부할 과목을 끌어다 놓으세요!
          </div>
        )}
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
