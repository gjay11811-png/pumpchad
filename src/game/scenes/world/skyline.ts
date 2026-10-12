import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Quality } from '../../save'
import { rng } from './kit'

/**
 * CHAD CITY — the future city seen across the valley to the south. Not playable (yet).
 *
 * Real 3D geometry (so parallax is correct as the camera moves), but cheap:
 *  - three layered bands of towers, each band merged into ONE mesh (1 draw call per band)
 *  - one shared canvas texture of windows; unlit material with no scene fog (fog would erase it at this
 *    distance) — instead each band gets its own baked "atmospheric haze" mix, stronger toward the valley floor
 *  - a casino landmark with neon signage and two sweeping searchlights
 *  - blinking aircraft beacons and a warm light-pollution glow behind the skyline
 */
export const CITY = { z0: 265, z1: 430, floorY: -44 }

type Disposable = THREE.Material | THREE.Texture | THREE.BufferGeometry

/** Facade texture: 8 columns × 16 floors of windows (20 m × 48 m of facade per tile). Top-right corner is solid roof. */
function windowsTexture(seed: number) {
  const W = 256
  const H = 512
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.fillStyle = '#0b0c14'
  g.fillRect(0, 0, W, H)
  const R = rng(seed)
  const cw = W / 8
  const fh = H / 16
  for (let f = 0; f < 16; f++) {
    // horizontal floor band
    g.fillStyle = '#121422'
    g.fillRect(0, f * fh, W, 3)
    for (let col = 0; col < 8; col++) {
      const r = R()
      const lit = r < 0.36
      const cool = R() < 0.25
      g.fillStyle = lit ? (cool ? '#a9d8ff' : R() < 0.5 ? '#ffd28f' : '#ffb867') : R() < 0.5 ? '#1a1d2e' : '#151726'
      g.globalAlpha = lit ? 0.75 + R() * 0.25 : 1
      g.fillRect(col * cw + 5, f * fh + 7, cw - 10, fh - 12)
      g.globalAlpha = 1
    }
  }
  // roof swatch (top-right 8×8 px) — roofs map here
  g.fillStyle = '#07080e'
  g.fillRect(W - 8, 0, 8, 8)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 4
  return t
}

/** Box with facade UVs in metres (u = 20 m, v = 48 m per tile); roof/floor faces map to the roof swatch. */
function towerGeo(w: number, h: number, d: number, u0: number) {
  const g = new THREE.BoxGeometry(w, h, d)
  const uv = g.attributes.uv as THREE.BufferAttribute
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z (4 verts each)
  const faces: ([number, number] | null)[] = [[d, h], [d, h], null, null, [w, h], [w, h]]
  faces.forEach((f, fi) => {
    for (let k = 0; k < 4; k++) {
      const i = fi * 4 + k
      if (!f) uv.setXY(i, 0.985, 0.985)
      else uv.setXY(i, u0 + uv.getX(i) * (f[0] / 20), uv.getY(i) * (f[1] / 48))
    }
  })
  return g
}

/** Unlit, fog-free, with baked distance haze that thickens toward the valley floor. */
function hazeMaterial(map: THREE.Texture, haze: THREE.Color, k: number, D: Disposable[]) {
  const m = new THREE.MeshBasicMaterial({ map, fog: false })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uHaze = { value: haze }
    sh.uniforms.uK = { value: k }
    sh.uniforms.uFloor = { value: CITY.floorY }
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vWY;').replace('#include <fog_vertex>', '#include <fog_vertex>\nvWY = (modelMatrix * vec4(transformed, 1.0)).y;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uHaze;\nuniform float uK;\nuniform float uFloor;\nvarying float vWY;')
      .replace('#include <opaque_fragment>', '#include <opaque_fragment>\nfloat mist = 1.0 - smoothstep(uFloor, uFloor + 70.0, vWY);\ngl_FragColor.rgb = mix(gl_FragColor.rgb, uHaze, clamp(uK + mist * 0.6, 0.0, 0.94));')
  }
  m.customProgramCacheKey = () => `chad-haze-${k.toFixed(2)}`
  D.push(m)
  return m
}

