import * as THREE from 'three'
import type { Town } from './buildings'
import { GARDEN, OVERLOOK, SOCIAL } from './city'
import { boxUV, rng } from './kit'
import { Frame, PANEL, boardTexture, lectern, panelTexture, postedBoard, type SignMats } from './signs'
import { stallV4 } from './market'

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

export type Greenery = { trees: [number, number][]; bushes: [number, number][]; hedges: [number, number, number, 'x' | 'z'][]; potted?: [number, number, number, number][] }
/** sittable benches added by the districts (seat anchors for the sit system: ry = the way a sitter faces) */
export type BenchSpot = { x: number; z: number; ry: number; label: string }

/** a park bench (timber slats on cast-iron ends), its collider, and its seat anchor */
export function parkBench(T: Town, x: number, z: number, ry: number, label: string, seats?: BenchSpot[]) {
  const P = T.P
  const F = Frame.at(T.batch, x, 0, z, ry)
  for (let k = 0; k < 3; k++) F.box(1.8, 0.05, 0.13, P.woodLight, 0, 0.46, -0.16 + k * 0.16)
  for (let k = 0; k < 2; k++) F.box(1.8, 0.11, 0.04, P.woodLight, 0, 0.66 + k * 0.17, -0.27)
  for (const dx of [-0.78, 0.78]) {
    F.box(0.07, 0.46, 0.5, P.iron, dx, 0.23, -0.02)
    F.box(0.07, 0.5, 0.06, P.iron, dx, 0.72, -0.28)
    F.box(0.07, 0.05, 0.42, P.iron, dx, 0.66, 0.0)
  }
  T.colliders.push({ kind: 'circle', x, z, r: 0.75, h: 0.9 })
  seats?.push({ x, z, ry, label })
}

/** crossed flower cards scattered over a bed (alpha-tested, batched) */
function flowerBed(T: Town, x0: number, x1: number, z0: number, z1: number, n: number, seed: number) {
  const P = T.P
  const r = rng(seed)
  const q = new THREE.PlaneGeometry(0.42, 0.42).translate(0, 0.21, 0)
  for (let k = 0; k < n; k++) {
    const fx = x0 + r() * (x1 - x0)
    const fz = z0 + r() * (z1 - z0)
    const s = 0.8 + r() * 0.5
    T.batch.put(q, P.flowers, fx, 0.04, fz, r() * 3, s, s, s, { cast: false })
    T.batch.put(q.clone().rotateY(Math.PI / 2), P.flowers, fx, 0.04, fz, r() * 3, s, s, s, { cast: false })
  }
}

function pave(T: Town, x0: number, x1: number, z0: number, z1: number, mat: THREE.Material, y = 0.024) {
  const w = x1 - x0
  const d = z1 - z0
  const g = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2)
  const u = g.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < u.count; i++) u.setXY(i, (u.getX(i) * w) / 3, (u.getY(i) * d) / 3)
  T.batch.put(g, mat, (x0 + x1) / 2, y, (z0 + z1) / 2, 0, 1, 1, 1, { cast: false })
}

