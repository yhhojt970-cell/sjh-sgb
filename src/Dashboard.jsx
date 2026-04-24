import React, { useEffect, useMemo, useState } from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SubjectPalette } from './SubjectPalette'
import TimeGrid from './TimeGrid'
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Coins,
  Gift,
  LayoutGrid,
  LogOut,
  Plus,
  Send,
  Settings,
  Trash,
  Trophy,
  Users,
  X as CloseIcon
} from 'lucide-react'
import { addDays, format, getDay, isSameDay, startOfWeek, subDays } from 'date-fns'
import { ko } from 'date-fns/locale'
import { arrayUnion, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'

const PRIMARY_PINK = '#ff4d6d'
const LIGHT_PINK = '#fff0f3'
const DEFAULT_DURATION = 50

const buildExpectedEndTime = (startTime, duration = DEFAULT_DURATION) => {
  const [hour, minute] = String(startTime || '00:00').split(':').map(Number)
  const total = hour * 60 + minute + duration
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

const parseWeekday = (raw) => {
  const value = String(raw || '').trim().toLowerCase()
  const map = {
    sun: 0, sunday: 0, '일': 0, '일요일': 0, '0': 0,
    mon: 1, monday: 1, '월': 1, '월요일': 1, '1': 1,
    tue: 2, tuesday: 2, '화': 2, '화요일': 2, '2': 2,
    wed: 3, wednesday: 3, '수': 3, '수요일': 3, '3': 3,
    thu: 4, thursday: 4, '목': 4, '목요일': 4, '4': 4,
    fri: 5, friday: 5, '금': 5, '금요일': 5, '5': 5,
    sat: 6, saturday: 6, '토': 6, '토요일': 6, '6': 6
  }
  return map[value]
}

function Dashboard({ user = {}, onLogout, allUsers = {}, cloud = {} }) {
  const isCloud = !!cloud?.db && !!cloud?.householdId
  const isAdmin = user?.role === 'admin' || user?.id === '엄마' || user?.loginId === 'yhhojt970'

  const [activeKidId, setActiveKidId] = useState('')
  const [resolvedKidDocId, setResolvedKidDocId] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

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
  const [showClassManager, setShowClassManager] = useState(false)

  const [newReward, setNewReward] = useState({ text: '', coins: 50 })
  const [newEssential, setNewEssential] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [messageTarget, setMessageTarget] = useState('')
  const [replyText, setReplyText] = useState('')
  const [bulkInput, setBulkInput] = useState('')
  const [activeDragItem, setActiveDragItem] = useState(null)

  const kidsList = useMemo(
    () => Object.entries(allUsers).filter(([, info]) => info?.role === 'child').map(([id]) => id),
    [allUsers]
  )

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!activeKidId && kidsList.length > 0) setActiveKidId(kidsList[0])
  }, [activeKidId, kidsList])

  useEffect(() => {
    if (activeKidId && !kidsList.includes(activeKidId)) setActiveKidId(kidsList[0] || '')
  }, [activeKidId, kidsList])

  useEffect(() => {
    if (!activeKidId) return
    const info = allUsers[activeKidId] || {}
    const aliases = [activeKidId, info.name, info.displayName, info.loginId].filter(Boolean)
    const unique = [...new Set(aliases)]

    let cancelled = false
    const resolve = async () => {
      if (!isCloud) {
        setResolvedKidDocId(unique[0] || activeKidId)
        return
      }
      let firstExisting = null
      for (const id of unique) {
        const snap = await getDoc(doc(cloud.db, 'households', cloud.householdId, 'kids', id))
        if (snap.exists()) {
          const data = snap.data() || {}
          if (Array.isArray(data.tasks) && data.tasks.length > 0) {
            if (!cancelled) setResolvedKidDocId(id)
            return
          }
          if (!firstExisting) firstExisting = id
        }
      }
      if (!cancelled) setResolvedKidDocId(firstExisting || unique[0] || activeKidId)
    }

    resolve().catch(console.error)
    return () => {
      cancelled = true
    }
  }, [activeKidId, allUsers, isCloud, cloud?.db, cloud?.householdId])

  useEffect(() => {
    if (!resolvedKidDocId || !isCloud) return
    const ref = doc(cloud.db, 'households', cloud.householdId, 'kids', resolvedKidDocId)
    return onSnapshot(ref, (snap) => {
      const data = snap.exists() ? snap.data() : {}
      setTasks(Array.isArray(data?.tasks) ? data.tasks : [])
      setRewards(Array.isArray(data?.rewards) ? data.rewards : [])
      setEssentials(Array.isArray(data?.essentials) ? data.essentials : [])
      setSpentCoins(Number(data?.spentCoins || 0))
    })
  }, [resolvedKidDocId, isCloud, cloud?.db, cloud?.householdId])

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
    if (!isCloud || !resolvedKidDocId) return
    await setDoc(
      doc(cloud.db, 'households', cloud.householdId, 'kids', resolvedKidDocId),
      { tasks, rewards, essentials, spentCoins, ...overrides, updatedAt: serverTimestamp() },
      { merge: true }
    )
  }

  const mergeMetaDoc = async (docId, payload) => {
    if (!isCloud) return
    await setDoc(doc(cloud.db, 'households', cloud.householdId, 'meta', docId), payload, { merge: true })
  }

  const appendSystemLog = async ({ kidId, text }) => {
    if (!isCloud || !text) return
    const now = new Date()
    await mergeMetaDoc('messages', {
      messages: arrayUnion({
        id: Date.now() + Math.floor(Math.random() * 1000),
        kind: 'system',
        kidId,
        text,
        read: true,
        date: format(now, 'yyyy-MM-dd'),
        createdAt: now.toISOString(),
        createdAtLabel: format(now, 'yyyy-MM-dd HH:mm')
      }),
      updatedAt: serverTimestamp()
    })
  }

  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(selectedDate, { weekStartsOn: 1 }), index))
  const todayStr = format(selectedDate, 'yyyy-MM-dd')

  const todayTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (task.type !== 'class') return task.date === todayStr
        if (task.weekday !== undefined && task.weekday !== null && task.weekday !== '') {
          return Number(task.weekday) === getDay(selectedDate)
        }
        if (task.date) return task.date === todayStr
        return true
      }),
    [tasks, selectedDate, todayStr]
  )

  const availableCoins = useMemo(
    () => tasks.filter((task) => task.completed && task.type !== 'class').reduce((sum, task) => sum + (task.coins || (task.type === 'study' ? 1 : 0)), 0) - spentCoins,
    [tasks, spentCoins]
  )

  const weekMonthReport = useMemo(() => {
    const year = selectedDate.getFullYear()
    const month = selectedDate.getMonth()
    const currentWeek = format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const completed = tasks.filter((task) => task.completed && task.type !== 'class' && task.date)
    const weekTasks = completed.filter((task) => {
      const date = new Date(task.date)
      return !Number.isNaN(date.getTime()) && format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd') === currentWeek
    })
    const monthTasks = completed.filter((task) => {
      const date = new Date(task.date)
      return !Number.isNaN(date.getTime()) && date.getFullYear() === year && date.getMonth() === month
    })
    return {
      weekCoins: weekTasks.reduce((sum, task) => sum + (task.coins || 1), 0),
      weekCount: weekTasks.length,
      monthCoins: monthTasks.reduce((sum, task) => sum + (task.coins || 1), 0),
      monthCount: monthTasks.length
    }
  }, [tasks, selectedDate])

  const nextRewardInfo = useMemo(() => {
    const sorted = [...rewards]
      .filter((reward) => Number(reward?.coins) > availableCoins)
      .sort((a, b) => Number(a.coins) - Number(b.coins))
    const next = sorted[0] || null
    if (!next) return { label: '선물 교환 가능!', remain: 0 }
    const remain = Math.max(0, Number(next.coins) - availableCoins)
    return { label: `${next.text}까지 ${remain}코인`, remain }
  }, [rewards, availableCoins])

  const isMessageForActiveKid = (kidId) => {
    const info = allUsers[activeKidId] || {}
    const aliases = [activeKidId, info.loginId, info.name, info.displayName].filter(Boolean)
    return aliases.includes(kidId)
  }

  const messagesForKid = messages.filter((message) => isMessageForActiveKid(message.kidId) && message.kind !== 'system')
  const todayMessagesForKid = messagesForKid.filter((message) => message.date === todayStr)
  const unreadMessage = messagesForKid.find((message) => !message.read)
  const hasReadToday = todayMessagesForKid.some((message) => message.read)

  const getFullName = (id) => allUsers[id]?.displayName || allUsers[id]?.name || id

  const handleSendReply = async () => {
    if (!replyText || !unreadMessage) return
    const next = messages.map((message) => (message.id === unreadMessage.id ? { ...message, reply: replyText, read: true } : message))
    await mergeMetaDoc('messages', { messages: next, updatedAt: serverTimestamp() })
    setReplyText('')
    setShowSurprise(false)
  }

  const addTaskFromPalette = async (hour, subject) => {
    const startTime = `${String(hour).padStart(2, '0')}:00`
    const newTask = {
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
    const nextTasks = [...tasks, newTask]
    setTasks(nextTasks)
    await persistKidState({ tasks: nextTasks })
  }

  const handleBulkAdd = async () => {
    if (!bulkInput.trim()) return
    const lines = bulkInput.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    const byKid = new Map()

    lines.forEach((line) => {
      const cols = line.includes('\t') ? line.split('\t') : line.split(',').map((c) => c.trim())
      if (cols.length < 5) return

      const [kidRaw, dayRaw, subjectRaw, timeRaw, durationRaw] = cols
      const kidId = kidsList.find((id) => {
        const name = getFullName(id)
        return name.includes(kidRaw) || kidRaw.includes(name)
      }) || activeKidId

      const weekday = parseWeekday(dayRaw)
      const duration = parseInt(durationRaw, 10)
      const startTime = /^\d{1,2}:\d{2}$/.test(timeRaw) ? timeRaw : `${String(parseInt(timeRaw, 10) || 0).padStart(2, '0')}:00`
      if (Number.isNaN(weekday) || Number.isNaN(duration) || !subjectRaw) return

      const task = {
        id: `class-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: subjectRaw.trim(),
        color: '#7c9cff',
        startTime,
        expectedEndTime: buildExpectedEndTime(startTime, duration),
        duration,
        type: 'class',
        icon: 'Book',
        completed: false,
        weekday
      }
      if (!byKid.has(kidId)) byKid.set(kidId, [])
      byKid.get(kidId).push(task)
    })

    if (byKid.size === 0) {
      alert('붙여넣기 형식을 확인해 주세요: 이름\t요일\t과목명\t시간\t분')
      return
    }

    for (const [kidId, items] of byKid.entries()) {
      await setDoc(
        doc(cloud.db, 'households', cloud.householdId, 'kids', kidId),
        { tasks: arrayUnion(...items), updatedAt: serverTimestamp() },
        { merge: true }
      )
    }

    setBulkInput('')
    setShowClassManager(false)
  }

  const glassStyle = {
    background: 'rgba(255,255,255,0.7)',
    backdropFilter: 'blur(15px)',
    WebkitBackdropFilter: 'blur(15px)',
    border: '1px solid rgba(255,255,255,0.3)'
  }

  return (
    <DndContext
      sensors={isMobile ? undefined : sensors}
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
        if (data?.type === 'task' && over.id.toString().startsWith('hour-')) {
          const nextHour = Number(over.data.current.hour)
          const next = tasks.map((task) => {
            if (String(task.id) !== String(active.id)) return task
            const [, minute = '00'] = String(task.startTime || '00:00').split(':')
            const nextStartTime = `${String(nextHour).padStart(2, '0')}:${minute}`
            return {
              ...task,
              startTime: nextStartTime,
              expectedEndTime: buildExpectedEndTime(nextStartTime, task.duration || DEFAULT_DURATION)
            }
          })
          setTasks(next)
          await persistKidState({ tasks: next })
        }
        setActiveDragItem(null)
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '8px' : '20px' }}>
        <header style={{ ...glassStyle, padding: isMobile ? '12px 15px' : '15px 25px', borderRadius: '20px', marginBottom: '15px', boxShadow: '0 4px 12px rgba(255,77,109,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '8px' : '20px', flexDirection: isMobile ? 'column' : 'row' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '15px' }}>
              <div onClick={() => unreadMessage && setShowSurprise(true)} style={{ position: 'relative', cursor: unreadMessage ? 'pointer' : 'default' }}>
                <div style={{ width: isMobile ? '42px' : '48px', height: isMobile ? '42px' : '48px', background: unreadMessage ? PRIMARY_PINK : '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: hasReadToday ? '2px solid #42c99b' : 'none' }}>
                  {unreadMessage ? <Gift size={isMobile ? 22 : 24} color="white" /> : hasReadToday ? <Check size={isMobile ? 22 : 24} color="#42c99b" /> : <Gift size={isMobile ? 22 : 24} color="#ccc" />}
                </div>
              </div>
              <div>
                <h1 style={{ fontSize: isMobile ? '17px' : '21px', fontWeight: 900, color: '#333', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
                  {getFullName(activeKidId)}
                  {isMobile ? (
                    <span
                      style={{
                        borderRadius: '999px',
                        padding: '3px 8px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        background: 'linear-gradient(135deg, #fff7db 0%, #ffe8f0 100%)',
                        border: '1px solid #ffd8a8'
                      }}
                    >
                      <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'linear-gradient(135deg, #ffcf4a 0%, #ff9f1a 100%)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Coins size={11} color="white" />
                      </span>
                      <strong style={{ color: '#c96d00', fontSize: '12px', lineHeight: 1 }}>{availableCoins}</strong>
                    </span>
                  ) : (
                    <span
                      style={{
                        borderRadius: '14px',
                        padding: '5px 10px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'linear-gradient(135deg, #fff7db 0%, #ffe8f0 100%)',
                        border: '1px solid #ffd8a8',
                        boxShadow: '0 4px 10px rgba(255,157,0,0.14)'
                      }}
                    >
                      <span style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'linear-gradient(135deg, #ffcf4a 0%, #ff9f1a 100%)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Coins size={14} color="white" />
                      </span>
                      <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1.1 }}>
                        <strong style={{ color: '#c96d00', fontSize: '15px' }}>{availableCoins} 코인</strong>
                        <span style={{ fontSize: '10px', color: '#9a7a3a', fontWeight: 700 }}>{nextRewardInfo.label}</span>
                      </span>
                    </span>
                  )}
                </h1>
              </div>
            </div>

            <div style={{ display: 'flex', gap: isMobile ? '4px' : '10px', overflowX: isMobile ? 'auto' : 'visible', paddingBottom: isMobile ? '2px' : 0 }}>
              {isAdmin && <button onClick={() => setShowPalette((prev) => !prev)} className="header-btn-original"><Plus size={isMobile ? 18 : 22} /></button>}
              {isAdmin && <button onClick={() => setShowFamilyManager(true)} className="header-btn-original"><Users size={isMobile ? 18 : 22} /></button>}
              {isAdmin && <button onClick={() => setShowClassManager(true)} className="header-btn-original"><LayoutGrid size={isMobile ? 18 : 22} /></button>}
              {isAdmin && <button onClick={() => setShowAppLauncher(true)} className="header-btn-original"><Gift size={isMobile ? 18 : 22} /></button>}
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
            <div style={{ position: 'fixed', bottom: isMobile ? '25px' : '40px', right: isMobile ? '25px' : '40px', zIndex: 950 }}>
              <button onClick={() => setShowPalette((prev) => !prev)} style={{ width: isMobile ? '60px' : '65px', height: isMobile ? '60px' : '65px', borderRadius: '50%', background: PRIMARY_PINK, color: 'white', border: 'none', boxShadow: '0 6px 20px rgba(255,77,109,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                const next = tasks.map((task) => (task.id === id ? { ...task, ...updates } : task))
                setTasks(next)
                persistKidState({ tasks: next })
              }}
              onDeleteTask={(id) => {
                const next = tasks.filter((task) => task.id !== id)
                setTasks(next)
                persistKidState({ tasks: next })
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
                const next = [...tasks, nextTask]
                setTasks(next)
                persistKidState({ tasks: next })
              }}
            />
          </div>
        </main>

        {showClassManager && isAdmin && (
          <div className="modal-overlay" onClick={() => setShowClassManager(false)}>
            <div className="modal-content glass" onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '24px', padding: '25px', maxWidth: '560px', width: '95%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h2 style={{ fontWeight: 900, color: PRIMARY_PINK }}>엑셀 붙여넣기 등록</h2>
                <button onClick={() => setShowClassManager(false)} style={{ border: 'none', background: 'none' }}><CloseIcon /></button>
              </div>
              <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>형식: 이름[TAB]요일[TAB]과목명[TAB]시간[TAB]분</p>
              <textarea className="input-field" value={bulkInput} onChange={(e) => setBulkInput(e.target.value)} style={{ minHeight: '140px', marginBottom: '10px' }} />
              <button className="btn-primary" style={{ width: '100%' }} onClick={handleBulkAdd}>일괄 등록</button>
            </div>
          </div>
        )}

        {showPalette && (
          <div
            className="glass"
            style={{
              position: 'fixed',
              right: isMobile ? '10px' : '20px',
              bottom: isMobile ? '95px' : '120px',
              width: isMobile ? 'calc(100vw - 20px)' : '420px',
              maxHeight: isMobile ? '60vh' : '70vh',
              overflowY: 'auto',
              background: 'white',
              borderRadius: '20px',
              border: '1px solid #ffdeeb',
              boxShadow: '0 20px 40px rgba(0,0,0,0.12)',
              zIndex: 980
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px 0' }}>
              <h2 style={{ fontWeight: 900, color: PRIMARY_PINK, margin: 0 }}>과목 팔레트</h2>
              <button onClick={() => setShowPalette(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><CloseIcon size={24} /></button>
            </div>
            <SubjectPalette
              cloud={cloud}
              activeKidId={activeKidId}
              kids={kidsList}
              kidLabels={Object.fromEntries(kidsList.map((id) => [id, getFullName(id)]))}
              onSubjectsChange={() => {}}
              onCoinChange={async ({ kidId, subjectName, beforeCoins, afterCoins }) => {
                if (!isAdmin || beforeCoins === afterCoins) return
                await appendSystemLog({
                  kidId,
                  text: `코인 변경: ${getFullName(kidId)} · ${subjectName} (${beforeCoins} → ${afterCoins})`
                })
              }}
              isAdmin={isAdmin}
              allowDrag={!isMobile && isAdmin}
            />
          </div>
        )}

        {showGoals && (
          <div className="modal-overlay" onClick={() => setShowGoals(false)}>
            <div className="modal-content glass" onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '24px', padding: '30px', maxWidth: isMobile ? '95%' : '450px', width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontWeight: 900, color: PRIMARY_PINK }}>코인/꼭 관리</h2>
                <button onClick={() => setShowGoals(false)} style={{ border: 'none', background: 'none' }}><CloseIcon size={24} /></button>
              </div>
              <div style={{ background: LIGHT_PINK, padding: '20px', borderRadius: '18px', textAlign: 'center', marginBottom: '25px' }}>
                <div style={{ fontSize: '14px', color: PRIMARY_PINK, fontWeight: 'bold', marginBottom: '5px' }}>현재 코인</div>
                <strong style={{ fontSize: '34px' }}>{availableCoins}</strong>
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
                    <h3 style={{ fontSize: '15px', fontWeight: 900, marginBottom: '12px' }}>보상 등록</h3>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                      <input className="input-field" placeholder="보상 이름" value={newReward.text} onChange={(e) => setNewReward({ ...newReward, text: e.target.value })} style={{ flex: 2 }} />
                      <input className="input-field" type="number" placeholder="코인" value={newReward.coins} onChange={(e) => setNewReward({ ...newReward, coins: parseInt(e.target.value, 10) || 0 })} style={{ flex: 1 }} />
                      <button onClick={() => { if (newReward.text) { const next = [...rewards, { id: Date.now(), ...newReward }]; setRewards(next); persistKidState({ rewards: next }); setNewReward({ text: '', coins: 50 }); } }} className="btn-primary" style={{ padding: '12px' }}><Plus /></button>
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '18px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 900, marginBottom: '12px' }}>꼭 할 일</h3>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                      <input className="input-field" placeholder="꼭 할 일 이름" value={newEssential} onChange={(e) => setNewEssential(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newEssential) { const next = [...essentials, { id: Date.now(), name: newEssential }]; setEssentials(next); persistKidState({ essentials: next }); setNewEssential(''); } }} />
                      <button onClick={() => { if (newEssential) { const next = [...essentials, { id: Date.now(), name: newEssential }]; setEssentials(next); persistKidState({ essentials: next }); setNewEssential(''); } }} className="btn-primary" style={{ padding: '12px' }}><Plus /></button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {essentials.map((item) => (
                        <div key={item.id} style={{ background: 'white', padding: '6px 12px', borderRadius: '10px', border: '1px solid #ffdeeb', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {item.name}
                          <Trash size={12} color="#ff4d6d" style={{ cursor: 'pointer' }} onClick={() => { const next = essentials.filter((entry) => entry.id !== item.id); setEssentials(next); persistKidState({ essentials: next }); }} />
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
                    {isAdmin && <button onClick={async () => { const next = spentCoins + reward.coins; setSpentCoins(next); await persistKidState({ spentCoins: next }); }} className="btn-primary" style={{ padding: '8px 15px', fontSize: '13px' }}>지급 완료</button>}
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
              <button onClick={onLogout} className="btn-primary" style={{ width: '100%', background: '#f1f5f9', color: '#ff4d6d' }}>로그아웃</button>
            </div>
          </div>
        )}

        {showSurprise && unreadMessage && (
          <div className="modal-overlay" onClick={() => setShowSurprise(false)}>
            <div className="modal-content glass" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', background: 'white', borderRadius: isMobile ? '24px' : '30px', padding: isMobile ? '30px 20px' : '40px', maxWidth: isMobile ? '90%' : '380px' }}>
              <h2 style={{ fontWeight: 900, marginBottom: '15px', color: PRIMARY_PINK, fontSize: isMobile ? '19px' : '22px' }}>메시지 확인</h2>
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
                <button
                  onClick={async () => {
                    if (newMessage && messageTarget) {
                      const now = new Date()
                      await mergeMetaDoc('messages', {
                        messages: arrayUnion({
                          id: Date.now(),
                          text: newMessage,
                          date: todayStr,
                          kidId: messageTarget,
                          read: false,
                          createdAt: now.toISOString(),
                          createdAtLabel: format(now, 'yyyy-MM-dd HH:mm')
                        }),
                        updatedAt: serverTimestamp()
                      })
                      setNewMessage('')
                    }
                  }}
                  className="btn-primary"
                  style={{ width: '100%' }}
                >
                  전송
                </button>
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'grid', gap: '8px' }}>
                {messages.slice().reverse().map((message) => (
                  <div key={message.id} style={{ padding: '10px', background: '#f8fafc', borderRadius: '12px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <strong>{message.kind === 'system' ? `시스템 · ${getFullName(message.kidId)}` : getFullName(message.kidId)}</strong>
                      <span>{message.kind === 'system' ? '로그' : (message.read ? '읽음' : '안 읽음')}</span>
                    </div>
                    <div style={{ color: '#999', fontSize: '11px', marginBottom: '4px' }}>
                      {message.createdAtLabel || (message.createdAt ? format(new Date(message.createdAt), 'yyyy-MM-dd HH:mm') : `${message.date || ''}`)}
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
