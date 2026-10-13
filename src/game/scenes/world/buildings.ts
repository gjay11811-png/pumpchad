import * as THREE from 'three'
import { Cloth, Fire } from './fx'
import { boxUV, gableGeo, type Palette, type StaticBatch } from './kit'
import { signTexture } from '../textures'
import { awning, inscription, shopSign } from './textures'

export type Collider = { kind: 'circle'; x: number; z: number; r: number; h?: number } | { kind: 'box'; minX: number; maxX: number; minZ: number; maxZ: number; h?: number }
export type LightSpot = { x: number; y: number; z: number; color: string; intensity: number; dist: number; priority: number; fire?: Fire }

/** Everything a builder can contribute to the town. */
export type Town = {
  batch: StaticBatch
  P: Palette
  scene: THREE.Scene
  colliders: Collider[]
  smoke: { x: number; y: number; z: number }[]
  embers: { x: number; y: number; z: number }[]
  fires: Fire[]
  cloths: Cloth[]
  lights: LightSpot[]
  dynamic: { update(t: number, dt: number): void }[]
  disposables: (THREE.Material | THREE.Texture | THREE.BufferGeometry)[]
}

type Facing = 'n' | 's' | 'e' | 'w'
const ROT: Record<Facing, number> = { s: 0, e: Math.PI / 2, n: Math.PI, w: -Math.PI / 2 }

/** Places local-space parts (door on local +Z) into the world for a building at (x,z) facing `f`. */
function placer(T: Town, x: number, z: number, f: Facing) {
  const r = ROT[f]
  const c = Math.cos(r)
  const s = Math.sin(r)
  const world = (lx: number, lz: number) => [x + lx * c + lz * s, z - lx * s + lz * c] as const
  return {
    world,
    put(geo: THREE.BufferGeometry, mat: THREE.Material, lx: number, y: number, lz: number, ry = 0, sx = 1, sy = 1, sz = 1, cast = true) {
      const [wx, wz] = world(lx, lz)
      T.batch.put(geo, mat, wx, y, wz, ry + r, sx, sy, sz, { cast })
    },
    box(minLX: number, maxLX: number, minLZ: number, maxLZ: number, h: number) {
      const a = world(minLX, minLZ)
      const b = world(maxLX, maxLZ)
      T.colliders.push({ kind: 'box', minX: Math.min(a[0], b[0]), maxX: Math.max(a[0], b[0]), minZ: Math.min(a[1], b[1]), maxZ: Math.max(a[1], b[1]), h })
    },
    rot: r,
  }
}

