import { m } from 'framer-motion'
import { Check, Copy, ExternalLink, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { contractLive, site } from '../config'

/** Official contract address: full address always visible, one-tap copy, Solscan link, verify-before-trading warning. */
export function ContractAddress({ compact = false }: { compact?: boolean }) {
  const [copied, setCopied] = useState(false)
  const address = site.contractAddress.trim()

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = address
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      ta.setSelectionRange(0, address.length)
      document.execCommand('copy')
      ta.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2200)
  }

  if (!contractLive) {
    return (
      <div className="rounded-[24px] border border-dashed border-bone/20 bg-ink/60 p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ash">Contract address</p>
        <p className="mt-2 font-display text-4xl uppercase">Not published</p>
      </div>
    )
  }

  return (
    <div className={`metal relative overflow-hidden rounded-[24px] ring-1 ring-pump/40 ${compact ? 'p-5' : 'p-5 sm:p-8 md:p-10'}`}>
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ash">Official contract address · Solana · $PCHAD</p>

      <p
        data-testid="contract-address"
        className="mt-3 select-all break-all rounded-xl bg-ink/70 px-4 py-3.5 font-mono text-[clamp(0.95rem,3.9vw,1.6rem)] font-semibold leading-snug text-bone ring-1 ring-bone/10"
      >
        {address}
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={copy}
          data-testid="copy-contract"
          className="inline-flex min-h-13 flex-1 items-center justify-center gap-2.5 rounded-full bg-pump px-6 text-[15px] font-semibold uppercase tracking-[0.08em] text-ink transition-colors hover:bg-ember active:scale-[0.98] sm:flex-none"
        >
          {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
          {copied ? 'Copied!' : 'Copy address'}
        </button>
        <a
          href={site.solscanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-13 flex-1 items-center justify-center gap-2.5 rounded-full border border-bone/25 px-6 text-[15px] font-semibold uppercase tracking-[0.08em] text-bone transition-colors hover:border-pump hover:text-pump active:scale-[0.98] sm:flex-none"
        >
          <ExternalLink className="h-5 w-5" />
          Verify on Solscan
        </a>
      </div>

      <p role="status" aria-live="polite" className={`mt-3 h-5 font-mono text-[12px] uppercase tracking-[0.18em] text-sol-green transition-opacity ${copied ? 'opacity-100' : 'opacity-0'}`}>
        {copied ? 'Contract address copied to clipboard' : ''}
      </p>

      <m.div initial={false} className="mt-2 flex items-start gap-3 rounded-2xl border border-ember/30 bg-ember/[0.07] p-4 text-sm leading-relaxed text-bone/85">
        <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-ember" />
        <p>
          <strong className="font-semibold text-bone">Verify before you trade.</strong> Copy-cat tokens exist. Check that the mint you swap matches this address exactly, and only trust it
          from this website, the official X account and the official Telegram.
        </p>
      </m.div>
    </div>
  )
}
