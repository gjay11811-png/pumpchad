import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Town } from './buildings'
import { DISTRICTS, LAKE, PIER, lakeR } from './city'
import { waterMaterial } from './fountain'
import { boxUV, rng } from './kit'
import { ornateSign } from './ornament'
import { Frame } from './signs'
import { fingerpost } from './wayfinding'
import { parkBench, type BenchSpot } from './westside'
import type { Quality } from '../../save'

/**
 * The wilds beyond the old town — two districts that double Chad City's walkable ground.
 *
 * ENCHANTED FOREST (north of the Haunted Quarter, through a timber arch): dark trees with teal + violet canopies,
 * glowing mushrooms, mossy rocks, lanterns along winding dirt paths that loop; a clearing with the Elder Oak and a
 * fairy ring, a moonstone glade to the west, and a bench at the forest edge looking across to the castle.
 *
 * MOONLIGHT LAKE (Motor Row's street runs on east): a lake with a gravel shore path round it, a timber pier out
 * to the middle with moored rowing boats, a domed pavilion on the north shore, willows, reeds, lily pads with
 * glowing lotus flowers, benches facing the water and the city's lamp posts.
 *
 * Everything static is batched; repeated things (trees, mushrooms, rocks, reeds) are instanced.
 */

type V2 = [number, number]
const UP = new THREE.Vector3(0, 1, 0)

/* ── shared helpers ── */

/** a flat ribbon along a smooth curve through `pts` (a dirt or gravel path) */
function ribbon(pts: V2[], w: number, closed = false) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), closed, 'centripetal')
  const n = Math.max(8, Math.round(curve.getLength() / 0.8))
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  let dist = 0
  let prev = curve.getPointAt(0)
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const p = curve.getPointAt(closed ? t % 1 : t)
    const tg = curve.getTangentAt(closed ? t % 1 : t)
    dist += p.distanceTo(prev)
    prev = p
    const nx = -tg.z
    const nz = tg.x
    pos.push(p.x + (nx * w) / 2, 0, p.z + (nz * w) / 2, p.x - (nx * w) / 2, 0, p.z - (nz * w) / 2)
    uv.push(0, dist / 3, w / 3, dist / 3)
    if (i < n) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3) // facing up
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return { geo: g, curve }
}

/** distance from (x, z) to a polyline */
function distToLine(x: number, z: number, pts: V2[]) {
  let best = Infinity
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i]
    const [bx, bz] = pts[i + 1]
    const dx = bx - ax
    const dz = bz - az
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)))
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t))
  }
  return best
}

/** an InstancedMesh from matrices (+ optional per-instance colours), added to the scene */
function instanced(T: Town, geo: THREE.BufferGeometry, mat: THREE.Material, mats: THREE.Matrix4[], colors?: THREE.Color[]) {
  if (!mats.length) return
  const im = new THREE.InstancedMesh(geo, mat, mats.length)
  mats.forEach((m, i) => im.setMatrixAt(i, m))
  colors?.forEach((c, i) => im.setColorAt(i, c))
  im.castShadow = false
  im.receiveShadow = true
  im.computeBoundingSphere()
  T.scene.add(im)
  T.disposables.push(geo)
}

const mtx = (x: number, y: number, z: number, ry: number, s: number, sy = s) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(UP, ry), new THREE.Vector3(s, sy, s))

/** a lumpy canopy: a few jittered blobs merged into one geometry */
function canopy(blobs: [number, number, number, number][], seed: number) {
  const r = rng(seed)
  const parts = blobs.map(([x, y, z, s]) => {
    const g = new THREE.IcosahedronGeometry(s, 1)
    const p = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      const k = 1 + (r() - 0.5) * 0.22
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.85, p.getZ(i) * k)
    }
    g.translate(x, y, z)
    return g
  })
  const m = mergeGeometries(parts)!
  parts.forEach((g) => g.dispose())
  m.computeVertexNormals()
  return m
}

function glowMat(T: Town, color = '#ffffff', k = 1) {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: false })
  T.disposables.push(m)
  return m
}

/** a timber lantern post (forest + pier), with a warm light in the pool */
function lanternPost(T: Town, x: number, z: number, ry: number, glass: THREE.Material, h = 2.3) {
  const F = Frame.at(T.batch, x, 0, z, ry)
  F.put(new THREE.CylinderGeometry(0.07, 0.1, h, 6), T.P.bark, 0, h / 2, 0)
  F.box(0.5, 0.06, 0.06, T.P.bark, 0.22, h - 0.12, 0)
  F.box(0.03, 0.18, 0.03, T.P.iron, 0.42, h - 0.24, 0)
  F.box(0.2, 0.26, 0.2, T.P.iron, 0.42, h - 0.46, 0)
  F.box(0.15, 0.2, 0.15, glass, 0.42, h - 0.46, 0, false)
  const c = Math.cos(ry)
  const s = Math.sin(ry)
  T.lights.push({ x: x + 0.42 * c, y: h - 0.5, z: z - 0.42 * s, color: '#ffcf80', intensity: 3.2, dist: 8, priority: 3 })
  T.colliders.push({ kind: 'circle', x, z, r: 0.18, h })
}

