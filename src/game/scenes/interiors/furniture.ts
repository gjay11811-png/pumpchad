import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { Frame } from '../world/signs'
import type { StaticBatch } from '../world/kit'
import { bookSpines, painting, rugTexture, shelfGoods, windowView, cobweb } from './art'

/**
 * Furniture kit for house interiors. Every piece is built at a local origin (floor level, front = local +z) through
 * a `Frame`, batched with the rest of the room, and registers its own collider. Shared materials come from `IMats`;
 * per-colour fabrics / paints are cached so a room stays a handful of draw calls.
 */
type D = (THREE.Material | THREE.Texture | THREE.BufferGeometry)[]

export type IMats = ReturnType<typeof interiorMats>
export function interiorMats(D: D) {
  const std = (p: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.8, ...p })
    D.push(m)
    return m
  }
  const cache = new Map<string, THREE.MeshStandardMaterial>()
  const glowM = (c: string, k: number) => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), toneMapped: false })
    D.push(m)
    return m
  }
  return {
    woodDark: std({ color: '#3a2618', roughness: 0.6 }),
    wood: std({ color: '#6a4428', roughness: 0.62 }),
    woodLight: std({ color: '#a07850', roughness: 0.66 }),
    iron: std({ color: '#222126', metalness: 0.8, roughness: 0.42 }),
    brass: std({ color: '#c89a48', metalness: 1, roughness: 0.32 }),
    chrome: std({ color: '#d8d6d0', metalness: 1, roughness: 0.18 }),
    stone: std({ color: '#7a7068', roughness: 0.92 }),
    stoneLight: std({ color: '#b8ab98', roughness: 0.9 }),
    soot: std({ color: '#141012', roughness: 1 }),
    porcelain: std({ color: '#efeae0', roughness: 0.25 }),
    linen: std({ color: '#e8e0cc', roughness: 0.95 }),
    sheet: std({ color: '#8c887f', roughness: 1, side: THREE.DoubleSide }), // dust sheets (aged, greyed)
    pumpkin: std({ color: '#e0661c', roughness: 0.55 }),
    leaf: std({ color: '#3f6a34', roughness: 0.85 }),
    soil: std({ color: '#3a2a1e', roughness: 1 }),
    mirror: std({ color: '#c8d0dc', metalness: 1, roughness: 0.05 }),
    candle: glowM('#ffd28a', 2.4),
    ember: glowM('#ff7a2a', 2.6),
    potionGreen: glowM('#7aff8a', 2),
    potionPurple: glowM('#c08aff', 2.2),
    crystal: glowM('#8ad8ff', 2.2),
    /** a cached fabric / paint colour */
    fab(color: string, rough = 0.9) {
      const k = color + rough
      let m = cache.get(k)
      if (!m) {
        m = std({ color, roughness: rough })
        cache.set(k, m)
      }
      return m
    },
    D,
  }
}

/** what a builder can do: batch geometry, block the player, light the room, light a fire, mark something inspectable */
export type Kit = {
  B: StaticBatch
  M: IMats
  /** world-axis collider (x0..x1, z0..z1); `level` 0 = ground floor, 1 = loft, undefined = both */
  block(x0: number, x1: number, z0: number, z1: number, level?: 0 | 1): void
  light(x: number, y: number, z: number, color: string, intensity: number, dist: number, flicker?: boolean): void
  fire(x: number, y: number, z: number, scale: number): void
  inspect(id: string, label: string, x: number, z: number, r: number, y?: number): void
  /** spots that animate (candle flames bobbing, cauldron bubbles, clock pendulum) */
  anim(fn: (t: number) => void): void
  scene: THREE.Scene
}

/** collider for a w×d footprint centred at (x,z) rotated by ry */
export function footprint(K: Kit, x: number, z: number, w: number, d: number, ry: number, level?: 0 | 1, pad = 0.05) {
  const c = Math.abs(Math.cos(ry))
  const s = Math.abs(Math.sin(ry))
  const hw = (w * c + d * s) / 2 + pad
  const hd = (w * s + d * c) / 2 + pad
  K.block(x - hw, x + hw, z - hd, z + hd, level)
}

const rbox = (w: number, h: number, d: number, r = 0.04) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2))

/* ───────────────────────── seating, tables, beds ───────────────────────── */

export function rug(K: Kit, x: number, z: number, w: number, d: number, ry: number, colors: [string, string, string], y = 0.006, seed = 1) {
  const m = new THREE.MeshStandardMaterial({ map: rugTexture(K.M.D, colors[0], colors[1], colors[2], seed), roughness: 1 })
  K.M.D.push(m)
  Frame.at(K.B, x, y, z, ry).put(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), m, 0, 0, 0, 0, 0, 0, false)
}

export function table(K: Kit, x: number, z: number, ry: number, o: { w?: number; d?: number; h?: number; round?: boolean; mat?: THREE.Material; cloth?: string; level?: 0 | 1; y?: number } = {}) {
  const w = o.w ?? 1.4
  const d = o.d ?? 0.8
  const h = o.h ?? 0.76
  const y = o.y ?? 0
  const mat = o.mat ?? K.M.wood
  const F = Frame.at(K.B, x, y, z, ry)
  if (o.round) {
    F.put(new THREE.CylinderGeometry(w / 2, w / 2, 0.05, 28), mat, 0, h - 0.025, 0)
    F.put(new THREE.CylinderGeometry(0.06, 0.08, h - 0.05, 10), mat, 0, (h - 0.05) / 2, 0)
    F.put(new THREE.CylinderGeometry(0.3, 0.34, 0.05, 16), mat, 0, 0.025, 0)
    if (o.cloth) F.put(new THREE.CylinderGeometry(w / 2 + 0.06, w / 2 + 0.14, 0.32, 28, 1, true), K.M.fab(o.cloth), 0, h - 0.17, 0)
  } else {
    F.put(rbox(w, 0.05, d, 0.015), mat, 0, h - 0.025, 0)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) F.put(new THREE.BoxGeometry(0.06, h - 0.05, 0.06), mat, sx * (w / 2 - 0.08), (h - 0.05) / 2, sz * (d / 2 - 0.08))
    F.put(new THREE.BoxGeometry(w - 0.2, 0.08, 0.03), mat, 0, h - 0.1, d / 2 - 0.08)
    if (o.cloth) F.put(new THREE.BoxGeometry(w * 0.4, 0.006, d + 0.12), K.M.fab(o.cloth), 0, h + 0.003, 0)
  }
  footprint(K, x, z, w, d, ry, o.level)
}

export function chair(K: Kit, x: number, z: number, ry: number, o: { mat?: THREE.Material; pad?: string; level?: 0 | 1; y?: number } = {}) {
  const F = Frame.at(K.B, x, o.y ?? 0, z, ry)
  const m = o.mat ?? K.M.wood
  F.put(rbox(0.44, 0.05, 0.42, 0.01), m, 0, 0.46, 0)
  if (o.pad) F.put(rbox(0.4, 0.05, 0.38, 0.02), K.M.fab(o.pad), 0, 0.5, 0)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) F.put(new THREE.BoxGeometry(0.04, 0.46, 0.04), m, sx * 0.19, 0.23, sz * 0.18)
  for (const sx of [-1, 1]) F.put(new THREE.BoxGeometry(0.04, 0.5, 0.04), m, sx * 0.19, 0.73, -0.19)
  for (const y of [0.62, 0.86]) F.put(new THREE.BoxGeometry(0.42, 0.05, 0.03), m, 0, y, -0.19)
  footprint(K, x, z, 0.44, 0.44, ry, o.level, 0)
}

