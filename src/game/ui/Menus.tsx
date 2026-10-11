import { m } from 'framer-motion'
import { useEffect, useState } from 'react'
import { ACHIEVEMENTS, type SaveData, type Settings } from '../save'
import { Btn, Icon, Label, Segmented, Slider, Toggle } from './kit'

const WEBSITE = import.meta.env.BASE_URL

export function PauseMenu({
  save,
  onResume,
  onEditCharacter,
  onSettings,
  onAchievements,
}: {
  save: SaveData
  onResume: () => void
  onEditCharacter: () => void
  onSettings: () => void
  onAchievements: () => void
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
