/// <reference lib="webworker" />

import { precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

// Precaches only the static app shell (JS/CSS/fonts/icons) - the same
// globPatterns as before. Do NOT add registerRoute() for /api/v1/* here -
// athlete/training data must always be fetched fresh, never served stale
// from a cache.
precacheAndRoute(self.__WB_MANIFEST)

// generateSW's registerType: 'autoUpdate' handled this implicitly; under
// injectManifest the worker itself must explicitly skip-waiting/claim or a
// user can get stuck on a stale cached shell after a deploy.
self.addEventListener('install', () => {
  void self.skipWaiting()
})
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

interface PushPayload {
  title: string
  body: string
  url?: string
}

self.addEventListener('push', (event) => {
  let payload: PushPayload = { title: 'Ubuntu Run', body: 'You have a new notification' }
  try {
    if (event.data) {
      payload = event.data.json()
    }
  } catch {
    // Malformed/absent payload - fall back to the generic copy above rather
    // than dropping the notification entirely.
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      data: { url: payload.url },
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data?.url as string | undefined) ?? '/'
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = clientList.find((client) => 'focus' in client)
      if (existing) {
        await existing.focus()
        return
      }
      await self.clients.openWindow(url)
    })(),
  )
})