export function armchair(K: Kit, x: number, z: number, ry: number, color: string, level?: 0 | 1) {
  const F = Frame.at(K.B, x, 0, z, ry)
  const f = K.M.fab(color)
  F.put(rbox(0.86, 0.36, 0.8, 0.08), f, 0, 0.3, 0)
  F.put(rbox(0.86, 0.62, 0.2, 0.08), f, 0, 0.72, -0.32)
  for (const sx of [-1, 1]) F.put(rbox(0.16, 0.3, 0.74, 0.06), f, sx * 0.38, 0.6, 0.02)
  F.put(rbox(0.6, 0.12, 0.58, 0.05), f, 0, 0.52, 0.06)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) F.put(new THREE.CylinderGeometry(0.03, 0.02, 0.12, 6), K.M.woodDark, sx * 0.36, 0.06, sz * 0.32)
  footprint(K, x, z, 0.86, 0.8, ry, level)
}

export function sofa(K: Kit, x: number, z: number, ry: number, color: string, w = 2) {
  const F = Frame.at(K.B, x, 0, z, ry)
  const f = K.M.fab(color)
  F.put(rbox(w, 0.34, 0.86, 0.08), f, 0, 0.3, 0)
  F.put(rbox(w, 0.56, 0.22, 0.08), f, 0, 0.7, -0.33)
  for (const sx of [-1, 1]) F.put(rbox(0.2, 0.28, 0.8, 0.08), f, sx * (w / 2 - 0.1), 0.58, 0.02)
  for (let k = 0; k < 2; k++) F.put(rbox(w / 2 - 0.22, 0.12, 0.6, 0.05), f, (k - 0.5) * (w / 2 - 0.18), 0.52, 0.06)
  F.put(rbox(0.36, 0.3, 0.12, 0.06), K.M.fab('#c89a48'), -w / 2 + 0.42, 0.72, -0.2) // cushion
  footprint(K, x, z, w, 0.86, ry)
}

export function bed(K: Kit, x: number, z: number, ry: number, o: { w?: number; blanket: string; frame?: THREE.Material; canopy?: string; level?: 0 | 1; y?: number }) {
  const w = o.w ?? 1.5
  const L = 2.05
  const y = o.y ?? 0
  const F = Frame.at(K.B, x, y, z, ry)
  const fr = o.frame ?? K.M.woodDark
  F.put(rbox(w, 0.22, L, 0.03), fr, 0, 0.28, 0)
  F.put(rbox(w - 0.08, 0.2, L - 0.1, 0.06), K.M.linen, 0, 0.48, 0.02)
  F.put(rbox(w - 0.02, 0.08, L * 0.62, 0.04), K.M.fab(o.blanket), 0, 0.6, L * 0.17) // blanket
  F.put(rbox(w - 0.02, 0.24, 0.02, 0.01), K.M.fab(o.blanket), 0, 0.48, L / 2 + 0.01) // overhang
  for (const sx of w > 1.2 ? [-1, 1] : [0]) F.put(rbox(w > 1.2 ? w / 2 - 0.12 : w - 0.2, 0.12, 0.36, 0.06), K.M.linen, sx * (w / 4), 0.64, -L / 2 + 0.3)
  F.put(rbox(w + 0.06, 1.1, 0.08, 0.02), fr, 0, 0.75, -L / 2 - 0.03) // headboard
  F.put(rbox(w + 0.06, 0.6, 0.08, 0.02), fr, 0, 0.42, L / 2 + 0.03) // footboard
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) F.put(new THREE.CylinderGeometry(0.045, 0.045, sz < 0 ? 1.35 : 0.8, 8), fr, sx * (w / 2 + 0.03), sz < 0 ? 0.68 : 0.4, sz * (L / 2 + 0.03))
  if (o.canopy) {
    const c = K.M.fab(o.canopy)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) F.put(new THREE.CylinderGeometry(0.035, 0.035, 2.1, 8), fr, sx * (w / 2 + 0.03), 1.05, sz * (L / 2 + 0.03))
    F.put(new THREE.BoxGeometry(w + 0.2, 0.06, L + 0.2), c, 0, 2.12, 0)
    for (const sx of [-1, 1]) F.put(new THREE.PlaneGeometry(L + 0.2, 1.6, 6, 1).rotateY(Math.PI / 2), c, sx * (w / 2 + 0.1), 1.3, 0, 0, 0, 0, false)
    F.put(new THREE.PlaneGeometry(w + 0.2, 1.6), c, 0, 1.3, -L / 2 - 0.1, 0, 0, 0, false)
  }
  footprint(K, x, z, w + 0.1, L + 0.1, ry, o.level)
}

/* ───────────────────────── storage, shelves, clocks ───────────────────────── */

export function bookshelf(K: Kit, x: number, z: number, ry: number, o: { w?: number; h?: number; seed?: number; level?: 0 | 1; y?: number; palette?: string[] } = {}) {
  const w = o.w ?? 1.6
  const h = o.h ?? 2.2
  const F = Frame.at(K.B, x, o.y ?? 0, z, ry)
  const m = K.M.woodDark
  F.put(new THREE.BoxGeometry(w, h, 0.04), m, 0, h / 2, -0.17)
  for (const sx of [-1, 1]) F.put(new THREE.BoxGeometry(0.05, h, 0.38), m, sx * (w / 2 - 0.025), h / 2, 0)
  F.put(new THREE.BoxGeometry(w + 0.08, 0.08, 0.42), m, 0, h + 0.04, 0)
  const shelves = Math.max(3, Math.round(h / 0.42))
  const sh = (h - 0.12) / shelves
  const spines = new THREE.MeshStandardMaterial({ map: bookSpines(K.M.D, o.seed ?? 1, o.palette), roughness: 0.85 })
  K.M.D.push(spines)
  for (let k = 0; k < shelves; k++) {
    const y = 0.08 + k * sh
    F.put(new THREE.BoxGeometry(w - 0.06, 0.035, 0.36), m, 0, y, 0)
    const books = new THREE.BoxGeometry(w - 0.12, sh * 0.82, 0.24)
    const uv = books.attributes.uv as THREE.BufferAttribute
    // the spine texture on the front face only; the rest reads as book-block colour
    for (let i = 0; i < uv.count; i++) if (i < 16 || i >= 20) uv.setXY(i, 0.02, 0.5)
    F.put(books, spines, 0, y + 0.02 + sh * 0.41, 0.02 + ((k * 7) % 3) * 0.01)
  }
  footprint(K, x, z, w, 0.42, ry, o.level)
}

export function wardrobe(K: Kit, x: number, z: number, ry: number, o: { mat?: THREE.Material; level?: 0 | 1; y?: number } = {}) {
  const F = Frame.at(K.B, x, o.y ?? 0, z, ry)
  const m = o.mat ?? K.M.wood
  F.put(rbox(1.2, 2.0, 0.6, 0.02), m, 0, 1.05, 0)
  F.put(rbox(1.28, 0.1, 0.66, 0.02), m, 0, 2.1, 0)
  F.put(rbox(1.24, 0.1, 0.64, 0.02), K.M.woodDark, 0, 0.05, 0)
  for (const sx of [-1, 1]) {
    F.put(new THREE.BoxGeometry(0.5, 1.6, 0.02), K.M.woodDark, sx * 0.29, 1.12, 0.305)
    F.put(new THREE.SphereGeometry(0.025, 8, 6), K.M.brass, sx * 0.06, 1.1, 0.33)
  }
  footprint(K, x, z, 1.28, 0.66, ry, o.level)
}

export function dresser(K: Kit, x: number, z: number, ry: number, o: { level?: 0 | 1; y?: number; mirror?: boolean } = {}) {
  const F = Frame.at(K.B, x, o.y ?? 0, z, ry)
  F.put(rbox(1.1, 0.85, 0.5, 0.02), K.M.wood, 0, 0.45, 0)
  for (let k = 0; k < 3; k++) {
    F.put(new THREE.BoxGeometry(1.0, 0.22, 0.02), K.M.woodDark, 0, 0.18 + k * 0.26, 0.255)
    for (const sx of [-1, 1]) F.put(new THREE.SphereGeometry(0.02, 8, 6), K.M.brass, sx * 0.25, 0.18 + k * 0.26, 0.275)
  }
  if (o.mirror) {
    F.put(new THREE.BoxGeometry(0.7, 0.8, 0.04), K.M.woodDark, 0, 1.35, -0.2)
    F.put(new THREE.PlaneGeometry(0.6, 0.7), K.M.mirror, 0, 1.35, -0.175, 0, 0, 0, false)
  }
  footprint(K, x, z, 1.1, 0.5, ry, o.level)
}

