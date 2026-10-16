import * as THREE from 'three'
import { ST } from './config'
import { box, cyl, floor, rng, slab, type Ctx } from './kit'

/**
 * The street: asphalt carriageway with kerbs and gutters, two-tone pavements (concrete slabs + a paver furniture strip), correctly scaled lane markings
 * (2 × 3.5 m lanes, 0.12 m centre line, 0.15 m edge lines, dashed lane lines, zebra crossings with stop lines), manholes and gully grates, street lamps,
 * traffic lights at the junction, bollards, benches, bins, a postbox and tree pits. All dimensions are real-world metres.
 */
export const AVE = { z0: -122, z1: 96 } // the avenue runs from here (deep end) to the gate end
const R = ST.road
const K = ST.kerb
const P = ST.pave
const CX0 = -90
const CX1 = 90

export function buildStreet(c: Ctx) {
  const { M } = c
  const cz = ST.crossZ
  const cw = ST.cross

  /* ── carriageway: the avenue in two runs either side of the junction, and the cross street through it ── */
  floor(c, M.asphalt, -R, R, cz + cw, AVE.z1, 0.0, 4.2)
  floor(c, M.asphalt, -R, R, AVE.z0, cz - cw, 0.0, 4.2)
  floor(c, M.asphalt, CX0, CX1, cz - cw, cz + cw, 0.0, 4.2, true)
  // a faint darker wheel-path band down each lane (tyre polish): a transparent dark strip over the asphalt, very subtle
  const wear = new THREE.MeshStandardMaterial({ color: '#000000', transparent: true, opacity: 0.1, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
  c.D.push(wear)
  for (const lx of [-5.25, -1.75, 1.75, 5.25])
    for (const [za, zb] of [[cz + cw, AVE.z1], [AVE.z0, cz - cw]] as const) {
      floor(c, wear, lx - 1.15, lx - 0.55, za, zb, 0.004, 3)
      floor(c, wear, lx + 0.55, lx + 1.15, za, zb, 0.004, 3)
    }

  /* ── kerbs, gutters and pavements ──
     the avenue's pavements run unbroken except where the cross street's carriageway crosses; the cross street's own pavements start where the avenue's end */
  for (const sx of [-1, 1]) {
    const xk0 = sx > 0 ? R : -R - K // kerb
    const xk1 = sx > 0 ? R + K : -R
    const xs0 = sx > 0 ? R + K : -R - K - 1.7 // furniture strip (pavers) beside the kerb
    const xs1 = sx > 0 ? R + K + 1.7 : -R - K
    const xp0 = sx > 0 ? R + K + 1.7 : -R - K - P // slabs
    const xp1 = sx > 0 ? R + K + P : -R - K - 1.7
    for (const [za, zb] of [[cz + cw + K, AVE.z1], [AVE.z0, cz - cw - K]] as const) {
      slab(c, M.kerb, xk0, xk1, 0, 0.16, za, zb, 1.5)
      floor(c, M.pavers, xs0, xs1, za, zb, 0.16, 2)
      floor(c, M.pavement, xp0, xp1, za, zb, 0.16, 2.4)
      slab(c, M.kerb, sx > 0 ? R + K + P : -R - K - P - 0.15, sx > 0 ? R + K + P + 0.15 : -R - K - P, 0, 0.16, za, zb, 1.5) // pavement back edge
    }
  }
  // the cross street: kerbs and pavements both sides, out to the district edge
  for (const [xa, xb] of [[R, CX1], [CX0, -R]] as const)
    for (const sz of [-1, 1]) {
      const zc = cz + sz * cw
      slab(c, M.kerb, xa, xb, 0, 0.16, sz > 0 ? zc : zc - K, sz > 0 ? zc + K : zc, 1.5)
      floor(c, M.pavement, xa, xb, sz > 0 ? zc + K : zc - K - P, sz > 0 ? zc + K + P : zc - K, 0.16, 2.4)
    }

  /* ── lane markings ── */
  const white = M.paint
  const Y = 0.012
  const lines = (x: number, w: number, mat: THREE.Material, za: number, zb: number) => floor(c, mat, x - w / 2, x + w / 2, za, zb, Y, 1)
  for (const [za, zb] of [[cz + cw + 6, AVE.z1], [AVE.z0, cz - cw - 6]] as const) {
    // centre line: a pair of 0.12 m lines 0.12 m apart (no overtaking); edge lines 0.4 m in from the kerb
    lines(-0.12, 0.12, M.paintYellow, za, zb)
    lines(0.12, 0.12, M.paintYellow, za, zb)
    lines(-R + 0.45, 0.15, white, za, zb)
    lines(R - 0.45, 0.15, white, za, zb)
    // lane lines: 3 m dashes, 6 m gaps
    for (const lx of [-3.5, 3.5]) for (let z = Math.min(za, zb) + 1; z < Math.max(za, zb) - 3; z += 9) lines(lx, 0.12, white, z, z + 3)
  }
  // cross street: centre dashes
  for (let x = CX0 + 2; x < CX1 - 2; x += 9) {
    if (Math.abs(x) < R + 3) continue
    floor(c, white, x, x + 3, cz - 0.06, cz + 0.06, Y, 1)
  }
  // zebra crossings (stripes 0.5 m, gaps 0.6 m, 4 m long) with stop lines and zig-zag approach, at the junction and mid-block outside the gym
  const zebra = (zc: number) => {
    for (let x = -R + 0.9; x < R - 0.9; x += 1.1) floor(c, white, x, x + 0.5, zc - 2, zc + 2, Y, 1)
    floor(c, white, -R + 0.5, 0, zc + 2.6, zc + 2.8, Y, 1) // stop lines, one per direction of travel
    floor(c, white, 0.2, R - 0.5, zc - 2.8, zc - 2.6, Y, 1)
  }
  zebra(cz + cw + 4.5)
  zebra(cz - cw - 4.5)
  zebra(-22) // outside the gym
  // junction: stop lines and a box-junction hatch
  for (const sx of [-1, 1]) floor(c, white, sx > 0 ? 0.2 : -R + 0.5, sx > 0 ? R - 0.5 : -0.2, sx > 0 ? cz - cw - 0.2 : cz + cw + 0.0, sx > 0 ? cz - cw : cz + cw + 0.2, Y, 1)
  // cross-street edge lines
  for (const sz of [-1, 1]) for (const [xa, xb] of [[R + K + 0.0, CX1], [CX0, -R - K]] as const) floor(c, white, xa, xb, cz + sz * (cw - 0.45) - 0.075, cz + sz * (cw - 0.45) + 0.075, Y, 1)
  // a painted cycle lane symbol would go here; parking bays are in the gym forecourt

  /* ── drains and covers ── */
  const iron = new THREE.MeshStandardMaterial({ color: '#2a2b2e', metalness: 0.7, roughness: 0.55 })
  c.D.push(iron)
  for (let z = AVE.z0 + 8; z < AVE.z1; z += 22) {
    if (Math.abs(z - cz) < cw + 3) continue
    for (const sx of [-1, 1]) {
      const gx = sx * (R - 0.35)
      c.B.put(new THREE.BoxGeometry(0.55, 0.02, 0.9), iron, gx, 0.012, z, 0, 1, 1, 1, { cast: false })
      for (let k = -3; k <= 3; k++) c.B.put(new THREE.BoxGeometry(0.5, 0.025, 0.04), M.black, gx, 0.016, z + k * 0.12, 0, 1, 1, 1, { cast: false })
    }
    c.B.put(new THREE.CylinderGeometry(0.42, 0.42, 0.02, 20), iron, -1.8 + ((z | 0) % 3) * 0.2, 0.012, z + 6, 0, 1, 1, 1, { cast: false }) // manhole
  }

  /* ── street trees (instanced GLB trees come in later), tree pits with grilles ── */
  const rnd = rng(11)
  const pits: [number, number][] = []
  for (let z = 78; z > AVE.z0 + 6; z -= 13) {
    if (Math.abs(z - cz) < cw + 7) continue
    for (const sx of [-1, 1]) if (!(sx < 0 && z < -6 && z > -54)) pits.push([sx * (R + K + 0.85), z + (rnd() - 0.5) * 2])
  }
  for (const [x, z] of pits) {
    floor(c, M.soil, x - 0.62, x + 0.62, z - 0.62, z + 0.62, 0.168, 1)
    slab(c, iron, x - 0.7, x + 0.7, 0.14, 0.17, z - 0.07, z + 0.07, 1)
    slab(c, iron, x - 0.07, x + 0.07, 0.14, 0.17, z - 0.7, z + 0.7, 1)
    c.trees.push({ kind: rnd() < 0.7 ? 'jacaranda' : 'island', x, z, s: 0.34 + rnd() * 0.1, yaw: rnd() * 6.28 })
  }

  /* ── lamps: slim steel poles with a curved arm and a flat LED head, staggered each side ── */
  const lamp = (x: number, z: number, faceX: number) => {
    cyl(c, M.steel, x, 0.16, z, 0.07, 0.1, 8.2, 10)
    cyl(c, M.steel, x, 0.16, z, 0.16, 0.18, 0.5, 10)
    const arm = new THREE.CylinderGeometry(0.045, 0.045, 2.0, 8).rotateZ(Math.PI / 2)
    c.B.put(arm, M.steel, x + faceX * 1.0, 8.2, z)
    box(c, M.steel, x + faceX * 2.0, 8.12, z, 0.9, 0.1, 0.34)
    c.B.put(new THREE.BoxGeometry(0.8, 0.02, 0.26), M.ceilLight, x + faceX * 2.0, 8.11, z, 0, 1, 1, 1, { cast: false })
    c.block(x - 0.12, x + 0.12, z - 0.12, z + 0.12)
  }
  for (let z = 84, i = 0; z > AVE.z0 + 4; z -= 20, i++) {
    if (Math.abs(z - cz) < cw + 5) continue
    lamp((R + K + 0.35) * (i % 2 ? 1 : -1), z, i % 2 ? -1 : 1)
  }

  /* ── traffic lights at the junction (poles on the four corners) ── */
  const signal = (x: number, z: number, faceX: number, faceZ: number) => {
    cyl(c, M.steel, x, 0.16, z, 0.06, 0.07, 3.4, 8)
    box(c, M.black, x, 3.0, z, 0.3, 0.9, 0.22)
    c.B.put(new THREE.SphereGeometry(0.09, 10, 8), M.redLamp, x + faceX * 0.12, 3.65, z + faceZ * 0.12, 0, 1, 1, 1, { cast: false })
    c.B.put(new THREE.SphereGeometry(0.09, 10, 8), M.amberLamp, x + faceX * 0.12, 3.4, z + faceZ * 0.12, 0, 1, 1, 1, { cast: false })
    c.B.put(new THREE.SphereGeometry(0.09, 10, 8), M.greenLamp, x + faceX * 0.12, 3.15, z + faceZ * 0.12, 0, 1, 1, 1, { cast: false })
    c.block(x - 0.1, x + 0.1, z - 0.1, z + 0.1)
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) signal(sx * (R + 0.6), cz + sz * (cw + 0.6), 0, -sz)

  /* ── bollards at the crossings, benches, bins, a postbox, bike hoops ── */
  const bollard = (x: number, z: number) => {
    cyl(c, M.steel, x, 0.16, z, 0.07, 0.07, 0.85, 12)
    cyl(c, M.steelLight, x, 1.0, z, 0.072, 0.072, 0.04, 12)
    c.block(x - 0.08, x + 0.08, z - 0.08, z + 0.08)
  }
  for (const zc of [cz + cw + 4.5, cz - cw - 4.5, -22]) for (const sx of [-1, 1]) for (const dz of [-2.4, 2.4]) bollard(sx * (R + K + 0.4), zc + dz)
  const bench = (x: number, z: number, ry: number) => {
    const g = new THREE.Group()
    void g
    const m = new THREE.Matrix4().makeRotationY(ry)
    void m
    for (let k = 0; k < 4; k++) c.B.put(new THREE.BoxGeometry(1.7, 0.04, 0.09), M.timber, x, 0.45, z, ry, 1, 1, 1)
    // (the slats are laid by rotating the offset in the bench's own frame)
    const ca = Math.cos(ry)
    const sa = Math.sin(ry)
    for (let k = 0; k < 4; k++) {
      const off = -0.16 + k * 0.1
      c.B.put(new THREE.BoxGeometry(1.7, 0.04, 0.09), M.timber, x + sa * off, 0.45, z + ca * off, ry)
    }
    for (let k = 0; k < 3; k++) {
      const off = -0.2 - k * 0.09
      c.B.put(new THREE.BoxGeometry(1.7, 0.04, 0.08), M.timber, x + sa * off, 0.7 + k * 0.1, z + ca * off, ry)
    }
    for (const lx of [-0.75, 0.75]) c.B.put(new THREE.BoxGeometry(0.06, 0.5, 0.5), M.steel, x + ca * lx, 0.25, z - sa * lx, ry)
    c.block(x - 0.9, x + 0.9, z - 0.35, z + 0.35)
  }
  bench(R + K + 3.4, 34, Math.PI / 2)
  bench(R + K + 3.4, 12, Math.PI / 2)
  bench(-R - K - 3.4, 60, -Math.PI / 2)
  const bin = (x: number, z: number) => {
    cyl(c, M.steel, x, 0.16, z, 0.28, 0.26, 0.95, 14)
    cyl(c, M.black, x, 1.1, z, 0.29, 0.29, 0.06, 14)
    c.block(x - 0.3, x + 0.3, z - 0.3, z + 0.3)
  }
  bin(R + K + 3.4, 31)
  bin(-R - K - 3.4, 57)
  bin(R + K + 3.4, 9)
  // postbox (the blue one in the reference)
  cyl(c, M.postbox, R + K + 5.2, 0.16, 20, 0.34, 0.36, 1.1, 18)
  c.B.put(new THREE.SphereGeometry(0.34, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.postbox, R + K + 5.2, 1.26, 20)
  c.block(R + K + 4.8, R + K + 5.6, 19.6, 20.4)
  // bike hoops
  for (let k = 0; k < 4; k++) c.B.put(new THREE.TorusGeometry(0.34, 0.025, 6, 16, Math.PI), M.steelLight, R + K + 3.8, 0.16, 26 + k * 0.9, Math.PI / 2)

  /* ── signs: a 20 mph roundel and a blue parking sign on steel posts ── */
  const signPost = (x: number, z: number, mat: THREE.Material, round: boolean, ry: number) => {
    cyl(c, M.steel, x, 0.16, z, 0.04, 0.04, 2.5, 8)
    const g = round ? new THREE.CylinderGeometry(0.34, 0.34, 0.03, 24).rotateX(Math.PI / 2) : new THREE.BoxGeometry(0.6, 0.6, 0.03)
    c.B.put(g, mat, x, 2.35, z + 0.05, ry)
    if (round) c.B.put(new THREE.CylinderGeometry(0.26, 0.26, 0.035, 24).rotateX(Math.PI / 2), M.white, x, 2.35, z + 0.052, ry)
  }
  signPost(R + K + 0.4, 62, M.signRed, true, 0)
  signPost(-R - K - 0.4, 40, M.postbox, false, 0)
}
