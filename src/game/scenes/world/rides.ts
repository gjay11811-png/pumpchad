import * as THREE from 'three'
import type { Town } from './buildings'
import { RIDES, VALLEY_GATE } from './city'
import { tube } from '../gym/gymArt'
import { Frame, PANEL, channelLetters, panelTexture, postedBoard, type SignMats } from './signs'

/**
 * CHAD RIDES teaser by the valley gate: a rental shelter with a dimensional sign, a hoop rack with three bikes
 * (frame, wheels with tyres + spokes, crank + chainring, pedals, saddle, bars), a COMING SOON notice and a
 * paved path that runs to the closed gate. Inspect only — no riding yet.
 */

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

/** one bike, local frame: wheels along X (rear −x), ground y = 0, facing +x */
function bike(F: Frame, paint: THREE.Material, M: { tyre: THREE.Material; steel: THREE.Material; seat: THREE.Material; chrome: THREE.Material }) {
  const R = 0.34 // wheel radius
  const rear = V(-0.52, R, 0)
  const front = V(0.55, R, 0)
  const bb = V(-0.02, 0.3, 0) // bottom bracket
  const seatTop = V(-0.2, 0.86, 0)
  const head = V(0.38, 0.86, 0)
  const headLow = V(0.42, 0.72, 0)
  const T = (a: THREE.Vector3, b: THREE.Vector3, r: number, m: THREE.Material) => F.put(tube(a, b, r, 8), m)
  // frame: top tube, down tube, seat tube, chain + seat stays (both sides), head tube, fork
  T(seatTop, head, 0.022, paint)
  T(bb, headLow, 0.026, paint)
  T(bb, seatTop, 0.024, paint)
  T(headLow, head.clone().setY(0.92), 0.028, paint)
  for (const z of [-0.055, 0.055]) {
    T(bb.clone().setZ(z * 0.6), rear.clone().setZ(z), 0.014, paint)
    T(seatTop.clone().setZ(z * 0.4).add(V(0, -0.04, 0)), rear.clone().setZ(z), 0.013, paint)
    T(headLow.clone().setZ(z * 0.6), front.clone().setZ(z), 0.016, paint)
  }
  // wheels: tyre, rim, hub, spokes
  for (const c of [rear, front]) {
    F.put(new THREE.TorusGeometry(R - 0.02, 0.026, 8, 28), M.tyre, c.x, c.y, c.z)
    F.put(new THREE.TorusGeometry(R - 0.05, 0.008, 4, 28), M.chrome, c.x, c.y, c.z)
    F.put(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 10).rotateX(Math.PI / 2), M.steel, c.x, c.y, c.z)
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI
      F.put(new THREE.BoxGeometry(0.005, (R - 0.05) * 2, 0.005), M.steel, c.x, c.y, c.z, 0, 0, a)
    }
  }
  // drivetrain: chainring, cranks, pedals, chain
  F.put(new THREE.TorusGeometry(0.09, 0.012, 4, 18), M.steel, bb.x, bb.y, 0.07)
  for (const [s, a] of [[1, 0.6], [-1, 0.6 + Math.PI]] as const) {
    const end = V(bb.x + Math.cos(a) * 0.16, bb.y + Math.sin(a) * 0.16, s * 0.09)
    T(bb.clone().setZ(s * 0.08), end, 0.012, M.steel)
    F.box(0.1, 0.02, 0.07, M.tyre, end.x, end.y, end.z + s * 0.04)
  }
  T(V(bb.x, bb.y + 0.09, 0.07), V(rear.x, rear.y + 0.05, 0.07), 0.005, M.steel)
  T(V(bb.x, bb.y - 0.09, 0.07), V(rear.x, rear.y - 0.05, 0.07), 0.005, M.steel)
  // saddle + post, bars + stem + grips
  T(seatTop, seatTop.clone().add(V(-0.02, 0.1, 0)), 0.014, M.chrome)
  F.put(new THREE.BoxGeometry(0.24, 0.05, 0.12).translate(0, 0, 0), M.seat, seatTop.x - 0.03, seatTop.y + 0.12, 0)
  T(head.clone().setY(0.92), V(0.33, 0.98, 0), 0.016, M.chrome)
  T(V(0.33, 0.98, -0.24), V(0.33, 0.98, 0.24), 0.013, M.chrome)
  for (const z of [-0.24, 0.24]) F.put(new THREE.CylinderGeometry(0.018, 0.018, 0.09, 8).rotateX(Math.PI / 2), M.tyre, 0.33, 0.98, z + Math.sign(z) * -0.04)
  // a little orange PumpChad badge on the head tube
  F.put(new THREE.CircleGeometry(0.035, 12), M.chrome, 0.43, 0.83, 0.035)
}

