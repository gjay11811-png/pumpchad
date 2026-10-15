import * as THREE from 'three'
import { boxUV } from '../world/kit'
import { HAMLET_INN, WATCHTOWER } from '../world/hamlet'
import { MANOR } from '../world/valley'
import * as Fu from './furniture'
import type { HouseSpec } from './houses'

/**
 * The valley's three enterable places:
 *  • THE LANTERN INN (the roadside hamlet): a taproom with a lit hearth, bar and keeper, tables, and a loft of guest beds;
 *  • THE OLD WATCHTOWER: a round-tower chamber with a watchkeeper's desk and journal, and a lookout platform above (a discovery
 *    tied to the castle mystery);
 *  • MOONCREST MANOR: a two-storey house — entrance hall with a grand staircase, living room, dining room, library, trophy
 *    room, kitchen and conservatory on the ground floor; two bedrooms and a bathroom upstairs. Its windows line up with the
 *    exterior's (front windows are symmetric on purpose). A secret in the library ties to the castle story.
 */
const hall = (id: string, w: number, d: number) => ({ x: id === 'inn' ? HAMLET_INN.x : WATCHTOWER.x, z: id === 'inn' ? HAMLET_INN.z : WATCHTOWER.z, half: d / 2, face: 0, w })

/** build a straight partition along z (axis 'z', at x = fixed) or along x (axis 'x', at z = fixed) with doorway gaps */
function partition(K: import('./furniture').Kit, mat: THREE.Material, axis: 'x' | 'z', fixed: number, from: number, to: number, gaps: [number, number][], y0: number, y1: number, level: 0 | 1) {
  const sorted = [...gaps].sort((a, b) => a[0] - b[0])
  const segs: [number, number][] = []
  let cur = from
  for (const [g0, g1] of sorted) {
    if (g0 > cur) segs.push([cur, g0])
    cur = Math.max(cur, g1)
  }
  if (cur < to) segs.push([cur, to])
  for (const [a, b] of segs) {
    const len = b - a
    if (len < 0.05) continue
    const mid = (a + b) / 2
    if (axis === 'z') {
      K.B.put(boxUV(0.22, y1 - y0, len, 1), mat, fixed, (y0 + y1) / 2, mid)
      K.block(fixed - 0.16, fixed + 0.16, a - 0.1, b + 0.1, level)
    } else {
      K.B.put(boxUV(len, y1 - y0, 0.22, 1), mat, mid, (y0 + y1) / 2, fixed)
      K.block(a - 0.1, b + 0.1, fixed - 0.16, fixed + 0.16, level)
    }
  }
  // door frames on each gap
  for (const [g0, g1] of sorted) {
    const mid = (g0 + g1) / 2
    const wdt = g1 - g0
    if (axis === 'z') {
      K.B.put(boxUV(0.3, 0.3, wdt + 0.3, 1), K.M.woodDark, fixed, y0 + 2.45, mid)
      for (const e of [g0, g1]) K.B.put(boxUV(0.3, 2.45, 0.14, 1), K.M.woodDark, fixed, y0 + 1.22, e)
    } else {
      K.B.put(boxUV(wdt + 0.3, 0.3, 0.3, 1), K.M.woodDark, mid, y0 + 2.45, fixed)
      for (const e of [g0, g1]) K.B.put(boxUV(0.14, 2.45, 0.3, 1), K.M.woodDark, e, y0 + 1.22, fixed)
    }
  }
}

