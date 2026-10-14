import * as THREE from 'three'
import type { Quality } from '../../save'
import type { Town } from './buildings'
import { boxUV, rng } from './kit'
import { Frame, PANEL, panelTexture, postedBoard, type SignMats } from './signs'
import { terrainHeight } from './city'
import { BRIDGE, DESCENT, DESCENT_W, VALLEY_Y } from './descent'
import { LANDING, WATER_Y, lakeRho } from './valley'
import { waterMaterial } from './fountain'
import { archEllipse } from './archGeo'
import { archMats, displayMaterial, shop, type ArchMats, type Roof } from './architecture'
import { flowerTub } from './ornament'
import { parkBench, type BenchSpot } from './westside'
import { inFrame } from './frame'

/**
 * MOONMERE — the lake in the valley basin beside Chad City, finished as one scene: the water (irregular shoreline, shelving
 * margins, moving normal-mapped surface), rocks + reeds + lily pads at the edge, the great stone BRIDGE over the inlet
 * (graceful elliptical arches, piers footed on the lake bed, masonry parapets, lanterns), the city's waterfront promenade
 * (balustrade, steps to the water, benches, a row of cafe/boat-hire frontages, a pavilion, a boathouse, moored boats), and the
 * Lakeside Landing (paving, a round pavilion, benches, a fishing pier, signposts, lanterns). Everything is built in a frame
 * whose y = 0 is the valley floor, so the existing street helpers work unchanged.
 */
export const LAKE_PIER = { x: 38.2, z: 432, deckY: 0.35 } // local y; the fishing prompt stands at the head
export const LAKE_LANTERNS: { x: number; y: number; z: number }[] = []
const SMt = (P: Town['P']): SignMats => ({ frame: P.iron, metal: P.iron, gold: P.gold, stone: P.stoneLight })

export function valleyLake(T: Town, waterNormal: THREE.Texture, q: Quality, seats: BenchSpot[], stoneTex: THREE.Texture) {
  const D = T.disposables
  /* ── the water: one plane over the whole basin; the terrain's own shelving margins make the shoreline, so it always meets the bank cleanly ── */
  const W = waterMaterial(waterNormal, D, '#1f5a74', '#0a2238')
  W.material.roughness = q === 'low' ? 0.25 : 0.1
  W.material.opacity = 0.9
  const x0 = -100
  const x1 = 140
  const z0 = 370
  const z1 = 610
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, 1, 1).rotateX(-Math.PI / 2)
  const uv = g.attributes.uv as THREE.BufferAttribute
  const pos = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + (x0 + x1) / 2) / 6, (pos.getZ(i) + (z0 + z1) / 2) / 6)
  const water = new THREE.Mesh(g, W.material)
  water.position.set((x0 + x1) / 2, WATER_Y, (z0 + z1) / 2)
  water.receiveShadow = q === 'high'
  water.renderOrder = 2
  T.scene.add(water)
  D.push(g)
  // (the slow surface motion is the normal map scrolling: one uniform per frame; low quality keeps a flatter, cheaper surface)
  T.dynamic.push({ update: (t) => (W.time.value = t) })
  inFrame(T, { x: 0, y: VALLEY_Y, z: 0 }, q !== 'low', (L) => valleyLakeFrame(L, q, seats, stoneTex))
}

