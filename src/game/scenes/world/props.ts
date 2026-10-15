import * as THREE from 'three'
import { FoliageBuilder, leafTexture, rockGeo } from './foliage'
import type { Quality } from '../../save'
import { signTexture, bannerTexture } from '../textures'
import type { Town } from './buildings'
import { Cloth, Fire } from './fx'
import { boxUV, instanced, rng } from './kit'
import { grassTuft } from './textures'
import { insideCity } from './city'
import type { KingdomStyle, styleMaterials } from './style'

type StyleMats = ReturnType<typeof styleMaterials>

/**
 * The four plaza benches round the fountain (diagonals, so the road mouths stay clear).
 * `ry` = the direction a seated person faces (toward the fountain). The bench geometry, b4s's seat and the
 * player's sit interaction all read these, so the seat anchor always matches the bench.
 */
export const PLAZA_BENCHES = [0, 1, 2, 3].map((i) => {
  const a = (i / 4) * Math.PI * 2 + Math.PI / 4
  return { x: Math.cos(a) * 8.6, z: Math.sin(a) * 8.6, ry: Math.atan2(-Math.cos(a), -Math.sin(a)), a }
})
/** the north-west bench belongs to b4s (he sits there) */
export const B4S_BENCH = 1
/** how far in front of a bench's centre the sitter's root goes so the seated clip lands on the seat */
export const SEAT_FWD = 0.12

/* ───────── ground: base terrain, plaza disc, roads + curbs ───────── */
export type Road = { x0: number; z0: number; x1: number; z1: number; w: number }
export const ROADS: Road[] = [
  { x0: 0, z0: 11, x1: 0, z1: 37.6, w: 5 }, // south avenue (old arch → canal bridge)
  { x0: 0, z0: -11, x1: 0, z1: -24.4, w: 5 }, // north road (plaza → castle steps)
  { x0: 10.5, z0: -4, x1: 15.4, z1: -4, w: 4.2 }, // east spur (plaza → gym door)
  { x0: -10.5, z0: 2.5, x1: -31, z1: 2.5, w: 5 }, // west road (Market Row)
  { x0: -2.5, z0: 19, x1: -5, z1: 19, w: 3 }, // tavern patio path
  { x0: 2.5, z0: 19, x1: 8, z1: 19, w: 3 }, // arcade path
  { x0: -11, z0: -9.8, x1: -16, z1: -9.8, w: 3 }, // forge path (from the plaza's north-west)
  { x0: 12, z0: -12.6, x1: 14.6, z1: -19.5, w: 2.4 }, // overgrown track to the Hollow House yard gate (it used to dead-end in the fence)
  { x0: 14.6, z0: -19.5, x1: 17.7, z1: -19.5, w: 1.6 }, // through the yard to the front door
]

export function buildGround(T: Town, _tex: Record<string, THREE.Texture>) {
  const P = T.P
  // (the lawn is the terrain mesh itself — see kingdom.ts)

  const plaza = new THREE.Mesh(new THREE.CircleGeometry(11.5, 72), P.plaza)
  plaza.rotation.x = -Math.PI / 2
  plaza.position.y = 0.02
  plaza.receiveShadow = true
  T.scene.add(plaza)
  // gold inlay ring at the plaza edge
  const inlay = new THREE.Mesh(new THREE.RingGeometry(11.4, 11.62, 96), P.gold)
  inlay.rotation.x = -Math.PI / 2
  inlay.position.y = 0.03
  T.scene.add(inlay)
  T.disposables.push(plaza.geometry, inlay.geometry)

  // roads: world-UV cobble strips
  const curbs: { x: number; y: number; z: number; ry: number }[] = []
  for (const r of ROADS) {
    const len = Math.hypot(r.x1 - r.x0, r.z1 - r.z0)
    const ang = Math.atan2(r.x1 - r.x0, r.z1 - r.z0)
    const g = new THREE.PlaneGeometry(r.w, len)
    const uv = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * r.w) / 3, (uv.getY(i) * len) / 3)
    g.rotateX(-Math.PI / 2)
    T.batch.put(g, P.cobble, (r.x0 + r.x1) / 2, 0.025, (r.z0 + r.z1) / 2, ang, 1, 1, 1, { cast: false })
    if (r.w >= 4) {
      const n = Math.floor(len / 0.9)
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n
        for (const side of [-1, 1]) {
          const ox = Math.cos(ang) * (r.w / 2 + 0.1) * side
          const oz = -Math.sin(ang) * (r.w / 2 + 0.1) * side
          curbs.push({ x: r.x0 + (r.x1 - r.x0) * t + ox, y: 0.07, z: r.z0 + (r.z1 - r.z0) * t + oz, ry: ang })
        }
      }
    }
  }
  // drop curbs that fall inside the plaza
  const c = curbs.filter((k) => Math.hypot(k.x, k.z) > 11.8)
  T.scene.add(instanced(new THREE.BoxGeometry(0.28, 0.14, 0.82), P.stoneLight, c, false))
}

