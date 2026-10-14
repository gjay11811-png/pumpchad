import { RoadSys, smooth } from './roadnet'

/**
 * CITADEL MOUNTAIN — the layout maths (no three.js) for the switchback Castle Road that climbs the mountain from the Gate
 * Plaza, the summit plateau the castle stands on, and the "walkable" queries city.ts folds in.
 *
 * It is authored in a LOCAL frame (road leaving the plaza at the origin end, climbing north) and placed in the valley, west of
 * Downtown, by `CASTLE_AT`: world = local + (x, z), height = local + y. Builders draw into a group at that offset; the
 * world-frame wrappers at the bottom are what the rest of the game calls.
 *
 *            summit castle (plateau, +90 above the valley floor)
 *        ┌────────────── leg 11 ←  gatehouse
 *        │  → leg 10 ─────────┐       twelve legs, hairpins at x −16 / x 36, ~7.5 m rise each
 *        ...
 *        └── leg 0 → ─────────┘
 *               Gate Plaza · valley floor · the avenue from Downtown ends here
 */
export const CASTLE_AT = { x: -120, y: -52, z: 470 }
export const SUMMIT = { x: 10, z: -198, r: 26, y: 90 }
/** the dry moat round the castle: ring radii (from the summit centre) and depth */
export const MOAT = { r0: 26.6, r1: 31, depth: 5 }
/** the flat plaza at the foot of the road, where Downtown's avenue ends (local frame) */
export const GATE_PLAZA_LOCAL = { x0: -8, x1: 36, z0: -76, z1: -50 }
export const ROAD_W = 5.2
const X_E = 36
const X_W = -16
const LEGS = 12
const DZ = 8.6
const Z0 = -70

function buildRaw(): [number, number][] {
  const raw: [number, number][] = [[10, GATE_PLAZA_LOCAL.z1 - 2], [10, Z0]]
  for (let k = 0; k < LEGS; k++) {
    const zk = Z0 - k * DZ
    const east = k % 2 === 0
    const xEnd = k === LEGS - 1 ? 10 : east ? X_E : X_W
    raw.push([xEnd, zk])
    if (k < LEGS - 1) {
      const r = DZ / 2
      for (let a = 1; a <= 7; a++) {
        const th = (a / 8) * Math.PI
        raw.push([xEnd + (east ? 1 : -1) * r * Math.sin(th), zk - r + r * Math.cos(th)])
      }
    }
  }
  const last = Z0 - (LEGS - 1) * DZ
  raw.push([10, last - 5], [10, SUMMIT.z + SUMMIT.r - 3]) // …the approach, over the moat bridge, to the gatehouse
  return raw
}
export const ROAD = new RoadSys(buildRaw(), 0, SUMMIT.y, ROAD_W)
export const ROAD_LEN = ROAD.len
/** where the hairpins are (local x, z of each turn's apex) — lanterns, buttresses and viaduct arches go here */
export const HAIRPINS: { x: number; z: number; east: boolean }[] = Array.from({ length: LEGS - 1 }, (_, k) => ({ x: k % 2 === 0 ? X_E + DZ / 2 : X_W - DZ / 2, z: Z0 - k * DZ - DZ / 2, east: k % 2 === 0 }))

/** the visual terrain (local frame): the road-driven massif, the plateau levelled, the dry moat */
export function mountainTerrainLocal(x: number, z: number, base: number) {
  if (z > -40 || z < -310 || x < -140 || x > 190) return base
  let h = ROAD.terrain(x, z, base)
  const nearRoad = ROAD.nearest(x, z).d < ROAD_W / 2 + 0.7
  const r = Math.hypot(x - SUMMIT.x, z - SUMMIT.z)
  if (!nearRoad || (r > MOAT.r0 - 1.5 && r < MOAT.r1 + 1.5)) {
    if (r < SUMMIT.r + 14) h += (SUMMIT.y - h) * (1 - smooth(MOAT.r1, SUMMIT.r + 14, r))
    if (r > MOAT.r0 - 2 && r < MOAT.r1 + 2) h -= MOAT.depth * smooth(MOAT.r0 - 1.5, MOAT.r0 + 0.5, r) * (1 - smooth(MOAT.r1 - 0.5, MOAT.r1 + 1.5, r))
  }
  return h
}
/** the height of the massif above the valley floor at a local point (for colouring and planting) */
export const massifRise = (x: number, z: number) => Math.max(0, mountainTerrainLocal(x, z, 0))

