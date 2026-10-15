import * as THREE from 'three'
import type { Town } from './buildings'
import { COURSES, PLATFORMS, SECRET, YARD, YARD_ENTRANCE, YARD_WALLS, type Platform } from '../../parkour'
import { boxUV } from './kit'
import { ornateSign } from './ornament'
import { Frame } from './signs'

/**
 * The CHAD PARKOUR YARD: concrete yard, brick enclosure with an arched entrance, the vault walls, beam, blocks, crate stair and container roofs
 * from parkour.ts, safety-mat pits, glowing start pads / checkpoint flags / finish plates, and the Golden Pumpkin in the hidden room.
 * Everything static goes through the batch (a few shared materials); only the pumpkin is a live mesh (it spins and can be taken).
 */
export function parkourYard(T: Town) {
  const P = T.P
  const std = (o: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.05, ...o })
    T.disposables.push(m)
    return m
  }
  const paint = new Map<string, THREE.MeshStandardMaterial>()
  const colour = (c: string) => {
    let m = paint.get(c)
    if (!m) paint.set(c, (m = std({ color: c, roughness: 0.7 })))
    return m
  }
  const mat = std({ color: '#2b3a5a', roughness: 0.95 }) // safety mats over the pits
  const hazard = std({ color: '#f2c230', roughness: 0.6, emissive: '#3a2a00' })
  const dark = std({ color: '#26242c', roughness: 0.9 })

  // the yard floor
  {
    const w = YARD.x1 - YARD.x0
    const d = 25.6 - -19.2
    const g = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2)
    const u = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < u.count; i++) u.setXY(i, (u.getX(i) * w) / 4, (u.getY(i) * d) / 4)
    T.batch.put(g, P.plaza, (YARD.x0 + YARD.x1) / 2, 0.02, (25.6 + -19.2) / 2, 0, 1, 1, 1, { cast: false })
  }

  // enclosure: brick walls with a stone cap (tall: never climbable, always solid)
  for (const r of YARD_WALLS) {
    const w = r.x1 - r.x0
    const d = r.z1 - r.z0
    const H = r.x1 - r.x0 < 1 && r.z1 - r.z0 > 6 ? 2.6 : 3
    T.batch.put(boxUV(w, H, d, 2.5), P.stone, (r.x0 + r.x1) / 2, H / 2, (r.z0 + r.z1) / 2)
    T.batch.put(boxUV(w + 0.16, 0.16, d + 0.16, 1), P.stoneLight, (r.x0 + r.x1) / 2, H + 0.08, (r.z0 + r.z1) / 2)
    T.colliders.push({ kind: 'box', minX: r.x0, maxX: r.x1, minZ: r.z0, maxZ: r.z1, h: H })
  }

  // platforms
  for (const p of PLATFORMS) {
    const w = p.maxX - p.minX
    const d = p.maxZ - p.minZ
    const y0 = p.bottom ?? 0
    const h = p.top - y0
    const cx = (p.minX + p.maxX) / 2
    const cz = (p.minZ + p.maxZ) / 2
    const body = p.kind === 'beam' ? P.woodLight : p.kind === 'slab' ? colour(p.color ?? '#3a7a5a') : colour(p.color ?? '#7a8696')
    T.batch.put(boxUV(w, h, d, 2), body, cx, y0 + h / 2, cz)
    if (p.kind === 'roof' || p.kind === 'slab' || p.kind === 'block' || p.kind === 'step' || p.kind === 'crate') {
      // a light top plate + hazard stripes along the long edges (so the edge reads from a run-up)
      T.batch.put(boxUV(w + 0.06, 0.08, d + 0.06, 1), P.stoneLight, cx, p.top + 0.04 - 0.02, cz, 0, 1, 1, 1, { cast: false })
      const longX = w >= d
      for (const s of [-1, 1]) T.batch.put(new THREE.BoxGeometry(longX ? w : 0.14, 0.02, longX ? 0.14 : d), hazard, longX ? cx : cx + s * (w / 2 - 0.1), p.top + 0.09, longX ? cz + s * (d / 2 - 0.1) : cz, 0, 1, 1, 1, { cast: false })
    }
    if (p.kind === 'wall' && p.vault) {
      // the vault walls: a padded top with a stripe so they read as "go over"
      T.batch.put(boxUV(w, 0.12, d + 0.14, 1), hazard, cx, p.top + 0.06, cz, 0, 1, 1, 1, { cast: false })
    }
    if (p.kind === 'crate' || p.kind === 'roof') {
      // container ribs
      const n = Math.max(2, Math.floor((p.maxX - p.minX) / 0.9))
      for (let i = 1; i < n; i++) T.batch.put(new THREE.BoxGeometry(0.06, h - 0.2, d + 0.08), dark, p.minX + (i * w) / n, y0 + h / 2, cz, 0, 1, 1, 1, { cast: false })
    }
  }

  // pits: safety mats across the fall zones
  for (const c of Object.values(COURSES)) {
    for (const r of c.pits) {
      const w = r.x1 - r.x0
      const d = r.z1 - r.z0
      T.batch.put(new THREE.BoxGeometry(w, 0.06, d), mat, (r.x0 + r.x1) / 2, 0.05, (r.z0 + r.z1) / 2, 0, 1, 1, 1, { cast: false })
    }
  }

  // start pads, checkpoint flags, finish plates
  const disc = (r: number, m: THREE.Material, x: number, y: number, z: number) => T.batch.put(new THREE.CylinderGeometry(r, r, 0.05, 24), m, x, y + 0.03, z, 0, 1, 1, 1, { cast: false })
  const flag = (x: number, y: number, z: number, m: THREE.Material) => {
    T.batch.put(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 8), P.iron, x, y + 1.1, z)
    T.batch.put(new THREE.BoxGeometry(0.7, 0.45, 0.04), m, x + 0.38, y + 1.9, z, 0, 1, 1, 1, { cast: false })
  }
  for (const c of Object.values(COURSES)) {
    disc(c.start.r, P.glowTeal, c.start.x, c.start.y, c.start.z)
    for (const k of c.checkpoints) flag(k.x + 1.2, k.y, k.z, P.glowTeal)
    disc(c.finish.r, P.glowGold, c.finish.x, c.finish.y, c.finish.z)
    flag(c.finish.x + 1.8, c.finish.y, c.finish.z, P.glowGold)
  }

  // the entrance arch + sign, and a board at each start pad
  {
    const { x, z } = YARD_ENTRANCE
    for (const sx of [-6.2, 6.2]) {
      T.batch.put(boxUV(0.9, 3.4, 1.1, 1.2), P.stone, x + sx, 1.7, z + 0.6)
      T.batch.put(boxUV(1.05, 0.14, 1.25, 1), P.stoneLight, x + sx, 3.47, z + 0.6)
    }
    T.batch.put(boxUV(13.4, 0.5, 0.9, 1), P.stone, x, 3.8, z + 0.6)
    ornateSign(T, Frame.at(T.batch, x, 3.8, z + 1.08, 0), 'CHAD PARKOUR YARD', { h: 0.5, crest: 'pumpkin' })
    ornateSign(T, Frame.at(T.batch, x, 3.8, z + 0.12, Math.PI), 'CHAD PARKOUR YARD', { h: 0.5, crest: 'pumpkin' })
  }
  const board = (text: string, x: number, z: number, ry: number) => {
    const F = Frame.at(T.batch, x, 1.55, z, ry)
    for (const px of [-0.9, 0.9]) F.box(0.1, 1.5, 0.1, P.bark, px, -0.75, -0.05)
    ornateSign(T, F, text, { h: 0.46, crest: null })
    for (const px of [-0.9, 0.9]) T.colliders.push({ kind: 'circle', x: x + Math.cos(ry) * px, z: z - Math.sin(ry) * px, r: 0.12, h: 1.5 })
  }
  board('ROOKIE RUN · START', COURSES.rookie.start.x + 3.2, COURSES.rookie.start.z, 0)
  board('ROOFTOP RUN · HARD', -230.4, 6.5, Math.PI / 2)

  // the hidden room's Golden Pumpkin
  const pumpkinMat = new THREE.MeshStandardMaterial({ color: '#ffcc33', emissive: '#ff9a10', emissiveIntensity: 1.6, roughness: 0.35, metalness: 0.5 })
  const geo = new THREE.SphereGeometry(0.34, 16, 12)
  geo.scale(1.1, 0.9, 1.1)
  const stemGeo = new THREE.CylinderGeometry(0.05, 0.07, 0.2, 6)
  T.disposables.push(pumpkinMat, geo, stemGeo)
  const secret = new THREE.Group()
  secret.add(new THREE.Mesh(geo, pumpkinMat))
  const stem = new THREE.Mesh(stemGeo, pumpkinMat)
  stem.position.y = 0.34
  secret.add(stem)
  secret.position.set(SECRET.x, 0.95, SECRET.z)
  T.scene.add(secret)
  T.batch.put(boxUV(0.9, 0.55, 0.9, 1), P.stone, SECRET.x, 0.275, SECRET.z)
  T.lights.push({ x: SECRET.x, y: 1.6, z: SECRET.z, color: '#ffb040', intensity: 1.4, dist: 7, priority: 1 })
  T.dynamic.push({
    update(t: number) {
      secret.rotation.y = t * 1.6
      secret.position.y = 0.95 + Math.sin(t * 2) * 0.06
    },
  })
  return {
    secret,
    setSecretTaken(taken: boolean) {
      secret.visible = !taken
    },
  }
}

export type ParkourBuild = ReturnType<typeof parkourYard>
export const isSolidPlatform = (p: Platform) => p.kind === 'wall' && !p.vault
