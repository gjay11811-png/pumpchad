import { useEffect, useState } from 'react'
import { rideBtn, releaseAllRideButtons, requestGetOff, type RideBtn } from '../bike/controls'

type Detail = { riding: false } | { riding: true; name: string; kmh: number; pitch: number; balance: number; maxPitch: number; phase: string; note: string; wheelieTime: number }

/**
 * The riding HUD: speed, a wheelie balance meter (the green band is the balance point: keep the marker in it with small throttle / lean / rear-brake
 * adjustments), a one-line note, and — on a phone — the on-screen controls. Every button is its own element with its own pointer capture, so throttle,
 * brake, rear brake and wheelie can be held at the same moment as the joystick steers; each releases on pointer-up, cancel and lost capture.
 */
function Hold({ k, label, className, big = false, testid }: { k: RideBtn; label: string; className?: string; big?: boolean; testid: string }) {
  const [down, setDown] = useState(false)
  const off = () => {
    rideBtn[k] = false
    setDown(false)
  }
  useEffect(() => {
    // anything that wipes the held state elsewhere (Input.clear on blur / orientation) also un-presses the visual
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

export function RideHud({ touch }: { touch: boolean }) {
  const [d, setD] = useState<Detail>({ riding: false })
  useEffect(() => {
    const f = (e: Event) => setD((e as CustomEvent<Detail>).detail)
    window.addEventListener('chad-ride-hud', f)
    return () => {
      window.removeEventListener('chad-ride-hud', f)
      releaseAllRideButtons()
    }
  }, [])
  if (!d.riding) return null
  const bar = Math.min(1, d.pitch / d.maxPitch)
  const zoneLo = Math.max(0, (d.balance - 0.12) / d.maxPitch)
  const zoneHi = Math.min(1, (d.balance + 0.1) / d.maxPitch)
  const hot = d.pitch > d.balance + 0.12
  return (
    <>
      {touch && (
        // the normal touch buttons (Go, Jump, Sprint, Emote) do nothing on a bike: they get out of the way
        <style>{`[data-testid="sprint"],[data-testid="jump-button"],[data-testid="emote-button"],button[aria-label^="Interact"]{display:none!important}`}</style>
      )}
      <div className="pointer-events-none absolute inset-x-0 top-24 flex flex-col items-center gap-1.5" data-testid="ride-hud">
        <p className="rounded-full bg-ink/70 px-4 py-1 font-mono text-[12px] uppercase tracking-[0.2em] text-moon">
          {d.name} · <span data-testid="ride-speed">{d.kmh}</span> km/h
        </p>
        <div className="relative h-2.5 w-44 overflow-hidden rounded-full bg-ink/70" data-testid="ride-balance" aria-label="wheelie balance">
          <div className="absolute inset-y-0 bg-[#58d68d]/50" style={{ left: `${zoneLo * 100}%`, width: `${(zoneHi - zoneLo) * 100}%` }} />
          <div className={`absolute inset-y-0 w-1.5 rounded-full ${hot ? 'bg-[#ff5a3c]' : 'bg-bone'}`} style={{ left: `calc(${bar * 100}% - 3px)` }} />
        </div>
        {d.note && <p className="rounded-full bg-pump px-4 py-1 font-display text-xs uppercase tracking-wide text-ink">{d.note}</p>}
      </div>
      {!touch && (
        <p className="pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 rounded-full bg-ink/70 px-4 py-1.5 text-center font-mono text-[10.5px] uppercase tracking-[0.16em] text-moon" data-testid="ride-keys">
          W gas · S brake (hold to reverse) · A D steer · Space rear brake · Shift wheelie · C lean forward · E get off
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
              <Hold k="heave" label="Wheelie" testid="ride-heave" />
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
