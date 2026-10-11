import { m } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { EYEWEAR, GLOWS, HEADWEAR, OUTFITS, SPECIES, TOPS, defaultAppearance, randomAppearance, type Appearance, type Species } from '../character/types'
import { validateName } from '../save'
import type { Showroom } from '../scenes/Showroom'
import { audio } from '../audio'
import { Btn, Icon, Label, Segmented, Toggle } from './kit'

type Tab = 'species' | 'look' | 'gear' | 'name'
const TABS: { id: Tab; name: string }[] = [
  { id: 'species', name: 'Species' },
  { id: 'look', name: 'Look' },
  { id: 'gear', name: 'Gear' },
  { id: 'name', name: 'Name' },
]

const SPECIES_BLURB: Record<Species, { stat: string; vibe: string }> = {
  pumpkin: { stat: 'Glow: carved grin', vibe: 'Royal bloodline' },
  skeleton: { stat: 'Glow: eye sockets', vibe: 'Diamond bones' },
  demon: { stat: 'Glow: eyes', vibe: 'Pure heat' },
}

export function Creator({
  showroom,
  initial,
  initialName,
  editing,
  onConfirm,
}: {
  showroom: Showroom
  initial: Appearance | null
  initialName: string
  editing: boolean
  onConfirm: (name: string, a: Appearance) => void
}) {
  const [a, setA] = useState<Appearance>(initial ?? defaultAppearance('pumpkin'))
  const [name, setName] = useState(initialName)
  const [tab, setTab] = useState<Tab>('species')
  const [touched, setTouched] = useState(false)
  const nameCheck = useMemo(() => validateName(name), [name])

  useEffect(() => {
    void showroom.setAppearance(a)
  }, [a, showroom])

  const update = (patch: Partial<Appearance>) => setA((prev) => ({ ...prev, ...patch }))
  const pickSpecies = (id: Species) => {
    if (id === a.species) return
    audio.play('select')
    setA(defaultAppearance(id))
    showroom.flex()
  }
  const sp = SPECIES.find((s) => s.id === a.species)!

  const confirm = () => {
    setTouched(true)
    if (!nameCheck.ok) {
      setTab('name')
      audio.play('miss')
      return
    }
    audio.play('confirm')
    showroom.flex()
    onConfirm(nameCheck.name, a)
  }

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col md:flex-row md:justify-end">
      {/* title block + rotate controls over the stage */}
      <div className="pointer-events-none relative flex flex-1 flex-col justify-between safe-t safe-x pb-3 md:pb-6 md:pl-8">
        <m.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="pt-2">
          <Label className="text-moon/80">{editing ? 'Wardrobe' : 'Step 1 of 1 · Character'}</Label>
          <h1 className="mt-1 font-display text-[clamp(2rem,8vw,3.6rem)] uppercase leading-[0.95]">
            {editing ? 'Edit your' : 'Create your'} <span className="text-molten">chad</span>
          </h1>
        </m.div>
        <div className="pointer-events-auto flex items-center justify-center gap-2 md:justify-start">
          <button type="button" aria-label="Rotate left" onClick={() => showroom.rotateBy(-1)} className="panel flex h-11 w-11 items-center justify-center rounded-full active:scale-95">
            <Icon.rotateL />
          </button>
          <button
            type="button"
            onClick={() => {
              audio.play('select')
              showroom.flex()
            }}
            className="panel flex h-11 items-center gap-2 rounded-full px-5 text-[13px] font-semibold uppercase tracking-[0.12em] active:scale-95"
          >
            <Icon.flex className="h-4 w-4 text-pump" /> Flex
          </button>
          <button type="button" aria-label="Rotate right" onClick={() => showroom.rotateBy(1)} className="panel flex h-11 w-11 items-center justify-center rounded-full active:scale-95">
            <Icon.rotateR />
          </button>
        </div>
      </div>

      {/* customisation panel: bottom sheet on phones, right column on desktop */}
      <m.section
        aria-label="Character options"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        className="panel pointer-events-auto flex max-h-[54svh] flex-col rounded-t-[28px] md:m-5 md:max-h-none md:w-[420px] md:rounded-[28px]"
      >
        <div role="tablist" aria-label="Customise" className="grid grid-cols-4 gap-1 border-b border-bone/[0.07] p-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => {
                audio.play('click')
                setTab(t.id)
              }}
              className={`relative min-h-11 rounded-xl text-[12px] font-semibold uppercase tracking-[0.14em] transition-colors ${tab === t.id ? 'text-bone' : 'text-bone/50 hover:text-bone/80'}`}
            >
              {t.name}
              {tab === t.id && <span className="absolute inset-x-4 bottom-1 h-[2px] rounded-full bg-pump" />}
              {t.id === 'name' && touched && !nameCheck.ok && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-alarm" aria-label="needs attention" />}
            </button>
          ))}
        </div>

        <div className="scrollbar-none flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-5">
          {tab === 'species' && (
            <div className="grid gap-2.5" role="radiogroup" aria-label="Species">
              {SPECIES.map((s) => {
                const on = s.id === a.species
                return (
                  <button
                    key={s.id}
                    role="radio"
                    aria-checked={on}
                    onClick={() => pickSpecies(s.id)}
                    className={`group relative overflow-hidden rounded-2xl p-4 text-left ring-1 transition-[box-shadow,background-color] duration-200 ${on ? 'bg-pump/[0.1] ring-pump/70 shadow-[0_0_30px_-8px_rgba(255,122,26,0.6)]' : 'bg-bone/[0.03] ring-bone/10 hover:bg-bone/[0.06]'}`}
                  >
                    <span className="flex items-baseline justify-between">
                      <span className="font-display text-2xl uppercase tracking-wide">{s.name}</span>
                      <span className={`font-mono text-[10px] uppercase tracking-[0.2em] ${on ? 'text-pump' : 'text-ash'}`}>{on ? 'Selected' : SPECIES_BLURB[s.id].vibe}</span>
                    </span>
                    <span className="mt-1 block text-[13px] leading-snug text-bone/65">{s.tagline}</span>
                    <span className="mt-2 flex gap-1.5">
                      {s.skins.slice(0, 5).map((c) => (
                        <span key={c} className="h-3 w-3 rounded-full ring-1 ring-black/40" style={{ background: c }} />
                      ))}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {tab === 'look' && (
            <div className="space-y-6">
              <Swatches label={a.species === 'skeleton' ? 'Bone' : 'Skin'} colors={sp.skins} value={a.skin} onPick={(c) => update({ skin: c })} />
              <Swatches label="Outfit colour" colors={OUTFITS} value={a.outfit} onPick={(c) => update({ outfit: c })} />
              <Swatches label="Glow" colors={GLOWS} value={a.glow} onPick={(c) => update({ glow: c })} glow />
            </div>
          )}

          {tab === 'gear' && (
            <div className="space-y-5">
              <Segmented label="Top" value={a.top} options={TOPS} onChange={(v) => update({ top: v })} />
              <Segmented label="Headwear" value={a.headwear} options={HEADWEAR} onChange={(v) => update({ headwear: v })} />
              <Segmented label="Eyewear" value={a.eyewear} options={EYEWEAR} onChange={(v) => update({ eyewear: v })} />
              <Toggle label="Gold chain" hint="The signature PUMP CHAD piece" checked={a.chain} onChange={(v) => update({ chain: v })} />
            </div>
          )}

          {tab === 'name' && (
            <div>
              <label htmlFor="chad-name" className="text-[14px] font-medium">
                Your name in the Chadverse
              </label>
              <input
                id="chad-name"
                value={name}
                maxLength={16}
                autoComplete="off"
                autoCapitalize="words"
                spellCheck={false}
                enterKeyHint="done"
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setTouched(true)}
                onKeyDown={(e) => e.key === 'Enter' && confirm()}
                placeholder="e.g. Gigagourd"
                aria-invalid={touched && !nameCheck.ok}
                aria-describedby="name-help"
                className="mt-2 w-full rounded-2xl border border-bone/15 bg-ink/70 px-4 py-3.5 font-display text-2xl uppercase tracking-wide text-bone placeholder:text-bone/25 focus:border-pump focus:outline-none"
              />
              <p id="name-help" className={`mt-2 text-[13px] ${touched && !nameCheck.ok ? 'text-alarm' : 'text-ash'}`}>
                {touched && !nameCheck.ok ? nameCheck.error : '3–16 characters. Saved on this device only.'}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-bone/[0.07] p-3 safe-b md:p-4">
          <Btn
            variant="ghost"
            className="!px-4"
            aria-label="Randomise character"
            sound="select"
            onClick={() => {
              setA(randomAppearance())
              showroom.flex()
            }}
          >
            <Icon.dice />
          </Btn>
          <Btn className="flex-1" onClick={confirm} sound={null}>
            {editing ? 'Save & return' : 'Enter Chad Square'}
          </Btn>
        </div>
      </m.section>
    </div>
  )
}

function Swatches({ label, colors, value, onPick, glow }: { label: string; colors: string[]; value: string; onPick: (c: string) => void; glow?: boolean }) {
  return (
    <div>
      <Label>{label}</Label>
      <div role="radiogroup" aria-label={label} className="mt-2.5 flex flex-wrap gap-2.5">
        {colors.map((c) => {
          const on = c.toLowerCase() === value.toLowerCase()
          return (
            <button
              key={c}
              role="radio"
              aria-checked={on}
              aria-label={`${label} ${c}`}
              onClick={() => {
                audio.play('select')
                onPick(c)
              }}
              className={`relative h-11 w-11 rounded-full ring-2 transition-transform duration-150 active:scale-90 ${on ? 'scale-110 ring-bone' : 'ring-bone/10 hover:ring-bone/40'}`}
              style={{ background: c, boxShadow: glow ? `0 0 18px ${c}88` : undefined }}
            >
              {on && <span className="absolute inset-0 m-auto h-2 w-2 rounded-full bg-ink/70 ring-2 ring-bone" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
