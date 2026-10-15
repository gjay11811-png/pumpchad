import * as THREE from 'three'
import type { Quality } from '../../save'
import type { Town } from './buildings'
import { boxUV, gableGeo, rng } from './kit'
import { Frame, PANEL, boardTexture, panelTexture, postedBoard, type SignMats } from './signs'
import { terrainHeight } from './city'
import { DESCENT } from './descent'
import { HAMLET, TOWER, TOWER_TRAIL, WOOD_TRAIL, lakeRho } from './valley'
import { RoadSys } from './roadnet'
import { archMats, detailWalls, displayMaterial, shop, type ArchMats } from './architecture'
import { climbers, flowerTub, windowBox } from './ornament'
import { parkBench, type BenchSpot } from './westside'
import { inFrame } from './frame'

/**
 * THE ROADSIDE PLACES on the way down:
 *  • the AUTUMN WOODLAND — layered trees of mixed species, rocky banks, ground plants, drifts of fallen leaves, and an optional
 *    woodland trail that leaves the road at the second hairpin and rejoins at the hamlet (past an old shrine and a stream crossing);
 *  • the ROADSIDE HAMLET — a terrace settlement: The Lantern Inn (enterable), five individually designed cottages with gardens,
 *    chimneys and shuttered windows, a cobbled courtyard with a well, a noticeboard, benches and lanterns, a hidden garden behind;
 *  • the OLD WATCHTOWER — a stone landmark on a rocky knoll, reached by a short trail; an accessible chamber and lookout inside.
 */
export const HAMLET_INN = { id: 'inn', x: -28, z: 201, w: 12, d: 8, face: 0 }
export const WATCHTOWER = { id: 'watchtower', x: TOWER.x, z: TOWER.z, r: 3.5, h: 15, face: 0 }
export const HAMLET_WELL = { x: -27, z: 217 }
export const HAMLET_BOARD = { x: -19.5, z: 211.5 }

const SMt = (P: Town['P']): SignMats => ({ frame: P.iron, metal: P.iron, gold: P.gold, stone: P.stoneLight })

