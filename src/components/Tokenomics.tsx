import { m } from 'framer-motion'
import { ExternalLink, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { formatSupply, site, tokenomics } from '../config'
import { Reveal, SectionLabel, ease } from './ui'

const R = 78
const C = 2 * Math.PI * R
const GAP = 1.6

const SPECS = [
  { k: 'Token', v: site.projectName },
  { k: 'Ticker', v: site.ticker },
  { k: 'Network', v: site.network },
  { k: 'DEX · Pair', v: `${site.dex} · ${site.pair}` },
]

export function Tokenomics() {
  const { allocation, allocationNote, liquidityWarning, onchain, onchainChecked } = tokenomics
  const [active, setActive] = useState(0)
  const cur = allocation[active]

  let cum = 0
  const segs = allocation.map((a) => {
    const len = Math.max((C * a.percent) / 100 - GAP, 0.8)
    const s = { len, off: -((C * cum) / 100) }
    cum += a.percent
    return s
  })

  return (
    <section id="tokenomics" aria-labelledby="tok-title" className="relative overflow-hidden py-24 md:py-36">
      <div aria-hidden="true" className="pointer-events-none absolute right-[-20%] top-0 h-[50rem] w-[50rem] rounded-full bg-pump/[0.06] blur-[140px]" />
      <div className="relative mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <SectionLabel n="04">Tokenomics</SectionLabel>
        <h2 id="tok-title" className="mt-6 font-display text-[clamp(3.25rem,14vw,9rem)] uppercase leading-[0.9]">
          The <span className="text-molten">numbers</span>
        </h2>

        <Reveal className="mt-12 border-t border-bone/10 pt-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ash">Total supply</p>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-3 font-display leading-[0.9]">
            <span className="text-chain text-[clamp(2.6rem,12vw,13rem)] tracking-[-0.01em]">{formatSupply(site.totalSupply)}</span>
            <span className="text-[clamp(1.75rem,6vw,4.5rem)] text-bone/80">{site.ticker}</span>
          </p>
        </Reveal>

        <dl className="mt-10 grid grid-cols-2 border-l border-t border-bone/10 lg:grid-cols-4">
          {SPECS.map((s) => (
            <div key={s.k} className="border-b border-r border-bone/10 p-4 md:p-7">
              <dt className="font-mono text-[11px] uppercase tracking-[0.3em] text-ash">{s.k}</dt>
              <dd className="mt-2 font-display text-[clamp(1.25rem,5vw,2.4rem)] uppercase leading-tight">{s.v}</dd>
            </div>
          ))}
        </dl>

        {/* ── allocation donut ── */}
        <div className="mt-12 grid gap-6 lg:grid-cols-12">
          <Reveal className="metal rounded-[24px] p-5 sm:p-8 lg:col-span-7">
            <p className="font-display text-3xl uppercase">Allocation</p>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.25em] text-ash">Tap a segment or a row</p>

            <div className="mt-6 grid items-center gap-8 md:grid-cols-2">
              <div className="relative mx-auto aspect-square w-full max-w-[22rem]">
                <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90" role="img" aria-label="Allocation donut chart: 82% liquidity, 10% community, 4% Chadverse development, 3% founder, 1% development team">
                  <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(243,236,226,0.06)" strokeWidth="26" />
                  {allocation.map((a, i) => (
                    <m.circle
                      key={a.id}
                      cx="100"
                      cy="100"
                      r={R}
                      fill="none"
                      stroke={a.color}
                      strokeWidth={active === i ? 34 : 26}
                      strokeDashoffset={segs[i].off}
                      initial={{ strokeDasharray: `0 ${C}` }}
                      whileInView={{ strokeDasharray: `${segs[i].len} ${C - segs[i].len}` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.1, ease, delay: i * 0.12 }}
                      style={{ cursor: 'pointer', opacity: active === i ? 1 : 0.55, transition: 'stroke-width .25s, opacity .25s', pointerEvents: 'stroke' }}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => setActive(i)}
                    />
                  ))}
                </svg>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <p className="font-display text-[clamp(3rem,13vw,4.8rem)] leading-none" style={{ color: cur.color }}>
                    {cur.percent}%
                  </p>
                  <p className="mt-1 max-w-[9rem] font-mono text-[11px] uppercase leading-tight tracking-[0.14em] text-bone/70">{cur.label}</p>
                </div>
              </div>

              <ul className="divide-y divide-bone/[0.07]">
                {allocation.map((a, i) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => setActive(i)}
                      onMouseEnter={() => setActive(i)}
                      aria-pressed={active === i}
                      className={`flex min-h-14 w-full items-center gap-3 py-3 text-left transition-opacity ${active === i ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`}
                    >
                      <span className="h-3.5 w-3.5 shrink-0 rounded-sm" style={{ background: a.color }} aria-hidden="true" />
                      <span className="min-w-0 flex-1 text-[15px] leading-snug text-bone">{a.label}</span>
                      <span className="font-display text-2xl">{a.percent}%</span>
                    </button>
                  </li>
                ))}
                <li className="flex items-center justify-between py-3 font-mono text-[12px] uppercase tracking-[0.2em] text-ash">
                  <span>Total</span>
                  <span>100%</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 rounded-2xl bg-ink/60 p-4 ring-1 ring-bone/10" aria-live="polite">
              <p className="font-display text-xl uppercase" style={{ color: cur.color }}>
                {cur.label} · {cur.percent}% · {formatSupply((site.totalSupply * cur.percent) / 100)} {site.ticker}
              </p>
              <p className="mt-2 text-[15px] leading-relaxed text-bone/75">{cur.blurb}</p>
            </div>
          </Reveal>

          <div className="flex flex-col gap-6 lg:col-span-5">
            <Reveal delay={0.1} className="rounded-[24px] border border-alarm/40 bg-[linear-gradient(135deg,rgba(255,77,61,0.10),rgba(255,77,61,0.02))] p-5 sm:p-7">
              <p className="flex items-center gap-2.5 font-display text-2xl uppercase text-alarm">
                <ShieldAlert aria-hidden="true" className="h-6 w-6" /> Liquidity is not locked
              </p>
              <p className="mt-3 text-[15px] leading-relaxed text-bone/85">{liquidityWarning}</p>
            </Reveal>

            <Reveal delay={0.15} className="rounded-[24px] border border-bone/10 p-5 sm:p-7">
              <p className="flex items-center gap-2.5 font-display text-2xl uppercase">
                <ShieldCheck aria-hidden="true" className="h-6 w-6 text-sol-green" /> Verified on-chain
              </p>
              <dl className="mt-4 divide-y divide-bone/10">
                {onchain.map((o) => (
                  <div key={o.label} className="flex items-baseline justify-between gap-4 py-3">
                    <div>
                      <dt className="font-mono text-[11px] uppercase tracking-[0.25em] text-ash">{o.label}</dt>
                      <dd className="mt-0.5 text-[13px] text-bone/50">{o.note}</dd>
                    </div>
                    <dd className="text-right font-semibold text-bone">{o.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-[13px] leading-relaxed text-bone/50">Checked against Solana mainnet on {onchainChecked}. Confirm yourself:</p>
              <a href={site.solscanUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-full border border-bone/25 px-5 text-sm font-semibold uppercase tracking-[0.08em] hover:border-pump hover:text-pump">
                <ExternalLink className="h-4 w-4" /> View on Solscan
              </a>
            </Reveal>
          </div>
        </div>

        <Reveal className="mt-6">
          <p className="rounded-2xl bg-bone/[0.04] px-5 py-4 text-[14px] leading-relaxed text-bone/65">{allocationNote} $PCHAD is a meme token: no guaranteed returns and no promise of value.</p>
        </Reveal>
      </div>
    </section>
  )
}
