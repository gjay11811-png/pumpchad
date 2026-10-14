/**
 * CITADEL MOUNTAIN — the layout maths (no three.js): the massif's height field, the switchback Castle Road that climbs
 * it from the Gate Plaza, the summit plateau the castle stands on, and the "walkable" queries city.ts folds in.
 * One source of truth: terrain, the road mesh, collisions, the map and the tests all read this file.
 *
 *            summit castle (plateau, y 56)
 *        ┌────────────── leg 7 ←  gatehouse (10, −133)
 *        │  → leg 6 ──────────┐
 *        ...   eight legs, hairpins at x −16 / x 36, ~6.4 m rise each
 *        └── leg 0 → ─────────┘
 *               Gate Plaza (10, −58) · y 0 · from Downtown
 */
export const MOUNTAIN = { cx: 10, cz: -150, rx: 64, rz: 88, A: 67 }
export const SUMMIT = { x: 10, z: -164, r: 26, y: 56 }
/** the dry moat round the castle: ring radii (from the summit centre) and depth */
export const MOAT = { r0: 26.6, r1: 31, depth: 5 }
/** the flat plaza at the foot of the road, where Downtown's boulevard ends */
export const GATE_PLAZA = { x0: -8, x1: 36, z0: -76, z1: -50 }
/** the plateau of flat ground the mountain stands on and the city's cliff edge: visual terrain only (not walkable) */
export const SHELF = { x0: -48, x1: 112, z0: -80, z1: -8 }
export const ROAD_W = 5.2
const X_E = 36
const X_W = -16
const LEGS = 8
const DZ = 8.6
const Z0 = -70

export type RoadPt = { x: number; z: number; y: number; s: number }

/** the road centreline: gate → leg 0 east → hairpins → leg 7 west → the gatehouse approach; y rises evenly with distance */
function buildRoad(): RoadPt[] {
  const raw: [number, number][] = [[10, GATE_PLAZA.z1 - 2], [10, Z0]]
  for (let k = 0; k < LEGS; k++) {
    const zk = Z0 - k * DZ
    const east = k % 2 === 0
    const xEnd = k === LEGS - 1 ? 10 : east ? X_E : X_W
    raw.push([xEnd, zk])
    if (k < LEGS - 1) {
      // the hairpin: a semicircle bulging outward, DZ/2 radius
      const r = DZ / 2
      for (let a = 1; a <= 7; a++) {
        const th = (a / 8) * Math.PI
        raw.push([xEnd + (east ? 1 : -1) * r * Math.sin(th), zk - r + r * Math.cos(th)])
      }
    }
  }
  const last = Z0 - (LEGS - 1) * DZ
  raw.push([10, last - 6], [10, SUMMIT.z + SUMMIT.r - 3]) // …the approach, over the moat bridge, to the gatehouse
  let total = 0
  const pts: RoadPt[] = raw.map(([x, z], i) => {
    if (i) total += Math.hypot(x - raw[i - 1][0], z - raw[i - 1][1])
    return { x, z, y: 0, s: total }
  })
  for (const p of pts) p.y = SUMMIT.y * Math.min(1, p.s / total)
  return pts
}
export const ROAD: RoadPt[] = buildRoad()
export const ROAD_LEN = ROAD[ROAD.length - 1].s
/** where the hairpins are (x, z of each turn's apex) — lanterns, buttresses and viaduct arches go here */
export const HAIRPINS: { x: number; z: number; east: boolean }[] = Array.from({ length: LEGS - 1 }, (_, k) => ({ x: k % 2 === 0 ? X_E + DZ / 2 : X_W - DZ / 2, z: Z0 - k * DZ - DZ / 2, east: k % 2 === 0 }))

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** the massif's height above the shelf (the summit rises ≈ 58 m) */
export function mountainRise(x: number, z: number) {
  const u2 = ((x - MOUNTAIN.cx) / MOUNTAIN.rx) ** 2 + ((z - MOUNTAIN.cz) / MOUNTAIN.rz) ** 2
  if (u2 >= 1) return 0
  return MOUNTAIN.A * Math.pow(Math.max(0, 1 - Math.sqrt(u2 + 0.012)), 1.2)
}
/** 0 inside the mountain's footprint, 1 well outside: how far the old cliff-and-valley profile applies */
export function massifSkirt(x: number, z: number) {
  const u = Math.sqrt(((x - MOUNTAIN.cx) / MOUNTAIN.rx) ** 2 + ((z - MOUNTAIN.cz) / MOUNTAIN.rz) ** 2)
  return smooth(0.9, 1.04, u)
}
/** distance to the shelf rectangle (0 on it) */
export function shelfDist(x: number, z: number) {
  const dx = Math.max(SHELF.x0 - x, 0, x - SHELF.x1)
  const dz = Math.max(SHELF.z0 - z, 0, z - SHELF.z1)
  return Math.hypot(dx, dz)
}

