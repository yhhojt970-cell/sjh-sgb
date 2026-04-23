import React, { useState, useEffect, useMemo, useRef } from 'react'
import { DndContext, DragOverlay, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { SubjectPalette } from './SubjectPalette'
import TimeGrid from './TimeGrid'
import { LogOut, Settings, Star, User, ChevronLeft, ChevronRight, ClipboardList, Gift, Trophy, CheckCircle2, Copy, Trash2, Plus, LayoutGrid, RotateCcw, Mail, Send, X as CloseIcon, AppWindow, ExternalLink, Trash, Sparkles, Calendar, Heart, CheckCircle, MessageCircle, Coins, Award, ShoppingCart, Check, Users, UserPlus, Shield, Palette, Moon, Sun, Laptop } from 'lucide-react'
import { format, addDays, subDays, startOfWeek, isSameDay, parseISO, startOfDay, getDay, isSameMonth, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'
import { ko } from 'date-fns/locale'
import { arrayUnion, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'

const THEMES = {
  lovely: {
    name: '러블리 분홍',
    primary: '#ff4d6d',
    secondary: '#ff8fa3',
    bgGradient: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
    sidebarBg: '#fff9fb',
    cardBg: '#ffffff',
    text: '#334155',
    accent: '#ffdeeb',
    icon: '🌸'
  },
  cute: {
    name: '깜찍 노랑',
    primary: '#f59e0b',
    secondary: '#fbbf24',
    bgGradient: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
    sidebarBg: '#fffbeb',
    cardBg: '#ffffff',
    text: '#451a03',
    accent: '#fef3c7',
    icon: '🐥'
  },
  clean: {
    name: '깔끔 블루',
    primary: '#3b82f6',
    secondary: '#60a5fa',
    bgGradient: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
    sidebarBg: '#f0f9ff',
    cardBg: '#ffffff',
    text: '#1e3a8a',
    accent: '#dbeafe',
    icon: '❄️'
  },
  dark: {
    name: '멋진 다크',
    primary: '#818cf8',
    secondary: '#6366f1',
    bgGradient: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    sidebarBg: '#1e293b',
    cardBg: '#334155',
    text: '#f8fafc',
    accent: '#475569',
    icon: '🌙'
  }
}

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
  
  const [newMember, setNewMember] = useState({ loginId: '', displayName: '', role: 'child', theme: 'lovely' })

  const [currentPassword, setCurrentPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)

  const [activeDragItem, setActiveDragItem] = useState(null)
  const [paletteSubjects, setPaletteSubjects] = useState([])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  // Current Theme based on active kid
  const currentTheme = useMemo(() => {
    const kidTheme = allUsers[activeKidId]?.theme || 'lovely'
    return THEMES[kidTheme] || THEMES.lovely
  }, [activeKidId, allUsers])

  useEffect(() => {
    if (!user?.id) return
    const saved = loadState(`activeKid_${user.id}`, user.role === 'child' ? user.id : '')
    if (saved) setActiveKidId(saved)
    else if (user.role === 'child') setActiveKidId(user.id)
    else { const kids = Object.keys(allUsers || {}).filter(id => allUsers[id].role === 'child'); if (kids.length > 0) setActiveKidId(kids[0]) }
  }, [user?.id, allUsers])

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

  const changeKidTheme = async (kidId, themeId) => {
    if (!isAdmin) return
    const updatedPeople = { ...allUsers, [kidId]: { ...allUsers[kidId], theme: themeId } }
    if (isCloud) {
        const ref = doc(cloud.db, 'households', cloud.householdId)
        await setDoc(ref, { people: updatedPeople, updatedAt: serverTimestamp() }, { merge: true })
    }
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
        alert(`[${newMember.displayName}] 아이가 등록되었습니다!`)
    }
    setNewMember({ loginId: '', displayName: '', role: 'child', theme: 'lovely' })
  }

  const deleteFamilyMember = async (id) => {
    if (!isAdmin || id === user.id) return
    if (!confirm('정말 삭제할까요?')) return
    const { [id]: _, ...remaining } = allUsers
    if (isCloud) { const ref = doc(cloud.db, 'households', cloud.householdId); await setDoc(ref, { people: remaining, updatedAt: serverTimestamp() }, { merge: true }) }
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
    const name = prompt('특별 일정 이름 (예: 기말고사)'); if (!name) return
    addTask(name, '#facc15', `${hour.toString().padStart(2, '0')}:00`, 60, 'event', 'Star')
  }

  const addStudyApp = async () => {
    const name = prompt('어플 이름'); const url = prompt('주소(URL)'); if (!name || !url) return
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
    setReplyMessage(''); alert('답장 전송! ❤️')
  }

  const deleteMessage = async (msgId) => {
    if (!confirm('삭제할까요?')) return
    const next = messages.filter(m => m.id !== msgId)
    const ref = doc(cloud.db, 'households', cloud.householdId, 'meta', 'messages')
    await setDoc(ref, { messages: next, updatedAt: serverTimestamp() }, { merge: true })
  }

  const handleDragEnd = (event) => {
    const { active, over } = event; if (!over) { setActiveDragItem(null); return }
    const d = active?.data?.current
    if (d?.type === 'palette' && over.id.toString().startsWith('hour-')) { addTask(d.subject.name, d.subject.color, `${over.data.current.hour.toString().padStart(2, '0')}:00`, 50, 'study') }
    else if (d?.type === 'task' && over.id.toString().startsWith('hour-')) { updateTask(d.task.id, { startTime: `${over.data.current.hour.toString().padStart(2, '0')}:00` }) }
    setActiveDragItem(null)
  }

  const addTask = (name, color, startTime, duration, type, icon = 'Book', targetKidId = activeKidId, targetDate = format(selectedDate, 'yyyy-MM-dd'), extra = {}) => {
    const [h, m] = startTime.split(':').map(Number); const total = h * 60 + m + duration; const endH = Math.floor(total / 60) % 24; const endM = total % 60
    const nt = { id: Math.random().toString(36).substr(2, 9), name, color, startTime, expectedEndTime: `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`, duration, type, icon, completed: false, date: targetDate, coins: type === 'event' ? 0 : 1, ...extra }
    if (targetKidId === activeKidId) applyTaskChange(prev => [...prev, nt])
  }

  const updateTask = (id, up) => applyTaskChange(prev => prev.map(t => t.id === id ? { ...t, ...up } : t))
  const deleteTask = (id) => applyTaskChange(prev => prev.filter(t => t.id !== id))

  const isAdmin = user?.role === 'admin'
  const kidsList = Object.keys(allUsers || {}).filter(id => allUsers[id].role === 'child')
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(selectedDate, { weekStartsOn: 1 }), i))
  const unreadMessage = useMemo(() => messages.find(m => m.date === format(selectedDate, 'yyyy-MM-dd') && m.kidId === activeKidId && !m.read), [messages, selectedDate, activeKidId])
  const todayMessage = useMemo(() => messages.find(m => m.date === format(selectedDate, 'yyyy-MM-dd') && m.kidId === activeKidId), [messages, selectedDate, activeKidId])
  const todayTasks = useMemo(() => tasks.filter(t => (t.type === 'class' && t.weekday === getDay(selectedDate)) || (t.date === format(selectedDate, 'yyyy-MM-dd'))), [tasks, selectedDate])
  const essentialChecklist = useMemo(() => essentials.map(e => ({ ...e, completed: todayTasks.some(t => t.completed && (t.name.includes(e.name) || e.name.includes(t.name))) })), [essentials, todayTasks])
  const totalEarnedCoins = useMemo(() => tasks.filter(t => t.completed).reduce((sum, t) => sum + (t.coins || 0), 0), [tasks])
  const availableCoins = useMemo(() => totalEarnedCoins - spentCoins, [totalEarnedCoins, spentCoins])
  const weeklyCoins = useMemo(() => { const s = startOfWeek(new Date(), { weekStartsOn: 1 }); const e = addDays(s, 6); return tasks.filter(t => t.completed && t.date && isWithinInterval(parseISO(t.date), { start: s, end: e })).reduce((sum, t) => sum + (t.coins || 0), 0) }, [tasks])
  const monthlyCoins = useMemo(() => { const s = startOfMonth(new Date()); const e = endOfMonth(new Date()); return tasks.filter(t => t.completed && t.date && isWithinInterval(parseISO(t.date), { start: s, end: e })).reduce((sum, t) => sum + (t.coins || 0), 0) }, [tasks])

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={(e) => { const d = e.active.data.current; if (d?.type === 'palette') setActiveDragItem({ type: 'palette', subject: d.subject }); else if (d?.type === 'task') setActiveDragItem({ type: 'task', task: d.task }); }} onDragEnd={handleDragEnd}>
      <div className="dashboard-shell" style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '8px' : '20px', backgroundColor: currentTheme.sidebarBg, minHeight: '100vh', transition: 'background-color 0.5s ease' }}>
        
        <header className="glass" style={{ padding: isMobile ? '10px' : '20px 30px', borderRadius: 'var(--radius-lg)', marginBottom: '15px', background: currentTheme.cardBg, borderBottom: `2px solid ${currentTheme.accent}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '5px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '15px', minWidth: 0, flex: 1 }}>
              <div style={{ position: 'relative', width: isMobile ? '36px' : '50px', height: isMobile ? '36px' : '50px', flexShrink: 0 }}>
                <div style={{ background: currentTheme.bgGradient, color: 'white', width: '100%', height: '100%', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 10px ${currentTheme.primary}40`, fontSize: isMobile ? '18px' : '24px' }}>
                  {currentTheme.icon}
                </div>
                {unreadMessage && (
                  <button onClick={() => { setShowSurprise(true); markMessageRead(unreadMessage.id); }} className="animate-bounce" style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ff4d6d', color: 'white', border: 'none', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer', zIndex: 10 }}>
                    <Gift size={10} />
                  </button>
                )}
              </div>
              <h1 style={{ fontSize: isMobile ? '16px' : '22px', fontWeight: '900', color: currentTheme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{allUsers[activeKidId]?.displayName || activeKidId}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: currentTheme.accent, padding: '5px 12px', borderRadius: '20px', border: `1px solid ${currentTheme.secondary}40` }}>
                 <Coins size={16} color={currentTheme.primary} />
                 <span style={{ fontSize: '14px', fontWeight: '900', color: currentTheme.text }}>{availableCoins}</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '3px' : '8px', flexShrink: 0 }}>
              {isAdmin && <button onClick={() => setShowFamilyManager(true)} style={{ background: `${currentTheme.primary}10`, border: 'none', padding: isMobile ? '6px' : '10px', borderRadius: '8px', color: currentTheme.primary }}><Users size={isMobile ? 18 : 22}/></button>}
              {isAdmin && <button onClick={() => setShowAppLauncher(true)} style={{ background: `${currentTheme.primary}10`, border: 'none', padding: isMobile ? '6px' : '10px', borderRadius: '8px', color: currentTheme.primary }}><LayoutGrid size={isMobile ? 18 : 22}/></button>}
              {isAdmin && <button onClick={() => { setShowMessageManager(true); setMessageTarget(activeKidId); }} style={{ background: '#ff4d6d10', border: 'none', padding: isMobile ? '6px' : '10px', borderRadius: '8px', color: '#ff4d6d' }}><Mail size={isMobile ? 18 : 22}/></button>}
              <button onClick={() => setShowGoals(true)} style={{ background: `${currentTheme.primary}10`, border: 'none', padding: isMobile ? '6px' : '10px', borderRadius: '8px', color: currentTheme.primary }}><Trophy size={isMobile ? 18 : 22}/></button>
              <button onClick={() => setShowSettings(true)} style={{ background: 'rgba(0,0,0,0.05)', border: 'none', padding: isMobile ? '6px' : '10px', borderRadius: '8px', color: currentTheme.text }}><Settings size={isMobile ? 18 : 22} /></button>
              <button onClick={onLogout} style={{ background: 'rgba(244, 63, 94, 0.05)', border: 'none', padding: isMobile ? '6px' : '10px', borderRadius: '8px', color: '#f43f5e' }}><LogOut size={isMobile ? 18 : 22} /></button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px', marginTop: '10px', background: 'rgba(0,0,0,0.03)', padding: '3px', borderRadius: '10px' }}>
            {kidsList.map(id => (
              <button key={id} onClick={() => setActiveKidId(id)} style={{ flex: 1, padding: '7px', borderRadius: '8px', border: 'none', background: activeKidId === id ? (allUsers[id]?.theme === 'dark' ? '#334155' : 'white') : 'transparent', fontWeight: '900', color: activeKidId === id ? THEMES[allUsers[id]?.theme || 'lovely']?.primary : (currentTheme.name === '멋진 다크' ? '#94a3b8' : '#64748b'), fontSize: '12px', boxShadow: activeKidId === id ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.3s' }}>
                {THEMES[allUsers[id]?.theme || 'lovely']?.icon} {allUsers[id]?.displayName || id}
              </button>
            ))}
          </div>
        </header>

        {/* Date Selector */}
        <div style={{ background: currentTheme.cardBg, borderRadius: 'var(--radius-lg)', padding: isMobile ? '12px' : '20px', marginBottom: '15px', boxShadow: 'var(--shadow)', border: `1px solid ${currentTheme.accent}` }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
             <button onClick={() => setSelectedDate(subDays(selectedDate, 1))} style={{ background: 'rgba(0,0,0,0.03)', border: 'none', borderRadius: '50%', padding: '8px', color: currentTheme.text }}><ChevronLeft size={20}/></button>
             <div style={{ fontSize: '16px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '6px', color: currentTheme.text }}><Calendar size={18} color={currentTheme.primary}/> {format(selectedDate, 'yyyy년 MM월')}</div>
             <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} style={{ background: 'rgba(0,0,0,0.03)', border: 'none', borderRadius: '50%', padding: '8px', color: currentTheme.text }}><ChevronRight size={20}/></button>
          </div>
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none', justifyContent: isMobile ? 'flex-start' : 'center' }}>
            {weekDays.map(day => (
              <button key={day.toString()} onClick={() => setSelectedDate(day)} style={{ flex: 1, padding: '10px 0', borderRadius: '12px', border: 'none', background: isSameDay(day, selectedDate) ? currentTheme.primary : (currentTheme.name === '멋진 다크' ? '#334155' : 'rgba(0,0,0,0.03)'), color: isSameDay(day, selectedDate) ? 'white' : currentTheme.text, fontWeight: '800', minWidth: '45px', display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'all 0.3s' }}>
                <span style={{ fontSize: '10px', opacity: 0.8 }}>{format(day, 'eee', { locale: ko })}</span>
                <span style={{ fontSize: '14px' }}>{format(day, 'd')}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={isMobile ? "" : "dashboard-main-grid"} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '320px 1fr', gap: isMobile ? '15px' : '30px' }}>
          <aside style={{ display: isMobile && !showPalette ? 'none' : 'flex', flexDirection: 'column', gap: '20px' }}>
             <div className="glass" style={{ borderRadius: 'var(--radius-lg)', background: currentTheme.cardBg, border: `1px solid ${currentTheme.accent}` }}><SubjectPalette cloud={cloud} activeKidId={activeKidId} kids={kidsList} onSubjectsChange={setPaletteSubjects} /></div>
          </aside>
          <main><TimeGrid tasks={todayTasks} onUpdateTask={updateTask} onDeleteTask={deleteTask} isAdmin={isAdmin} essentialChecklist={essentialChecklist} onAddSpecialEvent={addSpecialEvent} /></main>
        </div>

        {/* Family Manager Modal (With Theme Selection) */}
        {showFamilyManager && isAdmin && (
           <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
             <div className="glass animate-fade-in" style={{ background: 'white', padding: '25px', borderRadius: '24px', maxWidth: '480px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}><h2 style={{ fontSize: '18px', fontWeight: '900', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}><Users size={20}/> 가족 구성원 & 테마 관리</h2><button onClick={() => setShowFamilyManager(false)} style={{ background: 'none', border: 'none' }}><CloseIcon size={24}/></button></div>
               
               <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '15px', marginBottom: '20px' }}>
                 <div style={{ fontSize: '12px', fontWeight: '800', color: '#64748b', marginBottom: '5px' }}>우리 가족 코드 🔑</div>
                 <div style={{ fontSize: '20px', fontWeight: '900', color: '#3b82f6', letterSpacing: '2px' }}>{cloud.householdId}</div>
               </div>

               <div style={{ marginBottom: '25px' }}>
                 <h3 style={{ fontSize: '15px', fontWeight: '900', marginBottom: '12px' }}>새 멤버 추가</h3>
                 <div style={{ display: 'grid', gap: '10px', background: '#f1f5f9', padding: '15px', borderRadius: '18px' }}>
                    <input className="input-field" placeholder="아이 이름 (예: 손지희)" value={newMember.displayName} onChange={e => setNewMember({...newMember, displayName: e.target.value})} />
                    <input className="input-field" placeholder="로그인 아이디 (영문/숫자)" value={newMember.loginId} onChange={e => setNewMember({...newMember, loginId: e.target.value})} />
                    
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      {Object.entries(THEMES).map(([tid, t]) => (
                        <button key={tid} onClick={() => setNewMember({...newMember, theme: tid})} style={{ flex: 1, padding: '8px', borderRadius: '10px', border: newMember.theme === tid ? `2px solid ${t.primary}` : '1px solid #ddd', background: t.sidebarBg, fontSize: '11px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px', minWidth: '80px' }}>
                          {t.icon} {t.name.split(' ')[1]}
                        </button>
                      ))}
                    </div>
                    
                    <button onClick={addFamilyMember} className="btn-primary" style={{ width: '100%', padding: '12px', background: '#3b82f6' }}><UserPlus size={18} style={{marginRight:'8px'}}/> 아이 등록하기</button>
                 </div>
               </div>

               <div>
                 <h3 style={{ fontSize: '15px', fontWeight: '900', marginBottom: '10px' }}>멤버별 테마 설정</h3>
                 <div style={{ display: 'grid', gap: '10px' }}>
                    {Object.entries(allUsers).map(([id, p]) => (
                      <div key={id} style={{ padding: '15px', background: '#f8fafc', borderRadius: '18px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ padding: '8px', borderRadius: '10px', background: p.role === 'admin' ? '#fee2e2' : THEMES[p.theme || 'lovely']?.accent, color: p.role === 'admin' ? '#ef4444' : THEMES[p.theme || 'lovely']?.primary }}>
                               {p.role === 'admin' ? <Shield size={18}/> : <User size={18}/>}
                            </div>
                            <span style={{ fontWeight: '900' }}>{p.displayName}</span>
                          </div>
                          {id !== user.id && <button onClick={() => deleteFamilyMember(id)} style={{ color: '#fda4af', border: 'none', background: 'none' }}><Trash size={16}/></button>}
                        </div>
                        
                        <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '5px' }}>
                           {Object.entries(THEMES).map(([tid, t]) => (
                             <button key={tid} onClick={() => changeKidTheme(id, tid)} style={{ padding: '6px 10px', borderRadius: '8px', border: (p.theme || 'lovely') === tid ? `2px solid ${t.primary}` : '1px solid transparent', background: t.sidebarBg, fontSize: '11px', fontWeight: '800', whiteSpace: 'nowrap' }}>
                               {t.icon} {t.name.split(' ')[1]}
                             </button>
                           ))}
                        </div>
                      </div>
                    ))}
                 </div>
               </div>
             </div>
           </div>
        )}

        {/* Goals, Settings Modals (Simplified update for themes) */}
        {showGoals && (
           <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
             <div className="glass animate-fade-in" style={{ background: currentTheme.cardBg, padding: '25px', borderRadius: '24px', maxWidth: '480px', width: '100%', maxHeight: '90vh', overflowY: 'auto', color: currentTheme.text, border: `1px solid ${currentTheme.accent}` }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}><h2 style={{ fontSize: '20px', fontWeight: '900', color:currentTheme.primary, display:'flex', alignItems:'center', gap:'8px' }}><Award/> 코인 샵 & 관리</h2><button onClick={() => setShowGoals(false)} style={{ background: 'none', border: 'none', color: currentTheme.text }}><CloseIcon size={24}/></button></div>
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
                  <div style={{ background: currentTheme.accent, padding: '12px', borderRadius: '18px', textAlign: 'center', border: `1px solid ${currentTheme.primary}40` }}>
                    <div style={{ fontSize: '11px', color: currentTheme.primary, fontWeight: '800', marginBottom: '3px' }}>현재 잔액 💰</div>
                    <div style={{ fontSize: '22px', fontWeight: '900' }}>{availableCoins}</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.03)', padding: '12px', borderRadius: '18px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: currentTheme.text, opacity: 0.7, fontWeight: '800', marginBottom: '3px' }}>이번 주 🗓️</div>
                    <div style={{ fontSize: '20px', fontWeight: '900' }}>{weeklyCoins}</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.03)', padding: '12px', borderRadius: '18px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: currentTheme.text, opacity: 0.7, fontWeight: '800', marginBottom: '3px' }}>총 누적 🏆</div>
                    <div style={{ fontSize: '20px', fontWeight: '900' }}>{totalEarnedCoins}</div>
                  </div>
               </div>
               <div style={{ marginBottom: '25px', padding: '20px', background: currentTheme.bgGradient, borderRadius: '24px', color: 'white' }}>
                 <h3 style={{ fontSize: '17px', fontWeight: '900', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}><ShoppingCart size={20}/> 코인 샵</h3>
                 <div style={{ display: 'grid', gap: '10px' }}>
                   {rewards.map(r => (
                     <div key={r.id} style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', padding: '15px', borderRadius: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                       <div><div style={{ fontWeight: '900', fontSize: '15px' }}>{r.text}</div><div style={{ fontSize: '12px', fontWeight: '700', opacity: 0.8 }}>{r.coins} 코인</div></div>
                       {isAdmin ? (
                         <button onClick={() => redeemReward(r)} disabled={availableCoins < r.coins} style={{ background: availableCoins >= r.coins ? 'white' : 'rgba(255,255,255,0.3)', color: availableCoins >= r.coins ? currentTheme.primary : '#ccc', border: 'none', padding: '8px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '900' }}>증정 완료</button>
                       ) : (
                         <div style={{ background: availableCoins >= r.coins ? 'rgba(255,255,255,0.3)' : 'transparent', padding: '6px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '900' }}>{availableCoins >= r.coins ? '구매 가능!' : `${r.coins - availableCoins}개 더 필요`}</div>
                       )}
                     </div>
                   ))}
                 </div>
               </div>
             </div>
           </div>
        )}

      </div>
    </DndContext>
  )
}

export default Dashboard
