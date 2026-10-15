import * as THREE from 'three'
import { boxUV, type StaticBatch } from '../world/kit'
import { brickTexture, panelTexture, poster, rubberFloorTexture } from './gymArt'
import { Place, type GymMats } from './gymKit'

type D = (THREE.Material | THREE.BufferGeometry | THREE.Texture)[]

/** hall bounds (wall planes) and ceiling height */
export const HALL = { x0: -9, x1: 9, z0: -6, z1: 7.6, H: 5.4, door: 1.5 }

const canvas = (w: number, h: number) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}
const ctex = (c: HTMLCanvasElement, D: D, srgb = true) => {
  const t = new THREE.CanvasTexture(c)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  D.push(t)
  return t
}

/* ───────── PUMP GYM channel letters: block glyphs on a unit grid (height 1), extruded with a bevel ───────── */
type Glyph = { w: number; outline: [number, number][]; holes?: [number, number][][] }
const GLYPHS: Record<string, Glyph> = {
  P: { w: 0.72, outline: [[0, 0], [0.26, 0], [0.26, 0.4], [0.6, 0.4], [0.72, 0.52], [0.72, 0.88], [0.6, 1], [0, 1]], holes: [[[0.26, 0.6], [0.26, 0.8], [0.47, 0.8], [0.47, 0.6]]] },
  U: { w: 0.72, outline: [[0, 1], [0, 0.12], [0.12, 0], [0.6, 0], [0.72, 0.12], [0.72, 1], [0.46, 1], [0.46, 0.22], [0.26, 0.22], [0.26, 1]] },
  M: { w: 0.88, outline: [[0, 0], [0.24, 0], [0.24, 0.56], [0.36, 0.32], [0.52, 0.32], [0.64, 0.56], [0.64, 0], [0.88, 0], [0.88, 1], [0.64, 1], [0.44, 0.6], [0.24, 1], [0, 1]] },
  G: { w: 0.72, outline: [[0.12, 0], [0.6, 0], [0.72, 0.12], [0.72, 0.52], [0.38, 0.52], [0.38, 0.34], [0.48, 0.34], [0.48, 0.22], [0.26, 0.22], [0.26, 0.78], [0.48, 0.78], [0.48, 0.7], [0.72, 0.7], [0.72, 0.88], [0.6, 1], [0.12, 1], [0, 0.88], [0, 0.12]] },
  Y: { w: 0.76, outline: [[0, 1], [0.26, 1], [0.38, 0.7], [0.5, 1], [0.76, 1], [0.51, 0.46], [0.51, 0], [0.25, 0], [0.25, 0.46]] },
}
/** extruded block-letter word, left edge at x = 0, baseline y = 0, front face at z = depth. Returns geometry + width. */
export function letterGeo(text: string, size: number, depth: number) {
  const geos: THREE.BufferGeometry[] = []
  let x = 0
  for (const ch of text) {
    if (ch === ' ') {
      x += 0.42 * size
      continue
    }
    const gl = GLYPHS[ch]
    const shape = new THREE.Shape(gl.outline.map(([a, b]) => new THREE.Vector2(a * size, b * size)))
    for (const h of gl.holes ?? []) shape.holes.push(new THREE.Path(h.map(([a, b]) => new THREE.Vector2(a * size, b * size))))
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: depth * 0.18, bevelSize: size * 0.012, bevelSegments: 2, curveSegments: 1 })
    g.translate(x, 0, 0)
    geos.push(g)
    x += gl.w * size + 0.13 * size
  }
  return { geos, width: x - 0.13 * size }
}

/** night-sky glazing for the clerestory windows: deep navy → purple haze with a few distant city lights */
function nightGlass(D: D) {
  const [c, g] = canvas(128, 128)
  const grd = g.createLinearGradient(0, 0, 0, 128)
  grd.addColorStop(0, '#0b1026')
  grd.addColorStop(0.7, '#2a1740')
  grd.addColorStop(1, '#4a2350')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 40; i++) {
    g.fillStyle = Math.random() < 0.6 ? 'rgba(255,190,120,0.8)' : 'rgba(170,200,255,0.7)'
    g.fillRect(Math.random() * 128, 90 + Math.random() * 36, 1.5, 1.5)
  }
  return ctex(c, D)
}

/** what you see through the door: a warm-lit night street (dim, so the glass reads as glass) */
function streetTex(D: D) {
  const [c, g] = canvas(128, 128)
  const grd = g.createLinearGradient(0, 0, 0, 128)
  grd.addColorStop(0, '#120d1c')
  grd.addColorStop(0.55, '#3a2418')
  grd.addColorStop(1, '#8a5428')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 14; i++) {
    g.fillStyle = 'rgba(255,190,110,0.85)'
    g.fillRect(8 + Math.random() * 112, 40 + Math.random() * 30, 2, 2)
  }
  return ctex(c, D)
}