/** nearest point on the road centreline: distance, interpolated height, arc length */
export function roadNearest(x: number, z: number) {
  let best = { d: Infinity, y: 0, s: 0, px: 0, pz: 0 }
  for (let i = 1; i < ROAD.length; i++) {
    const a = ROAD[i - 1]
    const b = ROAD[i]
    const vx = b.x - a.x
    const vz = b.z - a.z
    const L2 = vx * vx + vz * vz
    const t = L2 > 0 ? Math.min(1, Math.max(0, ((x - a.x) * vx + (z - a.z) * vz) / L2)) : 0
    const px = a.x + vx * t
    const pz = a.z + vz * t
    const d = Math.hypot(x - px, z - pz)
    if (d < best.d) best = { d, y: a.y + (b.y - a.y) * t, s: a.s + (b.s - a.s) * t, px, pz }
  }
  return best
}


/** is (x, z) walkable mountain ground (road, plateau; the Gate Plaza is a normal district rect)? margin m shrinks it */
export function inMountainWalk(x: number, z: number, m = 0) {
  if (z > GATE_PLAZA.z1 + 1 || z < -200) return false
  if (Math.hypot(x - SUMMIT.x, z - SUMMIT.z) < SUMMIT.r - m) return true
  return roadNearest(x, z).d < ROAD_W / 2 - m
}

/** the surface height of the walkable mountain at (x, z), or null off it */
export function mountainGround(x: number, z: number): number | null {
  if (z > GATE_PLAZA.z1 + 1 || z < -200) return null
  const r = Math.hypot(x - SUMMIT.x, z - SUMMIT.z)
  const rn = roadNearest(x, z)
  if (r < SUMMIT.r) return rn.d < ROAD_W / 2 + 1 && r > SUMMIT.r - 4 ? Math.max(SUMMIT.y, rn.y) : SUMMIT.y
  return rn.d < ROAD_W / 2 + 0.4 ? rn.y : null
}

/** push (x, z) into the walkable mountain (nearest legal point), for the clamp */
export function clampToMountain(p: { x: number; z: number }, m: number) {
  const r = Math.hypot(p.x - SUMMIT.x, p.z - SUMMIT.z)
  const rn = roadNearest(p.x, p.z)
  const dRoad = rn.d - (ROAD_W / 2 - m)
  const dPlat = r - (SUMMIT.r - m)
  if (dRoad < dPlat) {
    const k = (ROAD_W / 2 - m) / Math.max(1e-6, rn.d)
    p.x = rn.px + (p.x - rn.px) * k
    p.z = rn.pz + (p.z - rn.pz) * k
  } else {
    const k = (SUMMIT.r - m) / Math.max(1e-6, r)
    p.x = SUMMIT.x + (p.x - SUMMIT.x) * k
    p.z = SUMMIT.z + (p.z - SUMMIT.z) * k
  }
}

/**
 * The hillside is driven by the road itself: at the road the ground is the road's level; between two legs it slopes
 * evenly from one level to the other (inverse-distance blend of the two nearest, separate legs); beyond the outermost
 * leg it falls away to the base. So the road always sits on the hill, whatever the hairpins do.
 */