/* ───────── lamp posts (emissive lanterns; a few get real lights via LightSpot priority) ───────── */
export function lampPosts(T: Town, spots: [number, number][]) {
  const P = T.P
  const post = new THREE.CylinderGeometry(0.07, 0.11, 3.3, 8)
  const arm = new THREE.BoxGeometry(0.6, 0.06, 0.06)
  // open-frame lantern: corner bars, base plate, pyramid cap + finial round a glowing glass core
  // (the old solid iron box hid the glow and read as a dark cube from above)
  const bar = new THREE.BoxGeometry(0.035, 0.4, 0.035)
  const plate = new THREE.BoxGeometry(0.36, 0.04, 0.36)
  const cap = new THREE.ConeGeometry(0.29, 0.2, 4).rotateY(Math.PI / 4)
  const finial = new THREE.SphereGeometry(0.045, 6, 4)
  const hook = new THREE.CylinderGeometry(0.015, 0.015, 0.14, 4)
  const glow = new THREE.BoxGeometry(0.27, 0.36, 0.27)
  const scroll = new THREE.TorusGeometry(0.16, 0.018, 4, 10, Math.PI)
  for (const [x, z] of spots) {
    T.batch.put(post, P.iron, x, 1.65, z)
    T.batch.put(new THREE.CylinderGeometry(0.2, 0.25, 0.25, 8), P.stone, x, 0.12, z)
    T.batch.put(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 8), P.iron, x, 3.3, z) // post cap
    T.batch.put(arm, P.iron, x + 0.28, 3.15, z)
    T.batch.put(scroll.clone().rotateZ(Math.PI), P.iron, x + 0.2, 3.0, z, 0, 1, 1, 1, { cast: false }) // curled bracket under the arm
    const lx = x + 0.55
    T.batch.put(hook, P.iron, lx, 3.12, z, 0, 1, 1, 1, { cast: false })
    T.batch.put(cap, P.iron, lx, 3.0, z, 0, 1, 1, 1, { cast: false })
    T.batch.put(finial, P.iron, lx, 3.1, z, 0, 1, 1, 1, { cast: false })
    T.batch.put(plate, P.iron, lx, 2.88, z, 0, 1, 1, 1, { cast: false })
    T.batch.put(plate, P.iron, lx, 2.62, z, 0, 1, 1, 1, { cast: false })
    for (const [cx, cz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) T.batch.put(bar, P.iron, lx + cx * 0.16, 2.75, z + cz * 0.16, 0, 1, 1, 1, { cast: false })
    T.batch.put(glow, P.glowOrange, lx, 2.75, z, 0, 1, 1, 1, { cast: false })
    T.colliders.push({ kind: 'circle', x, z, r: 0.25, h: 3.3 })
  }
}

/* ───────── string lights strung between poles (catenary) ───────── */
export function stringLights(T: Town, runs: [number, number, number, number][], h = 4.2) {
  const P = T.P
  const bulbs: { x: number; y: number; z: number }[] = []
  for (const [x0, z0, x1, z1] of runs) {
    const pts: THREE.Vector3[] = []
    const n = 18
    for (let i = 0; i <= n; i++) {
      const t = i / n
      pts.push(new THREE.Vector3(x0 + (x1 - x0) * t, h - Math.sin(t * Math.PI) * 0.9, z0 + (z1 - z0) * t))
    }
    T.batch.put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.015, 3, false), P.iron, 0, 0, 0, 0, 1, 1, 1, { cast: false })
    for (let i = 1; i < n; i += 2) bulbs.push({ x: pts[i].x, y: pts[i].y - 0.08, z: pts[i].z })
  }
  const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc861').multiplyScalar(3), toneMapped: false })
  T.disposables.push(bulbMat)
  T.scene.add(instanced(new THREE.SphereGeometry(0.06, 6, 4), bulbMat, bulbs, false))
}

export function poles(T: Town, spots: [number, number][], h = 4.4) {
  for (const [x, z] of spots) {
    T.batch.put(new THREE.CylinderGeometry(0.08, 0.1, h, 6), T.P.timber, x, h / 2, z)
    T.colliders.push({ kind: 'circle', x, z, r: 0.2, h })
  }
}

