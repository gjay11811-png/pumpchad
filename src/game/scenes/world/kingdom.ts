import * as THREE from 'three'
import type { Quality } from '../../save'
import { bannerTexture } from '../textures'
import type { Town } from './buildings'
import { Cloth } from './fx'
import { boxUV, rng } from './kit'
import type { KingdomStyle, styleMaterials } from './style'
import { insideCity, terrainHeight, terrainLines } from './city'
import { CASTLE_AT, SUMMIT } from './mountain'

type SM = ReturnType<typeof styleMaterials>

/**
 * CHAD CITY perimeter + terrain.
 *  - the old town's curtain wall survives along the north (it now frames CHAD CITADEL), ending in two towers
 *  - south, east and west the city has grown past the old walls into new districts (see city.ts)
 *  - one terrain mesh: the plateau (city ground), the canal cut, a lip, a steep cliff, and the valley beyond
 */
export const WALL_R = 35.9
const DEG = Math.PI / 180
/** lookout benches on the canal promenade (sit and watch the gateway + the valley skyline) */
export const BENCHES: { x: number; z: number; ry: number }[] = [
  { x: -9.6, z: 32.1, ry: 0 },
  { x: 9.8, z: 32.0, ry: 0 },
]

export function kingdom(T: Town, style: KingdomStyle, M: SM, q: Quality) {
  const P = T.P
  const R = rng(4242)
  const norm = (a: number) => (a + Math.PI * 2) % (Math.PI * 2)

  /* ── the north curtain wall (190° → 350°, the castle closes the middle) ── */
  const SEG = 48
  const H = 3.8
  for (let i = 0; i < SEG; i++) {
    const a = norm((i / SEG) * Math.PI * 2)
    const deg = a / DEG
    if (deg < 193 || deg > 347) continue
    const x = Math.cos(a) * WALL_R
    const z = Math.sin(a) * WALL_R
    if (z < -27) continue // the castle closes the north
    const ry = -a + Math.PI / 2
    const len = (2 * Math.PI * WALL_R) / SEG + 0.12
    T.batch.put(boxUV(len, H, 1.2, 1.8), M.stone, x, H / 2, z, ry)
    const ix = Math.cos(a) * (WALL_R - 0.75)
    const iz = Math.sin(a) * (WALL_R - 0.75)
    T.batch.put(boxUV(len, 0.22, 0.5, 1.5), M.trim, ix, H - 0.4, iz, ry)
    for (let k = 0; k < 4; k++) {
      const off = (k - 1.5) * (len / 4)
      T.batch.put(boxUV(len / 4 - 0.55, 0.8, 1.25, 1), M.stone, x + Math.cos(ry) * off, H + 0.4, z - Math.sin(ry) * off, ry)
    }
    if (i % 2 === 0) T.batch.put(boxUV(0.7, H * 0.7, 0.8, 1), M.trim, Math.cos(a) * (WALL_R - 0.85), H * 0.35, Math.sin(a) * (WALL_R - 0.85), ry)
    T.colliders.push({ kind: 'circle', x, z, r: 0.7, h: H })
  }

  /* ── towers: two along the wall, two closing its ends ── */
  const banner = bannerTexture()
  const bannerMat = new THREE.MeshStandardMaterial({ map: banner, roughness: 0.8, side: THREE.DoubleSide, alphaTest: 0.5, color: style.id === 'balanced' ? '#ffffff' : style.banner[0] })
  T.disposables.push(banner, bannerMat)
  for (const deg of [192, 210, 330, 348]) {
    const a = deg * DEG
    const tr = WALL_R + 0.3
    const x = Math.cos(a) * tr
    const z = Math.sin(a) * tr
    const r = 2.1
    const h = 8.6
    T.batch.put(new THREE.CylinderGeometry(r, r * 1.08, h, 18), M.stone, x, h / 2, z)
    T.batch.put(new THREE.CylinderGeometry(r * 1.18, r * 1.0, 0.5, 18), M.trim, x, h + 0.05, z)
    for (let k = 0; k < 8; k++) {
      const ma = (k / 8) * Math.PI * 2
      T.batch.put(boxUV(0.7, 0.75, 0.45, 1), M.stone, x + Math.cos(ma) * r * 1.08, h + 0.65, z + Math.sin(ma) * r * 1.08, -ma + Math.PI / 2)
    }
    const roofH = r * 2.4 * style.spire
    T.batch.put(new THREE.ConeGeometry(r * 1.3, roofH, 18), M.roof, x, h + 0.35 + roofH / 2, z)
    if (style.finials) T.batch.put(new THREE.SphereGeometry(0.22, 10, 8), M.finial, x, h + 0.45 + roofH, z)
    const toward = Math.atan2(-x, -z)
    for (const y of [3.4, 6.4]) {
      const wx = x + Math.sin(toward) * (r + 0.03)
      const wz = z + Math.cos(toward) * (r + 0.03)
      T.batch.put(new THREE.PlaneGeometry(0.26, 0.9), P.windowLit, wx, y, wz, toward, 1, 1, 1, { cast: false })
    }
    T.colliders.push({ kind: 'circle', x, z, r: r + 0.35, h })
    const c = new Cloth(1.2, 2.6, bannerMat, 0.12)
    c.mesh.position.set(x + Math.sin(toward) * (r + 0.12), h - 1.8, z + Math.cos(toward) * (r + 0.12))
    c.mesh.rotation.y = toward
    T.scene.add(c.mesh)
    T.cloths.push(c)
  }

  /* ── lookout benches on the canal promenade ── */
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

  /* ── terrain: one mesh over a non-uniform grid (fine over the city, coarse to the horizon) ── */
  const xs = terrainLines('x')
  const zs = terrainLines('z')
  const pos: number[] = []
  const uv: number[] = []
  const col: number[] = []
  const idx: number[] = []
  const lawn = new THREE.Color('#ffffff')
  const rock = new THREE.Color('#9a8a7a')
  const valley = new THREE.Color('#c4d6a0')
  const frost = new THREE.Color('#e8ecf4')
  for (const z of zs)
    for (const x of xs) {
      const y = terrainHeight(x, z)
      const wob = y < -1 && y > -40 ? (Math.sin(x * 0.7 + z * 0.3) + Math.sin(z * 0.9 - x * 0.4)) * 0.5 : 0
      pos.push(x, y + wob, z)
      uv.push(x / 6, z / 6)
      // the valley floor: meadow; the castle mountain: meadow low down, bare stone higher up, a hint of frost at the top;
      // the plateau's rock face: stone
      const rel = y - CASTLE_AT.y
      const onMountain = z > 200 && x < 40 && rel > 1.5
      const mt = onMountain ? Math.min(1, rel / SUMMIT.y) : 0
      const c =
        mt > 0.02
          ? lawn.clone().lerp(rock, Math.min(0.9, mt * 1.5 + 0.12 * Math.sin(x * 0.5 + z * 0.3))).lerp(frost, Math.max(0, mt - 0.85) * 3)
          : y > -0.3
            ? lawn
            : y > CASTLE_AT.y + 1.2
              ? rock.clone().lerp(lawn, 0.25 + 0.15 * Math.sin(x * 0.3))
              : valley
      col.push(c.r, c.g, c.b)
    }
  const row = xs.length
  for (let zi = 0; zi < zs.length - 1; zi++)
    for (let xi = 0; xi < xs.length - 1; xi++) {
      const a = zi * row + xi
      const b = a + row
      idx.push(a, b, a + 1, a + 1, b, b + 1)
    }
  const tg = new THREE.BufferGeometry()
  tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  tg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  tg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  tg.setIndex(idx)
  tg.computeVertexNormals()
  const terrainMat = new THREE.MeshStandardMaterial({ map: P.ground.map, vertexColors: true, roughness: 0.95 })
  const terrain = new THREE.Mesh(tg, terrainMat)
  terrain.receiveShadow = true
  terrain.matrixAutoUpdate = false
  T.scene.add(terrain)
  T.disposables.push(tg, terrainMat)

  /* ── pines on the slopes and in the valley; never on the city or the valley road ── */
  const pineN = q === 'low' ? 80 : q === 'medium' ? 150 : 220
  const cone = new THREE.ConeGeometry(1.6, 5.5, 7)
  cone.translate(0, 4.4, 0)
  const trunk = new THREE.CylinderGeometry(0.18, 0.26, 1.8, 5)
  trunk.translate(0, 0.9, 0)
  const items: THREE.Matrix4[] = []
  for (let i = 0; i < pineN * 4 && items.length < pineN; i++) {
    const x = (R() - 0.5) * 300
    const z = -60 + R() * 250
    if (insideCity(x, z, -6)) continue
    if (Math.abs(x) < 16 && z > 66) continue // the road down + the city view
    const y = terrainHeight(x, z)
    if (y > -1.5) continue
    const s = 0.8 + R() * 1.1
    items.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y - 0.2, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6), new THREE.Vector3(s, s * (0.9 + R() * 0.5), s)))
  }
  for (const [geo, mat] of [[cone, P.foliageDark], [trunk, P.bark]] as const) {
    const im = new THREE.InstancedMesh(geo, mat, items.length)
    items.forEach((m, i) => im.setMatrixAt(i, m))
    im.castShadow = false
    im.computeBoundingSphere()
    T.scene.add(im)
    T.disposables.push(geo)
  }
  return { terrain }
}

