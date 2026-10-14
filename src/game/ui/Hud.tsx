import { AnimatePresence, m } from 'framer-motion'
import { ACHIEVEMENTS, levelFor, xpForLevel, type SaveData } from '../save'
import type { Interactable } from '../scenes/World'
import { Icon, IconBtn, tap } from './kit'
import { EmoteWheel } from './EmoteWheel'
import type { EmoteId } from '../emotes'
import { ChallengeTab } from './Challenges'

export function objectiveFor(save: SaveData) {
  const d = save.progress.discoveries
  if (!d.includes('talk_coach')) return 'Find Coach Gourdon outside Pump Gym'
  if (save.progress.gymRuns === 0) return 'Enter Pump Gym and finish a Chad Press set'
  const seeds = d.filter((x) => x.startsWith('seed_')).length
  if (seeds < 5) return `Explore Chad City · Golden seeds ${seeds}/5`
  const got = save.progress.achievements.length
  const total = Object.keys(ACHIEVEMENTS).length
  if (got < total) return `Explore Chad City — ${total - got} secret${total - got === 1 ? '' : 's'} left`
  return 'All achievements unlocked. Absolute chad.'
}

/** compact optional-activity line: Discover Chad City n/5 · Hidden pumpkins n/6 (hidden once both are done) */
export function cityProgress(save: SaveData) {
  const d = save.progress.discoveries
  const steps = ['visit_square', 'visit_gym', 'visit_arcade', 'visit_citadel', 'visit_rides'].filter((k) => d.includes(k)).length
  const hp = d.filter((x) => x.startsWith('hp_')).length
  const parts: string[] = []
  if (steps < 5) parts.push(`Discover Chad City ${steps}/5`)
  if (hp < 6) parts.push(`Hidden pumpkins ${hp}/6`)
  return parts.join(' · ')
}

