import { useEffect, useState } from 'react'
import { rideBtn, releaseAllRideButtons, requestGetOff, type RideBtn } from '../bike/controls'

type School = { step: number; total: number; text: string; done: boolean } | null
type Detail =
  | { riding: false }
  | { riding: true; name: string; kmh: number; up: boolean; wheelieTime: number; wheelieDist: number; best: { t: number; d: number }; phase: string; note: string; assist: number; school: School }

const set = (d: { assist?: number; school?: boolean }) => window.dispatchEvent(new CustomEvent('chad-ride-set', { detail: d }))

/**
 * The riding HUD. Deliberately small: speed, an optional wheelie time / distance readout while the front wheel is up (a score of the riding — it never
 * influences the balance, and there is no timing bar, target zone or marker), a one-line note, the short optional lessons, and — on a phone — the controls.
 * Every button is its own element with its own pointer capture, so throttle, brake, rear brake and wheelie can be held at the same moment as the joystick
 * steers; each releases on pointer-up, cancel and lost capture (and everything is released on pause, focus loss, dismount and reset).
 */
function Hold({ k, label, className, big = false, testid }: { k: RideBtn; label: string; className?: string; big?: boolean; testid: string }) {
  const [down, setDown] = useState(false)
  const off = () => {
    rideBtn[k] = false
    setDown(false)
  }
  useEffect(() => {
    const f = () => setDown(rideBtn[k])
    window.addEventListener('chad-ride-release', f)
    return () => window.removeEventListener('chad-ride-release', f)
  }, [k])
  return (
    <button
      type="button"
      data-testid={testid}
      aria-label={label}
      aria-pressed={down}
      onPointerDown={(e) => {
        e.preventDefault()
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          /* synthetic pointers can't be captured */
        }
        rideBtn[k] = true
        setDown(true)
      }}
      onPointerUp={off}
      onPointerCancel={off}
      onLostPointerCapture={off}
      onContextMenu={(e) => e.preventDefault()}
      className={`pointer-events-auto flex select-none items-center justify-center rounded-full border font-display uppercase tracking-wide backdrop-blur-sm transition-transform ${big ? 'h-24 w-24 text-lg' : 'h-[4.5rem] w-[4.5rem] text-[11px] leading-tight'} ${down ? 'scale-90 border-pump bg-pump text-ink shadow-[0_0_24px_rgba(255,122,26,0.7)]' : 'border-bone/30 bg-ink/65 text-bone'} ${className ?? ''}`}
      style={{ touchAction: 'none', WebkitTouchCallout: 'none' }}
    >
      {label}
    </button>
  )
}

const ASSIST = ['Off', 'Low', 'Medium', 'High'] as const
const assistIdx = (a: number) => (a < 0.05 ? 0 : a < 0.45 ? 1 : a < 0.75 ? 2 : 3)
const assistVal = [0, 0.3, 0.6, 0.9]

