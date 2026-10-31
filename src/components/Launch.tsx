import { ArrowUpRight, ExternalLink } from 'lucide-react'
import { launch, site, social } from '../config'
import { LAUNCH_AT, countdownParts, tradingCopy, useLaunch } from '../launch'
import { ContractAddress } from './ContractAddress'
import { Reveal, SectionLabel, TelegramIcon, XIcon } from './ui'

const TONE = {
  live: 'border-sol-green/40 bg-sol-green/[0.07] text-sol-green',
  soon: 'border-ember/40 bg-ember/[0.07] text-ember',
  'not-live': 'border-alarm/40 bg-alarm/[0.07] text-alarm',
}

export function BuyButton({ className = '' }: { className?: string }) {
  return (
    <a
      href={site.buyUrl}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="buy-pchad"
      className={`group inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-[linear-gradient(180deg,#ff9a3c,#ff7a1a_55%,#e5630c)] px-8 text-base font-bold uppercase tracking-[0.1em] text-ink shadow-[0_10px_40px_-10px_rgba(255,122,26,0.8)] transition-transform duration-300 hover:-translate-y-0.5 active:scale-[0.97] ${className}`}
    >
      Buy $PCHAD
      <ArrowUpRight className="h-5 w-5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </a>
  )
}

export function TradingStatusChip({ className = '' }: { className?: string }) {
  const { trading, poolOpensAt } = useLaunch()
  const c = tradingCopy(trading, poolOpensAt)
  return (
    <span
      role="status"
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] ${TONE[c.tone]} ${className}`}
    >
      <span className={`h-2 w-2 rounded-full bg-current ${c.tone === 'live' ? 'shadow-[0_0_10px_currentColor]' : ''}`} aria-hidden="true" />
      Trading: {c.short}
    </span>
  )
}

function Tile({ v, label }: { v: number; label: string }) {
  return (
    <div className="rounded-2xl bg-ink/70 px-2 py-4 text-center ring-1 ring-bone/10 sm:py-6">
      <p className="font-display text-[clamp(2.4rem,11vw,5.5rem)] leading-none tabular-nums text-chain">{String(v).padStart(2, '0')}</p>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ash sm:text-[11px]">{label}</p>
    </div>
  )
}

const localTime = () => {
  try {
    return new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(LAUNCH_AT)
  } catch {
    return ''
  }
}

export function Launch() {
  const { msLeft, reached, trading, poolOpensAt, recheck } = useLaunch()
  const p = countdownParts(msLeft)
  const c = tradingCopy(trading, poolOpensAt)

  return (
    <section id="launch" aria-labelledby="launch-title" className="relative overflow-hidden py-20 md:py-32">
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 h-[40rem] w-[60rem] -translate-x-1/2 rounded-full bg-pump/[0.08] blur-[140px]" />
      <div className="relative mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-10">
        <SectionLabel n="01">Official launch</SectionLabel>
        <h2 id="launch-title" className="mt-6 font-display text-[clamp(2.75rem,12vw,7rem)] uppercase leading-[0.92]">
          The pumpkin has <span className="text-molten">awakened</span>
        </h2>

        <Reveal className="metal mt-10 rounded-[28px] p-5 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-ash">{launch.label}</p>
            <TradingStatusChip />
          </div>

          {!reached ? (
            <div className="mt-5" role="timer" aria-label="Time until launch">
              <div className="grid grid-cols-4 gap-2 sm:gap-4">
                <Tile v={p.d} label="Days" />
                <Tile v={p.h} label="Hours" />
                <Tile v={p.m} label="Min" />
                <Tile v={p.s} label="Sec" />
              </div>
              <p className="mt-4 text-sm text-bone/60">Your local time: {localTime()}</p>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl bg-ink/70 p-5 ring-1 ring-bone/10 sm:p-7">
              <p className="font-display text-[clamp(1.8rem,7vw,3.2rem)] uppercase leading-none">Launch time reached</p>
              <p className="mt-3 text-[16px] leading-relaxed text-bone/75">{c.long}</p>
              {trading !== 'open' && (
                <button type="button" onClick={recheck} className="mt-4 min-h-11 rounded-full border border-bone/25 px-5 font-mono text-[12px] uppercase tracking-[0.18em] text-bone hover:border-pump hover:text-pump">
                  Re-check status
                </button>
              )}
            </div>
          )}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <BuyButton className="sm:col-span-2" />
            <a href={site.solscanUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-13 items-center justify-center gap-2.5 rounded-full border border-bone/25 px-6 font-semibold uppercase tracking-[0.08em] transition-colors hover:border-pump hover:text-pump">
              <ExternalLink className="h-5 w-5" /> View on Solscan
            </a>
            <div className="grid grid-cols-2 gap-3">
              <a href={social.telegramUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full border border-bone/25 px-3 text-[13px] font-semibold uppercase tracking-[0.06em] transition-colors hover:border-pump hover:text-pump">
                <TelegramIcon className="h-4 w-4" /> Telegram
              </a>
              <a href={social.xUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full border border-bone/25 px-3 text-[13px] font-semibold uppercase tracking-[0.06em] transition-colors hover:border-pump hover:text-pump">
                <XIcon className="h-4 w-4" /> Follow on X
              </a>
            </div>
          </div>
          <p className="mt-4 text-[13px] leading-relaxed text-bone/50">
            Buy opens Raydium ({site.pair}, {site.poolType}) with the official $PCHAD mint selected. The page only shows trading as open once Raydium reports the pool open. Not financial advice.
          </p>
        </Reveal>

        <Reveal className="mt-6">
          <ContractAddress />
        </Reveal>
      </div>
    </section>
  )
}