export function grandfatherClock(K: Kit, x: number, z: number, ry: number) {
  const F = Frame.at(K.B, x, 0, z, ry)
  F.put(rbox(0.52, 2.1, 0.32, 0.02), K.M.woodDark, 0, 1.05, 0)
  F.put(rbox(0.6, 0.18, 0.36, 0.02), K.M.woodDark, 0, 2.18, 0)
  F.put(new THREE.CircleGeometry(0.18, 24), K.M.porcelain, 0, 1.8, 0.165, 0, 0, 0, false)
  F.put(new THREE.TorusGeometry(0.19, 0.015, 6, 24), K.M.brass, 0, 1.8, 0.17)
  F.put(new THREE.BoxGeometry(0.3, 0.9, 0.01), K.M.soot, 0, 0.95, 0.162)
  // pendulum swings
  const pend = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.6, 4).translate(0, -0.3, 0), K.M.brass)
  const bob = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.015, 16).rotateX(Math.PI / 2).translate(0, -0.62, 0), K.M.brass)
  const g = new THREE.Group()
  g.add(pend, bob)
  const p = F.world(0, 1.36, 0.17)
  g.position.copy(p)
  g.rotation.y = ry
  K.scene.add(g)
  K.M.D.push(pend.geometry, bob.geometry)
  K.anim((t) => (g.rotation.z = Math.sin(t * 2.4) * 0.2))
  footprint(K, x, z, 0.6, 0.36, ry)
}

/* ───────────────────────── hearth, kitchen, bath ───────────────────────── */

/** stone fireplace against a wall (its back at local -z), with a mantel, a fire and a warm flickering light */
export function fireplace(K: Kit, x: number, z: number, ry: number, o: { w?: number; mantel?: boolean; lit?: boolean; stone?: THREE.Material } = {}) {
  const w = o.w ?? 1.7
  const F = Frame.at(K.B, x, 0, z, ry)
  const st = o.stone ?? K.M.stone
  F.put(rbox(w, 1.3, 0.55, 0.03), st, 0, 0.65, 0)
  F.put(new THREE.BoxGeometry(w * 0.56, 0.78, 0.4), K.M.soot, 0, 0.46, 0.09)
  F.put(new THREE.BoxGeometry(w + 0.6, 0.1, 0.8), st, 0, 0.05, 0.2) // hearth stone
  F.put(new THREE.BoxGeometry(w * 0.7, 1.5, 0.45), st, 0, 2.05, -0.06) // chimney breast
  if (o.mantel !== false) F.put(rbox(w + 0.3, 0.1, 0.36, 0.02), K.M.woodDark, 0, 1.34, 0.06)
  // andirons + logs
  for (const sx of [-1, 1]) F.put(new THREE.BoxGeometry(0.04, 0.2, 0.3), K.M.iron, sx * 0.3, 0.2, 0.15)
  for (const [lx, rz] of [[-0.06, 0.2], [0.08, -0.25]] as const) F.put(new THREE.CylinderGeometry(0.06, 0.07, 0.62, 8).rotateZ(Math.PI / 2 + rz), K.M.woodDark, lx, 0.2, 0.16)
  if (o.lit !== false) {
    const p = F.world(0, 0.22, 0.16)
    K.fire(p.x, p.y, p.z, 0.75)
    F.put(new THREE.BoxGeometry(0.5, 0.05, 0.2), K.M.ember, 0, 0.13, 0.16, 0, 0, 0, false)
    const lp = F.world(0, 0.7, 0.8)
    K.light(lp.x, lp.y, lp.z, '#ff8a3a', 6, 7, true)
  }
  footprint(K, x, z, w + 0.6, 0.8, ry)
  const ip = F.world(0, 0, 1.0)
  return ip
}

export function kitchen(K: Kit, x: number, z: number, ry: number, o: { len?: number; top?: THREE.Material; front?: string; stove?: boolean } = {}) {
  const len = o.len ?? 2.6
  const F = Frame.at(K.B, x, 0, z, ry)
  const front = K.M.fab(o.front ?? '#4a5a4a', 0.6)
  const top = o.top ?? K.M.stoneLight
  F.put(rbox(len, 0.86, 0.6, 0.01), front, 0, 0.43, 0)
  F.put(rbox(len + 0.04, 0.05, 0.64, 0.01), top, 0, 0.885, 0.01)
  for (let k = 0; k < Math.floor(len / 0.6); k++) {
    const cx = -len / 2 + 0.3 + k * 0.6
    F.put(new THREE.BoxGeometry(0.54, 0.66, 0.02), K.M.fab(o.front ?? '#4a5a4a', 0.5), cx, 0.43, 0.305)
    F.put(new THREE.BoxGeometry(0.12, 0.02, 0.02), K.M.brass, cx, 0.7, 0.325)
  }
  // wall shelf with crockery
  F.put(new THREE.BoxGeometry(len, 0.04, 0.26), K.M.wood, 0, 1.65, -0.17)
  for (let k = 0; k < 7; k++) F.put(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 16).rotateX(Math.PI / 2), K.M.porcelain, -len / 2 + 0.25 + k * (len / 7), 1.78, -0.25)
  // sink (left) + pots
  F.put(new THREE.BoxGeometry(0.5, 0.04, 0.4), K.M.chrome, -len / 2 + 0.45, 0.91, 0.02)
  F.put(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6), K.M.chrome, -len / 2 + 0.45, 1.05, -0.2)
  if (o.stove !== false) {
    // cast-iron range on the right end with a pot
    const sx = len / 2 + 0.45
    F.put(rbox(0.8, 0.9, 0.62, 0.02), K.M.iron, sx, 0.45, 0)
    for (const dx of [-0.18, 0.18]) F.put(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 16), K.M.soot, sx + dx, 0.91, 0.02)
    F.put(new THREE.CylinderGeometry(0.16, 0.14, 0.2, 16), K.M.iron, sx - 0.18, 1.02, 0.02)
    F.put(new THREE.BoxGeometry(0.5, 0.25, 0.02), K.M.ember, sx, 0.3, 0.315, 0, 0, 0, false)
    F.put(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 10), K.M.iron, sx, 1.7, -0.2)
    footprint(K, F.world(sx, 0, 0).x, F.world(sx, 0, 0).z, 0.8, 0.62, ry)
  }
  footprint(K, x, z, len, 0.64, ry)
}

export function bathtub(K: Kit, x: number, z: number, ry: number, level?: 0 | 1, y = 0) {
  const F = Frame.at(K.B, x, y, z, ry)
  const tub = new THREE.CylinderGeometry(0.42, 0.36, 0.55, 24, 1, true)
  tub.scale(2.0, 1, 1)
  F.put(tub, K.M.porcelain, 0, 0.42, 0)
  F.put(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 24).scale(2.0, 1, 1), K.M.porcelain, 0, 0.17, 0)
  F.put(new THREE.CylinderGeometry(0.36, 0.36, 0.01, 24).scale(2.0, 1, 1), K.M.fab('#9cc8d8', 0.1), 0, 0.5, 0)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) F.put(new THREE.SphereGeometry(0.05, 8, 6), K.M.brass, sx * 0.62, 0.07, sz * 0.22)
  F.put(new THREE.TorusGeometry(0.08, 0.015, 6, 12, Math.PI), K.M.brass, -0.82, 0.78, 0)
  footprint(K, x, z, 1.7, 0.86, ry, level)
}

