'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'brightark-sidebar-collapsed'

export function useSidebarCollapse() {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(STORAGE_KEY) === 'true')
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current
      window.localStorage.setItem(STORAGE_KEY, String(next))
      return next
    })
  }

  return { collapsed, toggleCollapsed }
}
