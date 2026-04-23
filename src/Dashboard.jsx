import React, { useState, useEffect, useMemo, useRef } from 'react'
import { DndContext, DragOverlay, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SubjectPalette } from './SubjectPalette'
import TimeGrid from './TimeGrid'
import { LogOut, Settings, Star, User, ChevronLeft, ChevronRight, Gift, Trophy, Plus, LayoutGrid, Mail, Send, X as CloseIcon, Trash, Sparkles, Calendar, Coins, Check, Users } from 'lucide-react'
import { format, addDays, subDays, startOfWeek, isSameDay, getDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import { doc, onSnapshot, serverTimestamp, setDoc, updateDoc, arrayUnion } from 'firebase/firestore'

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
  const [showSettings, setShowSettings] = useState(false); const [showGoals, setShowGoals] = useState(false); const [showAppLauncher, setShowAppLauncher] = useState(false); const [showSurprise, setShowSurprise] = useState(false); const [showFamilyManager, setShowFamilyManager] = useState(false); const [showMessageManager, setShowMessageManager] = useState(false)
  
  const [newReward, setNewReward] = useState({ text: '', coins: 50 }); const [newMessage, setNewMessage] = useState(''); const [messageTarget, setMessageTarget] = useState(''); const [replyText, setReplyText] = useState('')
  const [activeDragItem, setActiveDragItem] = useState(null); const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const kidsList = useMemo(() => Object.keys(allUsers).filter(id => allUsers[id].role === 'child'), [allUsers])

  useEffect(() => {
    if (!activeKidId && kidsList.length > 0) {
      const sjh = kidsList.find(k => k.includes('sjh') || k.includes('손지희')) || kidsList[0]
      setActiveKidId(sjh)
    }
  }, [kidsList, activeKidId])

  useEffect(() => {
    if (!activeKidId || !isCloud) return
    const ref = doc(cloud.db, 'households', cloud.householdId, 'kids', activeKidId)
    return onSnapshot(ref, snap => {
      const d = snap.exists() ? snap.data() : {}
      setTasks(d.tasks || []); setRewards(d.rewards || []); setSpentCoins(d.spentCoins || 0); setEssentials(d.essentials || [])
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
    await setDoc(ref, { tasks, rewards, spentCoins, essentials, ...over, updatedAt: serverTimestamp() }, { merge: true })
  }

  const isAdmin = user.role === 'admin'
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(selectedDate, { weekStartsOn: 1 }), i))
  const todayStr = format(selectedDate, 'yyyy-MM-dd')
  const todayTasks = tasks.filter(t => (t.type === 'class' && t.weekday === getDay(selectedDate)) || (t.date === todayStr))
  const availableCoins = useMemo(() => tasks.filter(t => t.completed).reduce((s, t) => s + (t.coins || 0), 0) - spentCoins, [tasks, spentCoins])
  
  // SMART MESSAGE ICON LOGIC
  const todayMessagesForActiveKid = messages.filter(m => m.date === todayStr && m.kidId === activeKidId)
  const unreadMessage = todayMessagesForActiveKid.find(m => !m.read)
  const hasReadToday = todayMessagesForActiveKid.some(m => m.read)

  const handleSendReply = async () => {
    if (!replyText || !unreadMessage) return
    const next = messages.map(m => m.id === unreadMessage.id ? { ...m, reply: replyText, read: true } : m)
    await updateDoc(doc(cloud.db, 'households', cloud.householdId, 'meta', 'messages'), { messages: next })
    setReplyText(''); setShowSurprise(false)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={e => { const d = e.active.data.current; if (d?.type === 'palette') setActiveDragItem({ type: 'palette', subject: d.subject }); else if (d?.type === 'task') setActiveDragItem({ type: 'task', task: d.task }); }} onDragEnd={e => { const { active, over } = e; if (!over) { setActiveDragItem(null); return }; const d = active.data.current; if (d?.type === 'palette' && over.id.toString().startsWith('hour-')) { const startTime = `${over.data.current.hour.toString().padStart(2, '0')}:00`; const nt = { id: Math.random().toString(36).substr(2, 9), name: d.subject.name, color: d.subject.color, startTime, expectedEndTime: '00:00', duration: 50, type: 'study', icon: 'Book', completed: false, date: todayStr, coins: 1 }; const next = [...tasks, nt]; setTasks(next); persist({ tasks: next }) } setActiveDragItem(null); }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '10px' : '20px', minHeight: '100vh', background: '#fff9fb' }}>
        
        {/* HEADER WITH CIRCLE GIFT ICON */}
        <header style={{ padding: '15px 25px', borderRadius: '20px', marginBottom: '15px', background: 'white', border: `1px solid ${BORDER_COLOR}`, boxShadow: '0 4px 12px rgba(255, 77, 109, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div onClick={() => unreadMessage && setShowSurprise(true)} style={{ position: 'relative', cursor: unreadMessage ? 'pointer' : 'default' }}>
                <div style={{ width: '48px', height: '48px', background: unreadMessage ? PRIMARY_PINK : '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s ease' }}>
                   {unreadMessage ? <Gift size={24} color="white" /> : hasReadToday ? <Check size={24} color="#42c99b" /> : <Mail size={24} color="#ccc" />}
                </div>
                {unreadMessage && <div style={{ position: 'absolute', top: '0', right: '0', width: '14px', height: '14px', background: '#42c99b', borderRadius: '50%', border: '2px solid white' }} />}
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
              {isAdmin && <button onClick={() => setShowAppLauncher(true)} className="header-btn-original"><LayoutGrid size={20}/></button>}
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
          <main><TimeGrid tasks={todayTasks} onUpdateTask={(id, up) => { const next = tasks.map(t => t.id === id ? {...t, ...up} : t); setTasks(next); persist({ tasks: next }) }} onDeleteTask={id => { const next = tasks.filter(t => t.id !== id); setTasks(next); persist({ tasks: next }) }} isAdmin={isAdmin} essentialChecklist={essentials} onAddSpecialEvent={(h) => { const name = prompt('특별 일정 이름'); if(name) { const nt = { id: Date.now(), name, startTime: `${h.toString().padStart(2, '0')}:00`, expectedEndTime: `${h.toString().padStart(2, '0')}:30`, duration: 30, type: 'event', icon: 'Star', completed: false, date: todayStr }; setTasks([...tasks, nt]); persist({ tasks: [...tasks, nt] }) } }} /></main>
        </div>

        {/* MESSAGES WITH REPLIES AND HISTORY */}
        {showSurprise && unreadMessage && (
           <div className="modal-overlay" onClick={() => setShowSurprise(false)}>
             <div className="modal-content glass animate-bounce-in" onClick={e => e.stopPropagation()} style={{textAlign:'center', background:'white', borderRadius:'30px', padding:'40px', maxWidth:'380px'}}>
               <div style={{background:LIGHT_PINK, width:'70px', height:'70px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px'}}><Sparkles size={35} color={PRIMARY_PINK}/></div>
               <h2 style={{fontWeight:'900', marginBottom:'15px', color:PRIMARY_PINK}}>엄마의 깜짝 편지! 💌</h2>
               <div style={{background:'#fff9fb', padding:'25px', borderRadius:'18px', marginBottom:'20px', fontWeight:'700', border:`1px dashed ${PRIMARY_PINK}`, color:'#555', fontSize:'17px'}}>{unreadMessage.text}</div>
               <div style={{ marginBottom: '20px' }}>
                  <input className="input-field" placeholder="엄마에게 답장하기 (예: 사랑해요!)" value={replyText} onChange={e => setReplyText(e.target.value)} style={{ padding: '12px', borderRadius: '12px' }} onKeyDown={e => e.key === 'Enter' && handleSendReply()} />
               </div>
               <button onClick={handleSendReply} className="btn-primary" style={{width:'100%', padding:'15px', fontSize:'18px'}}>답장 보내고 확인 ✨</button>
             </div>
           </div>
        )}

        {showGoals && (
           <div className="modal-overlay" onClick={() => setShowGoals(false)}>
             <div className="modal-content" onClick={e => e.stopPropagation()} style={{background:'white', borderRadius:'20px', padding:'25px', maxWidth:'400px'}}>
               <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}><h2 style={{fontWeight:'900', color:PRIMARY_PINK}}>코인 & 보상 샵 🎁</h2><button onClick={() => setShowGoals(false)} style={{border:'none', background:'none'}}><CloseIcon/></button></div>
               <div style={{background:LIGHT_PINK, padding:'20px', borderRadius:'15px', textAlign:'center', marginBottom:'20px'}}>현재 코인: <strong style={{fontSize:'28px'}}>{availableCoins}</strong></div>
               
               {isAdmin && (
                 <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(255, 77, 109, 0.05)', borderRadius: '18px' }}>
                   <h3 style={{ fontSize: '14px', fontWeight: '900', color: PRIMARY_PINK, marginBottom: '10px' }}>꼭! 해야할 공부 관리</h3>
                   <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
                     <input className="input-field" placeholder="공부 이름" onKeyDown={e => { if(e.key === 'Enter' && e.target.value){ const next=[...essentials, {id:Date.now(), name:e.target.value}]; setEssentials(next); persist({essentials:next}); e.target.value='' } }} />
                   </div>
                   <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                     {essentials.map(e => <div key={e.id} style={{ background: 'white', padding: '5px 10px', borderRadius: '10px', border: '1px solid #ffdeeb', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>{e.name} <Trash size={12} onClick={() => { const next=essentials.filter(i => i.id !== e.id); setEssentials(next); persist({essentials:next}) }} /></div>)}
                   </div>
                 </div>
               )}

               <div style={{display:'grid', gap:'10px'}}>
                 {rewards.map(r => (
                   <div key={r.id} style={{padding:'15px', background:'#f8fafc', borderRadius:'15px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                     <div><strong style={{fontSize:'16px'}}>{r.text}</strong><div style={{fontSize:'12px', color: availableCoins >= r.coins ? '#42c99b' : '#666'}}>{r.coins} 코인 {availableCoins >= r.coins ? '(달성!)' : ''}</div></div>
                     {isAdmin && <button onClick={async () => { if(!confirm(`${r.text}를 증정할까요?`)) return; const nextSpent = spentCoins + r.coins; setSpentCoins(nextSpent); await persist({ spentCoins: nextSpent }) }} style={{padding:'8px 15px', background:PRIMARY_PINK, color:'white', border:'none', borderRadius:'10px', fontSize:'12px', fontWeight:'bold'}}>증정 완료</button>}
                   </div>
                 ))}
                 {isAdmin && (
                    <div style={{display:'flex', gap:'5px', marginTop:'10px'}}>
                       <input className="input-field" placeholder="보상 내용" value={newReward.text} onChange={e => setNewReward({...newReward, text: e.target.value})} />
                       <input className="input-field" type="number" style={{width:'60px'}} value={newReward.coins} onChange={e => setNewReward({...newReward, coins: parseInt(e.target.value)})} />
                       <button onClick={() => { if(newReward.text){ const next=[...rewards, {id:Date.now(), ...newReward}]; setRewards(next); persist({rewards:next}); setNewReward({text:'', coins:50}) } }} className="btn-primary"><Plus/></button>
                    </div>
                 )}
               </div>
             </div>
           </div>
        )}

        {showFamilyManager && isAdmin && (
           <div className="modal-overlay" onClick={() => setShowFamilyManager(false)}>
             <div className="modal-content glass" onClick={e => e.stopPropagation()} style={{background:'white', borderRadius:'24px', padding:'30px', maxWidth:'400px', width:'100%'}}>
               <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}><h2 style={{fontWeight:'900', color:PRIMARY_PINK}}>가족 & 메시지 관리 🏰</h2><button onClick={() => setShowFamilyManager(false)} style={{border:'none', background:'none'}}><CloseIcon/></button></div>
               
               <div style={{ marginBottom: '20px', padding: '15px', background: '#f8fafc', borderRadius: '15px' }}>
                 <h3 style={{ fontSize: '15px', fontWeight: '900', marginBottom: '10px' }}>메시지 보내기</h3>
                 <div style={{ display: 'grid', gap: '8px' }}>
                   <select className="input-field" value={messageTarget} onChange={e => setMessageTarget(e.target.value)}><option value="">대상 선택</option>{kidsList.map(id => <option key={id} value={id}>{allUsers[id]?.displayName || id}</option>)}</select>
                   <textarea className="input-field" placeholder="전할 말" value={newMessage} onChange={e => setNewMessage(e.target.value)} style={{ height: '80px' }} />
                   <button onClick={() => { if(newMessage && messageTarget){ updateDoc(doc(cloud.db, 'households', cloud.householdId, 'meta', 'messages'), { messages: arrayUnion({ id: Date.now(), text: newMessage, date: todayStr, kidId: messageTarget, read: false }) }); setNewMessage(''); } }} className="btn-primary">전송</button>
                 </div>
               </div>

               <h3 style={{ fontSize: '15px', fontWeight: '900', marginBottom: '10px' }}>전송 히스토리</h3>
               <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'grid', gap: '8px' }}>
                 {messages.slice().reverse().map(m => (
                   <div key={m.id} style={{ padding: '10px', background: '#f8fafc', borderRadius: '10px', fontSize: '12px' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><strong>{allUsers[m.kidId]?.displayName}에게</strong> <span style={{ color: m.read ? '#42c99b' : '#ff4d6d' }}>{m.read ? '읽음' : '안읽음'}</span></div>
                     <div>{m.text}</div>
                     {m.reply && <div style={{ marginTop: '5px', color: PRIMARY_PINK, fontWeight: 'bold' }}>↳ 답장: {m.reply}</div>}
                   </div>
                 ))}
               </div>
             </div>
           </div>
        )}

      </div>
      <DragOverlay>{activeDragItem && <div style={{ padding: '12px', background: 'white', borderRadius: '12px', borderLeft: `6px solid ${PRIMARY_PINK}`, boxShadow: '0 8px 16px rgba(0,0,0,0.1)', fontWeight: '900' }}>{activeDragItem.type === 'palette' ? activeDragItem.subject.name : activeDragItem.task.name}</div>}</DragOverlay>
    </DndContext>
  )
}

export default Dashboard
