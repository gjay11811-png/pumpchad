import { platformInside, type Platform } from './parkour'

/**
 * LEDGES: catching, hanging from, shimmying along and pulling up onto the top edge of a platform (a roof, a crate stack, a wall with a walkable top).
 * Pure geometry + rules (no scene graph): World feeds in the player's state and applies the pose it returns; the tests call the same functions.
 *
 * A platform is a box; each of its four top edges is a LEDGE ("side"): n = the −z face, s = +z, w = −x, e = +x. A hanging body stands just outside the face,
 * facing the wall, its HANDS on the edge (arm IK) and its FEET `HANG_DROP` below the top. Everything that makes a catch possible is checked first: the hands
 * must reach the edge, the spot below must be free, and a pull-up needs standing room and head clearance on top.
 */
export type Side = 'n' | 's' | 'w' | 'e'
export const HANG_DROP = 1.74 // feet this far under the ledge when the hands are on it
export const BODY_OFF = 0.36 // body centre this far out from the face
export const SHIMMY_SPEED = 1.15 // m/s along the ledge
export const REACH_BAND: [number, number] = [-0.32, 0.22] // hand height relative to the top at which a catch can happen (hands = feet + HANG_DROP)
export const PULL_ROOM = 0.7 // how far in from the edge the pull-up stands
export const END_MARGIN = 0.3 // the hands stop this far from a ledge's end

export type LedgeGeom = { side: Side; ax: number; az: number; tx: number; tz: number; nx: number; nz: number; len: number; top: number }
/** the geometry of one top edge: start point A, unit tangent T (the direction of increasing s), outward normal N, length */
export function ledgeGeom(p: Platform, side: Side): LedgeGeom {
  switch (side) {
    case 'n':
      return { side, ax: p.minX, az: p.minZ, tx: 1, tz: 0, nx: 0, nz: -1, len: p.maxX - p.minX, top: p.top }
    case 's':
      return { side, ax: p.maxX, az: p.maxZ, tx: -1, tz: 0, nx: 0, nz: 1, len: p.maxX - p.minX, top: p.top }
    case 'w':
      return { side, ax: p.minX, az: p.maxZ, tx: 0, tz: -1, nx: -1, nz: 0, len: p.maxZ - p.minZ, top: p.top }
    default:
      return { side, ax: p.maxX, az: p.minZ, tx: 0, tz: 1, nx: 1, nz: 0, len: p.maxZ - p.minZ, top: p.top }
  }
}
export const SIDES: Side[] = ['n', 's', 'w', 'e']
/** the point on the ledge at distance s along it */
export const edgeAt = (g: LedgeGeom, s: number) => ({ x: g.ax + g.tx * s, z: g.az + g.tz * s })
/** where the body's centre hangs (feet height: top − HANG_DROP) */
export const hangPose = (g: LedgeGeom, s: number) => {
  const e = edgeAt(g, s)
  return { x: e.x + g.nx * BODY_OFF, z: e.z + g.nz * BODY_OFF, y: g.top - HANG_DROP, yaw: Math.atan2(-g.nx, -g.nz) }
}
/** world points for the two hands (left / right as seen from behind the hanging body, which faces the wall) on the top surface just inside the edge */
export function handPoints(g: LedgeGeom, s: number, phase = 0) {
  const e = edgeAt(g, s)
  // facing −N, the body's RIGHT is T rotated: for a body facing direction F=(fx,fz) the right vector is (−fz, fx)... with F=−N: right = (nz, −nx)
  const rx = g.nz
  const rz = -g.nx
  const spread = 0.24
  const into = 0.07 // the fingers curl over the top, a touch inside the edge
  const mk = (sign: number, lift: number) => ({ x: e.x + rx * spread * sign - g.nx * into, y: g.top + 0.02 + lift, z: e.z + rz * spread * sign - g.nz * into })
  return { left: mk(-1, Math.max(0, Math.sin(phase)) * 0.06), right: mk(1, Math.max(0, -Math.sin(phase)) * 0.06) }
}

