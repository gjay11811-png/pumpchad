/**
 * The Chadverse atlas: what the map + journal show, read from the same layout data the world is built from.
 * Landmarks unlock fast travel once you've reached them on foot (their `visit` discovery); the tracked objective
 * is derived from the save, so the map always points at the same thing the HUD objective names.
 */
import type { SaveData } from './save'
import { LANTERNS, SIGIL } from './scenes/world/lanterns'
import { FOREST } from './scenes/world/wilds'
import { SPECIES } from './minigames/fishing'
import { EXPANSION_OPEN, inExpansionArea } from './launch'

export type MapKind = 'place' | 'shop' | 'quest' | 'activity'
export type Landmark = {
  id: string
  name: string
  x: number
  z: number
  kind: MapKind
  /** discovery that unlocks fast travel (none = always open, e.g. the gateway) */
  visit?: string
  /** where fast travel drops you + which way you face */
  spawn?: { x: number; z: number; yaw: number }
  /** draw the name under the marker (where neighbours would overlap) */
  below?: boolean
}

export const LANDMARKS: Landmark[] = [
  { id: 'gateway', name: 'City Gateway', x: 0, z: 62, kind: 'place', spawn: { x: 0, z: 62, yaw: Math.PI } },
  { id: 'square', name: 'Chad Square', x: 0, z: 0, kind: 'place', visit: 'visit_square', spawn: { x: 0, z: 13, yaw: Math.PI } },
  { id: 'gym', name: 'Pump Gym', x: 14.4, z: -4, kind: 'place', visit: 'visit_gym', spawn: { x: 12.2, z: 3, yaw: Math.PI } },
  { id: 'citadel', name: 'Chad Citadel', x: 0, z: -27, kind: 'place', visit: 'visit_citadel', spawn: { x: 0, z: -14, yaw: Math.PI } },
  { id: 'arcade', name: 'Pump Arcade', x: 52.5, z: 19, kind: 'place', visit: 'visit_arcade', spawn: { x: 40, z: 19, yaw: Math.PI / 2 } },
  { id: 'rides', name: 'Chad Rides', x: 12, z: 66.5, kind: 'place', visit: 'visit_rides', spawn: { x: 7.5, z: 60.5, yaw: 0.55 } },
  { id: 'motor', name: 'Motor Row', x: 46, z: 36.25, kind: 'place', visit: 'visit_motor', spawn: { x: 34, z: 36.25, yaw: Math.PI / 2 } },
  { id: 'haunted', name: 'Haunted Quarter', x: -80, z: 2.5, kind: 'place', visit: 'visit_haunted', spawn: { x: -66, z: 2.5, yaw: -Math.PI / 2 } },
  { id: 'forest', name: 'Enchanted Forest', x: -70, z: -48, kind: 'place', visit: 'visit_forest', spawn: { x: -80, z: -14, yaw: Math.PI } },
  { id: 'lake', name: 'Moonlight Lake', x: 98, z: 31, kind: 'place', visit: 'visit_lake', spawn: { x: 74, z: 36.25, yaw: Math.PI / 2 } },
  { id: 'estates', name: 'Chadville Estates', x: -47, z: 60, kind: 'place', visit: 'visit_estates', spawn: { x: -34, z: 47, yaw: -Math.PI / 2 } },
  { id: 'heights', name: 'Chadville Heights', x: -150, z: 50, kind: 'place', visit: 'visit_estates', spawn: { x: -68, z: 42, yaw: -Math.PI / 2 } },
  { id: 'parkour', name: 'Chad Parkour Yard', x: -206, z: 3, kind: 'place', visit: 'visit_parkour', spawn: { x: -234, z: 30, yaw: Math.PI } },
  { id: 'act_sword', name: 'Sword Drill', x: -196, z: -13, kind: 'activity', visit: 'visit_parkour', spawn: { x: -196, z: -8.5, yaw: Math.PI } },
  { id: 'downtown', name: 'Chad City', x: -47, z: 430, kind: 'place', visit: 'visit_downtown', spawn: { x: -10, z: 415, yaw: -Math.PI / 2 } },
  { id: 'overlook-road', name: 'Valley Overlook', x: 14, z: 88, kind: 'place', visit: 'visit_overlook', spawn: { x: 8, z: 89, yaw: 0 } },
  { id: 'castle-road', name: 'Castle Road', x: -110, z: 410, kind: 'place', visit: 'visit_castleroad', spawn: { x: -110, z: 417, yaw: Math.PI } },
  { id: 'castle', name: 'Chad Castle', x: -110, z: 272, kind: 'place', visit: 'visit_castle', spawn: { x: -110, z: 300, yaw: Math.PI } },
  { id: 'southshore', name: 'Southshore', x: 100, z: 94, kind: 'place', visit: 'visit_southshore', spawn: { x: 70, z: 94, yaw: Math.PI / 2 } },
  { id: 'millrow', name: 'Mill Row', x: -42, z: 100, kind: 'place', visit: 'visit_millrow', spawn: { x: -42, z: 82, yaw: 0 } },
  { id: 'hamlet', name: 'Lantern Hamlet', x: -27, z: 215, kind: 'place', visit: 'visit_hamlet', spawn: { x: -9, z: 208, yaw: -Math.PI / 2 } },
  { id: 'watchtower', name: 'Old Watchtower', x: 96, z: 262, kind: 'place', visit: 'visit_watchtower', spawn: { x: 90, z: 266, yaw: Math.PI / 2 } },
  { id: 'bridge', name: 'Moonspan Bridge', x: 20, z: 415, kind: 'place', visit: 'visit_bridge', spawn: { x: 56, z: 415, yaw: -Math.PI / 2 } },
  { id: 'landing', name: 'Lakeside Landing', x: 64, z: 436, kind: 'place', visit: 'visit_landing', spawn: { x: 58, z: 430, yaw: -Math.PI / 2 } },
  { id: 'manor', name: 'Mooncrest Manor', x: 150, z: 516, kind: 'place', visit: 'visit_manor', spawn: { x: 128, z: 516, yaw: Math.PI / 2 } },
  { id: 'fits', name: 'Chad Fits', x: 39.1, z: 26, kind: 'shop' },
  { id: 'pets', name: 'Chad Pets', x: 38, z: 47.5, kind: 'shop' },
  { id: 'motors', name: 'Chad Motors', x: 54, z: 50.5, kind: 'shop', below: true },
  { id: 'garage', name: 'Chad Motors Service', x: 72.4, z: 49, kind: 'shop' },
  { id: 'shakes', name: 'Pump Shakes', x: -38.5, z: 2.5, kind: 'shop' },
  // activities you can complete in the first release (each starts at the marker; no fast travel needed)
  { id: 'act_rush', name: 'Pumpkin Rush', x: 10.2, z: 11.7, kind: 'activity', spawn: { x: 8.5, z: 14, yaw: Math.PI } },
  { id: 'act_events', name: 'Events Board', x: 6.5, z: 9.5, kind: 'activity', spawn: { x: 7.5, z: 13, yaw: Math.PI } },
  { id: 'act_toss', name: 'Pumpkin Toss & Pistol Range', x: 110, z: 64, kind: 'activity', visit: 'visit_lake', spawn: { x: 103, z: 64, yaw: Math.PI / 2 } },
  { id: 'act_ghost', name: 'Ghost Hunt', x: -61.4, z: 3.4, kind: 'activity', visit: 'visit_haunted', spawn: { x: -62, z: 2.5, yaw: -Math.PI / 2 } },
  { id: 'act_fishing', name: 'Pier Fishing', x: 98, z: 33.2, kind: 'activity', visit: 'visit_lake', spawn: { x: 98, z: 44, yaw: Math.PI } },
]