/** a surfaced footpath/lane along a RoadSys (world coordinates, y follows the path), with soft edges */
export function pathRibbon(T: Town, road: RoadSys, mat: THREE.Material, width: number, lift = 0.05) {
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  let n = 0
  for (let s = 0; s <= road.len + 0.01; s += 1.2) {
    const p = road.pointAt(s)
    const nx = -p.tz
    const nz = p.tx
    for (const side of [-1, 1]) {
      pos.push(p.x + nx * side * (width / 2), p.y + lift, p.z + nz * side * (width / 2))
      uv.push(side < 0 ? 0 : width / 2.5, p.s / 2.5)
    }
    if (n > 0) {
      const a = (n - 1) * 2
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
    n++
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  if ((g.attributes.normal as THREE.BufferAttribute).getY(0) < 0) {
    g.setIndex(idx.map((_, i) => idx[i % 3 === 0 ? i : i % 3 === 1 ? i + 1 : i - 1]))
    g.computeVertexNormals()
  }
  T.batch.add(g, mat, new THREE.Matrix4(), { cast: false })
}

type CottageSpec = { x: number; z: number; ry: number; w: number; d: number; floors: 1 | 2; style: 0 | 1 | 2; shutter: string; porch?: boolean; door?: number; chimneyL?: boolean }

/** one individually proportioned cottage: plinth, walls, framed + shuttered windows, a surround door with step + lantern, thick-eaved gabled roof, chimney, garden */
function cottage(L: Town, M: ArchMats, c: CottageSpec, shutterMats: Record<string, THREE.Material>) {
  const P = L.P
  const F = Frame.at(L.batch, c.x, 0, c.z, c.ry)
  const H = 2.9 + (c.floors - 1) * 2.7
  const fz = c.d / 2
  const rise = Math.min(3.0, c.d * 0.45)
  F.put(boxUV(c.w, H, c.d, 2), M.wall, 0, H / 2, 0)
  F.put(boxUV(c.w + 0.14, 0.45, c.d + 0.14, 1.2), M.plinth, 0, 0.225, 0)
  if (c.floors > 1) F.put(boxUV(c.w + 0.12, 0.16, c.d + 0.12, 1.2), M.trim, 0, 2.95, 0)
  for (const sx of [-1, 1]) for (let y = 0.5, k = 0; y < H - 0.3; y += 0.6, k++) F.put(boxUV(k % 2 ? 0.24 : 0.4, 0.28, 0.06, 1), M.trim, sx * (c.w / 2 - (k % 2 ? 0.12 : 0.2)), y, fz + 0.03)
  if (c.style === 1) {
    // timber framing on the front: dark posts + rails + braces over the render
    for (const sx of [-1, -0.5, 0, 0.5, 1]) F.box(0.12, H - 0.5, 0.08, M.frame, sx * (c.w / 2 - 0.1), H / 2 + 0.1, fz + 0.05)
    for (const y of [1.05, 2.9]) F.box(c.w - 0.1, 0.12, 0.08, M.frame, 0, y, fz + 0.05)
  }
  // roof: a gable over the width, deep eaves, ridge, barge boards
  const rg = gableGeo(c.d + 0.9, c.w + 0.9, rise, 2)
  rg.rotateY(Math.PI / 2)
  F.put(rg, M.roof, 0, H + 0.16, 0)
  F.box(c.w + 1.0, 0.12, 0.3, M.trim, 0, H + 0.16 + rise + 0.03, 0)
  F.box(c.w + 0.95, 0.12, 0.16, M.trim, 0, H + 0.2, fz + 0.45)
  F.box(c.w + 0.95, 0.12, 0.16, M.trim, 0, H + 0.2, -fz - 0.45)
  // door with a stone surround, a step, a lantern; (this door is a private home: closed, a curtain drawn at the glass)
  const dx = c.door ?? 0
  for (const sx of [-1, 1]) F.box(0.22, 2.35, 0.2, M.trim, dx + sx * 0.7, 1.17, fz + 0.06)
  F.box(1.9, 0.22, 0.24, M.trim, dx, 2.42, fz + 0.07)
  F.box(0.3, 0.3, 0.26, P.gold, dx, 2.5, fz + 0.09)
  F.box(1.2, 2.2, 0.08, M.door, dx, 1.1, fz - 0.12)
  for (const x of [-0.3, 0.3]) for (const y of [0.7, 1.55]) F.box(0.46, 0.64, 0.03, M.frame, dx + x, y, fz - 0.07)
  F.box(1.5, 0.14, 0.6, M.plinth, dx, 0.07, fz + 0.3)
  F.box(1.9, 0.14, 0.4, M.plinth, dx, 0.02, fz + 0.62)
  F.put(new THREE.BoxGeometry(0.34, 0.44, 0.34), P.glowOrange, dx + 1.1, 2.0, fz + 0.2, 0, 0, 0, false)
  L.lights.push({ x: F.world(dx + 1.1, 2.0, fz + 0.4).x, y: 2.0, z: F.world(dx + 1.1, 2.0, fz + 0.4).z, color: '#ffb060', intensity: 2.6, dist: 7, priority: 1 })
  if (c.porch) {
    F.box(0.14, 2.5, 0.14, M.frame, dx - 0.95, 1.25, fz + 1.1)
    F.box(0.14, 2.5, 0.14, M.frame, dx + 0.95, 1.25, fz + 1.1)
    const pr = F.sub(dx, 2.62, fz + 0.62, -0.35, 0, 0)
    pr.box(2.5, 0.1, 1.7, M.roof, 0, 0, 0)
  }
  // windows: framed, sill + lintel, shutters either side, a window box on the ground floor
  const bays = c.w > 6.8 ? 2 : 1
  const place = (wx: number, y: number, lit: boolean) => {
    F.put(new THREE.PlaneGeometry(0.86, 1.2), lit ? P.windowLit : M.glass, wx, y, fz + 0.006, 0, 0, 0, false)
    F.box(1.06, 0.1, 0.12, M.frame, wx, y + 0.65, fz + 0.04)
    F.box(1.06, 0.1, 0.12, M.frame, wx, y - 0.65, fz + 0.04)
    for (const sx of [-0.5, 0.5]) F.box(0.08, 1.3, 0.12, M.frame, wx + sx, y, fz + 0.04)
    F.box(0.05, 1.2, 0.08, M.frame, wx, y, fz + 0.03)
    F.box(1.3, 0.1, 0.26, M.trim, wx, y - 0.74, fz + 0.1)
    F.box(1.3, 0.2, 0.14, M.trim, wx, y + 0.78, fz + 0.06)
    for (const sx of [-1, 1]) F.box(0.44, 1.26, 0.05, shutterMats[c.shutter], wx + sx * 0.78, y, fz + 0.04)
  }
  const gx = (k: number) => (k === 0 ? [-c.w * 0.28, c.w * 0.28] : [-c.w * 0.3, 0.0 + c.w * 0.3])[0] // (unused helper kept simple below)
  void gx
  const sideX = bays === 2 ? [-c.w * 0.3, c.w * 0.3] : [c.w * 0.28]
  const dside = dx >= 0 ? -1 : 1
  sideX.forEach((wx, i) => place(Math.abs(wx) < 0.8 ? wx + dside * 1.4 : wx, 1.55, (i + Math.round(c.x)) % 2 === 0))
  if (c.floors > 1) sideX.concat([dx]).forEach((wx, i) => place(wx, 4.0, (i + Math.round(c.z)) % 3 === 0))
  if (bays === 2) for (const wx of sideX) windowBox(L, F.sub(wx, 0, fz + 0.02), 1.0, 0.65)
  // sides + rear, chimneys
  detailWalls(L, F, { x: c.x, z: c.z, w: c.w, d: c.d, floors: c.floors, ry: c.ry, roof: 'pitched' }, M, H, 0)
  // a little front garden: low fence, beds, a shrub
  const gz = fz + 1.9
  for (let k = -2; k <= 2; k++) F.box(0.08, 0.7, 0.08, P.woodLight, k * (c.w / 4.4), 0.35, gz)
  F.box(c.w * 0.92, 0.06, 0.06, P.woodLight, 0, 0.62, gz)
  F.box(c.w * 0.92, 0.06, 0.06, P.woodLight, 0, 0.3, gz)
  for (const sx of [-1, 1]) F.box(c.w * 0.3, 0.2, 0.7, P.soil, sx * (c.w * 0.3), 0.1, fz + 1.2)
  const cx = F.world(0, 0, 0)
  const a = Math.cos(c.ry)
  const b = Math.sin(c.ry)
  const hw = (Math.abs(a) * c.w + Math.abs(b) * c.d) / 2 + 0.2
  const hd = (Math.abs(b) * c.w + Math.abs(a) * c.d) / 2 + 0.2
  L.colliders.push({ kind: 'box', minX: cx.x - hw, maxX: cx.x + hw, minZ: cx.z - hd, maxZ: cx.z + hd, h: H })
}

/** the whole hamlet, in a frame sitting on its terrace (local y = 0 is the terrace) */
export function hamlet(T: Town, q: Quality, stoneTex: THREE.Texture, seats: BenchSpot[]) {
  inFrame(T, { x: 0, y: HAMLET.y, z: 0 }, q !== 'low', (L) => {
    const P = L.P
    const D = L.disposables
    const R = rng(3141)
    const glass = new THREE.MeshStandardMaterial({ color: '#3a5068', roughness: 0.08, metalness: 0.65, emissive: '#0c1422' })
    D.push(glass)
    const styles = [archMats(L, 'stone', stoneTex, glass), archMats(L, 'render', stoneTex, glass), archMats(L, 'brick', stoneTex, glass)]
    const sh = (c: string) => {
      const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 })
      D.push(m)
      return m
    }
    const shutters: Record<string, THREE.Material> = { green: sh('#3f6a4a'), red: sh('#8a2f22'), blue: sh('#3a5a8a'), purple: sh('#5b2a86') }
    const awn = new THREE.MeshStandardMaterial({ color: '#a8321f', roughness: 0.75, side: THREE.DoubleSide })
    D.push(awn)
    // the terrace: setts, a courtyard ring, a drainage channel along the road side
    const pave = (x0: number, x1: number, z0: number, z1: number, mat: THREE.Material, y = 0.03) => {
      const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2)
      const u = g.attributes.uv as THREE.BufferAttribute
      for (let i = 0; i < u.count; i++) u.setXY(i, (u.getX(i) * (x1 - x0)) / 3, (u.getY(i) * (z1 - z0)) / 3)
      L.batch.put(g, mat, (x0 + x1) / 2, y, (z0 + z1) / 2, 0, 1, 1, 1, { cast: false })
    }
    pave(HAMLET.x0, HAMLET.x1, HAMLET.z0, HAMLET.z1, P.ground, 0.02)
    pave(-38, -17, 205, 229, P.cobble, 0.035)
    for (const [r, m] of [[9.2, P.stoneLight], [8.7, P.gold]] as const) L.batch.put(new THREE.RingGeometry(r - 0.13, r, 40).rotateX(-Math.PI / 2), m, HAMLET_WELL.x, 0.05, HAMLET_WELL.z, 0, 1, 1, 1, { cast: false })
    pave(-12, -5, 205, 212, P.cobble, 0.035) // the lane to the road
    // The Lantern Inn (enterable): a hanging sign, awning, tables out front, barrels
    {
      const { x, z, w, d } = HAMLET_INN
      shop(L, styles[1], { x, z, w, d, floors: 2, ry: 0, roof: 'pitched', name: 'LANTERN INN', sub: 'beds · broth · a warm fire', sign: 'ornate', crest: 'pumpkin', greenery: true, awning: awn, display: displayMaterial(L, '#ffb870', 'shelves'), balcony: true })
      for (let k = 0; k < 3; k++) {
        const tx = x - 3.2 + k * 3.2
        L.batch.put(new THREE.CylinderGeometry(0.44, 0.44, 0.06, 12), P.woodLight, tx, 0.78, z + d / 2 + 2.4)
        L.batch.put(new THREE.CylinderGeometry(0.05, 0.07, 0.78, 6), P.iron, tx, 0.39, z + d / 2 + 2.4)
        for (const dz of [0.75, -0.75]) L.batch.put(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 8), P.woodLight, tx, 0.45, z + d / 2 + 2.4 + dz)
        L.colliders.push({ kind: 'circle', x: tx, z: z + d / 2 + 2.4, r: 0.7, h: 1 })
      }
      for (const [bx, bz] of [[x + 5.2, z + d / 2 + 0.7], [x + 5.8, z + d / 2 + 1.3]] as const) {
        L.batch.put(new THREE.CylinderGeometry(0.34, 0.38, 0.8, 10), P.timber, bx, 0.4, bz)
        L.colliders.push({ kind: 'circle', x: bx, z: bz, r: 0.42, h: 0.9 })
      }
    }
    // five cottages — each its own shape, material, roof, shutters and garden
    const defs: CottageSpec[] = [
      { x: -46, z: 213, ry: -Math.PI / 2, w: 7.2, d: 6.4, floors: 1, style: 0, shutter: 'green', porch: true, door: 0.4 },
      { x: -41, z: 232, ry: Math.PI, w: 6.2, d: 6.0, floors: 2, style: 1, shutter: 'red', door: -0.5 },
      { x: -27, z: 232.4, ry: Math.PI, w: 8.0, d: 6.4, floors: 2, style: 2, shutter: 'blue', porch: true, door: 0.6 },
      { x: -14, z: 229.5, ry: Math.PI, w: 5.8, d: 5.6, floors: 1, style: 0, shutter: 'purple', door: -0.3 },
      { x: -11.6, z: 213, ry: Math.PI / 2, w: 6.6, d: 5.8, floors: 2, style: 1, shutter: 'green', door: 0.3 },
    ]
    defs.forEach((c) => cottage(L, styles[c.style], c, shutters))
    // the courtyard: a roofed well, a noticeboard, benches, flower tubs, lanterns
    {
      const { x, z } = HAMLET_WELL
      L.batch.put(new THREE.CylinderGeometry(1.15, 1.25, 0.95, 16), P.stone, x, 0.48, z)
      L.batch.put(new THREE.CylinderGeometry(0.95, 0.95, 0.06, 16), P.glowTeal, x, 0.93, z, 0, 1, 1, 1, { cast: false })
      for (const sx of [-1, 1]) L.batch.put(boxUV(0.16, 2.2, 0.16, 1), P.woodLight, x + sx * 1.0, 1.55, z)
      L.batch.put(boxUV(2.4, 0.12, 0.16, 1), P.woodLight, x, 2.62, z)
      L.batch.put(gableGeo(2.8, 2.0, 0.9, 1.2), P.roofRed, x, 2.68, z)
      L.colliders.push({ kind: 'circle', x, z, r: 1.45, h: 1 })
      const board = new THREE.MeshStandardMaterial({ map: boardTexture('HAMLET NOTICES', ['Inn: hot broth after dark', 'Lost: one lantern (gold)', 'The old watchtower is open —', 'mind the stair, climb for the view', 'Do not follow the lights in the', 'lake. (They follow you home.)'], 1.6, PANEL.dark, D), roughness: 0.7 })
      D.push(board)
      postedBoard(Frame.at(L.batch, HAMLET_BOARD.x, 0, HAMLET_BOARD.z, -Math.PI / 2 - 0.3), 1.9, 1.2, 1.4, board, SMt(P), true)
      L.colliders.push({ kind: 'circle', x: HAMLET_BOARD.x, z: HAMLET_BOARD.z, r: 0.9, h: 2 })
      for (const [bx, bz, ry] of [[x - 4.2, z, Math.PI / 2], [x + 4.2, z, -Math.PI / 2], [x, z + 4.4, Math.PI]] as const) parkBench(L, bx, bz, ry, 'Sit in the hamlet', seats)
      for (const [tx, tz] of [[-21, 207], [-33, 207], [-21, 227], [-33, 227]] as const) flowerTub(L, tx, tz, { long: 1.8 })
      for (const [lx, lz] of [[-35, 210], [-19, 210], [-35, 224], [-19, 224], [-27, 207]] as const) {
        L.batch.put(new THREE.CylinderGeometry(0.06, 0.09, 2.7, 6), P.iron, lx, 1.35, lz)
        L.batch.put(new THREE.BoxGeometry(0.22, 0.3, 0.22), P.glowOrange, lx, 2.85, lz, 0, 1, 1, 1, { cast: false })
        L.batch.put(new THREE.ConeGeometry(0.24, 0.2, 4).rotateY(Math.PI / 4), P.iron, lx, 3.08, lz)
        L.lights.push({ x: lx, y: 2.85, z: lz, color: '#ffb060', intensity: 3.6, dist: 10, priority: 1 })
        L.colliders.push({ kind: 'circle', x: lx, z: lz, r: 0.22, h: 3 })
      }
    }
    // the hidden garden behind the cottages: a walled plot with a gate, vines, a sundial and a bench (a discovery)
    {
      const gx = -38
      const gz = 245
      for (const [w, d, x, z] of [[9.2, 0.4, gx, gz - 3.4], [9.2, 0.4, gx, gz + 3.4], [0.4, 6.8, gx - 4.4, gz], [0.4, 6.8, gx + 4.4, gz]] as const) L.batch.put(boxUV(w, 1.8, d, 1.4), P.stone, x, 0.9, z)
      L.batch.put(boxUV(1.4, 0.2, 0.6, 1), P.stoneLight, gx, 1.85, gz - 3.4)
      L.batch.put(new THREE.CylinderGeometry(0.28, 0.4, 0.9, 8), P.stoneLight, gx, 0.45, gz)
      L.batch.put(new THREE.CylinderGeometry(0.46, 0.46, 0.06, 12), P.gold, gx, 0.93, gz)
      for (let k = 0; k < 8; k++) L.batch.put(new THREE.SphereGeometry(0.36, 8, 6).scale(1, 0.7, 1), P.pumpkin, gx - 2.8 + (k % 4) * 1.9, 0.3, gz + (k < 4 ? -1.6 : 1.7))
      L.colliders.push({ kind: 'box', minX: gx - 4.6, maxX: gx - 4.2, minZ: gz - 3.6, maxZ: gz + 3.6, h: 1.8 })
      L.colliders.push({ kind: 'box', minX: gx + 4.2, maxX: gx + 4.6, minZ: gz - 3.6, maxZ: gz + 3.6, h: 1.8 })
      L.colliders.push({ kind: 'box', minX: gx - 4.6, maxX: gx + 4.6, minZ: gz + 3.2, maxZ: gz + 3.6, h: 1.8 })
      L.colliders.push({ kind: 'box', minX: gx - 4.6, maxX: gx - 0.9, minZ: gz - 3.6, maxZ: gz - 3.2, h: 1.8 })
      L.colliders.push({ kind: 'box', minX: gx + 0.9, maxX: gx + 4.6, minZ: gz - 3.6, maxZ: gz - 3.2, h: 1.8 })
    }
    // autumn trees in groups round the terrace (mixed species; the open side faces the valley)
    for (const [tx, tz, s, k] of [[-50, 200, 1.1, 0], [-52, 224, 1.0, 1], [-8, 197, 0.95, 2], [-49, 238, 1.15, 0], [-5.5, 238, 1.0, 1], [-20, 240, 1.1, 2], [-31, 241, 0.9, 0]] as const) {
      L.batch.put(new THREE.CylinderGeometry(0.16 * s, 0.24 * s, 3.0 * s, 6), P.bark, tx, 1.5 * s, tz)
      if (k === 2) for (let j = 0; j < 4; j++) L.batch.put(new THREE.ConeGeometry((1.6 - j * 0.3) * s, 1.5 * s, 8), P.foliageDark, tx, (2.0 + j * 1.0) * s, tz)
      else for (const [r, y, dx, dz] of [[2.0, 3.4, 0, 0], [1.5, 4.4, 0.3, 0.1], [1.0, 5.1, 0, 0], [1.2, 3.7, 1.2, 0.4], [1.1, 3.9, -1.1, -0.5]] as const) L.batch.put(new THREE.SphereGeometry(r * s, 9, 6).scale(1, 0.55, 1), k === 0 ? P.foliageAutumn : P.foliage, tx + dx * s, y * s, tz + dz * s)
      L.colliders.push({ kind: 'circle', x: tx, z: tz, r: 0.4, h: 4 })
    }
    void R
  })
}

