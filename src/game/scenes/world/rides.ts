import * as THREE from 'three'
import { isNight } from './daylight'
import type { Town } from './buildings'
import { RIDES, VALLEY_GATE } from './city'
import { Frame, PANEL, channelLetters, panelTexture, postedBoard, type SignMats } from './signs'
import { eBike, motoMats, streetBike } from './motorbikes'

/**
 * CHAD RIDES teaser by the valley gate: a rental shelter with a dimensional sign, three parked motorbikes
 * (street bikes with engines, tanks and exhausts; a Sur-Ron-style electric dirt bike - see motorbikes.ts), a COMING SOON notice and a
 * paved path that runs to the closed gate. Inspect only — no riding yet.
 */


export function chadRides(T: Town, trim: THREE.Material) {
  const P = T.P
  const Dp = T.disposables
  const SMt: SignMats = { frame: P.iron, metal: P.iron, gold: P.gold, stone: trim }
  const { x, z } = RIDES
  const dark = new THREE.MeshStandardMaterial({ color: '#26252b', metalness: 0.7, roughness: 0.4 })
  const tyre = new THREE.MeshStandardMaterial({ color: '#141316', roughness: 0.85 })
  const seat = new THREE.MeshStandardMaterial({ color: '#1e1b1f', roughness: 0.6 })
  const paints = [new THREE.MeshStandardMaterial({ color: '#ff7a1a', metalness: 0.4, roughness: 0.35 }), new THREE.MeshStandardMaterial({ color: '#6b3fc8', metalness: 0.4, roughness: 0.35 }), new THREE.MeshStandardMaterial({ color: '#e9e3d6', metalness: 0.3, roughness: 0.4 })]
  const letters = new THREE.MeshStandardMaterial({ color: '#ffb24a', metalness: 0.3, roughness: 0.45, ...(isNight() ? { emissive: '#ffa040', emissiveIntensity: 1.7 } : {}) })
  Dp.push(dark, tyre, seat, letters, ...paints)
  const MM = motoMats(Dp)

  // paved pad + path to the valley gate
  const pad = (x0: number, x1: number, z0: number, z1: number) => {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2)
    const u = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < u.count; i++) u.setXY(i, (u.getX(i) * (x1 - x0)) / 3, (u.getY(i) * (z1 - z0)) / 3)
    T.batch.put(g, P.cobble, (x0 + x1) / 2, 0.026, (z0 + z1) / 2, 0, 1, 1, 1, { cast: false })
  }
  pad(x - 4.5, x + 4.5, z - 3, z + 3.2)
  pad(3.2, x - 4.5, VALLEY_GATE.z - 3.2, VALLEY_GATE.z - 1.2)
  // shelter: four dark posts, sloped canopy, fascia with CHAD RIDES letters facing the forecourt (north-west)
  const S = Frame.at(T.batch, x, 0, z, Math.PI) // front of the shelter faces −z (toward the gateway)
  for (const [sx, sz] of [[-3.2, -1.3], [3.2, -1.3], [-3.2, 1.3], [3.2, 1.3]]) {
    S.box(0.14, sz < 0 ? 2.9 : 2.6, 0.14, dark, sx, sz < 0 ? 1.45 : 1.3, sz)
    S.box(0.36, 0.12, 0.36, trim, sx, 0.06, sz)
  }
  const roof = S.sub(0, 2.85, 0, 0.1, 0, 0)
  roof.box(7.0, 0.1, 3.2, dark, 0, 0, 0)
  roof.box(7.1, 0.5, 0.1, dark, 0, -0.18, 1.6) // fascia (front)
  roof.box(7.1, 0.06, 0.12, P.gold, 0, -0.42, 1.62)
  const fascia = S.sub(0, 2.5, 1.68 + 0.02, 0.1, 0, 0)
  channelLetters(fascia, 'CHAD RIDES', 0.36, 0.06, letters)
  // back panel with a painted route map
  S.box(6.4, 1.6, 0.08, dark, 0, 1.5, -1.3)
  const back = new THREE.MeshStandardMaterial({ map: panelTexture('RIDE THE VALLEY', 'trails open with Chad Rides · coming soon', 4, PANEL.purple, Dp), roughness: 0.7 })
  Dp.push(back)
  S.put(new THREE.PlaneGeometry(6.2, 1.5), back, 0, 1.5, -1.25, 0, 0, 0, false)
  // three parked bays, each with a painted line: a street bike, an electric dirt bike, a street bike
  const bays = [[streetBike, paints[0]], [eBike, paints[1]], [streetBike, paints[2]]] as const
  bays.forEach(([make, paint], i) => {
    const bxx = -2.1 + i * 1.4
    S.box(0.05, 0.01, 1.7, P.gold, bxx + 0.55, 0.03, 0.2, false)
    make(S.sub(bxx, 0, 0.35, 0, -Math.PI / 2, 0), paint, MM)
  })
  // a warm light under the canopy so the bikes read at night
  for (const lx of [-1.8, 1.8]) {
    const lp = S.world(lx, 2.6, 0.5)
    T.lights.push({ x: lp.x, y: lp.y, z: lp.z, color: '#ffd9a8', intensity: 3.2, dist: 7, priority: 2 })
  }
  T.colliders.push({ kind: 'box', minX: x - 3.4, maxX: x + 3.4, minZ: z - 1.5, maxZ: z + 1.5, h: 3 })
  // COMING SOON notice on posts, in front of the shelter
  const soon = new THREE.MeshStandardMaterial({ map: panelTexture('COMING SOON', 'bikes in a future update', 1.7, PANEL.dark, Dp), roughness: 0.7 })
  Dp.push(soon)
  postedBoard(Frame.at(T.batch, x - 5.2, 0, z - 1.6, Math.PI + 0.5), 1.2, 0.7, 1.2, soon, SMt, true)
  T.colliders.push({ kind: 'circle', x: x - 5.2, z: z - 1.6, r: 0.8, h: 1.8 })
  // a spare bike leaning on the wall by the gate (the valley trail starts here)
  eBike(Frame.at(T.batch, VALLEY_GATE.x + 5.6, 0, VALLEY_GATE.z - 1.3, Math.PI), paints[1], MM)
}
