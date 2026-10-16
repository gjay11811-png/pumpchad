import * as THREE from 'three'
import { StaticBatch, boxUV } from '../scenes/world/kit'
import type { DMats } from './mats'
import type { Quality } from '../save'

/** what every district module builds with */
export type Ctx = {
  B: StaticBatch
  M: DMats
  scene: THREE.Scene
  D: (THREE.Material | THREE.Texture | THREE.BufferGeometry)[]
  q: Quality
  /** a world-axis collider (x0..x1, z0..z1) */
  block(x0: number, x1: number, z0: number, z1: number): void
  /** things that need a real GLB (trees): collected here and instanced once the file arrives */
  trees: TreeSpot[]
  /** ornamental shrubs (planters, hedges), planted by the foliage generator after the build */
  bushes: { x: number; y: number; z: number; s: number }[]
}
export type TreeSpot = { kind: 'jacaranda' | 'island'; x: number; z: number; s: number; yaw: number }

/** an axis-aligned slab from bounds, UVs in metres (`tile` = metres per texture repeat) */
export function slab(c: Ctx, mat: THREE.Material, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, tile = 2, cast = true) {
  const g = boxUV(x1 - x0, y1 - y0, z1 - z0, tile)
  c.B.put(g, mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, 0, 1, 1, 1, { cast })
}
/** a flat horizontal plane (UV in metres) */
export function floor(c: Ctx, mat: THREE.Material, x0: number, x1: number, z0: number, z1: number, y: number, tile = 3, rotUV = false) {
  const w = x1 - x0
  const d = z1 - z0
  const g = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2)
  const uv = g.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) {
    const u = (uv.getX(i) * (rotUV ? d : w)) / tile
    const v = (uv.getY(i) * (rotUV ? w : d)) / tile
    uv.setXY(i, u, v)
  }
  c.B.put(g, mat, (x0 + x1) / 2, y, (z0 + z1) / 2, 0, 1, 1, 1, { cast: false })
}
/** a vertical quad facing +x / −x / +z / −z (UV in metres) */
export function wall(c: Ctx, mat: THREE.Material, face: 'e' | 'w' | 'n' | 's', a0: number, a1: number, y0: number, y1: number, at: number, tile = 3, cast = false) {
  const w = a1 - a0
  const h = y1 - y0
  const g = new THREE.PlaneGeometry(w, h)
  const uv = g.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * h) / tile)
  const ry = face === 'e' ? Math.PI / 2 : face === 'w' ? -Math.PI / 2 : face === 's' ? 0 : Math.PI
  // 'e' faces +x (a building's east face), 's' faces +z, 'n' faces −z
  if (face === 'e' || face === 'w') c.B.put(g, mat, at, (y0 + y1) / 2, (a0 + a1) / 2, ry, 1, 1, 1, { cast })
  else c.B.put(g, mat, (a0 + a1) / 2, (y0 + y1) / 2, at, ry, 1, 1, 1, { cast })
}
export const cyl = (c: Ctx, mat: THREE.Material, x: number, y: number, z: number, rTop: number, rBot: number, h: number, seg = 14) => c.B.put(new THREE.CylinderGeometry(rTop, rBot, h, seg), mat, x, y + h / 2, z)
export const box = (c: Ctx, mat: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, ry = 0, cast = true) => c.B.put(new THREE.BoxGeometry(w, h, d), mat, x, y + h / 2, z, ry, 1, 1, 1, { cast })

/** seeded random so the district is identical every visit */
export function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
