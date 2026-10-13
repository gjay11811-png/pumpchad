import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { StaticBatch } from '../world/kit'
import { bumperGeo, hubGeo, roundedPad, tube } from './gymArt'

/**
 * Chad Gym v2 equipment kit: real-proportioned, grounded gym furniture built from simple primitives and merged
 * into the hall's static batch. Every builder works in its own local frame through `Place` (position + rotation
 * stack), so a piece can be rotated to face any wall and its parts — including tilted shelves — stay attached.
 */

export type GymMats = {
  frame: THREE.Material // powder-coated black steel
  steel: THREE.Material // bare / brushed steel
  chrome: THREE.Material
  knurl: THREE.Material
  rubber: THREE.Material
  orange: THREE.Material // brand accent (painted)
  purple: THREE.Material // brand accent (painted)
  pad: THREE.Material // upholstery
  plateSteel: THREE.Material
  upright: THREE.Material // drilled upright (numbered holes)
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const ONE = new THREE.Vector3(1, 1, 1)

/** a local frame for building one piece: everything put through it inherits its position + rotation */
export class Place {
  constructor(
    readonly B: StaticBatch,
    readonly M: THREE.Matrix4,
  ) {}
  static at(B: StaticBatch, x: number, z: number, ry = 0, y = 0) {
    return new Place(B, new THREE.Matrix4().compose(V(x, y, z), _q.setFromEuler(_e.set(0, ry, 0)), ONE))
  }
  private local(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) {
    return this.M.clone().multiply(new THREE.Matrix4().compose(V(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), ONE))
  }
  /** a child frame (e.g. a tilted shelf) */
  sub(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) {
    return new Place(this.B, this.local(x, y, z, rx, ry, rz))
  }
  put(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, cast = true) {
    this.B.add(geo, mat, this.local(x, y, z, rx, ry, rz), { cast })
  }
  /** box by size at a local centre */
  box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, cast = true) {
    this.put(new THREE.BoxGeometry(w, h, d), mat, x, y, z, rx, ry, rz, cast)
  }
  /** rounded box (bevelled steel tube / padded block) */
  rbox(w: number, h: number, d: number, r: number, mat: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, cast = true) {
    this.put(new RoundedBoxGeometry(w, h, d, 2, r), mat, x, y, z, rx, ry, rz, cast)
  }
  /** round tube between two local points */
  tube(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material, seg = 8) {
    this.put(tube(a, b, r, seg), mat)
  }
  /** world-space matrix of a local point (for dynamic meshes that must sit exactly where the kit says) */
  matrix(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) {
    return this.local(x, y, z, rx, ry, rz)
  }
  world(x: number, y: number, z: number) {
    return V(x, y, z).applyMatrix4(this.M)
  }
}

/* ───────────────────────── dumbbells ───────────────────────── */

/** dumbbell sizes: head radius r (m); the heads get longer as well as wider as the weight goes up */
export const headLen = (r: number) => 0.012 + r * 1.0
export const dumbbellLength = (r: number) => 0.154 + 2 * headLen(r) + 0.014

/**
 * Rubber hex dumbbell along X: knurled handle, steel inner collars, hex heads (flat face down), chrome end caps.
 * Returned as a Group of meshes (shared geometry cache per size) so it can be held, hidden, or absorbed into the batch.
 */
const geoCache = new Map<string, THREE.BufferGeometry>()
const cached = (k: string, make: () => THREE.BufferGeometry) => {
  let g = geoCache.get(k)
  if (!g) geoCache.set(k, (g = make()))
  return g
}
export function dumbbell(r: number, M: Pick<GymMats, 'rubber' | 'knurl' | 'chrome' | 'steel'>) {
  const g = new THREE.Group()
  const hl = headLen(r)
  const handle = new THREE.Mesh(cached('h', () => new THREE.CylinderGeometry(0.0165, 0.0165, 0.13, 12).rotateZ(Math.PI / 2)), M.knurl)
  g.add(handle)
  for (const s of [-1, 1]) {
    const collar = new THREE.Mesh(cached('c', () => new THREE.CylinderGeometry(0.03, 0.03, 0.012, 14).rotateZ(Math.PI / 2)), M.steel)
    collar.position.x = s * 0.071
    const head = new THREE.Mesh(cached(`hd${r.toFixed(3)}`, () => new THREE.CylinderGeometry(r, r, hl, 6).rotateZ(Math.PI / 2)), M.rubber)
    head.position.x = s * (0.077 + hl / 2)
    const cap = new THREE.Mesh(cached(`cp${r.toFixed(3)}`, () => new THREE.CylinderGeometry(r * 0.52, r * 0.52, 0.007, 16).rotateZ(Math.PI / 2)), M.chrome)
    cap.position.x = s * (0.077 + hl + 0.0035)
    g.add(collar, head, cap)
  }
  return g
}
/** a dumbbell resting on a surface: flat hex face down, so its centre sits this high above the surface */
export const restHeight = (r: number) => r * Math.cos(Math.PI / 6)

