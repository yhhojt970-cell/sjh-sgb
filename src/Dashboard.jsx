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
  Edit3,
  Gift,
  LayoutGrid,
  LogOut,
  PiggyBank,
  Plus,
  Send,
  Settings,
  Trash,
  Trophy,
  Users,
  X as CloseIcon
} from 'lucide-react'
import { addDays, endOfMonth, endOfWeek, format, getDay, isSameMonth, isSameDay, startOfMonth, startOfWeek, subDays } from 'date-fns'
import { ko } from 'date-fns/locale'
import { updatePassword } from 'firebase/auth'
import { arrayUnion, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth } from './firebase'

const PRIMARY_PINK = '#ff4d6d'
const LIGHT_PINK = '#fff0f3'
const DEFAULT_DURATION = 50

const CLASS_STATUSES = [
  { value: 'completed', label: '완료', bg: '#42c99b' },
  { value: 'holiday', label: '휴강', bg: '#3b82f6' },
  { value: 'absent', label: '결석', bg: '#ef4444' },
  { value: '', label: '초기화', bg: '#94a3b8' }
]

const buildExpectedEndTime = (startTime, duration = DEFAULT_DURATION) => {
  const [hour, minute] = String(startTime || '00:00').split(':').map(Number)
  const total = hour * 60 + minute + duration
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

const normalizeStartTime = (raw) => {
  const value = String(raw || '').trim()
  const match = value.match(/^(\d{1,2})(?::(\d{1,2}))?$/)
  if (!match) return ''

  const hour = parseInt(match[1], 10)
  const minute = parseInt(match[2] || '0', 10)
  if (Number.isNaN(hour) || Number.isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return ''

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
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

const parseLocalDate = (dateValue) => {
  const match = String(dateValue || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return new Date()
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

const getSubjectCoins = (subject) => {
  const parsed = Number(subject?.coins)
  if (Number.isNaN(parsed)) return 1
  return Math.max(0, parsed)
}

const createFixedClassTask = ({ name, weekday, startTime, duration, startDate = '', endDate = '', memo = '', coins = 0 }) => {
  const parsedWeekday = Number(typeof weekday === 'number' ? weekday : parseWeekday(weekday))
  const parsedDuration = parseInt(duration, 10)
  const parsedCoins = Number(coins)
  const normalizedStartTime = normalizeStartTime(startTime)
  const trimmedName = String(name || '').trim()
  const trimmedMemo = String(memo || '').trim()
  const trimmedStartDate = String(startDate || '').trim()
  const trimmedEndDate = String(endDate || '').trim()

  if (!trimmedName || !Number.isInteger(parsedWeekday) || parsedWeekday < 0 || parsedWeekday > 6 || !normalizedStartTime || Number.isNaN(parsedDuration) || parsedDuration <= 0) {
    return null
  }

  return {
    id: `class-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: trimmedName,
    color: '#7c9cff',
    startTime: normalizedStartTime,
    expectedEndTime: buildExpectedEndTime(normalizedStartTime, parsedDuration),
    duration: parsedDuration,
    type: 'class',
    icon: 'Book',
    completed: false,
    weekday: parsedWeekday,
    memo: trimmedMemo,
    note: trimmedMemo,
    startDate: trimmedStartDate || null,
    endDate: trimmedEndDate || null,
    classStartDate: trimmedStartDate || null,
    classEndDate: trimmedEndDate || null,
    coins: Number.isNaN(parsedCoins) ? 0 : Math.max(0, parsedCoins)
  }
}

function Dashboard({ user = {}, onLogout, allUsers = {}, cloud = {} }) {
  const isCloud = !!cloud?.db && !!cloud?.householdId
  const isAdmin = user?.role === 'admin' || user?.id === '엄마' || user?.loginId === 'yhhojt970'

  const [activeKidId, setActiveKidId] = useState('')
  const [resolvedKidDocId, setResolvedKidDocId] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 900)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const [tasks, setTasks] = useState([])
  const [messages, setMessages] = useState([])
  const [coinLogs, setCoinLogs] = useState([])
  const [studyApps, setStudyApps] = useState([])
  const [essentials, setEssentials] = useState([])
  const [rewards, setRewards] = useState([])
  const [sharedRewards, setSharedRewards] = useState([])
  const [spentCoins, setSpentCoins] = useState(0)
  const [allowanceEntries, setAllowanceEntries] = useState([])
  const [doneLogs, setDoneLogs] = useState([])

  const [showSettings, setShowSettings] = useState(false)
  const [showGoals, setShowGoals] = useState(false)
  const [showAppLauncher, setShowAppLauncher] = useState(false)
  const [showAllowanceBook, setShowAllowanceBook] = useState(false)
  const [showSurprise, setShowSurprise] = useState(false)
  const [showFamilyManager, setShowFamilyManager] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const [showClassManager, setShowClassManager] = useState(false)
  const [showCoinLedger, setShowCoinLedger] = useState(false)
  const [showAllAllowanceEntries, setShowAllAllowanceEntries] = useState(false)
  const [showAllCoinEntries, setShowAllCoinEntries] = useState(false)
  const [showAllCoinLogs, setShowAllCoinLogs] = useState(false)
  const [showDailyLog, setShowDailyLog] = useState(false)
  const [showTotalAuditLog, setShowTotalAuditLog] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [viewMonth, setViewMonth] = useState(new Date())
  const [expandedCoinGroups, setExpandedCoinGroups] = useState({})
  const [auditLogFilter, setAuditLogFilter] = useState('all') // 'all', 'study', 'coin', 'allowance'
  const [auditDateFilter, setAuditDateFilter] = useState('all') // 'all', 'today'
  const [dismissedEditRequestKey, setDismissedEditRequestKey] = useState('')
  const [requestEditDraft, setRequestEditDraft] = useState(null) // { logId, coins, status }
  const [logEditDraft, setLogEditDraft] = useState(null) // { logId, coins, status }

  const [newReward, setNewReward] = useState({ text: '', coins: 50, scope: 'shared', kidId: '' })
  const [newEssential, setNewEssential] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [messageTarget, setMessageTarget] = useState('')
  const [replyText, setReplyText] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [newAllowance, setNewAllowance] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    type: 'income',
    amount: '',
    title: '',
    memo: ''
  })
  const [bulkInput, setBulkInput] = useState('')
  const [manualClass, setManualClass] = useState({
    kidId: '',
    weekday: String(getDay(selectedDate)),
    name: '',
    startTime: '16:00',
    duration: DEFAULT_DURATION,
    coins: 0,
    startDate: '',
    endDate: '',
    memo: ''
  })
  const [classAddStatus, setClassAddStatus] = useState('')
  const [activeDragItem, setActiveDragItem] = useState(null)
  const [coinLedgerByKid, setCoinLedgerByKid] = useState({})
  const [allTasksByKid, setAllTasksByKid] = useState({})
  const [fixedSectionOpen, setFixedSectionOpen] = useState(true)
  const [fixedOpenByKid, setFixedOpenByKid] = useState({})
  const [editingClassInfo, setEditingClassInfo] = useState(null)

  const kidsList = useMemo(
    () => Object.entries(allUsers).filter(([, info]) => info?.role === 'child').map(([id]) => id),
    [allUsers]
  )
  const childOwnKidId = useMemo(() => {
    if (isAdmin) return ''
    if (user?.loginId && kidsList.includes(user.loginId)) return user.loginId
    const matched = kidsList.find((id) => {
      const info = allUsers[id] || {}
      return info.name === user?.id || info.displayName === user?.id
    })
    return matched || ''
  }, [isAdmin, user?.loginId, user?.id, kidsList, allUsers])

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 900)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (isAdmin) {
      if (!activeKidId && kidsList.length > 0) setActiveKidId(kidsList[0])
      return
    }
    if (childOwnKidId && activeKidId !== childOwnKidId) setActiveKidId(childOwnKidId)
  }, [isAdmin, activeKidId, kidsList, childOwnKidId])

  useEffect(() => {
    if (isAdmin) {
      if (activeKidId && !kidsList.includes(activeKidId)) setActiveKidId(kidsList[0] || '')
      return
    }
    if (childOwnKidId && activeKidId !== childOwnKidId) setActiveKidId(childOwnKidId)
  }, [isAdmin, activeKidId, kidsList, childOwnKidId])

  useEffect(() => {
    if (!activeKidId) return
    setDataLoaded(false)
    const info = allUsers[activeKidId] || {}
    const aliases = [activeKidId, info.name, info.displayName, info.loginId].filter(Boolean)
    const unique = [...new Set(aliases)]

    let cancelled = false
    const resolve = async () => {
      if (!isCloud) {
        setResolvedKidDocId(unique[0] || activeKidId)
        setDataLoaded(true)
        return
      }
      let firstExisting = null
      for (const id of unique) {
        const snap = await getDoc(doc(cloud.db, 'households', cloud.householdId, 'kids', id))
        if (snap.exists()) {
          const data = snap.data() || {}
          const hasData = (Array.isArray(data.tasks) && data.tasks.length > 0) ||
                          (Array.isArray(data.allowanceEntries) && data.allowanceEntries.length > 0) ||
                          (Array.isArray(data.doneLogs) && data.doneLogs.length > 0) ||
                          (Array.isArray(data.rewards) && data.rewards.length > 0) ||
                          (Array.isArray(data.essentials) && data.essentials.length > 0) ||
                          Number(data.spentCoins || 0) > 0

          if (hasData) {
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
    let cancelled = false
    const ref = doc(cloud.db, 'households', cloud.householdId, 'kids', resolvedKidDocId)

    const restoreMissingEssentialsFromAliases = async () => {
      if (!activeKidId) return
      const info = allUsers[activeKidId] || {}
      const aliases = [...new Set([activeKidId, info.name, info.displayName, info.loginId].filter(Boolean))]
        .filter((alias) => alias !== resolvedKidDocId)
      const restored = []
      const seenNames = new Set()

      for (const alias of aliases) {
        const aliasSnap = await getDoc(doc(cloud.db, 'households', cloud.householdId, 'kids', alias))
        if (!aliasSnap.exists()) continue

        const aliasEssentials = Array.isArray(aliasSnap.data()?.essentials) ? aliasSnap.data().essentials : []
        aliasEssentials.forEach((item) => {
          const name = String(item?.name || '').trim()
          if (!name || seenNames.has(name)) return
          seenNames.add(name)
          restored.push({
            id: item?.id || `essential-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name
          })
        })
      }

      if (cancelled || restored.length === 0) return
      setEssentials(restored)
      await setDoc(
        doc(cloud.db, 'households', cloud.householdId, 'kids', resolvedKidDocId),
        { essentials: restored, updatedAt: serverTimestamp() },
        { merge: true }
      )
    }

    const unsubscribe = onSnapshot(ref, (snap) => {
      const data = snap.exists() ? snap.data() : {}
      const nextEssentials = Array.isArray(data?.essentials) ? data.essentials : []
      setTasks(Array.isArray(data?.tasks) ? data.tasks : [])
      setRewards(Array.isArray(data?.rewards) ? data.rewards : [])
      setEssentials(nextEssentials)
      setSpentCoins(Number(data?.spentCoins || 0))
      setAllowanceEntries(Array.isArray(data?.allowanceEntries) ? data.allowanceEntries : [])
      setDoneLogs(Array.isArray(data?.doneLogs) ? data.doneLogs : [])
      setDataLoaded(true)

      if (nextEssentials.length === 0) {
        restoreMissingEssentialsFromAliases().catch(console.error)
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [resolvedKidDocId, activeKidId, allUsers, isCloud, cloud?.db, cloud?.householdId])

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
    const unsubCoinLogs = onSnapshot(
      doc(cloud.db, 'households', cloud.householdId, 'meta', 'coinLogs'),
      (snap) => setCoinLogs(snap.exists() ? snap.data().logs || [] : [])
    )
    const unsubSharedRewards = onSnapshot(
      doc(cloud.db, 'households', cloud.householdId, 'meta', 'sharedRewards'),
      (snap) => setSharedRewards(snap.exists() ? snap.data().rewards || [] : [])
    )
    return () => {
      unsubMessages()
      unsubApps()
      unsubCoinLogs()
      unsubSharedRewards()
    }
  }, [isCloud, cloud?.db, cloud?.householdId])

  useEffect(() => {
    if (!dataLoaded) return
    if (tasks.length > 0) {
      const legacyToMigrate = tasks.filter(t => t.completed && t.date && !doneLogs.some(l => String(l.taskId) === String(t.id) && l.date === t.date));
      if (legacyToMigrate.length > 0) {
        const newLogs = legacyToMigrate.map(t => ({
          id: `${t.id}-${t.date}`,
          taskId: t.id,
          name: t.name,
          type: t.type,
          date: t.date,
          status: 'completed',
          coins: getTaskCoins(t),
          timestamp: Date.now()
        }));
        const nextLogs = [...doneLogs, ...newLogs];
        setDoneLogs(nextLogs);
        persistKidState({ doneLogs: nextLogs });
      }
    }
  }, [tasks, doneLogs]);

  const handleDeleteApp = async (appId) => {
    if (!window.confirm('이 앱을 삭제할까요?')) return
    const next = studyApps.filter((a) => a.id !== appId)
    await setDoc(doc(cloud.db, 'households', cloud.householdId, 'meta', 'apps'), { apps: next, updatedAt: serverTimestamp() }, { merge: true })
  }

  const persistKidState = async (overrides = {}) => {
    if (!isCloud || !resolvedKidDocId || !dataLoaded) return
    await setDoc(
      doc(cloud.db, 'households', cloud.householdId, 'kids', resolvedKidDocId),
      { tasks, rewards, essentials, spentCoins, allowanceEntries, doneLogs, ...overrides, updatedAt: serverTimestamp() },
      { merge: true }
    )
  }

  const mergeMetaDoc = async (docId, payload) => {
    if (!isCloud) return
    await setDoc(doc(cloud.db, 'households', cloud.householdId, 'meta', docId), payload, { merge: true })
  }

  const giftCoins = async (amount, memo = '') => {
    if (!isAdmin || !amount || amount <= 0) return
    const now = new Date()
    const logId = `gift-${Date.now()}`
    const newLog = {
      id: logId,
      taskId: 'gift',
      name: `엄마의 선물${memo ? `: ${memo}` : ''}`,
      type: 'gift',
      date: todayStr,
      status: 'completed',
      coins: Number(amount),
      timestamp: Date.now(),
      createdAtLabel: format(now, 'yyyy-MM-dd HH:mm')
    }
    const nextLogs = [...doneLogs, newLog]
    setDoneLogs(nextLogs)
    await persistKidState({ doneLogs: nextLogs })
    await appendCoinLog({
      kidId: activeKidId,
      subjectName: `엄마의 선물 (${amount}코인)`,
      beforeCoins: availableCoins,
      afterCoins: availableCoins + amount
    })
  }

  const deleteDoneLog = async (logId) => {
    if (!isAdmin) return
    const logToDelete = doneLogs.find(l => l.id === logId)
    if (!logToDelete) return
    
    if (!window.confirm(`'${logToDelete.name}' 기록을 삭제할까요? 관련 코인도 회수됩니다.`)) return
    
    const nextLogs = doneLogs.filter(l => l.id !== logId)
    const nextTasks = logToDelete.type === 'class'
      ? tasks
      : tasks.map((task) => {
          if (String(task.id) !== String(logToDelete.taskId) || (task.date && logToDelete.date && task.date !== logToDelete.date)) return task
          return {
            ...task,
            completed: false,
            status: '',
            startTimeActual: '',
            actualStartTime: '',
            endTimeActual: '',
            actualEndTime: '',
            durationActual: 0,
            actualDuration: 0,
            durationMinutes: 0
          }
        })
    setDoneLogs(nextLogs)
    if (nextTasks !== tasks) setTasks(nextTasks)
    await persistKidState({ doneLogs: nextLogs, tasks: nextTasks })
    
    if (logToDelete.coins > 0) {
      await appendCoinLog({
        kidId: activeKidId,
        subjectName: `기록 삭제: ${logToDelete.name}`,
        beforeCoins: availableCoins,
        afterCoins: availableCoins - logToDelete.coins
      })
    }
  }

  const appendCoinLog = async ({ kidId, subjectName, beforeCoins, afterCoins, actionType = 'change' }) => {
    if (!isCloud) return
    const now = new Date()
    await mergeMetaDoc('coinLogs', {
      logs: arrayUnion({
        id: Date.now() + Math.floor(Math.random() * 1000),
        kidId,
        subjectName,
        beforeCoins,
        afterCoins,
        actionType,
        date: format(now, 'yyyy-MM-dd'),
        createdAt: now.toISOString(),
        createdAtLabel: format(now, 'yyyy-MM-dd HH:mm')
      }),
      updatedAt: serverTimestamp()
    })
  }

  const deleteCoinLog = async (logId) => {
    if (!isAdmin || !isCloud) return
    const logToDelete = coinLogs.find(l => l.id === logId)
    if (!logToDelete) return
    if (!window.confirm('이 코인 변경 로그를 삭제할까요? (실제 코인 잔액에는 영향을 주지 않으며 기록만 삭제됩니다.)')) return
    
    const next = coinLogs.filter(l => l.id !== logId)
    await setDoc(doc(cloud.db, 'households', cloud.householdId, 'meta', 'coinLogs'), { logs: next, updatedAt: serverTimestamp() }, { merge: true })
  }

  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(selectedDate, { weekStartsOn: 1 }), index))
  const todayStr = format(selectedDate, 'yyyy-MM-dd')

  const todayTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (task.type !== 'class') return task.date === todayStr
        const classStart = task.startDate || task.classStartDate || ''
        const classEnd = task.endDate || task.classEndDate || ''
        if (classStart && todayStr < classStart) return false
        if (classEnd && todayStr > classEnd) return false
        if (task.weekday !== undefined && task.weekday !== null && task.weekday !== '') {
          return Number(task.weekday) === getDay(selectedDate)
        }
        if (task.date) return task.date === todayStr
        return true
      }),
    [tasks, selectedDate, todayStr]
  )

  const getTaskCoins = (task) => {
    if (!task) return 0
    const hasCoins = task?.coins !== undefined && task?.coins !== null && task?.coins !== ''
    const parsedCoins = Number(task?.coins)
    if (hasCoins && !Number.isNaN(parsedCoins)) return parsedCoins
    return task?.type === 'study' ? 1 : 0
  }

  const availableCoins = useMemo(() => {
    const logCoins = doneLogs.reduce((sum, log) => sum + Number(log.coins || 0), 0)
    // Legacy support: count tasks that are completed but not in doneLogs
    const legacyCoins = tasks
      .filter((task) => task.completed && task.date && !doneLogs.some((log) => String(log.taskId) === String(task.id) && log.date === task.date))
      .reduce((sum, task) => sum + getTaskCoins(task), 0)
    return logCoins + legacyCoins - spentCoins
  }, [doneLogs, tasks, spentCoins])

  const weekMonthReport = useMemo(() => {
    const year = selectedDate.getFullYear()
    const month = selectedDate.getMonth()
    const currentWeek = format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    
    const weekLogs = doneLogs.filter((log) => {
      const date = new Date(log.date)
      return !Number.isNaN(date.getTime()) && format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd') === currentWeek
    })
    const monthLogs = doneLogs.filter((log) => {
      const date = new Date(log.date)
      return !Number.isNaN(date.getTime()) && date.getFullYear() === year && date.getMonth() === month
    })

    const legacyCompleted = tasks.filter((task) => task.completed && task.date && !doneLogs.some((log) => String(log.taskId) === String(task.id) && log.date === task.date))
    const weekLegacy = legacyCompleted.filter((task) => {
      const date = new Date(task.date)
      return !Number.isNaN(date.getTime()) && format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd') === currentWeek
    })
    const monthLegacy = legacyCompleted.filter((task) => {
      const date = new Date(task.date)
      return !Number.isNaN(date.getTime()) && date.getFullYear() === year && date.getMonth() === month
    })
    
    return {
      weekCoins: weekLogs.reduce((sum, log) => sum + Number(log.coins || 0), 0) + weekLegacy.reduce((sum, task) => sum + getTaskCoins(task), 0),
      weekCount: weekLogs.length + weekLegacy.length,
      monthCoins: monthLogs.reduce((sum, log) => sum + Number(log.coins || 0), 0) + monthLegacy.reduce((sum, task) => sum + getTaskCoins(task), 0),
      monthCount: monthLogs.length + monthLegacy.length
    }
  }, [doneLogs, tasks, selectedDate])

  const weekdayLabels = ['일', '월', '화', '수', '목', '금', '토']

  const allowanceSummary = useMemo(() => {
    const totalIncome = allowanceEntries
      .filter((entry) => entry.type === 'income')
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
    const totalExpense = allowanceEntries
      .filter((entry) => entry.type === 'expense')
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense
    }
  }, [allowanceEntries])

  const isMessageForActiveKid = (kidId) => {
    const info = allUsers[activeKidId] || {}
    const aliases = [activeKidId, info.loginId, info.name, info.displayName].filter(Boolean)
    return aliases.includes(kidId)
  }

  const messagesForKid = messages.filter((message) => isMessageForActiveKid(message.kidId) && message.kind !== 'system')
  const todayMessagesForKid = messagesForKid.filter((message) => message.date === todayStr)
  const unreadMessage = messagesForKid.find((message) => !message.read)
  const hasReadToday = todayMessagesForKid.some((message) => message.read)
  const unreadRepliesForAdmin = useMemo(
    () => messages.filter((message) => message.reply && !message.replyReadByAdmin).length,
    [messages]
  )

  const coinChangeLogsForView = useMemo(() => {
    const info = allUsers[activeKidId] || {}
    const aliases = new Set([activeKidId, info.loginId, info.name, info.displayName].filter(Boolean))
    return coinLogs.filter((log) => aliases.has(log.kidId))
  }, [coinLogs, activeKidId, allUsers])

  const getFullName = (id) => allUsers[id]?.displayName || allUsers[id]?.name || id

  const buildCoinEntries = (logList = [], taskList = []) => {
    const seenTaskDates = new Set()
    const logEntries = (logList || [])
      .filter((log) => log?.status === 'completed' && Number(log.coins || 0) > 0)
      .map((log) => {
        seenTaskDates.add(`${log.taskId || ''}-${log.date || ''}`)
        return {
          id: log.id || `${log.taskId || log.name}-${log.date || ''}`,
          date: log.date || '',
          title: log.name || '코인',
          coins: Number(log.coins || 0)
        }
      })

    const legacyEntries = (taskList || [])
      .filter((task) => task.completed && getTaskCoins(task) > 0)
      .filter((task) => !seenTaskDates.has(`${task.id || ''}-${task.date || ''}`))
      .map((task) => ({
        id: task.id || `${task.name}-${task.date || ''}-${task.startTime || ''}`,
        date: task.date || '',
        title: task.name || '학습',
        coins: getTaskCoins(task)
      }))

    return [...logEntries, ...legacyEntries]
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  }

  const loadCoinLedger = async () => {
    if (!isCloud) {
      setCoinLedgerByKid({ [activeKidId]: buildCoinEntries(doneLogs, tasks) })
      return
    }

    const targetKids = [activeKidId].filter(Boolean)
    const result = {}

    for (const kidId of targetKids) {
      const info = allUsers[kidId] || {}
      const aliases = [...new Set([kidId, info.loginId, info.name, info.displayName].filter(Boolean))]
      const mergedTasks = []
      const mergedLogs = []
      const seenTaskKeys = new Set()
      const seenLogKeys = new Set()
      for (const alias of aliases) {
        const snap = await getDoc(doc(cloud.db, 'households', cloud.householdId, 'kids', alias))
        if (snap.exists()) {
          const data = snap.data() || {}
          if (Array.isArray(data.doneLogs)) {
            data.doneLogs.forEach((log) => {
              const key = String(log?.id || `${log?.taskId || ''}-${log?.date || ''}-${log?.name || ''}`)
              if (seenLogKeys.has(key)) return
              seenLogKeys.add(key)
              mergedLogs.push(log)
            })
          }
          if (Array.isArray(data.tasks)) {
            data.tasks.forEach((task) => {
              const key = String(task?.id || `${task?.date || ''}-${task?.name || ''}-${task?.startTime || ''}-${task?.expectedEndTime || ''}`)
              if (seenTaskKeys.has(key)) return
              seenTaskKeys.add(key)
              mergedTasks.push(task)
            })
          }
        }
      }
      result[kidId] = buildCoinEntries(mergedLogs, mergedTasks)
    }

    setCoinLedgerByKid(result)
  }

  const openCoinLedger = async () => {
    try {
      await loadCoinLedger()
    } catch (error) {
      console.error(error)
    } finally {
      setShowCoinLedger(true)
    }
  }

  const getKidAliases = (kidId) => {
    const info = allUsers[kidId] || {}
    return [...new Set([kidId, info.loginId, info.name, info.displayName].filter(Boolean))]
  }

  const loadAllKidTasksForAdmin = async () => {
    if (!isAdmin) return
    if (!isCloud) {
      setAllTasksByKid({ [activeKidId]: tasks })
      return
    }
    const taskMap = {}
    for (const kidId of kidsList) {
      const aliases = getKidAliases(kidId)
      let found = []
      for (const alias of aliases) {
        const snap = await getDoc(doc(cloud.db, 'households', cloud.householdId, 'kids', alias))
        if (snap.exists()) {
          const data = snap.data() || {}
          if (Array.isArray(data.tasks)) {
            found = data.tasks
            if (data.tasks.length > 0) break
          }
        }
      }
      taskMap[kidId] = found
    }
    setAllTasksByKid(taskMap)
    setFixedOpenByKid((prev) => {
      const next = { ...prev }
      kidsList.forEach((kidId) => {
        if (typeof next[kidId] !== 'boolean') next[kidId] = true
      })
      return next
    })
  }

  const updateFixedClassTask = async (kidId, taskId, patch, scope = 'all') => {
    const currentTasks = allTasksByKid[kidId] || (kidId === activeKidId ? tasks : [])
    const targetTask = currentTasks.find(t => String(t.id) === String(taskId))
    if (!targetTask) return
    const normalizedPatch = { ...patch }
    if (normalizedPatch.coins !== undefined) {
      const parsedCoins = Number(normalizedPatch.coins)
      normalizedPatch.coins = Number.isNaN(parsedCoins) ? getTaskCoins(targetTask) : Math.max(0, parsedCoins)
    }

    let nextTasks = currentTasks
    const nowStr = format(new Date(), 'yyyy-MM-dd')
    const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd')

    if (scope === 'today_onwards' || scope === 'tomorrow_onwards') {
      const splitDate = scope === 'today_onwards' ? nowStr : format(addDays(new Date(), 1), 'yyyy-MM-dd')
      const capDate = scope === 'today_onwards' ? yesterdayStr : nowStr

      // Update old task to end
      nextTasks = currentTasks.map(t => (String(t.id) === String(taskId) ? { ...t, endDate: capDate, classEndDate: capDate } : t))
      
      // Create new task from today/tomorrow
      const newTask = {
        ...targetTask,
        ...normalizedPatch,
        id: `class-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        startDate: splitDate,
        classStartDate: splitDate,
        endDate: null,
        classEndDate: null
      }
      nextTasks.push(newTask)
    } else {
      // Default: 'all'
      nextTasks = currentTasks.map((task) => (String(task.id) === String(taskId) ? { ...task, ...normalizedPatch } : task))
    }

    setAllTasksByKid((prev) => ({ ...prev, [kidId]: nextTasks }))
    let targetDocId = kidId
    if (isCloud) {
      targetDocId = await getKidDocIdForWrite(kidId)
      await setDoc(
        doc(cloud.db, 'households', cloud.householdId, 'kids', targetDocId),
        { tasks: nextTasks, updatedAt: serverTimestamp() },
        { merge: true }
      )
    }
    if (kidId === activeKidId || targetDocId === resolvedKidDocId) setTasks(nextTasks)

    if (patch.coins !== undefined && Number(patch.coins) !== getTaskCoins(targetTask)) {
      await appendCoinLog({
        kidId,
        subjectName: `고정수업 코인 수정: ${targetTask.name} (${scope})`,
        beforeCoins: Number(targetTask.coins || 0),
        afterCoins: Number(patch.coins),
        actionType: 'template_change'
      })
    }
  }

  const deleteFixedClassTask = async (kidId, taskId) => {
    const currentTasks = allTasksByKid[kidId] || (kidId === activeKidId ? tasks : [])
    const nextTasks = currentTasks.filter((task) => String(task.id) !== String(taskId))
    setAllTasksByKid((prev) => ({ ...prev, [kidId]: nextTasks }))
    let targetDocId = kidId
    if (isCloud) {
      targetDocId = await getKidDocIdForWrite(kidId)
      await setDoc(
        doc(cloud.db, 'households', cloud.householdId, 'kids', targetDocId),
        { tasks: nextTasks, updatedAt: serverTimestamp() },
        { merge: true }
      )
    }
    if (kidId === activeKidId || targetDocId === resolvedKidDocId) setTasks(nextTasks)
  }

  const handleSendReply = async () => {
    if (!replyText || !unreadMessage) return
    const next = messages.map((message) => (message.id === unreadMessage.id ? { ...message, reply: replyText, read: true, replyReadByAdmin: false } : message))
    await mergeMetaDoc('messages', { messages: next, updatedAt: serverTimestamp() })
    setReplyText('')
    setShowSurprise(false)
  }

  const handleChangePassword = async () => {
    const next = String(newPassword || '')
    const confirm = String(confirmPassword || '')
    if (next.length < 6) {
      alert('새 비밀번호는 6자 이상이어야 해요.')
      return
    }
    if (next !== confirm) {
      alert('비밀번호 확인이 일치하지 않아요.')
      return
    }
    if (!auth.currentUser) {
      alert('로그인 정보를 다시 확인해 주세요.')
      return
    }
    try {
      await updatePassword(auth.currentUser, next)
      setNewPassword('')
      setConfirmPassword('')
      alert('비밀번호가 변경되었어요.')
    } catch (error) {
      console.error(error)
      alert('비밀번호 변경에 실패했어요. 다시 로그인 후 시도해 주세요.')
    }
  }

  const handleAddAllowance = async () => {
    const title = String(newAllowance.title || '').trim()
    const amount = Number(newAllowance.amount || 0)
    if (!title || amount <= 0) return
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date: newAllowance.date || format(new Date(), 'yyyy-MM-dd'),
      type: newAllowance.type === 'expense' ? 'expense' : 'income',
      amount,
      title,
      memo: String(newAllowance.memo || '').trim()
    }
    const next = [...allowanceEntries, entry]
    setAllowanceEntries(next)
    await persistKidState({ allowanceEntries: next })
    setNewAllowance((prev) => ({ ...prev, amount: '', title: '', memo: '' }))
  }

  const handleDeleteAllowance = async (id) => {
    const next = allowanceEntries.filter((entry) => entry.id !== id)
    setAllowanceEntries(next)
    await persistKidState({ allowanceEntries: next })
  }

  const getKidDocIdForWrite = async (kidId) => {
    const aliases = getKidAliases(kidId)
    if (!isCloud) return aliases[0] || kidId
    for (const alias of aliases) {
      const snap = await getDoc(doc(cloud.db, 'households', cloud.householdId, 'kids', alias))
      if (snap.exists()) return alias
    }
    return aliases[0] || kidId
  }

  const appendFixedClassesForKid = async (kidId, classItems) => {
    const targetKidId = kidId || activeKidId || kidsList[0]
    if (!targetKidId || classItems.length === 0) return

    if (!isCloud) {
      const currentTasks = targetKidId === activeKidId ? tasks : (allTasksByKid[targetKidId] || [])
      const nextTasks = [...currentTasks, ...classItems]
      setAllTasksByKid((prev) => ({ ...prev, [targetKidId]: nextTasks }))
      if (targetKidId === activeKidId) setTasks(nextTasks)
      return
    }

    const targetDocId = await getKidDocIdForWrite(targetKidId)
    const snap = await getDoc(doc(cloud.db, 'households', cloud.householdId, 'kids', targetDocId))
    const kidData = snap.exists() ? snap.data() : {}
    const currentTasks = Array.isArray(kidData?.tasks) ? kidData.tasks : (allTasksByKid[targetKidId] || [])
    const nextTasks = [...currentTasks, ...classItems]

    await setDoc(
      doc(cloud.db, 'households', cloud.householdId, 'kids', targetDocId),
      { tasks: nextTasks, updatedAt: serverTimestamp() },
      { merge: true }
    )

    setAllTasksByKid((prev) => ({ ...prev, [targetKidId]: nextTasks }))
    if (targetKidId === activeKidId || targetDocId === resolvedKidDocId) setTasks(nextTasks)
  }

  const addReward = async () => {
    const text = String(newReward.text || '').trim()
    const coins = Math.max(0, Number(newReward.coins || 0))
    const scope = newReward.scope === 'kid' ? 'kid' : 'shared'
    if (!text || coins <= 0) return

    const reward = {
      id: `reward-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text,
      coins,
      scope,
      kidId: scope === 'kid' ? (newReward.kidId || activeKidId) : null
    }

    if (scope === 'shared') {
      const next = [...sharedRewards, reward]
      setSharedRewards(next)
      await mergeMetaDoc('sharedRewards', { rewards: next, updatedAt: serverTimestamp() })
    } else {
      const targetKidId = reward.kidId || activeKidId
      const targetDocId = await getKidDocIdForWrite(targetKidId)
      const snap = await getDoc(doc(cloud.db, 'households', cloud.householdId, 'kids', targetDocId))
      const kidData = snap.exists() ? snap.data() : {}
      const currentRewards = Array.isArray(kidData?.rewards) ? kidData.rewards : []
      const next = [...currentRewards, reward]
      await setDoc(
        doc(cloud.db, 'households', cloud.householdId, 'kids', targetDocId),
        { rewards: next, updatedAt: serverTimestamp() },
        { merge: true }
      )
      if (targetKidId === activeKidId || targetDocId === resolvedKidDocId) setRewards(next)
    }

    setNewReward({ text: '', coins: 50, scope: 'shared', kidId: '' })
  }

  const spendRewardForKid = async (reward, kidId) => {
    const targetDocId = await getKidDocIdForWrite(kidId)
    const snap = await getDoc(doc(cloud.db, 'households', cloud.householdId, 'kids', targetDocId))
    if (!snap.exists()) return
    const kidData = snap.data() || {}
    const kidTasks = Array.isArray(kidData.tasks) ? kidData.tasks : []
    const kidDoneLogs = Array.isArray(kidData.doneLogs) ? kidData.doneLogs : []
    const loggedTaskDates = new Set(kidDoneLogs.map((log) => `${log.taskId || ''}-${log.date || ''}`))
    const completedCoins = kidDoneLogs
      .reduce((sum, log) => sum + Number(log.coins || 0), 0) + kidTasks
      .filter((task) => task.completed && getTaskCoins(task) > 0)
      .filter((task) => !loggedTaskDates.has(`${task.id || ''}-${task.date || ''}`))
      .reduce((sum, task) => sum + getTaskCoins(task), 0)
    const currentSpent = Number(kidData.spentCoins || 0)
    const currentAvailable = completedCoins - currentSpent
    if (currentAvailable < reward.coins) {
      alert(`${getFullName(kidId)}의 코인이 부족해요. (현재 ${currentAvailable})`)
      return
    }
    const nextSpent = currentSpent + reward.coins
    await setDoc(
      doc(cloud.db, 'households', cloud.householdId, 'kids', targetDocId),
      { spentCoins: nextSpent, updatedAt: serverTimestamp() },
      { merge: true }
    )
    if (kidId === activeKidId || targetDocId === resolvedKidDocId) setSpentCoins(nextSpent)
    await appendCoinLog({
      kidId,
      subjectName: `보상 지급: ${reward.text}`,
      beforeCoins: currentAvailable,
      afterCoins: currentAvailable - reward.coins
    })
  }

  useEffect(() => {
    if (!isAdmin || !showFamilyManager || unreadRepliesForAdmin === 0 || !isCloud) return
    const run = async () => {
      const next = messages.map((message) => (message.reply && !message.replyReadByAdmin ? { ...message, replyReadByAdmin: true } : message))
      await mergeMetaDoc('messages', { messages: next, updatedAt: serverTimestamp() })
    }
    run().catch(console.error)
  }, [isAdmin, showFamilyManager, unreadRepliesForAdmin, isCloud, messages])

  useEffect(() => {
    if (!isAdmin || !showClassManager) return
    loadAllKidTasksForAdmin().catch(console.error)
  }, [isAdmin, showClassManager, kidsList.join('|')])

  useEffect(() => {
    if (!showAllowanceBook) setShowAllAllowanceEntries(false)
  }, [showAllowanceBook])

  useEffect(() => {
    if (!showCoinLedger) {
      setShowAllCoinEntries(false)
      setShowAllCoinLogs(false)
    }
  }, [showCoinLedger])

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
      coins: getSubjectCoins(subject)
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

      const [kidRaw, dayRaw, subjectRaw, timeRaw, durationRaw, startDateRaw = '', endDateRaw = '', memoRaw = '', coinsRaw = '0'] = cols
      const kidId = kidsList.find((id) => {
        const name = getFullName(id)
        return name.includes(kidRaw) || kidRaw.includes(name)
      }) || activeKidId

      const task = createFixedClassTask({
        name: subjectRaw,
        weekday: dayRaw,
        startTime: timeRaw,
        duration: durationRaw,
        startDate: startDateRaw,
        endDate: endDateRaw,
        memo: memoRaw,
        coins: coinsRaw
      })
      if (!task) return

      if (!byKid.has(kidId)) byKid.set(kidId, [])
      byKid.get(kidId).push(task)
    })

    if (byKid.size === 0) {
      alert('붙여넣기 형식을 확인해 주세요: 이름\t요일\t과목명\t시간\t분')
      return
    }

    for (const [kidId, items] of byKid.entries()) {
      await appendFixedClassesForKid(kidId, items)
    }

    setBulkInput('')
    setClassAddStatus('고정수업을 등록했어요.')
    setShowClassManager(false)
  }

  const handleManualClassAdd = async () => {
    const targetKidId = manualClass.kidId || activeKidId || kidsList[0]
    const task = createFixedClassTask(manualClass)
    if (!targetKidId || !task) {
      alert('아이, 요일, 과목명, 시작시간, 수업시간을 확인해 주세요.')
      return
    }

    await appendFixedClassesForKid(targetKidId, [task])
    setManualClass((prev) => ({
      ...prev,
      kidId: targetKidId,
      name: '',
      memo: '',
      coins: 0,
      startDate: '',
      endDate: ''
    }))
    setClassAddStatus(`${getFullName(targetKidId)} 고정수업을 등록했어요.`)
  }

  const fixedClassesByKid = useMemo(() => {
    const source = isAdmin ? allTasksByKid : { [activeKidId]: tasks }
    const next = {}
    Object.entries(source || {}).forEach(([kidId, list]) => {
      next[kidId] = (list || [])
        .filter((task) => task?.type === 'class')
        .sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')))
    })
    return next
  }, [isAdmin, allTasksByKid, activeKidId, tasks])

  const pendingEditRequests = useMemo(
    () => doneLogs.filter((log) => log.editRequested),
    [doneLogs]
  )
  const editRequestKey = pendingEditRequests.map((log) => log.id).sort().join('|')
  const shouldShowEditRequestPopup = isAdmin && pendingEditRequests.length > 0 && editRequestKey !== dismissedEditRequestKey && !showDailyLog

  const dailyActivityLogs = useMemo(
    () => doneLogs.filter((log) => log.date === todayStr && log.type !== 'gift'),
    [doneLogs, todayStr]
  )

  const orphanedVirtualTasks = useMemo(() =>
    dailyActivityLogs
      .filter(log => !todayTasks.some(task => String(task.id) === String(log.taskId)))
      .map(log => ({
        id: log.taskId,
        name: log.name,
        type: log.type || 'study',
        date: log.date,
        startTime: log.startTimeActual || '07:00',
        duration: log.durationActual || 30,
        expectedEndTime: log.endTimeActual || '07:30',
        completed: true,
        status: log.status,
        coins: Number(log.coins || 0),
        _isOrphanedLog: true
      })),
    [dailyActivityLogs, todayTasks]
  )
  const dailyGiftLogs = useMemo(
    () => doneLogs.filter((log) => log.date === todayStr && log.type === 'gift'),
    [doneLogs, todayStr]
  )
  const dailyCoinLogs = useMemo(
    () => coinChangeLogsForView.filter((log) => log.date === todayStr),
    [coinChangeLogsForView, todayStr]
  )
  const dailyAllowanceLogs = useMemo(
    () => allowanceEntries.filter((entry) => entry.date === todayStr),
    [allowanceEntries, todayStr]
  )

  const focusTaskFromLog = (log) => {
    if (!log?.date) return
    setSelectedDate(parseLocalDate(log.date))
    setShowDailyLog(false)
    setTimeout(() => {
      document.getElementById(`task-${log.taskId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 150)
  }

  const resolveEditRequest = (logId) => {
    setDoneLogs(prev => prev.map((l) => l.id === logId ? { ...l, editRequested: false } : l))
  }

  const appendEditAuditLog = async (log, oldCoins, newCoins, status, labelPrefix) => {
    const coinDelta = newCoins - oldCoins
    const labelParts = []
    if (status !== log.status) labelParts.push(`상태: ${getStatusLabel(log.status) || '없음'} → ${getStatusLabel(status) || '초기화'}`)
    if (coinDelta !== 0) labelParts.push(`코인: ${oldCoins} → ${newCoins}`)
    if (labelParts.length === 0) return
    await appendCoinLog({
      kidId: activeKidId,
      subjectName: `${labelPrefix}: ${log.name} (${log.date}) · ${labelParts.join(', ')}`,
      beforeCoins: availableCoins,
      afterCoins: availableCoins + coinDelta,
      actionType: 'log_edit'
    })
  }

  const saveRequestEdit = async () => {
    if (!requestEditDraft) return
    const { logId, coins, status } = requestEditDraft
    const log = doneLogs.find(l => l.id === logId)
    if (!log) return
    const newCoins = Number(coins)
    const nextLogs = doneLogs.map(l =>
      l.id === logId ? { ...l, coins: newCoins, status, editRequested: false } : l
    )
    setDoneLogs(nextLogs)
    setRequestEditDraft(null)
    await persistKidState({ doneLogs: nextLogs })
    await appendEditAuditLog(log, Number(log.coins || 0), newCoins, status, '수정요청 처리')
  }

  const saveLogEdit = async () => {
    if (!logEditDraft) return
    const { logId, coins, status } = logEditDraft
    const log = doneLogs.find(l => l.id === logId)
    if (!log) return
    const newCoins = Number(coins)
    const prevCoins = Number(log.coins || 0)
    const coinHistory = prevCoins !== newCoins
      ? [...(log.coinHistory || []), { from: prevCoins, to: newCoins, changedAt: format(new Date(), 'yyyy-MM-dd') }]
      : (log.coinHistory || [])
    const nextLogs = doneLogs.map(l =>
      l.id === logId ? { ...l, coins: newCoins, status, coinHistory } : l
    )
    let nextTasks = tasks
    if (log.type !== 'class' && status === '' && log.status !== '') {
      nextTasks = tasks.map(t =>
        String(t.id) === String(log.taskId) && t.date === log.date
          ? { ...t, completed: false, status: '', startTimeActual: '', actualStartTime: '', endTimeActual: '', actualEndTime: '', durationActual: 0, actualDuration: 0, durationMinutes: 0 }
          : t
      )
    }
    setDoneLogs(nextLogs)
    if (nextTasks !== tasks) setTasks(nextTasks)
    setLogEditDraft(null)
    await persistKidState({ doneLogs: nextLogs, tasks: nextTasks })
    await appendEditAuditLog(log, Number(log.coins || 0), newCoins, status, '기록 수정')
  }

  const grantAutoCompletedCoins = async (log) => {
    const task = tasks.find(t => String(t.id) === String(log.taskId))
    const newCoins = getTaskCoins(task)
    const nextLogs = doneLogs.map(l =>
      l.id === log.id ? { ...l, coins: newCoins, autoCompleted: false } : l
    )
    setDoneLogs(nextLogs)
    await persistKidState({ doneLogs: nextLogs })
    await appendCoinLog({
      kidId: activeKidId,
      subjectName: `자동완료 코인 적립: ${log.name} (${log.date}) · 0 → ${newCoins}`,
      beforeCoins: availableCoins,
      afterCoins: availableCoins + newCoins,
      actionType: 'log_edit'
    })
  }

  const openFullSettingEdit = (log) => {
    setLogEditDraft(null)
    setShowDailyLog(false)
    if (log.type === 'class') {
      const task = tasks.find(t => String(t.id) === String(log.taskId))
      if (task) setEditingClassInfo({ ...task, kidId: activeKidId })
    } else {
      setShowPalette(true)
    }
  }

  const getStatusLabel = (status) => ({
    completed: '완료',
    holiday: '휴강',
    absent: '결석',
    studying: '진행 중'
  }[status] || status || '기록')

  const rewardsForView = useMemo(() => {
    const kidRewards = (rewards || []).map((reward) => ({
      ...reward,
      scope: reward.scope || 'kid',
      kidId: reward.kidId || activeKidId
    }))
    return [...(sharedRewards || []), ...kidRewards]
  }, [sharedRewards, rewards, activeKidId])

  const glassStyle = {
    background: 'rgba(255,255,255,0.7)',
    backdropFilter: 'blur(15px)',
    WebkitBackdropFilter: 'blur(15px)',
    border: '1px solid rgba(255,255,255,0.3)'
  }

  const patchManualClass = (patch) => {
    setManualClass((prev) => ({ ...prev, ...patch }))
    if (classAddStatus) setClassAddStatus('')
  }

  const openSubjectManager = () => {
    setShowClassManager(false)
    setShowPalette((prev) => !prev)
  }

  const openFixedClassManager = () => {
    setShowPalette(false)
    setShowClassManager(true)
  }

  const renderFixedClassRegistrationPanel = ({ showBulk = true } = {}) => {
    const selectedManualKidId = manualClass.kidId || activeKidId || kidsList[0] || ''

    return (
      <div style={{ display: 'grid', gap: '10px' }}>
        <div style={{ background: '#fff9fb', border: '1px solid #ffe1ea', borderRadius: '18px', padding: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 900, marginBottom: '8px', color: PRIMARY_PINK }}>한 건 입력</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
            <select className="input-field" value={selectedManualKidId} onChange={(event) => patchManualClass({ kidId: event.target.value })} style={{ fontSize: '13px', height: '42px', padding: '0 10px' }}>
              <option value="" disabled>아이 선택</option>
              {kidsList.map((kidId) => (
                <option key={kidId} value={kidId}>{getFullName(kidId)}</option>
              ))}
            </select>
            <select className="input-field" value={manualClass.weekday} onChange={(event) => patchManualClass({ weekday: event.target.value })} style={{ fontSize: '13px', height: '42px', padding: '0 10px' }}>
              {weekdayLabels.map((label, index) => (
                <option key={label} value={String(index)}>{label}요일</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr', gap: '6px', marginBottom: '6px' }}>
            <input className="input-field" placeholder="과목명" value={manualClass.name} onChange={(event) => patchManualClass({ name: event.target.value })} style={{ fontSize: '13px', height: '42px', padding: '0 10px' }} />
            <input className="input-field" type="time" value={manualClass.startTime} onChange={(event) => patchManualClass({ startTime: event.target.value })} style={{ fontSize: '13px', height: '42px', padding: '0 10px' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
            <input className="input-field" type="number" min="1" placeholder="시간(분)" value={manualClass.duration} onChange={(event) => patchManualClass({ duration: event.target.value })} style={{ fontSize: '13px', height: '42px', padding: '0 10px' }} />
            <input className="input-field" type="number" min="0" placeholder="코인" value={manualClass.coins} onChange={(event) => patchManualClass({ coins: event.target.value })} style={{ fontSize: '13px', height: '42px', padding: '0 10px' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
            <input className="input-field" type="date" value={manualClass.startDate} onChange={(event) => patchManualClass({ startDate: event.target.value })} style={{ fontSize: '13px', height: '42px', padding: '0 10px' }} title="시작일" />
            <input className="input-field" type="date" value={manualClass.endDate} onChange={(event) => patchManualClass({ endDate: event.target.value })} style={{ fontSize: '13px', height: '42px', padding: '0 10px' }} title="종료일" />
          </div>
          <textarea className="input-field" placeholder="메모 (선택)" value={manualClass.memo} onChange={(event) => patchManualClass({ memo: event.target.value })} style={{ minHeight: '40px', fontSize: '12px', marginBottom: '6px', padding: '8px' }} />
          <button className="btn-primary" style={{ width: '100%', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: selectedManualKidId ? 1 : 0.55, cursor: selectedManualKidId ? 'pointer' : 'not-allowed', fontSize: '13px' }} onClick={handleManualClassAdd} disabled={!selectedManualKidId}>
            <Plus size={14} /> 한 건 등록
          </button>
          {classAddStatus ? <div style={{ marginTop: '6px', fontSize: '11px', fontWeight: 800, color: '#16a34a', textAlign: 'center' }}>{classAddStatus}</div> : null}
        </div>

        {showBulk ? (
        <div style={{ borderTop: '1px solid #ffe1ea', paddingTop: '10px' }}>
          <div style={{ fontSize: '13px', fontWeight: 900, marginBottom: '6px', color: PRIMARY_PINK }}>엑셀 붙여넣기 등록</div>
          <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '6px', lineHeight: 1.4 }}>이름[TAB]요일[TAB]과목[TAB]시간[TAB]분[TAB]시작일(선택)[TAB]종료일(선택)[TAB]메모(선택)[TAB]코인(선택)</div>
          <textarea className="input-field" value={bulkInput} onChange={(event) => { setBulkInput(event.target.value); if (classAddStatus) setClassAddStatus('') }} style={{ minHeight: '80px', fontSize: '11px', marginBottom: '6px' }} placeholder="여기에 엑셀 데이터를 붙여넣으세요" />
          <button className="btn-primary" style={{ width: '100%', height: '36px', fontSize: '13px' }} onClick={handleBulkAdd}>일괄 등록</button>
        </div>
        ) : null}
      </div>
    )
  }

  const askFixedClassScope = () => {
    const scopePrompt = prompt('적용 범위 선택 (1: 전체, 2: 오늘부터, 3: 내일부터)', '1')
    if (scopePrompt === null) return null
    return scopePrompt === '2' ? 'today_onwards' : scopePrompt === '3' ? 'tomorrow_onwards' : 'all'
  }

  const promptFixedClassPatch = (task) => {
    const nextName = prompt('수업 이름', task.name || '')
    if (nextName === null) return null
    const safeName = nextName.trim()
    if (!safeName) return null

    const currentWeekday = task.weekday !== undefined && task.weekday !== null ? String(task.weekday) : ''
    const weekdayRaw = prompt('요일 (0:일 ~ 6:토)', currentWeekday)
    if (weekdayRaw === null) return null
    const parsedWeekday = parseInt(weekdayRaw, 10)
    const nextWeekday = Number.isNaN(parsedWeekday) ? task.weekday : Math.max(0, Math.min(6, parsedWeekday))

    const nextStartRaw = prompt('시작 시간', task.startTime || '09:00')
    if (nextStartRaw === null) return null
    const nextStart = normalizeStartTime(nextStartRaw) || task.startTime || '09:00'

    const durationRaw = prompt('수업 시간(분)', String(task.duration || DEFAULT_DURATION))
    if (durationRaw === null) return null
    const nextDuration = Math.max(1, parseInt(durationRaw, 10) || Number(task.duration || DEFAULT_DURATION))

    const coinsRaw = prompt('코인', String(getTaskCoins(task)))
    if (coinsRaw === null) return null
    const nextCoins = Math.max(0, parseInt(coinsRaw, 10) || 0)

    const nextStartDate = prompt('시작일(비우면 제한 없음)', task.startDate || task.classStartDate || '')
    if (nextStartDate === null) return null
    const nextEndDate = prompt('종료일(비우면 제한 없음)', task.endDate || task.classEndDate || '')
    if (nextEndDate === null) return null
    const nextMemo = prompt('메모(선택)', task.memo || task.note || '')
    if (nextMemo === null) return null

    return {
      name: safeName,
      weekday: nextWeekday,
      startTime: nextStart,
      duration: nextDuration,
      expectedEndTime: buildExpectedEndTime(nextStart, nextDuration),
      coins: nextCoins,
      startDate: nextStartDate.trim() || null,
      endDate: nextEndDate.trim() || null,
      classStartDate: nextStartDate.trim() || null,
      classEndDate: nextEndDate.trim() || null,
      memo: nextMemo.trim(),
      note: nextMemo.trim()
    }
  }

  const renderFixedClassListPanel = () => (
    <div style={{ borderTop: '1px solid #ffe1ea', paddingTop: '14px' }}>
      <button
        onClick={() => setFixedSectionOpen((prev) => !prev)}
        style={{ width: '100%', border: '1px solid #ffd6e0', background: '#fff7fa', color: '#d6336c', borderRadius: '12px', padding: '10px 12px', fontWeight: 900, cursor: 'pointer', textAlign: 'left' }}
      >
        {fixedSectionOpen ? '▼' : '▶'} 아이별 고정수업 목록
      </button>
      {fixedSectionOpen ? (
        <div style={{ marginTop: '8px', display: 'grid', gap: '8px' }}>
          {kidsList.map((kidId) => {
            const isOpen = fixedOpenByKid[kidId] !== false
            const classItems = fixedClassesByKid[kidId] || []
            return (
              <div key={`fixed-${kidId}`} style={{ border: '1px solid #ffe1ea', borderRadius: '12px', padding: '8px' }}>
                <button
                  onClick={() => setFixedOpenByKid((prev) => ({ ...prev, [kidId]: !isOpen }))}
                  style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'left', fontWeight: 900, color: '#ff4d6d', cursor: 'pointer', padding: '4px 2px' }}
                >
                  {isOpen ? '▼' : '▶'} {getFullName(kidId)} ({classItems.length})
                </button>
                {isOpen ? (
                  <div style={{ marginTop: '6px', display: 'grid', gap: '6px' }}>
                    {classItems.map((task) => (
                      <div key={`${kidId}-${task.id}`} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '8px', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 900, color: '#334155' }}>{task.name}</div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                            <span>{weekdayLabels[Number(task.weekday)] || '-'} / {task.startTime} ~ {task.expectedEndTime} ({task.duration}분)</span>
                            <span>·</span>
                            <input
                              type="number"
                              min="0"
                              defaultValue={getTaskCoins(task)}
                              onBlur={async (event) => {
                                const nextCoins = Math.max(0, parseInt(event.target.value, 10) || 0)
                                if (nextCoins === getTaskCoins(task)) return
                                const scope = askFixedClassScope()
                                if (!scope) {
                                  event.target.value = String(getTaskCoins(task))
                                  return
                                }
                                await updateFixedClassTask(kidId, task.id, { coins: nextCoins }, scope)
                              }}
                              style={{ width: '46px', height: '22px', border: '1px solid #ffe1ea', borderRadius: '6px', textAlign: 'center', fontSize: '11px', fontWeight: 800, color: PRIMARY_PINK }}
                              title="코인 수정"
                            />
                            <span>코인</span>
                            {(task.startDate || task.classStartDate || task.endDate || task.classEndDate) ? (
                              <span style={{ color: '#94a3b8' }}>({task.startDate || task.classStartDate || '시작 제한 없음'} ~ {task.endDate || task.classEndDate || '종료 제한 없음'})</span>
                            ) : null}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            onClick={() => setEditingClassInfo({
                              kidId,
                              task,
                              name: task.name || '',
                              weekday: String(task.weekday ?? '1'),
                              startTime: task.startTime || '09:00',
                              duration: String(task.duration || 50),
                              coins: String(getTaskCoins(task)),
                              startDate: task.startDate || task.classStartDate || '',
                              endDate: task.endDate || task.classEndDate || '',
                              memo: task.memo || task.note || ''
                            })}
                            style={{ border: '1px solid #dbeafe', background: '#eff6ff', color: '#1d4ed8', borderRadius: '8px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}
                          >
                            수정
                          </button>
                          <button
                            onClick={async () => {
                              if (!window.confirm('이 고정수업을 삭제할까요?')) return
                              await deleteFixedClassTask(kidId, task.id)
                            }}
                            style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', borderRadius: '8px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    ))}
                    {classItems.length === 0 ? <div style={{ fontSize: '11px', color: '#94a3b8' }}>등록된 고정수업이 없어요.</div> : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )

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
                  {unreadMessage && (
                    <span style={{ position: 'absolute', top: '-5px', right: '-5px', background: '#fbbf24', color: 'white', borderRadius: '50%', width: '18px', height: '18px', fontSize: '10px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white' }}>
                      !
                    </span>
                  )}
                </div>
              </div>
              <div>
                <h1 style={{ fontSize: isMobile ? '17px' : '21px', fontWeight: 900, color: '#333', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
                  {isAdmin ? (
                    <span style={{ display: 'inline-flex', background: '#f1f5f9', borderRadius: '14px', padding: '4px', border: '1px solid #e2e8f0' }}>
                      {kidsList.map((id) => (
                        <button
                          key={id}
                          onClick={() => setActiveKidId(id)}
                          style={{
                            border: 'none',
                            background: activeKidId === id ? 'white' : 'transparent',
                            color: activeKidId === id ? PRIMARY_PINK : '#64748b',
                            fontWeight: 900,
                            fontSize: isMobile ? '14px' : '13px',
                            borderRadius: '10px',
                            padding: isMobile ? '7px 14px' : '6px 12px',
                            boxShadow: activeKidId === id ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                            cursor: 'pointer'
                          }}
                        >
                          {getFullName(id)}
                        </button>
                      ))}
                    </span>
                  ) : (
                    getFullName(activeKidId)
                  )}
                  <button
                    onClick={openCoinLedger}
                    style={{
                      borderRadius: '999px',
                      padding: isMobile ? '3px 8px' : '5px 10px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'linear-gradient(135deg, #fff7db 0%, #ffe8f0 100%)',
                      border: '1px solid #ffd8a8',
                      cursor: 'pointer'
                    }}
                    title="코인 내역 보기"
                  >
                    <span style={{ width: isMobile ? '20px' : '22px', height: isMobile ? '20px' : '22px', borderRadius: '50%', background: 'linear-gradient(135deg, #ffcf4a 0%, #ff9f1a 100%)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Coins size={isMobile ? 11 : 12} color="white" />
                    </span>
                    <strong style={{ color: '#c96d00', fontSize: isMobile ? '12px' : '13px', lineHeight: 1 }}>{availableCoins}</strong>
                  </button>
                </h1>
              </div>
            </div>

            <div style={{ display: 'flex', gap: isMobile ? '4px' : '10px', overflowX: isMobile ? 'auto' : 'visible', paddingBottom: isMobile ? '2px' : 0 }}>
              {isAdmin && <button onClick={openSubjectManager} className="header-btn-original" title="과목 총 관리" aria-label="과목 총 관리"><Plus size={isMobile ? 18 : 22} /></button>}
              {isAdmin && (
                <button onClick={() => setShowTotalAuditLog(true)} className="header-btn-original" title="전체 활동 로그">
                  <Calendar size={isMobile ? 18 : 22} color="#fbbf24" />
                </button>
              )}
              {isAdmin && (
                <button onClick={() => setShowFamilyManager(true)} className="header-btn-original" style={{ position: 'relative' }}>
                  <Users size={isMobile ? 18 : 22} />
                  {unreadRepliesForAdmin > 0 ? (
                    <span style={{ position: 'absolute', top: '-6px', right: '-6px', minWidth: '18px', height: '18px', borderRadius: '999px', background: PRIMARY_PINK, color: 'white', fontSize: '10px', fontWeight: 900, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                      {unreadRepliesForAdmin > 9 ? '9+' : unreadRepliesForAdmin}
                    </span>
                  ) : null}
                </button>
              )}
              {isAdmin && (
                <button onClick={() => setShowDailyLog(true)} className="header-btn-original" style={{ position: 'relative' }} title="오늘의 기록 관리">
                  <Calendar size={isMobile ? 18 : 22} />
                  {pendingEditRequests.length > 0 && <span style={{ position: 'absolute', top: '-4px', right: '-4px', width: '8px', height: '8px', borderRadius: '50%', background: '#fbbf24' }}></span>}
                </button>
              )}
              <button onClick={() => setShowAppLauncher(true)} className="header-btn-original" title="학습 앱">
                <LayoutGrid size={isMobile ? 18 : 22} />
              </button>
              <button onClick={() => setShowAllowanceBook(true)} className="header-btn-original" title={`${getFullName(activeKidId)} 용돈기입장`}>
                <PiggyBank size={isMobile ? 18 : 22} />
              </button>
              <button onClick={() => setShowGoals(true)} className="header-btn-original"><Trophy size={isMobile ? 18 : 22} /></button>
              <button onClick={() => setShowSettings(true)} className="header-btn-original"><Settings size={isMobile ? 18 : 22} /></button>
              <button onClick={onLogout} className="header-btn-original" style={{ color: PRIMARY_PINK }}><LogOut size={isMobile ? 18 : 22} /></button>
            </div>
          </div>

        </header>

        <div style={{ ...glassStyle, borderRadius: '24px', padding: isMobile ? '15px' : '20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: isMobile ? '15px' : '20px', marginBottom: '15px' }}>
            <button onClick={() => setSelectedDate(subDays(selectedDate, 1))} style={{ border: 'none', background: 'none', color: PRIMARY_PINK, cursor: 'pointer' }}><ChevronLeft size={isMobile ? 24 : 28} /></button>
            <div 
              onClick={() => { setViewMonth(selectedDate); setShowDatePicker(true); }}
              style={{ fontWeight: 900, fontSize: isMobile ? '18px' : '22px', display: 'flex', alignItems: 'center', gap: '8px', color: '#333', cursor: 'pointer', padding: '4px 12px', borderRadius: '12px', background: 'rgba(255,255,255,0.4)', transition: 'all 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.7)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.4)'}
            >
              <Calendar size={20} color={PRIMARY_PINK} /> {format(selectedDate, 'yyyy년 MM월')}
            </div>
            <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} style={{ border: 'none', background: 'none', color: PRIMARY_PINK, cursor: 'pointer' }}><ChevronRight size={isMobile ? 24 : 28} /></button>
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

        <main style={{ width: '100%', display: isAdmin ? 'block' : 'flex', gap: '12px', alignItems: 'flex-start', flexDirection: isMobile ? 'column' : 'row' }}>
          {!isAdmin && (
            <div
              style={{
                ...glassStyle,
                width: isMobile ? '100%' : '310px',
                flexShrink: 0,
                borderRadius: '24px',
                overflow: 'hidden',
                position: isMobile ? 'relative' : 'sticky',
                top: isMobile ? 'auto' : '20px'
              }}
            >
              <SubjectPalette
                cloud={cloud}
                activeKidId={activeKidId}
                kids={kidsList}
                kidLabels={Object.fromEntries(kidsList.map((id) => [id, getFullName(id)]))}
                onSubjectsChange={() => {}}
              onCoinChange={async ({ kidId, subjectName, beforeCoins, afterCoins }) => {
                if (!isAdmin || beforeCoins === afterCoins) return
                await appendCoinLog({ kidId, subjectName, beforeCoins, afterCoins })
              }}
              isAdmin={isAdmin}
              allowDrag={!isMobile}
            />
            </div>
          )}
          {isAdmin && (
            <div style={{ position: 'fixed', bottom: isMobile ? '25px' : '40px', right: isMobile ? '25px' : '40px', zIndex: 950 }}>
              <button onClick={openFixedClassManager} title="고정수업 관리" aria-label="고정수업 관리" style={{ width: isMobile ? '60px' : '65px', height: isMobile ? '60px' : '65px', borderRadius: '50%', background: PRIMARY_PINK, color: 'white', border: 'none', boxShadow: '0 6px 20px rgba(255,77,109,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={isMobile ? 35 : 40} />
              </button>
            </div>
          )}

          <div style={{ ...glassStyle, borderRadius: '24px', overflow: 'hidden', flex: 1, width: '100%' }}>
            <TimeGrid
              tasks={[...todayTasks, ...orphanedVirtualTasks]}
              doneLogs={doneLogs}
              todayStr={todayStr}
              isAdmin={isAdmin}
              isMobile={isMobile}
              essentialChecklist={essentials}
              onUpdateTask={async (id, updates) => {
                if (updates.status !== undefined || updates.completed !== undefined || updates.editRequested !== undefined) {
                  const task = tasks.find((t) => String(t.id) === String(id))
                  if (task) {
                    const logId = `${id}-${todayStr}`
                    const isRemoval = updates.status === '' || updates.status === null
                    const existingLog = doneLogs.find((l) => l.id === logId)
                    
                    let nextLogs
                    if (isRemoval) {
                      nextLogs = doneLogs.filter((l) => l.id !== logId)
                    } else {
                      const nextStatus = updates.status !== undefined ? updates.status : (existingLog?.status || (updates.completed ? 'completed' : ''))
                      const isCompleted = nextStatus === 'completed' || updates.completed === true
                      const earnedCoins = isCompleted ? Number(updates.coins ?? getTaskCoins(task)) : 0
                      const newLog = {
                        ...(existingLog || {}),
                        id: logId,
                        taskId: id,
                        name: task.name,
                        type: task.type,
                        date: todayStr,
                        status: nextStatus,
                        coins: earnedCoins,
                        timestamp: Date.now(),
                        startTimeActual: updates.startTimeActual || existingLog?.startTimeActual || task.startTimeActual || task.actualStartTime || '',
                        endTimeActual: updates.endTimeActual || existingLog?.endTimeActual || task.endTimeActual || task.actualEndTime || '',
                        durationActual: updates.durationActual || existingLog?.durationActual || task.durationActual || task.actualDuration || 0,
                        editRequested: updates.editRequested !== undefined ? updates.editRequested : !!existingLog?.editRequested,
                        autoCompleted: updates.autoCompleted !== undefined ? updates.autoCompleted : !!existingLog?.autoCompleted
                      }
                      nextLogs = [...doneLogs.filter((l) => l.id !== logId), newLog]
                    }

                    const nextTasks = task.type === 'class'
                      ? tasks
                      : tasks.map((item) => {
                          if (String(item.id) !== String(id)) return item
                          if (isRemoval) {
                            return {
                              ...item,
                              completed: false,
                              status: '',
                              startTimeActual: '',
                              actualStartTime: '',
                              endTimeActual: '',
                              actualEndTime: '',
                              durationActual: 0,
                              actualDuration: 0,
                              durationMinutes: 0
                            }
                          }
                          return { ...item, ...updates }
                        })
                    setDoneLogs(nextLogs)
                    if (nextTasks !== tasks) setTasks(nextTasks)
                    await persistKidState({ doneLogs: nextLogs, tasks: nextTasks })
                    return
                  }
                }

                const { _doneLogCoinsUpdate, ...cleanUpdates } = updates
                const targetTask = tasks.find((task) => String(task.id) === String(id))
                if (targetTask?.type === 'class' && isAdmin) {
                  const scopePrompt = prompt('적용 범위 선택 (1: 전체, 2: 오늘부터, 3: 내일부터)', '1')
                  if (scopePrompt === null) return
                  const scope = scopePrompt === '2' ? 'today_onwards' : scopePrompt === '3' ? 'tomorrow_onwards' : 'all'
                  await updateFixedClassTask(activeKidId, id, cleanUpdates, scope)
                  return
                }

                const next = tasks.map((task) => {
                  if (task.id !== id) return task
                  return { ...task, ...cleanUpdates }
                })
                setTasks(next)
                if (_doneLogCoinsUpdate !== undefined) {
                  const logId = `${id}-${todayStr}`
                  const existingLog = doneLogs.find(l => l.id === logId)
                  if (existingLog) {
                    const prevCoins = Number(existingLog.coins || 0)
                    const newCoinsVal = Number(_doneLogCoinsUpdate)
                    const coinHistory = prevCoins !== newCoinsVal
                      ? [...(existingLog.coinHistory || []), { from: prevCoins, to: newCoinsVal, changedAt: format(new Date(), 'yyyy-MM-dd') }]
                      : (existingLog.coinHistory || [])
                    const updatedLogs = doneLogs.map(l => l.id === logId ? { ...l, coins: newCoinsVal, coinHistory } : l)
                    setDoneLogs(updatedLogs)
                    await persistKidState({ doneLogs: updatedLogs, tasks: next })
                    return
                  }
                }
                persistKidState({ tasks: next })
              }}
              onDeleteTask={(id) => {
                const deletedTask = tasks.find((t) => String(t.id) === String(id))
                const next = tasks.filter((t) => String(t.id) !== String(id))
                setTasks(next)
                if (deletedTask && deletedTask.type !== 'class') {
                  const nextLogs = doneLogs.filter((log) => !(String(log.taskId) === String(id) && log.date === todayStr))
                  setDoneLogs(nextLogs)
                  persistKidState({ tasks: next, doneLogs: nextLogs })
                } else {
                  persistKidState({ tasks: next })
                }
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

        {shouldShowEditRequestPopup && (
          <div className="modal-overlay" onClick={() => { setDismissedEditRequestKey(editRequestKey); setRequestEditDraft(null) }}>
            <div className="modal-content glass" onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '24px', padding: isMobile ? '16px' : '22px', maxWidth: '440px', width: '92%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.18)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: PRIMARY_PINK }}>수정 요청 {pendingEditRequests.length}건</h2>
                <button onClick={() => { setDismissedEditRequestKey(editRequestKey); setRequestEditDraft(null) }} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><CloseIcon /></button>
              </div>
              <div style={{ display: 'grid', gap: '10px' }}>
                {pendingEditRequests.map((log) => {
                  const isExpanded = requestEditDraft?.logId === log.id
                  return (
                    <div key={`request-${log.id}`} style={{ border: `1px solid ${isExpanded ? PRIMARY_PINK : '#ffd6e0'}`, borderRadius: '14px', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#fff7fa', gap: '8px' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 900, color: '#334155', fontSize: '13px' }}>{log.name}</div>
                          <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>{log.date} · {getStatusLabel(log.status)} · {Number(log.coins || 0)}코인</div>
                        </div>
                        <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                          <button
                            onClick={() => setRequestEditDraft(isExpanded ? null : { logId: log.id, coins: Number(log.coins || 0), status: log.status || '' })}
                            style={{ padding: '6px 10px', borderRadius: '9px', border: `1px solid ${PRIMARY_PINK}`, background: isExpanded ? PRIMARY_PINK : 'white', color: isExpanded ? 'white' : PRIMARY_PINK, fontWeight: 900, fontSize: '12px', cursor: 'pointer' }}
                          >
                            {isExpanded ? '닫기' : '수정'}
                          </button>
                          <button
                            onClick={() => { resolveEditRequest(log.id); if (requestEditDraft?.logId === log.id) setRequestEditDraft(null) }}
                            style={{ padding: '6px 10px', borderRadius: '9px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: 900, fontSize: '12px', cursor: 'pointer' }}
                          >
                            무시
                          </button>
                        </div>
                      </div>
                      {isExpanded && (
                        <div style={{ padding: '12px', background: 'white', borderTop: `1px solid ${LIGHT_PINK}` }}>
                          <div style={{ marginBottom: '10px' }}>
                            <div style={{ fontSize: '11px', color: '#666', marginBottom: '6px', fontWeight: 700 }}>상태 변경</div>
                            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                              {CLASS_STATUSES.map(({ value, label, bg }) => (
                                <button
                                  key={value}
                                  onClick={() => setRequestEditDraft(prev => ({ ...prev, status: value }))}
                                  style={{ padding: '6px 10px', borderRadius: '8px', border: 'none', fontSize: '12px', fontWeight: 900, cursor: 'pointer', background: requestEditDraft.status === value ? bg : '#f1f5f9', color: requestEditDraft.status === value ? 'white' : '#555' }}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                            <span style={{ fontSize: '12px', color: '#555', fontWeight: 700 }}>코인</span>
                            <input
                              type="number"
                              min="0"
                              value={requestEditDraft.coins}
                              onChange={(e) => setRequestEditDraft(prev => ({ ...prev, coins: e.target.value }))}
                              style={{ width: '72px', padding: '6px 8px', borderRadius: '8px', border: '1px solid #ffd6e0', textAlign: 'center', fontWeight: 900, fontSize: '14px' }}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={saveRequestEdit} className="btn-primary" style={{ flex: 1, padding: '9px', fontSize: '13px' }}>
                              저장 & 해결
                            </button>
                            <button onClick={() => setRequestEditDraft(null)} style={{ flex: 1, padding: '9px', border: '1px solid #ddd', borderRadius: '10px', background: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                              취소
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {showDailyLog && isAdmin && (
          <div className="modal-overlay" onClick={() => setShowDailyLog(false)}>
            <div className="modal-content glass" onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '24px', padding: isMobile ? '16px' : '24px', maxWidth: '620px', width: '95%', maxHeight: '88vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <h2 style={{ fontWeight: 900, color: PRIMARY_PINK, margin: '0 0 2px' }}>{format(selectedDate, 'yyyy년 M월 d일')} 기록 관리</h2>
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700 }}>현재 코인 합계 <strong style={{ color: '#c96d00' }}>{availableCoins}</strong>코인</div>
                </div>
                <button onClick={() => setShowDailyLog(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><CloseIcon /></button>
              </div>

              <div style={{ display: 'grid', gap: '14px' }}>
                <section style={{ border: '1px solid #ffe1ea', borderRadius: '14px', padding: '12px' }}>
                  <h3 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 900, color: '#334155' }}>고정수업 / 과목</h3>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {dailyActivityLogs.map((log) => {
                      const isEditingThis = logEditDraft?.logId === log.id
                      return (
                        <div key={`daily-activity-${log.id}`} style={{ background: '#f8fafc', border: log.editRequested ? `1.5px solid ${PRIMARY_PINK}` : (isEditingThis ? '1.5px solid #7c9cff' : '1px solid #e2e8f0'), borderRadius: '12px', overflow: 'hidden' }}>
                          <div style={{ padding: '10px', display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                            <button onClick={() => focusTaskFromLog(log)} style={{ flex: 1, border: 'none', background: 'transparent', textAlign: 'left', padding: 0, cursor: 'pointer' }}>
                              <div style={{ fontWeight: 900, color: '#334155', fontSize: '13px' }}>
                                {log.name}
                                {log.editRequested ? <span style={{ color: PRIMARY_PINK }}>· 수정 요청</span> : null}
                                {log.autoCompleted ? <span style={{ color: '#94a3b8', fontWeight: 700, fontSize: '11px', marginLeft: '4px' }}>⏰ 자동완료</span> : null}
                              </div>
                              <div style={{ color: '#64748b', fontSize: '11px', marginTop: '3px' }}>
                                {getStatusLabel(log.status)} · {Number(log.coins || 0)}코인{log.startTimeActual ? ` · ${log.startTimeActual}${log.endTimeActual ? `~${log.endTimeActual}` : ''}` : ''}
                              </div>
                              {log.coinHistory && log.coinHistory.length > 0 && (
                                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                  {log.coinHistory.map((h, i) => (
                                    <span key={i}><span style={{ textDecoration: 'line-through' }}>{h.from}코인</span> → {h.to}코인 <span style={{ color: '#cbd5e1' }}>({h.changedAt})</span></span>
                                  ))}
                                </div>
                              )}
                            </button>
                            <div style={{ display: 'flex', gap: '4px', flexShrink: 0, alignItems: 'center' }}>
                              {log.autoCompleted && (
                                <button
                                  onClick={() => grantAutoCompletedCoins(log)}
                                  title="코인 적립"
                                  style={{ border: 'none', background: '#fef9c3', color: '#b45309', padding: '0 8px', height: '32px', borderRadius: '10px', fontSize: '11px', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                >
                                  코인 적립
                                </button>
                              )}
                              <button
                                onClick={() => setLogEditDraft(isEditingThis ? null : { logId: log.id, coins: Number(log.coins || 0), status: log.status || '' })}
                                title="수정"
                                style={{ border: 'none', background: isEditingThis ? '#dbe7ff' : '#f1f5f9', color: isEditingThis ? '#355eb5' : '#666', width: '32px', height: '32px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                              >
                                <Edit3 size={14} />
                              </button>
                              <button onClick={() => deleteDoneLog(log.id)} title="삭제" style={{ border: 'none', background: '#fee2e2', color: '#ef4444', width: '32px', height: '32px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                <Trash size={15} />
                              </button>
                            </div>
                          </div>
                          {isEditingThis && (
                            <div style={{ padding: '12px', borderTop: '1px solid #e2e8f0', background: 'white' }}>
                              {log.type === 'class' && (
                                <div style={{ marginBottom: '10px' }}>
                                  <div style={{ fontSize: '11px', color: '#666', marginBottom: '6px', fontWeight: 700 }}>상태 변경</div>
                                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                    {CLASS_STATUSES.map(({ value, label, bg }) => (
                                      <button
                                        key={value}
                                        onClick={() => {
                                          const defaultCoins = value === 'completed' ? Number(log.coins || 0) : 0
                                          setLogEditDraft(prev => ({ ...prev, status: value, coins: defaultCoins }))
                                        }}
                                        style={{ padding: '5px 9px', borderRadius: '7px', border: 'none', fontSize: '11px', fontWeight: 900, cursor: 'pointer', background: logEditDraft.status === value ? bg : '#f1f5f9', color: logEditDraft.status === value ? 'white' : '#555' }}
                                      >
                                        {label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {log.type !== 'class' && (
                                <div style={{ marginBottom: '10px' }}>
                                  <div style={{ fontSize: '11px', color: '#666', marginBottom: '6px', fontWeight: 700 }}>완료 상태</div>
                                  <button
                                    onClick={() => setLogEditDraft(prev => ({ ...prev, status: prev.status === '' ? log.status : '' }))}
                                    style={{ padding: '5px 9px', borderRadius: '7px', border: 'none', fontSize: '11px', fontWeight: 900, cursor: 'pointer', background: logEditDraft.status === '' ? '#94a3b8' : '#f1f5f9', color: logEditDraft.status === '' ? 'white' : '#555' }}
                                  >
                                    {logEditDraft.status === '' ? '✓ 완료 취소됨' : '완료 취소하기'}
                                  </button>
                                </div>
                              )}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                <span style={{ fontSize: '12px', color: '#555', fontWeight: 700 }}>코인</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={logEditDraft.coins}
                                  onChange={(e) => setLogEditDraft(prev => ({ ...prev, coins: e.target.value }))}
                                  style={{ width: '66px', padding: '5px 8px', borderRadius: '8px', border: '1px solid #c7d7ff', textAlign: 'center', fontWeight: 900, fontSize: '14px' }}
                                />
                              </div>
                              {!logEditDraft.showSaveDialog ? (
                                <div style={{ display: 'flex', gap: '5px' }}>
                                  <button onClick={() => setLogEditDraft(prev => ({ ...prev, showSaveDialog: true }))} className="btn-primary" style={{ flex: 2, padding: '8px', fontSize: '12px' }}>
                                    저장
                                  </button>
                                  <button onClick={() => setLogEditDraft(null)} style={{ flex: 1, padding: '8px', border: '1px solid #ddd', background: 'white', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
                                    취소
                                  </button>
                                </div>
                              ) : (
                                <div>
                                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px', fontWeight: 700, textAlign: 'center' }}>저장 방식 선택</div>
                                  <div style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
                                    <button onClick={saveLogEdit} className="btn-primary" style={{ flex: 1, padding: '8px', fontSize: '12px' }}>
                                      이번 기록만 저장
                                    </button>
                                    <button
                                      onClick={async () => { await saveLogEdit(); openFullSettingEdit(log) }}
                                      style={{ flex: 1, padding: '8px', border: '1px solid #7c9cff', background: 'white', color: '#355eb5', borderRadius: '10px', fontWeight: 900, fontSize: '12px', cursor: 'pointer' }}
                                    >
                                      기본 설정도 변경
                                    </button>
                                  </div>
                                  <button onClick={() => setLogEditDraft(prev => ({ ...prev, showSaveDialog: false }))} style={{ width: '100%', padding: '7px', border: '1px solid #ddd', background: 'white', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
                                    뒤로
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {dailyActivityLogs.length === 0 ? <div style={{ fontSize: '12px', color: '#94a3b8' }}>이 날짜의 수업/과목 기록이 없어요.</div> : null}
                  </div>
                </section>

                <section style={{ border: '1px solid #ffe8b1', borderRadius: '14px', padding: '12px' }}>
                  <h3 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 900, color: '#334155' }}>코인</h3>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {dailyGiftLogs.map((log) => (
                      <div key={`daily-gift-${log.id}`} style={{ background: '#fffdf3', border: '1px solid #ffe8b1', borderRadius: '12px', padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 900, color: '#334155', fontSize: '13px' }}>{log.name}</div>
                          <div style={{ color: '#b45309', fontSize: '11px', marginTop: '3px' }}>+{Number(log.coins || 0)}코인</div>
                        </div>
                        <button onClick={() => deleteDoneLog(log.id)} title="삭제" style={{ border: 'none', background: '#fee2e2', color: '#ef4444', width: '32px', height: '32px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <Trash size={15} />
                        </button>
                      </div>
                    ))}
                    {dailyCoinLogs.map((log) => (
                      <div key={`daily-coin-${log.id}`} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 900, color: '#334155', fontSize: '13px' }}>{log.subjectName}</div>
                          <div style={{ color: '#64748b', fontSize: '11px', marginTop: '3px' }}>{log.beforeCoins} → {log.afterCoins}</div>
                        </div>
                        <button onClick={() => deleteCoinLog(log.id)} title="삭제" style={{ border: 'none', background: '#fee2e2', color: '#ef4444', width: '32px', height: '32px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <Trash size={15} />
                        </button>
                      </div>
                    ))}
                    {dailyGiftLogs.length === 0 && dailyCoinLogs.length === 0 ? <div style={{ fontSize: '12px', color: '#94a3b8' }}>이 날짜의 코인 기록이 없어요.</div> : null}
                  </div>
                </section>

                <section style={{ border: '1px solid #dbeafe', borderRadius: '14px', padding: '12px' }}>
                  <h3 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 900, color: '#334155' }}>용돈기입장</h3>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {dailyAllowanceLogs.map((entry) => (
                      <div key={`daily-allowance-${entry.id}`} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 900, color: '#334155', fontSize: '13px' }}>{entry.title}</div>
                          <div style={{ color: entry.type === 'income' ? '#166534' : '#991b1b', fontSize: '11px', marginTop: '3px' }}>{entry.type === 'income' ? '+' : '-'}{entry.amount}원{entry.memo ? ` · ${entry.memo}` : ''}</div>
                        </div>
                        <button onClick={() => { if (window.confirm('이 용돈 내역을 삭제할까요?')) handleDeleteAllowance(entry.id) }} title="삭제" style={{ border: 'none', background: '#fee2e2', color: '#ef4444', width: '32px', height: '32px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <Trash size={15} />
                        </button>
                      </div>
                    ))}
                    {dailyAllowanceLogs.length === 0 ? <div style={{ fontSize: '12px', color: '#94a3b8' }}>이 날짜의 용돈 기록이 없어요.</div> : null}
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}

        {showClassManager && isAdmin && (
          <div className="modal-overlay" onClick={() => setShowClassManager(false)}>
            <div className="modal-content glass" onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '24px', padding: '25px', maxWidth: '560px', width: '95%', maxHeight: '88vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h2 style={{ fontWeight: 900, color: PRIMARY_PINK }}>고정수업 관리</h2>
                <button onClick={() => setShowClassManager(false)} style={{ border: 'none', background: 'none' }}><CloseIcon /></button>
              </div>
              <div style={{ display: 'grid', gap: '14px' }}>
                {renderFixedClassRegistrationPanel({ showBulk: true })}
                {renderFixedClassListPanel()}
              </div>
            </div>
          </div>
        )}

        {editingClassInfo && isAdmin && (
          <div className="modal-overlay" onClick={() => setEditingClassInfo(null)}>
            <div className="modal-content glass" onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '24px', padding: '20px', maxWidth: '420px', width: '94%', boxShadow: '0 24px 60px rgba(0,0,0,0.18)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 900, color: PRIMARY_PINK }}>고정수업 수정</h2>
                <button onClick={() => setEditingClassInfo(null)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><CloseIcon /></button>
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#666', marginBottom: '3px' }}>수업명</div>
                    <input className="input-field" value={editingClassInfo.name} onChange={(e) => setEditingClassInfo((p) => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#666', marginBottom: '3px' }}>요일</div>
                    <select className="input-field" value={editingClassInfo.weekday} onChange={(e) => setEditingClassInfo((p) => ({ ...p, weekday: e.target.value }))}>
                      {weekdayLabels.map((label, idx) => <option key={label} value={String(idx)}>{label}요일</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#666', marginBottom: '3px' }}>시작 시간</div>
                    <input className="input-field" type="time" value={editingClassInfo.startTime} onChange={(e) => setEditingClassInfo((p) => ({ ...p, startTime: e.target.value }))} />
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#666', marginBottom: '3px' }}>수업 시간(분)</div>
                    <input className="input-field" type="number" min="1" value={editingClassInfo.duration} onChange={(e) => setEditingClassInfo((p) => ({ ...p, duration: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#666', marginBottom: '3px' }}>코인</div>
                  <input className="input-field" type="number" min="0" value={editingClassInfo.coins} onChange={(e) => setEditingClassInfo((p) => ({ ...p, coins: e.target.value }))} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#666', marginBottom: '3px' }}>수업 시작일</div>
                    <input className="input-field" type="date" value={editingClassInfo.startDate} onChange={(e) => setEditingClassInfo((p) => ({ ...p, startDate: e.target.value }))} />
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#666', marginBottom: '3px' }}>수업 종료일</div>
                    <input className="input-field" type="date" value={editingClassInfo.endDate} onChange={(e) => setEditingClassInfo((p) => ({ ...p, endDate: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#666', marginBottom: '3px' }}>메모</div>
                  <textarea className="input-field" value={editingClassInfo.memo} onChange={(e) => setEditingClassInfo((p) => ({ ...p, memo: e.target.value }))} style={{ minHeight: '50px', resize: 'vertical' }} />
                </div>
                <div style={{ borderTop: '1px solid #ffe1ea', paddingTop: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 900, color: '#666', marginBottom: '8px' }}>적용 범위</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                    {[['all', '전체'], ['today_onwards', '오늘부터'], ['tomorrow_onwards', '내일부터']].map(([scope, label]) => (
                      <button
                        key={scope}
                        onClick={async () => {
                          const safeName = editingClassInfo.name.trim()
                          if (!safeName) return
                          const parsedWeekday = parseInt(editingClassInfo.weekday, 10)
                          const normalizedStart = normalizeStartTime(editingClassInfo.startTime) || editingClassInfo.task.startTime
                          const dur = Math.max(1, parseInt(editingClassInfo.duration, 10) || Number(editingClassInfo.task.duration || 50))
                          const coins = Math.max(0, parseInt(editingClassInfo.coins, 10) || 0)
                          const patch = {
                            name: safeName,
                            weekday: Number.isNaN(parsedWeekday) ? editingClassInfo.task.weekday : parsedWeekday,
                            startTime: normalizedStart,
                            duration: dur,
                            expectedEndTime: buildExpectedEndTime(normalizedStart, dur),
                            coins,
                            startDate: editingClassInfo.startDate.trim() || null,
                            endDate: editingClassInfo.endDate.trim() || null,
                            classStartDate: editingClassInfo.startDate.trim() || null,
                            classEndDate: editingClassInfo.endDate.trim() || null,
                            memo: editingClassInfo.memo.trim(),
                            note: editingClassInfo.memo.trim()
                          }
                          await updateFixedClassTask(editingClassInfo.kidId, editingClassInfo.task.id, patch, scope)
                          setEditingClassInfo(null)
                        }}
                        className="btn-primary"
                        style={{ padding: '10px 6px', fontSize: '12px' }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showPalette && isAdmin && (
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
              <h2 style={{ fontWeight: 900, color: PRIMARY_PINK, margin: 0 }}>과목 총 관리</h2>
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
                await appendCoinLog({ kidId, subjectName, beforeCoins, afterCoins })
              }}
              isAdmin={isAdmin}
              allowDrag={!isMobile && !isAdmin}
              collapsibleAdminSections
            />
          </div>
        )}

        {showGoals && (
          <div className="modal-overlay" onClick={() => setShowGoals(false)}>
            <div className="modal-content glass" onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '24px', padding: isMobile ? '18px' : '30px', maxWidth: isMobile ? '95%' : '450px', width: '100%', maxHeight: isMobile ? '88vh' : '92vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontWeight: 900, color: PRIMARY_PINK }}>보상/꼭 관리</h2>
                <button onClick={() => setShowGoals(false)} style={{ border: 'none', background: 'none' }}><CloseIcon size={24} /></button>
              </div>
              <div style={{ background: LIGHT_PINK, padding: '20px', borderRadius: '18px', textAlign: 'center', marginBottom: '25px', display: 'none' }}>
                <div style={{ fontSize: '14px', color: PRIMARY_PINK, fontWeight: 'bold', marginBottom: '5px' }}>현재 코인</div>
                <strong style={{ fontSize: '34px' }}>{availableCoins}</strong>
              </div>

              <div style={{ display: 'none', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px', marginBottom: '25px' }}>
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

              <div style={{ marginBottom: '20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: isMobile ? '12px' : '14px', display: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 900 }}>용돈기입장</h3>
                  <span style={{ fontSize: '11px', color: '#666' }}>{getFullName(activeKidId)} 전용</span>
                </div>

                <div style={{ display: 'grid', gap: '8px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input className="input-field" type="date" value={newAllowance.date} onChange={(e) => setNewAllowance({ ...newAllowance, date: e.target.value })} />
                    <select className="input-field" value={newAllowance.type} onChange={(e) => setNewAllowance({ ...newAllowance, type: e.target.value })}>
                      <option value="income">받음(+)</option>
                      <option value="expense">씀(-)</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input className="input-field" placeholder="내용 (예: 간식)" value={newAllowance.title} onChange={(e) => setNewAllowance({ ...newAllowance, title: e.target.value })} />
                    <input className="input-field" type="number" min="0" placeholder="금액" value={newAllowance.amount} onChange={(e) => setNewAllowance({ ...newAllowance, amount: e.target.value })} />
                  </div>
                  <input className="input-field" placeholder="메모 (선택)" value={newAllowance.memo} onChange={(e) => setNewAllowance({ ...newAllowance, memo: e.target.value })} />
                  <button className="btn-primary" onClick={handleAddAllowance} style={{ width: '100%' }}>기록 추가</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '10px' }}>
                  <div style={{ background: '#ecfdf5', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#166534' }}>받은 금액</div>
                    <div style={{ fontWeight: 900, color: '#166534' }}>+{allowanceSummary.totalIncome}</div>
                  </div>
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#991b1b' }}>쓴 금액</div>
                    <div style={{ fontWeight: 900, color: '#991b1b' }}>-{allowanceSummary.totalExpense}</div>
                  </div>
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#1d4ed8' }}>잔액</div>
                    <div style={{ fontWeight: 900, color: '#1d4ed8' }}>{allowanceSummary.balance}</div>
                  </div>
                </div>

                <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'grid', gap: '8px' }}>
                  {allowanceEntries.slice().reverse().map((entry) => (
                    <div key={entry.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '8px 10px', fontSize: '12px', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                      <div>
                        <div style={{ fontWeight: 800 }}>{entry.title} ({entry.type === 'income' ? '+' : '-'}{entry.amount})</div>
                        <div style={{ color: '#999' }}>{entry.date}{entry.memo ? ` · ${entry.memo}` : ''}</div>
                      </div>
                      <button onClick={() => handleDeleteAllowance(entry.id)} style={{ border: 'none', background: 'none', color: PRIMARY_PINK, cursor: 'pointer' }}>
                        <Trash size={14} />
                      </button>
                    </div>
                  ))}
                  {allowanceEntries.length === 0 && <div style={{ fontSize: '12px', color: '#999' }}>아직 기록이 없어요.</div>}
                </div>
              </div>

              {false && isAdmin && (
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 900, marginBottom: '8px', color: '#666' }}>코인 변경 로그</h3>
                  <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'grid', gap: '8px' }}>
                    {coinLogs.slice().reverse().map((log) => (
                      <div key={log.id} style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '8px 10px', fontSize: '12px' }}>
                        <div style={{ color: '#999', marginBottom: '2px' }}>{log.createdAtLabel || log.date}</div>
                        <div style={{ fontWeight: 700 }}>
                          {getFullName(log.kidId)} · {log.subjectName} · {log.beforeCoins} → {log.afterCoins}
                        </div>
                      </div>
                    ))}
                    {coinLogs.length === 0 && <div style={{ fontSize: '12px', color: '#999' }}>아직 변경 로그가 없습니다.</div>}
                  </div>
                </div>
              )}

              {isAdmin && (
                <div style={{ display: 'grid', gap: '20px', marginBottom: '25px' }}>
                  <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '18px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 900, marginBottom: '12px' }}>보상 등록</h3>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                      <input className="input-field" placeholder="보상 이름" value={newReward.text} onChange={(e) => setNewReward({ ...newReward, text: e.target.value })} style={{ flex: 2 }} />
                      <input className="input-field" type="number" placeholder="코인" value={newReward.coins} onChange={(e) => setNewReward({ ...newReward, coins: parseInt(e.target.value, 10) || 0 })} style={{ flex: 1 }} />
                      <button onClick={addReward} className="btn-primary" style={{ padding: '12px' }}><Plus /></button>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select className="input-field" value={newReward.scope} onChange={(e) => setNewReward((prev) => ({ ...prev, scope: e.target.value }))}>
                        <option value="shared">공통</option>
                        <option value="kid">아이별</option>
                      </select>
                      {newReward.scope === 'kid' ? (
                        <select className="input-field" value={newReward.kidId || activeKidId} onChange={(e) => setNewReward((prev) => ({ ...prev, kidId: e.target.value }))}>
                          {kidsList.map((id) => <option key={id} value={id}>{getFullName(id)}</option>)}
                        </select>
                      ) : null}
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
                {rewardsForView.map((reward) => (
                  <div key={reward.id} style={{ padding: '15px', background: availableCoins >= reward.coins ? LIGHT_PINK : '#f8fafc', borderRadius: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: availableCoins >= reward.coins ? `1px solid ${PRIMARY_PINK}` : '1px solid transparent' }}>
                    <div style={{ flex: 1 }}>
                      <strong style={{ fontSize: '16px' }}>{reward.text}</strong>
                      <div style={{ fontSize: '12px', color: availableCoins >= reward.coins ? PRIMARY_PINK : '#666', fontWeight: 'bold' }}>
                        {reward.coins} 코인 · {reward.scope === 'shared' ? '공통' : getFullName(reward.kidId || activeKidId)}
                      </div>
                    </div>
                    {isAdmin ? (
                      reward.scope === 'shared' ? (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {kidsList.map((kidId) => (
                            <button key={`${reward.id}-${kidId}`} onClick={() => spendRewardForKid(reward, kidId)} className="btn-primary" style={{ padding: '8px 10px', fontSize: '12px' }}>
                              {getFullName(kidId)} 지급
                            </button>
                          ))}
                        </div>
                      ) : (
                        <button onClick={() => spendRewardForKid(reward, reward.kidId || activeKidId)} className="btn-primary" style={{ padding: '8px 15px', fontSize: '13px' }}>
                          지급
                        </button>
                      )
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {showAllowanceBook && (
          <div className="modal-overlay" onClick={() => setShowAllowanceBook(false)}>
            <div className="modal-content glass" onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '24px', padding: isMobile ? '18px' : '24px', maxWidth: isMobile ? '95%' : '520px', width: '100%', maxHeight: isMobile ? '88vh' : '80vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h2 style={{ fontWeight: 900, color: PRIMARY_PINK, margin: 0 }}>{getFullName(activeKidId)} 용돈기입장</h2>
                <button onClick={() => setShowAllowanceBook(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><CloseIcon /></button>
              </div>

              <div style={{ display: 'grid', gap: '8px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input className="input-field" type="date" value={newAllowance.date} onChange={(e) => setNewAllowance({ ...newAllowance, date: e.target.value })} />
                  <select className="input-field" value={newAllowance.type} onChange={(e) => setNewAllowance({ ...newAllowance, type: e.target.value })}>
                    <option value="income">받음(+)</option>
                    <option value="expense">씀(-)</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input className="input-field" placeholder="내용 (예: 간식)" value={newAllowance.title} onChange={(e) => setNewAllowance({ ...newAllowance, title: e.target.value })} />
                  <input className="input-field" type="number" min="0" placeholder="금액" value={newAllowance.amount} onChange={(e) => setNewAllowance({ ...newAllowance, amount: e.target.value })} />
                </div>
                <input className="input-field" placeholder="메모 (선택)" value={newAllowance.memo} onChange={(e) => setNewAllowance({ ...newAllowance, memo: e.target.value })} />
                <button className="btn-primary" onClick={handleAddAllowance} style={{ width: '100%' }}>기록 추가</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '10px' }}>
                <div style={{ background: '#ecfdf5', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#166534' }}>받은 금액</div>
                  <div style={{ fontWeight: 900, color: '#166534' }}>+{allowanceSummary.totalIncome}</div>
                </div>
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#991b1b' }}>쓴 금액</div>
                  <div style={{ fontWeight: 900, color: '#991b1b' }}>-{allowanceSummary.totalExpense}</div>
                </div>
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#1d4ed8' }}>잔액</div>
                  <div style={{ fontWeight: 900, color: '#1d4ed8' }}>{allowanceSummary.balance}</div>
                </div>
              </div>

              <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'grid', gap: '8px' }}>
                {(showAllAllowanceEntries ? allowanceEntries.slice().reverse() : allowanceEntries.slice().reverse().slice(0, 5)).map((entry) => (
                  <div key={entry.id} style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '8px 10px', fontSize: '12px', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{entry.title} ({entry.type === 'income' ? '+' : '-'}{entry.amount})</div>
                      <div style={{ color: '#999' }}>{entry.date}{entry.memo ? ` · ${entry.memo}` : ''}</div>
                    </div>
                    <button onClick={() => handleDeleteAllowance(entry.id)} style={{ border: 'none', background: 'none', color: PRIMARY_PINK, cursor: 'pointer' }}>
                      <Trash size={14} />
                    </button>
                  </div>
                ))}
                {allowanceEntries.length === 0 && <div style={{ fontSize: '12px', color: '#999' }}>아직 기록이 없어요.</div>}
              </div>

              {allowanceEntries.length > 5 ? (
                <button
                  onClick={() => setShowAllAllowanceEntries((prev) => !prev)}
                  style={{ marginTop: '10px', width: '100%', border: '1px solid #ffd6e0', background: '#fff7fa', color: '#d6336c', borderRadius: '10px', padding: '8px 10px', fontWeight: 800, cursor: 'pointer' }}
                >
                  {showAllAllowanceEntries ? '접기' : `더보기 (${allowanceEntries.length - 5}개)`}
                </button>
              ) : null}
            </div>
          </div>
        )}

        {showCoinLedger && (
          <div className="modal-overlay" onClick={() => setShowCoinLedger(false)}>
            <div className="modal-content glass" onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '24px', padding: isMobile ? '18px' : '24px', maxWidth: isMobile ? '95%' : '520px', width: '100%', maxHeight: isMobile ? '88vh' : '80vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h2 style={{ fontWeight: 900, color: PRIMARY_PINK, margin: 0 }}>코인 획득 내역</h2>
                <button onClick={() => setShowCoinLedger(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><CloseIcon /></button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
                <div style={{ background: '#fff7db', border: '1px solid #ffd8a8', borderRadius: '10px', padding: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#a16207' }}>현재 코인</div>
                  <div style={{ fontWeight: 900, color: '#a16207' }}>{availableCoins}</div>
                </div>
                <div style={{ background: '#fff7fb', border: '1px solid #ffd9e5', borderRadius: '10px', padding: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#be185d' }}>이번 주</div>
                  <div style={{ fontWeight: 900, color: '#be185d' }}>{weekMonthReport.weekCoins}</div>
                </div>
                <div style={{ background: '#fffdf3', border: '1px solid #ffe8b1', borderRadius: '10px', padding: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#b45309' }}>이번 달</div>
                  <div style={{ fontWeight: 900, color: '#b45309' }}>{weekMonthReport.monthCoins}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '8px' }}>
                {(() => {
                  const entries = coinLedgerByKid[activeKidId] || []
                  const grouped = entries.reduce((acc, entry) => {
                    const d = entry.date || '기타'
                    if (!acc[d]) acc[d] = { date: d, items: [], total: 0 }
                    acc[d].items.push(entry)
                    acc[d].total += Number(entry.coins || 0)
                    return acc
                  }, {})
                  
                  return Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date)).map((group) => {
                    const groupKey = group.date
                    const isExpanded = !!expandedCoinGroups[groupKey]
                    
                    return (
                      <div key={groupKey} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                        <div 
                          onClick={() => setExpandedCoinGroups(prev => ({ ...prev, [groupKey]: !isExpanded }))}
                          style={{ background: '#f8fafc', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                        >
                          <div style={{ fontSize: '13px', fontWeight: 900, color: '#334155' }}>
                            {group.date} <span style={{ color: '#94a3b8', fontWeight: 'normal', fontSize: '11px', marginLeft: '4px' }}>({group.items.length}건)</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <strong style={{ color: '#c96d00', fontSize: '14px' }}>+{group.total}</strong>
                            <span style={{ fontSize: '10px', color: '#64748b' }}>{isExpanded ? '▲' : '▼'}</span>
                          </div>
                        </div>
                        {isExpanded && (
                          <div style={{ padding: '4px 8px', background: 'white' }}>
                            {group.items.map((item) => (
                              <div key={item.id} style={{ fontSize: '12px', padding: '8px 4px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#64748b' }}>{item.title}</span>
                                <strong style={{ color: '#c96d00' }}>+{item.coins}</strong>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })
                })()}
                {(coinLedgerByKid[activeKidId] || []).length === 0 && <div style={{ fontSize: '12px', color: '#999' }}>아직 코인 획득 내역이 없어요.</div>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', marginTop: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 900, color: '#334155' }}>코인 획득 내역</h3>
                <button onClick={() => setShowAllCoinEntries((prev) => !prev)} style={{ border: '1px solid #ffd6e0', background: '#fff7fa', color: '#d6336c', borderRadius: '8px', padding: '4px 8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>
                  {showAllCoinEntries ? '접기' : '더보기'}
                </button>
              </div>

              <div style={{ display: 'grid', gap: '6px' }}>
                {(showAllCoinEntries ? (coinLedgerByKid[activeKidId] || []) : (coinLedgerByKid[activeKidId] || []).slice(0, 6)).map((entry) => (
                  <div key={entry.id} style={{ fontSize: '12px', background: '#f8fafc', borderRadius: '8px', padding: '8px 10px', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    <span>{entry.date} · {entry.title}</span>
                    <strong style={{ color: '#c96d00' }}>+{entry.coins}</strong>
                  </div>
                ))}
                {(coinLedgerByKid[activeKidId] || []).length === 0 && <div style={{ fontSize: '12px', color: '#999' }}>아직 코인 획득 내역이 없어요.</div>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', marginBottom: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 900, color: '#334155' }}>코인 변경 로그</h3>
                <button onClick={() => setShowAllCoinLogs((prev) => !prev)} style={{ border: '1px solid #ffd6e0', background: '#fff7fa', color: '#d6336c', borderRadius: '8px', padding: '4px 8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>
                  {showAllCoinLogs ? '접기' : '더보기'}
                </button>
              </div>
              <div style={{ display: 'grid', gap: '6px' }}>
                {(showAllCoinLogs ? coinChangeLogsForView.slice().reverse() : coinChangeLogsForView.slice().reverse().slice(0, 8)).map((log) => (
                  <div key={log.id} style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 10px', fontSize: '12px' }}>
                    <div style={{ color: '#999', fontSize: '11px', marginBottom: '2px' }}>{log.createdAtLabel || log.date}</div>
                    <div style={{ fontWeight: 700 }}>{getFullName(log.kidId)} · {log.subjectName} · {log.beforeCoins} → {log.afterCoins}</div>
                  </div>
                ))}
                {coinChangeLogsForView.length === 0 ? <div style={{ fontSize: '12px', color: '#999' }}>변경 로그가 없어요.</div> : null}
              </div>
            </div>
          </div>
        )}

        {showTotalAuditLog && isAdmin && (
          <div className="modal-overlay" onClick={() => setShowTotalAuditLog(false)}>
            <div className="modal-content glass" onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '24px', padding: isMobile ? '15px' : '25px', maxWidth: '600px', width: '95%', maxHeight: '88vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h2 style={{ fontWeight: 900, color: PRIMARY_PINK, margin: 0 }}>전체 활동 로그</h2>
                <button onClick={() => setShowTotalAuditLog(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><CloseIcon /></button>
              </div>

              <div style={{ display: 'flex', gap: '6px', marginBottom: '15px', overflowX: 'auto', paddingBottom: '4px' }}>
                {[
                  { id: 'all', label: '전체' },
                  { id: 'study', label: '학습/수업' },
                  { id: 'coin', label: '코인' },
                  { id: 'allowance', label: '용돈' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setAuditLogFilter(f.id)}
                    style={{
                      flexShrink: 0,
                      padding: '6px 12px',
                      borderRadius: '10px',
                      border: auditLogFilter === f.id ? `1.5px solid ${PRIMARY_PINK}` : '1.5px solid #eee',
                      background: auditLogFilter === f.id ? LIGHT_PINK : 'white',
                      color: auditLogFilter === f.id ? PRIMARY_PINK : '#666',
                      fontWeight: 900,
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
                <button 
                  onClick={() => setAuditDateFilter('all')}
                  style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '8px', border: auditDateFilter === 'all' ? `1px solid ${PRIMARY_PINK}` : '1px solid #ddd', background: auditDateFilter === 'all' ? LIGHT_PINK : 'white', color: auditDateFilter === 'all' ? PRIMARY_PINK : '#666' }}
                >전체 기간</button>
                <button 
                  onClick={() => setAuditDateFilter('today')}
                  style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '8px', border: auditDateFilter === 'today' ? `1px solid ${PRIMARY_PINK}` : '1px solid #ddd', background: auditDateFilter === 'today' ? LIGHT_PINK : 'white', color: auditDateFilter === 'today' ? PRIMARY_PINK : '#666' }}
                >오늘만</button>
              </div>

              <div style={{ background: '#fdf4f7', padding: '15px', borderRadius: '18px', marginBottom: '20px', border: '1px solid #ffdeeb' }}>
                <div style={{ fontSize: '13px', fontWeight: 900, color: PRIMARY_PINK, marginBottom: '10px' }}>🎁 코인 선물하기</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input className="input-field" type="number" placeholder="개수" id="giftAmount" style={{ width: '80px' }} />
                  <input className="input-field" placeholder="메모" id="giftMemo" style={{ flex: 1 }} />
                  <button className="btn-primary" onClick={() => {
                    const amount = parseInt(document.getElementById('giftAmount').value, 10)
                    const memo = document.getElementById('giftMemo').value
                    if (amount > 0) {
                      giftCoins(amount, memo)
                      document.getElementById('giftAmount').value = ''
                      document.getElementById('giftMemo').value = ''
                    }
                  }}>보내기</button>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '10px' }}>
                {(() => {
                  const activityLogs = doneLogs.map(l => ({ ...l, logType: 'activity' }))
                  const coinActivityLogs = coinChangeLogsForView.map(l => ({ ...l, id: l.id || `coin-${l.createdAt}`, logType: 'coin', name: l.subjectName, coins: l.afterCoins - l.beforeCoins, date: l.date }))
                  const moneyLogs = allowanceEntries.map(e => ({ ...e, logType: 'allowance', name: `[용돈] ${e.title}`, coins: e.amount, date: e.date }))

                  const combined = [...activityLogs, ...coinActivityLogs, ...moneyLogs]
                    .filter(log => {
                      if (auditDateFilter === 'today' && log.date !== todayStr) return false
                      if (auditLogFilter === 'all') return true
                      if (auditLogFilter === 'study') return log.logType === 'activity'
                      if (auditLogFilter === 'coin') return log.logType === 'coin'
                      if (auditLogFilter === 'allowance') return log.logType === 'allowance'
                      return true
                    })
                    .sort((a, b) => (b.timestamp || new Date(b.createdAt || b.date).getTime()) - (a.timestamp || new Date(a.createdAt || a.date).getTime()))

                  if (combined.length === 0) {
                    return <div style={{ textAlign: 'center', padding: '40px', color: '#999', fontSize: '14px' }}>기록된 활동이 없어요.</div>
                  }

                  return combined.map(log => (
                    <div key={`${log.logType}-${log.id}`} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 15px', borderRadius: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 900, fontSize: '14px', color: '#333' }}>{log.name}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                          {log.date} {log.createdAtLabel ? `· ${log.createdAtLabel.split(' ')[1]}` : ''} · 
                          <span style={{ marginLeft: '4px', color: log.logType === 'allowance' ? '#1d4ed8' : log.logType === 'coin' ? '#c96d00' : PRIMARY_PINK, fontWeight: 800 }}>
                            {log.logType === 'coin' ? (log.coins > 0 ? `+${log.coins}` : log.coins) : log.coins} {log.logType === 'allowance' ? '원' : '코인'}
                          </span>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          if (log.logType === 'allowance') {
                            if (window.confirm('이 용돈 내역을 삭제할까요?')) handleDeleteAllowance(log.id)
                          } else if (log.logType === 'coin') {
                            deleteCoinLog(log.id)
                          } else {
                            deleteDoneLog(log.id)
                          }
                        }}
                        style={{ border: 'none', background: '#fee2e2', color: '#ef4444', padding: '8px', borderRadius: '10px', cursor: 'pointer' }}
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  ))
                })()}
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
                  <div key={app.id} style={{ position: 'relative' }}>
                    <button onClick={() => { window.open(app.url, '_blank'); setShowAppLauncher(false); }} style={{ width: '100%', aspectRatio: '1/1', background: '#f8fafc', borderRadius: '18px', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px', cursor: 'pointer' }}>
                      <div style={{ width: '40px', height: '40px', background: PRIMARY_PINK, borderRadius: '12px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 'bold' }}>{app.name ? app.name[0] : '?'}</div>
                      <div style={{ fontSize: '12px', marginTop: '8px', fontWeight: 'bold', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.name}</div>
                    </button>
                    {isAdmin && (
                      <button onClick={() => handleDeleteApp(app.id)} style={{ position: 'absolute', top: '-5px', right: '-5px', width: '22px', height: '22px', borderRadius: '50%', background: '#fff', border: '1px solid #ddd', color: '#ff4d6d', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2 }}>
                        <CloseIcon size={14} />
                      </button>
                    )}
                  </div>
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
            <div className="modal-content glass" onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '24px', padding: '30px', maxWidth: '560px', width: '95%', maxHeight: '88vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontWeight: 900, color: PRIMARY_PINK }}>설정</h2>
                <button onClick={() => setShowSettings(false)} style={{ border: 'none', background: 'none' }}><CloseIcon /></button>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px', marginBottom: '14px' }}>
                <div style={{ fontSize: '13px', fontWeight: 900, marginBottom: '8px' }}>비밀번호 변경</div>
                <input className="input-field" type="password" placeholder="새 비밀번호 (6자 이상)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ marginBottom: '8px' }} />
                <input className="input-field" type="password" placeholder="새 비밀번호 확인" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={{ marginBottom: '8px' }} />
                <button onClick={handleChangePassword} className="btn-primary" style={{ width: '100%' }}>비밀번호 변경</button>
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
                {messages.filter((message) => message.kind !== 'system').slice().reverse().map((message) => (
                  <div key={message.id} style={{ padding: '10px', background: '#f8fafc', borderRadius: '12px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <strong>{getFullName(message.kidId)}</strong>
                      <span>{message.read ? '읽음' : '안 읽음'}</span>
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
        {showDatePicker && (
          <div className="modal-overlay" onClick={() => setShowDatePicker(false)}>
            <div className="modal-content glass" onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '24px', padding: '20px', maxWidth: '350px', width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <button onClick={() => setViewMonth(subDays(startOfMonth(viewMonth), 1))} style={{ border: 'none', background: 'none', color: PRIMARY_PINK, cursor: 'pointer' }}><ChevronLeft size={20} /></button>
                <div style={{ fontWeight: 900, fontSize: '16px' }}>{format(viewMonth, 'yyyy년 MM월')}</div>
                <button onClick={() => setViewMonth(addDays(endOfMonth(viewMonth), 1))} style={{ border: 'none', background: 'none', color: PRIMARY_PINK, cursor: 'pointer' }}><ChevronRight size={20} /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center' }}>
                {['일', '월', '화', '수', '목', '금', '토'].map(d => <div key={d} style={{ fontSize: '11px', color: '#999', fontWeight: 'bold', padding: '5px 0' }}>{d}</div>)}
                {(() => {
                  const start = startOfWeek(startOfMonth(viewMonth));
                  const end = endOfWeek(endOfMonth(viewMonth));
                  const days = [];
                  let curr = start;
                  while (curr <= end) {
                    const day = curr;
                    const isToday = isSameDay(day, new Date());
                    const isSelected = isSameDay(day, selectedDate);
                    const isCurrentMonth = isSameMonth(day, viewMonth);
                    days.push(
                      <button
                        key={day.toString()}
                        onClick={() => { setSelectedDate(day); setShowDatePicker(false); }}
                        style={{
                          border: 'none',
                          background: isSelected ? PRIMARY_PINK : isToday ? LIGHT_PINK : 'transparent',
                          color: isSelected ? 'white' : isCurrentMonth ? (getDay(day) === 0 ? '#ef4444' : getDay(day) === 6 ? '#3b82f6' : '#333') : '#ccc',
                          borderRadius: '10px',
                          padding: '8px 0',
                          fontSize: '13px',
                          fontWeight: isSelected || isToday ? '900' : 'normal',
                          cursor: 'pointer'
                        }}
                      >
                        {format(day, 'd')}
                      </button>
                    );
                    curr = addDays(curr, 1);
                  }
                  return days;
                })()}
              </div>
              <button onClick={() => { setSelectedDate(new Date()); setShowDatePicker(false); }} style={{ marginTop: '15px', width: '100%', border: '1px solid #eee', background: '#f8fafc', borderRadius: '12px', padding: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>오늘로 이동</button>
            </div>
          </div>
        )}
      </div>
    </DndContext>
  )
}

export default Dashboard
