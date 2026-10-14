import * as THREE from 'three'
import type { Town } from './buildings'
import { boxUV, rng } from './kit'
import { Frame, channelLetters } from './signs'
import { isNight } from './daylight'
import { CARS, sportsCar } from './vehicles'
import { planterBox } from './architecture'
import { DISTRICTS, insideCity } from './city'

/**
 * DOWNTOWN — the tall, colourful city beyond the east district (the third roadmap panel, "Chad City"): glass towers with
 * lit window grids in cyan / magenta / amber / teal, stepped crowns with spires and red beacons, a podium of glowing
 * shopfronts at the foot of every tower, a wide avenue (from the Gate Plaza to the east edge) and a boulevard (from the east
 * district north), a cross street, a monument plaza at the junction, parked cars along the kerbs, planters, lamps, and a
 * helipad with a turning helicopter on the tallest tower. The streets are walkable; the towers are solid.
 */
export const DT = { x0: DISTRICTS.downtown.x0, x1: DISTRICTS.downtown.x1, z0: DISTRICTS.downtown.z0, z1: DISTRICTS.downtown.z1 }
const AVE_Z = -55 // the avenue (east–west), 10 m of road
const BLV_X = 60 // the boulevard (north–south)
const CROSS_Z = -30

type Tower = { x: number; z: number; w: number; d: number; h: number; pal: number; name?: string; faces: 'n' | 's' | 'ns' }
const TOWERS: Tower[] = [
  // north of the avenue
  { x: 45, z: -69, w: 14, d: 11, h: 34, pal: 0, faces: 's', name: 'GAINS TOWER' },
  { x: 75, z: -69, w: 16, d: 11, h: 46, pal: 1, faces: 's', name: 'HYPE HOUSE' },
  { x: 95, z: -69, w: 17, d: 11, h: 58, pal: 2, faces: 's', name: 'CHAD CITY' },
  // row 1 (between the avenue and the cross street)
  { x: 45, z: -42, w: 14, d: 13, h: 28, pal: 3, faces: 'ns', name: 'PUMP PLAZA' },
  { x: 76, z: -42, w: 15, d: 13, h: 38, pal: 0, faces: 'ns', name: 'MOON BANK' },
  { x: 101, z: -42, w: 14, d: 13, h: 31, pal: 1, faces: 'ns', name: 'NIGHT MARKET' },
  // row 2 (between the cross street and the east district)
  { x: 45, z: -18, w: 14, d: 12, h: 24, pal: 2, faces: 'n', name: 'CHAD CAFE' },
  { x: 76, z: -18, w: 15, d: 12, h: 30, pal: 3, faces: 'n', name: 'CHAD MALL' },
  { x: 101, z: -18, w: 14, d: 12, h: 22, pal: 0, faces: 'n', name: 'LEG DAY LOFTS' },
]
const PALETTES = [
  ['#7fe8ff', '#4cc3ff', '#ffffff', '#ffd27a'], // cyan
  ['#ff6ad5', '#c86bff', '#ffffff', '#7fe8ff'], // magenta
  ['#ffb24a', '#ff7a1a', '#fff0c8', '#ff6ad5'], // amber
  ['#5fe0d0', '#7fe8ff', '#ffffff', '#b8ff7a'], // teal
]

export const DOWNTOWN_LAMPS: [number, number][] = [
  ...[40, 50, 70, 80, 90, 100, 108].flatMap((x) => [[x, AVE_Z - 5.6], [x, AVE_Z + 5.6]] as [number, number][]),
  ...[-12, -22, -40, -48].flatMap((z) => [[BLV_X - 5.6, z], [BLV_X + 5.6, z]] as [number, number][]),
  ...[40, 50, 70, 80, 90, 100].map((x) => [x, CROSS_Z - 4.3] as [number, number]),
]