export function washstand(K: Kit, x: number, z: number, ry: number, level?: 0 | 1, y = 0) {
  const F = Frame.at(K.B, x, y, z, ry)
  F.put(rbox(0.8, 0.8, 0.45, 0.02), K.M.woodLight, 0, 0.4, 0)
  F.put(new THREE.CylinderGeometry(0.2, 0.12, 0.12, 20), K.M.porcelain, 0, 0.86, 0)
  F.put(new THREE.CylinderGeometry(0.06, 0.09, 0.3, 12), K.M.porcelain, 0.25, 0.95, 0)
  F.put(new THREE.BoxGeometry(0.5, 0.65, 0.03), K.M.woodDark, 0, 1.5, -0.2)
  F.put(new THREE.PlaneGeometry(0.42, 0.56), K.M.mirror, 0, 1.5, -0.18, 0, 0, 0, false)
  footprint(K, x, z, 0.8, 0.45, ry, level)
}

/* ───────────────────────── walls: windows, paintings, lights, cobwebs ───────────────────────── */

/** a window set into a wall (its plane at local z=0, facing +z into the room): moonlit view, frame, sill, curtains */
export function windowOnWall(K: Kit, F: Frame, w: number, h: number, y: number, curtain?: string, seed = 1) {
  const view = new THREE.MeshBasicMaterial({ map: windowView(K.M.D, seed), color: new THREE.Color(1.25, 1.25, 1.35) })
  K.M.D.push(view)
  F.put(new THREE.PlaneGeometry(w, h), view, 0, y, 0.005, 0, 0, 0, false)
  const fr = K.M.woodDark
  F.box(w + 0.16, 0.08, 0.08, fr, 0, y + h / 2 + 0.04, 0.04)
  F.box(w + 0.16, 0.08, 0.12, fr, 0, y - h / 2 - 0.04, 0.06)
  for (const sx of [-1, 1]) F.box(0.08, h, 0.08, fr, sx * (w / 2 + 0.04), y, 0.04)
  F.box(0.04, h, 0.04, fr, 0, y, 0.03)
  F.box(w, 0.04, 0.04, fr, 0, y + h * 0.1, 0.03)
  F.box(w + 0.3, 0.05, 0.22, K.M.wood, 0, y - h / 2 - 0.08, 0.12) // sill
  if (curtain) {
    const c = K.M.fab(curtain)
    for (const sx of [-1, 1]) F.put(new THREE.BoxGeometry(0.34, h + 0.5, 0.06), c, sx * (w / 2 + 0.12), y + 0.05, 0.12)
    F.box(w + 0.9, 0.03, 0.03, K.M.brass, 0, y + h / 2 + 0.32, 0.14)
  }
}

export function paintingOnWall(K: Kit, F: Frame, w: number, y: number, kind: 'landscape' | 'castle' | 'portrait' | 'pumpkin', seed = 1, haunted = false) {
  const h = w * 1.25
  const m = new THREE.MeshStandardMaterial({ map: painting(K.M.D, kind, seed, haunted), roughness: 0.6 })
  K.M.D.push(m)
  F.box(w + 0.14, h + 0.14, 0.05, K.M.brass, 0, y, 0.025)
  F.put(new THREE.PlaneGeometry(w, h), m, 0, y, 0.055, 0, 0, 0, false)
}

export function cobwebs(K: Kit, corners: [number, number, number, number][]) {
  const m = new THREE.MeshBasicMaterial({ map: cobweb(K.M.D), transparent: true, depthWrite: false, side: THREE.DoubleSide })
  K.M.D.push(m)
  // [x, y, z, ry] — a web spanning a wall/ceiling corner
  for (const [x, y, z, ry] of corners) Frame.at(K.B, x, y, z, ry).put(new THREE.PlaneGeometry(0.9, 0.9).translate(0.45, -0.45, 0).rotateX(-0.6), m, 0, 0, 0, 0, 0, 0, false)
}

export function candle(K: Kit, x: number, y: number, z: number, h = 0.18, light = false) {
  K.B.put(new THREE.CylinderGeometry(0.025, 0.028, h, 8), K.M.linen, x, y + h / 2, z)
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6).scale(1, 1.8, 1), K.M.candle)
  flame.position.set(x, y + h + 0.03, z)
  K.scene.add(flame)
  K.M.D.push(flame.geometry)
  const ph = x * 7 + z * 3
  K.anim((t) => (flame.scale.y = 1 + Math.sin(t * 11 + ph) * 0.12 + Math.sin(t * 17 + ph) * 0.08))
  if (light) K.light(x, y + h + 0.25, z, '#ffc070', 1.6, 4, true)
}

export function chandelier(K: Kit, x: number, y: number, z: number, arms = 6, r = 0.55) {
  K.B.put(new THREE.CylinderGeometry(0.012, 0.012, 0.8, 4), K.M.iron, x, y + 0.4, z)
  K.B.put(new THREE.TorusGeometry(r, 0.025, 6, 32).rotateX(Math.PI / 2), K.M.iron, x, y, z)
  for (let k = 0; k < arms; k++) {
    const a = (k / arms) * Math.PI * 2
    K.B.put(new THREE.CylinderGeometry(0.008, 0.008, r, 4).rotateZ(Math.PI / 2).rotateY(a), K.M.iron, x + (Math.cos(a) * r) / 2, y, z - (Math.sin(a) * r) / 2)
    candle(K, x + Math.cos(a) * r, y, z - Math.sin(a) * r, 0.12)
  }
  K.light(x, y - 0.1, z, '#ffc878', 5, 8, true)
}

export function wallLamp(K: Kit, F: Frame, y: number) {
  F.box(0.08, 0.2, 0.04, K.M.brass, 0, y, 0.02)
  F.box(0.03, 0.03, 0.2, K.M.brass, 0, y + 0.05, 0.12)
  const p = F.world(0, y + 0.12, 0.22)
  candle(K, p.x, p.y - 0.12, p.z, 0.1)
  F.put(new THREE.CylinderGeometry(0.07, 0.11, 0.14, 12, 1, true), K.M.fab('#f2e2c0'), 0, y + 0.17, 0.22, 0, 0, 0, false)
}

/* ───────────────────────── character pieces (witch, wizard, tavern, shops, haunted) ───────────────────────── */

export function cauldron(K: Kit, x: number, z: number) {
  K.B.put(new THREE.SphereGeometry(0.45, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), K.M.iron, x, 0.55, z)
  K.B.put(new THREE.TorusGeometry(0.4, 0.04, 8, 24).rotateX(Math.PI / 2), K.M.iron, x, 0.82, z)
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2
    K.B.put(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 6), K.M.iron, x + Math.cos(a) * 0.3, 0.17, z + Math.sin(a) * 0.3)
  }
  const brew = new THREE.Mesh(new THREE.CircleGeometry(0.37, 24).rotateX(-Math.PI / 2), K.M.potionGreen)
  brew.position.set(x, 0.78, z)
  K.scene.add(brew)
  K.M.D.push(brew.geometry)
  // bubbles
  const bubbles: THREE.Mesh[] = []
  for (let k = 0; k < 5; k++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.04 + k * 0.008, 8, 6), K.M.potionGreen)
    K.scene.add(b)
    K.M.D.push(b.geometry)
    bubbles.push(b)
  }
  K.anim((t) => {
    bubbles.forEach((b, i) => {
      const u = (t * 0.6 + i * 0.21) % 1
      b.position.set(x + Math.sin(i * 2.1) * 0.2, 0.78 + u * 0.08, z + Math.cos(i * 1.7) * 0.2)
      b.scale.setScalar(u < 0.85 ? 0.4 + u : 0.01)
    })
  })
  // embers under it
  K.B.put(new THREE.CylinderGeometry(0.28, 0.32, 0.06, 12), K.M.ember, x, 0.03, z, 0, 1, 1, 1, { cast: false })
  K.light(x, 1.1, z, '#7aff8a', 2.4, 4.5, true)
  K.block(x - 0.5, x + 0.5, z - 0.5, z + 0.5)
}

