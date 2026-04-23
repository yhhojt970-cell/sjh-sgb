import React, { useEffect, useMemo, useState } from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SubjectPalette } from './SubjectPalette'
import TimeGrid from './TimeGrid'
import { LogOut, Settings, Gift, Trophy, Plus, LayoutGrid, Send, X as CloseIcon, Trash, Calendar, Coins, Check, Users, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, addDays, subDays, startOfWeek, isSameDay, getDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import { arrayUnion, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'

const PRIMARY_PINK = '#ff4d6d'
const LIGHT_PINK = '#fff0f3'
const DEFAULT_DURATION = 50

const buildExpectedEndTime = (startTime, duration = DEFAULT_DURATION) => {
  const [hour, minute] = String(startTime || '00:00').split(':').map(Number)
  const totalMinutes = hour * 60 + minute + duration
  const endHour = Math.floor(totalMinutes / 60) % 24
  const endMinute = totalMinutes % 60
  return `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`
}

function Dashboard({ user = {}, onLogout, allUsers = {}, cloud = {} }) {
  const isCloud = !!cloud?.db && !!cloud?.householdId
  const isAdmin = user?.role === 'admin'
  const [activeKidId, setActiveKidId] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)

  const [tasks, setTasks] = useState([])
  const [messages, setMessages] = useState([])
  const [studyApps, setStudyApps] = useState([])
  const [essentials, setEssentials] = useState([])
  const [rewards, setRewards] = useState([])
  const [spentCoins, setSpentCoins] = useState(0)

  const [showSettings, setShowSettings] = useState(false)
  const [showGoals, setShowGoals] = useState(false)
  const [showAppLauncher, setShowAppLauncher] = useState(false)
  const [showSurprise, setShowSurprise] = useState(false)
  const [showFamilyManager, setShowFamilyManager] = useState(false)
  const [showPalette, setShowPalette] = useState(false)

  const [newReward, setNewReward] = useState({ text: '', coins: 50 })
  const [newEssential, setNewEssential] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [messageTarget, setMessageTarget] = useState('')
  const [replyText, setReplyText] = useState('')
  const [activeDragItem, setActiveDragItem] = useState(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const kidsList = useMemo(() => {
    const priority = ['지희', '손지희', '가빈', '손가빈']

    return Object.entries(allUsers)
      .filter(([, info]) => info?.role === 'child')
      .map(([id]) => id)
      .sort((a, b) => {
        const aName = allUsers[a]?.displayName || allUsers[a]?.name || a
        const bName = allUsers[b]?.displayName || allUsers[b]?.name || b
        return priority.indexOf(aName) - priority.indexOf(bName)
      })
  }, [allUsers])

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!activeKidId && kidsList.length > 0) {
      setActiveKidId(kidsList[0])
    }
  }, [kidsList, activeKidId])

  useEffect(() => {
    if (activeKidId && !kidsList.includes(activeKidId)) {
      setActiveKidId(kidsList[0] || '')
    }
  }, [kidsList, activeKidId])

  useEffect(() => {
    if (!activeKidId || !isCloud) return
    const ref = doc(cloud.db, 'households', cloud.householdId, 'kids', activeKidId)
    return onSnapshot(ref, (snap) => {
      const data = snap.exists() ? snap.data() : {}
      setTasks(Array.isArray(data?.tasks) ? data.tasks : [])
      setRewards(Array.isArray(data?.rewards) ? data.rewards : [])
      setEssentials(Array.isArray(data?.essentials) ? data.essentials : [])
      setSpentCoins(Number(data?.spentCoins || 0))
    })
  }, [activeKidId, isCloud, cloud?.db, cloud?.householdId])

  useEffect(() => {
    if (!isCloud) return
    const unsubMessages = onSnapshot(
      doc(cloud.db, 'households', cloud.householdId, 'meta', 'messages'),
      (snap) => setMessages(snap.exists() ? snap.data().messages || [] : [])
    )
    const unsubApps = onSnapshot(
      doc(cloud.db, 'households', cloud.householdId, 'meta', 'apps'),
      (snap) => setStudyApps(snap.exists() ? snap.data().apps || [] : [])
    )
    return () => {
      unsubMessages()
      unsubApps()
    }
  }, [isCloud, cloud?.db, cloud?.householdId])

  const persistKidState = async (overrides = {}) => {
    if (!isCloud || !activeKidId) return
    await setDoc(
      doc(cloud.db, 'households', cloud.householdId, 'kids', activeKidId),
      {
        tasks,
        rewards,
        essentials,
        spentCoins,
        ...overrides,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    )
  }

  const mergeMetaDoc = async (docId, payload) => {
    if (!isCloud) return
    await setDoc(doc(cloud.db, 'households', cloud.householdId, 'meta', docId), payload, { merge: true })
  }

  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(selectedDate, { weekStartsOn: 1 }), index))
  const todayStr = format(selectedDate, 'yyyy-MM-dd')
  const todayTasks = tasks.filter((task) => (task.type === 'class' && task.weekday === getDay(selectedDate)) || task.date === todayStr)
  const availableCoins = useMemo(() => {
    return tasks
      .filter((task) => task.completed && task.type !== 'class')
      .reduce((sum, task) => sum + (task.coins || (task.type === 'study' ? 1 : 0)), 0) - spentCoins
  }, [tasks, spentCoins])

  const weekMonthReport = useMemo(() => {
    const selectedYear = selectedDate.getFullYear()
    const selectedMonth = selectedDate.getMonth()
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
    const weekStartKey = format(weekStart, 'yyyy-MM-dd')

    const completedTasks = tasks.filter((task) => task.completed && task.type !== 'class' && task.date)

    const weekTasks = completedTasks.filter((task) => {
      const taskDate = new Date(task.date)
      return !Number.isNaN(taskDate.getTime()) && format(startOfWeek(taskDate, { weekStartsOn: 1 }), 'yyyy-MM-dd') === weekStartKey
    })

    const monthTasks = completedTasks.filter((task) => {
      const taskDate = new Date(task.date)
      return !Number.isNaN(taskDate.getTime()) && taskDate.getFullYear() === selectedYear && taskDate.getMonth() === selectedMonth
    })

    return {
      weekCoins: weekTasks.reduce((sum, task) => sum + (task.coins || (task.type === 'study' ? 1 : 0)), 0),
      weekCount: weekTasks.length,
      monthCoins: monthTasks.reduce((sum, task) => sum + (task.coins || (task.type === 'study' ? 1 : 0)), 0),
      monthCount: monthTasks.length
    }
  }, [tasks, selectedDate])

  const todayMessagesForKid = messages.filter((message) => message.date === todayStr && message.kidId === activeKidId)
  const unreadMessage = todayMessagesForKid.find((message) => !message.read)
  const hasReadToday = todayMessagesForKid.some((message) => message.read)

  const getFullName = (id) => allUsers[id]?.displayName || allUsers[id]?.name || id

  const handleSendReply = async () => {
    if (!replyText || !unreadMessage) return
    const nextMessages = messages.map((message) =>
      message.id === unreadMessage.id ? { ...message, reply: replyText, read: true } : message
    )
    await mergeMetaDoc('messages', { messages: nextMessages, updatedAt: serverTimestamp() })
    setReplyText('')
    setShowSurprise(false)
  }

  const addTaskFromPalette = async (hour, subject) => {
    const startTime = `${String(hour).padStart(2, '0')}:00`
    const nextTask = {
      id: Math.random().toString(36).slice(2, 11),
      name: subject.name,
      color: subject.color,
      startTime,
      expectedEndTime: buildExpectedEndTime(startTime, DEFAULT_DURATION),
      duration: DEFAULT_DURATION,
      type: 'study',
      icon: 'Book',
      completed: false,
      date: todayStr,
      coins: subject.coins || 1
    }
    const nextTasks = [...tasks, nextTask]
    setTasks(nextTasks)
    await persistKidState({ tasks: nextTasks })
  }

  const glassStyle = {
    background: 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(15px)',
    WebkitBackdropFilter: 'blur(15px)',
    border: '1px solid rgba(255,255,255,0.3)'
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(event) => {
        const data = event.active.data.current
        if (data?.type === 'palette') {
          setActiveDragItem({ type: 'palette', subject: data.subject })
          if (isMobile) setShowPalette(false)
        }
      }}
      onDragEnd={async (event) => {
        const { over, active } = event
        if (!over) {
          setActiveDragItem(null)
          return
        }

        const data = active.data.current
        if (data?.type === 'palette' && over.id.toString().startsWith('hour-')) {
          await addTaskFromPalette(over.data.current.hour, data.subject)
        }

        setActiveDragItem(null)
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '8px' : '20px' }}>
        <header style={{ ...glassStyle, padding: isMobile ? '12px 15px' : '15px 25px', borderRadius: '20px', marginBottom: '15px', boxShadow: '0 4px 12px rgba(255,77,109,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: isMobile ? '10px' : '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '15px' }}>
              <div onClick={() => unreadMessage && setShowSurprise(true)} style={{ position: 'relative', cursor: unreadMessage ? 'pointer' : 'default' }}>
                <div style={{ width: isMobile ? '42px' : '48px', height: isMobile ? '42px' : '48px', background: unreadMessage ? PRIMARY_PINK : '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: hasReadToday ? '2px solid #42c99b' : 'none' }}>
                  {unreadMessage ? <Gift size={isMobile ? 22 : 24} color="white" /> : hasReadToday ? <Check size={isMobile ? 22 : 24} color="#42c99b" /> : <Gift size={isMobile ? 22 : 24} color="#ccc" />}
                </div>
              </div>
              <div>
                <h1 style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: 900, color: '#333', margin: 0 }}>
                  {getFullName(activeKidId)}
                  <span style={{ fontSize: '12px', color: PRIMARY_PINK, marginLeft: '6px' }}>
                    <Coins size={14} style={{ verticalAlign: 'middle' }} /> {availableCoins}
                  </span>
                </h1>
              </div>
            </div>

            <div style={{ display: 'flex', gap: isMobile ? '4px' : '10px' }}>
              {isAdmin && <button onClick={() => setShowFamilyManager(true)} className="header-btn-original"><Users size={isMobile ? 18 : 22} /></button>}
              {isAdmin && <button onClick={() => setShowAppLauncher(true)} className="header-btn-original"><LayoutGrid size={isMobile ? 18 : 22} /></button>}
              <button onClick={() => setShowGoals(true)} className="header-btn-original"><Trophy size={isMobile ? 18 : 22} /></button>
              <button onClick={() => setShowSettings(true)} className="header-btn-original"><Settings size={isMobile ? 18 : 22} /></button>
              <button onClick={onLogout} className="header-btn-original" style={{ color: PRIMARY_PINK }}><LogOut size={isMobile ? 18 : 22} /></button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '15px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
            {kidsList.map((id) => (
              <button key={id} onClick={() => setActiveKidId(id)} style={{ flexShrink: 0, padding: isMobile ? '8px 18px' : '6px 16px', borderRadius: '12px', border: activeKidId === id ? `2px solid ${PRIMARY_PINK}` : '1px solid #ffdeeb', background: activeKidId === id ? LIGHT_PINK : 'white', fontSize: isMobile ? '14px' : '13px', fontWeight: 'bold', color: activeKidId === id ? PRIMARY_PINK : '#666' }}>
                {getFullName(id)}
              </button>
            ))}
          </div>
        </header>

        <div style={{ ...glassStyle, borderRadius: '24px', padding: isMobile ? '15px' : '20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: isMobile ? '15px' : '20px', marginBottom: '15px' }}>
            <button onClick={() => setSelectedDate(subDays(selectedDate, 1))} style={{ border: 'none', background: 'none', color: PRIMARY_PINK }}><ChevronLeft size={isMobile ? 24 : 28} /></button>
            <div style={{ fontWeight: 900, fontSize: isMobile ? '18px' : '22px', display: 'flex', alignItems: 'center', gap: '8px', color: '#333' }}>
              <Calendar size={20} color={PRIMARY_PINK} /> {format(selectedDate, 'yyyy년 MM월')}
            </div>
            <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} style={{ border: 'none', background: 'none', color: PRIMARY_PINK }}><ChevronRight size={isMobile ? 24 : 28} /></button>
          </div>

          <div style={{ display: 'flex', gap: '4px' }}>
            {weekDays.map((day) => (
              <button key={day.toString()} onClick={() => setSelectedDate(day)} style={{ flex: 1, padding: isMobile ? '10px 0' : '15px 0', borderRadius: '15px', border: 'none', background: isSameDay(day, selectedDate) ? PRIMARY_PINK : 'transparent', color: isSameDay(day, selectedDate) ? 'white' : '#666', fontWeight: 'bold' }}>
                <div style={{ fontSize: '10px', opacity: 0.7 }}>{format(day, 'eee', { locale: ko })}</div>
                <div style={{ fontSize: isMobile ? '16px' : '18px' }}>{format(day, 'd')}</div>
              </button>
            ))}
          </div>
        </div>

        <main style={{ width: '100%' }}>
          {isAdmin && (
            <div style={{ position: 'fixed', bottom: isMobile ? '25px' : '40px', right: isMobile ? '25px' : '40px', zIndex: 100 }}>
              <button onClick={() => setShowPalette(true)} style={{ width: isMobile ? '60px' : '65px', height: isMobile ? '60px' : '65px', borderRadius: '50%', background: PRIMARY_PINK, color: 'white', border: 'none', boxShadow: '0 6px 20px rgba(255,77,109,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={isMobile ? 35 : 40} />
              </button>
            </div>
          )}

          <div style={{ ...glassStyle, borderRadius: '24px', overflow: 'hidden' }}>
            <TimeGrid
              tasks={todayTasks}
              isAdmin={isAdmin}
              isMobile={isMobile}
              essentialChecklist={essentials}
              onUpdateTask={(id, updates) => {
                const nextTasks = tasks.map((task) => (task.id === id ? { ...task, ...updates } : task))
                setTasks(nextTasks)
                persistKidState({ tasks: nextTasks })
              }}
              onDeleteTask={(id) => {
                const nextTasks = tasks.filter((task) => task.id !== id)
                setTasks(nextTasks)
                persistKidState({ tasks: nextTasks })
              }}
              onAddSpecialEvent={(hour) => {
                const name = prompt('특별 일정 이름')
                if (!name) return
                const startTime = `${String(hour).padStart(2, '0')}:00`
                const nextTask = {
                  id: Date.now(),
                  name,
                  startTime,
                  expectedEndTime: buildExpectedEndTime(startTime, 30),
                  duration: 30,
                  type: 'event',
                  icon: 'Star',
                  completed: false,
                  date: todayStr
                }
                const nextTasks = [...tasks, nextTask]
                setTasks(nextTasks)
                persistKidState({ tasks: nextTasks })
              }}
            />
          </div>
        </main>

        {showPalette && (
          <div className="modal-overlay" onClick={() => setShowPalette(false)}>
            <div className="modal-content glass" onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: isMobile ? '24px 24px 0 0' : '24px', padding: '30px', position: isMobile ? 'fixed' : 'relative', bottom: isMobile ? 0 : 'auto', left: isMobile ? 0 : 'auto', right: isMobile ? 0 : 'auto', maxWidth: isMobile ? '100%' : '500px', width: '100%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                <h2 style={{ fontWeight: 900, color: PRIMARY_PINK }}>과목 선택하기</h2>
                <button onClick={() => setShowPalette(false)} style={{ border: 'none', background: 'none' }}><CloseIcon size={28} /></button>
              </div>
              <SubjectPalette cloud={cloud} activeKidId={activeKidId} kids={kidsList} onSubjectsChange={() => {}} isAdmin={isAdmin} />
            </div>
          </div>
        )}

        {showGoals && (
          <div className="modal-overlay" onClick={() => setShowGoals(false)}>
            <div className="modal-content glass" onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '24px', padding: '30px', maxWidth: isMobile ? '95%' : '450px', width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontWeight: 900, color: PRIMARY_PINK }}>코인과 꼭 관리</h2>
                <button onClick={() => setShowGoals(false)} style={{ border: 'none', background: 'none' }}><CloseIcon size={24} /></button>
              </div>

              <div style={{ background: LIGHT_PINK, padding: '20px', borderRadius: '18px', textAlign: 'center', marginBottom: '25px' }}>
                <div style={{ fontSize: '14px', color: PRIMARY_PINK, fontWeight: 'bold', marginBottom: '5px' }}>현재 코인</div>
                <strong style={{ fontSize: '32px' }}>{availableCoins}</strong>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px', marginBottom: '25px' }}>
                <div style={{ background: '#fff7fb', border: '1px solid #ffd9e5', borderRadius: '16px', padding: '14px' }}>
                  <div style={{ fontSize: '12px', color: PRIMARY_PINK, fontWeight: 'bold', marginBottom: '6px' }}>이번 주 리포트</div>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: '#333' }}>{weekMonthReport.weekCoins}</div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{weekMonthReport.weekCount}개 완료</div>
                </div>
                <div style={{ background: '#fffdf3', border: '1px solid #ffe8b1', borderRadius: '16px', padding: '14px' }}>
                  <div style={{ fontSize: '12px', color: '#c47b00', fontWeight: 'bold', marginBottom: '6px' }}>이번 달 리포트</div>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: '#333' }}>{weekMonthReport.monthCoins}</div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{weekMonthReport.monthCount}개 완료</div>
                </div>
              </div>

              {isAdmin && (
                <div style={{ display: 'grid', gap: '20px', marginBottom: '25px' }}>
                  <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '18px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 900, marginBottom: '12px' }}>보상 추가</h3>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                      <input className="input-field" placeholder="보상 이름" value={newReward.text} onChange={(e) => setNewReward({ ...newReward, text: e.target.value })} style={{ flex: 2 }} />
                      <input className="input-field" type="number" placeholder="코인" value={newReward.coins} onChange={(e) => setNewReward({ ...newReward, coins: parseInt(e.target.value, 10) || 0 })} style={{ flex: 1 }} />
                      <button onClick={() => { if (newReward.text) { const nextRewards = [...rewards, { id: Date.now(), ...newReward }]; setRewards(nextRewards); persistKidState({ rewards: nextRewards }); setNewReward({ text: '', coins: 50 }); } }} className="btn-primary" style={{ padding: '12px' }}><Plus /></button>
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '18px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 900, marginBottom: '12px' }}>꼭 할 일</h3>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                      <input className="input-field" placeholder="꼭 할 일 이름" value={newEssential} onChange={(e) => setNewEssential(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newEssential) { const nextEssentials = [...essentials, { id: Date.now(), name: newEssential }]; setEssentials(nextEssentials); persistKidState({ essentials: nextEssentials }); setNewEssential(''); } }} />
                      <button onClick={() => { if (newEssential) { const nextEssentials = [...essentials, { id: Date.now(), name: newEssential }]; setEssentials(nextEssentials); persistKidState({ essentials: nextEssentials }); setNewEssential(''); } }} className="btn-primary" style={{ padding: '12px' }}><Plus /></button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {essentials.map((item) => (
                        <div key={item.id} style={{ background: 'white', padding: '6px 12px', borderRadius: '10px', border: '1px solid #ffdeeb', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {item.name}
                          <Trash size={12} color="#ff4d6d" style={{ cursor: 'pointer' }} onClick={() => { const nextEssentials = essentials.filter((entry) => entry.id !== item.id); setEssentials(nextEssentials); persistKidState({ essentials: nextEssentials }); }} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'grid', gap: '10px' }}>
                {rewards.map((reward) => (
                  <div key={reward.id} style={{ padding: '15px', background: availableCoins >= reward.coins ? LIGHT_PINK : '#f8fafc', borderRadius: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: availableCoins >= reward.coins ? `1px solid ${PRIMARY_PINK}` : '1px solid transparent' }}>
                    <div style={{ flex: 1 }}>
                      <strong style={{ fontSize: '16px' }}>{reward.text}</strong>
                      <div style={{ fontSize: '12px', color: availableCoins >= reward.coins ? PRIMARY_PINK : '#666', fontWeight: 'bold' }}>{reward.coins} 코인</div>
                    </div>
                    {isAdmin && (
                      <button onClick={async () => { const nextSpentCoins = spentCoins + reward.coins; setSpentCoins(nextSpentCoins); await persistKidState({ spentCoins: nextSpentCoins }); }} className="btn-primary" style={{ padding: '8px 15px', fontSize: '13px' }}>
                        지급 완료
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {showAppLauncher && (
          <div className="modal-overlay" onClick={() => setShowAppLauncher(false)}>
            <div className="modal-content glass" onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '24px', padding: '25px', maxWidth: '400px', width: '95%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontWeight: 900, color: PRIMARY_PINK }}>학습 앱</h2>
                <button onClick={() => setShowAppLauncher(false)} style={{ border: 'none', background: 'none' }}><CloseIcon /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                {studyApps.map((app) => (
                  <button key={app.id} onClick={() => window.open(app.url, '_blank')} style={{ aspectRatio: '1/1', background: '#f8fafc', borderRadius: '18px', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px' }}>
                    <div style={{ width: '40px', height: '40px', background: PRIMARY_PINK, borderRadius: '12px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 'bold' }}>{app.name[0]}</div>
                    <div style={{ fontSize: '12px', marginTop: '8px', fontWeight: 'bold' }}>{app.name}</div>
                  </button>
                ))}
                {isAdmin && (
                  <button onClick={async () => { const name = prompt('앱 이름'); const url = prompt('URL (https:// 포함)'); if (name && url) { await mergeMetaDoc('apps', { apps: arrayUnion({ id: Date.now(), name, url }), updatedAt: serverTimestamp() }); } }} style={{ aspectRatio: '1/1', border: '2px dashed #ddd', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white' }}>
                    <Plus color="#999" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {showSettings && (
          <div className="modal-overlay" onClick={() => setShowSettings(false)}>
            <div className="modal-content glass" onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '24px', padding: '30px', maxWidth: '400px', width: '95%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontWeight: 900, color: PRIMARY_PINK }}>설정</h2>
                <button onClick={() => setShowSettings(false)} style={{ border: 'none', background: 'none' }}><CloseIcon /></button>
              </div>
              <div style={{ display: 'grid', gap: '10px' }}>
                <p style={{ fontSize: '14px', color: '#666' }}>현재 기능 복구를 우선해 두었습니다. 로그아웃은 바로 사용할 수 있어요.</p>
                <button onClick={onLogout} className="btn-primary" style={{ background: '#f1f5f9', color: '#ff4d6d' }}>로그아웃</button>
              </div>
            </div>
          </div>
        )}

        {showSurprise && unreadMessage && (
          <div className="modal-overlay" onClick={() => setShowSurprise(false)}>
            <div className="modal-content glass" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', background: 'white', borderRadius: isMobile ? '24px' : '30px', padding: isMobile ? '30px 20px' : '40px', maxWidth: isMobile ? '90%' : '380px' }}>
              <h2 style={{ fontWeight: 900, marginBottom: '15px', color: PRIMARY_PINK, fontSize: isMobile ? '19px' : '22px' }}>메시지가 도착했어요</h2>
              <div style={{ background: '#fff9fb', padding: isMobile ? '20px' : '25px', borderRadius: '18px', marginBottom: '25px', fontWeight: 700, border: `1px dashed ${PRIMARY_PINK}`, color: '#555', fontSize: isMobile ? '16px' : '17px' }}>{unreadMessage.text}</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input className="input-field" placeholder="답장하기" value={replyText} onChange={(e) => setReplyText(e.target.value)} style={{ padding: '12px', borderRadius: '12px' }} onKeyDown={(e) => e.key === 'Enter' && handleSendReply()} />
                <button onClick={handleSendReply} className="btn-primary" style={{ padding: '12px' }}><Send size={20} /></button>
              </div>
            </div>
          </div>
        )}

        {showFamilyManager && isAdmin && (
          <div className="modal-overlay" onClick={() => setShowFamilyManager(false)}>
            <div className="modal-content glass" onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '24px', padding: '25px', maxWidth: isMobile ? '95%' : '450px', width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontWeight: 900, color: PRIMARY_PINK }}>가족 메시지</h2>
                <button onClick={() => setShowFamilyManager(false)} style={{ border: 'none', background: 'none' }}><CloseIcon /></button>
              </div>
              <div style={{ marginBottom: '20px', padding: '15px', background: '#f8fafc', borderRadius: '15px' }}>
                <select className="input-field" value={messageTarget} onChange={(e) => setMessageTarget(e.target.value)} style={{ marginBottom: '8px' }}>
                  <option value="">대상 선택</option>
                  {kidsList.map((id) => <option key={id} value={id}>{getFullName(id)}</option>)}
                </select>
                <textarea className="input-field" placeholder="메시지 입력" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} style={{ height: '70px', marginBottom: '8px' }} />
                <button onClick={async () => { if (newMessage && messageTarget) { await mergeMetaDoc('messages', { messages: arrayUnion({ id: Date.now(), text: newMessage, date: todayStr, kidId: messageTarget, read: false }), updatedAt: serverTimestamp() }); setNewMessage(''); } }} className="btn-primary" style={{ width: '100%' }}>
                  전송
                </button>
              </div>

              <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'grid', gap: '8px' }}>
                {messages.slice().reverse().map((message) => (
                  <div key={message.id} style={{ padding: '10px', background: '#f8fafc', borderRadius: '12px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <strong>{getFullName(message.kidId)}</strong>
                      <span>{message.read ? '읽음' : '안 읽음'}</span>
                    </div>
                    <div>{message.text}</div>
                    {message.reply && <div style={{ marginTop: '5px', color: PRIMARY_PINK, fontWeight: 'bold' }}>답장: {message.reply}</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </DndContext>
  )
}

export default Dashboard
