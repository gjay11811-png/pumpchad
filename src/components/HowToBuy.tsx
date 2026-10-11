import { m, useScroll, useTransform } from 'framer-motion'
import { AlertTriangle, ArrowUpRight, Lock } from 'lucide-react'
import { useRef } from 'react'
import { contractLive, site } from '../config'
import { SectionLabel, ease } from './ui'

const STEPS = [
  { title: 'Get a Solana wallet', body: 'Use a compatible wallet such as Phantom.' },
  { title: 'Get SOL', body: 'Fund the wallet with enough SOL for the purchase and network fees.' },
  { title: 'Use the official link', body: 'Only use links published on the Pumpchad website, X account and Telegram.' },
  { title: `Swap for ${site.ticker}`, body: `Once ${site.ticker} is live, connect your wallet through the official launch or trading link.` },
]

export function HowToBuy() {
  const listRef = useRef<HTMLOListElement>(null)
  const { scrollYProgress } = useScroll({ target: listRef, offset: ['start 0.7', 'end 0.6'] })
  const lineScale = useTransform(scrollYProgress, [0, 1], [0, 1])

  return (
    <section id="how-to-buy" aria-labelledby="buy-title" className="relative overflow-x-clip border-y border-bone/[0.07] bg-coal py-24 md:py-36">
      <div className="mx-auto grid max-w-[1440px] gap-14 px-4 sm:px-6 lg:grid-cols-12 lg:gap-10 lg:px-10">
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-32">
            <SectionLabel n="05">How to buy</SectionLabel>
            <h2 id="buy-title" className="mt-6 font-display text-[clamp(3.25rem,14vw,8rem)] uppercase leading-[0.9]">
              How to
              <br />
              become
              <br />a <span className="text-molten">Chad</span>
            </h2>

            {!contractLive && (
              <div role="note" className="mt-10 flex gap-4 rounded-2xl border border-alarm/35 bg-[linear-gradient(135deg,rgba(255,77,61,0.10),rgba(255,77,61,0.02))] p-5">
                <AlertTriangle aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-alarm" />
                <p className="text-[15px] leading-relaxed text-bone/90">
                  <strong className="font-semibold text-bone">{site.ticker} is not live yet.</strong> Do not buy tokens pretending to be
                  Pumpchad before the official contract is announced.
                </p>
              </div>
            )}

            <div className="mt-6">
              {site.buyUrl && contractLive ? (
                <a
                  href={site.buyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex min-h-13 items-center gap-3 rounded-full bg-pump px-7 font-semibold uppercase tracking-[0.08em] text-ink transition-colors hover:bg-ember"
                >
                  Official trading link
                  <ArrowUpRight className="h-5 w-5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </a>
              ) : (
                <span aria-disabled="true" className="inline-flex min-h-13 cursor-not-allowed items-center gap-3 whitespace-nowrap rounded-full border border-bone/15 px-6 text-[13px] font-semibold uppercase tracking-[0.08em] sm:px-7 sm:text-base text-bone/45">
                  <Lock aria-hidden="true" className="h-4 w-4" /> Official link — coming soon
                </span>
              )}
            </div>
          </div>
        </div>

        <ol ref={listRef} className="relative lg:col-span-7 lg:pl-8">
          {/* progress spine */}
          <span aria-hidden="true" className="absolute bottom-6 left-[1.625rem] top-6 w-px bg-bone/10 md:left-[2.5rem] lg:left-[4.5rem]" />
          <m.span
            aria-hidden="true"
            style={{ scaleY: lineScale }}
            className="absolute bottom-6 left-[1.625rem] top-6 w-px origin-top bg-gradient-to-b from-pump to-ember md:left-[2.5rem] lg:left-[4.5rem]"
          />
          {STEPS.map((s, i) => (
            <m.li
              key={s.title}
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '0px 0px -15% 0px' }}
              transition={{ duration: 0.8, ease }}
              className="relative grid grid-cols-[3.25rem_1fr] gap-5 pb-14 last:pb-0 md:grid-cols-[5rem_1fr] md:gap-8 md:pb-20"
            >
              <span className="relative z-10 flex aspect-square items-center justify-center rounded-full bg-coal font-display text-2xl text-pump ring-1 ring-pump/50 md:text-4xl">
                {i + 1}
              </span>
              <div className="pt-1 md:pt-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ash">Step 0{i + 1}</p>
                <h3 className="mt-2 font-display text-[clamp(2rem,8vw,4rem)] uppercase leading-[0.92]">{s.title}</h3>
                <p className="mt-3 max-w-md text-[16px] leading-relaxed text-bone/65 md:text-lg">{s.body}</p>
              </div>
            </m.li>
          ))}
        </ol>
      </div>
    </section>
  )
}
