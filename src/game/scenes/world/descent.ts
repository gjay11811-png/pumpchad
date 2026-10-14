import { RoadSys, smooth } from './roadnet'

/**
 * THE VALLEY ROAD — the long way down from the village plateau to Chad City, 52 m lower in the valley basin.
 *
 *   village gateway (0, 74) → straight → panoramic overlook lay-by (east of the road, z ≈ 90) → six hairpins down the notch
 *   between Mill Row and Southshore → sweeping bends south → the stone viaduct over the ravine → long curves → the
 *   City Gateway at the east end of Downtown's avenue (z 415).
 *
 * The road is ~690 m of carriageway at an even ~7.5 % grade (the drop is 52 m); at the sprint speed (7.6 m/s) the walk is
 * about 90 s, jogging (5.2 m/s) about 130 s, walking (2.2 m/s) about 5 min. All coordinates are world coordinates.
 */
export const VALLEY_Y = -52
export const DESCENT_W = 7.2
const R = 6 // turn radius on the quarter-turns
const K0 = 104 // z of the first hairpin leg
const DZ = 10
const X_W = -4
const X_E = 44
const LEGS = 6
const LAST_Z = K0 + (LEGS - 1) * DZ
/** the free bends after the hairpins (control points for the smoothed curve), ending on the avenue at z 415 */
const FREE: [number, number][] = [[X_W - R, LAST_Z + R], [-12, 182], [-2, 208], [22, 236], [46, 274], [58, 320], [62, 362], [62, 398], [57, 413], [50, 415]]