/* ───────────────────────── Timber-frame house ───────────────────────── */
export function house(
  T: Town,
  o: { x: number; z: number; w: number; d: number; floors?: 1 | 2; face: Facing; roof?: THREE.Material; lit?: number; chimney?: boolean; seed?: number; dark?: boolean },
) {
  const P = T.P
  const L = placer(T, o.x, o.z, o.face)
  const floors = o.floors ?? 2
  const fh = 2.6
  const plinth = 0.55
  const wall = o.dark ? P.plasterDark : P.plaster
  let seed = o.seed ?? 1
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
  const W = o.w
  const D = o.d

  // stone plinth + ground-floor walls
  L.put(boxUV(W + 0.2, plinth, D + 0.2, 1.5), P.stone, 0, plinth / 2, 0)
  L.put(boxUV(W, fh, D, 2.5), wall, 0, plinth + fh / 2, 0)
  let top = plinth + fh
  if (floors === 2) {
    // jettied upper floor overhangs the street
    L.put(boxUV(W + 0.5, 0.25, D + 0.5, 1), P.timber, 0, top + 0.12, 0)
    L.put(boxUV(W + 0.4, fh, D + 0.4, 2.5), wall, 0, top + 0.25 + fh / 2, 0)
    top += 0.25 + fh
  }
  // timber frame: corner posts, rails, braces (front + back)
  const post = new THREE.BoxGeometry(0.2, 1, 0.2)
  const ow = floors === 2 ? 0.2 : 0
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      L.put(post, P.timber, sx * (W / 2 + 0.02), plinth + fh / 2, sz * (D / 2 + 0.02), 0, 1, fh, 1)
      if (floors === 2) L.put(post, P.timber, sx * (W / 2 + ow + 0.02), plinth + fh + 0.25 + fh / 2, sz * (D / 2 + ow + 0.02), 0, 1, fh, 1)
    }
  const rail = new THREE.BoxGeometry(1, 0.18, 0.12)
  for (let f = 0; f < floors; f++) {
    const y0 = plinth + f * (fh + 0.25)
    const wW = W + (f ? 0.4 : 0)
    const wD = D + (f ? 0.4 : 0)
    for (const sz of [-1, 1]) {
      L.put(rail, P.timber, 0, y0 + fh - 0.1, sz * (wD / 2 + 0.05), 0, wW, 1, 1)
      // diagonal braces either side of the centre
      for (const sx of [-1, 1]) L.put(rail, P.timber, sx * wW * 0.33, y0 + fh / 2, sz * (wD / 2 + 0.05), 0, 0.9, 1, 1)
    }
    for (const sx of [-1, 1]) L.put(rail, P.timber, sx * (wW / 2 + 0.05), y0 + fh - 0.1, 0, Math.PI / 2, wD, 1, 1)
  }
  // braces as rotated rails on the long walls
  const brace = new THREE.BoxGeometry(0.14, 1, 0.1)
  for (let f = 0; f < floors; f++) {
    const y0 = plinth + f * (fh + 0.25)
    const wW = W + (f ? 0.4 : 0)
    const wD = D + (f ? 0.4 : 0)
    for (const sz of [-1, 1])
      for (const sx of [-1, 1]) {
        const g = brace.clone()
        g.rotateZ(sx * 0.62)
        L.put(g, P.timber, sx * (wW / 2 - 0.55), y0 + fh / 2, sz * (wD / 2 + 0.06), 0, 1, fh * 1.05, 1)
      }
  }

  // windows: lit or dark panes in timber frames, front/back/sides
  const win = new THREE.PlaneGeometry(0.75, 0.95)
  const frame = new THREE.BoxGeometry(0.9, 0.1, 0.1)
  const addWindow = (lx: number, y: number, lz: number, ry: number) => {
    const lit = rand() < (o.lit ?? 0.55)
    const nx = Math.sin(ry) * 0.02
    const nz = Math.cos(ry) * 0.02
    L.put(win, lit ? P.windowLit : P.windowDark, lx + nx, y, lz + nz, ry, 1, 1, 1, false)
    L.put(frame, P.timber, lx + nx * 2, y - 0.52, lz + nz * 2, ry) // sill
    L.put(frame, P.timber, lx + nx * 2, y + 0.52, lz + nz * 2, ry)
    L.put(frame, P.timber, lx + nx * 2, y, lz + nz * 2, ry + Math.PI / 2 * 0, 0.1, 9.5, 1) // mullion
  }
  for (let f = 0; f < floors; f++) {
    const y = plinth + f * (fh + 0.25) + 1.45
    const half = (W + (f ? 0.4 : 0)) / 2 + 0.03
    const halfD = (D + (f ? 0.4 : 0)) / 2 + 0.03
    const nFront = Math.max(1, Math.floor(W / 2.2))
    for (let i = 0; i < nFront; i++) {
      const lx = -half + ((i + 0.5) * 2 * half) / nFront
      if (f === 0 && Math.abs(lx) < 0.9) continue // door goes here
      addWindow(lx, y, halfD, 0)
      if (rand() > 0.3) addWindow(lx, y, -halfD, Math.PI)
    }
    if (D > 4) for (const sx of [-1, 1]) addWindow(sx * half, y, 0, (sx * Math.PI) / 2)
  }

  // flower beds either side of the door: stone kerb, dark soil, a row of blooms
  if (P.flowers)
    for (const sx of [-1, 1]) {
      const bx = sx * (W / 2 - 0.85)
      const bz = D / 2 + 0.42
      L.put(boxUV(1.2, 0.16, 0.5, 1), P.stone, bx, 0.08, bz)
      L.put(new THREE.BoxGeometry(1.08, 0.04, 0.38), P.soil, bx, 0.17, bz, 0, 1, 1, 1, false)
      for (let k = 0; k < 4; k++) {
        const fx = bx - 0.4 + k * 0.27
        const q = new THREE.PlaneGeometry(0.34, 0.42)
        q.translate(0, 0.21 + 0.17, 0)
        L.put(q, P.flowers, fx, 0, bz, (k * 1.3) % 3, 1, 0.85 + ((k * 37) % 10) / 30, 1, false)
        L.put(q.clone().rotateY(Math.PI / 2), P.flowers, fx, 0, bz, (k * 1.3) % 3, 1, 1, 1, false)
      }
    }

  // door + frame + step + door lantern
  L.put(new THREE.PlaneGeometry(1.15, 2.05), P.timber, 0, plinth + 1.02, D / 2 + 0.03, 0, 1, 1, 1, false)
  L.put(new THREE.BoxGeometry(1.45, 0.16, 0.16), P.timber, 0, plinth + 2.12, D / 2 + 0.06)
  L.put(boxUV(1.6, 0.25, 0.7, 1), P.stone, 0, 0.12, D / 2 + 0.45)
  L.put(new THREE.BoxGeometry(0.16, 0.24, 0.16), P.glowGold, 0.95, plinth + 2.1, D / 2 + 0.22, 0, 1, 1, 1, false)

  // roof (ridge along the longer side)
  const roofMat = o.roof ?? P.roofRed
  const alongX = W >= D
  const rw = (alongX ? D : W) + (floors === 2 ? 0.4 : 0) + 0.9
  const rd = (alongX ? W : D) + (floors === 2 ? 0.4 : 0) + 0.7
  const rise = rw * 0.55
  L.put(gableGeo(rw, rd, rise), roofMat, 0, top, 0, alongX ? Math.PI / 2 : 0)
  L.put(new THREE.BoxGeometry(0.18, 0.18, rd + 0.2), P.timber, 0, top + rise, 0, alongX ? Math.PI / 2 : 0)

  if (o.chimney !== false) {
    const cx = (alongX ? W * 0.28 : rw * 0.18) * (rand() > 0.5 ? 1 : -1)
    const cz = alongX ? -D * 0.15 : D * 0.25
    L.put(boxUV(0.7, rise + 1.4, 0.7, 1), P.stone, cx, top + (rise + 1.4) / 2 - 0.2, cz)
    const [wx, wz] = L.world(cx, cz)
    T.smoke.push({ x: wx, y: top + rise + 1.2, z: wz })
  }
  L.box(-W / 2 - 0.2, W / 2 + 0.2, -D / 2 - 0.2, D / 2 + 0.2, top + rise)
}

