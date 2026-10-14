import * as THREE from 'three'
import type { Town } from './buildings'
import { boxUV } from './kit'
import { Frame, PANEL, hangingSign, panelTexture, postedBoard, type SignMats } from './signs'
import { archMats, detailWalls, displayMaterial, shop } from './architecture'
import { climbers, flowerTub, ornamentMats, ornateSign } from './ornament'
import { CARS, sportsCar } from './vehicles'
import { isNight } from './daylight'

/**
 * MOTOR ROW — the canal promenade carries on east past Arcade Street's back lane into a short shopping street:
 * CHAD PETS (a cosy pet shop with a bay window full of cats, cages and a glowing aquarium) and CHAD MOTORS (a tall
 * Gothic-glass showroom with cars inside and a gold sports car on a podium out front). Both are enterable.
 * The Chad City shopfront style throughout: ornate gold-lettered signs, ivy and wisteria, flower tubs, warm light.
 */
export const MOTOR_ROW = { z: 36.25, x0: 28.6, x1: 64 }
export const PETS = { x: 38, z: 47.5, w: 9, d: 8 }
export const MOTORS = { x: 54, z: 50.5, w: 16, d: 12 }

export function motorRow(T: Town, stoneTex: THREE.Texture) {
  const P = T.P
  const D = T.disposables
  const glass = new THREE.MeshStandardMaterial({ color: '#3a5068', roughness: 0.08, metalness: 0.65, emissive: '#0c1422' })
  D.push(glass)
  const O = ornamentMats(T)
  const night = isNight()
  const Z = MOTOR_ROW.z

  /* ── the street: setts, kerbs, the forecourts ── */
  {
    const pave = (x0: number, x1: number, z0: number, z1: number, mat: THREE.Material = P.cobble, y = 0.024) => {
      const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2)
      const u = g.attributes.uv as THREE.BufferAttribute
      for (let i = 0; i < u.count; i++) u.setXY(i, (u.getX(i) * (x1 - x0)) / 3, (u.getY(i) * (z1 - z0)) / 3)
      T.batch.put(g, mat, (x0 + x1) / 2, y, (z0 + z1) / 2, 0, 1, 1, 1, { cast: false })
    }
    pave(MOTOR_ROW.x0, MOTOR_ROW.x1, Z - 2.05, Z + 2.05)
    for (const s of [-1, 1]) T.batch.put(boxUV(MOTOR_ROW.x1 - MOTOR_ROW.x0, 0.14, 0.28, 1), P.stoneLight, (MOTOR_ROW.x0 + MOTOR_ROW.x1) / 2, 0.07, Z + s * 2.2, 0, 1, 1, 1, { cast: false })
    // forecourts (polished dark stone for the dealership, setts for the pet shop)
    const dark = new THREE.MeshStandardMaterial({ map: P.plaza.map, color: '#5a5868', roughness: 0.35, metalness: 0.2 })
    D.push(dark)
    pave(MOTORS.x - MOTORS.w / 2, MOTORS.x + MOTORS.w / 2, Z + 2.3, MOTORS.z - MOTORS.d / 2, dark, 0.026)
    pave(PETS.x - 3, PETS.x + 3, Z + 2.3, PETS.z - PETS.d / 2, P.cobble, 0.025)
    // a link path up to Arcade Street's back lane between Chad Cuts and Chad Fits
    pave(45.4, 47.2, 22.6, Z - 2.0, P.cobble, 0.023)
  }

  /* ── CHAD PETS: a cosy two-storey shop in warm render, purple awning, paw-crested sign, climbers ── */
  {
    const render = archMats(T, 'render', stoneTex, glass)
    const awn = new THREE.MeshStandardMaterial({ color: '#6a3aa8', roughness: 0.75, side: THREE.DoubleSide })
    D.push(awn)
    shop(T, render, { x: PETS.x, z: PETS.z, w: PETS.w, d: PETS.d, floors: 2, ry: Math.PI, roof: 'pitched', name: 'CHAD PETS', sign: 'ornate', crest: 'paw', awning: awn, display: displayMaterial(T, '#c08aff', 'pets'), greenery: true })
  }

  /* ── CHAD MOTORS: a tall glass showroom between stone piers, a crowned pediment, cars inside ── */
  {
    const { x: X, z: Zm, w: W, d: Dd } = MOTORS
    const F = Frame.at(T.batch, X, 0, Zm, Math.PI) // local +z = the glass front (facing the street, north)
    const H = 6.2
    const stone = new THREE.MeshStandardMaterial({ map: stoneTex, color: '#d8ccb6', roughness: 0.85 })
    const trim = new THREE.MeshStandardMaterial({ map: stoneTex, color: '#efe4d0', roughness: 0.8 })
    const floor = new THREE.MeshStandardMaterial({ color: '#2a2832', roughness: 0.18, metalness: 0.3 })
    const showGlass = new THREE.MeshStandardMaterial({ color: '#c8d8f0', transparent: true, opacity: night ? 0.08 : 0.2, roughness: 0.05, metalness: 0.2, depthWrite: false, envMapIntensity: night ? 0.3 : 1 })
    const backWall = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd8a0').multiplyScalar(night ? 0.6 : 0.7) })
    D.push(stone, trim, floor, showGlass, backWall)
    // shell: back + side walls, roof slab, parapet with crenels, corner pinnacles
    F.put(boxUV(W, H, 0.5, 2), stone, 0, H / 2, -Dd / 2 + 0.25)
    for (const sx of [-1, 1]) F.put(boxUV(0.5, H, Dd, 2), stone, sx * (W / 2 - 0.25), H / 2, 0)
    F.put(boxUV(W, 0.5, Dd, 2), stone, 0, H + 0.25, 0)
    F.put(boxUV(W + 0.5, 0.3, Dd + 0.5, 1.4), trim, 0, H + 0.65, 0)
    for (let k = 0; k < 9; k++) F.put(boxUV(0.9, 0.7, 0.5, 1), stone, -W / 2 + 0.6 + k * ((W - 1.2) / 8), H + 1.15, Dd / 2 - 0.1)
    for (const sx of [-1, 1]) {
      F.put(boxUV(1.1, H + 2.2, 1.1, 1.6), stone, sx * (W / 2 + 0.1), (H + 2.2) / 2, Dd / 2 + 0.1)
      F.put(new THREE.ConeGeometry(0.75, 2.2, 4).rotateY(Math.PI / 4), trim, sx * (W / 2 + 0.1), H + 3.3, Dd / 2 + 0.1)
      F.put(new THREE.SphereGeometry(0.16, 10, 8), O.goldTrim, sx * (W / 2 + 0.1), H + 4.5, Dd / 2 + 0.1)
    }
    // the interior you see through the glass: polished floor, a warm-lit back wall with gold bands, ceiling light lines
    F.put(new THREE.PlaneGeometry(W - 1, Dd - 1).rotateX(-Math.PI / 2), floor, 0, 0.03, 0, 0, 0, 0, false)
    F.put(new THREE.PlaneGeometry(W - 1, H - 0.4), backWall, 0, H / 2, -Dd / 2 + 0.51, 0, 0, 0, false)
    for (const y of [1.2, 4.6]) F.box(W - 1.2, 0.08, 0.04, O.goldTrim, 0, y, -Dd / 2 + 0.55)
    for (const z of [-3, 0, 3]) F.box(W - 2, 0.05, 0.12, O.glow, 0, H - 0.05, z, false)
    // two cars on the showroom floor (the third is out on the podium)
    // display bays: a low plinth with a gold ring under each car, spaced so every car can be walked around
    for (const [bx, ry, car] of [[-4.2, 0.55, CARS[1]], [4.2, -0.55, CARS[2]]] as const) {
      F.put(new THREE.CylinderGeometry(2.6, 2.7, 0.14, 36), trim, bx, 0.07, -0.8)
      F.put(new THREE.TorusGeometry(2.62, 0.03, 6, 40).rotateX(Math.PI / 2), O.goldTrim, bx, 0.15, -0.8)
      sportsCar(F.sub(bx, 0.14, -0.8, 0, ry, 0), car, D)
    }
    // reception: a curved desk at the back with a lit crest, a lamp, and a plant either side
    F.put(boxUV(3.6, 1.0, 0.9, 1.2), trim, 0, 0.5, -Dd / 2 + 1.5)
    F.box(3.8, 0.06, 1.0, O.goldTrim, 0, 1.03, -Dd / 2 + 1.5)
    F.box(1.4, 0.5, 0.04, O.glow, 0, 2.3, -Dd / 2 + 0.58, false)
    for (const sx of [-1, 1]) {
      F.put(new THREE.CylinderGeometry(0.28, 0.22, 0.5, 12), trim, sx * 2.8, 0.25, -Dd / 2 + 1.1)
      F.put(new THREE.SphereGeometry(0.42, 10, 8).scale(1, 1.3, 1), O.goldTrim, sx * 2.8, 0.95, -Dd / 2 + 1.1)
    }
    // the glass front: four stone piers, three tall pointed-arch glass bays, iron mullions + transoms, glass doors
    const bayW = (W - 1.2 - 4 * 0.6) / 3
    const fz = Dd / 2
    for (let k = 0; k < 4; k++) {
      const px = -W / 2 + 0.6 + 0.3 + k * (bayW + 0.6)
      F.put(boxUV(0.6, H, 0.7, 1.6), trim, px, H / 2, fz - 0.1)
    }
    for (let k = 0; k < 3; k++) {
      const cx = -W / 2 + 0.6 + 0.6 + bayW / 2 + k * (bayW + 0.6)
      const arch = new THREE.Shape()
      const hw = bayW / 2
      const spring = H - 1.6
      arch.moveTo(-hw, 0)
      arch.lineTo(hw, 0)
      arch.lineTo(hw, spring)
      arch.quadraticCurveTo(hw, spring + 1.2, 0, spring + 1.35)
      arch.quadraticCurveTo(-hw, spring + 1.2, -hw, spring)
      arch.closePath()
      F.put(new THREE.ShapeGeometry(arch, 12), showGlass, cx, 0, fz - 0.05, 0, 0, 0, false)
      // the stone above the arch, up to the cornice
      const spand = new THREE.Shape()
      spand.moveTo(-hw, spring)
      spand.quadraticCurveTo(-hw, spring + 1.2, 0, spring + 1.35)
      spand.quadraticCurveTo(hw, spring + 1.2, hw, spring)
      spand.lineTo(hw, H)
      spand.lineTo(-hw, H)
      spand.closePath()
      F.put(new THREE.ExtrudeGeometry(spand, { depth: 0.4, bevelEnabled: false, curveSegments: 12 }), stone, cx, 0, fz - 0.45)
      for (const mx of [-hw / 3, hw / 3]) F.box(0.06, spring + 0.9, 0.08, O.iron, cx + mx, (spring + 0.9) / 2, fz)
      for (const my of [2.8, spring]) F.box(bayW, 0.07, 0.08, O.iron, cx, my, fz)
      F.box(bayW + 0.1, 0.12, 0.3, trim, cx, 0.06, fz + 0.05) // threshold
    }
    // glass double doors in the middle bay, with gold push bars
    for (const sx of [-1, 1]) F.box(0.04, 2.5, 0.05, O.goldTrim, sx * 0.55, 1.25, fz + 0.06)
    F.box(1.0, 0.04, 0.05, O.goldTrim, 0, 1.1, fz + 0.08)
    // the pediment carrying the big ornate sign with the pumpkin crest
    const ped = new THREE.Shape([new THREE.Vector2(-W * 0.32, 0), new THREE.Vector2(W * 0.32, 0), new THREE.Vector2(0, 2.2)])
    F.put(new THREE.ExtrudeGeometry(ped, { depth: 0.6, bevelEnabled: false }), stone, 0, H + 0.8, fz - 0.6)
    ornateSign(T, F.sub(0, H + 0.95, fz + 0.06), 'CHAD MOTORS', { h: 1.0, crest: 'pumpkin' })
    climbers(T, F.sub(0, 0, fz + 0.25), W + 1.6, H + 0.2, 91, { ivy: 3, wisteria: 4, avoid: [[-W / 2 + 1.4, W / 2 - 1.4]] })
    // warm light spilling out onto the forecourt
    for (const dx of [-5, 0, 5]) {
      const p = F.world(dx, 2.4, fz + 1.4)
      T.lights.push({ x: p.x, y: p.y, z: p.z, color: '#ffd09a', intensity: 4, dist: 9, priority: 3 })
    }
    // solid body (the glass front blocks too)
    const a = F.world(-W / 2 - 0.7, 0, -Dd / 2)
    const b = F.world(W / 2 + 0.7, 0, Dd / 2 + 0.7)
    T.colliders.push({ kind: 'box', minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minZ: Math.min(a.z, b.z), maxZ: Math.max(a.z, b.z), h: H })
    // the podium car out front, ringed by gold posts and velvet ropes
    const px = X - 4.0 // clear of the showroom door
    const pz = Z + 5.15
    T.batch.put(new THREE.CylinderGeometry(2.7, 2.85, 0.32, 40), trim, px, 0.16, pz)
    T.batch.put(new THREE.TorusGeometry(2.78, 0.04, 6, 48).rotateX(Math.PI / 2), O.goldTrim, px, 0.33, pz)
    T.batch.put(new THREE.RingGeometry(2.3, 2.62, 48).rotateX(-Math.PI / 2), O.glow, px, 0.325, pz, 0, 1, 1, 1, { cast: false })
    sportsCar(Frame.at(T.batch, px, 0.32, pz, 2.2), CARS[0], D)
    T.colliders.push({ kind: 'circle', x: px, z: pz, r: 2.85, h: 1.2 })
    T.lights.push({ x: px, y: 3.2, z: pz, color: '#fff0d8', intensity: 6, dist: 7, priority: 2 })
    // a small info lectern by the podium
    const info = new THREE.MeshStandardMaterial({ map: panelTexture('PUMPKIN PHANTOM GT', 'gold paint · gold rims · zero chill', 2.2, PANEL.dark, D), roughness: 0.6 })
    D.push(info)
    const lF = Frame.at(T.batch, px + 3.3, 0, pz - 0.4, -Math.PI / 2 - 0.4)
    lF.box(0.08, 1.0, 0.08, O.iron, 0, 0.5, 0)
    lF.put(new THREE.PlaneGeometry(0.9, 0.42).rotateX(-0.6), info, 0, 1.08, 0.05, 0, 0, 0, false)
    T.colliders.push({ kind: 'circle', x: px + 3.3, z: pz - 0.4, r: 0.3, h: 1.1 })
  }

  /* ── CHAD MOTORS SERVICE: the separate workshop east of the showroom — brick shed, two lit roller-door bays (one with a car on a hoist),
        a gilded sign, tyre stacks and drums in the yard. Dressed, not enterable (closed doors say so). ── */
  {
    const brick = archMats(T, 'brick', stoneTex, glass)
    const W = { x: 77, z: 49, w: 12, d: 9 }
    const H = 5.4
    const F = Frame.at(T.batch, W.x, 0, W.z, Math.PI) // front (+z local) faces north, onto Motor Row
    const fz = W.d / 2
    const dark = new THREE.MeshStandardMaterial({ color: '#26252b', metalness: 0.7, roughness: 0.4 })
    D.push(dark)
    F.put(boxUV(W.w, H, W.d, 2), brick.wall, 0, H / 2, 0)
    F.put(boxUV(W.w + 0.14, 0.5, W.d + 0.14, 1.2), brick.plinth, 0, 0.25, 0)
    F.put(boxUV(W.w + 0.4, 0.34, W.d + 0.4, 1.2), brick.trim, 0, H + 0.1, 0)
    F.put(boxUV(W.w + 0.3, 0.7, 0.3, 1), brick.wall, 0, H + 0.6, fz - 0.1) // front parapet
    F.put(boxUV(W.w + 0.5, 0.1, 0.4, 1), brick.trim, 0, H + 1.0, fz - 0.1)
    // two roller-door bays: stone surround, the lit workshop beyond, a half-raised shutter above
    const bay = displayMaterial(T, '#ffb870', 'racks')
    for (const sx of [-1, 1]) {
      const bx = sx * 3.0
      for (const jx of [-1, 1]) F.box(0.45, 3.9, 0.3, brick.trim, bx + jx * 1.75, 1.95, fz + 0.1)
      F.box(4.0, 0.5, 0.34, brick.trim, bx, 4.0, fz + 0.12)
      F.put(new THREE.PlaneGeometry(3.1, 3.3), bay, bx, 1.75, fz + 0.03, 0, 0, 0, false)
      F.put(boxUV(3.2, 1.0, 0.16, 1), dark, bx, 3.45, fz + 0.1)
      for (let k = 0; k < 4; k++) F.box(3.2, 0.03, 0.18, brick.frame, bx, 3.0 + k * 0.22, fz + 0.12)
      F.box(3.4, 0.12, 0.4, brick.plinth, bx, 0.06, fz + 0.2)
      T.lights.push({ x: F.world(bx, 2.4, fz + 1.6).x, y: 2.4, z: F.world(bx, 2.4, fz + 1.6).z, color: '#ffd09a', intensity: 3.4, dist: 8, priority: 2 })
    }
    sportsCar(F.sub(-3.0, 0.9, fz + 3.0, 0, Math.PI / 2, 0), CARS[1], D) // up on the hoist in front of the left bay
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) F.box(0.14, 0.9, 0.14, dark, -3.0 + sz * 1.0, 0.45, fz + 3.0 + sx * 1.6)
    T.colliders.push({ kind: 'box', minX: W.x + 0.7, maxX: W.x + 5.3, minZ: W.z - fz - 4.2, maxZ: W.z - fz - 1.8, h: 1.6 }) // the car on the hoist (world x = W.x − local x)
    ornateSign(T, F.sub(0, H - 0.15, fz + 0.1), 'MOTORS SERVICE', { h: 0.9, crest: 'crown' })
    climbers(T, F.sub(0, 0, fz + 0.25), W.w + 0.6, H, 57, { ivy: 2, wisteria: 1, avoid: [[-4.8, -1.2], [1.2, 4.8]] })
    // roof lights + a vent stack, a gutter run
    for (const sx of [-3, 3]) F.put(boxUV(2.4, 0.4, 1.6, 1), brick.glass, sx, H + 0.4, -0.5)
    F.put(new THREE.CylinderGeometry(0.22, 0.26, 2.0, 10), dark, 4.6, H + 1.2, -2.5)
    detailWalls(T, F, { x: W.x, z: W.z, w: W.w, d: W.d, floors: 1, ry: Math.PI, roof: 'parapet' }, brick, H, 0)
    // the yard: tyre stacks, oil drums, a workbench, cones — and a notice that the workshop opens later
    const rubber = new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.9 })
    const drum = new THREE.MeshStandardMaterial({ color: '#7a2a1e', metalness: 0.5, roughness: 0.6 })
    D.push(rubber, drum)
    const Y = Frame.at(T.batch, W.x, 0, W.z - fz - 2.4, 0)
    for (let k = 0; k < 4; k++) Y.put(new THREE.TorusGeometry(0.42, 0.17, 8, 14).rotateX(Math.PI / 2), rubber, -4.6, 0.17 + k * 0.34, 0)
    for (let k = 0; k < 3; k++) Y.put(new THREE.TorusGeometry(0.42, 0.17, 8, 14).rotateX(Math.PI / 2), rubber, -3.6, 0.17 + k * 0.34, 0.5)
    for (const dx of [4.4, 5.1]) Y.put(new THREE.CylinderGeometry(0.34, 0.34, 0.9, 12), drum, dx, 0.45, 0)
    Y.box(1.8, 0.1, 0.7, P.woodLight, 2.6, 0.9, 0.3)
    for (const sx of [-0.8, 0.8]) Y.box(0.08, 0.9, 0.6, dark, 2.6 + sx, 0.45, 0.3)
    const note = new THREE.MeshStandardMaterial({ map: panelTexture('WORKSHOP', 'doors closed · opens in a later chapter', 2.2, PANEL.dark, D), roughness: 0.7 })
    D.push(note)
    postedBoard(Y.sub(0.4, 0, 1.4, 0, 0.3, 0), 1.5, 0.7, 1.2, note, { frame: P.iron, metal: P.iron, gold: P.gold, stone: P.stoneLight }, true)
    T.colliders.push({ kind: 'circle', x: Y.world(0.4, 0, 1.4).x, z: Y.world(0.4, 0, 1.4).z, r: 0.6, h: 1.8 })
    T.colliders.push({ kind: 'box', minX: W.x - W.w / 2 - 0.4, maxX: W.x + W.w / 2 + 0.4, minZ: W.z - W.d / 2 - 0.4, maxZ: W.z + W.d / 2 + 0.4, h: H })
  }

  /* ── dressing: flower tubs, troughs, benches, lamps, the street sign, trees on the north side ── */
  for (const [x, z] of [[33.2, Z + 3.2], [42.8, Z + 3.2], [30.4, Z - 2.9], [62.4, Z - 2.9]] as const) flowerTub(T, x, z)
  for (const x of [36, 51, 58]) flowerTub(T, x, Z - 3.0, { long: 2.6 })
  // the street name on a hanging sign at the west end
  const SMt: SignMats = { frame: P.iron, metal: P.iron, gold: P.gold, stone: P.stoneLight }
  const nameMat = new THREE.MeshStandardMaterial({ map: panelTexture('MOTOR ROW', 'chad pets · chad motors', 2.6, PANEL.purple, D), roughness: 0.7 })
  D.push(nameMat)
  T.batch.put(new THREE.CylinderGeometry(0.08, 0.1, 3.4, 8), P.iron, 30.2, 1.7, Z - 2.6)
  hangingSign(Frame.at(T.batch, 30.2, 2.8, Z - 2.6, Math.PI / 2), 1.6, 0.5, nameMat, SMt, 0.4)
  T.colliders.push({ kind: 'circle', x: 30.2, z: Z - 2.6, r: 0.2, h: 3.4 })
}

/** lamp posts, trees and bushes for Motor Row (World adds them through its usual lamp + greenery passes) */
export const MOTOR_ROW_LAMPS: [number, number][] = [[34.5, MOTOR_ROW.z - 2.6], [44, MOTOR_ROW.z - 2.6], [54.5, MOTOR_ROW.z - 2.6], [62.6, MOTOR_ROW.z + 2.6], [44.4, MOTOR_ROW.z + 2.6], [31.6, MOTOR_ROW.z + 2.6]]
export const MOTOR_ROW_TREES: [number, number][] = [[39.5, 31.8], [60, 31.6], [64, 44], [64, 54], [33, 54]]
