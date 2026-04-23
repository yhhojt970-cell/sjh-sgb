import React, { useState, useEffect, useMemo, useRef } from 'react'
import { DndContext, DragOverlay, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { SubjectPalette } from './SubjectPalette'
import TimeGrid from './TimeGrid'
import { LogOut, Settings, Star, User, ChevronLeft, ChevronRight, ClipboardList, Gift, Trophy, CheckCircle2, Copy, Trash2, Plus, LayoutGrid } from 'lucide-react'
import { format, addDays, subDays, startOfWeek, isSameDay, parseISO, startOfDay, getDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import { arrayUnion, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'

function Dashboard({ user, onLogout, onUpdateUser, onChangePassword, allUsers, cloud }) {
  const isCloud = !!cloud?.db && !!cloud?.householdId
  const [activeKidId, setActiveKidId] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date())
  
  // 1. Detect Environment (PC vs Mobile)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const loadState = (key, defaultVal) => {
    try {
      const saved = localStorage.getItem(key)
      if (saved && saved !== 'undefined' && saved !== 'null') return JSON.parse(saved)
    } catch (e) { console.error(e) }
    return defaultVal
  }

  // 2. Data States
  const [tasks, setTasks] = useState([])
  const [logs, setLogs] = useState([])
  const [goals, setGoals] = useState([])
  const [wishes, setWishes] = useState([])

  const [showSettings, setShowSettings] = useState(false)
  const [showLogs, setShowLogs] = useState(false)
  const [showGoals, setShowGoals] = useState(false)
  const [showClassManager, setShowClassManager] = useState(false)
  const [showPalette, setShowPalette] = useState(false) // Toggle for mobile only
  
  const [newGoal, setNewGoal] = useState('')
  const [newWish, setNewWish] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)

  const [bulkInput, setBulkInput] = useState('')
  const [activeDragItem, setActiveDragItem] = useState(null)
  const [paletteSubjects, setPaletteSubjects] = useState([])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  // 3. Persistent Kid Selection
  useEffect(() => {
    if (!user?.id) return
    const saved = loadState(`activeKid_${user.id}`, user.role === 'child' ? user.id : '')
    if (saved) {
      setActiveKidId(saved)
    } else if (user.role === 'child') {
      setActiveKidId(user.id)
    } else {
      const kidsList = Object.keys(allUsers || {}).filter(id => allUsers[id].role === 'child')
      if (kidsList.length > 0) setActiveKidId(kidsList[0])
    }
  }, [user?.id, allUsers])

  useEffect(() => {
    if (user?.id && activeKidId) {
      localStorage.setItem(`activeKid_${user.id}`, JSON.stringify(activeKidId))
    }
  }, [activeKidId, user?.id])

  // 4. Data Sync Logic
  useEffect(() => {
    if (!activeKidId) return
    if (!isCloud) {
      setTasks(loadState(`tasks_${activeKidId}`, []))
      setGoals(loadState(`goals_${activeKidId}`, []))
      setWishes(loadState(`wishes_${activeKidId}`, []))
      return
    }

    const ref = doc(cloud.db, 'households', cloud.householdId, 'kids', activeKidId)
    return onSnapshot(ref, (snap) => {
      const data = snap.exists() ? snap.data() : {}
      setTasks(Array.isArray(data?.tasks) ? data.tasks : [])
      setGoals(Array.isArray(data?.goals) ? data.goals : [])
      setWishes(Array.isArray(data?.wishes) ? data.wishes : [])
    })
  }, [isCloud, cloud?.db, cloud?.householdId, activeKidId])

  useEffect(() => {
    if (!isCloud) return
    const ref = doc(cloud.db, 'households', cloud.householdId, 'meta', 'logs')
    return onSnapshot(ref, (snap) => {
      const data = snap.exists() ? snap.data() : {}
      setLogs(Array.isArray(data?.logs) ? data.logs : [])
    })
  }, [isCloud, cloud?.db, cloud?.householdId])

  const persistActiveKidState = async (overrides = {}) => {
    if (!isCloud || !activeKidId) return
    const payload = { 
      tasks: overrides.tasks ?? tasks ?? [], 
      goals: overrides.goals ?? goals ?? [], 
      wishes: overrides.wishes ?? wishes ?? [] 
    }
    const ref = doc(cloud.db, 'households', cloud.householdId, 'kids', activeKidId)
    await setDoc(ref, { ...payload, updatedAt: serverTimestamp() }, { merge: true })
  }

  const applyTaskChange = (updater) => {
    setTasks((prev) => {
      const next = typeof updater === 'function' ? updater(prev || []) : updater
      if (isCloud) persistActiveKidState({ tasks: next }).catch(console.error)
      else localStorage.setItem(`tasks_${activeKidId}`, JSON.stringify(next))
      return next
    })
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over) { setActiveDragItem(null); return }
    const dragData = active?.data?.current
    const overData = over?.data?.current
    if (dragData?.type === 'palette' && overData?.type === 'palette') {
      if (active.id !== over.id) {
        const oldIndex = paletteSubjects.findIndex(s => `palette-${s.name}-${s.kidId}` === active.id)
        const newIndex = paletteSubjects.findIndex(s => `palette-${s.name}-${s.kidId}` === over.id)
        if (oldIndex !== -1 && newIndex !== -1) {
          const nextSubjects = arrayMove(paletteSubjects, oldIndex, newIndex)
          if (isCloud) { const ref = doc(cloud.db, 'households', cloud.householdId, 'meta', 'subjects'); setDoc(ref, { subjects: nextSubjects, updatedAt: serverTimestamp() }, { merge: true }) }
          else { localStorage.setItem('kid_app_subjects', JSON.stringify(nextSubjects)); window.location.reload() }
        }
      }
    } else if (over.id.toString().startsWith('hour-')) {
      const hour = over.data.current.hour; const startTime = typeof hour === 'number' ? `${hour.toString().padStart(2, '0')}:00` : hour
      if (dragData?.type === 'palette') addTask(dragData.subject.name, dragData.subject.color, startTime, 50, 'study')
      else if (dragData?.type === 'task') updateTask(dragData.task.id, { startTime })
    }
    setActiveDragItem(null)
  }

  const addTask = (name, color, startTime, duration, type, icon = 'Book', targetKidId = activeKidId, targetDate = format(selectedDate, 'yyyy-MM-dd'), extra = {}) => {
    const safeStartTime = typeof startTime === 'string' && startTime.includes(':') ? startTime : `${String(startTime).padStart(2, '0')}:00`
    const [hour, min] = safeStartTime.split(':').map(Number); const totalMinutes = hour * 60 + min + duration; const endH = Math.floor(totalMinutes / 60) % 24; const endM = totalMinutes % 60
    const expectedEndTime = `${endH < 10 ? '0' + endH : endH}:${endM < 10 ? '0' + endM : endM}`
    const newTask = { id: Math.random().toString(36).substr(2, 9), name, color, startTime: safeStartTime, expectedEndTime, duration, type, icon, completed: false, date: targetDate, ...(type === 'class' ? { weekday: extra.weekday ?? getDay(parseISO(targetDate)) } : {}), ...extra }
    if (targetKidId === activeKidId && targetDate === format(selectedDate, 'yyyy-MM-dd')) applyTaskChange(prev => [...(prev || []), newTask])
    else if (isCloud) { (async () => { const ref = doc(cloud.db, 'households', cloud.householdId, 'kids', targetKidId); await setDoc(ref, { tasks: arrayUnion(newTask), updatedAt: serverTimestamp() }, { merge: true }) })().catch(console.error) }
  }

  const updateTask = (taskId, updates) => {
    applyTaskChange(prev => (prev || []).map(t => {
      if (t.id === taskId) {
        const newT = { ...t, ...updates }
        if (updates.startTime !== undefined || updates.duration !== undefined) {
           const [h, m] = newT.startTime.split(':').map(Number); const totalMinutes = h * 60 + m + (newT.duration || 0); const endH = Math.floor(totalMinutes / 60) % 24; const endM = totalMinutes % 60
           newT.expectedEndTime = `${endH < 10 ? '0' + endH : endH}:${endM < 10 ? '0' + endM : endM}`
        }
        return newT
      }
      return t
    }))
  }

  const deleteTask = (taskId) => applyTaskChange(prev => (prev || []).filter(t => t.id !== taskId))
  const copyToTomorrow = () => {
    const todayStr = format(selectedDate, 'yyyy-MM-dd'); const tomorrowStr = format(addDays(selectedDate, 1), 'yyyy-MM-dd'); const todayTasks = (tasks || []).filter(t => t.date === todayStr && t.type !== 'class')
    if (todayTasks.length === 0) return alert('오늘 계획이 없어요!'); applyTaskChange(prev => [...(prev || []), ...todayTasks.map(t => ({ ...t, id: Math.random().toString(36).substr(2, 9), date: tomorrowStr, completed: false }))]); alert(`${tomorrowStr}로 계획이 복사되었습니다!`)
  }
  const resetDay = () => { if (confirm('오늘의 모든 계획을 삭제하고 초기화할까요?')) { const todayStr = format(selectedDate, 'yyyy-MM-dd'); applyTaskChange(prev => (prev || []).filter(t => t.type === 'class' || t.date !== todayStr)) } }

  const currentTasks = useMemo(() => {
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd'); const targetTime = startOfDay(selectedDate).getTime(); const selectedWeekday = getDay(selectedDate)
      return (tasks || []).filter(t => {
        if (t.type === 'class') { if (t.weekday !== selectedWeekday) return false } else if (t.date !== dateStr) return false
        if (t.startDate && targetTime < startOfDay(parseISO(t.startDate)).getTime()) return false
        if (t.endDate && targetTime > startOfDay(parseISO(t.endDate)).getTime()) return false
        return true
      })
    } catch (e) { return [] }
  }, [tasks, selectedDate])

  const isAdmin = user?.role === 'admin'
  const kidsList = Object.keys(allUsers || {}).filter(id => allUsers[id].role === 'child')
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 }); const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={(e) => { const d = e.active.data.current; if(d?.type==='palette') setActiveDragItem({type:'palette', subject:d.subject}); else if(d?.type==='task') setActiveDragItem({type:'task', task:d.task}); }} onDragEnd={handleDragEnd} onDragCancel={() => setActiveDragItem(null)}>
      <div className="dashboard-shell" style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '10px' : '20px' }}>
        
        {/* PC Header */}
        {!isMobile && (
          <header className="glass" style={{ padding: '20px 30px', borderRadius: 'var(--radius-lg)', marginBottom: '20px', background: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ background: 'var(--primary)', color: 'white', padding: '12px', borderRadius: '18px' }}><Star size={28} /></div>
              <div>
                <h1 style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-main)' }}>{allUsers[activeKidId]?.displayName || activeKidId}의 하루</h1>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{format(selectedDate, 'yyyy년 MM월 dd일 (eeee)', { locale: ko })}</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {isAdmin && (
                <div style={{ display: 'flex', background: 'rgba(0,0,0,0.05)', padding: '5px', borderRadius: '14px', marginRight: '10px' }}>
                  {kidsList.map(id => (
                    <button key={id} onClick={() => setActiveKidId(id)} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: activeKidId === id ? 'white' : 'transparent', fontWeight: '800', cursor: 'pointer', boxShadow: activeKidId === id ? '0 4px 8px rgba(0,0,0,0.1)' : 'none', color: activeKidId === id ? 'var(--primary)' : 'var(--text-muted)' }}>{allUsers[id]?.displayName || id}</button>
                  ))}
                </div>
              )}
              <button onClick={() => setShowClassManager(!showClassManager)} className="glass" style={{ padding: '10px 18px', borderRadius: '12px', border: 'none', cursor: 'pointer', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800' }}><LayoutGrid size={20}/> 수업 관리</button>
              <button onClick={() => { setShowGoals(!showGoals); setShowLogs(false); setShowSettings(false); }} className="glass" style={{ padding: '10px', borderRadius: '12px', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}><Trophy size={22}/></button>
              <button onClick={() => { setShowSettings(!showSettings); setShowLogs(false); setShowGoals(false); }} className="glass" style={{ padding: '10px', borderRadius: '12px', border: 'none', cursor: 'pointer' }}><Settings size={22} /></button>
              <button onClick={onLogout} className="glass" style={{ padding: '10px', borderRadius: '12px', border: 'none', cursor: 'pointer', color: 'var(--secondary)' }}><LogOut size={22} /></button>
            </div>
          </header>
        )}

        {/* Mobile Header */}
        {isMobile && (
          <header className="glass" style={{ padding: '12px', borderRadius: 'var(--radius-lg)', marginBottom: '15px', background: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ background: 'var(--primary)', color: 'white', padding: '6px', borderRadius: '10px' }}><Star size={18} /></div>
                <h1 style={{ fontSize: '15px', fontWeight: '800' }}>{allUsers[activeKidId]?.displayName || activeKidId}</h1>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={() => { setShowGoals(!showGoals); setShowLogs(false); }} style={{ background: 'none', border: 'none', padding: '8px', color: 'var(--primary)' }}><Trophy size={18}/></button>
                <button onClick={() => setShowSettings(!showSettings)} style={{ background: 'none', border: 'none', padding: '8px' }}><Settings size={18} /></button>
                <button onClick={onLogout} style={{ background: 'none', border: 'none', padding: '8px', color: 'var(--secondary)' }}><LogOut size={18} /></button>
              </div>
            </div>
            {isAdmin && (
              <div style={{ display: 'flex', background: 'rgba(0,0,0,0.05)', padding: '3px', borderRadius: '10px', width: 'fit-content' }}>
                {kidsList.map(id => (
                  <button key={id} onClick={() => setActiveKidId(id)} style={{ padding: '6px 15px', borderRadius: '8px', border: 'none', background: activeKidId === id ? 'white' : 'transparent', fontWeight: '800', fontSize: '12px', boxShadow: activeKidId === id ? '0 2px 4px rgba(0,0,0,0.1)' : 'none' }}>{allUsers[id]?.displayName || id}</button>
                ))}
              </div>
            )}
          </header>
        )}

        {/* Date Navigation (Common but Centered) */}
        <div className="dashboard-date-nav" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px' }}>
             <button onClick={() => setSelectedDate(subDays(selectedDate, 1))} style={{ background: 'white', border: 'none', borderRadius: '50%', padding: '10px', cursor: 'pointer', boxShadow: 'var(--shadow)', display: 'flex' }}><ChevronLeft size={20}/></button>
             <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)', minWidth: '130px', textAlign: 'center' }}>
               {format(selectedDate, 'yyyy년 MM월')}
             </div>
             <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} style={{ background: 'white', border: 'none', borderRadius: '50%', padding: '10px', cursor: 'pointer', boxShadow: 'var(--shadow)', display: 'flex' }}><ChevronRight size={20}/></button>
          </div>
          <div className="dashboard-week-strip" style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '2px 0', scrollbarWidth: 'none', justifyContent: isMobile ? 'flex-start' : 'center' }}>
            {weekDays.map(day => (
              <button key={day.toString()} onClick={() => setSelectedDate(day)} style={{ padding: '10px 0', borderRadius: '12px', border: 'none', background: isSameDay(day, selectedDate) ? 'var(--primary)' : 'white', color: isSameDay(day, selectedDate) ? 'white' : 'var(--text-main)', fontWeight: '700', cursor: 'pointer', boxShadow: 'var(--shadow)', minWidth: isMobile ? '45px' : '65px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', opacity: 0.8, marginBottom: '2px' }}>{format(day, 'eee', { locale: ko })}</span>
                <span style={{ fontSize: '14px' }}>{format(day, 'd')}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Toolbar */}
        <div className="dashboard-toolbar" style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
           <button onClick={copyToTomorrow} style={{ flex: 1, padding: '12px', borderRadius: '15px', border: 'none', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', fontWeight: '800', boxShadow: 'var(--shadow)' }}><Copy size={16}/> 내일복사</button>
           <button onClick={resetDay} style={{ flex: 1, padding: '12px', borderRadius: '15px', border: 'none', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', fontWeight: '800', color: '#ef4444', boxShadow: 'var(--shadow)' }}><Trash2 size={16}/> 초기화</button>
           {isAdmin && isMobile && (
             <button onClick={() => setShowPalette(!showPalette)} style={{ padding: '12px', borderRadius: '15px', border: 'none', background: showPalette ? 'var(--primary)' : 'white', color: showPalette ? 'white' : 'var(--primary)', cursor: 'pointer', fontWeight: '800', boxShadow: 'var(--shadow)', display: 'flex' }}>
               <Plus size={20} style={{ transform: showPalette ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }} />
             </button>
           )}
        </div>

        {/* Main Content (PC=Grid, Mobile=Stack) */}
        <div className={isMobile ? "dashboard-main-stack" : "dashboard-main-grid"} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '320px 1fr', gap: isMobile ? '15px' : '30px' }}>
          
          <aside className="dashboard-sidebar" style={{ display: isMobile && !showPalette ? 'none' : 'flex', flexDirection: 'column', gap: '20px' }}>
             <div className="glass" style={{ borderRadius: 'var(--radius-lg)', background: 'white' }}>
               <SubjectPalette cloud={cloud} activeKidId={activeKidId} kids={kidsList} onSubjectsChange={setPaletteSubjects} />
             </div>
             {!isMobile && (
               <div className="glass" style={{ borderRadius: 'var(--radius-lg)', background: 'white', padding: '20px' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}><Gift size={20} style={{ color: 'var(--secondary)' }} /><h3 style={{ fontSize: '16px', fontWeight: '700' }}>나의 소원 리스트</h3></div>
                 <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}><input className="input-field" style={{ padding: '8px', fontSize: '13px' }} placeholder="소원 입력" value={newWish} onChange={(e) => setNewWish(e.target.value)} /><button onClick={() => { if(newWish){ applyWishesChange(prev => [...prev, {id: Date.now(), text: newWish, granted: false}]); setNewWish(''); } }} className="icon-add-button" style={{ background: 'var(--secondary)', color: 'white', border: 'none', borderRadius: '12px' }}><Plus size={16}/></button></div>
                 <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', padding: 0 }}>
                   {(wishes || []).map(w => (
                     <li key={w.id} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.02)', padding: '8px', borderRadius: '8px' }}>
                       {w.granted ? <CheckCircle2 size={14} color="var(--accent)"/> : <Star size={14} color="#ddd"/>}
                       <span style={{ textDecoration: w.granted ? 'line-through' : 'none', opacity: w.granted ? 0.5 : 1 }}>{w.text}</span>
                       {isAdmin && !w.granted && <button onClick={() => applyWishesChange(prev => prev.map(i => i.id === w.id ? {...i, granted: true} : i))} style={{ marginLeft: 'auto', fontSize: '10px', background: 'var(--accent)', color: 'white', border: 'none', padding: '2px 6px', borderRadius: '4px' }}>승인</button>}
                     </li>
                   ))}
                 </ul>
               </div>
             )}
          </aside>

          <main className="dashboard-main">
            {showClassManager && isAdmin ? (
               <div className="glass animate-fade-in" style={{ padding: '20px', borderRadius: 'var(--radius-lg)', background: 'white' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}><h2 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--primary)' }}>수업 일괄 등록</h2><button onClick={() => setShowClassManager(false)} style={{ background: 'none', border: 'none' }}><Plus size={20} style={{ transform: 'rotate(45deg)' }}/></button></div>
                  <textarea className="input-field" style={{ height: '100px', fontSize: '12px' }} placeholder="이름 [Tab] 요일 [Tab] 과목명 [Tab] 시간 [Tab] 분" value={bulkInput} onChange={(e) => setBulkInput(e.target.value)}/>
                  <button onClick={handleBulkAdd} className="btn-primary" style={{ width: '100%', marginTop: '10px' }}>스케줄 등록</button>
               </div>
            ) : showSettings ? (
               <div className="glass animate-fade-in" style={{ padding: '20px', borderRadius: 'var(--radius-lg)', background: 'white' }}>
                 <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '15px' }}>비밀번호 변경</h2>
                 <input className="input-field" type="password" placeholder="현재 비밀번호" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} style={{marginBottom:'10px'}}/>
                 <input className="input-field" type="password" placeholder="새 비밀번호" value={nextPassword} onChange={(e) => setNextPassword(e.target.value)} style={{marginBottom:'10px'}}/>
                 {passwordMessage && <div style={{ fontSize: '12px', color: 'var(--accent)', marginBottom: '10px' }}>{passwordMessage}</div>}
                 <button className="btn-primary" onClick={submitPasswordChange}>변경하기</button>
                 <button className="btn-secondary" onClick={()=>setShowSettings(false)} style={{marginTop:'10px', width:'100%'}}>닫기</button>
               </div>
            ) : showGoals ? (
               <div className="glass animate-fade-in" style={{ padding: '20px', borderRadius: 'var(--radius-lg)', background: 'white' }}>
                 <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '15px' }}>이번 주 목표</h2>
                 <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}><input className="input-field" value={newGoal} onChange={(e)=>setNewGoal(e.target.value)}/><button className="btn-primary" onClick={()=>{if(newGoal){applyGoalsChange(prev=>[...prev, {id:Date.now(), text:newGoal, done:false}]);setNewGoal('');}}}>+</button></div>
                 {(goals || []).map(g => (<div key={g.id} onClick={()=>applyGoalsChange(prev=>prev.map(i=>i.id===g.id?{...i,done:!i.done}:i))} style={{padding:'10px', background:g.done?'#f0fff4':'#f9f9f9', marginBottom:'5px', borderRadius:'8px', fontSize:'13px'}}>{g.text}</div>))}
                 <button className="btn-secondary" onClick={()=>setShowGoals(false)} style={{marginTop:'10px', width:'100%'}}>닫기</button>
               </div>
            ) : (
              <TimeGrid tasks={currentTasks} onUpdateTask={updateTask} onDeleteTask={deleteTask} isAdmin={isAdmin} />
            )}
          </main>
        </div>
      </div>
      <DragOverlay>{activeDragItem && (
        <div className="drag-preview-card" style={{ borderLeft: `6px solid ${activeDragItem.type==='palette' ? activeDragItem.subject.color : activeDragItem.task.color}` }}>
          <div className="drag-preview-title">{activeDragItem.type==='palette' ? activeDragItem.subject.name : activeDragItem.task.name}</div>
        </div>
      )}</DragOverlay>
    </DndContext>
  )
}

export default Dashboard
