import { m, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { useRef } from 'react'
import { art, social } from '../config'
import { Seal } from './Commandments'
import { TelegramIcon, XIcon } from './ui'

export function Community() {
  const ref = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const bgX = useTransform(scrollYProgress, [0, 1], reduce ? ['0%', '0%'] : ['0%', '-30%'])
  const imgRotate = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [-8, 6])

  return (
    <section ref={ref} id="community" aria-labelledby="zone-title" className="relative isolate overflow-hidden bg-pump text-ink">
      <m.p aria-hidden="true" style={{ x: bgX }} className="pointer-events-none absolute -bottom-[4vw] left-0 -z-10 whitespace-nowrap font-display text-[34vw] uppercase leading-none text-transparent [-webkit-text-stroke:1.5px_rgba(7,6,10,0.13)]">
        Chad zone chad zone
      </m.p>
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_80%_30%,rgba(255,215,140,0.55),transparent_55%)]" />

      <div className="mx-auto grid max-w-[1440px] items-center gap-12 px-4 py-24 sm:px-6 md:py-32 lg:grid-cols-12 lg:px-10">
        <div className="lg:col-span-7">
          <p className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.28em] text-ink/70">
            <span>(08)</span>
            <span className="h-px w-8 bg-current opacity-50" />
            Community
          </p>
          <h2 id="zone-title" className="mt-6 font-display text-[clamp(3.5rem,16vw,10.5rem)] uppercase leading-[0.88]">
            Enter the
            <br />
            Chad zone
          </h2>
          <div className="mt-8 space-y-1 font-display text-[clamp(1.6rem,6vw,2.75rem)] uppercase leading-[1.05]">
            <p>The memes start on X.</p>
            <p className="text-ink/60">The chaos happens on Telegram.</p>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:max-w-2xl">
            <ZoneButton href={social.telegramUrl} icon={<TelegramIcon className="h-6 w-6" />} title="Join Telegram" sub={`t.me/${social.telegramHandle}`} />
            <ZoneButton href={social.xUrl} icon={<XIcon className="h-5 w-5" />} title="Follow on X" sub={social.xHandle ? `@${social.xHandle}` : 'Official X account'} />
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[26rem] lg:col-span-5 lg:max-w-none">
          <m.div style={{ rotate: imgRotate }} className="relative aspect-square">
            <div className="absolute inset-[9%] overflow-hidden rounded-full bg-ink shadow-[0_40px_100px_-20px_rgba(7,6,10,0.7)] ring-[10px] ring-ink">
              <img src={art.hero.srcSmall} alt="" loading="lazy" className="h-full w-full scale-[1.15] object-cover object-top" />
            </div>
          </m.div>
          <Seal className="absolute -bottom-4 -left-2 w-28 rounded-full bg-ink p-1 sm:w-36" />
        </div>
      </div>
    </section>
  )
}

function ZoneButton({ href, icon, title, sub }: { href: string; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex items-center justify-between gap-4 overflow-hidden rounded-2xl bg-ink px-5 py-5 text-bone transition-transform duration-500 ease-chad hover:-translate-y-1 active:scale-[0.98] md:px-6 md:py-6"
    >
      <span className="flex items-center gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-pump text-ink transition-transform duration-500 group-hover:rotate-[-10deg] group-hover:scale-110">{icon}</span>
        <span>
          <span className="block font-display text-2xl uppercase leading-none tracking-wide">{title}</span>
          <span className="mt-1 block font-mono text-[11px] tracking-[0.12em] text-bone/55">{sub}</span>
        </span>
      </span>
      <ArrowUpRight className="h-6 w-6 text-pump transition-transform duration-500 group-hover:-translate-y-1 group-hover:translate-x-1" />
    </a>
  )
}