/**
 * Freestanding three-tier dumbbell rack. Local frame: length along X (centred), front = +Z, floor y = 0.
 * Angled trays step back as they rise (stadium style); pairs run light (top-left) to heavy (bottom-right).
 * Returns the world matrix of every dumbbell slot so the caller can pull one pair out as live meshes.
 */
export type RackSlot = { r: number; tier: number; pair: number; side: 0 | 1; matrix: THREE.Matrix4 }
export const RACK = { len: 3.4, back: -0.5, front: 0.44 }
export function dumbbellRack(P: Place, M: GymMats) {
  const L = RACK.len
  const TILT = 0.2 // trays slope down toward the lifter
  const DEPTH = 0.46
  const tiers = [
    // heavy → light, bottom → top: tray centre (y, z) and the head radii of its pairs (sized for the chunky Chads)
    { y: 0.32, z: 0.12, radii: [0.1, 0.105, 0.11, 0.115, 0.12] },
    { y: 0.66, z: -0.03, radii: [0.075, 0.079, 0.083, 0.087, 0.091, 0.095] },
    { y: 1.0, z: -0.18, radii: [0.05, 0.054, 0.058, 0.062, 0.066, 0.07, 0.074] },
  ]
  const POST_Z = -0.44
  const uprightsX = [-L / 2, -L / 6, L / 6, L / 2]
  for (const x of uprightsX) {
    // base foot (front-to-back) with rubber pads at both ends, rear post, diagonal brace
    P.rbox(0.07, 0.06, 0.92, 0.008, M.frame, x, 0.03, -0.03)
    for (const z of [-0.47, 0.41]) P.rbox(0.09, 0.012, 0.07, 0.004, M.rubber, x, 0.006, z)
    P.rbox(0.065, 1.2, 0.065, 0.008, M.frame, x, 0.6 + 0.06, POST_Z)
    P.tube(V(x, 0.06, 0.35), V(x, 0.25, POST_Z + 0.03), 0.018, M.frame) // runs under the bottom tray
    // end uprights carry the orange brand plate
    if (Math.abs(x) > L / 2 - 0.01) P.box(0.012, 0.5, 0.2, M.orange, x + Math.sign(x) * 0.04, 0.85, POST_Z + 0.02)
  }
  // rear stretchers (top + bottom) tie the uprights together
  P.rbox(L + 0.07, 0.06, 0.06, 0.008, M.frame, 0, 1.25, POST_Z)
  P.rbox(L + 0.07, 0.05, 0.05, 0.008, M.frame, 0, 0.12, POST_Z)
  const slots: RackSlot[] = []
  tiers.forEach((t, ti) => {
    const S = P.sub(0, t.y, t.z, TILT)
    // tray: steel sheet with a front lip and a back lip; arms underneath at every upright
    S.box(L + 0.06, 0.012, DEPTH, M.steel, 0, 0, 0)
    S.box(L + 0.06, 0.05, 0.014, M.frame, 0, 0.02, DEPTH / 2)
    S.box(L + 0.06, 0.035, 0.014, M.frame, 0, 0.012, -DEPTH / 2)
    for (const x of uprightsX) S.box(0.05, 0.04, DEPTH, M.frame, x, -0.026, 0)
    // connector from each tray's back edge to the rear posts (shorter as the tiers step back)
    const backY = t.y + Math.sin(TILT) * (DEPTH / 2) - 0.03
    const backZ = t.z - Math.cos(TILT) * (DEPTH / 2)
    const len = backZ - POST_Z
    if (len > 0.02) for (const x of uprightsX) P.box(0.05, 0.05, len, M.frame, x, backY, POST_Z + len / 2)
    // pairs: evenly spread across the tray, each dumbbell lying front-to-back, flat face down
    const n = t.radii.length
    const span = L - 0.24
    t.radii.forEach((r, k) => {
      const cx = -span / 2 + span * ((k + 0.5) / n)
      for (const side of [0, 1] as const) {
        const x = cx + (side ? 1 : -1) * (r + 0.006)
        slots.push({ r, tier: ti, pair: k, side, matrix: S.matrix(x, 0.006 + restHeight(r), 0, 0, Math.PI / 2, 0) })
      }
    })
  })
  return slots
}

