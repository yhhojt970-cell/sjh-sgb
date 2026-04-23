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
  const [showSettings, setShowSettings] = useState(false); const [showGoals, setShowGoals] = useState(false); const [showAppLauncher, setShowAppLauncher] = useState(false); const [showSurprise, setShowSurprise] = useState(false); const [showFamilyManager, setShowFamilyManager] = useState(false); const [showMessageManager, setShowMessageManager] = useState(false); const [showPalette, setShowPalette] = useState(false)
  
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
  }, [activeKidId, isCloud, cloud.householdId])

  useEffect(() => {
    if (!isCloud) return
    const unsubMsg = onSnapshot(doc(cloud.db, 'households', cloud.householdId, 'meta', 'messages'), s => setMessages(s.exists() ? s.data().messages || [] : []))
    const unsubApp = onSnapshot(doc(cloud.db, 'households', cloud.householdId, 'meta', 'apps'), s => setStudyApps(s.exists() ? s.data().apps || [] : []))
    return () => { unsubMsg(); unsubApp(); }
  }, [isCloud, cloud.householdId])

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
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={e => { const d = e.active.data.current; if (d?.type === 'palette') { setActiveDragItem({ type: 'palette', subject: d.subject }); if(isMobile) setShowPalette(false); } else if (d?.type === 'task') setActiveDragItem({ type: 'task', task: d.task }); }} onDragEnd={e => { const { active, over } = e; if (!over) { setActiveDragItem(null); return }; const d = active.data.current; if (d?.type === 'palette' && over.id.toString().startsWith('hour-')) { const startTime = `${over.data.current.hour.toString().padStart(2, '0')}:00`; const nt = { id: Math.random().toString(36).substr(2, 9), name: d.subject.name, color: d.subject.color, startTime, expectedEndTime: '00:00', duration: 50, type: 'study', icon: 'Book', completed: false, date: todayStr, coins: 1 }; const next = [...tasks, nt]; setTasks(next); persist({ tasks: next }) } setActiveDragItem(null); }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '8px' : '20px', minHeight: '100vh', background: '#fff9fb' }}>
        
        <header style={{ padding: isMobile ? '12px 15px' : '15px 25px', borderRadius: '20px', marginBottom: '15px', background: 'white', border: `1px solid ${BORDER_COLOR}`, boxShadow: '0 4px 12px rgba(255, 77, 109, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: isMobile ? '10px' : '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '15px' }}>
              <div onClick={() => unreadMessage && setShowSurprise(true)} style={{ position: 'relative', cursor: unreadMessage ? 'pointer' : 'default' }}>
                <div style={{ width: isMobile ? '42px' : '48px', height: isMobile ? '42px' : '48px', background: unreadMessage ? PRIMARY_PINK : '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: hasReadToday ? '2px solid #42c99b' : 'none' }}>
                   {unreadMessage ? <Gift size={isMobile ? 22 : 24} color="white" /> : hasReadToday ? <Check size={isMobile ? 22 : 24} color="#42c99b" /> : <Mail size={isMobile ? 22 : 24} color="#ccc" />}
                </div>
              </div>
              <div>
                <h1 style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: '900', color: '#333', margin: 0 }}>{allUsers[activeKidId]?.displayName || activeKidId} <span style={{fontSize:'12px', color:PRIMARY_PINK, marginLeft:'5px'}}><Coins size={14} style={{verticalAlign:'middle'}}/> {availableCoins}</span></h1>
              </div>
            </div>

            <div style={{ display: 'flex', gap: isMobile ? '4px' : '10px' }}>
              {isAdmin && <button onClick={() => setShowFamilyManager(true)} className="header-btn-original"><Users size={isMobile ? 18 : 22}/></button>}
              {isAdmin && <button onClick={() => setShowAppLauncher(true)} className="header-btn-original"><LayoutGrid size={isMobile ? 18 : 22}/></button>}
              <button onClick={() => setShowGoals(true)} className="header-btn-original"><Trophy size={isMobile ? 18 : 22}/></button>
              <button onClick={() => setShowSettings(true)} className="header-btn-original"><Settings size={isMobile ? 18 : 22}/></button>
              <button onClick={onLogout} className="header-btn-original" style={{ color: PRIMARY_PINK }}><LogOut size={isMobile ? 18 : 22}/></button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '15px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
            {kidsList.map(id => (
              <button key={id} onClick={() => setActiveKidId(id)} style={{ flexShrink: 0, padding: isMobile ? '8px 18px' : '6px 16px', borderRadius: '12px', border: activeKidId === id ? `2px solid ${PRIMARY_PINK}` : '1px solid #ffdeeb', background: activeKidId === id ? LIGHT_PINK : 'white', fontSize: isMobile ? '14px' : '13px', fontWeight: 'bold', color: activeKidId === id ? PRIMARY_PINK : '#666' }}>{allUsers[id]?.displayName || id}</button>
            ))}
          </div>
        </header>

        {/* DATE SELECTOR */}
        <div style={{ background: 'white', borderRadius: '24px', padding: isMobile ? '15px' : '20px', marginBottom: '20px', border: `1px solid ${BORDER_COLOR}` }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: isMobile ? '15px' : '20px', marginBottom: '15px' }}>
            <button onClick={() => setSelectedDate(subDays(selectedDate, 1))} style={{ border: 'none', background: 'none', color: '#ff4d6d' }}><ChevronLeft size={isMobile ? 24 : 28}/></button>
            <div style={{ fontWeight: '900', fontSize: isMobile ? '18px' : '22px', display:'flex', alignItems:'center', gap:'8px', color: '#333' }}><Calendar size={20} color={PRIMARY_PINK}/> {format(selectedDate, 'yyyy년 MM월')}</div>
            <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} style={{ border: 'none', background: 'none', color: '#ff4d6d' }}><ChevronRight size={isMobile ? 24 : 28}/></button>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {weekDays.map(day => (
              <button key={day.toString()} onClick={() => setSelectedDate(day)} style={{ flex: 1, padding: isMobile ? '10px 0' : '15px 0', borderRadius: '15px', border: 'none', background: isSameDay(day, selectedDate) ? PRIMARY_PINK : 'transparent', color: isSameDay(day, selectedDate) ? 'white' : '#666', fontWeight: 'bold' }}>
                <div style={{ fontSize: '10px', opacity: 0.7 }}>{format(day, 'eee', { locale: ko })}</div>
                <div style={{ fontSize: isMobile ? '16px' : '18px' }}>{format(day, 'd')}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '300px 1fr', gap: '20px', position: 'relative' }}>
          {!isMobile && <aside style={{ background: 'white', padding: '20px', borderRadius: '24px', border: `1px solid ${BORDER_COLOR}` }}><SubjectPalette cloud={cloud} activeKidId={activeKidId} kids={kidsList} onSubjectsChange={() => {}} /></aside>}
          <main>
             {isMobile && (
               <div style={{ position: 'fixed', bottom: '25px', right: '25px', zIndex: 100 }}>
                  <button onClick={() => setShowPalette(true)} style={{ width: '60px', height: '60px', borderRadius: '50%', background: PRIMARY_PINK, color: 'white', border: 'none', boxShadow: '0 6px 20px rgba(255, 77, 109, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                     <Plus size={35} />
                  </button>
               </div>
             )}
             <TimeGrid tasks={todayTasks} onUpdateTask={(id, up) => { const next = tasks.map(t => t.id === id ? {...t, ...up} : t); setTasks(next); persist({ tasks: next }) }} onDeleteTask={id => { const next = tasks.filter(t => t.id !== id); setTasks(next); persist({ tasks: next }) }} isAdmin={isAdmin} essentialChecklist={essentials} onAddSpecialEvent={(h) => { const name = prompt('특별 일정 이름'); if(name) { const nt = { id: Date.now(), name, startTime: `${h.toString().padStart(2, '0')}:00`, expectedEndTime: `${h.toString().padStart(2, '0')}:30`, duration: 30, type: 'event', icon: 'Star', completed: false, date: todayStr }; setTasks([...tasks, nt]); persist({ tasks: [...tasks, nt] }) } }} />
          </main>
        </div>

        {/* MODALS RE-ADDED */}
        {isMobile && showPalette && (
           <div className="modal-overlay" onClick={() => setShowPalette(false)}>
             <div className="modal-content glass" onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '24px 24px 0 0', padding: '30px', position: 'fixed', bottom: 0, left: 0, right: 0, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 -10px 40px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}><h2 style={{ fontWeight: '900', color: PRIMARY_PINK }}>과목 선택하기 🎨</h2><button onClick={() => setShowPalette(false)} style={{ border: 'none', background: 'none' }}><CloseIcon size={28}/></button></div>
                <SubjectPalette cloud={cloud} activeKidId={activeKidId} kids={kidsList} onSubjectsChange={() => {}} />
             </div>
           </div>
        )}

        {showAppLauncher && (
           <div className="modal-overlay" onClick={() => setShowAppLauncher(false)}>
             <div className="modal-content glass" onClick={e => e.stopPropagation()} style={{background:'white', borderRadius:'24px', padding:'25px', maxWidth:'400px', width:'95%'}}>
               <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}><h2 style={{fontWeight:'900', color:PRIMARY_PINK}}>학습 센터 🚀</h2><button onClick={() => setShowAppLauncher(false)} style={{border:'none', background:'none'}}><CloseIcon/></button></div>
               <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'15px'}}>
                 {studyApps.map((a, i) => <button key={a.id} onClick={() => window.open(a.url, '_blank')} style={{aspectRatio:'1/1', background:'#f8fafc', borderRadius:'18px', border:'none', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'10px'}}><div style={{width:'40px', height:'40px', background:PRIMARY_PINK, borderRadius:'12px', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px', fontWeight:'bold'}}>{a.name[0]}</div><div style={{fontSize:'12px', marginTop:'8px', fontWeight:'bold'}}>{a.name}</div></button>)}
                 {isAdmin && <button onClick={() => { const name=prompt('앱 이름'); const url=prompt('URL (https:// 포함)'); if(name && url){ updateDoc(doc(cloud.db, 'households', cloud.householdId, 'meta', 'apps'), { apps: arrayUnion({ id: Date.now(), name, url }) }) } }} style={{aspectRatio:'1/1', border:'2px dashed #ddd', borderRadius:'18px', display:'flex', alignItems:'center', justifyContent:'center'}}><Plus color="#999"/></button>}
               </div>
             </div>
           </div>
        )}

        {showSettings && (
           <div className="modal-overlay" onClick={() => setShowSettings(false)}>
             <div className="modal-content glass" onClick={e => e.stopPropagation()} style={{background:'white', borderRadius:'24px', padding:'30px', maxWidth:'400px', width:'95%'}}>
               <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}><h2 style={{fontWeight:'900', color:PRIMARY_PINK}}>설정 ⚙️</h2><button onClick={() => setShowSettings(false)} style={{border:'none', background:'none'}}><CloseIcon/></button></div>
               <div style={{display:'grid', gap:'10px'}}>
                  <p style={{fontSize:'14px', color:'#666'}}>비밀번호를 변경하거나 프로필 설정을 관리할 수 있습니다.</p>
                  <button onClick={() => alert('비밀번호 변경 기능은 준비 중입니다.')} className="btn-primary">비밀번호 변경</button>
                  <button onClick={onLogout} className="btn-primary" style={{background:'#f1f5f9', color:'#ff4d6d'}}>로그아웃</button>
               </div>
             </div>
           </div>
        )}

        {showSurprise && unreadMessage && (
           <div className="modal-overlay" onClick={() => setShowSurprise(false)}>
             <div className="modal-content glass animate-bounce-in" onClick={e => e.stopPropagation()} style={{textAlign:'center', background:'white', borderRadius:isMobile ? '24px' : '30px', padding:isMobile ? '30px 20px' : '40px', maxWidth:isMobile ? '90%' : '380px'}}>
               <h2 style={{fontWeight:'900', marginBottom:'15px', color:PRIMARY_PINK, fontSize:isMobile ? '19px' : '22px'}}>엄마의 깜짝 편지! 💌</h2>
               <div style={{background:'#fff9fb', padding:isMobile ? '20px' : '25px', borderRadius:'18px', marginBottom:'25px', fontWeight:'700', border:`1px dashed ${PRIMARY_PINK}`, color:'#555', fontSize:isMobile ? '16px' : '17px'}}>{unreadMessage.text}</div>
               <div style={{ display: 'flex', gap: '8px' }}>
                 <input className="input-field" placeholder="답장하기" value={replyText} onChange={e => setReplyText(e.target.value)} style={{ padding: '12px', borderRadius: '12px' }} onKeyDown={e => e.key === 'Enter' && handleSendReply()} />
                 <button onClick={handleSendReply} className="btn-primary" style={{ padding: '12px' }}><Send size={20}/></button>
               </div>
             </div>
           </div>
        )}

        {showGoals && (
           <div className="modal-overlay" onClick={() => setShowGoals(false)}>
             <div className="modal-content" onClick={e => e.stopPropagation()} style={{background:'white', borderRadius:'24px', padding:isMobile ? '25px' : '25px', maxWidth:isMobile ? '95%' : '400px', width:'100%'}}>
               <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}><h2 style={{fontWeight:'900', color:PRIMARY_PINK}}>코인 & 보상 샵 🎁</h2><button onClick={() => setShowGoals(false)} style={{border:'none', background:'none'}}><CloseIcon size={24}/></button></div>
               <div style={{background:LIGHT_PINK, padding:isMobile ? '15px' : '20px', borderRadius:'15px', textAlign:'center', marginBottom:'20px'}}>현재 코인: <strong style={{fontSize:isMobile ? '26px' : '28px'}}>{availableCoins}</strong></div>
               <div style={{maxHeight:'350px', overflowY:'auto', display:'grid', gap:'10px'}}>
                 {rewards.map(r => (
                   <div key={r.id} style={{padding:isMobile ? '12px' : '15px', background:'#f8fafc', borderRadius:'15px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                     <div style={{flex:1}}><strong style={{fontSize:isMobile ? '15px' : '16px'}}>{r.text}</strong><div style={{fontSize:'11px', color: availableCoins >= r.coins ? '#42c99b' : '#666'}}>{r.coins} 코인 {availableCoins >= r.coins ? '(달성!)' : ''}</div></div>
                     {isAdmin && <button onClick={async () => { if(!confirm(`${r.text}를 증정할까요?`)) return; const nextSpent = spentCoins + r.coins; setSpentCoins(nextSpent); await persist({ spentCoins: nextSpent }) }} style={{padding:'7px 14px', background:PRIMARY_PINK, color:'white', border:'none', borderRadius:'10px', fontSize:'12px', fontWeight:'bold', flexShrink:0}}>증정 완료</button>}
                   </div>
                 ))}
               </div>
             </div>
           </div>
        )}

        {showFamilyManager && isAdmin && (
           <div className="modal-overlay" onClick={() => setShowFamilyManager(false)}>
             <div className="modal-content glass" onClick={e => e.stopPropagation()} style={{background:'white', borderRadius:'24px', padding:'25px', maxWidth:isMobile ? '95%' : '450px', width:'100%'}}>
               <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}><h2 style={{fontWeight:'900', color:PRIMARY_PINK}}>가족 & 메시지 🏰</h2><button onClick={() => setShowFamilyManager(false)} style={{border:'none', background:'none'}}><CloseIcon/></button></div>
               <div style={{ marginBottom: '20px', padding: '15px', background: '#f8fafc', borderRadius: '15px' }}>
                 <select className="input-field" value={messageTarget} onChange={e => setMessageTarget(e.target.value)} style={{marginBottom:'8px'}}><option value="">대상 선택</option>{kidsList.map(id => <option key={id} value={id}>{allUsers[id]?.displayName || id}</option>)}</select>
                 <textarea className="input-field" placeholder="메시지 전송" value={newMessage} onChange={e => setNewMessage(e.target.value)} style={{ height: '70px', marginBottom:'8px' }} />
                 <button onClick={() => { if(newMessage && messageTarget){ updateDoc(doc(cloud.db, 'households', cloud.householdId, 'meta', 'messages'), { messages: arrayUnion({ id: Date.now(), text: newMessage, date: todayStr, kidId: messageTarget, read: false }) }); setNewMessage(''); } }} className="btn-primary" style={{width:'100%'}}>전송</button>
               </div>
               <h3 style={{ fontSize: '15px', fontWeight: '900', marginBottom: '10px' }}>메시지 히스토리</h3>
               <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'grid', gap: '8px' }}>
                 {messages.slice().reverse().map(m => (
                   <div key={m.id} style={{ padding: '10px', background: '#f8fafc', borderRadius: '12px', fontSize: '12px' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><strong>{allUsers[m.kidId]?.displayName}</strong> <span>{m.read ? '읽음' : '안읽음'}</span></div>
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
