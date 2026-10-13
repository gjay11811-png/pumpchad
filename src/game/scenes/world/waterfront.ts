import * as THREE from 'three'
import type { Town } from './buildings'
import { BRIDGES, CANAL } from './city'
import { waterMaterial } from './fountain'
import { boxUV } from './kit'
import { Frame, boardTexture, plaque } from './signs'

/**
 * The canal: open water south of the old town, stone embankments with coping, iron railings on alpha cards
 * (cheap), paved promenades on both banks, CHAD BRIDGE (an arched stone bridge carrying the avenue) and two
 * timber footbridges on steel stringers. Collision: the water between bridges is solid, so nobody can fall in.
 */

/** a railing texture: top + bottom rail, round-topped balusters (alpha-tested, one quad per run) */
export function railingMaterial(D: (THREE.Material | THREE.Texture | THREE.BufferGeometry)[]) {
  const m = new THREE.MeshStandardMaterial({ map: railingTexture(D), alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.45, color: '#ffffff' })
  D.push(m)
  return m
}
function railingTexture(D: (THREE.Material | THREE.Texture | THREE.BufferGeometry)[]) {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#2b2a30'
  g.fillRect(0, 0, 128, 10) // top rail
  g.fillRect(0, 112, 128, 8) // bottom rail
  for (let x = 8; x < 128; x += 16) {
    g.fillRect(x - 2, 10, 4, 102)
    g.beginPath()
    g.arc(x, 60, 5, 0, Math.PI * 2)
    g.fill()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  D.push(t)
  return t
}

export function waterfront(T: Town, waterNormal: THREE.Texture, stoneMat: THREE.Material, trimMat: THREE.Material, rail: THREE.Material) {
  const P = T.P
  const D = T.disposables
  const { x0, x1, z0, z1 } = CANAL
  const W = waterMaterial(waterNormal, D)
  W.material.roughness = 0.16 // a softer sun glint on the open canal (no bloom blowout)

  // ── water: one plane, world-scale UVs so the ripples match the fountain ──
  const wg = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2)
  const uv = wg.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * (x1 - x0)) / 5, (uv.getY(i) * (z1 - z0)) / 5)
  const water = new THREE.Mesh(wg, W.material)
  water.position.set((x0 + x1) / 2, CANAL.water, (z0 + z1) / 2)
  water.receiveShadow = true
  T.scene.add(water)
  D.push(wg)
  T.dynamic.push({ update: (t) => (W.time.value = t) })

  // ── embankments: stone walls down to the canal floor, coping stones on top, end walls ──
  const depth = 0.08 - CANAL.floor
  for (const [z, s] of [[z0, -1], [z1, 1]] as const) {
    T.batch.put(boxUV(x1 - x0 + 0.8, depth, 0.5, 1.6), stoneMat, (x0 + x1) / 2, CANAL.floor + depth / 2, z + s * 0.25)
    T.batch.put(boxUV(x1 - x0 + 0.9, 0.14, 0.7, 1.2), trimMat, (x0 + x1) / 2, 0.07, z + s * 0.2)
    // mooring rings + a darker tide line on the wall face
    for (let x = x0 + 3; x < x1 - 2; x += 7) T.batch.put(new THREE.TorusGeometry(0.12, 0.02, 6, 12), P.iron, x, -0.32, z - s * 0.02)
  }
  for (const x of [x0, x1]) {
    T.batch.put(boxUV(0.5, depth, z1 - z0 + 1, 1.6), stoneMat, x + (x < 0 ? -0.25 : 0.25), CANAL.floor + depth / 2, (z0 + z1) / 2)
    T.batch.put(boxUV(0.7, 0.14, z1 - z0 + 1.4, 1.2), trimMat, x + (x < 0 ? -0.2 : 0.2), 0.07, (z0 + z1) / 2)
  }
  const tide = new THREE.MeshStandardMaterial({ color: '#3a4a3c', roughness: 0.9, transparent: true, opacity: 0.35, depthWrite: false })
  D.push(tide)
  for (const [z, s] of [[z0, 1], [z1, -1]] as const) T.batch.put(new THREE.PlaneGeometry(x1 - x0, 0.35), tide, (x0 + x1) / 2, CANAL.water + 0.12, z + s * 0.004, s > 0 ? 0 : Math.PI, 1, 1, 1, { cast: false })

  // ── railings along both banks and the ends, broken by the bridges; stone pillars every few metres ──
  const gaps = BRIDGES.map((b) => [b.x - b.w / 2 - 0.3, b.x + b.w / 2 + 0.3] as const)
  const runs: [number, number][] = []
  let start = x0 - 0.3
  for (const [a, b] of gaps) {
    runs.push([start, a])
    start = b
  }
  runs.push([start, x1 + 0.3])
  for (const z of [z0 - 0.35, z1 + 0.35])
    for (const [a, b] of runs) {
      const len = b - a
      const g = new THREE.PlaneGeometry(len, 0.92)
      const u = g.attributes.uv as THREE.BufferAttribute
      for (let i = 0; i < u.count; i++) u.setX(i, (u.getX(i) * len) / 0.9)
      T.batch.put(g, rail, (a + b) / 2, 0.6, z, 0, 1, 1, 1, { cast: false })
      const n = Math.max(1, Math.round(len / 3.2))
      for (let k = 0; k <= n; k++) {
        const x = a + (len * k) / n
        T.batch.put(boxUV(0.3, 1.05, 0.3, 1), stoneMat, x, 0.6, z)
        T.batch.put(boxUV(0.4, 0.1, 0.4, 1), trimMat, x, 1.17, z)
      }
    }
  for (const x of [x0 - 0.35, x1 + 0.35]) {
    const g = new THREE.PlaneGeometry(z1 - z0 + 0.7, 0.92)
    T.batch.put(g, rail, x, 0.6, (z0 + z1) / 2, Math.PI / 2, 1, 1, 1, { cast: false })
  }
  // solid water between the bridges (camera passes over: low height)
  const edges = [x0 - 0.4, ...BRIDGES.flatMap((b) => [b.x - b.w / 2 + 0.25, b.x + b.w / 2 - 0.25]).sort((a, b) => a - b), x1 + 0.4]
  for (let i = 0; i < edges.length; i += 2) T.colliders.push({ kind: 'box', minX: edges[i], maxX: edges[i + 1], minZ: z0 - 0.45, maxZ: z1 + 0.45, h: 0.95 })
  // promenade paving strips on both banks
  for (const [z, w] of [[z0 - 2.0, 3.2], [z1 + 1.6, 2.4]] as const) {
    const g = new THREE.PlaneGeometry(x1 - x0 + 2, w).rotateX(-Math.PI / 2)
    const u = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < u.count; i++) u.setXY(i, (u.getX(i) * (x1 - x0 + 2)) / 3, (u.getY(i) * w) / 3)
    T.batch.put(g, P.cobble, (x0 + x1) / 2, 0.022, z, 0, 1, 1, 1, { cast: false })
  }

  // ── CHAD BRIDGE: arched stone body (extruded side elevation), parapets that follow the deck, lamps, plaque ──
  for (const b of BRIDGES) {
    const za = z0 - 0.6
    const zb = z1 + 0.6
    const L = zb - za
    const deck = (z: number) => Math.sin(((z - za) / L) * Math.PI) * b.rise
    const N = 14
    const main = b.w > 4
    if (main) {
      // side elevation: deck line on top, segmental arch underneath (water shows through), footings at the banks
      const s = new THREE.Shape()
      const zs: number[] = []
      for (let i = 0; i <= N; i++) zs.push(za + (L * i) / N)
      s.moveTo(-za, CANAL.floor)
      zs.forEach((z) => s.lineTo(-z, deck(z) - 0.02))
      s.lineTo(-zb, CANAL.floor)
      s.lineTo(-(z1 + 0.05), CANAL.floor)
      for (let i = 0; i <= N; i++) {
        const t = i / N
        const z = z1 + 0.05 - t * (z1 - z0 + 0.1)
        s.lineTo(-z, CANAL.water - 0.05 + Math.sin(t * Math.PI) * 0.66)
      }
      s.lineTo(-(z0 - 0.05), CANAL.floor)
      s.closePath()
      const body = new THREE.ExtrudeGeometry(s, { depth: b.w, bevelEnabled: false, curveSegments: 1 })
      body.rotateY(Math.PI / 2)
      const bu = body.attributes.uv as THREE.BufferAttribute
      for (let i = 0; i < bu.count; i++) bu.setXY(i, bu.getX(i) / 1.6, bu.getY(i) / 1.6)
      T.batch.put(body, stoneMat, b.x - b.w / 2, 0, 0)
      // arch ring (voussoirs) on both faces + keystone
      for (const side of [-1, 1]) {
        for (let i = 0; i < 9; i++) {
          const t = (i + 0.5) / 9
          const z = z0 - 0.05 + t * (z1 - z0 + 0.1)
          const y = CANAL.water - 0.05 + Math.sin(t * Math.PI) * 0.66
          const slope = Math.cos(t * Math.PI) * 0.66 * (Math.PI / (z1 - z0))
          const g = new THREE.BoxGeometry(0.06, 0.32, (z1 - z0) / 9 - 0.04)
          g.rotateX(-Math.atan(slope))
          T.batch.put(g, i === 4 ? P.gold : trimMat, b.x + side * (b.w / 2 + 0.02), y + 0.14, z)
        }
      }
    }
    // deck: segments following the rise (paving on the main bridge, planks on the footbridges)
    for (let i = 0; i < N; i++) {
      const za0 = za + (L * i) / N
      const zb0 = za + (L * (i + 1)) / N
      const zm = (za0 + zb0) / 2
      const slope = Math.atan2(deck(zb0) - deck(za0), zb0 - za0)
      const seg = new THREE.BoxGeometry(b.w, main ? 0.3 : 0.12, zb0 - za0 + 0.02)
      seg.rotateX(-slope)
      T.batch.put(seg, main ? P.cobble : P.woodLight, b.x, deck(zm) - (main ? 0.15 : 0.06), zm, 0, 1, 1, 1, { cast: !main })
      if (!main) {
        // steel stringers under the timber deck
        for (const sx of [-1, 1]) {
          const st = new THREE.BoxGeometry(0.12, 0.28, zb0 - za0 + 0.02)
          st.rotateX(-slope)
          T.batch.put(st, P.iron, b.x + sx * (b.w / 2 - 0.12), deck(zm) - 0.26, zm)
        }
      }
      // parapets / railings following the deck
      for (const sx of [-1, 1]) {
        if (main) {
          const pg = boxUV(0.4, 0.9, zb0 - za0 + 0.02, 1.2)
          pg.rotateX(-slope)
          T.batch.put(pg, stoneMat, b.x + sx * (b.w / 2 - 0.2), deck(zm) + 0.45, zm)
          const cg = boxUV(0.5, 0.1, zb0 - za0 + 0.04, 1.2)
          cg.rotateX(-slope)
          T.batch.put(cg, trimMat, b.x + sx * (b.w / 2 - 0.2), deck(zm) + 0.95, zm)
        } else {
          const rg = new THREE.PlaneGeometry(zb0 - za0 + 0.02, 0.9)
          rg.rotateX(0) // plane in XY → rotate to face sideways
          rg.rotateY(Math.PI / 2)
          rg.rotateX(-slope)
          T.batch.put(rg, rail, b.x + sx * (b.w / 2 - 0.05), deck(zm) + 0.5, zm, 0, 1, 1, 1, { cast: false })
          if (i % 3 === 0) T.batch.put(new THREE.BoxGeometry(0.08, 1.0, 0.08), P.iron, b.x + sx * (b.w / 2 - 0.05), deck(za0) + 0.5, za0)
        }
      }
    }
    if (!main) {
      // abutment pads on each bank (the timber deck lands on stone, not on grass)
      for (const z of [za, zb]) T.batch.put(boxUV(b.w + 0.4, 0.2, 0.9, 1), stoneMat, b.x, 0.06, z)
      for (const z of [za, zb]) for (const sx of [-1, 1]) T.batch.put(new THREE.BoxGeometry(0.1, 1.05, 0.1), P.iron, b.x + sx * (b.w / 2 - 0.05), 0.52, z)
    }
    // bridge-end pillars with lanterns (main bridge), and the side walls of the deck are solid for the player
    if (main) {
      for (const z of [za - 0.2, zb + 0.2])
        for (const sx of [-1, 1]) {
          const x = b.x + sx * (b.w / 2 + 0.1)
          T.batch.put(boxUV(0.7, 1.4, 0.7, 1), stoneMat, x, 0.7, z)
          T.batch.put(boxUV(0.85, 0.14, 0.85, 1), trimMat, x, 1.47, z)
          T.batch.put(new THREE.CylinderGeometry(0.07, 0.09, 1.6, 8), P.iron, x, 2.3, z)
          T.batch.put(new THREE.BoxGeometry(0.3, 0.4, 0.3), P.iron, x, 3.25, z)
          T.batch.put(new THREE.BoxGeometry(0.22, 0.3, 0.22), P.glowGold, x, 3.25, z, 0, 1, 1, 1, { cast: false })
          T.batch.put(new THREE.ConeGeometry(0.26, 0.22, 4).rotateY(Math.PI / 4), P.iron, x, 3.56, z)
          T.colliders.push({ kind: 'circle', x, z, r: 0.5, h: 3.5 })
        }
      // name plaques on the north-end pillars
      const face = new THREE.MeshStandardMaterial({ map: boardTexture('CHAD BRIDGE', ['over the Pump Canal', 'built to carry heavy lifts'], 1.6, { bg: '#7a5a2a', ink: '#ffe9b8', sub: '#f6e2b4', rule: '#e0b860' }, D, true), metalness: 0.7, roughness: 0.4 })
      D.push(face)
      for (const sx of [-1, 1]) {
        const F = Frame.at(T.batch, b.x + sx * (b.w / 2 + 0.1), 0.85, za - 0.2 - 0.36, Math.PI)
        plaque(F, 0.56, 0.35, face, { frame: P.iron, metal: P.iron, gold: P.gold, stone: stoneMat })
      }
    }
  }
}
