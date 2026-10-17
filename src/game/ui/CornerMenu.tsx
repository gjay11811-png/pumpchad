import { useEffect, useState } from 'react'
import { levelFor, xpForLevel, type SaveData } from '../save'
import { objectiveFor, cityProgress } from './Hud'
import { resetCtlLayout, resizeCtl, setCtlEditing, useCtlStore } from './Ctl'

/**
 * THE CORNER MENU (touch). Everything that is not a movement or riding control lives behind ONE small button in the top-left corner: the player (level, XP, coins), the current quest,
 * map / photo / sound / pause, emotes, the camera (behind / first person / side, and the third-person distance) and "Edit controls". It is closed by default; tap to expand downwards,
 * tap again to collapse.
 */
type View = 'chase' | 'side' | 'first'
const setRide = (d: { view?: View; dist?: number }) => window.dispatchEvent(new CustomEvent('chad-ride-set', { detail: d }))

export function CornerMenu({
  save,
  onPause,
  onProfile,
  onToggleSound,
  onPhoto,
  onMap,
  onChallenges,
  emotesDisabled,
}: {
  save: SaveData
  onPause: () => void
  onProfile?: () => void
  onToggleSound: () => void
  onPhoto?: () => void
  onMap?: () => void
  onChallenges?: () => void
  emotesDisabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [cam, setCam] = useState<{ view: View; dist: number }>({ view: 'chase', dist: 1 })
  const { editing } = useCtlStore()
  const [sel, setSel] = useState<string | null>(null)
  // the visible height (with Safari's bars showing) for the panel's max height
  useEffect(() => {
    const f = () => document.documentElement.style.setProperty('--vvh', `${window.visualViewport?.height ?? window.innerHeight}px`)
    f()
    window.visualViewport?.addEventListener('resize', f)
    window.addEventListener('orientationchange', f)
    return () => {
      window.visualViewport?.removeEventListener('resize', f)
      window.removeEventListener('orientationchange', f)
    }
  }, [])
  useEffect(() => {
    const f = (e: Event) => setCam((e as CustomEvent<{ view: View; dist: number }>).detail)
    const g = (e: Event) => setSel((e as CustomEvent<string>).detail)
    window.addEventListener('chad-ride-camera', f)
    window.addEventListener('chad-ctl-select', g)
    window.dispatchEvent(new CustomEvent('chad-ride-camera-ask'))
    return () => {
      window.removeEventListener('chad-ride-camera', f)
      window.removeEventListener('chad-ctl-select', g)
    }
  }, [])
  const xp = save.progress.xp
  const lvl = levelFor(xp)
  const lo = xpForLevel(lvl)
  const hi = xpForLevel(lvl + 1)
  const pct = Math.round(((xp - lo) / (hi - lo)) * 100)
  const item = 'pointer-events-auto flex h-9 items-center justify-center rounded-lg bg-bone/10 px-2 font-mono text-[10px] uppercase tracking-wider text-bone active:bg-pump active:text-ink'
  const close = () => setOpen(false)

  if (editing) {
    return (
      <div className="pointer-events-auto absolute left-1/2 top-[max(6px,env(safe-area-inset-top))] z-40 flex -translate-x-1/2 items-center gap-1.5 rounded-xl bg-ink/90 px-2 py-1.5" data-testid="edit-bar">
        <span className="font-mono text-[10px] uppercase tracking-wider text-moon">{sel ? `Editing: ${sel}` : 'Drag a control'}</span>
        <button type="button" className={item} disabled={!sel} onClick={() => sel && resizeCtl(sel, -0.1)} aria-label="Smaller" data-testid="edit-smaller">
          −
        </button>
        <button type="button" className={item} disabled={!sel} onClick={() => sel && resizeCtl(sel, 0.1)} aria-label="Bigger" data-testid="edit-bigger">
          +
        </button>
        <button type="button" className={item} onClick={() => (resetCtlLayout(), setSel(null))} data-testid="edit-reset">
          Restore defaults
        </button>
        <button type="button" className="pointer-events-auto flex h-9 items-center rounded-lg bg-pump px-3 font-display text-[12px] uppercase text-ink" onClick={() => (setCtlEditing(false), setSel(null))} data-testid="edit-done">
          Done
        </button>
      </div>
    )
  }
  return (
    <div className="pointer-events-none absolute left-[max(8px,env(safe-area-inset-left))] top-[max(8px,env(safe-area-inset-top))] z-30" data-testid="corner-menu">
      <button
        type="button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        data-testid="corner-menu-btn"
        onClick={() => setOpen((o) => !o)}
        className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-xl border border-bone/25 bg-ink/70 font-mono text-[16px] text-bone"
        style={{ touchAction: 'manipulation' }}
      >
        {open ? '✕' : '☰'}
      </button>
      {open && (
        <div className="pointer-events-auto mt-1 w-[15.5rem] max-w-[72vw] rounded-xl border border-bone/15 bg-ink/92 p-2.5 text-bone backdrop-blur-md" data-testid="corner-menu-panel" style={{ maxHeight: 'calc(var(--vvh, 100vh) - 3.5rem)', overflowY: 'auto' }}>
          <button type="button" className="flex w-full items-center gap-2 text-left" onClick={() => (close(), onProfile?.())} aria-label="Open profile">
            <span className="flex h-9 w-9 flex-col items-center justify-center rounded-lg bg-[linear-gradient(160deg,#ff9a3c,#c2540c)] text-ink">
              <span className="font-mono text-[7px] font-semibold leading-none">LVL</span>
              <span className="font-display text-base leading-none">{lvl}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-[13px] uppercase leading-tight">{save.character?.name}</span>
              <span className="mt-0.5 flex items-center gap-1.5">
                <span className="h-1 w-14 overflow-hidden rounded-full bg-bone/10" role="progressbar" aria-label="Experience" aria-valuenow={pct}>
                  <span className="block h-full rounded-full bg-[linear-gradient(90deg,#f6c870,#ff7a1a)]" style={{ width: `${pct}%` }} />
                </span>
                <span className="font-mono text-[9px] text-moon">{xp} XP</span>
                <span className="font-mono text-[9px] text-[#ffd25a]">◉ {save.progress.coins}</span>
              </span>
            </span>
          </button>
          <button type="button" className="mt-2 block w-full rounded-lg bg-bone/10 px-2 py-1.5 text-left text-[11px] leading-snug" onClick={() => (close(), onChallenges?.())} data-testid="menu-quest">
            <span className="font-mono text-[9px] uppercase tracking-wider text-moon">Quest</span>
            <span className="block">{objectiveFor(save)}</span>
            {cityProgress(save) && <span className="block font-mono text-[9px] uppercase tracking-wider text-moon/80">{cityProgress(save)}</span>}
          </button>
          <div className="mt-2 grid grid-cols-3 gap-1">
            {onMap && (
              <button type="button" className={item} onClick={() => (close(), onMap())} data-testid="menu-map">
                Map
              </button>
            )}
            {onPhoto && (
              <button type="button" className={item} onClick={() => (close(), onPhoto())}>
                Photo
              </button>
            )}
            <button type="button" className={item} onClick={onToggleSound} data-testid="menu-sound">
              {save.settings.muted ? 'Sound off' : 'Sound on'}
            </button>
            <button
              type="button"
              className={item}
              disabled={emotesDisabled}
              onClick={() => (close(), window.dispatchEvent(new CustomEvent('chad-emote-open')))}
              data-testid="menu-emote"
            >
              Emote
            </button>
            <button type="button" className={item} onClick={() => (close(), onPause())} data-testid="menu-pause">
              Pause
            </button>
            <button type="button" className={item} onClick={() => (close(), setCtlEditing(true))} data-testid="menu-edit-controls">
              Edit controls
            </button>
          </div>
          <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-moon">Camera</p>
          <div className="mt-1 grid grid-cols-3 gap-1" data-testid="menu-camera">
            {([['chase', 'Behind'], ['first', 'First person'], ['side', 'Side']] as const).map(([v, n]) => (
              <button key={v} type="button" onClick={() => setRide({ view: v })} className={`rounded-lg px-1 py-1.5 font-mono text-[9px] uppercase tracking-wider ${cam.view === v ? 'bg-pump text-ink' : 'bg-bone/10 text-bone'}`} aria-pressed={cam.view === v} data-testid={`cam-${v}`}>
                {n}
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="font-mono text-[9px] uppercase tracking-wider text-bone/70">Distance</span>
            <button type="button" className={`${item} !h-7 w-8`} onClick={() => setRide({ dist: Math.max(0.7, +(cam.dist - 0.1).toFixed(2)) })} aria-label="Camera closer">
              −
            </button>
            <span className="w-8 text-center font-mono text-[10px]">{cam.dist.toFixed(1)}×</span>
            <button type="button" className={`${item} !h-7 w-8`} onClick={() => setRide({ dist: Math.min(1.6, +(cam.dist + 0.1).toFixed(2)) })} aria-label="Camera further">
              +
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
