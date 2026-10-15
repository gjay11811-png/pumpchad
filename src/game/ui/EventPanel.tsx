import { AnimatePresence, m } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { audio } from '../audio'
import { EVENT_DEFS, EVENT_IDS, type EventDirector, type EventId, type EventStats } from '../minigames/events'
import { Btn, Label } from './kit'

export type EventResult = { xp: number; mult: number; wins: number; best?: number }
type Phase = 'ready' | 'run' | 'done'

/** The Events Board: pick an event → 3-2-1 → live HUD (timer / progress / lives / hint) → result → play again or back. */
export function EventPanel({
  director,
  player,
  wins,
  onPhase,
  onFinish,
  onClose,
  ids = EVENT_IDS,
}: {
  /** which rounds this panel offers (the Events Board offers the world events; the Ghost Hunt station offers just its own) */
  ids?: EventId[]
  director: EventDirector
  player: THREE.Vector3
  wins: Partial<Record<EventId, number>>
  onPhase: (p: Phase) => void
  onFinish: (s: EventStats) => EventResult
  onClose: () => void
}) {
  const [phase, setPhaseState] = useState<Phase>('ready')
  const [count, setCount] = useState(0)
  const [result, setResult] = useState<{ s: EventStats; r: EventResult } | null>(null)
  const timeRef = useRef<HTMLSpanElement>(null)
  const scoreRef = useRef<HTMLSpanElement>(null)
  const livesRef = useRef<HTMLSpanElement>(null)
  const hintRef = useRef<HTMLParagraphElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const [id, setId] = useState<EventId>(ids[0])
  const setPhase = (p: Phase) => {
    setPhaseState(p)
    onPhase(p)
  }

  useEffect(() => {
    if (phase !== 'run') return
    let raf = 0
    let lastCount = -1
    const loop = () => {
      if (director.phase === 'countdown') {
        const c = Math.ceil(director.countdown)
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
      const d = director.def
      if (timeRef.current) timeRef.current.textContent = Math.max(0, director.timeLeft).toFixed(1)
      if (scoreRef.current) scoreRef.current.textContent = `${director.score} / ${director.goal}`
      if (livesRef.current) livesRef.current.textContent = d.lives ? '♥'.repeat(Math.max(0, director.lives)) + '♡'.repeat(Math.max(0, d.lives - director.lives)) : ''
      if (hintRef.current) hintRef.current.textContent = director.hint
      if (barRef.current) barRef.current.style.width = `${(Math.max(0, director.timeLeft) / Math.max(1, director.limit || d.duration)) * 100}%`
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [phase, director])

  useEffect(() => {
    director.onHit = (k) => audio.play(k === 'strike' ? 'thunder' : k === 'bad' ? 'wail' : k === 'win' ? 'fanfare' : k === 'lose' ? 'miss' : director.id === 'invasion' ? 'banish' : 'perfect')
    director.onEnd = (s) => {
      setResult({ s, r: onFinish(s) })
      setPhase('done')
    }
    return () => {
      director.onHit = null
      director.onEnd = null
    }
    // the latest closures are what we want at the end of a round
    // eslint-disable-next-line react-hooks/exhaustive-deps
  })

  // leaving the panel always ends the round (no orphaned markers, no reward)
  useEffect(() => () => director.stop(), [director])

  const start = (e: EventId) => {
    audio.play('confirm')
    setId(e)
    setResult(null)
    director.start(e, player)
    setPhase('run')
  }
  const quit = () => {
    director.stop()
    onClose()
  }

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') quit()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const d = EVENT_DEFS[id]
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col">
      {phase === 'run' && (
        <>
          <div className="mx-auto mt-[calc(4.6rem+env(safe-area-inset-top))] w-[min(92vw,26rem)]" data-testid="event-hud">
            <div className="panel pointer-events-auto rounded-2xl px-4 py-2.5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <Label className="text-moon/80">{d.name}</Label>
                  <p className="font-display text-4xl leading-none">
                    <span ref={scoreRef} data-testid="event-score">0</span>
                    <span ref={livesRef} className="ml-2 text-2xl text-molten" />
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-4xl leading-none tabular-nums">
                    <span ref={timeRef} data-testid="event-time">{d.duration.toFixed(1)}</span>
                    <span className="text-lg text-bone/50">s</span>
                  </p>
                  <button type="button" onClick={quit} className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone/50 underline-offset-2 hover:underline" data-testid="event-quit">
                    Quit
                  </button>
                </div>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bone/10">
                <div ref={barRef} className="h-full rounded-full bg-[linear-gradient(90deg,#ff7a1a,#f6c870)]" style={{ width: '100%' }} />
              </div>
              <p ref={hintRef} className="mt-2 text-[13px] text-bone/70" />
            </div>
          </div>
          <AnimatePresence>
            {count > 0 && (
              <m.p key={count} initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }} className="absolute inset-x-0 top-[34%] text-center font-display text-[9rem] leading-none text-molten drop-shadow-[0_0_30px_rgba(255,122,26,0.6)]">
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
            <div className="flex items-start justify-between gap-3">
              <Label className="text-moon/80">{ids.length === 1 ? 'Activity' : 'Events Board'}</Label>
              <button type="button" onClick={quit} aria-label="Close" data-testid="event-close" className="-mr-1 -mt-1 flex h-9 w-9 items-center justify-center rounded-full text-lg text-bone/70 ring-1 ring-bone/20 hover:bg-bone/10">
                ✕
              </button>
            </div>
            <p className="mt-1 font-display text-3xl uppercase leading-none">{ids.length === 1 ? EVENT_DEFS[ids[0]].name : 'Village events'}</p>
            {ids.length === 1 && (
              <>
                <ul className="mt-3 grid gap-1.5 text-[14px] text-bone/80">
                  {EVENT_DEFS[ids[0]].rules.map((r) => (
                    <li key={r}>• {r}</li>
                  ))}
                </ul>
                <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ash">
                  {EVENT_DEFS[ids[0]].duration}s · cleared {wins[ids[0]] || 0}× · local to this device
                </p>
                <div className="sticky bottom-0 mt-4 flex gap-2 bg-ink/95 pb-1 pt-2">
                  <Btn className="flex-1" size="lg" onClick={() => start(ids[0])} sound={null} data-testid={`event-${ids[0]}`}>
                    Start
                  </Btn>
                </div>
              </>
            )}
            <div className={`mt-3 grid gap-2 sm:grid-cols-2 [@media(max-height:480px)]:grid-cols-3 ${ids.length === 1 ? 'hidden' : ''}`}>
              {ids.map((e) => (
                <button key={e} type="button" onClick={() => start(e)} data-testid={`event-${e}`} className="rounded-xl bg-bone/[0.04] p-3 text-left ring-1 ring-bone/10 transition hover:bg-bone/[0.09]">
                  <p className="font-display text-xl uppercase leading-tight">{EVENT_DEFS[e].name}</p>
                  <p className="mt-1 text-[13px] text-bone/70 [@media(max-height:480px)]:hidden">{EVENT_DEFS[e].blurb}</p>
                  <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ash">
                    {EVENT_DEFS[e].duration}s · cleared {wins[e] || 0}×
                  </p>
                </button>
              ))}
            </div>
          </Card>
        )}
        {phase === 'done' && result && (
          <Card key="done">
            <Label className="text-moon/80">{d.name}</Label>
            <p className={`mt-1 font-display text-5xl uppercase leading-none ${result.s.won ? 'text-chain' : 'text-bone'}`} data-testid="event-result">
              {result.s.won ? 'Cleared!' : 'Not this time'}
            </p>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ash">
              {result.s.score} / {result.s.goal}{result.s.won && result.s.id === 'race' ? ` · ${result.s.time.toFixed(2)}s${result.r.best && result.s.time <= result.r.best / 100 + 0.005 ? ' · new best!' : ''}` : ''}
              {d.lives > 0 ? ` · ${Math.max(0, result.s.lives)} lives left` : ''} · {result.s.timeLeft.toFixed(0)}s left
            </p>
            <p className="mt-4 text-center font-display text-2xl uppercase text-molten" data-testid="event-xp">
              +{result.r.xp} XP
            </p>
            {result.r.mult < 1 && <p className="mt-1 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-ash">Tired legs · {Math.round(result.r.mult * 100)}% XP for more rounds today</p>}
            <div className="sticky bottom-0 mt-4 flex gap-2 bg-ink/95 pb-1 pt-2">
              <Btn className="flex-1" onClick={() => start(id)} sound={null} data-testid="event-again">
                Play again
              </Btn>
              {ids.length > 1 && (
                <Btn variant="ghost" className="flex-1" onClick={() => setPhase('ready')} data-testid="event-menu">
                  Other events
                </Btn>
              )}
              <Btn variant="ghost" className="flex-1" onClick={quit} data-testid="event-done">
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
      <div className="panel mx-auto max-h-[calc(100svh-5.75rem)] max-w-xl overflow-y-auto overscroll-contain rounded-[24px] p-5 md:p-6 [@media(max-height:480px)]:p-3">{children}</div>
    </m.div>
  )
}