/* ───────────────────────── The Flexing Gourd (tavern) ───────────────────────── */
export function tavern(T: Town, x: number, z: number, face: Facing) {
  const P = T.P
  house(T, { x, z, w: 10, d: 7, floors: 2, face, roof: P.roofOrange, lit: 0.95, seed: 42 })
  const L = placer(T, x, z, face)
  // porch deck + steps + posts + awning roof
  L.put(boxUV(10.4, 0.3, 3, 1.2), P.woodLight, 0, 0.15, 3.5 + 1.5)
  L.put(boxUV(3, 0.15, 0.6, 1), P.woodLight, 0, 0.075, 6.8)
  const post = new THREE.CylinderGeometry(0.11, 0.13, 2.8, 8)
  for (const lx of [-4.8, -1.6, 1.6, 4.8]) L.put(post, P.timber, lx, 1.7, 6.3)
  const awn = boxUV(10.8, 0.12, 3.4, 1.5)
  awn.rotateX(0.18)
  L.put(awn, P.roofOrange, 0, 3.2, 4.9)
  // closed board on the door
  const closedTex = shopSign('CLOSED', 'back after leg day', '#ff8a30')
  T.disposables.push(closedTex)
  const closed = new THREE.MeshStandardMaterial({ map: closedTex, roughness: 0.8 })
  T.disposables.push(closed)
  L.put(new THREE.PlaneGeometry(1.0, 0.5), closed, 0, 1.75, 3.55, 0, 1, 1, 1, false)
  // tables, benches, barrels on the patio
  const table = new THREE.CylinderGeometry(0.55, 0.55, 0.08, 12)
  const leg = new THREE.CylinderGeometry(0.07, 0.09, 0.75, 6)
  const bench = boxUV(1.3, 0.1, 0.35, 1)
  for (const lx of [-3.2, 3.2]) {
    L.put(table, P.woodLight, lx, 1.1, 5)
    L.put(leg, P.timber, lx, 0.68, 5)
    L.put(bench, P.woodLight, lx, 0.72, 4.25)
    L.put(bench, P.woodLight, lx, 0.72, 5.75)
    L.put(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 8), P.glowGold, lx, 1.23, 5, 0, 1, 1, 1, false) // candle mug glow
  }
  const barrel = new THREE.CylinderGeometry(0.4, 0.4, 0.95, 12)
  for (const [lx, lz] of [[5.6, 4], [5.6, 4.9], [-5.6, 4.4]] as const) L.put(barrel, P.woodLight, lx, 0.78, lz)
  L.put(barrel, P.woodLight, 5.6, 1.72, 4.45)
  // hanging sign that swings
  const sTex = shopSign('THE FLEXING GOURD', 'est. after the great dump')
  const sMat = new THREE.MeshStandardMaterial({ map: sTex, roughness: 0.7 })
  T.disposables.push(sTex, sMat)
  L.put(new THREE.BoxGeometry(0.1, 0.1, 1.6), P.iron, 5.3, 3.9, 7.3 - 2.1 + 0.8)
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), sMat)
  const pivot = new THREE.Group()
  const [wx, wz] = L.world(5.3, 6.8)
  pivot.position.set(wx, 3.85, wz)
  pivot.rotation.y = L.rot + Math.PI / 2
  sign.position.y = -0.5
  const back = sign.clone() // second face so the lettering reads correctly from both sides
  back.rotation.y = Math.PI
  pivot.add(sign, back)
  T.scene.add(pivot)
  T.dynamic.push({ update: (t) => (pivot.rotation.x = Math.sin(t * 1.3) * 0.08) })
  // porch light
  const [lx, lz] = L.world(0, 6)
  T.lights.push({ x: lx, y: 2.8, z: lz, color: '#ffa04a', intensity: 9, dist: 11, priority: 2 })
  L.box(-5.4, 5.4, 3.4, 6.4, 0.3) // porch edge: only the posts/rail block; deck is walkable via height map in World
  T.colliders.pop()
  for (const px of [-4.8, 4.8]) {
    const [cx, cz] = L.world(px, 6.3)
    T.colliders.push({ kind: 'circle', x: cx, z: cz, r: 0.25 })
  }
}

