import { AnimatePresence, m } from 'framer-motion'
import { useRef } from 'react'
import { ACHIEVEMENTS, type SaveData } from '../save'
import { objectiveFor, type Toast } from './Hud'
import { tap } from './kit'

/**
 * Touch HUD: challenges collapse into a compact tab (the active objective + brief progress) so the view, the
 * joystick and the action buttons stay clear. Tapping the tab opens a sheet of scrollable challenge cards plus the
 * recent announcements (secondary notifications are grouped here instead of stacking banners). The sheet stays
 * within half the usable height, closes with the button, a swipe down or a tap outside, and while it is open the
 * game is paused and held movement cleared (GameApp) — scrolling it can never move the character or the camera.
 */
type Card = { id: string; title: string; detail?: string; done: number; total: number; steps?: { label: string; done: boolean }[] }

const CITY_STEPS: [string, string][] = [
  ['visit_square', 'Chad Square'],
  ['visit_gym', 'Pump Gym'],
  ['visit_arcade', 'Pump Arcade'],
  ['visit_citadel', 'Chad Citadel'],
  ['visit_rides', 'Chad Rides'],
]

export function challengeCards(save: SaveData): Card[] {
  const d = save.progress.discoveries
  const n = (p: string) => d.filter((x) => x.startsWith(p)).length
  const cards: Card[] = [
    { id: 'city', title: 'Discover Chad Village', done: CITY_STEPS.filter(([k]) => d.includes(k)).length, total: 5, steps: CITY_STEPS.map(([k, label]) => ({ label, done: d.includes(k) })) },
    { id: 'pumpkins', title: 'Hidden pumpkins', detail: 'Six hidden around the city — fair spots, no climbing.', done: n('hp_'), total: 6 },
    { id: 'seeds', title: 'Golden seeds', detail: 'Sparkling seeds tucked away in the old town.', done: n('seed_'), total: 5 },
    { id: 'gourds', title: 'The talking gourds', detail: 'Find and talk to all three.', done: n('gourd_'), total: 3 },
    { id: 'homes', title: 'Curious about the neighbours', detail: 'Look closely at things inside the houses.', done: n('look_'), total: 30 },
    { id: 'ach', title: 'Achievements', done: save.progress.achievements.length, total: Object.keys(ACHIEVEMENTS).length },
  ]
  // unfinished first, then finished
  return cards.sort((a, b) => Number(a.done >= a.total) - Number(b.done >= b.total))
}

/** the compact tab: objective (one line) + the most relevant progress */
export function ChallengeTab({ save, onOpen }: { save: SaveData; onOpen: () => void }) {
  const top = challengeCards(save).find((c) => c.done < c.total)
  return (
    <button
      type="button"
      {...tap(onOpen)}
      data-testid="challenge-tab"
      aria-label={`Challenges: ${objectiveFor(save)}. Tap for details`}
      className="pointer-events-auto mt-2 flex h-9 max-w-[min(70vw,22rem)] items-center gap-2 rounded-full bg-ink/60 pl-3 pr-1.5 text-left backdrop-blur-sm active:scale-[0.98]"
    >
      <span className="h-2 w-2 shrink-0 rotate-45 bg-pump" aria-hidden="true" />
      <span className="min-w-0 truncate text-[12.5px] leading-none text-bone/90" data-testid="objective">
        {objectiveFor(save)}
      </span>
      {top && (
        <span className="shrink-0 rounded-full bg-moon/15 px-2 py-1 font-mono text-[10px] leading-none text-moon" data-testid="city-progress">
          {top.done}/{top.total}
        </span>
      )}
      <span className="shrink-0 font-mono text-[11px] text-bone/50" aria-hidden="true">
        ▾
      </span>
    </button>
  )
}

