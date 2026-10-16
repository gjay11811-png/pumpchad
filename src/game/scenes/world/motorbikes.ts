import * as THREE from 'three'
import type { Frame } from './signs'
import { tube } from '../gym/gymArt'

/**
 * CHAD RIDES' motorbikes (original designs, no real makes): a naked street bike and a Sur-Ron-style electric dirt bike.
 * Both are built as static geometry through a Frame at ground level, facing local +x, wheels along x. Parked on a
 * kickstand with a slight lean. Spoked wheels, brake discs, sprung forks, swingarms and shocks are real parts; the
 * street bike has an engine block with finned cylinders, a tank and an exhaust, the dirt bike a slim frame, a battery
 * housing, a motor at the swingarm pivot and knobbly tyres.
 */
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
type D = (THREE.Material | THREE.Texture | THREE.BufferGeometry)[]

export type MotoMats = Record<'rubber' | 'dark' | 'steel' | 'chrome' | 'seat' | 'anod' | 'glowH' | 'glowT', THREE.Material>
export function motoMats(D: D): MotoMats {
  const std = (p: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial(p)
    D.push(m)
    return m
  }
  const glow = (c: string, k: number) => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), toneMapped: false })
    D.push(m)
    return m
  }
  return {
    rubber: std({ color: '#121214', roughness: 0.9 }),
    dark: std({ color: '#1e1e22', metalness: 0.6, roughness: 0.45 }),
    steel: std({ color: '#8c8a92', metalness: 0.9, roughness: 0.35 }),
    chrome: std({ color: '#d4d4dc', metalness: 1, roughness: 0.18 }),
    seat: std({ color: '#1a171a', roughness: 0.7 }),
    anod: std({ color: '#e0a83e', metalness: 0.9, roughness: 0.3 }), // gold anodised forks / springs
    glowH: glow('#fff2d8', 1.5),
    glowT: glow('#ff2a3a', 1.4),
  }
}

function wheel(F: Frame, c: THREE.Vector3, R: number, tyreR: number, M: MotoMats, opts: { knobs?: boolean; disc?: number; spokes?: number } = {}) {
  F.put(new THREE.TorusGeometry(R - tyreR, tyreR, 10, 32), M.rubber, c.x, c.y, c.z)
  if (opts.knobs) {
    // knobbly tyre: a ring of tread blocks around the circumference
    const n = 28
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2
      F.put(new THREE.BoxGeometry(0.035, 0.04, 0.075), M.rubber, c.x + Math.cos(a) * (R + 0.005), c.y + Math.sin(a) * (R + 0.005), c.z, 0, 0, a + (k % 2 ? 0.25 : -0.25))
    }
  }
  F.put(new THREE.TorusGeometry(R - tyreR * 2 + 0.01, 0.012, 6, 32), M.chrome, c.x, c.y, c.z) // rim
  F.put(new THREE.CylinderGeometry(0.045, 0.045, 0.14, 12).rotateX(Math.PI / 2), M.steel, c.x, c.y, c.z) // hub
  const ns = opts.spokes ?? 16
  for (let k = 0; k < ns; k++) {
    const a = (k / ns) * Math.PI
    F.put(new THREE.BoxGeometry(0.006, (R - tyreR * 2) * 2, 0.006), M.steel, c.x, c.y, c.z + (k % 2 ? 0.012 : -0.012), 0, 0, a)
  }
  if (opts.disc) F.put(new THREE.CylinderGeometry(opts.disc, opts.disc, 0.008, 24).rotateX(Math.PI / 2), M.steel, c.x, c.y, c.z + 0.06)
}

const T = (F: Frame, a: THREE.Vector3, b: THREE.Vector3, r: number, m: THREE.Material) => F.put(tube(a, b, r, 8), m)

/** the lean onto the kickstand: returns the Frame to draw the bike in (tilted ~10°), and draws the stand */
function parked(F: Frame, stand: THREE.Material, standAt: THREE.Vector3) {
  T(F, V(standAt.x, 0.34, 0.06), V(standAt.x - 0.08, 0.0, 0.26), 0.014, stand)
  return F.sub(0, 0, 0, 0.17, 0, 0)
}

