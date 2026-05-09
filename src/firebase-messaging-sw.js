import { initializeApp } from 'firebase/app'
import { getMessaging, isSupported, onBackgroundMessage } from 'firebase/messaging/sw'
import { firebaseConfig } from './firebaseConfig'

const app = initializeApp(firebaseConfig)
const appUrl = new URL('../', self.location.href).href
const iconUrl = new URL('../icon.svg', self.location.href).href

const resolveAppUrl = (url) => {
  try {
    if (!url || url === '/') return appUrl
    return new URL(url, appUrl).href
  } catch {
    return appUrl
  }
}

self.addEventListener('notificationclick', (event) => {
  const url = resolveAppUrl(event.notification?.data?.url)
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const matchingClient = clientList.find((client) => {
        try {
          return new URL(client.url).origin === self.location.origin
        } catch {
          return false
        }
      })

      if (matchingClient) {
        matchingClient.focus()
        matchingClient.navigate(url)
        return
      }

      return clients.openWindow(url)
    })
  )
})

isSupported()
  .then((supported) => {
    if (!supported) return

    const messaging = getMessaging(app)

    onBackgroundMessage(messaging, (payload) => {
      const notification = payload.notification || {}
      const data = payload.data || {}
      const title = notification.title || data.title || '새 알림'
      const body = notification.body || data.body || ''

      return self.registration.showNotification(title, {
        body,
        icon: iconUrl,
        badge: iconUrl,
        data: {
          url: resolveAppUrl(data.url)
        }
      })
    })
  })
  .catch(() => {})