/* ───────── vegetation ───────── */
export function vegetation(T: Town, q: Quality, avoid: (x: number, z: number) => boolean, extra: { trees: [number, number][]; bushes: [number, number][]; hedges: [number, number, number, 'x' | 'z'][]; potted?: [number, number, number, number][] } = { trees: [], bushes: [], hedges: [] }) {
  const P = T.P
  const r = rng(77)
  const F = new FoliageBuilder(77, q === 'high' ? 1 : q === 'medium' ? 0.7 : 0.45)
  const C = (h: string) => new THREE.Color(h)
  const autumnCols = [C('#c4561a'), C('#d98a1f'), C('#a8321e'), C('#c96b22'), C('#5c7a2e')]
  const barkCol = C('#3a2a20')
  // autumn trees: trunk + branches + clustered canopies of real leaf cards
  const autumn: [number, number][] = [[-15, 28], [15, 29], [-30, 8], [-6, -27], [7, -27.5], [-29, -15], [-20, 29], [-31, -4]]
  const dead: [number, number][] = [[26, -14], [15, -24], [27, -25], [-27, -24]]
  const gold = [C('#d9a42a'), C('#c8781c'), C('#e0b432'), C('#b8561c')]
  const pine = C('#2f5a3a')
  autumn.forEach(([x, z], i) => {
    // a mix of species so no two neighbours share a silhouette: broad autumn trees, gold poplars, dark conifers
    if (i % 4 === 1) F.poplar(x, z, 0.95 + r() * 0.25, gold, barkCol)
    else if (i % 4 === 3) F.conifer(x, z, 0.9 + r() * 0.25, pine, barkCol)
    else F.tree(x, z, 0.95 + r() * 0.3, autumnCols, barkCol)
    T.colliders.push({ kind: 'circle', x, z, r: 0.45, h: 5 })
  })
  // the new districts: summer-green street + garden trees, a few turning gold
  const summerCols = [C('#4f8a3a'), C('#5f9a40'), C('#3f7a34'), C('#7aa848'), C('#d9a42a')]
  extra.trees.forEach(([x, z], i) => {
    if (i % 5 === 2) F.conifer(x, z, 0.85 + r() * 0.3, pine, barkCol)
    else if (i % 5 === 4) F.poplar(x, z, 0.9 + r() * 0.25, [C('#7aa848'), C('#d9a42a'), C('#5f9a40')], barkCol)
    else F.tree(x, z, 0.9 + r() * 0.35, i % 5 === 1 ? autumnCols : summerCols, barkCol)
    T.colliders.push({ kind: 'circle', x, z, r: 0.45, h: 5 })
  })
  for (const [x, z] of dead) {
    F.plant('dead', x, z, 0.95 + r() * 0.3, [barkCol], C('#4a3c30')) // a gnarled snag with real limbs
    T.colliders.push({ kind: 'circle', x, z, r: 0.45, h: 4 })
  }
  // garden bushes: lumpy cores + leaf shells, a few greens (and the odd autumn one)
  const greens = [C('#3d5a33'), C('#4a6b38'), C('#34502f'), C('#6b6a2a')]
  const bushSpots: [number, number][] = [[-7, -10], [7, -10], [-7, 10.5], [7, 10.5], [-12.5, 6.5], [-12.5, -1.5], [12, 1.5], [12, -9.5], [-6.6, 27.6], [6.6, 27.6], [-24, 13], [-21, 19.5], [-18, -18], [-24, -6], [18, -12], [-29, 12], ...extra.bushes]
  for (const [x, z] of bushSpots)
    for (let k = 0; k < 3; k++) F.bush(x + (r() - 0.5) * 1.6, 0, z + (r() - 0.5) * 1.6, 0.75 + r() * 0.45, greens[Math.floor(r() * greens.length)])
  // planter shrubs (raised: they sit on the soil line of a stone planter)
  for (const [x, y, z, s] of extra.potted ?? []) F.bush(x, y, z, s, C('#3f5e34'))
  // clipped hedges along the north road and the plaza mouth (same footprint + colliders as before)
  const hedgeGreen = C('#2f4a2b')
  for (const side of [-1, 1]) {
    // (the north-road hedges made way for the citadel forecourt)
    F.hedge(side * 3.4, 16, 5, 0.75, 0.85, 'z', hedgeGreen)
    T.colliders.push({ kind: 'box', minX: side * 3.4 - 0.35, maxX: side * 3.4 + 0.35, minZ: 13.5, maxZ: 18.5, h: 0.8 })
  }
  for (const [x, z, len, axis] of extra.hedges) F.hedge(x, z, len, 0.7, 0.8, axis, hedgeGreen)
  F.build(T.scene, leafTexture(T.disposables), T.disposables, q === 'high') // foliage shadows: high tier only
  // rocks: a scatter along the inside of the walls and by the paths
  const rocks: { x: number; y: number; z: number; ry: number; s: number }[] = []
  for (let i = 0; i < (q === 'low' ? 30 : 70); i++) {
    const x = (r() - 0.5) * 116
    const z = -32 + r() * 106
    if (!insideCity(x, z, 0.5) || avoid(x, z)) continue
    rocks.push({ x, y: 0.02, z, ry: r() * 6, s: 0.12 + r() * 0.28 })
  }
  for (const [i, g] of [rockGeo(3), rockGeo(8)].entries()) {
    T.disposables.push(g)
    T.scene.add(instanced(g, P.rock, rocks.filter((_, k) => k % 2 === i)))
  }
  // grass tufts: crossed alpha cards, density by quality, colour-varied per clump
  const tuftMat = new THREE.MeshStandardMaterial({ map: grassTuft(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1, color: '#9ab07e' })
  T.disposables.push(tuftMat)
  const tuftGeo = new THREE.PlaneGeometry(0.7, 0.55)
  tuftGeo.translate(0, 0.27, 0)
  const cross = tuftGeo.clone().rotateY(Math.PI / 2)
  const { mergeGeometries } = { mergeGeometries: (a: THREE.BufferGeometry[]) => mergeGeos(a) }
  const tuft = mergeGeometries([tuftGeo, cross])
  const N = q === 'high' ? 1100 : q === 'medium' ? 650 : 240
  const tufts: { x: number; y: number; z: number; ry: number; s: number }[] = []
  for (let i = 0; i < N * 4 && tufts.length < N; i++) {
    const x = (r() - 0.5) * 116
    const z = -32 + r() * 106
    if (!insideCity(x, z, 0.4) || avoid(x, z)) continue
    tufts.push({ x, y: 0, z, ry: r() * 6, s: 0.7 + r() * 0.7 })
  }
  const tuftMesh = instanced(tuft, tuftMat, tufts, false)
  const tc = new THREE.Color()
  tufts.forEach((_, i) => tuftMesh.setColorAt(i, tc.setHSL(0.22 + r() * 0.08, 0.32 + r() * 0.2, 0.32 + r() * 0.2)))
  T.scene.add(tuftMesh)
  // (the glowing mushroom rings were a night-time accent; by day the city keeps to flowers)
}

function mergeGeos(a: THREE.BufferGeometry[]) {
  // tiny local merge to avoid importing the utils twice in hot paths
  const pos: number[] = []
  const nor: number[] = []
  const uv: number[] = []
  for (const g0 of a) {
    const g = g0.index ? g0.toNonIndexed() : g0
    pos.push(...(g.attributes.position.array as Float32Array))
    nor.push(...(g.attributes.normal.array as Float32Array))
    uv.push(...(g.attributes.uv.array as Float32Array))
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  return out
}

/* ───────── clutter that tells stories: crates, barrels, sacks, carts, benches ───────── */
export function clutter(T: Town) {
  const P = T.P
  const crates: { x: number; y: number; z: number; ry: number; s: number }[] = []
  const barrels: { x: number; y: number; z: number; ry: number; s: number }[] = []
  const crateSpots: [number, number, number][] = [
    // alley behind the tavern (dead end with a seed)
    [-19.5, 22.5, 0], [-19.4, 23.3, 0.3], [-20.6, 23.6, 0.1], [-19.6, 22.9, 0.2],
    // market ends
    [-29.5, -1.2, 0.2], [-30.2, -0.5, 0.6], [-29.6, 6.6, 0.1],
    // forge yard
    [-12, -15, 0.3], [-12.6, -14.2, 0],
    // gym side
    [15, 2.6, 0.2], [15.4, 3.4, 0.5],
    // arcade back
    [17.5, 24, 0.1],
  ]
  for (const [x, z, ry] of crateSpots) crates.push({ x, y: 0.35, z, ry, s: 0.7 })
  crates.push({ x: -19.5, y: 1.05, z: 22.8, ry: 0.4, s: 0.7 })
  const barrelSpots: [number, number][] = [[-7.6, 13.2], [-28.5, 5.2], [-13.2, -16.3], [14.8, -0.8], [6.6, 23.5], [-23.6, 9.6], [24, -11.8]]
  for (const [x, z] of barrelSpots) barrels.push({ x, y: 0.47, z, ry: x, s: 1 })
  T.scene.add(instanced(boxUV(1, 1, 1, 1), P.woodLight, crates))
  T.scene.add(instanced(new THREE.CylinderGeometry(0.4, 0.4, 0.95, 12), P.woodLight, barrels))
  for (const c of crates) if (c.y < 0.5) T.colliders.push({ kind: 'circle', x: c.x, z: c.z, r: 0.45, h: 0.7 })
  for (const b of barrels) T.colliders.push({ kind: 'circle', x: b.x, z: b.z, r: 0.45, h: 1 })

  // benches facing the fountain
  const benchGeo = boxUV(1.8, 0.12, 0.5, 1)
  for (const { a, x, z } of PLAZA_BENCHES) {
    const ry = -a + Math.PI / 2
    T.batch.put(benchGeo, P.woodLight, x, 0.48, z, ry)
    T.batch.put(new THREE.BoxGeometry(1.8, 0.4, 0.08), P.woodLight, x + Math.cos(a) * 0.25, 0.8, z + Math.sin(a) * 0.25, ry)
    for (const s of [-0.75, 0.75]) T.batch.put(new THREE.BoxGeometry(0.08, 0.45, 0.45), P.iron, x - Math.sin(a) * s, 0.22, z + Math.cos(a) * s, ry)
    T.colliders.push({ kind: 'circle', x, z, r: 0.75, h: 0.9 })
  }

  // broken cart beside (not on) the Hollow House track
  const cx = 17.6
  const cz = -13.1
  T.batch.put(boxUV(2.2, 0.5, 1.2, 1), P.woodRotten, cx, 0.55, cz, 0.4)
  const wheel = new THREE.TorusGeometry(0.42, 0.06, 6, 14)
  T.batch.put(wheel, P.woodRotten, cx + 0.6, 0.42, cz + 0.75, 0.4)
  const fallen = new THREE.TorusGeometry(0.42, 0.06, 6, 14)
  fallen.rotateX(Math.PI / 2)
  T.batch.put(fallen, P.woodRotten, cx - 1.3, 0.06, cz - 0.9)
  T.colliders.push({ kind: 'circle', x: cx, z: cz, r: 1.2, h: 1 })

  // (the community noticeboard moved into Chad Square — see square.ts)

  // wishing well at the west end of Market Row
  const wx = -31
  const wz = 2.5
  T.batch.put(new THREE.CylinderGeometry(1.1, 1.2, 0.9, 14, 1, true), P.stone, wx, 0.45, wz)
  T.batch.put(new THREE.TorusGeometry(1.1, 0.12, 6, 18).rotateX(Math.PI / 2), P.stoneLight, wx, 0.92, wz)
  const water = new THREE.CircleGeometry(1.0, 16).rotateX(-Math.PI / 2)
  T.batch.put(water, P.windowDark, wx, 0.55, wz)
  for (const s of [-1, 1]) T.batch.put(new THREE.BoxGeometry(0.14, 2.2, 0.14), P.timber, wx + s, 1.5, wz)
  const wr = gableRoof(2.6, 1.6, 0.8)
  T.batch.put(wr, P.roofRed, wx, 2.55, wz, Math.PI / 2)
  T.colliders.push({ kind: 'circle', x: wx, z: wz, r: 1.35, h: 1 })
}

function gableRoof(w: number, d: number, h: number) {
  const s = new THREE.Shape()
  s.moveTo(-w / 2, 0)
  s.lineTo(w / 2, 0)
  s.lineTo(0, h)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false })
  g.translate(0, 0, -d / 2)
  return g
}

