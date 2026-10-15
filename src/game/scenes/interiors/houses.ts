import * as THREE from 'three'
import { Frame } from '../world/signs'
import { boxUV } from '../world/kit'
import { ROT, type Facing } from '../world/buildings'
import { floorboards, tiles, wallpaper } from './art'
import * as Fu from './furniture'
import type { Kit } from './furniture'
import { HAUNTED_INTERIORS } from './haunted'
import { SHOP_INTERIORS } from './shops'
import { VALLEY_INTERIORS } from './valleyInteriors'
import { SHOW_HOME_INTERIORS } from './showHomes'
import type { VillagerLook } from '../../character/villager'

/**
 * Every enterable building in the village: where its door is in the world, and the interior behind it.
 *
 * Interior space: the room is centred on the origin, the entrance door is in the middle of the front wall (+z),
 * the player walks in facing -z. Two-storey homes get a loft over the back of the room, reached by a staircase
 * along the right-hand wall. Each house has its own footprint, wallpaper, floor, furniture plan, light and things
 * to look at — no two share a layout.
 */
export type Line = { label: string; speaker: string; role: string; lines: string[] }
export type HouseSpec = {
  id: string
  name: string
  /** world door: building centre, facing, half-depth to the door face (+ how far out the prompt stands) */
  door: { x: number; z: number; face: Facing | number; half: number; out?: number }
  room: { w: number; d: number; h: number; loft?: { y: number; zl: number; stair: { x0: number; x1: number; zb: number } } }
  look: { wall: [Parameters<typeof wallpaper>[1], string, string]; floor: string | { tiles: [string, string] }; trim: string; ceiling?: string }
  /** ambient level (the hollow house is dark and cold) */
  mood?: 'warm' | 'cold' | 'bright'
  /** things to inspect: id → prompt + what you read */
  looks?: Record<string, Line & { at: [number, number]; r?: number; level?: 0 | 1 }>
  build(K: Kit, S: Shell): void
  /** a shopkeeper (a villager) behind the counter; talk from `talkAt` (the customer side) */
  keeper?: { look: VillagerLook; at: [number, number]; yaw: number; talkAt: [number, number]; line: Line; shop?: 'fits' | 'pets' }
}

/** world position + facing of a building's door prompt and where you reappear when you leave */
export function doorSpot(h: HouseSpec) {
  const r = typeof h.door.face === 'number' ? h.door.face : ROT[h.door.face]
  const out = h.door.half + (h.door.out ?? 0.75)
  return { x: h.door.x + Math.sin(r) * out, z: h.door.z + Math.cos(r) * out, yaw: r, exit: { x: h.door.x + Math.sin(r) * (out + 0.7), z: h.door.z + Math.cos(r) * (out + 0.7) } }
}

/* ───────────────────────── the room shell ───────────────────────── */

export type Shell = ReturnType<typeof shell>
type Side = 'back' | 'front' | 'left' | 'right'

