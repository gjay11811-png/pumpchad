import { m } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { GLOWS, OUTFITS, SPECIES, SPECIES_OPTIONS, defaultAppearance, normaliseForSpecies, randomAppearance, type Appearance, type Species } from '../character/types'
import { validateName } from '../save'
import type { PreviewPose, Showroom } from '../scenes/Showroom'
import { audio } from '../audio'
import { Btn, Icon, Label, Segmented, Toggle } from './kit'

type Tab = 'look' | 'outfit' | 'gear' | 'name'
const TABS: { id: Tab; name: string }[] = [
  { id: 'look', name: 'Look' },
  { id: 'outfit', name: 'Outfit' },
  { id: 'gear', name: 'Gear' },
  { id: 'name', name: 'Name' },
]
const POSES: { id: PreviewPose; name: string }[] = [
  { id: 'idle', name: 'Idle' },
  { id: 'walk', name: 'Walk' },
  { id: 'flex', name: 'Flex' },
  { id: 'dance', name: 'Dance' },
  { id: 'wave', name: 'Wave' },
]
/** Upgraded species use real rigged models; the rest are clearly labelled prototypes. */
const MODEL_STATUS: Record<Species, 'new' | 'prototype'> = { pumpkin: 'new', skeleton: 'new', demon: 'new' }
const COMING = ['Bear', 'Wolf', 'Alien', 'Cyborg', 'Ghost']