export function potionShelf(K: Kit, x: number, z: number, ry: number, w = 1.4) {
  const F = Frame.at(K.B, x, 0, z, ry)
  for (const y of [1.0, 1.45, 1.9]) {
    F.box(w, 0.04, 0.28, K.M.woodDark, 0, y, 0)
    for (let k = 0; k < 6; k++) {
      const m = [K.M.potionGreen, K.M.potionPurple, K.M.crystal][(k + Math.round(y * 3)) % 3]
      const bx = -w / 2 + 0.15 + k * ((w - 0.3) / 5)
      F.put(new THREE.SphereGeometry(0.06, 10, 8), m, bx, y + 0.08, 0.02, 0, 0, 0, false)
      F.put(new THREE.CylinderGeometry(0.02, 0.025, 0.08, 8), K.M.porcelain, bx, y + 0.17, 0.02)
    }
  }
  for (const sx of [-1, 1]) F.box(0.04, 1.6, 0.04, K.M.woodDark, sx * (w / 2), 1.4, -0.12)
  const p = F.world(0, 1.5, 0.5)
  K.light(p.x, p.y, p.z, '#b08aff', 1.4, 3)
}

export function herbRack(K: Kit, x: number, y: number, z: number, ry: number, len = 1.6) {
  const F = Frame.at(K.B, x, y, z, ry)
  F.put(new THREE.CylinderGeometry(0.02, 0.02, len, 6).rotateZ(Math.PI / 2), K.M.woodDark, 0, 0, 0)
  for (let k = 0; k < 7; k++) {
    const bx = -len / 2 + 0.15 + k * ((len - 0.3) / 6)
    F.put(new THREE.ConeGeometry(0.07, 0.32, 6).rotateX(Math.PI), K.M.fab(['#5a6a2a', '#7a5a2a', '#4a3a5a'][k % 3]), bx, -0.2, 0)
  }
}

export function telescope(K: Kit, x: number, z: number, ry: number, level?: 0 | 1, y = 0) {
  const F = Frame.at(K.B, x, y, z, ry)
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2
    F.put(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 6).rotateX(0.25).rotateY(a), K.M.woodDark, Math.cos(a) * 0.14, 0.58, Math.sin(a) * 0.14)
  }
  F.put(new THREE.CylinderGeometry(0.06, 0.09, 1.2, 14).rotateX(-1.0), K.M.brass, 0, 1.35, -0.2)
  F.put(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 14).rotateX(-1.0), K.M.brass, 0, 1.63, -0.68)
  footprint(K, x, z, 0.6, 0.6, ry, level)
}

export function orrery(K: Kit, x: number, y: number, z: number) {
  K.B.put(new THREE.CylinderGeometry(0.03, 0.08, 0.25, 10), K.M.brass, x, y + 0.12, z)
  const g = new THREE.Group()
  g.position.set(x, y + 0.32, z)
  const sun = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), K.M.candle)
  g.add(sun)
  const planets: THREE.Mesh[] = []
  for (let k = 0; k < 4; k++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.14 + k * 0.08, 0.004, 4, 40).rotateX(Math.PI / 2), K.M.brass)
    g.add(ring)
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.025 + (k % 2) * 0.012, 10, 8), [K.M.crystal, K.M.pumpkin, K.M.potionPurple, K.M.porcelain][k])
    g.add(p)
    planets.push(p)
    K.M.D.push(ring.geometry, p.geometry)
  }
  K.M.D.push(sun.geometry)
  K.scene.add(g)
  K.anim((t) => planets.forEach((p, k) => p.position.set(Math.cos(t * (0.8 - k * 0.15)) * (0.14 + k * 0.08), 0, Math.sin(t * (0.8 - k * 0.15)) * (0.14 + k * 0.08))))
}

export function barCounter(K: Kit, x: number, z: number, ry: number, len = 4) {
  const F = Frame.at(K.B, x, 0, z, ry)
  F.put(rbox(len, 1.05, 0.6, 0.02), K.M.woodDark, 0, 0.525, 0)
  F.put(rbox(len + 0.1, 0.06, 0.72, 0.02), K.M.wood, 0, 1.08, 0.04)
  F.put(new THREE.CylinderGeometry(0.02, 0.02, len, 8).rotateZ(Math.PI / 2), K.M.brass, 0, 0.18, 0.38) // foot rail
  for (let k = 0; k < 3; k++) {
    const tx = -0.6 + k * 0.6
    F.put(new THREE.CylinderGeometry(0.02, 0.025, 0.36, 8), K.M.brass, tx, 1.29, -0.1)
    F.put(new THREE.SphereGeometry(0.035, 8, 6), K.M.fab(['#1a1a1a', '#e8641a', '#e8e0cc'][k]), tx, 1.5, -0.1)
  }
  footprint(K, x, z, len, 0.72, ry)
}

export function bottleWall(K: Kit, F: Frame, w: number) {
  for (const y of [1.3, 1.75, 2.2]) {
    F.box(w, 0.04, 0.22, K.M.woodDark, 0, y, 0.11)
    for (let k = 0; k < Math.floor(w / 0.16); k++) {
      const c = ['#2a5a2a', '#5a2a1a', '#c89a48', '#2a2a4a', '#e8e0cc'][(k * 3 + Math.round(y * 10)) % 5]
      F.put(new THREE.CylinderGeometry(0.035, 0.04, 0.24, 8), K.M.fab(c, 0.2), -w / 2 + 0.1 + k * 0.16, y + 0.14, 0.1)
    }
  }
}

export function barrel(K: Kit, x: number, z: number, onSide = false) {
  const g = new THREE.CylinderGeometry(0.34, 0.34, 0.9, 16)
  g.scale(1, 1, 1)
  const F = Frame.at(K.B, x, 0, z, 0)
  if (onSide) {
    F.put(g.clone().rotateZ(Math.PI / 2), K.M.wood, 0, 0.36, 0)
    for (const dx of [-0.3, 0.3]) F.put(new THREE.TorusGeometry(0.345, 0.02, 6, 20).rotateY(Math.PI / 2), K.M.iron, dx, 0.36, 0)
    K.block(x - 0.48, x + 0.48, z - 0.36, z + 0.36)
  } else {
    F.put(g, K.M.wood, 0, 0.45, 0)
    for (const y of [0.15, 0.75]) F.put(new THREE.TorusGeometry(0.345, 0.02, 6, 20).rotateX(Math.PI / 2), K.M.iron, 0, y, 0)
    K.block(x - 0.36, x + 0.36, z - 0.36, z + 0.36)
  }
}

export function crate(K: Kit, x: number, z: number, s = 0.6, ry = 0, y = 0) {
  Frame.at(K.B, x, y, z, ry).put(rbox(s, s, s, 0.01), K.M.woodLight, 0, s / 2, 0)
  if (y === 0) footprint(K, x, z, s, s, ry)
}

export function shopShelf(K: Kit, x: number, z: number, ry: number, palette: string[], seed = 1, w = 2) {
  const F = Frame.at(K.B, x, 0, z, ry)
  F.box(w, 2.1, 0.05, K.M.woodLight, 0, 1.05, -0.2)
  for (const sx of [-1, 1]) F.box(0.05, 2.1, 0.45, K.M.woodLight, sx * (w / 2), 1.05, 0)
  const goods = new THREE.MeshStandardMaterial({ map: shelfGoods(K.M.D, palette, seed), transparent: true, alphaTest: 0.5, roughness: 0.5 })
  K.M.D.push(goods)
  for (let k = 0; k < 4; k++) {
    const y = 0.15 + k * 0.5
    F.box(w - 0.04, 0.04, 0.42, K.M.woodLight, 0, y, 0)
    F.put(new THREE.PlaneGeometry(w - 0.1, 0.36), goods, 0, y + 0.2, 0.05, 0, 0, 0, false)
  }
  footprint(K, x, z, w, 0.45, ry)
}