/* ── walkable queries, local frame ── */
export function inMountainWalkLocal(x: number, z: number, m = 0) {
  if (z > GATE_PLAZA_LOCAL.z1 + 1 || z < -250) return false
  if (Math.hypot(x - SUMMIT.x, z - SUMMIT.z) < SUMMIT.r - m) return true
  return ROAD.on(x, z, m)
}
export function mountainGroundLocal(x: number, z: number): number | null {
  if (z > GATE_PLAZA_LOCAL.z1 + 1 || z < -250) return null
  const r = Math.hypot(x - SUMMIT.x, z - SUMMIT.z)
  if (r < SUMMIT.r) return SUMMIT.y
  return ROAD.ground(x, z)
}

/* ── world-frame wrappers ── */
const lx = (x: number) => x - CASTLE_AT.x
const lz = (z: number) => z - CASTLE_AT.z
export const GATE_PLAZA = {
  x0: GATE_PLAZA_LOCAL.x0 + CASTLE_AT.x,
  x1: GATE_PLAZA_LOCAL.x1 + CASTLE_AT.x,
  z0: GATE_PLAZA_LOCAL.z0 + CASTLE_AT.z,
  z1: GATE_PLAZA_LOCAL.z1 + CASTLE_AT.z,
}
export const SUMMIT_WORLD = { x: SUMMIT.x + CASTLE_AT.x, z: SUMMIT.z + CASTLE_AT.z, y: SUMMIT.y + CASTLE_AT.y, r: SUMMIT.r }
/** the Castle Road centreline in world coordinates */
export const castleRoadWorld = () => ROAD.pts.map((p) => ({ x: p.x + CASTLE_AT.x, y: p.y + CASTLE_AT.y, z: p.z + CASTLE_AT.z }))
export const inCastleWalk = (x: number, z: number, m = 0) => inMountainWalkLocal(lx(x), lz(z), m)
export function castleGround(x: number, z: number): number | null {
  const g = mountainGroundLocal(lx(x), lz(z))
  return g === null ? null : g + CASTLE_AT.y
}
export function clampToCastle(p: { x: number; z: number }, m: number) {
  const q = { x: lx(p.x), z: lz(p.z) }
  const r = Math.hypot(q.x - SUMMIT.x, q.z - SUMMIT.z)
  const rn = ROAD.nearest(q.x, q.z)
  const dRoad = rn.d - (ROAD_W / 2 - m)
  const dPlat = r - (SUMMIT.r - m)
  if (dRoad < dPlat) {
    const k = (ROAD_W / 2 - m) / Math.max(1e-6, rn.d)
    q.x = rn.px + (q.x - rn.px) * k
    q.z = rn.pz + (q.z - rn.pz) * k
  } else {
    const k = (SUMMIT.r - m) / Math.max(1e-6, r)
    q.x = SUMMIT.x + (q.x - SUMMIT.x) * k
    q.z = SUMMIT.z + (q.z - SUMMIT.z) * k
  }
  p.x = q.x + CASTLE_AT.x
  p.z = q.z + CASTLE_AT.z
}
/** the mountain-aware terrain at a world point: `baseW` is the valley/cliff profile there (world height) */
export function castleTerrain(x: number, z: number, baseW: number) {
  const lxv = lx(x)
  const lzv = lz(z)
  if (lzv > -40 || lzv < -310 || lxv < -140 || lxv > 190) return baseW
  return mountainTerrainLocal(lxv, lzv, baseW - CASTLE_AT.y) + CASTLE_AT.y
}
