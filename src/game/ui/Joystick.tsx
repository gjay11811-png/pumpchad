import { useEffect, useRef, useState } from 'react'
import type { Input } from '../input'

/**
 * Floating virtual joystick for touch screens. The base appears wherever the thumb
 * lands inside the left zone, so it works for any hand size / phone size.
 *
 * Release safety: the stick is owned by exactly one pointer (tracked by Input). Whatever ends that touch — lifting
 * the finger anywhere on screen, the browser cancelling it, pointer capture being lost, the app going to the
 * background, the phone rotating, a menu opening, or this control unmounting — the stick returns to centre and
 * movement stops. Logic reads refs (never stale render state), so a fast tap can't leave anything behind.
 */
export function Joystick({ input, sensitivity }: { input: Input; sensitivity: number }) {
  const [base, setBase] = useState<{ x: number; y: number } | null>(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const id = useRef<number | null>(null)
  const baseRef = useRef<{ x: number; y: number } | null>(null)
  const R = 56

  const reset = () => {
    id.current = null
    baseRef.current = null
    setBase(null)
    setKnob({ x: 0, y: 0 })
  }
  const end = () => {
    if (id.current !== null) input.releaseStick(id.current)
    reset()
  }

  // Input.clear() (menus, blur, background, rotation, scene changes) resets this control too
  useEffect(() => input.onReset(reset), [input])
  // unmounted mid-touch (a menu replaced the HUD): let go of the stick rather than leave it pushed
  useEffect(
    () => () => {
      if (id.current !== null) input.releaseStick(id.current)
    },
    [input],
  )

  const update = (pointerId: number, cx: number, cy: number, bx: number, by: number) => {
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
    input.setStick(pointerId, Math.cos(ang) * v, Math.sin(ang) * v, v > 0)
  }

  return (
    <div
      data-testid="joystick-zone"
      data-no-look
      className="absolute bottom-0 left-0 z-10 h-[46%] w-[48%] touch-none select-none"
      onPointerDown={(e) => {
        // a second finger on the zone is ignored — unless the first one's touch was lost (then take over)
        if (id.current !== null && input.stickOwner === id.current) return
        id.current = e.pointerId
        try {
          // keeps tracking the thumb even if it slides off the zone; harmless if unsupported
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        } catch {
          /* no active pointer (e.g. synthetic events) — window listeners still catch the release */
        }
        baseRef.current = { x: e.clientX, y: e.clientY }
        setBase(baseRef.current)
        update(e.pointerId, e.clientX, e.clientY, e.clientX, e.clientY)
      }}
      onPointerMove={(e) => {
        const b = baseRef.current
        if (e.pointerId !== id.current || !b) return
        update(e.pointerId, e.clientX, e.clientY, b.x, b.y)
      }}
      onPointerUp={(e) => e.pointerId === id.current && end()}
      onPointerCancel={(e) => e.pointerId === id.current && end()}
      onLostPointerCapture={(e) => e.pointerId === id.current && end()}
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
