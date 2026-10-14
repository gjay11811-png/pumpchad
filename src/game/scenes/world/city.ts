/**
 * CHAD CITY layout: one source of truth for the walkable shape, terrain heights, the canal + bridges, district
 * anchors and the spawn. Everything that places geometry, colliders, NPC routes or the map board reads it.
 *
 *            N (−z)            CHAD CITADEL (castle) + forecourt
 *   WEST                       CHAD SQUARE (old town core, r ≈ 34)            EAST
 *   garden, overlook,          market row → social corner                      arcade street, PUMP ARCADE,
 *   social corner                                                              gym courtyard
 *            S (+z)            canal promenade · CANAL · bridges
 *                              arrival forecourt · CHAD CITY gateway · spawn · CHAD RIDES · valley gate
 */

/** walkable areas (union). The core is the old walled town; the rectangles are the new districts. */
export const CORE_R = 34.5
export type Rect = { x0: number; x1: number; z0: number; z1: number }
export const DISTRICTS: Record<'south' | 'east' | 'west' | 'overlook' | 'haunted' | 'motor' | 'forest' | 'lake', Rect> = {
  south: { x0: -32, x1: 32, z0: 20, z1: 75 },
  east: { x0: 28, x1: 58, z0: -6, z1: 34 },
  west: { x0: -58, x1: -28, z0: -6, z1: 34 },
  // the scenic overlook juts out over the cliff at the garden's south-west corner
  overlook: { x0: -60, x1: -46, z0: 33, z1: 42 },
  // the HAUNTED QUARTER: crooked lanes of old houses beyond the garden, through the iron gate at the end of the west road
  haunted: { x0: -102, x1: -58, z0: -18, z1: 24 },
  // MOTOR ROW: the canal promenade's eastward continuation (Chad Pets, Chad Motors)
  motor: { x0: 28, x1: 66, z0: 29, z1: 58 },
  // the ENCHANTED FOREST: beyond the Haunted Quarter's north edge — glowing mushrooms, an elder oak, winding paths
  forest: { x0: -102, x1: -40, z0: -68, z1: -16 }, // overlaps the Haunted Quarter by 2 m so the seam has no wall
  // MOONLIGHT LAKE: Motor Row's street runs on east to a lake with a shore path, a pier and a pavilion
  lake: { x0: 64, x1: 128, z0: 4, z1: 70 },
}
/** Moonlight Lake's water (an ellipse, not walkable) and the pier over it (walkable) */
export const LAKE = { x: 98, z: 31, rx: 19, rz: 14, water: -0.32 }
export const PIER = { x0: 96.8, x1: 99.2, z0: 34, z1: 46.5, head: { x0: 95.2, x1: 100.8, z0: 31, z1: 35 } }
/** normalised lake radius at (x, z): < 1 is over water */
export const lakeR = (x: number, z: number) => Math.hypot((x - LAKE.x) / LAKE.rx, (z - LAKE.z) / LAKE.rz)
const onPier = (x: number, z: number, m = 0) => inRect(x, z, PIER, m) || inRect(x, z, PIER.head, m)
/** over the lake's open water (not the pier), with margin m metres */
export function inLake(x: number, z: number, m = 0) {
  return lakeR(x, z) < 1 + m / LAKE.rz && !onPier(x, z, m > 0 ? -m : 0)
}
const RECTS = Object.values(DISTRICTS)

/** the canal: open water between these bounds (y of the water surface below), crossed by the bridges */
export const CANAL = { x0: -28, x1: 28, z0: 38.5, z1: 44.5, water: -0.8, floor: -1.9 }
export const BRIDGES = [
  { x: 0, w: 6.4, rise: 0.42, name: 'Chad Bridge' }, // the main avenue
  { x: -19, w: 2.8, rise: 0.3, name: 'west footbridge' },
  { x: 19, w: 2.8, rise: 0.3, name: 'east footbridge' },
]
/** spawn: on the arrival forecourt, facing north through the gateway toward Chad Square and the citadel */
export const SPAWN = { x: 0, z: 64.5, yaw: Math.PI }
export const GATEWAY = { z: 51 }
/** the closed valley gate at the south edge (the road down to the rest of the city continues beyond it) */
export const VALLEY_GATE = { x: 0, z: 74.2 }
export const RIDES = { x: 12, z: 66.5 }
export const ARCADE_STREET = { z: 19, x0: 30, x1: 50 }
export const ARCADE = { x: 52.5, z: 19 }
export const COURTYARD = { x: 22, z: 6.5 }
export const GARDEN = { x: -44, z: 23 }
export const OVERLOOK = { x: -53, z: 38.5 }
export const SOCIAL = { x: -38.5, z: 2.5 }
/** Haunted Quarter: the gate on the west road, the main lane (z), the cross lane (x), the little square where they meet */
export const HQ = { gateX: -58.6, laneZ: 2.5, crossX: -80, square: { x: -80, z: 2.5 } }

const inRect = (x: number, z: number, r: Rect, m = 0) => x > r.x0 + m && x < r.x1 - m && z > r.z0 + m && z < r.z1 - m

/** is (x, z) on walkable city ground (with an inward margin m)? */
export function insideCity(x: number, z: number, m = 0) {
  if (Math.hypot(x, z) < CORE_R - m) return true
  if (m >= 0 && inLake(x, z, m)) return false
  return RECTS.some((r) => inRect(x, z, r, m))
}

