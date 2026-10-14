import * as THREE from 'three'
import type { Town } from './buildings'
import { boxUV } from './kit'
import { PANEL } from './signs'
import { archMats, displayMaterial, planterBox, shop, type ArchMats, type Roof } from './architecture'
import { flowerTub } from './ornament'
import { DISTRICTS } from './city'

/**
 * THE LOWER DISTRICTS — two new quarters that more than double the walkable city together with Downtown and the mountain:
 *
 *  • SOUTHSHORE (south of Moonlight Lake): a cobbled Shore Road lined with shops, Quay Lane running south to a market
 *    square with a fountain, a terrace of houses, a pond with a stone quay, an orchard garden.
 *  • MILL ROW (south of Chadville Estates): Mill Road with shops, a lane, terraces of homes, Mill Court with a well.
 *
 * The same Gothic shopfront style as the old town (recessed doors, display bays, gilded ornate signs, climbers), built from
 * the shop() kit. The shop doors are dressed but closed — enterable interiors come in a later chapter.
 */
export const SOUTHSHORE = DISTRICTS.southshore
export const MILL_ROW = DISTRICTS.millrow
const SHORE_Z = 94
const QUAY_X = 100
const MILL_Z = 100
const LANE_X = -42

const shopNames = ['PUMPKIN BAKERY', 'OLD BOOKS', 'LANTERN WRIGHT', 'APOTHECARY', 'SHORE CAFE', 'GOLDEN SCALES', 'MOON TAILOR', 'CHAD CHEESE', 'TEA & TALES', 'THE FORGE', 'SALT & SAGE', 'PIE SHOP']
const subs = ['warm every dawn', 'rare + curious', 'bright by hand', 'tonics + tinctures', 'shakes · tea · cake', 'honest weights', 'fits for chads', 'aged in the cellar', 'steeped slowly', 'iron + gold', 'spice + herb', 'savoury + sweet']

export const SOUTHSHORE_LAMPS: [number, number][] = [
  ...[72, 84, 92, 108, 116, 128].flatMap((x) => [[x, SHORE_Z - 4.4], [x, SHORE_Z + 4.4]] as [number, number][]),
  ...[70, 80, 110, 122, 134].map((z) => [QUAY_X - 4.4, z] as [number, number]),
  ...[76, 106, 118, 136].map((z) => [QUAY_X + 4.4, z] as [number, number]),
  [90, 126], [110, 126], [90, 134], [110, 134],
]
export const MILL_LAMPS: [number, number][] = [
  ...[-66, -56, -48, -36, -28, -18].flatMap((x) => [[x, MILL_Z - 4.4], [x, MILL_Z + 4.4]] as [number, number][]),
  ...[82, 112, 126, 138].flatMap((z) => [[LANE_X - 3.6, z], [LANE_X + 3.6, z]] as [number, number][]),
]

