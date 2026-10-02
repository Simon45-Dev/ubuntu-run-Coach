import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { subscribeToPush, unsubscribeFromPush } from '@/api/pushSubscriptions'
import { arrayBufferToBase64Url, isPushSupported, urlBase64ToUint8Array } from '@/lib/push'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

/**
 * Hidden entirely when the browser lacks Push API support (e.g. older iOS
 * Safari) or when no VAPID public key is configured (backend/frontend not
 * set up for push yet) - never shown as a button that would just error.
 */
const supported = isPushSupported() && Boolean(VAPID_PUBLIC_KEY)

export function PushNotificationsCard() {
  const [subscribed, setSubscribed] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!supported) {
      return
    }
    void navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setSubscribed(subscription !== null))
  }, [])

  async function enable() {
    setPending(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        toast.error('Notifications were blocked - re-enable them from your browser settings to turn this on.')
        return
      }
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // DOM lib types Uint8Array's buffer as possibly-SharedArrayBuffer,
        // which the spec's BufferSource union doesn't accept - the array is
        // always backed by a plain ArrayBuffer here, so this cast is safe.
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!) as BufferSource,
      })
      const p256dh = subscription.getKey('p256dh')
      const auth = subscription.getKey('auth')
      if (!p256dh || !auth) {
        throw new Error('Subscription is missing encryption keys')
      }
      await subscribeToPush({
        endpoint: subscription.endpoint,
        p256dh: arrayBufferToBase64Url(p256dh),
        auth: arrayBufferToBase64Url(auth),
        userAgent: navigator.userAgent,
      })
      setSubscribed(true)
      toast.success('Push notifications enabled on this device')
    } catch {
      toast.error('Could not enable push notifications')
    } finally {
      setPending(false)
    }
  }

  async function disable() {
    setPending(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await subscription.unsubscribe()
        await unsubscribeFromPush(subscription.endpoint)
      }
      setSubscribed(false)
      toast.success('Push notifications disabled on this device')
    } catch {
      toast.error('Could not disable push notifications')
    } finally {
      setPending(false)
    }
  }

  if (!supported) {
    return null
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Push notifications</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-navy/60">
          Get notified on this device when you receive a message, a new training plan, or club event
          results.
        </p>
        {subscribed ? (
          <Button variant="outline" onClick={() => void disable()} disabled={pending} className="self-start">
            {pending ? 'Disabling...' : 'Disable on this device'}
          </Button>
        ) : (
          <Button onClick={() => void enable()} disabled={pending} className="self-start">
            {pending ? 'Enabling...' : 'Enable on this device'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
