import * as THREE from 'three'
import { isNight } from './daylight'
import type { Town } from './buildings'
import { EXPANSION_OPEN, LOCKED_SIGN } from '../../launch'
import { lampPosts } from './props'
import { ARCADE, BRIDGES, CANAL, COURTYARD, DISTRICTS, GARDEN, GATEWAY, OVERLOOK, RIDES, SOCIAL, SPAWN, VALLEY_GATE } from './city'
import { Cloth } from './fx'
import { boxUV } from './kit'
import { Frame, PANEL, boardTexture, channelLetters, postedBoard, type SignMats } from './signs'

type D = (THREE.Material | THREE.Texture | THREE.BufferGeometry)[]

/** PumpChad banner: orange field, dark crown + pumpkin, gold border (reads in sunlight) */
export function cityBannerTexture(D: D, field = '#e8641a') {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 512
  const g = c.getContext('2d')!
  g.fillStyle = field
  g.fillRect(0, 0, 256, 512)
  g.fillStyle = 'rgba(0,0,0,0.12)'
  for (let y = 0; y < 512; y += 6) g.fillRect(0, y, 256, 2) // weave
  g.strokeStyle = '#f2c14e'
  g.lineWidth = 10
  g.strokeRect(16, 16, 224, 440)
  // swallow-tail cut
  g.fillStyle = 'rgba(0,0,0,0)'
  g.globalCompositeOperation = 'destination-out'
  g.beginPath()
  g.moveTo(0, 512)
  g.lineTo(128, 440)
  g.lineTo(256, 512)
  g.fill()
  g.globalCompositeOperation = 'source-over'
  // crown
  g.fillStyle = '#1c1820'
  g.beginPath()
  g.moveTo(58, 170)
  g.lineTo(198, 170)
  g.lineTo(208, 92)
  g.lineTo(168, 128)
  g.lineTo(128, 70)
  g.lineTo(88, 128)
  g.lineTo(48, 92)
  g.closePath()
  g.fill()
  // pumpkin
  g.beginPath()
  g.ellipse(128, 285, 78, 64, 0, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = field
  for (const dx of [-28, 28]) {
    g.beginPath()
    g.moveTo(128 + dx - 14, 270)
    g.lineTo(128 + dx + 14, 270)
    g.lineTo(128 + dx, 250)
    g.fill()
  }
  g.fillRect(96, 300, 64, 10)
  g.fillStyle = '#1c1820'
  g.fillRect(122, 205, 12, 22)
  g.font = '400 54px Anton, Impact, sans-serif'
  g.textAlign = 'center'
  g.fillText('CHAD VILLAGE', 128, 408)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  D.push(t)
  return t
}

/** top-down city map drawn from the real layout constants, with a YOU ARE HERE marker */
export function cityMapTexture(D: D, here: [number, number]) {
  const W = 1024
  const H = 768
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  // world bounds shown: x −62..62, z −46..70
  const sx = (x: number) => ((x + 62) / 124) * (W - 80) + 40
  const sz = (z: number) => ((z + 46) / 116) * (H - 120) + 90
  g.fillStyle = '#efe4cc'
  g.fillRect(0, 0, W, H)
  g.fillStyle = '#d9cdb0'
  for (let i = 0; i < 2000; i++) g.fillRect(Math.random() * W, Math.random() * H, 2, 2)
  g.fillStyle = '#2a2228'
  g.font = '400 54px Anton, Impact, sans-serif'
  g.textAlign = 'center'
  g.fillText('CHAD VILLAGE', W / 2, 62)
  // ground
  g.fillStyle = '#b9cf94'
  g.beginPath()
  g.arc(sx(0), sz(0), (34.5 / 124) * (W - 80), 0, Math.PI * 2)
  g.fill()
  for (const r of Object.values(DISTRICTS)) g.fillRect(sx(r.x0), sz(r.z0), sx(r.x1) - sx(r.x0), sz(r.z1) - sz(r.z0))
  // canal + bridges
  g.fillStyle = '#5fa8c4'
  g.fillRect(sx(CANAL.x0), sz(CANAL.z0), sx(CANAL.x1) - sx(CANAL.x0), sz(CANAL.z1) - sz(CANAL.z0))
  g.fillStyle = '#c9b48a'
  for (const b of BRIDGES) g.fillRect(sx(b.x - b.w / 2), sz(CANAL.z0 - 0.6), sx(b.x + b.w / 2) - sx(b.x - b.w / 2), sz(CANAL.z1 + 0.6) - sz(CANAL.z0 - 0.6))
  // main streets
  g.strokeStyle = '#d8c39a'
  g.lineCap = 'round'
  g.lineWidth = 16
  const street = (pts: [number, number][]) => {
    g.beginPath()
    pts.forEach(([x, z], i) => (i ? g.lineTo(sx(x), sz(z)) : g.moveTo(sx(x), sz(z))))
    g.stroke()
  }
  street([[0, 66], [0, -24]])
  street([[-50, 2.5], [-10, 2.5]])
  street([[10.5, -4], [15.4, -4]])
  street([[3, 19], [ARCADE.x - 3, 19]])
  // square + citadel
  g.fillStyle = '#e8dcc4'
  g.beginPath()
  g.arc(sx(0), sz(0), (11.5 / 124) * (W - 80), 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#8a7a64'
  g.fillRect(sx(-22), sz(-34), sx(22) - sx(-22), sz(-28) - sz(-34))
  // labels
  const label = (t: string, x: number, z: number, col = '#2a2228') => {
    g.font = '400 30px Anton, Impact, sans-serif'
    g.fillStyle = col
    g.fillText(t, sx(x), sz(z))
  }
  label('CHAD CITADEL', 0, -37)
  label('CHAD SQUARE', 0, 1)
  label('PUMP GYM', 18, -9)
  label('PUMP ARCADE', ARCADE.x - 3, 13)
  label('ARCADE ST', 38, 24)
  label('GYM YARD', COURTYARD.x, COURTYARD.z + 3)
  label('MARKET', -20, -2)
  label('SOCIAL CORNER', SOCIAL.x - 4, SOCIAL.z + 6)
  label('GARDEN', GARDEN.x, GARDEN.z)
  label('OVERLOOK', OVERLOOK.x, OVERLOOK.z + 4)
  label('PUMP CANAL', -14, 42.5, '#1f4a5c')
  label('CHAD RIDES', RIDES.x + 4, RIDES.z + 2.5)
  label('GATEWAY', -6, GATEWAY.z + 0.5)
  // you are here
  g.fillStyle = '#e8641a'
  g.beginPath()
  g.arc(sx(here[0]), sz(here[1]), 13, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = '#1c1820'
  g.lineWidth = 4
  g.stroke()
  g.font = '700 22px "JetBrains Mono", monospace'
  g.fillStyle = '#1c1820'
  g.fillText('YOU ARE HERE', sx(here[0]), sz(here[1]) + 36)
  // north arrow
  g.font = '400 34px Anton, Impact, sans-serif'
  g.fillText('N ↑', W - 70, 62)
  g.strokeStyle = '#b8862e'
  g.lineWidth = 8
  g.strokeRect(10, 10, W - 20, H - 20)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  D.push(t)
  return t
}

/** 5-point crown outline (unit width ~2, height ~1.3) */
function crownShape(s: number) {
  const p: [number, number][] = [[-1, 0], [1, 0], [1.08, 1.0], [0.62, 0.62], [0.32, 1.25], [0, 0.72], [-0.32, 1.25], [-0.62, 0.62], [-1.08, 1.0]]
  return new THREE.Shape(p.map(([x, y]) => new THREE.Vector2(x * s, y * s)))
}

export const WELCOME = { x: -6.8, z: 59.6 }
export const MAPBOARD = { x: 6.8, z: 59.6 }

/**
 * The arrival: forecourt paving + planters + benches + lamps, the CHAD VILLAGE gateway, the welcome board,
 * the city map, and the closed valley gate on the road south.
 */
export function arrival(T: Town, stone: THREE.Material, trim: THREE.Material) {
  const P = T.P
  const Dp = T.disposables
  const SMt: SignMats = { frame: P.iron, metal: P.iron, gold: P.gold, stone: trim }
  const gz = GATEWAY.z

  // ── forecourt paving: a broad cobbled avenue + a plaza with stone banding ──
  const pave = (x0: number, x1: number, z0: number, z1: number, y = 0.024, mat: THREE.Material = P.cobble) => {
    const w = x1 - x0
    const d = z1 - z0
    const g = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2)
    const u = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < u.count; i++) u.setXY(i, (u.getX(i) * w) / 3, (u.getY(i) * d) / 3)
    T.batch.put(g, mat, (x0 + x1) / 2, y, (z0 + z1) / 2, 0, 1, 1, 1, { cast: false })
  }
  pave(-3.2, 3.2, CANAL.z1 + 0.6, 47.6) // bridge → forecourt
  pave(-15, 15, 47.6, 68.6)
  pave(-3.2, 3.2, 68.6, 75.4)
  // stone bands across the plaza (every 3.8 m) + a gold compass inlay at the spawn
  for (let z = 49.5; z < 68; z += 3.8) T.batch.put(new THREE.BoxGeometry(30, 0.02, 0.32), trim, 0, 0.036, z, 0, 1, 1, 1, { cast: false })
  T.batch.put(new THREE.RingGeometry(1.5, 1.68, 48).rotateX(-Math.PI / 2), P.gold, SPAWN.x, 0.04, SPAWN.z, 0, 1, 1, 1, { cast: false })
  T.batch.put(new THREE.CircleGeometry(1.5, 48).rotateX(-Math.PI / 2), trim, SPAWN.x, 0.038, SPAWN.z, 0, 1, 1, 1, { cast: false })
  // kerbs along the plaza edge
  for (const x of [-15.15, 15.15]) T.batch.put(boxUV(0.3, 0.14, 21, 1), trim, x, 0.07, 58.1, 0, 1, 1, 1, { cast: false })

  // ── THE GATEWAY ──
  const banner = new THREE.MeshStandardMaterial({ map: cityBannerTexture(Dp), roughness: 0.75, side: THREE.DoubleSide, transparent: true, alphaTest: 0.5 })
  // brushed brass-orange letters: bright in sun, no glow wash
  const letters = new THREE.MeshStandardMaterial({ color: '#f09a32', metalness: 0.35, roughness: 0.48, ...(isNight() ? { emissive: '#ff9a3a', emissiveIntensity: 1.9 } : {}) })
  const darkMetal = new THREE.MeshStandardMaterial({ color: '#25242a', metalness: 0.75, roughness: 0.4 })
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd08a').multiplyScalar(1.3), toneMapped: false })
  Dp.push(banner, letters, darkMetal, glow)
  const H = 9.4 // pylon height
  const OPEN = 4.9 // half the clear opening
  const DEP = 3.2
  for (const s of [-1, 1]) {
    const x = s * (OPEN + 1.3)
    // stepped plinth, the pylon shaft with recessed panels + dark-metal fluting, gold capital, cornice
    T.batch.put(boxUV(3.4, 0.5, DEP + 0.9, 1.5), trim, x, 0.25, gz)
    T.batch.put(boxUV(3.0, 0.6, DEP + 0.5, 1.5), stone, x, 0.8, gz)
    T.batch.put(boxUV(2.6, H - 1.1, DEP, 2), stone, x, 1.1 + (H - 1.1) / 2, gz)
    for (const fz of [gz - DEP / 2 - 0.02, gz + DEP / 2 + 0.02]) {
      T.batch.put(boxUV(1.7, 5.2, 0.06, 1.5), trim, x, 4.2, fz) // recessed panel surround
      for (const dx of [-0.5, 0, 0.5]) T.batch.put(new THREE.BoxGeometry(0.12, 4.6, 0.08), darkMetal, x + dx, 4.2, fz) // fluting
      // pumpkin medallion
      T.batch.put(new THREE.CylinderGeometry(0.48, 0.48, 0.12, 24).rotateX(Math.PI / 2), P.gold, x, 7.25, fz)
      T.batch.put(new THREE.SphereGeometry(0.34, 16, 10).scale(1.2, 0.9, 0.4), P.pumpkin, x, 7.25, fz + Math.sign(fz - gz) * 0.06)
      // integrated uplight at the plinth
      T.batch.put(new THREE.BoxGeometry(1.4, 0.06, 0.06), glow, x, 1.16, fz + Math.sign(fz - gz) * 0.03, 0, 1, 1, 1, { cast: false })
    }
    T.batch.put(boxUV(2.9, 0.35, DEP + 0.3, 1.2), P.gold, x, H - 0.4, gz) // capital band
    T.colliders.push({ kind: 'box', minX: x - 1.5, maxX: x + 1.5, minZ: gz - DEP / 2 - 0.45, maxZ: gz + DEP / 2 + 0.45, h: H })
    // banners on both faces of each pylon (outer edge, so they frame the opening)
    for (const side of [-1, 1]) {
      const c = new Cloth(1.1, 3.4, banner, 0.1)
      c.mesh.position.set(x + s * 0.55, 6.6, gz + side * (DEP / 2 + 0.2))
      c.mesh.rotation.y = side > 0 ? 0 : Math.PI
      T.scene.add(c.mesh)
      T.cloths.push(c)
      T.batch.put(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6).rotateZ(Math.PI / 2), darkMetal, x + s * 0.55, 8.35, gz + side * (DEP / 2 + 0.2))
    }
  }
  // spandrels: the round arch is cut out of the stone between the pylons (extruded shape)
  {
    const sh = new THREE.Shape()
    // elliptical arch: springs at 4.5 m, crown just under the lintel
    const spring = 4.5
    const RISE = 2.55
    sh.moveTo(-OPEN, spring)
    sh.lineTo(-OPEN, H - 2.1)
    sh.lineTo(OPEN, H - 2.1)
    sh.lineTo(OPEN, spring)
    sh.absellipse(0, spring, OPEN, RISE, 0, Math.PI, false, 0)
    const g = new THREE.ExtrudeGeometry(sh, { depth: DEP - 0.4, bevelEnabled: false, curveSegments: 24 })
    g.translate(0, 0, -(DEP - 0.4) / 2)
    const u = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) / 2, u.getY(i) / 2)
    T.batch.put(g, stone, 0, 0, gz)
    // arch ring (voussoirs) on both faces + keystone
    for (const side of [-1, 1]) {
      const ring = new THREE.Shape()
      ring.absellipse(0, spring, OPEN + 0.45, RISE + 0.4, 0, Math.PI, false, 0)
      ring.lineTo(-OPEN, spring)
      ring.absellipse(0, spring, OPEN, RISE, Math.PI, 0, true, 0)
      ring.closePath()
      const rg = new THREE.ExtrudeGeometry(ring, { depth: 0.12, bevelEnabled: false, curveSegments: 28 })
      T.batch.put(rg, trim, 0, 0, gz + side * ((DEP - 0.4) / 2 + (side > 0 ? 0 : 0.12)))
      T.batch.put(boxUV(0.7, 0.6, 0.2, 1), trim, 0, spring + RISE + 0.15, gz + side * ((DEP - 0.4) / 2 + 0.08))
    }
  }
  // the lintel: stone entablature with a dark-metal sign band carrying CHAD CITY on both faces
  {
    const y0 = H - 2.1
    T.batch.put(boxUV(OPEN * 2 + 5.4, 2.4, DEP + 0.2, 2), stone, 0, y0 + 1.2, gz)
    T.batch.put(boxUV(OPEN * 2 + 5.8, 0.3, DEP + 0.6, 1.5), trim, 0, y0 + 2.55, gz) // cornice
    T.batch.put(boxUV(OPEN * 2 + 5.6, 0.18, DEP + 0.4, 1.5), trim, 0, y0 + 0.09, gz) // architrave
    for (const side of [-1, 1]) {
      const fz = gz + side * (DEP / 2 + 0.1)
      T.batch.put(new THREE.BoxGeometry(11.6, 1.75, 0.12), darkMetal, 0, y0 + 1.2, fz + side * 0.06)
      for (const dx of [-5.6, 5.6]) T.batch.put(new THREE.BoxGeometry(0.1, 1.75, 0.2), P.gold, dx, y0 + 1.2, fz + side * 0.08)
      const F = Frame.at(T.batch, 0, y0 + 0.62, fz + side * 0.13, side > 0 ? 0 : Math.PI)
      channelLetters(F, 'CHAD VILLAGE', 1.15, 0.14, letters)
      // a thin light line under the letters (integrated lighting, not a glow wash)
      T.batch.put(new THREE.BoxGeometry(10.8, 0.05, 0.05), glow, 0, y0 + 0.36, fz + side * 0.2, 0, 1, 1, 1, { cast: false })
    }
    // crown emblem on top: pedestal, extruded crown with a band and orbs
    const top = y0 + 2.7
    T.batch.put(boxUV(3.2, 0.45, 1.4, 1), trim, 0, top + 0.22, gz)
    const cg = new THREE.ExtrudeGeometry(crownShape(1.25), { depth: 0.36, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2, curveSegments: 1 })
    cg.translate(0, 0, -0.18)
    T.batch.put(cg, P.gold, 0, top + 0.45, gz)
    T.batch.put(new THREE.BoxGeometry(2.7, 0.28, 0.5), P.gold, 0, top + 0.58, gz)
    for (const [x, y] of [[-1.35, 1.25], [-0.4, 1.56], [0.4, 1.56], [1.35, 1.25]]) T.batch.put(new THREE.SphereGeometry(0.13, 12, 8), P.gold, x, top + 0.45 + y, gz)
    for (const dx of [-0.8, 0, 0.8]) T.batch.put(new THREE.OctahedronGeometry(0.12).scale(1, 1.4, 0.6), P.glowOrange, dx, top + 0.6, gz + 0.27, 0, 1, 1, 1, { cast: false })
  }
  // wing walls with lanterns (the gateway reads wider than the road; you can walk round the ends)
  for (const s of [-1, 1]) {
    const x0 = s * (OPEN + 2.6)
    const len = 4.2
    T.batch.put(boxUV(len, 3.6, 1.2, 1.6), stone, x0 + (s * len) / 2, 1.8, gz)
    T.batch.put(boxUV(len + 0.2, 0.22, 1.5, 1.2), trim, x0 + (s * len) / 2, 3.7, gz)
    T.batch.put(boxUV(len, 0.4, 1.5, 1.2), trim, x0 + (s * len) / 2, 0.2, gz)
    const xe = x0 + s * len
    T.batch.put(boxUV(1.0, 4.4, 1.6, 1.4), stone, xe, 2.2, gz)
    T.batch.put(new THREE.SphereGeometry(0.4, 16, 10), P.gold, xe, 4.85, gz)
    T.colliders.push({ kind: 'box', minX: Math.min(x0, xe) - 0.5, maxX: Math.max(x0, xe) + 0.5, minZ: gz - 0.8, maxZ: gz + 0.8, h: 4.4 })
    for (const side of [-1, 1]) {
      const lz = gz + side * 0.65
      T.batch.put(new THREE.BoxGeometry(0.06, 0.06, 0.5), darkMetal, x0 + s * 2.1, 2.9, lz + side * 0.2)
      T.batch.put(new THREE.BoxGeometry(0.26, 0.36, 0.26), darkMetal, x0 + s * 2.1, 2.66, lz + side * 0.42)
      T.batch.put(new THREE.BoxGeometry(0.18, 0.26, 0.18), P.glowGold, x0 + s * 2.1, 2.66, lz + side * 0.42, 0, 1, 1, 1, { cast: false })
    }
  }

  // ── planters, benches and lamps lining the forecourt ──
  const planter = (x: number, z: number, w: number, d: number) => {
    T.batch.put(boxUV(w, 0.55, d, 1.2), trim, x, 0.275, z)
    T.batch.put(boxUV(w - 0.2, 0.05, d - 0.2, 1), P.soil, x, 0.53, z, 0, 1, 1, 1, { cast: false })
    T.colliders.push({ kind: 'box', minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h: 0.6 })
    return { x, z, w, d }
  }
  const planters = [planter(-9.5, 55.2, 3.2, 1.4), planter(9.5, 55.2, 3.2, 1.4), planter(-12.6, 66.4, 1.4, 4.2), planter(-5.2, 46.6, 2.6, 1.2), planter(5.2, 46.6, 2.6, 1.2)]
  const benchAt = (x: number, z: number, ry: number) => {
    const F = Frame.at(T.batch, x, 0, z, ry)
    F.box(1.8, 0.09, 0.46, P.woodLight, 0, 0.47, 0)
    F.box(1.8, 0.42, 0.07, P.woodLight, 0, 0.8, -0.22)
    for (const dx of [-0.75, 0.75]) {
      F.box(0.08, 0.45, 0.46, P.iron, dx, 0.23, 0)
      F.box(0.08, 0.5, 0.06, P.iron, dx, 0.72, -0.22)
    }
    T.colliders.push({ kind: 'circle', x, z, r: 0.75, h: 0.9 })
  }
  benchAt(-9.5, 57.0, Math.PI)
  benchAt(9.5, 57.0, Math.PI)

  // ── welcome board + city map (posted, roofed, readable from the spawn) ──
  const welcome = new THREE.MeshStandardMaterial({
    map: boardTexture('WELCOME TO CHAD VILLAGE', ['Chad Square · straight on, over the bridge', 'Pump Gym · east of the square', 'Pump Arcade · Arcade Street, far east', 'Market + Garden · west', 'Chad Citadel · north', 'Chad Rides · here, by the valley gate (soon)'], 1.6, PANEL.dark, Dp),
    roughness: 0.7,
  })
  const map = new THREE.MeshStandardMaterial({ map: cityMapTexture(Dp, [MAPBOARD.x, MAPBOARD.z]), roughness: 0.75 })
  Dp.push(welcome, map)
  // faces turned toward the arriving player (south-facing, angled in)
  postedBoard(Frame.at(T.batch, WELCOME.x, 0, WELCOME.z, 0.38), 2.4, 1.5, 1.55, welcome, SMt, false)
  postedBoard(Frame.at(T.batch, MAPBOARD.x, 0, MAPBOARD.z, -0.38), 2.4, 1.8, 1.6, map, SMt, false)
  for (const b of [WELCOME, MAPBOARD]) T.colliders.push({ kind: 'box', minX: b.x - 1.5, maxX: b.x + 1.5, minZ: b.z - 0.3, maxZ: b.z + 0.3, h: 2.7 })

  // ── the valley gate: thrown open — the valley road starts here and winds down to Chad City ──
  {
    const { x: vx, z: vz } = VALLEY_GATE
    for (const s of [-1, 1]) {
      T.batch.put(boxUV(1.2, 3.6, 1.2, 1.4), stone, vx + s * 3.7, 1.8, vz)
      T.batch.put(boxUV(1.45, 0.25, 1.45, 1), trim, vx + s * 3.7, 3.72, vz)
      if (EXPANSION_OPEN) T.batch.put(new THREE.SphereGeometry(0.35, 14, 10), P.gold, vx + s * 3.7, 4.15, vz)
      T.colliders.push({ kind: 'box', minX: vx + s * 3.7 - 0.7, maxX: vx + s * 3.7 + 0.7, minZ: vz - 0.7, maxZ: vz + 0.7, h: 3.6 })
      if (!EXPANSION_OPEN) continue
      // the gate leaf, swung open against its pier: frame, vertical bars with spear tips, a crown boss
      const L = Frame.at(T.batch, vx + s * 3.2, 0, vz + 0.3, 0)
      for (const y of [0.25, 1.5, 2.6]) L.box(0.08, 0.08, 3.0, darkMetal, 0, y, 1.5)
      for (let k = 0; k < 12; k++) {
        const bz = 0.1 + k * 0.265
        const top = 2.7 + Math.sin((k / 11) * Math.PI) * 0.35
        L.box(0.04, top - 0.1, 0.04, darkMetal, 0, (top - 0.1) / 2 + 0.1, bz)
        L.put(new THREE.ConeGeometry(0.05, 0.16, 4), P.gold, 0, top + 0.06, bz)
      }
      L.put(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 18).rotateZ(Math.PI / 2), P.gold, -s * 0.05, 1.5, 1.5)
    }
    if (!EXPANSION_OPEN) closedValleyGate(T, vx, vz, stone, darkMetal)
    // …and the way through is open: the valley road starts here
  }
  return { planters }
}


