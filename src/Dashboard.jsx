import React, { useState, useEffect, useMemo, useRef } from 'react'
import { DndContext, DragOverlay, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { SubjectPalette } from './SubjectPalette'
import TimeGrid from './TimeGrid'
import { LogOut, Settings, Star, User, ChevronLeft, ChevronRight, ClipboardList, Gift, Trophy, CheckCircle2, Copy, Trash2, Plus, LayoutGrid, RotateCcw, Mail, Send, X as CloseIcon, AppWindow, ExternalLink, Trash, Sparkles, Calendar, Heart, CheckCircle, MessageCircle, Coins, Award, ShoppingCart, Check, Users, UserPlus, Shield } from 'lucide-react'
import { format, addDays, subDays, startOfWeek, isSameDay, parseISO, startOfDay, getDay, isSameMonth, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'
import { ko } from 'date-fns/locale'
import { arrayUnion, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'

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
  const [messages, setMessages] = useState([])
  const [studyApps, setStudyApps] = useState([])
  const [essentials, setEssentials] = useState([])
  const [rewards, setRewards] = useState([])
  const [spentCoins, setSpentCoins] = useState(0)

  const [showSettings, setShowSettings] = useState(false)
  const [showGoals, setShowGoals] = useState(false)
  const [showMessageManager, setShowMessageManager] = useState(false)
  const [showAppLauncher, setShowAppLauncher] = useState(false)
  const [showSurprise, setShowSurprise] = useState(false)
  const [showPalette, setShowPalette] = useState(false) 
  const [showFamilyManager, setShowFamilyManager] = useState(false)
  
  const [newGoal, setNewGoal] = useState('')
  const [newReward, setNewReward] = useState({ text: '', coins: 50 })
  const [newMessage, setNewMessage] = useState('')
  const [replyMessage, setReplyMessage] = useState('')
  const [messageDate, setMessageDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [messageTarget, setMessageTarget] = useState('')
  
  const [newMember, setNewMember] = useState({ loginId: '', displayName: '', role: 'child' })

  const [currentPassword, setCurrentPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)

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
      setTasks(loadState(`tasks_${activeKidId}`, [])); setGoals(loadState(`goals_${activeKidId}`, [])); setMessages(loadState(`messages_${activeKidId}`, [])); setStudyApps(loadState('study_apps', [])); setEssentials(loadState(`essentials_${activeKidId}`, [])); setRewards(loadState(`rewards_${activeKidId}`, [])); setSpentCoins(loadState(`spent_${activeKidId}`, 0))
      return
    }
    const ref = doc(cloud.db, 'households', cloud.householdId, 'kids', activeKidId)
    const unsub = onSnapshot(ref, (snap) => { 
      const data = snap.exists() ? snap.data() : {}; 
      setTasks(Array.isArray(data?.tasks) ? data.tasks : []); 
      setGoals(Array.isArray(data?.goals) ? data.goals : []); 
      setEssentials(Array.isArray(data?.essentials) ? data.essentials : []);
      setRewards(Array.isArray(data?.rewards) ? data.rewards : []);
      setSpentCoins(data?.spentCoins || 0);
    })
    
    const metaRef = doc(cloud.db, 'households', cloud.householdId, 'meta', 'messages')
    const unsubMsg = onSnapshot(metaRef, (snap) => { const data = snap.exists() ? snap.data() : {}; setMessages(Array.isArray(data?.messages) ? data.messages : []) })
    
    const appRef = doc(cloud.db, 'households', cloud.householdId, 'meta', 'apps')
    const unsubApp = onSnapshot(appRef, (snap) => { const data = snap.exists() ? snap.data() : {}; setStudyApps(Array.isArray(data?.apps) ? data.apps : []) })

    return () => { unsub(); unsubMsg(); unsubApp(); }
  }, [isCloud, cloud?.db, cloud?.householdId, activeKidId])

  const persistActiveKidState = async (overrides = {}) => {
    if (!isCloud || !activeKidId) return
    const payload = { tasks: overrides.tasks ?? tasks ?? [], goals: overrides.goals ?? goals ?? [], essentials: overrides.essentials ?? essentials ?? [], rewards: overrides.rewards ?? rewards ?? [], spentCoins: overrides.spentCoins ?? spentCoins ?? 0 }
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

  const applyRewardsChange = (updater) => {
    setRewards(prev => {
      const next = typeof updater === 'function' ? updater(prev || []) : updater
      if (isCloud) persistActiveKidState({ rewards: next }).catch(console.error)
      return next
    })
  }

  const redeemReward = (reward) => {
    if (!isAdmin) return
    if (!confirm(`[${reward.text}] 보상을 증정하고 ${reward.coins} 코인을 차감할까요?`)) return
    const nextSpent = spentCoins + reward.coins
    setSpentCoins(nextSpent)
    if (isCloud) persistActiveKidState({ spentCoins: nextSpent }).catch(console.error)
    else localStorage.setItem(`spent_${activeKidId}`, JSON.stringify(nextSpent))
    alert('보상 증정 완료! 코인이 차감되었습니다. ❤️')
  }
  
  const addFamilyMember = async () => {
    if (!newMember.loginId || !newMember.displayName) return
    const updatedPeople = { ...allUsers, [newMember.loginId]: { ...newMember } }
    if (isCloud) {
        const ref = doc(cloud.db, 'households', cloud.householdId)
        await setDoc(ref, { people: updatedPeople, updatedAt: serverTimestamp() }, { merge: true })
        alert(`[${newMember.displayName}] 아이가 등록되었습니다! 이제 아이가 이 아이디로 가입할 수 있어요.`)
    }
    setNewMember({ loginId: '', displayName: '', role: 'child' })
  }

  const deleteFamilyMember = async (id) => {
    if (!isAdmin || id === user.id) return
    if (!confirm('정말 삭제할까요? 아이의 모든 기록이 접근 불가능해집니다.')) return
    const { [id]: _, ...remaining } = allUsers
    if (isCloud) {
        const ref = doc(cloud.db, 'households', cloud.householdId)
        await setDoc(ref, { people: remaining, updatedAt: serverTimestamp() }, { merge: true })
    }
  }

  const applyEssentialsChange = (updater) => {
    setEssentials(prev => {
      const next = typeof updater === 'function' ? updater(prev || []) : updater
      if (isCloud) persistActiveKidState({ essentials: next }).catch(console.error)
      else localStorage.setItem(`essentials_${activeKidId}`, JSON.stringify(next))
      return next
    })
  }

  const addSpecialEvent = (hour) => {
    const name = prompt('특별 일정 이름을 입력해주세요 (예: 기말고사, 가족여행)')
    if (!name) return
    addTask(name, '#facc15', `${hour.toString().padStart(2, '0')}:00`, 60, 'event', 'Star')
  }

  const addStudyApp = async () => {
    const name = prompt('어플 이름을 입력해주세요'); const url = prompt('주소(URL)를 입력해주세요'); if (!name || !url) return
    const newApp = { id: Date.now(), name, url: url.startsWith('http') || url.includes('://') ? url : `https://${url}` }
    const next = [...studyApps, newApp]
    if (isCloud) { const ref = doc(cloud.db, 'households', cloud.householdId, 'meta', 'apps'); await setDoc(ref, { apps: next, updatedAt: serverTimestamp() }, { merge: true }) }
    else { localStorage.setItem('study_apps', JSON.stringify(next)); setStudyApps(next) }
  }

  const deleteStudyApp = async (id) => {
    if (!confirm('정말 삭제할까요?')) return
    const next = studyApps.filter(a => a.id !== id)
    if (isCloud) { const ref = doc(cloud.db, 'households', cloud.householdId, 'meta', 'apps'); await setDoc(ref, { apps: next, updatedAt: serverTimestamp() }, { merge: true }) }
    else { localStorage.setItem('study_apps', JSON.stringify(next)); setStudyApps(next) }
  }

  const sendSurpriseMessage = async () => {
    if (!newMessage || !messageTarget) return
    const msg = { id: Date.now(), text: newMessage, date: messageDate, kidId: messageTarget, from: user.id, read: false, replies: [] }
    if (isCloud) { const ref = doc(cloud.db, 'households', cloud.householdId, 'meta', 'messages'); await setDoc(ref, { messages: arrayUnion(msg), updatedAt: serverTimestamp() }, { merge: true }) }
    setNewMessage(''); setShowMessageManager(false); alert('전송 완료! 💌')
  }

  const markMessageRead = async (msgId) => {
    if (!isCloud) return
    const next = messages.map(m => m.id === msgId ? { ...m, read: true } : m)
    const ref = doc(cloud.db, 'households', cloud.householdId, 'meta', 'messages')
    await setDoc(ref, { messages: next, updatedAt: serverTimestamp() }, { merge: true })
  }

  const addMessageReply = async (msgId) => {
    if (!replyMessage || !isCloud) return
    const next = messages.map(m => m.id === msgId ? { ...m, replies: [...(m.replies || []), { from: user.id, text: replyMessage, time: format(new Date(), 'HH:mm') }] } : m)
    const ref = doc(cloud.db, 'households', cloud.householdId, 'meta', 'messages')
    await setDoc(ref, { messages: next, updatedAt: serverTimestamp() }, { merge: true })
    setReplyMessage(''); alert('답장을 보냈어요! ❤️')
  }

  const deleteMessage = async (msgId) => {
    if (!confirm('정말 삭제할까요?')) return
    const next = messages.filter(m => m.id !== msgId)
    const ref = doc(cloud.db, 'households', cloud.householdId, 'meta', 'messages')
    await setDoc(ref, { messages: next, updatedAt: serverTimestamp() }, { merge: true })
  }

  const handleDragEnd = (event) => {
    const { active, over } = event; if (!over) { setActiveDragItem(null); return }
    const dragData = active?.data?.current
    if (dragData?.type === 'palette' && over.id.toString().startsWith('hour-')) { addTask(dragData.subject.name, dragData.subject.color, `${over.data.current.hour.toString().padStart(2, '0')}:00`, 50, 'study') }
    else if (dragData?.type === 'task' && over.id.toString().startsWith('hour-')) { updateTask(dragData.task.id, { startTime: `${over.data.current.hour.toString().padStart(2, '0')}:00` }) }
    setActiveDragItem(null)
  }

  const addTask = (name, color, startTime, duration, type, icon = 'Book', targetKidId = activeKidId, targetDate = format(selectedDate, 'yyyy-MM-dd'), extra = {}) => {
    const [hour, min] = startTime.split(':').map(Number); const totalMinutes = hour * 60 + min + duration; const endH = Math.floor(totalMinutes / 60) % 24; const endM = totalMinutes % 60
    const newTask = { id: Math.random().toString(36).substr(2, 9), name, color, startTime, expectedEndTime: `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`, duration, type, icon, completed: false, date: targetDate, coins: type === 'event' ? 0 : 1, ...extra }
    if (targetKidId === activeKidId) applyTaskChange(prev => [...(prev || []), newTask])
  }

  const updateTask = (taskId, updates) => { applyTaskChange(prev => (prev || []).map(t => t.id === taskId ? { ...t, ...updates } : t)) }
  const deleteTask = (taskId) => applyTaskChange(prev => (prev || []).filter(t => t.id !== taskId))

  const isAdmin = user?.role === 'admin'
  const kidsList = Object.keys(allUsers || {}).filter(id => allUsers[id].role === 'child')
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(selectedDate, { weekStartsOn: 1 }), i))
  
  const unreadMessage = useMemo(() => (messages || []).find(m => m.date === format(selectedDate, 'yyyy-MM-dd') && m.kidId === activeKidId && !m.read), [messages, selectedDate, activeKidId])
  const todayMessage = useMemo(() => (messages || []).find(m => m.date === format(selectedDate, 'yyyy-MM-dd') && m.kidId === activeKidId), [messages, selectedDate, activeKidId])
  const todayTasks = useMemo(() => tasks.filter(t => (t.type === 'class' && t.weekday === getDay(selectedDate)) || (t.date === format(selectedDate, 'yyyy-MM-dd'))), [tasks, selectedDate])

  const essentialChecklist = useMemo(() => {
    return essentials.map(e => {
        const matchedTask = todayTasks.find(t => t.name.includes(e.name) || e.name.includes(t.name))
        return { ...e, completed: matchedTask?.completed || false }
    })
  }, [essentials, todayTasks])

  const totalEarnedCoins = useMemo(() => tasks.filter(t => t.completed).reduce((sum, t) => sum + (t.coins || 0), 0), [tasks])
  const availableCoins = useMemo(() => totalEarnedCoins - spentCoins, [totalEarnedCoins, spentCoins])
  const weeklyCoins = useMemo(() => { const start = startOfWeek(new Date(), { weekStartsOn: 1 }); const end = addDays(start, 6); return tasks.filter(t => t.completed && t.date && isWithinInterval(parseISO(t.date), { start, end })).reduce((sum, t) => sum + (t.coins || 0), 0) }, [tasks])
  const monthlyCoins = useMemo(() => { const start = startOfMonth(new Date()); const end = endOfMonth(new Date()); return tasks.filter(t => t.completed && t.date && isWithinInterval(parseISO(t.date), { start, end })).reduce((sum, t) => sum + (t.coins || 0), 0) }, [tasks])

  const submitPasswordChange = async () => {
    if (!currentPassword || !nextPassword) return setPasswordMessage('모든 항목을 입력해 주세요.')
    setPasswordBusy(true); const res = await onChangePassword(currentPassword, nextPassword); setPasswordMessage(res.message); setPasswordBusy(false)
    if (res.ok) { setCurrentPassword(''); setNextPassword(''); setTimeout(() => setShowSettings(false), 1500) }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={(e) => { const d = e.active.data.current; if (d?.type === 'palette') setActiveDragItem({ type: 'palette', subject: d.subject }); else if (d?.type === 'task') setActiveDragItem({ type: 'task', task: d.task }); }} onDragEnd={handleDragEnd}>
      <div className="dashboard-shell" style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '8px' : '20px' }}>
        
        {/* Modern Header */}
        <header className="glass" style={{ padding: isMobile ? '10px' : '20px 30px', borderRadius: 'var(--radius-lg)', marginBottom: '15px', background: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '5px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '15px', minWidth: 0, flex: 1 }}>
              <div style={{ position: 'relative', width: isMobile ? '36px' : '50px', height: isMobile ? '36px' : '50px', flexShrink: 0 }}>
                <div style={{ background: 'var(--bg-gradient)', color: 'white', width: '100%', height: '100%', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(124, 156, 255, 0.2)' }}><Star size={isMobile ? 18 : 24} /></div>
                {unreadMessage && (
                  <button onClick={() => { setShowSurprise(true); markMessageRead(unreadMessage.id); }} className="animate-bounce" style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ff4d6d', color: 'white', border: 'none', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer', zIndex: 10, aspectRatio: '1/1' }}>
                    <Gift size={10} />
                  </button>
                )}
              </div>
              <h1 style={{ fontSize: isMobile ? '16px' : '22px', fontWeight: '900', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{allUsers[activeKidId]?.displayName || activeKidId}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#fffbeb', padding: '5px 12px', borderRadius: '20px', border: '1px solid #fde68a' }}>
                 <Coins size={16} color="#d97706" />
                 <span style={{ fontSize: '14px', fontWeight: '900', color: '#854d0e' }}>{availableCoins}</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '3px' : '8px', flexShrink: 0 }}>
              {isAdmin && <button onClick={() => setShowFamilyManager(true)} style={{ background: 'rgba(0,0,0,0.05)', border: 'none', padding: isMobile ? '6px' : '10px', borderRadius: '8px', color: '#475569' }}><Users size={isMobile ? 18 : 22}/></button>}
              {isAdmin && <button onClick={() => setShowAppLauncher(true)} style={{ background: 'rgba(124, 156, 255, 0.1)', border: 'none', padding: isMobile ? '6px' : '10px', borderRadius: '8px', color: 'var(--primary)' }}><LayoutGrid size={isMobile ? 18 : 22}/></button>}
              {isAdmin && <button onClick={() => { setShowMessageManager(true); setMessageTarget(activeKidId); }} style={{ background: 'rgba(255, 77, 109, 0.1)', border: 'none', padding: isMobile ? '6px' : '10px', borderRadius: '8px', color: '#ff4d6d' }}><Mail size={isMobile ? 18 : 22}/></button>}
              <button onClick={() => setShowGoals(true)} style={{ background: 'rgba(124, 156, 255, 0.1)', border: 'none', padding: isMobile ? '6px' : '10px', borderRadius: '8px', color: 'var(--primary)' }}><Trophy size={isMobile ? 18 : 22}/></button>
              <button onClick={() => setShowSettings(true)} style={{ background: 'rgba(0,0,0,0.05)', border: 'none', padding: isMobile ? '6px' : '10px', borderRadius: '8px' }}><Settings size={isMobile ? 18 : 22} /></button>
              <button onClick={onLogout} style={{ background: 'rgba(244, 63, 94, 0.05)', border: 'none', padding: isMobile ? '6px' : '10px', borderRadius: '8px', color: 'var(--secondary)' }}><LogOut size={isMobile ? 18 : 22} /></button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px', marginTop: '10px', background: 'rgba(0,0,0,0.03)', padding: '3px', borderRadius: '10px' }}>
            {kidsList.map(id => <button key={id} onClick={() => setActiveKidId(id)} style={{ flex: 1, padding: '7px', borderRadius: '8px', border: 'none', background: activeKidId === id ? 'white' : 'transparent', fontWeight: '900', color: activeKidId === id ? 'var(--primary)' : 'var(--text-muted)', fontSize: '12px', boxShadow: activeKidId === id ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}>{allUsers[id]?.displayName || id}</button>)}
          </div>
        </header>

        {/* Date Selector & Grid... */}
        <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', padding: isMobile ? '12px' : '20px', marginBottom: '15px', boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
             <button onClick={() => setSelectedDate(subDays(selectedDate, 1))} style={{ background: 'rgba(0,0,0,0.03)', border: 'none', borderRadius: '50%', padding: '8px' }}><ChevronLeft size={20}/></button>
             <div style={{ fontSize: '16px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={18} color="var(--primary)"/> {format(selectedDate, 'yyyy년 MM월')}</div>
             <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} style={{ background: 'rgba(0,0,0,0.03)', border: 'none', borderRadius: '50%', padding: '8px' }}><ChevronRight size={20}/></button>
          </div>
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none', justifyContent: isMobile ? 'flex-start' : 'center' }}>
            {weekDays.map(day => (
              <button key={day.toString()} onClick={() => setSelectedDate(day)} style={{ flex: 1, padding: '10px 0', borderRadius: '12px', border: 'none', background: isSameDay(day, selectedDate) ? 'var(--primary)' : 'rgba(0,0,0,0.03)', color: isSameDay(day, selectedDate) ? 'white' : 'var(--text-main)', fontWeight: '800', minWidth: '45px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', opacity: 0.8 }}>{format(day, 'eee', { locale: ko })}</span>
                <span style={{ fontSize: '14px' }}>{format(day, 'd')}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={isMobile ? "" : "dashboard-main-grid"} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '320px 1fr', gap: isMobile ? '15px' : '30px' }}>
          <aside style={{ display: isMobile && !showPalette ? 'none' : 'flex', flexDirection: 'column', gap: '20px' }}>
             <div className="glass" style={{ borderRadius: 'var(--radius-lg)', background: 'white' }}><SubjectPalette cloud={cloud} activeKidId={activeKidId} kids={kidsList} onSubjectsChange={setPaletteSubjects} /></div>
          </aside>
          <main><TimeGrid tasks={todayTasks} onUpdateTask={updateTask} onDeleteTask={deleteTask} isAdmin={isAdmin} essentialChecklist={essentialChecklist} onAddSpecialEvent={addSpecialEvent} /></main>
        </div>

        {/* Family Manager Modal */}
        {showFamilyManager && isAdmin && (
           <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
             <div className="glass animate-fade-in" style={{ background: 'white', padding: '25px', borderRadius: '24px', maxWidth: '450px', width: '100%' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}><h2 style={{ fontSize: '18px', fontWeight: '900', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}><Users size={20}/> 가족 구성원 관리</h2><button onClick={() => setShowFamilyManager(false)} style={{ background: 'none', border: 'none' }}><CloseIcon size={24}/></button></div>
               
               <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '15px', marginBottom: '20px' }}>
                 <div style={{ fontSize: '12px', fontWeight: '800', color: '#64748b', marginBottom: '5px' }}>우리 가족 코드 🔑</div>
                 <div style={{ fontSize: '20px', fontWeight: '900', color: 'var(--primary)', letterSpacing: '2px' }}>{cloud.householdId}</div>
                 <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '5px' }}>아이들이 가입할 때 이 코드가 필요해요.</div>
               </div>

               <div style={{ marginBottom: '20px' }}>
                 <h3 style={{ fontSize: '15px', fontWeight: '900', marginBottom: '10px' }}>새 멤버 추가</h3>
                 <div style={{ display: 'grid', gap: '8px' }}>
                    <input className="input-field" placeholder="아이 이름 (예: 손지희)" value={newMember.displayName} onChange={e => setNewMember({...newMember, displayName: e.target.value})} />
                    <input className="input-field" placeholder="로그인 아이디 (영문/숫자)" value={newMember.loginId} onChange={e => setNewMember({...newMember, loginId: e.target.value})} />
                    <button onClick={addFamilyMember} className="btn-primary" style={{ width: '100%', padding: '12px' }}><UserPlus size={18} style={{marginRight:'8px'}}/> 아이 등록하기</button>
                 </div>
               </div>

               <div>
                 <h3 style={{ fontSize: '15px', fontWeight: '900', marginBottom: '10px' }}>현재 가족들</h3>
                 <div style={{ display: 'grid', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                    {Object.entries(allUsers).map(([id, p]) => (
                      <div key={id} style={{ padding: '12px', background: '#f8fafc', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                           <div style={{ padding: '6px', borderRadius: '8px', background: p.role === 'admin' ? '#fee2e2' : '#e0e7ff', color: p.role === 'admin' ? '#ef4444' : '#4f46e5' }}>
                              {p.role === 'admin' ? <Shield size={16}/> : <User size={16}/>}
                           </div>
                           <div>
                              <div style={{ fontWeight: '800', fontSize: '14px' }}>{p.displayName}</div>
                              <div style={{ fontSize: '11px', color: '#94a3b8' }}>ID: {id}</div>
                           </div>
                        </div>
                        {isAdmin && id !== user.id && (
                          <button onClick={() => deleteFamilyMember(id)} style={{ background: 'none', border: 'none', color: '#fda4af' }}><Trash size={16}/></button>
                        )}
                      </div>
                    ))}
                 </div>
               </div>
             </div>
           </div>
        )}

        {/* Existing Modals (Settings, Goals, App Launcher, Message Manager, Surprise...) */}
        {showGoals && (
           <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
             <div className="glass animate-fade-in" style={{ background: 'white', padding: '25px', borderRadius: '24px', maxWidth: '480px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}><h2 style={{ fontSize: '20px', fontWeight: '900', color:'var(--primary)', display:'flex', alignItems:'center', gap:'8px' }}><Award color="#facc15"/> 코인 샵 & 관리</h2><button onClick={() => setShowGoals(false)} style={{ background: 'none', border: 'none' }}><CloseIcon size={24}/></button></div>
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
                  <div style={{ background: '#fffbeb', padding: '12px', borderRadius: '18px', textAlign: 'center', border: '2px solid #fde68a', boxShadow: '0 4px 10px rgba(251, 191, 36, 0.1)' }}>
                    <div style={{ fontSize: '11px', color: '#b45309', fontWeight: '800', marginBottom: '3px' }}>현재 잔액 💰</div>
                    <div style={{ fontSize: '22px', fontWeight: '900', color: '#78350f' }}>{availableCoins}</div>
                  </div>
                  <div style={{ background: '#f0f9ff', padding: '12px', borderRadius: '18px', textAlign: 'center', border: '1px solid #bae6fd' }}>
                    <div style={{ fontSize: '11px', color: '#0369a1', fontWeight: '800', marginBottom: '3px' }}>이번 주 🗓️</div>
                    <div style={{ fontSize: '20px', fontWeight: '900', color: '#0c4a6e' }}>{weeklyCoins}</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '18px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '800', marginBottom: '3px' }}>총 누적 🏆</div>
                    <div style={{ fontSize: '20px', fontWeight: '900', color: '#334155' }}>{totalEarnedCoins}</div>
                  </div>
               </div>
               <div style={{ marginBottom: '25px', padding: '20px', background: 'linear-gradient(135deg, #fdf2f8, #fbcfe8)', borderRadius: '24px' }}>
                 <h3 style={{ fontSize: '17px', fontWeight: '900', color: '#be185d', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}><ShoppingCart size={20}/> 코인 샵 (보상 받기)</h3>
                 {isAdmin && (
                   <div style={{ display: 'flex', gap: '8px', marginBottom: '15px', background: 'white', padding: '10px', borderRadius: '15px' }}>
                     <input className="input-field" style={{ flex: 2, border: 'none', background: '#f8fafc' }} placeholder="보상 내용" value={newReward.text} onChange={e => setNewReward({...newReward, text: e.target.value})} />
                     <input className="input-field" type="number" style={{ flex: 1, border: 'none', background: '#f8fafc' }} placeholder="코인" value={newReward.coins} onChange={e => setNewReward({...newReward, coins: parseInt(e.target.value)})} />
                     <button onClick={() => { if(newReward.text) { applyRewardsChange(prev => [...prev, {id: Date.now(), ...newReward}]); setNewReward({text:'', coins:50}); } }} className="btn-primary" style={{ background: '#ec4899', width: '45px', borderRadius: '12px' }}><Plus size={20}/></button>
                   </div>
                 )}
                 <div style={{ display: 'grid', gap: '10px' }}>
                   {rewards.map(r => (
                     <div key={r.id} style={{ background: 'white', padding: '15px', borderRadius: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                       <div><div style={{ fontWeight: '900', color: '#334155', fontSize: '15px' }}>{r.text}</div><div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700' }}>필요 코인: {r.coins}개</div></div>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                         {isAdmin ? (
                           <button onClick={() => redeemReward(r)} disabled={availableCoins < r.coins} style={{ background: availableCoins >= r.coins ? '#ec4899' : '#e2e8f0', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '900', cursor: availableCoins >= r.coins ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '5px' }}><Gift size={14}/> 증정 완료</button>
                         ) : (
                           <div style={{ background: availableCoins >= r.coins ? '#f0fdf4' : '#f1f5f9', color: availableCoins >= r.coins ? '#16a34a' : '#94a3b8', padding: '6px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '900' }}>{availableCoins >= r.coins ? '구매 가능!' : `${r.coins - availableCoins}개 더 필요`}</div>
                         )}
                         {isAdmin && <button onClick={() => applyRewardsChange(prev => prev.filter(i => i.id !== r.id))} style={{ background: 'none', border: 'none', color: '#fda4af' }}><Trash size={16}/></button>}
                       </div>
                     </div>
                   ))}
                 </div>
               </div>
               <div>
                 <h3 style={{ fontSize: '16px', fontWeight: '900', color: '#1e293b', marginBottom: '12px' }}>이번 주 목표 🎯</h3>
                 <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}><input className="input-field" style={{flex:1}} placeholder="이번 주 목표 입력" value={newGoal} onChange={(e) => setNewGoal(e.target.value)} /><button onClick={() => { if(newGoal){ applyGoalsChange(prev => [...prev, {id:Date.now(), text:newGoal, done:false}]); setNewGoal(''); } }} className="btn-primary" style={{ width: '50px' }}><Plus/></button></div>
                 <div style={{ maxHeight: '200px', overflowY: 'auto', display:'grid', gap:'8px' }}>{goals.map(g => <div key={g.id} onClick={() => applyGoalsChange(prev => prev.map(i => i.id === g.id ? {...i, done: !i.done} : i))} style={{ padding: '12px', background: g.done ? '#f0fdf4' : '#f8fafc', borderRadius: '12px', fontSize: '14px', cursor: 'pointer', display:'flex', alignItems:'center', gap:'10px', border: g.done ? '1px solid #dcfce7' : '1px solid #f1f5f9' }}><div style={{width:'16px', height:'16px', borderRadius:'50%', border: g.done ? 'none' : '2px solid #cbd5e0', background: g.done ? '#22c55e' : 'transparent'}} /> <span style={{ textDecoration: g.done ? 'line-through' : 'none', opacity: g.done ? 0.5 : 1, fontWeight:'800' }}>{g.text}</span></div>)}</div>
               </div>
             </div>
           </div>
        )}

        {/* Other existing modals code remains the same... */}
        {showAppLauncher && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div className="glass animate-bounce-in" style={{ background: 'white', padding: '25px', borderRadius: '24px', maxWidth: '400px', width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}><h2 style={{ fontSize: '20px', fontWeight: '900' }}>학습 센터 🚀</h2><button onClick={() => setShowAppLauncher(false)} style={{ background: 'none', border: 'none' }}><CloseIcon size={24}/></button></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                {studyApps.map((app, i) => (
                  <div key={app.id} style={{ position: 'relative' }}>
                    <button onClick={() => window.open(app.url, '_blank')} style={{ width: '100%', aspectRatio: '1/1', background: 'white', border: 'none', borderRadius: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                      <div style={{ width: '40px', height: '40px', background: APP_COLORS[i % APP_COLORS.length], borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '18px', fontWeight: '900' }}>{app.name[0]}</div>
                      <div style={{ fontSize: '12px', fontWeight: '800', maxWidth: '80px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{app.name}</div>
                    </button>
                    {isAdmin && <button onClick={() => deleteStudyApp(app.id)} style={{ position: 'absolute', top: '-5px', right: '-5px', background: 'none', border: 'none', color: '#ff4d6d' }}><Trash size={16}/></button>}
                  </div>
                ))}
                {isAdmin && <button onClick={addStudyApp} style={{ width: '100%', aspectRatio: '1/1', border: '2px dashed #ddd', borderRadius: '20px', background: 'none' }}><Plus size={24} color="#aaa"/></button>}
              </div>
            </div>
          </div>
        )}

        {showMessageManager && isAdmin && (
           <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
             <div className="glass animate-fade-in" style={{ background: 'white', padding: '25px', borderRadius: '24px', maxWidth: '450px', width: '100%', boxSizing: 'border-box', maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}><h2 style={{ fontSize: '18px', fontWeight: '900', color: '#ff4d6d' }}>메시지 관리 & 로그</h2><button onClick={() => setShowMessageManager(false)} style={{ background: 'none', border: 'none' }}><CloseIcon size={20}/></button></div>
                <div style={{ display: 'grid', gap: '10px', marginBottom: '25px' }}>
                  <select className="input-field" style={{ width: '100%', boxSizing: 'border-box' }} value={messageTarget} onChange={(e) => setMessageTarget(e.target.value)}><option value="">아이 선택</option>{kidsList.map(id => <option key={id} value={id}>{allUsers[id]?.displayName || id}</option>)}</select>
                  <input type="date" className="input-field" style={{ width: '100%', boxSizing: 'border-box', display: 'block' }} value={messageDate} onChange={(e) => setMessageDate(e.target.value)} />
                  <textarea className="input-field" style={{ height: '80px', width: '100%', boxSizing: 'border-box' }} placeholder="메시지 입력" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} />
                  <button onClick={sendSurpriseMessage} className="btn-primary" style={{ background: '#ff4d6d', width: '100%' }}>깜짝 메시지 전송</button>
                </div>
                <div style={{ borderTop: '1px solid #eee', paddingTop: '20px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '900', marginBottom: '12px' }}>전송 히스토리 📝</h3>
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {[...(messages || [])].reverse().map(m => (
                      <div key={m.id} style={{ background: '#f8fafc', padding: '12px', borderRadius: '15px', position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                          <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b' }}>{m.date} - {allUsers[m.kidId]?.displayName || m.kidId}</span>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '10px', background: m.read ? '#e2e8f0' : '#ffedef', color: m.read ? '#64748b' : '#ff4d6d', fontWeight: '800' }}>{m.read ? '읽음' : '안읽음'}</span>
                            <button onClick={() => deleteMessage(m.id)} style={{ background: 'none', border: 'none', color: '#94a3b8' }}><Trash size={12}/></button>
                          </div>
                        </div>
                        <p style={{ fontSize: '13px', margin: 0, color: '#334155' }}>{m.text}</p>
                        {m.replies && m.replies.length > 0 && (
                          <div style={{ marginTop: '8px', padding: '8px', background: 'white', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                            {m.replies.map((r, i) => (
                              <div key={i} style={{ fontSize: '12px', color: '#ff4d6d', fontWeight: '800' }}>💬 답장: {r.text} <span style={{ fontSize: '10px', fontWeight: '400', color: '#94a3b8' }}>({r.time})</span></div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
             </div>
           </div>
        )}

        {showSurprise && todayMessage && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div className="glass animate-bounce-in" style={{ background: 'white', padding: '30px', borderRadius: '30px', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
              <div style={{ background: 'linear-gradient(135deg, #ff4d6d, #ff8fa3)', color: 'white', width: '70px', height: '70px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}><Sparkles size={36} /></div>
              <h2 style={{ fontSize: '22px', fontWeight: '900', marginBottom: '15px' }}>엄마의 깜짝 편지! 💌</h2>
              <div style={{ fontSize: '17px', lineHeight: '1.6', background: '#fff0f3', padding: '20px', borderRadius: '20px', whiteSpace: 'pre-wrap', marginBottom: '20px', color: '#d63384', fontWeight: '700' }}>{todayMessage.text}</div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                <input className="input-field" style={{ flex: 1, borderRadius: '12px' }} placeholder="엄마에게 답장하기..." value={replyMessage} onChange={(e) => setReplyMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addMessageReply(todayMessage.id)} />
                <button onClick={() => addMessageReply(todayMessage.id)} style={{ background: '#ff4d6d', color: 'white', border: 'none', borderRadius: '12px', padding: '0 15px' }}><Send size={18}/></button>
              </div>
              <button onClick={() => setShowSurprise(false)} className="btn-primary" style={{ background: 'rgba(0,0,0,0.05)', color: '#666', border: 'none', borderRadius:'15px' }}>닫기</button>
            </div>
          </div>
        )}

      </div>
      <DragOverlay>{activeDragItem && <div className="drag-preview-card" style={{ borderLeft: `6px solid ${activeDragItem.type === 'palette' ? activeDragItem.subject.color : activeDragItem.task.color}`, padding:'12px', background:'white', borderRadius:'12px', boxShadow:'0 10px 20px rgba(0,0,0,0.1)', fontWeight:'900', fontSize:'14px' }}>{activeDragItem.type === 'palette' ? activeDragItem.subject.name : activeDragItem.task.name}</div>}</DragOverlay>
    </DndContext>
  )
}

export default Dashboard