export function shopCounter(K: Kit, x: number, z: number, ry: number, len = 2.4, color = '#3a2a1e') {
  const F = Frame.at(K.B, x, 0, z, ry)
  F.put(rbox(len, 1.0, 0.6, 0.02), K.M.fab(color, 0.5), 0, 0.5, 0)
  F.put(rbox(len + 0.06, 0.05, 0.66, 0.01), K.M.woodLight, 0, 1.02, 0)
  // till + bell
  F.put(rbox(0.36, 0.22, 0.3, 0.03), K.M.brass, len / 2 - 0.4, 1.16, -0.05)
  F.put(new THREE.SphereGeometry(0.05, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), K.M.brass, -len / 2 + 0.3, 1.05, 0.1)
  footprint(K, x, z, len, 0.66, ry)
}

export function clothesRack(K: Kit, x: number, z: number, ry: number, colors: string[]) {
  const F = Frame.at(K.B, x, 0, z, ry)
  for (const sx of [-1, 1]) F.put(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6), K.M.chrome, sx * 0.7, 0.75, 0)
  F.put(new THREE.CylinderGeometry(0.018, 0.018, 1.45, 6).rotateZ(Math.PI / 2), K.M.chrome, 0, 1.5, 0)
  for (let k = 0; k < 8; k++) F.put(rbox(0.06, 0.8, 0.46, 0.02), K.M.fab(colors[k % colors.length]), -0.6 + k * 0.17, 1.08, 0)
  footprint(K, x, z, 1.5, 0.5, ry)
}

export function mannequin(K: Kit, x: number, z: number, ry: number, top: string) {
  const F = Frame.at(K.B, x, 0, z, ry)
  F.put(new THREE.CylinderGeometry(0.2, 0.22, 0.04, 16), K.M.iron, 0, 0.02, 0)
  F.put(new THREE.CylinderGeometry(0.015, 0.015, 0.9, 6), K.M.chrome, 0, 0.47, 0)
  F.put(rbox(0.46, 0.62, 0.26, 0.1), K.M.fab(top), 0, 1.2, 0)
  F.put(new THREE.SphereGeometry(0.11, 14, 10), K.M.porcelain, 0, 1.62, 0)
  K.block(x - 0.3, x + 0.3, z - 0.3, z + 0.3)
}

export function barberChair(K: Kit, x: number, z: number, ry: number) {
  const F = Frame.at(K.B, x, 0, z, ry)
  F.put(new THREE.CylinderGeometry(0.25, 0.3, 0.06, 20), K.M.chrome, 0, 0.03, 0)
  F.put(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 10), K.M.chrome, 0, 0.25, 0)
  F.put(rbox(0.6, 0.14, 0.56, 0.05), K.M.fab('#7a1a1a', 0.4), 0, 0.5, 0)
  F.put(rbox(0.56, 0.7, 0.12, 0.05), K.M.fab('#7a1a1a', 0.4), 0, 0.92, -0.26)
  F.put(rbox(0.28, 0.14, 0.1, 0.04), K.M.fab('#7a1a1a', 0.4), 0, 1.35, -0.28)
  for (const sx of [-1, 1]) F.put(rbox(0.08, 0.06, 0.48, 0.02), K.M.chrome, sx * 0.32, 0.72, 0)
  F.put(new THREE.BoxGeometry(0.4, 0.04, 0.2), K.M.chrome, 0, 0.22, 0.42)
  footprint(K, x, z, 0.7, 0.8, ry)
}

/** dust-sheeted furniture (the haunted house): a lumpy shape under a draped cloth */
export function sheeted(K: Kit, x: number, z: number, ry: number, w: number, h: number, d: number, y = 0, level?: 0 | 1) {
  const g = new RoundedBoxGeometry(w, h, d, 6, Math.min(w, h, d) * 0.12)
  const p = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) {
    const vx = p.getX(i)
    const vy = p.getY(i)
    const vz = p.getZ(i)
    const top = (vy + h / 2) / h
    // the cloth flares out and pools near the floor, sags between the corners on top, hangs in vertical folds
    const flare = 1 + Math.pow(1 - top, 2.5) * 0.2
    // deep vertical folds (stronger toward the hem), a few crumples on top
    const folds = (Math.sin(vx * 7.3 + vz * 1.7) * 0.045 + Math.sin(vz * 6.1 - vx * 1.3) * 0.045) * (0.4 + (1 - top))
    const sag = top > 0.85 ? -Math.cos((vx / w) * Math.PI) * Math.cos((vz / d) * Math.PI) * 0.05 : 0
    p.setXYZ(i, vx * flare + folds * (1 - top * 0.6), vy + sag, vz * flare + folds * (1 - top * 0.6))
  }
  g.computeVertexNormals()
  Frame.at(K.B, x, y, z, ry).put(g, K.M.sheet, 0, h / 2, 0)
  footprint(K, x, z, w, d, ry, level)
}

export function plant(K: Kit, x: number, z: number, s = 1, y = 0) {
  K.B.put(new THREE.CylinderGeometry(0.16 * s, 0.12 * s, 0.3 * s, 12), K.M.pumpkin, x, y + 0.15 * s, z)
  for (let k = 0; k < 6; k++) {
    const a = k * 1.05
    K.B.put(new THREE.SphereGeometry(0.16 * s, 8, 6).scale(1, 0.6, 1), K.M.leaf, x + Math.cos(a) * 0.1 * s, y + (0.42 + (k % 3) * 0.1) * s, z + Math.sin(a) * 0.1 * s)
  }
}

export function pumpkinPile(K: Kit, x: number, z: number, n = 3, y = 0) {
  for (let k = 0; k < n; k++) {
    const r = 0.14 + (k % 2) * 0.06
    K.B.put(new THREE.SphereGeometry(r, 14, 10).scale(1.15, 0.85, 1.15), K.M.pumpkin, x + Math.cos(k * 2.1) * 0.25, y + r * 0.85, z + Math.sin(k * 2.1) * 0.25)
    K.B.put(new THREE.CylinderGeometry(0.015, 0.02, 0.08, 5), K.M.leaf, x + Math.cos(k * 2.1) * 0.25, y + r * 1.7 + 0.03, z + Math.sin(k * 2.1) * 0.25)
  }
}

/* ───────────────────────── the Haunted Quarter ───────────────────────── */

/** a porcelain doll sitting on a shelf / chair: dress, head, button eyes, hair */
export function doll(K: Kit, x: number, y: number, z: number, ry: number, dress: string, hair = '#3a2418', turned = false) {
  const F = Frame.at(K.B, x, y, z, ry)
  F.put(new THREE.ConeGeometry(0.09, 0.2, 10), K.M.fab(dress), 0, 0.1, 0)
  F.put(new THREE.SphereGeometry(0.06, 12, 10), K.M.porcelain, 0, 0.26, 0)
  F.put(new THREE.SphereGeometry(0.064, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), K.M.fab(hair), 0, 0.27, -0.006)
  const face = turned ? Math.PI * 0.6 : 0 // one of them always faces you
  for (const sx of [-1, 1]) F.put(new THREE.SphereGeometry(0.009, 6, 4), K.M.soot, Math.sin(face) * 0.05 + sx * 0.02 * Math.cos(face), 0.27, Math.cos(face) * 0.055 - sx * 0.02 * Math.sin(face), 0, 0, 0, false)
  for (const sx of [-1, 1]) F.put(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 6).rotateZ(sx * 0.4), K.M.porcelain, sx * 0.07, 0.15, 0.01)
}

