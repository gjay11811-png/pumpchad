import * as THREE from 'three'
import type { Town } from './buildings'
import { boxUV } from './kit'
import { Frame, PANEL, channelLetters, panelTexture, postedBoard } from './signs'
import { archMats } from './architecture'
import { ornateSign } from './ornament'
import { CARS, heroCarAt } from './vehicles'

/**
 * CHAD MOTORS SERVICE — the workshop, laid out like a real garage (enterable by the RECEPTION door — see interiors/garage.ts).
 *
 *   • the building: a concrete-block shed with a brick base, two roller-door bays on the road side (shutters part-raised, the lit bays
 *     visible), a separate RECEPTION entrance with a glass door, shop window and awning, a flat roof with skylights and a flue;
 *   • a covered service bay on the road side: a steel portal canopy with a two-post vehicle lift, the car raised on its four lift points;
 *   • a paved working yard, linked to the end of Motor Row by a driveway, with painted bays, a tyre rack, stacked tyres, drums,
 *     a workbench with a vice, a roll-away tool chest, an air compressor, cones and bollards;
 *   • CHAD MOTORS SERVICE branding on a parapet band, a blade sign, a gilded plaque;
 *   • a screen of shrubs between the yard and the lake so the waterfront composition keeps its edge.
 *
 * It stays on its original plot (77, 49): the plot is on Motor Row's road, the lake lies beyond it, and nothing else (markers, saves,
 * interactions) referred to it.
 */
export const WORKSHOP = { x: 77, z: 49, w: 13, d: 9 }
export const WORKSHOP_SHRUBS: [number, number, number, number][] = []

