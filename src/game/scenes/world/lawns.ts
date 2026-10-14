import * as THREE from 'three'
import type { Town } from './buildings'
import { boxUV, rng } from './kit'
import { Frame, PANEL, panelTexture, postedBoard, type SignMats } from './signs'
import { parkBench, type BenchSpot, type Greenery } from './westside'

/** the pumpkin patch (south-west of the forecourt) — the prize pumpkin + the scarecrow anchors */
export const PATCH = { x0: -29.5, x1: -17.5, z0: 50, z1: 70, prize: { x: -21, z: 52.4 } }

/**
 * Filling the open lawns with purpose:
 *  - SW: the PUMPKIN PATCH — fenced soil rows of growing pumpkins, a scarecrow, a ludicrous prize pumpkin
 *  - SE: a picnic lawn — shade trees, two benches (one sittable), flowerbeds round a sundial
 *  - E : a small orchard north of Arcade Street with a bench under the trees
 */
export function lawns(T: Town, trim: THREE.Material, seats: BenchSpot[], green: Greenery) {
  const P = T.P
  const Dp = T.disposables
  const SM: SignMats = { frame: P.timber, metal: P.iron, gold: P.gold, stone: trim }
  const R = rng(5150)

  /* ═════════ PUMPKIN PATCH ═════════ */
  {
    const { x0, x1, z0, z1 } = PATCH
    // soil rows running north-south with grassy paths between
    for (let x = x0 + 1.2; x < x1 - 0.8; x += 2.4) {
      T.batch.put(new THREE.BoxGeometry(1.3, 0.12, z1 - z0 - 3).translate(0, 0.06, 0), P.soil, x, 0, (z0 + z1) / 2 + 0.6, 0, 1, 1, 1, { cast: false })
      // pumpkins at varied sizes, mostly plain, a few carved (the patch's jokers)
      for (let z = z0 + 3; z < z1 - 1.5; z += 1.25 + R() * 0.6) {
        if (Math.hypot(x - PATCH.prize.x, z - PATCH.prize.z) < 2.6) continue
        T.pumpkins!.add(x + (R() - 0.5) * 0.4, 0.12, z, { r: 0.14 + R() * 0.16, tint: R() < 0.12 ? 'green' : R() < 0.2 ? 'pale' : 'orange', face: R() < 0.08 ? Math.floor(R() * 4) : undefined, facing: Math.PI / 2 })
        // a curly vine leaf or two
        T.batch.put(new THREE.SphereGeometry(0.16, 6, 4).scale(1.4, 0.35, 1), P.foliage, x + 0.3, 0.13, z + 0.4, R() * 3, 1, 1, 1, { cast: false })
      }
    }
    // timber post-and-rail fence round the patch, with a gate gap facing the forecourt (east side)
    const fence = (ax: number, az: number, bx: number, bz: number) => {
      const len = Math.hypot(bx - ax, bz - az)
      const ang = Math.atan2(bx - ax, bz - az)
      const n = Math.max(1, Math.round(len / 1.6))
      for (let k = 0; k <= n; k++) T.batch.put(boxUV(0.12, 1.0, 0.12, 1), P.timber, ax + ((bx - ax) * k) / n, 0.5, az + ((bz - az) * k) / n)
      for (const y of [0.42, 0.82]) T.batch.put(boxUV(0.05, 0.1, len, 1), P.woodLight, (ax + bx) / 2, y, (az + bz) / 2, ang)
      T.colliders.push({ kind: 'box', minX: Math.min(ax, bx) - 0.12, maxX: Math.max(ax, bx) + 0.12, minZ: Math.min(az, bz) - 0.12, maxZ: Math.max(az, bz) + 0.12, h: 1 })
    }
    fence(x0, z0, x1, z0)
    fence(x0, z1, x1, z1)
    fence(x0, z0, x0, z1)
    fence(x1, z0, x1, z0 + 7)
    fence(x1, z0 + 10, x1, z1)
    // gate posts with a hanging sign
    for (const z of [z0 + 7, z0 + 10]) T.batch.put(boxUV(0.2, 2.4, 0.2, 1), P.timber, x1, 1.2, z)
    T.batch.put(boxUV(0.16, 0.16, 3.4, 1), P.timber, x1, 2.35, z0 + 8.5)
    const sign = new THREE.MeshStandardMaterial({ map: panelTexture('THE PUMPKIN PATCH', 'please do not poke the large one', 3, PANEL.green, Dp), roughness: 0.7 })
    Dp.push(sign)
    const sf = Frame.at(T.batch, x1 + 0.08, 1.85, z0 + 8.5, Math.PI / 2)
    sf.box(2.3, 0.72, 0.06, P.timber, 0, 0, 0)
    sf.put(new THREE.PlaneGeometry(2.2, 0.66), sign, 0, 0, 0.035, 0, 0, 0, false)
    sf.put(new THREE.PlaneGeometry(2.2, 0.66), sign, 0, 0, -0.035, 0, Math.PI, 0, false)
    for (const dz of [-0.9, 0.9]) T.batch.put(new THREE.CylinderGeometry(0.008, 0.008, 0.28, 4), P.iron, x1, 2.32 - 0.14 + 0.02, z0 + 8.5 + dz)
    // the scarecrow: post + cross arm, an old coat, straw cuffs, a carved pumpkin head with a hat
    {
      const sx = (x0 + x1) / 2 - 1.2
      const sz = z0 + 13
      T.batch.put(boxUV(0.12, 2.2, 0.12, 1), P.timber, sx, 1.1, sz)
      T.batch.put(boxUV(1.7, 0.1, 0.1, 1), P.timber, sx, 1.75, sz)
      T.batch.put(new THREE.CylinderGeometry(0.22, 0.34, 0.9, 8), P.roofRed, sx, 1.5, sz)
      for (const s of [-1, 1]) {
        T.batch.put(new THREE.CylinderGeometry(0.1, 0.13, 0.75, 6).rotateZ(Math.PI / 2), P.roofRed, sx + s * 0.5, 1.75, sz)
        T.batch.put(new THREE.ConeGeometry(0.1, 0.25, 6).rotateZ(-s * Math.PI / 2), P.woodLight, sx + s * 0.95, 1.75, sz)
      }
      T.pumpkins!.add(sx, 2.0, sz, { r: 0.26, face: 0, facing: Math.PI / 2 })
      T.batch.put(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 14), P.timber, sx, 2.48, sz)
      T.batch.put(new THREE.CylinderGeometry(0.17, 0.2, 0.28, 12), P.timber, sx, 2.62, sz)
      T.colliders.push({ kind: 'circle', x: sx, z: sz, r: 0.35, h: 2.5 })
    }
    // the prize pumpkin: absurdly large, on a pallet, with a rosette sign
    {
      const { x, z } = PATCH.prize
      T.batch.put(boxUV(2.4, 0.16, 2.4, 1), P.woodLight, x, 0.08, z)
      T.pumpkins!.add(x, 0.16, z, { r: 1.05, tint: 'deep', v: 2 })
      const rosette = new THREE.MeshStandardMaterial({ map: panelTexture('PRIZE PUMPKIN', 'weigh-in postponed · scale broke', 2.2, PANEL.cream, Dp), roughness: 0.7 })
      Dp.push(rosette)
      postedBoard(Frame.at(T.batch, x + 1.6, 0, z + 1.4, Math.PI / 2 + 0.5), 1.3, 0.6, 0.85, rosette, SM, true)
      T.colliders.push({ kind: 'circle', x, z, r: 1.4, h: 2 })
      T.colliders.push({ kind: 'circle', x: x + 1.6, z: z + 1.4, r: 0.75, h: 1.6 })
    }
    // (the patch's north-west corner tree made way for the Chadville Estates arch)
    green.trees.push([x0 - 1.5, z1 + 1.5], [x1 + 2.6, z1 - 1.5])
  }

  /* ═════════ SE picnic lawn: trees, flowerbeds round a sundial, benches ═════════ */
  {
    const cx = 23
    const cz = 54
    T.batch.put(new THREE.CylinderGeometry(0.4, 0.5, 0.95, 10), trim, cx, 0.475, cz)
    T.batch.put(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 20), P.gold, cx, 0.98, cz)
    T.batch.put(new THREE.BoxGeometry(0.04, 0.3, 0.5).rotateX(0.6), P.gold, cx, 1.12, cz)
    T.colliders.push({ kind: 'circle', x: cx, z: cz, r: 0.6, h: 1 })
    const ring = new THREE.RingGeometry(1.4, 3.0, 32, 1).rotateX(-Math.PI / 2)
    T.batch.put(ring, P.soil, cx, 0.02, cz, 0, 1, 1, 1, { cast: false })
    const q = new THREE.PlaneGeometry(0.42, 0.42).translate(0, 0.21, 0)
    for (let k = 0; k < 70; k++) {
      const a = R() * Math.PI * 2
      const rr = 1.6 + R() * 1.25
      const fx = cx + Math.cos(a) * rr
      const fz = cz + Math.sin(a) * rr
      T.batch.put(q, P.flowers, fx, 0.03, fz, R() * 3, 1, 1, 1, { cast: false })
      T.batch.put(q.clone().rotateY(Math.PI / 2), P.flowers, fx, 0.03, fz, R() * 3, 1, 1, 1, { cast: false })
    }
    parkBench(T, cx - 4.4, cz + 0.2, Math.PI / 2, 'Sit on the lawn', seats)
    parkBench(T, cx + 4.4, cz - 0.2, -Math.PI / 2, 'Sit on the lawn', [])
    green.trees.push([cx - 5, cz - 5.5], [cx + 5.5, cz - 5], [cx - 5.5, cz + 5.5], [cx + 5, cz + 6], [29.5, 47.5], [17.5, 47.6])
    green.bushes.push([cx - 3.3, cz - 3.4], [cx + 3.4, cz + 3.3])
  }

  /* ═════════ E: an orchard north of Arcade Street ═════════ */
  {
    for (let x = 33; x <= 55; x += 5.5) for (const z of [-3, 3.5]) green.trees.push([x + (R() - 0.5) * 0.8, z + (R() - 0.5) * 0.8])
    parkBench(T, 44, 0.3, Math.PI, 'Sit in the orchard', seats)
    green.bushes.push([31.5, 7.8], [56.5, 7.8], [56.5, -4.5])
  }
}
