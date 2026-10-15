import { useEffect, useState } from 'react'
import { MEDAL_NAME, fmtMs } from '../parkour'

type Detail = {
  state: 'idle' | 'run' | 'done'
  id?: string
  name?: string
  ms?: number
  text?: string
  cp?: number
  cps?: number
  falls?: number
  result?: { ms: number; falls: number; medal: number; coins: number; newBest: boolean; best: number; xp: number } | null
}

const cmd = (c: 'checkpoint' | 'restart' | 'exit') => window.dispatchEvent(new CustomEvent('chad-parkour-cmd', { detail: c }))

/** the live timer / result card for the Chad Parkour Yard (World broadcasts `chad-parkour`; buttons send `chad-parkour-cmd`; R / T / X do the same on a keyboard) */
export function ParkourChip({ touch }: { touch: boolean }) {
  const [d, setD] = useState<Detail>({ state: 'idle' })
  useEffect(() => {
    const f = (e: Event) => setD((e as CustomEvent<Detail>).detail)
    window.addEventListener('chad-parkour', f)
    return () => window.removeEventListener('chad-parkour', f)
  }, [])
  if (d.state === 'idle') return null
  const btn = 'pointer-events-auto rounded-full border border-bone/20 bg-ink/70 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-bone active:scale-95'
  return (
    <div className="pointer-events-none absolute left-1/2 top-[4.6rem] z-20 -translate-x-1/2" data-testid="parkour-chip">
      <div className="panel pointer-events-auto flex min-w-[15rem] flex-col items-center gap-1.5 rounded-2xl px-4 py-2.5 text-center">
        {d.state === 'run' ? (
          <>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-moon">{d.name}</p>
            <p className="font-display text-3xl tabular-nums text-[#ffd25a]" data-testid="parkour-time">
              {d.text}
            </p>
            <p className="font-mono text-[11px] uppercase tracking-wider text-bone/70">
              Checkpoint {d.cp}/{d.cps} · Falls {d.falls}
            </p>
            <div className="mt-1 flex gap-2">
              <button type="button" className={btn} onClick={() => cmd('checkpoint')}>
                Checkpoint{touch ? '' : ' · R'}
              </button>
              <button type="button" className={btn} onClick={() => cmd('restart')}>
                Restart{touch ? '' : ' · T'}
              </button>
              <button type="button" className={btn} onClick={() => cmd('exit')}>
                Exit{touch ? '' : ' · X'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-moon">{d.name} · finished</p>
            <p className="font-display text-3xl tabular-nums text-[#ffd25a]" data-testid="parkour-final">
              {fmtMs(d.ms ?? 0)}
            </p>
            {d.result && (
              <p className="font-mono text-[11px] uppercase tracking-wider text-bone/80">
                {MEDAL_NAME[d.result.medal]} · {d.result.newBest ? 'new best' : `best ${fmtMs(d.result.best)}`} · falls {d.result.falls} · +{d.result.coins} coins
              </p>
            )}
            <div className="mt-1 flex gap-2">
              <button type="button" className={btn} onClick={() => cmd('restart')}>
                Run again
              </button>
              <button type="button" className={btn} onClick={() => cmd('exit')}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
