import * as THREE from 'three'
import { SHOW_HOMES } from '../../estates'
import * as Fu from './furniture'
import type { HouseSpec } from './houses'

/**
 * THE THREE SHOW HOMES' INTERIORS (Chadville Heights, north row): a cosy one-room village COTTAGE, a bright open-plan CONTEMPORARY house with a loft bedroom,
 * and a larger PREMIUM home with a hall, a dining room, a music corner and two bedrooms upstairs. Each has its own plan, finish and lighting, a clear walk through
 * its rooms, windows with real depth (curtains, reveals, glass), and a "show-home note" that says which builder pieces the exterior is made of — so a visitor
 * can see what a plot can become. They are walk-through rooms, separate from the 52 purchasable plots; they are only built while you are inside (the Interior
 * scene), so they cost nothing when you are outside.
 */
const by = (id: string) => SHOW_HOMES.find((h) => h.id === id)!
const cottage = by('cottage')
const modern = by('contemporary')
const premium = by('premium')

export const SHOW_HOME_INTERIORS: HouseSpec[] = [
  /* ── 1. THE COTTAGE: one warm room, a hearth, a kitchen corner, a sleeping nook ── */
  {
    id: 'show_cottage',
    name: 'The Cottage · Show Home',
    door: { x: cottage.x, z: cottage.z - 0.8, face: 0, half: 2.8, out: 1.0 },
    room: { w: 7.2, d: 6.2, h: 2.9 },
    look: { wall: ['plaster', '#eadfc8', '#d6c6a4'], floor: '#8a6038', trim: '#4a3a2a', ceiling: '#efe6d2' },
    mood: 'warm',
    looks: {
      note: { at: [2.6, 2.2], label: 'Read the show-home note', speaker: 'Show Home · The Cottage', role: 'a starter home', lines: ['One room, one hearth, a nook to sleep in: the cottage is the smallest home on Chadville Heights.', 'In the plot builder it is the Cottage piece (2×2 cells, 60 coins) — add hedges, flowers and a path and it looks like this garden.'] },
    },
    build(K, S) {
      const M = K.M
      // living: a hearth on the left wall, a sofa and an armchair facing it on a warm rug, a low table between
      Fu.rug(K, -0.9, 0.7, 3.2, 2.3, 0, ['#8a3a2a', '#e8d8b0', '#4a5a3a'], 0.006, 31)
      Fu.fireplace(K, ...S.against('left', 0.4, 0.8), { lit: true })
      Fu.sofa(K, -0.6, 0.5, -Math.PI / 2, '#6a4a3a', 2.1)
      Fu.armchair(K, -1.7, 2.0, -Math.PI / 2 + 0.55, '#7a5a3a')
      Fu.table(K, -2.1, 0.5, 0, { w: 0.9, d: 0.55, h: 0.42, mat: M.woodDark })
      Fu.candle(K, -2.1, 0.44, 0.5, 0.14, true)
      // the kitchen corner (back wall, right): counter run + a small dining table with two chairs
      Fu.kitchen(K, ...S.against('back', 1.9, 0.6), { len: 2.6, front: '#5a7a5a' })
      Fu.table(K, 1.9, -0.4, 0, { w: 1.1, d: 0.8, mat: M.wood, cloth: '#e8e0cc' })
      Fu.chair(K, 1.5, -1.2, 0, { pad: '#8a3a2a' })
      Fu.chair(K, 2.3, 0.4, Math.PI, { pad: '#8a3a2a' })
      Fu.pumpkinPile(K, 3.0, -2.6, 3)
      // the sleeping nook (back-left): a bed under the eaves, a wardrobe and a chest
      Fu.bed(K, -2.3, -2.2, 0, { blanket: '#5a7a8a', w: 1.2 })
      Fu.wardrobe(K, ...S.against('left', -2.6, 0.6))
      Fu.dresser(K, -0.6, -2.7, 0, { mirror: true })
      Fu.rug(K, -2.3, -1.2, 1.4, 1.0, 0, ['#5a7a8a', '#e8e0cc', '#c89a48'], 0.007, 8)
      // windows with depth: curtains + reveals on three walls, a painting, plants
      S.window('front', -2.4, '#8a3a2a')
      S.window('front', 2.3, '#8a3a2a')
      S.window('right', 0.6, '#5a7a5a')
      S.window('back', -1.2, '#5a7a8a', 0.9, 1.1)
      Fu.paintingOnWall(K, S.on('back', 0.2), 0.7, 1.8, 'landscape', 33)
      Fu.plant(K, 3.0, 2.4, 1.1)
      Fu.plant(K, -3.0, 2.6, 0.9)
      K.light(-1.4, 2.3, 0.7, '#ffbe70', 4.0, 7, true)
      K.light(2.0, 2.4, -0.6, '#ffd8a0', 3.0, 6)
      K.light(-2.2, 2.2, -2.2, '#ffc890', 2.2, 5)
    },
  },

  /* ── 2. THE CONTEMPORARY: open plan, a kitchen island, a sofa group, a loft bedroom ── */
  {
    id: 'show_contemporary',
    name: 'The Contemporary · Show Home',
    door: { x: modern.x + 2.5, z: modern.z - 0.8, face: 0, half: 2.8, out: 0.9 },
    room: { w: 10, d: 7.8, h: 6.0, loft: { y: 3.0, zl: -0.4, stair: { x0: 4.05, x1: 5.0, zb: 2.8 } } },
    look: { wall: ['plaster', '#ecebe6', '#d4d0c8'], floor: { tiles: ['#d9d5cc', '#c6c2b8'] }, trim: '#2a2a2e', ceiling: '#f4f2ee' },
    mood: 'bright',
    looks: {
      note: { at: [2.4, 3.0], label: 'Read the show-home note', speaker: 'Show Home · The Contemporary', role: 'a flat-roofed detached home', lines: ['Open-plan living under a flat roof, a cantilevered upper floor and a long glazed front: the contemporary house on Chadville Heights.', 'The builder has the pieces for the garden (hedge, tree, path, flowers, lamp, bench); the house itself is a show model you can walk through but not buy.'] },
    },
    build(K, S) {
      const M = K.M
      const L = S.loft!.y
      // living (front half): an L of two sofas on a big rug around a low table, a TV wall on the left, plants, wide windows
      Fu.rug(K, -1.8, 1.8, 4.2, 3.0, 0, ['#c9c4b8', '#3a4a5a', '#e8e0cc'], 0.006, 41)
      Fu.sofa(K, -1.4, 3.0, Math.PI, '#4a5a6a', 2.8)
      Fu.sofa(K, -3.6, 1.4, Math.PI / 2, '#4a5a6a', 2.2)
      Fu.armchair(K, 0.4, 1.0, -Math.PI / 2 - 0.4, '#c89a48')
      Fu.table(K, -1.7, 1.7, 0, { w: 1.3, d: 0.8, h: 0.4, mat: M.woodDark })
      K.B.put(new THREE.BoxGeometry(0.06, 1.0, 2.0), M.fab('#101216', 0.3), -4.92, 1.35, 1.0) // the TV panel on the left wall
      K.B.put(new THREE.BoxGeometry(0.4, 0.5, 2.6), M.woodDark, -4.75, 0.25, 1.0) // its low unit
      Fu.plant(K, -4.4, 3.3, 1.3)
      Fu.plant(K, 3.2, 3.3, 1.2)
      // the kitchen + dining under the loft: a long run on the back wall, an island with stools, a dining table
      Fu.kitchen(K, ...S.against('back', 0.5, 0.6), { len: 4.4, front: '#2a2e36', top: M.stoneLight })
      Fu.table(K, 1.0, -1.7, 0, { w: 2.6, d: 0.9, h: 0.95, mat: M.woodDark })
      for (const x of [0.2, 1.0, 1.8]) Fu.chair(K, x, -1.0, Math.PI, { mat: M.woodDark, pad: '#c89a48', y: 0.2 })
      Fu.table(K, -3.2, -2.3, 0, { w: 1.8, d: 0.9, h: 0.76, mat: M.wood })
      for (const [x, z, r] of [[-3.8, -2.9, 0], [-2.6, -2.9, 0], [-3.8, -1.7, Math.PI], [-2.6, -1.7, Math.PI]] as const) Fu.chair(K, x, z, r, { pad: '#3a4a5a' })
      Fu.pumpkinPile(K, 3.9, -3.3, 2)
      // loft bedroom: a double bed on a rug, bedside table, wardrobe, a desk by the window, a washstand
      Fu.bed(K, -1.6, -2.7, 0, { blanket: '#3a4a5a', w: 1.5, level: 1, y: L })
      Fu.rug(K, -1.6, -1.6, 2.6, 1.6, 0, ['#c9c4b8', '#3a4a5a', '#e8e0cc'], L + 0.006, 17)
      Fu.dresser(K, 0.4, -3.6, 0, { level: 1, y: L })
      Fu.wardrobe(K, 2.6, -3.5, 0, { level: 1, y: L })
      Fu.table(K, -4.0, -0.4 - 0.0, Math.PI / 2, { w: 1.2, d: 0.6, h: 0.75, mat: M.wood, level: 1, y: L })
      Fu.chair(K, -3.4, -0.4, -Math.PI / 2, { pad: '#c89a48', level: 1, y: L })
      Fu.washstand(K, 4.2, -2.4, -Math.PI / 2, 1, L)
      // glazing: big front windows, a side window, a loft window (depth: reveal + curtain on each)
      S.window('front', -2.6, '#c9c4b8', 1.8, 1.7, 1.5)
      S.window('front', 0.4, '#c9c4b8', 1.8, 1.7, 1.5)
      S.window('right', -1.5, '#c9c4b8', 1.4, 1.5)
      S.window('back', 3.3, '#c9c4b8', 1.1, 1.2, 1.4, 1)
      S.window('left', -2.4, '#c9c4b8', 1.0, 1.2, 1.4, 1)
      Fu.paintingOnWall(K, S.on('back', -3.5), 1.1, 1.8, 'castle', 44)
      K.light(-1.5, 2.8, 2.0, '#fff2dc', 5, 9)
      K.light(1.2, 2.7, -2.6, '#ffe8c0', 4, 8, true)
      K.light(-1.6, L + 2.2, -2.4, '#ffd8a0', 3, 6)
    },
  },

  /* ── 3. THE PREMIUM: a hall, a drawing room with a piano, a dining room, two bedrooms upstairs ── */
  {
    id: 'show_premium',
    name: 'The Premium · Show Home',
    door: { x: premium.x, z: premium.z - 1.0, face: 0, half: 2.8, out: 3.0 },
    room: { w: 12, d: 9.2, h: 6.4, loft: { y: 3.2, zl: -1.2, stair: { x0: 5.05, x1: 6.0, zb: 2.4 } } },
    look: { wall: ['damask', '#d8cfc0', '#c8bda8'], floor: '#6a4426', trim: '#e8e0d0', ceiling: '#f4eee2' },
    mood: 'warm',
    looks: {
      note: { at: [3.0, 3.6], label: 'Read the show-home note', speaker: 'Show Home · The Premium', role: 'a two-storey home with a columned portico', lines: ['A hall, a drawing room with a piano, a dining room, and two bedrooms upstairs: the premium home is the largest of the three show homes.', 'It is a showpiece; on your own plot you can build with the Tower, Fountain, Lamp, Tree, Hedge and Path pieces to dress a grand garden like this one.'] },
    },
    build(K, S) {
      const M = K.M
      const L = S.loft!.y
      // drawing room (front-left): fireplace on the left wall, a sofa pair on a big rug, a piano by the window
      Fu.rug(K, -2.4, 1.6, 4.6, 3.2, 0, ['#7a2a2a', '#e8d8b0', '#2a3a4a'], 0.006, 51)
      Fu.fireplace(K, ...S.against('left', 1.2, 0.9), { lit: true, mantel: true })
      Fu.sofa(K, -2.6, 3.0, Math.PI, '#2a3a4a', 2.4)
      Fu.sofa(K, -2.4, 0.2, 0, '#2a3a4a', 2.4)
      Fu.armchair(K, -0.2, 1.7, -Math.PI / 2 - 0.3, '#7a2a2a')
      Fu.table(K, -2.5, 1.6, 0, { w: 1.2, d: 0.8, h: 0.44, mat: M.woodDark })
      Fu.grandPiano(K, 1.4, 3.0, Math.PI)
      Fu.chandelier(K, -2.4, 3.0, 1.6, 6, 0.6)
      // the dining room (front-right): a long table with six chairs
      Fu.table(K, 2.9, 0.4, Math.PI / 2, { w: 2.8, d: 1.1, mat: M.woodDark, cloth: '#e8e0cc' })
      for (const [dx, dz, r] of [[-1.0, -0.8, Math.PI / 2], [-1.0, 0.8, Math.PI / 2], [-1.0, 0.0, Math.PI / 2], [1.0, -0.8, -Math.PI / 2], [1.0, 0.8, -Math.PI / 2], [1.0, 0.0, -Math.PI / 2]] as const) Fu.chair(K, 2.9 + dx, 0.4 + dz, r, { mat: M.woodDark, pad: '#7a2a2a' })
      Fu.candle(K, 2.9, 0.78, 0.4, 0.2, true)
      Fu.chandelier(K, 2.9, 3.0, 0.4, 5, 0.5)
      // the study + library under the loft (back): bookshelves, a desk, a clock; the kitchen pass on the right
      Fu.bookshelf(K, ...S.against('back', -3.6, 0.42), { w: 2.2, h: 2.5, seed: 12 })
      Fu.bookshelf(K, ...S.against('back', -1.2, 0.42), { w: 2.2, h: 2.5, seed: 21 })
      Fu.table(K, -2.4, -3.0, 0, { w: 1.5, d: 0.75, mat: M.woodDark })
      Fu.chair(K, -2.4, -2.2, Math.PI, { pad: '#2a3a4a' })
      Fu.grandfatherClock(K, 0.2, -3.9, 0)
      Fu.kitchen(K, ...S.against('back', 3.4, 0.6), { len: 3.4, front: '#e8e0d0' })
      Fu.table(K, 3.3, -2.3, 0, { w: 1.8, d: 0.9, h: 0.92, mat: M.woodDark })
      Fu.plant(K, 5.0, 3.6, 1.4)
      Fu.plant(K, -5.1, 3.6, 1.3)
      Fu.paintingOnWall(K, S.on('right', 3.4), 1.0, 1.9, 'portrait', 61)
      // upstairs (loft): the main bedroom with a canopy bed, wardrobe, dresser; a second bedroom with a single bed; a bath alcove
      Fu.bed(K, -3.2, -3.2, 0, { blanket: '#7a2a2a', w: 1.6, canopy: '#7a2a2a', level: 1, y: L })
      Fu.wardrobe(K, -5.3, -2.0, Math.PI / 2, { level: 1, y: L })
      Fu.dresser(K, -0.8, -4.1, 0, { level: 1, y: L, mirror: true })
      Fu.rug(K, -3.2, -2.0, 3.2, 1.8, 0, ['#7a2a2a', '#e8d8b0', '#2a3a4a'], L + 0.006, 23)
      Fu.bed(K, 2.2, -3.4, 0, { blanket: '#2a5a6a', w: 1.1, level: 1, y: L })
      Fu.table(K, 3.8, -3.8, 0, { w: 0.9, d: 0.5, h: 0.5, mat: M.wood, level: 1, y: L })
      Fu.bathtub(K, 4.6, -1.8, -Math.PI / 2, 1, L)
      Fu.washstand(K, 2.6, -1.3, 0, 1, L)
      // windows: tall pairs on the front, one on each side, two upstairs at the back
      S.window('front', -3.6, '#7a2a2a', 1.3, 2.0, 1.7)
      S.window('front', -1.0, '#7a2a2a', 1.3, 2.0, 1.7)
      S.window('front', 1.6, '#7a2a2a', 1.3, 2.0, 1.7)
      S.window('front', 4.2, '#7a2a2a', 1.3, 2.0, 1.7)
      S.window('left', 2.6, '#2a3a4a', 1.2, 1.8)
      S.window('right', -1.0, '#2a3a4a', 1.2, 1.8)
      S.window('back', -3.2, '#7a2a2a', 1.2, 1.3, 1.4, 1)
      S.window('back', 2.2, '#2a5a6a', 1.2, 1.3, 1.4, 1)
      K.light(-2.4, 2.9, 1.6, '#ffd8a0', 6, 10, true)
      K.light(2.9, 2.9, 0.4, '#ffe0b0', 5, 9)
      K.light(-1.0, 2.7, -3.0, '#ffc880', 3.5, 7)
      K.light(-3.2, L + 2.4, -3.0, '#ffd8a0', 3.5, 7)
      K.light(2.6, L + 2.4, -3.0, '#ffe8c8', 3, 6)
    },
  },
]
