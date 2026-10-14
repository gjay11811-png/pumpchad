import * as THREE from 'three'
import type { Town } from './buildings'
import { Frame, channelLetters, textWidth } from './signs'
import { rng } from './kit'
import { isNight } from './daylight'

/**
 * The Chad City shopfront style (from the art direction): dark ornate signboards with raised gold lettering and a
 * crest, ivy and wisteria climbing the facades, window boxes spilling flowers, warm light everywhere.
 * Every piece is real geometry through the town's StaticBatch, on a handful of shared materials (so a whole street
 * of them costs a few draw calls).
 */
type D = (THREE.Material | THREE.Texture | THREE.BufferGeometry)[]
const cache = new WeakMap<Town, ReturnType<typeof makeMats>>()

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, D: D) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  D.push(t)
  return t
}

function makeMats(T: Town) {
  const D = T.disposables
  const night = isNight()
  const R = rng(77)
  // ivy: dense heart-shaped leaves in three greens on transparent ground
  const ivy = canvasTex(256, 256, (g) => {
    g.clearRect(0, 0, 256, 256)
    for (let k = 0; k < 160; k++) {
      const x = R() * 256
      const y = R() * 256
      const s = 9 + R() * 12
      g.fillStyle = ['#2f5a2a', '#3e6e30', '#4f8238', '#26482a'][Math.floor(R() * 4)]
      g.beginPath()
      g.moveTo(x, y + s)
      g.bezierCurveTo(x - s, y + s * 0.2, x - s * 0.6, y - s * 0.8, x, y - s * 0.3)
      g.bezierCurveTo(x + s * 0.6, y - s * 0.8, x + s, y + s * 0.2, x, y + s)
      g.fill()
    }
  }, D)
  // wisteria: hanging lilac racemes with a few leaves
  const wis = canvasTex(128, 256, (g) => {
    g.clearRect(0, 0, 128, 256)
    for (let r = 0; r < 5; r++) {
      const x = 14 + r * 25 + (R() - 0.5) * 8
      const len = 120 + R() * 110
      for (let y = 0; y < len; y += 5) {
        const w = (1 - y / len) * 10 + 2
        g.fillStyle = ['#b07ae8', '#9a5cd8', '#c896f2', '#7e4ac0'][Math.floor(R() * 4)]
        g.beginPath()
        g.arc(x + (R() - 0.5) * w, y + 6, 2.4 + R() * 1.6, 0, Math.PI * 2)
        g.fill()
      }
    }
    for (let k = 0; k < 18; k++) {
      g.fillStyle = '#3e6e30'
      g.beginPath()
      g.ellipse(R() * 128, R() * 40, 6, 3, R() * 3, 0, Math.PI * 2)
      g.fill()
    }
  }, D)
  // window-box flowers: pinks, purples, orange marigolds, white
  const bloom = canvasTex(256, 64, (g) => {
    g.clearRect(0, 0, 256, 64)
    for (let k = 0; k < 40; k++) {
      g.fillStyle = '#3e6e30'
      g.beginPath()
      g.ellipse(R() * 256, 40 + R() * 24, 8, 4, R() * 3, 0, Math.PI * 2)
      g.fill()
    }
    for (let k = 0; k < 70; k++) {
      g.fillStyle = ['#e85aa8', '#b07ae8', '#ff9a3a', '#f4ecd8', '#ffd25a'][Math.floor(R() * 5)]
      g.beginPath()
      g.arc(R() * 256, 14 + R() * 34, 3.5 + R() * 3, 0, Math.PI * 2)
      g.fill()
    }
  }, D)
  const std = (p: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.85, ...p })
    D.push(m)
    return m
  }
  return {
    ivy: std({ map: ivy, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }),
    wisteria: std({ map: wis, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9, ...(night ? { emissive: '#3a1a5a', emissiveIntensity: 0.6 } : {}) }),
    bloom: std({ map: bloom, alphaTest: 0.5, side: THREE.DoubleSide }),
    board: std({ color: '#141022', roughness: 0.45, metalness: 0.3 }),
    goldLetters: std({ color: '#f2c060', metalness: 0.95, roughness: 0.25, ...(night ? { emissive: '#ffb040', emissiveIntensity: 1.35 } : { emissive: '#ffb040', emissiveIntensity: 0.12 }) }),
    goldTrim: std({ color: '#d8a640', metalness: 1, roughness: 0.3, ...(night ? { emissive: '#a86a18', emissiveIntensity: 0.5 } : {}) }),
    iron: std({ color: '#1a1820', metalness: 0.8, roughness: 0.4 }),
    planter: std({ color: '#2a2230', roughness: 0.7 }),
    glow: (() => {
      const m = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc878').multiplyScalar(night ? 2.2 : 1.2), toneMapped: false })
      D.push(m)
      return m
    })(),
  }
}
export const ornamentMats = (T: Town) => {
  let m = cache.get(T)
  if (!m) cache.set(T, (m = makeMats(T)))
  return m
}