/**
 * The CLOSED valley gate (first release): a pair of wrought-iron leaves meeting in the middle between the existing piers, warm lanterns on the
 * piers and a pair of lamp posts, a hedge + planter flank, and a plaque reading CHAD CITY — NEXT UPDATE. Bars are open so the road beyond
 * stays visible: the way down is a glimpse of the next update, not a wall. Solid collision across the whole opening.
 */
function closedValleyGate(T: Town, vx: number, vz: number, stone: THREE.Material, iron: THREE.Material) {
  const P = T.P
  const warm = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc46a').multiplyScalar(1.5), toneMapped: false })
  T.disposables.push(warm)
  for (const s of [-1, 1]) {
    // a lantern on each pier (open frame + warm glass), standing on the cap
    const lx = vx + s * 3.7
    T.batch.put(new THREE.BoxGeometry(0.34, 0.46, 0.34), warm, lx, 4.15, vz, 0, 1, 1, 1, { cast: false })
    T.batch.put(new THREE.ConeGeometry(0.3, 0.26, 4).rotateY(Math.PI / 4), iron, lx, 4.5, vz, 0, 1, 1, 1, { cast: false })
    T.batch.put(new THREE.BoxGeometry(0.4, 0.05, 0.4), iron, lx, 3.9, vz, 0, 1, 1, 1, { cast: false })
    T.batch.put(new THREE.SphereGeometry(0.06, 8, 6), P.gold, lx, 4.68, vz, 0, 1, 1, 1, { cast: false })
    // each leaf: from the pier's inner face to the centre line
    const F = Frame.at(T.batch, vx, 0, vz, 0)
    const x0 = s * 3.1
    const x1 = s * 0.03
    const w = Math.abs(x1 - x0)
    const mid = (x0 + x1) / 2
    for (const y of [0.22, 0.9, 2.45]) F.box(w, 0.09, 0.09, iron, mid, y, 0)
    F.box(w, 0.05, 0.05, iron, mid, 1.65, 0)
    F.box(0.1, 2.9, 0.1, iron, x0 - s * 0.05, 1.45, 0)
    F.box(0.1, 2.9, 0.1, iron, x1, 1.45, 0)
    const bars = 11
    for (let k = 0; k <= bars; k++) {
      const bx = x0 + ((x1 - x0) * k) / bars
      const top = 2.45 + 0.35 * Math.sin((k / bars) * Math.PI)
      F.box(0.04, top - 0.1, 0.04, iron, bx, (top - 0.1) / 2 + 0.1, 0)
      F.put(new THREE.ConeGeometry(0.05, 0.17, 4), P.gold, bx, top + 0.06, 0)
    }
    // scrollwork ring in each leaf + a gold boss at the meeting stile
    F.put(new THREE.TorusGeometry(0.42, 0.025, 6, 20), P.gold, mid, 1.65, 0)
    F.put(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 16).rotateX(Math.PI / 2), P.gold, s * 0.12, 1.65, 0)
    // pier-flank hedge and stone planters, north of the gate
    for (let k = 0; k < 3; k++) {
      const hz = vz - 1.0 - k * 1.1
      T.batch.put(boxUV(1.3, 0.5, 1.0, 1), stone, vx + s * 3.7, 0.25, hz)
      T.batch.put(new THREE.SphereGeometry(0.62, 10, 8), P.foliageDark, vx + s * 3.7, 0.9, hz, 0, 1.05, 0.9, 1)
    }
    T.colliders.push({ kind: 'box', minX: vx + s * 3.7 - 0.65, maxX: vx + s * 3.7 + 0.65, minZ: vz - 3.6, maxZ: vz - 0.4, h: 1.2 })
  }
  // a plinth-rail under the gate + the unbroken collision across the opening (pier to pier)
  T.batch.put(boxUV(6.4, 0.16, 0.5, 1), stone, vx, 0.08, vz)
  T.colliders.push({ kind: 'box', minX: vx - 3.2, maxX: vx + 3.2, minZ: vz - 0.4, maxZ: vz + 0.45, h: 3.4 })
  lampPosts(T, [[vx - 5.5, vz - 0.9], [vx + 5.5, vz - 0.9]])
  // the plaque, hung between the piers above the leaves, facing the village
  const board = new THREE.MeshStandardMaterial({ map: boardTexture(LOCKED_SIGN, ['The valley road opens in the next update'], 5, PANEL.dark, T.disposables), roughness: 0.7 })
  T.disposables.push(board)
  const BF = Frame.at(T.batch, vx, 0, vz - 0.25, Math.PI)
  BF.box(5.8, 0.12, 0.12, iron, 0, 3.45, 0)
  BF.put(new THREE.PlaneGeometry(4.6, 0.92), board, 0, 3.0, 0.02)
}
