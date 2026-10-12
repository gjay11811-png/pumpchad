import { AnimatePresence, m } from 'framer-motion'
import { ChevronLeft, ChevronRight, Expand, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { chadverse, type Artwork } from '../config'
import { REVEAL_MARGIN, Reveal, SectionLabel, ease } from './ui'

const isLandscape = (a: Artwork) => a.width / a.height > 1.2

export function Chadverse() {
  const [open, setOpen] = useState<number | null>(null)
  const squares = chadverse.filter((a) => !isLandscape(a))
  const lastSquare = squares.length % 2 === 1 ? squares[squares.length - 1] : null
  // Desktop: pieces sit in pairs, each width proportional to its aspect ratio,
  // so both images in a row render at the same height without cropping.
  const ratio = (a: Artwork) => a.width / a.height
  const deskWidth = chadverse.map((a, i) => {
    const mate = chadverse[i % 2 === 0 ? i + 1 : i - 1]
    return mate ? ratio(a) / (ratio(a) + ratio(mate)) : 1
  })

  return (
    <section id="chadverse" aria-labelledby="chadverse-title" className="relative isolate overflow-hidden py-24 md:py-36">
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(246,200,112,0.08),transparent_70%)]" />

      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <SectionLabel n="07">Exclusive artwork</SectionLabel>
            <Reveal>
              <h2 id="chadverse-title" className="mt-6 font-display text-[clamp(3.25rem,14vw,9rem)] uppercase leading-[0.9]">
                The
                <br />
                <span className="text-chain">Chadverse</span>
              </h2>
            </Reveal>
          </div>
          <div className="lg:col-span-4 lg:justify-self-end lg:text-right">
            <p className="text-[16px] leading-relaxed text-bone/70 md:text-lg">
              Original Pumpchad artwork made for this site. You won’t find these on the timeline.
            </p>
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.22em] text-moon/70">
              Collection 01 · {String(chadverse.length).padStart(2, '0')} originals
            </p>
          </div>
        </div>

        <ul className="mt-12 grid grid-flow-dense grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:gap-4 md:mt-20 md:flex md:flex-wrap md:gap-5">
          {chadverse.map((art, i) => {
            const wide = isLandscape(art)
            const span = wide || art === lastSquare ? 'min-[360px]:col-span-2' : ''
            return (
              <m.li
                key={art.id}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: REVEAL_MARGIN }}
                transition={{ duration: 0.7, ease, delay: (i % 3) * 0.07 }}
                className={`${span} md:w-[calc(var(--w)*(100%-1.25rem))]`}
                style={{ ['--w' as string]: deskWidth[i] }}
              >
                <ArtCard art={art} compact={!wide && art !== lastSquare} onOpen={() => setOpen(i)} />
              </m.li>
            )
          })}
        </ul>
      </div>

      {createPortal(<AnimatePresence>{open !== null && <Viewer index={open} setIndex={setOpen} />}</AnimatePresence>, document.body)}
    </section>
  )
}

function ArtCard({ art, compact, onOpen }: { art: Artwork; compact: boolean; onOpen: () => void }) {
  return (
    <figure className="group relative h-full rounded-[22px] bg-[linear-gradient(160deg,rgba(255,122,26,0.55),rgba(246,200,112,0.14)_38%,rgba(255,122,26,0.06)_70%,rgba(255,122,26,0.35))] p-px shadow-[0_24px_60px_-34px_rgba(255,122,26,0.55)] transition-[transform,box-shadow] duration-500 ease-chad hover:-translate-y-1.5 hover:shadow-[0_30px_80px_-30px_rgba(255,122,26,0.8)]">
      <div className="flex h-full flex-col rounded-[21px] bg-coal p-1.5 sm:p-2">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Enlarge artwork: ${art.title}`}
          className="relative flex flex-1 items-center overflow-hidden rounded-[16px] bg-ink"
        >
          <img
            src={art.src}
            alt={art.alt}
            width={art.width}
            height={art.height}
            loading="lazy"
            decoding="async"
            className="block h-auto w-full rounded-[16px] transition-[filter] duration-500 group-hover:brightness-110"
          />
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[16px] ring-1 ring-inset ring-white/[0.06]" />
          <span
            aria-hidden="true"
            className="absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-ink/75 text-moon ring-1 ring-moon/30 backdrop-blur-sm transition-all duration-300 md:translate-y-1 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100"
          >
            <Expand className="h-4 w-4" />
          </span>
        </button>
        <figcaption className="flex min-h-[3.25rem] items-start gap-3 px-2 pb-1.5 pt-3 sm:px-2.5 sm:pt-3.5">
          <span className="pt-[3px] font-mono text-[11px] tracking-[0.12em] text-pump">{art.id}</span>
          <span className="min-w-0">
            <span className={`block font-display uppercase leading-none text-bone ${compact ? 'text-[1.15rem] sm:text-2xl' : 'text-2xl md:text-[1.75rem]'}`}>
              {art.title}
            </span>
            <span className={`mt-1.5 block text-[13px] leading-snug text-bone/55 sm:text-sm ${compact ? 'hidden sm:block' : ''}`}>{art.caption}</span>
          </span>
        </figcaption>
      </div>
    </figure>
  )
}

function Viewer({ index, setIndex }: { index: number; setIndex: (i: number | null) => void }) {
  const art = chadverse[index]
  const n = chadverse.length
  const closeRef = useRef<HTMLButtonElement>(null)
  const touchX = useRef<number | null>(null)
  const go = useCallback((d: number) => setIndex((index + d + n) % n), [index, n, setIndex])

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
      prev?.focus()
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIndex(null)
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, setIndex])

  return (
    <m.div
      role="dialog"
      aria-modal="true"
      aria-label={art.title}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[70] flex flex-col bg-ink/95 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]"
      onClick={() => setIndex(null)}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return
        const dx = e.changedTouches[0].clientX - touchX.current
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
        touchX.current = null
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 sm:px-6" onClick={(e) => e.stopPropagation()}>
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-moon/70">
          Chadverse {art.id} <span className="text-bone/30">/ {String(n).padStart(2, '0')}</span>
        </p>
        <button ref={closeRef} type="button" onClick={() => setIndex(null)} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full border border-bone/20 transition-colors hover:border-pump hover:text-pump">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-3 sm:px-20">
        <AnimatePresence mode="wait">
          <m.figure
            key={art.id}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease }}
            className="flex max-h-full flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={art.src}
              alt={art.alt}
              width={art.width}
              height={art.height}
              className="h-auto max-h-[calc(100svh-12rem)] w-auto max-w-full rounded-2xl object-contain shadow-[0_0_80px_-20px_rgba(255,122,26,0.5)] ring-1 ring-pump/30"
            />
            <figcaption className="mt-4 text-center">
              <span className="block font-display text-[clamp(1.5rem,5vw,2.25rem)] uppercase leading-none">{art.title}</span>
              <span className="mt-1.5 block text-sm text-bone/55">{art.caption}</span>
            </figcaption>
          </m.figure>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-center gap-3 py-4" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => go(-1)} aria-label="Previous artwork" className="flex h-12 w-12 items-center justify-center rounded-full border border-bone/20 transition-colors hover:border-pump hover:text-pump">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button type="button" onClick={() => go(1)} aria-label="Next artwork" className="flex h-12 w-12 items-center justify-center rounded-full border border-bone/20 transition-colors hover:border-pump hover:text-pump">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </m.div>
  )
}