export const VALLEY_INTERIORS: HouseSpec[] = [
  /* ───────── The Lantern Inn ───────── */
  {
    id: 'inn',
    name: 'The Lantern Inn',
    door: { x: hall('inn', 12, 8).x, z: hall('inn', 12, 8).z, face: 0, half: 4.0, out: 1.0 },
    room: { w: 11, d: 8.4, h: 3.7, loft: { y: 2.95, zl: -1.2, stair: { x0: 4.2, x1: 5.1, zb: 3.6 } } },
    look: { wall: ['plaster', '#d8c0a0', '#c8b090'], floor: '#7a5230', trim: '#3a2418', ceiling: '#b89a78' },
    mood: 'warm',
    looks: {
      hearth: { at: [-4.7, 0.2], r: 1.6, label: 'Warm your hands at the hearth', speaker: 'The Hearth', role: 'a fire that has not gone out in a century', lines: ['The innkeeper says the fire has burned since the night the Golden Pumpkin was taken — “someone has to keep a light on for the road.”'] },
      ledger: { at: [1.4, -3.3], r: 1.5, label: 'Read the guest book', speaker: 'The Guest Book', role: 'signatures going back years', lines: ['The newest entries are all the same hand: “Climbed the old watchtower. The beacon on top points at the castle, and the castle points back.”', 'One line, underlined twice: “Mooncrest Manor has a room that isn’t on the plan.”'] },
      bed: { at: [-3.4, -2.6], r: 1.4, level: 1, label: 'Peek at the guest beds', speaker: 'The Loft', role: 'three beds, one always made', lines: ['Three beds under the eaves. The middle one is made with a purple ribbon on the pillow: reserved, always, for “the next Guardian.”'] },
    },
    keeper: {
      look: { body: 'f', outfit: 'peasant', cloth: '#f0dcc0', skin: 0.4, hair: 'buns', hairColor: '#6a3a1e', apron: '#efe6d4' },
      at: [-1.6, -3.3],
      yaw: 0,
      talkAt: [-1.6, -1.5],
      line: {
        label: 'Talk to Nell, the innkeeper',
        speaker: 'Nell',
        role: 'Innkeeper · The Lantern Inn',
        lines: ['Welcome, traveller! Hot broth, a warm seat, and the best view on the road if you climb the old watchtower.', 'Everyone heading down to Chad City stops here first. Everyone heading up to the castle stops twice.', 'If you’re hunting for the Order of the Golden Pumpkin — check the guest book. Someone keeps writing in it.'],
      },
    },
    build(K, S) {
      const M = K.M
      // the bar along the back-left with a bottle wall behind it, the hearth on the left wall, tables on a rug, barrels, a chandelier
      Fu.barCounter(K, -1.4, -2.6, 0, 4.2)
      Fu.bottleWall(K, S.on('back', -1.4), 4)
      Fu.fireplace(K, ...S.against('left', 0.2, 0.7), { lit: true, w: 1.8 })
      Fu.rug(K, 0.4, 1.2, 5.4, 3.0, 0, ['#7a2a1a', '#c89a48', '#3a2418'], 0.006, 23)
      for (const [x, z, ry] of [[-1.6, 1.1, 0], [1.4, 1.5, 0.2], [3.2, 0.4, -0.15]] as const) {
        Fu.table(K, x, z, ry, { w: 1.3, d: 0.9, mat: M.woodDark })
        Fu.chair(K, x - 0.9, z, Math.PI / 2, { mat: M.woodDark })
        Fu.chair(K, x + 0.9, z, -Math.PI / 2, { mat: M.woodDark })
        Fu.candle(K, x, 0.78, z, 0.1, true)
      }
      Fu.barrel(K, -4.4, -3.4)
      Fu.barrel(K, -4.4, -2.5, true)
      Fu.crate(K, 4.4, -3.6, 0.55)
      Fu.plant(K, 4.5, 3.2, 1.1)
      Fu.chandelier(K, 0.2, 3.0, 0.8, 6, 0.6)
      S.window('front', -3.4, '#7a2a1a')
      S.window('front', 3.4, '#7a2a1a')
      S.window('right', 1.2, '#7a2a1a')
      Fu.paintingOnWall(K, S.on('right', -2.0), 0.9, 1.9, 'pumpkin', 71)
      Fu.paintingOnWall(K, S.on('back', 3.6), 0.7, 2.0, 'landscape', 72)
      // the loft: three guest beds under the eaves
      const LY = 2.95
      Fu.bed(K, -3.8, -3.1, Math.PI, { blanket: '#7a2a1a', w: 1.1, level: 1, y: LY })
      Fu.bed(K, -1.4, -3.1, Math.PI, { blanket: '#5b2a86', w: 1.1, level: 1, y: LY })
      Fu.bed(K, 1.0, -3.1, Math.PI, { blanket: '#3a5a6a', w: 1.1, level: 1, y: LY })
      Fu.dresser(K, 3.6, -3.4, Math.PI, { level: 1, y: LY })
      S.window('back', -2.6, '#7a2a1a', 0.9, 1.1, 1.6, 1)
      S.window('back', 2.0, '#7a2a1a', 0.9, 1.1, 1.6, 1)
      K.light(0, 2.6, 0.6, '#ffc880', 4.5, 9)
      K.light(-4.2, 1.2, 0.2, '#ff9a48', 3, 6, true)
    },
  },

  /* ───────── The Old Watchtower ───────── */
  {
    id: 'watchtower',
    name: 'The Old Watchtower',
    door: { x: hall('wt', 6.4, 6.4).x, z: hall('wt', 6.4, 6.4).z, face: 0, half: WATCHTOWER.r, out: 1.1 },
    room: { w: 6.4, d: 6.4, h: 5.9, loft: { y: 3.1, zl: -0.4, stair: { x0: 2.1, x1: 3.0, zb: 2.7 } } },
    look: { wall: ['stone', '#8a8478', '#6a6458'], floor: { tiles: ['#8a8478', '#6a6458'] }, trim: '#3a3228', ceiling: '#5a5448' },
    mood: 'cold',
    looks: {
      journal: { at: [-1.6, -2.0], r: 1.6, label: 'Read the watchkeeper’s journal', speaker: 'The Watchkeeper’s Journal', role: 'a leather book, pages loose with age', lines: ['Day 4,118. The beacon on the roof still answers the one on the castle. Nobody lit it. I checked.', 'The Order called the castle “the keep with no lord”. They said the Golden Pumpkin was never stolen — it was hidden where only one who looked UP would find it.', 'If you’re reading this: the lantern road is the key. Light every lantern between the village and the castle, and the sky will tell you the rest.'] },
      lookout: { at: [-1.0, -2.0], r: 1.7, level: 1, label: 'Look out from the lookout', speaker: 'The Lookout', role: 'the whole valley in one window', lines: ['North: the village on its plateau, every lantern a gold dot. East: the lake with the bridge across it. South: the city, a glittering bowl.', 'West, high on its mountain, the castle: and a single window in the tallest tower burning purple.'] },
    },
    build(K, S) {
      const M = K.M
      Fu.table(K, -1.6, -2.2, 0, { w: 1.7, d: 0.9, mat: M.woodDark })
      Fu.chair(K, -1.6, -1.3, Math.PI, { mat: M.woodDark })
      Fu.candle(K, -1.2, 0.78, -2.2, 0.14, true)
      Fu.bookshelf(K, ...S.against('left', 0.3, 0.42), { w: 1.4, h: 2.0, seed: 33 })
      Fu.barrel(K, 2.5, -2.6)
      Fu.crate(K, -2.6, 2.3, 0.5)
      Fu.rug(K, 0, 0.8, 2.6, 1.8, 0.2, ['#3a3a5a', '#c89a48', '#e8e0cc'], 0.006, 41)
      Fu.armorStand(K, -2.5, -0.6, Math.PI / 2)
      S.window('front', 1.4, undefined, 0.5, 1.1, 1.7)
      S.window('left', 1.4, undefined, 0.5, 1.1, 1.7)
      // the lookout loft: a telescope, a wide window on every wall
      const LY = 3.1
      Fu.telescope(K, -1.2, -1.6, 0.5, 1, LY)
      S.window('back', 0, undefined, 1.6, 1.3, 1.6, 1)
      S.window('left', -0.6, undefined, 1.4, 1.3, 1.6, 1)
      S.window('right', -0.6, undefined, 1.4, 1.3, 1.6, 1)
      Fu.bed(K, 1.6, -2.2, Math.PI, { blanket: '#4a3a2a', w: 0.9, level: 1, y: LY })
      K.light(0, 2.4, 0.4, '#ffc880', 3.6, 7)
      K.light(0, LY + 1.6, -1.6, '#a8c8ff', 2.4, 6)
    },
  },

  /* ───────── Mooncrest Manor ───────── */
  {
    id: 'manor',
    name: 'Mooncrest Manor',
    door: { x: MANOR.x, z: MANOR.z, face: MANOR.face, half: 10, out: 1.2 },
    room: { w: 26, d: 20, h: 7.2, loft: { y: 3.6, zl: -1.0, stair: { x0: 1.8, x1: 3.6, zb: 9.0 } } },
    look: { wall: ['damask', '#d8c8b0', '#bca888'], floor: { tiles: ['#c8bca8', '#6a5a48'] }, trim: '#3a2418', ceiling: '#eee4d0' },
    mood: 'warm',
    looks: {
      hall: { at: [0, 6.6], r: 2.4, label: 'Take in the great hall', speaker: 'The Great Hall', role: 'a staircase built for entrances', lines: ['Two storeys of oak and marble. The chandelier is older than the village; the portrait of the founder looks suspiciously like the statue in the square — if the statue had a beard.'] },
      living: { at: [-9.0, 7.6], r: 2.4, label: 'Admire the living room', speaker: 'The Living Room', role: 'fire, books and a very good view', lines: ['A fireplace you could park a cart in, sofas that swallow you, and the lake glittering through tall windows. Everything is exactly where its owner left it — years ago.'] },
      dining: { at: [-8.5, 1.0], r: 2.2, label: 'Look over the dining room', speaker: 'The Dining Room', role: 'set for twelve', lines: ['Twelve places laid, twelve candles burning, not a crumb of dust. A small card at each place: “The Order sits when all lanterns burn.”'] },
      library: { at: [-9.0, -6.0], r: 2.2, label: 'Browse the library', speaker: 'The Library', role: 'floor-to-ceiling shelves', lines: ['Thousands of spines. One shelf is lower than the rest, with a gap where a tall book should be — and a faint draught coming from behind it.'] },
      secret: { at: [-11.2, -6.0], r: 1.5, label: 'Pull the odd book', speaker: 'The Hidden Room', role: 'a draught from behind the shelf', lines: ['You pull a leather book that was never printed. Click — the shelf swings a hand’s width and a cold, starry draught pours out.', 'Inside, scratched on the wall: “The Guardian Lanterns light the road. The Golden Pumpkin sleeps in the castle’s highest tower. Look up.” (The room beyond isn’t open yet — the castle district comes first.)'] },
      trophies: { at: [0, -8.0], r: 2.0, label: 'See the trophy room', speaker: 'The Trophy Room', role: 'cups, medals and one very large fish', lines: ['Shelves of cups and medals from every Pumpkin Rush, Chad Press and fishing derby ever held on the lake — and a mounted fish the size of a rowboat. The plaque says: “Old Gnarly, caught 1887, released 1888.”'] },
      kitchen: { at: [8.8, -6.0], r: 2.4, label: 'Peek into the kitchen', speaker: 'The Kitchen', role: 'copper pans and a warm range', lines: ['Copper pans in size order, a range still warm, and a pie cooling on the sill. Somebody was here a minute ago.'] },
      conserv: { at: [9.0, 7.4], r: 2.4, label: 'Step into the conservatory', speaker: 'The Conservatory', role: 'glass, ferns and lake light', lines: ['A glasshouse full of ferns, lemon trees and pumpkin vines, facing the lake. French doors open onto the garden terrace outside — walk round the house to reach it.'] },
      bed: { at: [-9.0, -5.0], r: 2.2, level: 1, label: 'Peek at the master bedroom', speaker: 'The Master Bedroom', role: 'a canopy bed facing the lake', lines: ['A canopy bed made with the Order’s purple, a dressing table, and a window that frames the whole lake. On the pillow: a single gold pumpkin seed.'] },
      guest: { at: [9.0, -5.0], r: 2.2, level: 1, label: 'Peek at the guest bedroom', speaker: 'The Guest Bedroom', role: 'freshly made', lines: ['A guest bed made up for someone expected. On the nightstand: “If you find the hidden room, tell nobody. Tell the castle.”'] },
    },
    build(K, S) {
      const M = K.M
      const LY = 3.6
      const wallM = S.wallMat
      const H = 7.2
      /* ── ground-floor partitions: the hall in the middle, rooms either side, the trophy room behind ── */
      partition(K, wallM, 'z', -4, -10, 10, [[5.8, 8.2], [-0.2, 2.2], [-7.2, -4.8]], 0, H, 0) // hall | left rooms
      partition(K, wallM, 'z', 4, -10, 10, [[5.3, 7.7], [-4.2, -1.8]], 0, H, 0) // hall | right rooms
      partition(K, wallM, 'x', -5, -4, 4, [[-1.0, 1.0]], 0, H, 0) // hall | trophy room
      partition(K, wallM, 'x', 4, -13, -4, [[-9.7, -7.3]], 0, H, 0) // living | dining
      partition(K, wallM, 'x', -2, -13, -4, [[-9.7, -7.3]], 0, H, 0) // dining | library
      /* ── upper floor: bedroom walls on the loft ── */
      partition(K, wallM, 'z', -4.6, -10, -1.1, [[-5.8, -3.6]], LY, H, 1)
      partition(K, wallM, 'z', 4.6, -10, -1.1, [[-5.8, -3.6]], LY, H, 1)
      partition(K, wallM, 'x', -6.4, -4.6, 4.6, [[-1.0, 1.0]], LY, H, 1)

      /* ── the great hall: rug, chandelier, clock, armour, console, plants, portrait ── */
      Fu.rug(K, -0.4, 4.6, 3.6, 8.0, 0, ['#5b2a86', '#c89a48', '#efe2c8'], 0.006, 91)
      Fu.chandelier(K, 0, 5.6, 4.5, 8, 0.9)
      Fu.grandfatherClock(K, -3.5, -3.2, 0)
      Fu.armorStand(K, -3.3, 9.0, Math.PI)
      Fu.armorStand(K, 0.9, 9.2, Math.PI)
      Fu.plant(K, -3.2, 3.2, 1.4)
      Fu.plant(K, 3.3, -3.7, 1.4)
      Fu.paintingOnWall(K, S.on('front', 6.2), 1.1, 3.1, 'portrait', 83)
      /* ── the living room (left front) ── */
      Fu.fireplace(K, ...S.against('left', -7.6, 0.8), { lit: true, w: 2.4 })
      Fu.rug(K, -9.0, 7.0, 4.0, 3.0, 0, ['#2a4a5a', '#c89a48', '#e8e0cc'], 0.006, 92)
      Fu.sofa(K, -8.6, 8.4, Math.PI, '#5a2a3a', 2.4)
      Fu.armchair(K, -11.6, 6.6, Math.PI / 2, '#3a5a6a')
      Fu.armchair(K, -6.2, 6.4, -Math.PI / 2, '#3a5a6a')
      Fu.table(K, -8.8, 6.4, 0, { w: 1.4, d: 0.8, mat: M.woodDark })
      Fu.grandPiano(K, -11.5, 8.6, Math.PI / 2 + 0.4)
      S.window('front', -8.5, '#5a2a3a', 1.5, 2.2, 1.6)
      S.window('left', -7.2, '#5a2a3a', 1.2, 1.8, 1.5)
      /* ── the dining room (left middle) ── */
      Fu.table(K, -8.4, 1.0, 0, { w: 4.2, d: 1.5, mat: M.woodDark, cloth: '#efe6d4' })
      for (const dx of [-1.6, 0, 1.6]) for (const dz of [-1.0, 1.0]) Fu.chair(K, -8.4 + dx, 1.0 + dz, dz > 0 ? Math.PI : 0, { mat: M.woodDark, pad: '#5b2a86' })
      Fu.chair(K, -11.0, 1.0, Math.PI / 2, { mat: M.woodDark, pad: '#5b2a86' })
      Fu.chair(K, -5.8, 1.0, -Math.PI / 2, { mat: M.woodDark, pad: '#5b2a86' })
      for (const dx of [-1.2, 1.2]) Fu.candle(K, -8.4 + dx, 0.8, 1.0, 0.18, true)
      Fu.chandelier(K, -8.4, 3.4, 1.0, 6, 0.6)
      const dr = S.against('left', -1.0, 0.5)
      Fu.dresser(K, dr[0], dr[1], dr[2], {})
      S.window('left', -1.0, '#5a2a3a', 1.2, 1.8, 1.5)
      /* ── the library (left back, under the loft) ── */
      for (const [u, w] of [[-5.2, 2.2], [-8.4, 2.2], [-11.4, 2.2]] as const) Fu.bookshelf(K, ...S.against('back', u, 0.45), { w, h: 2.9, seed: Math.round(u * 7) })
      Fu.bookshelf(K, ...S.against('left', 5.5, 0.45), { w: 2.4, h: 2.9, seed: 12 })
      Fu.bookshelf(K, ...S.against('left', 8.2, 0.45), { w: 2.4, h: 2.9, seed: 13 })
      Fu.table(K, -8.2, -6.0, 0, { w: 1.8, d: 0.9, mat: M.woodDark })
      Fu.chair(K, -8.2, -5.0, Math.PI, { mat: M.woodDark, pad: '#3a5a3a' })
      Fu.armchair(K, -6.0, -7.4, Math.PI * 0.8, '#3a5a3a')
      Fu.rug(K, -8.0, -6.0, 3.0, 2.2, 0, ['#3a5a3a', '#c89a48', '#e8e0cc'], 0.006, 93)
      Fu.candle(K, -8.0, 0.78, -6.0, 0.14, true)
      /* ── the trophy room (behind the hall) ── */
      const TR = S.on('back', 0)
      TR.box(7.0, 0.1, 0.6, M.woodDark, 0, 1.05, 0.3)
      for (const [x, k] of [[-2.6, 0], [-1.4, 1], [0, 2], [1.4, 3], [2.6, 4]] as const) {
        TR.put(k % 2 ? new THREE.CylinderGeometry(0.16, 0.08, 0.3, 12) : new THREE.CylinderGeometry(0.2, 0.12, 0.36, 12), M.brass, x, 1.28, 0.3)
        TR.box(0.28, 0.06, 0.28, M.woodDark, x, 1.1, 0.3)
      }
      // the mounted fish (Old Gnarly) over the shelf
      TR.put(new THREE.SphereGeometry(0.42, 14, 8).scale(2.6, 0.7, 0.4), M.fab('#6a8a6a', 0.5), 0, 2.5, 0.12)
      TR.put(new THREE.ConeGeometry(0.28, 0.5, 4).rotateZ(Math.PI / 2), M.fab('#6a8a6a', 0.5), 1.25, 2.5, 0.12)
      TR.box(2.6, 0.5, 0.06, M.woodDark, 0, 2.5, 0.03)
      Fu.rug(K, 0, -7.6, 3.2, 1.8, 0, ['#7a2a1a', '#c89a48', '#3a2418'], 0.006, 94)
      Fu.table(K, -2.4, -7.6, 0, { w: 0.9, d: 0.6, mat: M.woodDark })
      Fu.table(K, 2.4, -7.6, 0, { w: 0.9, d: 0.6, mat: M.woodDark })
      Fu.armorStand(K, -3.3, -9.2, 0)
      Fu.armorStand(K, 3.3, -9.2, 0)
      K.light(0, 3.0, -7.6, '#ffd890', 3, 6)
      /* ── the kitchen (right back) ── */
      Fu.kitchen(K, ...S.against('back', 8.8, 0.7), { len: 4.0, front: '#5a3a22', stove: true })
      Fu.kitchen(K, ...S.against('right', -5.0, 0.7), { len: 3.2, front: '#5a3a22' })
      Fu.table(K, 8.4, -5.4, 0, { w: 2.4, d: 1.2, mat: M.woodLight })
      Fu.chair(K, 7.4, -6.6, 0, { mat: M.woodLight })
      Fu.chair(K, 9.4, -6.6, 0, { mat: M.woodLight })
      Fu.barrel(K, 11.8, -2.8)
      Fu.crate(K, 5.4, -9.0, 0.55)
      Fu.pumpkinPile(K, 5.4, -3.2, 4)
      S.window('back', 9.4, '#c89a48', 1.3, 1.3, 1.7)
      /* ── the conservatory (right front): a glasshouse corner with ferns and lemon trees ── */
      Fu.rug(K, 9.0, 7.0, 4.0, 3.2, 0, ['#2a5a3a', '#e8e0cc', '#c89a48'], 0.006, 95)
      for (const [px, pz, s] of [[5.4, 9.0, 1.8], [12.0, 9.0, 1.8], [12.0, 4.6, 1.5], [5.4, 4.6, 1.5], [9.0, 9.2, 2.0]] as const) Fu.plant(K, px, pz, s)
      Fu.table(K, 8.8, 6.6, 0, { w: 1.2, d: 1.2, round: true, mat: M.woodLight })
      Fu.chair(K, 7.7, 6.6, Math.PI / 2, { mat: M.woodLight, pad: '#2a5a3a' })
      Fu.chair(K, 9.9, 6.6, -Math.PI / 2, { mat: M.woodLight, pad: '#2a5a3a' })
      S.window('front', 6.4, undefined, 1.4, 2.6, 1.8)
      S.window('front', 9.0, undefined, 1.4, 2.6, 1.8)
      S.window('front', 11.6, undefined, 1.4, 2.6, 1.8)
      S.window('right', 6.2, undefined, 1.4, 2.6, 1.8)
      S.window('right', 8.8, undefined, 1.4, 2.6, 1.8)
      // the French doors in the right wall, with their glazing bars (they open onto the garden terrace outside)
      const FD = S.on('right', 3.6)
      FD.box(1.7, 2.5, 0.06, M.fab('#9fc0d8', 0.2), 0, 1.25, 0.05)
      for (const x of [-0.85, 0, 0.85]) FD.box(0.07, 2.55, 0.1, M.woodDark, x, 1.27, 0.07)
      FD.box(1.8, 0.07, 0.1, M.woodDark, 0, 1.4, 0.07)
      S.window('right', -8.8, '#c89a48', 1.2, 1.5, 1.6)
      /* ── the great hall's windows (symmetric: they line up with the exterior's) + the staircase landing ── */
      S.window('front', 2.8, '#5b2a86', 1.2, 3.2, 1.9)
      S.window('front', -2.8, '#5b2a86', 1.2, 3.2, 1.9)
      /* ── upstairs: the master bedroom (left), the guest bedroom (right), the bathroom and the landing ── */
      Fu.bed(K, -9.2, -7.2, 0, { blanket: '#5b2a86', w: 1.9, canopy: '#3a1a5a', level: 1, y: LY })
      Fu.dresser(K, -6.2, -9.4, 0, { level: 1, y: LY, mirror: true })
      Fu.wardrobe(K, -12.2, -4.8, Math.PI / 2, { level: 1, y: LY })
      Fu.rug(K, -9.0, -5.2, 3.2, 2.2, 0, ['#3a1a5a', '#c89a48', '#efe2c8'], 0.006 + LY, 96)
      Fu.bed(K, 9.2, -7.2, 0, { blanket: '#2a5a5a', w: 1.2, level: 1, y: LY })
      Fu.dresser(K, 6.4, -9.4, 0, { level: 1, y: LY })
      Fu.wardrobe(K, 12.2, -4.8, -Math.PI / 2, { level: 1, y: LY })
      Fu.bathtub(K, 0, -8.4, 0, 1, LY)
      Fu.washstand(K, -3.2, -8.0, 0, 1, LY)
      Fu.plant(K, 3.2, -2.4, 1.2, LY)
      S.window('back', -9.2, '#3a1a5a', 1.4, 1.6, 1.7, 1)
      S.window('back', 9.2, '#2a5a5a', 1.4, 1.6, 1.7, 1)
      S.window('back', 0, undefined, 0.9, 1.0, 1.8, 1)
      S.window('left', 5.0, '#3a1a5a', 1.4, 1.6, 1.7, 1)
      S.window('right', -5.0, '#2a5a5a', 1.4, 1.6, 1.7, 1)
      Fu.paintingOnWall(K, S.on('left', -8.0, LY), 0.9, 1.9, 'landscape', 84)
      K.light(-9, LY + 2.4, -6, '#ffd8a0', 3, 7)
      K.light(9, LY + 2.4, -6, '#ffd8a0', 3, 7)
      K.light(0, LY + 2.4, -3, '#ffe2b0', 2.5, 7)
      K.light(0, 5.0, 5.5, '#ffe2b0', 5.5, 12)
      K.light(-9, 2.8, 5.5, '#ffc880', 4, 8)
      K.light(-8, 2.8, 0.5, '#ffc880', 3.5, 7)
      K.light(9, 2.8, 6.5, '#e8ffd8', 3.5, 8)
      K.light(8.8, 2.6, -5.0, '#ffd8a0', 3.5, 7)
    },
  },
]
