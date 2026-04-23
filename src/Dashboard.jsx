import React, { useState, useEffect, useMemo, useRef } from 'react'
import { DndContext, DragOverlay, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SubjectPalette } from './SubjectPalette'
import TimeGrid from './TimeGrid'
import { LogOut, Settings, Star, User, ChevronLeft, ChevronRight, Gift, Trophy, Plus, LayoutGrid, Mail, Send, X as CloseIcon, Trash, Sparkles, Calendar, Coins } from 'lucide-react'
import { format, addDays, subDays, startOfWeek, isSameDay, getDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import { doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'

const PRIMARY_PINK = '#ff4d6d'
const LIGHT_PINK = '#fff0f3'
const BORDER_COLOR = '#ffdeeb'

function Dashboard({ user = {}, onLogout, allUsers = {}, cloud = {} }) {
  const isCloud = !!cloud.db && !!cloud.householdId
  const [activeKidId, setActiveKidId] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth <= 768); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h)
  }, [])

  const [tasks, setTasks] = useState([]); const [goals, setGoals] = useState([]); const [messages, setMessages] = useState([]); const [studyApps, setStudyApps] = useState([]); const [essentials, setEssentials] = useState([]); const [rewards, setRewards] = useState([]); const [spentCoins, setSpentCoins] = useState(0)
  const [showSettings, setShowSettings] = useState(false); const [showGoals, setShowGoals] = useState(false); const [showAppLauncher, setShowAppLauncher] = useState(false); const [showSurprise, setShowSurprise] = useState(false); const [showFamilyManager, setShowFamilyManager] = useState(false)
  
  const [newReward, setNewReward] = useState({ text: '', coins: 50 }); const [newMessage, setNewMessage] = useState(''); const [messageTarget, setMessageTarget] = useState('')
  const [activeDragItem, setActiveDragItem] = useState(null); const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  // Ensure activeKidId matches original SJH-SGB names
  useEffect(() => {
    if (!activeKidId && Object.keys(allUsers).length > 0) {
      const kids = Object.keys(allUsers).filter(id => allUsers[id].role === 'child')
      if (kids.length > 0) {
          const sjh = kids.find(k => k.includes('sjh')) || kids[0]
          setActiveKidId(sjh)
      }
    }
  }, [allUsers, activeKidId])

  useEffect(() => {
    if (!activeKidId || !isCloud) return
    const ref = doc(cloud.db, 'households', cloud.householdId, 'kids', activeKidId)
    return onSnapshot(ref, snap => {
      const d = snap.exists() ? snap.data() : {}
      setTasks(d.tasks || []); setRewards(d.rewards || []); setSpentCoins(d.spentCoins || 0)
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
    await setDoc(ref, { tasks, rewards, spentCoins, ...over, updatedAt: serverTimestamp() }, { merge: true })
  }

  const isAdmin = user.role === 'admin'
  const kidsList = Object.keys(allUsers).filter(id => allUsers[id].role === 'child')
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(selectedDate, { weekStartsOn: 1 }), i))
  const todayStr = format(selectedDate, 'yyyy-MM-dd')
  const todayTasks = tasks.filter(t => (t.type === 'class' && t.weekday === getDay(selectedDate)) || (t.date === todayStr))
  
  // COIN SYSTEM
  const availableCoins = useMemo(() => tasks.filter(t => t.completed).reduce((s, t) => s + (t.coins || 0), 0) - spentCoins, [tasks, spentCoins])
  
  // MESSAGE LOGIC
  const unreadMessage = messages.find(m => m.date === todayStr && m.kidId === activeKidId && !m.read)
  const todayMessage = messages.find(m => m.date === todayStr && m.kidId === activeKidId)

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={e => { const d = e.active.data.current; if (d?.type === 'palette') setActiveDragItem({ type: 'palette', subject: d.subject }); else if (d?.type === 'task') setActiveDragItem({ type: 'task', task: d.task }); }} onDragEnd={e => { const { active, over } = e; if (!over) { setActiveDragItem(null); return }; const d = active.data.current; if (d?.type === 'palette' && over.id.toString().startsWith('hour-')) { const startTime = `${over.data.current.hour.toString().padStart(2, '0')}:00`; const nt = { id: Math.random().toString(36).substr(2, 9), name: d.subject.name, color: d.subject.color, startTime, expectedEndTime: '00:00', duration: 50, type: 'study', icon: 'Book', completed: false, date: todayStr, coins: 1 }; const next = [...tasks, nt]; setTasks(next); persist({ tasks: next }) } setActiveDragItem(null); }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '10px' : '20px', minHeight: '100vh', background: '#fff9fb' }}>
        
        {/* ORIGINAL STYLE HEADER */}
        <header style={{ padding: '15px 25px', borderRadius: '20px', marginBottom: '15px', background: 'white', border: `1px solid ${BORDER_COLOR}`, boxShadow: '0 4px 12px rgba(255, 77, 109, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div onClick={() => unreadMessage && setShowSurprise(true)} style={{ position: 'relative', cursor: unreadMessage ? 'pointer' : 'default' }}>
                <div style={{ width: '45px', height: '45px', background: LIGHT_PINK, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   <Star size={24} color={PRIMARY_PINK} fill={unreadMessage ? PRIMARY_PINK : 'none'} />
                </div>
                {unreadMessage && <div style={{ position: 'absolute', top: '-5px', right: '-5px', width: '15px', height: '15px', background: PRIMARY_PINK, borderRadius: '50%', border: '2px solid white' }} />}
              </div>
              <div>
                <h1 style={{ fontSize: '18px', fontWeight: '900', color: '#333' }}>{allUsers[activeKidId]?.displayName || activeKidId} <span style={{fontSize:'12px', color:PRIMARY_PINK, marginLeft:'5px'}}><Coins size={12} style={{verticalAlign:'middle'}}/> {availableCoins}</span></h1>
                <div style={{ display: 'flex', gap: '4px', marginTop: '5px' }}>
                  {kidsList.map(id => (
                    <button key={id} onClick={() => setActiveKidId(id)} style={{ padding: '4px 12px', borderRadius: '8px', border: activeKidId === id ? `2px solid ${PRIMARY_PINK}` : '1px solid #ddd', background: activeKidId === id ? LIGHT_PINK : 'white', fontSize: '11px', fontWeight: 'bold' }}>{allUsers[id]?.displayName || id}</button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {isAdmin && <button onClick={() => setShowFamilyManager(true)} className="header-btn-original"><Users size={20}/></button>}
              <button onClick={() => setShowAppLauncher(true)} className="header-btn-original"><LayoutGrid size={20}/></button>
              <button onClick={() => setShowGoals(true)} className="header-btn-original"><Trophy size={20}/></button>
              <button onClick={() => setShowSettings(true)} className="header-btn-original"><Settings size={20}/></button>
              <button onClick={onLogout} className="header-btn-original" style={{ color: PRIMARY_PINK }}><LogOut size={20}/></button>
            </div>
          </div>
        </header>

        {/* DATE SELECTOR */}
        <div style={{ background: 'white', borderRadius: '20px', padding: '20px', marginBottom: '20px', border: `1px solid ${BORDER_COLOR}` }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', marginBottom: '15px' }}>
            <button onClick={() => setSelectedDate(subDays(selectedDate, 1))} style={{ border: 'none', background: 'none' }}><ChevronLeft size={24}/></button>
            <div style={{ fontWeight: 'bold', fontSize: '18px', display:'flex', alignItems:'center', gap:'8px' }}><Calendar size={18} color={PRIMARY_PINK}/> {format(selectedDate, 'yyyy년 MM월')}</div>
            <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} style={{ border: 'none', background: 'none' }}><ChevronRight size={24}/></button>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {weekDays.map(day => (
              <button key={day.toString()} onClick={() => setSelectedDate(day)} style={{ flex: 1, padding: '12px 0', borderRadius: '15px', border: 'none', background: isSameDay(day, selectedDate) ? PRIMARY_PINK : 'transparent', color: isSameDay(day, selectedDate) ? 'white' : '#333', fontWeight: 'bold' }}>
                <div style={{ fontSize: '10px', opacity: 0.7 }}>{format(day, 'eee', { locale: ko })}</div>
                <div style={{ fontSize: '15px' }}>{format(day, 'd')}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '300px 1fr', gap: '20px' }}>
          {!isMobile && <aside style={{ background: 'white', padding: '20px', borderRadius: '20px', border: `1px solid ${BORDER_COLOR}` }}><SubjectPalette cloud={cloud} activeKidId={activeKidId} kids={kidsList} onSubjectsChange={() => {}} /></aside>}
          <main><TimeGrid tasks={todayTasks} onUpdateTask={(id, up) => { const next = tasks.map(t => t.id === id ? {...t, ...up} : t); setTasks(next); persist({ tasks: next }) }} onDeleteTask={id => { const next = tasks.filter(t => t.id !== id); setTasks(next); persist({ tasks: next }) }} isAdmin={isAdmin} essentialChecklist={[]} onAddSpecialEvent={() => {}} /></main>
        </div>

        {/* RESTORED MODALS */}
        {showGoals && (
           <div className="modal-overlay" onClick={() => setShowGoals(false)}>
             <div className="modal-content" onClick={e => e.stopPropagation()} style={{background:'white', borderRadius:'20px', padding:'25px', maxWidth:'400px'}}>
               <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}><h2 style={{fontWeight:'900', color:PRIMARY_PINK}}>코인 샵 🎁</h2><button onClick={() => setShowGoals(false)} style={{border:'none', background:'none'}}><CloseIcon/></button></div>
               <div style={{background:LIGHT_PINK, padding:'20px', borderRadius:'15px', textAlign:'center', marginBottom:'20px'}}>현재 코인: <strong style={{fontSize:'28px'}}>{availableCoins}</strong></div>
               <div style={{display:'grid', gap:'10px'}}>
                 {rewards.map(r => (
                   <div key={r.id} style={{padding:'15px', background:'#f8fafc', borderRadius:'15px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                     <div><strong style={{fontSize:'16px'}}>{r.text}</strong><div style={{fontSize:'12px', color:'#666'}}>{r.coins} 코인 필요</div></div>
                     {isAdmin && <button onClick={async () => { if(!confirm(`${r.text}를 증정할까요?`)) return; const nextSpent = spentCoins + r.coins; setSpentCoins(nextSpent); await persist({ spentCoins: nextSpent }) }} style={{padding:'8px 15px', background:PRIMARY_PINK, color:'white', border:'none', borderRadius:'10px', fontSize:'12px', fontWeight:'bold'}}>증정 완료</button>}
                   </div>
                 ))}
               </div>
             </div>
           </div>
        )}

        {showSurprise && todayMessage && (
           <div className="modal-overlay" onClick={() => { setShowSurprise(false); updateDoc(doc(cloud.db, 'households', cloud.householdId, 'meta', 'messages'), { messages: messages.map(m => m.id === todayMessage.id ? {...m, read: true} : m) }) }}>
             <div className="modal-content" onClick={e => e.stopPropagation()} style={{textAlign:'center', background:'white', borderRadius:'25px', padding:'40px', maxWidth:'350px'}}>
               <div style={{background:LIGHT_PINK, width:'60px', height:'60px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px'}}><Sparkles size={30} color={PRIMARY_PINK}/></div>
               <h2 style={{fontWeight:'900', marginBottom:'15px', color:PRIMARY_PINK}}>엄마의 편지가 도착했어요!</h2>
               <div style={{background:'#fff9fb', padding:'20px', borderRadius:'15px', marginBottom:'25px', fontWeight:'700', border:`1px dashed ${PRIMARY_PINK}`, color:'#555'}}>{todayMessage.text}</div>
               <button onClick={() => { setShowSurprise(false); updateDoc(doc(cloud.db, 'households', cloud.householdId, 'meta', 'messages'), { messages: messages.map(m => m.id === todayMessage.id ? {...m, read: true} : m) }) }} className="btn-primary" style={{width:'100%', padding:'15px', fontSize:'16px'}}>읽음 확인 ✨</button>
             </div>
           </div>
        )}

      </div>
      <DragOverlay>{activeDragItem && <div style={{ padding: '12px', background: 'white', borderRadius: '12px', borderLeft: `6px solid ${PRIMARY_PINK}`, boxShadow: '0 8px 16px rgba(0,0,0,0.1)', fontWeight: '900' }}>{activeDragItem.type === 'palette' ? activeDragItem.subject.name : activeDragItem.task.name}</div>}</DragOverlay>
    </DndContext>
  )
}

export default Dashboard
