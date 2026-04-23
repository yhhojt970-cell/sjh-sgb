import React, { useState, useEffect, useMemo, useRef } from 'react'
import { DndContext, DragOverlay, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SubjectPalette } from './SubjectPalette'
import TimeGrid from './TimeGrid'
import { LogOut, Settings, Star, User, ChevronLeft, ChevronRight, Gift, Trophy, Plus, LayoutGrid, Mail, Send, X as CloseIcon, Trash, Sparkles, Calendar, Coins, Award, ShoppingCart, Users, UserPlus, Shield } from 'lucide-react'
import { format, addDays, subDays, startOfWeek, isSameDay, parseISO, getDay, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'
import { ko } from 'date-fns/locale'
import { arrayUnion, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'

// Fixed Colors to match the ORIGINAL style exactly
const PRIMARY_PINK = '#ff4d6d'
const LIGHT_PINK = '#fff0f3'
const BORDER_COLOR = '#ffdeeb'

function Dashboard({ user = {}, onLogout, onChangePassword, allUsers = {}, cloud = {} }) {
  const isCloud = !!cloud.db && !!cloud.householdId
  const [activeKidId, setActiveKidId] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth <= 768); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h)
  }, [])

  const [tasks, setTasks] = useState([]); const [goals, setGoals] = useState([]); const [messages, setMessages] = useState([]); const [studyApps, setStudyApps] = useState([]); const [essentials, setEssentials] = useState([]); const [rewards, setRewards] = useState([]); const [spentCoins, setSpentCoins] = useState(0)
  const [showSettings, setShowSettings] = useState(false); const [showGoals, setShowGoals] = useState(false); const [showMessageManager, setShowMessageManager] = useState(false); const [showAppLauncher, setShowAppLauncher] = useState(false); const [showSurprise, setShowSurprise] = useState(false); const [showFamilyManager, setShowFamilyManager] = useState(false)
  const [newGoal, setNewGoal] = useState(''); const [newReward, setNewReward] = useState({ text: '', coins: 50 }); const [newMessage, setNewMessage] = useState(''); const [replyMessage, setReplyMessage] = useState(''); const [messageDate, setMessageDate] = useState(format(new Date(), 'yyyy-MM-dd')); const [messageTarget, setMessageTarget] = useState(''); const [newMember, setNewMember] = useState({ loginId: '', displayName: '', role: 'child' })
  const [currentPassword, setCurrentPassword] = useState(''); const [nextPassword, setNextPassword] = useState(''); const [passwordMessage, setPasswordMessage] = useState(''); const [passwordBusy, setPasswordBusy] = useState(false)
  
  const [activeDragItem, setActiveDragItem] = useState(null); const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  // Map display names to correct IDs (Son Ji-hee, Son Ga-bin)
  useEffect(() => {
    if (!activeKidId && Object.keys(allUsers).length > 0) {
      const kids = Object.keys(allUsers).filter(id => allUsers[id].role === 'child')
      if (kids.length > 0) setActiveKidId(kids[0])
    }
  }, [allUsers, activeKidId])

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
  const addTask = (n, c, s, d, t, i = 'Book') => {
    const [h, m] = s.split(':').map(Number); const total = h * 60 + m + d; const eh = Math.floor(total / 60) % 24; const em = total % 60
    const nt = { id: Math.random().toString(36).substr(2, 9), name: n, color: c, startTime: s, expectedEndTime: `${eh.toString().padStart(2, '0')}:${em.toString().padStart(2, '0')}`, duration: d, type: t, icon: i, completed: false, date: format(selectedDate, 'yyyy-MM-dd'), coins: t === 'event' ? 0 : 1 }
    const next = [...tasks, nt]; setTasks(next); persist({ tasks: next })
  }

  const isAdmin = user.role === 'admin'
  const kidsList = Object.keys(allUsers).filter(id => allUsers[id].role === 'child')
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(selectedDate, { weekStartsOn: 1 }), i))
  const todayStr = format(selectedDate, 'yyyy-MM-dd')
  const todayTasks = tasks.filter(t => (t.type === 'class' && t.weekday === getDay(selectedDate)) || (t.date === todayStr))
  const availableCoins = useMemo(() => tasks.filter(t => t.completed).reduce((s, t) => s + (t.coins || 0), 0) - spentCoins, [tasks, spentCoins])
  const unreadMessage = messages.find(m => m.date === todayStr && m.kidId === activeKidId && !m.read)
  const todayMessage = messages.find(m => m.date === todayStr && m.kidId === activeKidId)

  const submitPasswordChange = async () => {
    if (!currentPassword || !nextPassword) return setPasswordMessage('모든 항목을 입력해 주세요.')
    setPasswordBusy(true); const res = await onChangePassword(currentPassword, nextPassword); setPasswordMessage(res.message); setPasswordBusy(false)
    if (res.ok) { setCurrentPassword(''); setNextPassword(''); setTimeout(() => setShowSettings(false), 1500) }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={e => { const d = e.active.data.current; if (d?.type === 'palette') setActiveDragItem({ type: 'palette', subject: d.subject }); else if (d?.type === 'task') setActiveDragItem({ type: 'task', task: d.task }); }} onDragEnd={e => { const { active, over } = e; if (!over) { setActiveDragItem(null); return }; const d = active.data.current; if (d?.type === 'palette' && over.id.toString().startsWith('hour-')) addTask(d.subject.name, d.subject.color, `${over.data.current.hour.toString().padStart(2, '0')}:00`, 50, 'study'); setActiveDragItem(null); }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '8px' : '20px', minHeight: '100vh', background: '#fff9fb' }}>
        
        {/* ORIGINAL STYLE HEADER */}
        <header className="glass" style={{ padding: '15px 25px', borderRadius: '20px', marginBottom: '15px', background: 'white', border: `1px solid ${BORDER_COLOR}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ position: 'relative', width: '50px', height: '50px', background: '#ffeef2', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Star size={24} color={PRIMARY_PINK} />
                {unreadMessage && <div style={{ position: 'absolute', top: '-5px', right: '-5px', width: '15px', height: '15px', background: PRIMARY_PINK, borderRadius: '50%', border: '2px solid white' }} />}
              </div>
              <div>
                <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#333' }}>{allUsers[activeKidId]?.displayName || activeKidId}</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px', color: PRIMARY_PINK, fontWeight: 'bold' }}><Coins size={14}/> {availableCoins}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {isAdmin && <button onClick={() => setShowFamilyManager(true)} className="header-btn-original"><Users size={20}/></button>}
              {isAdmin && <button onClick={() => setShowAppLauncher(true)} className="header-btn-original"><LayoutGrid size={20}/></button>}
              <button onClick={() => setShowGoals(true)} className="header-btn-original"><Trophy size={20}/></button>
              <button onClick={() => setShowSettings(true)} className="header-btn-original"><Settings size={20}/></button>
              <button onClick={onLogout} className="header-btn-original" style={{ color: '#ff4d6d' }}><LogOut size={20}/></button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            {kidsList.map(id => (
              <button key={id} onClick={() => setActiveKidId(id)} style={{ padding: '8px 16px', borderRadius: '10px', border: activeKidId === id ? '2px solid #333' : '1px solid #ddd', background: activeKidId === id ? 'white' : '#eee', fontWeight: 'bold', color: '#333' }}>
                {allUsers[id]?.displayName || id}
              </button>
            ))}
          </div>
        </header>

        {/* ORIGINAL DATE SELECTOR */}
        <div style={{ background: 'white', borderRadius: '20px', padding: '20px', marginBottom: '20px', border: `1px solid ${BORDER_COLOR}` }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', marginBottom: '15px' }}>
            <button onClick={() => setSelectedDate(subDays(selectedDate, 1))} style={{ border: 'none', background: 'none' }}><ChevronLeft size={24}/></button>
            <div style={{ fontWeight: 'bold', fontSize: '18px' }}>{format(selectedDate, 'yyyy년 MM월')}</div>
            <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} style={{ border: 'none', background: 'none' }}><ChevronRight size={24}/></button>
          </div>
          <div style={{ display: 'flex', gap: '5px' }}>
            {weekDays.map(day => (
              <button key={day.toString()} onClick={() => setSelectedDate(day)} style={{ flex: 1, padding: '15px 0', borderRadius: '15px', border: 'none', background: isSameDay(day, selectedDate) ? PRIMARY_PINK : 'transparent', color: isSameDay(day, selectedDate) ? 'white' : '#333', fontWeight: 'bold' }}>
                <div style={{ fontSize: '10px', opacity: 0.7 }}>{format(day, 'eee', { locale: ko })}</div>
                <div style={{ fontSize: '16px' }}>{format(day, 'd')}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '300px 1fr', gap: '20px' }}>
          {!isMobile && <aside style={{ background: 'white', padding: '20px', borderRadius: '20px', border: `1px solid ${BORDER_COLOR}` }}><SubjectPalette cloud={cloud} activeKidId={activeKidId} kids={kidsList} onSubjectsChange={() => {}} /></aside>}
          <main><TimeGrid tasks={todayTasks} onUpdateTask={updateTask} onDeleteTask={deleteTask} isAdmin={isAdmin} essentialChecklist={[]} onAddSpecialEvent={() => {}} /></main>
        </div>

        {/* MODALS (Functionality Restored) */}
        {showFamilyManager && isAdmin && (
          <div className="modal-overlay" onClick={() => setShowFamilyManager(false)}>
            <div className="modal-content glass animate-fade-in" onClick={e => e.stopPropagation()} style={{ background: 'white', maxWidth: '400px', padding: '25px', borderRadius: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}><h2 style={{ fontWeight: '900' }}>가족 관리</h2><button onClick={() => setShowFamilyManager(false)} style={{ border: 'none', background: 'none' }}><CloseIcon /></button></div>
              <div style={{ background: LIGHT_PINK, padding: '15px', borderRadius: '12px', marginBottom: '20px' }}>우리 가족 코드: <strong style={{color: PRIMARY_PINK}}>{cloud.householdId}</strong></div>
              <div style={{ display: 'grid', gap: '10px' }}>
                 {Object.entries(allUsers).map(([id, p]) => (
                   <div key={id} style={{ padding: '12px', background: '#f8fafc', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <div><strong>{p.displayName}</strong> <span style={{fontSize:'12px', color:'#999'}}>({id})</span></div>
                     {id !== user.id && <button onClick={async () => { const {[id]:_, ...rem} = allUsers; await setDoc(doc(cloud.db, 'households', cloud.householdId), { people: rem }, { merge: true }) }} style={{color:'red', border:'none', background:'none'}}><Trash size={16}/></button>}
                   </div>
                 ))}
                 <div style={{ borderTop: '1px solid #eee', marginTop: '10px', paddingTop: '10px' }}>
                    <input className="input-field" placeholder="아이 이름" value={newMember.displayName} onChange={e => setNewMember({...newMember, displayName: e.target.value})} style={{marginBottom:'5px'}} />
                    <input className="input-field" placeholder="로그인 아이디" value={newMember.loginId} onChange={e => setNewMember({...newMember, loginId: e.target.value})} />
                    <button onClick={async () => { const next = {...allUsers, [newMember.loginId]: newMember}; await setDoc(doc(cloud.db, 'households', cloud.householdId), { people: next }, { merge: true }); setNewMember({loginId:'', displayName:'', role:'child'}) }} className="btn-primary" style={{width:'100%', marginTop:'10px'}}>아이 추가</button>
                 </div>
              </div>
            </div>
          </div>
        )}

        {showGoals && (
           <div className="modal-overlay" onClick={() => setShowGoals(false)}>
             <div className="modal-content glass" onClick={e => e.stopPropagation()} style={{background:'white', borderRadius:'20px', padding:'25px'}}>
               <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}><h2 style={{fontWeight:'900', color:PRIMARY_PINK}}>코인 & 보상 관리</h2><button onClick={() => setShowGoals(false)} style={{border:'none', background:'none'}}><CloseIcon/></button></div>
               <div style={{background:LIGHT_PINK, padding:'15px', borderRadius:'15px', textAlign:'center', marginBottom:'20px'}}>내 코인: <strong style={{fontSize:'24px'}}>{availableCoins}</strong></div>
               <div style={{display:'grid', gap:'10px'}}>
                 {rewards.map(r => (
                   <div key={r.id} style={{padding:'15px', background:'#f8fafc', borderRadius:'15px', display:'flex', justifyContent:'space-between'}}>
                     <div><strong>{r.text}</strong><div>{r.coins} 코인</div></div>
                     {isAdmin && <button onClick={async () => { if(!confirm('코인을 차감할까요?')) return; const nextSpent = spentCoins + r.coins; setSpentCoins(nextSpent); await setDoc(doc(cloud.db, 'households', cloud.householdId, 'kids', activeKidId), { spentCoins: nextSpent }, { merge: true }) }} className="btn-primary" style={{padding:'5px 10px'}}>증정 완료</button>}
                   </div>
                 ))}
                 {isAdmin && (
                    <div style={{display:'flex', gap:'5px', marginTop:'10px'}}>
                       <input className="input-field" placeholder="보상 내용" value={newReward.text} onChange={e => setNewReward({...newReward, text: e.target.value})} />
                       <input className="input-field" type="number" style={{width:'60px'}} value={newReward.coins} onChange={e => setNewReward({...newReward, coins: parseInt(e.target.value)})} />
                       <button onClick={() => { const next = [...rewards, {id:Date.now(), ...newReward}]; setRewards(next); persist({rewards: next}); setNewReward({text:'', coins:50}) }} className="btn-primary"><Plus/></button>
                    </div>
                 )}
               </div>
             </div>
           </div>
        )}

        {showAppLauncher && (
           <div className="modal-overlay" onClick={() => setShowAppLauncher(false)}>
             <div className="modal-content glass" onClick={e => e.stopPropagation()} style={{background:'white', borderRadius:'20px', padding:'25px'}}>
               <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}><h2 style={{fontWeight:'900'}}>학습 센터</h2><button onClick={() => setShowAppLauncher(false)} style={{border:'none', background:'none'}}><CloseIcon/></button></div>
               <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'15px'}}>
                 {studyApps.map((a, i) => <button key={a.id} onClick={() => window.open(a.url, '_blank')} style={{aspectRatio:'1/1', background:'#f8fafc', border:'none', borderRadius:'15px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center'}}><div style={{width:'32px', height:'32px', background:APP_COLORS[i%6], borderRadius:'8px', color:'white', display:'flex', alignItems:'center', justifyContent:'center'}}>{a.name[0]}</div><div style={{fontSize:'12px', marginTop:'5px'}}>{a.name}</div></button>)}
                 {isAdmin && <button onClick={() => { const name=prompt('이름'); const url=prompt('URL'); if(name && url) { const next=[...studyApps, {id:Date.now(), name, url}]; setStudyApps(next); updateDoc(doc(cloud.db, 'households', cloud.householdId, 'meta', 'apps'), {apps:next}) } }} style={{border:'2px dashed #ddd', borderRadius:'15px', background:'none'}}><Plus color="#aaa"/></button>}
               </div>
             </div>
           </div>
        )}

        {showSettings && (
          <div className="modal-overlay" onClick={() => setShowSettings(false)}>
            <div className="modal-content glass" onClick={e => e.stopPropagation()} style={{background:'white', borderRadius:'20px', padding:'25px'}}>
               <h2 style={{ fontWeight: '900', marginBottom: '20px' }}>설정</h2>
               <div style={{ display: 'grid', gap: '10px' }}>
                 <input className="input-field" type="password" placeholder="현재 비밀번호" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
                 <input className="input-field" type="password" placeholder="새 비밀번호" value={nextPassword} onChange={e => setNextPassword(e.target.value)} />
                 <button onClick={submitPasswordChange} className="btn-primary" disabled={passwordBusy}>{passwordBusy ? '변경 중...' : '비밀번호 변경'}</button>
                 {passwordMessage && <div style={{ fontSize: '12px', color: PRIMARY_PINK }}>{passwordMessage}</div>}
               </div>
            </div>
          </div>
        )}

        {showSurprise && todayMessage && (
           <div className="modal-overlay" onClick={() => setShowSurprise(false)}>
             <div className="modal-content glass" onClick={e => e.stopPropagation()} style={{textAlign:'center', background:'white', borderRadius:'20px', padding:'30px'}}>
               <h2 style={{color:PRIMARY_PINK, fontWeight:'900', marginBottom:'15px'}}>엄마의 편지 💌</h2>
               <div style={{background:LIGHT_PINK, padding:'20px', borderRadius:'15px', marginBottom:'20px', fontWeight:'700'}}>{todayMessage.text}</div>
               <button onClick={() => setShowSurprise(false)} className="btn-primary" style={{width:'100%'}}>확인</button>
             </div>
           </div>
        )}

      </div>
      <DragOverlay>{activeDragItem && <div style={{ padding: '12px', background: 'white', borderRadius: '12px', borderLeft: `6px solid ${PRIMARY_PINK}`, boxShadow: '0 8px 16px rgba(0,0,0,0.1)', fontWeight: '900' }}>{activeDragItem.type === 'palette' ? activeDragItem.subject.name : activeDragItem.task.name}</div>}</DragOverlay>
    </DndContext>
  )
}

export default Dashboard