/** a landmark in the closed expansion (shown on the map as "Next update"; never a fast-travel target) */
export const isLockedLandmark = (l: Landmark) => !EXPANSION_OPEN && inExpansionArea(l.x, l.z)
export const canTravel = (l: Landmark, save: SaveData) => !!l.spawn && !isLockedLandmark(l) && (!l.visit || save.progress.discoveries.includes(l.visit))

/** the one objective the map tracks (mirrors the HUD objective): a point + a label, or null */
export function objectiveTarget(save: SaveData): { x: number; z: number; label: string } | null {
  const d = save.progress.discoveries
  if (!d.includes('q1_sigil')) {
    if (!d.includes('q1_start')) return { x: -3.6, z: 60.8, label: 'Goldie' }
    const next = LANTERNS.find((l) => !d.includes(`q1_lantern_${l.id}`))
    if (next) return { x: next.x, z: next.z, label: `Guardian Lantern · ${next.name}` }
    return { x: SIGIL.x, z: SIGIL.z, label: 'The Golden Sigil' }
  }
  if (!d.includes('talk_coach')) return { x: 13.4, z: 0.6, label: 'Coach Gourdon' }
  if (save.progress.gymRuns === 0) return { x: 14.4, z: -4, label: 'Pump Gym' }
  if (!d.includes('q2_stone')) {
    if (!d.includes('q2_start')) return { x: -89.4, z: 21.6, label: 'Grim the gravedigger' }
    if (!d.includes('q2_oak')) return { x: FOREST.oak.x, z: FOREST.oak.z, label: 'The Elder Oak' }
    return { x: FOREST.glade.x, z: FOREST.glade.z, label: 'The moonstone' }
  }
  return null
}

