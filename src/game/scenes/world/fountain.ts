import * as THREE from 'three'
import { Fire } from './fx'
import type { Town } from './buildings'
import { inscription } from './textures'

/**
 * THE PUMP FOUNTAIN — Chad Kingdom's centrepiece (v4).
 *
 * Moulded stone basin (lathe profiles, carved-stone texture + bump), two broad steps, a second-tier bowl that
 * spills a water curtain, eight arcing jets from rim spouts, layered animated water (two scrolling normal maps,
 * transparency, environment reflections), expanding ripple rings + splash droplets where the water lands,
 * and the golden King on top. Built cheap: the stone is merged into the town batch; water + effects are a
 * handful of draw calls (ripples and droplets are instanced / points).
 */

/** basin radius the player collides with */
export const FOUNTAIN_R = 5.45

type D = (THREE.Material | THREE.BufferGeometry | THREE.Texture)[]

/** soft carved limestone: colour + bump (no block lines — this is sculpted stone) */
function carvedStone(D: D) {
  const S = 512
  const mk = () => {
    const c = document.createElement('canvas')
    c.width = c.height = S
    return [c, c.getContext('2d')!] as const
  }
  const [c, g] = mk()
  const [b, gb] = mk()
  let seed = 31
  const r = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  g.fillStyle = '#8f8792'
  g.fillRect(0, 0, S, S)
  gb.fillStyle = '#808080'
  gb.fillRect(0, 0, S, S)
  // mottling
  for (let i = 0; i < 900; i++) {
    const x = r() * S
    const y = r() * S
    const rad = 6 + r() * 30
    const l = 40 + r() * 22
    const grd = g.createRadialGradient(x, y, 0, x, y, rad)
    grd.addColorStop(0, `hsla(${270 + r() * 40},${6 + r() * 6}%,${l}%,0.25)`)
    grd.addColorStop(1, 'hsla(0,0%,50%,0)')
    g.fillStyle = grd
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
    const bg = gb.createRadialGradient(x, y, 0, x, y, rad)
    const v = 100 + r() * 60
    bg.addColorStop(0, `rgba(${v},${v},${v},0.35)`)
    bg.addColorStop(1, 'rgba(128,128,128,0)')
    gb.fillStyle = bg
    gb.fillRect(x - rad, y - rad, rad * 2, rad * 2)
  }
  // fine grain + pits
  for (let i = 0; i < 14000; i++) {
    const x = r() * S
    const y = r() * S
    const d = r()
    g.fillStyle = d < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.07)'
    g.fillRect(x, y, 1.5, 1.5)
    if (d < 0.08) {
      gb.fillStyle = 'rgba(0,0,0,0.6)'
      gb.fillRect(x, y, 2, 2)
    }
  }
  // hairline veins
  for (let i = 0; i < 18; i++) {
    g.strokeStyle = `rgba(40,30,45,${0.12 + r() * 0.15})`
    gb.strokeStyle = 'rgba(30,30,30,0.5)'
    for (const ctx of [g, gb]) {
      ctx.lineWidth = 1
      ctx.beginPath()
      let x = r() * S
      let y = r() * S
      ctx.moveTo(x, y)
      for (let k = 0; k < 8; k++) {
        x += (r() - 0.5) * 70
        y += (r() - 0.3) * 50
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  }
  // damp moss near the bottom of the texture (v=0 maps to the bottom of each surface)
  const moss = g.createLinearGradient(0, S, 0, S * 0.7)
  moss.addColorStop(0, 'rgba(48,66,40,0.45)')
  moss.addColorStop(1, 'rgba(48,66,40,0)')
  g.fillStyle = moss
  g.fillRect(0, S * 0.7, S, S * 0.3)
  const t = (cv: HTMLCanvasElement, srgb: boolean) => {
    const x = new THREE.CanvasTexture(cv)
    x.wrapS = x.wrapT = THREE.RepeatWrapping
    if (srgb) x.colorSpace = THREE.SRGBColorSpace
    x.anisotropy = 4
    D.push(x)
    return x
  }
  return { map: t(c, true), bump: t(b, false) }
}

/** lathe with world-scale UVs: u = arc length / tile around, v = profile length / tile */
function lathe(profile: [number, number][], segments: number, tile = 2.2) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(r, y))
  const g = new THREE.LatheGeometry(pts, segments)
  const pos = g.attributes.position as THREE.BufferAttribute
  const uv = g.attributes.uv as THREE.BufferAttribute
  // accumulated profile length per profile point
  const acc: number[] = [0]
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + pts[i].distanceTo(pts[i - 1]))
  const maxR = Math.max(...profile.map((p) => p[0]))
  for (let i = 0; i < pos.count; i++) {
    const pi = i % pts.length
    const u = uv.getX(i)
    uv.setXY(i, (u * Math.PI * 2 * maxR) / tile, acc[pi] / tile)
  }
  return g
}