/* ══════════════════════════ ENCHANTED FOREST ══════════════════════════ */

export const FOREST = {
  gate: { x: -80, z: -18 },
  clearing: { x: -70, z: -52, r: 9 },
  oak: { x: -70, z: -58.5 },
  ring: { x: -70, z: -49.5, r: 3 },
  glade: { x: -93, z: -57, r: 6 },
  view: { x: -46, z: -27, r: 5 },
}
const F_MAIN: V2[] = [[-80, -11], [-80, -22], [-79, -30], [-74, -38], [-71, -46], [-70, -50]]
const F_WEST: V2[] = [[-79, -31], [-86, -36], [-92, -44], [-93, -53]]
const F_EAST: V2[] = [[-74, -38], [-64, -38.5], [-55, -34], [-48, -28]]
const F_LOOP: V2[] = [[-63, -53], [-56, -50], [-51, -42], [-55, -34]]
const F_PATHS = [F_MAIN, F_WEST, F_EAST, F_LOOP]

/** firefly + wisp anchors for World's night effects */
export const FOREST_WISPS = [
  { x: -70, y: 0.8, z: -52, r: 7, n: 26 },
  { x: -93, y: 0.6, z: -57, r: 5, n: 14 },
  { x: -79, y: 0.7, z: -30, r: 6, n: 12 },
  { x: -58, y: 0.7, z: -45, r: 7, n: 14 },
]

