/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('push', (event) => {
  if (!event.data) return
  try {
    const data = event.data.json() as {
      title: string
      body: string
      icon?: string
      tag?: string
      url?: string
    }
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: data.icon ?? '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: data.tag ?? 'restart-dashboard',
        data: { url: data.url ?? '/dashboard' },
      })
    )
  } catch { /* skip malformed payload */ }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data as { url?: string } | null)?.url ?? '/dashboard'
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        const found = clients.find(c => c.url.includes(url))
        if (found) return found.focus()
        return self.clients.openWindow(url)
      })
  )
})