/** soft purple halo behind the sign letters */
function haloTex(D: D) {
  const [c, g] = canvas(256, 64)
  g.save()
  g.scale(1, 0.25) // elliptical falloff: fades out on every edge of the plane
  const grd = g.createRadialGradient(128, 128, 4, 128, 128, 128)
  grd.addColorStop(0, 'rgba(150,80,255,0.75)')
  grd.addColorStop(0.45, 'rgba(110,50,210,0.3)')
  grd.addColorStop(1, 'rgba(60,20,120,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 256, 256)
  g.restore()
  return ctex(c, D)
}

/** orange tagline text on transparent */
function taglineTex(text: string, D: D) {
  const [c, g] = canvas(1024, 96)
  g.font = '700 54px "JetBrains Mono", monospace'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = '#ffb067'
  g.fillText(text, 512, 50)
  return ctex(c, D)
}

/** reception brand panel: PUMP GYM wordmark + strap line */
export function brandPanelTex(D: D) {
  const [c, g] = canvas(512, 144)
  g.fillStyle = '#121014'
  g.fillRect(0, 0, 512, 144)
  g.fillStyle = '#ff7a1a'
  g.font = '900 72px Anton, Impact, sans-serif'
  g.textAlign = 'center'
  g.fillText('PUMP GYM', 256, 82)
  g.fillStyle = '#b48cff'
  g.font = '600 20px "JetBrains Mono", monospace'
  g.fillText('MEMBERS · DAY PASSES · NO PAIN NO PUMP', 256, 120)
  return ctex(c, D)
}
export function screenTex(D: D) {
  const [c, g] = canvas(256, 144)
  g.fillStyle = '#0b0d14'
  g.fillRect(0, 0, 256, 144)
  g.fillStyle = '#ff7a1a'
  g.font = '900 30px Anton, Impact, sans-serif'
  g.fillText('CHECK-IN', 16, 40)
  g.fillStyle = '#7fd6ff'
  g.font = '600 14px monospace'
  ;['MEMBERS IN   27', 'CLASSES      LEG DAY 18:00', 'TOWELS       ✓'].forEach((t, i) => g.fillText(t, 16, 72 + i * 22))
  return ctex(c, D)
}

/**
 * The hall shell: floor zones, panelled + brick walls with skirting and cap rails, clerestory windows,
 * a framed glazed door, I-beam ceiling with ducting and pendant LED fixtures, the mirror wall, the PUMP GYM sign.
 * Static parts go into the batch; returns the few live pieces the scene animates.
 */
export function buildHall(B: StaticBatch, s: THREE.Scene, D: D, M: GymMats, env: THREE.Texture | null) {
  const { x0, x1, z0, z1, H, door } = HALL
  const mat = (p: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial(p)
    D.push(m)
    return m
  }
  const basic = (p: THREE.MeshBasicMaterialParameters) => {
    const m = new THREE.MeshBasicMaterial(p)
    D.push(m)
    return m
  }
  const W = Place.at(B, 0, 0)

  // ── floors: rubber tiles everywhere, a polished-concrete entrance, thicker mats in the training zones ──
  const floorTex = rubberFloorTexture(D)
  floorTex.repeat.set(9, 7.8)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), mat({ map: floorTex, roughness: 0.86, metalness: 0 }))
  floor.rotation.x = -Math.PI / 2
  floor.position.set(0, 0, (z0 + z1) / 2)
  floor.receiveShadow = true
  s.add(floor)
  const concrete = mat({ color: '#3a393e', roughness: 0.38, metalness: 0.05 })
  W.box(10, 0.01, 2.3, concrete, 0, 0.005, z1 - 1.15, 0, 0, 0, false)
  const zoneMat = mat({ color: '#121114', roughness: 0.92 })
  W.rbox(4.3, 0.022, 6.2, 0.008, zoneMat, 6.75, 0.011, -2.05, 0, 0, 0, false) // free-weights floor
  W.rbox(3.0, 0.022, 7.2, 0.008, zoneMat, -6.95, 0.011, -1.6, 0, 0, 0, false) // strength floor
  // entrance mat with an orange border
  W.rbox(2.6, 0.016, 1.1, 0.006, M.rubber, 0, 0.012, z1 - 0.7, 0, 0, 0, false)
  for (const dz of [-0.52, 0.52]) W.box(2.5, 0.004, 0.04, M.orange, 0, 0.021, z1 - 0.7 + dz, 0, 0, 0, false)

  // ── walls: panelled dado (1.2 m), brick above on the sides, painted charcoal feature wall at the back ──
  const brick = mat({ map: brickTexture(D), roughness: 0.92 })
  const feature = mat({ color: '#19161c', roughness: 0.88 })
  const wainscot = mat({ map: panelTexture(D), roughness: 0.6, metalness: 0.3 })
  const wall = (m: THREE.Material, w: number, h: number, x: number, y: number, z: number, ry: number) => {
    const g = new THREE.PlaneGeometry(w, h)
    const uv = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / 2, (uv.getY(i) * h) / 2)
    W.put(g, m, x, y, z, 0, ry, 0, false)
  }
  wall(feature, x1 - x0, H, 0, H / 2, z0, 0)
  wall(brick, z1 - z0, H, x0, H / 2, (z0 + z1) / 2, Math.PI / 2)
  wall(brick, z1 - z0, H, x1, H / 2, (z0 + z1) / 2, -Math.PI / 2)
  const sideW = x1 - door
  wall(brick, sideW, H, x0 + sideW / 2, H / 2, z1, Math.PI)
  wall(brick, sideW, H, x1 - sideW / 2, H / 2, z1, Math.PI)
  wall(brick, door * 2, H - 3, 0, 3 + (H - 3) / 2, z1, Math.PI)
  // dado panels, cap rail, rubber skirting (all four walls; the front wall stops at the door frame)
  const runs: [number, number, number, number][] = [
    // centre x, centre z, length, ry (panel faces into the room)
    [0, z0 + 0.03, x1 - x0, 0],
    [x0 + 0.03, (z0 + z1) / 2, z1 - z0, Math.PI / 2],
    [x1 - 0.03, (z0 + z1) / 2, z1 - z0, -Math.PI / 2],
    [x0 + sideW / 2, z1 - 0.03, sideW, Math.PI],
    [x1 - sideW / 2, z1 - 0.03, sideW, Math.PI],
  ]
  for (const [x, z, len, ry] of runs) {
    const R = Place.at(B, x, z, ry)
    R.put(boxUV(len, 1.2, 0.05, 1), wainscot, 0, 0.6, 0, 0, 0, 0, false)
    R.rbox(len, 0.05, 0.08, 0.01, M.frame, 0, 1.225, 0.02, 0, 0, 0, false) // cap rail
    R.box(len, 0.12, 0.02, M.rubber, 0, 0.06, 0.035, 0, 0, 0, false) // cove skirting
  }
  // steel pilasters (bolt plates top + bottom) on the side walls, between the windows
  for (const z of [-5.2, -1.2, 2.8, 6.8])
    for (const [x, ry] of [[x0 + 0.1, Math.PI / 2], [x1 - 0.1, -Math.PI / 2]] as const) {
      const R = Place.at(B, x, z, ry)
      R.box(0.3, H, 0.18, M.frame, 0, H / 2, 0)
      for (const y of [1.3, H - 0.35]) R.box(0.42, 0.08, 0.22, M.frame, 0, y, 0)
    }

  // ── clerestory windows (night sky outside) on both side walls ──
  const glass = basic({ map: nightGlass(D), color: new THREE.Color(1.15, 1.15, 1.15), toneMapped: false })
  for (const z of [-3.2, 0.8, 4.8])
    for (const [x, ry] of [[x0 + 0.01, Math.PI / 2], [x1 - 0.01, -Math.PI / 2]] as const) {
      const R = Place.at(B, x, z, ry)
      const w = 2.6
      const h = 1.2
      const y = 4.0
      R.put(new THREE.PlaneGeometry(w, h), glass, 0, y, 0.005, 0, 0, 0, false)
      for (const dy of [-h / 2, h / 2]) R.box(w + 0.16, 0.08, 0.14, M.frame, 0, y + dy, 0.05)
      for (const dx of [-w / 2, w / 2]) R.box(0.08, h + 0.08, 0.14, M.frame, dx, y, 0.05)
      for (const dx of [-w / 6, w / 6]) R.box(0.04, h, 0.06, M.frame, dx, y, 0.03) // mullions
      R.box(w, 0.035, 0.06, M.frame, 0, y + h * 0.18, 0.03) // transom
      R.rbox(w + 0.3, 0.05, 0.22, 0.01, M.steel, 0, y - h / 2 - 0.06, 0.1) // sill
    }

  // ── the door: steel frame with architrave, threshold, two glazed leaves with push bars; warm light beyond ──
  const doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(door * 2, 3), basic({ map: streetTex(D), toneMapped: false }))
  doorGlow.position.set(0, 1.5, z1 + 0.1)
  doorGlow.rotation.y = Math.PI
  s.add(doorGlow)
  {
    const R = Place.at(B, 0, z1, Math.PI)
    R.box(door * 2 + 0.36, 0.18, 0.22, M.frame, 0, 3.05, 0) // head
    for (const sx of [-1, 1]) R.box(0.18, 3.05, 0.22, M.frame, sx * (door + 0.09), 1.525, 0) // jambs / architrave
    R.box(door * 2, 0.02, 0.3, M.steel, 0, 0.01, 0) // threshold
    const tint = basic({ color: '#0e131c', transparent: true, opacity: 0.55, depthWrite: false })
    for (const sx of [-1, 1]) {
      const cx = sx * door * 0.5
      R.put(new THREE.PlaneGeometry(door - 0.12, 2.86), tint, cx, 1.47, 0.02, 0, 0, 0, false)
      for (const dx of [-1, 1]) R.box(0.06, 2.92, 0.05, M.steel, cx + (dx * (door - 0.06)) / 2, 1.47, 0.02)
      for (const y of [0.04, 2.9]) R.box(door - 0.06, 0.06, 0.05, M.steel, cx, y, 0.02)
      R.tube(new THREE.Vector3(cx - sx * 0.55, 1.05, 0.08), new THREE.Vector3(cx - sx * 0.05, 1.05, 0.08), 0.018, M.chrome, 10) // push bar
    }
  }

  // ── ceiling: dark deck, steel I-beams, a round supply duct with hangers, pendant LED fixtures on cables ──
  W.put(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(Math.PI / 2), feature, 0, H, (z0 + z1) / 2, 0, 0, 0, false)
  for (const z of [-4.2, -0.8, 2.6, 6.0]) {
    W.box(x1 - x0, 0.32, 0.03, M.frame, 0, H - 0.18, z, 0, 0, 0, false) // web
    W.box(x1 - x0, 0.03, 0.2, M.frame, 0, H - 0.345, z, 0, 0, 0, false) // bottom flange
  }
  const duct = mat({ color: '#5d5d63', metalness: 0.75, roughness: 0.42 })
  W.put(new THREE.CylinderGeometry(0.3, 0.3, z1 - z0, 20).rotateX(Math.PI / 2), duct, -7.0, H - 0.75, (z0 + z1) / 2, 0, 0, 0, false)
  for (let z = z0 + 1; z < z1; z += 2.4) {
    W.put(new THREE.TorusGeometry(0.305, 0.015, 6, 24), duct, -7.0, H - 0.75, z, 0, 0, 0, false) // seams
    W.box(0.03, 0.45, 0.03, M.frame, -7.0, H - 0.23, z, 0, 0, 0, false) // hanger
  }
  const led = basic({ color: new THREE.Color('#fff1dc').multiplyScalar(2.2), toneMapped: false })
  for (const z of [-2.5, 0.9, 4.3])
    for (const x of [-4.6, 0, 4.6]) {
      const y = H - 1.05
      W.rbox(2.3, 0.08, 0.24, 0.02, M.frame, x, y, z, 0, 0, 0, false)
      W.box(2.2, 0.012, 0.17, led, x, y - 0.045, z, 0, 0, 0, false)
      for (const dx of [-0.95, 0.95]) W.put(new THREE.CylinderGeometry(0.004, 0.004, H - y, 4), M.steel, x + dx, (H + y) / 2, z, 0, 0, 0, false)
    }

  // ── mirror wall behind the dumbbell rack (env-mapped steel glass: no real-time reflection pass) ──
  const mirrorMat = mat({ color: '#9aa3ad', metalness: 1, roughness: 0.04, envMap: env, envMapIntensity: 1.1 })
  {
    const R = Place.at(B, x1 - 0.1, -2.2, -Math.PI / 2) // stands proud of the dado cap rail
    const w = 5.6
    R.put(new THREE.PlaneGeometry(w, 2.4), mirrorMat, 0, 1.55, 0.012, 0, 0, 0, false)
    for (const dy of [-1.22, 1.22]) R.box(w + 0.08, 0.05, 0.04, M.steel, 0, 1.55 + dy, 0.02, 0, 0, 0, false)
    for (const dx of [-w / 2, -w / 6, w / 6, w / 2]) R.box(0.04, 2.48, 0.035, M.steel, dx, 1.55, 0.02, 0, 0, 0, false)
  }

  // ── two mirror panels on the brick west wall (between the steel pilasters), like the strength floors in the reference photos ──
  for (const z of [-3.2, 4.8]) {
    const R = Place.at(B, x0 + 0.1, z, Math.PI / 2)
    const w = 3.4
    R.put(new THREE.PlaneGeometry(w, 2.4), mirrorMat, 0, 1.55, 0.012, 0, 0, 0, false)
    for (const dy of [-1.22, 1.22]) R.box(w + 0.08, 0.05, 0.04, M.steel, 0, 1.55 + dy, 0.02, 0, 0, 0, false)
    for (const dx of [-w / 2, 0, w / 2]) R.box(0.04, 2.48, 0.035, M.steel, dx, 1.55, 0.02, 0, 0, 0, false)
  }

  // ── PUMP GYM: fabricated channel letters on a dark backer, purple halo, orange LED trim + tagline ──
  const sign = new THREE.Group()
  {
    const size = 0.86
    const { geos, width } = letterGeo('PUMP GYM', size, 0.1)
    const face = mat({ color: '#ff7a1a', emissive: '#ff6a10', emissiveIntensity: 0.9, roughness: 0.4, metalness: 0.2 })
    const y = 3.25
    const zs = z0 + 0.16
    for (const g of geos) W.put(g, face, -width / 2, y, zs)
    for (let i = 0; i < 8; i++) W.box(0.03, 0.03, 0.08, M.steel, -width / 2 + 0.3 + i * ((width - 0.6) / 7), y + size * 0.5, zs - 0.03, 0, 0, 0, false) // stand-offs
    W.rbox(width + 0.7, 1.5, 0.06, 0.02, M.frame, 0, y + size / 2, z0 + 0.05, 0, 0, 0, false) // backer
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(width + 2.2, 2.2), basic({ map: haloTex(D), transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }))
    halo.position.set(0, y + size / 2, z0 + 0.085)
    sign.add(halo)
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.41), basic({ map: taglineTex('CHAD GYM  ·  NO PAIN  ·  NO PUMP', D), transparent: true, toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6) }))
    tag.position.set(0, y - 0.42, z0 + 0.09)
    sign.add(tag)
    // two can lights on the nearest beam washing the sign
    for (const sx of [-1.6, 1.6]) {
      W.put(new THREE.CylinderGeometry(0.09, 0.07, 0.2, 14).rotateX(-0.6), M.frame, sx, H - 0.5, -4.2 + 0.12)
      W.put(new THREE.CircleGeometry(0.065, 14).rotateX(Math.PI / 2 + 0.6), led, sx, H - 0.6, -4.2 + 0.05, 0, 0, 0, false)
    }
  }
  s.add(sign)
  // LED strips along the back wall (they flash with clean reps) — returned so the scene can pulse them
  const strip = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff7a1a').multiplyScalar(3.4), toneMapped: false })
  for (const y of [0.18, H - 0.55]) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.035, 0.035), strip)
    st.position.set(0, y, z0 + 0.09)
    s.add(st)
  }

  // ── PumpChad art (framed) and the logo over the door ──
  const posters: [string, number, number, number, number, number, number][] = [
    ['art/chadverse/02-pumpchad-trading-room.webp', 1.4, 1.0, -6.8, 2.75, z0 + 0.08, 0],
    ['art/chadverse/03-pumpchad-bears-buried.webp', 1.4, 1.0, 6.8, 2.75, z0 + 0.08, 0],
    ['art/chadverse/04-pumpchad-charts-to-cars.webp', 1.5, 1.08, x0 + 0.08, 2.35, -1.2, Math.PI / 2],
    ['art/chadverse/01-pumpchad-throne.webp', 1.05, 1.35, x1 - 0.08, 2.35, 2.6, -Math.PI / 2],
    ['art/chadverse/05-pumpchad-army.webp', 1.5, 1.08, x1 - 0.08, 2.35, 5.4, -Math.PI / 2],
  ]
  for (const [url, w, h, x, y, z, ry] of posters) {
    const p = poster(url, w, h, D)
    p.position.set(x, y, z)
    p.rotation.y = ry
    s.add(p)
  }
  const logoMat = basic({ transparent: true, toneMapped: false, color: new THREE.Color(1.25, 1.25, 1.25) })
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), logoMat)
  logo.position.set(0, 4.25, z1 - 0.06)
  logo.rotation.y = Math.PI
  s.add(logo)
  new THREE.TextureLoader().load(import.meta.env.BASE_URL + 'art/pumpchad-logo.webp', (t) => {
    t.colorSpace = THREE.SRGBColorSpace
    logoMat.map = t
    logoMat.needsUpdate = true
    D.push(t)
  })
  return { strip }
}
