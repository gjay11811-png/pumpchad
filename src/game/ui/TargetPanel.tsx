import { AnimatePresence, m } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { audio } from '../audio'
import { MAX_TOSS_SCORE, TOSS, type TargetRange, type TossStats } from '../minigames/targetThrow'
import { Btn, Label } from './kit'

export type TossResult = { xp: number; mult: number; best: number; newBest: boolean }
type Phase = 'ready' | 'run' | 'done'

/**
 * Pumpkin Toss: instructions → ten throws (click or tap a board; a reticle follows the pointer) → results → throw again.
 * Movement is locked while the round runs and returns when it ends or is quit. Personal best is local to this device.
 */
export function TargetPanel({
  range,
  best,
  onPhase,
  onFinish,
  onClose,
}: {
  range: TargetRange
  best: number
  onPhase: (p: Phase) => void
  onFinish: (s: TossStats) => TossResult
  onClose: () => void
}) {
  const [phase, setPhaseState] = useState<Phase>('ready')
  const [result, setResult] = useState<{ s: TossStats; r: TossResult } | null>(null)
  const [pop, setPop] = useState<{ k: number; pts: number; label: string } | null>(null)
  const scoreRef = useRef<HTMLSpanElement>(null)
  const leftRef = useRef<HTMLSpanElement>(null)
  const reticle = useRef<HTMLDivElement>(null)
  const setPhase = (p: Phase) => {
    setPhaseState(p)
    onPhase(p)
  }

  useEffect(() => {
    range.onThrow = (pts, label) => {
      audio.play(pts >= 50 ? 'perfect' : pts > 0 ? 'rep' : 'miss')
      setPop((p) => ({ k: (p?.k ?? 0) + 1, pts, label }))
    }
    range.onEnd = (s) => {
      audio.play('achievement')
      setResult({ s, r: onFinish(s) })
      setPhase('done')
    }
    return () => {
      range.onThrow = null
      range.onEnd = null
    }
    // the latest closures are what we want when the round ends
    // eslint-disable-next-line react-hooks/exhaustive-deps
  })

  // live counters
  useEffect(() => {
    if (phase !== 'run') return
    let raf = 0
    const loop = () => {
      if (scoreRef.current) scoreRef.current.textContent = String(range.stats.score)
      if (leftRef.current) leftRef.current.textContent = String(range.left)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [phase, range])

  // pointer: the reticle follows it; a click/tap on the 3D view throws (UI buttons are left alone)
  useEffect(() => {
    if (phase !== 'run') return
    // a press that lands on the 3D view (not on a button / panel / the joystick) aims at the scene
    const canvas = () => document.querySelector('canvas') as HTMLCanvasElement | null
    const onCanvas = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null
      if (!t || t.closest?.('button, a, input, [role=dialog], [data-testid=toss-hud], .panel, [data-ui]')) return null
      return canvas()
    }
    const move = (e: PointerEvent) => {
      const c = onCanvas(e)
      if (reticle.current) {
        reticle.current.style.opacity = c ? '1' : '0'
        reticle.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`
      }
    }
    const up = (e: PointerEvent) => {
      const c = onCanvas(e)
      if (!c) return
      const r = c.getBoundingClientRect()
      if (range.throwAt(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1))) audio.play('interact')
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [phase, range])

  // leaving the panel always ends the round (nothing left flying, no reward)
  useEffect(() => () => range.stop(), [range])

  const start = () => {
    audio.play('confirm')
    setResult(null)
    setPop(null)
    range.start()
    setPhase('run')
  }
  const quit = () => {
    range.stop()
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
          <div className="mx-auto mt-[calc(4.6rem+env(safe-area-inset-top))] w-[min(92vw,24rem)]" data-testid="toss-hud">
            <div className="panel pointer-events-none rounded-2xl px-4 py-2.5 [@media(max-height:480px)]:py-1.5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <Label className="text-moon/80">Pumpkin Toss</Label>
                  <p className="font-display text-4xl leading-none">
                    <span ref={scoreRef} data-testid="toss-score">0</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-4xl leading-none tabular-nums">
                    <span ref={leftRef} data-testid="toss-left">{TOSS.throws}</span>
                    <span className="text-lg text-bone/50"> left</span>
                  </p>
                  <button type="button" onClick={quit} className="pointer-events-auto font-mono text-[10px] uppercase tracking-[0.2em] text-bone/50 underline-offset-2 hover:underline" data-testid="toss-quit">
                    Quit
                  </button>
                </div>
              </div>
              <p className="mt-1.5 text-[12px] text-bone/65 [@media(max-height:480px)]:hidden">Click or tap a board to throw. Bullseye 50 · inner 25 · outer 10 — far boards ×1.5, the sliding board ×2.</p>
            </div>
            <div className="relative mt-2 h-10 text-center">
              <AnimatePresence mode="wait">
                {pop && (
                  <m.p key={pop.k} initial={{ y: 10, opacity: 0, scale: 0.85 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -12, opacity: 0 }} className={`absolute inset-x-0 font-display text-3xl uppercase ${pop.pts >= 50 ? 'text-chain' : pop.pts ? 'text-molten' : 'text-bone/60'}`} data-testid="toss-pop">
                    {pop.pts ? `+${pop.pts}` : ''} <span className="font-mono text-base text-bone/80">{pop.label}</span>
                  </m.p>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div ref={reticle} className="pointer-events-none fixed left-0 top-0 z-30 opacity-0" style={{ marginLeft: -14, marginTop: -14 }} aria-hidden>
            <div className="h-7 w-7 rounded-full border-2 border-molten/90 shadow-[0_0_8px_rgba(255,122,26,0.7)]" />
          </div>
        </>
      )}

      <div className="flex-1" />

      <AnimatePresence mode="wait">
        {phase === 'ready' && (
          <Card key="ready">
            <div className="flex items-start justify-between gap-3">
              <Label className="text-moon/80">Mini-game</Label>
              <button type="button" onClick={quit} aria-label="Close" data-testid="toss-close" className="-mr-1 -mt-1 flex h-9 w-9 items-center justify-center rounded-full text-lg text-bone/70 ring-1 ring-bone/20 hover:bg-bone/10">
                ✕
              </button>
            </div>
            <p className="mt-1 font-display text-4xl uppercase leading-none">Pumpkin Toss</p>
            <ul className="mt-3 grid gap-1.5 text-[14px] text-bone/80">
              <li>• {TOSS.throws} throws from the line. Click (mouse) or tap (touch) a board to throw a pumpkin at that spot.</li>
              <li>• Bullseye 50 · inner ring 25 · outer ring 10. The far boards are worth ×1.5; the one sliding side to side is ×2 — time it.</li>
              <li>• You stay on the line while the round runs. Esc or Quit ends it with no reward.</li>
            </ul>
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ash" data-testid="toss-best">Your best (this device): {best || '—'}</p>
            <div className="sticky bottom-0 mt-5 flex gap-2 bg-ink/95 pb-1 pt-2">
              <Btn className="flex-1" size="lg" onClick={start} sound={null} data-testid="toss-start">
                Start
              </Btn>
            </div>
          </Card>
        )}
        {phase === 'done' && result && (
          <Card key="done">
            <Label className="text-moon/80">Round over</Label>
            <p className="mt-1 font-display text-6xl leading-none" data-testid="toss-final">
              {result.s.score}
            </p>
            <p className={`mt-1 font-mono text-[11px] uppercase tracking-[0.2em] ${result.r.newBest ? 'text-chain' : 'text-ash'}`} data-testid="toss-record">
              {result.r.newBest ? 'New personal best!' : `Best: ${result.r.best}`} · local to this device (max {MAX_TOSS_SCORE})
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {(
                [
                  ['Hits', `${result.s.hits}/${result.s.thrown}`],
                  ['Bullseyes', result.s.bulls],
                  ['Throws', result.s.thrown],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="rounded-xl bg-bone/[0.04] py-2 ring-1 ring-bone/10">
                  <p className="font-display text-2xl">{v}</p>
                  <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-ash">{k}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center font-display text-2xl uppercase text-molten" data-testid="toss-xp">
              +{result.r.xp} XP
            </p>
            {result.r.mult < 1 && <p className="mt-1 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-ash">Tired arm · {Math.round(result.r.mult * 100)}% XP for more rounds today</p>}
            <div className="sticky bottom-0 mt-4 flex gap-2 bg-ink/95 pb-1 pt-2">
              <Btn className="flex-1" onClick={start} sound={null} data-testid="toss-again">
                Throw again
              </Btn>
              <Btn variant="ghost" className="flex-1" onClick={quit} data-testid="toss-done">
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




