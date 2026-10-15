import { m } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { GLOWS, OUTFITS, SPECIES, SPECIES_OPTIONS, defaultAppearance, normaliseForSpecies, randomAppearance, type Appearance, type Species } from '../character/types'
import { CATALOG } from '../economy'
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
  owned = [],
}: {
  showroom: Showroom
  initial: Appearance | null
  initialName: string
  editing: boolean
  onConfirm: (name: string, a: Appearance) => void
  /** catalogue items bought at Chad Fits: their colours join the swatches */
  owned?: string[]
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
  // a phone gets a closer frame so the figure reads at a glance (the desktop stage keeps the full-body view)
  useEffect(() => {
    showroom.zoom = desktop ? 0 : 0.32
  }, [desktop, showroom])

  // tell the 3D stage which parts of the screen the UI covers
  useEffect(() => {
    if (desktop) {
      showroom.setInsets({ left: 40, right: 470, bottom: 100, top: 90 })
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
  const cycle = (d: 1 | -1) => {
    const i = SPECIES.findIndex((s) => s.id === a.species)
    pickSpecies(SPECIES[(i + d + SPECIES.length) % SPECIES.length].id)
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
          <Swatches label="Glow" hint={({ pumpkin: 'Carved face, eyes and visor', skeleton: 'Eye sockets and visor', demon: 'Eyes, skin veins and visor' } as Record<string, string>)[a.species] ?? 'Eyes and visor'} colors={[...GLOWS, ...CATALOG.filter((i) => i.kind === 'glow' && owned.includes(i.id)).map((i) => i.color)]} value={a.glow} onPick={(c) => update({ glow: c })} glow />
        </div>
      )}
      {tab === 'outfit' && (
        <div className="space-y-6">
          <Segmented label="Top" value={a.top} options={opts.tops} onChange={(v) => update({ top: v })} />
          <Swatches label={a.top === 'shirtless' ? 'Shorts colour' : a.species === 'skeleton' ? 'Gear colour' : 'Outfit colour'} colors={[...OUTFITS, ...CATALOG.filter((i) => i.kind === 'outfit' && owned.includes(i.id)).map((i) => i.color)]} value={a.outfit} onPick={(c) => update({ outfit: c })} />
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
      <button
        type="button"
        onClick={confirm}
        data-testid="enter-world"
        className="group relative flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#ffe08a] via-[#f2b13a] to-[#d9861a] px-6 font-display text-lg uppercase tracking-wide text-[#1a1008] shadow-[0_0_30px_-6px_rgba(255,190,70,0.85),inset_0_1px_0_rgba(255,255,255,0.55)] transition-transform duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60"
      >
        {editing ? 'Save & return' : 'Enter Chad Square'}
        <span aria-hidden className="text-xl transition-transform group-hover:translate-x-1">›</span>
      </button>
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

  const title = (
    <m.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <p className="bg-gradient-to-b from-[#ffe9a8] to-[#d9a03a] bg-clip-text font-display text-[clamp(1rem,3.4vw,1.6rem)] uppercase tracking-[0.14em] text-transparent">PumpChad</p>
      <h1 className="font-display text-[clamp(1.7rem,7vw,3.4rem)] uppercase leading-[0.95]">
        {editing ? 'Edit your' : 'Choose your'} <span className="bg-gradient-to-b from-[#ffe08a] to-[#e8941e] bg-clip-text text-transparent">chad</span>
      </h1>
    </m.div>
  )

  /** the three playable species as portrait cards (live-model portraits), a radio group with arrow-key cycling and a visible focus ring */
  const speciesCards = (compact: boolean) => (
    <div
      role="radiogroup"
      aria-label="Species"
      className="grid grid-cols-3 gap-2"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') (e.preventDefault(), cycle(1))
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') (e.preventDefault(), cycle(-1))
      }}
    >
      {SPECIES.map((s) => {
        const on = s.id === a.species
        return (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={s.name}
            tabIndex={on ? 0 : -1}
            onClick={() => pickSpecies(s.id)}
            data-testid={`species-${s.id}`}
            className={`group relative overflow-hidden rounded-2xl text-center ring-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/70 ${on ? 'scale-[1.02] bg-[#2a1c0a] ring-[#ffcf5a] shadow-[0_0_28px_-6px_rgba(255,190,70,0.9)]' : 'bg-ink/60 ring-bone/15 hover:ring-bone/40'}`}
          >
            <img src={`${import.meta.env.BASE_URL}chadverse/ui/species-${s.id}.jpg`} alt="" draggable={false} className={`w-full object-cover ${compact ? 'aspect-[4/3]' : 'aspect-[3/3.4]'} ${on ? '' : 'opacity-80 saturate-75 group-hover:opacity-100'}`} loading="eager" />
            <span className={`block bg-gradient-to-t from-ink via-ink/90 to-transparent ${compact ? 'px-1 py-1.5' : 'px-2 pb-2 pt-4'} font-display ${compact ? 'text-sm' : 'text-lg'} uppercase tracking-wide ${on ? 'text-[#ffe08a]' : 'text-bone'}`}>{s.name}</span>
            {on && (
              <span aria-hidden className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#ffcf5a] text-sm font-bold text-ink shadow-[0_0_10px_rgba(255,200,80,0.9)]">
                ✓
              </span>
            )}
          </button>
        )
      })}
    </div>
  )

  /* ─────────── desktop: title + figure on the night-village stage, the selection panel on the right ─────────── */
  if (desktop)
    return (
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-9 top-6">{title}</div>

        {/* previous / next species, either side of the figure */}
        {(['prev', 'next'] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-label={k === 'prev' ? 'Previous species' : 'Next species'}
            onClick={() => cycle(k === 'prev' ? -1 : 1)}
            className="pointer-events-auto absolute top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#d9a03a]/70 bg-ink/70 text-2xl text-[#ffe08a] backdrop-blur-sm transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/70"
            style={{ left: k === 'prev' ? 'calc(40px + (100% - 510px) / 2 - 230px)' : 'calc(40px + (100% - 510px) / 2 + 190px)' }}
          >
            {k === 'prev' ? '‹' : '›'}
          </button>
        ))}

        <div className="absolute bottom-6 left-[40px] right-[470px] flex justify-center">{poseBar}</div>

        <m.section initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.5, delay: 0.1 }} aria-label="Character options" className="pointer-events-auto absolute bottom-5 right-5 top-5 flex w-[430px] flex-col rounded-[22px] border border-[#d9a03a]/45 bg-[#0d0a12]/92 shadow-[0_0_60px_-20px_rgba(255,170,60,0.55)] backdrop-blur-md">
          <div className="px-5 pb-3 pt-5">{speciesCards(false)}</div>
          <div className="px-6 pb-3 text-center">
            <p className="font-display text-3xl uppercase leading-none text-bone" data-testid="species-name">
              {sp.name}
            </p>
            <p className="mt-1 text-[14px] text-bone/65">{sp.tagline}</p>
          </div>
          <div className="mx-5 flex items-center gap-2 text-[#d9a03a]/60" aria-hidden>
            <span className="h-px flex-1 bg-current" />
            <span className="text-xs">◆</span>
            <span className="h-px flex-1 bg-current" />
          </div>
          <div className="mt-2 border-b border-bone/[0.07] px-5 pb-2">
            <div className="flex flex-wrap items-center gap-1.5" data-testid="equipped">
              <Label className="mr-1">Equipped</Label>
              {equipped.map((e) => (
                <span key={e} className="rounded-full bg-bone/[0.06] px-2.5 py-0.5 text-[12px] text-bone/80 ring-1 ring-bone/10">
                  {e}
                </span>
              ))}
            </div>
          </div>
          <div className="border-b border-bone/[0.07]">{tabsBar}</div>
          <div className="scrollbar-none flex-1 overflow-y-auto px-5 py-4">{tabBody}</div>
          <div className="border-t border-bone/[0.07] p-4">{cta}</div>
          <p className="px-5 pb-3 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-bone/35">More species coming · {COMING.join(' · ')}</p>
        </m.section>
      </div>
    )

  /* ─────────── mobile: title · big preview · species cards · options sheet (reflowed, not a shrunken poster) ─────────── */
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col">
      <div className="safe-t safe-x px-4 pt-1">{title}</div>
      <div className="relative flex-1">
        {(['prev', 'next'] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-label={k === 'prev' ? 'Previous species' : 'Next species'}
            onClick={() => cycle(k === 'prev' ? -1 : 1)}
            className={`pointer-events-auto absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#d9a03a]/70 bg-ink/70 text-xl text-[#ffe08a] active:scale-90 ${k === 'prev' ? 'left-2' : 'right-2'}`}
          >
            {k === 'prev' ? '‹' : '›'}
          </button>
        ))}
      </div>
      <div ref={sheetRef} className="pointer-events-none">
        <div className="mb-2 flex justify-center safe-x">{poseBar}</div>
        <div className="pointer-events-auto px-3 pb-2">{speciesCards(true)}</div>
        <m.section
          aria-label="Character options"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-auto flex max-h-[38svh] flex-col rounded-t-[26px] border-t border-[#d9a03a]/45 bg-[#0d0a12]/94 backdrop-blur-md"
        >
          <div className="border-b border-bone/[0.07]">{tabsBar}</div>
          <div className="scrollbar-none flex-1 overflow-y-auto overscroll-contain px-4 py-3">{tabBody}</div>
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
