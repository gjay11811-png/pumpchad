import { Check, Hammer, CalendarDays } from 'lucide-react'
import { milestones } from '../config'
import { Reveal, SectionLabel } from './ui'

const STYLE = {
  done: { icon: <Check className="h-5 w-5" />, chip: 'bg-sol-green/15 text-sol-green ring-sol-green/30', bar: 'bg-sol-green' },
  building: { icon: <Hammer className="h-5 w-5" />, chip: 'bg-ember/12 text-ember ring-ember/30', bar: 'bg-[repeating-linear-gradient(-45deg,rgba(255,169,64,0.9)_0_8px,rgba(255,169,64,0.35)_8px_16px)]' },
  date: { icon: <CalendarDays className="h-5 w-5" />, chip: 'bg-pump/15 text-pump ring-pump/35', bar: 'bg-pump/40' },
} as const

/** Build progress — driven by `milestones` in config.ts. */
export function Progress() {
  return (
    <section id="progress" aria-labelledby="progress-title" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-10">
        <SectionLabel n="✓">Development progress</SectionLabel>
        <Reveal>
          <h2 id="progress-title" className="mt-6 font-display text-[clamp(2.75rem,10vw,6.5rem)] uppercase leading-[0.92]">
            Road to <span className="text-molten">launch</span>
          </h2>
        </Reveal>
        <ol className="mt-12 grid gap-3">
          {milestones.map((ms, i) => {
            const st = STYLE[ms.state]
            return (
              <li key={ms.label}>
                <Reveal delay={i * 0.06}>
                <div className="metal relative flex items-center gap-4 overflow-hidden rounded-2xl px-4 py-4 sm:gap-6 sm:px-6 sm:py-5" data-testid="milestone">
                  <span className={`absolute inset-y-0 left-0 w-1 ${st.bar}`} aria-hidden="true" />
                  <span className="font-mono text-[12px] text-bone/35">{String(i + 1).padStart(2, '0')}</span>
                  <p className="flex-1 font-display text-[clamp(1.25rem,4.6vw,2rem)] uppercase leading-tight">{ms.label}</p>
                  <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] ring-1 ${st.chip}`}>
                    {st.icon}
                    <span>{ms.note}</span>
                  </span>
                </div>
                </Reveal>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
