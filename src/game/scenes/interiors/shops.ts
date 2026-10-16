import * as THREE from 'three'
import { Frame } from '../world/signs'
import { MOTORS, PETS } from '../world/motorRow'
import { CARS, heroCar, sportsCar } from '../world/vehicles'
import * as Fu from './furniture'
import type { HouseSpec } from './houses'
import { GARAGE_INTERIOR } from './garage'

/**
 * Motor Row's shops. CHAD PETS: a bright, lively shop — a black cat on her cushion, a ghost in a glass dome, a bat
 * on a perch, a hopping pumpkin critter, an aquarium, a cat tree — with Patches behind the counter. CHAD MOTORS:
 * a polished showroom, three cars on lit podiums with info lecterns, and Rex at the sales desk.
 * Patches runs adoptions for Chad Coins (an in-game currency, never real money); cars aren't for sale until driving exists.
 */
const soon = 'Patches at the counter can set up an adoption — paid in Chad Coins, an in-game currency, never real money.'

export const SHOP_INTERIORS: HouseSpec[] = [
  {
    id: 'pets',
    name: 'Chad Pets',
    door: { x: PETS.x, z: PETS.z, face: Math.PI, half: PETS.d / 2, out: 0.85 },
    room: { w: 9.4, d: 8, h: 3.8 },
    look: { wall: ['stripe', '#f2e6f4', '#e2cce8'], floor: '#a07850', trim: '#5b2a86', ceiling: '#faf2fa' },
    mood: 'bright',
    keeper: {
      look: { body: 'f', outfit: 'peasant', cloth: '#ecdcf8', skin: 0.4, hair: 'buns', hairColor: '#c86a3a', apron: '#9b5cff' },
      at: [1.6, -3.3],
      yaw: 0,
      talkAt: [1.6, -1.1],
      shop: 'pets',
      line: {
        label: 'Adopt with Patches',
        speaker: 'Patches',
        role: 'Chad Pets · keeper of critters',
        lines: [
          'Welcome to CHAD PETS! Mind the cat — she owns the place, I just work here.',
          'Every companion here will follow you around Chad City, help you sniff out secrets, and never give anyone an unfair edge in competitions.',
          soon,
        ],
      },
    },
    looks: {
      cat: { at: [-2.4, 0.9], label: 'Say hello to the black cat', speaker: 'Midnight', role: 'black cat · very judgemental', lines: ['Midnight opens one golden eye, decides you are acceptable, and closes it again. Her tail keeps swishing.', soon] },
      ghost: { at: [-1.4, -1.6], label: 'Look at the ghost in the dome', speaker: 'Boo', role: 'pocket ghost · shy', lines: ['A tiny ghost peers out of its glass dome, then pretends it wasn’t looking.', 'Patches says Boo glows brighter near hidden things.', soon] },
      bat: { at: [-3.4, -1.9], label: 'Look at the bat', speaker: 'Flapjack', role: 'fruit bat · upside down', lines: ['Flapjack hangs from the perch, wrapped up like a burrito. One wing twitches when you get close.', soon] },
      critter: { at: [2.4, 1.0], r: 1.2, label: 'Watch the pumpkin critter', speaker: 'Gourdy', role: 'mini pumpkin creature · bouncy', lines: ['Gourdy hops round and round the pen. Every few laps it stops, looks at you, and hops faster.', soon] },
    },
    build(K, S) {
      Fu.rug(K, -0.2, 0.6, 3.2, 2.0, 0, ['#9b5cff', '#ffd25a', '#f2e6f4'], 0.006, 41)
      Fu.shopCounter(K, 1.6, -2.4, 0, 3.0, '#5b2a86')
      Fu.shopShelf(K, ...S.against('back', 1.6, 0.45), ['#9b5cff', '#ff9a3a', '#5fae6a', '#e8e0cc'], 43, 3.2)
      Fu.shopShelf(K, ...S.against('right', 0.4, 0.45), ['#ffd25a', '#5fc8e8', '#9b5cff', '#e8641a'], 47, 2.2)
      Fu.aquarium(K, ...S.against('left', 0.6, 0.5))
      Fu.catTree(K, -3.9, 2.4)
      Fu.table(K, -2.4, 0.4, 0, { w: 0.9, d: 0.7, h: 0.5, mat: K.M.woodLight })
      Fu.blackCat(K, -2.4, 0.5, 0.4, 0.4)
      Fu.table(K, -1.4, -2.6, 0, { round: true, w: 0.8, h: 0.7, mat: K.M.woodDark })
      Fu.ghostDome(K, -1.4, 0.7, -2.6)
      Fu.batPerch(K, -3.4, 1.7, -2.9)
      K.block(-3.75, -3.05, -3.1, -2.7)
      Fu.pumpkinCritter(K, 2.4, 2.2)
      Fu.plant(K, 4.2, 3.4, 1.1)
      Fu.plant(K, -4.2, -3.5, 1.0)
      S.window('front', -2.8, '#9b5cff', 1.3, 1.6, 1.6)
      S.window('front', 2.8, '#9b5cff', 1.3, 1.6, 1.6)
      // paw-print frames on the walls
      Fu.paintingOnWall(K, S.on('right', -2.6), 0.6, 1.8, 'pumpkin', 77)
      K.light(0, 3.3, 0, '#fff0e0', 4.5, 9)
      K.light(1.6, 3.2, -2.6, '#ffe0c0', 2.5, 6)
    },
  },
  {
    id: 'motors',
    name: 'Chad Motors',
    door: { x: MOTORS.x, z: MOTORS.z, face: Math.PI, half: MOTORS.d / 2, out: 1.2 },
    room: { w: 16, d: 12, h: 6 },
    look: { wall: ['plaster', '#efe6d6', '#e0d4c0'], floor: { tiles: ['#5a5662', '#4c4856'] }, trim: '#c89a48', ceiling: '#f4ece0' },
    mood: 'bright',
    keeper: {
      look: { body: 'm', outfit: 'peasant', cloth: '#d8d0e8', skin: -0.5, hair: 'buzzed', hairColor: '#1a1210', hat: 'cap', hatColor: '#1a1a20', beard: true },
      at: [6.7, 1.6],
      yaw: -Math.PI / 2,
      talkAt: [4.3, 1.6],
      line: {
        label: 'Talk to Rex',
        speaker: 'Rex',
        role: 'Chad Motors · sales (very enthusiastic)',
        lines: [
          'Welcome to CHAD MOTORS! Three beauties on the floor tonight, every one an original — you won’t find these anywhere else in the kingdom.',
          'Have a look, read the cards, pick a favourite. Test drives come with the driving update — I’m not handing anyone keys until the roads are ready.',
          'When Chad Coins arrive you’ll be able to make one yours. In-game coins only — never real money.',
        ],
      },
    },
    looks: Object.fromEntries(
      CARS.map((c, i) => [
        c.id,
        {
          at: [[-4.6, 1.4], [0, 0.6], [4.6, 1.4]][i] as [number, number],
          r: 1.2,
          label: `Look at the ${c.name}`,
          speaker: c.name,
          role: c.tagline,
          lines: [
            [`The ${c.name}: hand-built in Chad City, gold-stitched seats, a horn that plays the first four notes of the PumpChad theme.`, `The ${c.name}: the purple paint shifts colour under the moon. Rex swears it purrs.`, `The ${c.name}: so orange it has its own gravity. The boot fits exactly one prize pumpkin.`][i],
            'Test drives arrive with the driving update. Ownership will use Chad Coins (in-game only).',
          ],
        },
      ]),
    ),
    build(K, S) {
      const M = K.M
      // three cars on lit podiums with info lecterns
      const spots: [number, number, number][] = [[-4.6, -1.8, 0.5], [0, -3.0, 0], [4.6, -1.8, -0.5]]
      CARS.forEach((c, i) => {
        const [x, z, ry] = spots[i]
        K.B.put(new THREE.CylinderGeometry(2.7, 2.8, 0.22, 40), M.stoneLight, x, 0.11, z)
        K.B.put(new THREE.TorusGeometry(2.72, 0.035, 6, 48).rotateX(Math.PI / 2), M.brass, x, 0.23, z)
        if (i === 0) {
          heroCar(K.scene, x, 0.22, z, ry, c.paint) // the Sketchfab showpiece (the podium is bare for the instant it loads)
        } else sportsCar(Frame.at(K.B, x, 0.22, z, ry), c, M.D) // noses toward the entrance
        // soft white display lighting from the front and both sides of each podium
        for (const [dx, dz] of [[0, 3.2], [-3.2, 0.4], [3.2, 0.4]] as const) K.light(x + dx, 3.4, z + dz, '#fff8ee', 4.2, 7)
        K.block(x - 2.75, x + 2.75, z - 2.75, z + 2.75)
        K.light(x, 4.6, z, '#fff4e0', 5, 7)
        const lx = x + (i === 2 ? -2.0 : 2.0)
        const L = Frame.at(K.B, lx, 0, z + 2.6, Math.PI)
        L.box(0.08, 1.0, 0.08, M.iron, 0, 0.5, 0)
        L.box(0.7, 0.05, 0.4, M.brass, 0, 1.0, 0)
        K.block(lx - 0.2, lx + 0.2, z + 2.4, z + 2.8)
      })
      // the sales desk + chairs, a lounge corner, big windows, posters, planters
      Fu.table(K, 5.6, 1.6, Math.PI / 2, { w: 1.8, d: 0.9, mat: M.woodDark })
      Fu.chair(K, 4.9, 1.2, -Math.PI / 2, { mat: M.woodDark, pad: '#5b2a86' })
      Fu.sofa(K, -6.2, 3.6, Math.PI / 2, '#5b2a86', 2.2)
      Fu.table(K, -5.0, 3.6, 0, { round: true, w: 0.8, h: 0.45, mat: M.brass })
      for (const u of [-5.5, 0, 5.5]) S.window('front', u, '#2a2230', 2.6, 3.2, 2.2)
      for (const [side, u, kind] of [['back', -5.5, 'castle'], ['back', 5.5, 'pumpkin'], ['left', -2, 'landscape']] as const) Fu.paintingOnWall(K, S.on(side, u), 1.2, 2.4, kind, 200 + u * 3)
      for (const [x, z] of [[-7.4, -5.4], [7.4, -5.4], [7.4, 5.2]] as const) Fu.plant(K, x, z, 1.3)
      K.light(0, 5.4, 2.5, '#fff0d8', 4, 10)
    },
  },
  GARAGE_INTERIOR,
]
