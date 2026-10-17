import { useEffect, useState } from 'react'
import { rideBtn, releaseAllRideButtons, requestGetOff, type RideBtn } from '../bike/controls'

type Practice = { name: string; line: string; score: number | null; best: number | null } | null
type School = { step: number; total: number; text: string; done: boolean } | null
type Detail =
  | { riding: false }
  | { riding: true; name: string; kmh: number; up: boolean; slow: boolean; view: 'chase' | 'side'; practice: Practice; wheelieTime: number; wheelieDist: number; best: { t: number; d: number }; phase: string; note: string; assist: number; school: School }

const set = (d: { assist?: number; school?: boolean; view?: 'chase' | 'side' }) => window.dispatchEvent(new CustomEvent('chad-ride-set', { detail: d }))

/**
 * The riding HUD, kept small so the road and the rider stay visible:
 *   · while mounted the big profile / objective panels fold away (CSS below) and a one-line speed pill takes their place;
 *   · the optional lessons, the wheelie-assist setting and the key hints live behind ONE small corner button; a second small button swaps the camera (behind / side-on);
 *   · on a phone: LEFT thumb = the floating joystick (steering), RIGHT thumb = a big GAS and a BRAKE. Nothing else is always on screen. REVERSE appears only when the bike is nearly stopped,
 *     ONE HAND only while the front wheel is already up (it changes the rider's pose; it never starts or holds the wheelie). There is no REV / lift button: the gas lifts the front.
 *     Every button is its own element with its own pointer capture, so any combination can be held at once and no finger cancels another; each releases on pointer-up, cancel and
 *     lost capture (and everything is released on pause, focus loss, orientation change, dismount and reset).
 */
function Key({ k, label, sub, className, testid }: { k: RideBtn; label: string; sub?: string; className?: string; testid: string }) {
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
      aria-label={sub ? `${label} (${sub})` : label}
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
      className={`pointer-events-auto flex select-none flex-col items-center justify-center rounded-2xl border font-display uppercase leading-none tracking-wide backdrop-blur-sm transition-transform ${down ? 'scale-95 border-pump bg-pump text-ink' : 'border-bone/30 bg-ink/60 text-bone'} ${className ?? ''}`}
      style={{ touchAction: 'none', WebkitTouchCallout: 'none' }}
    >
      <span className="text-[13px]">{label}</span>
      {sub && <span className="mt-0.5 font-mono text-[8px] tracking-wider opacity-70">{sub}</span>}
    </button>
  )
}

const ASSIST = ['Off', 'Low', 'Medium', 'High'] as const
const assistIdx = (a: number) => (a < 0.05 ? 0 : a < 0.45 ? 1 : a < 0.75 ? 2 : 3)
const assistVal = [0, 0.3, 0.6, 0.9]

