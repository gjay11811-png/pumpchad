import { useEffect, useState } from 'react'
import { DRILL } from '../minigames/swordDrill'

type Detail = {
  state: 'idle' | 'run' | 'done'
  score?: number
  hits?: number
  swings?: number
  combo?: number
  bestCombo?: number
  left?: number
  result?: { xp: number; best: number; newBest: boolean } | null
}
const cmd = (c: 'quit' | 'again') => window.dispatchEvent(new CustomEvent('chad-sword-cmd', { detail: c }))

/** the Sword Drill's timer / score / result card (World broadcasts `chad-sword`; the buttons send `chad-sword-cmd`; E / GO is the cut) */
export function SwordChip({ touch }: { touch: boolean }) {
  const [d, setD] = useState<Detail>({ state: 'idle' })
  useEffect(() => {
    const f = (e: Event) => setD((e as CustomEvent<Detail>).detail)
    window.addEventListener('chad-sword', f)
    return () => window.removeEventListener('chad-sword', f)
  }, [])
  if (d.state === 'idle') return null
  const btn = 'pointer-events-auto rounded-full border border-bone/20 bg-ink/70 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-bone active:scale-95'
  return (
    <div className="pointer-events-none absolute left-1/2 top-[4.6rem] z-20 -translate-x-1/2" data-testid="sword-chip">
      <div className="panel pointer-events-auto flex min-w-[15rem] flex-col items-center gap-1.5 rounded-2xl px-4 py-2.5 text-center">
        {d.state === 'run' ? (
          <>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-moon">Sword Drill · {touch ? 'tap GO' : 'press E'} to cut</p>
            <p className="font-display text-3xl tabular-nums text-[#ffd25a]" data-testid="sword-score">
              {d.score}
            </p>
            <p className="font-mono text-[11px] uppercase tracking-wider text-bone/70">
              {d.left}s of {DRILL.seconds} · combo ×{d.combo} · hits {d.hits}/{d.swings}
            </p>
            <button type="button" className={btn} onClick={() => cmd('quit')}>
              Quit
            </button>
          </>
        ) : (
          <>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-moon">Sword Drill · finished</p>
            <p className="font-display text-3xl tabular-nums text-[#ffd25a]" data-testid="sword-final">
              {d.score}
            </p>
            <p className="font-mono text-[11px] uppercase tracking-wider text-bone/80">
              {d.result?.newBest ? 'new best' : `best ${d.result?.best ?? d.score}`} · best combo ×{d.bestCombo} · hits {d.hits}/{d.swings} · +{d.result?.xp ?? 0} XP
            </p>
            <div className="mt-1 flex gap-2">
              <button type="button" className={btn} onClick={() => cmd('again')}>
                Again
              </button>
              <button type="button" className={btn} onClick={() => cmd('quit')}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
