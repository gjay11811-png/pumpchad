import * as THREE from 'three'
import type { Town } from './buildings'
import { boxUV, gableGeo, rng } from './kit'
import { isNight } from './daylight'

/**
 * CHAD CITY SKYLINE — the distant city seen from the village overlook while the expansion is closed. Shells only: no colliders, no lights,
 * no interactables, no interiors, no NPCs. Built in the valley city's local frame (the same one Downtown uses), and replaced by the real
 * Downtown when the expansion opens.
 *
 * It is a grid of lots with a clear hierarchy: a tall financial/neon core around the monument plaza, mid-rise blocks with mansard and gable
 * roofs around it, low shop rows at the edges, and a handful of landmarks (a clock tower, a stepped art-deco tower with a spire, a twin
 * pair, a water tank block). Window grids are painted into four small atlases (warm, amber, cyan, magenta) — one material each, so the whole
 * skyline is a few draw calls.
 */
export const SKYLINE = { x0: 22, x1: 124, z0: -122, z1: -8, core: { x: 66, z: -52 } }

const WIN = [
  { base: '#17141f', lit: ['#ffd27a', '#ffc15a', '#fff0c8'], dark: '#2a2630' }, // warm
  { base: '#16131c', lit: ['#ffb24a', '#ff9a2e', '#ffd27a'], dark: '#2a2228' }, // amber
  { base: '#101624', lit: ['#7fe8ff', '#4cc3ff', '#e8ffff'], dark: '#1c2438' }, // cyan
  { base: '#1a1226', lit: ['#ff6ad5', '#c86bff', '#ffd2f6'], dark: '#2a1c3a' }, // magenta
]

