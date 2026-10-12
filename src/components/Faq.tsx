import { AnimatePresence, m } from 'framer-motion'
import { Plus } from 'lucide-react'
import { useId, useState } from 'react'
import { faq, launchStatus, type LaunchState } from '../config'
import { Reveal, SectionLabel, ease } from './ui'

const STATE_STYLE: Record<LaunchState, { dot: string; text: string }> = {
  live: { dot: 'bg-sol-green shadow-[0_0_10px_#19f19a]', text: 'text-sol-green' },
  soon: { dot: 'bg-ember', text: 'text-ember' },
  'not-live': { dot: 'bg-bone/25', text: 'text-bone/45' },
}

export function LaunchStatus() {
  return (
    <div className="metal overflow-hidden rounded-[24px]">
      <div className="flex items-center justify-between border-b border-bone/[0.07] px-5 py-4 sm:px-6">
        <p className="font-display text-2xl uppercase tracking-wide">Launch status</p>
        <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-ember">Launch · 31 Oct 2026</span>
      </div>
      <ul>
        {launchStatus.map((s) => {
          const st = STATE_STYLE[s.state]
          return (
            <li key={s.label} className="flex items-center justify-between gap-4 border-b border-bone/[0.05] px-5 py-3.5 last:border-0 sm:px-6">
              <span className="font-mono text-[12px] uppercase tracking-[0.22em] text-bone/80">{s.label}</span>
              <span className={`flex items-center gap-2.5 font-mono text-[12px] font-semibold uppercase tracking-[0.18em] ${st.text}`}>
                <span className={`h-2 w-2 rounded-full ${st.dot}`} aria-hidden="true" />
                {s.text}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  const base = useId()

  return (
    <section id="faq" aria-labelledby="faq-title" className="relative py-24 md:py-36">
      <div className="mx-auto grid max-w-[1440px] gap-14 px-4 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:px-10">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-32">
            <SectionLabel n="09">FAQ</SectionLabel>
            <h2 id="faq-title" className="mt-6 font-display text-[clamp(3.25rem,14vw,7.5rem)] uppercase leading-[0.9]">
              Chad
              <br />
              <span className="text-outline-pump">Q&amp;A</span>
            </h2>
            <p className="mt-5 max-w-xs text-[15px] leading-relaxed text-bone/60">Straight answers. If it isn’t confirmed, we say so.</p>
            <Reveal className="mt-10">
              <LaunchStatus />
            </Reveal>
          </div>
        </div>

        <div className="lg:col-span-8">
          <ul className="border-t border-bone/10">
            {faq.map((item, i) => {
              const isOpen = open === i
              const id = `${base}-${i}`
              return (
                <li key={item.q} className="border-b border-bone/10">
                  <h3>
                    <button
                      type="button"
                      id={`${id}-q`}
                      aria-expanded={isOpen}
                      aria-controls={`${id}-a`}
                      onClick={() => setOpen(isOpen ? null : i)}
                      className="group flex w-full items-center justify-between gap-6 py-6 text-left md:py-8"
                    >
                      <span className="flex items-baseline gap-4 md:gap-6">
                        <span className="font-mono text-[11px] text-pump">{String(i + 1).padStart(2, '0')}</span>
                        <span className={`font-display text-[clamp(1.5rem,5.4vw,2.6rem)] uppercase leading-[1.02] transition-colors duration-300 ${isOpen ? 'text-bone' : 'text-bone/75 group-hover:text-bone'}`}>
                          {item.q}
                        </span>
                      </span>
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all duration-500 ease-chad ${
                          isOpen ? 'rotate-45 border-pump bg-pump text-ink' : 'border-bone/20 text-bone group-hover:border-bone/50'
                        }`}
                        aria-hidden="true"
                      >
                        <Plus className="h-5 w-5" />
                      </span>
                    </button>
                  </h3>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <m.div
                        id={`${id}-a`}
                        role="region"
                        aria-labelledby={`${id}-q`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.45, ease }}
                        className="overflow-hidden"
                      >
                        <p className="max-w-2xl pb-8 pl-[calc(11px+1rem)] text-[17px] leading-relaxed text-bone/70 md:pl-[calc(11px+1.5rem+0.5rem)] md:text-lg">{item.a}</p>
                      </m.div>
                    )}
                  </AnimatePresence>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </section>
  )
}