export function downtown(T: Town) {
  const P = T.P
  const D = T.disposables
  const night = isNight()
  const R = rng(7771)

  /* ── window textures: a lit grid per palette ── */
  const winMats = PALETTES.map((pal, pi) => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const g = c.getContext('2d')!
    g.fillStyle = '#1a1830'
    g.fillRect(0, 0, 256, 256)
    const rr = rng(100 + pi)
    for (let cx = 0; cx < 4; cx++)
      for (let cy = 0; cy < 4; cy++) {
        const on = rr() > 0.28
        g.fillStyle = on ? pal[Math.floor(rr() * pal.length)] : '#2a2a48'
        g.globalAlpha = on ? 0.95 : 1
        g.fillRect(cx * 64 + 8, cy * 64 + 10, 48, 44)
        g.globalAlpha = 1
        g.fillStyle = 'rgba(20,18,40,0.55)'
        g.fillRect(cx * 64 + 30, cy * 64 + 10, 4, 44) // mullion
      }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    D.push(t)
    const m = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: night ? 1.15 : 0.35, roughness: 0.4, metalness: 0.3 })
    D.push(m)
    return m
  })
  const concrete = new THREE.MeshStandardMaterial({ color: '#4a4660', roughness: 0.7, metalness: 0.2 })
  const asphalt = new THREE.MeshStandardMaterial({ color: '#26242e', roughness: 0.9 })
  const lane = new THREE.MeshBasicMaterial({ color: '#e8d8a8' })
  const beacon = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff3a3a').multiplyScalar(2) })
  D.push(concrete, asphalt, lane, beacon)
  const neon = (hex: string) => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(1.7), toneMapped: false })
    D.push(m)
    return m
  }

  /* ── streets: road slabs, kerbs/pavements, lane lines, the monument plaza ── */
  const slab = (x0: number, x1: number, z0: number, z1: number, mat: THREE.Material, y: number) => {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2)
    const u = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < u.count; i++) u.setXY(i, (u.getX(i) * (x1 - x0)) / 3, (u.getY(i) * (z1 - z0)) / 3)
    T.batch.put(g, mat, (x0 + x1) / 2, y, (z0 + z1) / 2, 0, 1, 1, 1, { cast: false })
  }
  slab(DT.x0, DT.x1, DT.z0, DT.z1, P.plaza, 0.02) // pavement everywhere first
  slab(DT.x0, DT.x1, AVE_Z - 5, AVE_Z + 5, asphalt, 0.03) // avenue
  slab(BLV_X - 5, BLV_X + 5, AVE_Z + 5, DT.z1, asphalt, 0.03) // boulevard
  slab(DT.x0, DT.x1, CROSS_Z - 4, CROSS_Z + 4, asphalt, 0.03) // cross street
  for (let x = DT.x0 + 2; x < DT.x1 - 1; x += 6) {
    T.batch.put(new THREE.BoxGeometry(2.6, 0.01, 0.16), lane, x, 0.04, AVE_Z, 0, 1, 1, 1, { cast: false })
    T.batch.put(new THREE.BoxGeometry(2.6, 0.01, 0.16), lane, x, 0.04, CROSS_Z, 0, 1, 1, 1, { cast: false })
  }
  for (let z = AVE_Z + 8; z < DT.z1 - 1; z += 6) T.batch.put(new THREE.BoxGeometry(0.16, 0.01, 2.6), lane, BLV_X, 0.04, z, 0, 1, 1, 1, { cast: false })
  for (const sz of [-1, 1]) {
    T.batch.put(boxUV(DT.x1 - DT.x0, 0.14, 0.3, 1), P.stoneLight, (DT.x0 + DT.x1) / 2, 0.07, AVE_Z + sz * 5.15, 0, 1, 1, 1, { cast: false })
    T.batch.put(boxUV(DT.x1 - DT.x0, 0.14, 0.3, 1), P.stoneLight, (DT.x0 + DT.x1) / 2, 0.07, CROSS_Z + sz * 4.15, 0, 1, 1, 1, { cast: false })
  }
  // the monument plaza where the boulevard meets the cross street: a ring, a plinth and a golden pumpkin
  const MX = BLV_X
  const MZ = CROSS_Z
  for (const [r, m] of [[6.2, P.stoneLight], [5.6, P.gold]] as const) T.batch.put(new THREE.RingGeometry(r - 0.18, r, 40).rotateX(-Math.PI / 2), m, MX, 0.05, MZ, 0, 1, 1, 1, { cast: false })
  T.batch.put(new THREE.CylinderGeometry(2.4, 2.6, 0.8, 20), concrete, MX, 0.4, MZ)
  T.batch.put(new THREE.CylinderGeometry(1.1, 1.4, 1.6, 12), P.stone, MX, 1.6, MZ)
  T.batch.put(new THREE.SphereGeometry(1.15, 18, 12).scale(1.2, 0.95, 1.2), P.gold, MX, 3.1, MZ)
  T.batch.put(new THREE.CylinderGeometry(0.08, 0.1, 0.5, 6), P.iron, MX, 4.2, MZ)
  T.colliders.push({ kind: 'circle', x: MX, z: MZ, r: 2.7, h: 4.5 })
  T.lights.push({ x: MX, y: 3.4, z: MZ, color: '#ffd27a', intensity: 6, dist: 12, priority: 3 })

  /* ── towers: podium + shaft + stepped crown, windows facing the street, neon name signs ── */
  const signs: { x: number; y: number; z: number; ry: number; name: string; pal: number }[] = []
  TOWERS.forEach((t, i) => {
    const wm = winMats[t.pal]
    const podH = 4.2
    const shaftH = t.h - podH
    // podium (a dark base with the lit shopfronts) and the shaft above (the window grid)
    T.batch.put(boxUV(t.w + 1.2, podH, t.d + 1.2, 3), concrete, t.x, podH / 2, t.z)
    T.batch.put(boxUV(t.w, shaftH, t.d, 8), wm, t.x, podH + shaftH / 2, t.z)
    T.batch.put(boxUV(t.w + 0.5, 0.5, t.d + 0.5, 3), P.stoneLight, t.x, podH + 0.1, t.z)
    // stepped crown, spire and beacon
    T.batch.put(boxUV(t.w * 0.7, 3.2, t.d * 0.7, 6), wm, t.x, t.h + 1.6, t.z)
    T.batch.put(boxUV(t.w * 0.45, 2.4, t.d * 0.45, 6), concrete, t.x, t.h + 4.4, t.z)
    if (i !== 2) {
      T.batch.put(new THREE.ConeGeometry(0.5, 7 + (i % 3) * 2, 6), P.iron, t.x, t.h + 8.6, t.z)
      T.batch.put(new THREE.SphereGeometry(0.28, 8, 6), beacon, t.x, t.h + 12.4 + (i % 3) * 1.6, t.z, 0, 1, 1, 1, { cast: false })
    }
    T.colliders.push({ kind: 'box', minX: t.x - t.w / 2 - 0.6, maxX: t.x + t.w / 2 + 0.6, minZ: t.z - t.d / 2 - 0.6, maxZ: t.z + t.d / 2 + 0.6, h: 20 })
    // shopfronts across the street face: glowing glass bays with neon fascia strips, and the tower's name sign
    const sides: ('n' | 's')[] = t.faces === 'ns' ? ['s', 'n'] : [t.faces]
    sides.forEach((side, si) => {
      const fz = side === 's' ? t.z + t.d / 2 + 0.62 : t.z - t.d / 2 - 0.62
      const ry = side === 's' ? 0 : Math.PI
      const bays = Math.max(2, Math.floor(t.w / 4.2))
      const bw = (t.w - 1) / bays
      const F = Frame.at(T.batch, t.x, 0, fz, ry)
      for (let b = 0; b < bays; b++) {
        const bx = -t.w / 2 + 0.5 + bw * (b + 0.5)
        const shopTone = ['#ffd27a', '#ff9ad5', '#9ae8ff', '#b8ff9a'][(i + b + si) % 4]
        F.put(new THREE.PlaneGeometry(bw - 0.5, 2.7), neon(shopTone), bx, 1.75, 0.04, 0, 0, 0, false)
        F.box(bw - 0.3, 0.12, 0.14, P.iron, bx, 3.18, 0.08)
        F.box(bw - 0.3, 0.12, 0.14, P.iron, bx, 0.38, 0.08)
        F.box(0.1, 2.9, 0.14, P.iron, bx - (bw - 0.4) / 2, 1.75, 0.08)
        F.box(0.1, 2.9, 0.14, P.iron, bx + (bw - 0.4) / 2, 1.75, 0.08)
        F.box(bw - 0.2, 0.22, 0.12, neon(PALETTES[t.pal][0]), bx, 3.7, 0.1, false)
        F.box(0.14, 1.9, 0.06, P.gold, bx, 1.2, 0.14) // door bar (these doors are closed — the shops open in a later chapter)
      }
      if (t.name && si === 0) signs.push({ x: t.x, y: podH + shaftH * 0.62, z: fz + (side === 's' ? 0.2 : -0.2), ry, name: t.name, pal: t.pal })
    })
  })
  for (const s of signs) {
    const F = Frame.at(T.batch, s.x, s.y, s.z, s.ry)
    const m = neon(PALETTES[s.pal][0])
    F.box(s.name.length * 0.95 + 1.2, 1.7, 0.2, concrete, 0, 0, 0)
    channelLetters(F.sub(0, -0.4, 0.12), s.name, 1.1, 0.14, m)
  }

  /* ── the helipad and the turning helicopter on the tallest tower ── */
  {
    const t = TOWERS[2]
    const hx = t.x
    const hz = t.z
    const y = t.h + 5.6
    T.batch.put(new THREE.CylinderGeometry(4.2, 4.2, 0.3, 24), concrete, hx, y + 0.15, hz)
    T.batch.put(new THREE.RingGeometry(3.2, 3.5, 32).rotateX(-Math.PI / 2), neon('#ffd27a'), hx, y + 0.32, hz, 0, 1, 1, 1, { cast: false })
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) T.batch.put(new THREE.SphereGeometry(0.14, 6, 4), beacon, hx + Math.sin(a) * 4.1, y + 0.4, hz + Math.cos(a) * 4.1, 0, 1, 1, 1, { cast: false })
    const heli = new THREE.Group()
    const bodyM = new THREE.MeshStandardMaterial({ color: '#e8641a', metalness: 0.4, roughness: 0.4 })
    const darkM = new THREE.MeshStandardMaterial({ color: '#1e1c24', metalness: 0.6, roughness: 0.4 })
    const glassM = new THREE.MeshStandardMaterial({ color: '#7fe8ff', metalness: 0.6, roughness: 0.15, emissive: '#1a4a5a' })
    D.push(bodyM, darkM, glassM)
    const part = (g: THREE.BufferGeometry, m: THREE.Material, x: number, yy: number, z: number) => {
      const mesh = new THREE.Mesh(g, m)
      mesh.position.set(x, yy, z)
      D.push(g)
      heli.add(mesh)
      return mesh
    }
    part(new THREE.SphereGeometry(1.1, 14, 10).scale(1.5, 0.95, 0.9), bodyM, 0, 1.2, 0)
    part(new THREE.SphereGeometry(0.8, 12, 8).scale(1, 0.8, 0.8), glassM, 1.0, 1.35, 0)
    part(new THREE.BoxGeometry(3.2, 0.22, 0.3), bodyM, -2.4, 1.4, 0)
    part(new THREE.BoxGeometry(0.1, 0.9, 0.3), bodyM, -3.9, 1.8, 0)
    for (const z of [-0.7, 0.7]) part(new THREE.BoxGeometry(2.4, 0.08, 0.1), darkM, 0, 0.1, z)
    for (const z of [-0.5, 0.5]) for (const x of [-0.8, 0.8]) part(new THREE.BoxGeometry(0.08, 0.6, 0.08), darkM, x, 0.4, z)
    const rotor = new THREE.Group()
    rotor.position.y = 2.4
    for (let k = 0; k < 2; k++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.04, 0.22), darkM)
      blade.rotation.y = k * (Math.PI / 2)
      D.push(blade.geometry)
      rotor.add(blade)
    }
    heli.add(rotor)
    heli.position.set(hx, y + 0.3, hz)
    heli.rotation.y = 0.6
    T.scene.add(heli)
    T.dynamic.push({ update: (tt) => (rotor.rotation.y = tt * 14) })
  }

  /* ── kerbside cars (static), planters with shrubs, benches ── */
  const carSpots: [number, number, number, number][] = [
    [48, AVE_Z + 3.4, Math.PI / 2, 0], [70, AVE_Z + 3.4, Math.PI / 2, 1], [86, AVE_Z - 3.4, -Math.PI / 2, 2], [104, AVE_Z + 3.4, Math.PI / 2, 1],
    [BLV_X + 3.4, -18, 0, 2], [BLV_X - 3.4, -44, Math.PI, 0], [74, CROSS_Z + 2.4, Math.PI / 2, 0], [96, CROSS_Z - 2.4, -Math.PI / 2, 1],
  ]
  for (const [x, z, ry, k] of carSpots) {
    sportsCar(Frame.at(T.batch, x, 0.03, z, ry), CARS[k], D)
    T.colliders.push({ kind: 'box', minX: x - (Math.abs(Math.sin(ry)) > 0.5 ? 2.4 : 1.2), maxX: x + (Math.abs(Math.sin(ry)) > 0.5 ? 2.4 : 1.2), minZ: z - (Math.abs(Math.sin(ry)) > 0.5 ? 1.2 : 2.4), maxZ: z + (Math.abs(Math.sin(ry)) > 0.5 ? 1.2 : 2.4), h: 1.3 })
  }
  const leaf = new THREE.MeshStandardMaterial({ color: '#2f5c36', roughness: 0.95 })
  D.push(leaf)
  for (const [x, z] of [[56, AVE_Z + 6.4], [64, AVE_Z + 6.4], [56, CROSS_Z + 5.4], [64, CROSS_Z + 5.4], [BLV_X - 6.4, -14], [BLV_X + 6.4, -14], [BLV_X - 6.4, -46], [BLV_X + 6.4, -46]] as const) {
    planterBox(T, P.stoneLight, x, z, 1.4, 1.4)
    T.batch.put(new THREE.SphereGeometry(0.6, 10, 8).scale(1, 0.9, 1), leaf, x, 1.05, z)
    T.batch.put(new THREE.ConeGeometry(0.3, 0.9, 8), leaf, x, 1.75, z)
  }
  void R

  /* ── a low stone balustrade along the outer edges of Downtown and the Gate Plaza, so the walkable ground ends at a wall, not thin air ── */
  for (const key of ['downtown', 'plaza'] as const) {
    const r = DISTRICTS[key]
    const edges: [number, number, number, number, number, number][] = [
      [r.x0, r.z0, r.x1, r.z0, 0, -1],
      [r.x1, r.z0, r.x1, r.z1, 1, 0],
      [r.x1, r.z1, r.x0, r.z1, 0, 1],
      [r.x0, r.z1, r.x0, r.z0, -1, 0],
    ]
    for (const [ax, az, bx, bz, nx, nz] of edges) {
      const len = Math.hypot(bx - ax, bz - az)
      for (let d = 1; d < len; d += 2) {
        const x = ax + ((bx - ax) * d) / len
        const z = az + ((bz - az) * d) / len
        if (insideCity(x + nx * 1.2, z + nz * 1.2) || insideCity(x + nx * 0.4, z + nz * 0.4, -0.1)) continue
        const ry = Math.atan2(bx - ax, bz - az)
        T.batch.put(boxUV(2.02, 0.9, 0.36, 1), P.stone, x + nx * 0.2, 0.45, z + nz * 0.2, ry)
        T.batch.put(boxUV(2.1, 0.12, 0.5, 1), P.stoneLight, x + nx * 0.2, 0.96, z + nz * 0.2, ry)
        if (Math.round(d) % 4 === 1) {
          T.batch.put(boxUV(0.5, 1.3, 0.5, 1), P.stone, x + nx * 0.2, 0.65, z + nz * 0.2, ry)
          T.batch.put(new THREE.SphereGeometry(0.16, 8, 6), P.gold, x + nx * 0.2, 1.42, z + nz * 0.2)
        }
      }
    }
  }
}