export function southshore(T: Town, stoneTex: THREE.Texture) {
  const P = T.P
  const D = T.disposables
  const glass = new THREE.MeshStandardMaterial({ color: '#3a5068', roughness: 0.08, metalness: 0.65, emissive: '#0c1422' })
  D.push(glass)
  const std = (p: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.75, ...p })
    D.push(m)
    return m
  }
  const mats: ArchMats[] = [archMats(T, 'render', stoneTex, glass), archMats(T, 'stone', stoneTex, glass), archMats(T, 'brick', stoneTex, glass)]
  const awnings = [std({ color: '#e8641a', side: THREE.DoubleSide }), std({ color: '#5b2a86', side: THREE.DoubleSide }), std({ color: '#1f7a6a', side: THREE.DoubleSide }), std({ color: '#a8321f', side: THREE.DoubleSide })]
  const goods = ['shelves', 'racks', 'cabinets'] as const
  const tints = ['#ffb24a', '#c8a0ff', '#7fe8ff', '#ff9ad5', '#b8ff9a']
  const roofs: Roof[] = ['pitched', 'mansard', 'parapet']
  const leaf = std({ color: '#2f5c36', roughness: 0.95 })
  const leaf2 = std({ color: '#b8561c', roughness: 0.9 })
  const water = std({ color: '#2f6a8a', roughness: 0.05, metalness: 0.3, emissive: '#0c2a3a' })
  let n = 0
  const place = (x: number, z: number, w: number, ry: number, o: { floors?: number; name?: boolean; d?: number } = {}) => {
    const i = n++
    shop(T, mats[i % 3], {
      x, z, w, d: o.d ?? 6, floors: o.floors ?? 2, ry, roof: roofs[(i + 1) % 3],
      ...(o.name === false ? {} : { name: shopNames[i % shopNames.length], sub: subs[i % subs.length], sign: 'ornate' as const, crest: (['crown', 'pumpkin', 'paw'] as const)[i % 3], panel: [PANEL.cream, PANEL.purple, PANEL.green, PANEL.dark][i % 4] }),
      greenery: true,
      awning: awnings[i % 4],
      display: displayMaterial(T, tints[i % 5], goods[i % 3]),
      balcony: i % 3 === 1,
    })
  }
  const pave = (x0: number, x1: number, z0: number, z1: number, mat: THREE.Material = P.cobble, y = 0.025) => {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2)
    const u = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < u.count; i++) u.setXY(i, (u.getX(i) * (x1 - x0)) / 3, (u.getY(i) * (z1 - z0)) / 3)
    T.batch.put(g, mat, (x0 + x1) / 2, y, (z0 + z1) / 2, 0, 1, 1, 1, { cast: false })
  }
  const tree = (x: number, z: number, s = 1, autumn = false) => {
    T.batch.put(new THREE.CylinderGeometry(0.16 * s, 0.22 * s, 2.4 * s, 6), P.bark, x, 1.2 * s, z)
    T.batch.put(new THREE.SphereGeometry(1.5 * s, 10, 8).scale(1, 0.9, 1), autumn ? leaf2 : leaf, x, 3.3 * s, z)
    T.batch.put(new THREE.SphereGeometry(1.0 * s, 9, 7), autumn ? leaf2 : leaf, x + 0.7 * s, 2.7 * s, z + 0.3 * s)
    T.colliders.push({ kind: 'circle', x, z, r: 0.35 * s, h: 4 })
  }
  const bench = (x: number, z: number, ry: number) => {
    const c = Math.abs(Math.cos(ry))
    T.batch.put(boxUV(1.6, 0.08, 0.5, 1), P.woodLight, x, 0.5, z, ry)
    T.batch.put(boxUV(1.6, 0.4, 0.06, 1), P.woodLight, x + Math.sin(ry) * -0.24, 0.78, z + Math.cos(ry) * -0.24, ry)
    for (const sx of [-0.7, 0.7]) T.batch.put(boxUV(0.08, 0.5, 0.45, 1), P.iron, x + Math.cos(ry) * sx, 0.25, z - Math.sin(ry) * sx, ry)
    T.colliders.push({ kind: 'box', minX: x - (c > 0.5 ? 0.9 : 0.35), maxX: x + (c > 0.5 ? 0.9 : 0.35), minZ: z - (c > 0.5 ? 0.35 : 0.9), maxZ: z + (c > 0.5 ? 0.35 : 0.9), h: 0.8 })
  }
  const fountain = (x: number, z: number, r: number) => {
    for (const [rr, m] of [[r + 2.6, P.stoneLight], [r + 2.2, P.gold]] as const) T.batch.put(new THREE.RingGeometry(rr - 0.16, rr, 40).rotateX(-Math.PI / 2), m, x, 0.04, z, 0, 1, 1, 1, { cast: false })
    T.batch.put(new THREE.CylinderGeometry(r, r + 0.2, 0.75, 24), P.stone, x, 0.37, z)
    T.batch.put(new THREE.CylinderGeometry(r - 0.25, r - 0.25, 0.08, 24), water, x, 0.72, z, 0, 1, 1, 1, { cast: false })
    T.batch.put(new THREE.CylinderGeometry(0.28, 0.4, 1.8, 10), P.stone, x, 1.4, z)
    T.batch.put(new THREE.SphereGeometry(0.4, 12, 8), P.gold, x, 2.45, z)
    T.colliders.push({ kind: 'circle', x, z, r: r + 0.25, h: 1.2 })
  }

  /* ═════════ SOUTHSHORE ═════════ */
  {
    const { x0, x1, z0, z1 } = SOUTHSHORE
    pave(x0, x1, z0, z1, P.plaza, 0.02) // dressed paving under everything
    pave(x0, x1, SHORE_Z - 3.6, SHORE_Z + 3.6) // Shore Road
    pave(QUAY_X - 3.6, QUAY_X + 3.6, z0, z1) // Quay Lane
    for (const s of [-1, 1]) T.batch.put(boxUV(x1 - x0, 0.14, 0.28, 1), P.stoneLight, (x0 + x1) / 2, 0.07, SHORE_Z + s * 3.74, 0, 1, 1, 1, { cast: false })
    // shops either side of Shore Road (north side faces south, south side faces north); Quay Lane is left open
    for (const x of [74, 82.5, 91.5]) place(x, SHORE_Z - 6.9, x === 82.5 ? 8 : 7.4, 0)
    for (const x of [109, 117.5, 126.5]) place(x, SHORE_Z - 6.9, x === 117.5 ? 8 : 7.4, 0)
    for (const x of [74, 82.5, 91.5]) place(x, SHORE_Z + 6.9, x === 82.5 ? 8 : 7.4, Math.PI)
    for (const x of [109, 117.5, 126.5]) place(x, SHORE_Z + 6.9, x === 117.5 ? 8 : 7.4, Math.PI)
    // terrace of homes behind the south shops, facing the market square
    for (const x of [72, 79.5, 87, 94]) place(x, 113.2, 6.8, Math.PI, { floors: 3, name: false, d: 6.4 })
    for (const x of [106, 113.5, 121, 128.5]) place(x, 113.2, 6.8, Math.PI, { floors: 3, name: false, d: 6.4 })
    // the market square: a fountain ring, benches, trees, flower tubs
    fountain(QUAY_X, 128, 2.6)
    pave(84, 116, 118.5, 140, P.cobble, 0.026)
    for (const [bx, bz, ry] of [[92, 128, Math.PI / 2], [108, 128, -Math.PI / 2], [100, 120.8, Math.PI], [100, 136, 0]] as const) bench(bx, bz, ry)
    for (const [tx, tz] of [[88, 122], [112, 122], [88, 136], [112, 136]] as const) tree(tx, tz, 1.0, (tx + tz) % 2 === 0)
    for (const [fx, fz] of [[94, 120.4], [106, 120.4], [94, 138.4], [106, 138.4]] as const) flowerTub(T, fx, fz, { long: 1.6 })
    // the pond with its stone quay (west, behind the terrace): water + a coping ring, a bench on the quay
    T.batch.put(boxUV(15, 0.5, 14, 2), P.stoneLight, 74, 0.25, 130)
    T.batch.put(boxUV(13.6, 0.06, 12.6, 1), water, 74, 0.52, 130, 0, 1, 1, 1, { cast: false })
    T.colliders.push({ kind: 'box', minX: 66.5, maxX: 81.5, minZ: 123, maxZ: 137, h: 0.5 })
    for (const [bx, bz, ry] of [[74, 120.8, Math.PI], [74, 139.2, 0]] as const) bench(bx, bz, ry)
    // an orchard garden on the east: rows of autumn trees, planters, a path
    pave(122, 132, 120, 138, P.ground, 0.024)
    for (const tx of [124.5, 129.5]) for (const tz of [123, 128, 133]) tree(tx, tz, 0.9, true)
    for (const pz of [122, 134]) planterBox(T, P.stoneLight, 127, pz, 6, 0.8)
  }

  /* ═════════ MILL ROW ═════════ */
  {
    const { x0, x1, z0, z1 } = MILL_ROW
    pave(x0, x1, z0, z1, P.plaza, 0.02)
    pave(x0, x1, MILL_Z - 3.6, MILL_Z + 3.6) // Mill Road
    pave(LANE_X - 3.2, LANE_X + 3.2, z0, z1) // the lane
    for (const s of [-1, 1]) T.batch.put(boxUV(x1 - x0, 0.14, 0.28, 1), P.stoneLight, (x0 + x1) / 2, 0.07, MILL_Z + s * 3.74, 0, 1, 1, 1, { cast: false })
    for (const x of [-66, -57.5, -50]) place(x, MILL_Z - 6.9, x === -57.5 ? 8 : 7.2, 0)
    for (const x of [-34, -26.5, -18.5]) place(x, MILL_Z - 6.9, x === -26.5 ? 7.6 : 7.2, 0)
    for (const x of [-66, -57.5, -50]) place(x, MILL_Z + 6.9, x === -57.5 ? 8 : 7.2, Math.PI)
    for (const x of [-34, -26.5, -18.5]) place(x, MILL_Z + 6.9, x === -26.5 ? 7.6 : 7.2, Math.PI)
    // terraces of homes at the top (facing south onto the lane's head) and at the bottom (facing north onto Mill Court)
    for (const x of [-67, -60, -53, -47]) place(x, 83, 6.6, 0, { floors: 3, name: false, d: 6.4 })
    for (const x of [-37, -30.5, -24, -17.5]) place(x, 83, 6.4, 0, { floors: 3, name: false, d: 6.4 })
    for (const x of [-67, -60, -53, -47]) place(x, 125.6, 6.6, Math.PI, { floors: 3, name: false, d: 6.4 })
    for (const x of [-37, -30.5, -24, -17.5]) place(x, 125.6, 6.4, Math.PI, { floors: 3, name: false, d: 6.4 })
    // Mill Court: a stone well with a little roof, benches, trees, flower tubs
    pave(-66, -18, 128.8, 144, P.cobble, 0.026)
    T.batch.put(new THREE.CylinderGeometry(1.2, 1.3, 0.9, 16), P.stone, LANE_X, 0.45, 136)
    T.batch.put(new THREE.CylinderGeometry(1.0, 1.0, 0.06, 16), water, LANE_X, 0.88, 136, 0, 1, 1, 1, { cast: false })
    for (const sx of [-1, 1]) T.batch.put(boxUV(0.14, 2.0, 0.14, 1), P.woodLight, LANE_X + sx * 1.0, 1.5, 136)
    T.batch.put(new THREE.ConeGeometry(1.7, 0.9, 4).rotateY(Math.PI / 4), P.roofRed, LANE_X, 2.95, 136)
    T.colliders.push({ kind: 'circle', x: LANE_X, z: 136, r: 1.45, h: 1 })
    for (const [bx, bz, ry] of [[-50, 135, Math.PI / 2], [-34, 135, -Math.PI / 2], [LANE_X, 142, 0]] as const) bench(bx, bz, ry)
    for (const [tx, tz] of [[-60, 133], [-24, 133], [-60, 141], [-24, 141]] as const) tree(tx, tz, 1.0, (tx + tz) % 3 === 0)
    for (const fx of [-52, -32]) flowerTub(T, fx, 130.6, { long: 1.6 })
  }
}
