import * as THREE from 'three'
import type { Town } from './buildings'
import { boxUV, gableGeo } from './kit'
import { Frame, PANEL, framedBoard, panelTexture, type SignMats } from './signs'
import { SUMMIT } from './mountain'

/**
 * CHAD CASTLE — the original castle on the mountain's summit: a ring of curtain walls with eleven towers and a twin-towered
 * gatehouse (the road comes in over the moat bridge and under the gate), a bailey with a well and lamps, and — at the
 * back — the great keep with four turrets, a hall wing, a chapel and a sky bridge. The bailey is walkable; the keep's
 * doors are closed (a plaque says so), the Castle District being a later chapter.
 */
const N = 30 // curtain wall segments
const RING = 24
const TOWERS = [20, 65, 110, 155, 200, 245, 290, 335].map((d) => (d * Math.PI) / 180)

export const CASTLE = { keepZ: -9.5, doorX: 0, doorZ: -9.5 + 7.2 }

export function summitCastle(T: Town) {
  const P = T.P
  const D = T.disposables
  const SMt: SignMats = { frame: P.iron, metal: P.iron, gold: P.gold, stone: P.stoneLight }
  const Y = SUMMIT.y
  const cx = SUMMIT.x
  const cz = SUMMIT.z
  const wx = (x: number) => cx + x
  const wz = (z: number) => cz + z
  const F = Frame.at(T.batch, cx, Y, cz, 0) // local +z = south (toward the gate and the road)
  const roof = P.roofSlate
  const lit = P.windowLit

  /* ── curtain wall: 30 segments round the ring, a gap at the south for the gate; crenellated, with a wall-walk lip ── */
  for (let i = 0; i < N; i++) {
    const a = ((i + 0.5) / N) * Math.PI * 2
    const x = Math.sin(a) * RING
    const z = Math.cos(a) * RING
    if (z > 18 && Math.abs(x) < 6.6) continue // the gateway
    const len = (2 * Math.PI * RING) / N + 0.25
    const S = F.sub(x, 0, z, 0, a + Math.PI / 2, 0)
    S.put(boxUV(len, 7.2, 1.7, 2), P.stone, 0, 3.6, 0)
    S.put(boxUV(len, 0.3, 2.2, 1.4), P.stoneLight, 0, 7.35, 0)
    for (let k = -1; k <= 1; k++) S.put(boxUV(1.0, 0.9, 0.5, 1), P.stone, k * (len / 3), 8.0, 0.8)
    T.colliders.push({ kind: 'circle', x: wx(x), z: wz(z), r: 1.7, h: 7 })
  }

  /* ── eight round towers on the ring, each with a cone roof, a gold finial and glowing windows ── */
  const tower = (x: number, z: number, r: number, h: number, roofH: number, seed: number) => {
    F.put(new THREE.CylinderGeometry(r, r + 0.25, h, 16), P.stone, x, h / 2, z)
    F.put(new THREE.CylinderGeometry(r + 0.4, r + 0.4, 0.5, 16), P.stoneLight, x, h, z)
    F.put(new THREE.CylinderGeometry(r + 0.55, r + 0.35, 0.7, 16), P.stoneLight, x, h - 0.4, z)
    F.put(new THREE.ConeGeometry(r + 0.9, roofH, 16), roof, x, h + 0.25 + roofH / 2, z)
    F.put(new THREE.SphereGeometry(0.22, 8, 6), P.gold, x, h + roofH + 0.35, z)
    F.put(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 4), P.iron, x, h + roofH + 1.0, z)
    for (let k = 0; k < 3; k++) {
      const a = seed + (k / 3) * Math.PI * 2
      for (const wy of [h * 0.45, h * 0.78]) F.box(0.5, 1.0, 0.1, lit, x + Math.sin(a) * (r + 0.02), wy, z + Math.cos(a) * (r + 0.02), false)
    }
    T.colliders.push({ kind: 'circle', x: wx(x), z: wz(z), r: r + 0.4, h })
  }
  TOWERS.forEach((a, i) => tower(Math.sin(a) * RING, Math.cos(a) * RING, 2.6, 12 + (i % 3) * 2, 5.5 + (i % 2) * 1.5, a * 3))

  /* ── the gatehouse: two big drum towers either side of the gate, a bridge-room over it, a raised portcullis ── */
  for (const sx of [-1, 1]) tower(sx * 6.2, 23.2, 3.1, 15, 6.4, sx * 1.3)
  F.put(boxUV(9.6, 4.2, 3.4, 2), P.stone, 0, 11.3, 23.4) // the room over the arch
  F.put(boxUV(9.9, 0.5, 3.9, 1.4), P.stoneLight, 0, 13.6, 23.4)
  for (let k = -2; k <= 2; k++) F.put(boxUV(1.1, 1.0, 0.6, 1), P.stone, k * 2.1, 14.35, 24.9)
  const arch = new THREE.Shape()
  arch.moveTo(-3.0, 0)
  arch.lineTo(3.0, 0)
  arch.lineTo(3.0, 5.0)
  arch.quadraticCurveTo(3.0, 8.6, 0, 8.6)
  arch.quadraticCurveTo(-3.0, 8.6, -3.0, 5.0)
  arch.closePath()
  const dark = new THREE.MeshStandardMaterial({ color: '#17141c', roughness: 1 })
  D.push(dark)
  F.put(new THREE.ShapeGeometry(arch, 12), dark, 0, 0.02, 21.9, 0, 0, 0, false) // the shadowed passage
  for (let k = -5; k <= 5; k++) F.box(0.07, 3.6, 0.07, P.iron, k * 0.5, 6.7, 24.9) // raised portcullis teeth
  F.box(6.6, 0.2, 0.16, P.iron, 0, 8.8, 24.9)
  const crestMat = new THREE.MeshStandardMaterial({ map: panelTexture('CHAD CASTLE', 'the Order of the Golden Pumpkin', 3.2, PANEL.dark, D), roughness: 0.6 })
  D.push(crestMat)
  framedBoard(F.sub(0, 10.8, 25.2), 3.4, 0.9, crestMat, SMt, true)
  for (const sx of [-1, 1]) {
    // twin braziers flank the gate
    const bx = sx * 4.2
    F.put(new THREE.CylinderGeometry(0.16, 0.2, 1.1, 8), P.iron, bx, 0.55, 26.6)
    F.put(new THREE.CylinderGeometry(0.4, 0.22, 0.34, 10), P.iron, bx, 1.2, 26.6)
    F.put(new THREE.ConeGeometry(0.28, 0.7, 6), P.glowOrange, bx, 1.65, 26.6, 0, 0, 0, false)
    T.lights.push({ x: wx(bx), y: Y + 1.8, z: wz(26.6), color: '#ffa04a', intensity: 5, dist: 11, priority: 3 })
  }

  /* ── the keep: a tall block with four corner turrets, a stepped crown, big lit windows, closed doors, banners ── */
  const KZ = CASTLE.keepZ
  F.put(boxUV(14, 24, 13, 2.4), P.stone, 0, 12, KZ)
  F.put(boxUV(15, 0.6, 14, 1.4), P.stoneLight, 0, 24.3, KZ)
  F.put(boxUV(15, 0.5, 14, 1.4), P.stoneLight, 0, 12.2, KZ)
  for (let k = -3; k <= 3; k++) for (const sz of [-1, 1]) F.put(boxUV(1.2, 1.1, 0.6, 1), P.stone, k * 2.1, 25.1, KZ + sz * 6.6)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    tower(sx * 7.2, KZ + sz * 6.8, 1.9, 27, 8, sx + sz)
  }
  F.put(boxUV(5, 3, 5, 1.6), P.stone, 0, 26.2, KZ)
  F.put(gableGeo(5.4, 5.4, 4, 1.6), roof, 0, 27.7, KZ)
  F.put(new THREE.ConeGeometry(0.28, 3.6, 6), P.gold, 0, 33.8, KZ)
  const doors = new THREE.MeshStandardMaterial({ color: '#2a1d16', roughness: 0.8 })
  D.push(doors)
  F.put(boxUV(5.4, 7.2, 1.0, 1.6), P.stoneLight, CASTLE.doorX, 3.6, CASTLE.doorZ - 0.1) // the doorway surround
  F.box(4.2, 6.2, 0.4, doors, CASTLE.doorX, 3.1, CASTLE.doorZ + 0.45)
  for (const dy of [1.2, 3.1, 5.0]) F.box(4.3, 0.16, 0.12, P.iron, CASTLE.doorX, dy, CASTLE.doorZ + 0.7)
  F.box(0.2, 6.0, 0.14, P.iron, CASTLE.doorX, 3.1, CASTLE.doorZ + 0.72)
  F.put(new THREE.TorusGeometry(0.28, 0.05, 8, 14), P.gold, CASTLE.doorX - 0.7, 3.0, CASTLE.doorZ + 0.8)
  F.put(new THREE.TorusGeometry(0.28, 0.05, 8, 14), P.gold, CASTLE.doorX + 0.7, 3.0, CASTLE.doorZ + 0.8)
  for (let s = 0; s < 4; s++) F.put(boxUV(7 - s * 0.5, 0.22, 1.2, 1.4), P.stoneLight, 0, 0.11 + s * 0.22, CASTLE.doorZ + 1.5 + (3 - s) * 0.5)
  const closed = new THREE.MeshStandardMaterial({ map: panelTexture('DOORS CLOSED', 'the Castle District opens in a later chapter', 3.0, PANEL.dark, D), roughness: 0.6 })
  D.push(closed)
  framedBoard(F.sub(-4.4, 1.7, CASTLE.doorZ + 2.3, 0, 0.35, 0), 1.6, 0.8, closed, SMt, true)
  for (let row = 0; row < 3; row++) for (let k = -2; k <= 2; k++) {
    if (row === 0 && Math.abs(k) < 2) continue
    F.box(0.9, 1.7, 0.12, lit, k * 2.5, 10 + row * 5.3, KZ + 6.56, false)
    F.put(new THREE.BoxGeometry(1.3, 0.2, 0.3), P.stoneLight, k * 2.5, 11.0 + row * 5.3, KZ + 6.62)
  }
  for (const bx of [-3.4, 3.4]) {
    F.box(1.3, 6.2, 0.1, P.cloth, bx, 18.2, KZ + 6.58) // hanging banners
    F.box(1.3, 0.18, 0.14, P.gold, bx, 21.4, KZ + 6.6)
    F.put(new THREE.CircleGeometry(0.4, 12), P.pumpkin, bx, 18.6, KZ + 6.66, 0, 0, 0, false)
  }
  T.colliders.push({ kind: 'box', minX: wx(-7.2), maxX: wx(7.2), minZ: wz(KZ - 6.6), maxZ: wz(KZ + 6.9), h: 24 })
  T.lights.push({ x: wx(0), y: Y + 3.2, z: wz(CASTLE.doorZ + 2.4), color: '#ffc880', intensity: 5, dist: 12, priority: 3 })

  /* ── a great hall wing (east), a chapel (west) and the sky bridge from the keep to the east tower ── */
  F.put(boxUV(10, 9, 7, 2), P.stone, 14.5, 4.5, -2)
  F.put(gableGeo(10.6, 7.6, 5, 2), roof, 14.5, 9, -2)
  for (const wzz of [-5, -2, 1]) F.box(0.12, 2.6, 1.2, lit, 9.46, 5, wzz, false)
  T.colliders.push({ kind: 'box', minX: wx(9.4), maxX: wx(19.6), minZ: wz(-5.6), maxZ: wz(1.6), h: 9 })
  F.put(boxUV(7, 10, 7, 2), P.stone, -14.5, 5, -2)
  F.put(gableGeo(7.6, 7.6, 4, 2), roof, -14.5, 10, -2)
  F.put(new THREE.ConeGeometry(1.1, 5.5, 8), roof, -14.5, 16.6, -2)
  F.put(new THREE.SphereGeometry(0.2, 8, 6), P.gold, -14.5, 19.6, -2)
  F.box(0.12, 4.0, 1.4, lit, -10.96, 5.5, -2, false)
  T.colliders.push({ kind: 'box', minX: wx(-18.1), maxX: wx(-10.9), minZ: wz(-5.6), maxZ: wz(1.6), h: 10 })
  // the sky bridge: a stone arch with a parapet, from the keep's east turret to the hall's gable end
  F.put(boxUV(5.2, 0.6, 1.6, 1.6), P.stoneLight, 10.2, 17, -5.6)
  for (const sz of [-0.8, 0.8]) F.put(boxUV(5.2, 0.5, 0.2, 1), P.stoneLight, 10.2, 17.5, -5.6 + sz)
  F.put(new THREE.CylinderGeometry(0.8, 0.8, 1.4, 12, 1, true, 0, Math.PI).rotateZ(Math.PI / 2), P.stone, 10.2, 16.2, -5.6)

  /* ── the bailey: a well, flower beds, lamps, benches ── */
  F.put(new THREE.CylinderGeometry(1.1, 1.2, 0.9, 14), P.stone, 0, 0.45, 8)
  F.put(new THREE.CylinderGeometry(0.9, 0.9, 0.06, 14), P.glowTeal, 0, 0.88, 8, 0, 0, 0, false)
  for (const sx of [-1, 1]) F.box(0.12, 1.9, 0.12, P.woodLight, sx * 0.95, 1.5, 8)
  F.put(gableGeo(2.4, 1.6, 0.8, 1.2), roof, 0, 2.55, 8)
  T.colliders.push({ kind: 'circle', x: wx(0), z: wz(8), r: 1.35, h: 1 })
  for (const [lx, lz] of [[-9, 12], [9, 12], [-9, 2], [9, 2], [-4.5, 19], [4.5, 19]] as const) {
    F.put(new THREE.CylinderGeometry(0.06, 0.09, 2.7, 6), P.iron, lx, 1.35, lz)
    F.put(new THREE.BoxGeometry(0.24, 0.3, 0.24), P.glowOrange, lx, 2.85, lz, 0, 0, 0, false)
    F.put(new THREE.ConeGeometry(0.26, 0.2, 4).rotateY(Math.PI / 4), P.iron, lx, 3.08, lz)
    T.lights.push({ x: wx(lx), y: Y + 2.85, z: wz(lz), color: '#ffb060', intensity: 3.6, dist: 10, priority: 1 })
    T.colliders.push({ kind: 'circle', x: wx(lx), z: wz(lz), r: 0.22, h: 3 })
  }
  for (const sx of [-1, 1]) {
    F.put(boxUV(3.2, 0.5, 1.4, 1.4), P.stoneLight, sx * 5.5, 0.25, 4.5)
    F.put(new THREE.SphereGeometry(0.9, 10, 8).scale(1.2, 0.7, 0.8), P.foliageDark, sx * 5.5, 0.85, 4.5)
    T.colliders.push({ kind: 'box', minX: wx(sx * 5.5 - 1.7), maxX: wx(sx * 5.5 + 1.7), minZ: wz(3.8), maxZ: wz(5.2), h: 0.6 })
  }
  // the gate's ground: a paved apron through the passage into the bailey
  F.put(boxUV(7, 0.04, 14, 3), P.cobble, 0, 0.02, 18, 0, 0, 0, false)
}
