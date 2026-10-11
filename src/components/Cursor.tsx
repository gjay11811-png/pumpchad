import { m, useMotionValue, useSpring } from 'framer-motion'
import { useEffect, useState } from 'react'

/** Minimal desktop cursor: a dot plus a lagging ring that grows over interactive elements. */
export function Cursor() {
  const [enabled, setEnabled] = useState(false)
  const [hover, setHover] = useState(false)
  const [visible, setVisible] = useState(false)
  const x = useMotionValue(-100)
  const y = useMotionValue(-100)
  const rx = useSpring(x, { stiffness: 380, damping: 32, mass: 0.5 })
  const ry = useSpring(y, { stiffness: 380, damping: 32, mass: 0.5 })

  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!fine || reduce) return
    setEnabled(true)
    document.documentElement.classList.add('has-chad-cursor')

    const move = (e: PointerEvent) => {
      x.set(e.clientX)
      y.set(e.clientY)
      setVisible(true)
      const t = e.target as Element | null
      setHover(!!t?.closest('a, button, [role="button"]'))
    }
    const leave = () => setVisible(false)
    window.addEventListener('pointermove', move, { passive: true })
    document.addEventListener('pointerleave', leave)
    return () => {
      window.removeEventListener('pointermove', move)
      document.removeEventListener('pointerleave', leave)
      document.documentElement.classList.remove('has-chad-cursor')
    }
  }, [x, y])

  if (!enabled) return null
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[80]" style={{ opacity: visible ? 1 : 0, transition: 'opacity .3s' }}>
      <m.div style={{ x: rx, y: ry }} className="absolute left-0 top-0">
        <div
          className="-translate-x-1/2 -translate-y-1/2 rounded-full border border-pump/70 transition-[width,height,background-color] duration-300 ease-chad"
          style={{ width: hover ? 56 : 32, height: hover ? 56 : 32, backgroundColor: hover ? 'rgba(255,122,26,0.12)' : 'transparent' }}
        />
      </m.div>
      <m.div style={{ x, y }} className="absolute left-0 top-0">
        <div className="h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pump" />
      </m.div>
    </div>
  )
}