export function enchantedForest(T: Town, q: Quality, seats: BenchSpot[]) {
  const P = T.P
  const D = T.disposables
  const R = rng(4242)
  const Fz = DISTRICTS.forest
  const std = (p: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial(p)
    D.push(m)
    return m
  }

  // ── the forest floor: dark moss, then the dirt paths over it ──
  {
    const w = Fz.x1 - Fz.x0
    const d = Fz.z1 - Fz.z0
    const g = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2)
    const u = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < u.count; i++) u.setXY(i, (u.getX(i) * w) / 6, (u.getY(i) * d) / 6)
    T.batch.put(g, std({ map: P.ground.map, color: '#4a5a42', roughness: 1 }), (Fz.x0 + Fz.x1) / 2, 0.008, (Fz.z0 + Fz.z1) / 2, 0, 1, 1, 1, { cast: false })
    const dirt = std({ map: P.ground.map, color: '#8a7050', roughness: 1 })
    for (const pts of F_PATHS) T.batch.put(ribbon(pts, pts === F_MAIN ? 2.6 : 2.0).geo, dirt, 0, 0.018, 0, 0, 1, 1, 1, { cast: false })
    // the clearing: a round of trodden earth
    T.batch.put(new THREE.CircleGeometry(FOREST.clearing.r - 2, 40).rotateX(-Math.PI / 2), dirt, FOREST.clearing.x, 0.016, FOREST.clearing.z - 1.5, 0, 1, 1, 1, { cast: false })
    T.batch.put(new THREE.CircleGeometry(FOREST.glade.r - 1.5, 32).rotateX(-Math.PI / 2), dirt, FOREST.glade.x, 0.016, FOREST.glade.z, 0, 1, 1, 1, { cast: false })
  }

  // ── the gate: two mossy pillars, a bent-branch arch, the ornate sign on both faces ──
  {
    const { x, z } = FOREST.gate
    for (const dx of [-2.6, 2.6]) {
      T.batch.put(boxUV(0.9, 3.0, 0.9, 1.2), P.stone, x + dx, 1.5, z)
      T.batch.put(boxUV(1.05, 0.16, 1.05, 1), P.stoneLight, x + dx, 3.08, z)
      T.batch.put(new THREE.IcosahedronGeometry(0.5, 1).scale(1.1, 0.6, 1.1), P.foliageDark, x + dx, 3.3, z)
      T.colliders.push({ kind: 'circle', x: x + dx, z, r: 0.6, h: 3.2 })
    }
    T.batch.put(new THREE.TorusGeometry(2.6, 0.13, 6, 24, Math.PI), P.bark, x, 3.0, z)
    T.batch.put(new THREE.TorusGeometry(2.45, 0.07, 5, 24, Math.PI), P.foliageDark, x, 3.05, z + 0.05)
    for (const ry of [0, Math.PI]) ornateSign(T, Frame.at(T.batch, x, 4.1, z + (ry ? -0.07 : 0.07), ry), 'ENCHANTED FOREST', { h: 0.62, crest: null })
    fingerpost(T, x + 3.6, z + 4.2, [
      { label: 'ENCHANTED FOREST', to: [FOREST.clearing.x, FOREST.clearing.z] },
      { label: 'HAUNTED SQUARE', to: [-80, 2.5] },
    ])
  }

  // ── trees: dark trunks, teal / violet / deep-green canopies; never on paths or in clearings ──
  const clear = (x: number, z: number, m: number) => {
    if (F_PATHS.some((p) => distToLine(x, z, p) < m + 1.4)) return false
    for (const c of [FOREST.clearing, FOREST.glade, FOREST.view]) if (Math.hypot(x - c.x, z - c.z) < c.r + m) return false
    if (Math.hypot(x - FOREST.gate.x, z - FOREST.gate.z) < 5 + m) return false
    return x > Fz.x0 + 1.2 && x < Fz.x1 - 1.2 && z > Fz.z0 + 1.2 && z < Fz.z1 - 1.2
  }
  const nTrees = q === 'high' ? 150 : q === 'medium' ? 115 : 80
  const trees: V2[] = []
  for (let i = 0; i < nTrees * 30 && trees.length < nTrees; i++) {
    const x = Fz.x0 + R() * (Fz.x1 - Fz.x0)
    const z = Fz.z0 + R() * (Fz.z1 - Fz.z0)
    if (!clear(x, z, 1.2)) continue
    if (trees.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 3.3)) continue
    trees.push([x, z])
  }
  {
    const trunk = new THREE.CylinderGeometry(0.2, 0.36, 3.4, 7).translate(0, 1.7, 0)
    const crown = canopy([[0, 4.3, 0, 1.7], [0.95, 3.7, 0.45, 1.15], [-0.85, 3.9, -0.5, 1.25], [0.1, 5.2, -0.2, 1.1]], 7)
    const leaf = std({ color: '#ffffff', roughness: 0.9, flatShading: true, emissive: '#0a1214', emissiveIntensity: 1 })
    const tints = ['#2e5a50', '#3a3a62', '#2c4a30', '#4a3a66', '#24504a'].map((c) => new THREE.Color(c))
    const tm: THREE.Matrix4[] = []
    const cm: THREE.Matrix4[] = []
    const cc: THREE.Color[] = []
    for (const [x, z] of trees) {
      const s = 0.85 + R() * 0.75
      const ry = R() * 6.28
      tm.push(mtx(x, 0, z, ry, s * 1.1, s))
      cm.push(mtx(x, 0, z, ry, s, s * (0.9 + R() * 0.3)))
      cc.push(tints[Math.floor(R() * tints.length)].clone().multiplyScalar(0.85 + R() * 0.35))
      T.colliders.push({ kind: 'circle', x, z, r: 0.42 * s, h: 4 })
    }
    instanced(T, trunk, P.bark, tm)
    instanced(T, crown, leaf, cm, cc)
  }

  // ── the Elder Oak: a huge trunk on flaring roots, a glowing hollow, a canopy over the clearing ──
  {
    const { x, z } = FOREST.oak
    const F = Frame.at(T.batch, x, 0, z, 0)
    F.put(new THREE.CylinderGeometry(0.9, 1.5, 6.5, 12), P.bark, 0, 3.25, 0)
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + 0.3
      const root = new THREE.CylinderGeometry(0.16, 0.42, 2.4, 6).rotateZ(1.15).rotateY(-a)
      F.put(root, P.bark, Math.cos(a) * 1.5, 0.35, Math.sin(a) * 1.5)
    }
    for (const [bx, by, a] of [[1.4, 5.6, -0.7], [-1.5, 6.0, 0.8], [0.2, 6.4, 0.1]] as const) F.put(new THREE.CylinderGeometry(0.22, 0.5, 3.4, 7).rotateZ(a), P.bark, bx, by, 0.3)
    const crown = canopy([[0, 8.6, 0, 4.2], [3.4, 7.6, 1.0, 2.8], [-3.4, 7.8, -0.6, 3.0], [0.5, 7.4, 3.0, 2.6], [-0.4, 7.6, -3.0, 2.6]], 99)
    F.put(crown, std({ color: '#3a6a5a', roughness: 0.9, flatShading: true, emissive: '#0c2420', emissiveIntensity: 1 }), 0, 0, 0)
    // the hollow, facing the clearing: dark rim, warm glow inside
    F.put(new THREE.CircleGeometry(0.62, 20).scale(1, 1.5, 1), glowMat(T, '#ffb84a', 1.8), 0, 1.6, 1.42, 0, 0, 0, false)
    F.put(new THREE.TorusGeometry(0.66, 0.1, 6, 20).scale(1, 1.5, 1), P.bark, 0, 1.6, 1.4)
    T.lights.push({ x, y: 1.8, z: z + 2.2, color: '#ffb84a', intensity: 5, dist: 10, priority: 2 })
    T.colliders.push({ kind: 'circle', x, z, r: 2.0, h: 6 })
  }

  // ── mushrooms: a fairy ring in the clearing, clusters by the paths and the tree roots ──
  {
    const spots: [number, number, number][] = []
    const RG = FOREST.ring
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2
      spots.push([RG.x + Math.cos(a) * RG.r, RG.z + Math.sin(a) * RG.r, 0.9 + R() * 0.5])
    }
    const nM = q === 'high' ? 170 : q === 'medium' ? 120 : 80
    for (let i = 0; i < nM * 10 && spots.length < nM; i++) {
      // half by the paths, half at tree roots
      let x: number
      let z: number
      if (R() < 0.5) {
        const pts = F_PATHS[Math.floor(R() * F_PATHS.length)]
        const k = Math.floor(R() * (pts.length - 1))
        const t = R()
        const side = (R() < 0.5 ? -1 : 1) * (1.6 + R() * 1.6)
        const [ax, az] = pts[k]
        const [bx, bz] = pts[k + 1]
        const len = Math.hypot(bx - ax, bz - az)
        x = ax + (bx - ax) * t + (-(bz - az) / len) * side
        z = az + (bz - az) * t + ((bx - ax) / len) * side
      } else {
        const [tx, tz] = trees[Math.floor(R() * trees.length)] ?? [FOREST.oak.x, FOREST.oak.z]
        const a = R() * 6.28
        x = tx + Math.cos(a) * (0.7 + R() * 0.8)
        z = tz + Math.sin(a) * (0.7 + R() * 0.8)
      }
      if (F_PATHS.some((p) => distToLine(x, z, p) < 1.3)) continue
      if (x < Fz.x0 + 0.6 || x > Fz.x1 - 0.6 || z < Fz.z0 + 0.6 || z > Fz.z1 - 0.6) continue
      const n = 1 + Math.floor(R() * 3)
      for (let j = 0; j < n; j++) spots.push([x + (R() - 0.5) * 0.6, z + (R() - 0.5) * 0.6, 0.5 + R() * 0.9])
    }
    const stem = new THREE.CylinderGeometry(0.045, 0.07, 0.26, 6).translate(0, 0.13, 0)
    const cap = new THREE.SphereGeometry(0.2, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1).translate(0, 0.24, 0)
    const caps = ['#5fe0d0', '#b98cff', '#ffd25a', '#ff8ad8', '#7affb0'].map((c) => new THREE.Color(c).multiplyScalar(1.5))
    const sm: THREE.Matrix4[] = []
    const cc: THREE.Color[] = []
    for (const [x, z, s] of spots) {
      sm.push(mtx(x, 0, z, R() * 6.28, s))
      cc.push(caps[Math.floor(R() * caps.length)])
    }
    instanced(T, stem, std({ color: '#e8e0d0', roughness: 0.8 }), sm)
    instanced(T, cap, glowMat(T), sm, cc)
    // the ring gives off a soft violet light
    T.lights.push({ x: RG.x, y: 0.8, z: RG.z, color: '#b98cff', intensity: 3, dist: 7, priority: 3 })
  }

  // ── mossy rocks + ferny bushes in the undergrowth ──
  {
    const rm: THREE.Matrix4[] = []
    const bm: THREE.Matrix4[] = []
    const nR = q === 'low' ? 30 : 50
    for (let i = 0; i < nR * 20 && rm.length + bm.length < nR * 2; i++) {
      const x = Fz.x0 + R() * (Fz.x1 - Fz.x0)
      const z = Fz.z0 + R() * (Fz.z1 - Fz.z0)
      if (!clear(x, z, 0.2) || trees.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 1.4)) continue
      const s = 0.5 + R() * 0.9
      if (rm.length < nR && R() < 0.5) {
        rm.push(mtx(x, s * 0.15, z, R() * 6.28, s, s * 0.6))
        if (s > 0.9) T.colliders.push({ kind: 'circle', x, z, r: s * 0.55, h: s * 0.6 })
      } else bm.push(mtx(x, 0, z, R() * 6.28, s, s * 0.7))
    }
    instanced(T, new THREE.DodecahedronGeometry(0.7, 0), std({ color: '#6a7a62', roughness: 0.95, flatShading: true }), rm)
    instanced(T, new THREE.IcosahedronGeometry(0.75, 0).translate(0, 0.35, 0), std({ color: '#2c4a34', roughness: 0.95, flatShading: true }), bm)
  }

  // ── the moonstone glade: a standing stone with glowing runes, a ring of small stones ──
  {
    const { x, z } = FOREST.glade
    const F = Frame.at(T.batch, x, 0, z, 0.4)
    F.put(new THREE.CylinderGeometry(0.45, 0.7, 2.8, 6), P.stoneLight, 0, 1.4, 0)
    const rune = glowMat(T, '#7fe8ff', 1.6)
    for (const [ry, y] of [[0, 1.5], [Math.PI * 0.66, 1.2], [Math.PI * 1.33, 1.8]] as const) {
      const r0 = Frame.at(T.batch, x, 0, z, 0.4 + ry)
      for (let k = 0; k < 3; k++) r0.box(0.06, 0.32 - k * 0.06, 0.01, rune, -0.12 + k * 0.12, y + k * 0.1, 0.56, false)
    }
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2
      T.batch.put(new THREE.DodecahedronGeometry(0.4, 0).scale(1, 0.7, 1), P.rock, x + Math.cos(a) * 3.6, 0.2, z + Math.sin(a) * 3.6, a)
      T.colliders.push({ kind: 'circle', x: x + Math.cos(a) * 3.6, z: z + Math.sin(a) * 3.6, r: 0.4, h: 0.5 })
    }
    T.colliders.push({ kind: 'circle', x, z, r: 0.8, h: 2.8 })
    T.lights.push({ x, y: 1.6, z, color: '#7fe8ff', intensity: 4, dist: 9, priority: 3 })
  }

  // ── lanterns along the main path, a bench at the castle view ──
  {
    const glass = glowMat(T, '#ffcf80', 2.2)
    let side = 1
    for (const pts of [F_MAIN, F_WEST, F_EAST]) {
      const { curve } = ribbon(pts, 1)
      const L = curve.getLength()
      for (let d = 6; d < L - 2; d += 10) {
        const p = curve.getPointAt(d / L)
        const tg = curve.getTangentAt(d / L)
        const lx = p.x - tg.z * 1.9 * side
        const lz = p.z + tg.x * 1.9 * side
        lanternPost(T, lx, lz, Math.atan2(tg.x, tg.z) + (side > 0 ? 0 : Math.PI), glass)
        side = -side
      }
    }
    const v = FOREST.view
    parkBench(T, v.x, v.z, Math.atan2(0 - v.x, -31 - v.z), 'Sit and look at the castle', seats)
  }
}

