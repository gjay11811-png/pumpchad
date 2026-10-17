import * as THREE from 'three'
import type { Town } from './buildings'
import { COURSES, LANE, PLATFORMS, SECRET, YARD, YARD_ENTRANCE, YARD_WALLS, type Platform } from '../../parkour'
import { fence } from './props'
import { fingerpost } from './wayfinding'
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
  const brickMats = new Map<string, THREE.MeshStandardMaterial>()
  const brick = (c: string) => {
    let m = brickMats.get(c)
    if (!m) brickMats.set(c, (m = std({ map: P.stone.map, color: c, roughness: 0.9 })))
    return m
  }
  const hazard = std({ color: '#f2c230', roughness: 0.6, emissive: '#3a2a00' })
  const dark = std({ color: '#26242c', roughness: 0.9 })
  const edgeLine = std({ color: '#efe9d8', roughness: 0.6 }) // a thin painted edge line: the lip reads from a run-up without a glowing stripe
  const steelDark = std({ color: '#2d3036', roughness: 0.55, metalness: 0.55 })
  const concrete = std({ map: P.stoneLight.map, color: '#a9a9a2', roughness: 0.95 })
  const containerMats = new Map<string, THREE.MeshStandardMaterial>()
  const container = (c: string) => {
    let m = containerMats.get(c)
    if (!m) containerMats.set(c, (m = std({ color: c, roughness: 0.55, metalness: 0.45 })))
    return m
  }

  // the yard floor
  {
    const w = YARD.x1 - YARD.x0
    const d = 25.6 - -19.2
    const g = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2)
    const u = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < u.count; i++) u.setXY(i, (u.getX(i) * w) / 4, (u.getY(i) * d) / 4)
    T.batch.put(g, P.stoneLight, (YARD.x0 + YARD.x1) / 2, 0.02, (25.6 + -19.2) / 2, 0, 1, 1, 1, { cast: false })
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
    if (p.kind === 'building') {
      // a small brick building: tinted brick walls, a pale coping on the top edge (the ledge you hang from), dark and warm windows, a door under an awning,
      // a gutter line below the coping and a plinth — all four faces carry something, so no side is a blank wall
      const wall = brick(p.color ?? '#8a5a44')
      T.batch.put(boxUV(w, h, d, 2.2), wall, cx, y0 + h / 2, cz)
      T.batch.put(boxUV(w + 0.2, 0.3, d + 0.2, 1.4), P.stone, cx, 0.15, cz)
      T.batch.put(boxUV(w + 0.34, 0.14, d + 0.34, 1), P.stoneLight, cx, p.top - 0.07, cz) // the coping: a light lip all round
      T.batch.put(boxUV(w + 0.1, 0.05, d + 0.1, 1), dark, cx, p.top - 0.25, cz, 0, 1, 1, 1, { cast: false }) // gutter shadow line
      T.batch.put(boxUV(w - 0.2, 0.5, d - 0.2, 1), P.stoneLight, cx, p.top + 0.25, cz, 0, 1, 1, 1, { cast: false }) // the roof's low upstand (stands inside the ledge)
      const glassDark = std({ color: '#0e1220', roughness: 0.15, metalness: 0.5 })
      const faces: [number, number, number, number][] = [
        [cx, p.maxZ + 0.02, 0, d], // south, facing +z
        [cx, p.minZ - 0.02, Math.PI, d], // north
        [p.maxX + 0.02, cz, Math.PI / 2, w], // east
        [p.minX - 0.02, cz, -Math.PI / 2, w], // west
      ]
      faces.forEach(([fx, fz, ry, len], fi) => {
        const along = fi < 2 ? w : d
        const n = Math.max(1, Math.floor(along / 2.6))
        for (let k = 0; k < n; k++) {
          const t = -along / 2 + (along / n) * (k + 0.5)
          const wx = fi < 2 ? fx + t : fx
          const wz = fi < 2 ? fz : fz + t
          if (fi === 0 && k === Math.floor(n / 2)) {
            // the door
            T.batch.put(new THREE.PlaneGeometry(1.0, 1.9), P.timber, wx, 0.95 + 0.1, wz, ry, 1, 1, 1, { cast: false })
            T.batch.put(boxUV(1.5, 0.08, 0.6, 1), P.woodLight, wx, 2.05, wz + 0.28 * Math.cos(ry), ry, 1, 1, 1, { cast: false }) // awning
            continue
          }
          const lit = (k + fi) % 3 === 0
          T.batch.put(new THREE.PlaneGeometry(0.9, 0.8), lit ? P.windowLit : glassDark, wx, p.top - 0.9, wz, ry, 1, 1, 1, { cast: false })
          T.batch.put(boxUV(1.1, 0.07, 0.12, 1), P.stoneLight, wx, p.top - 1.35 + 0.0, wz + 0.04 * Math.cos(ry), ry, 1, 1, 1, { cast: false }) // sill
        }
        void len
      })
      continue
    }
    // supported, believable pieces: timber crates, concrete blocks, a plank beam on trestles, brick vault walls with a stone coping, and shipping containers on steel legs
    const cx2 = cx
    const cz2 = cz
    const longX = w >= d
    if (p.kind === 'wall') {
      // a brick low wall with a stone coping and a thin painted white edge line (no padding stripe): reads as "go over"
      T.batch.put(boxUV(w, h - 0.1, d, 1.6), brick('#9a6a54'), cx, y0 + (h - 0.1) / 2, cz)
      T.batch.put(boxUV(w + 0.08, 0.1, d + 0.12, 1), P.stoneLight, cx, p.top - 0.05, cz)
      if (p.vault) T.batch.put(new THREE.BoxGeometry(longX ? w : 0.04, 0.012, longX ? 0.04 : d), edgeLine, longX ? cx : cx, p.top + 0.006, cz, 0, 1, 1, 1, { cast: false })
    } else if (p.kind === 'beam') {
      // a plank beam on stone trestles every 2 m
      T.batch.put(boxUV(w, 0.16, d, 1), P.woodLight, cx, p.top - 0.08, cz)
      const n = Math.max(2, Math.round(Math.max(w, d) / 2) + 1)
      for (let i = 0; i < n; i++) {
        const t = -0.5 + i / (n - 1)
        const px = longX ? cx + t * (w - 0.3) : cx
        const pz = longX ? cz : cz + t * (d - 0.3)
        T.batch.put(boxUV(longX ? 0.3 : w + 0.2, p.top - 0.16, longX ? d + 0.2 : 0.3, 1.2), P.stone, px, (p.top - 0.16) / 2, pz)
      }
    } else if (p.kind === 'block' || p.kind === 'step') {
      // concrete blocks with a cast-in chamfer line and a light top
      T.batch.put(boxUV(w, h, d, 1.6), concrete, cx, y0 + h / 2, cz)
      T.batch.put(boxUV(w + 0.05, 0.07, d + 0.05, 1), P.stoneLight, cx, p.top - 0.035, cz, 0, 1, 1, 1, { cast: false })
      T.batch.put(new THREE.BoxGeometry(longX ? w : 0.05, 0.012, longX ? 0.05 : d), edgeLine, cx, p.top + 0.006, cz, 0, 1, 1, 1, { cast: false })
    } else if (p.kind === 'crate') {
      // a timber crate: planked sides, corner posts and cross-battens
      T.batch.put(boxUV(w, h, d, 1.2), P.woodLight, cx, y0 + h / 2, cz)
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) T.batch.put(boxUV(0.14, h + 0.02, 0.14, 1), P.timber, cx + sx * (w / 2 - 0.05), y0 + h / 2, cz + sz * (d / 2 - 0.05))
      for (const f of [0.35, 0.7]) T.batch.put(boxUV(w + 0.04, 0.09, d + 0.04, 1), P.timber, cx, y0 + h * f, cz, 0, 1, 1, 1, { cast: false })
      T.batch.put(new THREE.BoxGeometry(longX ? w : 0.04, 0.012, longX ? 0.04 : d), edgeLine, cx, p.top + 0.006, cz, 0, 1, 1, 1, { cast: false })
    } else if (p.kind === 'roof' || p.kind === 'slab') {
      // a shipping container on steel legs: corrugated sides (vertical ribs), corner castings, a door end with locking bars, a painted top rim; the legs and a brace carry it
      const body = container(p.color ?? '#8a4a2a')
      const bottom = Math.max(y0, 0.55)
      const ch = p.top - bottom
      T.batch.put(boxUV(w, ch, d, 2), body, cx, bottom + ch / 2, cz)
      const ribs = Math.max(6, Math.floor(w / 0.28))
      for (let i = 0; i <= ribs; i++) {
        const rx = p.minX + 0.1 + ((w - 0.2) * i) / ribs
        for (const sz of [-1, 1]) T.batch.put(new THREE.BoxGeometry(0.07, ch - 0.16, 0.035), body, rx, bottom + ch / 2, cz + sz * (d / 2 + 0.012), 0, 1, 1, 1, { cast: false })
      }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const sy of [0.06, ch - 0.06]) T.batch.put(new THREE.BoxGeometry(0.16, 0.12, 0.16), steelDark, cx + sx * (w / 2 - 0.05), bottom + sy, cz + sz * (d / 2 - 0.05), 0, 1, 1, 1, { cast: false })
      T.batch.put(new THREE.BoxGeometry(w + 0.04, 0.012, 0.06), edgeLine, cx, p.top + 0.006, cz - d / 2 + 0.12, 0, 1, 1, 1, { cast: false })
      T.batch.put(new THREE.BoxGeometry(w + 0.04, 0.012, 0.06), edgeLine, cx, p.top + 0.006, cz + d / 2 - 0.12, 0, 1, 1, 1, { cast: false })
      // steel legs (posts at the corners and one mid-span) with a cross brace, so it is clearly supported
      if (bottom > 0.6 || p.kind === 'roof') {
        const legs = Math.max(2, Math.round(w / 3.3) + 1)
        for (let i = 0; i < legs; i++) {
          const lx = p.minX + 0.2 + ((w - 0.4) * i) / (legs - 1)
          for (const sz of [-1, 1]) T.batch.put(new THREE.CylinderGeometry(0.07, 0.07, bottom, 8), steelDark, lx, bottom / 2, cz + sz * (d / 2 - 0.25), 0, 1, 1, 1, { cast: false })
          if (i < legs - 1) {
            const span = (w - 0.4) / (legs - 1)
            const br = new THREE.BoxGeometry(Math.hypot(span, bottom * 0.8), 0.05, 0.05)
            br.rotateZ(Math.atan2(bottom * 0.8, span))
            T.batch.put(br, steelDark, lx + span / 2, bottom / 2, cz + d / 2 - 0.25, 0, 1, 1, 1, { cast: false })
          }
        }
      }
    } else {
      T.batch.put(boxUV(w, h, d, 2), colour(p.color ?? '#7a8696'), cx, y0 + h / 2, cz)
    }
    void cx2
    void cz2
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

  // the traversal lane: a sprint-jump ditch (mats + hazard edges + low kerbs), a vaultable fence, lane signs, direction boards
  {
    const dz = LANE.ditch
    const w = dz.x1 - dz.x0
    const d = dz.z1 - dz.z0
    T.batch.put(new THREE.BoxGeometry(w, 0.05, d), mat, (dz.x0 + dz.x1) / 2, 0.04, (dz.z0 + dz.z1) / 2, 0, 1, 1, 1, { cast: false })
    for (const sx of [-1, 1]) {
      T.batch.put(boxUV(0.5, 0.22, d, 1), P.stoneLight, sx < 0 ? dz.x0 - 0.25 : dz.x1 + 0.25, 0.11, (dz.z0 + dz.z1) / 2)
      T.batch.put(new THREE.BoxGeometry(0.08, 0.02, d), hazard, sx < 0 ? dz.x0 - 0.04 : dz.x1 + 0.04, 0.23, (dz.z0 + dz.z1) / 2, 0, 1, 1, 1, { cast: false })
    }
    fence(T, [
      [LANE.fenceX, 16.4],
      [LANE.fenceX, 24.4],
    ])
    for (const s of LANE.signs) {
      const F = Frame.at(T.batch, s.x, 1.45, s.z, 0)
      for (const px of [-0.55, 0.55]) F.box(0.09, 1.45, 0.09, P.bark, px, -0.72, -0.04)
      ornateSign(T, F, s.text, { h: 0.42, crest: null })
      for (const px of [-0.55, 0.55]) T.colliders.push({ kind: 'circle', x: s.x + px, z: s.z, r: 0.1, h: 1.45 })
    }
    // direction boards: one on the lane outside, one on the apron inside
    fingerpost(T, -224.8, 33.4, [
      { label: 'CHAD PARKOUR YARD', to: [-234, 28] },
      { label: 'CHADVILLE HEIGHTS', to: [-120, 38] },
    ])
    fingerpost(T, -224.6, 22.8, [
      { label: 'ROOKIE RUN', to: [-234, 20] },
      { label: 'ROOFTOP RUN', to: [-229.6, 0] },
      { label: 'TRAVERSAL LANE', to: [-208, 19] },
      { label: 'SWORD DRILL', to: [-196, -13] },
    ])
  }

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

/** lamp posts: down the corridor, along the roof field and at the entrance (added to the city's lamp list) */
export const PARKOUR_LAMPS: [number, number][] = [[-239.4, 22], [-239.4, 10], [-239.4, -2], [-239.4, -14], [-232, 23], [-226, -9], [-214, 9], [-205, -10], [-196, 9], [-186, -9], [-176, 9], [-176, -9]]

export type ParkourBuild = ReturnType<typeof parkourYard>
export const isSolidPlatform = (p: Platform) => p.kind === 'wall' && !p.vault
