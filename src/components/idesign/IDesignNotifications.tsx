'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, BellRing, CircleX, X } from 'lucide'
import { usePathname } from 'next/navigation'
import { MorphIcon } from '@/components/ui/MorphIcon'

interface NotificationRow {
  id: number
  caseId: number
  title: string
  body: string
  readAt: string | null
  createdAt: string
}

export function IDesignNotifications() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const load = useCallback(async () => {
    const response = await fetch('/api/idesign/notifications', { cache: 'no-store' })
    const payload = await response.json().catch(() => ({}))
    if (response.ok) {
      setNotifications(payload.notifications ?? [])
      setUnreadCount(payload.unreadCount ?? 0)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const openNotification = async (notification: NotificationRow) => {
    if (!notification.readAt) {
      await fetch('/api/idesign/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: notification.id }) })
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item))
      setUnreadCount((current) => Math.max(0, current - 1))
    }
    setOpen(false)
  }

  const detailBase = pathname.startsWith('/portal') ? '/portal/idesign/orders' : '/admin/idesign/orders'
  return <div className="relative">
    <button type="button" onClick={() => setOpen((value) => !value)} className="relative grid h-10 w-10 place-items-center rounded-card border border-border bg-surface text-text-muted hover:bg-bg hover:text-text" title="Notifications" aria-expanded={open}>
      <MorphIcon icon={Bell} hoverIcon={BellRing} className="h-4 w-4" />
      {unreadCount > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />}
      <span className="sr-only">{unreadCount} unread notifications</span>
    </button>
    {open && <div className="absolute right-0 z-30 mt-2 w-[min(90vw,360px)] overflow-hidden max-md:fixed max-md:inset-x-3 max-md:top-16 max-md:mt-0 max-md:w-auto max-md:shadow-xl rounded-card border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3"><div><h2 className="text-sm font-semibold text-text">Notifications</h2><p className="text-xs text-text-muted">{unreadCount} unread</p></div><button type="button" onClick={() => setOpen(false)} className="rounded p-1.5 text-text-muted hover:bg-bg" title="Close"><MorphIcon icon={X} hoverIcon={CircleX} className="h-4 w-4" /></button></div>
      <div className="max-h-96 overflow-y-auto">{notifications.length === 0 ? <p className="px-4 py-10 text-center text-sm text-text-muted">No notifications yet</p> : notifications.map((notification) => <Link key={notification.id} href={`${detailBase}/${notification.caseId}`} onClick={() => void openNotification(notification)} className={`block border-b border-border px-4 py-3 last:border-0 hover:bg-bg ${notification.readAt ? '' : 'bg-pink-50/60'}`}><div className="flex items-start gap-2"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.readAt ? 'bg-border' : 'bg-red-500'}`} /><div className="min-w-0"><p className="text-sm font-medium text-text">{notification.title}</p><p className="mt-1 text-xs text-text-muted">{notification.body}</p><p className="mt-1.5 text-[10px] text-text-muted">{formatDate(notification.createdAt)}</p></div></div></Link>)}</div>
    </div>}
  </div>
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