/* ───────────────────────── adjustable bench ───────────────────────── */

/**
 * Adjustable (FID) bench. Local frame: long axis along X, seat at −X, backrest hinged and inclined toward +X,
 * floor y = 0. Wheels at the seat end, a lift handle at the back end, a notched ladder and pop-pin under the back.
 * Footprint ≈ 1.36 × 0.56 m.
 */
export function adjustableBench(P: Place, M: GymMats, incline = 0.42) {
  // spine + stabilisers (front and rear), rubber end caps, transport wheels, lift handle
  P.rbox(1.22, 0.08, 0.11, 0.012, M.frame, 0, 0.115, 0)
  for (const x of [-0.6, 0.6]) {
    P.rbox(0.09, 0.07, 0.54, 0.012, M.frame, x, 0.035, 0)
    for (const z of [-0.27, 0.27]) P.rbox(0.1, 0.075, 0.03, 0.01, M.rubber, x, 0.0375, z + Math.sign(z) * 0.012)
    P.box(0.07, 0.08, 0.07, M.frame, x, 0.11, 0) // riser to the spine
  }
  for (const z of [-0.24, 0.24]) {
    const w = new THREE.CylinderGeometry(0.042, 0.042, 0.032, 16).rotateX(Math.PI / 2)
    P.put(w, M.rubber, -0.68, 0.042, z)
  }
  P.tube(V(0.64, 0.1, -0.13), V(0.76, 0.12, -0.13), 0.016, M.frame)
  P.tube(V(0.64, 0.1, 0.13), V(0.76, 0.12, 0.13), 0.016, M.frame)
  P.tube(V(0.76, 0.12, -0.14), V(0.76, 0.12, 0.14), 0.017, M.rubber)
  // seat: short post + padded seat on a steel plate
  P.box(0.06, 0.25, 0.06, M.frame, -0.32, 0.28, 0)
  P.box(0.4, 0.015, 0.24, M.steel, -0.32, 0.41, 0)
  P.put(roundedPad(0.29, 0.085, 0.42).rotateY(Math.PI / 2), M.pad, -0.32, 0.46, 0, 0, 0, 0.06)
  // back pad: hinged at x = −0.08, inclined
  const hinge = V(-0.08, 0.43, 0)
  P.put(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 12).rotateX(Math.PI / 2), M.steel, hinge.x, hinge.y, 0)
  const back = P.sub(hinge.x, hinge.y, 0, 0, 0, incline)
  back.box(0.76, 0.015, 0.22, M.steel, 0.4, 0.0, 0)
  back.put(roundedPad(0.27, 0.085, 0.8).rotateY(Math.PI / 2), M.pad, 0.41, 0.05, 0)
  // support strut from the ladder up to the underside of the back pad
  const strutTop = back.world(0.46, -0.01, 0).applyMatrix4(P.M.clone().invert())
  P.tube(V(0.42, 0.16, 0), strutTop, 0.022, M.frame)
  // the adjustment ladder: notched rail on top of the spine + orange pop-pin knob
  P.box(0.42, 0.03, 0.05, M.steel, 0.36, 0.17, 0)
  for (let i = 0; i < 6; i++) P.box(0.018, 0.026, 0.055, M.frame, 0.18 + i * 0.07, 0.195, 0)
  P.put(new THREE.CylinderGeometry(0.022, 0.022, 0.05, 12).rotateX(Math.PI / 2), M.orange, -0.18, 0.13, 0.08)
}

/* ───────────────────────── cable station (functional trainer) ───────────────────────── */

/**
 * Dual-stack functional trainer. Local frame: width along X (≈2.7 m), front = +Z, floor y = 0, height 2.3 m.
 * Two towers with guide rods and plate stacks, adjustable pulley carriages with cables and D-handles,
 * a top beam with multi-grip pull-up handles.
 */
