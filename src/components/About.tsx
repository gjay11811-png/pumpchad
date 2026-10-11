import { m, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { art } from '../config'
import { ArtSlot, Reveal, SectionLabel } from './ui'

export function About() {
  const ref = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const imgY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [-40, 40])
  const bgX = useTransform(scrollYProgress, [0, 1], reduce ? ['0%', '0%'] : ['6%', '-14%'])

  return (
    <section ref={ref} id="about" aria-labelledby="about-title" className="relative overflow-hidden py-24 md:py-36">
      {/* faint background word */}
      <m.p
        aria-hidden="true"
        style={{ x: bgX }}
        className="text-outline pointer-events-none absolute -top-6 left-0 whitespace-nowrap font-display text-[42vw] leading-none md:top-10 md:text-[30vw]"
      >
        WHO? CHAD.
      </m.p>

      <div className="relative mx-auto grid max-w-[1440px] gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:gap-10 lg:px-10">
        {/* art column */}
        <div className="relative lg:col-span-5">
          <Reveal y={50} className="relative">
            <m.div style={{ y: imgY }} className="relative">
              <ArtSlot
                slot="standing"
                src={art.standing.src}
                alt={art.standing.alt}
                className="aspect-[4/5] w-full rounded-[28px] ring-1 ring-bone/10 [mask-image:linear-gradient(180deg,#000_70%,transparent)]"
              />
              {/* caption plate */}
              <div className="metal absolute -bottom-6 right-4 rounded-xl px-4 py-3 md:-right-8">
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ash">Subject</p>
                <p className="font-display text-2xl uppercase leading-tight text-chain">Pumpchad</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone/60">Status: unbothered</p>
              </div>
            </m.div>
          </Reveal>
        </div>

        {/* text column */}
        <div className="lg:col-span-7 lg:pl-10 lg:pt-10">
          <SectionLabel n="01">About</SectionLabel>
          <Reveal>
            <h2 id="about-title" className="mt-6 font-display text-[clamp(3.5rem,15vw,9.5rem)] uppercase leading-[0.9]">
              Who is
              <br />
              <span className="text-molten">Pumpchad?</span>
            </h2>
          </Reveal>

          <div className="mt-10 grid gap-8 md:grid-cols-[1fr_1.15fr] md:gap-10">
            <Reveal delay={0.05}>
              <p className="font-display text-[clamp(1.75rem,6vw,2.6rem)] uppercase leading-[1.02] text-bone">
                Pumpchad isn’t here to predict the market.
              </p>
            </Reveal>
            <Reveal delay={0.12} className="space-y-5 text-[17px] leading-relaxed text-bone/70 md:text-lg">
              <p>He’s here because everyone else started panicking.</p>
              <p>
                Born somewhere between a red candle, a protein shake and a terrible financial decision, Pumpchad represents
                the part of the internet that refuses to take the market — or itself — too seriously.
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.1} className="mt-14 flex flex-wrap items-end gap-x-6 gap-y-2 border-t border-bone/10 pt-8">
            <p className="font-display text-[clamp(2.5rem,10vw,5.5rem)] uppercase leading-none text-bone/35">Markets dump.</p>
            <p className="text-molten glow-pump font-display text-[clamp(2.5rem,10vw,5.5rem)] uppercase leading-none">Chads pump.</p>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
