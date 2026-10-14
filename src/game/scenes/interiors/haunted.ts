import * as THREE from 'three'
import { Frame } from '../world/signs'
import { CRYPT, HAUNTED_HOUSES } from '../world/hauntedQuarter'
import * as Fu from './furniture'
import type { HouseSpec } from './houses'

/**
 * Inside the Haunted Quarter: seven haunted homes and Mortimer's crypt. Each has its own layout and mood, and
 * most hide a piece of the Curse of the Chadverse (the Golden Pumpkin, the Order, the clocks stopped at ten to
 * midnight) — the story the next update builds on.
 */
const door = (id: string, out = 0.75) => {
  const h = HAUNTED_HOUSES.find((x) => x.id === id)!
  return { x: h.x, z: h.z, face: h.yaw, half: h.d / 2, out }
}

export const HAUNTED_INTERIORS: HouseSpec[] = [
  /* ── the Crooked House: everything a little askew ── */
  {
    id: 'crooked',
    name: 'The Crooked House',
    door: door('crooked'),
    room: { w: 7.4, d: 7, h: 6.0, loft: { y: 2.9, zl: -0.4, stair: { x0: 2.75, x1: 3.7, zb: 2.6 } } },
    look: { wall: ['stripe', '#3a4438', '#2e382e'], floor: '#4a3828', trim: '#1e1814', ceiling: '#2a2620' },
    mood: 'cold',
    looks: {
      raven: { at: [-2.4, -0.2], label: 'Look at the stuffed raven', speaker: 'A Stuffed Raven', role: 'on a crooked perch', lines: ['Its glass eyes follow the clock on the wall. The clock reads ten to midnight. It has read ten to midnight for a long time.'] },
      frames: { at: [1.4, 1.6], label: 'Straighten a picture', speaker: 'The Crooked House', role: 'it does not want to be straight', lines: ['You straighten the picture. It tilts back. You straighten it again. Something upstairs laughs.'] },
    },
    build(K, S) {
      const M = K.M
      const tilt = (a: number) => a + 0.12
      Fu.rug(K, -1.2, 0.6, 2.4, 1.8, 0.15, ['#2e382e', '#8a7a4a', '#5a1e22'], 0.006, 3)
      Fu.armchair(K, -2.3, 1.3, tilt(Math.PI * 0.6), '#4a2a3a')
      Fu.table(K, -1.3, 0.2, tilt(0), { w: 0.9, d: 0.6, h: 0.5, mat: M.woodDark })
      Fu.candle(K, -1.3, 0.5, 0.2, 0.12, true)
      Fu.bookshelf(K, ...S.against('back', -1.6, 0.42), { w: 1.6, h: 2.3, seed: 91 })
      Fu.fireplace(K, ...S.against('left', 1.4, 0.8), { lit: false })
      // the raven on its perch
      const R = Frame.at(K.B, -2.4, 0, -0.2, 0.4)
      R.put(new THREE.CylinderGeometry(0.02, 0.03, 1.3, 6), M.woodDark, 0, 0.65, 0)
      R.put(new THREE.SphereGeometry(0.12, 10, 8).scale(0.8, 1, 1.3), M.soot, 0, 1.42, 0)
      R.put(new THREE.SphereGeometry(0.07, 10, 8), M.soot, 0, 1.56, 0.12)
      R.put(new THREE.ConeGeometry(0.025, 0.1, 6).rotateX(Math.PI / 2), M.iron, 0, 1.55, 0.22)
      K.block(-2.6, -2.2, -0.4, 0)
      // crooked frames on the right wall
      for (const [u, y, a] of [[-1.6, 1.6, 0.2], [0.2, 1.9, -0.25], [1.6, 1.5, 0.3]] as const) Fu.paintingOnWall(K, S.on('right', u).sub(0, 0, 0, 0, 0, a), 0.5, y, (['portrait', 'landscape', 'castle'] as const)[Math.abs(Math.round(u)) % 3], Math.round(u * 10) + 50)
      Fu.grandfatherClock(K, 1.2, -3.2, tilt(0))
      S.window('front', -2.0, '#2e382e')
      Fu.cobwebs(K, [[-3.7, 5.95, -3.5, 0], [3.7, 2.85, 3.5, Math.PI]])
      K.light(-1.3, 2.0, 0.2, '#9affc8', 1.4, 5, true)
      // loft: a narrow bed under the eaves, toys left on the floor
      const L = S.loft!.y
      Fu.bed(K, -1.6, -2.3, tilt(0), { blanket: '#3a2a4a', level: 1, y: L, w: 1.1 })
      Fu.doll(K, 0.6, L, -3.2, 0.3, '#7a2a3a')
      Fu.doll(K, 1.0, L, -3.0, -0.4, '#2a4a5a', '#c8a070', true)
      Fu.candle(K, 1.8, L, -3.3, 0.2, true)
    },
  },

  /* ── the Apothecary's Rest: a shop nobody has opened in years ── */
  {
    id: 'apothecary',
    name: "The Apothecary's Rest",
    door: door('apothecary', 0.95),
    room: { w: 8, d: 7.4, h: 5.6, loft: { y: 2.8, zl: -0.6, stair: { x0: 3.05, x1: 4.0, zb: 2.6 } } },
    look: { wall: ['plaster', '#3a4a44', '#2e3c36'], floor: '#3e2e20', trim: '#1a2420', ceiling: '#283028' },
    mood: 'cold',
    looks: {
      ledger: { at: [-0.4, -0.8], label: 'Read the old ledger', speaker: 'Apothecary’s Ledger', role: 'the last page', lines: ['“Essence of Golden Pumpkin, one vial — SOLD. Buyer: a hooded gentleman. Paid in coins I have never seen before.”', '“He wore a ring with a crown inside a circle.” (The same mark is carved on Ivy’s half-finished lantern…)'] },
      mortar: { at: [2.0, 1.6], label: 'Sniff the mortar and pestle', speaker: 'Mortar & Pestle', role: 'still faintly glowing', lines: ['Cinnamon, graveyard moss, and something that smells exactly like a protein shake. The glow fades as you watch.'] },
    },
    build(K, S) {
      const M = K.M
      Fu.shopCounter(K, -0.4, -1.4, 0, 3.0, '#2a3a32')
      K.B.put(new THREE.BoxGeometry(0.4, 0.04, 0.3).rotateY(0.2), M.linen, -0.6, 1.06, -1.5)
      Fu.apothecaryJars(K, S.on('back', -0.4), 3.4)
      Fu.apothecaryJars(K, S.on('left', 0.4), 2.6)
      Fu.herbRack(K, -0.4, 2.6, 0.6, 0, 2.4)
      Fu.table(K, 2.0, 1.6, 0, { w: 1.0, d: 0.7, mat: M.woodDark })
      K.B.put(new THREE.CylinderGeometry(0.12, 0.08, 0.14, 14), M.stone, 2.0, 0.83, 1.6)
      K.B.put(new THREE.CylinderGeometry(0.02, 0.03, 0.22, 6).rotateZ(0.5), M.stone, 2.08, 0.95, 1.6)
      K.light(2.0, 1.1, 1.6, '#7aff8a', 1.2, 2.6, true)
      Fu.sheeted(K, -2.6, 1.8, 0.2, 1.1, 0.9, 0.8)
      Fu.cobwebs(K, [[-4, 5.55, -3.7, 0], [4, 5.55, -3.7, -Math.PI / 2], [-4, 2.75, 3.7, Math.PI / 2]])
      S.window('front', -2.4, '#2e3c36')
      S.window('front', 2.2, '#2e3c36')
      Fu.candle(K, 0.6, 1.02, -1.3, 0.1, true)
      // loft: the storeroom
      const L = S.loft!.y
      for (const [x, z] of [[-3.0, -3.2], [-2.3, -3.3], [-3.1, -2.4]] as const) Fu.crate(K, x, z, 0.6, 0.2, L)
      K.block(-3.6, -1.9, -3.7, -2.0, 1)
      Fu.barrel(K, 1.6, -3.0)
      Fu.candle(K, 0.2, L, -3.4, 0.2, true)
    },
  },

  /* ── Ravenswood Manor: the grand haunted mansion ── */
  {
    id: 'ravenswood',
    name: 'Ravenswood Manor',
    door: door('ravenswood'),
    room: { w: 12, d: 10, h: 7, loft: { y: 3.4, zl: -1.4, stair: { x0: 5.05, x1: 6.0, zb: 2.4 } } },
    look: { wall: ['damask', '#3a1e28', '#4a2a36'], floor: '#2e2018', trim: '#1a1014', ceiling: '#241a20' },
    mood: 'cold',
    looks: {
      table: { at: [-1.0, 0.4], r: 1.6, label: 'Look at the dining table', speaker: 'The Long Table', role: 'set for thirteen', lines: ['Thirteen places, thirteen dusty plates. The twelfth chair is pushed back as if someone just left.', 'The thirteenth chair has a golden pumpkin carved into its back, and a crown inside a circle.'] },
      portrait: { at: [-5.2, -0.4], label: 'Look at the family portraits', speaker: 'The Ravenswoods', role: 'five generations', lines: ['Five portraits, five Ravenswoods. Every one of them is holding the same golden pumpkin.', 'The last frame is empty. The brass plate under it says “Keeper”.'] },
      piano: { at: [3.4, 2.8], label: 'Press a piano key', speaker: 'The Grand Piano', role: 'badly out of tune', lines: ['You press one key. Upstairs, somebody presses the next one.'] },
    },
    build(K, S) {
      const M = K.M
      Fu.rug(K, -1.0, 0.4, 6.2, 2.8, 0, ['#3a1018', '#c89a48', '#1a1014'], 0.006, 17)
      Fu.table(K, -1.0, 0.4, 0, { w: 4.6, d: 1.2, mat: M.woodDark, cloth: '#e8e0cc' })
      for (let k = 0; k < 6; k++) {
        const x = -3.0 + k * 0.8
        Fu.chair(K, x, -0.55, 0, { mat: M.woodDark, pad: '#5a1a2a' })
        Fu.chair(K, x, 1.35, Math.PI, { mat: M.woodDark, pad: '#5a1a2a' })
        K.B.put(new THREE.CylinderGeometry(0.13, 0.13, 0.015, 16), M.porcelain, x, 0.79, 0.05)
        K.B.put(new THREE.CylinderGeometry(0.13, 0.13, 0.015, 16), M.porcelain, x, 0.79, 0.75)
      }
      for (const x of [-2.4, 0.4]) {
        K.B.put(new THREE.CylinderGeometry(0.03, 0.08, 0.4, 8), M.brass, x, 0.98, 0.4)
        for (const dx of [-0.12, 0, 0.12]) Fu.candle(K, x + dx, 1.12, 0.4, 0.12)
      }
      K.light(-1.0, 1.8, 0.4, '#ffb86a', 3.5, 7, true)
      Fu.fireplace(K, ...S.against('left', 1.4, 0.8), { w: 2.6 })
      for (let k = 0; k < 5; k++) Fu.paintingOnWall(K, S.on('back', -4.6 + k * 1.9), 0.8, 1.9, k === 4 ? 'castle' : 'portrait', 100 + k, k === 2)
      Fu.armorStand(K, -5.4, 3.8, Math.PI / 2)
      Fu.armorStand(K, -5.4, -3.6, Math.PI / 2)
      Fu.grandPiano(K, 3.4, 2.8, Math.PI * 0.85)
      Fu.sheeted(K, 2.6, -3.6, 0, 1.8, 0.9, 0.8)
      Fu.chandelier(K, -1.0, 4.6, 1.4, 10, 1.0)
      S.window('front', -3.6, '#3a1018', 1.2, 2.2, 1.9)
      S.window('front', 3.0, '#3a1018', 1.2, 2.2, 1.9)
      Fu.cobwebs(K, [[-6, 6.95, -5, 0], [6, 6.95, -5, -Math.PI / 2], [-6, 6.95, 5, Math.PI / 2], [6, 3.3, 5, Math.PI]])
      // the gallery: bedrooms behind a long balustrade
      const L = S.loft!.y
      Fu.bed(K, -3.6, -3.6, 0, { blanket: '#3a1018', canopy: '#2a1018', level: 1, y: L, w: 1.6 })
      Fu.dresser(K, -0.8, -4.6, 0, { level: 1, y: L, mirror: true })
      Fu.wardrobe(K, 1.4, -4.6, 0, { level: 1, y: L })
      Fu.doll(K, -0.8, L + 0.86, -4.6, 0.2, '#e8e0cc', '#2a1a14', true)
      Fu.candle(K, 3.2, L, -4.6, 0.2, true)
    },
  },

  /* ── the Dollmaker's House ── */
  {
    id: 'dollmaker',
    name: "The Dollmaker's House",
    door: door('dollmaker'),
    room: { w: 8, d: 7, h: 5.4, loft: { y: 2.7, zl: -0.5, stair: { x0: 3.05, x1: 4.0, zb: 2.4 } } },
    look: { wall: ['diamond', '#4a3438', '#7a5a5e'], floor: '#5a4030', trim: '#2a1a1e', ceiling: '#3a2a2e' },
    mood: 'cold',
    looks: {
      dolls: { at: [-1.4, -1.6], label: 'Look at the dolls', speaker: 'The Dolls', role: 'forty of them, give or take', lines: ['Rows of porcelain dolls in tiny pumpkin-coloured dresses. You count forty.', 'You count again. Forty-one.'] },
      table: { at: [1.8, 1.4], label: 'Look at the sewing table', speaker: 'Sewing Table', role: 'mid-stitch', lines: ['A half-finished doll in a tiny gold crown. Its label reads “for the Order — handle with care”.'] },
    },
    build(K, S) {
      const M = K.M
      // shelves of dolls along the back wall
      const sh = S.on('back', -1.4)
      for (const y of [0.9, 1.45, 2.0]) {
        sh.box(3.2, 0.04, 0.3, M.woodDark, 0, y, 0.15)
        for (let k = 0; k < 8; k++) {
          const p = sh.world(-1.4 + k * 0.4, y + 0.02, 0.16)
          Fu.doll(K, p.x, p.y, p.z, 0, ['#e8641a', '#7a2a3a', '#2a4a5a', '#e8e0cc'][(k + Math.round(y * 3)) % 4], ['#3a2418', '#c8a070', '#1a1210'][k % 3], k === 5 && y === 1.45)
        }
      }
      K.block(-3.2, 0.4, -3.5, -3.1)
      Fu.table(K, 1.8, 1.4, 0, { w: 1.3, d: 0.8, mat: M.woodLight })
      Fu.doll(K, 1.6, 0.76, 1.4, 0.4, '#e0a83e')
      K.B.put(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 10), M.fab('#c81a1a'), 2.2, 0.8, 1.3)
      Fu.chair(K, 1.8, 2.2, Math.PI, { mat: M.woodDark, pad: '#7a2a3a' })
      Fu.mannequin(K, 2.2, -1.9, -0.6, '#7a2a3a')
      Fu.armchair(K, -2.4, 1.8, Math.PI * 0.75, '#5a2a3a')
      Fu.doll(K, -2.4, 0.52, 1.8, Math.PI * 0.75, '#e8e0cc', '#1a1210', true)
      Fu.rug(K, -1.2, 1.4, 2.2, 1.6, 0, ['#4a3438', '#e0a83e', '#2a1a1e'], 0.006, 23)
      S.window('front', -2.2, '#7a2a3a')
      K.light(0, 2.2, 0.8, '#ff9ac8', 1.8, 6, true)
      Fu.candle(K, 1.3, 0.76, 1.6, 0.1, true)
      // loft: the doll house + a child's bed
      const L = S.loft!.y
      Fu.bed(K, -2.6, -2.4, 0, { blanket: '#e8a0b8', level: 1, y: L, w: 1.1 })
      const dh = Frame.at(K.B, 0.6, L, -3.0, 0)
      dh.box(1.1, 0.8, 0.6, M.fab('#e8d0c0'), 0, 0.4, 0)
      dh.put(new THREE.ConeGeometry(0.8, 0.5, 4).rotateY(Math.PI / 4).scale(1, 1, 0.6), M.fab('#7a2a3a'), 0, 1.05, 0)
      for (const [x, y] of [[-0.3, 0.55], [0.3, 0.55], [-0.3, 0.2], [0.3, 0.2]] as const) dh.put(new THREE.PlaneGeometry(0.16, 0.16), M.candle, x, y, 0.31, 0, 0, 0, false)
      K.block(0, 1.2, -3.4, -2.6, 1)
    },
  },

  /* ── Widow's Watch: she watched the canal for a ship that never came ── */
  {
    id: 'widow',
    name: "Widow's Watch",
    door: door('widow'),
    room: { w: 7.6, d: 7.6, h: 5.6, loft: { y: 2.8, zl: -0.4, stair: { x0: 2.85, x1: 3.8, zb: 2.6 } } },
    look: { wall: ['stripe', '#2e3440', '#3a4250'], floor: '#3a2a1e', trim: '#1a1e26', ceiling: '#262a34' },
    mood: 'cold',
    looks: {
      letters: { at: [-1.6, 0.4], label: 'Read the letters', speaker: 'A Bundle of Letters', role: 'tied with black ribbon', lines: ['“My dearest — the Order sails at midnight with the pumpkin. I will be home before the clocks strike twelve.”', 'Every letter after that is unopened. Every one is addressed in her handwriting, to him.'] },
      scope: { at: [1.6, -3.0], level: 1, label: 'Look through the telescope', speaker: 'Widow’s Telescope', role: 'pointed at the canal', lines: ['It still points at the canal. A small light bobs on the dark water, then winks out.'] },
    },
    build(K, S) {
      const M = K.M
      Fu.table(K, -1.6, 0.4, 0, { w: 1.2, d: 0.7, mat: M.woodDark })
      K.B.put(new THREE.BoxGeometry(0.3, 0.06, 0.2), M.linen, -1.7, 0.8, 0.4)
      K.B.put(new THREE.BoxGeometry(0.03, 0.065, 0.21), M.fab('#0e0c10'), -1.7, 0.8, 0.4)
      Fu.chair(K, -1.6, 1.2, Math.PI, { mat: M.woodDark, pad: '#2e3440' })
      Fu.candle(K, -1.1, 0.76, 0.2, 0.14, true)
      Fu.armchair(K, 1.2, 1.4, Math.PI * 1.2, '#2e3440')
      Fu.fireplace(K, ...S.against('left', -1.4, 0.8), { lit: true, w: 1.4 })
      Fu.bookshelf(K, ...S.against('back', -1.4, 0.42), { w: 1.6, h: 2.3, seed: 131, palette: ['#1a1e26', '#2e3440', '#5a1e22', '#c89a48'] })
      Fu.paintingOnWall(K, S.on('right', -1.6), 0.7, 1.7, 'portrait', 141)
      S.window('front', -2.2, '#2e3440', 1.0, 1.8, 1.7)
      S.window('front', 2.0, '#2e3440', 1.0, 1.8, 1.7)
      // loft: the watch room — the telescope at the window, a cold bed
      const L = S.loft!.y
      Fu.telescope(K, 1.6, -3.0, Math.PI, 1, L)
      S.window('back', 1.6, '#2e3440', 1.0, 1.2, 1.5, 1)
      Fu.bed(K, -1.8, -2.4, 0, { blanket: '#1a1e26', level: 1, y: L, w: 1.3 })
      Fu.candle(K, 0.0, L, -3.5, 0.2, true)
    },
  },

  /* ── the Lanternless House: no lamps, many mirrors ── */
  {
    id: 'lanternless',
    name: 'The Lanternless House',
    door: door('lanternless'),
    room: { w: 8.4, d: 8, h: 3.6 },
    look: { wall: ['plaster', '#1e1e22', '#141418'], floor: '#241c16', trim: '#0e0c0e', ceiling: '#141416' },
    mood: 'cold',
    looks: {
      mirror: { at: [-3.2, -1.0], label: 'Look in the mirror', speaker: 'A Tall Mirror', role: 'cold to the touch', lines: ['Your reflection is a second late. It waves before you do.', 'Then it points — toward the graveyard, toward Mortimer’s crypt.'] },
      candle: { at: [0, 0], label: 'Look at the only candle', speaker: 'The Last Candle', role: 'it has never gone out', lines: ['Nobody in the quarter remembers lighting it. Nobody has ever seen it burn down.'] },
    },
    build(K, S) {
      const M = K.M
      // mirrors around the walls, dust-sheeted shapes, a single candle in the middle of the room
      for (const [side, u] of [['left', -1.0], ['left', 1.6], ['back', -2.2], ['back', 2.2], ['right', 0.2]] as const) {
        const F = S.on(side, u)
        F.box(0.9, 2.1, 0.05, M.woodDark, 0, 1.25, 0.03)
        F.put(new THREE.PlaneGeometry(0.78, 1.95), M.mirror, 0, 1.25, 0.06, 0, 0, 0, false)
      }
      Fu.sheeted(K, -1.8, 2.2, 0.3, 1.8, 0.85, 0.8)
      Fu.sheeted(K, 2.4, 2.0, -0.4, 0.9, 1.0, 0.9)
      Fu.sheeted(K, 2.2, -2.4, 0, 1.4, 1.6, 0.6)
      Fu.table(K, 0, 0, 0, { round: true, w: 0.7, mat: M.woodDark })
      Fu.candle(K, 0, 0.76, 0, 0.18, true)
      Fu.cobwebs(K, [[-4.2, 3.55, -4, 0], [4.2, 3.55, -4, -Math.PI / 2], [-4.2, 3.55, 4, Math.PI / 2], [4.2, 3.55, 4, Math.PI]])
      S.window('front', -2.6, '#1e1e22')
    },
  },

  /* ── the gravedigger's cottage (warm: Grim is friendlier than his name) ── */
  {
    id: 'gravedigger',
    name: "Grim's Cottage",
    door: door('gravedigger'),
    room: { w: 7, d: 6, h: 3.2 },
    look: { wall: ['plaster', '#5a4e40', '#4a4034'], floor: '#5a4030', trim: '#2a2016', ceiling: '#4a4034' },
    looks: {
      coffin: { at: [1.4, -1.6], label: 'Look at the half-built coffin', speaker: 'A Half-Built Coffin', role: 'built to measure', lines: ['The tag says “For: the next visitor”.', 'Under it, in smaller letters: “(it’s a joke — it’s a bookshelf — Grim)”.'] },
      kettle: { at: [-2.4, -2.0], label: 'Look at the kettle', speaker: 'Grim’s Kettle', role: 'always on', lines: ['Pumpkin tea, strong enough to wake the dead. Grim insists that’s a figure of speech.'] },
    },
    build(K, S) {
      const M = K.M
      Fu.coffin(K, 1.4, -1.6, Math.PI / 2, { open: true })
      Fu.shovels(K, S.on('right', 1.6))
      Fu.kitchen(K, ...S.against('back', -1.8, 0.6), { len: 1.4, front: '#4a3a2a' })
      Fu.table(K, -1.4, 0.8, 0, { w: 1.1, d: 0.7, mat: M.wood })
      Fu.chair(K, -1.4, 1.5, Math.PI)
      Fu.bed(K, -2.6, 2.2, Math.PI / 2, { blanket: '#5a3a1e', w: 0.9 })
      Fu.candle(K, -1.2, 0.76, 0.8, 0.14, true)
      Fu.pumpkinPile(K, 2.8, 2.4, 3)
      S.window('front', -2.0, '#5a3a1e')
      K.light(0, 2.6, 0, '#ffc080', 3, 6)
    },
  },

  /* ── Mortimer's crypt: stone, candles, and the second clue ── */
  {
    id: 'crypt',
    name: "Mortimer's Crypt",
    door: { x: CRYPT.x, z: CRYPT.z, face: CRYPT.yaw, half: CRYPT.d / 2, out: 0.9 },
    room: { w: 7, d: 9, h: 4.2 },
    look: { wall: ['stone', '#6a645a', '#3a3630'], floor: { tiles: ['#4a463e', '#3a3630'] }, trim: '#2a2622', ceiling: '#3a3630' },
    mood: 'cold',
    looks: {
      tomb: { at: [0, -1.4], r: 1.4, label: 'Read the inscription', speaker: 'Mortimer’s Tomb', role: 'Keeper of the Golden Pumpkin', lines: ['“HERE LIES MORTIMER, LAST KEEPER OF THE GOLDEN PUMPKIN.”', '“He hid the key where the moon looks down on the water.” (Another clue — the story continues in the next update.)'] },
    },
    build(K, S) {
      Fu.sarcophagus(K, 0, -1.4, 0, { ajar: true })
      Fu.sarcophagus(K, -2.4, 2.0, 0)
      Fu.sarcophagus(K, 2.4, 2.0, 0)
      for (const [x, z] of [[-1.2, -3.6], [1.2, -3.6], [-3.0, -0.4], [3.0, -0.4]] as const) {
        K.B.put(new THREE.CylinderGeometry(0.16, 0.2, 1.0, 10), K.M.stoneLight, x, 0.5, z)
        Fu.candle(K, x - 0.05, 1.0, z, 0.2)
        Fu.candle(K, x + 0.07, 1.0, z + 0.04, 0.14)
        K.block(x - 0.25, x + 0.25, z - 0.25, z + 0.25)
      }
      K.light(0, 1.6, -2.4, '#ffb86a', 3, 7, true)
      K.light(0, 1.4, 2.0, '#7affb0', 1.6, 5, true)
      // carved pumpkin-and-crown reliefs on the back wall
      const F = S.on('back', 0)
      F.put(new THREE.CircleGeometry(0.7, 28), K.M.stoneLight, 0, 2.4, 0.03, 0, 0, 0, false)
      F.put(new THREE.SphereGeometry(0.35, 14, 10).scale(1.2, 0.9, 0.3), K.M.stone, 0, 2.35, 0.06)
      F.put(new THREE.ConeGeometry(0.2, 0.3, 5), K.M.stone, 0, 2.95, 0.06)
      Fu.cobwebs(K, [[-3.5, 4.15, -4.5, 0], [3.5, 4.15, -4.5, -Math.PI / 2]])
    },
  },
]
