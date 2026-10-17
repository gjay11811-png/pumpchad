import * as THREE from 'three'
import { isNight } from './daylight'
import type { Town } from './buildings'
import { ARCADE, ARCADE_STREET } from './city'
import { wallBays } from './facadeKit'
import { tube } from '../gym/gymArt'
import { boxUV } from './kit'
import { GYM } from './props'
import { Frame, PANEL, channelLetters, framedBoard, panelTexture, postedBoard, type SignMats } from './signs'
import { archMats, displayMaterial, planterBox, shop } from './architecture'
import { gymExterior } from './gymExterior'

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
type D = (THREE.Material | THREE.Texture | THREE.BufferGeometry)[]

/** fictional arcade-game poster (no claims, just fun) */
function posterTexture(title: string, tag: string, a: string, b: string, D: D) {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 384
  const g = c.getContext('2d')!
  const grd = g.createLinearGradient(0, 0, 0, 384)
  grd.addColorStop(0, a)
  grd.addColorStop(1, b)
  g.fillStyle = grd
  g.fillRect(0, 0, 256, 384)
  // a big stylised pumpkin / crown motif
  g.fillStyle = 'rgba(0,0,0,0.25)'
  g.beginPath()
  g.ellipse(128, 190, 92, 80, 0, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#ffb24a'
  g.beginPath()
  g.moveTo(70, 150)
  g.lineTo(186, 150)
  g.lineTo(196, 96)
  g.lineTo(160, 122)
  g.lineTo(128, 80)
  g.lineTo(96, 122)
  g.lineTo(60, 96)
  g.closePath()
  g.fill()
  g.fillStyle = '#fff4dc'
  g.textAlign = 'center'
  g.font = '400 50px Anton, Impact, sans-serif'
  g.fillText(title, 128, 300)
  g.font = '600 18px "JetBrains Mono", monospace'
  g.fillText(tag, 128, 336)
  g.strokeStyle = '#ffb24a'
  g.lineWidth = 6
  g.strokeRect(8, 8, 240, 368)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  D.push(t)
  return t
}

export function eastside(T: Town, stoneTex: THREE.Texture) {
  const P = T.P
  const Dp = T.disposables
  const std = (p: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.8, ...p })
    Dp.push(m)
    return m
  }
  const glass = std({ color: '#3a5068', roughness: 0.08, metalness: 0.65, emissive: '#0c1422' })
  const SM: SignMats = { frame: P.iron, metal: P.iron, gold: P.gold, stone: P.stoneLight }
  const darkMetal = std({ color: '#26252b', metalness: 0.7, roughness: 0.4 })
  const orangeLetters = std({ color: '#ff8a2a', metalness: 0.3, roughness: 0.45, ...(isNight() ? { emissive: '#ff8a2a', emissiveIntensity: 1.8 } : {}) })
  const lightStrip = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffcf8a').multiplyScalar(1.25), toneMapped: false })
  Dp.push(lightStrip)
  const stone = archMats(T, 'stone', stoneTex, glass)
  const render = archMats(T, 'render', stoneTex, glass)
  const brick = archMats(T, 'brick', stoneTex, glass)

  /* ═════════ PUMP GYM exterior (the interior + its door interaction are unchanged): see gymExterior.ts ═════════ */
  gymExterior(T, stoneTex)

  /* ═════════ the outdoor training yard (south of the gym) ═════════ */
  {
    const x0 = 15.6
    const x1 = 29.4
    const z0 = 2.0
    const z1 = 11.6
    const rubber = std({ color: '#2a2a2e', roughness: 0.95 })
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2)
    T.batch.put(g, rubber, (x0 + x1) / 2, 0.02, (z0 + z1) / 2, 0, 1, 1, 1, { cast: false })
    for (const lz of [z0 + 0.3, z1 - 0.3]) T.batch.put(new THREE.BoxGeometry(x1 - x0 - 0.6, 0.006, 0.08), P.glowOrange, (x0 + x1) / 2, 0.026, lz, 0, 1, 1, 1, { cast: false })
    // low wall + railing round three sides (open to the gym forecourt on the west and the street on the north-west)
    const wall = (ax: number, az: number, bx: number, bz: number) => {
      const len = Math.hypot(bx - ax, bz - az)
      const ang = Math.atan2(bx - ax, bz - az)
      T.batch.put(boxUV(0.35, 0.7, len, 1.2), brick.wall, (ax + bx) / 2, 0.35, (az + bz) / 2, ang)
      T.batch.put(boxUV(0.45, 0.08, len + 0.1, 1.2), brick.trim, (ax + bx) / 2, 0.74, (az + bz) / 2, ang)
      const n = Math.max(1, Math.round(len / 2))
      for (let k = 0; k <= n; k++) T.batch.put(new THREE.BoxGeometry(0.06, 0.7, 0.06), darkMetal, ax + ((bx - ax) * k) / n, 1.12, az + ((bz - az) * k) / n)
      T.batch.put(new THREE.BoxGeometry(0.05, 0.05, len), darkMetal, (ax + bx) / 2, 1.45, (az + bz) / 2, ang)
      T.colliders.push({ kind: 'box', minX: Math.min(ax, bx) - 0.2, maxX: Math.max(ax, bx) + 0.2, minZ: Math.min(az, bz) - 0.2, maxZ: Math.max(az, bz) + 0.2, h: 1.4 })
    }
    wall(x1, z0, x1, z1) // east
    wall(x0 + 4.2, z1, x1, z1) // north (opening at the west end, toward the street)
    wall(x0 + 0.4, z1, x0 + 1.2, z1)
    // calisthenics rig: three posts, pull-up bars at two heights, a monkey-bar ladder on top, parallel dip bars
    const rx = 23.5
    const rz = 9.6
    for (const dx of [-2.6, 0, 2.6]) {
      T.batch.put(tube(V(rx + dx, 0, rz), V(rx + dx, 2.7, rz), 0.06, 10), darkMetal, 0, 0, 0)
      T.batch.put(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 12), darkMetal, rx + dx, 0.03, rz)
      T.colliders.push({ kind: 'circle', x: rx + dx, z: rz, r: 0.18, h: 2.7 })
    }
    T.batch.put(tube(V(rx - 2.6, 2.45, rz), V(rx, 2.45, rz), 0.022, 10), P.iron, 0, 0, 0)
    T.batch.put(tube(V(rx, 2.15, rz), V(rx + 2.6, 2.15, rz), 0.022, 10), P.iron, 0, 0, 0)
    for (const dz of [-0.35, 0.35]) T.batch.put(tube(V(rx - 2.6, 2.7, rz + dz), V(rx + 2.6, 2.7, rz + dz), 0.03, 8), darkMetal, 0, 0, 0)
    for (let k = 0; k < 11; k++) T.batch.put(tube(V(rx - 2.5 + k * 0.5, 2.7, rz - 0.35), V(rx - 2.5 + k * 0.5, 2.7, rz + 0.35), 0.016, 6), P.iron, 0, 0, 0)
    for (const dx of [-0.3, 0.3]) {
      T.batch.put(tube(V(rx + 4.2 + dx, 1.05, rz - 0.7), V(rx + 4.2 + dx, 1.05, rz + 0.7), 0.025, 8), P.iron, 0, 0, 0)
      for (const dz of [-0.6, 0.6]) T.batch.put(tube(V(rx + 4.2 + dx, 0, rz + dz), V(rx + 4.2 + dx, 1.05, rz + dz), 0.035, 8), darkMetal, 0, 0, 0)
    }
    T.colliders.push({ kind: 'box', minX: rx + 3.8, maxX: rx + 4.6, minZ: rz - 0.8, maxZ: rz + 0.8, h: 1.1 })
    // plyo boxes (three heights), a tractor tyre + sledgehammer, a battle rope round an anchor post, kettlebells
    const ply = std({ map: P.woodLight.map, color: '#c99a62', roughness: 0.7 })
    for (const [bx, bz, h] of [[18, 4.0, 0.5], [19.2, 4.0, 0.75], [20.5, 4.0, 0.6]] as const) {
      T.batch.put(new THREE.BoxGeometry(0.9, h, 0.75), ply, bx, h / 2, bz)
      T.batch.put(new THREE.BoxGeometry(0.92, 0.04, 0.77), P.glowOrange, bx, h - 0.1, bz, 0, 1, 1, 1, { cast: false })
      T.colliders.push({ kind: 'box', minX: bx - 0.45, maxX: bx + 0.45, minZ: bz - 0.38, maxZ: bz + 0.38, h })
    }
    T.batch.put(new THREE.TorusGeometry(0.62, 0.26, 10, 22).rotateX(Math.PI / 2), P.rock, 26.5, 0.26, 4.4)
    T.batch.put(new THREE.TorusGeometry(0.62, 0.27, 10, 22).rotateX(Math.PI / 2), std({ color: '#1a1a1c', roughness: 0.9 }), 26.5, 0.26, 4.4)
    T.colliders.push({ kind: 'circle', x: 26.5, z: 4.4, r: 0.95, h: 0.55 })
    T.batch.put(tube(V(27.5, 0.05, 3.2), V(27.9, 0.95, 3.4), 0.02, 6), P.woodLight, 0, 0, 0)
    T.batch.put(new THREE.BoxGeometry(0.26, 0.14, 0.14), darkMetal, 27.95, 1.0, 3.42)
    T.batch.put(new THREE.CylinderGeometry(0.1, 0.12, 0.8, 10), darkMetal, 28.6, 0.4, 7.2)
    T.colliders.push({ kind: 'circle', x: 28.6, z: 7.2, r: 0.2, h: 0.8 })
    const rope = std({ color: '#3a3328', roughness: 0.95 })
    for (const dz of [-0.12, 0.12]) {
      const curve = new THREE.CatmullRomCurve3([V(28.5, 0.3, 7.2 + dz), V(27.2, 0.06, 7.3 + dz * 4), V(25.8, 0.06, 6.9 + dz * 6), V(24.6, 0.07, 7.3 + dz * 8)])
      T.batch.put(new THREE.TubeGeometry(curve, 24, 0.04, 6, false), rope, 0, 0, 0)
    }
    // signs: the yard board + the house rules (with the one rule everyone needs)
    const yard = std({ map: panelTexture('PUMP GYM · OUTDOOR YARD', 'warm up out here · lift inside', 3.2, PANEL.dark, Dp) })
    postedBoard(Frame.at(T.batch, 17.4, 0, z1 - 0.5, 0), 2.8, 0.85, 1.6, yard, SM, true)
    T.colliders.push({ kind: 'box', minX: 15.9, maxX: 18.9, minZ: z1 - 0.7, maxZ: z1 - 0.3, h: 2.2 })
    const rules = std({ map: panelTexture('NO CURLING IN THE SQUAT RACK', 'by order of Coach Gourdon', 3.6, PANEL.cream, Dp) })
    framedBoard(Frame.at(T.batch, GYM.x, 4.3, GYM.z + 5.27, 0), 2.8, 0.72, rules, SM) // above the yard windows
  }

  /* ═════════ ARCADE STREET ═════════ */
  {
    const z = ARCADE_STREET.z
    const xa = 2.6
    const xb = ARCADE.x - 5.4
    const g = new THREE.PlaneGeometry(xb - xa, 6.4).rotateX(-Math.PI / 2)
    const u = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < u.count; i++) u.setXY(i, (u.getX(i) * (xb - xa)) / 3, (u.getY(i) * 6.4) / 3)
    T.batch.put(g, P.cobble, (xa + xb) / 2, 0.025, z, 0, 1, 1, 1, { cast: false })
    for (const s of [-1, 1]) T.batch.put(boxUV(xb - xa, 0.14, 0.28, 1), P.stoneLight, (xa + xb) / 2, 0.07, z + s * 3.34, 0, 1, 1, 1, { cast: false })
    // shops: north side faces south (ry 0), south side faces north (ry π). The two nearest the arcade stand 2.3 m further back and 1.4 m narrower than they
    // used to, so the arcade has an open forecourt of its own (~9 m deep) instead of being pinched at the end of the street
    const awnA = std({ color: '#e8641a', roughness: 0.75, side: THREE.DoubleSide })
    const awnB = std({ color: '#5b2a86', roughness: 0.75, side: THREE.DoubleSide })
    shop(T, render, { x: 32.9, z: 12.2, w: 5.8, d: 6, floors: 2, ry: 0, roof: 'pitched', name: 'PUMP SUPPLY', sub: 'straps · chalk · shakers', sign: 'ornate', crest: 'crown', greenery: true, panel: PANEL.green, awning: awnA, display: displayMaterial(T, '#5fae6a', 'shelves') })
    shop(T, brick, { x: 39.1, z: 12.0, w: 6.0, d: 6.2, floors: 2, ry: 0, roof: 'mansard', name: 'CHAD SNACKS', sign: 'ornate', crest: 'pumpkin', greenery: true, display: displayMaterial(T, '#ffb24a', 'shelves'), balcony: true }, orangeLetters)
    shop(T, stone, { x: 32.9, z: 26.0, w: 5.8, d: 6, floors: 2, ry: Math.PI, roof: 'parapet', name: 'CHAD CUTS', sub: 'fades · beards · confidence', sign: 'ornate', crest: 'crown', greenery: true, panel: PANEL.cream, display: displayMaterial(T, '#b8c4d6', 'shelves') })
    shop(T, render, { x: 39.1, z: 26.0, w: 6.0, d: 6, floors: 2, ry: Math.PI, roof: 'pitched', name: 'CHAD FITS', sub: 'tees · hoodies · caps', sign: 'ornate', crest: 'crown', greenery: true, panel: PANEL.purple, awning: awnB, display: displayMaterial(T, '#9b6bff', 'racks'), balcony: true })
    // planters + benches along the street, lamp posts handled by the caller
    for (const px of [10, 18, 26]) for (const s of [-1, 1]) planterBox(T, P.stoneLight, px, z + s * 4.3, 1.6, 0.8)
  }

  /* ═════════ PUMP ARCADE ═════════ */
  {
    const W = 17 // along the facade (world z)
    // a shallower building set back to the district's east edge: the street ends in a real forecourt instead of running into the facade
    const Dd = 7
    const H = 9.4
    const AX = ARCADE.x + 1.75 // centre of the building (its east wall stays where it was)
    const F = Frame.at(T.batch, AX, 0, ARCADE.z, -Math.PI / 2) // faces west down the street
    const fz = Dd / 2
    const panelDark = std({ color: '#2a2036', roughness: 0.55, metalness: 0.3 })
    const purpleTrim = std({ color: '#7a4ad8', roughness: 0.4, metalness: 0.4 })
    const bulb = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd27a').multiplyScalar(1.4), toneMapped: false })
    const neonLetters = new THREE.MeshStandardMaterial({ color: '#ffb24a', emissive: '#ff8a1a', emissiveIntensity: isNight() ? 2.2 : 0.55, metalness: 0.2, roughness: 0.4 })
    Dp.push(bulb, neonLetters)
    F.put(boxUV(W, H, Dd, 2), stone.wall, 0, H / 2, 0)
    F.put(boxUV(W + 0.2, 0.6, Dd + 0.2, 1.2), stone.plinth, 0, 0.3, 0)
    // the two side walls (north and south, facing the lanes) and the back wall: plinth, stone pilasters between bays, two rows of framed windows (the upper row arched),
    // a string course between the floors, a cornice, downpipes and wall lanterns — the building reads as a whole from every side, not a facade on a box
    {
      const WM = { frame: purpleTrim, trim: stone.trim, plinth: stone.plinth, metal: darkMetal }
      const o = { height: H, rows: [[2.4, 2.1], [6.6, 2.2]] as [number, number][], maxWindow: 1.5, arch: true, plinth: 0.6, strings: [4.35], cornice: 0.5, downpipe: true, lanterns: bulb, pilaster: 0.5 }
      wallBays(T, F.sub(W / 2, 0, 0, 0, Math.PI / 2, 0), WM, { ...o, length: Dd, seed: 1 })
      wallBays(T, F.sub(-W / 2, 0, 0, 0, -Math.PI / 2, 0), WM, { ...o, length: Dd, seed: 2 })
      wallBays(T, F.sub(0, 0, -fz, 0, Math.PI, 0), WM, { ...o, length: W, seed: 3 })
    }
    // facade: dark purple panels framed in stone pilasters, orange accent lines
    for (const px of [-7.4, -4.6, 4.6, 7.4]) F.put(boxUV(0.7, H, 0.4, 1.2), stone.trim, px, H / 2, fz + 0.15)
    for (const sx of [-1, 1]) {
      F.box(2.1, H - 1.4, 0.1, panelDark, sx * 6.0, (H - 1.4) / 2 + 0.6, fz + 0.04)
      F.box(2.1, 0.06, 0.12, P.glowOrange, sx * 6.0, H - 0.75, fz + 0.1, false)
    }
    // lightbox posters for (fictional) games, framed, either side of the entrance
    const posters = [
      ['PUMP RUSH II', 'faster pumpkins', '#ff7a1a', '#7a1a1a'],
      ['BEAR BUSTER', 'two players · one bear', '#3a2a6a', '#120a24'],
      ['CHAD KART', 'drift into gains', '#1a6a6a', '#0a2424'],
      ['GAINS GALAXY', 'lift among the stars', '#5b2a86', '#100820'],
    ] as const
    posters.forEach(([t, s, a, b], i) => {
      const sx = i < 2 ? -1 : 1
      const y = i % 2 ? 4.8 : 2.0
      const mat = new THREE.MeshBasicMaterial({ map: posterTexture(t, s, a, b, Dp), color: '#e8e2da' })
      Dp.push(mat)
      if (i % 2 === 0) return // the lower bays are lit display windows (below), not posters
      F.box(1.5, 2.2, 0.14, darkMetal, sx * 6.0, y, fz + 0.12)
      F.put(new THREE.PlaneGeometry(1.32, 1.98), mat, sx * 6.0, y, fz + 0.2, 0, 0, 0, false)
    })
    // lit cabinet windows either side of the entrance: stone surround, purple frame, gold keystone and sill
    const cabinets = displayMaterial(T, '#b57aff', 'cabinets')
    for (const sx of [-1, 1]) {
      const wx = sx * 6.0
      F.put(new THREE.PlaneGeometry(1.7, 2.3), cabinets, wx, 2.0, fz + 0.1, 0, 0, 0, false)
      F.put(new THREE.PlaneGeometry(1.7, 2.3), glass, wx, 2.0, fz + 0.14, 0, 0, 0, false)
      for (const [bw, bh, bx, by] of [[1.9, 0.14, 0, 3.2], [1.9, 0.14, 0, 0.8], [0.14, 2.5, -0.9, 2.0], [0.14, 2.5, 0.9, 2.0], [0.08, 2.3, 0, 2.0]] as const) F.box(bw, bh, 0.16, purpleTrim, wx + bx, by, fz + 0.16)
      F.box(2.3, 0.3, 0.3, stone.trim, wx, 3.5, fz + 0.18) // lintel
      F.box(0.4, 0.4, 0.34, P.gold, wx, 3.52, fz + 0.2) // keystone
      F.box(2.3, 0.2, 0.36, stone.trim, wx, 0.65, fz + 0.2) // sill
    }
    F.box(Dd * 0 + 15.2, 0.22, 0.2, stone.trim, 0, 4.35, fz + 0.1) // string course between the floors
    // recessed entrance: stone portal, closed double doors with porthole windows, an OPENING SOON plaque
    for (const sx of [-1, 1]) F.box(0.7, 4.6, 0.5, stone.trim, sx * 2.45, 2.3, fz + 0.2) // jambs
    F.box(5.6, 0.9, 0.5, stone.trim, 0, 4.15, fz + 0.2) // lintel
    F.box(4.4, 3.8, 0.3, darkMetal, 0, 1.9, fz - 0.05)
    F.box(4.6, 0.12, 0.62, P.gold, 0, 4.66, fz + 0.2) // gold cornice over the lintel
    for (const dx of [-1.05, 1.05]) {
      F.box(2.0, 3.3, 0.08, purpleTrim, dx, 1.67, fz + 0.38)
      F.put(new THREE.CircleGeometry(0.32, 20), glass, dx, 2.3, fz + 0.43, 0, 0, 0, false)
      F.put(new THREE.TorusGeometry(0.34, 0.04, 6, 20), P.gold, dx, 2.3, fz + 0.43)
      F.box(0.06, 0.8, 0.08, P.gold, dx - Math.sign(dx) * 0.8, 1.5, fz + 0.46)
    }
    const soon = std({ map: panelTexture('OPENING SOON', 'the cabinets are being polished', 2.6, PANEL.purple, Dp) })
    framedBoard(F.sub(0, 3.75, fz + 0.5), 2.2, 0.6, soon, SM)
    // marquee: projecting canopy, chaser bulbs, PUMP ARCADE letters on its face
    const mq = F.sub(0, 5.3, fz + 1.6)
    mq.box(9.2, 1.5, 3.2, darkMetal, 0, 0, 0)
    mq.box(9.3, 0.1, 3.3, purpleTrim, 0, -0.78, 0)
    mq.box(8.6, 0.04, 2.6, P.glowOrange, 0, -0.84, 0, false)
    for (let k = 0; k < 24; k++) mq.put(new THREE.SphereGeometry(0.06, 8, 6), bulb, -4.5 + k * (9 / 23), 0.82, 1.62, 0, 0, 0, false)
    for (let k = 0; k < 24; k++) mq.put(new THREE.SphereGeometry(0.06, 8, 6), bulb, -4.5 + k * (9 / 23), -0.62, 1.62, 0, 0, 0, false)
    channelLetters(mq.sub(0, -0.38, 1.6), 'PUMP ARCADE', 0.72, 0.09, neonLetters)
    for (const sx of [-1, 1]) F.put(tube(V(sx * 4.2, 5.95, fz + 3.1), V(sx * 4.2, 7.6, fz + 0.1), 0.035, 6), darkMetal)
    // roofline: stepped parapet rising to a crowned centre gable
    for (let i = -4; i <= 4; i++) {
      const h = 0.8 + (4 - Math.abs(i)) * 0.35
      F.put(boxUV(1.85, h, 0.5, 1), stone.trim, i * 1.9, H + h / 2, fz - 0.1)
      F.box(1.9, 0.08, 0.56, purpleTrim, i * 1.9, H + h + 0.04, fz - 0.1)
    }
    const crown = new THREE.Shape([[-1, 0], [1, 0], [1.08, 1.0], [0.62, 0.62], [0.32, 1.25], [0, 0.72], [-0.32, 1.25], [-0.62, 0.62], [-1.08, 1.0]].map(([a, b]) => new THREE.Vector2(a * 1.1, b * 1.1)))
    const cg = new THREE.ExtrudeGeometry(crown, { depth: 0.24, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1 })
    F.put(cg, P.gold, 0, H + 2.25, fz - 0.22)
    // blade sign on the corner: ARCADE in a tall framed panel, mounted on two brackets
    const blade = std({ map: panelTexture('ARCADE', null, 0.42, PANEL.purple, Dp) })
    const B = F.sub(W / 2 - 0.4, 5.2, fz + 0.9, 0, Math.PI / 2, 0)
    framedBoard(B, 1.5, 3.4, blade, SM, true, 0.12)
    for (const y of [-1.2, 1.2]) F.box(0.08, 0.08, 0.8, darkMetal, W / 2 - 0.4, 5.2 + y, fz + 0.45)
    T.colliders.push({ kind: 'box', minX: AX - Dd / 2, maxX: AX + Dd / 2 + 0.3, minZ: ARCADE.z - W / 2, maxZ: ARCADE.z + W / 2, h: H })
    // the arcade forecourt: a paved plaza with a purple/orange inlay, lit bollards, planters and two pylon signs flanking the facade
    for (const [w, c] of [[3.4, P.glowOrange], [3.0, purpleTrim]] as const) T.batch.put(new THREE.RingGeometry(w - 0.12, w, 48).rotateX(-Math.PI / 2), c, AX - Dd / 2 - 3.6, 0.03, ARCADE.z, 0, 1, 1, 1, { cast: false })
    T.batch.put(new THREE.CircleGeometry(2.9, 40).rotateX(-Math.PI / 2), P.stoneLight, AX - Dd / 2 - 3.6, 0.028, ARCADE.z, 0, 1, 1, 1, { cast: false })
    {
      const x0 = ARCADE.x - 5.4
      const x1 = AX - Dd / 2 + 0.2
      const pg = new THREE.PlaneGeometry(x1 - x0, 9).rotateX(-Math.PI / 2)
      const pu = pg.attributes.uv as THREE.BufferAttribute
      for (let i = 0; i < pu.count; i++) pu.setXY(i, (pu.getX(i) * (x1 - x0)) / 3, (pu.getY(i) * 9) / 3)
      T.batch.put(pg, P.cobble, (x0 + x1) / 2, 0.025, ARCADE.z, 0, 1, 1, 1, { cast: false }) // the street runs on into the forecourt, wider than the street itself
    }
    // two tall neon pylons give the landmark a silhouette that reads from down the street
    for (const sx of [-1, 1]) {
      const px = sx * (W / 2 + 0.2)
      F.box(0.7, 13.2, 0.7, panelDark, px, 6.6, fz + 0.4)
      F.box(0.5, 11.4, 0.08, P.glowOrange, px, 6.5, fz + 0.78, false)
      for (const y of [4, 7.5, 11]) F.put(new THREE.TorusGeometry(0.62, 0.06, 6, 20), neonLetters, px, y, fz + 0.8)
      F.put(new THREE.ConeGeometry(0.5, 1.4, 4).rotateY(Math.PI / 4), P.gold, px, 13.9, fz + 0.4)
      T.colliders.push({ kind: 'box', minX: AX - fz - 0.9, maxX: AX - fz + 0.1, minZ: ARCADE.z + px - 0.45, maxZ: ARCADE.z + px + 0.45, h: 13 })
    }
    for (const dz of [-2.4, 0, 2.4]) {
      const bx = AX - Dd / 2 - 7
      T.batch.put(new THREE.CylinderGeometry(0.11, 0.13, 0.8, 10), darkMetal, bx, 0.4, ARCADE.z + dz)
      T.batch.put(new THREE.CylinderGeometry(0.115, 0.115, 0.05, 10), P.glowOrange, bx, 0.76, ARCADE.z + dz, 0, 1, 1, 1, { cast: false })
      T.colliders.push({ kind: 'circle', x: bx, z: ARCADE.z + dz, r: 0.14, h: 0.8 })
    }
  }
}