/** naked street bike — 17" spoked wheels, finned twin, tank, side exhaust, inverted forks */
/** the dimensions the riding visual needs (axles, head tube, seat, bars, pegs) — kept beside the models so they never drift apart */
export const BIKE_LAYOUT = {
  surron: { R: 0.31, rear: [-0.58, 0.31], front: [0.6, 0.31], steerTop: [0.18, 0.96], seat: [-0.32, 0.81], grips: [0.2, 1.0, 0.37], pegs: [-0.08, 0.33, 0.2], frontEndX: 0.12, helmetClear: 0.0 },
  street: { R: 0.33, rear: [-0.7, 0.33], front: [0.72, 0.33], steerTop: [0.38, 1.09], seat: [-0.3, 0.95], grips: [0.36, 1.09, 0.31], pegs: [-0.12, 0.34, 0.22], frontEndX: 0.22, helmetClear: 0.0 },
} as const

export function streetBike(F0: Frame, paint: THREE.Material, M: MotoMats, opts: { ride?: boolean } = {}) {
  const R = 0.33
  const rear = V(-0.7, R, 0)
  const front = V(0.72, R, 0)
  const head = V(0.4, 0.95, 0)
  const pivot = V(-0.28, 0.46, 0)
  const F = opts.ride ? F0 : parked(F0, M.steel, V(-0.05, 0, 0.1)) // `ride`: upright, no kickstand (the riding visual draws its own)
  wheel(F, rear, R, 0.075, M, { disc: 0.12 })
  wheel(F, front, R, 0.06, M, { disc: 0.14 })
  // forks: two sprung inverted legs from the triple clamp to the front axle, fender over the wheel
  for (const z of [-0.075, 0.075]) {
    T(F, V(head.x - 0.02, head.y + 0.1, z), V(front.x - 0.02, front.y + 0.02, z), 0.022, M.anod)
    T(F, V(head.x - 0.02, head.y + 0.1, z), V(head.x + 0.06, head.y - 0.14, z), 0.03, M.dark)
  }
  F.put(new THREE.BoxGeometry(0.1, 0.012, 0.15), M.dark, head.x + 0.02, head.y + 0.12, 0) // triple clamp
  F.put(new THREE.TorusGeometry(R + 0.025, 0.012, 4, 14, Math.PI * 0.55), paint, front.x, front.y, 0, 0, 0, 0.55) // front fender arc
  // frame: tubular trellis from the head to the swingarm pivot, a subframe back to the tail
  for (const z of [-0.075, 0.075]) {
    T(F, V(head.x, head.y - 0.02, z), V(pivot.x, pivot.y + 0.1, z * 1.6), 0.02, M.dark)
    T(F, V(head.x - 0.05, head.y - 0.1, z), V(pivot.x + 0.1, pivot.y - 0.05, z * 1.4), 0.017, M.dark)
    T(F, V(pivot.x, pivot.y + 0.1, z * 1.6), V(-0.62, 0.84, z), 0.017, M.dark) // subframe
    T(F, V(pivot.x, pivot.y, z * 1.9), rear.clone().setZ(z * 1.7), 0.022, M.steel) // swingarm
  }
  T(F, V(-0.3, 0.8, 0), V(-0.46, 0.5, 0.06), 0.032, M.dark) // rear shock
  T(F, V(-0.3, 0.8, 0), V(-0.46, 0.5, 0.06), 0.02, M.anod)
  // engine: crankcase, two finned cylinders, a clutch cover
  F.put(new THREE.BoxGeometry(0.46, 0.3, 0.3), M.dark, 0, 0.4, 0)
  for (const z of [-0.07, 0.07]) {
    F.put(new THREE.BoxGeometry(0.18, 0.2, 0.1), M.dark, 0.16, 0.65, z, 0, 0, -0.5)
    for (let k = 0; k < 5; k++) F.put(new THREE.BoxGeometry(0.2, 0.014, 0.12), M.steel, 0.1 + k * 0.025, 0.58 + k * 0.05, z, 0, 0, -0.5)
  }
  F.put(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 16).rotateX(Math.PI / 2), M.chrome, 0.04, 0.42, 0.17)
  // exhaust: header down the front of the engine, a long silver can sweeping up past the tail
  T(F, V(0.2, 0.62, 0.12), V(0.18, 0.28, 0.16), 0.026, M.chrome)
  T(F, V(0.18, 0.28, 0.16), V(-0.35, 0.3, 0.2), 0.03, M.chrome)
  F.put(new THREE.CylinderGeometry(0.06, 0.06, 0.62, 14).rotateZ(Math.PI / 2 - 0.12), M.chrome, -0.62, 0.35, 0.2)
  // tank, seat, tail, mudguard, lamp
  F.put(new THREE.SphereGeometry(0.22, 16, 10).scale(1.5, 0.78, 0.9), paint, 0.14, 1.0, 0)
  F.put(new THREE.BoxGeometry(0.56, 0.08, 0.26), M.seat, -0.3, 0.9, 0)
  F.put(new THREE.BoxGeometry(0.34, 0.1, 0.17), paint, -0.72, 0.93, 0, 0, 0, 0.18)
  F.box(0.04, 0.04, 0.12, M.glowT, -0.9, 0.93, 0, false)
  F.put(new THREE.BoxGeometry(0.34, 0.012, 0.13), M.dark, -0.84, 0.64, 0, 0, 0, 0.35)
  F.put(new THREE.SphereGeometry(0.1, 12, 10).scale(0.7, 1, 1), M.glowH, head.x + 0.2, head.y + 0.02, 0)
  F.put(new THREE.TorusGeometry(0.1, 0.01, 6, 16), M.chrome, head.x + 0.22, head.y + 0.02, 0, 0, Math.PI / 2, 0)
  // bars: a tubular handlebar with grips, mirrors on stalks, a small clock
  T(F, V(head.x - 0.04, head.y + 0.14, -0.34), V(head.x - 0.04, head.y + 0.14, 0.34), 0.013, M.chrome)
  for (const z of [-0.34, 0.34]) {
    F.put(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 8).rotateX(Math.PI / 2), M.rubber, head.x - 0.04, head.y + 0.14, z + Math.sign(z) * -0.03)
    T(F, V(head.x - 0.04, head.y + 0.14, z * 0.9), V(head.x - 0.18, head.y + 0.28, z * 1.05), 0.008, M.dark)
    F.put(new THREE.SphereGeometry(0.035, 8, 6).scale(1, 0.8, 0.3), M.dark, head.x - 0.18, head.y + 0.3, z * 1.05)
  }
  F.put(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 12).rotateZ(Math.PI / 2 - 0.5), M.dark, head.x - 0.05, head.y + 0.2, 0)
  for (const z of [-0.22, 0.22]) F.box(0.12, 0.025, 0.05, M.steel, -0.12, 0.34, z) // foot pegs
}

