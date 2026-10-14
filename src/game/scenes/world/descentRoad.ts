import * as THREE from 'three'
import type { Town } from './buildings'
import { boxUV, rng } from './kit'
import { Frame, PANEL, channelLetters, panelTexture, postedBoard, type SignMats } from './signs'
import { terrainHeight } from './city'
import { DESCENT, DESCENT_LEN, DESCENT_W, OVERLOOK, VALLEY_Y, VIADUCT } from './descent'
import { isNight } from './daylight'
import { archGeo } from './archGeo'

/**
 * THE VALLEY ROAD, built: the cobbled carriageway with a raised footway and kerb each side, retaining walls and a parapet
 * wherever the ground falls away, lanterns, direction boards at every decision point, the panoramic overlook terrace,
 * the stone viaduct over the ravine, the City Gateway where the road meets Downtown's avenue, and autumn trees + rock
 * outcrops on the banks. Everything is in world coordinates (the road's y changes along it).
 */
const ID = new THREE.Matrix4()
const Y = new THREE.Vector3(0, 1, 0)

function laid(T: Town, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, ang: number, pitch: number, cast = true) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, ang, 0, 'YXZ'))
  T.batch.add(geo, mat, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1)), { cast })
  geo.dispose()
}

export const DESCENT_LANTERNS: { x: number; y: number; z: number }[] = []

