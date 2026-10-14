import * as THREE from 'three'
import { isNight } from './daylight'
import type { Town } from './buildings'
import { boxUV } from './kit'
import { Frame, channelLetters } from './signs'

/**
 * The CHAD SQUARE gate: the landmark between the canal avenue and the square. Replaces the old timber beam +
 * flat canvas board. Two Gothic piers (plinth, corner colonnettes, a niche with a carved jack-o'-lantern on both
 * faces, a crocketed pinnacle), a pointed stone arch with a moulded ring, a dark-metal frieze carrying polished
 * gold CHAD SQUARE letters on both faces with a light line beneath, a pediment crowned by a great carved pumpkin,
 * and an iron lantern hanging under the crown of the arch. Warm uplights wash the stone.
 */
export function chadSquareGate(T: Town, z: number, stone: THREE.Material, trim: THREE.Material) {
  const P = T.P
  const Dp = T.disposables
  const darkMetal = new THREE.MeshStandardMaterial({ color: '#1e1c22', metalness: 0.8, roughness: 0.38 })
  const letters = new THREE.MeshStandardMaterial({ color: '#f2b44e', metalness: 0.9, roughness: 0.28, emissive: '#ff8a30', emissiveIntensity: isNight() ? 1.6 : 0.12 })
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc27a').multiplyScalar(1.25), toneMapped: false })
  const recess = new THREE.MeshStandardMaterial({ color: '#2a2228', roughness: 0.95 })
  Dp.push(darkMetal, letters, glow, recess)

  const PX = 3.65 // pier centres
  const PW = 1.3 // pier width / depth
  const HALF = PX - PW / 2 // half the clear opening (3.0)
  const DEP = 1.0 // arch body depth
  const SPRING = 3.5
  const RISE = 1.9
  const FRIEZE0 = SPRING + RISE + 0.15 // underside of the frieze
  const TOP = FRIEZE0 + 1.45 // top of the frieze / cornice line

  // ── piers ──
  for (const s of [-1, 1]) {
    const x = s * PX
    T.batch.put(boxUV(PW + 0.5, 0.45, PW + 0.5, 1), trim, x, 0.225, z)
    T.batch.put(boxUV(PW + 0.25, 0.3, PW + 0.25, 1), stone, x, 0.6, z)
    T.batch.put(boxUV(PW, TOP - 0.75, PW, 1.5), stone, x, 0.75 + (TOP - 0.75) / 2, z)
    // corner colonnettes with little bases and capitals
    for (const cx of [-1, 1])
      for (const cz of [-1, 1]) {
        const px = x + (cx * PW) / 2
        const pz = z + (cz * PW) / 2
        T.batch.put(new THREE.CylinderGeometry(0.1, 0.1, TOP - 1.3, 10), trim, px, 0.75 + (TOP - 1.3) / 2, pz)
        T.batch.put(new THREE.CylinderGeometry(0.15, 0.15, 0.16, 10), trim, px, 0.83, pz)
        T.batch.put(new THREE.CylinderGeometry(0.17, 0.12, 0.2, 10), trim, px, TOP - 0.45, pz)
      }
    // impost band where the arch springs
    T.batch.put(boxUV(PW + 0.2, 0.2, PW + 0.2, 1), trim, x, SPRING - 0.1, z)
    // a niche on both faces: pointed-headed recess, trim surround, a carved jack-o'-lantern on a corbel
    for (const f of [-1, 1]) {
      const fz = z + f * (PW / 2 + 0.005)
      const niche = new THREE.Shape()
      niche.moveTo(-0.36, 0)
      niche.lineTo(-0.36, 0.7)
      niche.quadraticCurveTo(-0.36, 1.08, 0, 1.18)
      niche.quadraticCurveTo(0.36, 1.08, 0.36, 0.7)
      niche.lineTo(0.36, 0)
      niche.closePath()
      const ng = new THREE.ShapeGeometry(niche, 12)
      T.batch.put(ng, recess, x, 1.75, fz + f * 0.002, f > 0 ? 0 : Math.PI, 1, 1, 1, { cast: false })
      const ring = new THREE.Shape()
      ring.moveTo(-0.48, 0)
      ring.lineTo(-0.48, 0.72)
      ring.quadraticCurveTo(-0.48, 1.2, 0, 1.32)
      ring.quadraticCurveTo(0.48, 1.2, 0.48, 0.72)
      ring.lineTo(0.48, 0)
      ring.lineTo(0.36, 0)
      ring.lineTo(0.36, 0.7)
      ring.quadraticCurveTo(0.36, 1.08, 0, 1.18)
      ring.quadraticCurveTo(-0.36, 1.08, -0.36, 0.7)
      ring.lineTo(-0.36, 0)
      ring.closePath()
      const rg = new THREE.ExtrudeGeometry(ring, { depth: 0.08, bevelEnabled: false, curveSegments: 12 })
      T.batch.put(rg, trim, x, 1.75, fz + (f > 0 ? 0 : -0.08))
      T.batch.put(boxUV(0.62, 0.12, 0.3, 1), trim, x, 1.72, fz + f * 0.14) // corbel
      T.pumpkins?.add(x, 1.78, fz + f * 0.16, { r: 0.27, face: s < 0 ? 1 : 2, facing: f > 0 ? 0 : Math.PI, v: 1 })
    }
    // pinnacle: a stepped base, a slender four-sided spire with crockets, a gold finial
    const py = TOP + 0.3
    T.batch.put(boxUV(PW + 0.15, 0.3, PW + 0.15, 1), trim, x, TOP + 0.15, z)
    T.batch.put(boxUV(0.95, 0.9, 0.95, 1), stone, x, py + 0.45, z)
    const spire = new THREE.ConeGeometry(0.62, 2.3, 4).rotateY(Math.PI / 4)
    T.batch.put(spire, stone, x, py + 0.9 + 1.15, z)
    for (let k = 0; k < 3; k++)
      for (let q = 0; q < 4; q++) {
        const a = (q * Math.PI) / 2
        const rr = 0.42 - k * 0.12
        T.batch.put(new THREE.SphereGeometry(0.07, 8, 6).scale(1, 0.7, 1), trim, x + Math.sin(a) * rr, py + 1.3 + k * 0.55, z + Math.cos(a) * rr)
      }
    T.batch.put(new THREE.SphereGeometry(0.13, 14, 10), P.gold, x, py + 3.3, z)
    T.batch.put(new THREE.ConeGeometry(0.06, 0.35, 8), P.gold, x, py + 3.55, z)
    T.colliders.push({ kind: 'box', minX: x - PW / 2 - 0.25, maxX: x + PW / 2 + 0.25, minZ: z - PW / 2 - 0.25, maxZ: z + PW / 2 + 0.25, h: TOP })
    // warm uplights at the pier feet (both sides)
    for (const f of [-1, 1]) T.batch.put(new THREE.BoxGeometry(0.9, 0.05, 0.05), glow, x, 0.48, z + f * (PW / 2 + 0.27), 0, 1, 1, 1, { cast: false })
    T.lights.push({ x, y: 1.2, z: z + 1.6, color: '#ff9a48', intensity: 9, dist: 8, priority: 3 })
  }

  // ── the pointed arch, cut from the spandrel stone (extruded) ──
  const pointed = (sh: THREE.Shape | THREE.Path, half: number, spring: number, rise: number, reverse = false) => {
    if (!reverse) {
      sh.lineTo(-half, spring)
      sh.quadraticCurveTo(-half, spring + rise * 0.82, 0, spring + rise)
      sh.quadraticCurveTo(half, spring + rise * 0.82, half, spring)
    } else {
      sh.lineTo(half, spring)
      sh.quadraticCurveTo(half, spring + rise * 0.82, 0, spring + rise)
      sh.quadraticCurveTo(-half, spring + rise * 0.82, -half, spring)
    }
  }
  {
    const sh = new THREE.Shape()
    sh.moveTo(-HALF, FRIEZE0)
    pointed(sh, HALF, SPRING, RISE)
    sh.lineTo(HALF, FRIEZE0)
    sh.closePath()
    // (shape winds over the arch: the opening is everything under the curve)
    const g = new THREE.ExtrudeGeometry(sh, { depth: DEP, bevelEnabled: false, curveSegments: 20 })
    g.translate(0, 0, -DEP / 2)
    const u = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) / 2, u.getY(i) / 2)
    T.batch.put(g, stone, 0, 0, z)
    // moulded arch ring on both faces
    for (const f of [-1, 1]) {
      const ring = new THREE.Shape()
      ring.moveTo(-HALF, SPRING)
      ring.quadraticCurveTo(-HALF, SPRING + RISE * 0.82, 0, SPRING + RISE)
      ring.quadraticCurveTo(HALF, SPRING + RISE * 0.82, HALF, SPRING)
      ring.lineTo(HALF - 0.32, SPRING)
      ring.quadraticCurveTo(HALF - 0.32, SPRING + (RISE - 0.3) * 0.82, 0, SPRING + RISE - 0.3)
      ring.quadraticCurveTo(-HALF + 0.32, SPRING + (RISE - 0.3) * 0.82, -HALF + 0.32, SPRING)
      ring.closePath()
      const rg = new THREE.ExtrudeGeometry(ring, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1, curveSegments: 20 })
      T.batch.put(rg, trim, 0, 0, z + f * (DEP / 2) + (f > 0 ? 0 : -0.1))
    }
  }

  // ── frieze: stone band, dark-metal sign panel, polished gold letters on both faces, a light line ──
  T.batch.put(boxUV(PX * 2 + PW, TOP - FRIEZE0, DEP + 0.1, 1.5), stone, 0, FRIEZE0 + (TOP - FRIEZE0) / 2, z)
  T.batch.put(boxUV(PX * 2 + PW + 0.4, 0.14, DEP + 0.4, 1.2), trim, 0, FRIEZE0 + 0.07, z)
  T.batch.put(boxUV(PX * 2 + PW + 0.6, 0.28, DEP + 0.5, 1.2), trim, 0, TOP + 0.14, z) // cornice
  for (const f of [-1, 1]) {
    const fz = z + f * ((DEP + 0.1) / 2)
    T.batch.put(new THREE.BoxGeometry(5.9, 1.0, 0.08), darkMetal, 0, FRIEZE0 + 0.72, fz + f * 0.04)
    for (const dx of [-2.95, 2.95]) T.batch.put(new THREE.BoxGeometry(0.08, 1.0, 0.12), P.gold, dx, FRIEZE0 + 0.72, fz + f * 0.06)
    for (const yy of [FRIEZE0 + 0.22, FRIEZE0 + 1.22]) T.batch.put(new THREE.BoxGeometry(5.98, 0.05, 0.12), P.gold, 0, yy, fz + f * 0.06)
    const F = Frame.at(T.batch, 0, FRIEZE0 + 0.42, fz + f * 0.08, f > 0 ? 0 : Math.PI)
    channelLetters(F, 'CHAD SQUARE', 0.6, 0.09, letters)
    T.batch.put(new THREE.BoxGeometry(5.4, 0.035, 0.035), glow, 0, FRIEZE0 + 0.33, fz + f * 0.12, 0, 1, 1, 1, { cast: false })
  }

  // ── pediment + the great carved pumpkin ──
  {
    const tri = new THREE.Shape()
    tri.moveTo(-1.9, 0)
    tri.lineTo(0, 1.35)
    tri.lineTo(1.9, 0)
    tri.closePath()
    const g = new THREE.ExtrudeGeometry(tri, { depth: 0.7, bevelEnabled: false })
    g.translate(0, 0, -0.35)
    T.batch.put(g, stone, 0, TOP + 0.28, z)
    // raking mouldings along both slopes, on both faces
    const ang = Math.atan2(1.35, 1.9)
    const len = Math.hypot(1.9, 1.35)
    for (const f of [-1, 1])
      for (const s of [-1, 1]) T.batch.put(boxUV(len + 0.12, 0.13, 0.12, 1).rotateZ(-s * ang), trim, s * 0.95, TOP + 0.28 + 0.675 + 0.05, z + f * 0.38)
    // gold medallion with the big jack-o'-lantern seated in it
    for (const f of [-1, 1]) T.batch.put(new THREE.TorusGeometry(0.62, 0.06, 8, 32), P.gold, 0, TOP + 0.95, z + f * 0.37)
    T.pumpkins?.add(0, TOP + 0.5, z, { r: 0.52, face: 0, facing: 0, v: 2 })
    T.batch.put(new THREE.SphereGeometry(0.1, 12, 8), P.gold, 0, TOP + 1.75, z)
    T.lights.push({ x: 0, y: TOP + 1, z: z + 1.4, color: '#ff8a30', intensity: 8, dist: 7, priority: 3 })
  }

  // ── iron lantern hanging under the crown of the arch ──
  {
    const ly = SPRING + RISE - 0.95
    T.batch.put(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 6), darkMetal, 0, ly + 0.62, z)
    T.batch.put(new THREE.ConeGeometry(0.22, 0.22, 4).rotateY(Math.PI / 4), darkMetal, 0, ly + 0.36, z)
    for (const [dx, dz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) T.batch.put(new THREE.BoxGeometry(0.025, 0.42, 0.025), darkMetal, dx * 0.13, ly + 0.03, z + dz * 0.13)
    T.batch.put(new THREE.BoxGeometry(0.22, 0.36, 0.22), glow, 0, ly + 0.03, z, 0, 1, 1, 1, { cast: false })
    T.batch.put(new THREE.BoxGeometry(0.3, 0.04, 0.3), darkMetal, 0, ly - 0.2, z)
    T.lights.push({ x: 0, y: ly, z, color: '#ffb060', intensity: 6, dist: 7, priority: 2 })
  }
}
