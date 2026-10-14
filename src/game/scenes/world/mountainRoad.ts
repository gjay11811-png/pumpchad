import * as THREE from 'three'
import type { Town } from './buildings'
import { boxUV, rng } from './kit'
import { Frame, PANEL, framedBoard, panelTexture, postedBoard, type SignMats } from './signs'
import { terrainHeight } from './city'
import { GATE_PLAZA, HAIRPINS, MOAT, ROAD, ROAD_LEN, ROAD_W, SUMMIT, hillRise, roadNearest } from './mountain'

/**
 * THE CASTLE ROAD — everything on and beside the switchback road up Citadel Mountain: the Gate Plaza at its foot (paving,
 * a gate arch, lamps, benches, a trail board), the cobbled road ribbon, retaining walls where the ground falls away or
 * rises beside it, a parapet along both edges, lanterns, buttresses at the hairpins, the moat bridge to the castle gate, and
 * the pines + boulders on the slopes. The road's geometry itself lives in mountain.ts.
 */
const ID = new THREE.Matrix4()

type Sample = { x: number; z: number; y: number; tx: number; tz: number; s: number }
/** a point on the road centreline at arc length s, with its unit tangent */
function pointAt(s: number): Sample {
  const c = Math.min(Math.max(s, 0), ROAD_LEN)
  let i = 1
  while (i < ROAD.length - 1 && ROAD[i].s < c) i++
  const a = ROAD[i - 1]
  const b = ROAD[i]
  const t = b.s > a.s ? (c - a.s) / (b.s - a.s) : 0
  const L = Math.hypot(b.x - a.x, b.z - a.z) || 1
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, y: a.y + (b.y - a.y) * t, tx: (b.x - a.x) / L, tz: (b.z - a.z) / L, s: c }
}

export const CASTLE_ROAD_LANTERNS: { x: number; y: number; z: number }[] = []

