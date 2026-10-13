import { m } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { ACHIEVEMENTS, levelFor, xpForLevel, type SaveData, type Settings } from '../save'
import { STATIONS, type StationId } from '../workout'
import { judge, markerAt, type Grade, type RepSpec } from '../chadpress'
import { fatigueMult, rollDaily, statLevel } from '../progression'
import { SPECIES } from '../character/types'
import { Btn, Icon, Label, Segmented, Slider, Toggle } from './kit'

const WEBSITE = import.meta.env.BASE_URL

export function PauseMenu({
  save,
  onResume,
  onEditCharacter,
  onSettings,
  onAchievements,
  onProfile,
}: {
  save: SaveData
  onResume: () => void
  onEditCharacter: () => void
  onSettings: () => void
  onAchievements: () => void
  onProfile: () => void
}) {
  useEsc(onResume)
  const got = save.progress.achievements.length
  return (
    <Overlay label="Paused">
      <Label className="text-moon/80">Paused</Label>
      <h2 className="mt-1 font-display text-5xl uppercase leading-none">
        Take a <span className="text-molten">breather</span>
      </h2>
      <p className="mt-2 text-[14px] text-bone/60">Your progress saves automatically on this device.</p>
      <div className="mt-6 grid gap-2.5">
        <Btn size="lg" onClick={onResume} sound="confirm">
          Resume
        </Btn>
        <Btn variant="ghost" onClick={onProfile} data-testid="pause-profile">
          Profile &amp; stats
        </Btn>
        <Btn variant="ghost" onClick={onAchievements}>
          Achievements · {got}/{Object.keys(ACHIEVEMENTS).length}
        </Btn>
        <Btn variant="ghost" onClick={onEditCharacter}>
          Wardrobe — edit character
        </Btn>
        <Btn variant="ghost" onClick={onSettings}>
          Settings
        </Btn>
        <a href={WEBSITE} className="btn-ghost inline-flex min-h-12 items-center justify-center rounded-full px-6 text-[15px] font-semibold uppercase tracking-[0.1em] text-bone">
          Return to website
        </a>
      </div>
    </Overlay>
  )
}

