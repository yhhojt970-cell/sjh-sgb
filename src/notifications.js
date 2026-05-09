import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { app } from './firebase'
import messagingSwUrl from './firebase-messaging-sw.js?worker&url'

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || ''

const getIconUrl = () => {
  try {
    return new URL('icon.svg', window.location.href).href
  } catch {
    return 'icon.svg'
  }
}

const storageKey = (householdId) => `sjh-sgb-fcm-token:${householdId || 'default'}`

const readStoredTokenHash = (householdId) => {
  try {
    return localStorage.getItem(storageKey(householdId)) || ''
  } catch {
    return ''
  }
}

const writeStoredTokenHash = (householdId, tokenHash) => {
  try {
    localStorage.setItem(storageKey(householdId), tokenHash)
  } catch {
    // Storage can be unavailable in private or restricted modes.
  }
}

const hashToken = async (token) => {
  if (globalThis.crypto?.subtle && globalThis.TextEncoder) {
    const encoded = new TextEncoder().encode(token)
    const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded)
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  }

  return token.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 140)
}

const getMessagingSupport = async () => {
  if (typeof window === 'undefined') return false
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false
  if (!window.isSecureContext) return false

  try {
    return await isSupported()
  } catch {
    return false
  }
}

const waitForActiveServiceWorker = (registration) => {
  if (registration.active) return Promise.resolve()

  const worker = registration.installing || registration.waiting
  if (!worker) return Promise.resolve()

  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 8000)
    worker.addEventListener('statechange', () => {
      if (worker.state === 'activated') {
        clearTimeout(timer)
        resolve()
      }
    })
  })
}

export const getPushNotificationStatus = async (householdId = '') => {
  const supported = await getMessagingSupport()
  const permission = 'Notification' in window ? Notification.permission : 'unsupported'

  return {
    supported,
    permission,
    hasVapidKey: Boolean(vapidKey),
    tokenHash: readStoredTokenHash(householdId)
  }
}

export const registerPushDevice = async ({ db, householdId, user, activeKidId, displayName }) => {
  if (!db || !householdId) {
    return { ok: false, code: 'cloud-disabled', message: '클라우드 연결을 확인해 주세요.' }
  }

  if (user?.testMode) {
    return { ok: false, code: 'test-mode', message: '테스트 화면에서는 알림을 등록하지 않아요.' }
  }

  const supported = await getMessagingSupport()
  if (!supported) {
    return { ok: false, code: 'unsupported', message: '이 브라우저에서는 웹 푸시 알림을 사용할 수 없어요.' }
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return { ok: false, code: 'permission-denied', message: '알림 권한이 허용되지 않았어요.' }
  }

  const registration = await navigator.serviceWorker.register(messagingSwUrl, {
    type: 'module',
    updateViaCache: 'none'
  })

  await waitForActiveServiceWorker(registration)

  const messaging = getMessaging(app)
  const tokenOptions = { serviceWorkerRegistration: registration }
  if (vapidKey) tokenOptions.vapidKey = vapidKey

  const token = await getToken(messaging, tokenOptions)
  if (!token) {
    return { ok: false, code: 'token-empty', message: '알림 토큰을 만들지 못했어요. Firebase Web Push 설정을 확인해 주세요.' }
  }

  const tokenHash = await hashToken(token)
  const role = user?.role === 'admin' ? 'admin' : 'child'
  const userId = user?.loginId || user?.id || ''
  const kidId = role === 'child' ? (activeKidId || userId) : ''
  const platform = navigator.userAgentData?.platform || navigator.platform || ''

  await setDoc(
    doc(db, 'households', householdId, 'notificationTokens', tokenHash),
    {
      token,
      tokenHash,
      enabled: true,
      role,
      userId,
      kidId,
      displayName: displayName || user?.id || userId,
      platform,
      userAgent: navigator.userAgent || '',
      hasVapidKey: Boolean(vapidKey),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  )

  writeStoredTokenHash(householdId, tokenHash)
  return { ok: true, code: 'registered', tokenHash, hasVapidKey: Boolean(vapidKey) }
}

export const listenForForegroundPush = async (onPayload) => {
  const supported = await getMessagingSupport()
  if (!supported || Notification.permission !== 'granted') return () => {}

  const messaging = getMessaging(app)
  return onMessage(messaging, onPayload)
}

export const showForegroundPushNotification = (payload) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return

  const notification = payload?.notification || {}
  const data = payload?.data || {}
  const title = notification.title || data.title || '새 알림'
  const body = notification.body || data.body || ''

  try {
    const notice = new Notification(title, {
      body,
      icon: getIconUrl(),
      data: { url: data.url || '.' }
    })

    notice.onclick = () => {
      window.focus()
      if (notice.data?.url) window.location.assign(notice.data.url)
      notice.close()
    }
  } catch {
    // Some mobile browsers only display notifications from the service worker.
  }
}
