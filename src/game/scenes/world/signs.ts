import * as THREE from 'three'
import type { StaticBatch } from './kit'

/**
 * CHAD CITY sign family — every permanent sign is a built object, not a floating label:
 *  - channel letters: extruded block glyphs on stand-offs (facades, the gateway, the citadel)
 *  - framed boards: a painted panel in a moulded frame, on posts or wall brackets
 *  - hanging signs: a double-sided board on chains from an iron bracket arm
 *  - plaques: engraved bronze/stone with a bevelled rim
 * Text panels are canvas textures (Anton / JetBrains Mono, same faces as the UI). Geometry goes through `Frame`,
 * a tiny local transform helper, so a sign can be mounted on any wall at any rotation.
 */

type D = (THREE.Material | THREE.Texture | THREE.BufferGeometry)[]
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const ONE = V(1, 1, 1)

/** local frame: origin + yaw (+ optional pitch); everything put through it is batched in world space */
export class Frame {
  constructor(
    readonly B: StaticBatch,
    readonly M: THREE.Matrix4,
  ) {}
  static at(B: StaticBatch, x: number, y: number, z: number, ry = 0) {
    return new Frame(B, new THREE.Matrix4().compose(V(x, y, z), _q.setFromEuler(_e.set(0, ry, 0)), ONE))
  }
  private local(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, s = ONE) {
    return this.M.clone().multiply(new THREE.Matrix4().compose(V(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), s))
  }
  sub(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) {
    return new Frame(this.B, this.local(x, y, z, rx, ry, rz))
  }
  put(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, cast = true) {
    this.B.add(geo, mat, this.local(x, y, z, rx, ry, rz), { cast })
  }
  box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, cast = true) {
    this.put(new THREE.BoxGeometry(w, h, d), mat, x, y, z, 0, 0, 0, cast)
  }
  world(x: number, y: number, z: number) {
    return V(x, y, z).applyMatrix4(this.M)
  }
  matrix(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    return this.local(x, y, z, rx, ry, rz)
  }
}