function catmull(pts: [number, number][], per = 8): [number, number][] {
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

function buildRaw(): [number, number][] {
  const raw: [number, number][] = [[0, 64], [0, K0 - R]]
  // a quarter-turn from heading south to heading east, then leg 0 east along z = K0
  for (let a = 1; a <= 5; a++) {
    const th = (a / 5) * (Math.PI / 2)
    raw.push([R - R * Math.cos(th), K0 - R + R * Math.sin(th)])
  }
  for (let k = 0; k < LEGS; k++) {
    const zk = K0 + k * DZ
    const east = k % 2 === 0
    const xEnd = east ? X_E : X_W
    raw.push([xEnd, zk])
    if (k < LEGS - 1) {
      const r = DZ / 2
      for (let a = 1; a <= 7; a++) {
        const th = (a / 8) * Math.PI
        raw.push([xEnd + (east ? 1 : -1) * r * Math.sin(th), zk + r - r * Math.cos(th)])
      }
    }
  }
  // the sixth leg runs west and ends at X_W: a quarter-turn to heading south, then the free sweeping bends to the City Gateway
  for (let a = 1; a <= 5; a++) {
    const th = (a / 5) * (Math.PI / 2)
    raw.push([X_W - R * Math.sin(th), LAST_Z + R - R * Math.cos(th)])
  }
  const free = catmull(FREE, 7)
  for (const p of free.slice(1)) raw.push(p)
  // the bridge straight: due west along the avenue's axis, a point every 4 m so the arched deck can be shaped
  for (let x = 46; x >= -14; x -= 4) raw.push([x, 415])
  return raw
}
export const DESCENT = new RoadSys(buildRaw(), 0, VALLEY_Y, DESCENT_W, { start: 26, end: 22 })
/** the stone bridge over the inlet: the road's own deck, lifted into an arch (east bank → the City Gateway) */
export const BRIDGE = { z: 415, xEast: 47, xWest: -3, rise: 3.6 }
DESCENT.raise(DESCENT.nearest(BRIDGE.xEast, BRIDGE.z).s, DESCENT.nearest(BRIDGE.xWest, BRIDGE.z).s, BRIDGE.rise)
export const DESCENT_LEN = DESCENT.len
/** the viaduct: the arc-length range where the road crosses the ravine on arches (the ground falls away beneath it) */
export const VIADUCT = (() => {
  const a = DESCENT.nearest(46, 274).s
  const b = DESCENT.nearest(56, 340).s
  return { s0: Math.min(a, b), s1: Math.max(a, b), depth: 15 }
})()
/** the panoramic overlook lay-by, on the east side of the straight below the gateway */
export const OVERLOOK = { x: 14, z: 88, r: 7 }

/** the footway joining the road to the terrace (walkable) */
export const OVERLOOK_LINK = { x0: 0, x1: 10, z0: 85, z1: 91 }
const inLink = (x: number, z: number, m: number) => x > OVERLOOK_LINK.x0 + m * 0 && x < OVERLOOK_LINK.x1 + m * 0 && z > OVERLOOK_LINK.z0 + m && z < OVERLOOK_LINK.z1 - m
const inTerrace = (x: number, z: number, m: number) => Math.hypot(x - OVERLOOK.x, z - OVERLOOK.z) < OVERLOOK.r - m

export const inDescentWalk = (x: number, z: number, m = 0) => {
  if (z < 60 || z > 430 || x < -40 || x > 120) return false
  return DESCENT.on(x, z, m) || inTerrace(x, z, m) || inLink(x, z, m)
}
export function descentGround(x: number, z: number): number | null {
  if (z < 60 || z > 430 || x < -40 || x > 120) return null
  const g = DESCENT.ground(x, z)
  if (g !== null) return g
  if (inTerrace(x, z, -0.01) || inLink(x, z, -0.01)) return DESCENT.nearest(OVERLOOK.x, OVERLOOK.z).y
  return null
}
export function clampToDescent(p: { x: number; z: number }, m: number) {
  // candidates: the road, the terrace, the link — take the nearest legal point
  const cands: { x: number; z: number }[] = []
  const r = { x: p.x, z: p.z }
  DESCENT.clamp(r, m)
  cands.push(r)
  if (Math.abs(p.x - OVERLOOK.x) < 20 && Math.abs(p.z - OVERLOOK.z) < 20) {
    const k = (OVERLOOK.r - m) / Math.max(1e-6, Math.hypot(p.x - OVERLOOK.x, p.z - OVERLOOK.z))
    cands.push(k < 1 ? { x: OVERLOOK.x + (p.x - OVERLOOK.x) * k, z: OVERLOOK.z + (p.z - OVERLOOK.z) * k } : { x: p.x, z: p.z })
    cands.push({ x: Math.min(Math.max(p.x, OVERLOOK_LINK.x0), OVERLOOK_LINK.x1), z: Math.min(Math.max(p.z, OVERLOOK_LINK.z0 + m), OVERLOOK_LINK.z1 - m) })
  }
  let best = cands[0]
  let bd = Math.hypot(p.x - best.x, p.z - best.z)
  for (const c of cands) {
    const d = Math.hypot(p.x - c.x, p.z - c.z)
    if (d < bd) [best, bd] = [c, d]
  }
  p.x = best.x
  p.z = best.z
}
/** the terrain with the valley road in it: `base` is the plateau-cliff / valley-floor profile at the point */
export function descentTerrain(x: number, z: number, base: number) {
  if (z < 56 || z > 440 || x < -60 || x > 150) return base
  let h = DESCENT.terrain(x, z, base)
  // the overlook terrace: level with the road beside it
  const ro = Math.hypot(x - OVERLOOK.x, z - OVERLOOK.z)
  if (ro < OVERLOOK.r + 5) {
    const y = DESCENT.nearest(OVERLOOK.x, OVERLOOK.z).y
    h += (y - 0.05 - h) * (1 - smooth(OVERLOOK.r - 0.5, OVERLOOK.r + 5, ro))
  }
  // the ravine under the viaduct
  const n = DESCENT.nearest(x, z)
  if (n.s > VIADUCT.s0 - 4 && n.s < VIADUCT.s1 + 4) {
    const along = smooth(VIADUCT.s0 - 4, VIADUCT.s0 + 8, n.s) * (1 - smooth(VIADUCT.s1 - 8, VIADUCT.s1 + 4, n.s))
    const across = 1 - smooth(DESCENT_W / 2 + 1, DESCENT_W / 2 + 22, n.d)
    const floor = Math.max(base, n.y - VIADUCT.depth)
    h = Math.min(h, h + (floor - h) * along * across)
  }
  return h
}