export function shell(K: Kit, H: HouseSpec) {
  const { w: W, d: D, h: Ht, loft } = H.room
  const M = K.M
  const wallTex = wallpaper(M.D, H.look.wall[0], H.look.wall[1], H.look.wall[2], H.id.length)
  wallTex.repeat.set(1, 1)
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.92 })
  const floorTex = typeof H.look.floor === 'string' ? floorboards(M.D, H.look.floor, H.id.length * 3) : tiles(M.D, H.look.floor.tiles[0], H.look.floor.tiles[1])
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.7 })
  const trim = M.fab(H.look.trim, 0.6)
  const ceil = M.fab(H.look.ceiling ?? '#e8dcc4', 1)
  M.D.push(wallMat, floorMat)

  // floor (world-scale UV: 2 m per floorboard tile)
  const fg = new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2)
  const fu = fg.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < fu.count; i++) fu.setXY(i, (fu.getX(i) * W) / 2, (fu.getY(i) * D) / 2)
  K.B.put(fg, floorMat, 0, 0, 0, 0, 1, 1, 1, { cast: false })
  // walls (thick boxes just outside the room; UVs in metres), skirting + picture rail, ceiling, beams
  const wall = (w: number, h: number, x: number, y: number, z: number, ry: number) => K.B.put(boxUV(w, h, 0.3, 1), wallMat, x, y, z, ry)
  wall(W + 0.6, Ht, 0, Ht / 2, -D / 2 - 0.15, 0)
  wall(D + 0.6, Ht, -W / 2 - 0.15, Ht / 2, 0, Math.PI / 2)
  wall(D + 0.6, Ht, W / 2 + 0.15, Ht / 2, 0, Math.PI / 2)
  // front wall with the doorway (1.3 m × 2.3 m)
  const dw = 1.3
  const dh = 2.3
  wall((W - dw) / 2 + 0.3, Ht, -(W + dw) / 4 - 0.075, Ht / 2, D / 2 + 0.15, 0)
  wall((W - dw) / 2 + 0.3, Ht, (W + dw) / 4 + 0.075, Ht / 2, D / 2 + 0.15, 0)
  wall(dw, Ht - dh, 0, dh + (Ht - dh) / 2, D / 2 + 0.15, 0)
  for (const [len, x, z, ry] of [[W, 0, -D / 2 + 0.02, 0], [D, -W / 2 + 0.02, 0, Math.PI / 2], [D, W / 2 - 0.02, 0, Math.PI / 2], [(W - dw) / 2, -(W + dw) / 4, D / 2 - 0.02, 0], [(W - dw) / 2, (W + dw) / 4, D / 2 - 0.02, 0]] as const) {
    K.B.put(new THREE.BoxGeometry(len, 0.16, 0.04), trim, x, 0.08, z, ry)
    K.B.put(new THREE.BoxGeometry(len, 0.05, 0.04), trim, x, Math.min(2.4, Ht - 0.4), z, ry)
  }
  K.B.put(new THREE.PlaneGeometry(W, D).rotateX(Math.PI / 2), ceil, 0, Ht, 0, 0, 1, 1, 1, { cast: false })
  for (let x = -W / 2 + 1; x < W / 2; x += 1.6) K.B.put(new THREE.BoxGeometry(0.16, 0.2, D), M.woodDark, x, Ht - 0.1, 0)
  // the door: a planked leaf in a moulded frame, a ring handle, a fanlight
  const F = Frame.at(K.B, 0, 0, D / 2, Math.PI)
  F.box(dw - 0.06, dh - 0.04, 0.06, M.woodDark, 0, dh / 2, 0.02)
  for (let k = 0; k < 5; k++) F.box(0.02, dh - 0.1, 0.07, M.wood, -dw / 2 + 0.2 + k * 0.23, dh / 2, 0.02)
  for (const y of [0.5, 1.8]) F.box(dw - 0.1, 0.08, 0.08, M.iron, 0, y, 0.06)
  F.put(new THREE.TorusGeometry(0.07, 0.012, 6, 16), M.brass, 0.45, 1.05, 0.1)
  for (const sx of [-1, 1]) F.box(0.12, dh + 0.1, 0.12, trim, sx * (dw / 2 + 0.06), dh / 2, 0.04)
  F.box(dw + 0.36, 0.14, 0.12, trim, 0, dh + 0.07, 0.04)
  F.put(new THREE.PlaneGeometry(dw * 0.9, 0.3), M.fab('#1a1e3a', 0.2), 0, dh - 0.25, 0.06, 0, 0, 0, false)
  // a doormat
  Frame.at(K.B, 0, 0.008, D / 2 - 0.6, 0).put(new THREE.PlaneGeometry(1.1, 0.6).rotateX(-Math.PI / 2), M.fab('#5a3a22', 1), 0, 0, 0, 0, 0, 0, false)

  // room bounds for the player
  const pad = 0.32
  K.block(-W / 2 - 1, -W / 2 + pad - 0.32, -D / 2 - 1, D / 2 + 1)
  K.block(W / 2 - pad + 0.32, W / 2 + 1, -D / 2 - 1, D / 2 + 1)
  K.block(-W / 2 - 1, W / 2 + 1, -D / 2 - 1, -D / 2)
  K.block(-W / 2 - 1, W / 2 + 1, D / 2, D / 2 + 1)

  // ── loft + stair ──
  if (loft) {
    const { y: LY, zl, stair } = loft
    const z0 = -D / 2
    // slab, joists under it, front beam + railing (open over the stair top)
    K.B.put(new THREE.BoxGeometry(W, 0.18, zl - z0), floorMat, 0, LY - 0.09, (z0 + zl) / 2)
    const tg = new THREE.PlaneGeometry(W, zl - z0).rotateX(-Math.PI / 2)
    const tu = tg.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < tu.count; i++) tu.setXY(i, (tu.getX(i) * W) / 2, (tu.getY(i) * (zl - z0)) / 2)
    K.B.put(tg, floorMat, 0, LY + 0.002, (z0 + zl) / 2, 0, 1, 1, 1, { cast: false })
    for (let x = -W / 2 + 0.6; x < W / 2; x += 1.2) K.B.put(new THREE.BoxGeometry(0.12, 0.18, zl - z0), M.woodDark, x, LY - 0.27, (z0 + zl) / 2)
    K.B.put(new THREE.BoxGeometry(W, 0.3, 0.2), M.woodDark, 0, LY - 0.15, zl)
    const railEnd = stair.x0 - 0.05
    const railLen = railEnd + W / 2
    K.B.put(new THREE.BoxGeometry(railLen, 0.07, 0.08), M.woodDark, -W / 2 + railLen / 2, LY + 0.95, zl - 0.04)
    for (let x = -W / 2 + 0.15; x < railEnd; x += 0.16) K.B.put(new THREE.CylinderGeometry(0.022, 0.022, 0.9, 6), M.wood, x, LY + 0.47, zl - 0.04)
    K.block(-W / 2, railEnd, zl - 0.1, zl + 0.04, 1) // can't walk off the loft edge
    // support posts (ground floor)
    for (const x of [-W / 2 + W * 0.3, W * 0.05]) {
      K.B.put(new THREE.BoxGeometry(0.2, LY - 0.3, 0.2), M.woodDark, x, (LY - 0.3) / 2, zl - 0.12)
      K.block(x - 0.14, x + 0.14, zl - 0.26, zl + 0.02, 0)
    }
    // the stair: treads + risers + a stringer + a newel + a handrail on the open side
    const n = 13
    const run = stair.zb - zl
    for (let k = 0; k < n; k++) {
      const z = stair.zb - ((k + 0.5) / n) * run
      const y = ((k + 1) / n) * LY
      K.B.put(new THREE.BoxGeometry(stair.x1 - stair.x0, 0.05, run / n + 0.03), M.wood, (stair.x0 + stair.x1) / 2, y - 0.025, z)
      K.B.put(new THREE.BoxGeometry(stair.x1 - stair.x0, LY / n, 0.03), M.woodDark, (stair.x0 + stair.x1) / 2, y - LY / n / 2, z + run / n / 2)
    }
    const len = Math.hypot(run, LY)
    const ang = Math.atan2(LY, run)
    const string = new THREE.BoxGeometry(0.08, 0.3, len).rotateX(ang)
    K.B.put(string, M.woodDark, stair.x0 - 0.04, LY / 2 - 0.1, zl + run / 2)
    K.B.put(new THREE.BoxGeometry(0.06, 0.06, len).rotateX(ang), M.wood, stair.x0 - 0.04, LY / 2 + 0.85, zl + run / 2)
    for (let k = 0; k <= 6; k++) {
      const t = k / 6
      K.B.put(new THREE.CylinderGeometry(0.018, 0.018, 0.9, 6), M.wood, stair.x0 - 0.04, t * LY + 0.45, stair.zb - t * run)
    }
    K.B.put(new THREE.BoxGeometry(0.12, 1.1, 0.12), M.woodDark, stair.x0 - 0.04, 0.55, stair.zb - 0.06)
    // the stair's open side blocks both floors (you step on at the bottom, off at the top)
    K.block(stair.x0 - 0.12, stair.x0, zl, stair.zb - 0.35)
    // from under the loft you can't step onto the top of the stair (you'd pop up a floor)
    K.block(stair.x0 - 0.12, W / 2, zl - 0.45, zl - 0.06, 0)
  }

  const S = {
    W,
    D,
    H: Ht,
    loft,
    wallMat,
    floorMat,
    trim,
    /** a frame on the inside face of a wall: u = position along it (left→right as you face it), facing into the room */
    on(side: Side, u: number, y = 0) {
      if (side === 'back') return Frame.at(K.B, u, y, -D / 2, 0)
      if (side === 'front') return Frame.at(K.B, -u, y, D / 2, Math.PI)
      if (side === 'left') return Frame.at(K.B, -W / 2, y, -u, Math.PI / 2)
      return Frame.at(K.B, W / 2, y, u, -Math.PI / 2)
    },
    /** [x, z, ry] for a piece whose back sits `depth/2` off a wall at position u */
    against(side: Side, u: number, depth: number): [number, number, number] {
      const o = depth / 2 + 0.02
      if (side === 'back') return [u, -D / 2 + o, 0]
      if (side === 'front') return [-u, D / 2 - o, Math.PI]
      if (side === 'left') return [-W / 2 + o, -u, Math.PI / 2]
      return [W / 2 - o, u, -Math.PI / 2]
    },
    window(side: Side, u: number, curtain?: string, w = 1.1, h = 1.4, y = 1.55, level: 0 | 1 = 0) {
      Fu.windowOnWall(K, S.on(side, u, level ? loft!.y : 0), w, h, y, curtain, Math.round(u * 13 + W))
    },
  }
  return S
}

/* ───────────────────────── the houses ───────────────────────── */

