import { m, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { chadverse } from '../config'
import { Reveal, SectionLabel } from './ui'

const throne = chadverse[0]

export function About() {
  const ref = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const imgY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [30, -30])

  return (
    <section ref={ref} id="about" aria-labelledby="about-title" className="relative overflow-hidden py-24 md:py-36">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <SectionLabel n="01">About</SectionLabel>
        <Reveal>
          <h2 id="about-title" className="mt-6 font-display text-[clamp(3.5rem,15vw,9.5rem)] uppercase leading-[0.9]">
            Who is <span className="text-molten">Pumpchad?</span>
          </h2>
        </Reveal>

        <div className="mt-12 grid items-center gap-10 md:mt-16 lg:grid-cols-12 lg:gap-14">
          <Reveal y={40} className="lg:col-span-7">
            <m.figure style={{ y: imgY }} className="rounded-[24px] bg-[linear-gradient(160deg,rgba(255,122,26,0.5),rgba(246,200,112,0.12)_40%,rgba(255,122,26,0.3))] p-px shadow-[0_30px_80px_-40px_rgba(255,122,26,0.6)]">
              <img
                src={throne.src}
                alt={throne.alt}
                width={throne.width}
                height={throne.height}
                loading="lazy"
                decoding="async"
                data-art-slot="about"
                className="block h-auto w-full rounded-[23px]"
              />
            </m.figure>
          </Reveal>

          <div className="lg:col-span-5">
            <Reveal>
              <p className="font-display text-[clamp(1.9rem,6vw,3rem)] uppercase leading-[1.02] text-bone">
                Pumpchad isn’t here to predict the market.
              </p>
            </Reveal>
            <Reveal delay={0.08} className="mt-6 space-y-5 text-[17px] leading-relaxed text-bone/70 md:text-lg">
              <p>He’s here because everyone else started panicking.</p>
              <p>
                Born somewhere between a red candle, a protein shake and a terrible financial decision, Pumpchad represents
                the part of the internet that refuses to take the market — or itself — too seriously.
              </p>
            </Reveal>
            <Reveal delay={0.12} className="mt-10 border-t border-bone/10 pt-7">
              <p className="font-display text-[clamp(2.25rem,8vw,4rem)] uppercase leading-[0.95] text-bone/35">Markets dump.</p>
              <p className="text-molten glow-pump font-display text-[clamp(2.25rem,8vw,4rem)] uppercase leading-[0.95]">Chads pump.</p>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  )
}
