import * as THREE from 'three'
import { isNight } from './daylight'
import type { Town } from './buildings'
import { boxUV, gableGeo } from './kit'
import { Frame, PANEL, channelLetters, framedBoard, hangingSign, panelTexture, type PanelStyle, type SignMats } from './signs'

/**
 * CHAD CITY street architecture. One builder, three styles that share proportions and details:
 *  - 'stone'   : warm ashlar, pale dressed trims, flat parapet roofs (civic / arcade street)
 *  - 'render'  : painted render over a stone plinth, pitched slate roofs with dormers (shops, cafés)
 *  - 'brick'   : red brick, stone trims, mansard or parapet roofs (workshops, the gym block)
 * Every building gets a plinth, a ground-floor shopfront (framed display windows, a recessed door, a stall riser,
 * a fascia), framed upper windows with sills + lintels, string courses and a cornice, and a real roof shape.
 * Decorative buildings have no entry prompt; their doors are visibly shut (no handle glow, a step, a mat).
 */

export type ArchStyle = 'stone' | 'render' | 'brick'
export type Roof = 'parapet' | 'pitched' | 'mansard'
export type ArchMats = {
  wall: THREE.Material
  trim: THREE.Material
  plinth: THREE.Material
  roof: THREE.Material
  glass: THREE.Material
  frame: THREE.Material // dark painted metal / timber for window frames + doors
  /** shopfront glazing: lightly tinted + see-through, so the display behind reads */
  shopGlass: THREE.Material
  door: THREE.Material
  sign: SignMats
}
export type ShopSpec = {
  x: number
  z: number
  /** facade width (local x) and depth (local z, front = +z) */
  w: number
  d: number
  floors: number
  ry: number
  roof: Roof
  name?: string
  sub?: string
  /** how the name is shown: raised letters on the fascia, a framed fascia board, or a hanging sign */
  sign?: 'letters' | 'board' | 'hanging'
  panel?: PanelStyle
  awning?: THREE.Material
  balcony?: boolean
  /** display-window contents (a painted interior card behind the glass) */
  display?: THREE.Material
}

const FLOOR_H = 3.1
const GROUND_H = 3.6

