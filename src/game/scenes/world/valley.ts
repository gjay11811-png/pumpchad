import { RoadSys, smooth } from './roadnet'
import { DESCENT, VALLEY_Y } from './descent'

/**
 * THE VALLEY COMPOSITION (maths only, world coordinates, +z south): the lake in the basin beside Chad City, the walkable
 * landings and promenades around it, the roadside destinations on the way down (woodland trail, hamlet terrace, the old
 * watchtower on its knoll), and Mooncrest Manor on its hillside terrace with its winding drive. Terrain, walkability, ground
 * height and the builders all read this file, so nothing is placed twice.
 *
 *          village plateau (y 0)
 *                │  valley road ──► overlook ─► hairpins ─► woodland ─► hamlet ─► viaduct ─► watchtower detour
 *                ▼                                                                              │
 *   Chad City (y −52) ◄── stone bridge over the inlet ◄── Lakeside Landing ◄────────────────────┘
 *      │ waterfront promenade                         │ Mansion Drive ► Mooncrest Manor (y −38) over the lake
 *      └──────────────── Moonmere (the lake, water y −54.4) ──────────────────────────────────────────────
 */
export const WATER_Y = VALLEY_Y - 2.4

/* ───────────── the lake: an irregular outline (two coves, a bay, and the inlet the bridge crosses) ───────────── */
type Ell = { k: 'e'; x: number; z: number; rx: number; rz: number; ph: number }
type Cap = { k: 'c'; ax: number; az: number; bx: number; bz: number; r: number }
const PARTS: (Ell | Cap)[] = [
  { k: 'e', x: 20, z: 527, rx: 78, rz: 46, ph: 0.6 },
  { k: 'e', x: -52, z: 502, rx: 30, rz: 21, ph: 2.1 },
  { k: 'e', x: 82, z: 548, rx: 30, rz: 20, ph: 4.0 },
  { k: 'c', ax: 20, az: 400, bx: 20, bz: 482, r: 27 },
]
/** < 1 inside the (wobbly) outline; the shoreline of the water sits near 0.8 */
export function lakeRho(x: number, z: number) {
  let m = Infinity
  for (const p of PARTS) {
    let r: number
    if (p.k === 'e') {
      const dx = x - p.x
      const dz = z - p.z
      const th = Math.atan2(dz, dx)
      const wob = 1 + 0.16 * Math.sin(3 * th + p.ph) + 0.09 * Math.sin(5 * th + 2 * p.ph) + 0.05 * Math.sin(9 * th + p.ph)
      r = Math.hypot(dx / p.rx, dz / p.rz) / wob
    } else {
      const vx = p.bx - p.ax
      const vz = p.bz - p.az
      const t = Math.min(1, Math.max(0, ((x - p.ax) * vx + (z - p.az) * vz) / (vx * vx + vz * vz)))
      r = Math.hypot(x - (p.ax + vx * t), z - (p.az + vz * t)) / (p.r * (1 + 0.07 * Math.sin(z * 0.09 + 1.2)))
    }
    m = Math.min(m, r)
  }
  return m
}
/** how far the lake bed is sunk below the valley floor at (x, z): gently shelving margins, deepest in the middle */
export function lakeBasin(x: number, z: number) {
  const r = lakeRho(x, z)
  if (r >= 1.15) return 0
  return 5.4 * (1 - smooth(0.4, 1.15, r))
}
/** is (x, z) over open water (the bed is below the waterline)? */
export const inLakeWater = (x: number, z: number) => lakeBasin(x, z) > 2.4 + 0.15

/* ───────────── flat landings and promenades ───────────── */
export type Pad = { id: string; x0: number; x1: number; z0: number; z1: number; y: number }
export type CirclePad = { id: string; x: number; z: number; r: number; y: number }
const roadY = (x: number, z: number) => DESCENT.nearest(x, z).y
/** city waterfront: the south promenade, the east strip beside the inlet, and the Lakeside Landing east of the bridge */
export const PADS: Pad[] = [
  { id: 'prom_s', x0: -88, x1: -8, z0: 463, z1: 482, y: VALLEY_Y },
  { id: 'prom_e', x0: -9.5, x1: -5, z0: 394, z1: 482, y: VALLEY_Y },
  { id: 'landing', x0: 49, x1: 80, z0: 418, z1: 454, y: VALLEY_Y },
  { id: 'hamlet', x0: -52, x1: -5, z0: 196, z1: 236, y: roadY(-2, 208) },
]
export const CIRCLE_PADS: CirclePad[] = [
  { id: 'tower', x: 96, z: 262, r: 7.5, y: roadY(54, 262) + 11 },
  { id: 'manor', x: 142, z: 516, r: 36, y: VALLEY_Y + 14 },
]
export const HAMLET = PADS[3]
export const LANDING = PADS[2]
export const TOWER = CIRCLE_PADS[0]
export const MANOR_PAD = CIRCLE_PADS[1]
export const MANOR = { x: 150, z: 516, y: MANOR_PAD.y, face: -Math.PI / 2 }