/* ───────────────────────── block glyphs (unit height, origin bottom-left) ───────────────────────── */
type Glyph = { w: number; o: [number, number][]; h?: [number, number][][] }
const G: Record<string, Glyph> = {
  A: { w: 0.78, o: [[0, 0], [0.25, 0], [0.3, 0.24], [0.48, 0.24], [0.53, 0], [0.78, 0], [0.52, 1], [0.26, 1]], h: [[[0.34, 0.44], [0.44, 0.44], [0.39, 0.72]]] },
  B: { w: 0.72, o: [[0, 0], [0.58, 0], [0.72, 0.12], [0.72, 0.4], [0.63, 0.5], [0.72, 0.6], [0.72, 0.88], [0.6, 1], [0, 1]], h: [[[0.24, 0.19], [0.48, 0.19], [0.48, 0.4], [0.24, 0.4]], [[0.24, 0.6], [0.48, 0.6], [0.48, 0.81], [0.24, 0.81]]] },
  C: { w: 0.72, o: [[0.12, 0], [0.72, 0], [0.72, 0.23], [0.26, 0.23], [0.26, 0.77], [0.72, 0.77], [0.72, 1], [0.12, 1], [0, 0.88], [0, 0.12]] },
  D: { w: 0.74, o: [[0, 0], [0.56, 0], [0.74, 0.17], [0.74, 0.83], [0.56, 1], [0, 1]], h: [[[0.24, 0.22], [0.5, 0.22], [0.5, 0.78], [0.24, 0.78]]] },
  E: { w: 0.66, o: [[0, 0], [0.66, 0], [0.66, 0.22], [0.24, 0.22], [0.24, 0.4], [0.58, 0.4], [0.58, 0.6], [0.24, 0.6], [0.24, 0.78], [0.66, 0.78], [0.66, 1], [0, 1]] },
  F: { w: 0.66, o: [[0, 0], [0.24, 0], [0.24, 0.4], [0.58, 0.4], [0.58, 0.6], [0.24, 0.6], [0.24, 0.78], [0.66, 0.78], [0.66, 1], [0, 1]] },
  G: { w: 0.74, o: [[0.12, 0], [0.62, 0], [0.74, 0.12], [0.74, 0.52], [0.4, 0.52], [0.4, 0.34], [0.5, 0.34], [0.5, 0.22], [0.26, 0.22], [0.26, 0.78], [0.5, 0.78], [0.5, 0.7], [0.74, 0.7], [0.74, 0.88], [0.62, 1], [0.12, 1], [0, 0.88], [0, 0.12]] },
  H: { w: 0.74, o: [[0, 0], [0.24, 0], [0.24, 0.4], [0.5, 0.4], [0.5, 0], [0.74, 0], [0.74, 1], [0.5, 1], [0.5, 0.6], [0.24, 0.6], [0.24, 1], [0, 1]] },
  I: { w: 0.25, o: [[0, 0], [0.25, 0], [0.25, 1], [0, 1]] },
  J: { w: 0.66, o: [[0, 0.32], [0, 0.12], [0.12, 0], [0.54, 0], [0.66, 0.12], [0.66, 1], [0.42, 1], [0.42, 0.22], [0.24, 0.22], [0.24, 0.32]] },
  K: { w: 0.76, o: [[0, 0], [0.24, 0], [0.24, 0.33], [0.31, 0.42], [0.5, 0], [0.76, 0], [0.47, 0.58], [0.74, 1], [0.47, 1], [0.24, 0.62], [0.24, 1], [0, 1]] },
  L: { w: 0.64, o: [[0, 0], [0.64, 0], [0.64, 0.22], [0.24, 0.22], [0.24, 1], [0, 1]] },
  M: { w: 0.88, o: [[0, 0], [0.24, 0], [0.24, 0.56], [0.36, 0.32], [0.52, 0.32], [0.64, 0.56], [0.64, 0], [0.88, 0], [0.88, 1], [0.64, 1], [0.44, 0.6], [0.24, 1], [0, 1]] },
  N: { w: 0.76, o: [[0, 0], [0.24, 0], [0.24, 0.54], [0.52, 0], [0.76, 0], [0.76, 1], [0.52, 1], [0.52, 0.46], [0.24, 1], [0, 1]] },
  O: { w: 0.74, o: [[0.12, 0], [0.62, 0], [0.74, 0.12], [0.74, 0.88], [0.62, 1], [0.12, 1], [0, 0.88], [0, 0.12]], h: [[[0.24, 0.22], [0.5, 0.22], [0.5, 0.78], [0.24, 0.78]]] },
  P: { w: 0.72, o: [[0, 0], [0.24, 0], [0.24, 0.38], [0.6, 0.38], [0.72, 0.5], [0.72, 0.88], [0.6, 1], [0, 1]], h: [[[0.24, 0.58], [0.48, 0.58], [0.48, 0.8], [0.24, 0.8]]] },
  Q: { w: 0.8, o: [[0.12, 0], [0.5, 0], [0.56, -0.1], [0.8, -0.1], [0.7, 0.06], [0.74, 0.12], [0.74, 0.88], [0.62, 1], [0.12, 1], [0, 0.88], [0, 0.12]], h: [[[0.24, 0.22], [0.5, 0.22], [0.5, 0.78], [0.24, 0.78]]] },
  R: { w: 0.76, o: [[0, 0], [0.24, 0], [0.24, 0.36], [0.36, 0.36], [0.5, 0], [0.76, 0], [0.59, 0.42], [0.72, 0.53], [0.72, 0.88], [0.6, 1], [0, 1]], h: [[[0.24, 0.56], [0.48, 0.56], [0.48, 0.8], [0.24, 0.8]]] },
  S: { w: 0.72, o: [[0, 0], [0.6, 0], [0.72, 0.12], [0.72, 0.5], [0.6, 0.6], [0.26, 0.6], [0.26, 0.78], [0.7, 0.78], [0.7, 1], [0.12, 1], [0, 0.88], [0, 0.5], [0.12, 0.4], [0.46, 0.4], [0.46, 0.22], [0, 0.22]] },
  T: { w: 0.72, o: [[0.24, 0], [0.48, 0], [0.48, 0.78], [0.72, 0.78], [0.72, 1], [0, 1], [0, 0.78], [0.24, 0.78]] },
  U: { w: 0.74, o: [[0, 1], [0, 0.12], [0.12, 0], [0.62, 0], [0.74, 0.12], [0.74, 1], [0.5, 1], [0.5, 0.22], [0.24, 0.22], [0.24, 1]] },
  V: { w: 0.78, o: [[0.25, 0], [0.53, 0], [0.78, 1], [0.52, 1], [0.39, 0.42], [0.26, 1], [0, 1]] },
  W: { w: 0.96, o: [[0, 1], [0.13, 0], [0.36, 0], [0.48, 0.4], [0.6, 0], [0.83, 0], [0.96, 1], [0.73, 1], [0.69, 0.5], [0.57, 0.88], [0.39, 0.88], [0.27, 0.5], [0.23, 1]] },
  X: { w: 0.78, o: [[0, 0], [0.26, 0], [0.39, 0.3], [0.52, 0], [0.78, 0], [0.53, 0.5], [0.78, 1], [0.52, 1], [0.39, 0.7], [0.26, 1], [0, 1], [0.25, 0.5]] },
  Y: { w: 0.78, o: [[0, 1], [0.26, 1], [0.39, 0.7], [0.52, 1], [0.78, 1], [0.52, 0.46], [0.52, 0], [0.26, 0], [0.26, 0.46]] },
  Z: { w: 0.7, o: [[0, 0], [0.7, 0], [0.7, 0.22], [0.32, 0.22], [0.7, 0.8], [0.7, 1], [0, 1], [0, 0.78], [0.38, 0.78], [0, 0.2]] },
  '·': { w: 0.2, o: [[0, 0.41], [0.2, 0.41], [0.2, 0.59], [0, 0.59]] },
  '-': { w: 0.42, o: [[0, 0.4], [0.42, 0.4], [0.42, 0.58], [0, 0.58]] },
}
const SPACE = 0.42
const TRACK = 0.13

