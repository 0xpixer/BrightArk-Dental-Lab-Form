'use client'

import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string
  remove: (id: string) => void
}

declare global { interface Window { turnstile?: TurnstileApi } }

export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null)
  const callback = useRef(onToken)
  callback.current = onToken
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    const api = window.turnstile
    if (!ready || !api || !container.current || !sitekey) return
    const id = api.render(container.current, {
      sitekey, action: 'signup', theme: 'light', size: container.current.clientWidth < 300 ? 'compact' : 'flexible',
      callback: (token: string) => { setFailed(false); callback.current(token) },
      'expired-callback': () => callback.current(''),
      'error-callback': () => { callback.current(''); setFailed(true) },
    })
    return () => { api.remove(id); callback.current('') }
  }, [ready, sitekey, retry])

  if (!sitekey) return <p role="alert" className="text-sm text-text-muted">New account registration is temporarily unavailable. Please contact BrightArk.</p>
  return <div className="min-w-0 space-y-2">
    <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={() => setReady(true)} onError={() => setFailed(true)} />
    <div ref={container} className="min-h-16" />
    {failed && <p role="alert" className="text-sm text-red-600">Security check could not load. {ready ? <button type="button" className="underline" onClick={() => { setFailed(false); setRetry((value) => value + 1) }}>Retry</button> : 'Check your connection or content blocker and reopen signup.'}</p>}
  </div>
}
