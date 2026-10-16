import type * as THREE from 'three'
import { COURSES, HEADROOM, PLATFORMS, REACH_MAX, REACH_MIN, medalFor, platformInside, type Checkpoint, type Course, type CourseId, type Platform } from './parkour'

/**
 * Platform physics + vault/mantle + the timed-run state machine for the Parkour Yard. Pure logic (no scene graph): World feeds it the
 * player's position and applies what it returns, and the tests drive the same functions.
 */
const STEP = 0.3
const KERB = 0.12
const BODY_H = 1.75

/** the height of the surface under (x, z) for feet at y: the tallest platform top within a step of the feet, else 0 */
export function platformFloor(x: number, z: number, y: number, list: Platform[] = PLATFORMS) {
  let best = 0
  for (const p of list) {
    if (p.top <= KERB || p.top > y + STEP + 1e-3 || p.top <= best) continue
    if ((p.bottom ?? 0) > y + 0.01 && p.top - y > STEP) continue
    if (platformInside(p, x, z)) best = p.top
  }
  return best
}

/** push a body of radius r out of every platform it is beside (feet above the top, or the head under the slab, pass) */
export function platformResolve(pos: THREE.Vector3, r: number, feetY: number, list: Platform[] = PLATFORMS) {
  for (const p of list) {
    if (feetY >= p.top - 0.12) continue
    if (feetY + BODY_H <= (p.bottom ?? 0)) continue
    const cx = Math.max(p.minX, Math.min(pos.x, p.maxX))
    const cz = Math.max(p.minZ, Math.min(pos.z, p.maxZ))
    const dx = pos.x - cx
    const dz = pos.z - cz
    const d = Math.hypot(dx, dz)
    if (d < r) {
      if (d > 1e-6) {
        pos.x = cx + (dx / d) * r
        pos.z = cz + (dz / d) * r
      } else {
        const pen = [pos.x - p.minX, p.maxX - pos.x, pos.z - p.minZ, p.maxZ - pos.z]
        const i = pen.indexOf(Math.min(...pen))
        if (i === 0) pos.x = p.minX - r
        else if (i === 1) pos.x = p.maxX + r
        else if (i === 2) pos.z = p.minZ - r
        else pos.z = p.maxZ + r
      }
    }
  }
}

export type TravKind = 'vault' | 'mantle'
export type TravPlan = {
  kind: TravKind
  from: { x: number; z: number; y: number }
  /** the hand-plant point at the obstacle's near face */
  edge: { x: number; z: number }
  to: { x: number; z: number; y: number }
  /** peak height of the root during the move */
  peak: number
  dur: number
  yaw: number
  /** the obstacle's top */
  top: number
  /** where the hands go: a vault plants on the middle of the top, a mantle on the near edge */
  hand: { x: number; z: number; y: number }
}
export type TravWhy = 'none' | 'no-obstacle' | 'too-high' | 'too-low' | 'headroom' | 'landing-blocked' | 'not-climbable'

/**
 * Is there something the player can vault or mantle straight ahead? `blocked(x, z, feetY)` answers "is a solid body in the way at that spot"
 * (tall colliders, the locked boundary, the world edge) so a landing can never be inside a wall or off the map. Returns a plan or why not.
 */