export function RideHud({ touch }: { touch: boolean }) {
  const [d, setD] = useState<Detail>({ riding: false })
  const [lessons, setLessons] = useState(true)
  const [menu, setMenu] = useState(false)
  useEffect(() => {
    const f = (e: Event) => setD((e as CustomEvent<Detail>).detail)
    window.addEventListener('chad-ride-hud', f)
    return () => {
      window.removeEventListener('chad-ride-hud', f)
      releaseAllRideButtons()
    }
  }, [])
  if (!d.riding) return null
  const showLessons = lessons && d.school && !d.school.done
  return (
    <>
      {/* the walking hint line and (on a phone) the normal touch buttons (Go, Jump, Sprint, Emote) do nothing on a bike: they get out of the way */}
      <style>{`[data-testid="walk-hint"]{display:none!important}${touch ? `[data-testid="sprint"],[data-testid="jump-button"],[data-testid="emote-button"],button[aria-label^="Interact"]{display:none!important}` : ''}`}</style>
      <div className="pointer-events-none absolute inset-x-0 top-24 flex flex-col items-center gap-1.5" data-testid="ride-hud">
        <p className="rounded-full bg-ink/70 px-4 py-1 font-mono text-[12px] uppercase tracking-[0.2em] text-moon">
          {d.name} · <span data-testid="ride-speed">{d.kmh}</span> km/h
        </p>
        {d.up && (
          <p className="rounded-full bg-ink/70 px-4 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-bone" data-testid="ride-wheelie">
            Wheelie {d.wheelieTime.toFixed(1)} s · {d.wheelieDist} m
          </p>
        )}
        {!d.up && d.best.t > 0 && (
          <p className="rounded-full bg-ink/45 px-3 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-bone/70" data-testid="ride-best">
            Best wheelie {d.best.t.toFixed(1)} s · {d.best.d} m
          </p>
        )}
        {d.note && <p className="rounded-full bg-pump px-4 py-1 font-display text-xs uppercase tracking-wide text-ink">{d.note}</p>}
      </div>
      {showLessons && d.school && (
        <div className="pointer-events-auto absolute left-[max(12px,env(safe-area-inset-left))] top-[calc(max(12px,env(safe-area-inset-top))+9.5rem)] w-60 rounded-xl bg-ink/75 p-2.5 text-bone backdrop-blur-sm" data-testid="ride-school">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-moon">
            Ride school {d.school.step + 1}/{d.school.total} · optional
          </p>
          <p className="mt-1 text-[12px] leading-snug">{d.school.text}</p>
          <button type="button" className="mt-1.5 text-[10px] uppercase tracking-widest text-bone/60 underline" onClick={() => (setLessons(false), set({ school: false }))}>
            Hide lessons
          </button>
        </div>
      )}
      <div className="pointer-events-auto absolute bottom-3 left-[max(12px,env(safe-area-inset-left))]">
        <button type="button" onClick={() => setMenu((m) => !m)} data-testid="ride-assist-btn" className="rounded-full bg-ink/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-moon">
          Wheelie assist: {ASSIST[assistIdx(d.assist)]}
        </button>
        {menu && (
          <div className="mt-1.5 flex gap-1.5 rounded-xl bg-ink/80 p-1.5" data-testid="ride-assist-menu">
            {ASSIST.map((n, i) => (
              <button key={n} type="button" onClick={() => set({ assist: assistVal[i] })} className={`rounded-lg px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${assistIdx(d.assist) === i ? 'bg-pump text-ink' : 'bg-bone/10 text-bone'}`}>
                {n}
              </button>
            ))}
            <span className="max-w-40 self-center text-[9px] leading-tight text-bone/60">Softens the wobble near the balance point. It never holds a wheelie for you.</span>
          </div>
        )}
      </div>
      {!touch && (
        <p className="pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 rounded-full bg-ink/70 px-4 py-1.5 text-center font-mono text-[10.5px] uppercase tracking-[0.16em] text-moon" data-testid="ride-keys">
          W gas · S brake (hold to reverse) · A D steer · Space rear brake · Shift lean back (wheelie) · C lean forward · E get off
        </p>
      )}
      {touch && (
        <>
          <button
            type="button"
            data-testid="ride-getoff"
            className="pointer-events-auto absolute right-[max(16px,env(safe-area-inset-right))] top-[calc(max(12px,env(safe-area-inset-top))+4.5rem)] rounded-full border border-bone/30 bg-ink/70 px-4 py-2 font-display text-xs uppercase tracking-wide text-bone active:scale-90"
            onPointerDown={(e) => (e.preventDefault(), requestGetOff())}
          >
            Get off
          </button>
          <div className="pointer-events-none absolute bottom-[max(24px,env(safe-area-inset-bottom))] right-[max(20px,env(safe-area-inset-right))] flex flex-col items-end gap-3" data-testid="ride-buttons">
            <div className="flex items-end gap-3">
              <Hold k="forward" label="Lean fwd" testid="ride-forward" className="!h-14 !w-14 !text-[9px]" />
              <Hold k="rear" label="Rear brake" testid="ride-rear" />
              <Hold k="heave" label="Lean back" testid="ride-heave" />
            </div>
            <div className="flex items-end gap-3">
              <Hold k="brake" label="Brake" testid="ride-brake" />
              <Hold k="throttle" label="Gas" big testid="ride-throttle" />
            </div>
          </div>
        </>
      )}
    </>
  )
}