/* ───────── fences ───────── */
export function fence(T: Town, pts: [number, number][], broken = false) {
  const P = T.P
  const mat = broken ? P.woodRotten : P.woodLight
  const r = rng(pts.length * 13)
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i]
    const [x1, z1] = pts[i + 1]
    const len = Math.hypot(x1 - x0, z1 - z0)
    const ang = Math.atan2(x1 - x0, z1 - z0)
    const n = Math.max(1, Math.round(len / 1.2))
    for (let k = 0; k <= n; k++) {
      const t = k / n
      if (broken && r() < 0.2) continue
      const tilt = broken ? (r() - 0.5) * 0.4 : 0
      const g = new THREE.BoxGeometry(0.12, 1.05, 0.12)
      g.rotateZ(tilt)
      T.batch.put(g, mat, x0 + (x1 - x0) * t, 0.52, z0 + (z1 - z0) * t, ang)
    }
    for (const y of [0.4, 0.82]) {
      if (broken && r() < 0.35) continue
      T.batch.put(new THREE.BoxGeometry(0.05, 0.1, len), mat, (x0 + x1) / 2, y, (z0 + z1) / 2, ang)
    }
    // thin collider along the run
    const steps = Math.ceil(len / 0.8)
    for (let k = 0; k <= steps; k++) {
      const t = k / steps
      T.colliders.push({ kind: 'circle', x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, r: 0.3, h: 1 })
    }
  }
}