export function castleRoad(T: Town, q: 'low' | 'medium' | 'high') {
  const P = T.P
  const D = T.disposables
  const SMt: SignMats = { frame: P.iron, metal: P.iron, gold: P.gold, stone: P.stoneLight }

  /* ── Gate Plaza: paving, a gate arch the road passes through, lamps, benches, a trail board ── */
  {
    const { x0, x1, z0, z1 } = GATE_PLAZA
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2)
    const u = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < u.count; i++) u.setXY(i, (u.getX(i) * (x1 - x0)) / 3, (u.getY(i) * (z1 - z0)) / 3)
    T.batch.put(g, P.cobble, (x0 + x1) / 2, 0.026, (z0 + z1) / 2, 0, 1, 1, 1, { cast: false })
    for (const [r, m] of [[5.6, P.stoneLight], [5.2, P.gold]] as const) T.batch.put(new THREE.RingGeometry(r - 0.14, r, 40).rotateX(-Math.PI / 2), m, 22, 0.035, -62, 0, 1, 1, 1, { cast: false })
    // a small stone fountain in the middle of the paved ring
    T.batch.put(new THREE.CylinderGeometry(2.0, 2.2, 0.7, 24), P.stone, 22, 0.35, -62)
    T.batch.put(new THREE.CylinderGeometry(1.7, 1.7, 0.1, 24), P.glowTeal, 22, 0.66, -62, 0, 1, 1, 1, { cast: false })
    T.batch.put(new THREE.CylinderGeometry(0.22, 0.3, 1.5, 10), P.stone, 22, 1.2, -62)
    T.batch.put(new THREE.SphereGeometry(0.34, 12, 8), P.gold, 22, 2.05, -62)
    T.colliders.push({ kind: 'circle', x: 22, z: -62, r: 2.2, h: 1.2 })
    // the gate: two piers + a lintel arch over the road mouth, open iron leaves, a name board
    const G = Frame.at(T.batch, 10, 0, -58.5, 0)
    for (const sx of [-1, 1]) {
      G.put(boxUV(1.3, 5.6, 1.3, 1.6), P.stone, sx * 3.7, 2.8, 0)
      G.put(new THREE.ConeGeometry(0.95, 1.4, 4).rotateY(Math.PI / 4), P.stoneLight, sx * 3.7, 6.3, 0)
      G.put(new THREE.SphereGeometry(0.16, 8, 6), P.gold, sx * 3.7, 7.1, 0)
      for (let k = 0; k < 4; k++) G.box(0.05, 3.6, 0.05, P.iron, sx * (3.0 - k * 0.5), 2.0, 0.1) // gate leaf thrown open, against the pier
      T.colliders.push({ kind: 'box', minX: 10 + sx * 3.7 - 0.7, maxX: 10 + sx * 3.7 + 0.7, minZ: -58.5 - 0.7, maxZ: -58.5 + 0.7, h: 6 })
    }
    const arch = new THREE.Shape()
    arch.moveTo(-3.7, 4.4)
    arch.lineTo(3.7, 4.4)
    arch.lineTo(3.7, 5.4)
    arch.lineTo(-3.7, 5.4)
    arch.closePath()
    G.put(boxUV(8.2, 1.0, 1.0, 1.6), P.stone, 0, 4.9, 0)
    G.box(8.6, 0.12, 1.2, P.gold, 0, 5.46, 0)
    const board = new THREE.MeshStandardMaterial({ map: panelTexture('THE CASTLE ROAD', 'to the mountain castle · lanterns lit', 3.4, PANEL.dark, D), roughness: 0.6 })
    D.push(board)
    framedBoard(G.sub(0, 4.9, 0.55), 3.0, 0.7, board, SMt, true)
    // trail board + benches + lamps
    const trail = new THREE.MeshStandardMaterial({ map: panelTexture('CASTLE ROAD', 'eight hairpins · ~480 m · lantern-lit all the way', 1.9, PANEL.purple, D), roughness: 0.7 })
    D.push(trail)
    postedBoard(Frame.at(T.batch, 3, 0, -54, 0.3), 1.5, 0.8, 1.2, trail, SMt, true)
    T.colliders.push({ kind: 'circle', x: 3, z: -54, r: 0.8, h: 1.8 })
    for (const bx of [16, 28]) {
      const B = Frame.at(T.batch, bx, 0, -55.2, Math.PI)
      B.box(1.6, 0.08, 0.5, P.woodLight, 0, 0.5, 0)
      B.box(1.6, 0.4, 0.06, P.woodLight, 0, 0.75, -0.24)
      for (const sx of [-0.7, 0.7]) B.box(0.08, 0.5, 0.45, P.iron, sx, 0.25, 0)
      T.colliders.push({ kind: 'box', minX: bx - 0.9, maxX: bx + 0.9, minZ: -55.5, maxZ: -54.9, h: 0.8 })
    }
  }

  /* ── the road surface: one cobbled ribbon along the centreline, a thin gold line down each edge ── */
  {
    const pos: number[] = []
    const uv: number[] = []
    const idx: number[] = []
    const edge: number[][] = [[], []]
    const step = 1.5
    let n = 0
    for (let s = 0; s <= ROAD_LEN + 0.01; s += step) {
      const p = pointAt(s)
      const nx = -p.tz
      const nz = p.tx
      for (const side of [-1, 1]) {
        pos.push(p.x + nx * side * (ROAD_W / 2), p.y + 0.045, p.z + nz * side * (ROAD_W / 2))
        uv.push(side < 0 ? 0 : ROAD_W / 3, p.s / 3)
      }
      for (const [k, side] of [[0, -1], [1, 1]] as const) edge[k].push(p.x + nx * side * (ROAD_W / 2 - 0.12), p.y + 0.06, p.z + nz * side * (ROAD_W / 2 - 0.12))
      if (n > 0) {
        const a = (n - 1) * 2
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
      }
      n++
    }
    const rg = new THREE.BufferGeometry()
    rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    rg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    rg.setIndex(idx)
    rg.computeVertexNormals()
    // make sure the ribbon faces up whichever way the strip winds
    const nm = rg.attributes.normal as THREE.BufferAttribute
    if (nm.getY(0) < 0) rg.setIndex(idx.map((_, i) => idx[i % 3 === 0 ? i : i % 3 === 1 ? i + 1 : i - 1]))
    rg.computeVertexNormals()
    T.batch.add(rg, P.cobble, ID, { cast: false })
    for (const k of [0, 1]) {
      const e = edge[k]
      for (let i = 3; i < e.length; i += 3) {
        const a = new THREE.Vector3(e[i - 3], e[i - 2], e[i - 1])
        const b = new THREE.Vector3(e[i], e[i + 1], e[i + 2])
        const len = a.distanceTo(b)
        if (len < 0.01) continue
        const m = new THREE.Matrix4().lookAt(a, b, new THREE.Vector3(0, 1, 0))
        const mid = a.clone().add(b).multiplyScalar(0.5)
        const geo = new THREE.BoxGeometry(0.08, 0.02, len + 0.02)
        T.batch.add(geo, P.gold, new THREE.Matrix4().compose(mid, new THREE.Quaternion().setFromRotationMatrix(m), new THREE.Vector3(1, 1, 1)), { cast: false })
        geo.dispose()
      }
    }
  }

  /* ── retaining walls + the edge parapet, every ~3 m on both sides; buttresses at the hairpins ── */
  {
    const step = 3.2
    const isHairpin = (x: number, z: number) => HAIRPINS.some((h) => Math.hypot(x - h.x, z - h.z) < 6.5)
    for (let s = step / 2; s < ROAD_LEN; s += step) {
      const p = pointAt(s)
      const nx = -p.tz
      const nz = p.tx
      const ang = Math.atan2(p.tx, p.tz)
      for (const side of [-1, 1]) {
        const ex = p.x + nx * side * (ROAD_W / 2 + 0.15)
        const ez = p.z + nz * side * (ROAD_W / 2 + 0.15)
        const ox = p.x + nx * side * (ROAD_W / 2 + 3.4)
        const oz = p.z + nz * side * (ROAD_W / 2 + 3.4)
        const drop = p.y - terrainHeight(ox, oz) // + falls away, − rises
        // the low parapet along the edge (kerb on the uphill side, a real wall on the drop side)
        const ph = drop > 0.8 ? 0.62 : 0.3
        T.batch.put(boxUV(0.44, ph, step + 0.1, 1.4), P.stoneLight, ex, p.y + ph / 2, ez, ang)
        if (drop > 0.8) {
          // retaining wall below the parapet, down to where the slope takes over
          const h = Math.min(3, Math.max(1.2, drop * 0.5 + 0.6))
          T.batch.put(boxUV(0.7, h, step + 0.1, 2), P.stone, ex + nx * side * 0.1, p.y - h / 2, ez + nz * side * 0.1, ang)
          if (isHairpin(p.x, p.z) && Math.round(s / step) % 2 === 0) {
            T.batch.put(boxUV(0.9, h + 0.2, 0.9, 2), P.stone, ex + nx * side * 0.75, p.y - h / 2 - 0.05, ez + nz * side * 0.75, ang) // buttress
            T.batch.put(new THREE.ConeGeometry(0.5, 0.55, 4).rotateY(Math.PI / 4), P.stoneLight, ex + nx * side * 0.75, p.y + 0.3, ez + nz * side * 0.75)
          }
        } else if (drop < -0.8) {
          // cut wall: the hillside held back on the uphill side
          const h = Math.min(2, Math.max(0.7, -drop * 0.4 + 0.4))
          T.batch.put(boxUV(0.5, h, step + 0.1, 2), P.stone, ex + nx * side * 0.05, p.y + h / 2, ez + nz * side * 0.05, ang)
        }
      }
    }
  }

  /* ── lanterns: a post every ~15 m, alternating sides, a warm light each; twin lanterns at every hairpin apex ── */
  {
    const post = new THREE.CylinderGeometry(0.06, 0.09, 2.7, 6)
    const cap = new THREE.ConeGeometry(0.24, 0.2, 4).rotateY(Math.PI / 4)
    const glow = new THREE.BoxGeometry(0.22, 0.3, 0.22)
    const lantern = (x: number, y: number, z: number) => {
      T.batch.put(post, P.iron, x, y + 1.35, z)
      T.batch.put(glow, P.glowOrange, x, y + 2.85, z, 0, 1, 1, 1, { cast: false })
      T.batch.put(cap, P.iron, x, y + 3.08, z, 0, 1, 1, 1, { cast: false })
      T.lights.push({ x, y: y + 2.85, z, color: '#ffb060', intensity: 3.4, dist: 9, priority: 1 })
      CASTLE_ROAD_LANTERNS.push({ x, y: y + 2.85, z })
    }
    let side = 1
    for (let s = 10; s < ROAD_LEN - 8; s += 15) {
      const p = pointAt(s)
      const near = HAIRPINS.some((h) => Math.hypot(p.x - h.x, p.z - h.z) < 6)
      if (near) continue
      lantern(p.x - p.tz * side * (ROAD_W / 2 - 0.05), p.y, p.z + p.tx * side * (ROAD_W / 2 - 0.05))
      side = -side
    }
    for (const h of HAIRPINS) {
      const r = roadNearest(h.x, h.z)
      const p = pointAt(r.s)
      lantern(p.x - p.tz * (ROAD_W / 2 - 0.05), p.y, p.z + p.tx * (ROAD_W / 2 - 0.05))
      lantern(p.x + p.tz * (ROAD_W / 2 - 0.05), p.y, p.z - p.tx * (ROAD_W / 2 - 0.05))
    }
  }

  /* ── the moat bridge: a stone arch carrying the road over the dry ditch to the gatehouse ── */
  {
    const zc = SUMMIT.z + (MOAT.r0 + MOAT.r1) / 2 // the middle of the ditch (the road runs along x = SUMMIT.x)
    const span = MOAT.r1 - MOAT.r0 + 3
    const y = SUMMIT.y
    const B = Frame.at(T.batch, SUMMIT.x, 0, zc, 0)
    B.put(boxUV(ROAD_W + 0.8, 0.7, span, 2), P.stone, 0, y - 0.38, 0) // deck
    B.put(boxUV(ROAD_W + 0.6, 0.06, span, 2), P.cobble, 0, y + 0.02, 0, 0, 0, 0, false)
    for (const sz of [-1, 1]) {
      B.put(boxUV(ROAD_W + 1.2, MOAT.depth + 1.4, 1.6, 2), P.stone, 0, y - (MOAT.depth + 1.4) / 2 - 0.2, sz * (span / 2 - 0.5)) // abutments
    }
    // the arch under the deck (a half cylinder lying along z)
    const archR = ROAD_W / 2
    B.put(new THREE.CylinderGeometry(archR, archR, span - 3, 20, 1, true, 0, Math.PI).rotateX(Math.PI / 2).rotateY(Math.PI / 2), P.stoneLight, 0, y - 0.7, 0)
    for (const sx of [-1, 1]) {
      B.put(boxUV(0.5, 0.9, span, 1.6), P.stoneLight, sx * (ROAD_W / 2 + 0.2), y + 0.45, 0) // parapets
      for (const sz of [-1, 1]) {
        B.put(boxUV(0.8, 1.5, 0.8, 1.4), P.stone, sx * (ROAD_W / 2 + 0.2), y + 0.75, sz * (span / 2 - 0.3))
        B.put(new THREE.SphereGeometry(0.2, 8, 6), P.gold, sx * (ROAD_W / 2 + 0.2), y + 1.65, sz * (span / 2 - 0.3))
      }
    }
  }

  /* ── pines + boulders on the slopes (never near the road or on the plateau) ── */
  {
    const R = rng(4242)
    const n = q === 'low' ? 60 : q === 'medium' ? 120 : 200
    const cone = new THREE.ConeGeometry(1.7, 6, 7)
    cone.translate(0, 4.6, 0)
    const trunk = new THREE.CylinderGeometry(0.18, 0.26, 2, 5)
    trunk.translate(0, 1, 0)
    const rock = new THREE.IcosahedronGeometry(1, 0)
    const trees: THREE.Matrix4[] = []
    const rocks: THREE.Matrix4[] = []
    for (let i = 0; i < n * 12 && (trees.length < n || rocks.length < n / 2); i++) {
      const x = -60 + R() * 130
      const z = -80 - R() * 170
      const r = Math.hypot(x - SUMMIT.x, z - SUMMIT.z)
      if (r < SUMMIT.r + 12) continue
      const { y: hy, d } = hillRise(x, z)
      if (hy < 1.5 || d < ROAD_W / 2 + 4) continue
      const y = terrainHeight(x, z)
      if (y < 1) continue
      const m = new THREE.Matrix4()
      if (R() < 0.7 && trees.length < n) {
        const sc = 0.8 + R() * 1.0
        m.compose(new THREE.Vector3(x, y - 0.2, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6), new THREE.Vector3(sc, sc * (0.9 + R() * 0.5), sc))
        trees.push(m)
      } else if (rocks.length < n / 2) {
        const sc = 0.7 + R() * 1.6
        m.compose(new THREE.Vector3(x, y + sc * 0.25, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(R() * 3, R() * 3, R() * 3)), new THREE.Vector3(sc * 1.3, sc * 0.8, sc))
        rocks.push(m)
      }
    }
    for (const [geo, mat, list] of [[cone, P.foliageDark, trees], [trunk, P.bark, trees], [rock, P.stone, rocks]] as const) {
      if (!list.length) continue
      const im = new THREE.InstancedMesh(geo, mat, list.length)
      list.forEach((m, i) => im.setMatrixAt(i, m))
      im.castShadow = false
      im.computeBoundingSphere()
      T.scene.add(im)
      D.push(geo)
    }
  }
}
