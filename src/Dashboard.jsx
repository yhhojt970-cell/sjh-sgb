import React, { useState, useEffect, useMemo, useRef } from 'react'
import { DndContext, DragOverlay, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SubjectPalette } from './SubjectPalette'
import TimeGrid from './TimeGrid'
import { LogOut, Settings, Star, User, ChevronLeft, ChevronRight, ClipboardList, Gift, Trophy, CheckCircle2, Copy, Trash2, Plus, LayoutGrid } from 'lucide-react'
import { format, addDays, subDays, startOfWeek, isSameDay, parseISO, startOfDay, getDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import { arrayUnion, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'

function Dashboard({ user, onLogout, onUpdateUser, onChangePassword, allUsers, cloud }) {
  const isCloud = !!cloud?.db && !!cloud?.householdId
  const [activeKidId, setActiveKidId] = useState(user?.id || '')
  const [selectedDate, setSelectedDate] = useState(new Date())
  
  const loadState = (key, defaultVal) => {
    try {
      const saved = localStorage.getItem(key)
      if (saved && saved !== 'undefined' && saved !== 'null') return JSON.parse(saved)
    } catch (e) { console.error(e) }
    return defaultVal
  }

  const [tasks, setTasks] = useState(() => (isCloud ? [] : loadState(`tasks_${activeKidId}`, [])))
  const [logs, setLogs] = useState(() => (isCloud ? [] : loadState('kid_app_logs', [])))
  const [goals, setGoals] = useState(() => (isCloud ? [] : loadState(`goals_${activeKidId}`, [])))
  const [wishes, setWishes] = useState(() => (isCloud ? [] : loadState(`wishes_${activeKidId}`, [])))

  const [showSettings, setShowSettings] = useState(false)
  const [showLogs, setShowLogs] = useState(false)
  const [showGoals, setShowGoals] = useState(false)
  const [showClassManager, setShowClassManager] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  
  const [newGoal, setNewGoal] = useState('')
  const [newWish, setNewWish] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)

  const [className, setClassName] = useState('')
  const [classStartTime, setClassStartTime] = useState('09:00')
  const [classDuration, setClassDuration] = useState(50)
  const [classColor, setClassColor] = useState('#8b5cf6')
  const [classIcon, setClassIcon] = useState('Book')
  const [classNotes, setClassNotes] = useState('')
  const [classStartDate, setClassStartDate] = useState('')
  const [classEndDate, setClassEndDate] = useState('')
  const [bulkInput, setBulkInput] = useState('')
  const [selectedKids, setSelectedKids] = useState([activeKidId])
  const [activeDragItem, setActiveDragItem] = useState(null)

  const ICONS = ['Book', 'Music', 'Calculator', 'Languages', 'Palette', 'Activity', 'Coffee', 'User', 'Star']
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    })
  )

  const kidSyncRef = useRef({ kidId: null, json: '', ready: false })
  const logsSyncRef = useRef({ json: '', ready: false })
  const latestKidStateRef = useRef({ tasks: [], goals: [], wishes: [] })

  useEffect(() => {
    if (activeKidId) {
      if (!isCloud) {
        setTasks(loadState(`tasks_${activeKidId}`, []))
        setGoals(loadState(`goals_${activeKidId}`, []))
        setWishes(loadState(`wishes_${activeKidId}`, []))
      }
    }
  }, [activeKidId, isCloud])

  useEffect(() => {
    if (!isCloud || !activeKidId) return

    kidSyncRef.current = { kidId: activeKidId, json: '', ready: false }
    const ref = doc(cloud.db, 'households', cloud.householdId, 'kids', activeKidId)

    return onSnapshot(ref, (snap) => {
      const data = snap.exists() ? snap.data() : {}
      const next = {
        tasks: Array.isArray(data?.tasks) ? data.tasks : [],
        goals: Array.isArray(data?.goals) ? data.goals : [],
        wishes: Array.isArray(data?.wishes) ? data.wishes : []
      }
      const json = JSON.stringify(next)
      kidSyncRef.current = { kidId: activeKidId, json, ready: true }
      setTasks(next.tasks)
      setGoals(next.goals)
      setWishes(next.wishes)
    })
  }, [isCloud, cloud?.db, cloud?.householdId, activeKidId])

  useEffect(() => {
    if (!isCloud) return
    logsSyncRef.current = { json: '', ready: false }

    const ref = doc(cloud.db, 'households', cloud.householdId, 'meta', 'logs')
    return onSnapshot(ref, (snap) => {
      const data = snap.exists() ? snap.data() : {}
      const next = Array.isArray(data?.logs) ? data.logs : []
      logsSyncRef.current = { json: JSON.stringify(next), ready: true }
      setLogs(next)
    })
  }, [isCloud, cloud?.db, cloud?.householdId])

  useEffect(() => {
    if (!user?.id) return
    const saved = loadState(`activeKid_${user.id}`, user.id)
    setActiveKidId(prev => prev || saved || user.id)
  }, [user?.id])

  useEffect(() => {
    if (!user?.id || !activeKidId) return
    localStorage.setItem(`activeKid_${user.id}`, JSON.stringify(activeKidId))
  }, [activeKidId, user?.id])

  useEffect(() => {
    if (!activeKidId) return
    setSelectedKids(prev => (prev || []).some(Boolean) ? prev : [activeKidId])
  }, [activeKidId])

  useEffect(() => { if(!isCloud && activeKidId) localStorage.setItem(`tasks_${activeKidId}`, JSON.stringify(tasks)) }, [tasks, activeKidId, isCloud])
  useEffect(() => { if(!isCloud) localStorage.setItem('kid_app_logs', JSON.stringify(logs)) }, [logs, isCloud])
  useEffect(() => { if(!isCloud && activeKidId) localStorage.setItem(`goals_${activeKidId}`, JSON.stringify(goals)) }, [goals, activeKidId, isCloud])
  useEffect(() => { if(!isCloud && activeKidId) localStorage.setItem(`wishes_${activeKidId}`, JSON.stringify(wishes)) }, [wishes, activeKidId, isCloud])
  useEffect(() => {
    latestKidStateRef.current = {
      tasks: tasks || [],
      goals: goals || [],
      wishes: wishes || []
    }
  }, [tasks, goals, wishes])

  const persistActiveKidState = async (overrides = {}) => {
    if (!isCloud || !activeKidId) return

    const payload = {
      tasks: overrides.tasks ?? latestKidStateRef.current.tasks ?? [],
      goals: overrides.goals ?? latestKidStateRef.current.goals ?? [],
      wishes: overrides.wishes ?? latestKidStateRef.current.wishes ?? []
    }
    const json = JSON.stringify(payload)

    kidSyncRef.current = { kidId: activeKidId, json, ready: true }
    latestKidStateRef.current = payload

    const ref = doc(cloud.db, 'households', cloud.householdId, 'kids', activeKidId)
    await setDoc(ref, { ...payload, updatedAt: serverTimestamp() }, { merge: true })
  }

  const applyTaskChange = (updater) => {
    setTasks((prev) => {
      const next = typeof updater === 'function' ? updater(prev || []) : updater
      latestKidStateRef.current = { ...latestKidStateRef.current, tasks: next }
      if (isCloud) {
        persistActiveKidState({ tasks: next }).catch(console.error)
      }
      return next
    })
  }

  const applyGoalsChange = (updater) => {
    setGoals((prev) => {
      const next = typeof updater === 'function' ? updater(prev || []) : updater
      latestKidStateRef.current = { ...latestKidStateRef.current, goals: next }
      if (isCloud) {
        persistActiveKidState({ goals: next }).catch(console.error)
      }
      return next
    })
  }

  const applyWishesChange = (updater) => {
    setWishes((prev) => {
      const next = typeof updater === 'function' ? updater(prev || []) : updater
      latestKidStateRef.current = { ...latestKidStateRef.current, wishes: next }
      if (isCloud) {
        persistActiveKidState({ wishes: next }).catch(console.error)
      }
      return next
    })
  }

  useEffect(() => {
    if (!isCloud) return
    if (!logsSyncRef.current.ready) return

    const json = JSON.stringify(logs || [])
    if (json === logsSyncRef.current.json) return

    const t = setTimeout(async () => {
      const ref = doc(cloud.db, 'households', cloud.householdId, 'meta', 'logs')
      await setDoc(ref, { logs: (logs || []).slice(0, 100), updatedAt: serverTimestamp() }, { merge: true })
      logsSyncRef.current = { json, ready: true }
    }, 500)

    return () => clearTimeout(t)
  }, [isCloud, cloud?.db, cloud?.householdId, logs])

  const addLog = (action, detail) => {
    const newLog = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      userId: user?.id || 'unknown',
      kidId: activeKidId,
      action,
      detail
    }
    setLogs(prev => [newLog, ...(prev || [])].slice(0, 100))
  }

  const renderDragPreview = () => {
    if (!activeDragItem) return null
    if (activeDragItem.type === 'palette') {
      const subject = activeDragItem.subject
      return (
        <div className="drag-preview-card" style={{ borderLeft: `6px solid ${subject.color}` }}>
          <div className="drag-preview-badge">끌어다 놓기</div>
          <div className="drag-preview-title">{subject.name}</div>
        </div>
      )
    }
    if (activeDragItem.type === 'task') {
      const task = activeDragItem.task
      return (
        <div className="drag-preview-card" style={{ borderLeft: `6px solid ${task.color}` }}>
          <div className="drag-preview-title">{task.name}</div>
        </div>
      )
    }
    return null
  }

  const handleDragStart = (event) => {
    const dragData = event.active?.data?.current
    if (!dragData) return
    if (dragData.type === 'palette') setActiveDragItem({ type: 'palette', subject: dragData.subject })
    else if (dragData.type === 'task') setActiveDragItem({ type: 'task', task: dragData.task })
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    const dragData = active?.data?.current
    if (over?.id?.toString().startsWith('hour-') && dragData?.type === 'palette') {
      const hour = over.data.current.hour
      const startTime = typeof hour === 'number' ? `${hour.toString().padStart(2, '0')}:00` : hour
      addTask(dragData.subject.name, dragData.subject.color, startTime, 50, 'study')
    } else if (over?.id?.toString().startsWith('hour-') && dragData?.type === 'task') {
      const hour = over.data.current.hour
      const startTime = typeof hour === 'number' ? `${hour.toString().padStart(2, '0')}:00` : hour
      updateTask(dragData.task.id, { startTime })
    }
    setActiveDragItem(null)
  }

  const addTask = (name, color, startTime, duration, type, icon = 'Book', targetKidId = activeKidId, targetDate = format(selectedDate, 'yyyy-MM-dd'), extra = {}) => {
    const safeStartTime = typeof startTime === 'string' && startTime.includes(':') ? startTime : `${String(startTime).padStart(2, '0')}:00`
    const [hour, min] = safeStartTime.split(':').map(Number)
    const totalMinutes = hour * 60 + min + duration
    const endH = Math.floor(totalMinutes / 60) % 24
    const endM = totalMinutes % 60
    const expectedEndTime = `${endH < 10 ? '0' + endH : endH}:${endM < 10 ? '0' + endM : endM}`
    const newTask = {
      id: Math.random().toString(36).substr(2, 9),
      name, color, startTime: safeStartTime, expectedEndTime, duration, type, icon,
      completed: false,
      date: targetDate,
      ...(type === 'class' ? { weekday: extra.weekday ?? getDay(parseISO(targetDate)) } : {}),
      ...extra
    }
    if (targetKidId === activeKidId && targetDate === format(selectedDate, 'yyyy-MM-dd')) applyTaskChange(prev => [...(prev || []), newTask])
    else if (isCloud) {
        ;(async () => {
          try {
            const ref = doc(cloud.db, 'households', cloud.householdId, 'kids', targetKidId)
            await setDoc(ref, { tasks: arrayUnion(newTask), updatedAt: serverTimestamp() }, { merge: true })
          } catch (e) { console.error(e) }
        })()
    } else if (targetKidId === activeKidId) applyTaskChange(prev => [...(prev || []), newTask])
    addLog(type === 'class' ? '고정 수업 추가' : '공부 계획 추가', `${targetDate} [${targetKidId}] ${name}`)
  }

  const handleBulkAdd = () => {
    if (!bulkInput) return
    const lines = bulkInput.trim().split('\n')
    let count = 0
    const dayMap = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6 }
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
    lines.forEach(line => {
      const parts = line.split(/[\t]+| {2,}/).map(s => s.trim()).filter(Boolean)
      if (parts.length >= 5) {
        const [kidName, dayName, subject, time, duration, ...rest] = parts
        const dayIdx = dayMap[dayName[0]]
        if (dayIdx !== undefined) {
           const targetDate = format(addDays(weekStart, dayIdx), 'yyyy-MM-dd')
           const kidId = Object.keys(allUsers || {}).find(key => {
             const info = allUsers[key] || {}
             return key.includes(kidName) || (info.displayName && info.displayName.includes(kidName))
           }) || kidName
           const extra = { weekday: getDay(parseISO(targetDate)) }
           if (rest[0]) extra.notes = rest[0]
           addTask(subject, '#8b5cf6', time, parseInt(duration) || 50, 'class', 'Book', kidId, targetDate, extra)
           count++
        }
      }
    })
    if (count > 0) {
      alert(`${count}개의 수업이 등록되었습니다!`)
      setBulkInput('')
      setShowClassManager(false)
    }
  }

  const updateTask = (taskId, updates) => {
    applyTaskChange(prev => (prev || []).map(t => {
      if (t.id === taskId) {
        const newT = { ...t, ...updates }
        if (updates.startTime !== undefined || updates.duration !== undefined) {
           const [h, m] = newT.startTime.split(':').map(Number)
           const totalMinutes = h * 60 + m + (newT.duration || 0)
           const endH = Math.floor(totalMinutes / 60) % 24
           const endM = totalMinutes % 60
           newT.expectedEndTime = `${endH < 10 ? '0' + endH : endH}:${endM < 10 ? '0' + endM : endM}`
        }
        return newT
      }
      return t
    }))
  }

  const deleteTask = (taskId) => {
    const task = (tasks || []).find(t => t.id === taskId)
    if (task) {
      applyTaskChange(prev => (prev || []).filter(t => t.id !== taskId))
      addLog('삭제', `${task.name}`)
    }
  }

  const copyToTomorrow = () => {
    const todayStr = format(selectedDate, 'yyyy-MM-dd')
    const tomorrowStr = format(addDays(selectedDate, 1), 'yyyy-MM-dd')
    const todayTasks = (tasks || []).filter(t => t.date === todayStr && t.type !== 'class')
    if (todayTasks.length === 0) return alert('오늘 계획이 없어요!')
    const newTasks = todayTasks.map(t => ({ ...t, id: Math.random().toString(36).substr(2, 9), date: tomorrowStr, completed: false }))
    applyTaskChange(prev => [...(prev || []), ...newTasks])
    alert(`${tomorrowStr}로 계획이 복사되었습니다!`)
  }

  const resetDay = () => {
    if (confirm('오늘의 모든 계획을 삭제하고 초기화할까요?')) {
      const todayStr = format(selectedDate, 'yyyy-MM-dd')
      applyTaskChange(prev => (prev || []).filter(t => t.type === 'class' || t.date !== todayStr))
    }
  }

  const submitPasswordChange = async () => {
    if (!onChangePassword || !currentPassword || !nextPassword) return
    setPasswordBusy(true)
    const result = await onChangePassword(currentPassword, nextPassword)
    setPasswordBusy(false)
    setPasswordMessage(result.message)
    if (result.ok) { setCurrentPassword(''); setNextPassword(''); setConfirmPassword(''); }
  }

  const currentTasks = useMemo(() => {
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      const targetTime = startOfDay(selectedDate).getTime()
      const selectedWeekday = getDay(selectedDate)
      return (tasks || []).filter(t => {
        if (t.type === 'class') {
          if (t.weekday !== selectedWeekday) return false
        } else if (t.date !== dateStr) return false
        if (t.startDate && targetTime < startOfDay(parseISO(t.startDate)).getTime()) return false
        if (t.endDate && targetTime > startOfDay(parseISO(t.endDate)).getTime()) return false
        return true
      })
    } catch (e) { return [] }
  }, [tasks, selectedDate])

  const isAdmin = user?.role === 'admin'
  const kids = Object.keys(allUsers || {}).filter(id => allUsers[id].role === 'child')
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveDragItem(null)}>
      <div className="dashboard-shell" style={{ maxWidth: '1200px', margin: '0 auto', padding: '10px' }}>
        <header className="glass dashboard-header" style={{ padding: '12px', borderRadius: 'var(--radius-lg)', marginBottom: '15px', background: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ background: 'var(--primary)', color: 'white', padding: '6px', borderRadius: '10px' }}><Star size={18} /></div>
              <h1 style={{ fontSize: '15px', fontWeight: '800' }}>{allUsers[activeKidId]?.displayName || activeKidId}의 하루</h1>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => { setShowGoals(!showGoals); setShowLogs(false); setShowSettings(false); setShowClassManager(false); }} style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer', color: 'var(--primary)' }}><Trophy size={18}/></button>
              {isAdmin && <button onClick={() => { setShowLogs(!showLogs); setShowGoals(false); setShowSettings(false); setShowClassManager(false); }} style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer', color: 'var(--accent)' }}><ClipboardList size={18}/></button>}
              <button onClick={() => { setShowSettings(!showSettings); setShowLogs(false); setShowGoals(false); setShowClassManager(false); setPasswordMessage(''); }} style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer' }}><Settings size={18} /></button>
              <button onClick={onLogout} style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer', color: 'var(--secondary)' }}><LogOut size={18} /></button>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
            {isAdmin && (
              <div style={{ display: 'flex', background: 'rgba(0,0,0,0.05)', padding: '3px', borderRadius: '10px' }}>
                {kids.map(kid => (
                  <button key={kid} onClick={() => setActiveKidId(kid)} style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', background: activeKidId === kid ? 'white' : 'transparent', fontWeight: '700', fontSize: '12px', cursor: 'pointer', boxShadow: activeKidId === kid ? '0 2px 4px rgba(0,0,0,0.1)' : 'none' }}>
                    {allUsers[kid]?.displayName || kid}
                  </button>
                ))}
              </div>
            )}
            {isAdmin && (
              <button onClick={() => setShowClassManager(!showClassManager)} style={{ padding: '6px 10px', borderRadius: '10px', border: 'none', background: 'rgba(139, 92, 246, 0.1)', color: 'var(--primary)', cursor: 'pointer', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <LayoutGrid size={14}/> 수업관리
              </button>
            )}
          </div>
        </header>

        <div className="dashboard-date-nav" style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '15px' }}>
          <button onClick={() => setSelectedDate(subDays(selectedDate, 1))} style={{ background: 'white', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer', boxShadow: 'var(--shadow)', display: 'flex' }}><ChevronLeft size={20}/></button>
          <div className="dashboard-week-strip" style={{ display: 'flex', gap: '4px', overflowX: 'auto', flex: 1, padding: '2px 0', scrollbarWidth: 'none' }}>
            {weekDays.map(day => (
              <button key={day.toString()} onClick={() => setSelectedDate(day)} style={{ padding: '8px 0', borderRadius: '10px', border: 'none', background: isSameDay(day, selectedDate) ? 'var(--primary)' : 'white', color: isSameDay(day, selectedDate) ? 'white' : 'var(--text-main)', fontWeight: '700', cursor: 'pointer', boxShadow: 'var(--shadow)', minWidth: '42px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '9px', opacity: 0.8, marginBottom: '2px' }}>{format(day, 'eee', { locale: ko })}</span>
                <span style={{ fontSize: '13px' }}>{format(day, 'd')}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} style={{ background: 'white', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer', boxShadow: 'var(--shadow)', display: 'flex' }}><ChevronRight size={20}/></button>
        </div>

        <div className="dashboard-toolbar" style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
           <button onClick={copyToTomorrow} style={{ flex: 1, padding: '10px', borderRadius: '12px', border: 'none', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', boxShadow: 'var(--shadow)' }}><Copy size={14}/> 내일복사</button>
           <button onClick={resetDay} style={{ flex: 1, padding: '10px', borderRadius: '12px', border: 'none', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#ef4444', boxShadow: 'var(--shadow)' }}><Trash2 size={14}/> 초기화</button>
           {isAdmin && (
             <button onClick={() => setShowPalette(!showPalette)} style={{ padding: '10px', borderRadius: '12px', border: 'none', background: showPalette ? 'var(--primary)' : 'white', color: showPalette ? 'white' : 'var(--primary)', cursor: 'pointer', fontWeight: '700', boxShadow: 'var(--shadow)', display: 'flex' }}>
               <Plus size={18} style={{ transform: showPalette ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }} />
             </button>
           )}
        </div>

        <div className="dashboard-main-stack" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {showPalette && isAdmin && (
            <div className="glass animate-fade-in" style={{ borderRadius: 'var(--radius-lg)', background: 'white' }}>
              <SubjectPalette cloud={cloud} activeKidId={activeKidId} kids={kids} />
            </div>
          )}
          <main className="dashboard-main">
            {showClassManager && isAdmin ? (
               <div className="glass animate-fade-in" style={{ padding: '20px', borderRadius: 'var(--radius-lg)', background: 'white' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}><h2 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--primary)' }}>수업 일괄 등록</h2><button onClick={() => setShowClassManager(false)} style={{ background: 'none', border: 'none' }}><Plus size={20} style={{ transform: 'rotate(45deg)' }}/></button></div>
                  <textarea className="input-field" style={{ height: '100px', fontSize: '12px' }} placeholder="이름 [Tab] 요일 [Tab] 과목명 [Tab] 시간 [Tab] 분" value={bulkInput} onChange={(e) => setBulkInput(e.target.value)}/>
                  <button onClick={handleBulkAdd} className="btn-primary" style={{ width: '100%', marginTop: '10px' }}>스케줄 등록</button>
               </div>
            ) : showSettings ? (
               <div className="glass animate-fade-in" style={{ padding: '20px', borderRadius: 'var(--radius-lg)', background: 'white' }}>
                 <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '15px' }}>비밀번호 변경</h2>
                 <input className="input-field" type="password" placeholder="현재 비밀번호" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} style={{marginBottom:'10px'}}/>
                 <input className="input-field" type="password" placeholder="새 비밀번호" value={nextPassword} onChange={(e) => setNextPassword(e.target.value)} style={{marginBottom:'10px'}}/>
                 {passwordMessage && <div style={{ fontSize: '12px', color: 'var(--accent)', marginBottom: '10px' }}>{passwordMessage}</div>}
                 <button className="btn-primary" onClick={submitPasswordChange}>변경하기</button>
                 <button className="btn-secondary" onClick={()=>setShowSettings(false)} style={{marginTop:'10px', width:'100%'}}>닫기</button>
               </div>
            ) : showLogs ? (
               <div className="glass animate-fade-in" style={{ padding: '20px', borderRadius: 'var(--radius-lg)', background: 'white' }}>
                 <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '15px' }}>활동 기록</h2>
                 <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                   {(logs || []).filter(l => l.kidId === activeKidId).map(log => (<div key={log.id} style={{ padding: '8px 0', borderBottom: '1px solid #eee', fontSize: '12px' }}><strong>{log.action}</strong>: {log.detail}</div>))}
                 </div>
                 <button className="btn-secondary" onClick={()=>setShowLogs(false)} style={{marginTop:'10px', width:'100%'}}>닫기</button>
               </div>
            ) : showGoals ? (
               <div className="glass animate-fade-in" style={{ padding: '20px', borderRadius: 'var(--radius-lg)', background: 'white' }}>
                 <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '15px' }}>이번 주 목표</h2>
                 <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}><input className="input-field" value={newGoal} onChange={(e)=>setNewGoal(e.target.value)}/><button className="btn-primary" onClick={()=>{if(newGoal){applyGoalsChange(prev=>[...prev, {id:Date.now(), text:newGoal, done:false}]);setNewGoal('');}}}>+</button></div>
                 {(goals || []).map(g => (<div key={g.id} onClick={()=>applyGoalsChange(prev=>prev.map(i=>i.id===g.id?{...i,done:!i.done}:i))} style={{padding:'10px', background:g.done?'#f0fff4':'#f9f9f9', marginBottom:'5px', borderRadius:'8px', fontSize:'13px'}}>{g.text}</div>))}
                 <button className="btn-secondary" onClick={()=>setShowGoals(false)} style={{marginTop:'10px', width:'100%'}}>닫기</button>
               </div>
            ) : (
              <TimeGrid tasks={currentTasks} onUpdateTask={updateTask} onDeleteTask={deleteTask} isAdmin={isAdmin} />
            )}
          </main>
        </div>
      </div>
      <DragOverlay>{renderDragPreview()}</DragOverlay>
    </DndContext>
  )
}

export default Dashboard
