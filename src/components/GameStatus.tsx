import { Reveal, SectionLabel } from './ui'

type Stage = 'built' | 'dev' | 'planned'

const STAGE: Record<Stage, { label: string; cls: string }> = {
  built: { label: 'In the build · not public yet', cls: 'border-sol-green/40 bg-sol-green/[0.08] text-sol-green' },
  dev: { label: 'In development', cls: 'border-ember/40 bg-ember/[0.08] text-ember' },
  planned: { label: 'Planned · not playable', cls: 'border-bone/20 bg-bone/[0.04] text-bone/60' },
}

const ITEMS: { name: string; stage: Stage; text: string }[] = [
  { name: 'Chadverse world', stage: 'built', text: 'Chad Village in 3D: square, gym street, canal and citadel, with a character creator.' },
  { name: 'Parkour & rooftop traversal', stage: 'built', text: 'Climbing, vaulting, ledges and wall running are in the build. Still being tuned and rough in places.' },
  { name: 'Bike riding', stage: 'built', text: 'Ride dirt bikes around Chad Rides. Handling is still being refined.' },
  { name: 'Bike racing & stunt challenges', stage: 'dev', text: 'Stunt practice and judging exist in early form; races and challenges are not open.' },
  { name: 'Pump Arcade', stage: 'dev', text: 'The building stands on Arcade Street, but it is not open yet.' },
  { name: 'Mountain Madness', stage: 'planned', text: 'Mountain course challenge. Planned.' },
  { name: 'Chad Mayhem', stage: 'planned', text: 'Chaos game mode. Planned.' },
  { name: 'Chad Demolition', stage: 'planned', text: 'Destruction game mode. Planned.' },
  { name: 'Underground Fight Club', stage: 'planned', text: 'Arena brawling. Planned.' },
  { name: 'Multiplayer', stage: 'planned', text: 'An ambition, not a promise: nothing multiplayer is built yet.' },
  { name: 'Community competitions & rewards', stage: 'planned', text: 'No competition or reward programme is live. Rules will be announced on official channels first.' },
]

export function GameStatus() {
  return (
    <section id="game-status" aria-labelledby="game-title" className="relative py-20 md:py-28">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <SectionLabel n="07b">Chadverse game status</SectionLabel>
        <h2 id="game-title" className="mt-6 font-display text-[clamp(2.5rem,10vw,6rem)] uppercase leading-[0.92]">
          What’s built, <span className="text-molten">what’s coming</span>
        </h2>
        <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-bone/65">
          The Chadverse is an early build, not a finished game. Nothing here is open to the public yet: green means it exists in the private build, the rest is still in development or only planned. Game features do not promise any token utility or reward.
        </p>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ITEMS.map((it, i) => (
            <Reveal key={it.name} delay={(i % 3) * 0.05} className="rounded-[20px] border border-bone/10 bg-coal p-5">
              <span className={`inline-block rounded-full border px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] ${STAGE[it.stage].cls}`}>{STAGE[it.stage].label}</span>
              <h3 className="mt-3 font-display text-2xl uppercase leading-none">{it.name}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-bone/65">{it.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
