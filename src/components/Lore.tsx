import { m, useReducedMotion, useScroll, useTransform, type MotionValue } from 'framer-motion'
import { useRef } from 'react'
import { art } from '../config'
import { SectionLabel } from './ui'

const LINES = [
  { t: 'Nobody knows exactly where Pumpchad came from.', size: 'lg' },
  { t: 'Some say he was forged during the deepest red candle imaginable.', size: 'md' },
  {
    t: 'Others say he simply opened a chart one morning, saw everyone panicking, cracked open a protein shake and pressed buy.',
    size: 'md',
  },
  { t: 'Nobody knows the truth.', size: 'lg' },
  { t: 'One thing is certain.', size: 'lg' },
  { t: 'When markets dump…', size: 'xl' },
] as const

function Line({ p, i, n, children, className }: { p: MotionValue<number>; i: number; n: number; children: string; className: string }) {
  const reduce = useReducedMotion()
  const start = (i / n) * 0.75
  const opacity = useTransform(p, [start, start + 0.12], reduce ? [1, 1] : [0.14, 1])
  const y = useTransform(p, [start, start + 0.12], reduce ? [0, 0] : [18, 0])
  return (
    <m.p style={{ opacity, y }} className={className}>
      {children}
    </m.p>
  )
}

export function Lore() {
  const ref = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.75', 'end 0.85'] })
  const silY = useTransform(scrollYProgress, [0, 1], reduce ? ['0%', '0%'] : ['-8%', '10%'])
  const silScale = useTransform(scrollYProgress, [0, 1], reduce ? [1, 1] : [0.95, 1.1])
  const finalScale = useTransform(scrollYProgress, [0.78, 0.95], reduce ? [1, 1] : [0.82, 1])
  const finalOpacity = useTransform(scrollYProgress, [0.78, 0.92], reduce ? [1, 1] : [0, 1])

  const sizes = {
    md: 'text-[clamp(1.35rem,4.6vw,2.4rem)] leading-[1.25] font-sans font-medium text-bone/90 max-w-3xl',
    lg: 'text-[clamp(2rem,7vw,4.25rem)] leading-[0.98] font-display uppercase',
    xl: 'text-[clamp(2.5rem,9vw,6rem)] leading-[0.95] font-display uppercase text-bone/80',
  }

  return (
    <section ref={ref} aria-labelledby="lore-title" className="relative isolate overflow-hidden pb-16 pt-28 md:pb-28 md:pt-44">
      {/* silhouette */}
      <m.div aria-hidden="true" style={{ y: silY, scale: silScale }} className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
        <img
          src={art.silhouette.src}
          alt=""
          loading="lazy"
          data-art-slot="silhouette"
          className="h-[min(120vw,1100px)] w-auto max-w-none opacity-[0.16] [filter:grayscale(1)_contrast(1.6)_brightness(0.55)_sepia(1)_hue-rotate(-18deg)_saturate(3)] [mask-image:radial-gradient(closest-side,#000_35%,transparent)]"
        />
      </m.div>
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_100%,rgba(255,122,26,0.14),transparent_60%)]" />

      <div className="mx-auto max-w-[1100px] px-4 sm:px-6">
        <SectionLabel n="06">The lore</SectionLabel>
        <h2 id="lore-title" className="sr-only">
          The Lore
        </h2>
        <p aria-hidden="true" className="text-outline mt-4 font-display text-[clamp(4rem,20vw,12rem)] uppercase leading-[0.8]">
          The lore
        </p>

        <div className="mt-14 space-y-10 md:mt-20 md:space-y-14">
          {LINES.map((l, i) => (
            <Line key={i} p={scrollYProgress} i={i} n={LINES.length} className={sizes[l.size]}>
              {l.t}
            </Line>
          ))}
        </div>

        <m.p
          style={{ scale: finalScale, opacity: finalOpacity }}
          className="text-molten glow-pump mt-10 origin-left font-display text-[clamp(5rem,26vw,19rem)] uppercase leading-[0.88] md:mt-14"
        >
          Chads
          <br />
          pump.
        </m.p>
      </div>
    </section>
  )
}
