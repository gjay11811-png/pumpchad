import { AnimatePresence, m } from 'framer-motion'
import { ACHIEVEMENTS, levelFor, xpForLevel, type SaveData } from '../save'
import type { Interactable } from '../scenes/World'
import { Icon, IconBtn } from './kit'
import { EmoteWheel } from './EmoteWheel'
import type { EmoteId } from '../emotes'

export function objectiveFor(save: SaveData) {
  const d = save.progress.discoveries
  if (!d.includes('talk_coach')) return 'Find Coach Gourdon outside Chad Gym'
  if (save.progress.gymRuns === 0) return 'Enter Chad Gym and finish a Chad Press set'
  const seeds = d.filter((x) => x.startsWith('seed_')).length
  if (seeds < 5) return `Explore Chad Square · Golden seeds ${seeds}/5`
  const got = save.progress.achievements.length
  const total = Object.keys(ACHIEVEMENTS).length
  if (got < total) return `Explore Chad Square — ${total - got} secret${total - got === 1 ? '' : 's'} left`
  return 'All achievements unlocked. Absolute chad.'
}

export function Hud({
  save,
  prompt,
  touch,
  onPause,
  onToggleSound,
  onAction,
  onEmote,
  onJump,
  emotesDisabled = false,
}: {
  save: SaveData
  prompt: Interactable | null
  touch: boolean
  onPause: () => void
  onToggleSound: () => void
  onAction: () => void
  onEmote?: (id: EmoteId) => void
  onJump?: () => void
  emotesDisabled?: boolean
}) {
  const xp = save.progress.xp
  const lvl = levelFor(xp)
  const lo = xpForLevel(lvl)
  const hi = xpForLevel(lvl + 1)
  const pct = Math.round(((xp - lo) / (hi - lo)) * 100)

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* top bar */}
      <div className="flex items-start justify-between gap-3 safe-t safe-x">
        <div className="panel pointer-events-auto flex items-center gap-3 rounded-2xl py-2 pl-2 pr-4">
          <div className="flex h-11 w-11 flex-col items-center justify-center rounded-xl bg-[linear-gradient(160deg,#ff9a3c,#c2540c)] text-ink">
            <span className="font-mono text-[9px] font-semibold leading-none">LVL</span>
            <span className="font-display text-xl leading-none">{lvl}</span>
          </div>
          <div className="min-w-0">
            <p className="max-w-[9.5rem] truncate font-display text-lg uppercase leading-tight tracking-wide sm:max-w-none">{save.character?.name}</p>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-bone/10 sm:w-32" role="progressbar" aria-label="Experience" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-[linear-gradient(90deg,#f6c870,#ff7a1a)] transition-[width] duration-700" style={{ width: `${pct}%` }} />
              </div>
              <span className="font-mono text-[10px] text-moon">{xp} XP</span>
            </div>
          </div>
        </div>
        <div className="pointer-events-auto flex gap-2">
          <IconBtn label={save.settings.muted ? 'Turn sound on' : 'Mute sound'} onClick={onToggleSound}>
            {save.settings.muted ? <Icon.mute /> : <Icon.sound />}
          </IconBtn>
          <IconBtn label="Pause menu" onClick={onPause}>
            <Icon.pause />
          </IconBtn>
        </div>
      </div>

      {/* objective */}
      <div className="mt-2 safe-x">
        <div className="inline-flex max-w-[min(92vw,26rem)] items-start gap-2.5 rounded-xl bg-ink/55 px-3 py-2 backdrop-blur-sm">
          <span className="mt-1 h-2 w-2 shrink-0 rotate-45 bg-pump" aria-hidden="true" />
          <p className="text-[13px] leading-snug text-bone/85" data-testid="objective">
            {objectiveFor(save)}
          </p>
        </div>
      </div>

      {/* interaction prompt */}
      <AnimatePresence>
        {prompt && (
          <m.div
            key={prompt.id}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className={`absolute left-1/2 -translate-x-1/2 ${touch ? 'bottom-[calc(10.5rem+env(safe-area-inset-bottom))]' : 'bottom-10'}`}
          >
            <div className="panel flex items-center gap-3 rounded-full py-2 pl-2 pr-5" data-testid="prompt">
              <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-pump px-2 font-mono text-[12px] font-semibold text-ink">{touch ? 'TAP' : 'E'}</span>
              <span className="whitespace-nowrap text-[14px] font-semibold">{prompt.label}</span>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* touch action button */}
      {touch && (
        <button
          type="button"
          aria-label={prompt ? prompt.label : 'Interact (nothing nearby)'}
          disabled={!prompt}
          onClick={onAction}
          className={`pointer-events-auto absolute bottom-[max(28px,env(safe-area-inset-bottom))] right-[max(24px,env(safe-area-inset-right))] flex h-24 w-24 items-center justify-center rounded-full font-display text-xl uppercase tracking-wide transition-all duration-200 active:scale-90 ${
            prompt ? 'btn-primary' : 'border border-bone/15 bg-ink/40 text-bone/30'
          }`}
        >
          {prompt ? 'Go' : '·'}
        </button>
      )}
      {!touch && (
        <p className="absolute bottom-3 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.25em] text-bone/35">
          WASD move · Shift run · Space jump · Q emotes · Drag look · E interact · Esc menu
        </p>
      )}
      {onEmote && onJump && <EmoteWheel touch={touch} disabled={emotesDisabled} onEmote={onEmote} onJump={onJump} />}
    </div>
  )
}

export type Toast = { id: string; title: string; desc: string; kind?: 'achievement' | 'collect' }
export function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[calc(5.5rem+env(safe-area-inset-top))] z-30 flex flex-col items-center gap-2 px-3" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <m.div
            key={t.id}
            initial={{ opacity: 0, y: -16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
            className="panel flex w-full max-w-sm items-center gap-3 rounded-2xl border-moon/40 p-3 shadow-[0_0_40px_-10px_rgba(246,200,112,0.6)]"
            data-testid="toast"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(160deg,#fff3cf,#e8b84a_45%,#9a6a22)] text-ink">
              <Icon.trophy />
            </span>
            <span className="min-w-0">
              <span className="block font-mono text-[10px] uppercase tracking-[0.22em] text-moon">{t.kind === 'collect' ? 'Collectible found' : 'Achievement unlocked'}</span>
              <span className="block truncate font-display text-lg uppercase leading-tight">{t.title}</span>
              <span className="block truncate text-[12px] text-bone/60">{t.desc}</span>
            </span>
          </m.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