const LOFT8 = { y: 2.8, zl: -0.6, stair: { x0: 3.05, x1: 4.0, zb: 2.6 } }

export const HOUSES: HouseSpec[] = [
  /* 1 ── the castle steward's town house (forecourt, west side) ── */
  {
    id: 'steward',
    name: "Steward Barnaby's House",
    door: { x: -9.5, z: -19, face: 'e', half: 2.5 },
    room: { w: 8, d: 8, h: 5.6, loft: LOFT8 },
    look: { wall: ['stripe', '#3f5a48', '#2f4a3a'], floor: '#7a5434', trim: '#2a1e16' },
    looks: {
      ledger: { at: [-2.6, 1.0], label: 'Read the open ledger', speaker: 'The Castle Ledger', role: 'in Barnaby’s neat hand', lines: ['Lanterns re-wicked: 212. Pumpkins carved: 1,040. Complaints about the fountain statue flexing at night: 3.', 'Note to self — the north tower bell rang at midnight again. Nobody was up there.'] },
      clock: { at: [-3.4, -3.0], label: 'Look at the grandfather clock', speaker: 'Grandfather Clock', role: 'stopped at ten to midnight', lines: ['Every clock in Barnaby’s house stopped at ten to midnight on the same night.', 'He keeps winding them. They keep stopping.'] },
    },
    build(K, S) {
      const M = K.M
      Fu.rug(K, -0.6, 0.6, 3.2, 2.2, 0, ['#5a1e22', '#c89a48', '#2a3a4a'], 0.006, 2)
      const fp = Fu.fireplace(K, ...S.against('left', 0.6, 0.8), {})
      void fp
      Fu.armchair(K, -2.2, 1.6, Math.PI / 2 + 0.5, '#5a1e22')
      Fu.armchair(K, -2.3, -0.2, Math.PI / 2 - 0.5, '#5a1e22')
      Fu.table(K, -1.0, 0.5, 0, { w: 0.8, d: 0.6, h: 0.5, mat: M.woodDark })
      Fu.candle(K, -1.0, 0.5, 0.5, 0.16, true)
      // study corner: desk + chair + ledger + candle, bookshelves along the back wall
      Fu.table(K, -2.6, 1.0 + 1.6, 0, { w: 1.3, d: 0.7, mat: M.woodDark })
      Fu.chair(K, -2.6, 3.2, Math.PI, { pad: '#5a1e22' })
      K.B.put(new THREE.BoxGeometry(0.42, 0.04, 0.3), M.linen, -2.6, 0.79, 2.6)
      Fu.candle(K, -2.15, 0.76, 2.4, 0.14, true)
      Fu.bookshelf(K, ...S.against('back', -1.8, 0.42), { w: 1.8, h: 2.3, seed: 4 })
      Fu.bookshelf(K, ...S.against('back', 0.3, 0.42), { w: 1.8, h: 2.3, seed: 9 })
      Fu.grandfatherClock(K, -3.4, -3.0 + 0.0, 0)
      Fu.paintingOnWall(K, S.on('right', -0.6), 0.8, 1.7, 'castle', 3)
      S.window('front', -2.4, '#2f4a3a')
      S.window('front', 2.0, '#2f4a3a')
      Fu.chandelier(K, -0.5, 2.3, 1.2, 5, 0.45)
      Fu.plant(K, 1.4, 3.3, 1.1)
      // loft: bedroom
      const L = S.loft!.y
      Fu.bed(K, -1.4, -2.6, 0, { blanket: '#2a3a5a', level: 1, y: L })
      Fu.wardrobe(K, 1.6, -3.6, 0, { level: 1, y: L })
      Fu.washstand(K, -3.4, -1.9, Math.PI / 2, 1, L)
      Fu.rug(K, -1.4, -1.2, 2.2, 1.4, 0, ['#2a3a5a', '#c89a48', '#e8e0cc'], L + 0.006, 5)
      Fu.candle(K, 0.2, L + 0.02, -3.7, 0.18, true)
      S.window('back', -1.4, '#2a3a5a', 1.0, 1.2, 1.4, 1)
    },
  },

  /* 2 ── Widow Marrow, the town witch (forecourt, east side) ── */
  {
    id: 'witch',
    name: "Widow Marrow's House",
    door: { x: 9.5, z: -19.5, face: 'w', half: 2.5 },
    room: { w: 8, d: 8, h: 5.6, loft: { y: 2.8, zl: -0.6, stair: { x0: 3.05, x1: 4.0, zb: 2.6 } } },
    look: { wall: ['damask', '#2a1e34', '#3e2a4e'], floor: '#3a2618', trim: '#1a1220', ceiling: '#2a2230' },
    looks: {
      cauldron: { at: [-1.4, 0.7], r: 1.3, label: 'Peer into the cauldron', speaker: 'Widow Marrow’s Cauldron', role: 'bubbling, smells of cinnamon', lines: ['A green brew bubbles away. A label on the ladle reads: “PROTEIN — DO NOT DRINK BEFORE LEG DAY”.', 'Something at the bottom glints like gold, then sinks out of sight.'] },
      crystal: { at: [1.6, 1.6], label: 'Gaze into the crystal ball', speaker: 'Crystal Ball', role: 'cloudy, then clear', lines: ['You see the citadel at midnight… a golden pumpkin, glowing… and then just your own reflection, flexing.'] },
    },
    build(K, S) {
      const M = K.M
      Fu.cauldron(K, -1.4, 0.7)
      Fu.rug(K, -1.4, 0.7, 2.6, 2.6, 0.4, ['#1a1220', '#7a3aa8', '#2a5a2a'], 0.006, 7)
      Fu.potionShelf(K, ...S.against('left', 0.4, 0.3), 1.6)
      Fu.potionShelf(K, ...S.against('back', 1.2, 0.3), 1.4)
      Fu.herbRack(K, -1.4, 2.55, 0.7, 0.3, 1.8)
      Fu.herbRack(K, 1.0, 2.55, 1.6, -0.2, 1.4)
      Fu.table(K, 1.6, 1.6, 0, { round: true, w: 1.0, cloth: '#3e2a4e', mat: M.woodDark })
      // a glass ball on a brass stand with a slow-swirling light inside
      const glass = new THREE.MeshStandardMaterial({ color: '#b8e8ff', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35, depthWrite: false })
      M.D.push(glass)
      K.B.put(new THREE.CylinderGeometry(0.09, 0.12, 0.08, 16), M.brass, 1.6, 0.8, 1.6)
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), glass)
      ball.position.set(1.6, 0.98, 1.6)
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), M.crystal)
      core.position.copy(ball.position)
      K.scene.add(core, ball)
      M.D.push(ball.geometry, core.geometry)
      K.anim((t) => core.position.set(1.6 + Math.sin(t * 1.3) * 0.06, 0.98 + Math.sin(t * 2.1) * 0.04, 1.6 + Math.cos(t * 1.7) * 0.06))
      K.light(1.6, 1.3, 1.6, '#8ad8ff', 1.6, 3.5, true)
      Fu.chair(K, 1.6, 2.5, Math.PI, { mat: M.woodDark, pad: '#3e2a4e' })
      Fu.chair(K, 0.8, 1.0, 0.8, { mat: M.woodDark, pad: '#3e2a4e' })
      Fu.fireplace(K, ...S.against('right', -2.2, 0.8), { stone: M.stone })
      Fu.pumpkinPile(K, -3.2, 3.2, 3)
      Fu.paintingOnWall(K, S.on('front', 2.2), 0.7, 1.7, 'portrait', 11)
      S.window('front', -2.4, '#3e2a4e')
      Fu.candle(K, -3.5, 0, 1.8, 0.4, true)
      Fu.candle(K, -3.35, 0, 2.0, 0.3)
      Fu.cobwebs(K, [[-4, 5.55, -4, 0], [4, 5.55, -4, -Math.PI / 2]])
      // loft: the witch's bedroom (canopy bed, a dressing table, a broom by the wall)
      const L = S.loft!.y
      Fu.bed(K, -1.2, -2.7, 0, { blanket: '#5a2a7a', canopy: '#3e2a4e', level: 1, y: L, w: 1.6 })
      Fu.dresser(K, 1.6, -3.7, 0, { level: 1, y: L, mirror: true })
      K.B.put(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 6).rotateZ(0.2), M.wood, -3.6, L + 0.7, -0.9)
      K.B.put(new THREE.ConeGeometry(0.16, 0.45, 10).rotateZ(0.2), M.fab('#a07a3a'), -3.66, L + 0.15, -0.9)
      Fu.candle(K, 2.4, L + 0.9, -3.75, 0.16, true)
    },
  },

  /* 3 ── Hazel the gardener's cottage (west, by the market) ── */
  {
    id: 'gardener',
    name: "Hazel's Garden Cottage",
    door: { x: -25, z: 13.5, face: 'n', half: 2.5 },
    room: { w: 8.4, d: 7.6, h: 5.4, loft: { y: 2.7, zl: -0.4, stair: { x0: 3.25, x1: 4.2, zb: 2.6 } } },
    look: { wall: ['plaster', '#e8dcc0', '#d8c8a8'], floor: '#a0784c', trim: '#5a3a22', ceiling: '#efe4d0' },
    mood: 'bright',
    looks: {
      bench: { at: [1.4, 1.6], label: 'Look at the potting bench', speaker: 'Potting Bench', role: 'soil under every fingernail', lines: ['Seedlings in neat rows, each labelled: “Giant Gourd”, “Moonflower”, “DO NOT WATER AFTER MIDNIGHT”.', 'Hazel’s note: the prize pumpkin outside grew another foot overnight. Nobody planted it.'] },
    },
    build(K, S) {
      const M = K.M
      Fu.kitchen(K, ...S.against('back', -1.2, 0.6), { len: 2.4, front: '#6a7a4a' })
      Fu.table(K, -1.6, 1.0, 0, { w: 1.5, d: 0.85, cloth: '#c8d8a8' })
      Fu.chair(K, -2.2, 1.8, Math.PI)
      Fu.chair(K, -1.0, 1.8, Math.PI)
      Fu.chair(K, -1.6, 0.2, 0)
      // potting bench + pots + seed sacks
      Fu.table(K, 1.4, 1.6, 0, { w: 1.6, d: 0.7, mat: M.woodLight })
      for (let k = 0; k < 4; k++) Fu.plant(K, 0.8 + k * 0.4, 1.6, 0.6, 0.76)
      Fu.crate(K, 2.4, 0.4, 0.55)
      Fu.crate(K, 2.4, 0.4, 0.4, 0.4, 0.55)
      Fu.armchair(K, 0.9, 0.3, 0.3, '#6a7a4a')
      Fu.fireplace(K, ...S.against('left', 1.2, 0.8), { w: 1.4 })
      for (const [x, z] of [[-3.7, 3.3], [3.7, 3.3], [-3.6, -0.6], [1.2, 3.4]] as const) Fu.plant(K, x, z, 1.2)
      Fu.pumpkinPile(K, -3.3, 2.4, 4)
      Fu.herbRack(K, -1.6, 2.3, 1.0, 0, 1.4)
      S.window('front', -2.6, '#c8d8a8')
      S.window('front', 2.4, '#c8d8a8')
      S.window('left', -1.6, '#c8d8a8')
      Fu.paintingOnWall(K, S.on('right', -1.6), 0.6, 1.6, 'landscape', 21)
      K.light(-1.6, 2.2, 1.0, '#ffd8a0', 3.2, 7)
      // loft
      const L = S.loft!.y
      Fu.bed(K, -1.8, -2.4, 0, { blanket: '#5a7a3a', level: 1, y: L, w: 1.3 })
      Fu.bathtub(K, 1.4, -3.2, 0, 1, L)
      Fu.plant(K, -3.6, -3.4, 1, L)
      S.window('back', -1.8, '#c8d8a8', 0.9, 1.0, 1.4, 1)
      Fu.candle(K, 0, L, -3.6, 0.2, true)
    },
  },

  /* 4 ── the wizard's house (north-west, by the forge) ── */
  {
    id: 'wizard',
    name: "Pumbledore's Study",
    door: { x: -26, z: -9.5, face: 's', half: 2.5 },
    room: { w: 8.4, d: 8.4, h: 6.0, loft: { y: 3.0, zl: -0.8, stair: { x0: 3.25, x1: 4.2, zb: 2.6 } } },
    look: { wall: ['diamond', '#1a2244', '#c89a48'], floor: '#4a3020', trim: '#c89a48', ceiling: '#141a36' },
    looks: {
      telescope: { at: [2.4, 2.4], label: 'Look through the telescope', speaker: 'Brass Telescope', role: 'pointed at the citadel', lines: ['It isn’t pointed at the stars. It’s pointed at the citadel’s north tower.', 'A light moves in the top window. Then it goes out.'] },
      orrery: { at: [-1.4, -2.4], label: 'Study the orrery', speaker: 'Pumbledore’s Orrery', role: 'four planets and a pumpkin', lines: ['The planets turn on their own. One of them is very clearly a pumpkin.', 'A tag in looping script: “When the pumpkin aligns with the moon, the Order meets.”'] },
    },
    build(K, S) {
      const M = K.M
      Fu.rug(K, 0, 0.8, 3.6, 2.6, 0, ['#1a2244', '#c89a48', '#5a1e5a'], 0.006, 13)
      Fu.bookshelf(K, ...S.against('left', -1.6, 0.42), { w: 2.0, h: 2.5, seed: 31, palette: ['#1a2244', '#5a1e5a', '#2a4a5a', '#c89a48', '#1a1a1e'] })
      Fu.bookshelf(K, ...S.against('left', 0.8, 0.42), { w: 2.0, h: 2.5, seed: 37, palette: ['#1a2244', '#5a1e5a', '#2a4a5a', '#c89a48', '#1a1a1e'] })
      Fu.table(K, -1.4, -2.4, 0, { w: 1.6, d: 0.9, mat: M.woodDark })
      Fu.orrery(K, -1.4, 0.76, -2.4)
      Fu.chair(K, -1.4, -1.6, Math.PI, { mat: M.woodDark, pad: '#5a1e5a' })
      Fu.telescope(K, 2.4, 2.4, Math.PI * 0.85)
      Fu.armchair(K, 0.6, 0.6, Math.PI * 1.15, '#5a1e5a')
      Fu.fireplace(K, ...S.against('back', 1.6, 0.8), { stone: M.stone })
      Fu.paintingOnWall(K, S.on('right', -0.3), 0.9, 1.8, 'castle', 41)
      S.window('front', -2.6, '#5a1e5a', 1.0, 1.8, 1.7)
      S.window('front', 2.4, '#5a1e5a', 1.0, 1.8, 1.7)
      // floating candles bob under the ceiling
      for (let k = 0; k < 12; k++) {
        const x = -3 + (k % 4) * 1.9
        const z = -0.2 + Math.floor(k / 4) * 1.3
        const g = new THREE.Group()
        const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.16, 8), M.linen)
        const flame = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6).scale(1, 1.8, 1), M.candle)
        flame.position.y = 0.11
        g.add(wax, flame)
        g.position.set(x, 4.6, z)
        K.scene.add(g)
        M.D.push(wax.geometry, flame.geometry)
        K.anim((t) => (g.position.y = 4.6 + Math.sin(t * 0.9 + k) * 0.12))
      }
      K.light(0, 4.4, 1.0, '#ffd08a', 4, 9, true)
      // glowing crystals on the mantel
      for (const dx of [-0.6, 0.6]) K.B.put(new THREE.OctahedronGeometry(0.08).scale(1, 1.8, 1), M.crystal, 1.6 + dx, 1.5, -3.9)
      // loft: the library
      const L = S.loft!.y
      Fu.bookshelf(K, -2.6, -3.95, 0, { w: 2.2, h: 2.4, seed: 43, level: 1, y: L })
      Fu.bookshelf(K, 0.0, -3.95, 0, { w: 2.2, h: 2.4, seed: 47, level: 1, y: L })
      Fu.table(K, -1.4, -2.0, 0, { w: 1.4, d: 0.8, level: 1, y: L, mat: M.woodDark })
      Fu.candle(K, -1.0, L + 0.76, -2.0, 0.18, true)
      Fu.bed(K, 2.3, -2.6, 0, { blanket: '#1a2244', level: 1, y: L, w: 1.2 })
    },
  },

  /* 5 ── Old Finn the canal fisherman (south-west, by the canal) — one room ── */
  {
    id: 'fisher',
    name: "Old Finn's Cottage",
    door: { x: -15, z: 27, face: 'e', half: 2.0 },
    room: { w: 7.6, d: 6.6, h: 3.3 },
    look: { wall: ['plaster', '#9aa8b0', '#8a98a0'], floor: '#8a6a48', trim: '#3a2a1e', ceiling: '#c8c0b0' },
    looks: {
      nets: { at: [2.6, -2.4], label: 'Look at the fishing nets', speaker: 'Finn’s Nets', role: 'still damp from the canal', lines: ['Tangled in the net: a boot, a coin from no kingdom you know, and a tiny golden pumpkin charm.', 'Finn says he’s been fishing the canal forty years and it’s never given up gold before this month.'] },
    },
    build(K, S) {
      const M = K.M
      // box bed in an alcove, stove + table, nets and oars on the walls, barrels
      Fu.bed(K, -2.7, -1.9, Math.PI / 2, { blanket: '#2a5a5a', w: 1.2 })
      Fu.kitchen(K, ...S.against('back', 0.8, 0.6), { len: 1.8, front: '#3a5a6a' })
      Fu.table(K, 1.3, 0.2, 0.3, { w: 1.1, d: 0.75, mat: M.woodLight })
      Fu.chair(K, 1.05, 0.95, Math.PI + 0.3)
      Fu.chair(K, 1.6, -0.55, 0.3)
      Fu.barrel(K, 3.2, 2.4)
      Fu.barrel(K, 3.2, 1.6, true)
      // nets draped on the right wall
      const net = S.on('right', -2.4)
      for (let k = 0; k < 6; k++) net.put(new THREE.PlaneGeometry(0.3, 1.4 - (k % 3) * 0.2, 1, 4), M.fab('#6a6a4a', 1), -0.75 + k * 0.3, 1.5, 0.05 + (k % 2) * 0.02, 0, 0, (k - 2.5) * 0.08, false)
      K.B.put(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 6).rotateZ(0.9), M.wood, -3.6, 1.6, 2.4)
      K.B.put(new THREE.BoxGeometry(0.16, 0.5, 0.03).rotateZ(0.9), M.wood, -2.75, 2.25, 2.4)
      Fu.armchair(K, -1.6, 2.1, Math.PI * 0.85, '#3a5a6a')
      Fu.rug(K, -0.6, 1.6, 2.0, 1.4, 0.2, ['#3a5a6a', '#e8e0cc', '#c89a48'], 0.006, 17)
      S.window('front', 2.2, '#3a5a6a')
      S.window('left', 0.6, '#3a5a6a')
      Fu.paintingOnWall(K, S.on('back', -2.6), 0.6, 1.8, 'landscape', 51)
      Fu.candle(K, 1.3, 0.76, 0.2, 0.14, true)
      K.light(0, 2.8, 0.6, '#ffc880', 3.5, 7)
    },
  },

  /* 6 ── Ivy the lantern-maker (south-east, by the canal) — one room workshop ── */
  {
    id: 'lantern',
    name: "Ivy's Lantern Workshop",
    door: { x: 16, z: 26.5, face: 'w', half: 2.0 },
    room: { w: 7.6, d: 6.6, h: 3.4 },
    look: { wall: ['stone', '#8a7a68', '#4a3e34'], floor: '#6a4428', trim: '#2a1e16', ceiling: '#5a4a3a' },
    looks: {
      bench: { at: [-1.0, -2.2], label: 'Watch the lanterns', speaker: 'Ivy’s Workbench', role: 'carving knives, wax, wick', lines: ['Every lantern in Chad City was carved on this bench. Ivy signs each one on the bottom.', 'A half-carved pumpkin shows a pattern you haven’t seen before: a crown inside a circle.'] },
    },
    build(K, S) {
      const M = K.M
      // two workbenches with carved pumpkins + candles, lantern shelves, a cot, a small stove
      Fu.table(K, -1.0, -2.2, 0, { w: 2.2, d: 0.8, mat: M.woodDark })
      Fu.pumpkinPile(K, -1.6, -2.2, 2, 0.76)
      Fu.candle(K, -0.4, 0.76, -2.2, 0.12, true)
      Fu.table(K, 2.0, 0.2, Math.PI / 2, { w: 1.8, d: 0.8, mat: M.woodDark })
      Fu.pumpkinPile(K, 2.0, 0.4, 3, 0.76)
      Fu.chair(K, -1.0, -1.4, Math.PI)
      // lantern shelves on the back wall: little iron lanterns with candles inside
      const sh = S.on('back', 1.8)
      for (const y of [1.1, 1.7, 2.3]) {
        sh.box(2.4, 0.04, 0.3, M.woodDark, 0, y, 0.15)
        for (let k = 0; k < 5; k++) {
          const p = sh.world(-1.0 + k * 0.5, y + 0.02, 0.16)
          K.B.put(new THREE.BoxGeometry(0.16, 0.22, 0.16), M.iron, p.x, p.y + 0.11, p.z)
          Fu.candle(K, p.x, p.y + 0.02, p.z + 0.09, 0.07)
        }
      }
      K.light(1.8, 1.9, -2.6, '#ffb860', 3, 6, true)
      Fu.bed(K, -2.9, 1.8, Math.PI / 2, { blanket: '#7a3a1a', w: 1.0 })
      Fu.kitchen(K, ...S.against('right', 1.4, 0.6), { len: 1.2, front: '#5a3a22' })
      Fu.pumpkinPile(K, -3.2, -2.8, 4)
      Fu.crate(K, 3.3, -2.8, 0.5)
      S.window('front', -2.4, '#7a3a1a')
      Fu.paintingOnWall(K, S.on('left', -1.6), 0.6, 1.7, 'pumpkin', 61)
      Fu.cobwebs(K, [[-3.8, 3.35, -3.3, 0]])
    },
  },

  /* 7 ── The Flexing Gourd tavern (open again) ── */
  {
    id: 'tavern',
    name: 'The Flexing Gourd',
    door: { x: -12, z: 19, face: 'e', half: 3.5, out: 1.0 },
    room: { w: 12, d: 10, h: 6.2, loft: { y: 3.0, zl: -1.6, stair: { x0: 5.05, x1: 6.0, zb: 1.8 } } },
    look: { wall: ['stone', '#9a8a74', '#5a4a3a'], floor: '#5a3a22', trim: '#2a1a10', ceiling: '#3a2a1e' },
    looks: {
      board: { at: [-4.8, 3.6], label: 'Read the tavern board', speaker: 'Tavern Board', role: 'chalk, mostly smudged', lines: ['TONIGHT: Pumpkin Ale · Leg-Day Stew · Arm-Wrestling (casual, no prizes)', 'Someone has added in small letters: “Who rang the citadel bell? — answers to the barkeep.”'] },
      hearth: { at: [-4.6, -2.0], label: 'Warm up by the hearth', speaker: 'The Great Hearth', role: 'roaring', lines: ['The fire is big enough to roast a pumpkin the size of a cart. Someone has, judging by the soot.'] },
    },
    build(K, S) {
      const M = K.M
      Fu.barCounter(K, 2.2, -0.2, 0, 4.4)
      Fu.bottleWall(K, S.on('back', 2.2), 4.4)
      for (const [x, z] of [[0.6, -3.6], [3.2, -3.6]] as const) Fu.barrel(K, x, z, true)
      for (let k = 0; k < 4; k++) Fu.chair(K, 0.6 + k * 1.1, 0.75, Math.PI, { mat: M.woodDark, pad: '#5a2a1a' })
      // tables with chairs
      for (const [x, z, round] of [[-3.0, 1.6, true], [-1.6, 3.2, false], [2.4, 3.0, true], [-3.4, -1.2, false]] as const) {
        Fu.table(K, x, z, 0, { round, w: round ? 1.1 : 1.5, d: 0.9, mat: M.woodDark })
        for (const [dx, dz, r] of round ? [[0, -0.85, 0], [0, 0.85, Math.PI], [0.85, 0, -Math.PI / 2]] : [[-0.5, -0.75, 0], [0.5, -0.75, 0], [-0.5, 0.75, Math.PI], [0.5, 0.75, Math.PI]])
          Fu.chair(K, x + dx, z + dz, r, { mat: M.woodDark })
        Fu.candle(K, x, 0.76, z, 0.12)
      }
      Fu.fireplace(K, ...S.against('left', 2.0, 0.8), { w: 2.4 })
      Fu.chandelier(K, -1.0, 2.5, 1.6, 8, 0.8)
      Fu.chandelier(K, 3.0, 2.5, 1.6, 6, 0.6)
      // chalk board by the door + kegs
      const bd = S.on('front', 4.6)
      bd.box(1.2, 0.9, 0.04, M.fab('#1a1e1a', 0.9), 0, 1.6, 0.03)
      bd.box(1.3, 1.0, 0.03, M.wood, 0, 1.6, 0.01)
      Fu.barrel(K, 5.2, 4.2)
      Fu.barrel(K, 4.4, 4.3)
      Fu.pumpkinPile(K, -5.4, 4.2, 3)
      S.window('front', -3.4, '#5a2a1a', 1.2, 1.5, 1.6)
      S.window('front', 2.4, '#5a2a1a', 1.2, 1.5, 1.6)
      Fu.paintingOnWall(K, S.on('right', 0.6), 1.0, 1.8, 'pumpkin', 71)
      // loft: two guest rooms behind a gallery
      const L = S.loft!.y
      Fu.bed(K, -4.0, -3.6, 0, { blanket: '#5a2a1a', level: 1, y: L, w: 1.3 })
      Fu.bed(K, 0.6, -3.6, 0, { blanket: '#2a4a3a', level: 1, y: L, w: 1.3 })
      Fu.dresser(K, -1.8, -4.6, 0, { level: 1, y: L })
      K.B.put(new THREE.BoxGeometry(0.1, 2.4, 3.0), M.woodDark, -1.0 - 0.6, L + 1.2, -3.4) // partition between the rooms
      K.block(-1.7, -1.5, -4.9, -2.0, 1)
      Fu.candle(K, -1.8, L + 0.85, -4.6, 0.16, true)
    },
  },

  /* 8 ── The Hollow House (haunted; the first clue to the Curse of the Chadverse) ── */
  {
    id: 'hollow',
    name: 'The Hollow House',
    door: { x: 21, z: -19.5, face: 'w', half: 3.0, out: 0.9 },
    room: { w: 9, d: 8, h: 5.6, loft: { y: 2.8, zl: -0.6, stair: { x0: 3.55, x1: 4.5, zb: 2.6 } } },
    look: { wall: ['damask', '#3a3a34', '#2a2a26'], floor: '#4a3e34', trim: '#1a1612', ceiling: '#2a2620' },
    mood: 'cold',
    looks: {
      portrait: { at: [-3.6, 0.4], label: 'Look at the portrait', speaker: 'A Portrait', role: 'its eyes follow you', lines: ['A stern lady in an old-fashioned collar. A small plaque: “Lady Hollow, Keeper of the Golden Pumpkin”.', 'You could swear her eyes just moved.'] },
      page: { at: [0.8, -1.6], label: 'Read the torn page', speaker: 'A Torn Page', role: 'the Curse of the Chadverse', lines: ['“…and on the night the Golden Pumpkin was taken from the citadel, every clock stopped at ten to midnight, and the curse began…”', '“…only the Order can—” The rest is torn away. (A clue! The story continues in a future update.)'] },
    },
    build(K, S) {
      const M = K.M
      // everything under dust sheets, an overturned chair, cobwebs, a cold fireplace, a few guttering candles
      Fu.sheeted(K, -1.4, 1.2, 0.2, 2.0, 0.85, 0.9) // sofa
      Fu.sheeted(K, 1.8, 1.8, -0.3, 0.9, 1.0, 0.9) // armchair
      Fu.sheeted(K, -3.4, -2.4, Math.PI / 2, 1.6, 2.1, 0.5) // cabinet
      Fu.sheeted(K, 2.2, -2.6, 0, 1.3, 0.8, 0.6) // chest
      Fu.table(K, 0.8, -1.6, 0.1, { w: 1.2, d: 0.7, mat: M.woodDark })
      K.B.put(new THREE.PlaneGeometry(0.22, 0.28).rotateX(-Math.PI / 2).rotateY(0.3), M.linen, 0.8, 0.79, -1.6)
      Fu.candle(K, 1.2, 0.76, -1.7, 0.08, false)
      Frame.at(K.B, -0.6, 0.22, 2.6, 0.4).put(new THREE.BoxGeometry(0.44, 0.05, 0.42), M.woodDark, 0, 0, 0, Math.PI / 2 - 0.1) // toppled chair seat
      Fu.fireplace(K, ...S.against('back', -1.0, 0.8), { lit: false })
      Fu.paintingOnWall(K, S.on('left', -0.4), 0.9, 1.8, 'portrait', 81, true)
      Fu.grandfatherClock(K, -4.25, 2.7, Math.PI / 2)
      Fu.cobwebs(K, [[-4.5, 5.55, -4, 0], [4.5, 5.55, -4, -Math.PI / 2], [-4.5, 2.75, 4, Math.PI / 2], [4.5, 2.5, 4, Math.PI], [-4.5, 5.5, -0.6, Math.PI / 2]])
      S.window('front', -2.6, '#3a3a34')
      S.window('front', 2.2, '#3a3a34')
      // a cold green glow drifting near the portrait
      K.light(-3.0, 1.8, 0.4, '#7affc8', 1.6, 4, true)
      K.light(0.8, 1.2, -1.6, '#ffb070', 0.9, 3, true)
      // loft: an empty nursery with a rocking chair that rocks by itself
      const L = S.loft!.y
      Fu.sheeted(K, -2.4, -2.8, 0, 1.4, 0.7, 2.0, L, 1) // the cot
      const rock = new THREE.Group()
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.5), M.woodDark)
      seat.position.y = 0.45
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.05), M.woodDark)
      back.position.set(0, 0.8, -0.24)
      const rk = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.025, 4, 16, Math.PI / 2).rotateY(Math.PI / 2).rotateX(Math.PI / 2 + Math.PI / 4), M.woodDark)
      rk.position.set(0, 0.6, 0)
      rock.add(seat, back, rk)
      rock.position.set(1.4, L, -2.6)
      K.scene.add(rock)
      M.D.push(seat.geometry, back.geometry, rk.geometry)
      K.anim((t) => (rock.rotation.x = Math.sin(t * 1.3) * 0.12))
      K.block(1.05, 1.75, -2.95, -2.25, 1)
    },
  },

  /* 9–12 ── Arcade Street shops (single room behind the shopfront) ── */
  {
    id: 'supply',
    name: 'Pump Supply',
    door: { x: 32.9, z: 12.2, face: 0, half: 3.0, out: 0.85 },
    room: { w: 7.4, d: 7, h: 3.6 },
    look: { wall: ['plaster', '#dfe8dc', '#c8d8c4'], floor: { tiles: ['#2a2a2e', '#3a3a3e'] }, trim: '#1e3a2a', ceiling: '#f2f2ee' },
    mood: 'bright',
    looks: {
      counter: { at: [0.6, -1.0], label: 'Ask about the shakers', speaker: 'Pump Supply', role: 'straps · chalk · shakers', lines: ['Shelves of straps, chalk and shakers in every colour. Every price tag just says “COMING SOON”.', 'The shop opens properly when Chad Coins arrive — no real money, ever.'] },
    },
    build(K, S) {
      Fu.shopShelf(K, ...S.against('left', 0, 0.45), ['#3a7a4a', '#e8641a', '#1a1a1e', '#e8e0cc'], 3, 2.6)
      Fu.shopShelf(K, ...S.against('right', 0, 0.45), ['#3a7a4a', '#e8641a', '#1a1a1e', '#e8e0cc'], 5, 2.6)
      Fu.shopShelf(K, ...S.against('back', -2.0, 0.45), ['#3a7a4a', '#ffb24a', '#1a1a1e'], 7, 2.2)
      Fu.shopCounter(K, 0.8, -1.4, 0, 2.6, '#1e3a2a')
      // a display table of shakers + a rack of lifting straps
      Fu.table(K, -1.6, 1.2, 0, { w: 1.4, d: 0.8, mat: K.M.woodLight })
      for (let k = 0; k < 6; k++) K.B.put(new THREE.CylinderGeometry(0.05, 0.045, 0.2, 12), K.M.fab(['#3a7a4a', '#e8641a', '#1a1a1e'][k % 3], 0.4), -2.1 + k * 0.2, 0.86, 1.2)
      K.light(0, 3.2, 0, '#fff0d8', 4, 8)
      K.light(0, 3.2, -2.4, '#fff0d8', 2.5, 6)
    },
  },
  {
    id: 'snacks',
    name: 'Chad Snacks',
    door: { x: 39.1, z: 12.0, face: 0, half: 3.1, out: 0.85 },
    room: { w: 8.2, d: 7, h: 3.6 },
    look: { wall: ['stripe', '#f2e2c0', '#e8b46a'], floor: { tiles: ['#e8e0cc', '#7a2a1a'] }, trim: '#7a2a1a', ceiling: '#f6eedc' },
    mood: 'bright',
    looks: {
      menu: { at: [-1.0, -1.6], label: 'Read the menu', speaker: 'Chad Snacks Menu', role: 'chalk on slate', lines: ['Pumpkin Protein Pie · Gourd Grilled Cheese · Leg-Day Lasagne · The Bulk Burrito', 'All prices: “COMING SOON (Chad Coins)”. The smell, however, is free.'] },
    },
    build(K, S) {
      Fu.shopCounter(K, -1.0, -2.0, 0, 3.4, '#7a2a1a')
      Fu.shopShelf(K, ...S.against('back', -1.0, 0.45), ['#e8641a', '#ffb24a', '#7a2a1a', '#e8e0cc'], 11, 3.4)
      // café tables
      for (const [x, z] of [[1.8, 0.6], [1.8, 2.4], [-2.4, 1.8]] as const) {
        Fu.table(K, x, z, 0, { round: true, w: 0.8, mat: K.M.chrome })
        Fu.chair(K, x - 0.6, z, Math.PI / 2, { mat: K.M.chrome, pad: '#7a2a1a' })
        Fu.chair(K, x + 0.6, z, -Math.PI / 2, { mat: K.M.chrome, pad: '#7a2a1a' })
      }
      const mb = S.on('back', 2.6)
      mb.box(1.4, 1.0, 0.04, K.M.fab('#1a1e1a', 0.9), 0, 2.1, 0.03)
      Fu.plant(K, 3.6, -3.0, 1.1)
      Fu.pumpkinPile(K, -3.6, 3.0, 3)
      K.light(0, 3.2, 0, '#ffe8c8', 4, 8)
      K.light(-1, 3.2, -2.4, '#ffe0b0', 2.5, 6)
    },
  },
  {
    id: 'cuts',
    name: 'Chad Cuts',
    door: { x: 32.9, z: 26.0, face: Math.PI, half: 3.0, out: 0.85 },
    room: { w: 7.4, d: 7, h: 3.6 },
    look: { wall: ['stripe', '#e8ecf0', '#c8d0dc'], floor: { tiles: ['#efeae0', '#1a1a1e'] }, trim: '#1a1a1e', ceiling: '#f6f6f2' },
    mood: 'bright',
    looks: {
      chair: { at: [-1.2, -1.8], label: 'Sit in the barber chair?', speaker: 'Chad Cuts', role: 'fades · beards · confidence', lines: ['The barber is out, but a sign on the mirror says: “Back soon. Your fade will be legendary.”', 'Haircuts will be part of the wardrobe update — no real money, just Chad Coins.'] },
    },
    build(K, S) {
      for (const x of [-1.2, 1.2]) {
        Fu.barberChair(K, x, -1.8, 0)
        const mF = S.on('back', x)
        mF.box(1.1, 1.3, 0.04, K.M.woodDark, 0, 1.6, 0.02)
        mF.put(new THREE.PlaneGeometry(0.95, 1.15), K.M.mirror, 0, 1.6, 0.045, 0, 0, 0, false)
        mF.box(1.2, 0.05, 0.3, K.M.porcelain, 0, 0.95, 0.15)
      }
      // waiting bench + magazine table + a barber's pole by the door
      Fu.sofa(K, ...S.against('left', -1.2, 0.86), '#7a1a1a', 1.8)
      Fu.table(K, -2.6, 2.4, 0, { w: 0.6, d: 0.6, h: 0.45, mat: K.M.chrome })
      Fu.washstand(K, ...S.against('right', 1.0, 0.45))
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.0, 16), K.M.fab('#c81a1a', 0.3))
      pole.position.set(3.2, 1.5, 3.0)
      K.scene.add(pole)
      K.M.D.push(pole.geometry)
      K.anim((t) => (pole.rotation.y = t * 2))
      Fu.plant(K, 3.2, -3.0, 1)
      K.light(0, 3.2, -1.0, '#f2f6ff', 4.5, 8)
      K.light(0, 3.2, 2.0, '#fff0e0', 2.5, 6)
    },
  },
  {
    id: 'fits',
    name: 'Chad Fits',
    door: { x: 39.1, z: 26.0, face: Math.PI, half: 3.0, out: 0.85 },
    room: { w: 8.2, d: 7, h: 3.6 },
    look: { wall: ['plaster', '#2a2230', '#3a2a44'], floor: '#8a6a4a', trim: '#9b6bff', ceiling: '#2a2230' },
    keeper: {
      look: { body: 'f', outfit: 'peasant', cloth: '#2a2230', skin: 0.1, hair: 'buns', hairColor: '#1a1210', apron: '#9b6bff' },
      at: [0, -3.15],
      yaw: 0,
      talkAt: [0, -1.4],
      shop: 'fits',
      line: { label: 'Shop with Vera', speaker: 'Vera', role: 'Chad Fits · tailor', lines: ['Welcome to CHAD FITS. Premium colours, paid in Chad Coins — in-game only, never real money.'] },
    },
    looks: {
      rack: { at: [0, 0.6], label: 'Browse the racks', speaker: 'Chad Fits', role: 'tees · hoodies · caps', lines: ['Hoodies in pumpkin orange, tees in midnight purple, caps with a tiny gold crown.', 'The changing room has a mirror that makes everyone look 10% more jacked. Vera at the counter sells premium colours for Chad Coins.'] },
    },
    build(K, S) {
      Fu.clothesRack(K, -1.4, 0.6, 0, ['#e8641a', '#5b2a86', '#1a1a1e', '#e8e0cc'])
      Fu.clothesRack(K, 1.6, 0.6, 0, ['#9b6bff', '#e8641a', '#2a5a3a', '#1a1a1e'])
      Fu.mannequin(K, -2.8, -2.4, 0.3, '#e8641a')
      Fu.mannequin(K, 2.8, -2.4, -0.3, '#5b2a86')
      Fu.shopCounter(K, 0, -2.5, 0, 2.2, '#3a2a44')
      // changing booth with a curtain + a tall mirror
      const cb = S.on('right', 1.8)
      cb.box(1.2, 2.2, 0.04, K.M.fab('#9b6bff', 1), 0, 1.25, 1.2)
      K.block(3.0, 4.1, 1.2, 2.4)
      const mr = S.on('left', 1.8)
      mr.box(0.7, 1.9, 0.04, K.M.brass, 0, 1.15, 0.02)
      mr.put(new THREE.PlaneGeometry(0.6, 1.8), K.M.mirror, 0, 1.15, 0.045, 0, 0, 0, false)
      K.light(0, 3.2, 0, '#f8e8ff', 4, 8)
      K.light(0, 2.6, -2.6, '#c08aff', 2.2, 5)
    },
  },
]

// the Haunted Quarter's seven houses + the crypt
HOUSES.push(...HAUNTED_INTERIORS)
// Motor Row: Chad Pets + Chad Motors
HOUSES.push(...SHOP_INTERIORS)
HOUSES.push(...SHOW_HOME_INTERIORS)
// the valley's own places: the roadside inn, the old watchtower, Mooncrest Manor
HOUSES.push(...VALLEY_INTERIORS)

export const HOUSE = (id: string) => HOUSES.find((h) => h.id === id)
/** your cottage in Chadville Estates: registered (or refreshed) from the save just before you go in */
export function setHome(spec: HouseSpec) {
  const i = HOUSES.findIndex((h) => h.id === 'home')
  if (i >= 0) HOUSES.splice(i, 1)
  HOUSES.push(spec)
}