export function Hud({
  save,
  prompt,
  touch,
  onPause,
  onProfile,
  onToggleSound,
  onAction,
  onEmote,
  onJump,
  emotesDisabled = false,
  sprint = false,
  onSprint,
  onPhoto,
  onChallenges,
}: {
  /** touch: open the challenges sheet (the objective collapses into a tab) */
  onChallenges?: () => void
  /** open photo mode (camera button, top right) */
  onPhoto?: () => void
  save: SaveData
  prompt: Interactable | null
  touch: boolean
  onPause: () => void
  /** open the player profile (tap the level badge) */
  onProfile?: () => void
  onToggleSound: () => void
  onAction: () => void
  onEmote?: (id: EmoteId) => void
  onJump?: () => void
  emotesDisabled?: boolean
  /** touch: Sprint toggle state + handler */
  sprint?: boolean
  onSprint?: () => void
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
        <button type="button" {...tap(() => onProfile?.())} aria-label="Open profile" data-testid="hud-profile" className="panel pointer-events-auto flex items-center gap-3 rounded-2xl py-2 pl-2 pr-4 text-left transition-transform active:scale-[0.97]">
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
        </button>
        <div className="pointer-events-auto flex gap-2">
          {onPhoto && (
            <IconBtn label="Photo mode" onClick={onPhoto}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
            </IconBtn>
          )}
          <IconBtn label={save.settings.muted ? 'Turn sound on' : 'Mute sound'} onClick={onToggleSound}>
            {save.settings.muted ? <Icon.mute /> : <Icon.sound />}
          </IconBtn>
          <IconBtn label="Pause menu" onClick={onPause}>
            <Icon.pause />
          </IconBtn>
        </div>
      </div>

      {/* objective: on touch screens a compact tab (tap → the challenges sheet), so the view stays clear */}
      {touch && onChallenges ? (
        <div className="safe-x">
          <ChallengeTab save={save} onOpen={onChallenges} />
        </div>
      ) : (
      <div className="mt-2 safe-x">
        <div className="inline-flex max-w-[min(92vw,26rem)] items-start gap-2.5 rounded-xl bg-ink/55 px-3 py-2 backdrop-blur-sm">
          <span className="mt-1 h-2 w-2 shrink-0 rotate-45 bg-pump" aria-hidden="true" />
          <div>
            <p className="text-[13px] leading-snug text-bone/85" data-testid="objective">
              {objectiveFor(save)}
            </p>
            {cityProgress(save) && (
              <p className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-moon/90" data-testid="city-progress">
                {cityProgress(save)}
              </p>
            )}
          </div>
        </div>
      </div>
      )}

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

      {/* touch sprint toggle (sits above the emote button, left of Jump) */}
      {touch && onSprint && (
        <button
          type="button"
          aria-label="Sprint"
          aria-pressed={sprint}
          onPointerDown={(e) => {
            e.preventDefault()
            onSprint()
          }}
          data-testid="sprint"
          className={`pointer-events-auto absolute bottom-[calc(max(28px,env(safe-area-inset-bottom))+6.5rem)] right-[calc(max(24px,env(safe-area-inset-right))+7rem)] flex h-16 w-16 flex-col items-center justify-center rounded-full font-display text-[13px] uppercase leading-none tracking-wide backdrop-blur-sm transition-all duration-150 active:scale-90 ${
            sprint ? 'btn-primary shadow-[0_0_24px_rgba(255,122,26,0.7)]' : 'border border-bone/20 bg-ink/55 text-bone'
          }`}
        >
          <span aria-hidden className="text-lg leading-none">»</span>
          {sprint ? 'Run on' : 'Sprint'}
        </button>
      )}

      {/* touch action button */}
      {touch && (
        <button
          type="button"
          aria-label={prompt ? prompt.label : 'Interact (nothing nearby)'}
          disabled={!prompt}
          {...tap(onAction)}
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

/** big centred "LEVEL UP" moment */
export function LevelUpBanner({ level }: { level: number }) {
  return (
    <m.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.08 }}
      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
      className="pointer-events-none absolute inset-x-0 top-[28%] z-30 flex flex-col items-center"
      role="status"
      aria-live="assertive"
      data-testid="level-up"
    >
      <p className="font-mono text-[12px] uppercase tracking-[0.45em] text-moon">Level up</p>
      <p className="font-display text-[clamp(4rem,14vw,8rem)] uppercase leading-[0.9] text-transparent [-webkit-text-stroke:0] bg-[linear-gradient(180deg,#fff3cf,#f6c870_45%,#ff7a1a)] bg-clip-text drop-shadow-[0_0_30px_rgba(255,122,26,0.55)]">
        Level {level}
      </p>
      <p className="mt-1 text-[14px] text-bone/75">Bigger. Stronger. Chaddier.</p>
    </m.div>
  )
}

export type Toast = { id: string; title: string; desc: string; kind?: 'achievement' | 'collect' | 'discover' }
export function Toasts({ toasts, compact = false }: { toasts: Toast[]; compact?: boolean }) {
  if (compact)
    return (
      <div className="pointer-events-none absolute inset-x-0 top-[calc(6.4rem+env(safe-area-inset-top))] z-30 flex justify-center px-3 landscape:top-[calc(4.2rem+env(safe-area-inset-top))]" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <m.div
              key={t.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="flex max-w-[min(86vw,22rem)] items-center gap-2 rounded-full bg-ink/75 px-3 py-1.5 backdrop-blur-sm"
              data-testid="toast"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-moon text-ink" aria-hidden="true">
                ★
              </span>
              <span className="min-w-0 truncate text-[12.5px] leading-none text-bone">
                <b className="font-semibold">{t.title}</b>
                <span className="text-bone/60"> · {t.desc}</span>
              </span>
            </m.div>
          ))}
        </AnimatePresence>
      </div>
    )
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
              <span className="block font-mono text-[10px] uppercase tracking-[0.22em] text-moon">{t.kind === 'collect' ? 'Collectible found' : t.kind === 'discover' ? 'Chad City' : 'Achievement unlocked'}</span>
              <span className="block truncate font-display text-lg uppercase leading-tight">{t.title}</span>
              <span className="block truncate text-[12px] text-bone/60">{t.desc}</span>
            </span>
          </m.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