export function cableStation(P: Place, M: GymMats) {
  const TOP = 2.28
  for (const sx of [-1, 1]) {
    const x = sx * 1.08
    // base rails + rubber feet
    P.rbox(0.42, 0.07, 0.94, 0.01, M.frame, x, 0.035, -0.02)
    for (const dz of [-0.45, 0.41]) P.rbox(0.44, 0.012, 0.08, 0.004, M.rubber, x, 0.006, dz)
    // tower: two uprights either side of the stack + top cap
    for (const ux of [-0.19, 0.19]) P.rbox(0.07, TOP, 0.07, 0.01, M.frame, x + ux, TOP / 2, -0.2)
    P.rbox(0.46, 0.08, 0.18, 0.012, M.frame, x, TOP, -0.2)
    // guide rods + plate stack (orange top plate carries the lift rod)
    for (const gx of [-0.1, 0.1]) P.put(new THREE.CylinderGeometry(0.011, 0.011, TOP - 0.2, 8), M.chrome, x + gx, 0.1 + (TOP - 0.2) / 2, -0.2)
    for (let i = 0; i < 15; i++) P.box(0.3, 0.04, 0.15, M.frame, x, 0.12 + i * 0.044, -0.2)
    P.box(0.3, 0.05, 0.15, M.orange, x, 0.12 + 15 * 0.044 + 0.004, -0.2)
    P.put(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 8), M.chrome, x, 0.12 + 15 * 0.044 + 0.27, -0.2)
    // selector pin on the side of the stack
    P.put(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 8).rotateZ(Math.PI / 2), M.steel, x + sx * 0.2, 0.12 + 9 * 0.044, -0.2)
    P.put(new THREE.SphereGeometry(0.022, 10, 8), M.orange, x + sx * 0.27, 0.12 + 9 * 0.044, -0.2)
    // swivel column out front, carriage + pulley, cable to the top pulley and down to the stack
    const cx = x - sx * 0.02
    P.rbox(0.07, 2.0, 0.07, 0.01, M.frame, cx, 1.08, 0.12)
    P.rbox(0.13, 0.17, 0.11, 0.015, M.orange, cx, 1.32, 0.12)
    P.put(new THREE.CylinderGeometry(0.055, 0.055, 0.028, 18).rotateZ(Math.PI / 2), M.steel, cx, 1.24, 0.19)
    P.put(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 18).rotateZ(Math.PI / 2), M.steel, cx, TOP - 0.02, 0.12)
    P.put(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 18).rotateZ(Math.PI / 2), M.steel, x, TOP - 0.02, -0.2)
    P.box(0.12, 0.05, 0.4, M.frame, (cx + x) / 2, TOP + 0.02, -0.04)
    P.tube(V(cx, TOP - 0.08, 0.17), V(cx, 1.3, 0.17), 0.004, M.rubber, 4)
    P.tube(V(cx, TOP - 0.08, 0.07), V(x, TOP - 0.08, -0.16), 0.004, M.rubber, 4)
    P.tube(V(x, TOP - 0.08, -0.2), V(x, 0.12 + 15 * 0.044 + 0.5, -0.2), 0.004, M.rubber, 4)
    // short cable + carabiner + D-handle hanging from the carriage
    P.tube(V(cx, 1.2, 0.21), V(cx, 1.0, 0.22), 0.004, M.rubber, 4)
    P.put(new THREE.TorusGeometry(0.018, 0.004, 6, 12), M.steel, cx, 0.985, 0.22)
    P.put(new THREE.TorusGeometry(0.075, 0.009, 6, 16, Math.PI).rotateZ(Math.PI), M.steel, cx, 0.97, 0.22)
    P.put(new THREE.CylinderGeometry(0.016, 0.016, 0.13, 10).rotateZ(Math.PI / 2), M.rubber, cx, 0.9, 0.22)
  }
  // top beam + multi-grip pull-up handles + back stretcher
  P.rbox(2.6, 0.1, 0.1, 0.012, M.frame, 0, TOP + 0.02, -0.2)
  P.rbox(2.2, 0.06, 0.06, 0.01, M.frame, 0, 0.18, -0.2)
  for (const s of [-1, 1]) {
    P.tube(V(s * 0.18, TOP - 0.03, -0.2), V(s * 0.42, TOP - 0.16, 0.12), 0.018, M.knurl)
    P.tube(V(s * 0.42, TOP - 0.16, 0.12), V(s * 0.62, TOP - 0.16, 0.12), 0.018, M.knurl)
  }
  P.tube(V(-0.18, TOP - 0.03, -0.2), V(0.18, TOP - 0.03, -0.2), 0.018, M.knurl)
  P.box(0.9, 0.18, 0.012, M.orange, 0, TOP - 0.2, -0.155) // brand plate on the beam
}