/* ══════════════════════════ MOONLIGHT LAKE ══════════════════════════ */

export const LAKE_SPOTS = {
  pavilion: { x: LAKE.x, z: 9.4, r: 3.1 },
  path: 1.17,
  link: { z: 36.25, x0: 63.5, x1: 78 },
}
export const LAKE_FIREFLIES = [
  { x: 80, y: 0.5, z: 26, r: 6, n: 16 },
  { x: 116, y: 0.5, z: 38, r: 6, n: 16 },
  { x: 98, y: 0.6, z: 50, r: 5, n: 10 },
  { x: 98, y: 0.8, z: 10, r: 5, n: 12 },
]
/** points on the ellipse at normalised radius k (angle a) */
const onRing = (k: number, a: number): V2 => [LAKE.x + Math.cos(a) * LAKE.rx * k, LAKE.z + Math.sin(a) * LAKE.rz * k]
const nearPier = (x: number, z: number, m = 0) => x > PIER.head.x0 - m && x < PIER.head.x1 + m && z > PIER.head.z0 - m && z < PIER.z1 + m

export function moonlightLake(T: Town, waterNormal: THREE.Texture, q: Quality, seats: BenchSpot[]) {
  const P = T.P
  const D = T.disposables
  const R = rng(777)
  const std = (p: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial(p)
    D.push(m)
    return m
  }

  // ── water: one ellipse, world-scale UVs ──
  {
    const W = waterMaterial(waterNormal, D, '#1e4a6e', '#0a1c38')
    W.material.roughness = 0.12
    const g = new THREE.CircleGeometry(1, 72).rotateX(-Math.PI / 2).scale(LAKE.rx, 1, LAKE.rz)
    const uv = g.attributes.uv as THREE.BufferAttribute
    const pos = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 5, pos.getZ(i) / 5)
    const water = new THREE.Mesh(g, W.material)
    water.position.set(LAKE.x, LAKE.water, LAKE.z)
    water.receiveShadow = true
    T.scene.add(water)
    D.push(g)
    T.dynamic.push({ update: (t) => (W.time.value = t) })
  }

  // ── paths: Motor Row's setts carry on to a gravel ring round the shore ──
  {
    const { z, x0, x1 } = LAKE_SPOTS.link
    const g = new THREE.PlaneGeometry(x1 - x0, 4.1).rotateX(-Math.PI / 2)
    const u = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < u.count; i++) u.setXY(i, (u.getX(i) * (x1 - x0)) / 3, (u.getY(i) * 4.1) / 3)
    T.batch.put(g, P.cobble, (x0 + x1) / 2, 0.024, z, 0, 1, 1, 1, { cast: false })
    const ring: V2[] = []
    for (let k = 0; k < 28; k++) ring.push(onRing(LAKE_SPOTS.path, (k / 28) * Math.PI * 2))
    T.batch.put(ribbon(ring, 2.6, true).geo, std({ map: P.ground.map, color: '#d8c8a4', roughness: 0.95 }), 0, 0.02, 0, 0, 1, 1, 1, { cast: false })
    fingerpost(T, 66.8, z - 3.0, [
      { label: 'MOONLIGHT LAKE', to: [LAKE.x, LAKE.z] },
      { label: 'MOTOR ROW', to: [40, z] },
    ])
  }

  // ── shore: a band of rocks at the waterline, reeds in the shallows, lily pads + lotus flowers ──
  {
    const rm: THREE.Matrix4[] = []
    for (let k = 0; k < 90; k++) {
      const a = (k / 90) * Math.PI * 2 + R() * 0.03
      const [x, z] = onRing(0.985 + R() * 0.03, a)
      if (nearPier(x, z, 0.6)) continue
      const s = 0.35 + R() * 0.45
      rm.push(mtx(x, -0.05, z, R() * 6.28, s, s * 0.55))
    }
    instanced(T, new THREE.DodecahedronGeometry(0.8, 0), std({ color: '#8a8478', roughness: 0.95, flatShading: true }), rm)

    const reeds: THREE.Matrix4[] = []
    const nR = q === 'high' ? 240 : q === 'medium' ? 170 : 100
    for (let i = 0; i < nR; i++) {
      const a = R() * Math.PI * 2
      const [x, z] = onRing(0.88 + R() * 0.1, a)
      if (nearPier(x, z, 1.2)) continue
      const n = 2 + Math.floor(R() * 3)
      for (let j = 0; j < n; j++) reeds.push(mtx(x + (R() - 0.5) * 0.5, LAKE.water - 0.1, z + (R() - 0.5) * 0.5, R() * 6.28, 0.7 + R() * 0.6, 0.8 + R() * 0.7))
    }
    instanced(T, new THREE.ConeGeometry(0.05, 1.05, 4).translate(0, 0.52, 0), std({ color: '#7a9a52', roughness: 0.9, emissive: '#101a08' }), reeds)

    const pads: THREE.Matrix4[] = []
    const lotus: THREE.Matrix4[] = []
    for (let i = 0; i < 46; i++) {
      const a = R() * Math.PI * 2
      const [x, z] = onRing(0.45 + R() * 0.45, a)
      if (nearPier(x, z, 1.0)) continue
      const s = 0.6 + R() * 0.7
      pads.push(mtx(x, LAKE.water + 0.015, z, R() * 6.28, s, 1))
      if (R() < 0.3) lotus.push(mtx(x + 0.1, LAKE.water + 0.02, z, R() * 6.28, 0.8 + R() * 0.4))
    }
    instanced(T, new THREE.CircleGeometry(0.45, 12, 0.3, Math.PI * 2 - 0.6).rotateX(-Math.PI / 2), std({ color: '#3a6a3e', roughness: 0.7, side: THREE.DoubleSide }), pads)
    instanced(T, new THREE.IcosahedronGeometry(0.13, 0).scale(1, 0.7, 1).translate(0, 0.07, 0), glowMat(T, '#ff9ad8', 1.6), lotus)
  }

  // ── the pier: plank deck to the middle of the lake, posts, a rope rail, lanterns on the head, two rowing boats ──
  {
    const deckM = std({ map: P.woodLight.map ?? undefined, color: '#8a6040', roughness: 0.85 })
    const plank = (x0: number, x1: number, z0: number, z1: number) => {
      for (let z = z0; z < z1 - 0.01; z += 0.34) T.batch.put(boxUV(x1 - x0, 0.07, 0.3, 1), deckM, (x0 + x1) / 2, 0.02, z + 0.17, 0, 1, 1, 1, { cast: false })
    }
    plank(PIER.x0, PIER.x1, PIER.head.z1, PIER.z1)
    plank(PIER.head.x0, PIER.head.x1, PIER.head.z0, PIER.head.z1)
    const post = new THREE.CylinderGeometry(0.11, 0.12, 1.9, 6)
    const posts: V2[] = []
    for (let z = PIER.head.z1 + 1; z < PIER.z1; z += 2.4) posts.push([PIER.x0 - 0.05, z], [PIER.x1 + 0.05, z])
    for (const x of [PIER.head.x0 - 0.05, PIER.head.x1 + 0.05]) for (const z of [PIER.head.z0, (PIER.head.z0 + PIER.head.z1) / 2]) posts.push([x, z])
    posts.push([PIER.head.x0 + 1.2, PIER.head.z0 - 0.05], [PIER.head.x1 - 1.2, PIER.head.z0 - 0.05])
    for (const [x, z] of posts) T.batch.put(post, P.bark, x, -0.35, z)
    // rope between the posts above the deck (along both sides of the walkway)
    for (const x of [PIER.x0 - 0.05, PIER.x1 + 0.05]) T.batch.put(new THREE.CylinderGeometry(0.025, 0.025, PIER.z1 - PIER.head.z1 - 1, 5).rotateX(Math.PI / 2), std({ color: '#c8b48a', roughness: 0.9 }), x, 0.5, (PIER.head.z1 + 1 + PIER.z1) / 2)
    const glass = glowMat(T, '#ffcf80', 2.2)
    lanternPost(T, PIER.head.x0 + 0.3, PIER.head.z0 + 0.3, Math.PI / 2, glass, 2.0)
    lanternPost(T, PIER.head.x1 - 0.3, PIER.head.z0 + 0.3, -Math.PI / 2, glass, 2.0)
    // rowing boats tied either side of the head, bobbing
    const hull = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(0.62, 0.38, 1.5)
    const hullM = std({ color: '#5a3a2a', roughness: 0.8, side: THREE.DoubleSide })
    const trimM = std({ color: '#c8a050', roughness: 0.6, metalness: 0.4 })
    D.push(hull)
    for (const [bx, bz, ry] of [[PIER.head.x0 - 1.1, PIER.head.z1 + 1.6, 0.1], [PIER.head.x1 + 1.1, PIER.head.z1 + 2.4, -0.15]] as const) {
      const g = new THREE.Group()
      const h = new THREE.Mesh(hull, hullM)
      g.add(h)
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 0.28), trimM)
      seat.position.y = -0.06
      g.add(seat)
      const floor = new THREE.Mesh(new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2).scale(0.5, 1, 1.25), hullM)
      floor.position.y = -0.24
      g.add(floor)
      for (const sz of [-0.95, 0.95]) {
        const oar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 1.6), trimM)
        oar.position.set(sz * 0.3, -0.02, 0.1)
        oar.rotation.y = sz * 0.25
        g.add(oar)
        D.push(oar.geometry)
      }
      D.push(seat.geometry, floor.geometry)
      g.position.set(bx, LAKE.water + 0.3, bz)
      g.rotation.y = ry
      T.scene.add(g)
      const ph = bx * 0.7
      T.dynamic.push({ update: (t) => {
        g.position.y = LAKE.water + 0.3 + Math.sin(t * 1.3 + ph) * 0.03
        g.rotation.z = Math.sin(t * 0.9 + ph) * 0.04
      } })
    }
  }

  // ── the pavilion on the north shore: eight slim columns, a slate dome, a lantern ──
  {
    const { x, z, r } = LAKE_SPOTS.pavilion
    T.batch.put(new THREE.CylinderGeometry(r + 0.3, r + 0.4, 0.06, 8), P.stoneLight, x, 0.03, z, Math.PI / 8)
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2
      const cx = x + Math.cos(a) * r
      const cz = z + Math.sin(a) * r
      T.batch.put(new THREE.CylinderGeometry(0.12, 0.14, 3.2, 8), P.stoneLight, cx, 1.6, cz)
      T.batch.put(boxUV(0.34, 0.16, 0.34, 1), P.stone, cx, 0.08, cz)
      T.colliders.push({ kind: 'circle', x: cx, z: cz, r: 0.2, h: 3.2 })
    }
    T.batch.put(new THREE.CylinderGeometry(r + 0.35, r + 0.35, 0.3, 8), P.stone, x, 3.35, z, Math.PI / 8)
    T.batch.put(new THREE.SphereGeometry(r + 0.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.8, 1), P.roofSlate, x, 3.5, z)
    T.batch.put(new THREE.ConeGeometry(0.12, 0.7, 6), P.gold, x, 6.35, z)
    T.batch.put(new THREE.SphereGeometry(0.16, 8, 6), P.gold, x, 6.0, z)
    T.batch.put(new THREE.CylinderGeometry(0.01, 0.01, 0.8, 4), P.iron, x, 2.95, z)
    T.batch.put(new THREE.BoxGeometry(0.28, 0.36, 0.28), glowMat(T, '#ffcf80', 2.2), x, 2.4, z, 0, 1, 1, 1, { cast: false })
    T.lights.push({ x, y: 2.3, z, color: '#ffcf80', intensity: 5, dist: 10, priority: 2 })
  }

  // ── willows round the lake: a dome canopy with a drooping fringe ──
  {
    const pts: V2[] = []
    const nW = q === 'high' ? 28 : q === 'medium' ? 22 : 15
    const L = DISTRICTS.lake
    for (let i = 0; i < nW * 40 && pts.length < nW; i++) {
      const x = L.x0 + 2 + R() * (L.x1 - L.x0 - 4)
      const z = L.z0 + 2 + R() * (L.z1 - L.z0 - 4)
      const lr = lakeR(x, z)
      if (lr < 1.42 || lr > 2.6) continue
      if (x < 82 && Math.abs(z - LAKE_SPOTS.link.z) < 5) continue
      if (Math.hypot(x - LAKE_SPOTS.pavilion.x, z - LAKE_SPOTS.pavilion.z) < 6.5) continue
      if (Math.abs(x - LAKE.x) < 3 && z > 44) continue
      if (pts.some(([px, pz]) => Math.hypot(px - x, pz - z) < 5)) continue
      pts.push([x, z])
    }
    const trunk = new THREE.CylinderGeometry(0.22, 0.34, 3.6, 7).translate(0, 1.8, 0)
    const dome = canopy([[0, 4.2, 0, 2.0], [0.9, 3.9, 0.3, 1.3], [-0.9, 4.0, -0.3, 1.3]], 31)
    const fringe = new THREE.CylinderGeometry(2.0, 2.4, 1.6, 20, 2, true).translate(0, 3.3, 0)
    {
      const p = fringe.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < p.count; i++) if (p.getY(i) < 3) p.setY(i, p.getY(i) + Math.sin(i * 2.7) * 0.3)
      fringe.computeVertexNormals()
    }
    const leaf = std({ color: '#ffffff', roughness: 0.9, flatShading: true, emissive: '#081410', emissiveIntensity: 1, side: THREE.DoubleSide })
    const tm: THREE.Matrix4[] = []
    const cm: THREE.Matrix4[] = []
    const cc: THREE.Color[] = []
    for (const [x, z] of pts) {
      const s = 0.85 + R() * 0.4
      const ry = R() * 6.28
      tm.push(mtx(x, 0, z, ry, s))
      cm.push(mtx(x, 0, z, ry, s))
      cc.push(new THREE.Color(R() < 0.5 ? '#6a9a5a' : '#5a8a66').multiplyScalar(0.9 + R() * 0.3))
      T.colliders.push({ kind: 'circle', x, z, r: 0.45 * s, h: 4 })
    }
    instanced(T, trunk, P.bark, tm)
    instanced(T, dome, leaf, cm, cc)
    instanced(T, fringe, leaf, cm, cc)

    // wildflower meadows + low bushes on the open grass between the willows
    const cards = new THREE.PlaneGeometry(0.42, 0.42).translate(0, 0.21, 0)
    const cross = mergeGeometries([cards.clone(), cards.clone().rotateY(Math.PI / 2)])!
    const fm: THREE.Matrix4[] = []
    const bm: THREE.Matrix4[] = []
    for (let i = 0; i < 600 && fm.length < (q === 'low' ? 180 : 320); i++) {
      const x = L.x0 + 2 + R() * (L.x1 - L.x0 - 4)
      const z = L.z0 + 2 + R() * (L.z1 - L.z0 - 4)
      const lr = lakeR(x, z)
      if (lr < 1.42 || (x < 82 && Math.abs(z - LAKE_SPOTS.link.z) < 4)) continue
      if (pts.some(([px, pz]) => Math.hypot(px - x, pz - z) < 2.6)) continue
      // patches, not a carpet
      if (Math.sin(x * 0.21) + Math.cos(z * 0.17 + 1.3) < 0.6) continue
      const s = 0.8 + R() * 0.6
      fm.push(mtx(x, 0.02, z, R() * 6.28, s))
      if (R() < 0.12) bm.push(mtx(x + 0.8, 0, z, R() * 6.28, 0.6 + R() * 0.5, 0.5))
    }
    instanced(T, cross, P.flowers, fm)
    cards.dispose()
    instanced(T, new THREE.IcosahedronGeometry(0.8, 1).translate(0, 0.45, 0), std({ color: '#4a7a46', roughness: 0.95, flatShading: true }), bm)
  }

  // ── lamps + benches facing the water (the lamp posts come from World's lamp pass) ──
  const benchAngles = [0.35, 1.05, 2.09, 2.45, 3.84, 5.23]
  for (const a of benchAngles) {
    const [x, z] = onRing(1.36, a)
    parkBench(T, x, z, Math.atan2(LAKE.x - x, LAKE.z - z), 'Sit by the lake', seats)
  }
}

/** lamp posts round Moonlight Lake (passed to World's lampPosts with the rest of the city's) */
export function lakeLamps(): V2[] {
  const out: V2[] = []
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2 + 0.17
    const [x, z] = onRing(1.33, a)
    if (x < 80 && Math.abs(z - LAKE_SPOTS.link.z) < 3.5) continue // the street joins here
    if (Math.abs(x - LAKE.x) < 2.5) continue // pier + pavilion approaches
    out.push([x, z])
  }
  return out
}
