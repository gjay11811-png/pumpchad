/**
 * Local save data. Everything read back from storage is treated as untrusted:
 * parsed defensively, whitelisted, clamped, and rebuilt from defaults.
 * Never eval'd, never injected as HTML.
 */
import { EYEWEAR, GLOWS, HEADWEAR, OUTFITS, SPECIES, TOPS, type Appearance } from './character/types'
import { sanitizeEstate, type Estate } from './estates'
import { CATALOG, ITEM, PREMIUM_GLOWS, PREMIUM_OUTFITS, coinsForXp, itemForColor } from './economy'

export const SAVE_KEY = 'pumpchad.chadverse.save'
/** v2: Chad Coins + owned items (v1 saves migrate: coins from XP already earned) */
export const SAVE_VERSION = 2

export type Quality = 'low' | 'medium' | 'high'

export type Settings = {
  quality: Quality
  sfx: number
  ambience: number
  muted: boolean
  reducedEffects: boolean
  cameraSensitivity: number
  stickSensitivity: number
  uiScale: number
}

export type Progress = {
  xp: number
  achievements: string[]
  gymBest: number
  gymRuns: number
  discoveries: string[]
  /** lifetime strength points from gym stations */
  strength: number
  /** lifetime reps per station */
  reps: Record<string, number>
  /** lifetime stamina points from cardio stations (treadmill, heavy bag) */
  stamina: number
  /** lifetime workout stats */
  stats: { sets: number; clean: number; bestCombo: number }
  /** per-station sets finished today (anti-farm fatigue) */
  daily: { day: string; sets: Record<string, number> }
  /** mini-game personal bests (Chad Press best stays in gymBest) */
  records: Record<string, number>
  /** Chad Coins (in-game currency, never real money) */
  coins: number
  /** catalogue item ids the player owns */
  owned: string[]
  /** the companion (a pet item id) following you, or null (left at home) */
  pet: string | null
  /** Chadville Estates: the plot you own (if any) and what you've built on it */
  estate: Estate
}

export type SaveData = {
  version: number
  character: { name: string; appearance: Appearance } | null
  progress: Progress
  settings: Settings
}

const prefersReduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const isTouch = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

export const defaultSettings = (): Settings => ({
  quality: isTouch() ? 'medium' : 'high',
  sfx: 0.7,
  ambience: 0.4,
  muted: true, // sound stays off until the player turns it on
  reducedEffects: !!prefersReduced(),
  cameraSensitivity: 1,
  stickSensitivity: 1,
  uiScale: 1,
})

export const defaultSave = (): SaveData => ({
  version: SAVE_VERSION,
  character: null,
  progress: { xp: 0, achievements: [], gymBest: 0, gymRuns: 0, discoveries: [], strength: 0, reps: {}, stamina: 0, stats: { sets: 0, clean: 0, bestCombo: 0 }, daily: { day: '', sets: {} }, records: {}, coins: 0, owned: [], pet: null, estate: { plot: null, pieces: [] } },
  settings: defaultSettings(),
})

/* ── validation helpers ── */
const HEX = /^#[0-9a-f]{6}$/i
const num = (v: unknown, min: number, max: number, d: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], d: T): T => (allowed.includes(v as T) ? (v as T) : d)
const color = (v: unknown, allowed: string[], d: string) => (typeof v === 'string' && HEX.test(v) && allowed.includes(v.toLowerCase()) ? v.toLowerCase() : d)
const strList = (v: unknown, max = 64) =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && /^[a-z0-9_-]{1,32}$/.test(x)))].slice(0, max) : []

const BLOCKED = ['fuck', 'shit', 'cunt', 'nigg', 'fag', 'retard', 'rape', 'hitler', 'nazi']

/** Username rules: 3–16 chars, letters/numbers/space/_/-, no slurs. Returns cleaned name or an error. */
export function validateName(raw: string): { ok: true; name: string } | { ok: false; error: string } {
  const name = raw.replace(/\s+/g, ' ').trim()
  if (name.length < 3) return { ok: false, error: 'At least 3 characters.' }
  if (name.length > 16) return { ok: false, error: '16 characters max.' }
  if (!/^[A-Za-z0-9 _-]+$/.test(name)) return { ok: false, error: 'Letters, numbers, spaces, _ and - only.' }
  const flat = name.toLowerCase().replace(/[^a-z]/g, '')
  if (BLOCKED.some((b) => flat.includes(b))) return { ok: false, error: 'Pick a different name, chad.' }
  return { ok: true, name }
}