/* ───────────────────────── Iron Gourd Forge ───────────────────────── */
export function forge(T: Town, x: number, z: number, face: Facing) {
  const P = T.P
  const L = placer(T, x, z, face)
  const W = 8
  const D = 6
  // back + side stone walls (open front)
  L.put(boxUV(W, 3, 0.5, 2), P.stone, 0, 1.5, -D / 2)
  L.put(boxUV(0.5, 3, D, 2), P.stone, -W / 2, 1.5, 0)
  L.put(boxUV(0.5, 1.2, D, 2), P.stone, W / 2, 0.6, 0)
  const post = new THREE.BoxGeometry(0.3, 3.4, 0.3)
  for (const lx of [-W / 2, 0, W / 2]) L.put(post, P.timber, lx, 1.7, D / 2)
  // single-pitch roof
  const roof = boxUV(W + 1, 0.2, D + 1.2, 1.5)
  roof.rotateX(-0.22)
  L.put(roof, P.roofSlate, 0, 3.7, 0)
  // furnace: stone mass, glowing mouth, tall chimney
  L.put(boxUV(2.4, 2.2, 1.8, 1.2), P.stoneLight, -2.2, 1.1, -1.9)
  L.put(new THREE.PlaneGeometry(1.1, 0.8), T.P.glowOrange, -2.2, 0.85, -0.99, 0, 1, 1, 1, false)
  L.put(boxUV(1, 5.5, 1, 1), P.stone, -2.2, 3.6, -2.2)
  const [fx, fz] = L.world(-2.2, -0.7)
  const fire = new Fire(fx, 0.45, fz, 1.3)
  T.fires.push(fire)
  T.scene.add(fire.group)
  T.lights.push({ x: fx, y: 1.2, z: fz, color: '#ff6a1a', intensity: 16, dist: 12, priority: 1, fire })
  T.embers.push({ x: fx, y: 1.2, z: fz })
  const [sx, sz] = L.world(-2.2, -2.2)
  T.smoke.push({ x: sx, y: 6.5, z: sz })
  // anvil on stump
  L.put(new THREE.CylinderGeometry(0.45, 0.55, 0.7, 10), P.timber, 1.2, 0.35, 0.6)
  L.put(new THREE.BoxGeometry(0.9, 0.3, 0.4), P.iron, 1.2, 0.85, 0.6)
  L.put(new THREE.BoxGeometry(0.4, 0.25, 0.3), P.iron, 1.2, 0.98, 0.6)
  const horn = new THREE.ConeGeometry(0.15, 0.45, 8)
  horn.rotateZ(Math.PI / 2)
  L.put(horn, P.iron, 1.8, 0.88, 0.6)
  // sword rack on the back wall
  for (let i = 0; i < 5; i++) {
    L.put(new THREE.BoxGeometry(0.08, 1.4, 0.03), P.iron, 1 + i * 0.4, 1.5, -2.65)
    L.put(new THREE.BoxGeometry(0.35, 0.06, 0.06), P.gold, 1 + i * 0.4, 0.85, -2.62)
  }
  // coal pile, quench barrel, grindstone
  L.put(new THREE.DodecahedronGeometry(0.6, 0), P.rock, -0.4, 0.2, -2.2, 0, 1.4, 0.5, 1)
  L.put(new THREE.CylinderGeometry(0.45, 0.45, 0.8, 12), P.woodLight, 3.2, 0.4, -1.8)
  L.put(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 12), T.P.windowDark, 3.2, 0.81, -1.8)
  const wheel = new THREE.CylinderGeometry(0.5, 0.5, 0.15, 16)
  wheel.rotateZ(Math.PI / 2)
  L.put(wheel, P.stoneLight, 3, 0.7, 1.2)
  // sign
  const tex = shopSign('IRON GOURD', 'forge & weights')
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 })
  T.disposables.push(tex, mat)
  L.put(new THREE.PlaneGeometry(2.4, 1.2), mat, 2.2, 4.3, D / 2 + 0.35, -0.2, 1, 1, 1, false)
  // colliders: walls + furnace + anvil (open front is walkable)
  L.box(-W / 2 - 0.3, W / 2 + 0.3, -D / 2 - 0.3, -D / 2 + 0.3, 3)
  L.box(-W / 2 - 0.3, -W / 2 + 0.3, -D / 2, D / 2, 3)
  L.box(W / 2 - 0.3, W / 2 + 0.3, -D / 2, D / 2 - 1.8, 1.2)
  L.box(-3.4, -1, -2.8, -1, 2.2)
  const [ax, az] = L.world(1.3, 0.6)
  T.colliders.push({ kind: 'circle', x: ax, z: az, r: 0.75 })
}