/** a thin tube along a curve whose radius tapers from r0 to r1 (water jets) */
function taperedTube(curve: THREE.Curve<THREE.Vector3>, r0: number, r1: number, seg = 20, radial = 6) {
  const g = new THREE.TubeGeometry(curve, seg, 1, radial, false)
  const pos = g.attributes.position as THREE.BufferAttribute
  const P = new THREE.Vector3()
  for (let i = 0; i <= seg; i++) {
    const t = i / seg
    curve.getPointAt(t, P)
    const r = r0 + (r1 - r0) * t
    for (let k = 0; k <= radial; k++) {
      const idx = i * (radial + 1) + k
      const x = pos.getX(idx)
      const y = pos.getY(idx)
      const z = pos.getZ(idx)
      pos.setXYZ(idx, P.x + (x - P.x) * r, P.y + (y - P.y) * r, P.z + (z - P.z) * r)
    }
  }
  g.computeVertexNormals()
  return g
}

/** layered water: two scrolling normal-map samples blended, transparent, glossy */
function waterMaterial(normal: THREE.Texture, D: D) {
  const m = new THREE.MeshStandardMaterial({
    color: '#123a44',
    roughness: 0.05,
    metalness: 0.15,
    transparent: true,
    opacity: 0.86,
    normalMap: normal,
    normalScale: new THREE.Vector2(0.55, 0.55),
    envMapIntensity: 1.6,
    emissive: '#0d2f38',
    emissiveIntensity: 0.55,
    depthWrite: false,
  })
  const uT = { value: 0 }
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uT = uT
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uT;')
      .replace(
        '#include <normal_fragment_maps>',
        `vec3 nA = texture2D( normalMap, vNormalMapUv + vec2( uT * 0.031, uT * 0.019 ) ).xyz * 2.0 - 1.0;
         vec3 nB = texture2D( normalMap, vNormalMapUv * 1.7 + vec2( -uT * 0.024, uT * 0.035 ) ).xyz * 2.0 - 1.0;
         vec3 mapN = normalize( vec3( ( nA.xy + nB.xy ) * normalScale, nA.z * nB.z ) );
         normal = normalize( tbn * mapN );`,
      )
  }
  m.customProgramCacheKey = () => 'chad-water-v4'
  D.push(m)
  return { material: m, time: uT }
}