/** width of a word set in block glyphs at height `size` */
export function textWidth(text: string, size: number) {
  let x = 0
  for (const ch of text.toUpperCase()) x += ch === ' ' ? SPACE * size : ((G[ch]?.w ?? 0.6) + TRACK) * size
  return x - TRACK * size
}

const glyphCache = new Map<string, THREE.BufferGeometry>()
/** an extruded, bevelled glyph (cached per char/size/depth) */
function glyphGeo(ch: string, size: number, depth: number) {
  const k = `${ch}|${size}|${depth}`
  let g = glyphCache.get(k)
  if (g) return g
  const gl = G[ch]
  const shape = new THREE.Shape(gl.o.map(([a, b]) => new THREE.Vector2(a * size, b * size)))
  for (const h of gl.h ?? []) shape.holes.push(new THREE.Path(h.map(([a, b]) => new THREE.Vector2(a * size, b * size))))
  g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: depth * 0.16, bevelSize: size * 0.012, bevelSegments: 1, curveSegments: 1 })
  glyphCache.set(k, g)
  return g
}

/**
 * Channel letters centred on the frame origin: baseline at y = 0, faces toward +z, extruding from z = 0 to `depth`.
 * `align`: 'center' (default) or 'left'. Returns the set width.
 */
export function channelLetters(F: Frame, text: string, size: number, depth: number, mat: THREE.Material, align: 'center' | 'left' = 'center') {
  const w = textWidth(text, size)
  let x = align === 'center' ? -w / 2 : 0
  for (const ch of text.toUpperCase()) {
    if (ch === ' ') {
      x += SPACE * size
      continue
    }
    const gl = G[ch]
    if (!gl) continue
    F.put(glyphGeo(ch, size, depth), mat, x, 0, 0)
    x += (gl.w + TRACK) * size
  }
  return w
}

/* ───────────────────────── painted panels (canvas) ───────────────────────── */

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}
function tex(c: HTMLCanvasElement, D: D) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  D.push(t)
  return t
}

export type PanelStyle = { bg: string; ink: string; sub?: string; rule?: string; font?: string }
export const PANEL = {
  dark: { bg: '#1c1a20', ink: '#ffb24a', sub: '#efe6d6', rule: '#c89b3c' },
  cream: { bg: '#efe4cc', ink: '#2a2228', sub: '#6a4a2a', rule: '#b8862e' },
  green: { bg: '#24402c', ink: '#f4e3b8', sub: '#cfe2c4', rule: '#d6a84a' },
  purple: { bg: '#2a1840', ink: '#ffb24a', sub: '#e6d8ff', rule: '#9b6bff' },
} satisfies Record<string, PanelStyle>

