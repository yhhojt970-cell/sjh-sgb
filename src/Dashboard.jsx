import React, { useState, useEffect, useMemo, useRef } from 'react'
import { DndContext, DragOverlay, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SubjectPalette } from './SubjectPalette'
import TimeGrid from './TimeGrid'
import { LogOut, Settings, Star, User, ChevronLeft, ChevronRight, Gift, Trophy, Plus, LayoutGrid, Mail, Send, X as CloseIcon, Trash, Sparkles, Calendar, Coins, Award, ShoppingCart, Users, UserPlus, Shield, Palette } from 'lucide-react'
import { format, addDays, subDays, startOfWeek, isSameDay, parseISO, getDay, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'
import { ko } from 'date-fns/locale'
import { arrayUnion, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'

const THEMES = {
  lovely: { name: '러블리 분홍', primary: '#ff4d6d', secondary: '#ff8fa3', bgGradient: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)', sidebarBg: '#fff9fb', cardBg: '#ffffff', text: '#334155', accent: '#ffdeeb', icon: '🌸' },
  cute: { name: '깜찍 노랑', primary: '#f59e0b', secondary: '#fbbf24', bgGradient: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)', sidebarBg: '#fffbeb', cardBg: '#ffffff', text: '#451a03', accent: '#fef3c7', icon: '🐥' },
  clean: { name: '깔끔 블루', primary: '#3b82f6', secondary: '#60a5fa', bgGradient: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)', sidebarBg: '#f0f9ff', cardBg: '#ffffff', text: '#1e3a8a', accent: '#dbeafe', icon: '❄️' },
  dark: { name: '멋진 다크', primary: '#818cf8', secondary: '#6366f1', bgGradient: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', sidebarBg: '#1e293b', cardBg: '#334155', text: '#f8fafc', accent: '#475569', icon: '🌙' }
}

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
  const [currentPassword, setCurrentPassword] = useState(''); const [nextPassword, setNextPassword] = useState(''); const [passwordMessage, setPasswordMessage] = useState(''); const [passwordBusy, setPasswordBusy] = useState(false)
  const [activeDragItem, setActiveDragItem] = useState(null); const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const currentTheme = useMemo(() => {
    const tid = (allUsers && activeKidId && allUsers[activeKidId]?.theme) || 'lovely'
    return THEMES[tid] || THEMES.lovely
  }, [activeKidId, allUsers])

  useEffect(() => {
    if (!user.id) return
    const kids = Object.keys(allUsers).filter(id => allUsers[id].role === 'child')
    if (!activeKidId) setActiveKidId(kids.length > 0 ? kids[0] : user.id)
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

  const updateTask = (id, up) => { const next = tasks.map(t => t.id === id ? {...t, ...up} : t); setTasks(next); persist({ tasks: next }) }
  const deleteTask = id => { const next = tasks.filter(t => t.id !== id); setTasks(next); persist({ tasks: next }) }
  const isAdmin = user.role === 'admin'
  const kidsList = Object.keys(allUsers).filter(id => allUsers[id].role === 'child')
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(selectedDate, { weekStartsOn: 1 }), i))
  const todayStr = format(selectedDate, 'yyyy-MM-dd')
  const todayTasks = tasks.filter(t => (t.type === 'class' && t.weekday === getDay(selectedDate)) || (t.date === todayStr))
  const availableCoins = useMemo(() => tasks.filter(t => t.completed).reduce((s, t) => s + (t.coins || 0), 0) - spentCoins, [tasks, spentCoins])
  const unreadMessage = messages.find(m => m.date === todayStr && m.kidId === activeKidId && !m.read)

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={e => { const d = e.active.data.current; if (d?.type === 'palette') setActiveDragItem({ type: 'palette', subject: d.subject }); else if (d?.type === 'task') setActiveDragItem({ type: 'task', task: d.task }); }} onDragEnd={e => { const { active, over } = e; if (!over) { setActiveDragItem(null); return }; const d = active.data.current; if (d?.type === 'palette' && over.id.toString().startsWith('hour-')) { const startTime = `${over.data.current.hour.toString().padStart(2, '0')}:00`; const nt = { id: Math.random().toString(36).substr(2, 9), name: d.subject.name, color: d.subject.color, startTime, expectedEndTime: '00:00', duration: 50, type: 'study', icon: 'Book', completed: false, date: todayStr, coins: 1 }; const next = [...tasks, nt]; setTasks(next); persist({ tasks: next }) } setActiveDragItem(null); }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '8px' : '20px', backgroundColor: currentTheme.sidebarBg, minHeight: '100vh', transition: 'background-color 0.5s ease' }}>
        
        {/* PREMIUM HEADER */}
        <header className="glass" style={{ padding: isMobile ? '12px' : '20px 30px', borderRadius: '24px', marginBottom: '15px', background: currentTheme.cardBg, boxShadow: '0 8px 32px rgba(0,0,0,0.05)', border: `1px solid ${currentTheme.accent}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '15px', minWidth: 0, flex: 1 }}>
              <div style={{ position: 'relative', width: isMobile ? '40px' : '55px', height: isMobile ? '40px' : '55px', flexShrink: 0 }}>
                <div style={{ background: currentTheme.bgGradient, color: 'white', width: '100%', height: '100%', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? '20px' : '28px', boxShadow: `0 4px 15px ${currentTheme.primary}40` }}>{currentTheme.icon}</div>
                {unreadMessage && <div style={{ position: 'absolute', top: '-5px', right: '-5px', background: '#ff4d6d', width: '18px', height: '18px', borderRadius: '50%', border: '2px solid white' }} />}
              </div>
              <div style={{ minWidth: 0 }}>
                <h1 style={{ fontSize: isMobile ? '17px' : '24px', fontWeight: '900', color: currentTheme.text, margin: 0 }}>{allUsers[activeKidId]?.displayName || activeKidId}</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                   <Coins size={14} color={currentTheme.primary} />
                   <span style={{ fontSize: '13px', fontWeight: '900', color: currentTheme.primary }}>{availableCoins}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {isAdmin && <button onClick={() => setShowFamilyManager(true)} className="header-btn" style={{ background: `${currentTheme.primary}15`, color: currentTheme.primary }}><Users size={20}/></button>}
              {isAdmin && <button onClick={() => setShowAppLauncher(true)} className="header-btn" style={{ background: `${currentTheme.primary}15`, color: currentTheme.primary }}><LayoutGrid size={20}/></button>}
              <button onClick={() => setShowGoals(true)} className="header-btn" style={{ background: `${currentTheme.primary}15`, color: currentTheme.primary }}><Trophy size={20}/></button>
              <button onClick={() => setShowSettings(true)} className="header-btn" style={{ background: 'rgba(0,0,0,0.05)', color: currentTheme.text }}><Settings size={20}/></button>
              <button onClick={onLogout} className="header-btn" style={{ background: '#ff4d6d15', color: '#ff4d6d' }}><LogOut size={20}/></button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px', marginTop: '15px', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {kidsList.map(id => (
              <button key={id} onClick={() => setActiveKidId(id)} style={{ flex: '0 0 auto', padding: '8px 16px', borderRadius: '12px', border: 'none', background: activeKidId === id ? (allUsers[id]?.theme === 'dark' ? '#334155' : 'white') : 'transparent', fontWeight: '900', color: activeKidId === id ? THEMES[allUsers[id]?.theme || 'lovely'].primary : '#94a3b8', fontSize: '13px', boxShadow: activeKidId === id ? '0 4px 12px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.3s' }}>
                {THEMES[allUsers[id]?.theme || 'lovely'].icon} {allUsers[id]?.displayName || id}
              </button>
            ))}
          </div>
        </header>

        {/* DATE SELECTOR */}
        <div style={{ background: currentTheme.cardBg, borderRadius: '24px', padding: isMobile ? '15px' : '20px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: `1px solid ${currentTheme.accent}` }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', marginBottom: '15px' }}>
            <button onClick={() => setSelectedDate(subDays(selectedDate, 1))} style={{ background: 'none', border: 'none', color: currentTheme.text }}><ChevronLeft size={24}/></button>
            <div style={{ fontSize: '18px', fontWeight: '900', color: currentTheme.text, display: 'flex', alignItems: 'center', gap: '8px' }}><Calendar size={20} color={currentTheme.primary}/> {format(selectedDate, 'yyyy년 MM월')}</div>
            <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} style={{ background: 'none', border: 'none', color: currentTheme.text }}><ChevronRight size={24}/></button>
          </div>
          <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {weekDays.map(day => (
              <button key={day.toString()} onClick={() => setSelectedDate(day)} style={{ flex: 1, padding: '12px 0', borderRadius: '15px', border: 'none', background: isSameDay(day, selectedDate) ? currentTheme.primary : 'transparent', color: isSameDay(day, selectedDate) ? 'white' : currentTheme.text, fontWeight: '800', minWidth: '45px', transition: 'all 0.3s' }}>
                <div style={{ fontSize: '11px', opacity: 0.7, marginBottom: '2px' }}>{format(day, 'eee', { locale: ko })}</div>
                <div style={{ fontSize: '16px' }}>{format(day, 'd')}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '300px 1fr', gap: '20px' }}>
          {!isMobile && <aside style={{ position: 'sticky', top: '20px', height: 'fit-content' }}><SubjectPalette cloud={cloud} activeKidId={activeKidId} kids={kidsList} onSubjectsChange={() => {}} /></aside>}
          <main><TimeGrid tasks={todayTasks} onUpdateTask={updateTask} onDeleteTask={deleteTask} isAdmin={isAdmin} essentialChecklist={[]} onAddSpecialEvent={() => {}} /></main>
        </div>

        {/* MODALS (With Premium Theme) */}
        {showFamilyManager && isAdmin && (
          <div className="modal-overlay" onClick={() => setShowFamilyManager(false)}>
            <div className="modal-content glass animate-fade-in" onClick={e => e.stopPropagation()} style={{ background: 'white', maxWidth: '450px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}><h2 style={{ fontSize: '20px', fontWeight: '900' }}>가족 & 테마 관리 🏰</h2><button onClick={() => setShowFamilyManager(false)} style={{ border: 'none', background: 'none' }}><CloseIcon /></button></div>
              <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '18px', marginBottom: '20px' }}>
                <div style={{ fontSize: '12px', fontWeight: '800', color: '#64748b' }}>우리 가족 코드 🔑</div>
                <div style={{ fontSize: '22px', fontWeight: '900', color: '#3b82f6', letterSpacing: '2px' }}>{cloud.householdId}</div>
              </div>
              <div style={{ marginBottom: '20px', display: 'grid', gap: '8px' }}>
                <input className="input-field" placeholder="아이 이름" value={newMember.displayName} onChange={e => setNewMember({...newMember, displayName: e.target.value})} />
                <input className="input-field" placeholder="아이디" value={newMember.loginId} onChange={e => setNewMember({...newMember, loginId: e.target.value})} />
                <button onClick={async () => { const next = {...allUsers, [newMember.loginId]: newMember}; await setDoc(doc(cloud.db, 'households', cloud.householdId), { people: next }, { merge: true }); setNewMember({loginId:'', displayName:'', role:'child', theme:'lovely'}) }} className="btn-primary" style={{ background: '#3b82f6' }}>새 아이 등록</button>
              </div>
              <div style={{ display: 'grid', gap: '10px' }}>
                {Object.entries(allUsers).map(([id, p]) => (
                  <div key={id} style={{ padding: '15px', background: '#f8fafc', borderRadius: '15px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                       <span style={{ fontWeight: '900' }}>{p.displayName} ({id})</span>
                       <div style={{ display: 'flex', gap: '4px' }}>
                         {Object.entries(THEMES).map(([tid, t]) => (
                           <button key={tid} onClick={async () => { const next = {...allUsers, [id]: {...p, theme: tid}}; await setDoc(doc(cloud.db, 'households', cloud.householdId), { people: next }, { merge: true }) }} style={{ width: '24px', height: '24px', borderRadius: '8px', background: t.primary, border: p.theme === tid ? '3px solid black' : 'none' }} />
                         ))}
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
      <DragOverlay>{activeDragItem && <div style={{ padding: '12px 20px', background: 'white', borderRadius: '15px', boxShadow: '0 8px 20px rgba(0,0,0,0.15)', fontWeight: '900', borderLeft: `6px solid #ff4d6d` }}>{activeDragItem.type === 'palette' ? activeDragItem.subject.name : activeDragItem.task.name}</div>}</DragOverlay>
    </DndContext>
  )
}

export default Dashboard
