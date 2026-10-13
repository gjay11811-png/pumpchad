import * as THREE from 'three'
import type { Quality } from '../../save'
import { bannerTexture } from '../textures'
import type { Town } from './buildings'
import { Cloth, Fire } from './fx'
import { boxUV, rng } from './kit'
import { shopSign } from './textures'
import type { KingdomStyle, styleMaterials } from './style'

type SM = ReturnType<typeof styleMaterials>

/**
 * CHAD KINGDOM perimeter: the town sits on a cliff-top plateau.
 *  - crenellated walls + eight watchtowers around the town
 *  - the south edge opens into a low-parapet LOOKOUT TERRACE over the valley (the Chad City viewpoint)
 *  - a south gatehouse with a closed portcullis: the road to Chad City continues outside, but it's shut for now
 *  - terrain outside the walls falls away into a misty valley, with pine forest and distant mountains
 */
export const WALL_R = 35.9
const DEG = Math.PI / 180
/** south terrace: angles (atan2(z, x)) between these are low parapet instead of high wall */
const TERRACE = [62 * DEG, 118 * DEG]
const GATE_HALF = 7.5 * DEG
export const GATE = { x: 0, z: 36.6 }
export const CITY_SIGN = { x: 3.3, z: 33.1 }
export const BENCHES: { x: number; z: number; ry: number }[] = [
  { x: -9.6, z: 32.1, ry: 0 }, // seat faces south: you sit looking out at Chad City, clear of the gatehouse towers
  { x: 9.8, z: 32.0, ry: 0 },
]

/** Terrain outside the walls: gentle lip, steep cliff into the valley, flat valley floor (y = −32). */
export function outerHeight(r: number) {
  if (r < 39) return -0.12 * (r - 36.4)
  const t = Math.min(1, (r - 39) / 34)
  const cliff = -0.31 - 31.7 * (t * t * (3 - 2 * t))
  // past the cliff the valley keeps sinking gently toward Chad City's floor (−44 m)
  return r < 73 ? cliff : cliff - Math.min(12, (r - 73) * 0.06)
}

