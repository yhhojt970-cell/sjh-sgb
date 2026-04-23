import React, { useState, useEffect, useMemo, useRef } from 'react'
import { DndContext, DragOverlay, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SubjectPalette } from './SubjectPalette'
import TimeGrid from './TimeGrid'
import { LogOut, Settings, Star, User, ChevronLeft, ChevronRight, Gift, Trophy, Plus, LayoutGrid, Mail, Send, X as CloseIcon, Trash, Sparkles, Calendar, Coins, Award, ShoppingCart, Users, UserPlus, Shield } from 'lucide-react'
import { format, addDays, subDays, startOfWeek, isSameDay, parseISO, getDay, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'
import { ko } from 'date-fns/locale'
import { arrayUnion, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'

const THEMES = {
  lovely: { name: '러블리 분홍', primary: '#ff4d6d', secondary: '#ff8fa3', bgGradient: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)', sidebarBg: '#fff9fb', cardBg: '#ffffff', text: '#334155', accent: '#ffdeeb', icon: '🌸' },
  cute: { name: '깜찍 노랑', primary: '#f59e0b', secondary: '#fbbf24', bgGradient: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)', sidebarBg: '#fffbeb', cardBg: '#ffffff', text: '#451a03', accent: '#fef3c7', icon: '🐥' },
  clean: { name: '깔끔 블루', primary: '#3b82f6', secondary: '#60a5fa', bgGradient: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)', sidebarBg: '#f0f9ff', cardBg: '#ffffff', text: '#1e3a8a', accent: '#dbeafe', icon: '❄️' },
  dark: { name: '멋진 다크', primary: '#818cf8', secondary: '#6366f1', bgGradient: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', sidebarBg: '#1e293b', cardBg: '#334155', text: '#f8fafc', accent: '#475569', icon: '🌙' }
}

const APP_COLORS = ['#ff9a9e', '#a1c4fd', '#84fab0', '#f6d365', '#cfd9df', '#a8edea']

function Dashboard({ user = {}, onLogout, allUsers = {}, cloud = {} }) {
  const isCloud = !!cloud.db && !!cloud.householdId
  const [activeKidId, setActiveKidId] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth <= 768); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h)
  }, [])

  const [tasks, setTasks] = useState([]); const [goals, setGoals] = useState([]); const [messages, setMessages] = useState([]); const [studyApps, setStudyApps] = useState([]); const [essentials, setEssentials] = useState([]); const [rewards, setRewards] = useState([]); const [spentCoins, setSpentCoins] = useState(0)
  const [showSettings, setShowSettings] = useState(false); const [showGoals, setShowGoals] = useState(false); const [showMessageManager, setShowMessageManager] = useState(false); const [showAppLauncher, setShowAppLauncher] = useState(false); const [showSurprise, setShowSurprise] = useState(false); const [showFamilyManager, setShowFamilyManager] = useState(false)
  const [newGoal, setNewGoal] = useState(''); const [newReward, setNewReward] = useState({ text: '', coins: 50 }); const [newMessage, setNewMessage] = useState(''); const [replyMessage, setReplyMessage] = useState(''); const [messageDate, setMessageDate] = useState(format(new Date(), 'yyyy-MM-dd')); const [messageTarget, setMessageTarget] = useState(''); const [newMember, setNewMember] = useState({ loginId: '', displayName: '', role: 'child', theme: 'lovely' })
  const [activeDragItem, setActiveDragItem] = useState(null); const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  // Safety first for themes
  const currentTheme = useMemo(() => {
    const tid = (allUsers && activeKidId && allUsers[activeKidId]?.theme) || 'lovely'
    return THEMES[tid] || THEMES.lovely
  }, [activeKidId, allUsers])

  useEffect(() => {
    if (!user.id) return
    const kids = Object.keys(allUsers).filter(id => allUsers[id].role === 'child')
    if (kids.length > 0 && !activeKidId) setActiveKidId(kids[0])
    else if (!activeKidId) setActiveKidId(user.id)
  }, [user.id, allUsers])

  useEffect(() => {
    if (!activeKidId || !isCloud) return
    const ref = doc(cloud.db, 'households', cloud.householdId, 'kids', activeKidId)
    return onSnapshot(ref, snap => {
      const d = snap.exists() ? snap.data() : {}
      setTasks(d.tasks || []); setGoals(d.goals || []); setEssentials(d.essentials || []); setRewards(d.rewards || []); setSpentCoins(d.spentCoins || 0)
    })
  }, [activeKidId, isCloud])

  useEffect(() => {
    if (!isCloud) return
    const unsubMsg = onSnapshot(doc(cloud.db, 'households', cloud.householdId, 'meta', 'messages'), s => setMessages(s.exists() ? s.data().messages || [] : []))
    const unsubApp = onSnapshot(doc(cloud.db, 'households', cloud.householdId, 'meta', 'apps'), s => setStudyApps(s.exists() ? s.data().apps || [] : []))
    return () => { unsubMsg(); unsubApp(); }
  }, [isCloud])

  const persist = async (over) => {
    if (!isCloud || !activeKidId) return
    const ref = doc(cloud.db, 'households', cloud.householdId, 'kids', activeKidId)
    await setDoc(ref, { tasks, goals, essentials, rewards, spentCoins, ...over, updatedAt: serverTimestamp() }, { merge: true })
  }

  const isAdmin = user.role === 'admin'
  const kidsList = Object.keys(allUsers).filter(id => allUsers[id].role === 'child')
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(selectedDate, { weekStartsOn: 1 }), i))
  const todayStr = format(selectedDate, 'yyyy-MM-dd')
  const todayTasks = tasks.filter(t => (t.type === 'class' && t.weekday === getDay(selectedDate)) || (t.date === todayStr))
  const availableCoins = useMemo(() => tasks.filter(t => t.completed).reduce((s, t) => s + (t.coins || 0), 0) - spentCoins, [tasks, spentCoins])
  const unreadMessage = messages.find(m => m.date === todayStr && m.kidId === activeKidId && !m.read)

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={e => { const d = e.active.data.current; if (d?.type === 'palette') setActiveDragItem({ type: 'palette', subject: d.subject }); else if (d?.type === 'task') setActiveDragItem({ type: 'task', task: d.task }); }} onDragEnd={e => { const { active, over } = e; if (!over) { setActiveDragItem(null); return }; const d = active.data.current; if (d?.type === 'palette' && over.id.toString().startsWith('hour-')) { const startTime = `${over.data.current.hour.toString().padStart(2, '0')}:00`; const nt = { id: Math.random().toString(36).substr(2, 9), name: d.subject.name, color: d.subject.color, startTime, expectedEndTime: '00:00', duration: 50, type: 'study', icon: 'Book', completed: false, date: todayStr, coins: 1 }; const next = [...tasks, nt]; setTasks(next); persist({ tasks: next }) } setActiveDragItem(null); }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '8px' : '20px', backgroundColor: currentTheme.sidebarBg, minHeight: '100vh', color: currentTheme.text }}>
        
        <header className="glass" style={{ padding: isMobile ? '10px' : '20px', borderRadius: '15px', marginBottom: '15px', background: currentTheme.cardBg }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ background: currentTheme.bgGradient, width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{currentTheme.icon}</div>
              <h1 style={{ fontSize: isMobile ? '16px' : '20px', fontWeight: '900' }}>{allUsers[activeKidId]?.displayName || activeKidId}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: currentTheme.accent, padding: '4px 10px', borderRadius: '20px' }}>
                <Coins size={14} color={currentTheme.primary} />
                <span style={{ fontSize: '13px', fontWeight: '900' }}>{availableCoins}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', padding: '5px 0' }}>
              {isAdmin && <button onClick={() => setShowFamilyManager(true)} className="header-btn"><Users size={18}/></button>}
              <button onClick={() => setShowGoals(true)} className="header-btn"><Trophy size={18}/></button>
              <button onClick={() => setShowSettings(true)} className="header-btn"><Settings size={18}/></button>
              <button onClick={onLogout} className="header-btn" style={{ color: 'red' }}><LogOut size={18}/></button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '5px', marginTop: '10px', overflowX: 'auto' }}>
            {kidsList.map(id => (
              <button key={id} onClick={() => setActiveKidId(id)} style={{ flex: '0 0 auto', padding: '6px 12px', borderRadius: '10px', border: 'none', background: activeKidId === id ? 'white' : 'rgba(0,0,0,0.05)', fontWeight: 'bold' }}>{allUsers[id]?.displayName || id}</button>
            ))}
          </div>
        </header>

        <div style={{ background: currentTheme.cardBg, borderRadius: '15px', padding: '15px', marginBottom: '15px', border: `1px solid ${currentTheme.accent}` }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '10px' }}>
            <button onClick={() => setSelectedDate(subDays(selectedDate, 1))} style={{ border: 'none', background: 'none' }}><ChevronLeft/></button>
            <div style={{ fontWeight: 'bold' }}>{format(selectedDate, 'yyyy년 MM월')}</div>
            <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} style={{ border: 'none', background: 'none' }}><ChevronRight/></button>
          </div>
          <div style={{ display: 'flex', gap: '2px' }}>
            {weekDays.map(day => (
              <button key={day.toString()} onClick={() => setSelectedDate(day)} style={{ flex: 1, padding: '10px 0', borderRadius: '10px', border: 'none', background: isSameDay(day, selectedDate) ? currentTheme.primary : 'transparent', color: isSameDay(day, selectedDate) ? 'white' : 'inherit' }}>
                <div style={{ fontSize: '10px' }}>{format(day, 'eee', { locale: ko })}</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{format(day, 'd')}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '280px 1fr', gap: '15px' }}>
          {!isMobile && <aside style={{ background: 'white', padding: '15px', borderRadius: '15px' }}><SubjectPalette cloud={cloud} activeKidId={activeKidId} kids={kidsList} onSubjectsChange={() => {}} /></aside>}
          <main><TimeGrid tasks={todayTasks} onUpdateTask={(id, up) => { const next = tasks.map(t => t.id === id ? {...t, ...up} : t); setTasks(next); persist({ tasks: next }) }} onDeleteTask={id => { const next = tasks.filter(t => t.id !== id); setTasks(next); persist({ tasks: next }) }} isAdmin={isAdmin} essentialChecklist={[]} onAddSpecialEvent={() => {}} /></main>
        </div>

        {/* Simplest Modals */}
        {showFamilyManager && isAdmin && (
          <div className="modal-overlay" onClick={() => setShowFamilyManager(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ background: 'white', padding: '20px', borderRadius: '15px' }}>
              <h2 style={{ marginBottom: '15px' }}>가족 관리</h2>
              <div style={{ background: '#eee', padding: '10px', borderRadius: '10px', marginBottom: '10px' }}>코드: {cloud.householdId}</div>
              <input style={{ width: '100%', padding: '10px', marginBottom: '5px' }} placeholder="이름" value={newMember.displayName} onChange={e => setNewMember({...newMember, displayName: e.target.value})} />
              <input style={{ width: '100%', padding: '10px', marginBottom: '10px' }} placeholder="아이디" value={newMember.loginId} onChange={e => setNewMember({...newMember, loginId: e.target.value})} />
              <button onClick={async () => { const next = {...allUsers, [newMember.loginId]: newMember}; await setDoc(doc(cloud.db, 'households', cloud.householdId), { people: next }, { merge: true }); setNewMember({loginId:'', displayName:'', role:'child'}) }} style={{ width: '100%', padding: '10px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '10px' }}>등록</button>
            </div>
          </div>
        )}

      </div>
    </DndContext>
  )
}

export default Dashboard
