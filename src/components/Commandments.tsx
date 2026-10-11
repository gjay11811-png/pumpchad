import { m } from 'framer-motion'
import { art } from '../config'
import { Reveal, SectionLabel, ease } from './ui'

const LAWS = [
  { n: 'I', title: 'Never panic.', line: 'Red candles build character.' },
  { n: 'II', title: 'Respect the pump.', line: 'Nobody likes a premature exit.' },
  { n: 'III', title: 'Memes before meetings.', line: 'The timeline never sleeps.' },
  { n: 'IV', title: 'Protect the community.', line: 'No fake links. No fake contracts. No scammers.' },
  { n: 'V', title: 'Stay Chad.', line: 'Markets dump. Chads pump.' },
]

export function Seal({ className = '' }: { className?: string }) {
  const text = 'OFFICIAL CHAD LAW • MARKETS DUMP • CHADS PUMP • '
  return (
    <div className={`relative aspect-square ${className}`} aria-hidden="true">
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full animate-[spin_24s_linear_infinite] motion-reduce:animate-none">
        <defs>
          <path id="seal-circle" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" />
        </defs>
        <text fontFamily="JetBrains Mono, monospace" fontSize="12.5" letterSpacing="3" fill="#f6c870">
          <textPath href="#seal-circle">{text}</textPath>
        </text>
      </svg>
      <div className="absolute inset-[24%] overflow-hidden rounded-full ring-2 ring-moon/60">
        <img src={art.logo.src} alt="" loading="lazy" className="h-full w-full object-cover" />
      </div>
    </div>
  )
}

export function Commandments() {
  return (
    <section aria-labelledby="laws-title" className="relative overflow-hidden bg-coal py-24 md:py-36">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pump/40 to-transparent" />
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <div className="flex items-end justify-between gap-6">
          <div>
            <SectionLabel n="03">The law</SectionLabel>
            <Reveal>
              <h2 id="laws-title" className="mt-6 font-display text-[clamp(3.25rem,14vw,10rem)] uppercase leading-[0.9]">
                The Chad
                <br />
                <span className="text-chain">Commandments</span>
              </h2>
            </Reveal>
          </div>
          <Seal className="hidden w-44 shrink-0 md:block lg:w-56" />
        </div>

        <ol className="mt-16 border-b border-bone/10 md:mt-24">
          {LAWS.map((l, i) => (
            <m.li
              key={l.n}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '0px 0px -10% 0px' }}
              transition={{ duration: 0.8, ease, delay: i * 0.04 }}
              className="group relative isolate overflow-hidden border-t border-bone/10"
            >
              {/* hover wipe */}
              <span aria-hidden="true" className="absolute inset-0 -z-10 origin-left scale-x-0 bg-pump transition-transform duration-700 ease-chad group-hover:scale-x-100" />
              <div className="grid grid-cols-[3.5rem_1fr] items-center gap-x-4 gap-y-1 py-7 md:grid-cols-[9rem_1fr_minmax(0,22rem)] md:gap-x-8 md:py-10 lg:grid-cols-[12rem_1fr_minmax(0,26rem)]">
                <span className="row-span-2 font-serif text-[clamp(2.75rem,10vw,7rem)] italic leading-none text-pump transition-colors duration-500 group-hover:text-ink md:row-span-1">
                  {l.n}
                </span>
                <h3 className="font-display text-[clamp(1.9rem,7.4vw,5rem)] uppercase leading-[0.95] transition-[color,transform] duration-500 ease-chad group-hover:translate-x-2 group-hover:text-ink">
                  {l.title}
                </h3>
                <p className="text-[15px] leading-snug text-bone/60 transition-colors duration-500 group-hover:text-ink/80 md:text-right md:text-lg">
                  {l.line}
                </p>
              </div>
            </m.li>
          ))}
        </ol>
      </div>
    </section>
  )
}