/** clamp a point into the walkable union (margin m inside every edge): nearest legal point */
export function clampToCity(p: { x: number; z: number }, m: number) {
  if (insideCity(p.x, p.z, m)) return
  if (inLake(p.x, p.z, m)) {
    // off the pier into the water: back onto the pier if that's nearest, else out to the shore
    const k = (1 + m / LAKE.rz) / Math.max(1e-3, lakeR(p.x, p.z))
    let bx = LAKE.x + (p.x - LAKE.x) * k
    let bz = LAKE.z + (p.z - LAKE.z) * k
    let bd = Math.hypot(p.x - bx, p.z - bz)
    for (const r of [PIER, PIER.head]) {
      const cx = Math.min(Math.max(p.x, r.x0 + m), r.x1 - m)
      const cz = Math.min(Math.max(p.z, r.z0 + m), r.z1 - m)
      const d = Math.hypot(p.x - cx, p.z - cz)
      if (d < bd) [bx, bz, bd] = [cx, cz, d]
    }
    p.x = bx
    p.z = bz
    return
  }
  let bx = p.x
  let bz = p.z
  let bd = Infinity
  const d0 = Math.hypot(p.x, p.z)
  const R = CORE_R - m
  if (d0 > 1e-6) {
    const cx = (p.x / d0) * R
    const cz = (p.z / d0) * R
    const d = Math.hypot(p.x - cx, p.z - cz)
    if (d < bd) [bx, bz, bd] = [cx, cz, d]
  }
  for (const r of RECTS) {
    const cx = Math.min(Math.max(p.x, r.x0 + m), r.x1 - m)
    const cz = Math.min(Math.max(p.z, r.z0 + m), r.z1 - m)
    const d = Math.hypot(p.x - cx, p.z - cz)
    if (d < bd) [bx, bz, bd] = [cx, cz, d]
  }
  p.x = bx
  p.z = bz
}

/** distance from (x, z) to the walkable union (0 inside) — drives the cliff profile */
export function outsideDistance(x: number, z: number) {
  if (insideCity(x, z)) return 0
  let d = Math.max(0, Math.hypot(x, z) - CORE_R)
  for (const r of RECTS) {
    const dx = Math.max(r.x0 - x, 0, x - r.x1)
    const dz = Math.max(r.z0 - z, 0, z - r.z1)
    d = Math.min(d, Math.hypot(dx, dz))
  }
  return d
}

/** the bridge deck height at (x, z), or null if not on a bridge */
export function bridgeHeight(x: number, z: number) {
  if (z < CANAL.z0 - 0.6 || z > CANAL.z1 + 0.6) return null
  for (const b of BRIDGES) {
    if (Math.abs(x - b.x) > b.w / 2) continue
    const t = Math.min(1, Math.max(0, (z - (CANAL.z0 - 0.6)) / (CANAL.z1 - CANAL.z0 + 1.2)))
    return Math.sin(t * Math.PI) * b.rise
  }
  return null
}

/** is (x, z) over open canal water (not a bridge)? */
export function inCanal(x: number, z: number, m = 0) {
  if (x < CANAL.x0 - m || x > CANAL.x1 + m || z < CANAL.z0 - m || z > CANAL.z1 + m) return false
  return !BRIDGES.some((b) => Math.abs(x - b.x) < b.w / 2 - m)
}

/** Terrain: flat city plateau (y 0), the canal cut, a short lip, a steep cliff, then the valley sinking to −44. */
export function terrainHeight(x: number, z: number) {
  // the lake bowl: a gentle bank down from the shore, deepest in the middle
  const lr = lakeR(x, z)
  if (lr < 1) return -0.04 - 1.9 * Math.pow(1 - lr * lr, 0.6)
  // the cut sits 0.3 m behind the embankment wall faces, so the walls hide the drop
  if (x > CANAL.x0 - 0.3 && x < CANAL.x1 + 0.3 && z > CANAL.z0 - 0.3 && z < CANAL.z1 + 0.3) return CANAL.floor
  const d = outsideDistance(x, z)
  if (d <= 0) return 0
  if (d < 2.5) return -0.1 * d
  const t = Math.min(1, (d - 2.5) / 30)
  const cliff = -0.25 - 31.5 * (t * t * (3 - 2 * t))
  return d < 33 ? cliff : cliff - Math.min(12, (d - 33) * 0.07)
}

/** grid lines for the terrain mesh: dense over the city, sparse toward the horizon, exact at canal edges */
export function terrainLines(axis: 'x' | 'z') {
  const s = new Set<number>()
  const lo = axis === 'x' ? -106 : -72
  const hi = axis === 'x' ? 132 : 74
  for (let v = lo; v <= hi; v += 2) s.add(v)
  for (const v of [70, 80, 95, 115, 140, 175, 220, 280, 360, 460]) {
    if (axis === 'x' && v <= 132 && v >= 70) {
      s.add(v)
      continue // west of the old town the land is dense now (the Haunted Quarter); the east side stays coarse
    }
    s.add(v)
    s.add(-v)
  }
  // one line just outside the cut (ground level) + one just inside it (canal floor): a vertical drop hidden in the walls
  if (axis === 'z') for (const v of [CANAL.z0 - 0.42, CANAL.z0 - 0.25, CANAL.z1 + 0.25, CANAL.z1 + 0.42]) s.add(v)
  else for (const v of [CANAL.x0 - 0.42, CANAL.x0 - 0.25, CANAL.x1 + 0.25, CANAL.x1 + 0.42]) s.add(v)
  return [...s].sort((a, b) => a - b)
}
