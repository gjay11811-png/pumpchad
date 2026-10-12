import { AnimatePresence, m } from 'framer-motion'
import { Lock } from 'lucide-react'
import { useState } from 'react'
import { chadverse3d, social } from '../config'
import { Reveal, SectionLabel, TelegramIcon, ease } from './ui'

/** Teaser for the in-development 3D Chadverse: real screenshots only — the game itself is not loaded here. */
export function ChadverseTeaser() {
  return (
    <section id="chadverse-3d" aria-labelledby="awakening-title" className="relative isolate overflow-hidden bg-coal py-24 md:py-36">
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(155,92,255,0.12),transparent_70%),radial-gradient(ellipse_60%_40%_at_50%_100%,rgba(255,122,26,0.10),transparent_70%)]" />
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <SectionLabel n="3D">Sneak peek · in development</SectionLabel>
            <Reveal>
              <h2 id="awakening-title" className="mt-6 font-display text-[clamp(3rem,12.5vw,8.5rem)] uppercase leading-[0.9]">
                The Chadverse
                <br />
                <span className="text-molten">is awakening.</span>
              </h2>
            </Reveal>
          </div>
          <div className="lg:col-span-4 lg:justify-self-end lg:text-right">
            <p className="text-[16px] leading-relaxed text-bone/70 md:text-lg">An interactive 3D world for the PumpChad community, built by hand. Everything below is a real screenshot from the work-in-progress build.</p>
          </div>
        </div>

        {/* characters */}
        <div className="mt-14 grid grid-cols-3 gap-2 sm:gap-4">
          {chadverse3d.characters.map((c, i) => (
            <Reveal key={c.name} delay={i * 0.08}>
              <figure className="group relative overflow-hidden rounded-[22px] bg-ink ring-1 ring-bone/10">
                <img src={c.src} alt={c.alt} width={560} height={768} loading="lazy" decoding="async" className="aspect-[560/768] w-full object-cover transition-transform duration-[1.2s] ease-chad group-hover:scale-[1.04]" />
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink via-ink/70 to-transparent px-3 pb-3 pt-10 font-display text-[clamp(0.9rem,3.6vw,1.6rem)] uppercase leading-none tracking-wide">{c.name}</figcaption>
              </figure>
            </Reveal>
          ))}
        </div>

        {/* world + gym */}
        <div className="mt-2 grid gap-2 sm:mt-4 sm:gap-4 lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            <figure className="relative overflow-hidden rounded-[22px] ring-1 ring-bone/10">
              <img src={chadverse3d.world.src} alt={chadverse3d.world.alt} width={1280} height={720} loading="lazy" decoding="async" className="aspect-video w-full object-cover" />
              <figcaption className="absolute left-3 top-3 rounded-full bg-ink/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-bone/85 backdrop-blur">Chad Square</figcaption>
            </figure>
          </Reveal>
          <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:col-span-5 lg:grid-cols-1 lg:grid-rows-3">
            {chadverse3d.gym.map((g, i) => (
              <Reveal key={g.label} delay={0.05 + i * 0.06} className="h-full">
                <figure className="relative h-full overflow-hidden rounded-[18px] ring-1 ring-bone/10">
                  <img src={g.src} alt={g.alt} width={900} height={570} loading="lazy" decoding="async" className="aspect-[900/570] h-full w-full object-cover lg:aspect-auto" />
                  <figcaption className="absolute left-2 top-2 rounded-full bg-ink/70 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-bone/85 backdrop-blur sm:text-[10px]"><span className="hidden sm:inline">Gym · </span>{g.label}</figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>

        {/* features + locked gate */}
        <div className="mt-14 grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-7">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ash">What we’re building</p>
            <ul className="mt-6 divide-y divide-bone/[0.07] border-y border-bone/[0.07]">
              {chadverse3d.features.map((f) => (
                <li key={f.title} className="flex items-start justify-between gap-6 py-5">
                  <div>
                    <p className="font-display text-[clamp(1.35rem,4.6vw,1.9rem)] uppercase leading-tight">{f.title}</p>
                    <p className="mt-1 text-[15px] leading-relaxed text-bone/60">{f.text}</p>
                  </div>
                  <span className="mt-1 shrink-0 rounded-full border border-ember/30 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ember">In development</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:col-span-5">
            <LockedGate />
          </div>
        </div>
      </div>
    </section>
  )
}

function LockedGate() {
  const [tries, setTries] = useState(0)
  const knock = () => setTries((t) => t + 1)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={knock}
        aria-describedby="gate-msg"
        className={`group relative block w-full overflow-hidden rounded-[28px] p-[1px] text-left [background:linear-gradient(140deg,rgba(255,169,64,0.6),rgba(155,92,255,0.45),rgba(255,122,26,0.15))] ${tries ? 'gate-shake' : ''}`}
        key={tries} // restart the shake on every knock
        data-testid="chadverse-gate"
      >
        <span className="relative block overflow-hidden rounded-[27px] bg-ink px-6 py-10 sm:px-8 sm:py-12">
          <span aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,122,26,0.22),transparent_60%)] opacity-70 transition-opacity duration-700 group-hover:opacity-100" />
          <span aria-hidden="true" className="absolute inset-x-[18%] top-0 h-full bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.05)_0_2px,transparent_2px_22px)]" />
          <span className="relative flex flex-col items-center text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-pump/15 ring-1 ring-pump/40 transition-transform duration-500 group-hover:scale-105">
              <Lock className="h-9 w-9 text-ember" strokeWidth={1.6} />
            </span>
            <span className="mt-6 font-display text-[clamp(1.9rem,7vw,2.75rem)] uppercase leading-none tracking-wide">Access locked</span>
            <span className="mt-2 font-mono text-[12px] uppercase tracking-[0.3em] text-ember">Coming soon</span>
            <span className="mt-6 font-mono text-[10.5px] uppercase tracking-[0.22em] text-bone/40">Tap to knock</span>
          </span>
        </span>
      </button>
      <AnimatePresence mode="wait">
        <m.div key={tries > 0 ? 'open' : 'idle'} id="gate-msg" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.45, ease }} className="mt-4 text-center" aria-live="polite">
          {tries > 0 ? (
            <div className="rounded-2xl bg-bone/[0.04] p-5 ring-1 ring-bone/10">
              <p className="font-display text-xl uppercase tracking-wide">The gate holds — for now.</p>
              <p className="mt-1 text-[15px] text-bone/65">The Chadverse isn’t open to the public yet. Join the Telegram to hear first when it is.</p>
              <a href={social.telegramUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-full bg-pump px-6 font-semibold uppercase tracking-[0.08em] text-ink transition-colors hover:bg-ember" data-testid="gate-telegram">
                <TelegramIcon className="h-5 w-5" /> Get updates on Telegram
              </a>
            </div>
          ) : (
            <p className="text-[14px] text-bone/45">The entrance to the Chadverse. Not open to the public yet.</p>
          )}
        </m.div>
      </AnimatePresence>
    </div>
  )
}
