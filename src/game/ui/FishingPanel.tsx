import { useEffect, useRef, useState } from 'react'
import { CASTS, ZONE, fishingXp, newReel, rollFish, stepReel, type Catch, type Reel } from '../minigames/fishing'
import { Btn } from './kit'
import { Header, Overlay, useEsc } from './Menus'

type Phase = 'aim' | 'wait' | 'bite' | 'reel' | 'between' | 'done'
export type FishingResult = { xp: number; mult: number; best: number; newBest: boolean }

/**
 * Fishing off the Moonlight Lake pier. One button (Space / E / the big button) does everything: tap to cast at
 * the power shown, wait, tap on the bite, then hold to reel and let go to ease off. Five casts a round; the
 * catches, score and reward show at the end, with Fish again / Done.
 */
export function FishingPanel({ best, onFinish, onBack }: { best: number; onFinish: (score: number, catches: Catch[]) => FishingResult; onBack: () => void }) {
  useEsc(onBack)
  const [phase, setPhase] = useState<Phase>('aim')
  const [cast, setCast] = useState(0)
  const [msg, setMsg] = useState('Tap to cast. The further out, the rarer the fish.')
  const [catches, setCatches] = useState<Catch[]>([])
  const [result, setResult] = useState<FishingResult | null>(null)
  const [, force] = useState(0)
  const power = useRef(0)
  const lockedPower = useRef(0)
  const fish = useRef<Catch | null>(null)
  const reel = useRef<Reel>(newReel())
  const holding = useRef(false)
  const timer = useRef(0)
  const phaseRef = useRef<Phase>('aim')
  phaseRef.current = phase
  // the loop below is created once, so the round's running totals live in refs (state mirrors them for display)
  const castRef = useRef(0)
  const catchesRef = useRef<Catch[]>([])
  const finishRef = useRef(onFinish)
  finishRef.current = onFinish

  // the loop: power meter while aiming, the bite clock while waiting, the reel fight
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const ph = phaseRef.current
      if (ph === 'aim') power.current = 0.5 - 0.5 * Math.cos((now / 1000) * 2.4)
      if (ph === 'wait' && (timer.current -= dt) <= 0) {
        setPhase('bite')
        setMsg('A bite! Strike now!')
        timer.current = 0.95
      } else if (ph === 'bite' && (timer.current -= dt) <= 0) {
        endCast(null, 'It got away before you struck.')
      } else if (ph === 'reel' && fish.current) {
        reel.current = stepReel(reel.current, dt, holding.current, fish.current.species, Math.random)
        const r = reel.current.result
        if (r === 'landed') endCast(fish.current, `Landed a ${fish.current.species.name}! ${fish.current.kg} kg.`)
        else if (r === 'snapped') endCast(null, `Snap! The line broke — it was a ${fish.current.species.name}.`)
        else if (r === 'escaped') endCast(null, 'Too much slack — it slipped the hook.')
      }
      force((n) => (n + 1) % 1e6)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const endCast = (c: Catch | null, text: string) => {
    holding.current = false
    phaseRef.current = 'between' // stop the loop acting on this cast again before React re-renders
    const got = c ? [...catchesRef.current, c] : catchesRef.current
    catchesRef.current = got
    setCatches(got)
    const n = castRef.current + 1
    castRef.current = n
    setCast(n)
    setMsg(text)
    if (n >= CASTS) {
      const score = got.reduce((a, k) => a + k.points, 0)
      phaseRef.current = 'done'
      setResult(finishRef.current(score, got))
      setPhase('done')
    } else {
      setPhase('between')
      timer.current = 0
      setTimeout(() => {
        if (phaseRef.current !== 'between') return
        setPhase('aim')
        setMsg(`Cast ${n + 1} of ${CASTS}. Tap to cast.`)
      }, 1100)
    }
  }

  const press = () => {
    const ph = phaseRef.current
    if (ph === 'aim') {
      lockedPower.current = power.current
      fish.current = rollFish(power.current, Math.random)
      timer.current = 1.2 + Math.random() * 2
      setPhase('wait')
      setMsg(power.current > 0.75 ? 'A long cast, out into the deep water… wait for it.' : power.current > 0.35 ? 'A good cast… wait for the bobber.' : 'A short cast near the reeds… wait for it.')
    } else if (ph === 'wait') {
      endCast(null, 'Too soon — you spooked it.')
    } else if (ph === 'bite') {
      reel.current = newReel()
      holding.current = true
      setPhase('reel')
      setMsg('Hold to reel · let go to ease off · keep the line in the green.')
    } else if (ph === 'reel') holding.current = true
  }
  const release = () => {
    holding.current = false
  }

  // keyboard: Space / E / Enter (hold to reel)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'e' && e.key !== 'E' && e.key !== 'Enter') return
      e.preventDefault()
      if (e.repeat) return
      press()
    }
    const up = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'e' || e.key === 'E' || e.key === 'Enter') release()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  })

  const again = () => {
    castRef.current = 0
    catchesRef.current = []
    setCatches([])
    setResult(null)
    setCast(0)
    setPhase('aim')
    setMsg('Tap to cast. The further out, the rarer the fish.')
  }

  const r = reel.current
  const bobX = 14 + (phase === 'aim' ? power.current : lockedPower.current) * 76
  const score = catches.reduce((a, k) => a + k.points, 0)
  const label = phase === 'aim' ? 'Cast' : phase === 'wait' ? 'Wait…' : phase === 'bite' ? 'Strike!' : phase === 'reel' ? 'Hold to reel' : '…'

  return (
    <Overlay label="Fishing">
      <Header title="Fishing" onBack={onBack} />
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-moon">Moonlight Lake · {CASTS} casts · best {best || '—'}</p>

      {/* the lake: your line out to the bobber, which bobs, dips on a bite and tugs while you reel */}
      <div className="mt-3 overflow-hidden rounded-2xl ring-1 ring-bone/10">
        <svg viewBox="0 0 100 40" className="block w-full" role="img" aria-label="The lake" data-testid="fish" data-phase={phase} data-tension={r.tension.toFixed(2)} data-cast={cast} data-power={(phase === 'aim' ? power.current : lockedPower.current).toFixed(2)}>
          <defs>
            <linearGradient id="lk" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#24305a" />
              <stop offset="1" stopColor="#0e1428" />
            </linearGradient>
          </defs>
          <rect width="100" height="40" fill="url(#lk)" />
          <ellipse cx="62" cy="9" rx="10" ry="1.2" fill="#fff6d8" opacity="0.25" />
          <rect x="0" y="30" width="10" height="10" fill="#6a4a30" />
          {phase !== 'aim' && phase !== 'done' && <path d={`M8 30 Q ${(8 + bobX) / 2} 14 ${bobX} ${phase === 'reel' ? 21 + Math.sin(r.t * 18) * 1.2 : 20}`} stroke="#e9e4da" strokeWidth="0.25" fill="none" opacity="0.7" />}
          {phase !== 'done' && (
            <g transform={`translate(${bobX} ${phase === 'bite' ? 21.5 : 20 + Math.sin(performance.now() / 400) * 0.4})`}>
              <circle r="1.3" fill="#ff4d3d" />
              <rect x="-1.3" y="0" width="2.6" height="1.3" fill="#f2efe6" />
              {phase === 'bite' && <circle r="4" fill="none" stroke="#e9e4da" strokeWidth="0.3" opacity="0.6" />}
            </g>
          )}
          {phase === 'aim' && <text x={bobX} y="16" textAnchor="middle" fontSize="3" fill="#ffd25a">▼</text>}
        </svg>
      </div>

      <p className="mt-3 min-h-[2.5em] text-[13px] leading-snug text-bone/85" data-testid="fish-msg" aria-live="polite">
        {msg}
      </p>

      {phase === 'reel' && (
        <div className="mt-1 grid gap-2">
          <div className="relative h-4 overflow-hidden rounded-full bg-ink ring-1 ring-bone/10" data-testid="fish-tension">
            <div className="absolute inset-y-0 bg-[#7affb0]/25" style={{ left: `${ZONE.lo * 100}%`, width: `${(ZONE.hi - ZONE.lo) * 100}%` }} />
            <div className="absolute inset-y-0 right-0 w-[8%] bg-alarm/40" />
            <div className="absolute inset-y-0 w-1.5 -translate-x-1/2 rounded-full bg-bone" style={{ left: `${Math.min(100, r.tension * 100)}%` }} />
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-bone/10">
            <div className="h-full rounded-full bg-[linear-gradient(90deg,#f6c870,#ff7a1a)]" style={{ width: `${r.progress * 100}%` }} />
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ash">tension · reeled in</p>
        </div>
      )}

      {phase !== 'done' ? (
        <button
          type="button"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            press()
          }}
          onPointerUp={release}
          onPointerCancel={release}
          onLostPointerCapture={release}
          onContextMenu={(e) => e.preventDefault()}
          disabled={phase === 'between'}
          className="btn-primary mt-3 flex min-h-14 w-full select-none items-center justify-center rounded-full text-[15px] font-semibold uppercase tracking-[0.12em] disabled:opacity-50"
          style={{ touchAction: 'none' }}
          data-testid="fish-action"
        >
          {label}
        </button>
      ) : (
        <div className="mt-2 rounded-2xl bg-bone/[0.04] p-4 ring-1 ring-bone/10" data-testid="fish-results">
          <p className="font-display text-3xl uppercase leading-none">
            {score} <span className="font-mono text-[11px] text-ash">points</span>
          </p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.15em] text-moon">
            +{result?.xp ?? 0} XP{result && result.mult < 1 ? ` (tired ×${result.mult})` : ''} · {result?.newBest ? 'new best!' : `best ${result?.best ?? best}`}
          </p>
          <div className="mt-3 flex gap-2">
            <Btn className="flex-1" onClick={again} data-testid="fish-again">
              Fish again
            </Btn>
            <Btn variant="ghost" className="flex-1" onClick={onBack}>
              Done
            </Btn>
          </div>
        </div>
      )}

      <ul className="mt-3 grid gap-1.5" data-testid="fish-catches">
        {catches.map((c, i) => (
          <li key={i} className="flex items-center gap-2 text-[13px]">
            <span className="h-3 w-3 rounded-full" style={{ background: c.species.color }} />
            <span className="flex-1">{c.species.name}</span>
            <span className="font-mono text-[11px] text-ash">
              {c.kg} kg · {c.points}
            </span>
          </li>
        ))}
        {!catches.length && <li className="font-mono text-[10px] uppercase tracking-[0.15em] text-ash">no catches yet · {CASTS - cast} casts left</li>}
      </ul>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ash">xp {`= score ÷ 6, up to ${fishingXp(1e9)}`} · new species go in your journal</p>
    </Overlay>
  )
}
