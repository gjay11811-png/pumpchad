import * as THREE from 'three'
import type { Town } from './buildings'
import { Frame, PANEL, panelTexture, postedBoard, type SignMats } from './signs'

/**
 * Street details that make the districts read as one city:
 *  - district markers: short posted name plates at street entrances (both sides painted)
 *  - litter bins beside benches (dark metal, orange band, lid)
 *  - hanging flower baskets on the forecourt + Arcade Street lamps
 */
export function streetDetails(T: Town, trim: THREE.Material) {
  const P = T.P
  const Dp = T.disposables
  const SM: SignMats = { frame: P.iron, metal: P.iron, gold: P.gold, stone: trim }

  // ── district markers ──
  const markers: [string, string, number, number, number][] = [
    ['ARCADE STREET', 'shops · Pump Arcade', 28.4, 14.4, -Math.PI / 2],
    ['CANAL PROMENADE', 'bridges · benches', -13.6, 34.3, Math.PI],
    ['MARKET ROW', 'stalls · social corner', -10.9, 0.2, Math.PI / 2],
    ['CITADEL FORECOURT', 'Chad Citadel', 4.4, -11.0, 0],
    ['ARRIVAL FORECOURT', 'gateway · Chad Rides', -8.2, 46.4, Math.PI],
  ]
  for (const [name, sub, x, z, ry] of markers) {
    const face = new THREE.MeshStandardMaterial({ map: panelTexture(name, sub, 2.6, PANEL.dark, Dp), roughness: 0.7 })
    Dp.push(face)
    postedBoard(Frame.at(T.batch, x, 0, z, ry), 1.5, 0.58, 1.75, face, SM, true)
    T.colliders.push({ kind: 'circle', x, z, r: 0.95, h: 2.4 })
  }

  // ── litter bins ──
  const bins: [number, number][] = [[-11.1, 57.0], [11.1, 57.0], [29.8, 22.9], [-38.6, 4.0], [28.6, 52.4], [-48.4, 39.8], [7.6, -7.8], [-30.4, 12.2]]
  const body = new THREE.CylinderGeometry(0.26, 0.23, 0.82, 14)
  const lid = new THREE.CylinderGeometry(0.29, 0.29, 0.07, 14)
  const band = new THREE.CylinderGeometry(0.265, 0.265, 0.07, 14)
  for (const [x, z] of bins) {
    T.batch.put(body, P.iron, x, 0.41, z)
    T.batch.put(lid, P.iron, x, 0.86, z)
    T.batch.put(band, P.glowOrange, x, 0.62, z, 0, 1, 1, 1, { cast: false })
    T.colliders.push({ kind: 'circle', x, z, r: 0.33, h: 0.9 })
  }

  // ── hanging baskets on lamp posts (bracket on the post's far side from the lantern) ──
  const baskets: [number, number][] = [[-4.4, 48.5], [4.4, 48.5], [-4.4, 56.5], [4.4, 56.5], [14, 15.6], [22, 15.6], [14, 22.4], [22, 22.4]]
  const bowl = new THREE.SphereGeometry(0.24, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)
  const fl = new THREE.PlaneGeometry(0.34, 0.3).translate(0, 0.15, 0)
  for (const [x, z] of baskets) {
    const bx = x - 0.38
    T.batch.put(new THREE.BoxGeometry(0.42, 0.04, 0.04), P.iron, x - 0.2, 2.62, z)
    T.batch.put(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 4), P.iron, bx, 2.46, z)
    T.batch.put(bowl, P.woodLight, bx, 2.3, z)
    T.batch.put(new THREE.SphereGeometry(0.23, 10, 6).scale(1, 0.45, 1), P.foliage, bx, 2.31, z)
    for (let k = 0; k < 3; k++) {
      T.batch.put(fl, P.flowers, bx, 2.28, z, k * 1.05, 1, 1, 1, { cast: false })
    }
  }
}
