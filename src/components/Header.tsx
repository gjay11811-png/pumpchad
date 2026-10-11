import { AnimatePresence, m } from 'framer-motion'
import { useEffect, useState } from 'react'
import { art, nav, site, social } from '../config'
import { EnterChadverse, PlayIcon } from './EnterChadverse'
import { TelegramIcon, XIcon, ease } from './ui'

export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
    <header
      className={`fixed inset-x-0 top-0 z-50 pt-[env(safe-area-inset-top)] transition-[background-color,border-color,backdrop-filter] duration-500 ${
        scrolled || open ? 'border-b border-bone/[0.07] bg-ink/70 backdrop-blur-xl' : 'border-b border-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6 md:h-20 lg:px-10">
        <a href="#top" className="group flex items-center gap-3" aria-label="Pumpchad — back to top">
          <span className="relative h-9 w-9 overflow-hidden rounded-full ring-1 ring-pump/50 transition-transform duration-500 group-hover:rotate-[-8deg] md:h-10 md:w-10">
            <img src={art.logo.src} alt="" className="h-full w-full object-cover" width={40} height={40} />
          </span>
          <span className="font-display text-xl tracking-[0.06em] md:text-2xl">PUMPCHAD</span>
        </a>

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-9">
            {nav.map((n) => (
              <li key={n.href}>
                <a
                  href={n.href}
                  className="group relative py-2 font-mono text-[12px] uppercase tracking-[0.22em] text-bone/70 transition-colors hover:text-bone"
                >
                  {n.label}
                  <span className="absolute -bottom-0.5 left-0 h-px w-full origin-right scale-x-0 bg-pump transition-transform duration-500 ease-chad group-hover:origin-left group-hover:scale-x-100" />
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <EnterChadverse className="group hidden h-11 items-center gap-2 rounded-full border border-moon/40 bg-[linear-gradient(180deg,rgba(246,200,112,0.14),rgba(246,200,112,0.04))] px-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-moon transition-all duration-300 hover:-translate-y-0.5 hover:border-moon/70 xl:flex">
            <PlayIcon className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" /> Enter the Chadverse
          </EnterChadverse>
          <SocialPill href={social.xUrl} label="Pumpchad on X">
            <XIcon className="h-4 w-4" />
          </SocialPill>
          <SocialPill href={social.telegramUrl} label="Pumpchad on Telegram" accent>
            <TelegramIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Telegram</span>
          </SocialPill>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="relative ml-1 flex h-11 w-11 items-center justify-center rounded-full border border-bone/15 lg:hidden"
          >
            <span className={`absolute h-[1.5px] w-5 bg-bone transition-transform duration-500 ease-chad ${open ? 'rotate-45' : '-translate-y-[4px]'}`} />
            <span className={`absolute h-[1.5px] w-5 bg-bone transition-transform duration-500 ease-chad ${open ? '-rotate-45' : 'translate-y-[4px]'}`} />
          </button>
        </div>
      </div>

    </header>
      <AnimatePresence>
        {open && (
          <m.div
            id="mobile-menu"
            initial={{ clipPath: 'inset(0 0 100% 0)' }}
            animate={{ clipPath: 'inset(0 0 0% 0)' }}
            exit={{ clipPath: 'inset(0 0 100% 0)' }}
            transition={{ duration: 0.6, ease }}
            className="fixed inset-x-0 z-40 top-[calc(4rem+env(safe-area-inset-top))] bottom-0 pb-[calc(2.5rem+env(safe-area-inset-bottom))] flex flex-col justify-between overflow-y-auto bg-ink px-4 pt-8 sm:px-6 md:top-[calc(5rem+env(safe-area-inset-top))] lg:hidden"
          >
            <div aria-hidden="true" className="pointer-events-none absolute -right-24 bottom-10 h-80 w-80 rounded-full bg-pump/20 blur-[90px]" />
            <nav aria-label="Mobile">
              <ul className="space-y-1">
                {nav.map((n, i) => (
                  <li key={n.href} className="overflow-hidden">
                    <m.a
                      href={n.href}
                      onClick={() => setOpen(false)}
                      initial={{ y: '110%' }}
                      animate={{ y: 0 }}
                      transition={{ duration: 0.7, ease, delay: 0.12 + i * 0.06 }}
                      className="flex items-baseline gap-4 py-1 font-display text-[clamp(3rem,15vw,5.5rem)] uppercase leading-[0.95] text-bone active:text-pump"
                    >
                      <span className="font-mono text-xs text-pump">0{i + 1}</span>
                      {n.label}
                    </m.a>
                  </li>
                ))}
              </ul>
            </nav>
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="relative mt-10 space-y-5"
            >
              <EnterChadverse className="flex min-h-14 items-center justify-center gap-2.5 rounded-full border border-moon/40 bg-[linear-gradient(180deg,rgba(246,200,112,0.16),rgba(246,200,112,0.04))] font-semibold uppercase tracking-[0.12em] text-moon">
                <PlayIcon className="h-5 w-5" /> Enter the Chadverse
              </EnterChadverse>
              <p className="font-display text-2xl uppercase text-bone/80">{site.slogan}</p>
              <div className="flex gap-3">
                <a href={social.telegramUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-pump font-semibold uppercase tracking-wider text-ink">
                  <TelegramIcon className="h-4 w-4" /> Telegram
                </a>
                <a href={social.xUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border border-bone/20 font-semibold uppercase tracking-wider">
                  <XIcon className="h-4 w-4" /> Follow
                </a>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  )
}

function SocialPill({ href, label, children, accent }: { href: string; label: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className={`flex h-11 min-w-11 items-center justify-center gap-2 rounded-full px-3 text-[12px] font-semibold uppercase tracking-[0.12em] transition-all duration-300 hover:-translate-y-0.5 sm:px-4 ${
        accent ? 'bg-pump text-ink hover:bg-ember' : 'border border-bone/15 text-bone hover:border-bone/40'
      }`}
    >
      {children}
    </a>
  )
}