/** Player profile: level, stats, workout totals, records. All local and cosmetic. */
export function ProfileMenu({ save, onBack }: { save: SaveData; onBack: () => void }) {
  useEsc(onBack)
  const p = save.progress
  const lvl = levelFor(p.xp)
  const lo = xpForLevel(lvl)
  const hi = xpForLevel(lvl + 1)
  const pct = Math.round(((p.xp - lo) / (hi - lo)) * 100)
  const daily = rollDaily(p.daily)
  const totalReps = Object.values(p.reps).reduce((a, b) => a + b, 0)
  const seeds = p.discoveries.filter((d) => d.startsWith('seed_')).length
  const species = SPECIES.find((s) => s.id === save.character?.appearance.species)?.name ?? 'Chad'
  const stat = (label: string, pts: number) => {
    const l = statLevel(pts)
    const a = 20 * (l - 1) ** 2
    const b = 20 * l ** 2
    return (
      <div className="rounded-2xl bg-bone/[0.04] p-3 ring-1 ring-bone/10">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">{label}</p>
        <p className="font-display text-3xl leading-none">
          Lv {l} <span className="font-mono text-[11px] text-bone/50">{pts} pts</span>
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bone/10">
          <div className="h-full rounded-full bg-[linear-gradient(90deg,#f6c870,#ff7a1a)]" style={{ width: `${Math.round(((pts - a) / (b - a)) * 100)}%` }} />
        </div>
      </div>
    )
  }
  return (
    <Overlay label="Profile">
      <Header title="Profile" onBack={onBack} />
      <div className="mt-3 flex items-center gap-3" data-testid="profile">
        <div className="flex h-14 w-14 flex-col items-center justify-center rounded-2xl bg-[linear-gradient(160deg,#ff9a3c,#c2540c)] text-ink">
          <span className="font-mono text-[9px] font-semibold leading-none">LVL</span>
          <span className="font-display text-2xl leading-none" data-testid="profile-level">{lvl}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-2xl uppercase leading-tight">{save.character?.name}</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
            {species} · {p.xp} XP · {hi - p.xp} to level {lvl + 1}
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bone/10">
            <div className="h-full rounded-full bg-[linear-gradient(90deg,#f6c870,#ff7a1a)]" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {stat('Strength', p.strength)}
        {stat('Stamina', p.stamina)}
      </div>
      <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.22em] text-moon">Workouts</p>
      <div className="mt-2 grid grid-cols-4 gap-2 text-center">
        {(
          [
            ['Sets', p.stats.sets],
            ['Reps', totalReps],
            ['Clean', p.stats.clean],
            ['Best combo', p.stats.bestCombo],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="rounded-xl bg-bone/[0.04] py-2 ring-1 ring-bone/10">
            <p className="font-display text-xl">{v}</p>
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-ash">{k}</p>
          </div>
        ))}
      </div>
      <ul className="mt-2 grid gap-1">
        {(Object.keys(STATIONS) as StationId[]).map((id) => {
          const m = fatigueMult(daily.sets[id] ?? 0)
          return (
            <li key={id} className="flex items-center justify-between rounded-xl px-3 py-1.5 text-[13px] odd:bg-bone/[0.03]">
              <span>{STATIONS[id].name}</span>
              <span className="font-mono text-[11px] text-bone/60">
                {p.reps[id] ?? 0} reps · <span className={m < 1 ? 'text-alarm' : 'text-moon'}>{m < 1 ? `${Math.round(m * 100)}% today` : 'fresh'}</span>
              </span>
            </li>
          )
        })}
      </ul>
      <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.22em] text-moon">Records &amp; exploring</p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[13px]">
        <Row k="Chad Press best" v={p.gymBest ? String(p.gymBest) : '—'} />
        <Row k="Pumpkin Rush best" v={p.records.pumpkin_rush ? String(p.records.pumpkin_rush) : '—'} />
        <Row k="Golden seeds" v={`${seeds}/5`} />
        <Row k="Achievements" v={`${p.achievements.length}/${Object.keys(ACHIEVEMENTS).length}`} />
      </div>
      <p className="mt-4 text-[12px] text-bone/45">Progress lives on this device only. XP, levels and stats are just for fun — no cash value, nothing to withdraw.</p>
    </Overlay>
  )
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-bone/[0.04] px-3 py-2 ring-1 ring-bone/10">
      <span className="text-bone/70">{k}</span>
      <span className="font-display text-lg">{v}</span>
    </div>
  )
}

/**
 * The Chad Square notice board: what you can actually do here today (with live progress), what's coming,
 * and the controls. Only implemented activities are listed as available.
 */