export function descentRoad(T: Town, q: 'low' | 'medium' | 'high') {
  const P = T.P
  const D = T.disposables
  const SMt: SignMats = { frame: P.iron, metal: P.iron, gold: P.gold, stone: P.stoneLight }
  const night = isNight()
  const R = rng(9133)
  const W = DESCENT_W
  const FOOT = 1.7 // footway width each side
  const grade = (VALLEY_Y - 0) / DESCENT_LEN // metres of y per metre of road (negative: downhill)
  const stoneDark = new THREE.MeshStandardMaterial({ color: '#8d8478', roughness: 0.95 })
  D.push(stoneDark)

  /* ── the surface: carriageway + a raised footway and a kerb on each side ── */
  {
    const road: number[] = []
    const roadUv: number[] = []
    const roadIdx: number[] = []
    const foot: number[][] = [[], []]
    const footUv: number[][] = [[], []]
    const footIdx: number[][] = [[], []]
    const step = 1.5
    let n = 0
    for (let s = 0; s <= DESCENT_LEN + 0.01; s += step) {
      const p = DESCENT.pointAt(s)
      const nx = -p.tz
      const nz = p.tx
      const half = W / 2
      const cw = half - FOOT // carriageway half-width
      for (const side of [-1, 1]) road.push(p.x + nx * side * cw, p.y + 0.04, p.z + nz * side * cw), roadUv.push(side < 0 ? 0 : (2 * cw) / 3, p.s / 3)
      for (const [k, side] of [[0, -1], [1, 1]] as const) {
        for (const off of [cw + 0.18, half]) {
          foot[k].push(p.x + nx * side * off, p.y + 0.13, p.z + nz * side * off)
          footUv[k].push(off === half ? 0 : 1, p.s / 2.4)
        }
      }
      if (n > 0) {
        const a = (n - 1) * 2
        roadIdx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
        for (const k of [0, 1]) footIdx[k].push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
      }
      n++
    }
    const make = (pos: number[], uv: number[], idx: number[], mat: THREE.Material, up = true) => {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
      g.setIndex(idx)
      g.computeVertexNormals()
      if (up && (g.attributes.normal as THREE.BufferAttribute).getY(0) < 0) {
        g.setIndex(idx.map((_, i) => idx[i % 3 === 0 ? i : i % 3 === 1 ? i + 1 : i - 1]))
        g.computeVertexNormals()
      }
      T.batch.add(g, mat, ID, { cast: false })
    }
    make(road, roadUv, roadIdx, P.cobble)
    for (const k of [0, 1]) make(foot[k], footUv[k], footIdx[k], P.plaza)
    // a restrained kerb between the carriageway and each footway
    for (const side of [-1, 1]) {
      for (let s = step; s <= DESCENT_LEN; s += 3) {
        const p = DESCENT.pointAt(s - step / 2)
        const nx = -p.tz
        const nz = p.tx
        const off = W / 2 - FOOT + 0.09
        laid(T, boxUV(0.18, 0.2, 3.1, 1), stoneDark, p.x + nx * side * off, p.y + 0.07, p.z + nz * side * off, Math.atan2(p.tx, p.tz), -Math.atan(grade), false)
      }
    }
  }

  /* ── retaining walls and the parapet where the ground falls away; a low kerb-wall on the uphill side ── */
  {
    const step = 3.2
    for (let s = step / 2; s < DESCENT_LEN; s += step) {
      const p = DESCENT.pointAt(s)
      if (s > VIADUCT.s0 - 2 && s < VIADUCT.s1 + 2) continue // the viaduct carries its own parapet
      const nx = -p.tz
      const nz = p.tx
      const ang = Math.atan2(p.tx, p.tz)
      const pitch = -Math.atan(grade)
      for (const side of [-1, 1]) {
        const ex = p.x + nx * side * (W / 2 + 0.2)
        const ez = p.z + nz * side * (W / 2 + 0.2)
        const drop = p.y - terrainHeight(p.x + nx * side * (W / 2 + 3.6), p.z + nz * side * (W / 2 + 3.6))
        const ph = drop > 0.8 ? 0.7 : 0.35
        laid(T, boxUV(0.46, ph, step + 0.1, 1.4), P.stoneLight, ex, p.y + ph / 2 + 0.08, ez, ang, pitch)
        if (drop > 0.8) {
          const h = Math.min(7, Math.max(1.4, drop * 0.9 + 0.8))
          laid(T, boxUV(0.8, h, step + 0.1, 2), P.stone, ex + nx * side * 0.12, p.y - h / 2 + 0.08, ez + nz * side * 0.12, ang, pitch)
          if (Math.round(s / step) % 3 === 0) {
            T.batch.put(boxUV(1.0, h + 0.3, 1.0, 2), P.stone, ex + nx * side * 0.8, p.y - h / 2, ez + nz * side * 0.8, ang)
            T.batch.put(new THREE.ConeGeometry(0.55, 0.6, 4).rotateY(Math.PI / 4), P.stoneLight, ex + nx * side * 0.8, p.y + 0.35, ez + nz * side * 0.8)
          }
        }
      }
    }
  }

  /* ── lanterns every ~16 m, alternating; a pair at each hairpin apex; a lit post at every board ── */
  {
    const post = new THREE.CylinderGeometry(0.06, 0.09, 2.7, 6)
    const cap = new THREE.ConeGeometry(0.24, 0.2, 4).rotateY(Math.PI / 4)
    const glow = new THREE.BoxGeometry(0.22, 0.3, 0.22)
    const lantern = (x: number, y: number, z: number) => {
      T.batch.put(post, P.iron, x, y + 1.35, z)
      T.batch.put(glow, P.glowOrange, x, y + 2.85, z, 0, 1, 1, 1, { cast: false })
      T.batch.put(cap, P.iron, x, y + 3.08, z, 0, 1, 1, 1, { cast: false })
      T.lights.push({ x, y: y + 2.85, z, color: '#ffb060', intensity: 3.4, dist: 9, priority: 1 })
      DESCENT_LANTERNS.push({ x, y: y + 2.85, z })
    }
    let side = 1
    for (let s = 14; s < DESCENT_LEN - 6; s += 16) {
      if (s > VIADUCT.s0 - 1 && s < VIADUCT.s1 + 1) {
        const p = DESCENT.pointAt(s)
        lantern(p.x - p.tz * side * (W / 2 - 0.15), p.y + 0.2, p.z + p.tx * side * (W / 2 - 0.15))
      } else {
        const p = DESCENT.pointAt(s)
        lantern(p.x - p.tz * side * (W / 2 + 0.2), p.y, p.z + p.tx * side * (W / 2 + 0.2))
      }
      side = -side
    }
  }

  /* ── direction boards: the village gate, the overlook, the middle of the descent, the viaduct, the City Gateway ── */
  {
    const board = (s: number, side: number, title: string, sub: string, aspect = 2.2) => {
      const p = DESCENT.pointAt(s)
      const ox = p.x - p.tz * side * (W / 2 + 1.6)
      const oz = p.z + p.tx * side * (W / 2 + 1.6)
      const m = new THREE.MeshStandardMaterial({ map: panelTexture(title, sub, aspect, PANEL.dark, D), roughness: 0.65 })
      D.push(m)
      // face the oncoming walker (looking down the road, i.e. against the direction of travel)
      postedBoard(Frame.at(T.batch, ox, p.y, oz, Math.atan2(-p.tx, -p.tz)), 1.9, 0.9, 1.5, m, SMt, true)
      T.colliders.push({ kind: 'circle', x: ox, z: oz, r: 0.7, h: 2.2 })
    }
    board(8, 1, 'CHAD CITY', `down the valley road · ${Math.round(DESCENT_LEN)} m`)
    board(DESCENT.nearest(14, 88).s + 18, 1, 'OVERLOOK', 'the whole valley · benches · lanterns')
    board(DESCENT.nearest(-4, 154).s + 40, -1, 'CHAD CITY', 'the avenue · the castle road · Downtown')
    board(VIADUCT.s0 - 12, 1, 'MOONSPAN VIADUCT', 'stone arches over the ravine')
    board(DESCENT_LEN - 30, 1, 'CITY GATEWAY', 'Downtown, 60 m ahead')
  }

  /* ── the panoramic overlook: a stone terrace over the drop, with benches, a telescope, a map plaque and lanterns ── */
  {
    const { x, z, r } = OVERLOOK
    const y = DESCENT.nearest(x, z).y
    const disc = new THREE.CircleGeometry(r, 36).rotateX(-Math.PI / 2)
    const u = disc.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < u.count; i++) u.setXY(i, disc.attributes.position.getX(i) / 3, disc.attributes.position.getZ(i) / 3)
    T.batch.put(disc, P.plaza, x, y + 0.06, z, 0, 1, 1, 1, { cast: false })
    for (const [rr, m] of [[r - 0.35, P.stoneLight], [r - 0.7, P.gold]] as const) T.batch.put(new THREE.RingGeometry(rr - 0.1, rr, 40).rotateX(-Math.PI / 2), m, x, y + 0.075, z, 0, 1, 1, 1, { cast: false })
    // a footway joining the road
    T.batch.put(boxUV(5, 0.14, 2.4, 1.6), P.plaza, (DESCENT.nearest(x, z).px + x - r) / 2 + 0.3, y + 0.07, z, 0)
    // balustrade on the valley side (south half), with piers; and retaining wall down to the slope below
    const posts = 22
    for (let i = 0; i <= posts; i++) {
      const a = (i / posts) * Math.PI // 0 → π: east → west through the south
      const bx = x + Math.cos(a) * (r - 0.2)
      const bz = z + Math.sin(a) * (r - 0.2)
      if (bx < x - r + 2.5 && false) continue
      const ground = terrainHeight(bx + Math.cos(a) * 2, bz + Math.sin(a) * 2)
      const h = Math.min(14, Math.max(1.2, y - ground + 0.6))
      T.batch.put(boxUV(0.7, 1.15, 0.7, 1.4), P.stone, bx, y + 0.6, bz, -a)
      T.batch.put(new THREE.SphereGeometry(0.18, 8, 6), P.gold, bx, y + 1.3, bz)
      T.batch.put(boxUV(1.05, h, 0.95, 2), P.stone, bx + Math.cos(a) * 0.15, y - h / 2 + 0.06, bz + Math.sin(a) * 0.15, -a)
      if (i < posts) {
        const a2 = ((i + 0.5) / posts) * Math.PI
        const mx = x + Math.cos(a2) * (r - 0.2)
        const mz = z + Math.sin(a2) * (r - 0.2)
        T.batch.put(boxUV(0.3, 0.14, (Math.PI * r) / posts + 0.1, 1), P.stoneLight, mx, y + 1.08, mz, -a2 + Math.PI / 2)
        T.batch.put(boxUV(0.2, 0.7, (Math.PI * r) / posts, 1), P.iron, mx, y + 0.6, mz, -a2 + Math.PI / 2)
      }
    }
    // benches facing the view (south), a telescope on a pillar, a lit map plaque, lanterns, planters
    for (const dx of [-3.2, 0, 3.2]) {
      const bx = x + dx
      const bz = z + 2.6 - Math.abs(dx) * 0.2
      T.batch.put(boxUV(1.8, 0.08, 0.55, 1), P.woodLight, bx, y + 0.55, bz, 0)
      T.batch.put(boxUV(1.8, 0.45, 0.07, 1), P.woodLight, bx, y + 0.85, bz - 0.26, 0)
      for (const sx of [-0.8, 0.8]) T.batch.put(boxUV(0.08, 0.5, 0.5, 1), P.iron, bx + sx, y + 0.3, bz, 0)
      T.colliders.push({ kind: 'box', minX: bx - 0.95, maxX: bx + 0.95, minZ: bz - 0.35, maxZ: bz + 0.35, h: 0.9 })
    }
    T.batch.put(new THREE.CylinderGeometry(0.18, 0.26, 1.15, 10), P.stone, x, y + 0.6, z + 4.4)
    T.batch.put(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 8).rotateX(Math.PI / 2.4), P.gold, x, y + 1.35, z + 4.7)
    T.batch.put(new THREE.CylinderGeometry(0.1, 0.07, 0.3, 8).rotateX(Math.PI / 2.4), P.iron, x, y + 1.62, z + 5.05)
    T.colliders.push({ kind: 'circle', x, z: z + 4.4, r: 0.45, h: 1.3 })
    const plaque = new THREE.MeshStandardMaterial({ map: panelTexture('THE VALLEY', 'Chad City below · the castle above · the road between', 2.6, PANEL.purple, D), roughness: 0.6 })
    D.push(plaque)
    postedBoard(Frame.at(T.batch, x - 4.6, y, z + 1.2, Math.atan2(0.5, -1)), 1.7, 0.75, 1.1, plaque, SMt, true)
    T.colliders.push({ kind: 'circle', x: x - 4.6, z: z + 1.2, r: 0.7, h: 1.8 })
    for (const lx of [-5, 5]) {
      const px = x + lx
      const pz = z + 3.2
      T.batch.put(new THREE.CylinderGeometry(0.06, 0.09, 2.7, 6), P.iron, px, y + 1.35, pz)
      T.batch.put(new THREE.BoxGeometry(0.22, 0.3, 0.22), P.glowOrange, px, y + 2.85, pz, 0, 1, 1, 1, { cast: false })
      T.batch.put(new THREE.ConeGeometry(0.24, 0.2, 4).rotateY(Math.PI / 4), P.iron, px, y + 3.08, pz)
      T.lights.push({ x: px, y: y + 2.85, z: pz, color: '#ffb060', intensity: 4, dist: 11, priority: 2 })
      T.colliders.push({ kind: 'circle', x: px, z: pz, r: 0.22, h: 3 })
    }
  }

  /* ── the Moonspan Viaduct: arches on piers that meet the ravine floor, a deck with parapets, lanterns ── */
  {
    const s0 = VIADUCT.s0
    const s1 = VIADUCT.s1
    const span = 11
    const n = Math.max(2, Math.round((s1 - s0) / span))
    const sp = (s1 - s0) / n
    const pitch = -Math.atan(grade)
    const archMat = P.stoneLight
    for (let i = 0; i <= n; i++) {
      const p = DESCENT.pointAt(s0 + i * sp)
      const g = terrainHeight(p.x, p.z)
      const h = Math.max(1, p.y - g)
      const ang = Math.atan2(p.tx, p.tz)
      // pier: a tapering stone column, wider at the base, with a cap
      T.batch.put(boxUV(W + 0.6, h, 2.3, 2), P.stone, p.x, g + h / 2 - 0.4, p.z, ang)
      T.batch.put(boxUV(W + 1.4, 0.5, 3.1, 1.4), P.stoneLight, p.x, p.y - 0.95, p.z, ang)
      if (h > 2) T.batch.put(boxUV(W + 1.6, 0.9, 3.4, 1.4), P.stone, p.x, g + 0.2, p.z, ang)
      T.colliders.push({ kind: 'circle', x: p.x, z: p.z, r: 1.4, h: h })
    }
    for (let i = 0; i < n; i++) {
      const a = DESCENT.pointAt(s0 + i * sp)
      const b = DESCENT.pointAt(s0 + (i + 1) * sp)
      const mx = (a.x + b.x) / 2
      const mz = (a.z + b.z) / 2
      const my = (a.y + b.y) / 2
      const ang = Math.atan2(b.x - a.x, b.z - a.z)
      const len = Math.hypot(b.x - a.x, b.z - a.z)
      const rr = len / 2 - 1.1
      // the arch: a half-cylinder shell under the deck, plus the spandrel wall above it
      const spring = my - 2.0 - rr // the ring's outer crown meets the underside of the spandrel slab
      laid(T, archGeo(rr, 0.55, W + 0.5), archMat, mx, spring, mz, ang, 0)
      // the wall above the arch (the spandrel): a slab from the crown up to the deck, with the ring showing below it
      laid(T, boxUV(W + 0.6, 1.1, len, 2), P.stone, mx, my - 0.9 + 0.0, mz, ang, pitch)
      laid(T, boxUV(W + 1.0, 0.3, len + 0.2, 1.4), P.stoneLight, mx, my + 0.12, mz, ang, pitch)
      // the deck's surface and the parapets
      for (const side of [-1, 1]) {
        const ox = mx + Math.cos(ang) * side * (W / 2 + 0.3)
        const oz = mz - Math.sin(ang) * side * (W / 2 + 0.3)
        laid(T, boxUV(0.5, 1.0, len, 1.4), P.stoneLight, ox, my + 0.65, oz, ang, pitch)
        for (const e of [-1, 1]) {
          const fx = ox + Math.sin(ang) * e * (len / 2 - 0.3)
          const fz = oz + Math.cos(ang) * e * (len / 2 - 0.3)
          T.batch.put(boxUV(0.8, 1.5, 0.8, 1.4), P.stone, fx, my + 0.85, fz, ang)
          T.batch.put(new THREE.SphereGeometry(0.2, 8, 6), P.gold, fx, my + 1.75, fz)
        }
      }
    }
  }

  /* ── the City Gateway: stone piers either side of the road where it meets the avenue, an iron arch, gold lettering ── */
  {
    const gx = -3
    const gz = 415
    const y = VALLEY_Y
    const G = Frame.at(T.batch, gx, y, gz, Math.PI / 2) // local +z points east, toward the arriving walker
    const gold = new THREE.MeshStandardMaterial({ color: '#ffcf5a', metalness: 0.85, roughness: 0.3, ...(night ? { emissive: '#ff9a1a', emissiveIntensity: 0.8 } : {}) })
    D.push(gold)
    for (const sx of [-1, 1]) {
      G.put(boxUV(2.0, 6.6, 2.0, 1.6), P.stone, sx * 6.4, 3.3, 0)
      G.put(boxUV(2.5, 0.5, 2.5, 1.2), P.stoneLight, sx * 6.4, 6.85, 0)
      G.put(boxUV(2.4, 0.6, 2.4, 1.2), P.stoneLight, sx * 6.4, 0.3, 0)
      G.put(new THREE.ConeGeometry(1.5, 2.0, 4).rotateY(Math.PI / 4), P.stone, sx * 6.4, 8.3, 0)
      G.put(new THREE.SphereGeometry(0.28, 10, 8), gold, sx * 6.4, 9.5, 0)
      for (const sy of [-0.5, 0.5]) G.box(0.5, 0.8, 0.12, P.glowOrange, sx * 6.4, 5.0, sy * 2.1, false)
      T.colliders.push({ kind: 'box', minX: gx - 1.3, maxX: gx + 1.3, minZ: gz + sx * 6.4 - 1.3, maxZ: gz + sx * 6.4 + 1.3, h: 7 })
      T.lights.push({ x: gx + 1.4, y: y + 5.0, z: gz + sx * 6.4, color: '#ffb060', intensity: 5, dist: 12, priority: 3 })
    }
    // the arch: an iron span with scrollwork and a lantern, carrying a gold name
    const arch = new THREE.TorusGeometry(6.4, 0.16, 8, 32, Math.PI)
    G.put(arch, P.iron, 0, 6.6, 0)
    G.put(new THREE.TorusGeometry(5.4, 0.1, 8, 32, Math.PI), P.iron, 0, 6.6, 0)
    G.box(12.8, 0.18, 0.4, P.iron, 0, 6.65, 0)
    for (let k = -5; k <= 5; k++) G.box(0.06, 0.9 + Math.abs(Math.cos((k / 5) * 1.2)) * 0.4, 0.06, P.iron, k * 1.1, 7.4, 0)
    G.box(7.2, 1.3, 0.3, P.iron, 0, 8.4, 0)
    G.box(7.4, 0.12, 0.4, P.gold, 0, 7.72, 0)
    G.box(7.4, 0.12, 0.4, P.gold, 0, 9.08, 0)
    channelLetters(G.sub(0, 8.0, 0.2), 'CHAD CITY', 0.8, 0.22, gold)
    channelLetters(G.sub(0, 8.0, -0.2, 0, Math.PI, 0), 'CHAD CITY', 0.8, 0.22, gold)
    // a lantern hanging at the crown
    G.put(new THREE.BoxGeometry(0.34, 0.44, 0.34), P.glowOrange, 0, 5.5, 0, 0, 0, 0, false)
  }

  /* ── autumn trees and rock outcrops on the banks (instanced, cheap) ── */
  {
    const trunk = new THREE.CylinderGeometry(0.16, 0.26, 3.2, 6)
    trunk.translate(0, 1.6, 0)
    // a layered crown: three flattened tiers, so it reads as branches of foliage and not one ball
    const tier = (r: number, y: number) => new THREE.SphereGeometry(r, 9, 6).scale(1, 0.55, 1).translate(0, y, 0)
    const crown = (() => {
      const parts = [tier(2.1, 3.6), tier(1.6, 4.5), tier(1.0, 5.3), tier(1.2, 3.2).translate(1.1, 0, 0.3), tier(1.1, 3.4).translate(-1.0, 0, -0.5)]
      const geo = new THREE.BufferGeometry()
      let pos: number[] = []
      for (const p of parts) pos = pos.concat(Array.from((p.toNonIndexed().attributes.position as THREE.BufferAttribute).array))
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      geo.computeVertexNormals()
      parts.forEach((p) => p.dispose())
      return geo
    })()
    const rock = new THREE.DodecahedronGeometry(1, 0)
    const trees: THREE.Matrix4[] = []
    const colours: THREE.Color[] = []
    const rocks: THREE.Matrix4[] = []
    const palette = ['#b8561c', '#c8781c', '#8a5a1c', '#6f8a3a', '#a8321f', '#d89a2a']
    const nTree = q === 'low' ? 50 : q === 'medium' ? 110 : 170
    for (let i = 0; i < nTree * 14 && (trees.length < nTree || rocks.length < nTree / 2); i++) {
      const s = R() * DESCENT_LEN
      const p = DESCENT.pointAt(s)
      const side = R() < 0.5 ? -1 : 1
      const off = (DESCENT_W / 2 + 3 + R() * 22) * side
      const x = p.x - p.tz * off
      const z = p.z + p.tx * off
      if (z < 92 || z > 410) continue
      if (s > VIADUCT.s0 - 6 && s < VIADUCT.s1 + 6) continue
      const nn = DESCENT.nearest(x, z)
      if (nn.d < DESCENT_W / 2 + 2.4) continue
      if (Math.hypot(x - OVERLOOK.x, z - OVERLOOK.z) < OVERLOOK.r + 4) continue
      const gy = terrainHeight(x, z)
      if (Math.abs(gy - nn.y) > 9 && R() < 0.7) continue
      const m = new THREE.Matrix4()
      if (R() < 0.72 && trees.length < nTree) {
        const sc = 0.7 + R() * 0.9
        m.compose(new THREE.Vector3(x, gy - 0.15, z), new THREE.Quaternion().setFromAxisAngle(Y, R() * 6), new THREE.Vector3(sc, sc * (0.85 + R() * 0.5), sc))
        trees.push(m)
        colours.push(new THREE.Color(palette[Math.floor(R() * palette.length)]))
      } else if (rocks.length < nTree / 2) {
        const sc = 0.6 + R() * 1.8
        m.compose(new THREE.Vector3(x, gy + sc * 0.2, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(R() * 3, R() * 3, R() * 3)), new THREE.Vector3(sc * 1.4, sc * 0.8, sc))
        rocks.push(m)
      }
    }
    const leafMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92, flatShading: true })
    D.push(leafMat, crown, trunk, rock)
    const place = (geo: THREE.BufferGeometry, mat: THREE.Material, list: THREE.Matrix4[], cols?: THREE.Color[]) => {
      if (!list.length) return
      const im = new THREE.InstancedMesh(geo, mat, list.length)
      list.forEach((m, i) => {
        im.setMatrixAt(i, m)
        if (cols) im.setColorAt(i, cols[i])
      })
      im.castShadow = false
      im.computeBoundingSphere()
      T.scene.add(im)
    }
    place(crown, leafMat, trees, colours)
    place(trunk, P.bark, trees)
    place(rock, P.rock, rocks)
  }
}