/** Sur-Ron-style electric dirt bike — slim frame, big battery housing, a motor at the pivot, long-travel forks, knobbly tyres */
export function eBike(F0: Frame, paint: THREE.Material, M: MotoMats, opts: { ride?: boolean } = {}) {
  const R = 0.31
  const rear = V(-0.58, R, 0)
  const front = V(0.6, R, 0)
  const head = V(0.3, 0.8, 0)
  const pivot = V(-0.22, 0.4, 0)
  const F = opts.ride ? F0 : parked(F0, M.steel, V(-0.05, 0, 0.1)) // `ride`: upright, no kickstand (the riding visual draws its own)
  wheel(F, rear, R, 0.065, M, { knobs: true, spokes: 14, disc: 0.1 })
  wheel(F, front, R, 0.055, M, { knobs: true, spokes: 14, disc: 0.12 })
  // long-travel inverted forks (gold) angled back from the bars, a high beak fender
  for (const z of [-0.07, 0.07]) {
    T(F, V(head.x - 0.12, head.y + 0.16, z), V(front.x, front.y, z), 0.021, M.anod)
    T(F, V(head.x - 0.1, head.y + 0.14, z), V(head.x + 0.08, head.y - 0.12, z), 0.028, M.dark)
  }
  F.put(new THREE.BoxGeometry(0.34, 0.014, 0.14), paint, front.x - 0.05, 0.66, 0, 0, 0, -0.35)
  // the slim aluminium frame: a loop from the head tube, over the battery, down to the swingarm pivot
  for (const z of [-0.065, 0.065]) {
    T(F, V(head.x, head.y, z), V(-0.3, 0.68, z), 0.02, M.steel)
    T(F, V(head.x - 0.02, head.y - 0.12, z), V(pivot.x + 0.08, pivot.y + 0.02, z), 0.02, M.steel)
    T(F, V(-0.3, 0.68, z), V(pivot.x, pivot.y + 0.1, z), 0.018, M.steel)
    T(F, V(pivot.x, pivot.y, z * 1.7), rear.clone().setZ(z * 1.5), 0.02, M.steel) // swingarm
  }
  // the battery housing in the frame triangle, with a charge indicator
  F.put(new THREE.BoxGeometry(0.52, 0.3, 0.2), paint, 0, 0.56, 0, 0, 0, -0.18)
  F.put(new THREE.BoxGeometry(0.5, 0.05, 0.22), M.dark, 0, 0.7, 0, 0, 0, -0.18)
  F.box(0.04, 0.12, 0.014, M.glowH, 0.13, 0.52, 0.108, false)
  // motor low at the swingarm pivot; chain to the rear sprocket
  F.put(new THREE.CylinderGeometry(0.11, 0.11, 0.2, 18).rotateX(Math.PI / 2), M.dark, pivot.x + 0.06, pivot.y - 0.03, 0)
  F.put(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 14).rotateX(Math.PI / 2), M.steel, pivot.x + 0.06, pivot.y - 0.03, 0.11)
  T(F, V(pivot.x + 0.04, pivot.y + 0.04, 0.13), V(rear.x, rear.y + 0.07, 0.13), 0.006, M.steel)
  T(F, V(pivot.x + 0.04, pivot.y - 0.1, 0.13), V(rear.x, rear.y - 0.07, 0.13), 0.006, M.steel)
  // rear shock with a gold coil spring, a flat motocross seat, a rear mudguard
  T(F, V(-0.3, 0.7, 0), V(-0.4, 0.42, 0.05), 0.016, M.dark)
  for (let k = 0; k < 7; k++) F.put(new THREE.TorusGeometry(0.03, 0.006, 4, 10), M.anod, -0.3 - k * 0.0145, 0.7 - k * 0.04, 0, Math.PI / 2, 0, 0.2)
  F.put(new THREE.BoxGeometry(0.62, 0.07, 0.15), M.seat, -0.32, 0.76, 0)
  F.put(new THREE.BoxGeometry(0.3, 0.012, 0.12), paint, -0.72, 0.62, 0, 0, 0, 0.5)
  F.box(0.04, 0.03, 0.08, M.glowT, -0.86, 0.66, 0, false)
  // number plate + a small lamp, wide motocross bars with hand guards
  F.put(new THREE.BoxGeometry(0.02, 0.18, 0.2), M.chrome, head.x + 0.08, head.y + 0.06, 0, 0, 0, -0.12)
  F.put(new THREE.BoxGeometry(0.03, 0.05, 0.08), M.glowH, head.x + 0.1, head.y + 0.16, 0)
  T(F, V(head.x - 0.1, head.y + 0.2, -0.4), V(head.x - 0.1, head.y + 0.2, 0.4), 0.013, M.dark)
  T(F, V(head.x - 0.06, head.y + 0.08, 0), V(head.x - 0.1, head.y + 0.2, 0), 0.016, M.dark)
  for (const z of [-0.4, 0.4]) {
    F.put(new THREE.CylinderGeometry(0.02, 0.02, 0.11, 8).rotateX(Math.PI / 2), M.rubber, head.x - 0.1, head.y + 0.2, z + Math.sign(z) * -0.03)
    F.put(new THREE.BoxGeometry(0.08, 0.04, 0.012), paint, head.x - 0.05, head.y + 0.23, z + Math.sign(z) * 0.03)
  }
  for (const z of [-0.2, 0.2]) F.box(0.1, 0.022, 0.05, M.steel, -0.08, 0.33, z) // pegs
}
