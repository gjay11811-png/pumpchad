import { AnimatePresence, m, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion'
import { useRef, useState } from 'react'
import { art } from '../config'
import { Reveal, SectionLabel, ease } from './ui'

const STAGES = [
  { label: 'Panic', color: '#ff4d3d', quip: 'Refreshing the chart every 4 seconds.' },
  { label: 'Hold', color: '#cfc6bc', quip: 'Deep breaths. Hydrate. Do not open the app.' },
  { label: 'Locked in', color: '#ffa940', quip: 'Shades on. Notifications off.' },
  { label: 'Chad mode', color: '#ff7a1a', quip: 'Unreasonably high confidence achieved.' },
]

export function Diagnostics() {
  const ref = useRef<HTMLElement>(null)
  const deviceRef = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  // Desktop: section is pinned, progress follows the pin. Mobile: follows the gauge itself.
  const [isLg] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches)
  const { scrollYProgress } = useScroll(
    isLg ? { target: ref, offset: ['start start', 'end end'] } : { target: deviceRef, offset: ['start 0.95', 'end 0.45'] },
  )
  const progress = useTransform(scrollYProgress, [0.08, 0.82], [0, 1], { clamp: true })
  const springy = useSpring(progress, reduce ? { stiffness: 1000, damping: 100 } : { stiffness: 140, damping: 9, mass: 0.6 })
  const angle = useTransform(springy, [0, 1], [-82, 82])
  const [stage, setStage] = useState(0)

  useMotionValueEvent(progress, 'change', (v) => {
    const s = v >= 0.97 ? 3 : v >= 0.62 ? 2 : v >= 0.3 ? 1 : 0
    setStage((prev) => (prev === s ? prev : s))
  })

  return (
    <section ref={ref} aria-labelledby="meter-title" className="relative lg:h-[240vh]">
      <div className="relative overflow-hidden lg:sticky lg:top-0 lg:flex lg:h-[100svh] lg:items-center lg:pt-16">
        <div aria-hidden="true" className="grid-faint pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_30%_60%,#000,transparent_70%)]" />
        <m.div
          aria-hidden="true"
          className="pointer-events-none absolute left-[10%] top-1/3 h-[40rem] w-[40rem] rounded-full blur-[140px]"
          animate={{ backgroundColor: STAGES[stage].color, opacity: stage === 3 ? 0.22 : 0.08 }}
          transition={{ duration: 0.8 }}
        />

        <div className="relative mx-auto grid w-full max-w-[1440px] gap-10 px-4 py-24 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:px-10 lg:py-0">
          <div className="lg:col-span-7">
            <SectionLabel n="02">Diagnostics</SectionLabel>
            <h2 id="meter-title" className="mt-5 font-display text-[clamp(3rem,13vw,7.5rem)] uppercase leading-[0.9] lg:text-[clamp(3.5rem,5.6vw,6rem)]">
              The Chad <span className="text-outline-pump">Meter</span>
            </h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-bone/60">
              Scroll to calibrate. Measures vibes, not prices — it has never seen a chart and has no idea what the market is doing.
            </p>

            {/* gauge device */}
            <div ref={deviceRef} className="metal relative mt-8 rounded-[28px] p-5 sm:p-7 lg:mt-6">
              <div className="mb-4 flex items-center justify-between gap-3 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.2em] text-ash sm:text-[10px]">
                <span className="hidden sm:inline">Unit PCHAD-01</span>
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: STAGES[stage].color }} />
                  Calibrated: 1 protein shake
                </span>
              </div>

              <div className="relative mx-auto aspect-[400/230] w-full max-w-[480px]">
                <Gauge stage={stage} />
                {/* needle */}
                <m.div
                  aria-hidden="true"
                  style={{ rotate: angle }}
                  className="absolute bottom-[8.7%] left-1/2 h-[66%] w-[6px] -translate-x-1/2 origin-bottom"
                >
                  <div className="mx-auto h-full w-full rounded-full bg-gradient-to-t from-bone via-bone to-pump shadow-[0_0_20px_rgba(255,122,26,0.6)] [clip-path:polygon(50%_0,100%_100%,0_100%)]" />
                </m.div>
                <div aria-hidden="true" className="metal absolute bottom-[3%] left-1/2 h-[12%] w-[7%] -translate-x-1/2 rounded-full ring-2 ring-pump/50" />

                {/* reaction pop at chad mode */}
                <AnimatePresence>
                  {stage === 3 && (
                    <m.div
                      initial={{ scale: 0.4, opacity: 0, rotate: -12 }}
                      animate={{ scale: 1, opacity: 1, rotate: 6 }}
                      exit={{ scale: 0.6, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 14 }}
                      className="absolute -right-2 -top-4 w-[30%] sm:-right-4"
                    >
                      <img src={art.reaction.src} alt={art.reaction.alt} data-art-slot="reaction" loading="lazy" className="aspect-[4/3] w-full rounded-xl object-cover ring-2 ring-pump shadow-[0_10px_40px_rgba(255,122,26,0.5)]" />
                    </m.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="mt-4 flex flex-col items-center text-center" aria-live="polite">
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ash">Current reading</p>
                <AnimatePresence mode="wait">
                  <m.p
                    key={stage}
                    initial={{ y: 20, opacity: 0, filter: 'blur(8px)' }}
                    animate={{ y: 0, opacity: 1, filter: 'blur(0px)', x: stage === 0 && !reduce ? [0, -3, 3, -2, 2, 0] : 0 }}
                    exit={{ y: -20, opacity: 0 }}
                    transition={{ duration: 0.45, ease }}
                    className={`font-display text-[clamp(2.75rem,11vw,5rem)] uppercase leading-none ${stage === 3 ? 'text-molten glow-pump' : ''}`}
                    style={stage === 3 ? undefined : { color: STAGES[stage].color }}
                  >
                    {STAGES[stage].label}
                  </m.p>
                </AnimatePresence>
                <p className="mt-2 min-h-6 text-sm text-bone/55">{STAGES[stage].quip}</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 lg:self-end lg:pb-2">
            <StatusPanel />
          </div>
        </div>
      </div>
    </section>
  )
}