/** a sign panel texture: title (+ optional subtitle), sized to the board's aspect so text never stretches */
export function panelTexture(title: string, sub: string | null, aspect: number, st: PanelStyle, D: D) {
  const H = 256
  const W = Math.round(H * aspect)
  const [c, g] = canvas(W, H)
  g.fillStyle = st.bg
  g.fillRect(0, 0, W, H)
  // subtle paint grain
  for (let i = 0; i < W * 0.6; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},0.035)`
    g.fillRect(Math.random() * W, Math.random() * H, 2, 2)
  }
  if (st.rule) {
    g.strokeStyle = st.rule
    g.lineWidth = 6
    g.strokeRect(14, 14, W - 28, H - 28)
  }
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = st.ink
  let size = sub ? 112 : 132
  g.font = `400 ${size}px Anton, Impact, sans-serif`
  while (g.measureText(title).width > W - 70 && size > 30) g.font = `400 ${(size -= 4)}px Anton, Impact, sans-serif`
  g.fillText(title, W / 2, sub ? H * 0.42 : H * 0.53)
  if (sub) {
    let s2 = 36
    g.font = `600 ${s2}px "JetBrains Mono", monospace`
    while (g.measureText(sub).width > W - 70 && s2 > 14) g.font = `600 ${(s2 -= 2)}px "JetBrains Mono", monospace`
    g.fillStyle = st.sub ?? st.ink
    g.fillText(sub, W / 2, H * 0.76)
  }
  return tex(c, D)
}

/** multi-line board text (welcome boards, plaques): a heading + body lines */
export function boardTexture(heading: string, lines: string[], aspect: number, st: PanelStyle, D: D, engraved = false) {
  const H = 512
  const W = Math.round(H * aspect)
  const [c, g] = canvas(W, H)
  g.fillStyle = st.bg
  g.fillRect(0, 0, W, H)
  if (engraved) {
    // brushed bronze: streaks + a darker rim
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,230,180' : '60,40,20'},0.05)`
      g.fillRect(0, Math.random() * H, W, 1 + Math.random() * 2)
    }
  }
  if (st.rule) {
    g.strokeStyle = st.rule
    g.lineWidth = 8
    g.strokeRect(20, 20, W - 40, H - 40)
  }
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const write = (text: string, y: number, font: string, col: string) => {
    g.font = font
    if (engraved) {
      g.fillStyle = 'rgba(255,240,210,0.35)'
      g.fillText(text, W / 2 + 1.5, y + 1.5)
    }
    g.fillStyle = col
    g.fillText(text, W / 2, y)
  }
  let hs = 84
  g.font = `400 ${hs}px Anton, Impact, sans-serif`
  while (g.measureText(heading).width > W - 90 && hs > 30) g.font = `400 ${(hs -= 4)}px Anton, Impact, sans-serif`
  write(heading, 92, g.font, st.ink)
  const n = lines.length
  const top = 175
  const step = Math.min(56, (H - top - 50) / Math.max(1, n))
  let bs = Math.min(34, step * 0.62)
  g.font = `500 ${bs}px "JetBrains Mono", monospace`
  const widest = Math.max(...lines.map((l) => g.measureText(l).width))
  while (widest * (bs / 34) > W - 100 && bs > 12) bs -= 1
  lines.forEach((l, i) => write(l, top + step * (i + 0.5), `500 ${bs}px "JetBrains Mono", monospace`, st.sub ?? st.ink))
  return tex(c, D)
}

/* ───────────────────────── built sign types ───────────────────────── */

export type SignMats = { frame: THREE.Material; metal: THREE.Material; gold: THREE.Material; stone: THREE.Material }

/**
 * Framed board: backing panel + moulded frame + painted face (both sides if `twoSided`). Origin = board centre.
 */