function sanitizeAppearance(a: unknown): Appearance | null {
  if (!a || typeof a !== 'object') return null
  const o = a as Record<string, unknown>
  const species = oneOf(o.species, SPECIES.map((s) => s.id), 'pumpkin')
  const skins = SPECIES.find((s) => s.id === species)!.skins
  return {
    species,
    skin: color(o.skin, skins, skins[0]),
    outfit: color(o.outfit, [...OUTFITS, ...PREMIUM_OUTFITS], OUTFITS[0]),
    glow: color(o.glow, [...GLOWS, ...PREMIUM_GLOWS], GLOWS[0]),
    top: oneOf(o.top, TOPS.map((t) => t.id), 'shirtless'),
    headwear: oneOf(o.headwear, HEADWEAR.map((t) => t.id), 'none'),
    eyewear: oneOf(o.eyewear, EYEWEAR.map((t) => t.id), 'shades'),
    chain: typeof o.chain === 'boolean' ? o.chain : true,
  }
}

const STATION_KEYS = ['bench', 'curl', 'squat', 'bag', 'deadlift', 'pullup', 'treadmill']
/** whitelisted key → whole non-negative number */
function countMap(v: unknown, keys: string[], max = 1e7): Record<string, number> {
  const out: Record<string, number> = {}
  if (!v || typeof v !== 'object') return out
  for (const k of keys) {
    const n = (v as Record<string, unknown>)[k]
    if (typeof n === 'number' && Number.isFinite(n) && n > 0) out[k] = Math.min(max, Math.floor(n))
  }
  return out
}
/** station → rep count, only known stations */
const repMap = (v: unknown) => countMap(v, STATION_KEYS)
export const RECORD_KEYS = ['pumpkin_rush', 'fishing', 'event_hunt', 'event_invasion', 'event_festival', 'event_storm']

export function sanitizeSave(raw: unknown): SaveData {
  const d = defaultSave()
  if (!raw || typeof raw !== 'object') return d
  const o = raw as Record<string, unknown>
  // future: migrate older versions here; unknown future versions fall back to defaults
  if (typeof o.version !== 'number' || o.version > SAVE_VERSION) return d

  let character: SaveData['character'] = null
  const c = o.character as Record<string, unknown> | null
  if (c && typeof c === 'object') {
    const v = typeof c.name === 'string' ? validateName(c.name) : null
    const app = sanitizeAppearance(c.appearance)
    if (v?.ok && app) character = { name: v.name, appearance: app }
  }

  const p = (o.progress ?? {}) as Record<string, unknown>
  const s = (o.settings ?? {}) as Record<string, unknown>
  return {
    version: SAVE_VERSION,
    character,
    progress: {
      xp: Math.floor(num(p.xp, 0, 1e7, 0)),
      achievements: strList(p.achievements),
      gymBest: Math.floor(num(p.gymBest, 0, 1e6, 0)),
      gymRuns: Math.floor(num(p.gymRuns, 0, 1e6, 0)),
      discoveries: strList(p.discoveries),
      strength: Math.floor(num(p.strength, 0, 1e7, 0)),
      reps: repMap(p.reps),
      stamina: Math.floor(num(p.stamina, 0, 1e7, 0)),
      stats: (() => {
        const st = (p.stats ?? {}) as Record<string, unknown>
        return { sets: Math.floor(num(st.sets, 0, 1e6, 0)), clean: Math.floor(num(st.clean, 0, 1e7, 0)), bestCombo: Math.floor(num(st.bestCombo, 0, 1000, 0)) }
      })(),
      daily: (() => {
        const dl = (p.daily ?? {}) as Record<string, unknown>
        const day = typeof dl.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dl.day) ? dl.day : ''
        return { day, sets: countMap(dl.sets, [...STATION_KEYS, ...RECORD_KEYS], 1000) }
      })(),
      records: countMap(p.records, RECORD_KEYS, 1e6),
      // v1 → v2 migration: coins for the XP already earned (the same 2 XP = 1 coin rule)
      coins: o.version < 2 ? coinsForXp(num(p.xp, 0, 1e7, 0)) : Math.floor(num(p.coins, 0, 1e7, 0)),
      owned: strList(p.owned).filter((id) => CATALOG.some((i) => i.id === id)),
      pet: typeof p.pet === 'string' ? p.pet : null,
      estate: sanitizeEstate(p.estate),
    },
    settings: {
      quality: oneOf(s.quality, ['low', 'medium', 'high'] as const, d.settings.quality),
      sfx: num(s.sfx, 0, 1, d.settings.sfx),
      ambience: num(s.ambience, 0, 1, d.settings.ambience),
      muted: typeof s.muted === 'boolean' ? s.muted : d.settings.muted,
      reducedEffects: typeof s.reducedEffects === 'boolean' ? s.reducedEffects : d.settings.reducedEffects,
      cameraSensitivity: num(s.cameraSensitivity, 0.3, 2, 1),
      stickSensitivity: num(s.stickSensitivity, 0.5, 1.5, 1),
      uiScale: num(s.uiScale, 0.85, 1.25, 1),
    },
  }
}