/** the woodland: trail surface, mixed trees in groves with openings, rocky banks, ground plants, fallen leaves, the shrine, the stream crossing */
export function woodland(T: Town, q: Quality) {
  const P = T.P
  const D = T.disposables
  const R = rng(2718)
  const gravel = new THREE.MeshStandardMaterial({ map: P.ground.map, color: '#d6c29a', roughness: 0.96 })
  D.push(gravel)
  pathRibbon(T, WOOD_TRAIL, gravel, WOOD_TRAIL.width)
  pathRibbon(T, TOWER_TRAIL, gravel, TOWER_TRAIL.width)
  // trees: layered crowns (tiers) in three silhouettes + gold/red autumn tints, clustered round the trail with gaps for views
  const trunk = new THREE.CylinderGeometry(0.15, 0.26, 3.4, 6)
  trunk.translate(0, 1.7, 0)
  const tiers = (r: number[], y: number[], flat = 0.55) => {
    const parts = r.map((rr, i) => new THREE.SphereGeometry(rr, 9, 6).scale(1, flat, 1).translate((i % 2 ? 0.5 : -0.4) * rr * 0.5, y[i], (i % 3 ? 0.3 : -0.3) * rr * 0.4))
    const g = new THREE.BufferGeometry()
    let pos: number[] = []
    for (const p of parts) pos = pos.concat(Array.from((p.toNonIndexed().attributes.position as THREE.BufferAttribute).array))
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.computeVertexNormals()
    parts.forEach((p) => p.dispose())
    return g
  }
  const crowns = [tiers([2.1, 1.6, 1.1, 1.2, 1.0], [3.9, 4.8, 5.5, 4.2, 4.4]), tiers([1.0, 0.95, 0.9, 0.8, 0.7, 0.6], [2.8, 3.7, 4.6, 5.5, 6.3, 7.0], 0.8), tiers([2.4, 1.4, 1.8, 1.0], [3.4, 4.4, 3.8, 5.0], 0.45)]
  const leafMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92, flatShading: true })
  D.push(leafMat, trunk, ...crowns)
  const groups: THREE.Matrix4[][] = [[], [], []]
  const cols: THREE.Color[][] = [[], [], []]
  const tints = ['#b8561c', '#c8781c', '#d89a2a', '#8a5a1c', '#6f8a3a', '#a8321f', '#9a6a22']
  const nT = q === 'low' ? 70 : q === 'medium' ? 130 : 200
  const nearSomething = (x: number, z: number) => DESCENT.nearest(x, z).d < DESCENT_CLEAR || WOOD_TRAIL.nearest(x, z).d < 3.6 || TOWER_TRAIL.nearest(x, z).d < 3.6
  const DESCENT_CLEAR = 6.5
  for (let i = 0; i < nT * 14 && groups.reduce((a, g) => a + g.length, 0) < nT; i++) {
    const x = -90 + R() * 130
    const z = 150 + R() * 140
    if (nearSomething(x, z)) continue
    if (x > -55 && x < -3 && z > 193 && z < 238) continue // the hamlet terrace
    if (x > -60 && x < -34 && z > 240 && z < 252) continue
    // leave openings so the skyline shows: a few view corridors toward the city
    if (Math.abs(x - (20 + (z - 200) * 0.9)) < 5 && z > 160) continue
    const y = terrainHeight(x, z)
    const nn = DESCENT.nearest(x, z)
    if (Math.abs(y - nn.y) > 22) continue
    const kind = Math.floor(R() * 3)
    const s = 0.75 + R() * 0.95
    groups[kind].push(new THREE.Matrix4().compose(new THREE.Vector3(x, y - 0.15, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, R() * 6, 0)), new THREE.Vector3(s, s * (0.9 + R() * 0.5), s)))
    cols[kind].push(new THREE.Color(kind === 1 ? '#2f5c3a' : tints[Math.floor(R() * tints.length)]))
  }
  const allTrunks: THREE.Matrix4[] = []
  crowns.forEach((geo, k) => {
    if (!groups[k].length) return
    const im = new THREE.InstancedMesh(geo, leafMat, groups[k].length)
    groups[k].forEach((m, i) => {
      im.setMatrixAt(i, m)
      im.setColorAt(i, cols[k][i])
      allTrunks.push(m)
    })
    im.castShadow = false
    im.computeBoundingSphere()
    T.scene.add(im)
  })
  if (allTrunks.length) {
    const im = new THREE.InstancedMesh(trunk, P.bark, allTrunks.length)
    allTrunks.forEach((m, i) => im.setMatrixAt(i, m))
    im.computeBoundingSphere()
    T.scene.add(im)
  }
  // rocky banks beside the road + shrubs and ground plants + fallen leaves
  const rock = new THREE.DodecahedronGeometry(1, 0)
  const shrub = new THREE.IcosahedronGeometry(0.7, 0).scale(1.3, 0.8, 1.1)
  const leaf = new THREE.PlaneGeometry(0.34, 0.24).rotateX(-Math.PI / 2)
  const leafCard = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, side: THREE.DoubleSide })
  D.push(rock, shrub, leaf, leafCard)
  const rocks: THREE.Matrix4[] = []
  const shrubs: THREE.Matrix4[] = []
  const shrubC: THREE.Color[] = []
  const leaves: THREE.Matrix4[] = []
  const leafC: THREE.Color[] = []
  const nR = q === 'low' ? 50 : 110
  const nL = q === 'low' ? 260 : q === 'medium' ? 520 : 900
  const mt = (x: number, y: number, z: number, ry: number, sx: number, sy = sx, sz = sx) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz))
  for (let i = 0; i < 4000 && (rocks.length < nR || leaves.length < nL); i++) {
    const s = R() * DESCENT.len
    if (s < 60 || s > 560) continue
    const p = DESCENT.pointAt(s)
    const side = R() < 0.5 ? -1 : 1
    const off = (4.8 + R() * 14) * side
    const x = p.x - p.tz * off
    const z = p.z + p.tx * off
    if (lakeRho(x, z) < 1.3) continue
    if (x > -55 && x < -3 && z > 193 && z < 238) continue
    const y = terrainHeight(x, z)
    const r = R()
    if (r < 0.2 && rocks.length < nR) rocks.push(mt(x, y + 0.2, z, R() * 6, 0.6 + R() * 1.7, 0.5 + R() * 0.9, 0.6 + R() * 1.3))
    else if (r < 0.35) {
      shrubs.push(mt(x, y + 0.25, z, R() * 6, 0.8 + R() * 0.9))
      shrubC.push(new THREE.Color(['#4a6b38', '#5f7a3a', '#8a6a2a', '#b8561c'][Math.floor(R() * 4)]))
    } else if (leaves.length < nL) {
      for (let k = 0; k < 5; k++) {
        leaves.push(mt(x + (R() - 0.5) * 1.6, y + 0.03, z + (R() - 0.5) * 1.6, R() * 6, 0.8 + R() * 0.6))
        leafC.push(new THREE.Color(tints[Math.floor(R() * tints.length)]))
      }
    }
  }
  for (const [geo, mat, list, colors] of [[rock, P.rock, rocks, null], [shrub, leafMat, shrubs, shrubC], [leaf, leafCard, leaves, leafC]] as const) {
    if (!list.length) continue
    const im = new THREE.InstancedMesh(geo, mat, list.length)
    list.forEach((m, i) => {
      im.setMatrixAt(i, m)
      if (colors) im.setColorAt(i, colors[i])
    })
    im.castShadow = false
    im.computeBoundingSphere()
    T.scene.add(im)
  }
  // the old shrine beside the trail, and the plank bridge over the stream
  inFrame(T, { x: 0, y: 0, z: 0 }, false, (L) => {
    const sy = terrainHeight(-69, 207)
    L.batch.put(boxUV(1.6, 0.4, 1.6, 1), P.stone, -69, sy + 0.2, 207)
    L.batch.put(boxUV(1.0, 1.1, 1.0, 1), P.stone, -69, sy + 0.95, 207)
    L.batch.put(new THREE.ConeGeometry(0.85, 0.7, 4).rotateY(Math.PI / 4), P.stoneLight, -69, sy + 1.85, 207)
    L.batch.put(new THREE.SphereGeometry(0.2, 8, 6).scale(1, 0.8, 1), P.pumpkin, -69, sy + 1.62, 207.55)
    for (const dx of [-0.5, 0.5]) {
      L.batch.put(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 6), P.timber, -69 + dx, sy + 0.5, 208.0)
      L.batch.put(new THREE.SphereGeometry(0.04, 6, 4), P.glowOrange, -69 + dx, sy + 0.62, 208.0)
    }
    L.lights.push({ x: -69, y: sy + 1.0, z: 208, color: '#ffa860', intensity: 3, dist: 6, priority: 2 })
    L.colliders.push({ kind: 'circle', x: -69, z: 207, r: 0.85, h: 1.5 })
    // the stream: a shallow channel in the trail's path, a plank bridge, a lantern under it
    const by = terrainHeight(-71, 221)
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.14, 2.0), new THREE.MeshStandardMaterial({ color: '#7a5a3a', roughness: 0.9 }))
    bridge.position.set(-71, by + 0.22, 221)
    bridge.rotation.y = 0.5
    L.scene.add(bridge)
    D.push(bridge.geometry, bridge.material as THREE.Material)
    for (const sx of [-1, 1]) L.batch.put(boxUV(3.4, 0.5, 0.1, 1), P.timber, -71 + Math.cos(0.5) * 0, by + 0.5, 221 + sx * 1.0, 0.5)
  })
}

