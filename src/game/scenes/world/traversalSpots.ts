import type { Town } from './buildings'
import { boxUV } from './kit'
import type { Platform } from '../../parkour'

/**
 * TRAVERSAL SPOTS in the open village: a few honest, visible structures with flat tops you can mantle, catch, hang from, shimmy along and pull up onto, so ledge play is not
 * confined to the Parkour Yard. The data is the single source for both the drawing and the platform physics (World registers PLATFORMS from it); the world scan in
 * `scripts/ledge-scan.mjs` adds every OTHER collider whose top is verified flat (ledgeData.ts). Each is a stone wall with a capstone, a timber crate or a flat-roofed timber shed.
 *   Chad Rides: a crate stair (1.0 → 2.0 m) up to the shelter's flat roof (3.0 m).
 *   Heights Green: a retaining wall (2.1 m), a taller one (2.5 m) across a 4 m gap, and a garden shed (2.3 m), beside the boulevard.
 */
export type Spot = { id: string; kind: 'wall' | 'crate' | 'shed'; x0: number; x1: number; z0: number; z1: number; top: number }
export const TRAVERSAL_SPOTS: Spot[] = [
  { id: 'rides_crate_1', kind: 'crate', x0: 6.0, x1: 7.3, z0: 65.6, z1: 66.9, top: 1.0 },
  { id: 'rides_crate_2', kind: 'crate', x0: 7.3, x1: 8.6, z0: 65.4, z1: 67.2, top: 2.0 },
  { id: 'green_step', kind: 'crate', x0: -166.2, x1: -164.6, z0: 37.5, z1: 39.1, top: 1.1 },
  { id: 'green_wall_1', kind: 'wall', x0: -164.6, x1: -152, z0: 37.6, z1: 39.0, top: 2.1 },
  { id: 'green_wall_2', kind: 'wall', x0: -148, x1: -136, z0: 37.6, z1: 39.0, top: 2.5 },
  { id: 'green_shed', kind: 'shed', x0: -132, x1: -124, z0: 33, z1: 39, top: 2.3 },
]

export const spotPlatforms = (): Platform[] => TRAVERSAL_SPOTS.map((s) => ({ minX: s.x0, maxX: s.x1, minZ: s.z0, maxZ: s.z1, top: s.top, kind: 'block', climb: true, ledge: true }))

export function traversalSpots(T: Town) {
  const P = T.P
  for (const s of TRAVERSAL_SPOTS) {
    const w = s.x1 - s.x0
    const d = s.z1 - s.z0
    const cx = (s.x0 + s.x1) / 2
    const cz = (s.z0 + s.z1) / 2
    if (s.kind === 'wall') {
      T.batch.put(boxUV(w, s.top - 0.12, d, 1.4), P.stone, cx, (s.top - 0.12) / 2, cz)
      T.batch.put(boxUV(w + 0.14, 0.12, d + 0.14, 1.4), P.stoneLight, cx, s.top - 0.06, cz) // the capstone
    } else if (s.kind === 'crate') {
      T.batch.put(boxUV(w, s.top, d, 1), P.woodLight, cx, s.top / 2, cz)
      for (const y of [s.top * 0.33, s.top * 0.66]) T.batch.put(boxUV(w + 0.04, 0.07, d + 0.04, 1), P.timber, cx, y, cz) // slat bands
      for (const sx of [s.x0 + 0.05, s.x1 - 0.05]) for (const sz of [s.z0 + 0.05, s.z1 - 0.05]) T.batch.put(boxUV(0.1, s.top, 0.1, 1), P.timber, sx, s.top / 2, sz)
    } else {
      // a garden shed: timber walls, a flat roof slab with an overhang, a door and a window on the south face
      T.batch.put(boxUV(w, s.top - 0.18, d, 1.6), P.woodLight, cx, (s.top - 0.18) / 2, cz)
      T.batch.put(boxUV(w + 0.4, 0.18, d + 0.4, 1.4), P.timber, cx, s.top - 0.09, cz)
      T.batch.put(boxUV(1.0, 1.9, 0.08, 1), P.timber, cx - 1.6, 0.95, s.z1 + 0.03)
      T.batch.put(boxUV(1.1, 0.8, 0.08, 1), P.windowDark, cx + 1.4, 1.5, s.z1 + 0.03)
    }
  }
}