/** a pet you don't own stays home; a premium colour that isn't owned (edited save, refund…) falls back to the default colour */
function enforceOwnership(d: SaveData): SaveData {
  const pet = d.progress.pet
  if (pet && !(d.progress.owned.includes(pet) && ITEM(pet)?.kind === 'pet')) d = { ...d, progress: { ...d.progress, pet: null } }
  const a = d.character?.appearance
  if (!a) return d
  const outfit = itemForColor('outfit', a.outfit)
  const glow = itemForColor('glow', a.glow)
  const fix: Partial<Appearance> = {}
  if (outfit && !d.progress.owned.includes(outfit.id)) fix.outfit = OUTFITS[0]
  if (glow && !d.progress.owned.includes(glow.id)) fix.glow = GLOWS[0]
  return Object.keys(fix).length ? { ...d, character: { ...d.character!, appearance: { ...a, ...fix } } } : d
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw || raw.length > 50_000) return defaultSave()
    return enforceOwnership(sanitizeSave(JSON.parse(raw)))
  } catch {
    return defaultSave() // corrupt JSON or storage blocked: start fresh, never crash
  }
}

export function writeSave(data: SaveData): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...data, version: SAVE_VERSION }))
    return true
  } catch {
    return false // private mode / quota: game keeps running, progress just isn't persisted
  }
}

/* ── progression ── */
export const levelFor = (xp: number) => Math.floor(Math.sqrt(xp / 50)) + 1
export const xpForLevel = (lvl: number) => 50 * (lvl - 1) ** 2

export const ACHIEVEMENTS: Record<string, { name: string; desc: string }> = {
  welcome: { name: 'Chad Has Entered The Chat', desc: 'Create your character.' },
  first_set: { name: 'First Set', desc: 'Finish a Chad Press set.' },
  perfect_form: { name: 'Perfect Form', desc: 'Land 5 PERFECT reps in one set.' },
  iron_chad: { name: 'Iron Chad', desc: 'Score 800+ in Chad Press.' },
  socialite: { name: 'Town Socialite', desc: 'Talk to every resident of Chad Square.' },
  gourd_whisperer: { name: 'Gourd Whisperer', desc: 'Annoy the suspicious pumpkin.' },
  gourd_council: { name: 'Gourd Council', desc: 'Find all three talking pumpkins.' },
  city_explorer: { name: 'City Explorer', desc: 'Discover Chad Village: the square, the gym, the arcade, the citadel and Chad Rides.' },
  pumpkin_hunter: { name: 'Pumpkin Hunter', desc: 'Find all six hidden pumpkins in Chad City.' },
  bucket_shot: { name: 'Bucket Shot', desc: 'Land a coin in the wishing well bucket.' },
  kings_stash: { name: 'The King’s Stash', desc: 'Find the hidden switch.' },
  seed_collector: { name: 'Seed Collector', desc: 'Find all 5 golden seeds.' },
  full_circuit: { name: 'Full Circuit', desc: 'Finish a set on every gym station.' },
  century: { name: 'Century', desc: 'Do 100 reps at the gym stations.' },
  rush_hour: { name: 'Rush Hour', desc: 'Score 5,000+ in Pumpkin Rush.' },
  hunt_won: { name: 'Night Owl', desc: 'Win the Midnight Pumpkin Hunt.' },
  ghost_buster: { name: 'Ghostbuster', desc: 'Win the Ghost Invasion.' },
  festival_lit: { name: 'Lantern Keeper', desc: 'Light every lantern at the Harvest Festival.' },
  storm_rider: { name: 'Storm Rider', desc: 'Win the Thunderstorm event.' },
}