function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => [cx + r * Math.cos((a * Math.PI) / 180), cy - r * Math.sin((a * Math.PI) / 180)]
  const [x0, y0] = p(a0)
  const [x1, y1] = p(a1)
  return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`
}

function Gauge({ stage }: { stage: number }) {
  const cx = 200
  const cy = 210
  return (
    <svg viewBox="0 0 400 230" className="absolute inset-0 h-full w-full overflow-visible" role="img" aria-label={`Chad meter reading: ${STAGES[stage].label}`}>
      <defs>
        <filter id="seg-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      {/* ticks */}
      {Array.from({ length: 37 }).map((_, k) => {
        const a = 180 - k * 5
        const r0 = k % 9 === 0 ? 132 : 140
        const rad = (a * Math.PI) / 180
        return (
          <line
            key={k}
            x1={cx + r0 * Math.cos(rad)}
            y1={cy - r0 * Math.sin(rad)}
            x2={cx + 148 * Math.cos(rad)}
            y2={cy - 148 * Math.sin(rad)}
            stroke="rgba(243,236,226,0.25)"
            strokeWidth={k % 9 === 0 ? 2 : 1}
          />
        )
      })}
      {STAGES.map((s, k) => {
        const a0 = 180 - k * 45 - 1.5
        const a1 = 180 - (k + 1) * 45 + 1.5
        const active = k <= stage
        return (
          <g key={s.label}>
            {k === stage && <path d={arc(cx, cy, 168, a0, a1)} stroke={s.color} strokeWidth="18" fill="none" filter="url(#seg-glow)" opacity="0.6" />}
            <path
              d={arc(cx, cy, 168, a0, a1)}
              stroke={active ? s.color : 'rgba(243,236,226,0.08)'}
              strokeWidth="18"
              fill="none"
              style={{ transition: 'stroke .5s' }}
            />
          </g>
        )
      })}
      {STAGES.map((s, k) => {
        const a = 180 - k * 45 - 22.5
        const rad = (a * Math.PI) / 180
        return (
          <text
            key={s.label}
            x={cx + 110 * Math.cos(rad)}
            y={cy - 110 * Math.sin(rad) + 4}
            textAnchor="middle"
            fontFamily="JetBrains Mono, monospace"
            fontSize="11"
            letterSpacing="1.5"
            fill={k === stage ? s.color : 'rgba(243,236,226,0.4)'}
            style={{ textTransform: 'uppercase', transition: 'fill .4s' }}
          >
            {s.label.toUpperCase()}
          </text>
        )
      })}
    </svg>
  )
}

const ROWS = [
  { k: 'Protein', v: 'Loaded', kind: 'bar' as const },
  { k: 'SOL', v: 'Ready', kind: 'sol' as const },
  { k: 'Panic', v: 'Disabled', kind: 'toggle' as const },
  { k: 'Chad level', v: 'Maximum', kind: 'segments' as const },
]

export function StatusPanel() {
  return (
    <Reveal>
      <div className="metal relative overflow-hidden rounded-[24px]">
        <div className="flex items-center justify-between border-b border-bone/[0.07] px-5 py-4 sm:px-6">
          <div>
            <p className="font-display text-2xl uppercase tracking-wide">Chad status</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ash">Chad OS v1.0 · all systems unbothered</p>
          </div>
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-alarm/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-ember/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-sol-green/70" />
          </span>
        </div>
        <dl className="divide-y divide-bone/[0.06]">
          {ROWS.map((r, i) => (
            <m.div
              key={r.k}
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease, delay: 0.1 + i * 0.1 }}
              className="flex items-center justify-between gap-4 px-5 py-5 sm:px-6"
            >
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-[0.25em] text-ash">{r.k}</dt>
                <dd className={`font-display text-[1.9rem] uppercase leading-tight ${r.kind === 'segments' ? 'text-molten glow-pump' : r.kind === 'sol' ? 'text-sol-green' : 'text-bone'}`}>
                  {r.v}
                </dd>
              </div>
              <Indicator kind={r.kind} />
            </m.div>
          ))}
        </dl>
        <p className="border-t border-bone/[0.07] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-bone/35 sm:px-6">
          Readings are vibes. None of this is market data.
        </p>
      </div>
    </Reveal>
  )
}

function Indicator({ kind }: { kind: 'bar' | 'sol' | 'toggle' | 'segments' }) {
  if (kind === 'bar')
    return (
      <div aria-hidden="true" className="h-2.5 w-28 overflow-hidden rounded-full bg-bone/[0.08]">
        <m.div className="h-full rounded-full bg-gradient-to-r from-ember to-pump" initial={{ width: 0 }} whileInView={{ width: '100%' }} viewport={{ once: true }} transition={{ duration: 1.4, ease, delay: 0.3 }} />
      </div>
    )
  if (kind === 'sol')
    return (
      <span aria-hidden="true" className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,#9b5cff,#19f19a)] p-[1.5px]">
        <span className="flex h-full w-full items-center justify-center rounded-full bg-coal">
          <span className="h-2.5 w-2.5 rounded-full bg-sol-green shadow-[0_0_12px_#19f19a]" />
        </span>
      </span>
    )
  if (kind === 'toggle')
    return (
      <span aria-hidden="true" className="flex h-8 w-14 items-center rounded-full bg-bone/[0.08] p-1 ring-1 ring-bone/10">
        <span className="h-6 w-6 rounded-full bg-bone/30" />
      </span>
    )
  return (
    <div aria-hidden="true" className="flex items-end gap-1">
      {Array.from({ length: 8 }).map((_, k) => (
        <m.span
          key={k}
          className="w-1.5 rounded-[1px] bg-pump"
          style={{ height: 10 + k * 3.5 }}
          initial={{ opacity: 0.1 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 + k * 0.08 }}
        />
      ))}
    </div>
  )
}