export function crownShape(s: number) {
  const p: [number, number][] = [[-1, 0], [1, 0], [1.08, 1.0], [0.62, 0.62], [0.32, 1.25], [0, 0.72], [-0.32, 1.25], [-0.62, 0.62], [-1.08, 1.0]]
  return new THREE.Shape(p.map(([x, y]) => new THREE.Vector2(x * s, y * s)))
}

/**
 * An ornate shop sign mounted flat on a facade (Frame at the board's centre, facing +z): a dark board with a
 * moulded gold frame and corner rosettes, raised gold channel letters, a crest on top (crown / paw / pumpkin),
 * and a hidden light strip that lights the lettering at night.
 */
export function ornateSign(T: Town, F: Frame, text: string, o: { w?: number; h?: number; crest?: 'crown' | 'paw' | 'pumpkin' | null } = {}) {
  const M = ornamentMats(T)
  const h = o.h ?? 0.9
  const size = h * 0.48
  const w = o.w ?? textWidth(text, size) + h * 1.1
  // board with rounded ends (a lozenge plate)
  const s = new THREE.Shape()
  const r = h / 2
  s.moveTo(-w / 2 + r, -r)
  s.lineTo(w / 2 - r, -r)
  s.absarc(w / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2, false)
  s.lineTo(-w / 2 + r, r)
  s.absarc(-w / 2 + r, 0, r, Math.PI / 2, (3 * Math.PI) / 2, false)
  const board = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 12 })
  F.put(board, M.board, 0, 0, 0)
  // gold moulding: an inset outline
  const ring = new THREE.Shape()
  const ri = r - 0.06
  ring.moveTo(-w / 2 + r, -ri)
  ring.lineTo(w / 2 - r, -ri)
  ring.absarc(w / 2 - r, 0, ri, -Math.PI / 2, Math.PI / 2, false)
  ring.lineTo(-w / 2 + r, ri)
  ring.absarc(-w / 2 + r, 0, ri, Math.PI / 2, (3 * Math.PI) / 2, false)
  const hole = new THREE.Path()
  const rh = ri - 0.035
  hole.moveTo(-w / 2 + r, -rh)
  hole.absarc(-w / 2 + r, 0, rh, (3 * Math.PI) / 2, Math.PI / 2, true)
  hole.lineTo(w / 2 - r, rh)
  hole.absarc(w / 2 - r, 0, rh, Math.PI / 2, -Math.PI / 2, true)
  hole.lineTo(-w / 2 + r, -rh)
  ring.holes.push(hole)
  F.put(new THREE.ExtrudeGeometry(ring, { depth: 0.03, bevelEnabled: false, curveSegments: 12 }), M.goldTrim, 0, 0, 0.1)
  for (const sx of [-1, 1]) F.put(new THREE.SphereGeometry(0.05, 10, 8).scale(1, 1, 0.5), M.goldTrim, sx * (w / 2 - r * 0.45), 0, 0.12)
  // raised lettering
  channelLetters(F.sub(0, -size * 0.5, 0.11), text, size, 0.05, M.goldLetters)
  // the crest
  if (o.crest) {
    const cF = F.sub(0, r + 0.02, 0.04)
    cF.put(new THREE.CircleGeometry(r * 0.75, 24, 0, Math.PI).translate(0, 0, 0), M.board, 0, 0, 0.0, 0, 0, 0, false)
    cF.put(new THREE.TorusGeometry(r * 0.75, 0.025, 6, 24, Math.PI), M.goldTrim, 0, 0, 0.02)
    if (o.crest === 'crown') {
      const cg = new THREE.ExtrudeGeometry(crownShape(r * 0.42), { depth: 0.05, bevelEnabled: false })
      cF.put(cg, M.goldLetters, 0, r * 0.1, 0.03)
    } else if (o.crest === 'paw') {
      cF.put(new THREE.CircleGeometry(r * 0.2, 16).scale(1.15, 0.95, 1), M.goldLetters, 0, r * 0.22, 0.04, 0, 0, 0, false)
      for (const [dx, dy] of [[-0.25, 0.48], [-0.09, 0.6], [0.09, 0.6], [0.25, 0.48]] as const) cF.put(new THREE.CircleGeometry(r * 0.08, 12), M.goldLetters, dx * r, dy * r, 0.04, 0, 0, 0, false)
    } else {
      cF.put(new THREE.SphereGeometry(r * 0.28, 14, 10).scale(1.2, 0.9, 0.5), M.goldLetters, 0, r * 0.35, 0.05)
      cF.put(new THREE.CylinderGeometry(0.02, 0.03, r * 0.16, 6), M.goldTrim, 0, r * 0.66, 0.05)
    }
  }
  // the light strip under the board (lights the letters warm at night)
  F.put(new THREE.BoxGeometry(w * 0.7, 0.03, 0.04), M.glow, 0, -r - 0.05, 0.22, 0, 0, 0, false)
  F.box(0.04, 0.04, 0.24, M.iron, -w * 0.3, -r - 0.05, 0.12)
  F.box(0.04, 0.04, 0.24, M.iron, w * 0.3, -r - 0.05, 0.12)
  return w
}