function useIsDesktop() {
  const q = '(min-width: 1024px) and (min-height: 600px)'
  const [d, setD] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const on = () => setD(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return d
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
  const [a, setA] = useState<Appearance>(() => normaliseForSpecies(initial ?? defaultAppearance('pumpkin')))
  const [name, setName] = useState(initialName)
  const [tab, setTab] = useState<Tab>('look')
  const [pose, setPose] = useState<PreviewPose>('idle')
  const [touched, setTouched] = useState(false)
  const nameCheck = useMemo(() => validateName(name), [name])
  const desktop = useIsDesktop()
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void showroom.setAppearance(a)
  }, [a, showroom])
  useEffect(() => {
    showroom.previewPose = pose
  }, [pose, showroom])

  // tell the 3D stage which parts of the screen the UI covers
  useEffect(() => {
    if (desktop) {
      showroom.setInsets({ left: 300, right: 430, bottom: 96, top: 70 })
      return
    }
    const el = sheetRef.current
    if (!el) return
    const ro = new ResizeObserver(() => showroom.setInsets({ left: 0, right: 0, top: 64, bottom: el.getBoundingClientRect().height + 12 }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [desktop, showroom])

  const update = (patch: Partial<Appearance>) => setA((prev) => ({ ...prev, ...patch }))
  const pickSpecies = (id: Species) => {
    if (id === a.species) return
    audio.play('select')
    setA(defaultAppearance(id))
    showroom.flex()
  }
  const sp = SPECIES.find((s) => s.id === a.species)!
  const opts = SPECIES_OPTIONS[a.species]

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

  const equipped = [
    opts.tops.find((t) => t.id === a.top)?.name,
    a.headwear !== 'none' || a.species === 'skeleton' ? opts.headwear.find((t) => t.id === a.headwear)?.name : null,
    a.eyewear !== 'none' ? opts.eyewear.find((t) => t.id === a.eyewear)?.name : null,
    a.chain ? 'Gold chain' : null,
  ].filter(Boolean) as string[]

  const tabBody = (
    <>
      {tab === 'look' && (
        <div className="space-y-6">
          <Swatches label={a.species === 'skeleton' ? 'Bone' : a.species === 'pumpkin' ? 'Pumpkin skin' : 'Skin'} colors={sp.skins} value={a.skin} onPick={(c) => update({ skin: c })} />
          <Swatches label="Glow" hint={({ pumpkin: 'Carved face, eyes and visor', skeleton: 'Eye sockets and visor', demon: 'Eyes, skin veins and visor' } as Record<string, string>)[a.species] ?? 'Eyes and visor'} colors={GLOWS} value={a.glow} onPick={(c) => update({ glow: c })} glow />
        </div>
      )}
      {tab === 'outfit' && (
        <div className="space-y-6">
          <Segmented label="Top" value={a.top} options={opts.tops} onChange={(v) => update({ top: v })} />
          <Swatches label={a.top === 'shirtless' ? 'Shorts colour' : a.species === 'skeleton' ? 'Gear colour' : 'Outfit colour'} colors={OUTFITS} value={a.outfit} onPick={(c) => update({ outfit: c })} />
        </div>
      )}
      {tab === 'gear' && (
        <div className="space-y-5">
          <Segmented label="Headwear" value={a.headwear} options={opts.headwear} onChange={(v) => update({ headwear: v })} />
          <Segmented label="Eyewear" value={a.eyewear} options={opts.eyewear} onChange={(v) => update({ eyewear: v })} />
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
    </>
  )

  const tabsBar = (
    <div role="tablist" aria-label="Customise" className="grid grid-cols-4 gap-1 p-1.5">
      {TABS.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={tab === t.id}
          onClick={() => {
            audio.play('click')
            setTab(t.id)
          }}
          className={`relative min-h-11 rounded-xl text-[12px] font-semibold uppercase tracking-[0.14em] transition-colors ${tab === t.id ? 'bg-bone/[0.08] text-bone' : 'text-bone/50 hover:text-bone/80'}`}
        >
          {t.name}
          {t.id === 'name' && touched && !nameCheck.ok && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-alarm" aria-label="needs attention" />}
        </button>
      ))}
    </div>
  )

  const cta = (
    <div className="flex gap-2">
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
  )

  const poseBar = (
    <div className="pointer-events-auto flex items-center gap-1.5">
      <button type="button" aria-label="Rotate left" onClick={() => showroom.rotateBy(-1)} className="panel hidden h-10 w-10 items-center justify-center rounded-full active:scale-95 lg:flex">
        <Icon.rotateL className="h-4 w-4" />
      </button>
      <div role="radiogroup" aria-label="Preview animation" className="panel flex rounded-full p-1">
        {POSES.map((p) => (
          <button
            key={p.id}
            role="radio"
            aria-checked={pose === p.id}
            onClick={() => {
              audio.play('select')
              setPose(p.id)
            }}
            className={`min-h-8 rounded-full px-3 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${pose === p.id ? 'bg-pump text-ink' : 'text-bone/70 hover:text-bone'}`}
          >
            {p.name}
          </button>
        ))}
      </div>
      <button type="button" aria-label="Rotate right" onClick={() => showroom.rotateBy(1)} className="panel hidden h-10 w-10 items-center justify-center rounded-full active:scale-95 lg:flex">
        <Icon.rotateR className="h-4 w-4" />
      </button>
      <div className="panel ml-1 flex rounded-full p-1">
        <button type="button" aria-label="Zoom out" onClick={() => showroom.zoomBy(-0.5)} className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-bone/80 hover:text-bone">
          −
        </button>
        <button type="button" aria-label="Zoom in" onClick={() => showroom.zoomBy(0.5)} className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-bone/80 hover:text-bone">
          +
        </button>
      </div>
    </div>
  )

  const speciesBadge = (s: Species) =>
    MODEL_STATUS[s] === 'new' ? (
      <span className="rounded-full bg-moon/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-moon">New model</span>
    ) : (
      <span className="rounded-full bg-bone/[0.06] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-bone/45">Prototype</span>
    )

  const title = (
    <m.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Label className="text-moon/80">{editing ? 'Wardrobe' : 'Character select'}</Label>
      <h1 className="font-display text-[clamp(1.7rem,6vw,3rem)] uppercase leading-[0.95]">
        {editing ? 'Edit your' : 'Create your'} <span className="text-molten">chad</span>
      </h1>
    </m.div>
  )

  /* ─────────── desktop: species left · preview centre · options right ─────────── */
  if (desktop)
    return (
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 pt-5 text-center">{title}</div>

        <m.aside initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.5, delay: 0.05 }} className="panel pointer-events-auto absolute bottom-5 left-5 top-5 flex w-[270px] flex-col rounded-[26px] p-4" aria-label="Species">
          <Label>Species</Label>
          <div role="radiogroup" aria-label="Species" className="mt-3 grid gap-2">
            {SPECIES.map((s) => {
              const on = s.id === a.species
              return (
                <button
                  key={s.id}
                  role="radio"
                  aria-checked={on}
                  aria-label={s.name}
                  onClick={() => pickSpecies(s.id)}
                  className={`rounded-2xl p-3.5 text-left ring-1 transition-[box-shadow,background-color] duration-200 ${on ? 'bg-pump/[0.1] ring-pump/70 shadow-[0_0_30px_-10px_rgba(255,122,26,0.7)]' : 'bg-bone/[0.03] ring-bone/10 hover:bg-bone/[0.06]'}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-display text-xl uppercase tracking-wide">{s.name}</span>
                    {speciesBadge(s.id)}
                  </span>
                  <span className="mt-1 block text-[12px] leading-snug text-bone/60">{s.tagline}</span>
                </button>
              )
            })}
          </div>
          <Label className="mt-6">Coming soon</Label>
          <ul className="mt-2 grid grid-cols-2 gap-1.5">
            {COMING.map((c) => (
              <li key={c} className="flex items-center gap-2 rounded-xl bg-bone/[0.02] px-3 py-2 text-[12px] text-bone/35 ring-1 ring-bone/[0.06]" aria-disabled="true">
                <span aria-hidden="true">🔒</span>
                {c}
              </li>
            ))}
          </ul>
        </m.aside>

        <div className="absolute bottom-6 left-[300px] right-[430px] flex justify-center">{poseBar}</div>

        <m.section initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.5, delay: 0.1 }} aria-label="Character options" className="panel pointer-events-auto absolute bottom-5 right-5 top-5 flex w-[400px] flex-col rounded-[26px]">
          <div className="border-b border-bone/[0.07] px-5 pb-3 pt-4">
            <Label>Equipped</Label>
            <div className="mt-2 flex flex-wrap gap-1.5" data-testid="equipped">
              {equipped.map((e) => (
                <span key={e} className="rounded-full bg-bone/[0.06] px-2.5 py-1 text-[12px] text-bone/80 ring-1 ring-bone/10">
                  {e}
                </span>
              ))}
            </div>
          </div>
          <div className="border-b border-bone/[0.07]">{tabsBar}</div>
          <div className="scrollbar-none flex-1 overflow-y-auto px-5 py-5">{tabBody}</div>
          <div className="border-t border-bone/[0.07] p-4">{cta}</div>
        </m.section>
      </div>
    )

  /* ─────────── mobile: big preview · species strip · bottom sheet ─────────── */
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col">
      <div className="safe-t safe-x pt-1">{title}</div>
      <div className="flex-1" />
      <div ref={sheetRef} className="pointer-events-none">
        <div className="mb-2 flex justify-center safe-x">{poseBar}</div>
        <div role="radiogroup" aria-label="Species" className="scrollbar-none pointer-events-auto flex gap-2 overflow-x-auto px-3 pb-2">
          {SPECIES.map((s) => {
            const on = s.id === a.species
            return (
              <button
                key={s.id}
                role="radio"
                aria-checked={on}
                aria-label={s.name}
                onClick={() => pickSpecies(s.id)}
                className={`panel flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 ${on ? '!border-pump/70 bg-pump/[0.12]' : ''}`}
              >
                <span className="font-display text-lg uppercase tracking-wide">{s.name}</span>
                {speciesBadge(s.id)}
              </button>
            )
          })}
          {COMING.map((c) => (
            <span key={c} aria-disabled="true" className="flex shrink-0 items-center gap-1.5 rounded-2xl border border-bone/[0.06] px-3 py-2.5 text-[12px] text-bone/30">
              🔒 {c}
            </span>
          ))}
        </div>
        <m.section
          aria-label="Character options"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="panel pointer-events-auto flex max-h-[42svh] flex-col rounded-t-[28px]"
        >
          <div className="border-b border-bone/[0.07]">{tabsBar}</div>
          <div className="scrollbar-none flex-1 overflow-y-auto overscroll-contain px-4 py-4">{tabBody}</div>
          <div className="border-t border-bone/[0.07] p-3 safe-b">{cta}</div>
        </m.section>
      </div>
    </div>
  )
}

function Swatches({ label, hint, colors, value, onPick, glow }: { label: string; hint?: string; colors: string[]; value: string; onPick: (c: string) => void; glow?: boolean }) {
  return (
    <div>
      <Label>{label}</Label>
      {hint && <p className="mt-1 text-[12px] text-bone/45">{hint}</p>}
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
