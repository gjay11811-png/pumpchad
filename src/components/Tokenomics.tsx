import { m } from 'framer-motion'
import { formatSupply, site, tokenomics } from '../config'
import { ContractAddress } from './ContractAddress'
import { Reveal, SectionLabel, ease } from './ui'

const SPECS = [
  { k: 'Token', v: site.projectName },
  { k: 'Ticker', v: site.ticker },
  { k: 'Network', v: site.network },
  { k: 'Tax', v: site.tax, note: site.taxNote },
]

export function Tokenomics() {
  const { final, allocation, allocationNote, status } = tokenomics
  return (
    <section id="tokenomics" aria-labelledby="tok-title" className="relative overflow-hidden py-24 md:py-36">
      <div aria-hidden="true" className="pointer-events-none absolute right-[-20%] top-0 h-[50rem] w-[50rem] rounded-full bg-pump/[0.06] blur-[140px]" />
      <div className="relative mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <SectionLabel n="04">Tokenomics</SectionLabel>
            <h2 id="tok-title" className="mt-6 font-display text-[clamp(3.25rem,14vw,9rem)] uppercase leading-[0.9]">
              The <span className="text-molten">numbers</span>
            </h2>
          </div>
          <p className="max-w-xs font-mono text-[11px] uppercase leading-relaxed tracking-[0.2em] text-ash">
            Spec sheet {final ? '· final' : '· pre-launch'}
            <br />
            Only confirmed details are shown as confirmed.
          </p>
        </div>

        {/* supply */}
        <Reveal className="mt-14 border-t border-bone/10 pt-8 md:mt-20">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ash">Total supply</p>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-3 font-display leading-[0.9]">
            <span className="text-chain text-[clamp(3.4rem,15.5vw,15rem)] tracking-[-0.01em]">{formatSupply(site.totalSupply)}</span>
            <span className="text-[clamp(1.75rem,6vw,4.5rem)] text-bone/80">{site.ticker}</span>
          </p>
        </Reveal>

        {/* spec grid */}
        <dl className="mt-12 grid grid-cols-2 border-l border-t border-bone/10 lg:grid-cols-4">
          {SPECS.map((s, i) => (
            <m.div
              key={s.k}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease, delay: i * 0.08 }}
              className="group relative border-b border-r border-bone/10 p-5 transition-colors duration-500 hover:bg-bone/[0.03] md:p-8"
            >
              <dt className="font-mono text-[11px] uppercase tracking-[0.3em] text-ash">{s.k}</dt>
              <dd className={`mt-3 font-display uppercase leading-none ${s.k === 'Tax' ? 'text-molten text-[clamp(3rem,10vw,5.5rem)]' : 'text-[clamp(1.6rem,6vw,3rem)]'}`}>
                {s.v}
              </dd>
              {s.note && <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-bone/45">{s.note}</p>}
            </m.div>
          ))}
        </dl>

        <div className="mt-12 grid gap-6 lg:grid-cols-12">
          {/* allocation */}
          <Reveal className="metal relative overflow-hidden rounded-[24px] p-6 sm:p-8 lg:col-span-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-display text-3xl uppercase">Allocation</p>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.25em] text-ash">
                  {final ? 'Published allocation' : 'Placeholder — segments are not to scale'}
                </p>
              </div>
              {!final && (
                <span className="rotate-[4deg] rounded-md border-2 border-ember/70 px-3 py-1 font-display text-lg uppercase tracking-widest text-ember">
                  Draft · not final
                </span>
              )}
            </div>

            <div className="mt-8 flex h-14 gap-1.5 overflow-hidden rounded-xl" aria-hidden="true">
              {allocation.map((a, i) =>
                final && a.percent != null ? (
                  <div key={a.label} className="h-full rounded-md" style={{ width: `${a.percent}%`, background: ['#ff7a1a', '#ffa940', '#f6c870'][i % 3] }} />
                ) : (
                  <div key={a.label} className="hatch h-full flex-1 rounded-md border border-dashed border-ember/40" />
                ),
              )}
            </div>

            <ul className="mt-6 divide-y divide-bone/[0.07]">
              {allocation.map((a) => (
                <li key={a.label} className="flex items-center justify-between gap-4 py-4">
                  <span className="text-[15px] text-bone/85 md:text-base">{a.label}</span>
                  <span className={`font-display text-2xl uppercase ${final && a.percent != null ? 'text-bone' : 'text-ember/80'}`}>
                    {final && a.percent != null ? `${a.percent}%` : 'TBC'}
                  </span>
                </li>
              ))}
            </ul>

            {!final && (
              <p className="mt-4 rounded-xl bg-bone/[0.04] px-4 py-3 text-[15px] font-semibold text-bone">{allocationNote}</p>
            )}
          </Reveal>

          {/* launch facts */}
          <Reveal delay={0.1} className="flex flex-col rounded-[24px] border border-bone/10 lg:col-span-5">
            <p className="border-b border-bone/10 px-6 py-5 font-display text-3xl uppercase sm:px-8">Launch facts</p>
            <dl className="flex flex-1 flex-col divide-y divide-bone/10">
              {status.map((s) => (
                <div key={s.label} className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:px-8">
                  <dt className="font-mono text-[11px] uppercase tracking-[0.3em] text-ash">{s.label}</dt>
                  <dd className="text-lg font-semibold text-bone">{s.value}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>

        <Reveal className="mt-6">
          <ContractAddress />
        </Reveal>
      </div>
    </section>
  )
}
