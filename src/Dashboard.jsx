import React, { useState, useEffect, useMemo, useRef } from 'react'
import { DndContext, closestCenter } from '@dnd-kit/core'
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

  const ICONS = ['Book', 'Music', 'Calculator', 'Languages', 'Palette', 'Activity', 'Coffee', 'User', 'Star']

  const kidSyncRef = useRef({ kidId: null, json: '', ready: false })
  const logsSyncRef = useRef({ json: '', ready: false })

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

  // If `user` is loaded async, initialize activeKidId from user/localStorage so saving works.
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
    if (!isCloud || !activeKidId) return
    if (!kidSyncRef.current.ready) return
    if (kidSyncRef.current.kidId !== activeKidId) return

    const payload = { tasks: tasks || [], goals: goals || [], wishes: wishes || [] }
    const json = JSON.stringify(payload)
    if (json === kidSyncRef.current.json) return

    const t = setTimeout(async () => {
      const ref = doc(cloud.db, 'households', cloud.householdId, 'kids', activeKidId)
      await setDoc(ref, { ...payload, updatedAt: serverTimestamp() }, { merge: true })
      kidSyncRef.current = { kidId: activeKidId, json, ready: true }
    }, 500)

    return () => clearTimeout(t)
  }, [isCloud, cloud?.db, cloud?.householdId, activeKidId, tasks, goals, wishes])

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

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (over && active?.id?.startsWith('palette-')) {
      const subject = active.data.current
      if (!subject) return
      const hour = over.data.current.hour
      const startTime = typeof hour === 'number' ? `${hour.toString().padStart(2, '0')}:00` : hour
      addTask(subject.name, subject.color, startTime, 50, 'study')
    }
  }

  const addTask = (name, color, startTime, duration, type, icon = 'Book', targetKidId = activeKidId, targetDate = format(selectedDate, 'yyyy-MM-dd'), extra = {}) => {
    const safeStartTime =
      typeof startTime === 'string' && startTime.includes(':')
        ? startTime
        : `${String(startTime).padStart(2, '0')}:00`

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

    if (targetKidId === activeKidId && targetDate === format(selectedDate, 'yyyy-MM-dd')) {
      setTasks(prev => [...(prev || []), newTask])
    } else {
      if (!isCloud) {
        // Update specific kid's localStorage for the specific date
        const key = `tasks_${targetKidId}`
        const existing = loadState(key, [])
        localStorage.setItem(key, JSON.stringify([...existing, newTask]))
      } else if (targetKidId !== activeKidId) {
        ;(async () => {
          try {
            const ref = doc(cloud.db, 'households', cloud.householdId, 'kids', targetKidId)
            await setDoc(
              ref,
              {
                tasks: arrayUnion(newTask),
                updatedAt: serverTimestamp()
              },
              { merge: true }
            )
          } catch (e) {
            console.error(e)
          }
        })()
      }

      // If we are currently viewing the same kid but different date, keep UI state in sync.
      if (targetKidId === activeKidId) {
        setTasks(prev => [...prev, newTask])
      }
    }
    
    addLog(type === 'class' ? '고정 수업 추가' : '공부 계획 추가', `${targetDate} [${targetKidId}] ${name}`)
  }

  const handleBulkAdd = () => {
    if (!bulkInput) return
    const lines = bulkInput.trim().split('\n')
    let count = 0
    
    const dayMap = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6 }
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
    const isDateStr = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '')

    lines.forEach(line => {
      // Split by tab or multiple spaces
      const parts = line.split(/[\t]+| {2,}/).map(s => s.trim()).filter(Boolean)
      
      if (parts.length >= 5) {
        const [kidName, dayName, subject, time, duration, ...rest] = parts
        const dayIdx = dayMap[dayName[0]] // Take first char just in case of '월요일'
        
        if (dayIdx !== undefined) {
           const targetDate = format(addDays(weekStart, dayIdx), 'yyyy-MM-dd')
           const kidId = Object.keys(allUsers || {}).find(k => k.includes(kidName) || kidName.includes(k)) || kidName

           let notes = ''
           let startDate = ''
           let endDate = ''

           if (rest.length > 0) {
             notes = rest[0] || ''

             if (rest.length > 1) {
               if (isDateStr(rest[1])) startDate = rest[1]
               else notes = `${notes} ${rest[1]}`.trim()
             }

             if (rest.length > 2) {
               if (isDateStr(rest[2])) endDate = rest[2]
               else notes = `${notes} ${rest[2]}`.trim()
             }

             if (rest.length > 3) {
               notes = `${notes} ${rest.slice(3).join(' ')}`.trim()
             }
           }

           const extra = {}
           if (notes) extra.notes = notes
           if (startDate) extra.startDate = startDate
           if (endDate) extra.endDate = endDate
           extra.weekday = getDay(parseISO(targetDate))

           addTask(subject, '#8b5cf6', time, parseInt(duration) || 50, 'class', 'Book', kidId, targetDate, extra)
           count++
        }
      }
    })
    
    if (count > 0) {
      alert(`${count}개의 수업이 등록되었습니다!`)
      setBulkInput('')
      setShowClassManager(false)
      // In cloud mode the Firestore listener will refresh tasks; local mode still reads from storage.
      if (!isCloud) {
        setTasks(loadState(`tasks_${activeKidId}`, []))
      }
    } else {
      alert('올바른 형식이 아닙니다. [이름 요일 과목 시간 분 (메모) (시작일) (종료일)] 순서로 입력해 주세요.')
    }
  }

  const updateTask = (taskId, updates) => {
    setTasks(prev => (prev || []).map(t => {
      if (t.id === taskId) {
        const newT = { ...t, ...updates }
        
        // Recalculate end time if start time or duration changed
        if (updates.startTime !== undefined || updates.duration !== undefined) {
           const [h, m] = newT.startTime.split(':').map(Number)
           const totalMinutes = h * 60 + m + (newT.duration || 0)
           const endH = Math.floor(totalMinutes / 60) % 24
           const endM = totalMinutes % 60
           newT.expectedEndTime = `${endH < 10 ? '0' + endH : endH}:${endM < 10 ? '0' + endM : endM}`
        }

        if (t.type === 'class') {
           addLog('고정 수업 수정', `${t.name} -> ${newT.name} (${newT.startTime})`)
        } else if (updates.completed !== undefined) {
           addLog(updates.completed ? '달성 완료' : '달성 취소', `${t.name}`)
        }
        
        return newT
      }
      return t
    }))
  }

  const deleteTask = (taskId) => {
    const task = (tasks || []).find(t => t.id === taskId)
    if (task) {
      setTasks(prev => (prev || []).filter(t => t.id !== taskId))
      addLog('삭제', `${task.name}`)
    }
  }

  const copyToTomorrow = () => {
    const todayStr = format(selectedDate, 'yyyy-MM-dd')
    const tomorrowStr = format(addDays(selectedDate, 1), 'yyyy-MM-dd')
    const todayTasks = (tasks || []).filter(t => t.date === todayStr)
    
    if (todayTasks.length === 0) return alert('오늘 계획이 없어요!')
    
    const newTasks = todayTasks.map(t => ({
      ...t,
      id: Math.random().toString(36).substr(2, 9),
      date: tomorrowStr,
      completed: false,
      actualStartTime: null,
      actualEndTime: null
    }))
    
    setTasks(prev => [...prev, ...newTasks])
    alert(`${tomorrowStr}로 계획이 복사되었습니다!`)
    addLog('계획 복사', `${todayStr} -> ${tomorrowStr}`)
  }

  const resetDay = () => {
    if (confirm('오늘의 모든 계획을 삭제하고 초기화할까요?')) {
      const todayStr = format(selectedDate, 'yyyy-MM-dd')
      setTasks(prev => (prev || []).filter(t => t.date !== todayStr))
      addLog('초기화', `${todayStr} 시간표 초기화`)
    }
  }

  const copyGroupCode = async () => {
    if (!isCloud) return
    try {
      await navigator.clipboard.writeText(cloud.householdId)
      alert(`그룹 코드가 복사됐어요: ${cloud.householdId}`)
    } catch (e) {
      alert('그룹 코드 복사에 실패했어요.')
    }
  }

  const submitPasswordChange = async () => {
    if (!onChangePassword) return
    if (!currentPassword || !nextPassword || !confirmPassword) {
      setPasswordMessage('세 칸을 모두 입력해 주세요.')
      return
    }
    if (nextPassword.length < 6) {
      setPasswordMessage('새 비밀번호는 6자 이상으로 해 주세요.')
      return
    }
    if (nextPassword !== confirmPassword) {
      setPasswordMessage('새 비밀번호 확인이 맞지 않아요.')
      return
    }

    setPasswordBusy(true)
    const result = await onChangePassword(currentPassword, nextPassword)
    setPasswordBusy(false)
    setPasswordMessage(result.message)

    if (result.ok) {
      setCurrentPassword('')
      setNextPassword('')
      setConfirmPassword('')
    }
  }

  const currentTasks = useMemo(() => {
    try {
      if (!selectedDate || !(selectedDate instanceof Date)) return []
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      const targetTime = startOfDay(selectedDate).getTime()
      const selectedWeekday = getDay(selectedDate)

      return (tasks || []).filter(t => {
        const isRecurringClass = t.type === 'class'
        const taskWeekday = t.weekday ?? (t.date ? getDay(parseISO(t.date)) : null)

        if (isRecurringClass) {
          if (taskWeekday !== selectedWeekday) return false
        } else if (t.date !== dateStr) {
          return false
        }
        
        // Optional date range match
        if (t.startDate) {
          const start = startOfDay(parseISO(t.startDate)).getTime()
          if (targetTime < start) return false
        }
        if (t.endDate) {
          const end = startOfDay(parseISO(t.endDate)).getTime()
          if (targetTime > end) return false
        }
        
        return true
      })
    } catch (e) { return [] }
  }, [tasks, selectedDate])

  const isAdmin = user?.role === 'admin'
  const kids = Object.keys(allUsers || {}).filter(id => allUsers[id].role === 'child')
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
        <header className="glass" style={{ padding: '20px 30px', borderRadius: 'var(--radius-lg)', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ background: 'var(--primary)', color: 'white', padding: '10px', borderRadius: '15px' }}><Star size={24} /></div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: '800' }}>{activeKidId}의 {isAdmin ? '스케줄 관리' : '행복한 하루'}</h1>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{format(selectedDate, 'yyyy년 MM월 dd일 (eeee)', { locale: ko })}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {isAdmin && (
              <div style={{ display: 'flex', background: 'rgba(0,0,0,0.05)', padding: '4px', borderRadius: '12px' }}>
                {kids.map(kid => (<button key={kid} onClick={() => setActiveKidId(kid)} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: activeKidId === kid ? 'white' : 'transparent', fontWeight: '600', cursor: 'pointer', boxShadow: activeKidId === kid ? '0 2px 4px rgba(0,0,0,0.1)' : 'none' }}>{kid}</button>))}
              </div>
            )}
            {isCloud && isAdmin && (
              <button onClick={copyGroupCode} className="glass" style={{ padding: '10px 14px', borderRadius: '12px', border: 'none', cursor: 'pointer', color: 'var(--text-main)', fontWeight: '800', fontSize: '12px' }}>
                그룹: {cloud.householdId}
              </button>
            )}
            {isAdmin && <button onClick={() => setShowClassManager(!showClassManager)} className="glass" style={{ padding: '10px', borderRadius: '12px', border: 'none', cursor: 'pointer', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '5px' }}><LayoutGrid size={20}/> <span style={{fontSize: '13px', fontWeight: '700'}}>수업 관리</span></button>}
            <button onClick={() => { setShowGoals(!showGoals); setShowLogs(false); setShowSettings(false); setShowClassManager(false); }} className="glass" style={{ padding: '10px', borderRadius: '12px', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}><Trophy size={20}/></button>
            {isAdmin && <button onClick={() => { setShowLogs(!showLogs); setShowGoals(false); setShowSettings(false); setShowClassManager(false); }} className="glass" style={{ padding: '10px', borderRadius: '12px', border: 'none', cursor: 'pointer', color: 'var(--accent)' }}><ClipboardList size={20}/></button>}
            <button onClick={() => { setShowSettings(!showSettings); setShowLogs(false); setShowGoals(false); setShowClassManager(false); setPasswordMessage(''); }} className="glass" style={{ padding: '10px', borderRadius: '12px', border: 'none', cursor: 'pointer' }}><Settings size={20} /></button>
            <button onClick={onLogout} className="glass" style={{ padding: '10px', borderRadius: '12px', border: 'none', cursor: 'pointer', color: 'var(--secondary)' }}><LogOut size={20} /></button>
          </div>
        </header>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
           <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={copyToTomorrow} className="glass" style={{ padding: '10px 18px', borderRadius: '12px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '700' }}><Copy size={16}/> 내일로 복사</button>
              <button onClick={resetDay} className="glass" style={{ padding: '10px 18px', borderRadius: '12px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '700', color: '#ef4444' }}><Trash2 size={16}/> 초기화</button>
           </div>
           <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <button onClick={() => setSelectedDate(subDays(selectedDate, 1))} className="glass" style={{ padding: '8px', borderRadius: '50%', border: 'none', cursor: 'pointer' }}><ChevronLeft size={20}/></button>
              <div style={{ display: 'flex', gap: '5px' }}>
                {weekDays.map(day => (<button key={day.toString()} onClick={() => setSelectedDate(day)} style={{ padding: '10px 14px', borderRadius: '12px', border: 'none', background: isSameDay(day, selectedDate) ? 'var(--primary)' : 'white', color: isSameDay(day, selectedDate) ? 'white' : 'var(--text-main)', fontWeight: '700', cursor: 'pointer', boxShadow: 'var(--shadow)', minWidth: '55px' }}><div style={{ fontSize: '10px', opacity: 0.8 }}>{format(day, 'eee', { locale: ko })}</div><div>{format(day, 'd')}</div></button>))}
              </div>
              <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="glass" style={{ padding: '8px', borderRadius: '50%', border: 'none', cursor: 'pointer' }}><ChevronRight size={20}/></button>
           </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '30px' }}>
          <aside style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="glass" style={{ borderRadius: 'var(--radius-lg)', background: 'white' }}><SubjectPalette cloud={cloud} /></div>
            <div className="glass" style={{ borderRadius: 'var(--radius-lg)', background: 'white', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}><Gift size={20} style={{ color: 'var(--secondary)' }} /><h3 style={{ fontSize: '16px', fontWeight: '700' }}>나의 소원 리스트</h3></div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}><input className="input-field" style={{ padding: '8px', fontSize: '13px' }} placeholder="이루고 싶은 소원" value={newWish} onChange={(e) => setNewWish(e.target.value)} /><button onClick={() => { if(newWish){ setWishes(prev => [...(prev || []), {id: Date.now(), text: newWish, granted: false}]); setNewWish(''); } }} style={{ background: 'var(--secondary)', color: 'white', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}><Plus size={16}/></button></div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(wishes || []).map(w => (
                  <li key={w.id} style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.02)', padding: '8px', borderRadius: '8px' }}>
                    {w.granted ? <CheckCircle2 size={14} color="var(--accent)"/> : <Star size={14} color="#ddd"/>}
                    <span style={{ textDecoration: w.granted ? 'line-through' : 'none', opacity: w.granted ? 0.5 : 1 }}>{w.text}</span>
                    {isAdmin && !w.granted && <button onClick={() => setWishes(prev => (prev || []).map(i => i.id === w.id ? {...i, granted: true} : i))} style={{ marginLeft: 'auto', fontSize: '10px', background: 'var(--accent)', color: 'white', border: 'none', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer' }}>승인</button>}
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <main>
            {showClassManager && isAdmin ? (
              <div className="glass animate-fade-in" style={{ padding: '30px', borderRadius: 'var(--radius-lg)', background: 'white' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--primary)' }}>🛠️ 수업 일괄 등록 (엄마 전용)</h2>
                    <button onClick={() => setShowClassManager(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><Plus size={20} style={{ transform: 'rotate(45deg)' }}/></button>
                 </div>
                 
                 <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(139, 92, 246, 0.05)', borderRadius: '12px' }}>
                    <p style={{ fontSize: '13px', fontWeight: '700', marginBottom: '10px' }}>1. 대상을 선택하세요</p>
                    <div style={{ display: 'flex', gap: '15px' }}>
                       {kids.map(kid => (
                         <label key={kid} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px', cursor: 'pointer' }}>
                           <input type="checkbox" checked={selectedKids.includes(kid)} onChange={(e) => {
                             if (e.target.checked) setSelectedKids([...selectedKids, kid])
                             else setSelectedKids(selectedKids.filter(k => k !== kid))
                           }} /> {kid}
                         </label>
                       ))}
                    </div>
                 </div>

                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' }}>
                    <div style={{ borderRight: '1px solid #eee', paddingRight: '20px' }}>
                       <p style={{ fontSize: '13px', fontWeight: '700', marginBottom: '10px' }}>방법 A: 직접 입력하기</p>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <input className="input-field" value={className} onChange={(e)=>setClassName(e.target.value)} placeholder="수업 이름"/>
                          <div style={{ display: 'flex', gap: '10px' }}>
                             <input type="time" className="input-field" value={classStartTime} onChange={(e)=>setClassStartTime(e.target.value)} />
                             <input type="number" className="input-field" value={classDuration} onChange={(e)=>setClassDuration(Number(e.target.value))} placeholder="분"/>
                          </div>
                          <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>수업 기간 (선택)</label>
                          <div style={{ display: 'flex', gap: '5px' }}>
                             <input type="date" className="input-field" style={{padding:'4px', fontSize:'11px'}} value={classStartDate} onChange={(e)=>setClassStartDate(e.target.value)} />
                             <input type="date" className="input-field" style={{padding:'4px', fontSize:'11px'}} value={classEndDate} onChange={(e)=>setClassEndDate(e.target.value)} />
                          </div>
                          <textarea className="input-field" style={{padding:'8px', fontSize:'12px', height:'40px'}} value={classNotes} onChange={(e)=>setClassNotes(e.target.value)} placeholder="수업 메모 (줌 주소 등)"/>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                             <select className="input-field" value={classIcon} onChange={(e)=>setClassIcon(e.target.value)}>
                                {ICONS.map(i => <option key={i} value={i}>{i}</option>)}
                             </select>
                             <input type="color" className="input-field" style={{padding:'2px',height:'40px', width: '60px'}} value={classColor} onChange={(e)=>setClassColor(e.target.value)}/>
                          </div>
                          <button onClick={()=>{ if(className){ selectedKids.forEach(kid => addTask(className, classColor, classStartTime, classDuration, 'class', classIcon, kid, format(selectedDate, 'yyyy-MM-dd'), { notes: classNotes, startDate: classStartDate, endDate: classEndDate })); setClassName(''); setClassNotes(''); setClassStartDate(''); setClassEndDate(''); } }} className="btn-primary" style={{width:'100%'}}>등록하기</button>
                       </div>
                    </div>

                    <div>
                       <p style={{ fontSize: '13px', fontWeight: '700', marginBottom: '10px' }}>방법 B: 엑셀 일괄 등록 (추천 ⭐)</p>
                       <textarea 
                          className="input-field" 
                          style={{ height: '120px', fontSize: '12px', fontFamily: 'monospace' }} 
                          placeholder="이름 [Tab] 요일 [Tab] 과목명 [Tab] 시간 [Tab] 분 [Tab] (메모) [Tab] (시작일) [Tab] (종료일)&#10;예: 가빈\t월\t피아노\t14:00\t50\t줌: https://...\t2026-05-01\t2026-06-30&#10;    지희\t화\t영어학원\t15:30\t90"
                          value={bulkInput}
                          onChange={(e) => setBulkInput(e.target.value)}
                       />
                       <button onClick={handleBulkAdd} className="btn-primary" style={{ width: '100%', marginTop: '10px', background: 'var(--accent)' }}>스케줄 일괄 등록 실행</button>
                    </div>
                 </div>

                 <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: '#f9f9f9', padding: '10px', borderRadius: '8px' }}>
                    💡 기본 5개 열(이름, 요일, 과목, 시간, 분) + 선택 3개 열(메모, 시작일, 종료일)도 지원해요. 메모에 띄어쓰기가 있으면 Tab으로 구분해서 붙여넣어 주세요.
                 </div>
              </div>
            ) : showSettings ? (
              <div className="glass animate-fade-in" style={{ padding: '30px', borderRadius: 'var(--radius-lg)', background: 'white' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '10px' }}>내 비밀번호 바꾸기</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                  지금 로그인한 사람만 자기 비밀번호를 바꿀 수 있어요.
                </p>

                <div style={{ maxWidth: '460px', display: 'grid', gap: '12px' }}>
                  <input
                    className="input-field"
                    type="password"
                    placeholder="현재 비밀번호"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                  <input
                    className="input-field"
                    type="password"
                    placeholder="새 비밀번호"
                    value={nextPassword}
                    onChange={(e) => setNextPassword(e.target.value)}
                  />
                  <input
                    className="input-field"
                    type="password"
                    placeholder="새 비밀번호 다시 입력"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  {passwordMessage && (
                    <div style={{ fontSize: '12px', fontWeight: '800', color: passwordMessage.includes('바뀌었어요') ? 'var(--accent)' : '#ef4444' }}>
                      {passwordMessage}
                    </div>
                  )}
                  <button
                    className="btn-primary"
                    style={{ width: '220px', opacity: passwordBusy ? 0.7 : 1 }}
                    disabled={passwordBusy}
                    onClick={submitPasswordChange}
                  >
                    {passwordBusy ? '바꾸는 중...' : '비밀번호 변경하기'}
                  </button>
                </div>
              </div>
            ) : showLogs ? (
              <div className="glass animate-fade-in" style={{ padding: '30px', borderRadius: 'var(--radius-lg)', background: 'white' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '20px' }}>활동 기록</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>{(logs || []).filter(l => l.kidId === activeKidId).map(log => (<div key={log.id} style={{ padding: '12px', borderBottom: '1px solid #eee', fontSize: '13px' }}><span style={{ color: 'var(--text-muted)', marginRight: '10px' }}>{log.timestamp ? format(new Date(log.timestamp), 'HH:mm:ss') : ''}</span><strong style={{ color: 'var(--primary)', marginRight: '10px' }}>{log.action}</strong><span>{log.detail}</span></div>))}</div>
              </div>
            ) : showGoals ? (
              <div className="glass animate-fade-in" style={{ padding: '30px', borderRadius: 'var(--radius-lg)', background: 'white' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '20px' }}>🎯 이번 주 목표</h2>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}><input className="input-field" placeholder="목표 입력" value={newGoal} onChange={(e) => setNewGoal(e.target.value)} /><button onClick={() => { if(newGoal){ setGoals(prev => [...(prev || []), {id: Date.now(), text: newGoal, done: false}]); setNewGoal(''); } }} className="btn-primary">추가</button></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>{(goals || []).map(g => (<div key={g.id} onClick={() => setGoals(prev => (prev || []).map(i => i.id === g.id ? {...i, done: !i.done} : i))} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '15px', background: g.done ? 'rgba(52, 211, 153, 0.1)' : 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>{g.done ? <CheckCircle2 color="var(--accent)"/> : <div style={{ width: '24px', height: '24px', border: '2px solid #ddd', borderRadius: '50%' }}/>}<span style={{ fontWeight: '600', textDecoration: g.done ? 'line-through' : 'none' }}>{g.text}</span></div>))}</div>
              </div>
            ) : (
              <TimeGrid tasks={currentTasks} onUpdateTask={updateTask} onDeleteTask={deleteTask} isAdmin={isAdmin} />
            )}
          </main>
        </div>
      </div>
    </DndContext>
  )
}

export default Dashboard
