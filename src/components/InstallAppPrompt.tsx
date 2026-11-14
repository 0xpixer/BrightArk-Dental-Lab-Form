'use client'

import { useEffect, useState } from 'react'
import { EllipsisVertical, Share, SquarePlus, X } from 'lucide'
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

  const iconBox = 'mx-0.5 inline-grid h-6 w-6 place-items-center rounded-md bg-white/15 align-middle text-white'
  const closeButton = <button type="button" onClick={dismiss} aria-label="Dismiss" className="absolute right-0.5 top-0.5 grid h-10 w-10 place-items-center rounded-full text-white/70 hover:text-white"><MorphIcon icon={X} className="h-4 w-4" /></button>

  // Android / desktop-class Chrome: the browser can show its own install dialog.
  if (installEvent) return <div role="dialog" aria-label="Install BrightArk" className="fixed inset-x-3 bottom-3 z-40 rounded-2xl bg-neutral-900/95 px-4 pb-4 pt-3.5 text-center text-white shadow-2xl backdrop-blur md:hidden" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
    {closeButton}
    <p className="px-8 text-sm leading-6">Install BrightArk on your phone to open your orders in one tap.</p>
    <button type="button" onClick={() => void install()} className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-card bg-primary text-sm font-semibold text-white hover:bg-orange-600"><MorphIcon icon={SquarePlus} className="h-4 w-4" />Install app</button>
  </div>

  // iOS Safari: point down at the Share button in the bottom toolbar.
  if (isIOS) return <div role="dialog" aria-label="Add BrightArk to your home screen" className="fixed inset-x-3 bottom-3 z-40 md:hidden" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
    <div className="relative rounded-2xl bg-neutral-900/95 px-4 pb-4 pt-3.5 text-center text-white shadow-2xl backdrop-blur">
      {closeButton}
      <p className="px-8 text-sm leading-7">You can install this app on your phone, simply tap <span className={iconBox}><MorphIcon icon={Share} className="h-4 w-4" /></span> and then <span className="whitespace-nowrap font-semibold">&lsquo;Add to Home Screen&rsquo; <span className={iconBox}><MorphIcon icon={SquarePlus} className="h-4 w-4" /></span></span>.</p>
    </div>
    <div className="mx-auto -mt-px h-0 w-0 border-x-[10px] border-t-[10px] border-x-transparent border-t-neutral-900/95" aria-hidden />
  </div>

  // Other mobile browsers (e.g. Android without the install event): point up at the ⋮ menu.
  return <div role="dialog" aria-label="Add BrightArk to your home screen" className="fixed inset-x-3 top-2 z-40 md:hidden">
    <div className="ml-auto mr-3 h-0 w-0 border-x-[10px] border-b-[10px] border-x-transparent border-b-neutral-900/95" aria-hidden />
    <div className="relative -mt-px rounded-2xl bg-neutral-900/95 px-4 pb-4 pt-3.5 text-center text-white shadow-2xl backdrop-blur">
      {closeButton}
      <p className="px-8 text-sm leading-7">You can install this app on your phone, simply tap <span className={iconBox}><MorphIcon icon={EllipsisVertical} className="h-4 w-4" /></span> in the browser and then <span className="whitespace-nowrap font-semibold">&lsquo;Add to Home screen&rsquo; <span className={iconBox}><MorphIcon icon={SquarePlus} className="h-4 w-4" /></span></span>.</p>
    </div>
  </div>
}
