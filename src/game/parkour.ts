/**
 * CHAD PARKOUR YARD — pure data (no three.js): the platforms, the two courses, medals and rewards. Shared by the world builder, the
 * traversal (vault / mantle) rules and the run state machine, so the numbers live in one place.
 *
 *   • ROOKIE RUN — a walled corridor north from the entrance: two vault walls, a balance beam, a gap jump and a stair-mantle to the finish.
 *   • ROOFTOP RUN — the harder branch: climb the crate stair on the corridor's east side, then five container roofs with growing gaps; the
 *     second roof is hollow and hides a room (vault the decoy wall) holding the Golden Pumpkin.
 *
 * World frame: +z south. The yard fills x −242…−170, z −20…27 at ground level 0 (a plateau district like the rest of the village).
 */
export type Rect = { x0: number; x1: number; z0: number; z1: number }
export const YARD: Rect = { x0: -242, x1: -170, z0: -20, z1: 27 }
export const YARD_ENTRANCE = { x: -234, z: 25.6 }

/** a solid block with a walkable top. `bottom` > 0 makes a slab you can walk under. */
export type Platform = {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  top: number
  bottom?: number
  /** can be mantled onto (a tall face) */
  climb?: boolean
  /** a thin low obstacle that can be vaulted over (the landing is validated) */
  vault?: boolean
  kind: 'wall' | 'crate' | 'beam' | 'roof' | 'block' | 'step' | 'slab' | 'plate'
  /** paint colour for the builder */
  color?: string
}
const box = (minX: number, maxX: number, minZ: number, maxZ: number, top: number, kind: Platform['kind'], o: Partial<Platform> = {}): Platform => ({ minX, maxX, minZ, maxZ, top, kind, ...o })

const CX0 = -240
const CX1 = -228
/** the rookie corridor */
const A: Platform[] = [
  box(CX0, CX1, 16.8, 17.2, 0.95, 'wall', { vault: true, color: '#e8a02a' }),
  box(CX0, CX1, 10.8, 11.2, 1.2, 'wall', { vault: true, color: '#e8641a' }),
  // the balance beam: 1 m wide, 0.55 high, 8 long (centre line x -234)
  box(-234.5, -233.5, -4, 4, 0.55, 'beam', { climb: true, color: '#9a6b44' }),
  // the gap jump: two blocks with a 1.8 m pit between
  box(CX0 + 1, CX1 - 1, -10, -8, 1.0, 'block', { climb: true, color: '#7a8696' }),
  box(CX0 + 1, CX1 - 1, -14.4, -11.8, 1.0, 'block', { climb: true, color: '#7a8696' }),
  // the finish stair: a mantle up to the finish block
  box(CX0 + 1, CX1 - 1, -18, -14.4, 1.6, 'step', { climb: true, color: '#e0a83e' }),
]
/** the rooftop branch: crate stair then five roofs (z −2.5…2.5) */
const RZ0 = -2.5
const RZ1 = 2.5
const B: Platform[] = [
  box(-227.4, -224.8, -2, 2, 1.2, 'crate', { climb: true, color: '#b84a2a' }),
  box(-224.8, -222.2, -2, 2, 2.2, 'crate', { climb: true, color: '#2a6a9a' }),
  box(-222.2, -212.0, RZ0, RZ1, 3.2, 'roof', { climb: true, color: '#8a4a2a' }),
  // roof 2 is hollow: a slab on three walls, open to the north (the secret room, its mouth screened by a vaultable crate wall)
  box(-209.4, -202.0, RZ0, RZ1, 3.6, 'slab', { climb: true, bottom: 2.6, color: '#3a7a5a' }),
  box(-209.4, -208.9, -4.2, RZ1, 3.6, 'wall', { color: '#3a7a5a' }),
  box(-202.5, -202.0, -4.2, RZ1, 3.6, 'wall', { color: '#3a7a5a' }),
  box(-209.4, -202.0, 2.0, RZ1, 3.6, 'wall', { color: '#3a7a5a' }),
  box(-208.9, -202.5, -4.2, -3.8, 1.1, 'wall', { vault: true, color: '#b84a2a' }), // the decoy wall in front of the room's mouth
  box(-199.2, -192.0, RZ0, RZ1, 3.2, 'roof', { climb: true, color: '#8a4a2a' }),
  box(-189.4, -182.0, RZ0, RZ1, 3.6, 'roof', { climb: true, color: '#2a6a9a' }),
  box(-179.2, -171.5, -3, 3, 4.0, 'roof', { climb: true, color: '#e0a83e' }),
]
/** the yard's solid enclosure (tall: never climbable) — x/z boxes only, drawn + collided by the builder */
export const YARD_WALLS: Rect[] = [
  { x0: -241.2, x1: -240.4, z0: -19.2, z1: 25.6 }, // corridor west wall
  { x0: -227.6, x1: -226.8, z0: 4.4, z1: 25.6 }, // corridor east wall, south part
  { x0: -227.6, x1: -226.8, z0: -19.2, z1: -4.4 }, // corridor east wall, north part (the branch opens between)
  { x0: -242, x1: -240.4, z0: 25.6, z1: 26.8 }, // south boundary wall either side of the entrance
  { x0: -227.6, x1: -170.4, z0: 25.6, z1: 26.8 },
  { x0: -241.2, x1: -170.4, z0: -19.8, z1: -19.2 }, // north boundary
  { x0: -170.8, x1: -170.4, z0: -19.2, z1: 25.6 }, // east boundary
]
export const PLATFORMS: Platform[] = [...A, ...B]