export function shop(T: Town, M: ArchMats, s: ShopSpec, letterMat?: THREE.Material) {
  const F = Frame.at(T.batch, s.x, 0, s.z, s.ry)
  const H = GROUND_H + (s.floors - 1) * FLOOR_H
  const fz = s.d / 2 // facade plane
  // body, plinth, string course between ground + upper floors, cornice. The ground floor's display windows are
  // real openings: the main body stops BAY behind the facade and the shopfront is built as piers, a riser and a
  // lintel band around open display bays (the old glazing sat inside a solid box, so you saw wall in the frames)
  const BAY = 1.3
  const doorW = 1.3
  const winW = Math.max(1.2, (s.w - doorW - 1.6) / 2)
  F.put(boxUV(s.w, H, s.d - BAY, 2), M.wall, 0, H / 2, -BAY / 2)
  if (H > GROUND_H) F.put(boxUV(s.w, H - GROUND_H, BAY, 2), M.wall, 0, GROUND_H + (H - GROUND_H) / 2, fz - BAY / 2)
  {
    const winTop = 2.95
    const sill = 0.74
    const inner = doorW / 2 + 0.4 // door bay half-width
    const outer = inner + winW // outer edge of each window
    F.put(boxUV(s.w, GROUND_H - winTop, BAY, 2), M.wall, 0, winTop + (GROUND_H - winTop) / 2, fz - BAY / 2) // lintel band
    const REC = 0.35 // door recess
    for (const sx of [-1, 1]) {
      F.put(boxUV(winW, sill, BAY, 1), M.wall, sx * (inner + winW / 2), sill / 2, fz - BAY / 2) // riser under each window
      if (s.w / 2 - outer > 0.01) F.put(boxUV(s.w / 2 - outer, winTop, BAY, 2), M.wall, sx * (outer + (s.w / 2 - outer) / 2), winTop / 2, fz - BAY / 2) // end pier
      F.put(boxUV(inner - doorW / 2, winTop, REC, 1), M.wall, sx * (doorW / 2 + (inner - doorW / 2) / 2), winTop / 2, fz - REC / 2) // door jamb
    }
    F.put(boxUV(inner * 2, winTop, BAY - REC, 2), M.wall, 0, winTop / 2, fz - REC - (BAY - REC) / 2) // behind the door
    // inside each bay: a display platform, a plinth of goods, the lit shop interior on the back wall
    for (const sx of [-1, 1]) {
      const cx = sx * (inner + winW / 2)
      F.box(winW, 0.06, BAY - 0.12, M.plinth, cx, sill + 0.03, fz - BAY / 2 - 0.06)
      F.box(Math.min(0.7, winW * 0.4), 0.45, 0.5, M.trim, cx + sx * winW * 0.15, sill + 0.28, fz - BAY + 0.45)
      if (s.display) F.put(new THREE.PlaneGeometry(winW, winTop - sill), s.display, cx, sill + (winTop - sill) / 2, fz - BAY + 0.005, 0, 0, 0, false)
      if (isNight()) F.box(winW - 0.14, 0.05, 0.05, T.P.glowGold, cx, winTop - 0.07, fz - 0.32) // warm strip light inside the window head
    }
  }
  F.put(boxUV(s.w + 0.12, 0.45, s.d + 0.12, 1.2), M.plinth, 0, 0.225, 0)
  if (s.floors > 1) F.put(boxUV(s.w + 0.16, 0.18, s.d + 0.16, 1.2), M.trim, 0, GROUND_H + 0.05, 0)
  F.put(boxUV(s.w + 0.34, 0.3, s.d + 0.34, 1.2), M.trim, 0, H + 0.12, 0)
  // quoins on the front corners
  for (const sx of [-1, 1]) for (let y = 0.6, k = 0; y < H - 0.4; y += 0.62, k++) {
    const qw = k % 2 ? 0.26 : 0.42 // alternating long + short quoin stones
    F.put(boxUV(qw, 0.3, 0.06, 1), M.trim, sx * (s.w / 2 - qw / 2), y, fz + 0.03)
  }

  // ── ground floor shopfront: two display windows either side of a recessed door ──
  for (const sx of [-1, 1]) {
    const cx = sx * (doorW / 2 + 0.4 + winW / 2)
    // stall riser, sill, glazing recessed 0.12, frame, transom bar, mullion
    F.put(boxUV(winW + 0.2, 0.7, 0.16, 1), M.plinth, cx, 0.35, fz + 0.06)
    F.box(winW + 0.3, 0.08, 0.3, M.trim, cx, 0.74, fz + 0.12)
    F.put(new THREE.PlaneGeometry(winW, 2.1), M.shopGlass, cx, 1.83, fz - 0.1, 0, 0, 0, false)
    for (const [bw, bh, bx, by] of [[winW + 0.16, 0.1, 0, 2.93], [0.1, 2.2, -winW / 2 - 0.03, 1.83], [0.1, 2.2, winW / 2 + 0.03, 1.83], [winW, 0.06, 0, 2.35], [0.06, 1.55, 0, 1.55]] as const) F.box(bw, bh, 0.1, M.frame, cx + bx, by, fz - 0.05)
  }
  // recessed door with a stone surround, panelled leaves, a step and a fanlight
  // (the door sits at the back of a real 0.35 m recess: stone jambs either side, leaves, a fanlight above)
  for (const sx of [-1, 1]) F.box(0.2, 2.95, 0.14, M.trim, sx * (doorW / 2 + 0.1), 1.475, fz + 0.02)
  F.box(doorW - 0.04, 2.4, 0.06, M.door, 0, 1.2, fz - 0.32)
  F.box(0.03, 2.4, 0.07, M.frame, 0, 1.2, fz - 0.31) // meeting stile
  for (const dx of [-0.3, 0.3]) for (const y of [0.7, 1.7]) F.box(0.42, 0.7, 0.03, M.frame, dx, y, fz - 0.28)
  F.box(doorW, 0.08, 0.1, M.frame, 0, 2.44, fz - 0.31) // transom
  F.put(new THREE.CircleGeometry(0.48, 20, 0, Math.PI), M.glass, 0, 2.47, fz - 0.33, 0, 0, 0, false)
  F.box(doorW + 0.6, 0.12, 0.5, M.plinth, 0, 0.06, fz + 0.25)
  // fascia (above the shopfront) + its sign
  const fasciaY = 3.22
  F.box(s.w - 0.3, 0.6, 0.18, M.frame, 0, fasciaY, fz + 0.08)
  F.box(s.w - 0.1, 0.08, 0.3, M.trim, 0, fasciaY + 0.34, fz + 0.12)
  if (s.name) {
    if (s.sign === 'letters' && letterMat) channelLetters(F.sub(0, fasciaY - 0.2, fz + 0.18), s.name, 0.4, 0.06, letterMat)
    else if (s.sign === 'hanging') {
      const face = new THREE.MeshStandardMaterial({ map: panelTexture(s.name, s.sub ?? null, 1.6, s.panel ?? PANEL.dark, T.disposables), roughness: 0.7 })
      T.disposables.push(face)
      hangingSign(F.sub(s.w / 2 - 0.5, GROUND_H + 0.9, fz + 0.02), 1.1, 0.68, face, M.sign, 1.25)
      const strip = new THREE.MeshStandardMaterial({ map: panelTexture(s.name, null, (s.w - 0.5) / 0.5, s.panel ?? PANEL.dark, T.disposables), roughness: 0.7 })
      T.disposables.push(strip)
      F.put(new THREE.PlaneGeometry(s.w - 0.5, 0.48), strip, 0, fasciaY, fz + 0.175, 0, 0, 0, false)
    } else {
      const face = new THREE.MeshStandardMaterial({ map: panelTexture(s.name, s.sub ?? null, (s.w - 0.5) / 0.48, s.panel ?? PANEL.dark, T.disposables), roughness: 0.7 })
      T.disposables.push(face)
      F.put(new THREE.PlaneGeometry(s.w - 0.5, 0.48), face, 0, fasciaY, fz + 0.175, 0, 0, 0, false)
    }
  }
  // awning over the shopfront (sloped, with a scalloped valance band and iron brackets)
  if (s.awning) {
    const aw = F.sub(0, 2.92, fz + 0.65, 0.42, 0, 0)
    aw.box(s.w - 0.4, 0.05, 1.3, s.awning, 0, 0, 0)
    aw.box(s.w - 0.4, 0.22, 0.04, s.awning, 0, -0.12, 0.65)
    for (const sx of [-1, 1]) F.put(new THREE.CylinderGeometry(0.015, 0.015, 1.3, 5).rotateX(Math.PI / 2 - 0.5), M.sign.metal, sx * (s.w / 2 - 0.3), 2.75, fz + 0.6)
  }
  // ── upper floors: framed windows with sills + lintels (pairs per bay), an optional balcony ──
  const bays = Math.max(2, Math.round(s.w / 2.3))
  for (let fl = 1; fl < s.floors; fl++) {
    const y = GROUND_H + (fl - 1) * FLOOR_H + 1.55
    for (let b = 0; b < bays; b++) {
      const wx = -s.w / 2 + (s.w / bays) * (b + 0.5)
      F.put(new THREE.PlaneGeometry(0.9, 1.5), M.glass, wx, y, fz + 0.005, 0, 0, 0, false)
      F.box(1.08, 0.1, 0.12, M.frame, wx, y + 0.8, fz + 0.04)
      F.box(1.08, 0.1, 0.12, M.frame, wx, y - 0.8, fz + 0.04)
      for (const dx of [-0.5, 0.5]) F.box(0.08, 1.6, 0.12, M.frame, wx + dx, y, fz + 0.04)
      F.box(0.06, 1.5, 0.08, M.frame, wx, y, fz + 0.03)
      F.box(1.3, 0.1, 0.26, M.trim, wx, y - 0.9, fz + 0.1) // sill
      F.box(1.3, 0.22, 0.14, M.trim, wx, y + 0.97, fz + 0.06) // lintel
    }
    if (s.balcony && fl === 1) {
      const bw = Math.min(3.4, s.w - 1.2)
      F.box(bw, 0.16, 0.9, M.trim, 0, y - 0.95, fz + 0.45)
      for (let k = 0; k <= 8; k++) F.box(0.04, 0.85, 0.04, M.sign.metal, -bw / 2 + (bw * k) / 8, y - 0.45, fz + 0.86)
      F.box(bw, 0.05, 0.06, M.sign.metal, 0, y - 0.02, fz + 0.86)
    }
  }
  // ── roof ──
  if (s.roof === 'parapet') {
    F.put(boxUV(s.w + 0.2, 0.7, 0.3, 1), M.wall, 0, H + 0.6, fz - 0.1)
    F.put(boxUV(s.w + 0.3, 0.1, 0.4, 1), M.trim, 0, H + 1.0, fz - 0.1)
  } else if (s.roof === 'pitched') {
    const rg = gableGeo(s.d + 0.6, s.w + 0.4, Math.min(3.2, s.d * 0.42), 2)
    rg.rotateY(Math.PI / 2)
    F.put(rg, M.roof, 0, H + 0.27, 0)
    // dormers on the street side
    for (const dx of s.w > 6 ? [-s.w / 4, s.w / 4] : [0]) {
      F.put(boxUV(1.1, 1.0, 1.2, 1), M.wall, dx, H + 0.9, fz - 0.9)
      F.put(new THREE.PlaneGeometry(0.6, 0.65), M.glass, dx, H + 0.9, fz - 0.29, 0, 0, 0, false)
      const dg = gableGeo(1.4, 1.4, 0.6, 1)
      F.put(dg, M.roof, dx, H + 1.4, fz - 0.9)
    }
  } else {
    // mansard: steep lower slope with dormers, flat top
    const hd = (s.d + 0.2) / 2
    const prof = new THREE.Shape([new THREE.Vector2(-hd, 0), new THREE.Vector2(hd, 0), new THREE.Vector2(hd - 0.7, 1.8), new THREE.Vector2(-hd + 0.7, 1.8)])
    const m = new THREE.ExtrudeGeometry(prof, { depth: s.w + 0.2, bevelEnabled: false })
    m.translate(0, 0, -(s.w + 0.2) / 2)
    m.rotateY(Math.PI / 2)
    const mu = m.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < mu.count; i++) mu.setXY(i, mu.getX(i) / 2, mu.getY(i) / 2)
    F.put(m, M.roof, 0, H + 0.27, 0)
    for (let b = 0; b < bays; b++) {
      const wx = -s.w / 2 + (s.w / bays) * (b + 0.5)
      F.put(boxUV(0.9, 1.0, 0.6, 1), M.trim, wx, H + 1.1, fz - 0.05)
      F.put(new THREE.PlaneGeometry(0.6, 0.7), M.glass, wx, H + 1.1, fz + 0.26, 0, 0, 0, false)
    }
  }
  // solid for the player and the camera
  const p0 = F.world(-s.w / 2 - 0.1, 0, -s.d / 2 - 0.1)
  const p1 = F.world(s.w / 2 + 0.1, 0, s.d / 2 + 0.25)
  T.colliders.push({ kind: 'box', minX: Math.min(p0.x, p1.x), maxX: Math.max(p0.x, p1.x), minZ: Math.min(p0.z, p1.z), maxZ: Math.max(p0.z, p1.z), h: H })
  return { H, F }
}

