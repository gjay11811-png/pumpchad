import { AnimatePresence, m } from 'framer-motion'
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { memes } from '../config'
import { Reveal, SectionLabel, ease } from './ui'

// Desktop rhythm repeats every 5 memes: 7+5 on top, 4+4+4 below.
const DESKTOP = ['lg:col-span-7', 'lg:col-span-5', 'lg:col-span-4', 'lg:col-span-4', 'lg:col-span-4']

export function Archives() {
  const [open, setOpen] = useState<number | null>(null)
  const n = memes.length

  return (
    <section id="memes" aria-labelledby="memes-title" className="relative overflow-hidden py-24 md:py-36">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <SectionLabel n="07">Memes</SectionLabel>
            <Reveal>
              <h2 id="memes-title" className="mt-6 font-display text-[clamp(3.25rem,14vw,9rem)] uppercase leading-[0.9]">
                The Chad
                <br />
                <span className="text-outline-pump">Archives</span>
              </h2>
            </Reveal>
          </div>
          <p className="max-w-sm font-mono text-[11px] uppercase leading-relaxed tracking-[0.2em] text-ash lg:col-span-4 lg:justify-self-end lg:text-right">
            Recovered from the timeline.
            <br />
            {String(n).padStart(3, '0')} files on record · tap to open
          </p>
        </div>

        <ul className="mt-14 grid grid-flow-dense grid-cols-2 gap-3 md:mt-20 md:gap-4 lg:auto-rows-[clamp(12rem,17vw,17rem)] lg:grid-cols-12">
          {memes.map((meme, i) => {
            const wideMobile = i % 3 === 0 || (i === n - 1 && i % 3 === 1)
            return (
              <m.li
                key={meme.id}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '0px 0px -10% 0px' }}
                transition={{ duration: 0.8, ease, delay: (i % 3) * 0.08 }}
                className={`${wideMobile ? 'col-span-2 aspect-[16/11]' : 'col-span-1 aspect-[4/5]'} ${DESKTOP[i % 5]} lg:row-span-2 lg:aspect-auto`}
              >
                <button
                  type="button"
                  onClick={() => setOpen(i)}
                  aria-label={`Open meme: ${meme.caption}`}
                  className="group relative block h-full w-full overflow-hidden rounded-[18px] bg-char text-left ring-1 ring-bone/10 transition-[box-shadow] duration-500 hover:ring-pump/60 md:rounded-[22px]"
                >
                  <img
                    src={meme.src}
                    alt={meme.alt}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover transition-[transform,filter] duration-[1.2s] ease-chad group-hover:scale-[1.07] group-hover:[filter:contrast(1.1)_saturate(1.15)]"
                  />
                  <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
                  <span className="absolute left-3 top-3 rounded-full bg-ink/70 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.25em] text-bone/80 backdrop-blur md:left-4 md:top-4 md:text-[10px]">
                    File {meme.id}
                  </span>
                  <span aria-hidden="true" className="absolute right-3 top-3 flex h-8 w-8 scale-75 items-center justify-center rounded-full bg-pump text-ink opacity-0 transition-all duration-500 group-hover:scale-100 group-hover:opacity-100 md:right-4 md:top-4">
                    <Maximize2 className="h-4 w-4" />
                  </span>
                  <span className="absolute inset-x-0 bottom-0 p-3 md:p-5">
                    <span className={`block font-display uppercase leading-[1] text-bone transition-transform duration-500 ease-chad group-hover:-translate-y-1 ${wideMobile ? 'text-[clamp(1.4rem,5.5vw,2.4rem)]' : 'text-[clamp(1.05rem,4.4vw,2rem)]'} lg:text-[clamp(1.3rem,1.9vw,2.2rem)]`}>
                      {meme.caption}
                    </span>
                  </span>
                </button>
              </m.li>
            )
          })}
        </ul>
      </div>

      <AnimatePresence>{open !== null && <Lightbox index={open} setIndex={setOpen} />}</AnimatePresence>
    </section>
  )
}

function Lightbox({ index, setIndex }: { index: number; setIndex: (i: number | null) => void }) {
  const meme = memes[index]
  const closeRef = useRef<HTMLButtonElement>(null)
  const n = memes.length
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
      aria-label={meme.caption}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[70] flex flex-col bg-ink/90 backdrop-blur-xl"
      onClick={() => setIndex(null)}
    >
      <div className="flex items-center justify-between px-4 py-4 sm:px-6" onClick={(e) => e.stopPropagation()}>
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-ash">
          File {meme.id} <span className="text-bone/30">/ {String(n).padStart(3, '0')}</span>
        </p>
        <button ref={closeRef} type="button" onClick={() => setIndex(null)} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full border border-bone/20 transition-colors hover:border-pump hover:text-pump">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 sm:px-20">
        <AnimatePresence mode="wait">
          <m.figure
            key={meme.id}
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.4, ease }}
            className="flex max-h-full flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={meme.src} alt={meme.alt} className="max-h-[calc(100svh-15rem)] w-auto max-w-full rounded-2xl object-contain ring-1 ring-bone/10" />
            <figcaption className="mt-5 max-w-2xl text-center font-display text-[clamp(1.5rem,5vw,2.75rem)] uppercase leading-[1]">{meme.caption}</figcaption>
          </m.figure>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-center gap-3 py-5" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => go(-1)} aria-label="Previous meme" className="flex h-12 w-12 items-center justify-center rounded-full border border-bone/20 transition-colors hover:border-pump hover:text-pump">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button type="button" onClick={() => go(1)} aria-label="Next meme" className="flex h-12 w-12 items-center justify-center rounded-full border border-bone/20 transition-colors hover:border-pump hover:text-pump">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </m.div>
  )
}