export function workshop(T: Town, stoneTex: THREE.Texture) {
  const P = T.P
  const D = T.disposables
  const std = (p: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.8, ...p })
    D.push(m)
    return m
  }
  const glass = std({ color: '#3a5068', roughness: 0.08, metalness: 0.65, emissive: '#0c1422' })
  const brick = archMats(T, 'brick', stoneTex, glass)
  const block = std({ color: '#8d8e96', roughness: 0.9, emissive: '#15161a' })
  const steel = std({ color: '#2c2e38', metalness: 0.55, roughness: 0.45, emissive: '#0c0d10' })
  const yellow = std({ color: '#e8b82a', roughness: 0.55 })
  const red = std({ color: '#a02a22', roughness: 0.45, metalness: 0.3 })
  const rubber = std({ color: '#161618', roughness: 0.92 })
  const chrome = std({ color: '#cfd0d6', metalness: 1, roughness: 0.25 })
  const concrete = std({ color: '#6a6b72', roughness: 0.95 })
  const asphalt = std({ color: '#2a2a30', roughness: 0.96 })
  const warm = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd09a').multiplyScalar(1.25), toneMapped: false })
  const orange = std({ color: '#ff8a2a', metalness: 0.3, roughness: 0.45, emissive: '#ff8a2a', emissiveIntensity: 1.6 })
  D.push(warm)
  const bay = std({ color: '#ffffff', roughness: 0.8 }) // placeholder, replaced by the lit-bay painting below
  void bay

  const W = WORKSHOP
  const H = 5.2
  const F = Frame.at(T.batch, W.x, 0, W.z, Math.PI) // local +z faces north (onto Motor Row); local +x runs west
  const fz = W.d / 2

  // ── the shed ──
  F.put(boxUV(W.w, H, W.d, 3), block, 0, H / 2, 0)
  F.put(boxUV(W.w + 0.14, 1.1, W.d + 0.14, 1.4), brick.wall, 0, 0.55, 0)
  F.put(boxUV(W.w + 0.4, 0.34, W.d + 0.4, 1.2), brick.trim, 0, H + 0.1, 0)
  F.put(boxUV(W.w + 0.3, 0.7, 0.3, 1), steel, 0, H + 0.6, fz - 0.1)
  for (const sx of [-3.8, 0.4]) F.put(boxUV(2.2, 0.35, 1.5, 1), brick.glass, sx, H + 0.45, -0.8) // skylights
  F.put(new THREE.CylinderGeometry(0.22, 0.26, 2.0, 10), steel, -5.2, H + 1.2, -2.5)
  F.box(2.2, 0.9, 1.3, steel, 3.4, H + 0.8, -1.4) // roof unit

  // ── two roller-door bays (lit, shutters half-raised), with painted door numbers ──
  const bayLit = new THREE.MeshBasicMaterial({ color: '#ffc688' })
  D.push(bayLit)
  for (const [i, bx] of [-3.7, -0.1].entries()) {
    for (const jx of [-1, 1]) F.box(0.4, 3.9, 0.3, brick.trim, bx + jx * 1.65, 1.95, fz + 0.1)
    F.box(3.7, 0.5, 0.34, brick.trim, bx, 4.0, fz + 0.12)
    F.put(new THREE.PlaneGeometry(3.0, 3.3), bayLit, bx, 1.65, fz + 0.03, 0, 0, 0, false)
    // the rolled-up shutter above: ribbed slats
    for (let k = 0; k < 7; k++) F.box(3.05, 0.1, 0.1, k % 2 ? steel : block, bx, 3.3 + k * 0.08, fz + 0.1)
    F.box(3.2, 0.12, 0.16, yellow, bx, 0.14, fz + 0.18) // threshold stripe
    T.lights.push({ x: F.world(bx, 2.4, fz + 1.8).x, y: 2.4, z: F.world(bx, 2.4, fz + 1.8).z, color: '#ffd09a', intensity: 3.2, dist: 8, priority: 2 })
    void i
  }
  F.box(4.8, 0.7, 0.14, yellow, -1.9, 4.65, fz + 0.12) // door-number band above the bays
  channelLetters(F.sub(-1.9, 4.5, fz + 0.2), 'SERVICE BAYS', 0.34, 0.08, orange)

  // ── reception: a glass door, shop window and awning at the east end ──
  const rx = 4.6
  F.box(2.4, 3.2, 0.12, steel, rx, 1.6, fz + 0.06)
  F.put(new THREE.PlaneGeometry(1.0, 2.5), glass, rx - 0.45, 1.35, fz + 0.14, 0, 0, 0, false)
  F.put(new THREE.PlaneGeometry(1.0, 2.5), glass, rx + 0.5, 1.35, fz + 0.14, 0, 0, 0, false)
  F.box(0.05, 2.6, 0.1, steel, rx + 0.02, 1.35, fz + 0.16)
  F.put(new THREE.PlaneGeometry(1.6, 1.3), bayLit, rx + 1.9, 1.8, fz + 0.03, 0, 0, 0, false)
  for (const [bw, bh, bx, by] of [[1.7, 0.1, 0, 2.5], [1.7, 0.1, 0, 1.1], [0.1, 1.5, -0.8, 1.8], [0.1, 1.5, 0.8, 1.8]] as const) F.box(bw, bh, 0.12, steel, rx + 1.9 + bx, by, fz + 0.1)
  const awn = std({ color: '#1f4a8a', roughness: 0.75, side: THREE.DoubleSide })
  F.put(new THREE.BoxGeometry(4.2, 0.08, 1.4), awn, rx + 0.6, 3.35, fz + 0.75)
  F.put(new THREE.BoxGeometry(4.2, 0.4, 0.06), awn, rx + 0.6, 3.15, fz + 1.45)
  const recep = std({ map: panelTexture('RECEPTION', 'book a service · quotes · MOT', 2.6, PANEL.dark, D), roughness: 0.7 })
  F.put(new THREE.PlaneGeometry(1.3, 0.5), recep, rx, 3.7, fz + 0.15, 0, 0, 0, false)
  T.colliders.push({ kind: 'box', minX: W.x - W.w / 2 - 0.4, maxX: W.x + W.w / 2 + 0.4, minZ: W.z - W.d / 2 - 0.4, maxZ: W.z + W.d / 2 + 0.4, h: H })

  // ── branding: a lettered band on the parapet + a gilded plaque + a blade sign at the west corner ──
  F.box(8.2, 0.9, 0.12, steel, -0.2, H + 0.58, fz + 0.02)
  channelLetters(F.sub(-0.2, H + 0.38, fz + 0.12), 'CHAD MOTORS', 0.52, 0.16, orange)
  ornateSign(T, F.sub(rx + 0.6, 3.95, fz + 0.15), 'SERVICE', { h: 0.55, crest: null })

  // ── the covered service bay (west side, toward the street): portal canopy + a two-post lift with the car raised on it ──
  {
    const cx = 9.9 // centre of the bay in local x (the building's west face is at local x = 6.5)
    const cw = 6.0
    const cd = 7.0
    const top = 3.7
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) F.put(new THREE.CylinderGeometry(0.1, 0.11, top, 10), steel, cx + sx * (cw / 2 - 0.2), top / 2, sz * (cd / 2 - 0.3) + 0.5)
    F.box(cw + 0.3, 0.2, cd + 0.2, steel, cx, top + 0.1, 0.5) // roof
    F.box(cw + 0.34, 0.05, 0.06, yellow, cx, top - 0.02, cd / 2 + 0.55, false)
    F.box(cw - 0.6, 0.04, cd - 0.8, warm, cx, top - 0.04, 0.5, false) // lit soffit
    T.lights.push({ x: F.world(cx, 3.2, 0.5).x, y: 3.2, z: F.world(cx, 3.2, 0.5).z, color: '#ffe0b0', intensity: 4.5, dist: 9, priority: 2 })
    // the floor: a concrete pad with painted keep-clear lines
    F.put(boxUV(cw + 0.4, 0.05, cd + 0.4, 2), concrete, cx, 0.03, 0.5, 0, 0, 0, false)
    for (const sx of [-1, 1]) F.box(0.1, 0.01, cd, yellow, cx + sx * (cw / 2 - 0.5), 0.065, 0.5, false)
    // lift: two columns, a carriage on each, four swing arms with pads under the car's lift points
    const lx = [cx - 1.8, cx + 1.8]
    for (const x of lx) {
      F.box(0.34, 3.4, 0.4, yellow, x, 1.7, 0.5)
      F.box(0.5, 0.5, 0.5, steel, x, 1.35, 0.5) // the carriage, at the lifted height
      F.box(0.5, 0.05, 0.5, steel, x, 0.03, 0.5)
      T.colliders.push({ kind: 'box', minX: F.world(x, 0, 0.5).x - 0.3, maxX: F.world(x, 0, 0.5).x + 0.3, minZ: F.world(x, 0, 0.5).z - 0.3, maxZ: F.world(x, 0, 0.5).z + 0.3, h: 3.4 })
    }
    // arms reach in under the sills; pads at the four contact points (car body sits 1.5 m up, sills at ~1.55)
    for (const [x, side] of [[lx[0], 1], [lx[1], -1]] as const) for (const dz of [-1.0, 0.9]) {
      F.box(Math.abs(cx - x) - 0.3, 0.1, 0.12, steel, (x + cx) / 2 - side * 0.0, 1.38, 0.5 + dz * 0.6)
      F.put(new THREE.CylinderGeometry(0.1, 0.11, 0.1, 10), rubber, cx - side * 0.6 + (side > 0 ? 0 : 0), 1.46, 0.5 + dz * 0.6)
    }
    heroCarAt(F.sub(cx, 1.5, 0.5, 0, 0, 0), T.scene, CARS[2].paint) // nose toward the street, between the two columns
    // a trolley jack, axle stands and an oil drip tray under the raised car
    F.box(1.2, 0.12, 0.5, red, cx + 0.2, 0.2, 2.0)
    F.box(0.6, 0.35, 0.3, steel, cx - 0.5, 0.18, -1.0)
    // wall side: a parts shelf and a tyre rack against the building
    for (const y of [0.4, 1.2, 2.0]) F.box(0.3, 0.05, 3.2, steel, 6.75, y, 1.0)
    for (const dz of [-0.2, 0.9, 2.0]) F.box(0.3, 2.2, 0.06, steel, 6.75, 1.1, dz)
    for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) tyre(F, 6.78, 0.62 + r * 0.8, 0.0 + k * 0.78 - 0.3, 'standing')
    T.colliders.push({ kind: 'box', minX: F.world(7.4, 0, 3.0).x - 0.3, maxX: F.world(6.4, 0, -0.5).x + 0.3, minZ: F.world(7.4, 0, 3.0).z - 0.3, maxZ: F.world(6.4, 0, -0.5).z + 0.3, h: 2.4 })
  }

  /** a tyre with a real shape: a chunky toroidal carcass, a tread band and a chrome rim with a hub (stacked flat, or standing on a rack) */
  function tyre(Fr: Frame, x: number, y: number, z: number, mode: 'flat' | 'standing') {
    const car = new THREE.TorusGeometry(0.29, 0.13, 10, 22)
    car.scale(1, 1, 1.35)
    if (mode === 'flat') car.rotateX(Math.PI / 2)
    else car.rotateY(Math.PI / 2)
    Fr.put(car, rubber, x, y, z)
    const tread = new THREE.CylinderGeometry(0.42, 0.42, 0.22, 22, 1, true)
    if (mode === 'standing') tread.rotateZ(Math.PI / 2)
    Fr.put(tread, rubber, x, y, z, 0, 0, 0, false)
    const rim = new THREE.CylinderGeometry(0.19, 0.19, 0.2, 14)
    if (mode === 'standing') rim.rotateZ(Math.PI / 2)
    Fr.put(rim, chrome, x, y, z, 0, 0, 0, false)
  }

  // ── the yard: asphalt with painted bays, the driveway to Motor Row, kerbs, bollards ──
  {
    const pave = (x0: number, x1: number, z0: number, z1: number, mat: THREE.Material, y = 0.026) => {
      const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2)
      const u = g.attributes.uv as THREE.BufferAttribute
      for (let i = 0; i < u.count; i++) u.setXY(i, (u.getX(i) * (x1 - x0)) / 3, (u.getY(i) * (z1 - z0)) / 3)
      T.batch.put(g, mat, (x0 + x1) / 2, y, (z0 + z1) / 2, 0, 1, 1, 1, { cast: false })
    }
    const zN = W.z - fz // the building's road face, world z
    pave(64.0, 86.0, zN - 7.2, zN + 0.02, asphalt) // the working yard
    pave(63.6, 66.4, 38.6, zN - 6.6, asphalt) // the driveway from the end of Motor Row
    for (let k = 0; k < 4; k++) T.batch.put(new THREE.BoxGeometry(0.1, 0.01, 3.0), yellow, 68.6 + k * 3.6, 0.04, zN - 3.4, 0, 1, 1, 1, { cast: false })
    T.batch.put(new THREE.BoxGeometry(22, 0.01, 0.12), yellow, 75, 0.04, zN - 1.2, 0, 1, 1, 1, { cast: false })
    for (const sx of [-1, 1]) T.batch.put(boxUV(0.3, 0.16, 6.2, 1), P.stoneLight, 65 + sx * 0, 0.08, 41.6 + sx * 0, 0, 1, 1, 1, { cast: false })
    // lit bollards along the lake edge of the yard and a low wall + shrubs to screen it from the waterfront
    const bol = new THREE.CylinderGeometry(0.11, 0.13, 0.8, 10)
    for (const dx of [-1, 0, 1]) {
      T.batch.put(bol, yellow, 80 + dx * 2.2, 0.4, zN - 7.0)
      T.colliders.push({ kind: 'circle', x: 80 + dx * 2.2, z: zN - 7.0, r: 0.13, h: 0.8 })
    }
    T.batch.put(boxUV(0.4, 0.9, 6.2, 1.2), brick.wall, 86.2, 0.45, zN - 3.6)
    T.colliders.push({ kind: 'box', minX: 86.0, maxX: 86.4, minZ: zN - 6.7, maxZ: zN - 0.5, h: 0.9 })
    for (const dz of [-6.0, -4.4, -2.8, -1.2]) WORKSHOP_SHRUBS.push([87.0, 0, zN + dz, 1.0 + (dz % 2 ? 0.1 : 0)])
  }

  // ── the working yard's kit: stacked tyres, drums, a workbench with a vice, a roll-away chest, an air compressor, cones ──
  {
    const zN = W.z - fz
    const Y = Frame.at(T.batch, W.x, 0, zN - 2.6, Math.PI)
    for (let k = 0; k < 5; k++) tyre(Y, -5.4, 0.15 + k * 0.28, 0, 'flat')
    for (let k = 0; k < 4; k++) tyre(Y, -4.2, 0.15 + k * 0.28, 0.5, 'flat')
    T.colliders.push({ kind: 'circle', x: Y.world(-5.4, 0, 0).x, z: Y.world(-5.4, 0, 0).z, r: 0.5, h: 1.4 })
    T.colliders.push({ kind: 'circle', x: Y.world(-4.2, 0, 0.5).x, z: Y.world(-4.2, 0, 0.5).z, r: 0.5, h: 1.1 })
    const drum = std({ color: '#7a2a1e', metalness: 0.5, roughness: 0.6 })
    const blue = std({ color: '#1f4a8a', metalness: 0.5, roughness: 0.6 })
    for (const [dx, m] of [[3.2, drum], [3.9, blue], [3.55, drum]] as const) Y.put(new THREE.CylinderGeometry(0.3, 0.3, 0.88, 12), m, dx, 0.44, dx === 3.55 ? 0.55 : 0)
    T.colliders.push({ kind: 'circle', x: Y.world(3.55, 0, 0.3).x, z: Y.world(3.55, 0, 0.3).z, r: 0.85, h: 0.9 })
    Y.box(1.9, 0.08, 0.7, P.woodLight, 0.2, 0.92, 0.0) // the bench top
    for (const sx of [-0.85, 0.85]) Y.box(0.08, 0.92, 0.6, steel, 0.2 + sx, 0.46, 0.0)
    Y.box(0.16, 0.16, 0.12, steel, -0.4, 1.04, 0.1) // the vice
    Y.box(0.9, 0.02, 0.3, chrome, 0.5, 0.98, 0.05)
    T.colliders.push({ kind: 'box', minX: Y.world(1.1, 0, 0.4).x - 0.1, maxX: Y.world(-0.7, 0, -0.4).x + 0.1, minZ: Y.world(-0.7, 0, -0.4).z - 0.1, maxZ: Y.world(1.1, 0, 0.4).z + 0.1, h: 1.0 })
    Y.box(0.8, 1.15, 0.55, red, 1.9, 0.58, 0.6) // roll-away tool chest with drawers
    for (let k = 0; k < 5; k++) Y.box(0.74, 0.03, 0.02, chrome, 1.9, 0.18 + k * 0.2, 0.89, false)
    Y.put(new THREE.CylinderGeometry(0.22, 0.22, 0.7, 12).rotateZ(Math.PI / 2), yellow, 2.5, 0.45, -0.7) // air compressor tank on a frame
    Y.box(0.9, 0.08, 0.5, steel, 2.5, 0.12, -0.7)
    for (const [cx, cz] of [[-1.5, 1.4], [0.4, 1.6], [2.2, 1.5]] as const) {
      Y.put(new THREE.ConeGeometry(0.17, 0.5, 10), std({ color: '#ff6a1a', roughness: 0.6 }), cx, 0.25, cz)
      Y.box(0.38, 0.03, 0.38, rubber, cx, 0.02, cz, false)
    }
    const note = std({ map: panelTexture('CHAD MOTORS SERVICE', 'reception is open · come inside', 2.6, PANEL.dark, D), roughness: 0.7 })
    postedBoard(Y.sub(-2.0, 0, 1.6, 0, 0, 0), 1.7, 0.75, 1.25, note, { frame: P.iron, metal: P.iron, gold: P.gold, stone: P.stoneLight }, true)
    T.colliders.push({ kind: 'circle', x: Y.world(-2.0, 0, 1.6).x, z: Y.world(-2.0, 0, 1.6).z, r: 0.8, h: 1.9 })
  }
}
