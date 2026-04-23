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
    name: '러블리 분홍', primary: '#ff4d6d', secondary: '#ff8fa3', bgGradient: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
    sidebarBg: '#fff9fb', cardBg: '#ffffff', text: '#334155', accent: '#ffdeeb', icon: '🌸'
  },
  cute: {
    name: '깜찍 노랑', primary: '#f59e0b', secondary: '#fbbf24', bgGradient: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
    sidebarBg: '#fffbeb', cardBg: '#ffffff', text: '#451a03', accent: '#fef3c7', icon: '🐥'
  },
  clean: {
    name: '깔끔 블루', primary: '#3b82f6', secondary: '#60a5fa', bgGradient: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
    sidebarBg: '#f0f9ff', cardBg: '#ffffff', text: '#1e3a8a', accent: '#dbeafe', icon: '❄️'
  },
  dark: {
    name: '멋진 다크', primary: '#818cf8', secondary: '#6366f1', bgGradient: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    sidebarBg: '#1e293b', cardBg: '#334155', text: '#f8fafc', accent: '#475569', icon: '🌙'
  }
}

const APP_COLORS = ['#ff9a9e', '#a1c4fd', '#84fab0', '#f6d365', '#cfd9df', '#a8edea']

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

  const loadState = (key, def) => { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def } catch { return def } }

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
  const [currentPassword, setCurrentPassword] = useState(''); const [nextPassword, setNextPassword] = useState(''); const [passwordMessage, setPasswordMessage] = useState(''); const [passwordBusy, setPasswordBusy] = useState(false)

  const [activeDragItem, setActiveDragItem] = useState(null)
  const [paletteSubjects, setPaletteSubjects] = useState([])
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const currentTheme = useMemo(() => THEMES[allUsers[activeKidId]?.theme || 'lovely'] || THEMES.lovely, [activeKidId, allUsers])

  useEffect(() => {
    if (!user?.id) return
    const saved = loadState(`activeKid_${user.id}`, user.role === 'child' ? user.id : '')
    if (saved && allUsers[saved]) setActiveKidId(saved)
    else { const kids = Object.keys(allUsers).filter(id => allUsers[id].role === 'child'); if (kids.length > 0) setActiveKidId(kids[0]); else setActiveKidId(user.id) }
  }, [user?.id, allUsers])

  useEffect(() => {
    if (!activeKidId || !isCloud) return
    const ref = doc(cloud.db, 'households', cloud.householdId, 'kids', activeKidId)
    const unsub = onSnapshot(ref, snap => {
      const d = snap.exists() ? snap.data() : {}
      setTasks(d.tasks || []); setGoals(d.goals || []); setEssentials(d.essentials || []); setRewards(d.rewards || []); setSpentCoins(d.spentCoins || 0)
    })
    const metaRef = doc(cloud.db, 'households', cloud.householdId, 'meta', 'messages')
    const unsubMsg = onSnapshot(metaRef, snap => setMessages(snap.exists() ? snap.data().messages || [] : []))
    const appRef = doc(cloud.db, 'households', cloud.householdId, 'meta', 'apps')
    const unsubApp = onSnapshot(appRef, snap => setStudyApps(snap.exists() ? snap.data().apps || [] : []))
    return () => { unsub(); unsubMsg(); unsubApp() }
  }, [activeKidId, isCloud])

  const persist = async (over) => {
    if (!isCloud || !activeKidId) return
    const ref = doc(cloud.db, 'households', cloud.householdId, 'kids', activeKidId)
    await setDoc(ref, { tasks, goals, essentials, rewards, spentCoins, ...over, updatedAt: serverTimestamp() }, { merge: true })
  }

  const applyTaskChange = up => { const next = typeof up === 'function' ? up(tasks) : up; setTasks(next); persist({ tasks: next }) }
  const applyGoalsChange = up => { const next = typeof up === 'function' ? up(goals) : up; setGoals(next); persist({ goals: next }) }
  const applyRewardsChange = up => { const next = typeof up === 'function' ? up(rewards) : up; setRewards(next); persist({ rewards: next }) }

  const redeemReward = r => {
    if (!user.role === 'admin' || !confirm(`[${r.text}] 보상을 증정하고 코인을 차감할까요?`)) return
    const nextSpent = spentCoins + r.coins; setSpentCoins(nextSpent); persist({ spentCoins: nextSpent })
  }

  const addFamilyMember = async () => {
    if (!newMember.loginId || !newMember.displayName) return
    const next = { ...allUsers, [newMember.loginId]: { ...newMember } }
    await setDoc(doc(cloud.db, 'households', cloud.householdId), { people: next, updatedAt: serverTimestamp() }, { merge: true })
    setNewMember({ loginId: '', displayName: '', role: 'child', theme: 'lovely' })
  }

  const changeKidTheme = async (kidId, tid) => {
    const next = { ...allUsers, [kidId]: { ...allUsers[kidId], theme: tid } }
    await setDoc(doc(cloud.db, 'households', cloud.householdId), { people: next, updatedAt: serverTimestamp() }, { merge: true })
  }

  const updateTask = (id, up) => applyTaskChange(prev => prev.map(t => t.id === id ? { ...t, ...up } : t))
  const deleteTask = id => applyTaskChange(prev => prev.filter(t => t.id !== id))
  const addTask = (n, c, s, d, t, i = 'Book') => {
    const [h, m] = s.split(':').map(Number); const total = h * 60 + m + d; const eh = Math.floor(total / 60) % 24; const em = total % 60
    const nt = { id: Math.random().toString(36).substr(2, 9), name: n, color: c, startTime: s, expectedEndTime: `${eh.toString().padStart(2, '0')}:${em.toString().padStart(2, '0')}`, duration: d, type: t, icon: i, completed: false, date: format(selectedDate, 'yyyy-MM-dd'), coins: t === 'event' ? 0 : 1 }
    applyTaskChange(prev => [...prev, nt])
  }

  const isAdmin = user.role === 'admin'
  const kidsList = Object.keys(allUsers).filter(id => allUsers[id].role === 'child')
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(selectedDate, { weekStartsOn: 1 }), i))
  const todayStr = format(selectedDate, 'yyyy-MM-dd')
  const todayTasks = tasks.filter(t => (t.type === 'class' && t.weekday === getDay(selectedDate)) || (t.date === todayStr))
  const unreadMessage = messages.find(m => m.date === todayStr && m.kidId === activeKidId && !m.read)
  const todayMessage = messages.find(m => m.date === todayStr && m.kidId === activeKidId)
  const availableCoins = useMemo(() => tasks.filter(t => t.completed).reduce((s, t) => s + (t.coins || 0), 0) - spentCoins, [tasks, spentCoins])
  const essentialChecklist = essentials.map(e => ({ ...e, completed: todayTasks.some(t => t.completed && (t.name.includes(e.name) || e.name.includes(t.name))) }))

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={e => { const d = e.active.data.current; if (d?.type === 'palette') setActiveDragItem({ type: 'palette', subject: d.subject }); else if (d?.type === 'task') setActiveDragItem({ type: 'task', task: d.task }); }} onDragEnd={e => { const { active, over } = e; if (!over) { setActiveDragItem(null); return }; const d = active.data.current; if (d?.type === 'palette' && over.id.toString().startsWith('hour-')) addTask(d.subject.name, d.subject.color, `${over.data.current.hour.toString().padStart(2, '0')}:00`, 50, 'study'); else if (d?.type === 'task' && over.id.toString().startsWith('hour-')) updateTask(d.task.id, { startTime: `${over.data.current.hour.toString().padStart(2, '0')}:00` }); setActiveDragItem(null); }}>
      <div className="dashboard-shell" style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '8px' : '20px', backgroundColor: currentTheme.sidebarBg, minHeight: '100vh' }}>
        
        <header className="glass" style={{ padding: isMobile ? '8px 12px' : '20px 30px', borderRadius: '18px', marginBottom: '15px', background: currentTheme.cardBg, borderBottom: `2px solid ${currentTheme.accent}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '15px', minWidth: 0, flex: 1 }}>
              <div style={{ position: 'relative', width: isMobile ? '36px' : '48px', height: isMobile ? '36px' : '48px', flexShrink: 0 }}>
                <div style={{ background: currentTheme.bgGradient, color: 'white', width: '100%', height: '100%', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? '18px' : '22px' }}>{currentTheme.icon}</div>
                {unreadMessage && <button onClick={() => { setShowSurprise(true); updateDoc(doc(cloud.db, 'households', cloud.householdId, 'meta', 'messages'), { messages: messages.map(m => m.id === unreadMessage.id ? { ...m, read: true } : m) }) }} className="animate-bounce" style={{ position: 'absolute', top: '-5px', right: '-5px', background: '#ff4d6d', border: 'none', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}><Gift size={10} color="white"/></button>}
              </div>
              <h1 style={{ fontSize: isMobile ? '15px' : '22px', fontWeight: '900', color: currentTheme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{allUsers[activeKidId]?.displayName || activeKidId}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: currentTheme.accent, padding: '4px 10px', borderRadius: '20px' }}>
                <Coins size={14} color={currentTheme.primary} />
                <span style={{ fontSize: '13px', fontWeight: '900', color: currentTheme.text }}>{availableCoins}</span>
              </div>
            </div>

            {/* Mobile-optimized Header Buttons (Horizontal Scrollable) */}
            <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', scrollbarWidth: 'none', padding: '2px 0' }}>
              {isAdmin && <button onClick={() => setShowFamilyManager(true)} className="header-btn" style={{ background: `${currentTheme.primary}15`, color: currentTheme.primary }}><Users size={18}/></button>}
              {isAdmin && <button onClick={() => setShowAppLauncher(true)} className="header-btn" style={{ background: `${currentTheme.primary}15`, color: currentTheme.primary }}><LayoutGrid size={18}/></button>}
              {isAdmin && <button onClick={() => { setShowMessageManager(true); setMessageTarget(activeKidId); }} className="header-btn" style={{ background: '#ff4d6d15', color: '#ff4d6d' }}><Mail size={18}/></button>}
              <button onClick={() => setShowGoals(true)} className="header-btn" style={{ background: `${currentTheme.primary}15`, color: currentTheme.primary }}><Trophy size={18}/></button>
              <button onClick={() => setShowSettings(true)} className="header-btn" style={{ background: 'rgba(0,0,0,0.05)', color: currentTheme.text }}><Settings size={18} /></button>
              <button onClick={onLogout} className="header-btn" style={{ background: 'rgba(244, 63, 94, 0.05)', color: '#f43f5e' }}><LogOut size={18} /></button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '5px', marginTop: '10px', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {kidsList.map(id => (
              <button key={id} onClick={() => setActiveKidId(id)} style={{ flex: '0 0 auto', padding: '6px 12px', borderRadius: '10px', border: 'none', background: activeKidId === id ? (allUsers[id]?.theme === 'dark' ? '#334155' : 'white') : 'rgba(0,0,0,0.03)', fontWeight: '900', color: activeKidId === id ? THEMES[allUsers[id]?.theme || 'lovely']?.primary : '#64748b', fontSize: '12px', boxShadow: activeKidId === id ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}>
                {THEMES[allUsers[id]?.theme || 'lovely']?.icon} {allUsers[id]?.displayName || id}
              </button>
            ))}
          </div>
        </header>

        <div style={{ background: currentTheme.cardBg, borderRadius: '18px', padding: isMobile ? '12px' : '20px', marginBottom: '15px', boxShadow: 'var(--shadow)', border: `1px solid ${currentTheme.accent}` }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginBottom: '12px' }}>
            <button onClick={() => setSelectedDate(subDays(selectedDate, 1))} style={{ background: 'rgba(0,0,0,0.03)', border: 'none', borderRadius: '50%', padding: '6px' }}><ChevronLeft size={18}/></button>
            <div style={{ fontSize: '15px', fontWeight: '900', color: currentTheme.text }}>{format(selectedDate, 'yyyy년 MM월')}</div>
            <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} style={{ background: 'rgba(0,0,0,0.03)', border: 'none', borderRadius: '50%', padding: '6px' }}><ChevronRight size={18}/></button>
          </div>
          <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {weekDays.map(day => (
              <button key={day.toString()} onClick={() => setSelectedDate(day)} style={{ flex: 1, padding: '8px 0', borderRadius: '10px', border: 'none', background: isSameDay(day, selectedDate) ? currentTheme.primary : 'transparent', color: isSameDay(day, selectedDate) ? 'white' : currentTheme.text, fontWeight: '800', minWidth: '40px', textAlign: 'center' }}>
                <div style={{ fontSize: '9px', opacity: 0.7 }}>{format(day, 'eee', { locale: ko })}</div>
                <div style={{ fontSize: '13px' }}>{format(day, 'd')}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '300px 1fr', gap: '15px' }}>
          {!isMobile && <aside className="glass" style={{ background: currentTheme.cardBg, borderRadius: '18px', padding: '15px' }}><SubjectPalette cloud={cloud} activeKidId={activeKidId} kids={kidsList} onSubjectsChange={setPaletteSubjects} /></aside>}
          <main><TimeGrid tasks={todayTasks} onUpdateTask={updateTask} onDeleteTask={deleteTask} isAdmin={isAdmin} essentialChecklist={essentialChecklist} onAddSpecialEvent={addSpecialEvent} /></main>
        </div>

        {/* MODALS */}
        {showFamilyManager && isAdmin && (
          <div className="modal-overlay" onClick={() => setShowFamilyManager(false)}>
            <div className="modal-content glass animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}><h2 style={{ fontSize: '18px', fontWeight: '900' }}>가족 관리</h2><button onClick={() => setShowFamilyManager(false)} style={{ background: 'none', border: 'none' }}><CloseIcon /></button></div>
               <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', marginBottom: '15px' }}>
                 <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748b' }}>가족 코드 (Family ID)</div>
                 <div style={{ fontSize: '18px', fontWeight: '900', color: '#3b82f6' }}>{cloud.householdId}</div>
               </div>
               <div style={{ marginBottom: '15px' }}>
                 <input className="input-field" placeholder="아이 이름" value={newMember.displayName} onChange={e => setNewMember({...newMember, displayName: e.target.value})} style={{ marginBottom: '5px' }} />
                 <input className="input-field" placeholder="로그인 아이디" value={newMember.loginId} onChange={e => setNewMember({...newMember, loginId: e.target.value})} />
                 <button onClick={addFamilyMember} className="btn-primary" style={{ width: '100%', marginTop: '8px' }}>아이 등록하기</button>
               </div>
               <div style={{ display: 'grid', gap: '8px' }}>
                  {Object.entries(allUsers).map(([id, p]) => (
                    <div key={id} style={{ padding: '10px', background: '#f8fafc', borderRadius: '10px', display: 'flex', justifyContent: 'space-between' }}>
                      <div><div style={{ fontWeight: '800', fontSize: '14px' }}>{p.displayName}</div><div style={{ fontSize: '10px', color: '#94a3b8' }}>{id}</div></div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {Object.entries(THEMES).map(([tid, t]) => (
                          <button key={tid} onClick={() => changeKidTheme(id, tid)} style={{ width: '20px', height: '20px', borderRadius: '50%', background: t.primary, border: p.theme === tid ? '2px solid black' : 'none', padding: 0 }} />
                        ))}
                      </div>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        )}

        {showGoals && (
          <div className="modal-overlay" onClick={() => setShowGoals(false)}>
            <div className="modal-content glass" onClick={e => e.stopPropagation()} style={{ background: 'white' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}><h2 style={{ fontSize: '18px', fontWeight: '900' }}>코인 샵</h2><button onClick={() => setShowGoals(false)} style={{ background: 'none', border: 'none' }}><CloseIcon /></button></div>
               <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                 <div style={{ flex: 1, background: '#fffbeb', padding: '10px', borderRadius: '15px', textAlign: 'center' }}><div style={{ fontSize: '10px' }}>내 코인</div><div style={{ fontSize: '20px', fontWeight: '900' }}>{availableCoins}</div></div>
               </div>
               {isAdmin && (
                 <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
                   <input className="input-field" placeholder="보상 내용" value={newReward.text} onChange={e => setNewReward({...newReward, text: e.target.value})} />
                   <input className="input-field" type="number" style={{ width: '60px' }} value={newReward.coins} onChange={e => setNewReward({...newReward, coins: parseInt(e.target.value)})} />
                   <button onClick={() => { applyRewardsChange([...rewards, {id: Date.now(), ...newReward}]); setNewReward({text:'', coins:50}) }} className="btn-primary"><Plus/></button>
                 </div>
               )}
               <div style={{ display: 'grid', gap: '8px' }}>
                 {rewards.map(r => (
                   <div key={r.id} style={{ padding: '12px', background: '#f8fafc', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <div><div style={{ fontWeight: '800' }}>{r.text}</div><div style={{ fontSize: '11px' }}>{r.coins} 코인</div></div>
                     {isAdmin ? <button onClick={() => redeemReward(r)} disabled={availableCoins < r.coins} className="btn-primary" style={{ padding: '5px 10px', fontSize: '12px' }}>증정 완료</button> : <div style={{ fontSize: '11px' }}>{availableCoins >= r.coins ? '구매 가능!' : `${r.coins - availableCoins}개 더 필요`}</div>}
                   </div>
                 ))}
               </div>
            </div>
          </div>
        )}

        {showAppLauncher && (
          <div className="modal-overlay" onClick={() => setShowAppLauncher(false)}>
            <div className="modal-content glass" onClick={e => e.stopPropagation()} style={{ maxWidth: '350px' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}><h2 style={{ fontSize: '18px', fontWeight: '900' }}>학습 센터</h2><button onClick={() => setShowAppLauncher(false)} style={{ border: 'none', background: 'none' }}><CloseIcon /></button></div>
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                 {studyApps.map((a, i) => <button key={a.id} onClick={() => window.open(a.url, '_blank')} style={{ aspectRatio: '1/1', background: 'white', borderRadius: '15px', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}><div style={{ width: '32px', height: '32px', background: APP_COLORS[i % 6], borderRadius: '8px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900' }}>{a.name[0]}</div><div style={{ fontSize: '11px', marginTop: '5px', fontWeight: '800' }}>{a.name}</div></button>)}
                 {isAdmin && <button onClick={addStudyApp} style={{ border: '2px dashed #ddd', borderRadius: '15px', background: 'none' }}><Plus color="#aaa"/></button>}
               </div>
            </div>
          </div>
        )}

        {showMessageManager && isAdmin && (
          <div className="modal-overlay" onClick={() => setShowMessageManager(false)}>
            <div className="modal-content glass" onClick={e => e.stopPropagation()}>
               <h2 style={{ fontSize: '18px', fontWeight: '900', marginBottom: '15px' }}>메시지 전송</h2>
               <div style={{ display: 'grid', gap: '8px' }}>
                 <select className="input-field" value={messageTarget} onChange={e => setMessageTarget(e.target.value)}><option value="">대상 선택</option>{kidsList.map(id => <option key={id} value={id}>{allUsers[id]?.displayName || id}</option>)}</select>
                 <textarea className="input-field" placeholder="메시지 내용" value={newMessage} onChange={e => setNewMessage(e.target.value)} />
                 <button onClick={() => { if(!newMessage || !messageTarget) return; updateDoc(doc(cloud.db, 'households', cloud.householdId, 'meta', 'messages'), { messages: arrayUnion({ id: Date.now(), text: newMessage, date: todayStr, kidId: messageTarget, from: user.id, read: false, replies: [] }) }); setNewMessage(''); setShowMessageManager(false); }} className="btn-primary">전송하기</button>
               </div>
            </div>
          </div>
        )}

        {showSurprise && todayMessage && (
          <div className="modal-overlay" style={{ zIndex: 3000 }} onClick={() => setShowSurprise(false)}>
            <div className="modal-content glass animate-bounce-in" onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
              <div style={{ background: '#ff4d6d', color: 'white', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px' }}><Sparkles size={32}/></div>
              <h2 style={{ fontWeight: '900', marginBottom: '10px' }}>엄마의 깜짝 편지! 💌</h2>
              <div style={{ background: '#fff0f3', padding: '15px', borderRadius: '15px', marginBottom: '15px', color: '#d63384', fontWeight: '700' }}>{todayMessage.text}</div>
              <button onClick={() => setShowSurprise(false)} className="btn-primary">닫기</button>
            </div>
          </div>
        )}

        {showSettings && (
          <div className="modal-overlay" onClick={() => setShowSettings(false)}>
            <div className="modal-content glass" onClick={e => e.stopPropagation()}>
               <h2 style={{ fontWeight: '900', marginBottom: '15px' }}>설정</h2>
               <div style={{ display: 'grid', gap: '8px' }}>
                 <input className="input-field" type="password" placeholder="현재 비밀번호" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
                 <input className="input-field" type="password" placeholder="새 비밀번호" value={nextPassword} onChange={e => setNextPassword(e.target.value)} />
                 <button onClick={submitPasswordChange} className="btn-primary" disabled={passwordBusy}>{passwordBusy ? '변경 중...' : '비밀번호 변경'}</button>
                 {passwordMessage && <div style={{ fontSize: '12px', color: '#ff4d6d' }}>{passwordMessage}</div>}
               </div>
               <button onClick={() => setShowSettings(false)} className="btn-secondary" style={{ width: '100%', marginTop: '15px' }}>닫기</button>
            </div>
          </div>
        )}

      </div>
      <DragOverlay>{activeDragItem && <div style={{ padding: '10px', background: 'white', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontWeight: '900' }}>{activeDragItem.type === 'palette' ? activeDragItem.subject.name : activeDragItem.task.name}</div>}</DragOverlay>
    </DndContext>
  )
}

export default Dashboard