export type Checkpoint = { x: number; z: number; y: number; yaw: number }
export type CourseId = 'rookie' | 'roof'
export type Course = {
  id: CourseId
  name: string
  blurb: string
  /** the start pad (you must stand on it and press the action) */
  start: Checkpoint & { r: number }
  finish: { x: number; z: number; y: number; r: number }
  checkpoints: Checkpoint[]
  /** where touching the ground (not a platform top) means a fall: recover at the last checkpoint */
  pits: Rect[]
  /** pits exempt from the fall rule (the secret room's floor) */
  safe?: Rect[]
  /** ms: gold, silver, bronze */
  medals: [number, number, number]
  coins: { clear: number; bronze: number; silver: number; gold: number }
  xp: number
}
export const COURSES: Record<CourseId, Course> = {
  rookie: {
    id: 'rookie',
    name: 'Rookie Run',
    blurb: 'Two vault walls, a balance beam, a gap and a climb · about 20 seconds',
    start: { x: -234, z: 22, y: 0, yaw: Math.PI, r: 1.6 },
    finish: { x: -234, z: -16.2, y: 1.6, r: 2.4 },
    checkpoints: [
      { x: -234, z: 8, y: 0, yaw: Math.PI },
      { x: -234, z: -6.4, y: 0, yaw: Math.PI },
    ],
    pits: [
      { x0: CX0, x1: CX1, z0: -4.4, z1: 4.4 }, // off the beam
      { x0: CX0, x1: CX1, z0: -11.8, z1: -10 }, // the gap
    ],
    medals: [14000, 22000, 35000],
    coins: { clear: 25, bronze: 10, silver: 20, gold: 40 },
    xp: 60,
  },
  roof: {
    id: 'roof',
    name: 'Rooftop Run',
    blurb: 'Climb the crates, then five roofs over widening gaps · about 30 seconds',
    start: { x: -229.6, z: 0, y: 0, yaw: Math.PI / 2, r: 1.3 },
    finish: { x: -175.4, z: 0, y: 4.0, r: 2.6 },
    checkpoints: [
      { x: -205.7, z: 0, y: 3.6, yaw: Math.PI / 2 },
      { x: -185.7, z: 0, y: 3.6, yaw: Math.PI / 2 },
    ],
    pits: [{ x0: -226.8, x1: -171, z0: -6, z1: 6 }],
    safe: [{ x0: -209, x1: -202.6, z0: -6, z1: 2 }], // under roof 2: the secret room and its approach
    medals: [22000, 32000, 50000],
    coins: { clear: 60, bronze: 20, silver: 40, gold: 80 },
    xp: 120,
  },
}
export const SECRET = { x: -205.7, z: -0.2, id: 'pk_secret' }
export const medalFor = (c: Course, ms: number): 0 | 1 | 2 | 3 => (ms <= c.medals[0] ? 3 : ms <= c.medals[1] ? 2 : ms <= c.medals[2] ? 1 : 0)
export const MEDAL_NAME = ['No medal', 'Bronze', 'Silver', 'Gold']
/** coins for a finished run: the clear bonus the first time, plus the difference for each NEW medal tier above the previous best */
export function runCoins(c: Course, prevBestMs: number, ms: number) {
  const prevM = prevBestMs > 0 ? medalFor(c, prevBestMs) : -1
  const m = medalFor(c, ms)
  const tier = [0, c.coins.bronze, c.coins.silver, c.coins.gold]
  let coins = prevBestMs > 0 ? 0 : c.coins.clear
  if (m > prevM) coins += tier[m] - (prevM > 0 ? tier[prevM] : 0)
  return { coins, medal: m, newBest: prevBestMs <= 0 || ms < prevBestMs }
}
export const fmtMs = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}.${String(Math.floor((ms % 1000) / 100))}`

/* ── traversal rules (vault / mantle), pure so the tests and the world share them ── */
export const REACH_MAX = 2.3 // the tallest face a mantle can pull up (m above the feet)
export const REACH_MIN = 0.45 // lower than this is just a step / a jump
export const HEADROOM = 1.8 // clear height needed on top

const inside = (p: Platform, x: number, z: number, m = 0) => x > p.minX - m && x < p.maxX + m && z > p.minZ - m && z < p.maxZ + m
export const platformInside = inside