/** The road down the valley: a paved ribbon following the curve the skyline's traffic uses. */
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

/** Distant mountain ranges: two hazy blue layers (unlit, fog-free) framing the valley. */
export function mountains(scene: THREE.Scene, D: (THREE.Material | THREE.Texture | THREE.BufferGeometry)[], night = false) {
  // Three layered mountain walls round the valley — irregular ridgelines with ledges, shoulders and ravines (no cones, no
  // white triangle caps): a dark near ring, a bluer middle ring and a hazy far ring, so they separate by atmosphere.
  // One vertex-coloured, fog-free mesh per layer (a few thousand vertices each).
  const R = rng(99)
  const layers = night
    ? [
        { r: 620, h: 120, tint: ['#1c1a30', '#2c2a4a', '#4a4570'], seg: 220 },
        { r: 800, h: 190, tint: ['#262442', '#38355e', '#5a5688'], seg: 200 },
        { r: 940, h: 260, tint: ['#32305a', '#48447a', '#6e6a9c'], seg: 160 },
      ]
    : [
        { r: 620, h: 120, tint: ['#6c7f8c', '#86a0b0', '#a8bfce'], seg: 220 },
        { r: 800, h: 190, tint: ['#8da2b4', '#a6bacb', '#c4d3df'], seg: 200 },
        { r: 940, h: 260, tint: ['#a9bbcb', '#c0cfdc', '#dde7ef'], seg: 160 },
      ]
  const centre = { x: -20, z: 240 }
  const FLOOR = -62
  layers.forEach((L, li) => {
    const phase = R() * 100
    const peaks = Array.from({ length: 9 + li * 3 }, () => ({ a: R() * Math.PI * 2, w: 0.1 + R() * 0.16, k: 0.45 + R() * 0.55 }))
    const ridge = (a: number) => {
      let v = 0.42 + 0.14 * Math.sin(a * 3 + phase) + 0.1 * Math.sin(a * 7.3 + phase * 1.7) + 0.06 * Math.sin(a * 17 + phase * 0.6)
      for (const p of peaks) {
        const d = Math.atan2(Math.sin(a - p.a), Math.cos(a - p.a))
        v += p.k * Math.exp(-(d * d) / (2 * p.w * p.w)) * 0.5
      }
      return Math.min(1, v)
    }
    const K = 14
    const pos: number[] = []
    const col: number[] = []
    const idx: number[] = []
    const c0 = new THREE.Color(L.tint[0])
    const c1 = new THREE.Color(L.tint[1])
    const c2 = new THREE.Color(L.tint[2])
    const tmp = new THREE.Color()
    for (let j = 0; j <= L.seg; j++) {
      const a = (j / L.seg) * Math.PI * 2
      const H = ridge(a) * L.h
      for (let k = 0; k <= K; k++) {
        const u = k / K // 0 at the foot (toward the valley) → 1 at the back
        // a rising face with ledges: smooth rise to the crest at u ≈ 0.55, then a long back slope
        const rise = u < 0.55 ? Math.pow(u / 0.55, 1.35) : 1 - 0.55 * ((u - 0.55) / 0.45)
        const ledges = 0.16 * Math.floor(rise * 6) / 6 + 0.84 * rise
        const noise = 1 + 0.12 * Math.sin(a * 41 + u * 9 + phase) + 0.08 * Math.sin(a * 83 - u * 17)
        const rr = L.r + u * 220 + 14 * Math.sin(a * 9 + u * 5 + phase)
        const y = FLOOR + H * ledges * noise
        pos.push(centre.x + Math.cos(a) * rr, y, centre.z + Math.sin(a) * rr)
        const hf = Math.min(1, Math.max(0, (y - FLOOR) / (L.h * 0.9)))
        tmp.copy(c0).lerp(c1, Math.min(1, hf * 1.6)).lerp(c2, Math.max(0, hf - 0.55) * 1.6)
        const v = 0.9 + 0.1 * Math.sin(a * 53 + k * 3) // strata-like banding
        col.push(tmp.r * v, tmp.g * v, tmp.b * v)
      }
    }
    const row = K + 1
    for (let j = 0; j < L.seg; j++)
      for (let k = 0; k < K; k++) {
        const a = j * row + k
        const b = a + row
        idx.push(a, a + 1, b, a + 1, b + 1, b)
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    // bake a soft key light into the vertex colours (the material is unlit so the far ranges stay cheap and fog-free)
    {
      const nrm = g.attributes.normal as THREE.BufferAttribute
      const cl = g.attributes.color as THREE.BufferAttribute
      const Lr = new THREE.Vector3(0.45, 0.55, -0.7).normalize()
      for (let i = 0; i < nrm.count; i++) {
        const nv = new THREE.Vector3(nrm.getX(i), Math.abs(nrm.getY(i)), nrm.getZ(i))
        const k = 0.62 + 0.55 * Math.max(0, nv.dot(Lr))
        cl.setXYZ(i, cl.getX(i) * k, cl.getY(i) * k, cl.getZ(i) * k)
      }
    }
    const m = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide })
    D.push(g, m)
    const mesh = new THREE.Mesh(g, m)
    mesh.frustumCulled = false
    scene.add(mesh)
  })
}