export function coffin(K: Kit, x: number, z: number, ry: number, o: { open?: boolean; y?: number; level?: 0 | 1 } = {}) {
  const s = new THREE.Shape([new THREE.Vector2(-0.24, -0.95), new THREE.Vector2(0.24, -0.95), new THREE.Vector2(0.34, 0.45), new THREE.Vector2(0.22, 0.95), new THREE.Vector2(-0.22, 0.95), new THREE.Vector2(-0.34, 0.45)])
  const box = new THREE.ExtrudeGeometry(s, { depth: 0.45, bevelEnabled: false }).rotateX(-Math.PI / 2)
  const F = Frame.at(K.B, x, o.y ?? 0, z, ry)
  F.put(box, K.M.woodDark, 0, 0.05, 0)
  F.put(new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2), K.M.fab('#5a1a2a', 1), 0, 0.42, 0, 0, 0, 0, false) // satin lining
  const lid = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false }).rotateX(-Math.PI / 2)
  if (o.open) F.put(lid, K.M.wood, 0.52, 0.3, 0, 0, 0, -1.1)
  else F.put(lid, K.M.wood, 0, 0.5, 0)
  footprint(K, x, z, 0.7, 1.95, ry, o.level)
}

export function sarcophagus(K: Kit, x: number, z: number, ry: number, o: { ajar?: boolean } = {}) {
  const F = Frame.at(K.B, x, 0, z, ry)
  F.put(rbox(1.1, 0.8, 2.2, 0.03), K.M.stoneLight, 0, 0.4, 0)
  F.put(rbox(1.2, 0.12, 2.3, 0.03), K.M.stone, 0, 0.06, 0)
  // the lid with a carved figure (a long gisant shape, hands folded over a pumpkin)
  const L = F.sub(o.ajar ? 0.25 : 0, 0.86, o.ajar ? 0.2 : 0, 0, o.ajar ? 0.18 : 0, 0)
  L.put(rbox(1.18, 0.12, 2.28, 0.03), K.M.stoneLight, 0, 0, 0)
  L.put(new THREE.CapsuleGeometry(0.22, 1.2, 4, 8).rotateX(Math.PI / 2).scale(1, 0.6, 1), K.M.stoneLight, 0, 0.16, 0.05)
  L.put(new THREE.SphereGeometry(0.16, 12, 10), K.M.stoneLight, 0, 0.2, -0.8)
  L.put(new THREE.SphereGeometry(0.12, 12, 8).scale(1.15, 0.85, 1.15), K.M.pumpkin, 0, 0.32, -0.1)
  footprint(K, x, z, 1.2, 2.3, ry)
}

export function armorStand(K: Kit, x: number, z: number, ry: number) {
  const F = Frame.at(K.B, x, 0, z, ry)
  const steel = K.M.chrome
  F.put(new THREE.CylinderGeometry(0.3, 0.34, 0.08, 16), K.M.woodDark, 0, 0.04, 0)
  for (const sx of [-1, 1]) F.put(new THREE.CylinderGeometry(0.07, 0.06, 0.85, 10), steel, sx * 0.12, 0.5, 0)
  F.put(new THREE.CylinderGeometry(0.2, 0.17, 0.62, 14), steel, 0, 1.25, 0) // cuirass
  F.put(new THREE.SphereGeometry(0.2, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), steel, 0, 1.56, 0)
  for (const sx of [-1, 1]) {
    F.put(new THREE.SphereGeometry(0.11, 10, 8), steel, sx * 0.26, 1.5, 0) // pauldrons
    F.put(new THREE.CylinderGeometry(0.05, 0.045, 0.6, 8), steel, sx * 0.28, 1.15, 0.02)
  }
  F.put(new THREE.CylinderGeometry(0.13, 0.13, 0.28, 14), steel, 0, 1.82, 0) // helm
  F.put(new THREE.SphereGeometry(0.13, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), steel, 0, 1.96, 0)
  F.box(0.16, 0.02, 0.02, K.M.soot, 0, 1.84, 0.13) // visor slit
  F.put(new THREE.CylinderGeometry(0.012, 0.012, 2.2, 6), K.M.woodDark, 0.38, 1.1, 0.05) // halberd shaft
  F.put(new THREE.ConeGeometry(0.06, 0.3, 4), steel, 0.38, 2.3, 0.05)
  K.block(x - 0.4, x + 0.4, z - 0.4, z + 0.4)
}

export function grandPiano(K: Kit, x: number, z: number, ry: number) {
  const F = Frame.at(K.B, x, 0, z, ry)
  const s = new THREE.Shape()
  s.moveTo(-0.75, 0)
  s.lineTo(0.75, 0)
  s.lineTo(0.75, 1.0)
  s.quadraticCurveTo(0.7, 1.9, 0.05, 2.0)
  s.quadraticCurveTo(-0.75, 1.6, -0.75, 1.0)
  s.closePath()
  const body = new THREE.ExtrudeGeometry(s, { depth: 0.32, bevelEnabled: false }).rotateX(Math.PI / 2)
  F.put(body, K.M.fab('#0e0c10', 0.25), 0, 0.98, 0)
  F.put(new THREE.ShapeGeometry(s).rotateX(Math.PI / 2).rotateX(Math.PI).rotateZ(0), K.M.fab('#0e0c10', 0.25), 0, 0.99, 0, 0, 0, 0, false)
  F.box(1.5, 0.05, 0.22, K.M.porcelain, 0, 0.78, -0.12) // keys
  for (const [lx, lz] of [[-0.6, 0.2], [0.6, 0.2], [0, 1.7]] as const) F.put(new THREE.CylinderGeometry(0.05, 0.04, 0.66, 8), K.M.fab('#0e0c10', 0.25), lx, 0.33, lz)
  F.put(new THREE.BoxGeometry(1.2, 0.02, 0.9).rotateX(-0.5), K.M.fab('#0e0c10', 0.25), 0.1, 1.25, 1.0) // propped lid
  footprint(K, x, z, 1.6, 2.1, ry)
}

export function apothecaryJars(K: Kit, F: Frame, w: number) {
  const colors = ['#7aff8a', '#c08aff', '#ffb24a', '#8ad8ff', '#ff6a8a']
  for (const y of [0.9, 1.3, 1.7, 2.1]) {
    F.box(w, 0.04, 0.26, K.M.woodDark, 0, y, 0.13)
    for (let k = 0; k < Math.floor(w / 0.2); k++) {
      const c = colors[(k * 7 + Math.round(y * 10)) % colors.length]
      const h = 0.14 + ((k * 3) % 4) * 0.03
      F.put(new THREE.CylinderGeometry(0.06, 0.06, h, 10), K.M.fab(c, 0.15), -w / 2 + 0.12 + k * 0.2, y + h / 2 + 0.02, 0.12)
      F.put(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 8), K.M.woodDark, -w / 2 + 0.12 + k * 0.2, y + h + 0.035, 0.12)
    }
  }
}

export function shovels(K: Kit, F: Frame) {
  for (let k = 0; k < 3; k++) {
    const g = F.sub(-0.4 + k * 0.4, 0, 0.12, 0, 0, (k - 1) * 0.08)
    g.put(new THREE.CylinderGeometry(0.018, 0.018, 1.3, 6), K.M.wood, 0, 0.9, 0)
    g.put(new THREE.BoxGeometry(0.22, 0.3, 0.02), K.M.iron, 0, 0.15, 0.02)
  }
}

/* ───────────────────────── CHAD PETS: the companions on display ───────────────────────── */