export function kingdom(T: Town, style: KingdomStyle, M: SM, q: Quality) {
  const P = T.P
  const R = rng(4242)
  const inTerrace = (a: number) => a > TERRACE[0] && a < TERRACE[1]
  const nearGate = (a: number) => Math.abs(a - Math.PI / 2) < GATE_HALF
  const norm = (a: number) => (a + Math.PI * 2) % (Math.PI * 2)

  /* ── walls ── */
  const SEG = 48
  const H = 3.8
  for (let i = 0; i < SEG; i++) {
    const a = norm((i / SEG) * Math.PI * 2)
    const x = Math.cos(a) * WALL_R
    const z = Math.sin(a) * WALL_R
    if (z < -27) continue // the castle closes the north
    const ry = -a + Math.PI / 2
    const len = (2 * Math.PI * WALL_R) / SEG + 0.12
    if (nearGate(a)) continue
    if (inTerrace(a)) {
      // low parapet with a coping stone and a plinth: you can lean on it and look out
      T.batch.put(boxUV(len, 1.0, 0.7, 1.5), M.stone, x, 0.5, z, ry)
      T.batch.put(boxUV(len, 0.16, 0.95, 1.5), M.trim, x, 1.08, z, ry)
      T.batch.put(boxUV(len, 0.3, 1.1, 1.5), M.trim, x, 0.15, z, ry, 1, 1, 1, { cast: false })
      continue
    }
    T.batch.put(boxUV(len, H, 1.2, 1.8), M.stone, x, H / 2, z, ry)
    // wall-walk ledge on the town side + coping
    const ix = Math.cos(a) * (WALL_R - 0.75)
    const iz = Math.sin(a) * (WALL_R - 0.75)
    T.batch.put(boxUV(len, 0.22, 0.5, 1.5), M.trim, ix, H - 0.4, iz, ry)
    // crenellations: four merlons per segment
    for (let k = 0; k < 4; k++) {
      const off = (k - 1.5) * (len / 4)
      T.batch.put(boxUV(len / 4 - 0.55, 0.8, 1.25, 1), M.stone, x + Math.cos(ry) * off, H + 0.4, z - Math.sin(ry) * off, ry)
    }
    // buttress every other segment (breaks up the long run, reads as real masonry)
    if (i % 2 === 0) T.batch.put(boxUV(0.7, H * 0.7, 0.8, 1), M.trim, Math.cos(a) * (WALL_R - 0.85), H * 0.35, Math.sin(a) * (WALL_R - 0.85), ry)
  }

  /* ── watchtowers ── */
  const banner = bannerTexture()
  const bannerMat = new THREE.MeshStandardMaterial({ map: banner, roughness: 0.8, side: THREE.DoubleSide, color: style.id === 'balanced' ? '#ffffff' : style.banner[0] })
  T.disposables.push(banner, bannerMat)
  for (const deg of [330, 0, 30, 60, 120, 150, 180, 210]) {
    const a = deg * DEG
    const tr = WALL_R + 0.3
    const x = Math.cos(a) * tr
    const z = Math.sin(a) * tr
    const r = 2.1
    const h = 8.6
    T.batch.put(new THREE.CylinderGeometry(r, r * 1.08, h, 18), M.stone, x, h / 2, z)
    T.batch.put(new THREE.CylinderGeometry(r * 1.18, r * 1.0, 0.5, 18), M.trim, x, h + 0.05, z) // corbelled top
    for (let k = 0; k < 8; k++) {
      const ma = (k / 8) * Math.PI * 2
      T.batch.put(boxUV(0.7, 0.75, 0.45, 1), M.stone, x + Math.cos(ma) * r * 1.08, h + 0.65, z + Math.sin(ma) * r * 1.08, -ma + Math.PI / 2)
    }
    const roofH = r * 2.4 * style.spire
    T.batch.put(new THREE.ConeGeometry(r * 1.3, roofH, 18), M.roof, x, h + 0.35 + roofH / 2, z)
    if (style.finials) T.batch.put(new THREE.SphereGeometry(0.22, 10, 8), M.finial, x, h + 0.45 + roofH, z)
    // lit arrow slits facing the town (two levels)
    const toward = Math.atan2(-x, -z)
    for (const y of [3.4, 6.4]) {
      const wx = x + Math.sin(toward) * (r + 0.03)
      const wz = z + Math.cos(toward) * (r + 0.03)
      T.batch.put(new THREE.PlaneGeometry(0.26, 0.9), P.windowLit, wx, y, wz, toward, 1, 1, 1, { cast: false })
    }
    T.colliders.push({ kind: 'circle', x, z, r: r + 0.35, h })
    // banner hanging on the town side
    const c = new Cloth(1.2, 2.6, bannerMat, 0.12)
    c.mesh.position.set(x + Math.sin(toward) * (r + 0.12), h - 1.8, z + Math.cos(toward) * (r + 0.12))
    c.mesh.rotation.y = toward
    T.scene.add(c.mesh)
    T.cloths.push(c)
    // torches on the towers that frame the lookout terrace
    if (deg === 60 || deg === 120) {
      const fx = x + Math.sin(toward) * (r + 0.4)
      const fz = z + Math.cos(toward) * (r + 0.4)
      T.batch.put(new THREE.CylinderGeometry(0.08, 0.12, 0.9, 6), P.iron, fx, 2.6, fz)
      const f = new Fire(fx, 3.1, fz, 0.6)
      T.fires.push(f)
      T.scene.add(f.group)
      T.lights.push({ x: fx, y: 3.4, z: fz, color: '#ff8a3a', intensity: 9, dist: 10, priority: 5, fire: f })
    }
  }

  /* ── south gatehouse: the road to Chad City (shut) ── */
  {
    const { x: gx, z: gz } = GATE
    for (const s of [-1, 1]) {
      const tx = gx + s * 4.7
      T.batch.put(new THREE.CylinderGeometry(2.3, 2.45, 10.5, 18), M.stone, tx, 5.25, gz)
      T.batch.put(new THREE.CylinderGeometry(2.7, 2.3, 0.6, 18), M.trim, tx, 10.6, gz)
      for (let k = 0; k < 9; k++) {
        const ma = (k / 9) * Math.PI * 2
        T.batch.put(boxUV(0.75, 0.8, 0.5, 1), M.stone, tx + Math.cos(ma) * 2.55, 11.25, gz + Math.sin(ma) * 2.55, -ma + Math.PI / 2)
      }
      const roofH = 5.6 * style.spire
      T.batch.put(new THREE.ConeGeometry(2.9, roofH, 18), M.roof, tx, 10.9 + roofH / 2, gz)
      if (style.finials) T.batch.put(new THREE.SphereGeometry(0.26, 10, 8), M.finial, tx, 11 + roofH, gz)
      T.batch.put(new THREE.PlaneGeometry(0.3, 1.1), P.windowLit, tx, 7.2, gz - 2.32, Math.PI, 1, 1, 1, { cast: false })
      T.colliders.push({ kind: 'circle', x: tx, z: gz, r: 2.7, h: 10 })
      // pier + arch block over the road
      T.batch.put(boxUV(1.0, 4.6, 3.2, 1.5), M.stone, gx + s * 2.7, 2.3, gz)
    }
    T.batch.put(boxUV(6.4, 3.6, 3.2, 1.8), M.stone, gx, 4.6 + 1.8, gz)
    T.batch.put(boxUV(6.8, 0.35, 3.5, 1.5), M.trim, gx, 4.55, gz) // arch lintel
    for (let k = 0; k < 5; k++) T.batch.put(boxUV(0.8, 0.8, 3.3, 1), M.stone, gx - 2.6 + k * 1.3, 8.8, gz)
    // portcullis: iron grid, lowered (the city is closed)
    for (let k = 0; k < 11; k++) T.batch.put(new THREE.BoxGeometry(0.09, 4.3, 0.09), P.iron, gx - 2.1 + k * 0.42, 2.15, gz - 1.1)
    for (let k = 0; k < 6; k++) T.batch.put(new THREE.BoxGeometry(4.4, 0.08, 0.09), P.iron, gx, 0.35 + k * 0.75, gz - 1.1)
    // banners on the gate towers (style colours)
    for (const s of [-1, 1]) {
      const c = new Cloth(1.4, 3.2, bannerMat, 0.14)
      c.mesh.position.set(gx + s * 4.7, 7.6, gz - 2.45)
      c.mesh.rotation.y = Math.PI
      T.scene.add(c.mesh)
      T.cloths.push(c)
    }
    // barricade in front of the portcullis: two timber sawhorses + a plank rail
    for (const s of [-1, 1]) {
      const leg = new THREE.BoxGeometry(0.12, 1.5, 0.12)
      leg.rotateZ(0.42)
      T.batch.put(leg, P.timber, gx + s * 1.3 - 0.25, 0.65, 35.05)
      const leg2 = new THREE.BoxGeometry(0.12, 1.5, 0.12)
      leg2.rotateZ(-0.42)
      T.batch.put(leg2, P.timber, gx + s * 1.3 + 0.25, 0.65, 35.05)
    }
    const stripes = new THREE.MeshStandardMaterial({ map: (() => {
      const c = document.createElement('canvas')
      c.width = 128
      c.height = 16
      const g = c.getContext('2d')!
      for (let i = 0; i < 8; i++) {
        g.fillStyle = i % 2 ? '#141216' : '#ff7a1a'
        g.beginPath()
        g.moveTo(i * 16, 16)
        g.lineTo(i * 16 + 8, 0)
        g.lineTo(i * 16 + 24, 0)
        g.lineTo(i * 16 + 16, 16)
        g.fill()
      }
      const t = new THREE.CanvasTexture(c)
      t.colorSpace = THREE.SRGBColorSpace
      T.disposables.push(t)
      return t
    })(), roughness: 0.7 })
    T.disposables.push(stripes)
    T.batch.put(new THREE.BoxGeometry(4.2, 0.28, 0.08), stripes, gx, 1.1, 34.98)
    // "CHAD CITY — COMING SOON" signpost on the road, lantern-lit
    const tex = shopSign('CHAD CITY', 'coming soon · road closed')
    const signMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.35 })
    T.disposables.push(tex, signMat)
    const { x: sx, z: sz } = CITY_SIGN
    for (const dx of [-1.05, 1.05]) T.batch.put(boxUV(0.16, 2.6, 0.16, 1), P.timber, sx + dx, 1.3, sz)
    T.batch.put(boxUV(2.5, 1.3, 0.12, 1), P.timber, sx, 1.95, sz + 0.02)
    T.batch.put(new THREE.PlaneGeometry(2.35, 1.17), signMat, sx, 1.95, sz - 0.05, Math.PI, 1, 1, 1, { cast: false })
    // arrow pointing down the road (south)
    const arrow = new THREE.Shape()
    arrow.moveTo(-0.5, 0.12)
    arrow.lineTo(0.25, 0.12)
    arrow.lineTo(0.25, 0.3)
    arrow.lineTo(0.6, 0)
    arrow.lineTo(0.25, -0.3)
    arrow.lineTo(0.25, -0.12)
    arrow.lineTo(-0.5, -0.12)
    T.batch.put(new THREE.ExtrudeGeometry(arrow, { depth: 0.06, bevelEnabled: false }), P.glowGold, sx + 0.3, 2.95, sz, -Math.PI / 2, 1, 1, 1, { cast: false })
    T.colliders.push({ kind: 'box', minX: sx - 1.25, maxX: sx + 1.25, minZ: sz - 0.2, maxZ: sz + 0.2, h: 2.6 })
    T.lights.push({ x: sx, y: 3.2, z: sz - 1.2, color: '#ffb067', intensity: 6, dist: 7, priority: 6 })
  }

  /* ── lookout benches (sit and watch the city) ── */
  for (const b of BENCHES) {
    const g = new THREE.Group()
    const seat = new THREE.Mesh(boxUV(1.9, 0.1, 0.5, 1), P.woodLight)
    seat.position.y = 0.48
    const back = new THREE.Mesh(boxUV(1.9, 0.5, 0.08, 1), P.woodLight)
    back.position.set(0, 0.82, -0.24)
    g.add(seat, back)
    for (const dx of [-0.8, 0.8]) {
      const leg = new THREE.Mesh(boxUV(0.1, 0.48, 0.45, 1), P.iron)
      leg.position.set(dx, 0.24, 0)
      g.add(leg)
    }
    g.position.set(b.x, 0, b.z)
    g.rotation.y = b.ry
    T.batch.absorb(g)
    g.traverse((o) => (o as THREE.Mesh).geometry?.dispose())
    const c = Math.cos(b.ry)
    T.colliders.push({ kind: 'box', minX: b.x - 1.0 * Math.abs(c) - 0.3, maxX: b.x + 1.0 * Math.abs(c) + 0.3, minZ: b.z - 0.3, maxZ: b.z + 0.3, h: 1 })
  }

  /* ── outside the walls: cliff, valley floor, forest, the road down ── */
  const radii = [36.4, 37.5, 39, 41, 44, 48, 53, 59, 66, 74, 84, 98, 118, 145, 180, 230, 300, 420]
  const segs = q === 'low' ? 64 : 112
  const pos: number[] = []
  const col: number[] = []
  const idx: number[] = []
  const rock = new THREE.Color('#2a2430')
  const grass = new THREE.Color('#1d2a1f')
  for (let ri = 0; ri < radii.length; ri++) {
    for (let si = 0; si <= segs; si++) {
      const a = (si / segs) * Math.PI * 2
      const r = radii[ri]
      const n = ri > 1 && ri < radii.length - 3 ? (Math.sin(a * 7 + ri) + Math.sin(a * 13 - ri * 2)) * 0.9 * Math.min(1, (r - 39) / 20) : 0
      pos.push(Math.cos(a) * r, outerHeight(r) + n, Math.sin(a) * r)
      const steep = r > 40 && r < 74 ? 1 : 0
      const c = steep ? rock.clone().lerp(grass, 0.25 + 0.2 * Math.sin(a * 5)) : grass
      col.push(c.r, c.g, c.b)
    }
  }
  const row = segs + 1
  for (let ri = 0; ri < radii.length - 1; ri++)
    for (let si = 0; si < segs; si++) {
      const a = ri * row + si
      const b = a + row
      idx.push(a, b, a + 1, a + 1, b, b + 1)
    }
  const tg = new THREE.BufferGeometry()
  tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  tg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  tg.setIndex(idx)
  tg.computeVertexNormals()
  const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true })
  const terrain = new THREE.Mesh(tg, terrainMat)
  terrain.receiveShadow = true
  terrain.matrixAutoUpdate = false
  T.scene.add(terrain)
  T.disposables.push(tg, terrainMat)

  // pines on the slopes and in the valley (silhouettes through the mist); none on the road
  const pineN = q === 'low' ? 70 : q === 'medium' ? 130 : 190
  const cone = new THREE.ConeGeometry(1.6, 5.5, 7)
  cone.translate(0, 4.4, 0)
  const trunk = new THREE.CylinderGeometry(0.18, 0.26, 1.8, 5)
  trunk.translate(0, 0.9, 0)
  const pineMat = P.foliageDark
  const items: THREE.Matrix4[] = []
  for (let i = 0; i < pineN * 3 && items.length < pineN; i++) {
    const a = R() * Math.PI * 2
    const r = 40 + Math.pow(R(), 0.8) * 90
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    if (Math.abs(x) < 14 && z > 30) continue // keep the road and the city view clear
    if (z < -30 && Math.abs(x) < 34) continue // behind the castle
    const s = 0.8 + R() * 1.1
    items.push(new THREE.Matrix4().compose(new THREE.Vector3(x, outerHeight(r) - 0.2, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6), new THREE.Vector3(s, s * (0.9 + R() * 0.5), s)))
  }
  for (const [geo, mat] of [[cone, pineMat], [trunk, P.bark]] as const) {
    const im = new THREE.InstancedMesh(geo, mat, items.length)
    items.forEach((m, i) => im.setMatrixAt(i, m))
    im.castShadow = false
    im.computeBoundingSphere()
    T.scene.add(im)
    T.disposables.push(geo)
  }

  return { terrain }
}

