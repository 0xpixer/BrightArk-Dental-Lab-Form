'use client'

import { useEffect, useState } from 'react'
import { BannerMedia } from './BannerMedia'

interface Banner {
  id: number
  imageUrl: string
  linkUrl: string | null
  altText: string
}

export function SidebarBannerCarousel() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/sidebar-banners')
      .then(async (response) => response.ok ? response.json() : { banners: [] })
      .then((payload) => { if (!cancelled) setBanners(payload.banners ?? []) })
      .catch(() => { if (!cancelled) setBanners([]) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (paused || banners.length < 2) return
    const timer = window.setInterval(() => setActiveIndex((current) => (current + 1) % banners.length), 6000)
    return () => window.clearInterval(timer)
  }, [banners.length, paused])

  if (!banners.length) return null
  const banner = banners[Math.min(activeIndex, banners.length - 1)]
  const image = <BannerMedia key={banner.id} url={banner.imageUrl} alt={banner.altText} />

  return <div className="space-y-1.5" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
    <div className="aspect-[3/1] overflow-hidden rounded-card border border-border bg-bg">
      {banner.linkUrl
        ? <a href={banner.linkUrl} target="_blank" rel="noopener noreferrer" className="block h-full w-full" aria-label={banner.altText}>{image}</a>
        : image}
    </div>
    {banners.length > 1 && <div className="flex justify-center gap-1" aria-label="Banner navigation">
      {banners.map((item, index) => <button key={item.id} type="button" onClick={() => setActiveIndex(index)} aria-label={`Show banner ${index + 1}`} aria-current={index === activeIndex} className={`h-1.5 rounded-full transition-[width,background-color] ${index === activeIndex ? 'w-4 bg-primary' : 'w-1.5 bg-border'}`} />)}
    </div>}
  </div>
}
