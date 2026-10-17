import * as THREE from 'three'
import type { Town } from './buildings'
import { boxUV } from './kit'
import type { Frame } from './signs'

/**
 * FACADE KIT — shared pieces that give a flat wall architectural depth without carving the wall itself:
 *   recessedWindow()  a sash / industrial window: dark inner reveal shadow, textured glazing, a tinted reflective glass skin, a protruding frame, a stone surround
 *                     (jambs + lintel with an optional arch head) and a projecting sill — the glazing reads as set back behind the frame.
 *   wallBays()        everything a long side or rear wall needs: a plinth band, pilasters between bays, windows in each bay (alternate rooms lit), a string course,
 *                     a cornice, a downpipe and optional wall lanterns — so no wall is ever a blank slab.
 * All geometry goes through the town's static batch (cheap); materials come from the palette passed in.
 */
export type WinMats = { frame: THREE.Material; trim: THREE.Material; plinth?: THREE.Material; wall?: THREE.Material; metal?: THREE.Material }

const glassCache = new WeakMap<Town, THREE.Material>()
/** a faint, reflective glass skin laid over the textured glazing (sky and street reflect in it) */
export function glassSkin(T: Town) {
  let m = glassCache.get(T)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: '#cfe0f4', transparent: true, opacity: 0.16, roughness: 0.04, metalness: 0.35, envMapIntensity: 1.3, depthWrite: false })
    T.disposables.push(m)
    glassCache.set(T, m)
  }
  return m
}

export type WindowOpts = {
  lit?: boolean
  /** a rounded head (half-disc) instead of a flat one */
  arch?: boolean
  /** a thin dark steel frame (industrial) instead of a painted one with a stone surround */
  industrial?: boolean
  /** an extra sill / lintel depth multiplier */
  depth?: number
}

/** a window at (x, y) of width w and height h on the wall plane z = 0 of `F` (its local +z points out of the wall) */
export function recessedWindow(T: Town, F: Frame, M: WinMats, x: number, y: number, w: number, h: number, o: WindowOpts = {}) {
  const P = T.P
  const dp = o.depth ?? 1
  const t = o.industrial ? 0.07 : 0.1 // frame thickness
  // 1. the inner reveal: a dark shadow along the top and one side, so the glazing reads as set back
  F.box(w, h, 0.02, P.windowDark, x, y, 0.012, false)
  F.box(w - 0.02, 0.06, 0.05, M.frame, x, y + h / 2 - 0.03, 0.035, false)
  F.box(0.06, h - 0.1, 0.05, M.frame, x - w / 2 + 0.03, y, 0.035, false)
  // 2. the glazing (textured sash windows, lamplit or dark) and the reflective skin over it
  const pane = new THREE.PlaneGeometry(w - 2 * t, h - 2 * t)
  F.put(pane, o.lit ? P.windowLit : P.windowDark, x, y, 0.045, 0, 0, 0, false)
  F.put(new THREE.PlaneGeometry(w - 2 * t, h - 2 * t), glassSkin(T), x, y, 0.062, 0, 0, 0, false)
  // 3. the frame: head, sill rail, jambs, and a central meeting bar
  const fd = 0.11 * dp
  F.box(w, t, fd, M.frame, x, y + h / 2 - t / 2, fd / 2 + 0.02)
  F.box(w, t, fd, M.frame, x, y - h / 2 + t / 2, fd / 2 + 0.02)
  for (const s of [-1, 1]) F.box(t, h, fd, M.frame, x + s * (w / 2 - t / 2), y, fd / 2 + 0.02)
  F.box(0.05, h - 2 * t, 0.07 * dp, M.frame, x, y, 0.07)
  if (h > 1.9 && !o.industrial) F.box(w - 2 * t, 0.05, 0.07 * dp, M.frame, x, y + h * 0.18, 0.07)
  if (o.industrial) {
    // a transom bar a third of the way up, like a shopfront or factory sash
    F.box(w - 2 * t, 0.05, 0.08, M.frame, x, y + h * 0.2, 0.08)
    return
  }
  // 4. the stone surround: jambs a little proud of the wall, a lintel (flat, or an arch), a projecting sill
  for (const s of [-1, 1]) F.box(0.13, h + 0.1, 0.1 * dp, M.trim, x + s * (w / 2 + 0.065), y, 0.05 * dp)
  if (o.arch) {
    const arc = new THREE.TorusGeometry(w / 2 + 0.065, 0.07, 6, 18, Math.PI)
    F.put(arc, M.trim, x, y + h / 2, 0.06 * dp)
    F.put(new THREE.CircleGeometry(w / 2, 18, 0, Math.PI), o.lit ? P.windowLit : P.windowDark, x, y + h / 2, 0.04, 0, 0, 0, false)
  } else F.box(w + 0.36, 0.2, 0.15 * dp, M.trim, x, y + h / 2 + 0.1, 0.07 * dp)
  F.box(w + 0.34, 0.1, 0.26 * dp, M.trim, x, y - h / 2 - 0.05, 0.12 * dp)
  F.box(w + 0.1, 0.05, 0.1, M.trim, x, y - h / 2 - 0.12, 0.05) // the drip under the sill
}