export function RideHud({ touch }: { touch: boolean }) {
  const [d, setD] = useState<Detail>({ riding: false })
  const [menu, setMenu] = useState(false)
  const [lessons, setLessons] = useState(true)
  useEffect(() => {
    const f = (e: Event) => setD((e as CustomEvent<Detail>).detail)
    window.addEventListener('chad-ride-hud', f)
    return () => {
      window.removeEventListener('chad-ride-hud', f)
      releaseAllRideButtons()
    }
  }, [])
  const riding = d.riding
  useEffect(() => {
    if (!riding) setMenu(false)
  }, [riding])
  if (!d.riding) return null
  const lesson = lessons && d.school && !d.school.done ? d.school : null
  return (
    <>
      {/* fold the big on-foot panels away while mounted; on a phone the walking buttons go too */}
      <style>{`[data-testid="hud-profile"],[data-testid="challenge-tab"],[data-testid="objective-wrap"],[data-testid="walk-hint"]{display:none!important}${touch ? `[data-testid="sprint"],[data-testid="jump-button"],[data-testid="emote-button"],button[aria-label^="Interact"]{display:none!important}` : ''}`}</style>

      <div className="pointer-events-none absolute left-[max(12px,env(safe-area-inset-left))] top-[max(10px,env(safe-area-inset-top))] flex flex-col items-start gap-1" data-testid="ride-hud">
        <div className="flex items-center gap-1.5">
          <p className="rounded-full bg-ink/70 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-moon">
            {d.name} · <span data-testid="ride-speed">{d.kmh}</span> km/h
          </p>
          <button
            type="button"
            onClick={() => set({ view: d.view === 'side' ? 'chase' : 'side' })}
            aria-label={d.view === 'side' ? 'Camera: side view (tap for behind)' : 'Camera: behind (tap for side view)'}
            data-testid="ride-view-btn"
            className="pointer-events-auto flex h-8 items-center rounded-full bg-ink/70 px-2.5 font-mono text-[10px] uppercase tracking-wider text-moon"
          >
            {d.view === 'side' ? 'Side' : 'Behind'}
          </button>
          <button
            type="button"
            onClick={() => setMenu((m) => !m)}
            aria-label="Ride options and lessons"
            aria-expanded={menu}
            data-testid="ride-menu-btn"
            className="pointer-events-auto relative flex h-8 w-8 items-center justify-center rounded-full bg-ink/70 font-mono text-[15px] text-moon"
          >
            ⋯{lesson && <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-pump" aria-hidden="true" />}
          </button>
        </div>
        {d.practice && (
          <p className="rounded-lg bg-ink/75 px-3 py-1 font-mono text-[10px] leading-snug tracking-[0.08em] text-bone" data-testid="ride-practice">
            <span className="uppercase text-moon">{d.practice.name}</span> · {d.practice.line}
            {d.practice.score !== null && <span className="ml-1 text-pump">{d.practice.score}</span>}
            {d.practice.best !== null && <span className="ml-1 text-bone/60">best {d.practice.best}</span>}
          </p>
        )}
        {d.up && (
          <p className="rounded-full bg-ink/70 px-3 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-bone" data-testid="ride-wheelie">
            Wheelie {d.wheelieTime.toFixed(1)} s · {d.wheelieDist} m
          </p>
        )}
        {!d.up && d.best.t > 0 && (
          <p className="rounded-full bg-ink/45 px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-bone/70" data-testid="ride-best">
            Best {d.best.t.toFixed(1)} s · {d.best.d} m
          </p>
        )}
        {d.note && <p className="rounded-full bg-pump px-3 py-0.5 font-display text-[11px] uppercase tracking-wide text-ink">{d.note}</p>}
      </div>

      {menu && (
        <div className="pointer-events-auto absolute left-[max(12px,env(safe-area-inset-left))] top-[calc(max(10px,env(safe-area-inset-top))+2.6rem)] w-64 max-w-[70vw] rounded-xl bg-ink/85 p-3 text-bone backdrop-blur-sm" data-testid="ride-menu">
          {d.school && !d.school.done && (
            <div data-testid="ride-school">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-moon">
                Ride school {d.school.step + 1}/{d.school.total} · optional
              </p>
              <p className="mt-1 text-[12px] leading-snug">{d.school.text}</p>
              <button type="button" className="mt-1 text-[10px] uppercase tracking-widest text-bone/60 underline" onClick={() => (setLessons(false), set({ school: false }))}>
                Hide lessons
              </button>
            </div>
          )}
          {(!d.school || d.school.done || !lessons) && (
            <button type="button" className="text-[10px] uppercase tracking-widest text-bone/60 underline" onClick={() => (setLessons(true), set({ school: true }))}>
              Show lessons
            </button>
          )}
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-moon">Wheelie assist</p>
          <div className="mt-1 flex gap-1" data-testid="ride-assist-menu">
            {ASSIST.map((n, i) => (
              <button key={n} type="button" onClick={() => set({ assist: assistVal[i] })} className={`rounded-lg px-2 py-1 font-mono text-[10px] uppercase tracking-wider ${assistIdx(d.assist) === i ? 'bg-pump text-ink' : 'bg-bone/10 text-bone'}`}>
                {n}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[9px] leading-tight text-bone/60">Softens the wobble near the balance point. It never holds a wheelie for you.</p>
          {!touch && <p className="mt-2 text-[10px] leading-snug text-bone/70">W gas · S brake · A D steer · R reverse (nearly stopped) · Space rear brake · Shift one hand (in a wheelie) · E get off</p>}
        </div>
      )}

      {!touch && (
        <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-ink/55 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-moon/90" data-testid="ride-keys">
          W gas · S brake · A D steer · Shift one hand (in a wheelie) · E get off
        </p>
      )}

      {touch && (
        <>
          <button
            type="button"
            data-testid="ride-getoff"
            className="pointer-events-auto absolute right-[max(12px,env(safe-area-inset-right))] top-[calc(max(10px,env(safe-area-inset-top))+3.6rem)] rounded-full border border-bone/30 bg-ink/65 px-3 py-1.5 font-display text-[11px] uppercase tracking-wide text-bone active:scale-90"
            onPointerDown={(e) => (e.preventDefault(), requestGetOff())}
          >
            Get off
          </button>
          <div className="pointer-events-none absolute bottom-[max(14px,env(safe-area-inset-bottom))] right-[max(14px,env(safe-area-inset-right))] flex flex-col items-end gap-2" data-testid="ride-buttons">
            {d.up && <Key k="trick" label="One hand" testid="ride-trick" className="h-11 w-[5.6rem] text-[12px]" />}
            {d.slow && !d.up && <Key k="reverse" label="Reverse" testid="ride-reverse" className="h-9 w-[5.2rem] text-[10px] opacity-80" />}
            <div className="flex items-end gap-3">
              <Key k="brake" label="Brake" testid="ride-brake" className="h-[4.6rem] w-[4.6rem] text-[14px]" />
              <Key k="throttle" label="Gas" testid="ride-throttle" className="h-[5.8rem] w-[5.8rem] text-[18px]" />
            </div>
          </div>
        </>
      )}
    </>
  )
}