export function hillRise(x: number, z: number) {
  let b1 = { d: Infinity, y: 0, s: 0 }
  for (let i = 1; i < ROAD.length; i++) {
    const a = ROAD[i - 1]
    const b = ROAD[i]
    const vx = b.x - a.x
    const vz = b.z - a.z
    const L2 = vx * vx + vz * vz
    const t = L2 > 0 ? Math.min(1, Math.max(0, ((x - a.x) * vx + (z - a.z) * vz) / L2)) : 0
    const d = Math.hypot(x - (a.x + vx * t), z - (a.z + vz * t))
    if (d < b1.d) b1 = { d, y: a.y + (b.y - a.y) * t, s: a.s + (b.s - a.s) * t }
  }
  let b2 = { d: Infinity, y: 0 }
  for (let i = 1; i < ROAD.length; i++) {
    const a = ROAD[i - 1]
    const b = ROAD[i]
    if (Math.abs((a.s + b.s) / 2 - b1.s) < 24) continue // the same leg (or its hairpin): not a second leg
    const vx = b.x - a.x
    const vz = b.z - a.z
    const L2 = vx * vx + vz * vz
    const t = L2 > 0 ? Math.min(1, Math.max(0, ((x - a.x) * vx + (z - a.z) * vz) / L2)) : 0
    const d = Math.hypot(x - (a.x + vx * t), z - (a.z + vz * t))
    if (d < b2.d) b2 = { d, y: a.y + (b.y - a.y) * t }
  }
  const shelfReach = ROAD_W / 2 + 0.7
  if (b1.d < shelfReach) return { y: b1.y, d: b1.d, reach: 8 + b1.y * 0.95 } // the road shelf itself: dead level across its width
  let y = b1.y
  if (b2.d < 22 && b2.d < b1.d * 3) {
    const k = b1.d / (b1.d + b2.d) // 0 at the nearest leg → toward the other leg's level
    y = b1.y + (b2.y - b1.y) * k
  }
  // beyond the outermost leg (or past the last turn) the hill falls away at roughly 40°, with a little lumpiness
  const lump = Math.sin(x * 0.21 + z * 0.13) * 3 + Math.sin(x * 0.07 - z * 0.19) * 4
  const reach = 8 + b1.y * 0.95
  const dd = Math.max(0, b1.d + lump * Math.min(1, b1.d / 12))
  return { y: y * (1 - smooth(5, reach, dd)), d: dd, reach }
}

/**
 * The visual terrain height with the mountain in it: `oldH` is the old cliff-and-valley profile; under and around the road
 * the base is flat shelf ground (0) with the road-driven hill on top, the plateau levelled, and the cliffs beyond.
 */
export function mountainTerrain(x: number, z: number, oldH: number) {
  if (z > -40 || z < -272 || x < -100 || x > 130) return oldH
  const { y, d, reach } = hillRise(x, z)
  const r0 = Math.hypot(x - SUMMIT.x, z - SUMMIT.z)
  // the road bed itself stays dead level (except where it crosses the moat on its bridge)
  if (d < ROAD_W / 2 + 0.7 && !(r0 > MOAT.r0 - 1.5 && r0 < MOAT.r1 + 1.5)) return y - 0.05
  const skirt = smooth(reach * 0.55, reach + 18, d) // 0 near the road → the old profile again far away
  let h = oldH * skirt + y
  const r = Math.hypot(x - SUMMIT.x, z - SUMMIT.z)
  if (r < SUMMIT.r + 14) h += (SUMMIT.y - h) * (1 - smooth(MOAT.r1, SUMMIT.r + 14, r))
  // the dry moat: a ring ditch just outside the castle's plateau (the road crosses it on a stone bridge)
  if (r > MOAT.r0 - 2 && r < MOAT.r1 + 2) {
    const k = smooth(MOAT.r0 - 1.5, MOAT.r0 + 0.5, r) * (1 - smooth(MOAT.r1 - 0.5, MOAT.r1 + 1.5, r))
    h -= MOAT.depth * k
  }
  return h
}