export type JournalEntry = { id: string; title: string; status: 'done' | 'active' | 'open'; steps: { label: string; done: boolean }[] }

export function journal(save: SaveData): JournalEntry[] {
  const d = save.progress.discoveries
  const has = (k: string) => d.includes(k)
  const status = (steps: { done: boolean }[], started = true): JournalEntry['status'] => (steps.every((s) => s.done) ? 'done' : started ? 'active' : 'open')
  const q1 = [
    { label: 'Talk to Goldie by the city gateway', done: has('q1_start') },
    ...LANTERNS.map((l) => ({ label: `Relight the Guardian Lantern · ${l.name}`, done: has(`q1_lantern_${l.id}`) || has('q1_sigil') })),
    { label: 'Claim the Golden Sigil at the Citadel doors', done: has('q1_sigil') },
  ]
  const coach = [
    { label: 'Find Coach Gourdon outside Pump Gym', done: has('talk_coach') },
    { label: 'Finish a Chad Press set', done: save.progress.gymRuns > 0 },
  ]
  const q2 = [
    { label: 'Ask Grim the gravedigger about the sigil', done: has('q2_start') },
    { label: 'Find the Elder Oak in the Enchanted Forest', done: has('q2_oak') },
    { label: 'Read the moonstone in the forest glade', done: has('q2_stone') },
  ]
  const city = [
    ['visit_square', 'Chad Square'],
    ['visit_gym', 'Pump Gym'],
    ['visit_arcade', 'Pump Arcade'],
    ['visit_citadel', 'Chad Citadel forecourt'],
    ['visit_rides', 'Chad Rides'],
  ].map(([k, label]) => ({ label, done: has(k) }))
  const wilds = [
    ['visit_motor', 'Motor Row'],
    ['visit_haunted', 'Haunted Quarter'],
    ['visit_forest', 'Enchanted Forest'],
    ['visit_lake', 'Moonlight Lake'],
  ].map(([k, label]) => ({ label, done: has(k) }))
  const hp = d.filter((x) => x.startsWith('hp_')).length
  const seeds = d.filter((x) => x.startsWith('seed_')).length
  return [
    { id: 'q1', title: 'The Guardian Lanterns', status: status(q1, true), steps: q1 },
    { id: 'q2', title: 'Whispers in the Wood', status: status(q2, has('q1_sigil')), steps: q2 },
    { id: 'coach', title: 'Leg Day Is Every Day', status: status(coach, has('q1_sigil') || has('talk_coach')), steps: coach },
    { id: 'city', title: 'Discover Chad Village', status: status(city), steps: city },
    { id: 'wilds', title: 'Beyond the Old Town', status: status(wilds), steps: wilds },
    { id: 'hidden', title: 'Hidden Pumpkins', status: hp >= 6 ? 'done' : 'active', steps: [{ label: `${hp}/6 found · fair spots, no climbing`, done: hp >= 6 }] },
    (() => {
      const e = save.progress.estate
      const steps = [
        { label: 'Buy a plot in Chadville Estates', done: !!e.plot },
        { label: 'Build a cottage on it', done: e.pieces.some((p) => p.k === 'cottage') },
        { label: 'Make it yours: place 8 pieces', done: e.pieces.length >= 8 },
      ]
      return { id: 'estate', title: 'A Place of Your Own', status: steps.every((s) => s.done) ? ('done' as const) : e.plot ? ('active' as const) : ('open' as const), steps }
    })(),
    {
      id: 'fish',
      title: 'Moonlight Lake Fish Log',
      status: SPECIES.every((s) => has(`fish_${s.id}`)) ? 'done' : SPECIES.some((s) => has(`fish_${s.id}`)) ? 'active' : 'open',
      steps: SPECIES.map((s) => ({ label: has(`fish_${s.id}`) ? `${s.name} — ${s.blurb}` : '??? · fish off the Moonlight Lake pier', done: has(`fish_${s.id}`) })),
    },
    { id: 'seeds', title: 'Golden Seeds', status: seeds >= 5 ? 'done' : 'active', steps: [{ label: `${seeds}/5 collected around the city`, done: seeds >= 5 }] },
  ]
}
