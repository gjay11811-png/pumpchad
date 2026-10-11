import { m, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { art, site, social } from '../config'
import { ArtSlot, Cta, TelegramIcon, XIcon, ease } from './ui'

const WORD = 'PUMPCHAD'.split('')

export function Hero() {
  const ref = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const imgY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, 140])
  const imgScale = useTransform(scrollYProgress, [0, 1], reduce ? [1, 1] : [1, 1.08])
  const wordY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, -90])
  const copyOpacity = useTransform(scrollYProgress, [0, 0.55], [1, 0])

  return (
    <section ref={ref} id="top" aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-ink pt-16 md:pt-20 lg:min-h-[100svh]">
      {/* ── background layers ── */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="grid-faint absolute inset-0 [mask-image:radial-gradient(ellipse_70%_60%_at_60%_40%,#000_10%,transparent_75%)]" />
        <div className="glow-breathe absolute left-1/2 top-[8%] h-[70vw] w-[70vw] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,122,26,0.32),rgba(255,122,26,0.06)_45%,transparent_70%)] lg:left-[68%] lg:top-[2%] lg:h-[62vw] lg:w-[62vw]" />
        <div className="absolute -bottom-40 -left-40 h-[32rem] w-[32rem] rounded-full bg-sol-purple/[0.08] blur-[120px]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink to-transparent" />
      </div>

      <div className="relative mx-auto flex max-w-[1440px] flex-col lg:block lg:min-h-[calc(100svh-5rem)]">
        {/* ── mascot ── */}
        <m.div
          style={{ y: imgY, scale: imgScale }}
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.6, ease }}
          className="relative order-1 mx-auto aspect-square w-[min(112vw,640px)] -mt-2 lg:absolute lg:right-[-4vw] lg:top-[-4.5rem] lg:mt-0 lg:w-[min(64vw,118svh)] lg:max-w-none"
        >
          <ArtSlot
            slot="hero"
            src={art.hero.src}
            srcSet={`${art.hero.srcSmall} 760w, ${art.hero.src} 1254w`}
            sizes="(max-width: 1024px) 100vw, 64vw"
            alt={art.hero.alt}
            eager
            className="h-full w-full [mask-image:radial-gradient(closest-side_at_50%_46%,#000_62%,transparent_100%)]"
          />
          {/* rim light to sit the art into the page */}
          <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(closest-side_at_50%_50%,transparent_55%,#07060a_98%)]" />
        </m.div>

        {/* ── copy ── */}
        <m.div style={{ opacity: copyOpacity }} className="relative z-20 order-3 px-4 pb-14 sm:px-6 lg:max-w-[min(42rem,46vw)] lg:px-10 lg:pb-0 lg:pt-[clamp(2.5rem,9vh,7rem)]">
          <m.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease, delay: 0.2 }}
            className="mb-6 hidden flex-wrap items-center gap-3 lg:flex"
          >
            <StatusBadge />
            <TickerChip />
          </m.div>

          <h2 className="overflow-hidden font-display text-[clamp(2.75rem,11.5vw,4.5rem)] uppercase leading-[0.92] lg:text-[clamp(3.5rem,6.2vw,6.75rem)]">
            <m.span className="block" initial={{ y: '105%' }} animate={{ y: 0 }} transition={{ duration: 1, ease, delay: 0.35 }}>
              Markets dump.
            </m.span>
            <m.span className="text-molten block" initial={{ y: '105%' }} animate={{ y: 0 }} transition={{ duration: 1, ease, delay: 0.47 }}>
              Chads pump.
            </m.span>
          </h2>

          <m.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease, delay: 0.7 }}
            className="mt-5 max-w-[30rem] text-[17px] leading-relaxed text-bone/70 md:text-lg"
          >
            {site.heroLine}
          </m.p>

          <m.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease, delay: 0.85 }}
            className="mt-8 flex flex-col gap-3 sm:flex-row"
          >
            <Cta href={social.telegramUrl} icon={<TelegramIcon className="h-5 w-5" />}>Join Telegram</Cta>
            <Cta href={social.xUrl} variant="ghost" icon={<XIcon className="h-4 w-4" />}>Follow on X</Cta>
          </m.div>

          <m.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4 }}
            className="mt-8 font-mono text-[11px] uppercase tracking-[0.25em] text-bone/45"
          >
            &gt; {site.secondary}
            <span className="blink ml-1 inline-block h-3 w-1.5 translate-y-0.5 bg-pump" />
          </m.p>
        </m.div>

        {/* ── wordmark ── */}
        <m.div style={{ y: wordY }} className="relative z-10 order-2 -mt-[24vw] px-3 sm:-mt-[20vw] lg:absolute lg:inset-x-0 lg:bottom-[-1.6vw] lg:mt-0 lg:px-6">
          <div className="mb-3 flex items-center justify-between gap-3 px-1 lg:hidden">
            <StatusBadge />
            <TickerChip />
          </div>
          <h1 id="hero-title" aria-label="Pumpchad ($PCHAD)" className="flex select-none justify-between font-display text-[23.4vw] leading-[0.8] tracking-[-0.01em] lg:text-[min(21.8vw,22rem)]">
            {WORD.map((ch, i) => (
              <span key={i} aria-hidden="true" className="block overflow-hidden pb-[0.02em]">
                <m.span
                  className="block bg-[linear-gradient(180deg,#fbf6ee_0%,#f3ece2_55%,#ffb76b_130%)] bg-clip-text text-transparent [filter:drop-shadow(0_10px_40px_rgba(0,0,0,0.65))]"
                  initial={{ y: '102%' }}
                  animate={{ y: 0 }}
                  transition={{ duration: 1.1, ease, delay: 0.05 + i * 0.055 }}
                >
                  {ch}
                </m.span>
              </span>
            ))}
          </h1>
        </m.div>
      </div>

      {/* scroll cue */}
      <m.a
        href="#about"
        aria-label="Scroll to About"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8 }}
        className="absolute bottom-[calc(min(21.8vw,22rem)*0.86)] right-10 z-20 hidden items-center gap-3 font-mono text-[11px] uppercase tracking-[0.35em] text-bone/40 transition-colors hover:text-bone lg:flex"
      >
        Scroll
        <span className="relative block h-10 w-px overflow-hidden bg-bone/15">
          <m.span
            className="absolute inset-x-0 top-0 h-1/2 bg-pump"
            animate={{ y: ['-100%', '200%'] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        </span>
      </m.a>
    </section>
  )
}

function StatusBadge() {
  return (
    <span className="inline-flex items-center gap-2.5 rounded-full py-1.5 pl-2.5 pr-3.5 font-mono text-[11px] uppercase tracking-[0.2em] text-bone/85 backdrop-blur [background-image:linear-gradient(#0b0a0e,#0b0a0e),linear-gradient(90deg,rgba(155,92,255,0.6),rgba(25,241,154,0.6))] [background-clip:padding-box,border-box] [border:1px_solid_transparent]">
      <span className="relative flex h-2 w-2">
        <span className="absolute inset-0 animate-ping rounded-full bg-sol-green/70 motion-reduce:animate-none" />
        <span className="relative h-2 w-2 rounded-full bg-sol-green" />
      </span>
      Launching on Solana
    </span>
  )
}

function TickerChip() {
  return (
    <span className="metal inline-flex items-center rounded-md px-3 py-1.5 font-display text-lg leading-none tracking-[0.08em]">
      <span className="text-chain">{site.ticker}</span>
    </span>
  )
}