/* ───────────────────────── Pump Arcade (decorative, opening soon) ───────────────────────── */
export function arcade(T: Town, x: number, z: number, face: Facing) {
  const P = T.P
  const L = placer(T, x, z, face)
  const W = 10
  const D = 8
  const H = 5.5
  L.put(boxUV(W, H, D, 2), P.stone, 0, H / 2, 0)
  L.put(boxUV(W + 0.4, 0.5, D + 0.4, 1.5), P.stoneLight, 0, H + 0.25, 0)
  // stepped parapet
  for (let i = -2; i <= 2; i++) L.put(boxUV(1.2, 0.8, 0.5, 1), P.stoneLight, i * 2, H + 0.9, D / 2)
  // arched windows glowing with cabinet screens (teal / purple), animated via shared materials
  const cabTex = cabinetsTexture()
  const scrA = new THREE.MeshBasicMaterial({ map: cabTex, color: '#5fe0d0', toneMapped: false })
  const scrB = new THREE.MeshBasicMaterial({ map: cabTex, color: '#b07bff', toneMapped: false })
  T.disposables.push(scrA, scrB, cabTex)
  const pane = new THREE.PlaneGeometry(1.5, 2.2)
  const arch = new THREE.CircleGeometry(0.75, 16, 0, Math.PI)
  for (const [i, lx] of [-3.4, 3.4].entries()) {
    const m = i ? scrB : scrA
    L.put(pane, m, lx, 2.2, D / 2 + 0.02, 0, 1, 1, 1, false)
    L.put(arch, m, lx, 3.3, D / 2 + 0.02, 0, 1, 1, 1, false)
    L.put(new THREE.BoxGeometry(1.8, 0.15, 0.25), P.stoneLight, lx, 1.05, D / 2 + 0.1)
  }
  T.dynamic.push({
    update: (t) => {
      scrA.color.setHSL(0.47 + Math.sin(t * 0.7) * 0.04, 0.8, 0.6).multiplyScalar(1.4 + Math.sin(t * 6) * 0.15)
      scrB.color.setHSL(0.75 + Math.sin(t * 0.5) * 0.05, 0.85, 0.65).multiplyScalar(1.4 + Math.sin(t * 5.3 + 1) * 0.15)
    },
  })
  // boarded double door
  L.put(new THREE.PlaneGeometry(2.2, 2.8), P.timber, 0, 1.4, D / 2 + 0.03, 0, 1, 1, 1, false)
  const plank = new THREE.BoxGeometry(2.6, 0.22, 0.08)
  for (const [y, rz] of [[1.0, 0.25], [1.9, -0.2]] as const) {
    const g = plank.clone()
    g.rotateZ(rz)
    L.put(g, P.woodLight, 0, y, D / 2 + 0.08)
  }
  // neon sign + flashing "opening soon"
  const neonTex = signTexture('PUMP ARCADE', { color: '#c48bff', sub: '★ OPENING SOON ★' })
  const neon = new THREE.MeshBasicMaterial({ map: neonTex, toneMapped: false, color: new THREE.Color(2.4, 2.4, 2.4) })
  T.disposables.push(neonTex, neon)
  L.put(new THREE.PlaneGeometry(6, 1.5), neon, 0, 4.4, D / 2 + 0.04, 0, 1, 1, 1, false)
  T.dynamic.push({ update: (t) => neon.color.setScalar(Math.sin(t * 3.2) > -0.85 ? 2.4 : 0.6) })
  const [lx, lz] = L.world(0, D / 2 + 2)
  T.lights.push({ x: lx, y: 3, z: lz, color: '#a070ff', intensity: 10, dist: 11, priority: 3 })
  L.box(-W / 2, W / 2, -D / 2, D / 2, H)
}

