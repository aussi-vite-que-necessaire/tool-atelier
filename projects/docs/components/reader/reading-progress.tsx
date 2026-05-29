"use client"

import { useEffect, useState } from "react"

/** Barre de progression de lecture, fixée en haut de page. */
export function ReadingProgress() {
  const [pct, setPct] = useState(0)
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement
      const max = el.scrollHeight - el.clientHeight
      setPct(max > 0 ? Math.min(100, (el.scrollTop / max) * 100) : 0)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [])
  return (
    <div className="fixed inset-x-0 top-0 z-50 h-1">
      <div className="h-full bg-accent transition-[width] duration-150" style={{ width: `${pct}%` }} />
    </div>
  )
}
