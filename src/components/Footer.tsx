import { art, disclaimer, nav, site, social } from '../config'
import { TelegramIcon, XIcon } from './ui'

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-bone/[0.07] bg-coal pt-20">
      <div className="mx-auto grid max-w-[1440px] gap-12 px-4 sm:px-6 md:grid-cols-12 lg:px-10">
        <div className="md:col-span-5">
          <a href="#top" className="flex items-center gap-3" aria-label="Back to top">
            <img src={art.logo.src} alt="" loading="lazy" className="h-14 w-14 rounded-full ring-1 ring-pump/50" />
            <span className="font-display text-3xl tracking-[0.06em]">PUMPCHAD</span>
          </a>
          <p className="mt-6 font-display text-[clamp(2rem,6vw,3rem)] uppercase leading-none">
            Markets dump.
            <br />
            <span className="text-molten">Chads pump.</span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:col-span-7">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ash">Explore</p>
            <ul className="mt-4 space-y-2.5">
              {nav.map((n) => (
                <li key={n.href}>
                  <a href={n.href} className="text-[15px] text-bone/75 transition-colors hover:text-pump">
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ash">Official links</p>
            <ul className="mt-4 space-y-2.5">
              <li>
                <a href={social.xUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[15px] text-bone/75 transition-colors hover:text-pump">
                  <XIcon className="h-3.5 w-3.5" /> X
                </a>
              </li>
              <li>
                <a href={social.telegramUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[15px] text-bone/75 transition-colors hover:text-pump">
                  <TelegramIcon className="h-4 w-4" /> Telegram
                </a>
              </li>
            </ul>
          </div>
          <dl className="col-span-2 grid grid-cols-2 gap-8 sm:col-span-1 sm:grid-cols-1 sm:gap-4">
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-[0.3em] text-ash">Ticker</dt>
              <dd className="mt-2 font-display text-2xl text-chain">{site.ticker}</dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-[0.3em] text-ash">Network</dt>
              <dd className="mt-2 font-display text-2xl">{site.network}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <div className="flex flex-col gap-4 border-t border-bone/10 py-8 md:flex-row md:items-start md:justify-between md:gap-12">
          <p className="max-w-2xl text-[13px] leading-relaxed text-bone/50">{disclaimer}</p>
          <p className="shrink-0 font-mono text-[11px] uppercase tracking-[0.2em] text-bone/40">{site.copyright}</p>
        </div>
      </div>

      <p aria-hidden="true" className="pointer-events-none -mb-[5.5vw] select-none text-center font-display text-[23vw] leading-[0.8] text-transparent [-webkit-text-stroke:1px_rgba(255,122,26,0.22)]">
        PUMPCHAD
      </p>
    </footer>
  )
}