/** Silhouettes of arcade cabinets with lit screens, seen through the arcade's arched windows. */
function cabinetsTexture() {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 192
  const g = c.getContext('2d')!
  const grd = g.createLinearGradient(0, 0, 0, 192)
  grd.addColorStop(0, '#3a3a4a')
  grd.addColorStop(1, '#141420')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 192)
  for (const [x, w] of [[6, 36], [46, 36], [86, 36]] as const) {
    g.fillStyle = '#05050a'
    g.fillRect(x, 70, w, 122)
    g.fillRect(x - 2, 60, w + 4, 14)
    g.fillStyle = '#ffffff'
    g.fillRect(x + 5, 82, w - 10, 30) // screen
    g.fillStyle = 'rgba(255,255,255,0.55)'
    g.fillRect(x + 4, 122, w - 8, 6) // control deck
    g.fillStyle = '#ffffff'
    g.beginPath()
    g.arc(x + 10, 140, 3, 0, Math.PI * 2)
    g.arc(x + w - 10, 140, 3, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = 'rgba(255,255,255,0.18)' // ceiling light spill
  g.fillRect(0, 0, 128, 18)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/* ───────────────────────── The Hollow House (abandoned) ───────────────────────── */
export function hollowHouse(T: Town, x: number, z: number, face: Facing) {
  const P = T.P
  const L = placer(T, x, z, face)
  const W = 7
  const D = 6
  const lean = 0.06
  const body = boxUV(W, 5.4, D, 2.5)
  body.rotateZ(lean)
  L.put(body, P.woodRotten, 0, 2.75, 0)
  L.put(boxUV(W + 0.3, 0.5, D + 0.3, 1.2), P.stone, 0, 0.25, 0)
  // sagging, broken roof
  const roof = gableGeo(D + 0.9, W + 0.8, 3)
  roof.rotateZ(lean * 1.5)
  L.put(roof, P.roofSlate, 0.2, 5.4, 0, Math.PI / 2)
  L.put(new THREE.BoxGeometry(1.4, 0.3, 1.2), P.windowDark, 1.6, 7.1, 0.6, 0.4) // hole patch
  // boarded windows
  const plank = new THREE.BoxGeometry(1.3, 0.16, 0.07)
  for (const lx of [-2, 2])
    for (const y of [1.7, 4]) {
      L.put(new THREE.PlaneGeometry(1, 1.1), P.windowDark, lx, y, D / 2 + 0.03, 0, 1, 1, 1, false)
      for (const rz of [0.5, -0.45]) {
        const g = plank.clone()
        g.rotateZ(rz)
        L.put(g, P.woodLight, lx, y, D / 2 + 0.08)
      }
    }
  // the one window that isn't boarded: a faint purple flicker
  const eerie = new THREE.MeshBasicMaterial({ color: '#7a3cff', toneMapped: false })
  T.disposables.push(eerie)
  L.put(new THREE.PlaneGeometry(0.9, 1.05), eerie, 0, 4, D / 2 + 0.03, 0, 1, 1, 1, false)
  T.dynamic.push({
    update: (t) => {
      const flick = Math.sin(t * 1.7) * Math.sin(t * 7.3) > 0.55 ? 2.6 : 0.25 + Math.sin(t * 0.8) * 0.12
      eerie.color.set('#7a3cff').multiplyScalar(flick)
    },
  })
  // door hanging off its hinge
  const door = new THREE.PlaneGeometry(1.1, 2.1)
  door.rotateY(0.5)
  L.put(door, P.woodRotten, -0.3, 1.55, D / 2 + 0.3)
  // graves out back
  const stoneTop = new THREE.CylinderGeometry(0.42, 0.42, 0.2, 12, 1, false, 0, Math.PI)
  stoneTop.rotateX(Math.PI / 2)
  stoneTop.rotateZ(Math.PI / 2)
  for (const [lx, lz, tilt] of [[-2, -5.2, 0.1], [0, -5.6, -0.15], [2.2, -5.1, 0.05]] as const) {
    const slab = boxUV(0.85, 0.9, 0.18, 1)
    slab.rotateZ(tilt)
    L.put(slab, P.stone, lx, 0.45, lz)
    L.put(new THREE.BoxGeometry(0.7, 0.04, 1.6), P.foliageDark, lx, 0.02, lz + 1)
  }
  L.box(-W / 2 - 0.15, W / 2 + 0.15, -D / 2 - 0.15, D / 2 + 0.15, 8)
}

/* ───────────────────────── Market stall ───────────────────────── */
export function stall(T: Town, x: number, z: number, face: Facing, stripe: THREE.Material, goods: 'pumpkins' | 'potions' | 'crates' | 'cloth') {
  const P = T.P
  const L = placer(T, x, z, face)
  const post = new THREE.CylinderGeometry(0.07, 0.08, 2.6, 6)
  for (const lx of [-1.4, 1.4])
    for (const lz of [-0.8, 0.8]) L.put(post, P.timber, lx, 1.3, lz)
  L.put(boxUV(3, 0.9, 1.2, 1), P.woodLight, 0, 0.45, 0.35)
  L.put(boxUV(3.2, 0.08, 1.35, 1), P.timber, 0, 0.93, 0.35)
  const roof = new THREE.PlaneGeometry(3.4, 2.1)
  roof.rotateX(-Math.PI / 2 + 0.35)
  L.put(roof, stripe, 0, 2.75, 0.15, 0, 1, 1, 1)
  const valance = new THREE.PlaneGeometry(3.4, 0.35)
  L.put(valance, stripe, 0, 2.38, 1.13)
  // goods
  if (goods === 'pumpkins') {
    const pk = new THREE.SphereGeometry(0.2, 10, 8)
    pk.scale(1.15, 0.8, 1.15)
    for (let i = 0; i < 6; i++) L.put(pk, P.pumpkin, -1.1 + i * 0.44, 1.08, 0.3 + (i % 2) * 0.25)
  } else if (goods === 'potions') {
    const bottle = new THREE.CylinderGeometry(0.07, 0.1, 0.3, 8)
    const mats = [P.glowTeal, P.glowPurple, P.glowOrange]
    for (let i = 0; i < 9; i++) L.put(bottle, mats[i % 3], -1.15 + i * 0.29, 1.12, 0.35 + (i % 2) * 0.2, 0, 1, 1, 1, false)
  } else if (goods === 'cloth') {
    for (let i = 0; i < 4; i++) L.put(boxUV(0.55, 0.12, 0.7, 1), [P.roofRed, P.roofSlate, P.roofOrange, P.woodLight][i], -1 + i * 0.66, 1.03 + (i % 2) * 0.12, 0.35)
  }
  const crate = boxUV(0.6, 0.6, 0.6, 0.6)
  L.put(crate, P.woodLight, 1.9, 0.3, -0.4, 0.3)
  L.put(crate, P.woodLight, 1.95, 0.9, -0.35, 0.1)
  L.put(new THREE.BoxGeometry(0.14, 0.18, 0.14), P.glowGold, 1.3, 2.25, 0.9, 0, 1, 1, 1, false) // hanging lantern
  L.box(-1.6, 1.6, -1, 1, 1)
  T.colliders.pop()
  const [cx, cz] = L.world(0, 0.35)
  const r = ROT[face]
  const hw = Math.abs(Math.cos(r)) > 0.5 ? 1.6 : 0.7
  const hd = Math.abs(Math.cos(r)) > 0.5 ? 0.7 : 1.6
  T.colliders.push({ kind: 'box', minX: cx - hw, maxX: cx + hw, minZ: cz - hd, maxZ: cz + hd, h: 1 })
}

export function stripeMats(T: Town) {
  const mk = (a: string, b: string) => {
    const t = awning(a, b)
    const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, side: THREE.DoubleSide })
    T.disposables.push(t, m)
    return m
  }
  return [mk('#ff7a1a', '#1a1418'), mk('#5b2a86', '#e9dcc0'), mk('#2f4a2c', '#e8b84a'), mk('#9a2a22', '#e9dcc0')]
}