export function fountainV4(T: Town, king: THREE.Object3D, waterNormal: THREE.Texture) {
  const P = T.P
  const D = T.disposables
  const stoneTex = carvedStone(D)
  const stone = new THREE.MeshStandardMaterial({ map: stoneTex.map, bumpMap: stoneTex.bump, bumpScale: 2.2, color: '#c9c0c7', roughness: 0.86 })
  const stoneDark = new THREE.MeshStandardMaterial({ map: stoneTex.map, bumpMap: stoneTex.bump, bumpScale: 2.6, color: '#8b8390', roughness: 0.92 })
  const basinFloor = new THREE.MeshStandardMaterial({ map: stoneTex.map, color: '#2f3a3c', roughness: 0.6 })
  D.push(stone, stoneDark, basinFloor)
  const SEG = 56

  // ── two broad bevelled steps ──
  T.batch.put(lathe([[0, 0], [6.35, 0], [6.42, 0.06], [6.42, 0.18], [6.34, 0.24], [0, 0.24]], SEG), stoneDark, 0, 0, 0)
  T.batch.put(lathe([[0, 0.24], [5.78, 0.24], [5.85, 0.3], [5.85, 0.42], [5.77, 0.48], [0, 0.48]], SEG), stone, 0, 0, 0)

  // ── main basin: plinth, wall, bead, rolled lip, inner wall (one moulded profile) ──
  const basin = lathe(
    [
      [4.6, 0.55], [4.62, 1.12], [4.7, 1.24], [4.86, 1.32], [5.06, 1.33], [5.2, 1.27], [5.25, 1.18], [5.18, 1.1],
      [5.06, 1.06], [5.06, 0.72], [5.14, 0.66], [5.28, 0.6], [5.3, 0.48],
    ],
    SEG,
  )
  T.batch.put(basin, stone, 0, 0, 0)
  T.batch.put(new THREE.CircleGeometry(4.62, SEG).rotateX(-Math.PI / 2), basinFloor, 0, 0.56, 0, 0, 1, 1, 1, { cast: false })
  // gold inscription band on the basin wall
  const inscTex = inscription('MARKETS DUMP · CHADS PUMP')
  const inscMat = new THREE.MeshStandardMaterial({ map: inscTex, metalness: 0.6, roughness: 0.4, emissive: '#e8b84a', emissiveMap: inscTex, emissiveIntensity: 0.35, transparent: true })
  D.push(inscTex, inscMat)
  T.batch.put(new THREE.CylinderGeometry(5.075, 5.075, 0.3, 64, 1, true), inscMat, 0, 0.89, 0, 0, 1, 1, 1, { cast: false })

  // ── centre: fluted column → second-tier bowl → upper column → gold plinth → the King ──
  T.batch.put(lathe([[1.5, 0.55], [1.42, 0.72], [1.18, 0.86], [1.05, 1.0], [1.02, 1.9], [1.12, 2.0], [1.3, 2.08]], 32), stone, 0, 0, 0)
  // bowl: underside curve up to a rolled lip at r 2.45
  const bowl = lathe([[1.0, 2.0], [1.6, 2.22], [2.2, 2.46], [2.46, 2.6], [2.5, 2.7], [2.42, 2.76], [2.3, 2.72], [2.2, 2.62], [0.6, 2.62]], 40)
  T.batch.put(bowl, stone, 0, 0, 0)
  T.batch.put(lathe([[0.82, 2.62], [0.74, 2.8], [0.68, 3.5], [0.78, 3.62], [0.92, 3.72]], 28), stone, 0, 0, 0)
  T.batch.put(new THREE.CylinderGeometry(1.32, 1.32, 0.12, 32), P.gold, 0, 3.78, 0)
  T.batch.put(new THREE.CylinderGeometry(1.42, 1.48, 0.16, 32), P.gold, 0, 3.92, 0)
  for (let i = 0; i < 4; i++) T.batch.put(new THREE.TorusGeometry(1.06, 0.035, 6, 32).rotateX(Math.PI / 2), P.gold, 0, 1.15 + i * 0.22, 0, 0, 1, 1, 1, { cast: false })
  king.position.set(0, 4.0, 0)
  king.scale.setScalar(1.75)
  king.updateMatrixWorld(true)
  T.batch.absorb(king)

  // ── water ──
  const W = waterMaterial(waterNormal, D)
  waterNormal.repeat.set(3, 3)
  const mainWater = new THREE.Mesh(new THREE.RingGeometry(0.98, 4.64, SEG, 2).rotateX(-Math.PI / 2), W.material)
  mainWater.position.y = 1.14
  mainWater.renderOrder = 2
  T.scene.add(mainWater)
  const bowlWater = new THREE.Mesh(new THREE.CircleGeometry(2.24, 40).rotateX(-Math.PI / 2), W.material)
  bowlWater.position.y = 2.66
  bowlWater.renderOrder = 2
  T.scene.add(bowlWater)
  D.push(mainWater.geometry, bowlWater.geometry)
  // underwater glow ring (warm, from the lamps in the basin)
  const glowRing = new THREE.Mesh(new THREE.TorusGeometry(3.9, 0.05, 6, 72), T.P.glowOrange)
  glowRing.rotation.x = Math.PI / 2
  glowRing.position.y = 0.62
  T.scene.add(glowRing)
  D.push(glowRing.geometry)

  // flowing texture for the curtain + jets
  const flowTex = (() => {
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 128
    const g = c.getContext('2d')!
    let s = 5
    const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
    g.fillStyle = 'rgba(190,230,255,0.35)'
    g.fillRect(0, 0, 64, 128)
    for (let i = 0; i < 60; i++) {
      const x = r() * 64
      const len = 20 + r() * 60
      const y = r() * 128
      const grd = g.createLinearGradient(0, y, 0, y + len)
      grd.addColorStop(0, 'rgba(255,255,255,0)')
      grd.addColorStop(0.5, `rgba(235,250,255,${0.35 + r() * 0.5})`)
      grd.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = grd
      g.fillRect(x, y, 1 + r() * 2.5, len)
      g.fillRect(x, y - 128, 1 + r() * 2.5, len) // wrap
    }
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.colorSpace = THREE.SRGBColorSpace
    return t
  })()
  D.push(flowTex)
  // thin, see-through falling water (the old opaque curtain read as a glowing drum)
  const sheetMat = new THREE.MeshBasicMaterial({ map: flowTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, color: new THREE.Color('#bfe6ff'), opacity: 0.42 })
  const jetMat = new THREE.MeshBasicMaterial({ map: flowTex, transparent: true, depthWrite: false, color: new THREE.Color('#d6f2ff').multiplyScalar(1.1), toneMapped: false, opacity: 0.75 })
  D.push(jetMat)
  D.push(sheetMat)
  // water curtain spilling over the bowl's lip (slightly flared, open cylinder)
  const curtain = new THREE.CylinderGeometry(2.5, 2.78, 1.5, 48, 6, true)
  {
    const pos = curtain.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i)
      const t = (0.75 - y) / 1.5 // 0 at the lip, 1 at the water
      const bulge = Math.sin(t * Math.PI) * 0.12
      const a = Math.atan2(pos.getZ(i), pos.getX(i))
      const rr = Math.hypot(pos.getX(i), pos.getZ(i)) + bulge
      pos.setX(i, Math.cos(a) * rr)
      pos.setZ(i, Math.sin(a) * rr)
    }
    curtain.computeVertexNormals()
    const uv = curtain.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 10, uv.getY(i) * 1.4)
  }
  const curtainMesh = new THREE.Mesh(curtain, sheetMat)
  curtainMesh.position.y = 1.15 + 0.75 + 0.06
  curtainMesh.renderOrder = 3
  T.scene.add(curtainMesh)
  D.push(curtain)
  // eight arcing jets from lion-head spouts on the basin's inner rim, landing in the main pool
  const jetGeos: THREE.BufferGeometry[] = []
  const landings: THREE.Vector3[] = []
  const spoutGeo = new THREE.SphereGeometry(0.15, 10, 8)
  spoutGeo.scale(1, 0.9, 1.25)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    const start = new THREE.Vector3(ca * 4.62, 1.36, sa * 4.62)
    const end = new THREE.Vector3(ca * 3.15, 1.15, sa * 3.15)
    const mid = new THREE.Vector3(ca * 3.95, 2.05, sa * 3.95)
    jetGeos.push(taperedTube(new THREE.QuadraticBezierCurve3(start, mid, end), 0.05, 0.03))
    landings.push(end)
    T.batch.put(spoutGeo, P.gold, ca * 4.68, 1.36, sa * 4.68, -a + Math.PI / 2, 1, 1, 1, { cast: false })
  }
  for (const g of jetGeos) {
    const m = new THREE.Mesh(g, jetMat)
    m.renderOrder = 3
    T.scene.add(m)
    D.push(g)
  }
  // ripple rings where water lands (jets + the curtain's foot): one instanced mesh, additive, fading out as they grow
  const RIPPLES_PER = 2
  const rippleSpots = [...landings.map((p) => ({ x: p.x, z: p.z, y: 1.155, s: 0.5 })), ...Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2
    return { x: Math.cos(a) * 2.85, z: Math.sin(a) * 2.85, y: 1.155, s: 0.65 }
  })]
  const rippleGeo = new THREE.RingGeometry(0.82, 1, 28).rotateX(-Math.PI / 2)
  const rippleMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
  const ripples = new THREE.InstancedMesh(rippleGeo, rippleMat, rippleSpots.length * RIPPLES_PER)
  ripples.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(rippleSpots.length * RIPPLES_PER * 3), 3)
  ripples.frustumCulled = false
  ripples.renderOrder = 4
  T.scene.add(ripples)
  D.push(rippleGeo, rippleMat)
  // splash droplets at the jet landings (points, gravity)
  const DROPS = 72
  const dPos = new Float32Array(DROPS * 3)
  const dVel = new Float32Array(DROPS * 3)
  const dGeo = new THREE.BufferGeometry()
  dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3))
  const dMat = new THREE.PointsMaterial({ color: new THREE.Color('#e8f8ff').multiplyScalar(1.4), size: 0.06, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false })
  const drops = new THREE.Points(dGeo, dMat)
  drops.frustumCulled = false
  T.scene.add(drops)
  D.push(dGeo, dMat)
  let seed = 9
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  const respawn = (i: number) => {
    const p = landings[i % landings.length]
    dPos.set([p.x + (rnd() - 0.5) * 0.12, 1.16, p.z + (rnd() - 0.5) * 0.12], i * 3)
    const a = rnd() * Math.PI * 2
    const sp = 0.3 + rnd() * 0.6
    dVel.set([Math.cos(a) * sp, 1 + rnd() * 1.2, Math.sin(a) * sp], i * 3)
  }
  for (let i = 0; i < DROPS; i++) {
    respawn(i)
    dPos[i * 3 + 1] = 1.16 + rnd() * 0.3
  }

  // ── golden crown halo floating above the King ──
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
  crown.position.y = 8.65
  T.scene.add(crown)
  D.push(ring.geometry, spike)

  // ── four braziers on the lower step ──
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    const bx = Math.cos(a) * 6.02
    const bz = Math.sin(a) * 6.02
    T.batch.put(new THREE.CylinderGeometry(0.2, 0.3, 1.3, 10), P.iron, bx, 0.89, bz)
    T.batch.put(new THREE.CylinderGeometry(0.55, 0.28, 0.4, 12, 1, true), P.iron, bx, 1.72, bz)
    T.batch.put(new THREE.TorusGeometry(0.55, 0.035, 6, 20).rotateX(Math.PI / 2), P.gold, bx, 1.92, bz, 0, 1, 1, 1, { cast: false })
    const f = new Fire(bx, 1.75, bz, 1)
    T.fires.push(f)
    T.scene.add(f.group)
    T.embers.push({ x: bx, y: 2.05, z: bz })
    T.colliders.push({ kind: 'circle', x: bx, z: bz, r: 0.45, h: 2 })
  }
  T.lights.push({ x: 0, y: 6, z: 0, color: '#ffb057', intensity: 40, dist: 22, priority: 0 })
  T.colliders.push({ kind: 'circle', x: 0, z: 0, r: FOUNTAIN_R, h: 2 })

  const M = new THREE.Matrix4()
  const Q = new THREE.Quaternion()
  const V = new THREE.Vector3()
  const S = new THREE.Vector3()
  const C = new THREE.Color()
  T.dynamic.push({
    update: (t, dt) => {
      W.time.value = t
      flowTex.offset.y -= dt * 1.1
      crown.rotation.y += dt * 0.5
      crown.position.y = 8.65 + Math.sin(t * 1.2) * 0.12
      // ripples: two staggered rings per spot, growing and fading over 1.6 s
      let k = 0
      for (let s = 0; s < rippleSpots.length; s++) {
        const sp = rippleSpots[s]
        for (let j = 0; j < RIPPLES_PER; j++) {
          const ph = ((t * 0.62 + s * 0.137 + j / RIPPLES_PER) % 1 + 1) % 1
          const sc = sp.s * (0.15 + ph * 0.85)
          M.compose(V.set(sp.x, sp.y, sp.z), Q, S.set(sc, 1, sc))
          ripples.setMatrixAt(k, M)
          const a = (1 - ph) * 0.32
          ripples.setColorAt(k, C.setRGB(a, a * 1.1, a * 1.2))
          k++
        }
      }
      ripples.instanceMatrix.needsUpdate = true
      if (ripples.instanceColor) ripples.instanceColor.needsUpdate = true
      // splash droplets
      const step = Math.min(dt, 0.05)
      for (let i = 0; i < DROPS; i++) {
        dVel[i * 3 + 1] -= 9.8 * step
        dPos[i * 3] += dVel[i * 3] * step
        dPos[i * 3 + 1] += dVel[i * 3 + 1] * step
        dPos[i * 3 + 2] += dVel[i * 3 + 2] * step
        if (dPos[i * 3 + 1] < 1.14) respawn(i)
      }
      dGeo.attributes.position.needsUpdate = true
    },
  })
}