/* ───────────────────────── treadmill ───────────────────────── */

/**
 * Treadmill. Local frame: running direction +X (console end), deck along X (−1.0 … +1.0), floor y = 0.
 * `belt` is a material (its own scrolling texture when the belt should move). Deck top (belt) is at y = 0.165.
 */
export function treadmill(P: Place, M: GymMats & { console: THREE.Material; belt: THREE.Material }) {
  P.rbox(2.0, 0.14, 0.84, 0.035, M.frame, 0, 0.07, 0) // deck body
  for (const z of [-0.36, 0.36]) {
    P.rbox(1.8, 0.03, 0.08, 0.01, M.steel, -0.08, 0.155, z) // aluminium side rails (foot plates)
    for (const x of [-0.92, 0.84]) P.rbox(0.1, 0.02, 0.08, 0.008, M.rubber, x, 0.01, z) // feet
  }
  P.put(new THREE.PlaneGeometry(1.7, 0.62).rotateX(-Math.PI / 2), M.belt, -0.08, 0.162, 0, 0, 0, 0, false)
  P.put(new THREE.CylinderGeometry(0.06, 0.06, 0.66, 14).rotateX(Math.PI / 2), M.steel, -0.95, 0.1, 0) // rear roller cap
  // motor hood at the front + uprights rising to the console
  P.rbox(0.34, 0.24, 0.84, 0.05, M.frame, 0.86, 0.17, 0)
  P.box(0.3, 0.02, 0.84, M.orange, 0.86, 0.29, 0)
  for (const z of [-0.37, 0.37]) {
    P.tube(V(0.86, 0.25, z), V(0.98, 1.18, z * 0.92), 0.036, M.frame, 10)
    P.tube(V(0.96, 1.08, z * 0.92), V(0.48, 1.04, z * 0.92), 0.02, M.chrome, 10) // side handrails
    P.tube(V(0.48, 1.04, z * 0.92), V(0.44, 0.96, z * 0.92), 0.02, M.chrome, 10)
  }
  // console: angled housing with the lit screen
  const C = P.sub(1.0, 1.24, 0, 0, 0, 0.42)
  C.rbox(0.2, 0.1, 0.86, 0.03, M.frame, 0, 0, 0)
  C.put(new THREE.PlaneGeometry(0.46, 0.16).rotateX(-Math.PI / 2).rotateY(Math.PI / 2), M.console, 0, 0.052, 0, 0, 0, 0, false) // on the top face, tilted toward the runner
  C.tube(V(-0.05, 0.0, -0.38), V(-0.05, 0.0, 0.38), 0.018, M.rubber)
}

/* ───────────────────────── barbell storage ───────────────────────── */

/** a plate stored on a horizontal peg/horn (axis along local X) */
export function storedPlate(P: Place, M: GymMats, x: number, y: number, z: number, r: number, w: number, orange: boolean, ry = 0) {
  P.put(bumperGeo(r, w), orange ? M.orange : M.rubber, x, y, z, 0, ry, 0)
  P.put(hubGeo(w), M.plateSteel, x, y, z, 0, ry, 0)
}

/* ───────────────────────── entrance ───────────────────────── */

