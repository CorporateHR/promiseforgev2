'use client'

import { useEffect, useRef, useState } from 'react'

const STATS = [
  { label: 'Higher completion rates', display: '40%', numeric: 40, suffix: '%' },
  { label: 'Employee engagement lift', display: '3×', numeric: 3, suffix: '×' },
  { label: 'Time to first challenge live', display: '<1hr', numeric: null, suffix: '' },
  { label: 'Audit trail on every token', display: '100%', numeric: 100, suffix: '%' },
]

function StatItem({ stat, animate }: { stat: typeof STATS[number]; animate: boolean }) {
  const [count, setCount] = useState(0)
  const done = useRef(false)

  useEffect(() => {
    if (!animate || done.current || stat.numeric === null) return
    done.current = true
    const target = stat.numeric
    const duration = 1400
    let startTime: number | null = null

    const step = (ts: number) => {
      if (!startTime) startTime = ts
      const progress = Math.min((ts - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [animate, stat.numeric])

  const value = stat.numeric === null ? stat.display : `${count}${stat.suffix}`

  return (
    <div className="flex flex-col items-center text-center gap-3">
      <div className="text-5xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-slate-900 to-slate-400 tabular-nums">
        {value}
      </div>
      <div className="text-sm text-slate-500 font-medium max-w-[120px] leading-snug">
        {stat.label}
      </div>
    </div>
  )
}

export default function StatsSection() {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.3 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section ref={ref} className="py-20 px-6 bg-slate-50 border-y border-slate-100">
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-6">
          {STATS.map((stat) => (
            <StatItem key={stat.label} stat={stat} animate={visible} />
          ))}
        </div>
      </div>
    </section>
  )
}
