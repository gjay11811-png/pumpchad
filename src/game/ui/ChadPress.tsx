import { AnimatePresence, m } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { REPS, applyGrade, judge, markerAt, newRun, repSpec, type Grade, type RepSpec, type RunState } from '../chadpress'
import type { Gym } from '../scenes/Gym'
import { audio } from '../audio'
import { Btn, Label } from './kit'

type Phase = 'intro' | 'countdown' | 'playing' | 'resolving' | 'results'

export function ChadPress({
  gym,
  best,
  onFinish,
  onExit,
}: {
  gym: Gym
  best: number
  /** called once per completed set; returns XP actually awarded */
  onFinish: (run: RunState) => number
  onExit: () => void
}) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [run, setRun] = useState<RunState>(newRun())
  const [spec, setSpec] = useState<RepSpec>(() => repSpec(0))
  const [count, setCount] = useState(3)
  const [last, setLast] = useState<{ g: Grade; pts: number; k: number } | null>(null)
  const [award, setAward] = useState<{ xp: number; newBest: boolean } | null>(null)
  const markerRef = useRef<HTMLDivElement>(null)
  const posRef = useRef(0)
  const t0 = useRef(0)
  const raf = useRef(0)

  // marker animation — written straight to the DOM (no React re-render per frame)
  useEffect(() => {
    if (phase !== 'playing') return
    t0.current = performance.now() - Math.random() * 400
    const loop = () => {
      const p = markerAt((performance.now() - t0.current) / 1000, spec.speed)
      posRef.current = p
      if (markerRef.current) markerRef.current.style.left = `${p * 100}%`
      gym.setPress(0.05 + p * 0.12) // the bar trembles at the shoulders while you line it up
      raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf.current)
  }, [phase, spec, gym])

  const start = () => {
    audio.play('confirm')
    gym.reset()
    setRun(newRun())
    setSpec(repSpec(0))
    setLast(null)
    setAward(null)
    setCount(3)
    setPhase('countdown')
  }

  useEffect(() => {
    if (phase !== 'countdown') return
    if (count === 0) {
      setPhase('playing')
      return
    }
    audio.play('click')
    const id = setTimeout(() => setCount((c) => c - 1), 650)
    return () => clearTimeout(id)
  }, [phase, count])

  const press = useCallback(() => {
    if (phase !== 'playing') return
    cancelAnimationFrame(raf.current)
    const g = judge(posRef.current, spec)
    const { state, points } = applyGrade(run, g)
    setRun(state)
    setLast({ g, pts: points, k: state.rep })
    setPhase('resolving')
    if (g === 'miss') {
      audio.play('miss')
      gym.missShake()
      gym.setPress(0.25)
    } else {
      audio.play(g === 'perfect' ? 'perfect' : 'rep')
      if (g === 'perfect') gym.perfectFlash()
      gym.setPress(1)
    }
    setTimeout(() => {
      gym.setPress(0)
      if (state.rep >= REPS) {
        gym.celebrate()
        audio.play('achievement')
        const xp = onFinish(state)
        setAward({ xp, newBest: state.score > best })
        setPhase('results')
      } else {
        setSpec(repSpec(state.rep))
        setPhase('playing')
      }
    }, 700)
  }, [phase, spec, run, gym, onFinish, best])

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (key === ' ' || key === 'e' || key === 'enter') {
        e.preventDefault()
        if (phase === 'intro' || phase === 'results') return
        press()
      }
      if (key === 'escape' && (phase === 'intro' || phase === 'results')) onExit()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [press, phase, onExit])

  const gradeStyle = { perfect: 'text-chain', good: 'text-molten', miss: 'text-alarm' }

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col">
      <div className="flex items-start justify-between safe-t safe-x">
        <div>
          <Label className="text-moon/80">Chad Gym</Label>
          <h1 className="font-display text-4xl uppercase leading-none md:text-5xl">
            Chad <span className="text-molten">Press</span>
          </h1>
        </div>
        {(phase === 'playing' || phase === 'resolving' || phase === 'countdown') && (
          <div className="panel rounded-2xl px-4 py-2 text-right" data-testid="press-score">
            <p className="font-display text-3xl leading-none">{run.score}</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
              Rep {Math.min(run.rep + 1, REPS)}/{REPS} · Combo ×{run.combo}
            </p>
          </div>
        )}
      </div>

      <div className="flex-1" />

      <AnimatePresence mode="wait">
        {phase === 'intro' && (
          <Card key="intro">
            <p className="font-display text-3xl uppercase">Ten reps. No excuses.</p>
            <ul className="mt-3 space-y-1.5 text-[15px] text-bone/75">
              <li>• Press when the marker is inside the zone.</li>
              <li>
                • <span className="text-moon">Gold</span> = PERFECT (100) · <span className="text-pump">Orange</span> = GOOD (50).
              </li>
              <li>• Chain hits for a combo multiplier. Zones shrink every rep.</li>
            </ul>
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ash">Best: {best} · Space / E / tap to press</p>
            <div className="mt-5 flex gap-2">
              <Btn className="flex-1" size="lg" onClick={start} sound={null} data-testid="press-start">
                Start set
              </Btn>
              <Btn variant="ghost" size="lg" onClick={onExit}>
                Leave
              </Btn>
            </div>
          </Card>
        )}

        {(phase === 'countdown' || phase === 'playing' || phase === 'resolving') && (
          <m.div key="play" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pointer-events-auto px-3 pb-3 safe-b safe-x">
            <div className="mx-auto max-w-xl">
              <div className="relative mb-3 h-10 text-center">
                <AnimatePresence>
                  {last && phase === 'resolving' && (
                    <m.p key={last.k} initial={{ y: 10, opacity: 0, scale: 0.8 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className={`font-display text-4xl uppercase ${gradeStyle[last.g]}`} data-testid="press-grade">
                      {last.g}
                      {last.pts > 0 && <span className="ml-2 font-mono text-base text-bone/70">+{last.pts}</span>}
                    </m.p>
                  )}
                  {phase === 'countdown' && (
                    <m.p key={`c${count}`} initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-display text-5xl text-pump">
                      {count || 'GO'}
                    </m.p>
                  )}
                </AnimatePresence>
              </div>
              <div className="panel rounded-[22px] p-4" onPointerDown={press}>
                <div className="relative h-12 overflow-hidden rounded-xl bg-ink ring-1 ring-bone/10" data-testid="press-bar">
                  <div className="absolute inset-y-0 bg-pump/35" style={{ left: `${(spec.center - spec.good) * 100}%`, width: `${spec.good * 200}%` }} />
                  <div className="absolute inset-y-0 bg-[linear-gradient(180deg,#fff3cf,#e8b84a)] shadow-[0_0_20px_rgba(246,200,112,0.8)]" style={{ left: `${(spec.center - spec.perfect) * 100}%`, width: `${spec.perfect * 200}%` }} />
                  <div ref={markerRef} className="absolute inset-y-1 w-1.5 -translate-x-1/2 rounded-full bg-bone shadow-[0_0_12px_#fff]" style={{ left: '0%' }} />
                </div>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    press()
                  }}
                  disabled={phase !== 'playing'}
                  className="btn-primary mt-3 flex min-h-16 w-full items-center justify-center rounded-2xl font-display text-3xl uppercase tracking-wider"
                  data-testid="press-button"
                >
                  Press
                </button>
              </div>
            </div>
          </m.div>
        )}

        {phase === 'results' && award && (
          <Card key="results">
            <Label className="text-moon/80">Set complete</Label>
            <p className="mt-1 font-display text-6xl leading-none" data-testid="press-final">
              {run.score}
            </p>
            {award.newBest && <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.2em] text-moon">New personal best</p>}
            <div className="mt-4 grid grid-cols-4 gap-2 text-center">
              {[
                ['Perfect', run.perfects],
                ['Good', run.goods],
                ['Miss', run.misses],
                ['Best combo', run.maxCombo],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-bone/[0.04] py-2 ring-1 ring-bone/10">
                  <p className="font-display text-2xl">{v}</p>
                  <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-ash">{k}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center font-display text-2xl uppercase text-molten" data-testid="press-xp">
              +{award.xp} XP
            </p>
            <div className="mt-4 flex gap-2">
              <Btn className="flex-1" onClick={start} sound={null}>
                Go again
              </Btn>
              <Btn variant="ghost" className="flex-1" onClick={onExit} data-testid="press-exit">
                Back to the gym floor
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