export function NoticeBoardMenu({ save, onBack }: { save: SaveData; onBack: () => void }) {
  useEsc(onBack)
  const p = save.progress
  const seeds = p.discoveries.filter((d) => d.startsWith('seed_')).length
  const gourds = p.discoveries.filter((d) => d.startsWith('gourd_')).length
  const steps = ['visit_square', 'visit_gym', 'visit_arcade', 'visit_citadel', 'visit_rides'].filter((k) => p.discoveries.includes(k)).length
  const hidden = p.discoveries.filter((d) => d.startsWith('hp_')).length
  const now: [string, string, string][] = [
    ['Discover Chad City', 'Square · gym · east street · citadel · rides', `${steps}/5 found`],
    ['Pump Gym', 'East of Chad Square · 7 stations + Chad Press', `${Object.values(p.reps).reduce((a, b) => a + b, 0)} reps logged`],
    ['Pumpkin Rush', 'The pumpkin cart in Chad Square · 45 s sprint', p.records.pumpkin_rush ? `best ${p.records.pumpkin_rush}` : 'not played yet'],
    ['Chad View', 'West, past the garden · the best view in the city', p.discoveries.includes('overlook') ? 'visited' : 'unvisited'],
    ['Hidden pumpkins', 'Six of them, in fair spots around the city', `${hidden}/6 found`],
    ['Golden seeds', 'Hidden in alleys and dead ends', `${seeds}/5 found`],
    ['Talking pumpkins', 'Some pumpkins have opinions', `${gourds}/3 found`],
    ['Residents', 'Goldie, Coach Gourdon, b4s, Barley, Anvilus, Madame Marrowpot, Mo, Captain Tibia, Pip', 'say hi'],
  ]
  const soon: [string, string][] = [
    ['Chad Citadel', 'The King is doing his sets'],
    ['Pump Arcade', 'Cabinets being polished on Arcade Street'],
    ['Chad Rides', 'Bikes are parked by the valley gate'],
    ['Downtown', 'Down the valley road — closed for now'],
    ['Chad Casino', 'Free-play only, when it opens. No real money, ever.'],
  ]
  return (
    <Overlay label="Notice board">
      <Header title="Notice board" onBack={onBack} />
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-moon">Chad Square · what’s on</p>
      <ul className="mt-3 grid gap-1.5" data-testid="board-now">
        {now.map(([t, d, s]) => (
          <li key={t} className="flex items-center justify-between gap-3 rounded-xl bg-bone/[0.04] px-3 py-2 ring-1 ring-bone/10">
            <span className="min-w-0">
              <span className="block font-display text-lg uppercase leading-tight">{t}</span>
              <span className="block text-[12px] text-bone/60">{d}</span>
            </span>
            <span className="shrink-0 rounded-full bg-moon/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-moon">{s}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-ash">Coming soon</p>
      <ul className="mt-2 grid grid-cols-2 gap-1.5" data-testid="board-soon">
        {soon.map(([t, d]) => (
          <li key={t} className="rounded-xl bg-bone/[0.02] px-3 py-2 ring-1 ring-bone/10">
            <span className="block font-display text-base uppercase leading-tight text-bone/70">{t}</span>
            <span className="block text-[11px] text-bone/45">{d}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-ash">Controls</p>
      <p className="mt-1 text-[13px] text-bone/70">
        WASD / arrows to walk · Shift to sprint · drag to look · E to interact · Space to jump · Q emotes. On phones: stick, Sprint, Jump and GO.
      </p>
    </Overlay>
  )
}

/**
 * Wishing-well coin toss (optional timing challenge): three tosses, stop the swinging marker in the bucket zone.
 * Space / E / click / tap to toss, Escape to leave at any time. Only the first ever bucket shot pays out (one
 * achievement), so it can't be farmed. No money involved: it's a pocket-lint coin.
 */
export const TOSSES = 3
const firstSpec = (): RepSpec => ({ center: 0.3 + Math.random() * 0.4, good: 0.12, perfect: 0.04, speed: 0.7 })
export function WellToss({ onHit, onBack }: { onHit: () => void; onBack: () => void }) {
  useEsc(onBack)
  const [grades, setGrades] = useState<Grade[]>([])
  const [spec, setSpec] = useState<RepSpec>(firstSpec)
  const markerRef = useRef<HTMLDivElement>(null)
  const t0 = useRef(performance.now())
  const pos = useRef(0)
  const locked = useRef(false)
  const done = grades.length >= TOSSES
  useEffect(() => {
    if (done) return
    let raf = 0
    const loop = () => {
      if (!locked.current) pos.current = markerAt((performance.now() - t0.current) / 1000, spec.speed)
      if (markerRef.current) markerRef.current.style.left = `${pos.current * 100}%`
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [spec, done])
  const toss = () => {
    if (done || locked.current) return
    locked.current = true
    const g = judge(pos.current, spec)
    setGrades((gs) => [...gs, g])
    if (g !== 'miss') onHit()
    // a short beat so the result reads, then the next toss (faster, narrower)
    setTimeout(() => {
      locked.current = false
      t0.current = performance.now()
      setSpec((sp) => ({ center: 0.25 + Math.random() * 0.5, good: Math.max(0.07, sp.good - 0.02), perfect: Math.max(0.025, sp.perfect - 0.005), speed: sp.speed + 0.18 }))
    }, 650)
  }
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.key === ' ' || e.key === 'e' || e.key === 'E' || e.key === 'Enter') {
        e.preventDefault()
        toss()
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })
  const last = grades[grades.length - 1]
  const hits = grades.filter((g) => g !== 'miss').length
  const say = (g: Grade) => (g === 'perfect' ? 'Splash! Dead centre.' : g === 'good' ? 'Plink. In the bucket.' : 'Clank. Off the rim.')
  const again = () => {
    setGrades([])
    t0.current = performance.now()
    setSpec(firstSpec())
  }
  return (
    <Overlay label="Wishing well coin toss">
      <Header title="Coin toss" onBack={onBack} />
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-moon">Wishing well · free play · no real money</p>
      <p className="mt-3 text-[13px] text-bone/70">Stop the marker over the bucket. Gold is dead centre. Three coins from your pocket lint.</p>
      <div className="mt-4 rounded-[18px] bg-bone/[0.04] p-4 ring-1 ring-bone/10" onPointerDown={toss}>
        <div className="relative h-12 overflow-hidden rounded-xl bg-ink ring-1 ring-bone/10" data-testid="toss-bar">
          <div className="absolute inset-y-0 bg-pump/35" style={{ left: `${(spec.center - spec.good) * 100}%`, width: `${spec.good * 200}%` }} />
          <div className="absolute inset-y-0 bg-[linear-gradient(180deg,#fff3cf,#e8b84a)] shadow-[0_0_20px_rgba(246,200,112,0.8)]" style={{ left: `${(spec.center - spec.perfect) * 100}%`, width: `${spec.perfect * 200}%` }} />
          <div ref={markerRef} className="absolute inset-y-1 w-1.5 -translate-x-1/2 rounded-full bg-bone shadow-[0_0_12px_#fff]" style={{ left: '0%' }} />
        </div>
        <p className="mt-3 min-h-6 text-center font-display text-xl uppercase text-moon" aria-live="polite" data-testid="toss-result">
          {last ? say(last) : `Coin 1 of ${TOSSES}`}
        </p>
      </div>
      {done ? (
        <div className="mt-4" data-testid="toss-final">
          <p className="text-center font-display text-3xl uppercase">
            {hits}/{TOSSES} in the bucket
          </p>
          <div className="mt-3 flex gap-2">
            <Btn className="flex-1" onClick={again} data-testid="toss-again">
              Toss again
            </Btn>
            <Btn variant="ghost" className="flex-1" onClick={onBack}>
              Done
            </Btn>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation()
            toss()
          }}
          className="btn-primary mt-4 flex min-h-16 w-full items-center justify-center rounded-2xl font-display text-3xl uppercase tracking-wider"
          data-testid="toss-button"
        >
          Toss
        </button>
      )}
      <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-ash">Space / E / tap to toss · Esc to leave</p>
    </Overlay>
  )
}

export function AchievementsMenu({ save, onBack }: { save: SaveData; onBack: () => void }) {
  useEsc(onBack)
  return (
    <Overlay label="Achievements">
      <Header title="Achievements" onBack={onBack} />
      <ul className="mt-4 grid gap-2">
        {Object.entries(ACHIEVEMENTS).map(([id, a]) => {
          const got = save.progress.achievements.includes(id)
          return (
            <li key={id} className={`flex items-center gap-3 rounded-2xl p-3 ring-1 ${got ? 'bg-moon/[0.07] ring-moon/30' : 'bg-bone/[0.02] ring-bone/10'}`}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${got ? 'bg-[linear-gradient(160deg,#fff3cf,#e8b84a_45%,#9a6a22)] text-ink' : 'bg-bone/[0.06] text-bone/30'}`}>
                <Icon.trophy />
              </span>
              <span className="min-w-0">
                <span className={`block font-display text-lg uppercase leading-tight ${got ? '' : 'text-bone/50'}`}>{got ? a.name : '???'}</span>
                <span className="block text-[13px] text-bone/55">{got ? a.desc : 'Keep exploring Chad Square.'}</span>
              </span>
              <span className={`ml-auto font-mono text-[10px] uppercase tracking-[0.2em] ${got ? 'text-moon' : 'text-bone/30'}`}>{got ? 'Unlocked' : 'Locked'}</span>
            </li>
          )
        })}
      </ul>
    </Overlay>
  )
}

export function SettingsMenu({
  settings,
  onChange,
  onBack,
  onResetProgress,
}: {
  settings: Settings
  onChange: (s: Partial<Settings>) => void
  onBack: () => void
  onResetProgress: () => void
}) {
  useEsc(onBack)
  const [confirmReset, setConfirmReset] = useState(false)
  const pct = (v: number) => `${Math.round(v * 100)}%`
  return (
    <Overlay label="Settings">
      <Header title="Settings" onBack={onBack} />
      <div className="mt-4 space-y-6">
        <section className="space-y-4">
          <Label>Graphics</Label>
          <Segmented
            label="Quality"
            value={settings.quality}
            options={[
              { id: 'low', name: 'Low' },
              { id: 'medium', name: 'Medium' },
              { id: 'high', name: 'High' },
            ]}
            onChange={(v) => onChange({ quality: v })}
          />
          <Toggle label="Reduced effects" hint="Turns off glow bloom and slows ambient motion" checked={settings.reducedEffects} onChange={(v) => onChange({ reducedEffects: v })} />
          <Slider label="Interface size" value={settings.uiScale} min={0.85} max={1.25} step={0.05} onChange={(v) => onChange({ uiScale: v })} format={pct} />
        </section>
        <section className="space-y-4">
          <Label>Audio</Label>
          <Toggle label="Mute all" checked={settings.muted} onChange={(v) => onChange({ muted: v })} />
          <Slider label="Effects volume" value={settings.sfx} min={0} max={1} step={0.05} onChange={(v) => onChange({ sfx: v })} format={pct} />
          <Slider label="Ambience volume" value={settings.ambience} min={0} max={1} step={0.05} onChange={(v) => onChange({ ambience: v })} format={pct} />
          <p className="text-[12px] text-ash">All sound is generated live in your browser. There is no background music track yet.</p>
        </section>
        <section className="space-y-4">
          <Label>Controls</Label>
          <Slider label="Camera sensitivity" value={settings.cameraSensitivity} min={0.3} max={2} step={0.1} onChange={(v) => onChange({ cameraSensitivity: v })} format={(v) => `${v.toFixed(1)}×`} />
          <Slider label="Joystick sensitivity" value={settings.stickSensitivity} min={0.5} max={1.5} step={0.1} onChange={(v) => onChange({ stickSensitivity: v })} format={(v) => `${v.toFixed(1)}×`} />
        </section>
        <section className="space-y-3 border-t border-bone/10 pt-5">
          {confirmReset ? (
            <div className="rounded-2xl bg-alarm/10 p-4 ring-1 ring-alarm/30">
              <p className="text-[14px]">Delete your character and all progress on this device?</p>
              <div className="mt-3 flex gap-2">
                <Btn size="sm" className="!bg-alarm !bg-none" onClick={onResetProgress}>
                  Delete everything
                </Btn>
                <Btn size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>
                  Cancel
                </Btn>
              </div>
            </div>
          ) : (
            <Btn variant="ghost" size="sm" onClick={() => setConfirmReset(true)}>
              Reset progress
            </Btn>
          )}
          <a href={WEBSITE} className="block text-[14px] font-semibold text-pump underline-offset-4 hover:underline">
            Return to the Pumpchad website →
          </a>
        </section>
      </div>
    </Overlay>
  )
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="font-display text-4xl uppercase leading-none">{title}</h2>
      <button type="button" onClick={onBack} aria-label="Back" className="btn-ghost flex h-11 w-11 items-center justify-center rounded-full">
        <Icon.close />
      </button>
    </div>
  )
}

function Overlay({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <m.div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="pointer-events-auto absolute inset-0 z-40 flex items-end justify-center bg-ink/60 backdrop-blur-sm sm:items-center"
    >
      <m.div
        initial={{ y: 30, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 20 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="panel scrollbar-none max-h-[92svh] w-full max-w-md overflow-y-auto rounded-t-[28px] p-6 safe-b sm:rounded-[28px]"
      >
        {children}
      </m.div>
    </m.div>
  )
}

function useEsc(fn: () => void) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && fn()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [fn])
}
