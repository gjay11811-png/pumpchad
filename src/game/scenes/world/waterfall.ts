import * as THREE from 'three'
import type { Town } from './buildings'
import { waterMaterial } from './fountain'
import { rng } from './kit'
import { softDot } from './textures'
import { ribbon } from './wilds'
import { boxUV } from './kit'

/**
 * THE ENCHANTED FOREST'S WATERFALL — a spring-fed brook comes out of a crack in a mossy rock mass at the forest's north-east edge, runs over a flat stone lip and falls 7.6 m
 * in a bowed sheet into a rock-rimmed plunge pool; mist rises from the foot, foam ripples the surface, and the pool's overflow runs away south-west as a shallow stream
 * under a plank footbridge where the forest's loop path crosses it. A short branch path leads to a viewing spot with a bench. Everything static goes through the batch;
 * the falling sheet, the pool, the foam and the mist are the only moving parts (all driven by the town's clock).
 */
export const WATERFALL = {
  x: -49,
  z: -60,
  poolR: 4.4,
  cliffZ: -63.2, // the rock face the water leaves (north of the pool)
  height: 7.6,
  view: { x: -50.6, z: -54.2 },
  /** the footbridge where the loop path crosses the outflow */
  bridge: { x: -57.8, z: -50.9, yaw: 0.45 },
}
export const WATERFALL_BRANCH: [number, number][] = [[-55.6, -50.4], [-53, -52.2], [-51.2, -54]]