/* ───────── castle (north) with real steps, torches and waving banners ───────── */
export const CASTLE_Z = -31
export function castle(T: Town, style: KingdomStyle, SM: StyleMats) {
  const P = { ...T.P, stone: SM.stone, roofSlate: SM.roof }
  const Z = CASTLE_Z
  for (const [x, w] of [[-13, 18], [13, 18]] as const) {
    T.batch.put(boxUV(w, 8, 2.4, 2.5), P.stone, x, 4, Z)
    T.colliders.push({ kind: 'box', minX: x - w / 2, maxX: x + w / 2, minZ: Z - 1.4, maxZ: Z + 1.4, h: 8 })
    for (let i = -w / 2 + 0.6; i < w / 2; i += 1.6) T.batch.put(boxUV(0.9, 0.9, 2.4, 1), P.stone, x + i, 8.45, Z)
  }
  // (the gatehouse itself is built by citadel.ts: arched surround, recessed timber doors, nameplate)
  // approach steps (walkable: World's height map raises the player)
  for (let i = 0; i < 4; i++) T.batch.put(boxUV(9, 0.22, 1.05, 1.5), P.stoneLight, 0, 0.11 + i * 0.22, -24.95 - i * 1.05, 0, 1, 1 + i * 0, 1)
  for (let i = 0; i < 4; i++) T.batch.put(boxUV(9, 0.22 * (i + 1), 1.05, 1.5), P.stone, 0, (0.22 * (i + 1)) / 2, -24.95 - i * 1.05, 0, 1, 1, 1, { cast: false })
  T.batch.put(boxUV(9, 0.88, 1.6, 1.5), P.stone, 0, 0.44, -29.2)
  for (const s of [-1, 1]) {
    T.batch.put(boxUV(0.6, 1.4, 5.2, 1), P.stoneLight, s * 4.8, 0.7, -27)
    T.colliders.push({ kind: 'box', minX: s * 4.8 - 0.3, maxX: s * 4.8 + 0.3, minZ: -29.6, maxZ: -24.4, h: 1.4 })
    // gate torches
    T.batch.put(new THREE.CylinderGeometry(0.1, 0.14, 1.2, 6), P.iron, s * 3, 3.3, Z + 1.75)
    const f = new Fire(s * 3, 3.9, Z + 1.75, 0.75)
    T.fires.push(f)
    T.scene.add(f.group)
  }
  T.lights.push({ x: 0, y: 4, z: Z + 3.5, color: '#ff8a3a', intensity: 14, dist: 12, priority: 4 })
  for (const x of [-22, -4.8, 4.8, 22]) {
    const r = Math.abs(x) > 10 ? 2.6 : 1.6
    const h = Math.abs(x) > 10 ? 14 : 15
    T.batch.put(new THREE.CylinderGeometry(r, r * 1.08, h, 16), P.stone, x, h / 2, Z)
    T.batch.put(new THREE.ConeGeometry(r * 1.25, r * 2.4, 16), P.roofSlate, x, h + r * 1.2, Z)
    T.batch.put(new THREE.PlaneGeometry(0.5, 1), P.windowLit, x, h * 0.7, Z + r + 0.02, 0, 1, 1, 1, { cast: false })
    T.colliders.push({ kind: 'circle', x, z: Z, r: r + 0.3, h })
  }
  // heraldic banners hung from iron poles under the battlements (they used to poke above the wall top),
  // spaced clear of the forecourt houses' eaves, plus carved jack-o'-lantern sconces on iron brackets
  const bTex = bannerTexture()
  const bMat = new THREE.MeshStandardMaterial({ map: bTex, roughness: 0.78, side: THREE.DoubleSide, alphaTest: 0.5 })
  T.disposables.push(bTex, bMat)
  for (const x of [-14.5, -19.5, 14.5, 19.5]) {
    T.batch.put(new THREE.CylinderGeometry(0.035, 0.035, 1.9, 8).rotateZ(Math.PI / 2), P.iron, x, 7.55, Z + 1.45)
    for (const s of [-1, 1]) {
      T.batch.put(new THREE.BoxGeometry(0.06, 0.06, 0.32), P.iron, x + s * 0.9, 7.55, Z + 1.32)
      T.batch.put(new THREE.SphereGeometry(0.06, 10, 8), P.gold, x + s * 0.98, 7.55, Z + 1.45)
    }
    const c = new Cloth(1.6, 3.2, bMat, 0.12)
    c.mesh.position.set(x, 7.45, Z + 1.47) // cloth hangs from its top edge, just under the pole
    T.scene.add(c.mesh)
    T.cloths.push(c)
  }
  for (const x of [-8, -11.6, -17, 8, 11.6, 17]) {
    const y = 4.3
    const fz = Z + 1.2
    T.batch.put(boxUV(0.34, 0.5, 0.08, 1), P.iron, x, y + 0.1, fz + 0.04) // wall plate
    T.batch.put(new THREE.BoxGeometry(0.05, 0.05, 0.5), P.iron, x, y + 0.22, fz + 0.3) // arm
    T.batch.put(new THREE.TorusGeometry(0.27, 0.03, 6, 20).rotateX(Math.PI / 2), P.iron, x, y - 0.2, fz + 0.5) // cradle ring
    T.batch.put(new THREE.CylinderGeometry(0.02, 0.02, 0.32, 6), P.iron, x, y + 0.07, fz + 0.5)
    if (T.pumpkins) T.pumpkins.add(x, y - 0.12, fz + 0.5, { r: 0.3, face: Math.abs(x) % 4 > 2 ? 1 : 3, facing: 0, v: Math.abs(x) > 12 ? 2 : 0 })
    T.lights.push({ x, y: y + 0.3, z: fz + 1.2, color: '#ff8a30', intensity: 4, dist: 5, priority: 5 })
  }
  keep(T, style, SM)
  // flags on the gatehouse
  for (const s of [-1, 1]) {
    T.batch.put(new THREE.CylinderGeometry(0.05, 0.05, 3, 6), P.iron, s * 2.8, 12.5, Z - 0.4)
    const flag = new Cloth(1.6, 1, bMat, 0.25)
    flag.mesh.rotation.z = -Math.PI / 2
    flag.mesh.position.set(s * 2.8, 13.8, Z - 0.4)
    T.scene.add(flag.mesh)
    T.cloths.push(flag)
  }
}