/* ───────────────────────── South gate arch ───────────────────────── */
export function entranceArch(T: Town, z: number) {
  const P = T.P
  for (const x of [-3.8, 3.8]) {
    T.batch.put(boxUV(1.2, 5, 1.2, 1.5), P.stone, x, 2.5, z)
    T.batch.put(boxUV(1.5, 0.4, 1.5, 1), P.stoneLight, x, 5.2, z)
    // pumpkin lantern + fire on each pillar
    const pk = new THREE.SphereGeometry(0.5, 14, 10)
    pk.scale(1.15, 0.85, 1.15)
    T.batch.put(pk, P.pumpkin, x, 5.8, z)
    const f = new Fire(x, 6.2, z, 0.8)
    T.fires.push(f)
    T.scene.add(f.group)
    T.colliders.push({ kind: 'box', minX: x - 0.65, maxX: x + 0.65, minZ: z - 0.65, maxZ: z + 0.65, h: 5 })
  }
  T.batch.put(boxUV(8.8, 0.7, 0.8, 1.5), P.timber, 0, 4.6, z)
  const tex = shopSign('CHAD SQUARE', 'markets dump · chads pump')
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.25 })
  T.disposables.push(tex, mat)
  for (const side of [1, -1]) T.batch.put(new THREE.PlaneGeometry(4.4, 2.2), mat, 0, 3.55, z + side * 0.42, side > 0 ? 0 : Math.PI, 1, 1, 1, { cast: false })
  T.batch.put(new THREE.BoxGeometry(0.06, 1, 0.06), P.iron, -1.6, 4.0, z)
  T.batch.put(new THREE.BoxGeometry(0.06, 1, 0.06), P.iron, 1.6, 4.0, z)
}