/** the old watchtower: a round stone landmark on its knoll, battered base, string courses, arrow slits, an arched door with steps, a lit beacon on the crenellated top */
export function watchtower(T: Town) {
  inFrame(T, { x: 0, y: TOWER.y, z: 0 }, true, (L) => {
    const P = L.P
    const { x, z, r, h } = WATCHTOWER
    L.batch.put(new THREE.CylinderGeometry(r + 0.7, r + 1.5, 1.6, 20), P.stone, x, 0.8, z)
    L.batch.put(new THREE.CylinderGeometry(r, r + 0.35, h, 20), P.stone, x, h / 2 + 1.0, z)
    for (const y of [4.6, 9.0, 13.2]) L.batch.put(new THREE.CylinderGeometry(r + 0.18, r + 0.18, 0.28, 20), P.stoneLight, x, y, z)
    // machicolation: a flared stone collar carrying the parapet
    L.batch.put(new THREE.CylinderGeometry(r + 0.9, r + 0.1, 1.1, 20), P.stoneLight, x, h + 1.0, z)
    L.batch.put(new THREE.CylinderGeometry(r + 0.85, r + 0.85, 1.2, 20, 1, true), P.stone, x, h + 2.1, z)
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2
      L.batch.put(boxUV(0.95, 0.9, 0.55, 1), P.stone, x + Math.cos(a) * (r + 0.85), h + 3.1, z + Math.sin(a) * (r + 0.85), -a + Math.PI / 2)
    }
    L.batch.put(new THREE.CylinderGeometry(0.55, 0.7, 0.5, 8), P.iron, x, h + 2.0, z)
    L.batch.put(new THREE.ConeGeometry(0.5, 0.9, 7), P.glowOrange, x, h + 2.7, z, 0, 1, 1, 1, { cast: false })
    L.lights.push({ x, y: h + 3, z, color: '#ffa04a', intensity: 7, dist: 18, priority: 3 })
    // arrow slits up the shaft; a stone arch door with steps on the south face
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 2 + (k - 1.5) * 0.9
      for (const y of [6.4, 10.8]) L.batch.put(new THREE.BoxGeometry(0.16, 1.0, 0.4), P.iron, x + Math.cos(a) * (r + 0.02), y, z + Math.sin(a) * (r + 0.02), -a + Math.PI / 2)
    }
    const F = Frame.at(L.batch, x, 0, z + r, 0)
    for (const sx of [-1, 1]) F.put(boxUV(0.45, 2.7, 0.7, 1), P.stoneLight, sx * 0.95, 1.35 + 1.0, 0.05)
    F.put(new THREE.TorusGeometry(0.95, 0.22, 6, 14, Math.PI), P.stoneLight, 0, 2.7 + 1.0, 0.1)
    F.put(new THREE.PlaneGeometry(1.6, 2.7), L.P.windowLit, 0, 1.35 + 1.0, 0.05, 0, 0, 0, false)
    for (let k = 0; k < 3; k++) F.put(boxUV(3.2 - k * 0.3, 0.2, 1.0, 1), P.stoneLight, 0, 0.1 + k * 0.2, 1.0 + (2 - k) * 0.5)
    L.colliders.push({ kind: 'circle', x, z, r: r + 0.4, h })
    // the viewpoint terrace at the base: a curved balustrade on the valley side, a bench, a telescope
    for (let k = 0; k <= 12; k++) {
      const a = Math.PI * (0.05 + (k / 12) * 0.9) // the east/south arc faces the view
      const bx = x + Math.cos(a) * 6.6
      const bz = z + Math.sin(a) * 6.6
      L.batch.put(boxUV(0.6, 1.1, 0.6, 1.4), P.stone, bx, 0.55, bz, -a)
      L.batch.put(new THREE.SphereGeometry(0.16, 8, 6), P.gold, bx, 1.2, bz)
      L.colliders.push({ kind: 'circle', x: bx, z: bz, r: 0.35, h: 1.1 })
      if (k < 12) {
        const a2 = Math.PI * (0.05 + ((k + 0.5) / 12) * 0.9)
        L.batch.put(boxUV(0.2, 0.7, 1.15, 1), P.iron, x + Math.cos(a2) * 6.6, 0.55, z + Math.sin(a2) * 6.6, -a2 + Math.PI / 2)
        L.batch.put(boxUV(0.34, 0.1, 1.2, 1), P.stoneLight, x + Math.cos(a2) * 6.6, 1.05, z + Math.sin(a2) * 6.6, -a2 + Math.PI / 2)
      }
    }
    L.batch.put(new THREE.CylinderGeometry(0.18, 0.26, 1.1, 10), P.stone, x + 5.0, 0.55, z + 3.4)
    L.batch.put(new THREE.CylinderGeometry(0.07, 0.07, 0.95, 8).rotateX(Math.PI / 2.6), P.gold, x + 5.2, 1.3, z + 3.7)
    L.colliders.push({ kind: 'circle', x: x + 5.0, z: z + 3.4, r: 0.45, h: 1.3 })
    for (const [bx, bz, ry] of [[x + 3.8, z + 5.3, Math.PI * 0.8], [x - 3.0, z + 5.6, Math.PI]] as const) {
      L.batch.put(boxUV(1.6, 0.08, 0.5, 1), P.woodLight, bx, 0.5, bz, ry)
      L.batch.put(boxUV(1.6, 0.4, 0.06, 1), P.woodLight, bx - Math.sin(ry) * 0.24, 0.8, bz - Math.cos(ry) * 0.24, ry)
      L.colliders.push({ kind: 'circle', x: bx, z: bz, r: 0.75, h: 0.8 })
    }
    const sign = new THREE.MeshStandardMaterial({ map: panelTexture('THE OLD WATCHTOWER', 'open · climb for the view', 2.6, PANEL.dark, L.disposables), roughness: 0.6 })
    L.disposables.push(sign)
    postedBoard(Frame.at(L.batch, x - 5.2, 0, z + 4.4, Math.PI * 0.9), 1.8, 0.8, 1.2, sign, SMt(P), true)
    L.colliders.push({ kind: 'circle', x: x - 5.2, z: z + 4.4, r: 0.7, h: 1.8 })
  })
}
void climbers