/** standard material set for a style (shared per World, so every shop of a style is the same few draw calls) */
export function archMats(T: Town, style: ArchStyle, stoneTex: THREE.Texture | null, glass: THREE.Material): ArchMats {
  const P = T.P
  const std = (p: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.85, ...p })
    T.disposables.push(m)
    return m
  }
  const frame = std({ color: '#2a2c33', metalness: 0.45, roughness: 0.5 })
  // night: barely-there glazing so the lamplit display reads (a mirror of the night sky hid it)
  const shopGlass = isNight()
    ? std({ color: '#c8d4e0', metalness: 0, roughness: 0.25, transparent: true, opacity: 0.1, depthWrite: false, envMapIntensity: 0.25 })
    : std({ color: '#9fc0d8', metalness: 0.1, roughness: 0.08, transparent: true, opacity: 0.28, depthWrite: false })
  const sign: SignMats = { frame: P.iron, metal: P.iron, gold: P.gold, stone: P.stoneLight }
  if (style === 'stone') return { wall: std({ map: stoneTex, color: '#dccbae' }), trim: std({ map: stoneTex, color: '#f1e6d1' }), plinth: std({ map: stoneTex, color: '#b9a88e' }), roof: P.roofSlate, glass, frame, shopGlass, door: std({ color: '#3a2a22', roughness: 0.6 }), sign }
  if (style === 'render') return { wall: std({ map: P.plaster.map, color: '#f0dcc0' }), trim: std({ map: stoneTex, color: '#f4ead8' }), plinth: std({ map: stoneTex, color: '#a9997f' }), roof: P.roofSlate, glass, frame, shopGlass, door: std({ color: '#24453a', roughness: 0.6 }), sign }
  return { wall: std({ map: brickTex(T), color: '#ffffff' }), trim: std({ map: stoneTex, color: '#efe2c8' }), plinth: std({ map: stoneTex, color: '#a39380' }), roof: P.roofSlate, glass, frame, shopGlass, door: std({ color: '#5a2a1e', roughness: 0.6 }), sign }
}

