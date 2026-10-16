import * as THREE from 'three'
import { Frame } from '../world/signs'
import { WORKSHOP } from '../world/workshop'
import { CARS, heroCar } from '../world/vehicles'
import * as Fu from './furniture'
import type { HouseSpec } from './houses'

/**
 * CHAD MOTORS SERVICE — the workshop's inside, entered by the RECEPTION door at the east end of the road face. A working garage: a car on a
 * two-post lift with its wheels off the ground, a second car waiting its turn, a workbench with a vice, a roll-away tool chest, tyre
 * stacks and racks, oil drums, an air compressor, a parts shelf, a reception desk with Dex the mechanic, strip lights and a pit
 * marked in the floor. Cars are not for sale here and there is nothing to drive yet (the notice says so honestly).
 */
const RECEPTION_X = WORKSHOP.x - 4.6 // the reception door sits 4.6 m west-of-centre in the building's local frame (local +x is world west)

export const GARAGE_INTERIOR: HouseSpec = {
  id: 'garage',
  name: 'Chad Motors Service',
  door: { x: RECEPTION_X, z: WORKSHOP.z, face: Math.PI, half: WORKSHOP.d / 2, out: 1.3 },
  room: { w: 13, d: 9, h: 5 },
  look: { wall: ['plaster', '#efe6d6', '#e0d4c0'], floor: { tiles: ['#5a5662', '#4c4856'] }, trim: '#c89a48', ceiling: '#f4ece0' },
  mood: 'bright',
  ambient: 1.1,
  keeper: {
    look: { body: 'm', outfit: 'peasant', cloth: '#2a3a5a', skin: -0.2, hair: 'buzzed', hairColor: '#2a1c12', hat: 'cap', hatColor: '#e8a21a', beard: true, apron: '#3a3a40' },
    at: [6.0, 2.0],
    yaw: -Math.PI / 2,
    talkAt: [4.2, 2.0],
    line: {
      label: 'Talk to Dex',
      speaker: 'Dex',
      role: 'Chad Motors Service · head mechanic',
      lines: [
        'Mind the lift! Ten tonnes of nothing-much above your head. Welcome to CHAD MOTORS SERVICE.',
        'That gold beauty up there is getting a full going-over. Brakes, wheels, a polish that costs more than my van.',
        'Booking a service and test drives come with the driving update. Right now I just get to look at them. And talk about them. A lot.',
      ],
    },
  },
  looks: {
    lift: {
      at: [-2.6, 1.9],
      r: 1.6,
      label: 'Look at the lift',
      speaker: 'Two-post lift',
      role: 'Chad Motors Service',
      lines: ['A two-post lift, arms under the four lift points, the Pumpkin Phantom a metre and a half off the floor with its wheels hanging free.', 'Dex checks the brakes by spinning each wheel by hand. He says it tells him everything.'],
    },
    bench: {
      at: [1.0, -3.2],
      r: 1.5,
      label: 'Look at the workbench',
      speaker: 'Workbench',
      role: 'Chad Motors Service',
      lines: ['A steel bench: a vice, a torque wrench, a tray of sockets arranged by size, and a mug that says WORLD’S OKAYEST MECHANIC.'],
    },
  },
  build(K, S) {
    const M = K.M
    const yellow = M.fab('#e8a21a', 0.5)
    const red = M.fab('#b02a2a', 0.5)
    const steel = M.fab('#5a5c64', 0.4)
    const rubber = M.fab('#141416', 0.92)
    // the floor: a yellow-edged pit and painted bay lines
    {
      const F = Frame.at(K.B, 0, 0, 0, 0)
      for (const [x, z, w, d] of [[-2.6, 0.9, 5.4, 0.08], [-2.6, -2.1, 5.4, 0.08], [3.4, -3.8, 4.2, 0.08], [3.4, 0.2, 4.2, 0.08]] as const) F.put(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), yellow, x, 0.012, z, 0, 0, 0, false)
      for (const [x, z, w, d] of [[-5.3, -0.6, 0.08, 3.0], [0.1, -0.6, 0.08, 3.0], [1.3, -1.8, 0.08, 4.0], [5.5, -1.8, 0.08, 4.0]] as const) F.put(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), yellow, x, 0.012, z, 0, 0, 0, false)
    }
    // ── the lift: two posts, four arms, the car raised 1.5 m on it ──
    {
      const cx = -2.6
      const cz = -0.6
      const F = Frame.at(K.B, cx, 0, cz, 0)
      for (const sz of [-1, 1]) {
        F.box(0.34, 3.4, 0.34, yellow, -0.1, 1.7, sz * 1.7)
        F.box(0.5, 0.06, 0.5, steel, -0.1, 0.03, sz * 1.7)
        F.box(3.8, 0.1, 0.14, steel, -0.1, 1.15, sz * 1.45) // the carriage arms reaching under the car
        F.box(0.3, 0.2, 0.3, steel, -0.1, 1.2, sz * 1.7)
        for (const sx of [-1.4, 1.2]) F.put(new THREE.CylinderGeometry(0.08, 0.1, 0.12, 10), rubber, sx, 1.25, sz * 1.45) // lift pads
      }
      F.box(3.9, 0.12, 0.2, steel, -0.1, 3.4, 0) // the overhead beam
      heroCar(K.scene, cx, 1.28, cz, Math.PI / 2) // the Sketchfab showpiece on the lift
      Fu.footprint(K, cx, cz, 4.8, 3.6, 0)
      K.light(cx, 4.5, cz, '#fff6e8', 6, 9)
    }
    // ── a second car waiting its turn (floor level) ──
    heroCar(K.scene, 3.3, 0, -1.5, -Math.PI / 2 + 0.25, CARS[1].paint, 'gt3')
    Fu.footprint(K, 3.3, -1.5, 4.6, 2.4, 0.25)
    K.light(3.3, 4.5, -1.5, '#fff0dc', 4, 8)
    // ── the back wall: workbench with a vice, a tool chest, a parts shelf, a pegboard ──
    {
      const bz = -3.9
      const B = Frame.at(K.B, 1.0, 0, bz, 0)
      B.box(2.8, 0.08, 0.72, M.woodDark, 0, 0.95, 0)
      B.box(2.7, 0.9, 0.62, steel, 0, 0.45, 0)
      B.box(0.18, 0.18, 0.22, steel, -1.0, 1.1, 0.0) // vice
      B.box(0.06, 0.04, 0.36, steel, -1.0, 1.15, 0.28)
      B.put(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 10), M.fab('#f2f2f2', 0.4), 0.5, 1.04, 0.1) // mug
      B.box(0.5, 0.04, 0.2, M.chrome, 0.1, 1.0, 0.0) // a tray of sockets
      B.box(2.8, 1.1, 0.04, M.fab('#6a5a48', 0.8), 0, 1.9, -0.34) // pegboard
      for (let k = 0; k < 8; k++) B.box(0.06, 0.4 + (k % 3) * 0.1, 0.04, M.chrome, -1.2 + k * 0.34, 1.9, -0.3) // hanging tools
      Fu.footprint(K, 1.0, bz, 2.9, 0.8, 0)
      const T = Frame.at(K.B, -1.8, 0, bz, 0)
      T.box(0.9, 1.2, 0.55, red, 0, 0.6, 0) // roll-away tool chest
      for (let k = 0; k < 4; k++) T.box(0.84, 0.02, 0.02, M.chrome, 0, 0.3 + k * 0.25, 0.28)
      T.box(0.9, 0.06, 0.58, steel, 0, 1.23, 0)
      Fu.footprint(K, -1.8, bz, 0.95, 0.6, 0)
      Fu.shopShelf(K, 4.4, bz + 0.2, 0, ['#e8a21a', '#b02a2a', '#2a5aa8', '#e8e0cc'], 71, 2.4) // oil, filters, spares
      Fu.shopShelf(K, 6.0, bz + 0.2, 0, ['#e8a21a', '#3a3a40', '#b02a2a'], 72, 1.0)
    }
    // ── west wall: tyres (stacked and racked), a compressor, drums ──
    {
      const W = Frame.at(K.B, -6.0, 0, 0, 0)
      for (let s = 0; s < 3; s++) for (let k = 0; k < 4; k++) W.put(new THREE.TorusGeometry(0.28, 0.12, 6, 12).rotateX(Math.PI / 2), rubber, 0, 0.12 + k * 0.24, -3.0 + s * 0.78)
      Fu.footprint(K, -6.0, -2.2, 0.8, 2.4, 0)
      for (let k = 0; k < 5; k++) W.put(new THREE.TorusGeometry(0.3, 0.12, 6, 12).rotateY(Math.PI / 2), rubber, 0.2, 0.34 + (k % 2) * 0.7, 1.2 + (k >> 1) * 0.5) // a rack of upright tyres
      W.box(0.12, 1.6, 1.6, steel, -0.35, 0.8, 1.6)
      Fu.footprint(K, -5.8, 1.6, 1.0, 1.7, 0)
      const C = Frame.at(K.B, -6.0, 0, 3.4, 0)
      C.put(new THREE.CylinderGeometry(0.22, 0.22, 0.8, 14).rotateZ(Math.PI / 2), yellow, 0, 0.55, 0)
      C.box(0.9, 0.08, 0.5, steel, 0, 0.18, 0)
      Fu.footprint(K, -6.0, 3.4, 1.0, 0.6, 0)
    }
    // oil drums + a cone cluster by the lift
    for (const [x, z, c] of [[5.9, -2.2, '#2a5aa8'], [5.4, -2.6, '#b02a2a'], [6.0, -1.5, '#e8a21a']] as const) {
      Frame.at(K.B, x, 0, z, 0).put(new THREE.CylinderGeometry(0.3, 0.3, 0.88, 16), M.fab(c, 0.5), 0, 0.44, 0)
      Fu.footprint(K, x, z, 0.62, 0.62, 0)
    }
    // ── reception desk (front-right), a waiting chair, and the door-side window ──
    Fu.shopCounter(K, 5.4, 2.0, Math.PI / 2, 2.6, '#2a2a30')
    Fu.chair(K, 2.2, 3.4, Math.PI / 2, { mat: M.iron, pad: '#e8a21a' })
    Fu.chair(K, 2.2, 4.0, Math.PI / 2, { mat: M.iron, pad: '#e8a21a' })
    S.window('front', -3.8, '#9aa8c0', 2.4, 2.4, 1.8)
    S.window('front', 3.0, '#9aa8c0', 2.4, 2.4, 1.8)
    S.window('back', 5.6, '#9aa8c0', 1.6, 1.6, 1.9)
    // strip lights along the ceiling
    for (const x of [-4, -1, 2, 5]) {
      Frame.at(K.B, x, 4.9, 0, 0).box(0.14, 0.05, 6.4, M.fab('#fffbe8', 0.3), 0, 0, 0, false)
      K.light(x, 4.5, 0, '#fff8ea', 6, 10)
    }
    K.light(0, 4.6, 3.0, '#fff4e4', 5, 12)
    K.light(0, 4.6, -3.2, '#fff4e4', 5, 12)
    Fu.plant(K, 6.1, 4.0, 0.9)
  },
}