/** The road down the valley: a dirt ribbon following the same curve as the lamp line in skyline.ts. */
export function valleyRoad(T: Town, curve: THREE.Curve<THREE.Vector3>) {
  const N = 90
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  let len = 0
  let prev = curve.getPoint(0)
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const p = curve.getPoint(t)
    len += p.distanceTo(prev)
    prev = p
    const tn = curve.getTangent(t)
    const side = new THREE.Vector3(-tn.z, 0, tn.x).normalize().multiplyScalar(2.6)
    pos.push(p.x + side.x, p.y + 0.06, p.z + side.z, p.x - side.x, p.y + 0.06, p.z - side.z)
    uv.push(0, len / 3, 5.2 / 3, len / 3)
    if (i < N) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  const m = new THREE.Mesh(g, T.P.cobble)
  m.receiveShadow = true
  T.scene.add(m)
  T.disposables.push(g)
}

/** Distant mountain silhouettes framing the valley (fog-free, slightly darker than the night sky). */
export function mountains(scene: THREE.Scene, D: (THREE.Material | THREE.Texture | THREE.BufferGeometry)[]) {
  const mat = new THREE.MeshBasicMaterial({ color: '#0a0710', fog: false })
  const far = new THREE.MeshBasicMaterial({ color: '#130d1c', fog: false })
  D.push(mat, far)
  const R = rng(99)
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + R() * 0.1
    const deg = ((a / DEG) + 360) % 360
    if (deg > 55 && deg < 125) continue // the valley opening toward Chad City
    const r = 600 + R() * 120
    const h = 110 + R() * 140
    const g = new THREE.ConeGeometry(110 + R() * 80, h, 6)
    const m = new THREE.Mesh(g, i % 2 ? mat : far)
    m.position.set(Math.cos(a) * r, -44 + h / 2, Math.sin(a) * r)
    m.rotation.y = R() * 3
    scene.add(m)
    D.push(g)
  }
}