/**
 * The KEEP: the kingdom's landmark, standing behind the gatehouse and visible from all over town —
 * a great tower with the tallest spire, four corner turrets, rows of lit windows (fog-free so they
 * read through the mist) and banners. All dimensions/colours follow the active kingdom style.
 */
function keep(T: Town, style: KingdomStyle, SM0: StyleMats) {
  const SM = { ...SM0, stone: SM0.farStone, trim: SM0.farStone, roof: SM0.farRoof }
  const Z = CASTLE_Z - 10
  const W = 16
  const D = 11
  const H = 17
  T.batch.put(boxUV(W, H, D, 2.5), SM.stone, 0, H / 2, Z)
  T.batch.put(boxUV(W + 0.8, 0.5, D + 0.8, 1.5), SM.trim, 0, H + 0.1, Z)
  for (let k = 0; k < 9; k++) {
    T.batch.put(boxUV(0.9, 1, 0.6, 1), SM.stone, -W / 2 + 0.6 + k * ((W - 1.2) / 8), H + 0.85, Z + D / 2 + 0.1)
    T.batch.put(boxUV(0.9, 1, 0.6, 1), SM.stone, -W / 2 + 0.6 + k * ((W - 1.2) / 8), H + 0.85, Z - D / 2 - 0.1)
  }
  // rows of lit windows on the town-facing side
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 5; col++) {
      if (row === 0 && col === 2) continue
      T.batch.put(new THREE.PlaneGeometry(0.75, 1.5), SM.farWindow, -6 + col * 3, 5 + row * 4, Z + D / 2 + 0.03, 0, 1, 1, 1, { cast: false })
    }
  // great hall door + balcony
  T.batch.put(boxUV(3.2, 4.4, 0.4, 1), T.P.timber, 0, 2.2, Z + D / 2 + 0.2)
  T.batch.put(boxUV(5.5, 0.3, 1.4, 1), SM.trim, 0, 9.3, Z + D / 2 + 0.7)
  // corner turrets
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const x = sx * (W / 2)
      const z = Z + sz * (D / 2)
      const r = 1.7
      const h = H + 7
      T.batch.put(new THREE.CylinderGeometry(r, r * 1.06, h, 16), SM.stone, x, h / 2, z)
      T.batch.put(new THREE.CylinderGeometry(r * 1.2, r, 0.5, 16), SM.trim, x, h + 0.05, z)
      const rh = r * 3 * style.spire
      T.batch.put(new THREE.ConeGeometry(r * 1.35, rh, 16), SM.roof, x, h + 0.3 + rh / 2, z)
      if (style.finials) T.batch.put(new THREE.SphereGeometry(0.2, 8, 6), SM.finial, x, h + 0.4 + rh, z)
      if (sz > 0) T.batch.put(new THREE.PlaneGeometry(0.35, 1), SM.farWindow, x, h - 4, z + r + 0.02, 0, 1, 1, 1, { cast: false })
    }
  // great tower rising from the middle — the tallest thing in the kingdom
  const gr = 3.4
  const gh = H + 15
  T.batch.put(new THREE.CylinderGeometry(gr, gr * 1.05, gh, 20), SM.stone, 0, gh / 2, Z - 0.5)
  T.batch.put(new THREE.CylinderGeometry(gr * 1.22, gr, 0.7, 20), SM.trim, 0, gh + 0.1, Z - 0.5)
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2
    T.batch.put(boxUV(0.85, 0.9, 0.5, 1), SM.stone, Math.cos(a) * gr * 1.15, gh + 0.9, Z - 0.5 + Math.sin(a) * gr * 1.15, -a + Math.PI / 2)
  }
  const sh = gr * 3.4 * style.spire
  T.batch.put(new THREE.ConeGeometry(gr * 1.3, sh, 20), SM.roof, 0, gh + 0.45 + sh / 2, Z - 0.5)
  T.batch.put(new THREE.CylinderGeometry(0.06, 0.06, 4, 6), T.P.iron, 0, gh + sh + 2, Z - 0.5)
  for (let k = 0; k < 4; k++) T.batch.put(new THREE.PlaneGeometry(0.6, 1.4), SM.farWindow, Math.sin((k * Math.PI) / 2) * (gr + 0.02), gh - 5, Z - 0.5 + Math.cos((k * Math.PI) / 2) * (gr + 0.02), (k * Math.PI) / 2, 1, 1, 1, { cast: false })
  // a pennant on the very top
  const flagTex = bannerTexture()
  const flagMat = new THREE.MeshStandardMaterial({ map: flagTex, roughness: 0.8, side: THREE.DoubleSide, alphaTest: 0.5, color: style.id === 'balanced' ? '#ffffff' : style.banner[0] })
  T.disposables.push(flagTex, flagMat)
  const flag = new Cloth(2.2, 1.2, flagMat, 0.3)
  flag.mesh.rotation.z = -Math.PI / 2
  flag.mesh.position.set(0, gh + sh + 3.2, Z - 0.5)
  T.scene.add(flag.mesh)
  T.cloths.push(flag)
  // warm uplight so the keep reads as a lit landmark at night
  T.lights.push({ x: 0, y: 12, z: Z + D / 2 + 4, color: '#ff9a50', intensity: 16, dist: 22, priority: 3 })
}