/* ───────────────────────── The Pump Fountain (central landmark) ───────────────────────── */
export function fountain(T: Town, king: THREE.Object3D, waterNormal: THREE.Texture) {
  const P = T.P
  // stepped octagonal base
  T.batch.put(new THREE.CylinderGeometry(6.2, 6.5, 0.25, 8), P.stoneLight, 0, 0.12, 0, Math.PI / 8)
  T.batch.put(new THREE.CylinderGeometry(5.6, 5.9, 0.3, 8), P.stone, 0, 0.4, 0, Math.PI / 8)
  // basin wall (lathe ring) + rim
  const rim = new THREE.LatheGeometry(
    [new THREE.Vector2(4.6, 0), new THREE.Vector2(4.9, 0), new THREE.Vector2(5.0, 0.9), new THREE.Vector2(5.15, 1.0), new THREE.Vector2(4.5, 1.05), new THREE.Vector2(4.45, 0.2)],
    8,
  )
  T.batch.put(rim, P.stoneLight, 0, 0.5, 0, Math.PI / 8)
  // inscription band around the rim
  const inscTex = inscription('MARKETS DUMP · CHADS PUMP')
  const inscMat = new THREE.MeshStandardMaterial({ map: inscTex, metalness: 0.6, roughness: 0.4, emissive: '#e8b84a', emissiveMap: inscTex, emissiveIntensity: 0.35 })
  T.disposables.push(inscTex, inscMat)
  const band = new THREE.CylinderGeometry(5.03, 5.03, 0.45, 48, 1, true)
  T.batch.put(band, inscMat, 0, 1.05, 0, 0, 1, 1, 1, { cast: false })
  // water surface (animated normals)
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(4.55, 48),
    new THREE.MeshStandardMaterial({ color: '#10232a', roughness: 0.08, metalness: 0.3, normalMap: waterNormal, normalScale: new THREE.Vector2(0.6, 0.6), envMapIntensity: 1.4, emissive: '#2a1206', emissiveIntensity: 0.6 }),
  )
  water.rotation.x = -Math.PI / 2
  water.position.y = 1.2
  T.scene.add(water)
  T.disposables.push(water.geometry, water.material as THREE.Material)
  // underwater glow ring
  const glowRing = new THREE.Mesh(new THREE.TorusGeometry(3.9, 0.06, 6, 64), T.P.glowOrange)
  glowRing.rotation.x = Math.PI / 2
  glowRing.position.y = 1.12
  T.scene.add(glowRing)
  T.disposables.push(glowRing.geometry)
  // central tiered pedestal
  T.batch.put(new THREE.CylinderGeometry(1.7, 2.1, 1.2, 8), P.stone, 0, 1.5, 0, Math.PI / 8)
  T.batch.put(new THREE.CylinderGeometry(1.95, 1.95, 0.18, 8), P.gold, 0, 2.15, 0, Math.PI / 8)
  T.batch.put(new THREE.CylinderGeometry(1.3, 1.55, 1.6, 8), P.stoneLight, 0, 3.0, 0, Math.PI / 8)
  T.batch.put(new THREE.CylinderGeometry(1.5, 1.5, 0.2, 8), P.gold, 0, 3.85, 0, Math.PI / 8)
  // the golden King
  king.position.set(0, 3.95, 0)
  king.scale.setScalar(1.75)
  king.updateMatrixWorld(true)
  T.batch.absorb(king)
  // water arcs from the pedestal into the basin (flowing texture)
  const flowTex = (() => {
    const c = document.createElement('canvas')
    c.width = 8
    c.height = 64
    const g = c.getContext('2d')!
    for (let y = 0; y < 64; y++) {
      g.fillStyle = `rgba(200,240,255,${0.25 + 0.35 * Math.abs(Math.sin(y * 0.4))})`
      g.fillRect(0, y, 8, 1)
    }
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    return t
  })()
  const flowMat = new THREE.MeshBasicMaterial({ map: flowTex, transparent: true, depthWrite: false, color: new THREE.Color('#bfe9ff').multiplyScalar(1.3), toneMapped: false, opacity: 0.75 })
  T.disposables.push(flowTex, flowMat)
  const arcGeos: THREE.BufferGeometry[] = []
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8
    const start = new THREE.Vector3(Math.cos(a) * 1.45, 2.7, Math.sin(a) * 1.45)
    const end = new THREE.Vector3(Math.cos(a) * 3.6, 1.2, Math.sin(a) * 3.6)
    const mid = new THREE.Vector3(Math.cos(a) * 2.9, 3.4, Math.sin(a) * 2.9)
    arcGeos.push(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(start, mid, end), 16, 0.06, 5, false))
  }
  for (const g of arcGeos) {
    const m = new THREE.Mesh(g, flowMat)
    T.scene.add(m)
    T.disposables.push(g)
  }
  // floating golden crown halo above the King
  const crown = new THREE.Group()
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.06, 8, 40), T.P.glowGold)
  ring.rotation.x = Math.PI / 2
  crown.add(ring)
  const spike = new THREE.ConeGeometry(0.12, 0.38, 4)
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Mesh(spike, T.P.glowGold)
    const a = (i / 8) * Math.PI * 2
    s.position.set(Math.cos(a) * 0.9, 0.2, Math.sin(a) * 0.9)
    crown.add(s)
  }
  crown.position.y = 8.6
  T.scene.add(crown)
  T.disposables.push(ring.geometry, spike)
  // four braziers on the outer step
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    const bx = Math.cos(a) * 5.75
    const bz = Math.sin(a) * 5.75
    T.batch.put(new THREE.CylinderGeometry(0.22, 0.3, 1.4, 8), P.iron, bx, 1.2, bz)
    T.batch.put(new THREE.CylinderGeometry(0.55, 0.3, 0.4, 10, 1, true), P.iron, bx, 2.05, bz)
    const f = new Fire(bx, 2.0, bz, 1)
    T.fires.push(f)
    T.scene.add(f.group)
    T.embers.push({ x: bx, y: 2.3, z: bz })
    T.colliders.push({ kind: 'circle', x: bx, z: bz, r: 0.45, h: 2 })
  }
  T.lights.push({ x: 0, y: 6, z: 0, color: '#ffb057', intensity: 40, dist: 22, priority: 0 })
  T.colliders.push({ kind: 'circle', x: 0, z: 0, r: 5.3, h: 2 })
  T.dynamic.push({
    update: (t, dt) => {
      waterNormal.offset.x += dt * 0.03
      waterNormal.offset.y += dt * 0.02
      flowTex.offset.y -= dt * 1.4
      crown.rotation.y += dt * 0.5
      crown.position.y = 8.6 + Math.sin(t * 1.2) * 0.12
    },
  })
}