/* ───────────── paths: woodland trail, watchtower trail, Mansion Drive, the shore viewpoint path ───────────── */
function catmull(pts: [number, number][], per = 6): [number, number][] {
  const out: [number, number][] = []
  const P = [pts[0], ...pts, pts[pts.length - 1]]
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]]
    for (let k = 0; k < per; k++) {
      const t = k / per
      const t2 = t * t
      const t3 = t2 * t
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ])
    }
  }
  out.push(pts[pts.length - 1])
  return out
}
/** the optional woodland trail: leaves the road at the second hairpin, wanders west through the autumn trees, past a shrine, over a stream, to the hamlet */
export const WOOD_TRAIL = new RoadSys(catmull([[-11, 176], [-30, 178], [-50, 186], [-66, 200], [-70, 216], [-62, 230], [-52, 234]], 6), roadY(-11, 176), HAMLET.y, 2.4)
/** the watchtower detour: from the road beyond the viaduct approach, up the knoll */
export const TOWER_TRAIL = new RoadSys(catmull([[58, 258], [70, 252], [82, 256], [90, 266], [96, 262]], 6), roadY(58, 258), TOWER.y, 2.4)
/** Mansion Drive: from the Lakeside Landing, winding up the hillside to the gates */
export const DRIVE = new RoadSys(catmull([[80, 436], [98, 440], [116, 452], [128, 468], [122, 486], [104, 494], [100, 508], [108, 518]], 6), VALLEY_Y, MANOR_PAD.y, 4.6, { start: 6, end: 4 })
/** the garden path from the manor terrace down to the shoreline viewpoint */
export const VIEW_PATH = new RoadSys(catmull([[122, 540], [112, 548], [100, 556], [92, 560]], 6), MANOR_PAD.y, VALLEY_Y + 0.4, 2.4, { start: 2 })
export const VIEWPOINT = { x: 90, z: 562, y: VALLEY_Y + 0.4 }
const ROADS: RoadSys[] = [WOOD_TRAIL, TOWER_TRAIL, DRIVE, VIEW_PATH]

/* ───────────── walkable / ground / clamp / terrain ───────────── */
const inRect = (x: number, z: number, p: Pad, m: number) => x > p.x0 + m && x < p.x1 - m && z > p.z0 + m && z < p.z1 - m
const inCircle = (x: number, z: number, c: CirclePad, m: number) => Math.hypot(x - c.x, z - c.z) < c.r - m
const BOX = { x0: -100, x1: 190, z0: 150, z1: 600 }
const inBox = (x: number, z: number) => x > BOX.x0 && x < BOX.x1 && z > BOX.z0 && z < BOX.z1

export function inValleyWalk(x: number, z: number, m = 0) {
  if (!inBox(x, z)) return false
  if (PADS.some((p) => inRect(x, z, p, m))) return true
  if (CIRCLE_PADS.some((c) => inCircle(x, z, c, m))) return true
  return ROADS.some((r) => r.on(x, z, m))
}
export function valleyGround(x: number, z: number): number | null {
  if (!inBox(x, z)) return null
  for (const p of PADS) if (inRect(x, z, p, -0.2)) return p.y
  for (const c of CIRCLE_PADS) if (inCircle(x, z, c, -0.2)) return c.y
  for (const r of ROADS) {
    const g = r.ground(x, z)
    if (g !== null) return g
  }
  return null
}
export function clampToValley(p: { x: number; z: number }, m: number) {
  if (!inBox(p.x, p.z)) return
  const cands: { x: number; z: number }[] = []
  for (const r of PADS) cands.push({ x: Math.min(Math.max(p.x, r.x0 + m), r.x1 - m), z: Math.min(Math.max(p.z, r.z0 + m), r.z1 - m) })
  for (const c of CIRCLE_PADS) {
    const d = Math.hypot(p.x - c.x, p.z - c.z)
    const k = d > c.r - m ? (c.r - m) / Math.max(1e-6, d) : 1
    cands.push({ x: c.x + (p.x - c.x) * k, z: c.z + (p.z - c.z) * k })
  }
  for (const r of ROADS) {
    const q = { x: p.x, z: p.z }
    r.clamp(q, m)
    cands.push(q)
  }
  let best = cands[0]
  let bd = Infinity
  for (const c of cands) {
    const d = Math.hypot(p.x - c.x, p.z - c.z)
    if (d < bd) [best, bd] = [c, d]
  }
  p.x = best.x
  p.z = best.z
}