export function planTraverse(x: number, z: number, y: number, yaw: number, blocked: (x: number, z: number, feetY: number) => boolean, list: Platform[] = PLATFORMS, reach = 1.0): { plan: TravPlan | null; why: TravWhy } {
  const fx = Math.sin(yaw)
  const fz = Math.cos(yaw)
  // the obstacle the feet are facing: a platform whose footprint contains the point 0.8 m ahead (with a hand's reach of margin), feet outside it
  // walk a ray from the feet out to `reach`: the first platform it enters (the nearest face), tallest if several share that step
  let hit: Platform | null = null
  for (let d = 0.1; d <= reach && !hit; d += 0.1) {
    const ax = x + fx * d
    const az = z + fz * d
    for (const p of list) {
      if (platformInside(p, x, z, 0.05)) continue
      if (!platformInside(p, ax, az, 0.08)) continue
      if (!hit || p.top > hit.top) hit = p
    }
  }
  if (!hit) return { plan: null, why: 'no-obstacle' }
  const rise = hit.top - y
  // depth of the obstacle along the heading (a slab march: from the near face to the far face)
  let near = 0.2
  while (near < 3 && !platformInside(hit, x + fx * near, z + fz * near, 0.0)) near += 0.05
  let far = near
  while (far < 14 && platformInside(hit, x + fx * (far + 0.05), z + fz * (far + 0.05), 0.0)) far += 0.05
  const depth = far - near
  if (hit.vault) {
    if (rise > 1.4) return { plan: null, why: 'too-high' }
    if (rise < 0.4) return { plan: null, why: 'too-low' }
    if (depth > 1.1) return { plan: null, why: 'landing-blocked' }
    const lx = x + fx * (far + 0.7)
    const lz = z + fz * (far + 0.7)
    // the landing's own floor: another platform it is over (within a step of our feet) else the ground; never inside a taller solid
    const ly = platformFloor(lx, lz, y)
    if (blocked(lx, lz, ly) || list.some((p) => p !== hit && p.top > ly + STEP && (p.bottom ?? 0) < ly + BODY_H && platformInside(p, lx, lz, 0.35))) return { plan: null, why: 'landing-blocked' }
    if (y - ly > 1.6) return { plan: null, why: 'landing-blocked' }
    return {
      plan: { kind: 'vault', from: { x, z, y }, edge: { x: x + fx * (near - 0.2), z: z + fz * (near - 0.2) }, to: { x: lx, z: lz, y: ly }, peak: Math.max(hit.top, ly) + 0.38, dur: 0.64, yaw, top: hit.top, hand: { x: x + fx * (near + depth * 0.5), z: z + fz * (near + depth * 0.5), y: hit.top + 0.02 } },
      why: 'none',
    }
  }
  if (!hit.climb) return { plan: null, why: 'not-climbable' }
  if (rise > REACH_MAX) return { plan: null, why: 'too-high' }
  if (rise < Math.max(REACH_MIN, 0.75)) return { plan: null, why: 'too-low' }
  // standing room: a spot 0.55 m in from the near face, with the body's width inside the top and nothing overhead
  const ux = x + fx * (near + 0.55)
  const uz = z + fz * (near + 0.55)
  if (!platformInside(hit, ux, uz, -0.3)) return { plan: null, why: 'landing-blocked' }
  if (list.some((p) => p !== hit && (p.bottom ?? 0) >= hit.top - 0.05 && (p.bottom ?? 0) < hit.top + HEADROOM && platformInside(p, ux, uz, 0.3))) return { plan: null, why: 'headroom' }
  if (blocked(ux, uz, hit.top)) return { plan: null, why: 'landing-blocked' }
  return {
    plan: { kind: 'mantle', from: { x, z, y }, edge: { x: x + fx * (near - 0.28), z: z + fz * (near - 0.28) }, to: { x: ux, z: uz, y: hit.top }, peak: hit.top + 0.2, dur: 0.8, yaw, top: hit.top, hand: { x: x + fx * (near + 0.1), z: z + fz * (near + 0.1), y: hit.top + 0.02 } },
    why: 'none',
  }
}