/** reception desk. Local frame: counter front = +Z, length along X, floor y = 0. */
export function receptionDesk(P: Place, M: GymMats & { top: THREE.Material; brand: THREE.Material; glowPurple: THREE.Material; screen: THREE.Material }) {
  const L = 2.4
  // front counter: dark panel body, brand panel, raised transaction ledge, purple kick light
  P.rbox(L, 1.06, 0.62, 0.02, M.frame, 0, 0.53, 0)
  P.put(new THREE.PlaneGeometry(1.5, 0.42), M.brand, 0, 0.62, 0.312, 0, 0, 0, false)
  P.rbox(L + 0.06, 0.04, 0.34, 0.01, M.top, 0, 1.1, 0.17)
  P.box(L - 0.1, 0.025, 0.02, M.glowPurple, 0, 0.05, 0.312, 0, 0, 0, false)
  // work surface behind, monitor, card reader, a few towels
  P.rbox(L, 0.04, 0.5, 0.01, M.top, 0, 0.78, -0.5)
  for (const x of [-L / 2 + 0.05, L / 2 - 0.05]) P.box(0.05, 0.76, 0.48, M.frame, x, 0.38, -0.5)
  P.box(0.08, 0.2, 0.06, M.frame, 0.45, 0.9, -0.5)
  P.rbox(0.56, 0.34, 0.03, 0.01, M.frame, 0.45, 1.13, -0.48, 0, -0.3)
  P.put(new THREE.PlaneGeometry(0.5, 0.28), M.screen, 0.45 + 0.014, 1.13, -0.464, 0, -0.3, 0, false)
  P.rbox(0.09, 0.03, 0.14, 0.01, M.frame, -0.5, 1.135, 0.2)
  for (let i = 0; i < 4; i++) P.rbox(0.34, 0.05, 0.24, 0.02, i % 2 ? M.purple : M.orange, -0.75, 0.81 + i * 0.05, -0.5)
}

/** a run of full-height lockers. Local frame: doors face +Z, length along X, floor y = 0. */
export function lockers(P: Place, M: GymMats & { locker: THREE.Material; glowOrange: THREE.Material }, n: number) {
  const W = 0.46
  const L = n * W
  P.rbox(L + 0.04, 0.12, 0.5, 0.01, M.rubber, 0, 0.06, 0) // plinth
  P.rbox(L + 0.04, 0.04, 0.52, 0.01, M.frame, 0, 2.02, 0) // crown
  for (let i = 0; i < n; i++) {
    const x = -L / 2 + W * (i + 0.5)
    P.rbox(W - 0.012, 1.86, 0.48, 0.008, M.locker, x, 1.06, 0)
    for (let k = 0; k < 4; k++) P.box(W * 0.5, 0.012, 0.004, M.frame, x, 1.78 - k * 0.035, 0.241, 0, 0, 0, false) // vents
    P.box(0.11, 0.05, 0.004, M.glowOrange, x, 1.62, 0.242, 0, 0, 0, false) // number plate
    P.rbox(0.03, 0.14, 0.03, 0.008, M.chrome, x + W * 0.32, 1.1, 0.25) // handle
  }
}

/** water station: stainless bottle-filler cabinet with a lit fill bay + cooler bottle. Front = +Z. */
export function waterStation(P: Place, M: GymMats & { glass: THREE.Material; glowBlue: THREE.Material }) {
  P.rbox(0.6, 1.2, 0.36, 0.02, M.steel, 0, 0.6, 0)
  P.box(0.4, 0.42, 0.02, M.frame, 0, 1.05, 0.18)
  P.box(0.3, 0.02, 0.02, M.glowBlue, 0, 1.24, 0.19, 0, 0, 0, false)
  P.put(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 8), M.chrome, 0, 1.2, 0.15)
  P.rbox(0.36, 0.03, 0.12, 0.01, M.frame, 0, 0.86, 0.13) // drip tray
  P.rbox(0.42, 0.08, 0.36, 0.02, M.frame, 0, 1.24, 0)
  P.put(new THREE.CylinderGeometry(0.15, 0.15, 0.4, 20), M.glass, 0, 1.48, 0)
  P.put(new THREE.CylinderGeometry(0.05, 0.15, 0.06, 20), M.glass, 0, 1.31, 0)
}

/* ───────────────────────── squat rack ───────────────────────── */

/**
 * Four-post squat rack around the lifter. Local frame: lifter stands at the origin facing +Z; uprights at x ±0.7,
 * z ±0.55; bar rests in the J-hooks on the front uprights (y 1.48, z +0.5). Spotter arms, plate horns, base rails.
 */
