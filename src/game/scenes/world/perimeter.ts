import * as THREE from 'three'
import type { Town } from './buildings'
import { DISTRICTS, VALLEY_GATE, insideCity } from './city'
import { boxUV } from './kit'

/**
 * The city's open edges: walk every district outline, keep the stretches that face the cliff (the outward
 * neighbour isn't city), and line them with a stone balustrade — plinth, iron railing, a pier every few metres.
 * The north is closed by the old curtain wall and the citadel, so only district rectangles are walked.
 */
export function perimeter(T: Town, stone: THREE.Material, trim: THREE.Material, rail: THREE.Material) {
  const STEP = 0.5
  type Run = { a: THREE.Vector2; b: THREE.Vector2 }
  const runs: Run[] = []
  for (const r of Object.values(DISTRICTS)) {
    const edges: [number, number, number, number, number, number][] = [
      // x0, z0, x1, z1, outward normal
      [r.x0, r.z0, r.x1, r.z0, 0, -1],
      [r.x1, r.z0, r.x1, r.z1, 1, 0],
      [r.x1, r.z1, r.x0, r.z1, 0, 1],
      [r.x0, r.z1, r.x0, r.z0, -1, 0],
    ]
    for (const [ax, az, bx, bz, nx, nz] of edges) {
      const len = Math.hypot(bx - ax, bz - az)
      const n = Math.round(len / STEP)
      let cur: THREE.Vector2 | null = null
      let last: THREE.Vector2 | null = null
      for (let i = 0; i <= n; i++) {
        const t = i / n
        const x = ax + (bx - ax) * t
        const z = az + (bz - az) * t
        const open = !insideCity(x + nx * 0.6, z + nz * 0.6) && !insideCity(x - nx * 0.05 + nx * 0.6, z - nz * 0.05 + nz * 0.6)
        const gate = Math.abs(x - VALLEY_GATE.x) < 4.4 && z > VALLEY_GATE.z - 1
        const north = z < -5 // the curtain wall's end towers close these corners
        if (open && !gate && !north) {
          const p = new THREE.Vector2(x + nx * 0.25, z + nz * 0.25)
          if (!cur) cur = p
          last = p
        } else if (cur && last) {
          if (cur.distanceTo(last) > 0.4) runs.push({ a: cur, b: last })
          cur = last = null
        }
      }
      if (cur && last && cur.distanceTo(last) > 0.4) runs.push({ a: cur, b: last })
    }
  }
  for (const { a, b } of runs) {
    const len = a.distanceTo(b)
    const ang = Math.atan2(b.x - a.x, b.y - a.y)
    const mx = (a.x + b.x) / 2
    const mz = (a.y + b.y) / 2
    T.batch.put(boxUV(0.42, 0.42, len + 0.42, 1.4), stone, mx, 0.21, mz, ang)
    T.batch.put(boxUV(0.5, 0.08, len + 0.5, 1.4), trim, mx, 0.46, mz, ang)
    const g = new THREE.PlaneGeometry(len, 0.75)
    const u = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < u.count; i++) u.setX(i, (u.getX(i) * len) / 0.9)
    T.batch.put(g, rail, mx, 0.86, mz, ang + Math.PI / 2, 1, 1, 1, { cast: false })
    const piers = Math.max(1, Math.round(len / 4.5))
    for (let k = 0; k <= piers; k++) {
      const t = k / piers
      const x = a.x + (b.x - a.x) * t
      const z = a.y + (b.y - a.y) * t
      T.batch.put(boxUV(0.5, 1.3, 0.5, 1), stone, x, 0.65, z, ang)
      T.batch.put(boxUV(0.62, 0.1, 0.62, 1), trim, x, 1.35, z, ang)
    }
  }
  return runs.length
}