const ease = (u: number) => u * u * (3 - 2 * u)
export type TravFrame = { x: number; z: number; y: number; pitch: number; roll: number; done: boolean }
/** where the body is `u` (0…1) of the way through a plan, and how it is leaning */
export function travAt(pl: TravPlan, u: number): TravFrame {
  u = Math.min(1, Math.max(0, u))
  if (pl.kind === 'vault') {
    // a speed vault: run into the hand-plant, hips up and over, land beyond (the arc peaks over the obstacle)
    const h = ease(u)
    const x = pl.from.x + (pl.to.x - pl.from.x) * h
    const z = pl.from.z + (pl.to.z - pl.from.z) * h
    const base = pl.from.y + (pl.to.y - pl.from.y) * h
    const arc = Math.sin(Math.PI * Math.min(1, u * 1.04)) // 0 → 1 → 0
    const y = base + arc * (pl.peak - Math.max(pl.from.y, pl.to.y))
    return { x, z, y, pitch: Math.sin(Math.PI * u) * 0.75, roll: Math.sin(Math.PI * u) * 0.42, done: u >= 1 }
  }
  // mantle: reach for the edge (0–0.2), pull up (0.2–0.7), stand over the top (0.7–1)
  let x: number
  let z: number
  let y: number
  if (u < 0.2) {
    const k = ease(u / 0.2)
    x = pl.from.x + (pl.edge.x - pl.from.x) * k
    z = pl.from.z + (pl.edge.z - pl.from.z) * k
    y = pl.from.y + k * 0.1
  } else if (u < 0.7) {
    const k = ease((u - 0.2) / 0.5)
    x = pl.edge.x + (pl.to.x - pl.edge.x) * 0.35 * k
    z = pl.edge.z + (pl.to.z - pl.edge.z) * 0.35 * k
    y = pl.from.y + 0.1 + (pl.peak - pl.from.y - 0.1) * k
  } else {
    const k = ease((u - 0.7) / 0.3)
    x = pl.edge.x + (pl.to.x - pl.edge.x) * (0.35 + 0.65 * k)
    z = pl.edge.z + (pl.to.z - pl.edge.z) * (0.35 + 0.65 * k)
    y = pl.peak + (pl.to.y - pl.peak) * k
  }
  const lean = u < 0.2 ? u / 0.2 : u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3
  return { x, z, y, pitch: lean * 0.42, roll: 0, done: u >= 1 }
}

/* ───────── the timed run ───────── */
export type RunState = { course: Course; ms: number; cp: number; falls: number; done: boolean; result?: RunResult }
export type RunResult = { ms: number; falls: number; medal: 0 | 1 | 2 | 3; coins: number; newBest: boolean; best: number; xp: number }
export type RunEvent = { type: 'checkpoint'; index: number } | { type: 'fall'; to: Checkpoint } | { type: 'finish' } | { type: 'none' }

export class ParkourRun {
  run: RunState | null = null
  start(id: CourseId) {
    this.run = { course: COURSES[id], ms: 0, cp: -1, falls: 0, done: false }
  }
  cancel() {
    this.run = null
  }
  /** where a recovery sends you: the last checkpoint, else the start pad */
  respawn(): Checkpoint {
    const r = this.run!
    return r.cp >= 0 ? r.course.checkpoints[r.cp] : r.course.start
  }
  update(dt: number, x: number, z: number, y: number, grounded: boolean): RunEvent {
    const r = this.run
    if (!r || r.done) return { type: 'none' }
    r.ms += dt * 1000
    const c = r.course
    for (let i = c.checkpoints.length - 1; i > r.cp; i--) {
      const k = c.checkpoints[i]
      if (Math.hypot(x - k.x, z - k.z) < 1.9 && Math.abs(y - k.y) < 0.9) {
        r.cp = i
        return { type: 'checkpoint', index: i }
      }
    }
    const f = c.finish
    if (grounded && Math.hypot(x - f.x, z - f.z) < f.r && Math.abs(y - f.y) < 0.7) {
      r.done = true
      return { type: 'finish' }
    }
    // a fall: standing on the ground (not on a platform top) inside a pit
    if (grounded && y < 0.35 && c.pits.some((p) => x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1) && !(c.safe ?? []).some((p) => x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1)) {
      r.falls++
      return { type: 'fall', to: this.respawn() }
    }
    return { type: 'none' }
  }
}
export { medalFor }
