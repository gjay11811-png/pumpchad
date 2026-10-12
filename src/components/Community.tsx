import { m, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { ArrowUpRight, Check, Share2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { art, launch, site, social, xUrl } from '../config'
import { TelegramIcon, XIcon } from './ui'

const SHARE_TEXT = `PumpChad ($PCHAD) — ${launch.countdownTagline}`
/** the address people are actually on (site.url is still a placeholder domain) */
const pageUrl = () => (typeof window === 'undefined' ? '' : window.location.origin + window.location.pathname)

/** Native share sheet on phones; copy-the-link fallback everywhere else. */
function ShareButton() {
  const [copied, setCopied] = useState(false)
  const share = async () => {
    const url = pageUrl()
    if (navigator.share) {
      try {
        await navigator.share({ title: site.projectName, text: SHARE_TEXT, url })
        return
      } catch {
        // cancelled — fall through to copy only if sharing isn't available
        return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const t = document.createElement('textarea')
      t.value = url
      document.body.appendChild(t)
      t.select()
      document.execCommand('copy')
      t.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2200)
  }
  return (
    <button type="button" onClick={share} className="group inline-flex min-h-13 items-center justify-center gap-3 rounded-full border-2 border-ink px-6 font-semibold uppercase tracking-[0.08em] text-ink transition-colors hover:bg-ink hover:text-pump active:scale-[0.97]" data-testid="share-button">
      {copied ? <Check className="h-5 w-5" /> : <Share2 className="h-5 w-5 transition-transform group-hover:-rotate-12" />}
      <span aria-live="polite">{copied ? 'Link copied' : 'Share PumpChad'}</span>
    </button>
  )
}

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
          <h2 id="zone-title" className="mt-6 font-display text-[clamp(3rem,13vw,8.5rem)] uppercase leading-[0.88]">
            The strongest
            <br />
            Chads build
            <br />
            together.
          </h2>
          <div className="mt-8 space-y-1 font-display text-[clamp(1.4rem,5.5vw,2.4rem)] uppercase leading-[1.05]">
            <p>Get in before {launch.dateLabel}.</p>
            <p className="text-ink/60">Launch news, sneak peeks and the memes land here first.</p>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:max-w-2xl">
            <ZoneButton href={social.telegramUrl} icon={<TelegramIcon className="h-6 w-6" />} title="Join Telegram" sub={`t.me/${social.telegramHandle}`} />
            {xUrl ? (
              <ZoneButton href={xUrl} icon={<XIcon className="h-5 w-5" />} title="Follow on X" sub={`@${social.xHandle}`} />
            ) : (
              <div className="flex items-center gap-4 rounded-2xl border-2 border-dashed border-ink/25 px-5 py-5 md:px-6 md:py-6">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink/10">
                  <XIcon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-display text-2xl uppercase leading-none tracking-wide">X — coming soon</span>
                  <span className="mt-1 block font-mono text-[11px] tracking-[0.12em] text-ink/60">Official account link drops here</span>
                </span>
              </div>
            )}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <ShareButton />
            <a href={`https://t.me/share/url?url=${encodeURIComponent(pageUrl())}&text=${encodeURIComponent(SHARE_TEXT)}`} target="_blank" rel="noopener noreferrer" className="font-mono text-[12px] uppercase tracking-[0.16em] underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
              Share on Telegram
            </a>
            <a href={`https://x.com/intent/post?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(pageUrl())}`} target="_blank" rel="noopener noreferrer" className="font-mono text-[12px] uppercase tracking-[0.16em] underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
              Post on X
            </a>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[26rem] lg:col-span-5 lg:max-w-none">
          <m.div style={{ rotate: imgRotate }} className="relative aspect-square">
            <div className="absolute inset-[9%] overflow-hidden rounded-full bg-ink shadow-[0_40px_100px_-20px_rgba(7,6,10,0.7)] ring-[10px] ring-ink">
              <img src={art.hero.srcSmall} alt="" loading="lazy" className="h-full w-full scale-[1.15] object-cover object-top" />
            </div>
          </m.div>
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
