import * as THREE from 'three'
import { isNight } from './daylight'
import type { Town } from './buildings'
import { archMats, displayMaterial, planterBox } from './architecture'
import { boxUV } from './kit'
import { GYM } from './props'
import { Frame, channelLetters } from './signs'
import { glassSkin, wallBays } from './facadeKit'

/**
 * PUMP GYM — the exterior (the interior, its door interaction and everything in it are untouched).
 *
 * A modern industrial gym: dark standing-seam metal cladding on a brick base, a brick feature tower at one end, tall black-framed
 * glazing with the lit gym visible behind it, a wide entrance with a cantilevered steel canopy (orange LED edge, lit soffit, slim posts
 * and tie rods), dimensional illuminated orange PUMP GYM letters on a dark fascia, a flat roof with plant boxes, and a clean paved
 * forecourt with lit bollards and planters of real shrubs. Footprint, floor level and the entrance position are the original ones.
 */
export const GYM_SHRUBS: [number, number, number, number][] = []

export function gymExterior(T: Town, stoneTex: THREE.Texture) {
  const P = T.P
  const Dp = T.disposables
  const night = isNight()
  const std = (p: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.8, ...p })
    Dp.push(m)
    return m
  }
  const glass = std({ color: '#3a5068', roughness: 0.08, metalness: 0.65, emissive: '#0c1422' }) // (archMats wants a glazing material; the gym's own windows show the lit interior directly)
  const brick = archMats(T, 'brick', stoneTex, glass)

  // standing-seam cladding: dark steel with vertical seams, a faint sheen gradient and a few fastener rows
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 256
  const g = c.getContext('2d')!
  const grd = g.createLinearGradient(0, 0, 128, 0)
  grd.addColorStop(0, '#4a4e5c')
  grd.addColorStop(0.5, '#5a5e6c')
  grd.addColorStop(1, '#484c58')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 256)
  for (let x = 0; x < 128; x += 32) {
    g.fillStyle = 'rgba(0,0,0,0.5)'
    g.fillRect(x, 0, 2, 256)
    g.fillStyle = 'rgba(255,255,255,0.1)'
    g.fillRect(x + 2, 0, 1, 256)
  }
  for (let y = 16; y < 256; y += 64) {
    g.fillStyle = 'rgba(0,0,0,0.25)'
    for (let x = 6; x < 128; x += 32) g.fillRect(x, y, 3, 3)
  }
  const ct = new THREE.CanvasTexture(c)
  ct.colorSpace = THREE.SRGBColorSpace
  ct.wrapS = ct.wrapT = THREE.RepeatWrapping
  ct.anisotropy = 4
  Dp.push(ct)
  // charcoal, not black: moon and lamp light must be able to find the surface at night
  const clad = std({ map: ct, color: '#9a9eb0', metalness: 0.25, roughness: 0.55, emissive: '#1c1f28', emissiveIntensity: 1 })
  const steel = std({ color: '#2c2e38', metalness: 0.5, roughness: 0.45, emissive: '#0c0d10', emissiveIntensity: 1 })
  const orange = std({ color: '#ff8a2a', metalness: 0.3, roughness: 0.45, ...(night ? { emissive: '#ff8a2a', emissiveIntensity: 2.0 } : {}) })
  const led = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff8a2a').multiplyScalar(1.6), toneMapped: false })
  const warm = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffcf8a').multiplyScalar(1.3), toneMapped: false })
  Dp.push(led, warm)
  const inside = displayMaterial(T, '#ff7a1a', 'racks')
  const rubberFloor = std({ color: '#1c1d22', roughness: 0.9 })

  const W = 10.4 // along the facade (world z)
  const Dd = 9.4 // depth (world x)
  const H = 6.6
  const F = Frame.at(T.batch, GYM.x, 0, GYM.z, -Math.PI / 2) // local +z = west, the entrance side; local x runs along the frontage
  const fz = Dd / 2

  // volume: cladding over a brick base, a flat roof with a deep coping and an orange reveal under it
  // the glazing is a real recess: the main volume stops REC behind the facade, and the front is a slab of cladding with openings cut for the two glass bays and the
  // entrance (a solid end, sills under each bay, a header band above them), so the lit gym is seen set back behind steel mullions, not painted on the wall
  const REC = 0.9
  F.put(boxUV(W, H, Dd - REC, 3), clad, 0, H / 2, -REC / 2)
  {
    const slab = (x0: number, x1: number, y0: number, y1: number) => F.put(boxUV(x1 - x0, y1 - y0, REC, 3), clad, (x0 + x1) / 2, (y0 + y1) / 2, fz - REC / 2)
    slab(-W / 2, -3.35, 0, H) // the solid end beside the tower
    slab(-3.35, -1.75, 0, 1.2) // sills under the two glass bays
    slab(1.8, W / 2, 0, 1.2)
    slab(-3.35, 3.4 + 1.8, 4.7, H) // the header band above the bays and the entrance
    slab(-1.8, 1.8, 3.9, 4.7)
  }
  // (the brick base stops either side of the entrance so the doors reach the ground)
  for (const [x0, x1] of [[-W / 2 - 0.07, -1.8], [1.8, W / 2 + 0.07]] as const) {
    F.put(boxUV(x1 - x0, 1.25, Dd + 0.14, 1.4), brick.wall, (x0 + x1) / 2, 0.625, 0)
    F.put(boxUV(x1 - x0, 0.14, Dd + 0.2, 1), brick.trim, (x0 + x1) / 2, 1.3, 0)
  }
  F.put(boxUV(W + 0.4, 0.45, Dd + 0.4, 1), steel, 0, H + 0.2, 0)
  F.box(W + 0.42, 0.06, 0.06, led, 0, H - 0.1, fz + 0.2, false)
  // roof plant: air handlers and a flue, set back from the edge so the silhouette stays clean
  F.box(2.4, 0.9, 1.4, steel, -2.6, H + 0.9, -0.8)
  F.box(1.8, 0.7, 1.2, steel, 2.8, H + 0.8, 0.6)
  F.put(new THREE.CylinderGeometry(0.22, 0.22, 1.6, 10), steel, -3.8, H + 1.2, 1.4)

  // the brick feature tower at the left end of the frontage: proud of the cladding and taller than the roof, with slits of light
  const tx = -W / 2 + 0.95
  F.put(boxUV(1.9, H + 1.1, 0.6, 1.4), brick.wall, tx, (H + 1.1) / 2, fz + 0.05)
  F.put(boxUV(2.1, 0.2, 0.8, 1), brick.trim, tx, H + 1.15, fz + 0.05)
  F.box(0.2, 3.2, 0.05, warm, tx, 3.3, fz + 0.38, false)
  F.box(0.2, 1.6, 0.05, warm, tx, 5.9, fz + 0.38, false)

  // glazing: a tall black-framed bay either side of the entrance, the lit gym visible behind the glass
  const bay = (cx: number, w: number) => {
    F.put(new THREE.PlaneGeometry(w - 0.1, 3.5), inside, cx, 2.95, fz - REC + 0.012, 0, 0, 0, false) // the lit gym, at the back of the recess
    F.put(new THREE.PlaneGeometry(w - 0.1, 3.5), glassSkin(T), cx, 2.95, fz - 0.05, 0, 0, 0, false)
    F.put(new THREE.PlaneGeometry(w, REC).rotateX(-Math.PI / 2), rubberFloor, cx, 1.22, fz - REC / 2, 0, 0, 0, false) // the sill's top
    F.box(w - 0.1, 0.05, REC - 0.1, warm, cx, 4.62, fz - REC / 2, false) // a lit ceiling strip inside the head
    F.box(0.07, 3.5, REC, steel, cx - w / 2 + 0.02, 2.95, fz - REC / 2) // the side reveals
    F.box(0.07, 3.5, REC, steel, cx + w / 2 - 0.02, 2.95, fz - REC / 2)
    // gym kit seen through the glass: a rack and a stack of plyo boxes on the sill
    F.box(0.08, 1.5, 0.08, steel, cx - w * 0.25, 1.97, fz - REC + 0.25)
    F.box(0.08, 1.5, 0.08, steel, cx - w * 0.25 + 0.7, 1.97, fz - REC + 0.25)
    F.box(0.78, 0.06, 0.08, orange, cx - w * 0.25 + 0.35, 2.5, fz - REC + 0.25, false)
    F.box(0.6, 0.45, 0.5, steel, cx + w * 0.22, 1.45, fz - REC + 0.4)
    const mulls = Math.max(1, Math.round(w / 1.1))
    for (let i = 0; i <= mulls; i++) F.box(0.07, 3.7, 0.14, steel, cx - w / 2 + (w * i) / mulls, 2.95, fz + 0.03)
    for (const y of [1.15, 2.75, 4.75]) F.box(w + 0.1, 0.1, 0.16, steel, cx, y, fz + 0.04)
    F.box(w + 0.3, 0.12, 0.26, brick.trim, cx, 1.22, fz + 0.1)
  }
  bay(3.5, 3.4)
  bay(-2.55, 1.6)
  // the entrance: a wide opening with a recessed steel portal, double glass doors, a lit reveal, and a threshold slab
  F.put(new THREE.PlaneGeometry(3.3, 3.3), inside, 0, 1.75, fz - REC + 0.012, 0, 0, 0, false)
  for (const dx of [-0.68, 0.68]) {
    F.put(new THREE.PlaneGeometry(1.3, 2.7), glassSkin(T), dx, 1.5, fz + 0.03, 0, 0, 0, false)
    F.box(0.06, 2.8, 0.1, steel, dx - 0.65, 1.5, fz + 0.07)
    F.box(0.06, 2.8, 0.1, steel, dx + 0.65, 1.5, fz + 0.07)
    F.box(1.34, 0.08, 0.1, steel, dx, 2.85, fz + 0.07)
    F.box(0.04, 1.1, 0.07, orange, dx - Math.sign(dx) * 0.5, 1.4, fz + 0.12, false) // pull handles
  }
  F.box(0.06, 2.9, 0.1, steel, 0, 1.5, fz + 0.07)
  for (const sx of [-1, 1]) F.box(0.16, 3.6, 0.32, steel, sx * 1.8, 1.8, fz + 0.04) // portal jambs
  F.box(3.9, 0.2, 0.32, steel, 0, 3.7, fz + 0.04)
  F.put(boxUV(4.6, 0.05, 2.2, 1), P.stoneLight, 0, 0.03, fz + 0.9, 0, 0, 0, false)

  // the cantilevered canopy: a steel slab (orange LED edge, lit soffit), two slim posts and tie rods back to the wall
  const cw = 6.6
  const cd = 2.8
  F.box(cw, 0.24, cd, steel, 0, 4.0, fz + cd / 2)
  F.box(cw + 0.04, 0.05, 0.05, led, 0, 3.93, fz + cd, false)
  F.box(0.05, 0.05, cd, led, -cw / 2, 3.93, fz + cd / 2, false)
  F.box(0.05, 0.05, cd, led, cw / 2, 3.93, fz + cd / 2, false)
  F.box(cw - 0.5, 0.04, cd - 0.6, warm, 0, 3.86, fz + cd / 2, false) // the lit soffit
  for (const sx of [-1, 1]) {
    const px = sx * (cw / 2 - 0.25)
    F.put(new THREE.CylinderGeometry(0.07, 0.08, 3.9, 10), steel, px, 1.95, fz + cd - 0.2)
    const rod = new THREE.CylinderGeometry(0.018, 0.018, Math.hypot(cd, 1.6), 5)
    F.put(rod, steel, px, 4.9, fz + cd / 2, -Math.atan2(cd, 1.6), 0, 0) // tie rod from the wall bracket down to the slab edge
    T.colliders.push({ kind: 'circle', x: GYM.x - fz - cd + 0.2, z: GYM.z + px, r: 0.14, h: 4 })
  }

  // the fascia: a dark band above the canopy carrying dimensional illuminated PUMP GYM letters (with a glow bar behind)
  F.box(7.2, 1.25, 0.12, steel, 0.4, 5.55, fz + 0.06)
  F.box(6.9, 0.05, 0.05, led, 0.4, 4.98, fz + 0.14, false)
  F.box(6.9, 0.05, 0.05, led, 0.4, 6.12, fz + 0.14, false)
  // (no glow slab behind the letters: it washed the lettering out; the dark fascia lets the lit letters read on their own)
  channelLetters(F.sub(0.4, 5.2, fz + 0.16), 'PUMP GYM', 0.76, 0.26, orange)

  // the south (yard), north and rear walls: a brick base band, steel ribs between bays, tall black-framed industrial windows above the base, a coping line — no bare cladding
  {
    const WM = { frame: steel, trim: brick.trim, plinth: brick.wall, metal: steel }
    const o = { height: H, rows: [[3.5, 2.6] as [number, number]], maxWindow: 1.7, industrial: true, plinth: 1.25, strings: [1.3], pilaster: 0.22, downpipe: true }
    wallBays(T, Frame.at(T.batch, GYM.x, 0, GYM.z + W / 2, 0), WM, { ...o, length: Dd, seed: 2 }) // south
    wallBays(T, Frame.at(T.batch, GYM.x, 0, GYM.z - W / 2, Math.PI), WM, { ...o, length: Dd, seed: 4 }) // north
    wallBays(T, Frame.at(T.batch, GYM.x + Dd / 2, 0, GYM.z, Math.PI / 2), WM, { ...o, length: W, seed: 6 }) // rear (east)
  }
  T.colliders.push({ kind: 'box', minX: GYM.x - Dd / 2, maxX: GYM.x + Dd / 2, minZ: GYM.z - W / 2, maxZ: GYM.z + W / 2, h: H })
  T.colliders.push({ kind: 'box', minX: GYM.x - fz - 0.7, maxX: GYM.x - fz, minZ: GYM.z - W / 2 + 0.1, maxZ: GYM.z - W / 2 + 2.1, h: H + 1.1 }) // the brick tower

  // the forecourt: pale pavers with a stone carpet to the portal, lit bollards along the street edge, and planters of real shrubs
  const fx = GYM.x - fz // the facade line in world x
  const pave = new THREE.PlaneGeometry(6.4, 11).rotateX(-Math.PI / 2)
  const u = pave.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < u.count; i++) u.setXY(i, (u.getX(i) * 6.4) / 3, (u.getY(i) * 11) / 3)
  T.batch.put(pave, P.cobble, fx - 3.2, 0.026, GYM.z, 0, 1, 1, 1, { cast: false })
  T.batch.put(boxUV(5.6, 0.03, 3.2, 1), P.stoneLight, fx - 2.8, 0.045, GYM.z, 0, 1, 1, 1, { cast: false })
  for (const sz of [-1.62, 1.62]) T.batch.put(new THREE.BoxGeometry(5.6, 0.035, 0.07), P.glowOrange, fx - 2.8, 0.05, GYM.z + sz, 0, 1, 1, 1, { cast: false })
  const boll = new THREE.CylinderGeometry(0.11, 0.13, 0.78, 10)
  for (const dz of [-5.0, -3.2, 3.2, 5.0]) {
    T.batch.put(boll, steel, fx - 5.6, 0.39, GYM.z + dz)
    T.batch.put(new THREE.CylinderGeometry(0.115, 0.115, 0.05, 10), led, fx - 5.6, 0.74, GYM.z + dz, 0, 1, 1, 1, { cast: false })
    T.colliders.push({ kind: 'circle', x: fx - 5.6, z: GYM.z + dz, r: 0.13, h: 0.8 })
  }
  for (const dz of [-4.2, 4.2]) {
    planterBox(T, brick.trim, fx - 1.0, GYM.z + dz, 1.6, 1.8)
    GYM_SHRUBS.push([fx - 1.0, 0.55, GYM.z + dz - 0.4, 0.95], [fx - 1.0, 0.55, GYM.z + dz + 0.4, 0.85])
  }
  T.lights.push({ x: fx - 1.4, y: 3.2, z: GYM.z, color: '#ff9a3a', intensity: 6, dist: 11, priority: 3 })
}