export function squatRack(P: Place, M: GymMats) {
  for (const sx of [-0.7, 0.7]) {
    P.rbox(0.1, 0.06, 1.34, 0.01, M.frame, sx, 0.03, 0) // side base rail
    for (const dz of [-0.62, 0.62]) P.rbox(0.13, 0.012, 0.1, 0.004, M.rubber, sx, 0.006, dz)
    for (const dz of [-0.55, 0.55]) P.box(0.075, 2.27, 0.075, M.upright, sx, 0.06 + 2.27 / 2, dz)
    P.rbox(0.08, 0.08, 1.18, 0.01, M.frame, sx, 2.33, 0) // top side member
    // J-hook on the front upright: back plate, cradle with orange liner, front lip
    const hx = sx - Math.sign(sx) * 0.065 // just inside the upright
    P.box(0.014, 0.16, 0.09, M.frame, sx - Math.sign(sx) * 0.045, 1.44, 0.5)
    P.box(0.05, 0.02, 0.12, M.frame, hx, 1.445, 0.5)
    P.box(0.046, 0.006, 0.11, M.orange, hx, 1.458, 0.5)
    P.box(0.05, 0.055, 0.016, M.frame, hx, 1.47, 0.565)
    // spotter arm (pin-pipe style safety) with an orange UHMW strip
    P.rbox(0.06, 0.06, 1.24, 0.008, M.frame, hx, 0.62, 0)
    P.box(0.05, 0.008, 1.2, M.orange, hx, 0.654, 0)
    // plate horns on the rear uprights + stored bumpers
    for (const [y, r, w, o] of [[0.36, 0.25, 0.07, true], [0.92, 0.2, 0.05, false]] as const) {
      P.tube(V(sx * 0.74, y, -0.55), V(sx * 1.06, y, -0.55), 0.025, M.steel, 10)
      storedPlate(P, M, sx * 0.82, y, -0.55, r, w, o)
      storedPlate(P, M, sx * 0.9, y, -0.55, r, w, o)
    }
  }
  P.rbox(1.5, 0.06, 0.1, 0.01, M.frame, 0, 0.03, -0.55) // rear base rail
  P.rbox(1.48, 0.08, 0.08, 0.01, M.frame, 0, 2.33, -0.55) // rear top member
  P.tube(V(-0.7, 2.27, 0.55), V(0.7, 2.27, 0.55), 0.019, M.knurl, 12) // chin-up bar
}

/* ───────────────────────── bench-press station ───────────────────────── */

/**
 * Flat bench + standalone uprights. Local frame: lifter's head toward −Z; pad top at y ≈ 0.525;
 * the bar rests in J-hooks at (0, 1.1, −0.66). Spotter arms, plate horns, H-base.
 */
export function benchStation(P: Place, M: GymMats) {
  // bench: steel deck under the leather pad, spine, front T-foot, rear post into the upright base
  P.put(roundedPad(0.32, 0.11, 1.28), M.pad, 0, 0.47, 0.06)
  P.box(0.26, 0.02, 1.2, M.steel, 0, 0.405, 0.06)
  P.rbox(0.08, 0.06, 1.12, 0.01, M.frame, 0, 0.36, 0.08)
  P.box(0.07, 0.3, 0.07, M.frame, 0, 0.21, 0.6)
  P.rbox(0.56, 0.06, 0.08, 0.01, M.frame, 0, 0.03, 0.6)
  for (const sx of [-0.27, 0.27]) P.rbox(0.07, 0.07, 0.1, 0.01, M.rubber, sx, 0.035, 0.6)
  P.box(0.07, 0.33, 0.07, M.frame, 0, 0.2, -0.42)
  P.rbox(0.07, 0.06, 0.34, 0.01, M.frame, 0, 0.03, -0.58)
  // uprights on an H-base
  P.rbox(1.24, 0.06, 0.1, 0.01, M.frame, 0, 0.03, -0.72)
  for (const sx of [-0.55, 0.55]) {
    P.rbox(0.1, 0.06, 0.52, 0.01, M.frame, sx, 0.03, -0.72)
    for (const dz of [-0.96, -0.48]) P.rbox(0.12, 0.012, 0.08, 0.004, M.rubber, sx, 0.006, dz)
    P.box(0.07, 1.3, 0.07, M.upright, sx, 0.06 + 0.65, -0.72)
    P.rbox(0.09, 0.03, 0.09, 0.008, M.frame, sx, 1.375, -0.72)
    // J-hook (opens toward the lifter)
    const hx = sx - Math.sign(sx) * 0.06 // inside the upright, under the bar
    P.box(0.05, 0.02, 0.12, M.frame, hx, 1.055, -0.66)
    P.box(0.046, 0.006, 0.11, M.orange, hx, 1.068, -0.66)
    P.box(0.05, 0.06, 0.016, M.frame, hx, 1.08, -0.595)
    // short spotter arm toward the chest + plate horn out the back with stored plates
    P.rbox(0.05, 0.05, 0.36, 0.008, M.frame, sx, 0.86, -0.5)
    P.tube(V(sx, 0.42, -0.76), V(sx, 0.42, -1.04), 0.024, M.steel, 10)
    storedPlate(P, M, sx, 0.42, -0.86, 0.225, 0.06, true, Math.PI / 2)
    storedPlate(P, M, sx, 0.42, -0.95, 0.2, 0.05, false, Math.PI / 2)
  }
}