/* ───────── Chad Gym (working: enter for Chad Press) ───────── */
export const GYM = { x: 20, z: -4 }
export function gym(T: Town) {
  const P = T.P
  const { x: X, z: Z } = GYM
  const wall = new THREE.MeshStandardMaterial({ color: '#17131a', roughness: 0.6, metalness: 0.3 })
  T.disposables.push(wall)
  T.batch.put(new THREE.BoxGeometry(9, 6, 10), wall, X, 3, Z)
  T.batch.put(new THREE.BoxGeometry(9.6, 0.5, 10.6), P.iron, X, 6.25, Z)
  for (const y of [0.15, 5.95]) T.batch.put(new THREE.BoxGeometry(0.06, 0.06, 10), P.glowOrange, X - 4.53, y, Z, 0, 1, 1, 1, { cast: false })
  const signTex = signTexture('CHAD GYM', { sub: 'NO PAIN · NO PUMP' })
  const signMat = new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false, color: new THREE.Color(2.8, 2.8, 2.8) })
  T.disposables.push(signTex, signMat)
  T.batch.put(new THREE.PlaneGeometry(6, 1.5), signMat, X - 4.56, 4.6, Z, -Math.PI / 2, 1, 1, 1, { cast: false })
  for (const dz of [-1.25, 1.25]) T.batch.put(new THREE.BoxGeometry(0.25, 3.5, 0.25), P.iron, X - 4.6, 1.75, Z + dz)
  T.batch.put(new THREE.BoxGeometry(0.25, 0.25, 2.75), P.iron, X - 4.6, 3.5, Z)
  const inside = new THREE.MeshBasicMaterial({ color: '#2a1206' })
  T.disposables.push(inside)
  T.batch.put(new THREE.BoxGeometry(0.02, 1.6, 0.08), inside, X - 4.5, 1.1, Z - 0.6, 0, 1, 1, 1, { cast: false })
  T.batch.put(new THREE.BoxGeometry(0.02, 1.6, 0.08), inside, X - 4.5, 1.1, Z + 0.6, 0, 1, 1, 1, { cast: false })
  T.batch.put(new THREE.BoxGeometry(0.02, 0.06, 1.6), inside, X - 4.5, 1.7, Z, 0, 1, 1, 1, { cast: false })
  T.lights.push({ x: X - 6, y: 2.2, z: Z, color: '#ff7a1a', intensity: 10, dist: 9, priority: 1 })
  T.colliders.push({ kind: 'box', minX: X - 4.7, maxX: X + 4.7, minZ: Z - 5.2, maxZ: Z + 5.2, h: 6 })
  // dumbbells outside
  for (let i = 0; i < 3; i++) {
    const bar = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8).rotateZ(Math.PI / 2)
    T.batch.put(bar, P.iron, X - 5.2, 0.17, Z + 3 + i * 0.5, Math.PI / 2)
    for (const sx of [-0.28, 0.28]) T.batch.put(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 14).rotateZ(Math.PI / 2), P.iron, X - 5.2, 0.17, Z + 3 + i * 0.5 + sx, Math.PI / 2)
  }
}

/* ───────── outer town wall (the real limit is World's BOUNDS) ───────── */
export function townWall(T: Town, bounds: number) {
  const P = T.P
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2
    const x = Math.cos(a) * (bounds + 1.4)
    const z = Math.sin(a) * (bounds + 1.4)
    if (z < -27) continue // castle closes the north
    T.batch.put(boxUV(5.6, 2.2, 0.9, 1.5), P.stone, x, 1.1, z, -a + Math.PI / 2)
  }
}

void Fire
