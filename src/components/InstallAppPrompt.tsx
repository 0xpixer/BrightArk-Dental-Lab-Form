'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Share, SquarePlus, X } from 'lucide'
import { MorphIcon } from '@/components/ui/MorphIcon'

const DISMISS_KEY = 'brightark-install-prompt-dismissed-at'
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** Phone-only banner suggesting "Add to Home Screen". Hidden once installed or dismissed (for 30 days). */
export function InstallAppPrompt() {
  const [visible, setVisible] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
    const phone = window.matchMedia('(max-width: 767px)').matches
    let dismissedAt = 0
    try { dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0) } catch { /* storage blocked */ }
    if (standalone || !phone || Date.now() - dismissedAt < SNOOZE_MS) return

    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent))
    const onPrompt = (event: Event) => { event.preventDefault(); setInstallEvent(event as BeforeInstallPromptEvent) }
    const onInstalled = () => setVisible(false)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    const timer = window.setTimeout(() => setVisible(true), 1500)
    return () => { window.clearTimeout(timer); window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled) }
  }, [])

  const dismiss = () => {
    setVisible(false)
    try { window.localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* storage blocked */ }
  }

  const install = async () => {
    if (!installEvent) return
    await installEvent.prompt()
    const choice = await installEvent.userChoice
    setInstallEvent(null)
    if (choice.outcome === 'accepted') setVisible(false)
  }

  if (!visible) return null

  return <div role="dialog" aria-label="Add BrightArk to your home screen" className="fixed inset-x-3 bottom-3 z-40 rounded-card border border-border bg-surface p-3 shadow-xl md:hidden" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
    <div className="flex items-start gap-3">
      <Image src="/icons/icon-192.png" alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-card" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text">Add BrightArk to your home screen</p>
        {installEvent
          ? <p className="mt-0.5 text-xs text-text-muted">Open your orders in one tap, like an app.</p>
          : isIOS
            ? <p className="mt-0.5 text-xs text-text-muted">Tap <MorphIcon icon={Share} className="inline h-3.5 w-3.5 align-[-2px]" /> Share in Safari, then <span className="font-semibold text-text">Add to Home Screen</span>.</p>
            : <p className="mt-0.5 text-xs text-text-muted">Open the browser menu, then choose <span className="font-semibold text-text">Add to Home screen</span>.</p>}
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="-mr-1 -mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-card text-text-muted hover:bg-bg hover:text-text"><MorphIcon icon={X} className="h-4 w-4" /></button>
    </div>
    {installEvent && <button type="button" onClick={() => void install()} className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-card bg-primary text-sm font-semibold text-white hover:bg-orange-600"><MorphIcon icon={SquarePlus} className="h-4 w-4" />Install app</button>}
  </div>
}