/** a black cat curled on a cushion; its tail swishes (animated) */
export function blackCat(K: Kit, x: number, y: number, z: number, ry: number) {
  const F = Frame.at(K.B, x, y, z, ry)
  const fur = K.M.fab('#141018', 0.7)
  F.put(new THREE.CylinderGeometry(0.32, 0.34, 0.08, 20), K.M.fab('#c08aff', 0.95), 0, 0.04, 0) // cushion
  F.put(new THREE.SphereGeometry(0.17, 14, 10).scale(1.25, 0.8, 1), fur, 0, 0.2, 0)
  F.put(new THREE.SphereGeometry(0.1, 14, 10), fur, 0.16, 0.32, 0.04)
  for (const sz of [-1, 1]) F.put(new THREE.ConeGeometry(0.035, 0.08, 6), fur, 0.16, 0.42, 0.04 + sz * 0.05)
  for (const sz of [-1, 1]) F.put(new THREE.SphereGeometry(0.016, 8, 6), K.M.fab('#ffd25a', 0.3), 0.25, 0.34, 0.04 + sz * 0.035, 0, 0, 0, false)
  F.put(new THREE.TorusGeometry(0.06, 0.008, 6, 14), K.M.fab('#9b5cff', 0.4), 0.13, 0.25, 0.04, 0, Math.PI / 2, 0) // collar
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.028, 0.32, 6).translate(0, 0.16, 0), fur)
  const p = F.world(-0.18, 0.18, 0)
  tail.position.copy(p)
  K.scene.add(tail)
  K.M.D.push(tail.geometry)
  K.anim((t) => {
    tail.rotation.z = 0.9 + Math.sin(t * 2.2) * 0.35
    tail.rotation.y = ry + Math.sin(t * 1.3) * 0.3
  })
}

/** a friendly little ghost bobbing inside a glass dome */
export function ghostDome(K: Kit, x: number, y: number, z: number) {
  K.B.put(new THREE.CylinderGeometry(0.32, 0.36, 0.12, 20), K.M.woodDark, x, y + 0.06, z)
  const glass = new THREE.MeshStandardMaterial({ color: '#c8e8ff', transparent: true, opacity: 0.18, roughness: 0.05, depthWrite: false })
  K.M.D.push(glass)
  K.B.put(new THREE.SphereGeometry(0.3, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.4, 1), glass, x, y + 0.12, z, 0, 1, 1, 1, { cast: false })
  const ghostM = new THREE.MeshStandardMaterial({ color: '#f4f8ff', emissive: '#a8c8ff', emissiveIntensity: 0.6, transparent: true, opacity: 0.88 })
  K.M.D.push(ghostM)
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62).scale(1, 1.35, 1), ghostM)
  const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.14, 16, 1, true).rotateX(Math.PI), ghostM)
  skirt.position.y = -0.04
  g.add(body, skirt)
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), K.M.soot)
    eye.position.set(sx * 0.035, 0.06, 0.095)
    g.add(eye)
    K.M.D.push(eye.geometry)
  }
  K.M.D.push(body.geometry, skirt.geometry)
  g.position.set(x, y + 0.36, z)
  K.scene.add(g)
  K.anim((t) => {
    g.position.y = y + 0.36 + Math.sin(t * 1.8) * 0.05
    g.rotation.y = Math.sin(t * 0.7) * 0.6
  })
  K.light(x, y + 0.5, z, '#a8c8ff', 0.8, 2)
}

/** a bat hanging from a perch, wings twitching */
export function batPerch(K: Kit, x: number, y: number, z: number) {
  K.B.put(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 6).rotateZ(Math.PI / 2), K.M.woodDark, x, y, z)
  for (const sx of [-1, 1]) K.B.put(new THREE.CylinderGeometry(0.015, 0.02, y, 6), K.M.woodDark, x + sx * 0.25, y / 2, z)
  const fur = K.M.fab('#1e1424', 0.8)
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8).scale(1, 1.4, 1), fur)
  body.position.y = -0.1
  g.add(body)
  const wings: THREE.Mesh[] = []
  for (const sx of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.16, 3).rotateZ(sx * 1.2).translate(sx * 0.07, -0.08, 0), fur)
    g.add(w)
    wings.push(w)
    K.M.D.push(w.geometry)
  }
  K.M.D.push(body.geometry)
  g.position.set(x, y, z)
  K.scene.add(g)
  K.anim((t) => wings.forEach((w, i) => (w.rotation.y = (i ? -1 : 1) * (0.2 + Math.max(0, Math.sin(t * 9)) * 0.3 * (Math.sin(t * 0.5) > 0.7 ? 1 : 0)))))
}

/** a mini pumpkin creature hopping in its little pen */
export function pumpkinCritter(K: Kit, x: number, z: number) {
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2
    K.B.put(new THREE.CylinderGeometry(0.02, 0.02, 0.36, 6), K.M.woodLight, x + Math.cos(a) * 0.55, 0.18, z + Math.sin(a) * 0.55)
  }
  K.B.put(new THREE.TorusGeometry(0.55, 0.02, 6, 30).rotateX(Math.PI / 2), K.M.woodLight, x, 0.34, z)
  K.B.put(new THREE.CircleGeometry(0.55, 24).rotateX(-Math.PI / 2), K.M.fab('#c8b070', 1), x, 0.01, z, 0, 1, 1, 1, { cast: false })
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10).scale(1.2, 0.9, 1.2), K.M.pumpkin)
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.06, 6), K.M.leaf)
  stem.position.y = 0.12
  g.add(body, stem)
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), K.M.candle)
    eye.position.set(sx * 0.045, 0.03, 0.12)
    g.add(eye)
    K.M.D.push(eye.geometry)
  }
  K.M.D.push(body.geometry, stem.geometry)
  K.scene.add(g)
  K.anim((t) => {
    const hop = Math.abs(Math.sin(t * 3.2))
    g.position.set(x + Math.cos(t * 0.6) * 0.25, 0.11 + hop * 0.12, z + Math.sin(t * 0.6) * 0.25)
    g.rotation.y = -t * 0.6 + Math.PI / 2
    g.scale.set(1 + (1 - hop) * 0.12, 1 - (1 - hop) * 0.1, 1 + (1 - hop) * 0.12)
  })
  K.block(x - 0.6, x + 0.6, z - 0.6, z + 0.6)
}

export function aquarium(K: Kit, x: number, z: number, ry: number) {
  const F = Frame.at(K.B, x, 0, z, ry)
  F.put(rbox(1.4, 0.8, 0.5, 0.02), K.M.woodDark, 0, 0.4, 0)
  const water = new THREE.MeshBasicMaterial({ color: new THREE.Color('#5fc8e8').multiplyScalar(1.3), transparent: true, opacity: 0.75, toneMapped: false })
  K.M.D.push(water)
  F.put(new THREE.BoxGeometry(1.3, 0.6, 0.42), water, 0, 1.12, 0, 0, 0, 0, false)
  F.box(1.36, 0.04, 0.46, K.M.iron, 0, 1.44, 0)
  for (const [fx, fy, c] of [[-0.3, 1.1, '#ff8a3a'], [0.2, 1.2, '#ffd25a'], [0.35, 1.0, '#c08aff']] as const) F.put(new THREE.SphereGeometry(0.035, 8, 6).scale(1.6, 1, 0.6), K.M.fab(c, 0.4), fx, fy, 0.05)
  K.light(F.world(0, 1.2, 0.5).x, 1.3, F.world(0, 1.2, 0.5).z, '#5fc8e8', 1.2, 3)
  footprint(K, x, z, 1.4, 0.5, ry)
}

export function catTree(K: Kit, x: number, z: number) {
  const carpet = K.M.fab('#c8b090', 1)
  K.B.put(new THREE.BoxGeometry(0.8, 0.08, 0.8), carpet, x, 0.04, z)
  K.B.put(new THREE.CylinderGeometry(0.07, 0.07, 1.7, 10), K.M.fab('#a08a68', 1), x, 0.9, z)
  for (const [y, dx] of [[0.7, 0.25], [1.25, -0.2], [1.75, 0.1]] as const) K.B.put(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 16), carpet, x + dx, y, z)
  K.B.put(new THREE.SphereGeometry(0.06, 10, 8), K.M.fab('#e8641a', 0.6), x + 0.25, 0.55, z + 0.2) // a toy on a string
  K.block(x - 0.45, x + 0.45, z - 0.45, z + 0.45)
}
