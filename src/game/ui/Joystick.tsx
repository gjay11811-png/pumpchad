import { useRef, useState } from 'react'
import type { Input } from '../input'

/**
 * Floating virtual joystick for touch screens. The base appears wherever the thumb
 * lands inside the left zone, so it works for any hand size / phone size.
 */
export function Joystick({ input, sensitivity }: { input: Input; sensitivity: number }) {
  const [base, setBase] = useState<{ x: number; y: number } | null>(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const id = useRef<number | null>(null)
  const R = 56

  const update = (cx: number, cy: number, bx: number, by: number) => {
    let dx = cx - bx
    let dy = cy - by
    const d = Math.hypot(dx, dy)
    if (d > R) {
      dx *= R / d
      dy *= R / d
    }
    setKnob({ x: dx, y: dy })
    // dead zone + sensitivity curve
    const n = Math.min(1, d / R)
    const v = n < 0.12 ? 0 : Math.min(1, ((n - 0.12) / 0.88) * sensitivity)
    const ang = Math.atan2(dy, dx)
    input.stick = { x: Math.cos(ang) * v, y: Math.sin(ang) * v, active: v > 0 }
  }

  const end = () => {
    id.current = null
    setBase(null)
    setKnob({ x: 0, y: 0 })
    input.stick = { x: 0, y: 0, active: false }
  }

  return (
    <div
      data-testid="joystick-zone"
      data-no-look
      className="absolute bottom-0 left-0 z-10 h-[46%] w-[48%] touch-none"
      onPointerDown={(e) => {
        if (id.current !== null) return
        id.current = e.pointerId
        try {
          // keeps tracking the thumb even if it slides off the zone; harmless if unsupported
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        } catch {
          /* no active pointer (e.g. synthetic events) — tracking still works without capture */
        }
        setBase({ x: e.clientX, y: e.clientY })
        update(e.clientX, e.clientY, e.clientX, e.clientY)
      }}
      onPointerMove={(e) => {
        if (e.pointerId !== id.current || !base) return
        update(e.clientX, e.clientY, base.x, base.y)
      }}
      onPointerUp={(e) => e.pointerId === id.current && end()}
      onPointerCancel={(e) => e.pointerId === id.current && end()}
    >
      {base ? (
        <div className="pointer-events-none fixed" style={{ left: base.x - R - 14, top: base.y - R - 14 }}>
          <div className="relative rounded-full border border-moon/25 bg-ink/40 backdrop-blur-sm" style={{ width: (R + 14) * 2, height: (R + 14) * 2 }}>
            <div
              className="absolute left-1/2 top-1/2 h-16 w-16 rounded-full bg-[radial-gradient(circle_at_35%_30%,#ffb066,#ff7a1a_60%,#c2540c)] shadow-[0_0_24px_rgba(255,122,26,0.55)]"
              style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
            />
          </div>
        </div>
      ) : (
        <div className="pointer-events-none absolute bottom-[max(28px,env(safe-area-inset-bottom))] left-[max(28px,env(safe-area-inset-left))] flex h-28 w-28 items-center justify-center rounded-full border border-moon/15 bg-ink/25">
          <div className="h-12 w-12 rounded-full border border-pump/50 bg-pump/15" />
        </div>
      )}
    </div>
  )
}