let brick: THREE.Texture | null = null
/** warm red brick with lime mortar (world-scale via boxUV: 1 texture = 2 m) */
function brickTex(T: Town) {
  if (brick && T.disposables.includes(brick)) return brick
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#d8cbb8'
  g.fillRect(0, 0, 256, 256)
  const bw = 32
  const bh = 12
  for (let row = 0; row < 256 / bh + 1; row++) {
    const off = row % 2 ? bw / 2 : 0
    for (let col = -1; col < 256 / bw + 1; col++) {
      const k = Math.random()
      g.fillStyle = `hsl(${10 + k * 12}, ${42 + k * 14}%, ${36 + Math.random() * 12}%)`
      g.fillRect(col * bw + off + 1.5, row * bh + 1.5, bw - 3, bh - 3)
    }
  }
  brick = new THREE.CanvasTexture(c)
  brick.wrapS = brick.wrapT = THREE.RepeatWrapping
  brick.colorSpace = THREE.SRGBColorSpace
  T.disposables.push(brick)
  return brick
}

/** a painted shop interior for display windows (shelves + goods silhouettes), tinted per shop */
export function displayMaterial(T: Town, tint: string, goods: 'shelves' | 'racks' | 'cabinets') {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')!
  const grd = g.createLinearGradient(0, 0, 0, 256)
  grd.addColorStop(0, '#3a2e2a')
  grd.addColorStop(1, '#1e1816')
  g.fillStyle = grd
  g.fillRect(0, 0, 256, 256)
  g.fillStyle = tint
  if (goods === 'shelves') {
    for (const y of [70, 140, 210]) {
      g.fillStyle = '#5a4030'
      g.fillRect(10, y, 236, 8)
      for (let x = 18; x < 240; x += 22) {
        g.fillStyle = Math.random() < 0.5 ? tint : '#e8dcc4'
        g.fillRect(x, y - 30 - Math.random() * 12, 14, 30 + Math.random() * 10)
      }
    }
  } else if (goods === 'racks') {
    g.fillStyle = '#9a9aa0'
    g.fillRect(10, 40, 236, 4)
    for (let x = 20; x < 240; x += 26) {
      g.fillStyle = [tint, '#2a2a30', '#e8dcc4', '#ff7a1a'][Math.floor(Math.random() * 4)]
      g.fillRect(x, 44, 20, 110)
    }
    g.fillStyle = '#5a4030'
    g.fillRect(10, 200, 236, 40)
  } else {
    for (let x = 14; x < 240; x += 58) {
      g.fillStyle = '#16141a'
      g.fillRect(x, 60, 44, 190)
      g.fillStyle = tint
      g.fillRect(x + 6, 80, 32, 40)
      g.fillStyle = '#ffb24a'
      g.fillRect(x + 8, 150, 6, 6)
      g.fillRect(x + 22, 150, 6, 6)
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  const m = new THREE.MeshBasicMaterial({ map: t, color: isNight() ? new THREE.Color('#ffd9a8').multiplyScalar(1.25) : '#cfc6be' })
  T.disposables.push(t, m)
  return m
}

/** a stone planter with soil (flowers are added by the foliage pass) */
export function planterBox(T: Town, trim: THREE.Material, x: number, z: number, w: number, d: number, ry = 0) {
  T.batch.put(boxUV(w, 0.55, d, 1.2), trim, x, 0.275, z, ry)
  T.batch.put(boxUV(w - 0.2, 0.05, d - 0.2, 1), T.P.soil, x, 0.53, z, ry, 1, 1, 1, { cast: false })
  const c = Math.abs(Math.cos(ry))
  const sn = Math.abs(Math.sin(ry))
  const hw = (w * c + d * sn) / 2
  const hd = (w * sn + d * c) / 2
  T.colliders.push({ kind: 'box', minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd, h: 0.6 })
}

export { framedBoard }