export type BayOpts = {
  /** wall length (local x, centred) and height */
  length: number
  height: number
  /** window rows: [centre y, height] per row; width = bay width − pilaster − margin */
  rows: [number, number][]
  /** window width cap */
  maxWindow?: number
  arch?: boolean
  industrial?: boolean
  /** skip these bay indices (a door goes there) */
  skip?: number[]
  seed?: number
  /** pilaster width (0 = none), plinth band height (0 = none), string course heights (y values) */
  pilaster?: number
  plinth?: number
  strings?: number[]
  cornice?: number
  downpipe?: boolean
  /** a wall lantern between bays (warm light glow is the caller's business) */
  lanterns?: THREE.Material
}

/** a fully articulated wall: bays of windows between pilasters, with a plinth, string courses and a cornice */
export function wallBays(T: Town, F: Frame, M: WinMats, o: BayOpts) {
  const { length: L, height: H } = o
  const n = Math.max(1, Math.round(L / 3.2))
  const bw = L / n
  const seed = o.seed ?? 1
  const pw = o.pilaster ?? 0.4
  if (o.plinth) F.put(boxUV(L + 0.1, o.plinth, 0.22, 1.2), M.plinth ?? M.trim, 0, o.plinth / 2, 0.06)
  for (const y of o.strings ?? []) F.put(boxUV(L + 0.08, 0.16, 0.2, 1), M.trim, 0, y, 0.07)
  if (o.cornice) {
    F.put(boxUV(L + 0.3, o.cornice, 0.46, 1.2), M.trim, 0, H - o.cornice / 2, 0.16)
    F.put(boxUV(L + 0.4, 0.1, 0.56, 1), M.trim, 0, H + 0.05, 0.2)
  }
  if (pw > 0) for (let i = 0; i <= n; i++) F.put(boxUV(pw, H - (o.plinth ?? 0), 0.2, 1.2), M.trim, -L / 2 + i * bw, (H + (o.plinth ?? 0)) / 2 - 0.0, 0.08)
  for (let b = 0; b < n; b++) {
    if (o.skip?.includes(b)) continue
    const cx = -L / 2 + (b + 0.5) * bw
    o.rows.forEach(([y, h], r) => {
      const w = Math.min(o.maxWindow ?? 1.4, bw - pw - 0.9)
      recessedWindow(T, F, M, cx, y, w, h, { lit: (seed + b + r) % 3 === 0, arch: o.arch && r === o.rows.length - 1, industrial: o.industrial })
    })
    if (o.lanterns && b < n - 1) {
      const lx = -L / 2 + (b + 1) * bw
      F.box(0.05, 0.05, 0.28, M.metal ?? M.frame, lx, 3.0, 0.16)
      F.box(0.16, 0.26, 0.16, o.lanterns, lx, 2.85, 0.3, false)
    }
  }
  if (o.downpipe) F.put(new THREE.CylinderGeometry(0.05, 0.05, H - 0.3, 6), M.metal ?? M.frame, L / 2 - 0.35, H / 2, 0.14)
}