export function westside(T: Town, stone: THREE.Material, trim: THREE.Material, stripe: THREE.Material, seats: BenchSpot[]) {
  const P = T.P
  const Dp = T.disposables
  const SM: SignMats = { frame: P.iron, metal: P.iron, gold: P.gold, stone: trim }
  const green: Greenery = { trees: [], bushes: [], hedges: [] }
  const gravel = new THREE.MeshStandardMaterial({ color: '#d9c9a6', roughness: 0.95, map: P.cobble.map })
  Dp.push(gravel)

  /* ═════════ the road west: Market Row continues past the wishing well to the social corner ═════════ */
  pave(T, -48, -32.6, 0.2, 4.8, P.cobble)

  /* ═════════ SOCIAL CORNER: pergola with string lights, picnic tables, the shake stall ═════════ */
  {
    const { x: sx, z: sz } = SOCIAL
    pave(T, sx - 7.5, sx + 4.5, sz - 7.8, sz - 2.4, P.cobble)
    stallV4(T, sx - 0.5, sz - 6.0, 's', stripe, 'shakes')
    // pergola: six timber posts, beams, rafters, string lights draped between the beams
    const px0 = sx - 7
    const px1 = sx + 0.5
    const pz0 = sz + 2.6
    const pz1 = sz + 8.6
    const posts: [number, number][] = []
    for (const x of [px0, (px0 + px1) / 2, px1]) for (const z of [pz0, pz1]) posts.push([x, z])
    for (const [x, z] of posts) {
      T.batch.put(boxUV(0.18, 2.8, 0.18, 1), P.timber, x, 1.4, z)
      T.batch.put(boxUV(0.4, 0.2, 0.4, 1), trim, x, 0.1, z)
      T.colliders.push({ kind: 'circle', x, z, r: 0.22, h: 2.8 })
    }
    for (const z of [pz0, pz1]) T.batch.put(boxUV(px1 - px0 + 0.6, 0.22, 0.14, 1), P.timber, (px0 + px1) / 2, 2.85, z)
    for (let x = px0; x <= px1 + 0.01; x += 0.75) T.batch.put(boxUV(0.08, 0.16, pz1 - pz0 + 0.6, 1), P.timber, x, 3.02, (pz0 + pz1) / 2)
    const bulbs: THREE.Vector3[] = []
    for (let k = 0; k < 4; k++) {
      const z = pz0 + ((pz1 - pz0) * (k + 0.5)) / 4
      const curve = new THREE.CatmullRomCurve3([V(px0, 2.9, z), V((px0 + px1) / 2, 2.55, z), V(px1, 2.9, z)])
      T.batch.put(new THREE.TubeGeometry(curve, 16, 0.008, 3, false), P.iron, 0, 0, 0, 0, 1, 1, 1, { cast: false })
      for (let i = 1; i < 12; i++) bulbs.push(curve.getPoint(i / 12).add(V(0, -0.05, 0)))
    }
    const bulbGeo = new THREE.SphereGeometry(0.045, 6, 4)
    for (const b of bulbs) T.batch.put(bulbGeo, P.glowGold, b.x, b.y, b.z, 0, 1, 1, 1, { cast: false })
    pave(T, px0 - 0.6, px1 + 0.6, pz0 - 0.6, pz1 + 0.6, P.stoneLight)
    // picnic tables (top + benches on A-frame legs)
    for (const [tx, tz] of [[px0 + 1.8, (pz0 + pz1) / 2], [px1 - 1.8, (pz0 + pz1) / 2]] as const) {
      const F = Frame.at(T.batch, tx, 0, tz, Math.PI / 2)
      F.box(1.9, 0.06, 0.8, P.woodLight, 0, 0.76, 0)
      for (const dz of [-0.62, 0.62]) F.box(1.9, 0.05, 0.3, P.woodLight, 0, 0.45, dz)
      for (const dx of [-0.75, 0.75]) {
        F.put(new THREE.BoxGeometry(0.07, 0.95, 0.07).rotateX(0.55), P.timber, dx, 0.38, 0.22)
        F.put(new THREE.BoxGeometry(0.07, 0.95, 0.07).rotateX(-0.55), P.timber, dx, 0.38, -0.22)
        F.box(0.07, 0.06, 1.55, P.timber, dx, 0.42, 0)
      }
      // a couple of shake cups on the table
      F.put(new THREE.CylinderGeometry(0.05, 0.04, 0.14, 8), P.glowOrange, -0.3, 0.86, 0.1, 0, 0, 0, false)
      F.put(new THREE.CylinderGeometry(0.05, 0.04, 0.14, 8), P.plaster, 0.4, 0.86, -0.15, 0, 0, 0, false)
      T.colliders.push({ kind: 'box', minX: tx - 0.95, maxX: tx + 0.95, minZ: tz - 0.95, maxZ: tz + 0.95, h: 0.8 })
    }
    const corner = new THREE.MeshStandardMaterial({ map: panelTexture('SOCIAL CORNER', 'sit · sip · talk gains', 3, PANEL.green, Dp), roughness: 0.7 })
    Dp.push(corner)
    postedBoard(Frame.at(T.batch, px1 + 1.6, 0, pz0 + 0.6, 2.6), 2.2, 0.72, 1.7, corner, SM, true)
    T.colliders.push({ kind: 'circle', x: px1 + 1.6, z: pz0 + 0.6, r: 1.15, h: 2.4 })
    green.bushes.push([px0 - 1.4, pz0 + 1.5], [px0 - 1.4, pz1 - 1.5], [sx + 4.2, sz - 8.6])
  }

  /* ═════════ THE GARDEN: hedged parterre, a gazebo, a reflecting pool, flowerbeds, benches ═════════ */
  {
    const { x: gx, z: gz } = GARDEN
    const X0 = -55
    const X1 = -33
    const Z0 = 13
    const Z1 = 33
    // gravel paths: the cross axes + the outer loop
    pave(T, X0, X1, gz - 1.1, gz + 1.1, gravel, 0.022)
    pave(T, gx - 1.1, gx + 1.1, Z0 - 6.6, Z1, gravel, 0.022)
    pave(T, X0, X1, Z0, Z0 + 1.6, gravel, 0.021)
    pave(T, X0, X1, Z1 - 1.6, Z1, gravel, 0.021)
    pave(T, X0, X0 + 1.6, Z0, Z1, gravel, 0.021)
    pave(T, X1 - 1.6, X1, Z0, Z1, gravel, 0.021)
    // four planted beds edged with clipped hedges (openings on the axes)
    for (const [bx0, bx1, bz0, bz1, seed] of [
      [X0 + 2.2, gx - 1.8, Z0 + 2.2, gz - 1.8, 1],
      [gx + 1.8, X1 - 2.2, Z0 + 2.2, gz - 1.8, 2],
      [X0 + 2.2, gx - 1.8, gz + 1.8, Z1 - 2.2, 3],
      [gx + 1.8, X1 - 2.2, gz + 1.8, Z1 - 2.2, 4],
    ] as const) {
      T.batch.put(new THREE.PlaneGeometry(bx1 - bx0, bz1 - bz0).rotateX(-Math.PI / 2), P.soil, (bx0 + bx1) / 2, 0.018, (bz0 + bz1) / 2, 0, 1, 1, 1, { cast: false })
      flowerBed(T, bx0 + 0.6, bx1 - 0.6, bz0 + 0.6, bz1 - 0.6, 60, 900 + seed)
      // hedges on the outer two sides of each bed, low box hedging on the inner sides
      const outerX = seed % 2 ? bx0 : bx1
      const outerZ = seed < 3 ? bz0 : bz1
      green.hedges.push([outerX, (bz0 + bz1) / 2, bz1 - bz0, 'z'], [(bx0 + bx1) / 2, outerZ, bx1 - bx0, 'x'])
      T.colliders.push({ kind: 'box', minX: bx0 - 0.3, maxX: bx1 + 0.3, minZ: bz0 - 0.3, maxZ: bz1 + 0.3, h: 0.8 })
      green.trees.push([seed % 2 ? bx0 + 1.2 : bx1 - 1.2, seed < 3 ? bz0 + 1.2 : bz1 - 1.2])
    }
    // the gazebo: octagonal stone base, eight columns, a ring beam and a domed lead roof with a gold finial
    {
      const R = 2.9
      T.batch.put(new THREE.CylinderGeometry(R + 0.4, R + 0.55, 0.36, 8), trim, gx, 0.18, gz)
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + Math.PI / 8
        const cx = gx + Math.cos(a) * R
        const cz = gz + Math.sin(a) * R
        // leave the four axis openings clear; columns stand on the diagonals + beside each opening
        T.batch.put(new THREE.CylinderGeometry(0.16, 0.19, 2.9, 12), P.stoneLight, cx, 0.36 + 1.45, cz)
        T.batch.put(boxUV(0.44, 0.16, 0.44, 1), trim, cx, 0.44, cz)
        T.batch.put(boxUV(0.46, 0.2, 0.46, 1), trim, cx, 3.3, cz)
        T.colliders.push({ kind: 'circle', x: cx, z: cz, r: 0.25, h: 3.3 })
      }
      T.batch.put(new THREE.TorusGeometry(R, 0.18, 6, 32).rotateX(Math.PI / 2), trim, gx, 3.48, gz)
      T.batch.put(new THREE.SphereGeometry(R + 0.35, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.62, 1), P.roofSlate, gx, 3.55, gz)
      T.batch.put(new THREE.CylinderGeometry(0.06, 0.12, 0.9, 8), P.gold, gx, 3.55 + (R + 0.35) * 0.62 + 0.35, gz)
      T.batch.put(new THREE.SphereGeometry(0.16, 12, 8), P.gold, gx, 3.55 + (R + 0.35) * 0.62 + 0.85, gz)
      // a ring of benches inside, facing out over the beds
      for (const a of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
        const bx = gx + Math.cos(a) * 1.7
        const bz = gz + Math.sin(a) * 1.7
        T.batch.put(boxUV(1.3, 0.08, 0.42, 1), P.woodLight, bx, 0.82, bz, -a + Math.PI / 2)
        T.batch.put(boxUV(1.2, 0.46, 0.36, 1), trim, bx, 0.6, bz, -a + Math.PI / 2)
      }
    }
    // a narrow reflecting rill on the north axis, between the gazebo and the outer loop (with a stone kerb)
    {
      const za = Z0 + 2.4
      const zb = gz - 3.9
      const pz = (za + zb) / 2
      const len = zb - za
      T.batch.put(boxUV(2.0, 0.34, len, 1), trim, gx, 0.17, pz)
      const w = new THREE.MeshStandardMaterial({ color: '#4f9fb8', roughness: 0.05, metalness: 0.3, envMapIntensity: 1.4 })
      Dp.push(w)
      T.batch.put(new THREE.PlaneGeometry(1.6, len - 0.4).rotateX(-Math.PI / 2), w, gx, 0.31, pz, 0, 1, 1, 1, { cast: false })
      T.batch.put(new THREE.SphereGeometry(0.22, 12, 8), P.gold, gx, 0.42, za + 0.5)
      T.colliders.push({ kind: 'box', minX: gx - 1.0, maxX: gx + 1.0, minZ: za, maxZ: zb, h: 0.4 })
    }
    // benches on the outer loop, facing the gazebo (two of them can be sat on)
    parkBench(T, gx, Z1 - 2.9, Math.PI, 'Sit in the garden', seats)
    parkBench(T, X1 - 2.9, gz, -Math.PI / 2, 'Sit in the garden', seats)
    parkBench(T, X0 + 2.9, gz + 0.0, Math.PI / 2, 'Sit in the garden', [])
    // garden name + a plaque on the gazebo step
    const gname = new THREE.MeshStandardMaterial({ map: panelTexture('THE PUMPKIN GARDEN', 'paths · flowers · a quiet bench', 3.2, PANEL.green, Dp), roughness: 0.7 })
    Dp.push(gname)
    postedBoard(Frame.at(T.batch, X1 + 0.8, 0, gz + 3.2, Math.PI / 2), 2.6, 0.8, 1.6, gname, SM, true)
    T.colliders.push({ kind: 'circle', x: X1 + 0.8, z: gz + 3.2, r: 1.4, h: 2.4 })
    green.trees.push([X0 - 1.2, Z0 - 1.2], [-56.6, 31.0], [-56, 4], [-52, -4], [-34.5, 31.5])
  }

  /* ═════════ the OVERLOOK: a terrace over the cliff — the valley, the gateway, the citadel ═════════ */
  {
    const { x: ox, z: oz } = OVERLOOK
    pave(T, -59.5, -46.5, 33.5, 41.5, P.stoneLight, 0.03)
    pave(T, -52, -48, 31.4, 34, gravel, 0.022) // path down from the garden's south loop
    // compass rose inlay
    T.batch.put(new THREE.RingGeometry(1.2, 1.35, 40).rotateX(-Math.PI / 2), P.gold, ox, 0.04, oz, 0, 1, 1, 1, { cast: false })
    for (let k = 0; k < 4; k++) T.batch.put(new THREE.ConeGeometry(0.22, 1.0, 3).rotateX(-Math.PI / 2).rotateY((k * Math.PI) / 2), P.gold, ox, 0.045, oz, 0, 1, 0.02, 1, { cast: false })
    // coin-op viewer on a pedestal, aimed at the gateway
    const vx = -55.5
    const vz = 39.8
    T.batch.put(new THREE.CylinderGeometry(0.16, 0.24, 1.1, 10), P.iron, vx, 0.55, vz)
    const head = Frame.at(T.batch, vx, 1.25, vz, Math.atan2(0 - vx, 51 - vz))
    head.box(0.34, 0.26, 0.42, P.iron, 0, 0, 0)
    for (const dx of [-0.08, 0.08]) head.put(new THREE.CylinderGeometry(0.06, 0.07, 0.22, 10).rotateX(Math.PI / 2), P.gold, dx, 0.02, 0.28)
    T.colliders.push({ kind: 'circle', x: vx, z: vz, r: 0.35, h: 1.4 })
    // two benches facing the view (south-east)
    parkBench(T, -50.2, 40.2, Math.PI * 0.25, 'Sit and take in the view', seats)
    parkBench(T, -56.6, 35.2, Math.PI * 0.4, 'Sit and take in the view', [])
    // the lore plaque
    const pl = new THREE.MeshStandardMaterial({ map: boardTexture('CHAD VIEW', ['The gateway, the canal and the', 'citadel, all from one terrace.', 'Downtown lies down the valley.'], 1.6, { bg: '#7a5a2a', ink: '#ffe9b8', sub: '#f6e2b4', rule: '#e0b860' }, Dp, true), metalness: 0.7, roughness: 0.4 })
    Dp.push(pl)
    lectern(Frame.at(T.batch, -48.6, 0, 34.4, Math.PI * 0.75), 0.62, 0.4, pl, SM)
    T.colliders.push({ kind: 'circle', x: -48.6, z: 34.4, r: 0.45, h: 1.1 })
  }
  void stone
  return green
}
