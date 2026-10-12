import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { launch } from '../config'

/** Milliseconds left until launch — never negative. The target carries an explicit UTC offset, so every visitor counts to the same instant. */
export function msLeft(now = Date.now()) {
  const t = Date.parse(launch.target)
  return Number.isFinite(t) ? Math.max(0, t - now) : 0
}

export function splitTime(ms: number) {
  const s = Math.floor(ms / 1000)
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 }
}

/** Ticks once per second, re-aligned to the wall clock each tick (no drift, recovers after a background tab). */
function useCountdown() {
  const [left, setLeft] = useState(() => msLeft())
  useEffect(() => {
    let id = 0
    const tick = () => {
      const ms = msLeft()
      setLeft(ms)
      if (ms > 0) id = window.setTimeout(tick, 1000 - (Date.now() % 1000) + 5)
    }
    tick()
    const onVis = () => document.visibilityState === 'visible' && setLeft(msLeft())
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearTimeout(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])
  return left
}

export function Countdown() {
  const left = useCountdown()
  const t = splitTime(left)
  const done = left <= 0
  const units: [string, number][] = [
    ['Days', t.days],
    ['Hours', t.hours],
    ['Minutes', t.minutes],
    ['Seconds', t.seconds],
  ]
  // screen readers get a calm summary that only updates every minute, not a ticking second hand
  const summary = done ? launch.doneTitle : `${t.days} days, ${t.hours} hours and ${t.minutes} minutes until launch`

  return (
    <div className="countdown-panel relative overflow-hidden rounded-[26px] p-4 sm:p-5 md:p-6" data-testid="countdown">
      <div aria-hidden="true" className="pointer-events-none absolute -top-28 left-1/2 h-56 w-[90%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(255,122,26,0.30),transparent_68%)]" />
      <p className="relative flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.3em] text-ember sm:text-[12px]">
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="absolute inset-0 animate-ping rounded-full bg-pump/80 motion-reduce:animate-none" />
          <span className="relative h-2 w-2 rounded-full bg-pump" />
        </span>
        {done ? launch.doneTitle : launch.countdownTitle}
      </p>
      <p className="sr-only" aria-live="polite">
        {summary}
      </p>
      <div aria-hidden="true" className="relative mt-3 grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-start gap-x-1.5 sm:gap-x-3">
        {units.map(([label, v], i) => (
          <Fragment key={label} sep={i > 0}>
            <Unit label={label} value={v} digits={label === 'Days' && v > 99 ? 3 : 2} />
          </Fragment>
        ))}
      </div>
      <p className="relative mt-4 font-display text-[clamp(1.05rem,4.2vw,1.45rem)] uppercase tracking-[0.04em] text-bone/90" data-testid="countdown-tagline">
        {launch.countdownTagline}
      </p>
    </div>
  )
}

function Fragment({ sep, children }: { sep: boolean; children: React.ReactNode }) {
  return (
    <>
      {sep && <span className="countdown-colon pt-[0.12em] font-display text-[clamp(2rem,9vw,4.25rem)] leading-none text-pump/70">:</span>}
      {children}
    </>
  )
}

function Unit({ label, value, digits }: { label: string; value: number; digits: number }) {
  const s = String(value).padStart(digits, '0')
  return (
    <div className="flex flex-col items-center" data-testid={`countdown-${label.toLowerCase()}`} data-value={value}>
      <div className="countdown-cell flex w-full justify-center rounded-2xl px-1 py-2 sm:py-3">
        {s.split('').map((d, i) => (
          <Digit key={i} d={d} />
        ))}
      </div>
      <span className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.28em] text-ash sm:text-[11px]">{label}</span>
    </div>
  )
}

function Digit({ d }: { d: string }) {
  const reduce = useReducedMotion()
  return (
    <span className="relative inline-block h-[1em] w-[0.6em] overflow-hidden font-display text-[clamp(2rem,9vw,4.25rem)] leading-none tabular-nums [contain:paint]">
      <AnimatePresence initial={false} mode="popLayout">
        <m.span
          key={d}
          className="text-countdown absolute inset-0 text-center will-change-transform"
          initial={reduce ? { opacity: 0 } : { y: '-70%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { y: '70%', opacity: 0 }}
          transition={{ duration: reduce ? 0.2 : 0.32, ease: [0.22, 1, 0.36, 1] }}
        >
          {d}
        </m.span>
      </AnimatePresence>
    </span>
  )
}