/** the terrain with the valley's features in it: `h` is the height so far (valley floor / hills / descent road / castle) */
export function valleyTerrain(x: number, z: number, h: number) {
  if (!inBox(x, z)) return h
  // the knoll under the old watchtower (a rocky rise), and the manor's hill (roads + terrace carve their own banks)
  const kn = Math.exp(-(((x - TOWER.x) / 17) ** 2 + ((z - TOWER.z) / 15) ** 2))
  h += kn * (TOWER.y - roadY(54, 262) + 1.5) * 0.9
  const mh = Math.exp(-(((x - 150) / 48) ** 2 + ((z - 520) / 40) ** 2))
  h += mh * (MANOR_PAD.y - VALLEY_Y) * 0.55
  // the lake bed
  h -= lakeBasin(x, z)
  // paths carve their shelves into the slope
  for (const r of ROADS) {
    const n = r.nearest(x, z)
    if (n.d < 14) h = r.terrain(x, z, h, false)
  }
  // flat pads: level inside, easing into the surroundings over a few metres
  for (const p of PADS) {
    const dx = Math.max(p.x0 - x, 0, x - p.x1)
    const dz = Math.max(p.z0 - z, 0, z - p.z1)
    const d = Math.hypot(dx, dz)
    if (d < 9) h += (p.y - h) * (1 - smooth(0, 9, d))
  }
  for (const c of CIRCLE_PADS) {
    const d = Math.max(0, Math.hypot(x - c.x, z - c.z) - c.r)
    if (d < (c.id === 'manor' ? 22 : 8)) h += (c.y - h) * (1 - smooth(0, c.id === 'manor' ? 22 : 8, d))
  }
  return h
}

/* ───────────── discoveries: small finds between the big places ───────────── */
export type Discovery = { id: string; disc: string; name: string; x: number; z: number; xp: number; speaker: string; role: string; lines: string[] }
export const VALLEY_DISCOVERIES: Discovery[] = [
  {
    id: 'shrine', disc: 'disc_shrine', name: 'Look at the old shrine', x: -69, z: 207, xp: 15, speaker: 'An Old Shrine', role: 'moss, candles and a gold pumpkin',
    lines: ['A little stone shrine in the trees, its candles freshly lit by someone who was here a moment ago.', 'On the plinth, scratched with a nail: “The Order kept three keys. One for the gate, one for the vault, one for the sky.”'],
  },
  {
    id: 'garden', disc: 'disc_garden', name: 'Step into the hidden garden', x: -38, z: 245, xp: 15, speaker: 'The Hidden Garden', role: 'a walled secret behind the hamlet',
    lines: ['Behind the inn’s back wall a gate you’d never notice opens on a tiny walled garden: pumpkin vines, a sundial, a bench for one.', 'The sundial’s shadow points at the castle on its mountain.'],
  },
  {
    id: 'stream', disc: 'disc_stream', name: 'Cross the stream on the plank bridge', x: -71, z: 221, xp: 10, speaker: 'The Stream Crossing', role: 'cold water under old planks',
    lines: ['A shallow stream runs down toward the lake. Under the plank bridge, a lantern someone left lit — and a ribbon in the Order’s purple.'],
  },
  {
    id: 'treasure', disc: 'disc_treasure', name: 'Dig where the X is marked', x: 126, z: 438, xp: 30, speaker: 'Buried Treasure', role: 'a chest, a note, and a coin',
    lines: ['Under a flat stone marked with an X, an old chest: a handful of gold-painted tokens, and a note — “For whoever follows the lantern road all the way down. Keep looking up.”'],
  },
]
