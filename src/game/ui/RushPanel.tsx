import { AnimatePresence, m } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { audio } from '../audio'
import { RUSH, type RushGame, type RushStats } from '../minigames/pumpkinRush'
import { Btn, Label } from './kit'

export type RushResult = { xp: number; mult: number; best: number; newBest: boolean }
type Phase = 'ready' | 'run' | 'done'

/** Pumpkin Rush: instructions → 3-2-1 → 45 s sprint (live time / score / combo) → results → play again. */
export function RushPanel({
  rush,
  best,
  onPhase,
  onFinish,
  onClose,
}: {
  rush: RushGame
  best: number
  /** tells the app whether the world should run (only during the sprint itself) */
  onPhase: (p: Phase) => void
  /** a finished run; returns the rewards actually awarded */
  onFinish: (s: RushStats) => RushResult
  onClose: () => void
}) {
  const [phase, setPhaseState] = useState<Phase>('ready')
  const [count, setCount] = useState(0)
  const [pops, setPops] = useState<{ k: number; pts: number; combo: number; gold: boolean }[]>([])
  const [result, setResult] = useState<{ s: RushStats; r: RushResult } | null>(null)
  const timeRef = useRef<HTMLSpanElement>(null)
  const scoreRef = useRef<HTMLSpanElement>(null)
  const comboRef = useRef<HTMLSpanElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const popK = useRef(0)
  const setPhase = (p: Phase) => {
    setPhaseState(p)
    onPhase(p)
  }

  // live HUD straight to the DOM (no React render per frame)
  useEffect(() => {
    if (phase !== 'run') return
    let raf = 0
    let lastCount = -1
    const loop = () => {
      if (rush.phase === 'countdown') {
        const c = Math.ceil(rush.countdown)
        if (c !== lastCount) {
          lastCount = c
          setCount(c)
          audio.play('rep')
        }
      } else if (lastCount !== 0) {
        lastCount = 0
        setCount(0)
        audio.play('confirm')
      }
      if (timeRef.current) timeRef.current.textContent = rush.timeLeft.toFixed(1)
      if (scoreRef.current) scoreRef.current.textContent = String(rush.stats.score)
      if (comboRef.current) comboRef.current.textContent = rush.combo > 1 ? `×${rush.combo}` : ''
      if (barRef.current) barRef.current.style.width = `${(rush.timeLeft / RUSH.duration) * 100}%`
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [phase, rush])

  useEffect(() => {
    rush.onGrab = (pts, combo, gold) => {
      audio.play(gold || combo >= 3 ? 'perfect' : 'rep')
      const k = ++popK.current
      setPops((p) => [...p.slice(-3), { k, pts, combo, gold }])
      setTimeout(() => setPops((p) => p.filter((x) => x.k !== k)), 900)
    }
    rush.onEnd = (s) => {
      audio.play('achievement')
      setResult({ s, r: onFinish(s) })
      setPhase('done')
    }
    return () => {
      rush.onGrab = null
      rush.onEnd = null
    }
    // onFinish / setPhase are recreated per render; the latest closure is what we want at the end of a run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  })

  // leaving the panel always stops the round (no orphaned pumpkins, no reward)
  useEffect(() => () => rush.stop(), [rush])

  const start = () => {
    audio.play('confirm')
    setResult(null)
    setPops([])
    rush.start()
    setPhase('run')
  }
  const quit = () => {
    rush.stop()
    onClose()
  }

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (key === 'escape') quit()
      if ((key === 'enter' || key === 'e') && phase !== 'run') {
        e.preventDefault()
        start()
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col">
      {phase === 'run' && (
        <>
          <div className="mx-auto mt-[calc(4.6rem+env(safe-area-inset-top))] w-[min(92vw,26rem)]" data-testid="rush-hud">
            <div className="panel pointer-events-auto rounded-2xl px-4 py-2.5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <Label className="text-moon/80">Pumpkin Rush</Label>
                  <p className="font-display text-4xl leading-none">
                    <span ref={scoreRef} data-testid="rush-score">0</span>
                    <span ref={comboRef} className="ml-2 text-2xl text-molten" />
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-4xl leading-none tabular-nums">
                    <span ref={timeRef} data-testid="rush-time">{RUSH.duration.toFixed(1)}</span>
                    <span className="text-lg text-bone/50">s</span>
                  </p>
                  <button type="button" onClick={quit} className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone/50 underline-offset-2 hover:underline" data-testid="rush-quit">
                    Quit
                  </button>
                </div>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bone/10">
                <div ref={barRef} className="h-full rounded-full bg-[linear-gradient(90deg,#ff7a1a,#f6c870)]" style={{ width: '100%' }} />
              </div>
            </div>
            <div className="relative mt-2 h-10 text-center">
              <AnimatePresence>
                {pops.map((p) => (
                  <m.p key={p.k} initial={{ y: 12, opacity: 0, scale: 0.8 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -14, opacity: 0 }} className={`absolute inset-x-0 font-display text-3xl uppercase ${p.gold ? 'text-chain' : 'text-molten'}`}>
                    +{p.pts}
                    {p.combo > 1 && <span className="ml-2 font-mono text-base text-bone/80">combo ×{p.combo}</span>}
                    {p.gold && <span className="ml-2 font-mono text-base text-chain">golden!</span>}
                  </m.p>
                ))}
              </AnimatePresence>
            </div>
          </div>
          <AnimatePresence>
            {count > 0 && (
              <m.p key={count} initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }} className="absolute inset-x-0 top-[34%] text-center font-display text-[9rem] leading-none text-molten drop-shadow-[0_0_30px_rgba(255,122,26,0.6)]" data-testid="rush-count">
                {count}
              </m.p>
            )}
          </AnimatePresence>
        </>
      )}

      <div className="flex-1" />

      <AnimatePresence mode="wait">
        {phase === 'ready' && (
          <Card key="ready">
            <Label className="text-moon/80">Mini-game</Label>
            <p className="mt-1 font-display text-4xl uppercase leading-none">Pumpkin Rush</p>
            <ul className="mt-3 grid gap-1.5 text-[14px] text-bone/80">
              <li>• {RUSH.duration} seconds. Glowing pumpkins light up around Chad Square — run into them to grab them.</li>
              <li>• Grab the next one within {RUSH.comboWindow}s to build a combo (up to ×{RUSH.maxCombo}).</li>
              <li>• Every {RUSH.goldEvery}th pumpkin is golden: triple points. Follow the light beams. Sprint with Shift / the far stick.</li>
            </ul>
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ash" data-testid="rush-best">Your best: {best || '—'}</p>
            <div className="mt-5 flex gap-2">
              <Btn className="flex-1" size="lg" onClick={start} sound={null} data-testid="rush-start">
                Start
              </Btn>
              <Btn variant="ghost" size="lg" onClick={quit} data-testid="rush-close">
                Not now
              </Btn>
            </div>
          </Card>
        )}
        {phase === 'done' && result && (
          <Card key="done">
            <Label className="text-moon/80">Time!</Label>
            <p className="mt-1 font-display text-6xl leading-none" data-testid="rush-final">
              {result.s.score}
            </p>
            <p className={`mt-1 font-mono text-[11px] uppercase tracking-[0.2em] ${result.r.newBest ? 'text-chain' : 'text-ash'}`} data-testid="rush-record">
              {result.r.newBest ? 'New personal best!' : `Best: ${result.r.best}`}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {(
                [
                  ['Pumpkins', result.s.grabbed],
                  ['Golden', result.s.gold],
                  ['Best combo', result.s.bestCombo ? `×${result.s.bestCombo}` : '—'],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="rounded-xl bg-bone/[0.04] py-2 ring-1 ring-bone/10">
                  <p className="font-display text-2xl">{v}</p>
                  <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-ash">{k}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center font-display text-2xl uppercase text-molten" data-testid="rush-xp">
              +{result.r.xp} XP
            </p>
            {result.r.mult < 1 && <p className="mt-1 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-ash">Tired legs · {Math.round(result.r.mult * 100)}% XP for more runs today</p>}
            <div className="mt-4 flex gap-2">
              <Btn className="flex-1" onClick={start} sound={null} data-testid="rush-again">
                Play again
              </Btn>
              <Btn variant="ghost" className="flex-1" onClick={quit} data-testid="rush-done">
                Done
              </Btn>
            </div>
          </Card>
        )}
      </AnimatePresence>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <m.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} className="pointer-events-auto px-3 pb-3 safe-b safe-x">
      <div className="panel mx-auto max-w-xl rounded-[24px] p-5 md:p-6">{children}</div>
    </m.div>
  )
}