/** everything that stands on the valley floor around the lake (built in a frame at y = VALLEY_Y) */
export function valleyLakeFrame(L: Town, q: Quality, seats: BenchSpot[], stoneTex: THREE.Texture) {
  const P = L.P
  const D = L.disposables
  const R = rng(7788)
  const tH = (x: number, z: number) => terrainHeight(x, z) - VALLEY_Y
  const WL = WATER_Y - VALLEY_Y
  const sm = SMt(P)
  const std = (p: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.85, ...p })
    D.push(m)
    return m
  }
  const timber = std({ color: '#5a4030', roughness: 0.9 })
  const timberLight = std({ color: '#8a6a4a', roughness: 0.85 })
  const reedMat = std({ color: '#8a9a4c', roughness: 1, side: THREE.DoubleSide })
  const padMat = std({ color: '#3f7a46', roughness: 0.9, side: THREE.DoubleSide })
  const hull = std({ color: '#7a3a22', roughness: 0.6 })
  const hullIn = std({ color: '#c8a070', roughness: 0.8 })
  const sailM = std({ color: '#e8e0cc', roughness: 0.95, side: THREE.DoubleSide })
  const glass = std({ color: '#3a5068', roughness: 0.08, metalness: 0.65, emissive: '#0c1422' })
  const mats: ArchMats[] = [archMats(L, 'render', stoneTex, glass), archMats(L, 'stone', stoneTex, glass), archMats(L, 'brick', stoneTex, glass)]
  const awnings = [std({ color: '#1f7a6a', side: THREE.DoubleSide }), std({ color: '#e8641a', side: THREE.DoubleSide }), std({ color: '#5b2a86', side: THREE.DoubleSide }), std({ color: '#a8321f', side: THREE.DoubleSide })]
  const lamp = (x: number, y: number, z: number, intensity = 3.6) => {
    L.batch.put(new THREE.CylinderGeometry(0.06, 0.09, 2.7, 6), P.iron, x, y + 1.35, z)
    L.batch.put(new THREE.BoxGeometry(0.22, 0.3, 0.22), P.glowOrange, x, y + 2.85, z, 0, 1, 1, 1, { cast: false })
    L.batch.put(new THREE.ConeGeometry(0.24, 0.2, 4).rotateY(Math.PI / 4), P.iron, x, y + 3.08, z)
    L.lights.push({ x, y: y + 2.85, z, color: '#ffb060', intensity, dist: 10, priority: 1 })
    LAKE_LANTERNS.push({ x, y: y + 2.85 + VALLEY_Y, z })
  }
  const paving = (x0: number, x1: number, z0: number, z1: number, mat: THREE.Material = P.plaza, y = 0.03) => {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2)
    const u = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < u.count; i++) u.setXY(i, (u.getX(i) * (x1 - x0)) / 3, (u.getY(i) * (z1 - z0)) / 3)
    L.batch.put(g, mat, (x0 + x1) / 2, y, (z0 + z1) / 2, 0, 1, 1, 1, { cast: false })
  }
  /** a box lying between two points (any slope), thickness w × h */
  const beam = (a: THREE.Vector3, b: THREE.Vector3, w: number, h: number, mat: THREE.Material, cast = true) => {
    const len = a.distanceTo(b)
    const m = new THREE.Matrix4().lookAt(a, b, new THREE.Vector3(0, 1, 0))
    L.batch.add(new THREE.BoxGeometry(w, h, len), mat, new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromRotationMatrix(m), new THREE.Vector3(1, 1, 1)), { cast })
  }

  /* ── the shore: rocks at the waterline, reed beds and lily pads in the shallows (instanced; fewer on low) ── */
  {
    const nR = q === 'low' ? 60 : q === 'medium' ? 110 : 170
    const nReed = q === 'low' ? 90 : q === 'medium' ? 170 : 260
    const rock = new THREE.DodecahedronGeometry(1, 0)
    const reed = new THREE.PlaneGeometry(0.16, 1.5).translate(0, 0.75, 0)
    const pad = new THREE.CircleGeometry(0.55, 10).rotateX(-Math.PI / 2)
    const rocks: THREE.Matrix4[] = []
    const reeds: THREE.Matrix4[] = []
    const pads: THREE.Matrix4[] = []
    const mt = (x: number, y: number, z: number, ry: number, sx: number, sy = sx, sz = sx) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz))
    const free = (x: number, z: number) => !(x > 47 && x < 82 && z > 416 && z < 456) && !(x > -90 && x < -4 && z > 460 && z < 484) && !(Math.abs(x - 20) < 30 && z > 405 && z < 428) // landing, promenade, bridge line stay clear
    for (let i = 0; i < nR * 30 && (rocks.length < nR || reeds.length < nReed); i++) {
      const x = -95 + R() * 230
      const z = 380 + R() * 230
      const r = lakeRho(x, z)
      if (r < 0.7 || r > 0.96 || !free(x, z)) continue
      const y = tH(x, z)
      if (R() < 0.45 && rocks.length < nR) {
        const s = 0.35 + R() * 0.9
        rocks.push(mt(x, Math.max(y, WL - 0.15) + s * 0.25, z, R() * 6, s * 1.3, s * 0.7, s))
      } else if (reeds.length < nReed && y < WL + 0.2 && y > WL - 1.4) {
        for (let k = 0; k < 4; k++) reeds.push(mt(x + (R() - 0.5) * 0.7, y, z + (R() - 0.5) * 0.7, R() * 6, 0.8 + R() * 0.8, 0.8 + R() * 0.9, 1))
      } else if (y < WL - 0.2 && y > WL - 1.8 && pads.length < 80) {
        pads.push(mt(x, WL + 0.02, z, R() * 6, 0.7 + R() * 0.8, 1, 1))
      }
    }
    for (const [geo, mat, list] of [[rock, P.rock, rocks], [reed, reedMat, reeds], [pad, padMat, pads]] as const) {
      if (!list.length) continue
      const im = new THREE.InstancedMesh(geo, mat, list.length)
      list.forEach((m, i) => im.setMatrixAt(i, m))
      im.castShadow = false
      im.computeBoundingSphere()
      L.scene.add(im)
      D.push(geo)
    }
  }

  /* ── the stone bridge over the inlet (the road's own deck, arched; piers footed on the lake bed; parapets; lanterns) ── */
  {
    const xE = BRIDGE.xEast
    const xW = BRIDGE.xWest
    const zc = BRIDGE.z
    const span = 12.5
    const n = Math.max(2, Math.round((xE - xW) / span))
    const sp = (xE - xW) / n
    const W = DESCENT_W
    const deckAt = (x: number) => DESCENT.nearest(x, zc).y - VALLEY_Y // road y in this frame
    const pierW = 2.3
    const SPRING = WL - 1.0 // arches spring just under the waterline
    for (let i = 0; i <= n; i++) {
      const x = xE - i * sp
      const dy = deckAt(x)
      const base = Math.min(tH(x, zc), WL - 0.5) - 0.8
      const h = dy - 1.6 - base
      if (h < 0.5) continue
      // pier: tapered shaft with a cutwater nose either side of the current, a plinth at the bed, a cap under the deck
      L.batch.put(boxUV(pierW, h, W + 1.0, 2), P.stone, x, base + h / 2, zc)
      L.batch.put(boxUV(pierW + 0.5, 0.6, W + 1.5, 1.4), P.stoneLight, x, base + 0.3, zc)
      L.batch.put(boxUV(pierW + 0.5, 0.45, W + 1.4, 1.4), P.stoneLight, x, dy - 1.6 - 0.22, zc)
      for (const sz of [-1, 1]) L.batch.put(new THREE.ConeGeometry(0.85, h * 0.62, 4).rotateY(Math.PI / 4).scale(1, 1, 1), P.stone, x, base + h * 0.31 + 0.3, zc + sz * (W / 2 + 0.95))
    }
    for (let i = 0; i < n; i++) {
      const xa = xE - i * sp
      const xb = xE - (i + 1) * sp
      const xm = (xa + xb) / 2
      const dyM = deckAt(xm)
      const clear = sp - pierW
      const rise = Math.min(clear / 2, Math.max(1.4, dyM - 1.6 - SPRING - 0.55))
      const g = archEllipse(clear / 2, rise, 0.55, W + 0.8)
      L.batch.add(g, P.stoneLight, new THREE.Matrix4().makeTranslation(xm, SPRING, zc), { cast: true })
      g.dispose()
      // spandrel wall above the arch, in short sloped slabs so it follows the deck's rise
      for (let k = 0; k < 4; k++) {
        const xa2 = xa - ((xa - xb) * k) / 4
        const xb2 = xa - ((xa - xb) * (k + 1)) / 4
        const a = new THREE.Vector3(xa2, deckAt(xa2) - 1.15, zc)
        const b = new THREE.Vector3(xb2, deckAt(xb2) - 1.15, zc)
        beam(a, b, W + 0.7, 1.15, P.stone)
      }
    }
    // the deck's parapets, coping, posts and lanterns (sloped with the road)
    const stepX = 2.0
    for (let x = xE; x > xW + 0.01; x -= stepX) {
      const x2 = Math.max(xW, x - stepX)
      const a = new THREE.Vector3(x, deckAt(x), zc)
      const b = new THREE.Vector3(x2, deckAt(x2), zc)
      for (const sz of [-1, 1]) {
        const off = sz * (W / 2 + 0.28)
        beam(a.clone().add(new THREE.Vector3(0, 0.55, off)), b.clone().add(new THREE.Vector3(0, 0.55, off)), 0.52, 1.1, P.stoneLight)
        beam(a.clone().add(new THREE.Vector3(0, 1.14, off)), b.clone().add(new THREE.Vector3(0, 1.14, off)), 0.74, 0.14, P.stone, false)
      }
    }
    for (let i = 0; i <= n * 2; i++) {
      const x = xE - (i * (xE - xW)) / (n * 2)
      const y = deckAt(x)
      for (const sz of [-1, 1]) {
        const z = zc + sz * (W / 2 + 0.28)
        L.batch.put(boxUV(0.8, 1.55, 0.8, 1.4), P.stone, x, y + 0.78, z)
        L.batch.put(new THREE.SphereGeometry(0.2, 8, 6), P.gold, x, y + 1.72, z)
        if (i % 2 === 1) lamp(x, y + 0.1, zc + sz * (W / 2 + 0.28), 4)
      }
    }
    // abutments where the bridge meets each bank: wing walls stepping down to the ground
    for (const [x, dir] of [[xE + 1.6, 1], [xW - 1.6, -1]] as const) {
      for (const sz of [-1, 1]) {
        const g = tH(x, zc + sz * (W / 2 + 1.6))
        const hh = Math.max(0.8, 0.9 - g + 0.4)
        L.batch.put(boxUV(2.8, hh + 0.5, 1.0, 2), P.stone, x + dir * 0.8, g + (hh + 0.5) / 2 - 0.3, zc + sz * (W / 2 + 0.6))
      }
    }
    // a nameplate
    const plate = new THREE.MeshStandardMaterial({ map: panelTexture('MOONSPAN BRIDGE', 'raised 1892 · the lantern road', 2.6, PANEL.dark, D), roughness: 0.6 })
    D.push(plate)
    postedBoard(Frame.at(L.batch, xE + 4.5, 0, zc - W / 2 - 1.8, Math.PI / 2 + 0.3), 1.8, 0.8, 1.2, plate, sm, true)
    L.colliders.push({ kind: 'circle', x: xE + 4.5, z: zc - W / 2 - 1.8, r: 0.7, h: 1.8 })
  }

  /* ── the city's waterfront: promenade, balustrade, steps to the water, benches, frontages, a pavilion, a boathouse, moored boats ── */
  {
    const x0 = -88, x1 = -8, zWalk0 = 470, zWalk1 = 482
    paving(x0, x1, 463, zWalk1, P.plaza, 0.03)
    paving(x0, x1, zWalk1 - 1.4, zWalk1 - 0.9, P.stoneLight, 0.04) // a pale edge band
    // a low balustrade along the water's edge with gaps for two flights of steps
    const steps = [-70, -34]
    for (let x = x0; x < x1; x += 2) {
      if (steps.some((s) => Math.abs(x + 1 - s) < 2.4)) continue
      L.batch.put(boxUV(2.02, 0.95, 0.4, 1), P.stone, x + 1, 0.48, zWalk1 + 0.2)
      L.batch.put(boxUV(2.1, 0.12, 0.55, 1), P.stoneLight, x + 1, 1.01, zWalk1 + 0.2)
      if (Math.round(x / 2) % 3 === 0) {
        L.batch.put(boxUV(0.55, 1.35, 0.55, 1), P.stone, x, 0.68, zWalk1 + 0.2)
        L.batch.put(new THREE.SphereGeometry(0.16, 8, 6), P.gold, x, 1.45, zWalk1 + 0.2)
      }
      L.colliders.push({ kind: 'box', minX: x, maxX: x + 2, minZ: zWalk1 - 0.1, maxZ: zWalk1 + 0.5, h: 1 })
    }
    for (const sx of steps) {
      for (let k = 0; k < 5; k++) L.batch.put(boxUV(4.2, 0.2, 0.7, 1), P.stoneLight, sx, -0.1 - k * 0.2, zWalk1 + 0.4 + k * 0.62)
      L.colliders.push({ kind: 'box', minX: sx - 2.2, maxX: sx - 2.0, minZ: zWalk1 - 0.1, maxZ: zWalk1 + 3.6, h: 1 })
      L.colliders.push({ kind: 'box', minX: sx + 2.0, maxX: sx + 2.2, minZ: zWalk1 - 0.1, maxZ: zWalk1 + 3.6, h: 1 })
    }
    // street lamps + benches facing the lake (the benches are real seats)
    for (let x = x0 + 4; x < x1; x += 10) lamp(x, 0, zWalk1 - 2.4)
    for (const x of [-80, -58, -46, -22, -14]) parkBench(L, x, zWalk1 - 1.5, 0, 'Sit by the water', seats)
    for (const x of [-76, -52, -28]) flowerTub(L, x, zWalk0 + 0.3, { long: 2.4 })
    // the frontage row (cafe, boat hire, ice cream, bookshop): the same shopfront kit as the village, facing the lake
    const names = ['LAKESIDE CAFE', 'BOAT HIRE', 'GELATO', 'TIDE BOOKS', 'THE FERRYMAN', 'PIER PIES']
    const xs = [-82, -72, -62, -52, -40, -29]
    xs.forEach((x, i) => {
      const w = 8.6
      const roof: Roof = (['pitched', 'mansard', 'parapet'] as const)[i % 3]
      shop(L, mats[i % 3], { x, z: 466.4, w, d: 6, floors: 2 + (i % 2), ry: 0, roof, name: names[i], sub: ['coffee · cake · sunsets', 'rowboats by the hour', 'twelve flavours', 'second-hand + rare', 'late supper', 'hot from the oven'][i], sign: 'ornate', crest: (['crown', 'pumpkin', 'paw'] as const)[i % 3], panel: [PANEL.cream, PANEL.green, PANEL.purple, PANEL.dark][i % 4], greenery: true, awning: awnings[i % 4], display: displayMaterial(L, ['#ffb24a', '#7fe8ff', '#ff9ad5', '#c8a0ff'][i % 4], (['shelves', 'racks', 'cabinets'] as const)[i % 3]), balcony: i % 2 === 1 }, undefined)
    })
    // cafe terrace: tables, chairs and parasols in front of the first frontage
    for (let k = 0; k < 4; k++) {
      const tx = -84 + k * 2.6
      L.batch.put(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 12), P.woodLight, tx, 0.78, zWalk0 + 3.2)
      L.batch.put(new THREE.CylinderGeometry(0.04, 0.06, 0.78, 6), P.iron, tx, 0.39, zWalk0 + 3.2)
      L.batch.put(new THREE.ConeGeometry(1.1, 0.5, 8), awnings[k % 4], tx, 2.35, zWalk0 + 3.2)
      L.batch.put(new THREE.CylinderGeometry(0.03, 0.03, 2.1, 5), P.iron, tx, 1.2, zWalk0 + 3.2)
      for (const [dx, dz] of [[0.7, 0], [-0.7, 0]] as const) L.batch.put(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 8), P.woodLight, tx + dx, 0.45, zWalk0 + 3.2 + dz)
      L.colliders.push({ kind: 'circle', x: tx, z: zWalk0 + 3.2, r: 0.5, h: 1 })
    }
    // an open pavilion on the promenade (eight columns, a conical slate roof, a bench ring)
    {
      const px = -18
      const pz = 475.5
      L.batch.put(new THREE.CylinderGeometry(3.4, 3.6, 0.35, 16), P.stoneLight, px, 0.18, pz)
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2
        L.batch.put(new THREE.CylinderGeometry(0.14, 0.17, 3.2, 8), P.stone, px + Math.cos(a) * 3.0, 1.95, pz + Math.sin(a) * 3.0)
        L.colliders.push({ kind: 'circle', x: px + Math.cos(a) * 3.0, z: pz + Math.sin(a) * 3.0, r: 0.22, h: 3 })
      }
      L.batch.put(new THREE.TorusGeometry(3.0, 0.1, 6, 24).rotateX(Math.PI / 2), P.stoneLight, px, 3.55, pz)
      L.batch.put(new THREE.ConeGeometry(3.9, 1.9, 16), P.roofSlate, px, 4.5, pz)
      L.batch.put(new THREE.SphereGeometry(0.2, 8, 6), P.gold, px, 5.6, pz)
      L.lights.push({ x: px, y: 3.0, z: pz, color: '#ffc880', intensity: 5, dist: 12, priority: 2 })
    }
    // the boathouse: a timber hall on piles over the water at the west end of the promenade, with a slipway and moored boats
    {
      const bx = -66
      const bz = 489
      for (const sx of [-3.4, 0, 3.4]) for (const sz of [-3, 0, 3]) L.batch.put(new THREE.CylinderGeometry(0.2, 0.24, 4.2, 6), timber, bx + sx, -1.6, bz + sz)
      L.batch.put(boxUV(9.4, 0.3, 8.4, 1.6), timberLight, bx, 0.15, bz)
      L.batch.put(boxUV(8.6, 3.0, 0.3, 1.6), timber, bx, 1.65, bz + 3.9)
      L.batch.put(boxUV(0.3, 3.0, 7.6, 1.6), timber, bx - 4.2, 1.65, bz)
      L.batch.put(boxUV(0.3, 3.0, 7.6, 1.6), timber, bx + 4.2, 1.65, bz)
      for (const sx of [-1, 1]) L.batch.put(boxUV(2.4, 2.4, 0.25, 1.6), P.glowGold, bx + sx * 2.9, 1.5, bz - 3.9, 0, 1, 1, 1, { cast: false })
      const roofG = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-4.9, 0), new THREE.Vector2(4.9, 0), new THREE.Vector2(0, 2.2)]), { depth: 8.8, bevelEnabled: false })
      roofG.translate(0, 0, -4.4)
      roofG.rotateY(Math.PI / 2)
      L.batch.put(roofG, P.roofRed, bx, 3.25, bz)
      L.colliders.push({ kind: 'box', minX: bx - 4.8, maxX: bx + 4.8, minZ: bz - 4.2, maxZ: bz + 4.4, h: 3 })
      // a walkway from the promenade out to the boathouse (a short jetty on piles)
      L.batch.put(boxUV(2.4, 0.2, 5.2, 1.6), timberLight, bx - 6.2, 0.1, bz - 5.2)
    }
    // moored rowboats + a little sailing dinghy at the steps (they rock with the water)
    const boats: { g: THREE.Group; ph: number }[] = []
    const mkBoat = (x: number, z: number, ry: number, withSail = false) => {
      const g = new THREE.Group()
      const body = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1.0, 0.55, 2.4).rotateX(Math.PI), hull)
      body.position.y = 0.45
      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.88, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1, 0.5, 2.3).rotateX(Math.PI), hullIn)
      inner.position.y = 0.5
      g.add(body, inner)
      for (const dz of [-0.7, 0.8]) {
        const t = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.28), timberLight)
        t.position.set(0, 0.62, dz)
        g.add(t)
      }
      if (withSail) {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 3.2, 6), timber)
        mast.position.set(0, 2.1, 0.2)
        const sl = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.9, 0.2), new THREE.Vector3(0, 3.5, 0.2), new THREE.Vector3(0, 0.9, -1.8)]), sailM)
        sl.geometry.setIndex([0, 1, 2])
        sl.geometry.computeVertexNormals()
        g.add(mast, sl)
      }
      g.position.set(x, WL + 0.05, z)
      g.rotation.y = ry
      L.scene.add(g)
      boats.push({ g, ph: x * 0.7 + z })
      D.push(body.geometry, inner.geometry)
    }
    mkBoat(-70, 486.8, Math.PI / 2 + 0.1)
    mkBoat(-62, 491.5, 0.2)
    mkBoat(-38.6, 487.6, 0.05, true)
    mkBoat(-30, 489.2, Math.PI / 2 - 0.15)
    L.dynamic.push({ update: (t) => boats.forEach((b) => ((b.g.position.y = WL + 0.05 + Math.sin(t * 1.1 + b.ph) * 0.035), (b.g.rotation.z = Math.sin(t * 0.9 + b.ph) * 0.025))) })
  }

  /* ── Lakeside Landing (east end of the bridge): paving, a round pavilion, benches, a fishing pier, signposts, lanterns, planting ── */
  {
    const { x0, x1, z0, z1 } = LANDING
    paving(x0, x1, z0, z1, P.plaza, 0.03)
    for (const [r, m] of [[6.4, P.stoneLight], [5.9, P.gold]] as const) L.batch.put(new THREE.RingGeometry(r - 0.16, r, 40).rotateX(-Math.PI / 2), m, 66, 0.045, 436, 0, 1, 1, 1, { cast: false })
    // the round pavilion at the centre
    {
      const px = 66
      const pz = 436
      L.batch.put(new THREE.CylinderGeometry(3.2, 3.4, 0.4, 16), P.stoneLight, px, 0.2, pz)
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2
        L.batch.put(new THREE.CylinderGeometry(0.15, 0.19, 3.3, 8), P.stone, px + Math.cos(a) * 2.8, 2.05, pz + Math.sin(a) * 2.8)
        L.colliders.push({ kind: 'circle', x: px + Math.cos(a) * 2.8, z: pz + Math.sin(a) * 2.8, r: 0.24, h: 3 })
      }
      L.batch.put(new THREE.TorusGeometry(2.8, 0.1, 6, 24).rotateX(Math.PI / 2), P.stoneLight, px, 3.7, pz)
      L.batch.put(new THREE.ConeGeometry(3.7, 2.1, 12), P.roofSlate, px, 4.75, pz)
      L.batch.put(new THREE.SphereGeometry(0.22, 8, 6), P.gold, px, 5.95, pz)
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + Math.PI / 6
        L.batch.put(new THREE.BoxGeometry(1.4, 0.1, 0.4), P.woodLight, px + Math.cos(a) * 2.0, 0.6, pz + Math.sin(a) * 2.0, -a + Math.PI / 2)
      }
      L.lights.push({ x: px, y: 3.2, z: pz, color: '#ffc880', intensity: 5.5, dist: 13, priority: 2 })
    }
    for (const [bx, bz, ry] of [[56, 426, Math.PI / 2], [56, 446, Math.PI / 2], [74, 426, -Math.PI / 2], [74, 446, -Math.PI / 2]] as const) parkBench(L, bx, bz, ry, 'Sit by the landing', seats)
    for (let z = z0 + 3; z < z1; z += 10) {
      lamp(x1 - 1.2, 0, z)
      lamp(x0 + 1.2, 0, z)
    }
    for (const z of [422, 432, 442, 450]) flowerTub(L, 78.4, z, { long: 2.2, ry: Math.PI / 2 })
    // trees: framing, in groups, with a clear line of sight to the water
    for (const [tx, tz, s] of [[76, 419, 1.1], [80.5, 428, 1.0], [80.5, 444, 1.15], [77, 452, 0.95], [53, 452, 1.0]] as const) {
      L.batch.put(new THREE.CylinderGeometry(0.16 * s, 0.24 * s, 2.8 * s, 6), P.bark, tx, 1.4 * s, tz)
      for (const [r, y, dx, dz] of [[2.0, 3.4, 0, 0], [1.5, 4.4, 0.3, 0.1], [1.0, 5.1, 0, 0], [1.2, 3.7, 1.2, 0.4], [1.1, 3.9, -1.1, -0.5]] as const)
        L.batch.put(new THREE.SphereGeometry(r * s, 9, 6).scale(1, 0.55, 1), P.foliageAutumn, tx + dx * s, y * s, tz + dz * s)
      L.colliders.push({ kind: 'circle', x: tx, z: tz, r: 0.4, h: 4 })
    }
    // the fishing pier: a timber deck on piles out over the inlet, a lantern at the head, a rail along both sides
    {
      const zP = LAKE_PIER.z
      const xHead = LAKE_PIER.x
      const len = x0 - xHead
      L.batch.put(boxUV(len, 0.22, 2.6, 1.6), timberLight, (x0 + xHead) / 2, LAKE_PIER.deckY, zP)
      for (let k = 0; k <= 5; k++) {
        const x = xHead + (k * len) / 5
        for (const sz of [-1.1, 1.1]) L.batch.put(new THREE.CylinderGeometry(0.13, 0.16, 3.6, 6), timber, x, -1.45, zP + sz)
      }
      for (const sz of [-1.25, 1.25]) {
        L.batch.put(boxUV(len, 0.08, 0.1, 1), timber, (x0 + xHead) / 2, LAKE_PIER.deckY + 1.0, zP + sz)
        for (let k = 0; k <= 8; k++) L.batch.put(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 5), timber, xHead + (k * len) / 8, LAKE_PIER.deckY + 0.55, zP + sz)
      }
      lamp(xHead + 0.4, LAKE_PIER.deckY, zP - 1.1, 4.2)
      L.colliders.push({ kind: 'box', minX: xHead - 0.3, maxX: xHead, minZ: zP - 1.3, maxZ: zP + 1.3, h: 1 }) // the end of the planks
      mkBait(L, P, xHead + 3, zP + 1.35, LAKE_PIER.deckY)
    }
    // signposts: where everything is
    {
      const post = (x: number, z: number, ry: number, text: [string, string, number][]) => {
        L.batch.put(new THREE.CylinderGeometry(0.07, 0.09, 3.1, 6), P.iron, x, 1.55, z)
        text.forEach(([t, sub, dy], i) => {
          const m = new THREE.MeshStandardMaterial({ map: panelTexture(t, sub, 2.4, PANEL.dark, D), roughness: 0.65 })
          D.push(m)
          const F = Frame.at(L.batch, x, 0, z, ry + (i % 2 ? 0.25 : -0.25))
          F.put(new THREE.PlaneGeometry(1.5, 0.42), m, 0.8, 2.9 - i * 0.55, 0.06, 0, 0, 0, false)
          F.box(1.52, 0.44, 0.04, P.iron, 0.8, 2.9 - i * 0.55, 0.02)
          void dy
        })
        L.colliders.push({ kind: 'circle', x, z, r: 0.3, h: 3 })
      }
      post(72, 422, Math.PI, [['MOONSPAN BRIDGE', 'Chad City · 50 m', 0], ['MOONCREST MANOR', 'the drive · uphill', 0], ['FISHING PIER', 'rods for hire · west', 0], ['THE VILLAGE', 'back up the lantern road', 0]])
    }
  }
}

/** a little bait bucket + rod stand on the pier (decor that says "fish here") */
function mkBait(L: Town, P: Town['P'], x: number, z: number, y: number) {
  L.batch.put(new THREE.CylinderGeometry(0.22, 0.18, 0.34, 10), P.iron, x, y + 0.28, z)
  L.batch.put(new THREE.CylinderGeometry(0.02, 0.02, 1.7, 5).rotateZ(1.2), P.woodLight, x + 0.2, y + 0.7, z + 0.3)
  L.batch.put(new THREE.CylinderGeometry(0.02, 0.02, 1.7, 5).rotateZ(1.25), P.woodLight, x + 0.3, y + 0.7, z + 0.55)
}
