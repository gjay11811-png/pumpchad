import { AnimatePresence, m } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Gym } from '../scenes/Gym'
import { audio } from '../audio'
import { applyRep, barZone, beatPhase, judgeTap, newSet, type RepGrade, type SetState, type StationSpec } from '../workout'
import { judge, markerAt } from '../chadpress'
import { Btn, Label } from './kit'

type Phase = 'ready' | 'playing' | 'done'

/** Tempo workout for a gym station: the ring closes on the target every beat — rep on the beat for a clean rep. */
export function WorkoutPanel({
  gym,
  spec,
  lifetimeReps,
  onSetDone,
  onStop,
}: {
  gym: Gym
  spec: StationSpec
  lifetimeReps: number
  /** called once per finished set; returns the rewards actually awarded (after daily fatigue) */
  onSetDone: (s: SetState) => { xp: number; stat: number; mult: number }
  onStop: () => void
}) {
  const [phase, setPhase] = useState<Phase>('ready')
  const [set, setSet] = useState<SetState>(newSet())
  const [last, setLast] = useState<{ g: RepGrade; pts: number; k: number } | null>(null)
  const [reward, setReward] = useState({ xp: 0, stat: 0, mult: 1 })
  const statTag = spec.stat === 'stamina' ? 'STA' : 'STR'
  const ringRef = useRef<HTMLDivElement>(null)
  const isBar = spec.timing === 'bar'
  const [zone, setZone] = useState(() => barZone())
  const zoneRef = useRef(zone)
  zoneRef.current = zone
  const markerRef = useRef<HTMLDivElement>(null)
  const markerPos = useRef(0)
  const paceRef = useRef<HTMLSpanElement>(null)
  const t0 = useRef(0)
  const lastTap = useRef(-10)
  const raf = useRef(0)
  const setRef = useRef(set)
  setRef.current = set

  // ring animation straight to the DOM (no React re-render per frame)
  useEffect(() => {
    if (phase !== 'playing') return
    t0.current = performance.now()
    const loop = () => {
      const now = (performance.now() - t0.current) / 1000
      if (isBar) {
        markerPos.current = markerAt(now, zoneRef.current.speed)
        if (markerRef.current) markerRef.current.style.left = `${markerPos.current * 100}%`
      }
      const ph = beatPhase(now, spec.beat)
      if (ringRef.current) {
        ringRef.current.style.transform = `scale(${1 + (1 - ph) * 1.25})`
        ringRef.current.style.opacity = String(0.35 + ph * 0.65)
      }
      // treadmill: live belt speed (the runner's clip follows it)
      if (paceRef.current) paceRef.current.textContent = `${(gym.pace * 3.6).toFixed(1)} km/h`
      raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf.current)
  }, [phase, spec.beat, gym, isBar])

  const start = () => {
    audio.play('confirm')
    gym.beginSet()
    setSet(newSet())
    setLast(null)
    lastTap.current = -10
    setPhase('playing')
  }

  const rep = useCallback(() => {
    if (phase !== 'playing') return
    const now = (performance.now() - t0.current) / 1000
    if (now - lastTap.current < spec.beat * (spec.id === 'bag' ? 0.35 : 0.55)) return // no spamming through a rep
    lastTap.current = now
    // bar stations: inside the zone = a clean, full-power hit; a new zone each punch
    const barGrade = isBar ? judge(markerPos.current, zoneRef.current) : null
    const g: RepGrade = isBar ? (barGrade === 'miss' ? 'sloppy' : 'clean') : judgeTap(beatPhase(now, spec.beat), spec)
    if (isBar) setZone(barZone())
    if (barGrade === 'perfect') gym.perfectFlash()
    const { state, points } = applyRep(setRef.current, g, spec)
    setSet(state)
    setLast({ g, pts: points, k: state.reps })
    gym.rep(g)
    audio.play(g === 'clean' ? 'perfect' : 'rep')
    if (state.reps >= spec.reps) {
      setTimeout(() => {
        gym.setDone()
        audio.play('achievement')
        setReward(onSetDone(state))
        setPhase('done')
      }, 650)
    }
  }, [phase, spec, gym, onSetDone, isBar])

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (key === ' ' || key === 'e' || key === 'enter') {
        e.preventDefault()
        if (e.repeat) return
        if (phase === 'playing') rep()
        else if (phase === 'ready') start()
      }
      if (key === 'escape') onStop()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
    // start is stable enough per render; listing it would re-bind every frame of state change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rep, phase, onStop])

  const pct = Math.round((set.reps / spec.reps) * 100)

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col">
      <div className="flex items-start justify-between gap-3 safe-t safe-x">
        <div>
          <Label className="text-moon/80">Chad Gym</Label>
          <h1 className="font-display text-4xl uppercase leading-none md:text-5xl" data-testid="workout-title">
            {spec.name}
          </h1>
        </div>
        <div className="panel pointer-events-auto rounded-2xl px-4 py-2 text-right" data-testid="workout-count">
          <p className="font-display text-3xl leading-none">
            {set.reps}
            <span className="text-bone/40">/{spec.reps}</span>
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
            Reps · +{set.strength} {statTag}{set.combo >= 3 ? ` · ×${set.combo}` : ''}
          </p>
        </div>
      </div>

      <div className="flex-1" />

      <AnimatePresence mode="wait">
        {phase === 'ready' && (
          <Card key="ready">
            <p className="font-display text-3xl uppercase">{spec.reps} reps on the beat</p>
            <p className="mt-2 text-[15px] text-bone/75">{spec.tip}</p>
            <p className="mt-2 text-[15px] text-bone/75">
              {isBar ? (
                <>
                  Tap <span className="text-moon">{spec.verb}</span> (or Space / E) while the marker is inside the <span className="text-pump">orange</span> zone — <span className="text-moon">gold</span> centre for a perfect hit. Clean hits chain combos.
                </>
              ) : (
                <>
                  Tap <span className="text-moon">{spec.verb}</span> (or Space / E) as the ring closes: <span className="text-moon">clean</span> reps build strength fast and chain combos.
                </>
              )}
            </p>
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ash">Lifetime reps here: {lifetimeReps}</p>
            <div className="mt-5 flex gap-2">
              <Btn className="flex-1" size="lg" onClick={start} sound={null} data-testid="workout-start">
                Start set
              </Btn>
              <Btn variant="ghost" size="lg" onClick={onStop} data-testid="workout-stop">
                Step away
              </Btn>
            </div>
          </Card>
        )}

        {phase === 'playing' && (
          <m.div key="play" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pointer-events-auto px-3 pb-3 safe-b safe-x">
            <div className="mx-auto max-w-xl">
              <div className="relative mb-2 h-10 text-center">
                <AnimatePresence>
                  {last && (
                    <m.p key={last.k} initial={{ y: 10, opacity: 0, scale: 0.8 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className={`font-display text-4xl uppercase ${last.g === 'clean' ? 'text-chain' : 'text-alarm'}`} data-testid="workout-grade">
                      {last.g}
                      <span className="ml-2 font-mono text-base text-bone/70">+{last.pts}</span>
                    </m.p>
                  )}
                </AnimatePresence>
              </div>
              <div className="panel rounded-[22px] p-4">
                {isBar && (
                  <div className="relative mb-3 h-12 overflow-hidden rounded-xl bg-ink ring-1 ring-bone/10" data-testid="workout-bar" data-center={zone.center} data-good={zone.good}>
                    <div className="absolute inset-y-0 bg-pump/40" style={{ left: `${(zone.center - zone.good) * 100}%`, width: `${zone.good * 200}%` }} />
                    <div className="absolute inset-y-0 bg-[linear-gradient(180deg,#fff3cf,#e8b84a)] shadow-[0_0_20px_rgba(246,200,112,0.8)]" style={{ left: `${(zone.center - zone.perfect) * 100}%`, width: `${zone.perfect * 200}%` }} />
                    <div ref={markerRef} className="absolute inset-y-1 w-1.5 -translate-x-1/2 rounded-full bg-bone shadow-[0_0_12px_#fff]" style={{ left: '0%' }} data-testid="workout-marker" />
                  </div>
                )}
                <div className="flex items-center gap-4">
                  {/* tempo ring */}
                  {!isBar && (
                    <div className="relative h-20 w-20 shrink-0" aria-hidden>
                      <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle,#fff3cf,#e8b84a)] shadow-[0_0_24px_rgba(246,200,112,0.75)]" />
                      <div ref={ringRef} className="absolute inset-[18%] rounded-full ring-[3px] ring-bone" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="h-2 overflow-hidden rounded-full bg-bone/10" role="progressbar" aria-label="Set progress" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-full rounded-full bg-[linear-gradient(90deg,#f6c870,#ff7a1a)] transition-[width] duration-300" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ash">
                      Clean {set.clean} · Sloppy {set.sloppy} · Best combo {set.maxCombo}
                    </p>
                    {spec.id === 'treadmill' && (
                      <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-moon" data-testid="workout-pace">
                        Pace <span ref={paceRef}>{(gym.pace * 3.6).toFixed(1)} km/h</span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault()
                      rep()
                    }}
                    className="btn-primary flex min-h-16 flex-1 items-center justify-center rounded-2xl font-display text-3xl uppercase tracking-wider"
                    data-testid="workout-rep"
                  >
                    {spec.verb}
                  </button>
                  <button type="button" onClick={onStop} className="min-h-16 rounded-2xl border border-bone/15 px-4 font-mono text-[11px] uppercase tracking-[0.18em] text-bone/70" data-testid="workout-stop">
                    Stop
                  </button>
                </div>
              </div>
            </div>
          </m.div>
        )}

        {phase === 'done' && (
          <Card key="done">
            <Label className="text-moon/80">Set complete</Label>
            <p className="mt-1 font-display text-6xl leading-none" data-testid="workout-done">
              +{reward.stat} <span className="text-3xl text-bone/60">{statTag}</span>
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                ['Clean', set.clean],
                ['Sloppy', set.sloppy],
                ['Best combo', set.maxCombo],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-bone/[0.04] py-2 ring-1 ring-bone/10">
                  <p className="font-display text-2xl">{v}</p>
                  <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-ash">{k}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center font-display text-2xl uppercase text-molten">+{reward.xp} XP</p>
            {reward.mult < 1 && (
              <p className="mt-1 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-ash" data-testid="workout-fatigue">
                Fatigued · {Math.round(reward.mult * 100)}% rewards here today — try another station
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <Btn className="flex-1" onClick={start} sound={null} data-testid="workout-again">
                Go again
              </Btn>
              <Btn variant="ghost" className="flex-1" onClick={onStop} data-testid="workout-leave">
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
