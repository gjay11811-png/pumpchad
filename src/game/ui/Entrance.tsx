import { AnimatePresence, m } from 'framer-motion'
import { levelFor, type SaveData } from '../save'
import { Btn, Label } from './kit'

const WORD = 'CHADVERSE'.split('')

export function Loading({ pct, label }: { pct: number; label: string }) {
  return (
    <m.div exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-ink px-6">
      <m.div
        aria-hidden="true"
        className="absolute h-[70vmin] w-[70vmin] rounded-full bg-[radial-gradient(circle,rgba(255,122,26,0.28),transparent_65%)]"
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.6, ease: 'easeOut' }}
      />
      <Label className="relative text-moon/70">Pumpchad presents</Label>
      <h1 className="relative mt-3 flex font-display text-[clamp(3rem,15vw,8rem)] uppercase leading-none" aria-label="The Chadverse">
        {WORD.map((c, i) => (
          <span key={i} className="overflow-hidden" aria-hidden="true">
            <m.span className="text-molten block" initial={{ y: '105%' }} animate={{ y: 0 }} transition={{ duration: 0.8, delay: 0.1 + i * 0.05, ease: [0.22, 1, 0.36, 1] }}>
              {c}
            </m.span>
          </span>
        ))}
      </h1>
      <div className="relative mt-10 w-[min(70vw,320px)]">
        <div className="h-[3px] overflow-hidden rounded-full bg-bone/10" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Loading">
          <div className="h-full bg-[linear-gradient(90deg,#f6c870,#ff7a1a)] transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-3 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-ash">{label}</p>
      </div>
    </m.div>
  )
}

export function Title({ save, onEnter, onWardrobe }: { save: SaveData; onEnter: (sound: boolean) => void; onWardrobe: () => void }) {
  const c = save.character
  return (
    <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className="pointer-events-auto absolute inset-0 z-30 flex flex-col justify-between bg-[linear-gradient(180deg,rgba(7,6,10,0.55),rgba(7,6,10,0.1)_35%,rgba(7,6,10,0.85)_78%)] md:bg-[linear-gradient(90deg,transparent_45%,rgba(7,6,10,0.85))] safe-t safe-b safe-x">
      <div className="flex items-center justify-between pt-1">
        <a href={import.meta.env.BASE_URL} className="font-mono text-[11px] uppercase tracking-[0.22em] text-bone/60 hover:text-bone">
          ← Pumpchad
        </a>
        <span className="rounded-full border border-moon/25 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-moon/80">Early access · v0.1</span>
      </div>

      <div className="mx-auto w-full max-w-md pb-2 text-center md:mx-0 md:ml-auto md:mr-[max(1rem,4vw)] md:w-[420px] md:pb-[8vh] md:text-left">
        <Label className="text-moon/70">Welcome to</Label>
        <h1 className="mt-1 font-display text-[clamp(3.25rem,16vw,6.5rem)] uppercase leading-[0.9]">
          The <span className="text-molten">Chadverse</span>
        </h1>
        <AnimatePresence>
          {c ? (
            <p className="mt-3 text-[15px] text-bone/75">
              Welcome back, <span className="font-semibold text-bone">{c.name}</span> · Level {levelFor(save.progress.xp)}
            </p>
          ) : (
            <p className="mt-3 text-[15px] text-bone/75">Create your chad. Explore Chad Square. Lift heavy. Free to play — no wallet needed.</p>
          )}
        </AnimatePresence>
        <div className="mt-6 grid gap-2.5">
          <Btn size="lg" onClick={() => onEnter(true)} sound={null} data-testid="enter-sound">
            {c ? 'Continue' : 'Enter'} with sound
          </Btn>
          <Btn variant="ghost" onClick={() => onEnter(false)} sound={null} data-testid="enter-muted">
            {c ? 'Continue' : 'Enter'} muted
          </Btn>
          {c && (
            <button type="button" onClick={onWardrobe} className="mt-1 text-[14px] md:text-left font-semibold text-pump underline-offset-4 hover:underline">
              Open the wardrobe first
            </button>
          )}
        </div>
      </div>
    </m.div>
  )
}

/** Orange portal wipe used for every scene change. */
export function Portal({ show, label }: { show: boolean; label: string }) {
  return (
    <AnimatePresence>
      {show && (
        <m.div
          key="portal"
          className="pointer-events-auto absolute inset-0 z-[60] flex items-center justify-center bg-ink"
          initial={{ clipPath: 'circle(0% at 50% 55%)' }}
          animate={{ clipPath: 'circle(150% at 50% 55%)' }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.65, 0, 0.35, 1] }}
        >
          <div aria-hidden="true" className="absolute h-[60vmin] w-[60vmin] animate-pulse rounded-full bg-[radial-gradient(circle,rgba(255,122,26,0.35),transparent_65%)]" />
          <p className="relative font-mono text-[12px] uppercase tracking-[0.3em] text-moon" role="status">
            {label}
          </p>
        </m.div>
      )}
    </AnimatePresence>
  )
}