export function citySkyline(T: Town) {
  const D = T.disposables
  const night = isNight()
  const R = rng(4242)

  const wins = WIN.map((w, wi) => {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')!
    g.fillStyle = w.base
    g.fillRect(0, 0, 128, 128)
    const rr = rng(900 + wi)
    for (let cx = 0; cx < 4; cx++)
      for (let cy = 0; cy < 4; cy++) {
        const on = rr() > 0.32
        g.fillStyle = on ? w.lit[Math.floor(rr() * w.lit.length)] : w.dark
        g.fillRect(cx * 32 + 5, cy * 32 + 6, 22, 20)
      }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = 2
    D.push(t)
    const m = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: night ? 0.95 : 0.25, roughness: 0.55, metalness: 0.15 })
    D.push(m)
    return m
  })
  const roofs = [
    new THREE.MeshStandardMaterial({ color: '#2c2a3a', roughness: 0.85 }), // slate
    new THREE.MeshStandardMaterial({ color: '#4a2f2a', roughness: 0.85 }), // terracotta
    new THREE.MeshStandardMaterial({ color: '#3a4a46', roughness: 0.6, metalness: 0.4 }), // oxidised copper
  ]
  const stone = new THREE.MeshStandardMaterial({ color: '#6a6480', roughness: 0.8 })
  const trim = new THREE.MeshStandardMaterial({ color: '#8a8498', roughness: 0.7 })
  const gold = new THREE.MeshStandardMaterial({ color: '#d9a844', roughness: 0.35, metalness: 0.7, emissive: '#6a4a10', emissiveIntensity: night ? 0.6 : 0.1 })
  const beacon = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff3a3a').multiplyScalar(2), toneMapped: false })
  const water = new THREE.MeshStandardMaterial({ color: '#4a3a30', roughness: 0.9 })
  D.push(...roofs, stone, trim, gold, beacon, water)

  const put = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, ry = 0) => T.batch.put(g, m, x, y, z, ry, 1, 1, 1, { cast: false })
  const roofFor = (r: number) => roofs[Math.floor(r * roofs.length)]

  /** a window-wall box from y0 to y1 (windows tile at ~3 m) with a thin cornice ledge on top */
  const wall = (x: number, z: number, w: number, d: number, y0: number, y1: number, mat: THREE.Material, ry = 0) => {
    put(boxUV(w, y1 - y0, d, 12), mat, x, (y0 + y1) / 2, z, ry)
    put(boxUV(w + 0.5, 0.35, d + 0.5, 3), trim, x, y1 + 0.1, z, ry)
  }

  const dCore = (x: number, z: number) => Math.hypot((x - SKYLINE.core.x) / 38, (z - SKYLINE.core.z) / 44)
  const LOT = 12
  let count = 0
  for (let gx = SKYLINE.x0; gx < SKYLINE.x1; gx += LOT) {
    for (let gz = SKYLINE.z0; gz < SKYLINE.z1; gz += LOT) {
      // streets: every fourth row / column is left open, and the lots are jittered a little
      const ci = Math.round((gx - SKYLINE.x0) / LOT)
      const cj = Math.round((gz - SKYLINE.z0) / LOT)
      if (ci % 4 === 3 || cj % 4 === 3) continue
      if (R() < 0.08) continue
      const x = gx + LOT / 2 + (R() - 0.5) * 2.2
      const z = gz + LOT / 2 + (R() - 0.5) * 2.2
      const w = 7 + R() * 3.4
      const d = 7 + R() * 3.4
      const core = Math.max(0, 1 - dCore(x, z))
      const win = wins[R() < 0.18 + core * 0.25 ? 2 + Math.floor(R() * 2) : Math.floor(R() * 2)] // the core leans neon
      const kind = core > 0.55 ? (R() < 0.7 ? 'tower' : 'deco') : core > 0.2 ? (R() < 0.55 ? 'mid' : 'tower') : R() < 0.6 ? 'low' : 'mid'
      count++
      if (kind === 'tower') {
        // a stepped slab: shaft, one or two setbacks, a crown, sometimes a mast
        const h = 26 + core * 38 + R() * 10
        const h1 = h * 0.7
        wall(x, z, w, d, 0, h1, win)
        wall(x, z, w * 0.78, d * 0.78, h1, h, win)
        if (R() < 0.5) {
          wall(x, z, w * 0.52, d * 0.52, h, h + h * 0.14, win)
          put(boxUV(w * 0.56, 0.5, d * 0.56, 3), stone, x, h + h * 0.14 + 0.3, z)
          if (R() < 0.6) {
            put(new THREE.CylinderGeometry(0.1, 0.18, 7, 6), trim, x, h + h * 0.14 + 4, z)
            put(new THREE.SphereGeometry(0.28, 6, 4), beacon, x, h + h * 0.14 + 7.6, z)
          }
        } else {
          put(boxUV(w * 0.8, 1.6, d * 0.8, 3), stone, x, h + 0.9, z) // plant room / parapet
          put(new THREE.CylinderGeometry(1.1, 1.3, 1.8, 8), water, x + w * 0.15, h + 2.5, z - d * 0.1)
        }
      } else if (kind === 'deco') {
        // art-deco: tall shaft with stepped shoulders and a gold-tipped spire (rare, so no two towers repeat)
        const h = 46 + R() * 14
        wall(x, z, w, d, 0, h * 0.55, win)
        wall(x, z, w * 0.8, d * 0.8, h * 0.55, h * 0.8, win)
        wall(x, z, w * 0.55, d * 0.55, h * 0.8, h, win)
        put(new THREE.ConeGeometry(Math.min(w, d) * 0.22, h * 0.26, 4).rotateY(Math.PI / 4), gold, x, h + h * 0.13, z)
        put(new THREE.SphereGeometry(0.3, 6, 4), beacon, x, h + h * 0.26 + 0.3, z)
      } else if (kind === 'mid') {
        // mid-rise block with a mansard or gable roof and a chimney or two
        const h = 12 + R() * 12 + core * 10
        wall(x, z, w, d, 0, h, win)
        const roof = roofFor(R())
        if (R() < 0.55) {
          const g = gableGeo(w + 0.4, d + 0.4, 3 + R() * 2.2, 3)
          put(g, roof, x, h + 0.28, z, R() < 0.5 ? 0 : Math.PI / 2)
        } else {
          // mansard: a tapered slab
          put(new THREE.CylinderGeometry(Math.min(w, d) * 0.46, Math.max(w, d) * 0.7, 3, 4).rotateY(Math.PI / 4).scale(w > d ? 1 : d / w, 1, w > d ? d / w : 1), roof, x, h + 1.7, z)
        }
        for (let k = 0; k < 1 + Math.floor(R() * 2); k++) put(boxUV(0.9, 3.2, 0.9, 2), stone, x + (R() - 0.5) * w * 0.6, h + 3.4, z + (R() - 0.5) * d * 0.6)
      } else {
        // low shop row: two floors, a sloped roof, a shopfront band glowing at the foot
        const h = 6.5 + R() * 3
        wall(x, z, w + 1.5, d, 0, h, win)
        put(gableGeo(w + 2, d + 0.6, 2.2, 3), roofFor(R()), x, h + 0.28, z, R() < 0.5 ? 0 : Math.PI / 2)
        put(boxUV(w + 1.6, 1.8, 0.2, 3), wins[0], x, 1.1, z + d / 2 + 0.05)
      }
    }
  }
  // landmarks: a clock tower and a twin pair on the core's edge, so the skyline is recognisable rather than a field of boxes
  {
    const cx = SKYLINE.core.x - 20
    const cz = SKYLINE.core.z + 30
    put(boxUV(6, 30, 6, 12), stone, cx, 15, cz)
    wall(cx, cz, 6.6, 6.6, 30, 36, wins[0])
    put(new THREE.ConeGeometry(4.6, 9, 4).rotateY(Math.PI / 4), roofs[2], cx, 40.8, cz)
    put(new THREE.SphereGeometry(0.35, 6, 4), gold, cx, 45.6, cz)
    for (const s of [-1, 1]) {
      const tx = SKYLINE.core.x + 30
      const tz = SKYLINE.core.z - 18 + s * 7
      wall(tx, tz, 8, 8, 0, 54, wins[2])
      put(boxUV(8.6, 1.4, 8.6, 3), stone, tx, 54.9, tz)
      put(new THREE.SphereGeometry(0.3, 6, 4), beacon, tx, 56.2, tz)
    }
  }
  return count
}