/**
 * Climbers on a facade (Frame on the wall face, +z out of the wall): ivy strands rising from the ground in clumps,
 * and wisteria hanging from the top edge. `w` = wall width to cover, `h` = wall height.
 */
export function climbers(T: Town, F: Frame, w: number, h: number, seed = 1, o: { ivy?: number; wisteria?: number; avoid?: [number, number][] } = {}) {
  const M = ornamentMats(T)
  const R = rng(seed)
  const quad = new THREE.PlaneGeometry(1, 1)
  const strands = o.ivy ?? Math.max(2, Math.round(w / 2.4))
  for (let k = 0; k < strands; k++) {
    const x = -w / 2 + (w / strands) * (k + 0.2 + R() * 0.6)
    if (o.avoid?.some(([a, b]) => x > a && x < b)) continue
    const top = h * (0.35 + R() * 0.6)
    let y = 0.3
    while (y < top) {
      const s = 0.55 + R() * 0.45
      F.put(quad, M.ivy, x + (R() - 0.5) * 0.5, y, 0.04 + R() * 0.05, 0, 0, R() * 3, false)
      F.put(quad.clone().scale(s, s, 1), M.ivy, x + (R() - 0.5) * 0.7, y + 0.25, 0.08 + R() * 0.05, 0, 0, R() * 3, false)
      y += 0.42 + R() * 0.2
    }
  }
  const hangs = o.wisteria ?? Math.max(1, Math.round(w / 3))
  for (let k = 0; k < hangs; k++) {
    const x = -w / 2 + (w / hangs) * (k + 0.5) + (R() - 0.5) * 0.6
    const len = 0.9 + R() * 0.8
    const g = new THREE.PlaneGeometry(0.75, len).translate(0, -len / 2, 0)
    F.put(g, M.wisteria, x, h - 0.05, 0.12 + R() * 0.06, 0, (R() - 0.5) * 0.4, 0, false)
    F.put(g.clone().scale(0.8, 0.85, 1), M.wisteria, x + 0.3, h - 0.1, 0.18, 0, (R() - 0.5) * 0.4, 0, false)
  }
}

/** a window box under a sill: a dark planter overflowing with flowers (Frame on the wall, +z out) */
export function windowBox(T: Town, F: Frame, w: number, y: number) {
  const M = ornamentMats(T)
  F.box(w, 0.2, 0.26, M.planter, 0, y, 0.16)
  const g = new THREE.PlaneGeometry(w + 0.1, 0.32)
  F.put(g, M.bloom, 0, y + 0.22, 0.2, 0, 0, 0, false)
  F.put(g.clone(), M.bloom, 0, y + 0.18, 0.08, 0, 0.2, 0, false)
  F.put(new THREE.PlaneGeometry(w * 0.9, 0.42).translate(0, -0.1, 0), M.ivy, 0, y - 0.08, 0.3, 0.15, 0, 0, false) // trailing leaves
}

/** a planter of flowers on the street (round stone tub or long trough) */
export function flowerTub(T: Town, x: number, z: number, o: { long?: number; ry?: number } = {}) {
  const M = ornamentMats(T)
  const F = Frame.at(T.batch, x, 0, z, o.ry ?? 0)
  if (o.long) {
    F.box(o.long, 0.55, 0.7, M.planter, 0, 0.275, 0)
    const g = new THREE.PlaneGeometry(o.long, 0.5)
    for (const dz of [-0.15, 0.15]) F.put(g, M.bloom, 0, 0.75, dz, 0, 0, 0, false)
    F.put(g.clone().rotateY(Math.PI / 2).scale(1, 1, 0.3), M.bloom, 0, 0.75, 0, 0, 0, 0, false)
    const c = Math.abs(Math.cos(o.ry ?? 0))
    const hw = (o.long / 2) * c + 0.35 * (1 - c)
    const hd = (o.long / 2) * (1 - c) + 0.35 * c
    T.colliders.push({ kind: 'box', minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd, h: 0.6 })
  } else {
    F.put(new THREE.CylinderGeometry(0.42, 0.34, 0.6, 16), M.planter, 0, 0.3, 0)
    const g = new THREE.PlaneGeometry(0.9, 0.55)
    for (let k = 0; k < 3; k++) F.put(g, M.bloom, 0, 0.82, 0, 0, (k * Math.PI) / 3, 0, false)
    T.colliders.push({ kind: 'circle', x, z, r: 0.45, h: 0.7 })
  }
}