/* ───────────────────────── kettlebell shelf ───────────────────────── */

/** two-tier kettlebell shelf. Local frame: front = +Z, length along X, floor y = 0. */
export function kettlebellShelf(P: Place, M: GymMats, kb: THREE.BufferGeometry[]) {
  const L = 2.2
  for (const x of [-L / 2, 0, L / 2]) {
    P.rbox(0.05, 0.62, 0.05, 0.008, M.frame, x, 0.31, -0.2)
    P.rbox(0.05, 0.36, 0.05, 0.008, M.frame, x, 0.18, 0.2)
    P.rbox(0.06, 0.04, 0.5, 0.008, M.frame, x, 0.02, 0)
  }
  P.box(L + 0.05, 0.02, 0.26, M.steel, 0, 0.34, 0.1)
  P.box(L + 0.05, 0.02, 0.22, M.steel, 0, 0.6, -0.13)
  for (let i = 0; i < 5; i++) {
    P.put(kb[0].clone(), M.rubber, -0.9 + i * 0.45, 0.35, 0.1)
    P.put(kb[1].clone(), M.frame, -0.9 + i * 0.45, 0.35, 0.1)
  }
  for (let i = 0; i < 6; i++) {
    P.put(kb[0].clone().scale(0.75, 0.75, 0.75), M.orange, -0.95 + i * 0.38, 0.61, -0.13)
    P.put(kb[1].clone().scale(0.75, 0.75, 0.75), M.frame, -0.95 + i * 0.38, 0.61, -0.13)
  }
}

/* ───────────────────────── turf lane + push sled ───────────────────────── */

/** artificial-turf sled lane with yard lines and a loaded push sled. Local frame: lane along X, floor y = 0. */
export function turfLane(P: Place, M: GymMats, turf: THREE.Material, len: number) {
  P.rbox(len, 0.024, 1.5, 0.008, turf, 0, 0.012, 0, 0, 0, 0, false)
  for (let i = 0; i <= 4; i++) P.box(0.05, 0.004, 1.4, M.steel, -len / 2 + 0.3 + i * ((len - 0.6) / 4), 0.026, 0, 0, 0, 0, false)
  // sled: twin skids, plate posts with stacked bumpers, tall push uprights with rubber grips
  const S = P.sub(len / 2 - 0.9, 0, 0)
  for (const z of [-0.3, 0.3]) {
    S.rbox(0.9, 0.05, 0.08, 0.02, M.frame, 0, 0.05, z)
    S.tube(V(-0.4, 0.06, z), V(-0.55, 1.15, z * 0.85), 0.022, M.frame, 10)
    S.tube(V(-0.55, 1.15, z * 0.85), V(-0.62, 1.15, z * 0.85), 0.024, M.rubber, 10)
  }
  for (const z of [-0.3, 0.3]) S.box(0.06, 0.05, 0.06, M.frame, -0.4, 0.06, z)
  S.rbox(0.62, 0.04, 0.66, 0.01, M.frame, 0.05, 0.1, 0)
  S.put(new THREE.CylinderGeometry(0.025, 0.025, 0.42, 10), M.steel, 0.1, 0.33, 0)
  for (let i = 0; i < 3; i++) {
    const g = bumperGeo(0.24 - i * 0.03, 0.06).rotateZ(Math.PI / 2)
    S.put(g, i === 0 ? M.orange : M.rubber, 0.1, 0.155 + i * 0.065, 0)
    S.put(hubGeo(0.06).rotateZ(Math.PI / 2), M.plateSteel, 0.1, 0.155 + i * 0.065, 0)
  }
}