export function waterfall(T: Town, waterNormal: THREE.Texture) {
  const P = T.P
  const D = T.disposables
  const R = rng(9137)
  const { x: wx, z: wz, poolR, cliffZ, height: H } = WATERFALL
  const std = (p: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial(p)
    D.push(m)
    return m
  }
  // weathered rock: icosahedra subdivided twice, pushed about by layered noise into irregular boulders — five different shapes so no two neighbours match — in three tones (stone, dark, moss)
  // (flat per-material colours: the town's static batch keeps only position / normal / uv, so per-vertex colours would come out black)
  const rockGrey = std({ color: '#8f8c86', roughness: 0.96 })
  const rockDark = std({ color: '#5c5a57', roughness: 0.96 })
  const moss = std({ color: '#4c6140', roughness: 1 })
  const boulders: THREE.BufferGeometry[] = []
  for (let v = 0; v < 5; v++) {
    const g = new THREE.IcosahedronGeometry(1, 2)
    const pos = g.attributes.position as THREE.BufferAttribute
    const ph = [v * 1.7 + 0.3, v * 2.3 + 1.1, v * 0.9 + 2.2]
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const z = pos.getZ(i)
      const n = Math.sin(x * 2.3 + ph[0]) * Math.cos(y * 2.1 + ph[1]) * 0.5 + Math.sin(z * 3.1 + ph[2]) * Math.sin(x * 4.2 - y * 1.7) * 0.28 + Math.sin(x * 7 + y * 6 + z * 5 + ph[0]) * 0.07
      const k = 1 + n * 0.3
      pos.setXYZ(i, x * k, y * k * 0.85, z * k)
    }
    g.computeVertexNormals()
    boulders.push(g)
    D.push(g)
  }
  const boulder = boulders[0]
  let bi = 0
  const nextBoulder = () => boulders[bi++ % boulders.length]

  /* ── the rock mass: a solid dark core, then a face of tumbled boulders (grey, dark and mossy), a flat stone lip at the top where the brook arrives ── */
  T.batch.put(boxUV(17, H - 0.6, 5.2, 3), rockDark, wx, (H - 0.6) / 2, cliffZ - 2.8)
  const rows = 6
  for (let k = 0; k < rows; k++) {
    const y = 0.5 + (k / (rows - 1)) * (H - 1.4)
    const n = 12 - k * 0.6
    for (let i = 0; i < n; i++) {
      const x = wx - 8.2 + ((i + 0.5) / n) * 16.4 + (R() - 0.5) * 0.9
      // leave the channel clear: the falling water runs down the middle 3.2 m
      if (Math.abs(x - wx) < 1.9 && k > 0) continue
      const s = 1.1 + R() * 0.9
      const m = R() < 0.3 ? moss : R() < 0.5 ? rockDark : rockGrey
      T.batch.put(nextBoulder(), m, x, y + (R() - 0.5) * 0.6, cliffZ - 0.2 - R() * 0.9, R() * 6, s * 1.05, s * 0.95, s)
    }
  }
  // the lip: a flat slab the water pours over, with a boulder on either side
  T.batch.put(boxUV(3.4, 0.5, 2.6, 1.5), rockGrey, wx, H - 0.25, cliffZ - 0.9)
  for (const s of [-1, 1]) T.batch.put(boulder, rockGrey, wx + s * 2.4, H - 0.2, cliffZ - 0.9, R() * 6, 1.4, 1.2, 1.4)
  // the spring: a dark crack in the rock above the lip with the brook running forward to the edge (a flat water strip with stone banks)
  const brookMat = waterMaterial(waterNormal, D, '#3a8a9a', '#0e3c48')
  const brook = new THREE.PlaneGeometry(2.4, 5).rotateX(-Math.PI / 2)
  const bu = brook.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < bu.count; i++) bu.setXY(i, bu.getX(i) * 0.8, bu.getY(i) * 1.6)
  const brookMesh = new THREE.Mesh(brook, brookMat.material)
  brookMesh.position.set(wx, H + 0.01, cliffZ - 3.4)
  T.scene.add(brookMesh)
  D.push(brook)
  for (const s of [-1, 1]) T.batch.put(boulder, moss, wx + s * 1.9, H + 0.1, cliffZ - 3.4 + (R() - 0.5) * 2, R() * 6, 0.9, 0.7, 1.3)
  T.batch.put(boxUV(3, 1.4, 0.6, 1.5), std({ color: '#161513', roughness: 1 }), wx, H + 0.7, cliffZ - 6.1) // the crack the spring comes out of

  /* ── the falling sheet: streaked water scrolling downward, bowed out from the face ── */
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 512
  const g = c.getContext('2d')!
  g.fillStyle = 'rgba(190,225,240,0.55)'
  g.fillRect(0, 0, 128, 512)
  for (let i = 0; i < 120; i++) {
    const x = R() * 128
    const w = 1 + R() * 4
    g.fillStyle = `rgba(255,255,255,${0.25 + R() * 0.55})`
    const y0 = R() * 512
    g.fillRect(x, y0, w, 60 + R() * 220)
    g.fillRect(x, y0 - 512, w, 60 + R() * 220)
  }
  const sheetTex = new THREE.CanvasTexture(c)
  sheetTex.wrapS = sheetTex.wrapT = THREE.RepeatWrapping
  sheetTex.colorSpace = THREE.SRGBColorSpace
  sheetTex.repeat.set(1, 2.2)
  const sheetMat = new THREE.MeshBasicMaterial({ map: sheetTex, transparent: true, opacity: 0.92, depthWrite: false, side: THREE.DoubleSide, color: '#e6f4ff' })
  const sheetGeo = new THREE.PlaneGeometry(2.8, H - 0.3, 6, 12)
  const sp = sheetGeo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < sp.count; i++) {
    const u = (sp.getY(i) + (H - 0.3) / 2) / (H - 0.3) // 0 at the foot, 1 at the lip
    const bow = Math.sin(Math.min(1, u) * Math.PI * 0.55) * 0.55 // leaves the lip, leans back to the face as it falls
    sp.setZ(i, (1 - u) * 0.1 + bow * (1 - u) * 0.9 + (u > 0.85 ? (u - 0.85) * 2.2 : 0))
  }
  sheetGeo.computeVertexNormals()
  const sheet = new THREE.Mesh(sheetGeo, sheetMat)
  sheet.position.set(wx, (H - 0.3) / 2 + 0.15, cliffZ + 0.28)
  T.scene.add(sheet)
  D.push(sheetGeo, sheetMat, sheetTex)

  /* ── the plunge pool, its rock rim, the foam, the mist ── */
  const poolMat = waterMaterial(waterNormal, D, '#2a7a92', '#0e3c48')
  const poolGeo = new THREE.CircleGeometry(poolR, 40).rotateX(-Math.PI / 2)
  const pu = poolGeo.attributes.uv as THREE.BufferAttribute
  const pp = poolGeo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pu.count; i++) pu.setXY(i, pp.getX(i) / 3, pp.getZ(i) / 3)
  const pool = new THREE.Mesh(poolGeo, poolMat.material)
  pool.position.set(wx, 0.06, wz)
  pool.receiveShadow = true
  T.scene.add(pool)
  D.push(poolGeo)
  const foamMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false })
  const foamGeo = new THREE.RingGeometry(0.9, 1.5, 28).rotateX(-Math.PI / 2)
  D.push(foamMat, foamGeo)
  const foam = new THREE.Mesh(foamGeo, foamMat)
  foam.position.set(wx, 0.075, cliffZ + 1.4)
  T.scene.add(foam)
  // a rim of rocks round the pool, open on the south-west where the stream leaves and on the south where people stand
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2
    const dx = Math.cos(a)
    const dz = Math.sin(a)
    if (dz > 0.45 && dx < 0.4) continue // the viewing side
    if (dx < -0.55 && dz > -0.2) continue // the outflow
    const s = 0.5 + R() * 0.5
    const x = wx + dx * (poolR + 0.35)
    const z = wz + dz * (poolR + 0.35)
    T.batch.put(nextBoulder(), rockGrey, x, s * 0.35, z, R() * 6, s * 1.2, s * 0.8, s)
    T.colliders.push({ kind: 'circle', x, z, r: s * 0.9, h: 0.9 })
  }
  // the pool itself is deep water: a low blocking disc so nobody walks across the surface
  T.colliders.push({ kind: 'circle', x: wx, z: wz, r: poolR - 0.3, h: 1.0 })
  // the cliff blocks (a solid box under the boulders)
  T.colliders.push({ kind: 'box', minX: wx - 8.8, maxX: wx + 8.8, minZ: cliffZ - 5.8, maxZ: cliffZ + 0.2, h: H })

  /* ── the outflow: a shallow stream south-west to the loop path, under a plank footbridge ── */
  const stream = ribbon([[wx - 3.2, wz + 2.0], [wx - 5.2, wz + 4.2], [-56.8, -50.2], [-60, -46.4], [-63.6, -43.6]], 1.9)
  const streamMat = waterMaterial(waterNormal, D, '#2a7a92', '#0e3c48')
  const sg = stream.geo
  const spos = sg.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < spos.count; i++) spos.setY(i, 0.045)
  const suv = sg.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < suv.count; i++) suv.setXY(i, suv.getX(i), suv.getY(i) * 0.9)
  const streamMesh = new THREE.Mesh(sg, streamMat.material)
  T.scene.add(streamMesh)
  D.push(sg)
  for (let k = 0; k < 14; k++) {
    // bank stones along the stream
    const t = (k + 0.5) / 14
    const p = stream.curve.getPointAt(t)
    const tg = stream.curve.getTangentAt(t)
    for (const s of [-1, 1]) {
      const sc = 0.22 + R() * 0.2
      T.batch.put(nextBoulder(), rockGrey, p.x - tg.z * s * (1.25 + R() * 0.2), sc * 0.4, p.z + tg.x * s * (1.25 + R() * 0.2), R() * 6, sc * 1.4, sc * 0.8, sc)
    }
  }
  {
    const { x, z, yaw } = WATERFALL.bridge
    const wood = P.woodLight
    const F = (lx: number, y: number, lz: number, w: number, h: number, d: number, m: THREE.Material) => {
      const c2 = Math.cos(yaw)
      const s2 = Math.sin(yaw)
      T.batch.put(boxUV(w, h, d, 1), m, x + lx * c2 + lz * s2, y, z - lx * s2 + lz * c2, yaw)
    }
    F(0, 0.2, 0, 2.6, 0.12, 2.8, wood) // the deck planking
    for (const s of [-1, 1]) {
      F(s * 1.25, 0.1, 0, 0.18, 0.2, 2.9, P.timber) // the bearers
      F(s * 1.25, 0.62, 0, 0.1, 0.07, 2.8, P.timber) // a hand rail
      for (const lz of [-1.3, 0, 1.3]) F(s * 1.25, 0.4, lz, 0.1, 0.5, 0.1, P.timber)
    }
  }

  /* ── the viewing spot: a branch path, a flat stone and a bench facing the falls ── */
  {
    const bp = ribbon(WATERFALL_BRANCH, 1.8)
    const dirt = std({ map: P.ground.map, color: '#8a7050', roughness: 1 })
    T.batch.put(bp.geo, dirt, 0, 0.019, 0, 0, 1, 1, 1, { cast: false })
    T.batch.put(new THREE.CylinderGeometry(1.6, 1.7, 0.1, 18), rockGrey, WATERFALL.view.x, 0.05, WATERFALL.view.z, 0, 1, 1, 1, { cast: false })
    // a bench with its back to the path, looking at the falls
    const bx = WATERFALL.view.x + 1.0
    const bz = WATERFALL.view.z + 0.7
    T.batch.put(boxUV(1.7, 0.08, 0.45, 1), P.woodLight, bx, 0.46, bz)
    T.batch.put(boxUV(1.7, 0.36, 0.06, 1), P.woodLight, bx, 0.78, bz + 0.2)
    for (const s of [-1, 1]) T.batch.put(boxUV(0.08, 0.46, 0.4, 1), P.iron, bx + s * 0.78, 0.23, bz)
    T.colliders.push({ kind: 'box', minX: bx - 0.95, maxX: bx + 0.95, minZ: bz - 0.28, maxZ: bz + 0.28, h: 1 })
  }

  /* ── mist: soft sprites that rise from the foot of the falls and thin out (one Points draw call) ── */
  const N = 46
  const mpos = new Float32Array(N * 3)
  const mseed = Array.from({ length: N }, () => R())
  const dot = softDot()
  const mistGeo = new THREE.BufferGeometry()
  mistGeo.setAttribute('position', new THREE.BufferAttribute(mpos, 3))
  const mistMat = new THREE.PointsMaterial({ size: 2.6, map: dot, transparent: true, opacity: 0.32, depthWrite: false, color: '#e6f2f8', sizeAttenuation: true })
  D.push(mistGeo, mistMat, dot)
  const mist = new THREE.Points(mistGeo, mistMat)
  mist.frustumCulled = false
  T.scene.add(mist)

  T.dynamic.push({
    update(t: number) {
      poolMat.time.value = t
      brookMat.time.value = t
      streamMat.time.value = t * 0.6
      sheetTex.offset.y = -t * 1.7
      const f = 1 + 0.16 * Math.sin(t * 3.1)
      foam.scale.set(f * 1.6, 1, f * 1.0)
      foamMat.opacity = 0.42 + 0.18 * Math.sin(t * 2.3)
      for (let i = 0; i < N; i++) {
        const ph = (t * 0.22 + mseed[i]) % 1
        mpos[i * 3] = wx + (mseed[i] - 0.5) * 3.4 + Math.sin(t * 0.7 + i) * 0.4
        mpos[i * 3 + 1] = 0.3 + ph * 3.4
        mpos[i * 3 + 2] = cliffZ + 1.4 + (((i * 7919) % 100) / 100 - 0.4) * 2.6
      }
      mistGeo.attributes.position.needsUpdate = true
    },
  })
  T.lights.push({ x: wx, y: 2.4, z: wz + 1.2, color: '#9ad8ff', intensity: 1.2, dist: 11, priority: 1 })
}
