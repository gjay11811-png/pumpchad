import { AnimatePresence, m } from 'framer-motion'
import { Check, Copy, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { contractLive, site } from '../config'

const shorten = (a: string) => `${a.slice(0, 6)}…${a.slice(-6)}`

/** Reads site.contractAddress. Shows NOT LIVE YET until a valid Solana address is set. */
export function ContractAddress({ compact = false }: { compact?: boolean }) {
  const [full, setFull] = useState(false)
  const [copied, setCopied] = useState(false)
  const address = site.contractAddress.trim()

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = address
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div
      className={`relative overflow-hidden rounded-[24px] ${
        contractLive ? 'metal ring-1 ring-pump/40' : 'border border-dashed border-bone/20 bg-ink/60'
      } ${compact ? 'p-5' : 'p-6 sm:p-8 md:p-10'}`}
    >
      {!contractLive && <div aria-hidden="true" className="hatch pointer-events-none absolute inset-y-0 right-0 w-1/3 opacity-40 [mask-image:linear-gradient(90deg,transparent,#000)]" />}
      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ash">Contract address</p>

          {contractLive ? (
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => setFull((v) => !v)}
                aria-expanded={full}
                title={full ? 'Show short address' : 'Show full address'}
                className="min-w-0 text-left font-mono text-[clamp(1.1rem,4.5vw,2rem)] font-semibold text-bone transition-colors hover:text-ember"
              >
                <span className={full ? 'break-all' : ''}>{full ? address : shorten(address)}</span>
              </button>
              <button
                type="button"
                onClick={copy}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-full bg-pump px-5 text-sm font-semibold uppercase tracking-wider text-ink transition-colors hover:bg-ember sm:self-auto"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <AnimatePresence>
                {copied && (
                  <m.span role="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="sr-only">
                    Contract address copied
                  </m.span>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <>
              <p className={`mt-2 font-display uppercase leading-none text-bone ${compact ? 'text-4xl' : 'text-[clamp(3rem,12vw,6.5rem)]'}`}>
                Not live <span className="text-outline-pump">yet</span>
              </p>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-bone/65">
                The official {site.ticker} contract address will appear here at launch.
              </p>
            </>
          )}
        </div>

        <div className="flex max-w-sm items-start gap-3 rounded-2xl border border-ember/25 bg-ember/[0.06] p-4 text-sm leading-relaxed text-bone/80">
          <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-ember" />
          <p>Never trust a contract posted anywhere except our official website, X account and Telegram.</p>
        </div>
      </div>
    </div>
  )
}
