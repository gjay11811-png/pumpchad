import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Fragment, useEffect, useState } from 'react'
import { tickerPhrases } from '../config'
import { PumpkinMark, ease } from './ui'

const MOODS = [
  { from: 'Market mood: Fear', to: 'Pumpchad mode' },
  { from: 'Red candle detected', to: 'Chad mode activated' },
  { from: 'Timeline panicking', to: 'Protein shake opened' },
  { from: 'Paper hands detected', to: 'Biceps engaged' },
]

/** Pure branding. Cycles through jokes — this is not, and never shows, market data. */
export function MoodStrip() {
  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const reduce = useReducedMotion()

  useEffect(() => {
    const t = setInterval(() => {
      setFlipped((f) => {
        if (f) setI((v) => (v + 1) % MOODS.length)
        return !f
      })
    }, reduce ? 4200 : 2100)
    return () => clearInterval(t)
  }, [reduce])

  const mood = MOODS[i]

  return (
    <div role="region" aria-label="Pumpchad mood strip (for fun, not market data)" className="relative z-10 border-y border-bone/[0.08] bg-coal/90">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:gap-8 lg:px-10">
        <div className="flex shrink-0 items-center gap-3 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.22em] text-ash sm:text-[10px]">
          <span className="rounded-sm bg-bone/[0.06] px-2 py-1 text-bone/80">Chad mood index</span>
          <span>Vibes only · Not market data</span>
        </div>

        <div className="flex min-h-[3.6rem] flex-1 flex-wrap items-center gap-x-3 gap-y-1 overflow-hidden font-display lg:min-h-8 lg:flex-nowrap text-[clamp(1.25rem,5.2vw,1.9rem)] uppercase leading-none" aria-live="polite">
          <AnimatePresence mode="popLayout" initial={false}>
            <m.span
              key={`${i}-from`}
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: flipped ? 0.35 : 1 }}
              exit={{ y: '-100%', opacity: 0 }}
              transition={{ duration: 0.5, ease }}
              className="relative whitespace-nowrap text-alarm"
            >
              {mood.from}
              <m.span
                aria-hidden="true"
                className="absolute left-0 top-1/2 h-[2px] w-full origin-left bg-alarm"
                initial={false}
                animate={{ scaleX: flipped ? 1 : 0 }}
                transition={{ duration: 0.4, ease }}
              />
            </m.span>
          </AnimatePresence>
          <ArrowRight aria-hidden="true" className={`h-5 w-5 shrink-0 transition-colors duration-500 ${flipped ? 'text-pump' : 'text-bone/25'}`} />
          <AnimatePresence mode="popLayout" initial={false}>
            {flipped && (
              <m.span
                key={`${i}-to`}
                initial={{ y: '100%', opacity: 0, filter: 'blur(6px)' }}
                animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                transition={{ duration: 0.5, ease }}
                className="text-molten glow-pump whitespace-nowrap"
              >
                {mood.to}
              </m.span>
            )}
          </AnimatePresence>
        </div>

        {/* mood segments — decorative */}
        <div aria-hidden="true" className="hidden shrink-0 gap-1 lg:flex">
          {Array.from({ length: 12 }).map((_, k) => (
            <span
              key={k}
              className="h-5 w-1.5 rounded-[1px] transition-colors duration-500"
              style={{
                transitionDelay: `${k * 35}ms`,
                background: flipped ? `rgba(255,${110 + k * 8},26,${0.35 + k * 0.05})` : k < 3 ? '#ff4d3d' : 'rgba(243,236,226,0.08)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function TapeRow({ reverse, variant }: { reverse?: boolean; variant: 'pump' | 'dark' }) {
  const items = [...tickerPhrases, ...tickerPhrases]
  return (
    <div className="flex overflow-hidden">
      <div className={`marquee ${reverse ? 'marquee-reverse' : ''}`} style={{ ['--marquee-duration' as string]: variant === 'pump' ? '48s' : '62s' }}>
        {[0, 1].map((dup) => (
          <div key={dup} aria-hidden={dup === 1} className="flex shrink-0 items-center">
            {items.map((p, k) => (
              <Fragment key={k}>
                <span
                  className={`whitespace-nowrap px-5 font-display uppercase leading-none md:px-7 ${
                    variant === 'pump'
                      ? 'text-[clamp(1.75rem,6vw,3.5rem)] text-ink'
                      : k % 2
                        ? 'text-outline-pump text-[clamp(1.5rem,5vw,2.75rem)]'
                        : 'text-[clamp(1.5rem,5vw,2.75rem)] text-bone/90'
                  }`}
                >
                  {p}
                </span>
                <PumpkinMark className={`h-6 w-6 shrink-0 md:h-8 md:w-8 ${variant === 'pump' ? 'text-ink' : 'text-pump'}`} />
              </Fragment>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function Ticker() {
  return (
    <section aria-label={tickerPhrases.join(' · ')} className="relative overflow-hidden py-14 md:py-20">
      <div className="relative -mx-[5%] rotate-[-2.2deg] bg-pump py-3 shadow-[0_20px_60px_-10px_rgba(255,122,26,0.45)] md:py-4">
        <TapeRow variant="pump" />
      </div>
      <div className="relative -mx-[5%] -mt-2 rotate-[1.6deg] border-y border-bone/10 bg-char py-3 md:py-4">
        <TapeRow variant="dark" reverse />
      </div>
    </section>
  )
}