export function chadRides(T: Town, trim: THREE.Material) {
  const P = T.P
  const Dp = T.disposables
  const SMt: SignMats = { frame: P.iron, metal: P.iron, gold: P.gold, stone: trim }
  const { x, z } = RIDES
  const dark = new THREE.MeshStandardMaterial({ color: '#26252b', metalness: 0.7, roughness: 0.4 })
  const tyre = new THREE.MeshStandardMaterial({ color: '#141316', roughness: 0.85 })
  const seat = new THREE.MeshStandardMaterial({ color: '#1e1b1f', roughness: 0.6 })
  const paints = [new THREE.MeshStandardMaterial({ color: '#ff7a1a', metalness: 0.4, roughness: 0.35 }), new THREE.MeshStandardMaterial({ color: '#6b3fc8', metalness: 0.4, roughness: 0.35 }), new THREE.MeshStandardMaterial({ color: '#e9e3d6', metalness: 0.3, roughness: 0.4 })]
  const letters = new THREE.MeshStandardMaterial({ color: '#ffb24a', metalness: 0.3, roughness: 0.45 })
  Dp.push(dark, tyre, seat, letters, ...paints)
  const BM = { tyre, steel: P.iron, seat, chrome: P.gold }

  // paved pad + path to the valley gate
  const pad = (x0: number, x1: number, z0: number, z1: number) => {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2)
    const u = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < u.count; i++) u.setXY(i, (u.getX(i) * (x1 - x0)) / 3, (u.getY(i) * (z1 - z0)) / 3)
    T.batch.put(g, P.cobble, (x0 + x1) / 2, 0.026, (z0 + z1) / 2, 0, 1, 1, 1, { cast: false })
  }
  pad(x - 4.5, x + 4.5, z - 3, z + 3.2)
  pad(3.2, x - 4.5, VALLEY_GATE.z - 3.2, VALLEY_GATE.z - 1.2)
  // shelter: four dark posts, sloped canopy, fascia with CHAD RIDES letters facing the forecourt (north-west)
  const S = Frame.at(T.batch, x, 0, z, Math.PI) // front of the shelter faces −z (toward the gateway)
  for (const [sx, sz] of [[-3.2, -1.3], [3.2, -1.3], [-3.2, 1.3], [3.2, 1.3]]) {
    S.box(0.14, sz < 0 ? 2.9 : 2.6, 0.14, dark, sx, sz < 0 ? 1.45 : 1.3, sz)
    S.box(0.36, 0.12, 0.36, trim, sx, 0.06, sz)
  }
  const roof = S.sub(0, 2.85, 0, 0.1, 0, 0)
  roof.box(7.0, 0.1, 3.2, dark, 0, 0, 0)
  roof.box(7.1, 0.5, 0.1, dark, 0, -0.18, 1.6) // fascia (front)
  roof.box(7.1, 0.06, 0.12, P.gold, 0, -0.42, 1.62)
  const fascia = S.sub(0, 2.5, 1.68 + 0.02, 0.1, 0, 0)
  channelLetters(fascia, 'CHAD RIDES', 0.36, 0.06, letters)
  // back panel with a painted route map
  S.box(6.4, 1.6, 0.08, dark, 0, 1.5, -1.3)
  const back = new THREE.MeshStandardMaterial({ map: panelTexture('RIDE THE VALLEY', 'trails open with Chad Rides · coming soon', 4, PANEL.purple, Dp), roughness: 0.7 })
  Dp.push(back)
  S.put(new THREE.PlaneGeometry(6.2, 1.5), back, 0, 1.5, -1.25, 0, 0, 0, false)
  // hoop rack + three bikes (parked side by side, front wheel in a hoop)
  for (let i = 0; i < 4; i++) {
    const hx = -2.1 + i * 1.4
    S.put(new THREE.TorusGeometry(0.36, 0.028, 6, 16, Math.PI), P.iron, hx, 0.02, -0.1, 0, Math.PI / 2, 0)
  }
  for (let i = 0; i < 3; i++) {
    const bxx = -2.1 + i * 1.4 + 0.18
    bike(S.sub(bxx, 0, 0.35, 0, -Math.PI / 2, 0), paints[i], BM)
  }
  T.colliders.push({ kind: 'box', minX: x - 3.4, maxX: x + 3.4, minZ: z - 1.5, maxZ: z + 1.5, h: 3 })
  // COMING SOON notice on posts, in front of the shelter
  const soon = new THREE.MeshStandardMaterial({ map: panelTexture('COMING SOON', 'bikes in a future update', 1.7, PANEL.dark, Dp), roughness: 0.7 })
  Dp.push(soon)
  postedBoard(Frame.at(T.batch, x - 5.2, 0, z - 1.6, Math.PI + 0.5), 1.2, 0.7, 1.2, soon, SMt, true)
  T.colliders.push({ kind: 'circle', x: x - 5.2, z: z - 1.6, r: 0.8, h: 1.8 })
  // a spare bike leaning on the wall by the gate (the valley trail starts here)
  bike(Frame.at(T.batch, VALLEY_GATE.x + 5.6, 0, VALLEY_GATE.z - 1.3, Math.PI), paints[1], BM)
}
