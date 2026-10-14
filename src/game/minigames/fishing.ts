/**
 * Fishing at Moonlight Lake — the rules, separate from the UI so they can be read (and tuned) in one place.
 *
 * A round is CASTS casts. Each cast: aim (a power meter: further out = rarer fish) → wait for a bite (pressing
 * early spooks it) → strike inside the bite window → reel: hold to reel in, release to ease off; keep the line
 * tension inside the green zone. Too much tension snaps the line, too much slack lets the fish go. Bigger fish
 * pull harder and come in slower. Score = the points of everything landed; XP comes from the score, capped,
 * with the same daily fatigue as the other activities.
 */
export const CASTS = 5
export const FISH_XP = { div: 6, cap: 60 }
export const fishingXp = (score: number) => Math.min(FISH_XP.cap, Math.round(score / FISH_XP.div))

export type Species = {
  id: string
  name: string
  blurb: string
  base: number
  kg: [number, number]
  /** how hard it pulls (0..1) and how fast it reels in (progress per second while in the zone) */
  strength: number
  reel: number
  color: string
  /** relative chance by distance band: near / mid / far */
  w: [number, number, number]
}
export const SPECIES: Species[] = [
  { id: 'perch', name: 'Pumpkinseed Perch', blurb: 'orange-striped, everywhere, always hungry', base: 10, kg: [0.2, 0.6], strength: 0.25, reel: 0.55, color: '#e8641a', w: [60, 30, 12] },
  { id: 'carp', name: 'Moonlit Carp', blurb: 'silver scales that shine under the moon', base: 18, kg: [1, 4], strength: 0.4, reel: 0.42, color: '#c8ccd8', w: [30, 34, 22] },
  { id: 'koi', name: 'Ghost Koi', blurb: 'pale and see-through; glows faintly', base: 40, kg: [0.8, 2.5], strength: 0.5, reel: 0.38, color: '#dfe6ff', w: [8, 20, 24] },
  { id: 'gourd', name: 'Golden Gourdfish', blurb: 'round, gold, smug about it', base: 75, kg: [0.5, 1.8], strength: 0.6, reel: 0.34, color: '#ffd25a', w: [2, 10, 18] },
  { id: 'eel', name: 'Lantern Eel', blurb: 'a little light on the end of its nose', base: 90, kg: [1, 3], strength: 0.72, reel: 0.3, color: '#7fe8ff', w: [0, 5, 16] },
  { id: 'gnarly', name: 'Old Gnarly', blurb: 'the lake legend. Older than the city.', base: 250, kg: [8, 14], strength: 0.95, reel: 0.2, color: '#5a6a4a', w: [0, 1, 8] },
]

export type Catch = { species: Species; kg: number; points: number }

/** which fish bites, for a cast of power 0..1 */
export function rollFish(power: number, rnd: () => number): Catch {
  const band = power < 0.35 ? 0 : power < 0.75 ? 1 : 2
  const total = SPECIES.reduce((a, s) => a + s.w[band], 0)
  let r = rnd() * total
  let sp = SPECIES[0]
  for (const s of SPECIES) {
    r -= s.w[band]
    if (r <= 0) {
      sp = s
      break
    }
  }
  const t = rnd()
  const kg = +(sp.kg[0] + (sp.kg[1] - sp.kg[0]) * t).toFixed(2)
  return { species: sp, kg, points: Math.round(sp.base * (0.8 + 0.4 * t)) }
}

/** the reel fight */
export const ZONE = { lo: 0.25, hi: 0.8 }
export type Reel = { tension: number; progress: number; slack: number; t: number; surge: number; result: null | 'landed' | 'snapped' | 'escaped' }
export const newReel = (): Reel => ({ tension: 0.45, progress: 0.15, slack: 0, t: 0, surge: 0, result: null })

export function stepReel(r: Reel, dt: number, holding: boolean, sp: Species, rnd: () => number): Reel {
  if (r.result) return r
  const t = r.t + dt
  // the fish surges now and then; harder fish surge harder
  let surge = Math.max(0, r.surge - dt * 1.4)
  if (rnd() < dt * (0.4 + sp.strength * 1.2)) surge = (0.5 + rnd() * 0.7) * sp.strength
  const pull = sp.strength * (0.35 + 0.35 * Math.sin(t * (2 + sp.strength * 3)) + surge)
  // holding winds in against the fish's pull (and its surges); letting go pays out line, so tension always eases
  const d = holding ? 0.35 + pull * 1.1 + surge * 1.25 : -1.5 + pull * 0.6
  const tension = Math.min(1.05, Math.max(0, r.tension + d * dt))
  const inZone = tension >= ZONE.lo && tension <= ZONE.hi
  const progress = Math.min(1, Math.max(0, r.progress + (holding && inZone ? sp.reel : holding ? sp.reel * 0.25 : -0.06) * dt))
  const slack = tension < 0.06 ? r.slack + dt : 0
  const result = tension >= 1 ? 'snapped' : slack > 1.3 ? 'escaped' : progress >= 1 ? 'landed' : null
  return { tension, progress, slack, t, surge, result }
}