/** the expanded sheet */
export function ChallengePanel({ open, save, notes, onClose }: { open: boolean; save: SaveData; notes: Toast[]; onClose: () => void }) {
  const drag = useRef<{ y: number; id: number } | null>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const cards = challengeCards(save)
  // swipe down to collapse: from the handle/header anywhere, or from the list when it's scrolled to the top
  const onDown = (e: React.PointerEvent, fromList: boolean) => {
    if (fromList && (scroller.current?.scrollTop ?? 0) > 2) return
    drag.current = { y: e.clientY, id: e.pointerId }
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId || !sheet.current) return
    const dy = Math.max(0, e.clientY - d.y)
    sheet.current.style.transform = `translateY(${dy}px)`
  }
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    const dy = e.clientY - d.y
    if (sheet.current) sheet.current.style.transform = ''
    if (dy > 70) onClose()
  }
  return (
    <AnimatePresence>
      {open && (
        <m.div key="challenges" className="absolute inset-0 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1, pointerEvents: 'auto' }} exit={{ opacity: 0, pointerEvents: 'none' }} transition={{ duration: 0.16 }} data-no-look>
          {/* tap outside to close */}
          <button type="button" aria-label="Close challenges" className="absolute inset-0 h-full w-full cursor-default bg-ink/30" onClick={onClose} tabIndex={-1} />
          <m.div
            initial={{ y: 40 }}
            animate={{ y: 0 }}
            exit={{ y: 60, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-lg landscape:max-w-md"
          >
          {/* the drag (swipe-down) transform lives on this inner layer, so it never fights the open/close animation */}
          <div
            ref={sheet}
            role="dialog"
            aria-label="Challenges"
            data-testid="challenge-panel"
            className="panel flex max-h-[min(50dvh,30rem)] w-full touch-pan-y flex-col rounded-t-3xl pb-[env(safe-area-inset-bottom)] safe-x transition-transform duration-75 landscape:max-h-[78dvh]"
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            <div className="flex shrink-0 cursor-grab items-center gap-3 px-4 pb-2 pt-2.5 touch-none" onPointerDown={(e) => onDown(e, false)} data-testid="challenge-handle">
              <div className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-bone/25" aria-hidden="true" />
              <p className="mt-2 flex-1 font-display text-xl uppercase tracking-wide">Challenges</p>
              <button type="button" {...tap(onClose)} aria-label="Close" data-testid="challenge-close" className="mt-1 flex h-11 w-11 items-center justify-center rounded-full border border-bone/15 bg-ink/50 text-lg text-bone/80 active:scale-95">
                ✕
              </button>
            </div>
            <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4" onPointerDown={(e) => onDown(e, true)} data-testid="challenge-list">
              <div className="mb-3 rounded-2xl border border-pump/40 bg-pump/10 p-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-pump">Current objective</p>
                <p className="mt-1 text-[14px] leading-snug text-bone">{objectiveFor(save)}</p>
              </div>
              {cards.map((c) => {
                const pct = Math.min(100, Math.round((c.done / Math.max(1, c.total)) * 100))
                const finished = c.done >= c.total
                return (
                  <div key={c.id} className={`mb-2.5 rounded-2xl border p-3 ${finished ? 'border-moon/20 bg-ink/30 opacity-70' : 'border-bone/10 bg-ink/45'}`} data-testid={`card-${c.id}`}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-display text-[16px] uppercase leading-tight tracking-wide">{c.title}</p>
                      <p className="shrink-0 font-mono text-[12px] text-moon">{finished ? 'Done ✓' : `${c.done}/${c.total}`}</p>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bone/10">
                      <div className="h-full rounded-full bg-[linear-gradient(90deg,#f6c870,#ff7a1a)]" style={{ width: `${pct}%` }} />
                    </div>
                    {c.detail && <p className="mt-1.5 text-[12px] leading-snug text-bone/60">{c.detail}</p>}
                    {c.steps && (
                      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                        {c.steps.map((s) => (
                          <li key={s.label} className={`text-[12px] ${s.done ? 'text-moon' : 'text-bone/55'}`}>
                            {s.done ? '✓' : '○'} {s.label}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
              {notes.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-bone/50">Recent</p>
                  {notes.slice(0, 12).map((t) => (
                    <div key={t.id} className="mb-1.5 rounded-xl bg-ink/35 px-3 py-2" data-testid="note">
                      <p className="text-[13px] leading-tight text-bone">{t.title}</p>
                      <p className="text-[11.5px] leading-snug text-bone/55">{t.desc}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  )
}