/** Canvas sign texture for the casino's neon. */
function neonTexture(top: string, bottom: string) {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 384
  const g = c.getContext('2d')!
  g.clearRect(0, 0, 1024, 384)
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.shadowColor = '#ffb347'
  g.shadowBlur = 36
  g.fillStyle = '#ffe2a6'
  g.font = '900 150px Anton, Impact, "Arial Narrow", sans-serif'
  g.fillText(top, 512, 140)
  g.shadowColor = '#ff3d8b'
  g.fillStyle = '#ffc2dc'
  g.font = '900 120px Anton, Impact, "Arial Narrow", sans-serif'
  g.fillText(bottom, 512, 286)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function buildChadCity(scene: THREE.Scene, q: Quality, D: Disposable[]) {
  const group = new THREE.Group()
  group.name = 'chad-city'
  scene.add(group)
  const tex = windowsTexture(7)
  D.push(tex)
  const R = rng(1337)
  const Y = CITY.floorY
  const haze = new THREE.Color('#2b1d38')

  // three bands, near → far: shorter & clearer → taller & hazier
  const bands = [
    { z: [268, 300], n: q === 'low' ? 26 : 40, h: [18, 62], w: [10, 22], k: 0.34 },
    { z: [312, 350], n: q === 'low' ? 22 : 34, h: [45, 135], w: [12, 24], k: 0.46 },
    { z: [364, 410], n: q === 'low' ? 9 : 14, h: [110, 215], w: [14, 26], k: 0.58 },
  ]
  const tops: THREE.Vector3[] = []
  for (const b of bands) {
    const geos: THREE.BufferGeometry[] = []
    for (let i = 0; i < b.n; i++) {
      // spread across the horizon; densest around the centre line of the valley
      const x = (R() - 0.5) * 2 * (190 + R() * 60) * (0.55 + R() * 0.45)
      if (Math.abs(x - 38) < 26 && b === bands[1]) continue // keep the casino's silhouette clear
      const z = b.z[0] + R() * (b.z[1] - b.z[0])
      const h = b.h[0] + Math.pow(R(), 1.6) * (b.h[1] - b.h[0]) * (1 - Math.min(0.6, Math.abs(x) / 400))
      const w = b.w[0] + R() * (b.w[1] - b.w[0])
      const d = b.w[0] + R() * (b.w[1] - b.w[0])
      const g = towerGeo(w, h, d, Math.floor(R() * 8) / 8)
      g.translate(x, Y + h / 2, z)
      geos.push(g)
      // setback crown on tall towers (reads as real architecture, not boxes)
      if (h > 90) {
        const ch = 8 + R() * 14
        const c = towerGeo(w * 0.62, ch, d * 0.62, 0.5)
        c.translate(x, Y + h + ch / 2, z)
        geos.push(c)
        const sp = new THREE.CylinderGeometry(0.25, 0.6, 10 + R() * 18, 5)
        const spH = (sp.parameters as { height: number }).height
        sp.translate(x, Y + h + ch + spH / 2, z)
        const suv = sp.attributes.uv as THREE.BufferAttribute
        for (let k = 0; k < suv.count; k++) suv.setXY(k, 0.985, 0.985)
        geos.push(sp)
        tops.push(new THREE.Vector3(x, Y + h + ch + spH, z))
      } else if (R() < 0.35) tops.push(new THREE.Vector3(x, Y + h + 0.5, z))
    }
    const merged = mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)))!
    geos.forEach((g) => g.dispose())
    D.push(merged)
    const mesh = new THREE.Mesh(merged, hazeMaterial(tex, haze, b.k, D))
    mesh.matrixAutoUpdate = false
    mesh.frustumCulled = false // one huge mesh; always partly in view from the lookout
    group.add(mesh)
  }

  // ── CHAD CASINO landmark: gold podium, slim tower, crown, neon, searchlights ──
  const cx = 46
  const cz = 326
  const goldTex = windowsTexture(99)
  D.push(goldTex)
  const casinoMat = hazeMaterial(goldTex, haze, 0.38, D)
  const casinoGeos: THREE.BufferGeometry[] = []
  const podium = towerGeo(62, 16, 38, 0)
  podium.translate(cx, Y + 8, cz)
  casinoGeos.push(podium)
  const tower = towerGeo(22, 128, 22, 0.25)
  tower.translate(cx, Y + 16 + 64, cz + 4)
  casinoGeos.push(tower)
  const casinoMerged = mergeGeometries(casinoGeos.map((g) => g.toNonIndexed()))!
  casinoGeos.forEach((g) => g.dispose())
  D.push(casinoMerged)
  const casino = new THREE.Mesh(casinoMerged, casinoMat)
  casino.frustumCulled = false
  group.add(casino)
  // gold crown + glowing ring at the top (bloom catches the HDR colours)
  const gold = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffbf4d').multiplyScalar(1.6), fog: false, toneMapped: false })
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff5fa8').multiplyScalar(2.4), fog: false, toneMapped: false })
  D.push(gold, ringMat)
  const top = Y + 16 + 128
  const crownGeo = new THREE.CylinderGeometry(9, 12, 10, 8, 1, true)
  const crown = new THREE.Mesh(crownGeo, gold)
  crown.position.set(cx, top + 5, cz + 4)
  group.add(crown)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const spike = new THREE.Mesh(new THREE.ConeGeometry(1.4, 7, 4), gold)
    spike.position.set(cx + Math.cos(a) * 9.5, top + 13, cz + 4 + Math.sin(a) * 9.5)
    group.add(spike)
    D.push(spike.geometry)
  }
  const ringGeo = new THREE.TorusGeometry(14, 0.7, 6, 48)
  const ring = new THREE.Mesh(ringGeo, ringMat)
  ring.rotation.x = Math.PI / 2
  ring.position.set(cx, top - 6, cz + 4)
  group.add(ring)
  D.push(crownGeo, ringGeo)
  // neon sign facing the kingdom (north, toward −Z)
  const neon = neonTexture('CHAD CASINO', 'COMING SOON')
  const neonMat = new THREE.MeshBasicMaterial({ map: neon, transparent: true, fog: false, toneMapped: false, color: new THREE.Color(2.2, 2.2, 2.2), depthWrite: false })
  D.push(neon, neonMat)
  const signGeo = new THREE.PlaneGeometry(64, 24)
  const sign = new THREE.Mesh(signGeo, neonMat)
  sign.position.set(cx, Y + 30, cz - 19.2)
  sign.rotation.y = Math.PI
  group.add(sign)
  D.push(signGeo)
  // searchlights: soft additive cones sweeping the sky
  const beamMat = new THREE.MeshBasicMaterial({ color: '#ffd9a0', transparent: true, opacity: 0.045, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide })
  D.push(beamMat)
  const beamGeo = new THREE.ConeGeometry(14, 260, 20, 1, true)
  beamGeo.translate(0, 130, 0)
  D.push(beamGeo)
  const beams: THREE.Mesh[] = []
  if (q !== 'low')
    for (const s of [-1, 1]) {
      const b = new THREE.Mesh(beamGeo, beamMat)
      b.position.set(cx + s * 24, Y + 16, cz)
      group.add(b)
      beams.push(b)
    }

  // aircraft beacons on the tallest roofs (blink)
  const bPos = new Float32Array(tops.length * 3)
  tops.forEach((p, i) => bPos.set([p.x, p.y, p.z], i * 3))
  const bGeo = new THREE.BufferGeometry()
  bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3))
  const bMat = new THREE.PointsMaterial({ color: new THREE.Color('#ff3b30').multiplyScalar(2), size: 3.2, sizeAttenuation: true, fog: false, toneMapped: false, transparent: true })
  D.push(bGeo, bMat)
  group.add(new THREE.Points(bGeo, bMat))

  // warm light-pollution glow rising behind the skyline + mist band hiding the city's feet
  const glowTex = (() => {
    const c = document.createElement('canvas')
    c.width = 4
    c.height = 256
    const g = c.getContext('2d')!
    const gr = g.createLinearGradient(0, 256, 0, 0)
    gr.addColorStop(0, 'rgba(255,140,60,0.55)')
    gr.addColorStop(0.35, 'rgba(190,80,140,0.22)')
    gr.addColorStop(1, 'rgba(40,20,60,0)')
    g.fillStyle = gr
    g.fillRect(0, 0, 4, 256)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  })()
  const glowMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })
  const glowGeo = new THREE.PlaneGeometry(1000, 320)
  const glow = new THREE.Mesh(glowGeo, glowMat)
  glow.position.set(0, Y + 120, 440)
  glow.rotation.y = Math.PI
  glow.renderOrder = -1
  group.add(glow)
  D.push(glowTex, glowMat, glowGeo)

  // lit road snaking from the kingdom's south gate down the valley to the city
  const lampPts: number[] = []
  const road = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 37), new THREE.Vector3(2, -4, 50), new THREE.Vector3(-6, -18, 68), new THREE.Vector3(4, -31, 92), new THREE.Vector3(-2, -33, 140), new THREE.Vector3(8, -38, 200), new THREE.Vector3(14, -44, 262)])
  const steps = 64
  for (let i = 1; i <= steps; i++) {
    const p = road.getPoint(i / steps)
    const tng = road.getTangent(i / steps)
    const side = new THREE.Vector3(-tng.z, 0, tng.x).normalize().multiplyScalar(3.4 * (i % 2 ? 1 : -1))
    lampPts.push(p.x + side.x, p.y + 4, p.z + side.z)
  }
  const lGeo = new THREE.BufferGeometry()
  lGeo.setAttribute('position', new THREE.Float32BufferAttribute(lampPts, 3))
  const lMat = new THREE.PointsMaterial({ color: new THREE.Color('#ffc27a').multiplyScalar(1.8), size: 1.1, sizeAttenuation: true, fog: false, toneMapped: false, transparent: true, opacity: 0.9 })
  D.push(lGeo, lMat)
  group.add(new THREE.Points(lGeo, lMat))

  let t = 0
  return {
    group,
    road,
    update(dt: number) {
      t += dt
      bMat.opacity = Math.sin(t * 3.2) > 0.2 ? 1 : 0.15
      beams.forEach((b, i) => {
        const s = i ? 1 : -1
        b.rotation.z = Math.sin(t * 0.35 + i * 2.1) * 0.55 * s
        b.rotation.x = -0.25 + Math.cos(t * 0.27 + i) * 0.18
      })
    },
  }
}