export function framedBoard(F: Frame, w: number, h: number, face: THREE.Material, M: SignMats, twoSided = false, depth = 0.08) {
  F.box(w, h, depth, M.frame, 0, 0, 0)
  const r = 0.06
  for (const [bw, bh, x, y] of [[w + r * 2, r, 0, h / 2 + r / 2], [w + r * 2, r, 0, -h / 2 - r / 2], [r, h, -w / 2 - r / 2, 0], [r, h, w / 2 + r / 2, 0]] as const) F.box(bw, bh, depth + 0.05, M.gold, x, y, 0)
  F.put(new THREE.PlaneGeometry(w - 0.04, h - 0.04), face, 0, 0, depth / 2 + 0.004, 0, 0, 0, false)
  if (twoSided) F.put(new THREE.PlaneGeometry(w - 0.04, h - 0.04), face, 0, 0, -depth / 2 - 0.004, 0, Math.PI, 0, false)
}

/** a board on two square posts with stone footings (welcome board, directions, notices). Origin = ground centre. */
export function postedBoard(F: Frame, w: number, h: number, boardY: number, face: THREE.Material, M: SignMats, twoSided = false) {
  for (const sx of [-1, 1]) {
    const x = sx * (w / 2 + 0.14)
    F.box(0.16, boardY + h / 2 + 0.25, 0.16, M.metal, x, (boardY + h / 2 + 0.25) / 2, 0)
    F.box(0.36, 0.22, 0.36, M.stone, x, 0.11, 0)
    F.put(new THREE.SphereGeometry(0.09, 10, 8), M.gold, x, boardY + h / 2 + 0.3, 0)
  }
  // a small roof cap keeps the board from reading as a floating card
  F.box(w + 0.6, 0.08, 0.34, M.metal, 0, boardY + h / 2 + 0.18, 0)
  framedBoard(F.sub(0, boardY, 0), w, h, face, M, twoSided)
}

/** hanging sign: wall plate + iron arm + two chains + a double-sided board. Origin at the wall, arm along +z. */
export function hangingSign(F: Frame, w: number, h: number, face: THREE.Material, M: SignMats, arm = 1.4) {
  F.box(0.08, 0.5, 0.06, M.metal, 0, 0, 0.03)
  F.box(0.05, 0.05, arm, M.metal, 0, 0.1, arm / 2)
  F.put(new THREE.CylinderGeometry(0.012, 0.012, arm * 0.9, 6), M.metal, 0, -0.12, arm * 0.45, Math.PI / 2 - 0.5)
  F.put(new THREE.SphereGeometry(0.05, 8, 6), M.gold, 0, 0.1, arm)
  const cz = arm * 0.55
  for (const dz of [-w * 0.36, w * 0.36]) F.put(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 4), M.metal, 0, -0.05, cz + dz)
  framedBoard(F.sub(0, -0.2 - h / 2, cz, 0, Math.PI / 2, 0), w, h, face, M, true, 0.06)
}

/** engraved plaque on a small stone plinth or flush on a wall (wall = true). Origin = plaque centre. */
export function plaque(F: Frame, w: number, h: number, face: THREE.Material, M: SignMats) {
  F.box(w + 0.08, h + 0.08, 0.04, M.gold, 0, 0, 0)
  F.put(new THREE.PlaneGeometry(w, h), face, 0, 0, 0.022, 0, 0, 0, false)
  for (const [x, y] of [[-w / 2 + 0.05, h / 2 - 0.05], [w / 2 - 0.05, h / 2 - 0.05], [-w / 2 + 0.05, -h / 2 + 0.05], [w / 2 - 0.05, -h / 2 + 0.05]]) F.put(new THREE.SphereGeometry(0.015, 6, 4), M.metal, x, y, 0.025)
}

/** a reading lectern: stone pedestal with an angled plaque on top (statue + castle lore). Origin = ground. */
export function lectern(F: Frame, w: number, h: number, face: THREE.Material, M: SignMats) {
  F.box(0.5, 0.95, 0.4, M.stone, 0, 0.475, 0)
  F.box(0.66, 0.08, 0.52, M.stone, 0, 0.04, 0)
  const top = F.sub(0, 1.02, 0.02, -0.55, 0, 0)
  top.box(w + 0.12, h + 0.12, 0.06, M.metal, 0, 0, 0)
  plaque(top.sub(0, 0, 0.035), w, h, face, M)
}