export type Catch = { plat: Platform; g: LedgeGeom; s: number; why: 'ok' }
export type CatchWhy = 'ok' | 'none' | 'blocked'

/**
 * Is there a ledge the hands can reach right now? `x,z,feetY` is the body, `hx,hz` the (unit) direction it is moving / facing. The hands are at feet+HANG_DROP; they
 * must be within REACH_BAND of the top, the body within 0.62 m of the face, heading into it, and inside the ledge's length (minus a margin).
 * `free(x,z,y)` says whether the hanging spot is clear of solids.
 */
export function findCatch(x: number, z: number, feetY: number, hx: number, hz: number, plats: Platform[], free: (x: number, z: number, y: number) => boolean): { c: Catch | null; why: CatchWhy } {
  let best: Catch | null = null
  let bestD = 9
  let blocked = false
  const handY = feetY + HANG_DROP
  for (const p of plats) {
    if (!p.ledge) continue
    const dy = handY - p.top
    if (dy < REACH_BAND[0] || dy > REACH_BAND[1]) continue
    for (const side of SIDES) {
      const g = ledgeGeom(p, side)
      // signed distance of the body from the face (positive outside), and where along the edge it is
      const rx = x - g.ax
      const rz = z - g.az
      const out = rx * g.nx + rz * g.nz
      const s = rx * g.tx + rz * g.tz
      if (out < -0.1 || out > 0.62 + BODY_OFF - 0.3) continue
      if (s < END_MARGIN - 0.15 || s > g.len - END_MARGIN + 0.15) continue
      if (hx * -g.nx + hz * -g.nz < 0.2) continue // not moving toward the wall
      const sc = Math.min(Math.max(s, END_MARGIN), g.len - END_MARGIN)
      const pose = hangPose(g, sc)
      if (!free(pose.x, pose.z, pose.y)) {
        blocked = true
        continue
      }
      if (out < bestD) {
        bestD = out
        best = { plat: p, g, s: sc, why: 'ok' }
      }
    }
  }
  return { c: best, why: best ? 'ok' : blocked ? 'blocked' : 'none' }
}

/** can the body stand on top of this ledge: PULL_ROOM in from the edge there is platform under the feet and nothing overhead for the head? */
export function pullUpSpot(g: LedgeGeom, s: number, plats: Platform[], p: Platform, free: (x: number, z: number, y: number) => boolean) {
  const e = edgeAt(g, s)
  const x = e.x - g.nx * PULL_ROOM
  const z = e.z - g.nz * PULL_ROOM
  if (!platformInside(p, x, z, -0.3)) return null // not enough top to stand on (a thin wall, a narrow beam)
  // a ceiling over the top: another platform sitting above with its underside inside head height
  for (const q of plats) {
    if (q === p) continue
    if ((q.bottom ?? 0) >= p.top - 0.05 && (q.bottom ?? 0) < p.top + 1.8 && platformInside(q, x, z, 0.3)) return null
  }
  if (!free(x, z, p.top)) return null
  return { x, z, y: p.top, yaw: Math.atan2(-g.nx, -g.nz) }
}

/** the adjacent side when the hands reach the end of a ledge and the player keeps pressing on: a convex corner of the same box (null when there is none) */
export function cornerNext(p: Platform, g: LedgeGeom, atEnd: 1 | -1): { side: Side; s: number } | null {
  // going "forward" (+s) ends at the corner shared with the next side clockwise; going back (−s) ends at the previous one
  const order: Side[] = ['n', 'e', 's', 'w'] // clockwise seen from above (+z south)
  const i = order.indexOf(g.side)
  const next = order[(i + (atEnd === 1 ? 1 : 3)) % 4]
  const ng = ledgeGeom(p, next)
  // the new side's s=0 end is the corner we left when going on, its far end when going back
  return { side: next, s: atEnd === 1 ? 0 : ng.len }
}
