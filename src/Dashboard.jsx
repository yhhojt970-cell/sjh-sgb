import React, { useState, useEffect, useMemo, useRef } from 'react'
import { DndContext, DragOverlay, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { SubjectPalette } from './SubjectPalette'
import TimeGrid from './TimeGrid'
import { LogOut, Settings, Star, User, ChevronLeft, ChevronRight, ClipboardList, Gift, Trophy, CheckCircle2, Copy, Trash2, Plus, LayoutGrid, RotateCcw, Mail, Send, X as CloseIcon, AppWindow, ExternalLink, Trash, Sparkles, Calendar } from 'lucide-react'
import { format, addDays, subDays, startOfWeek, isSameDay, parseISO, startOfDay, getDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import { arrayUnion, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'

const APP_COLORS = [
  'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
  'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
  'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
  'linear-gradient(135deg, #cfd9df 0%, #e2ebf0 100%)',
  'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'
]

function Dashboard({ user, onLogout, onUpdateUser, onChangePassword, allUsers, cloud }) {
  const isCloud = !!cloud?.db && !!cloud?.householdId
  const [activeKidId, setActiveKidId] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date())
  
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

  const [tasks, setTasks] = useState([])
  const [goals, setGoals] = useState([])
  const [wishes, setWishes] = useState([])
  const [messages, setMessages] = useState([])
  const [studyApps, setStudyApps] = useState([])

  const [showSettings, setShowSettings] = useState(false)
  const [showGoals, setShowGoals] = useState(false)
  const [showClassManager, setShowClassManager] = useState(false)
  const [showMessageManager, setShowMessageManager] = useState(false)
  const [showAppLauncher, setShowAppLauncher] = useState(false)
  const [showSurprise, setShowSurprise] = useState(false)
  const [showPalette, setShowPalette] = useState(false) 
  
  const [newGoal, setNewGoal] = useState('')
  const [newWish, setNewWish] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [messageDate, setMessageDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [messageTarget, setMessageTarget] = useState('')
  
  const [currentPassword, setCurrentPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)

  const [bulkInput, setBulkInput] = useState('')
  const [activeDragItem, setActiveDragItem] = useState(null)
  const [paletteSubjects, setPaletteSubjects] = useState([])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  useEffect(() => {
    if (!user?.id) return
    const saved = loadState(`activeKid_${user.id}`, user.role === 'child' ? user.id : '')
    if (saved) setActiveKidId(saved)
    else if (user.role === 'child') setActiveKidId(user.id)
    else { const kids = Object.keys(allUsers || {}).filter(id => allUsers[id].role === 'child'); if (kids.length > 0) setActiveKidId(kids[0]) }
  }, [user?.id, allUsers])

  useEffect(() => { if (user?.id && activeKidId) localStorage.setItem(`activeKid_${user.id}`, JSON.stringify(activeKidId)) }, [activeKidId, user?.id])

  useEffect(() => {
    if (!activeKidId) return
    if (!isCloud) {
      setTasks(loadState(`tasks_${activeKidId}`, [])); setGoals(loadState(`goals_${activeKidId}`, [])); setWishes(loadState(`wishes_${activeKidId}`, [])); setMessages(loadState(`messages_${activeKidId}`, [])); setStudyApps(loadState('study_apps', []))
      return
    }
    const ref = doc(cloud.db, 'households', cloud.householdId, 'kids', activeKidId)
    const unsub = onSnapshot(ref, (snap) => { 
      const data = snap.exists() ? snap.data() : {}; 
      setTasks(Array.isArray(data?.tasks) ? data.tasks : []); 
      setGoals(Array.isArray(data?.goals) ? data.goals : []); 
      setWishes(Array.isArray(data?.wishes) ? data.wishes : []) 
    })
    
    const metaRef = doc(cloud.db, 'households', cloud.householdId, 'meta', 'messages')
    const unsubMsg = onSnapshot(metaRef, (snap) => { const data = snap.exists() ? snap.data() : {}; setMessages(Array.isArray(data?.messages) ? data.messages : []) })
    
    const appRef = doc(cloud.db, 'households', cloud.householdId, 'meta', 'apps')
    const unsubApp = onSnapshot(appRef, (snap) => { const data = snap.exists() ? snap.data() : {}; setStudyApps(Array.isArray(data?.apps) ? data.apps : []) })

    return () => { unsub(); unsubMsg(); unsubApp(); }
  }, [isCloud, cloud?.db, cloud?.householdId, activeKidId])

  const persistActiveKidState = async (overrides = {}) => {
    if (!isCloud || !activeKidId) return
    const payload = { tasks: overrides.tasks ?? tasks ?? [], goals: overrides.goals ?? goals ?? [], wishes: overrides.wishes ?? wishes ?? [] }
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

  const applyGoalsChange = (updater) => {
    setGoals(prev => {
      const next = typeof updater === 'function' ? updater(prev || []) : updater
      if (isCloud) persistActiveKidState({ goals: next }).catch(console.error)
      return next
    })
  }

  const handleBulkAdd = async () => {
    if (!bulkInput.trim()) return
    const lines = bulkInput.split('\n')
    for (const line of lines) {
      const parts = line.split('\t')
      if (parts.length < 5) continue
      const [kidName, weekdayStr, subjectName, hour, min] = parts
      const targetKid = kidsList.find(id => allUsers[id]?.displayName === kidName || id === kidName)
      if (!targetKid) continue
      addTask(subjectName, '#7c9cff', `${hour.padStart(2, '0')}:${min.padStart(2, '0')}`, 50, 'class', 'Book', targetKid, format(selectedDate, 'yyyy-MM-dd'), { weekday: parseInt(weekdayStr) })
    }
    setBulkInput(''); setShowClassManager(false); alert('수업 등록 완료!')
  }

  const addStudyApp = async () => {
    const name = prompt('어플 이름을 입력해주세요')
    const url = prompt('주소(URL)를 입력해주세요')
    if (!name || !url) return
    const newApp = { id: Date.now(), name, url: url.startsWith('http') || url.includes('://') ? url : `https://${url}` }
    const next = [...studyApps, newApp]
    if (isCloud) {
        const ref = doc(cloud.db, 'households', cloud.householdId, 'meta', 'apps')
        await setDoc(ref, { apps: next, updatedAt: serverTimestamp() }, { merge: true })
    } else { localStorage.setItem('study_apps', JSON.stringify(next)); setStudyApps(next) }
  }

  const deleteStudyApp = async (id) => {
    if (!confirm('정말 삭제할까요?')) return
    const next = studyApps.filter(a => a.id !== id)
    if (isCloud) {
        const ref = doc(cloud.db, 'households', cloud.householdId, 'meta', 'apps')
        await setDoc(ref, { apps: next, updatedAt: serverTimestamp() }, { merge: true })
    } else { localStorage.setItem('study_apps', JSON.stringify(next)); setStudyApps(next) }
  }

  const sendSurpriseMessage = async () => {
    if (!newMessage || !messageTarget) return
    const msg = { id: Date.now(), text: newMessage, date: messageDate, kidId: messageTarget, from: user.id }
    if (isCloud) {
        const ref = doc(cloud.db, 'households', cloud.householdId, 'meta', 'messages')
        await setDoc(ref, { messages: arrayUnion(msg), updatedAt: serverTimestamp() }, { merge: true })
    }
    setNewMessage(''); setShowMessageManager(false); alert('전송 완료! 💌')
  }

  const submitPasswordChange = async () => {
    if (!currentPassword || !nextPassword) return setPasswordMessage('모든 항목을 입력해 주세요.')
    setPasswordBusy(true)
    const res = await onChangePassword(currentPassword, nextPassword)
    setPasswordMessage(res.message); setPasswordBusy(false)
    if (res.ok) { setCurrentPassword(''); setNextPassword(''); setTimeout(() => setShowSettings(false), 1500) }
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over) { setActiveDragItem(null); return }
    const dragData = active?.data?.current
    if (dragData?.type === 'palette' && over.id.toString().startsWith('hour-')) {
      addTask(dragData.subject.name, dragData.subject.color, `${over.data.current.hour.toString().padStart(2, '0')}:00`, 50, 'study')
    } else if (dragData?.type === 'task' && over.id.toString().startsWith('hour-')) {
        updateTask(dragData.task.id, { startTime: `${over.data.current.hour.toString().padStart(2, '0')}:00` })
    }
    setActiveDragItem(null)
  }

  const addTask = (name, color, startTime, duration, type, icon = 'Book', targetKidId = activeKidId, targetDate = format(selectedDate, 'yyyy-MM-dd'), extra = {}) => {
    const [hour, min] = startTime.split(':').map(Number); const totalMinutes = hour * 60 + min + duration; const endH = Math.floor(totalMinutes / 60) % 24; const endM = totalMinutes % 60
    const newTask = { id: Math.random().toString(36).substr(2, 9), name, color, startTime, expectedEndTime: `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`, duration, type, icon, completed: false, date: targetDate, ...extra }
    if (targetKidId === activeKidId) applyTaskChange(prev => [...(prev || []), newTask])
  }

  const updateTask = (taskId, updates) => { applyTaskChange(prev => (prev || []).map(t => t.id === taskId ? { ...t, ...updates } : t)) }
  const deleteTask = (taskId) => applyTaskChange(prev => (prev || []).filter(t => t.id !== taskId))

  const isAdmin = user?.role === 'admin'
  const kidsList = Object.keys(allUsers || {}).filter(id => allUsers[id].role === 'child')
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(selectedDate, { weekStartsOn: 1 }), i))
  const todayMessage = useMemo(() => (messages || []).find(m => m.date === format(selectedDate, 'yyyy-MM-dd') && m.kidId === activeKidId), [messages, selectedDate, activeKidId])

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={(e) => { const d = e.active.data.current; if (d?.type === 'palette') setActiveDragItem({ type: 'palette', subject: d.subject }); else if (d?.type === 'task') setActiveDragItem({ type: 'task', task: d.task }); }} onDragEnd={handleDragEnd}>
      <div className="dashboard-shell" style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '8px' : '20px' }}>
        
        {/* Modern Header */}
        <header className="glass" style={{ padding: isMobile ? '15px' : '20px 30px', borderRadius: 'var(--radius-lg)', marginBottom: '15px', background: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '20px' }}>
              <div style={{ position: 'relative' }}>
                <div style={{ background: 'var(--bg-gradient)', color: 'white', padding: isMobile ? '10px' : '12px', borderRadius: '15px', boxShadow: '0 8px 16px rgba(124, 156, 255, 0.3)' }}><Star size={isMobile ? 22 : 28} /></div>
                {todayMessage && <button onClick={() => setShowSurprise(true)} className="animate-bounce" style={{ position: 'absolute', top: '-10px', right: '-10px', background: '#ff4d6d', color: 'white', border: 'none', borderRadius: '50%', padding: '6px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(255, 77, 109, 0.4)' }}><Gift size={isMobile ? 14 : 18} /></button>}
              </div>
              <div>
                <h1 style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: '900', color: 'var(--text-main)', letterSpacing: '-0.5px' }}>{allUsers[activeKidId]?.displayName || activeKidId}</h1>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '4px' : '10px' }}>
              <button onClick={() => setShowAppLauncher(true)} style={{ background: 'rgba(124, 156, 255, 0.1)', border: 'none', padding: '10px', borderRadius: '12px', color: 'var(--primary)' }}><LayoutGrid size={isMobile ? 22 : 24}/></button>
              {isAdmin && <button onClick={() => { setShowMessageManager(true); setMessageTarget(activeKidId); }} style={{ background: 'rgba(255, 77, 109, 0.1)', border: 'none', padding: '10px', borderRadius: '12px', color: '#ff4d6d' }}><Mail size={isMobile ? 22 : 24}/></button>}
              <button onClick={() => setShowGoals(true)} style={{ background: 'rgba(124, 156, 255, 0.1)', border: 'none', padding: '10px', borderRadius: '12px', color: 'var(--primary)' }}><Trophy size={isMobile ? 22 : 24}/></button>
              <button onClick={() => setShowSettings(true)} style={{ background: 'rgba(0,0,0,0.05)', border: 'none', padding: '10px', borderRadius: '12px' }}><Settings size={isMobile ? 22 : 24} /></button>
              <button onClick={onLogout} style={{ background: 'rgba(244, 63, 94, 0.05)', border: 'none', padding: '10px', borderRadius: '12px', color: 'var(--secondary)' }}><LogOut size={isMobile ? 22 : 24} /></button>
            </div>
          </div>
          {isAdmin && (
            <div style={{ display: 'flex', gap: '10px', marginTop: '15px', background: 'rgba(0,0,0,0.03)', padding: '5px', borderRadius: '14px' }}>
              {kidsList.map(id => <button key={id} onClick={() => setActiveKidId(id)} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: activeKidId === id ? 'white' : 'transparent', fontWeight: '900', color: activeKidId === id ? 'var(--primary)' : 'var(--text-muted)', fontSize: '14px', boxShadow: activeKidId === id ? '0 4px 8px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.2s' }}>{allUsers[id]?.displayName || id}</button>)}
            </div>
          )}
        </header>

        {/* Date Selector */}
        <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', padding: isMobile ? '15px' : '20px', marginBottom: '15px', boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', marginBottom: '15px' }}>
             <button onClick={() => setSelectedDate(subDays(selectedDate, 1))} style={{ background: 'rgba(0,0,0,0.03)', border: 'none', borderRadius: '50%', padding: '10px', cursor: 'pointer' }}><ChevronLeft size={20}/></button>
             <div style={{ fontSize: '18px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={18} color="var(--primary)"/> {format(selectedDate, 'yyyy년 MM월')}</div>
             <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} style={{ background: 'rgba(0,0,0,0.03)', border: 'none', borderRadius: '50%', padding: '10px', cursor: 'pointer' }}><ChevronRight size={20}/></button>
          </div>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none', justifyContent: isMobile ? 'flex-start' : 'center' }}>
            {weekDays.map(day => (
              <button key={day.toString()} onClick={() => setSelectedDate(day)} style={{ flex: 1, padding: '12px 0', borderRadius: '15px', border: 'none', background: isSameDay(day, selectedDate) ? 'var(--primary)' : 'rgba(0,0,0,0.03)', color: isSameDay(day, selectedDate) ? 'white' : 'var(--text-main)', fontWeight: '800', minWidth: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'all 0.2s' }}>
                <span style={{ fontSize: '11px', opacity: 0.8, marginBottom: '2px' }}>{format(day, 'eee', { locale: ko })}</span>
                <span style={{ fontSize: '16px' }}>{format(day, 'd')}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <button onClick={() => { const todayStr = format(selectedDate, 'yyyy-MM-dd'); const tomorrowStr = format(addDays(selectedDate, 1), 'yyyy-MM-dd'); const todayTasks = tasks.filter(t => t.date === todayStr && t.type !== 'class'); if(todayTasks.length){ applyTaskChange(prev => [...prev, ...todayTasks.map(t => ({...t, id:Math.random().toString(36).substr(2,9), date:tomorrowStr, completed:false}))]); alert('내일로 복사 완료! 📝'); } }} style={{ flex: 1, padding: '15px', borderRadius: '18px', border: 'none', background: 'white', fontWeight: '900', boxShadow: 'var(--shadow)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--text-main)' }}><Copy size={18} color="var(--primary)"/> 내일복사</button>
          <button onClick={() => { if(confirm('오늘 일정을 초기화할까요?')) applyTaskChange(prev => prev.filter(t => t.type === 'class' || t.date !== format(selectedDate, 'yyyy-MM-dd'))) }} style={{ flex: 1, padding: '15px', borderRadius: '18px', border: 'none', background: 'white', fontWeight: '900', color: '#ef4444', boxShadow: 'var(--shadow)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><RotateCcw size={18}/> 초기화</button>
          {isAdmin && isMobile && <button onClick={() => setShowPalette(!showPalette)} style={{ width: '60px', borderRadius: '18px', border: 'none', background: showPalette ? 'var(--primary)' : 'white', color: showPalette ? 'white' : 'var(--primary)', boxShadow: 'var(--shadow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={24} style={{ transition: '0.3s', transform: showPalette ? 'rotate(45deg)' : 'none' }} /></button>}
        </div>

        <div className={isMobile ? "" : "dashboard-main-grid"} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '320px 1fr', gap: isMobile ? '15px' : '30px' }}>
          <aside style={{ display: isMobile && !showPalette ? 'none' : 'flex', flexDirection: 'column', gap: '20px' }}>
             <div className="glass" style={{ borderRadius: 'var(--radius-lg)', background: 'white' }}><SubjectPalette cloud={cloud} activeKidId={activeKidId} kids={kidsList} onSubjectsChange={setPaletteSubjects} /></div>
             {!isMobile && (
               <div className="glass" style={{ borderRadius: 'var(--radius-lg)', background: 'white', padding: '25px', boxShadow: 'var(--shadow)' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}><LayoutGrid size={22} color="var(--primary)"/><h3 style={{ fontSize: '18px', fontWeight: '900' }}>학습 센터</h3></div>
                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                   {studyApps.map((app, i) => (
                     <button key={app.id} onClick={() => window.open(app.url, '_blank')} className="app-icon-button" style={{ padding: '15px 10px', borderRadius: '20px', border: 'none', cursor: 'pointer', textAlign: 'center', background: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', transition: 'transform 0.2s' }}>
                       <div style={{ width: '45px', height: '45px', background: APP_COLORS[i % APP_COLORS.length], borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '20px', fontWeight: '900', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>{app.name[0]}</div>
                       <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)' }}>{app.name}</span>
                     </button>
                   ))}
                 </div>
               </div>
             )}
          </aside>
          <main><TimeGrid tasks={tasks.filter(t => (t.type === 'class' && t.weekday === getDay(selectedDate)) || (t.date === format(selectedDate, 'yyyy-MM-dd')))} onUpdateTask={updateTask} onDeleteTask={deleteTask} isAdmin={isAdmin} /></main>
        </div>

        {/* App Launcher Modal */}
        {showAppLauncher && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div className="glass animate-bounce-in" style={{ background: 'white', padding: '30px', borderRadius: '30px', maxWidth: '450px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                <div>
                   <h2 style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-main)' }}>학습 센터 🚀</h2>
                   <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>등록된 앱을 누르면 바로 연결됩니다.</p>
                </div>
                <button onClick={() => setShowAppLauncher(false)} style={{ background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '50%', padding: '8px', cursor: 'pointer' }}><CloseIcon size={24}/></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '10px' }}>
                {studyApps.map((app, i) => (
                  <div key={app.id} style={{ position: 'relative' }}>
                    <button onClick={() => window.open(app.url, '_blank')} style={{ width: '100%', aspectRatio: '1/1', background: 'white', border: 'none', borderRadius: '22px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,0,0,0.06)' }}>
                      <div style={{ width: '50px', height: '50px', background: APP_COLORS[i % APP_COLORS.length], borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '24px', fontWeight: '900' }}>{app.name[0]}</div>
                      <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.name}</div>
                    </button>
                    {isAdmin && <button onClick={() => deleteStudyApp(app.id)} style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#ff4d6d', color: 'white', border: 'none', borderRadius: '50%', padding: '6px', boxShadow: '0 4px 8px rgba(255, 77, 109, 0.3)', cursor: 'pointer' }}><Trash size={12}/></button>}
                  </div>
                ))}
                {isAdmin && (
                  <button onClick={addStudyApp} style={{ width: '100%', aspectRatio: '1/1', border: '3px dashed rgba(124, 156, 255, 0.3)', borderRadius: '22px', background: 'rgba(124, 156, 255, 0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <Plus size={32} color="var(--primary)" style={{ opacity: 0.5 }}/>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Message Manager Modal */}
        {showMessageManager && isAdmin && (
           <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
             <div className="glass animate-fade-in" style={{ background: 'white', padding: '30px', borderRadius: '30px', maxWidth: '400px', width: '100%', boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}><h2 style={{ fontSize: '20px', fontWeight: '900', color: '#ff4d6d', display: 'flex', alignItems: 'center', gap: '8px' }}><Mail size={22}/> 깜짝 메시지</h2><button onClick={() => setShowMessageManager(false)} style={{ background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '50%', padding: '8px' }}><CloseIcon size={20}/></button></div>
                <div style={{ display: 'grid', gap: '15px' }}>
                  <select className="input-field" style={{ padding: '12px', borderRadius: '15px' }} value={messageTarget} onChange={(e) => setMessageTarget(e.target.value)}><option value="">받는 아이 선택</option>{kidsList.map(id => <option key={id} value={id}>{allUsers[id]?.displayName || id}</option>)}</select>
                  <input type="date" className="input-field" style={{ padding: '12px', borderRadius: '15px' }} value={messageDate} onChange={(e) => setMessageDate(e.target.value)} />
                  <textarea className="input-field" style={{ height: '120px', borderRadius: '15px', padding: '15px' }} placeholder="아이에게 남길 따뜻한 한마디!" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} />
                  <button onClick={sendSurpriseMessage} className="btn-primary" style={{ background: '#ff4d6d', border: 'none', height: '50px', borderRadius: '15px', fontSize: '16px' }}><Send size={18} style={{marginRight:'8px'}}/> 전송하기</button>
                </div>
             </div>
           </div>
        )}

        {/* Surprise Message View */}
        {showSurprise && todayMessage && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div className="glass animate-bounce-in" style={{ background: 'white', padding: '40px 30px', borderRadius: '40px', maxWidth: '400px', width: '100%', textAlign: 'center', boxShadow: '0 30px 60px rgba(0,0,0,0.3)' }}>
              <div style={{ background: 'linear-gradient(135deg, #ff4d6d, #ff8fa3)', color: 'white', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 25px', boxShadow: '0 10px 20px rgba(255, 77, 109, 0.4)' }}><Sparkles size={40} /></div>
              <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-main)', marginBottom: '20px' }}>엄마의 깜짝 편지! 💌</h2>
              <div style={{ fontSize: '18px', lineHeight: '1.7', background: '#fff0f3', padding: '25px', borderRadius: '25px', whiteSpace: 'pre-wrap', marginBottom: '25px', color: '#d63384', fontWeight: '700' }}>{todayMessage.text}</div>
              <button onClick={() => setShowSurprise(false)} className="btn-primary" style={{ background: 'linear-gradient(90deg, #ff4d6d, #ff8fa3)', border: 'none', height: '55px', borderRadius: '20px', fontSize: '18px' }}>사랑해요! ❤️</button>
            </div>
          </div>
        )}

        {/* Settings & Goals (Omitted for brevity, but kept intact) */}
        {showSettings && (
           <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
             <div className="glass animate-fade-in" style={{ background: 'white', padding: '30px', borderRadius: '30px', maxWidth: '400px', width: '100%' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}><h2 style={{ fontSize: '20px', fontWeight: '900' }}>설정</h2><button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none' }}><CloseIcon size={24}/></button></div>
               <div style={{ display: 'grid', gap: '15px' }}>
                 <input className="input-field" type="password" style={{padding:'12px', borderRadius:'15px'}} placeholder="현재 비밀번호" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                 <input className="input-field" type="password" style={{padding:'12px', borderRadius:'15px'}} placeholder="새 비밀번호" value={nextPassword} onChange={(e) => setNextPassword(e.target.value)} />
                 {passwordMessage && <div style={{ fontSize: '13px', color: 'var(--accent)', fontWeight:'700' }}>{passwordMessage}</div>}
                 <button className="btn-primary" style={{height:'50px', borderRadius:'15px'}} disabled={passwordBusy} onClick={submitPasswordChange}>비밀번호 변경하기</button>
               </div>
             </div>
           </div>
        )}

        {showGoals && (
           <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
             <div className="glass animate-fade-in" style={{ background: 'white', padding: '30px', borderRadius: '30px', maxWidth: '450px', width: '100%' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}><h2 style={{ fontSize: '22px', fontWeight: '900', color:'var(--primary)' }}>이번 주 목표 🏆</h2><button onClick={() => setShowGoals(false)} style={{ background: 'none', border: 'none' }}><CloseIcon size={24}/></button></div>
               <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}><input className="input-field" style={{flex:1, padding:'12px', borderRadius:'15px'}} placeholder="목표를 입력하세요" value={newGoal} onChange={(e) => setNewGoal(e.target.value)} /><button onClick={() => { if(newGoal){ applyGoalsChange(prev => [...prev, {id:Date.now(), text:newGoal, done:false}]); setNewGoal(''); } }} className="btn-primary" style={{ width: '60px', borderRadius:'15px' }}><Plus/></button></div>
               <div style={{ maxHeight: '400px', overflowY: 'auto', display:'grid', gap:'10px' }}>
                 {goals.map(g => <div key={g.id} onClick={() => applyGoalsChange(prev => prev.map(i => i.id === g.id ? {...i, done: !i.done} : i))} style={{ padding: '15px', background: g.done ? '#f0fff4' : '#f8fafc', borderRadius: '18px', fontSize: '15px', cursor: 'pointer', display:'flex', alignItems:'center', gap:'10px', transition:'0.2s', border: g.done ? '1px solid #c6f6d5' : '1px solid transparent' }}>{g.done ? <CheckCircle2 color="#38a169"/> : <Circle color="#cbd5e0"/>}<span style={{ textDecoration: g.done ? 'line-through' : 'none', opacity: g.done ? 0.5 : 1, fontWeight:'700' }}>{g.text}</span></div>)}
               </div>
             </div>
           </div>
        )}

      </div>
      <DragOverlay>{activeDragItem && <div className="drag-preview-card" style={{ borderLeft: `6px solid ${activeDragItem.type === 'palette' ? activeDragItem.subject.color : activeDragItem.task.color}`, padding:'15px', background:'white', borderRadius:'12px', boxShadow:'0 10px 30px rgba(0,0,0,0.1)', fontWeight:'900' }}>{activeDragItem.type === 'palette' ? activeDragItem.subject.name : activeDragItem.task.name}</div>}</DragOverlay>
    </DndContext>
  )
}

function Circle({color}) { return <div style={{width:'20px', height:'20px', borderRadius:'50%', border:`2px solid ${color}`}} /> }

export default Dashboard
