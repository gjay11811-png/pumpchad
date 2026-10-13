import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Quality } from '../../save'
import { rng } from './kit'

/**
 * CHAD CITY — the future city seen across the valley to the south. Not playable (yet).
 *
 * Real 3D geometry (parallax stays correct as the camera moves), built for distance and kept cheap:
 *  - four depth bands (near → far horizon); towers merged per band × facade style (a handful of draw calls)
 *  - three facade styles at real scale (glass curtain wall, punched residential windows, ribbon offices),
 *    lit in believable clusters, on varied silhouettes: setback towers, round and chamfered towers, slabs,
 *    wedge roofs, crowns, spires and antennas
 *  - neon edge trims, a street-light grid at the city's feet and moving traffic on the valley road
 *  - the CHAD CASINO landmark: gold tower, curved podium, LED screen, neon sign, sweeping searchlights
 *  - baked atmospheric haze per band (fog-free materials: scene fog would erase a city this far away)
 */
export const CITY = { z0: 265, z1: 430, floorY: -44 }

type Disposable = THREE.Material | THREE.Texture | THREE.BufferGeometry
type Style = 'glass' | 'punched' | 'ribbon'
/** one facade tile = 24 m wide × 48 m tall */
const TILE_W = 24
const TILE_H = 48

function facadeTexture(style: Style, seed: number) {
  const W = 512
  const H = 1024
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const R = rng(seed)
  const floors = 16 // 3 m floors
  const fh = H / floors
  if (style === 'glass') {
    // dark blue-grey curtain wall; whole office floors lit in runs; thin mullions every 1.5 m
    g.fillStyle = '#0b1220'
    g.fillRect(0, 0, W, H)
    const sky = g.createLinearGradient(0, 0, W, H)
    sky.addColorStop(0, 'rgba(90,110,170,0.18)')
    sky.addColorStop(1, 'rgba(20,20,40,0)')
    g.fillStyle = sky
    g.fillRect(0, 0, W, H)
    for (let f = 0; f < floors; f++) {
      const lit = R() < 0.42
      if (lit) {
        const x0 = Math.floor(R() * 6) * (W / 16)
        const x1 = x0 + (4 + Math.floor(R() * 12)) * (W / 16)
        g.fillStyle = R() < 0.3 ? 'rgba(170,215,255,0.85)' : 'rgba(255,226,170,0.82)'
        g.fillRect(x0, f * fh + 6, Math.min(W, x1) - x0, fh - 12)
      }
      g.fillStyle = '#05070c'
      g.fillRect(0, f * fh, W, 5) // floor slab
    }
    g.fillStyle = 'rgba(0,0,0,0.55)'
    for (let x = 0; x < W; x += W / 16) g.fillRect(x, 0, 2, H)
  } else if (style === 'punched') {
    // masonry residential: small individual windows, warm, about a third lit
    g.fillStyle = '#1b1720'
    g.fillRect(0, 0, W, H)
    const cols = 12
    const cw = W / cols
    for (let f = 0; f < floors; f++)
      for (let k = 0; k < cols; k++) {
        const lit = R() < 0.3
        g.fillStyle = lit ? (R() < 0.7 ? '#ffcf8a' : '#ffe9c2') : R() < 0.5 ? '#0d0c12' : '#13121a'
        g.globalAlpha = lit ? 0.7 + R() * 0.3 : 1
        g.fillRect(k * cw + cw * 0.25, f * fh + fh * 0.22, cw * 0.5, fh * 0.52)
        g.globalAlpha = 1
      }
  } else {
    // office ribbons: continuous horizontal window bands with lit stretches
    g.fillStyle = '#16141c'
    g.fillRect(0, 0, W, H)
    for (let f = 0; f < floors; f++) {
      g.fillStyle = '#0a0b12'
      g.fillRect(0, f * fh + fh * 0.3, W, fh * 0.48)
      let x = 0
      while (x < W) {
        const run = 30 + R() * 160
        if (R() < 0.45) {
          g.fillStyle = R() < 0.5 ? 'rgba(255,214,150,0.85)' : 'rgba(200,230,255,0.8)'
          g.fillRect(x, f * fh + fh * 0.33, Math.min(run, W - x), fh * 0.42)
        }
        x += run + 10
      }
    }
  }
  // roof swatch (top-right corner) — roofs and spires map here
  g.fillStyle = '#06070c'
  g.fillRect(W - 16, 0, 16, 16)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  return t
}
const ROOF_UV = 0.99

/** set facade UVs in metres on any geometry whose sides are vertical; caps → roof swatch */
function facadeUV(g: THREE.BufferGeometry, u0: number) {
  const pos = g.attributes.position as THREE.BufferAttribute
  const nor = g.attributes.normal as THREE.BufferAttribute
  const uv = g.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(nor.getY(i)) > 0.7) {
      uv.setXY(i, ROOF_UV, ROOF_UV)
      continue
    }
    // horizontal coordinate along the facade: project on the face tangent
    const nx = nor.getX(i)
    const nz = nor.getZ(i)
    const along = -nz * pos.getX(i) + nx * pos.getZ(i)
    uv.setXY(i, u0 + along / TILE_W, pos.getY(i) / TILE_H)
  }
}
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d).toNonIndexed()
const prism = (r: number, h: number, sides: number, rot = 0) => {
  const g = new THREE.CylinderGeometry(r, r, h, sides, 1).toNonIndexed()
  g.rotateY(rot)
  return g
}

/** Unlit, fog-free, with baked distance haze that thickens toward the valley floor. */
function hazeMaterial(map: THREE.Texture | null, haze: THREE.Color, k: number, D: Disposable[], color?: THREE.Color) {
  const m = new THREE.MeshBasicMaterial({ map, fog: false, color: color ?? new THREE.Color(1, 1, 1) })
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
  const R = rng(1337)
  const Y = CITY.floorY
  const haze = new THREE.Color('#2b1d38')
  const tex: Record<Style, THREE.Texture> = { glass: facadeTexture('glass', 7), punched: facadeTexture('punched', 8), ribbon: facadeTexture('ribbon', 9) }
  Object.values(tex).forEach((t) => D.push(t))

  const bands = [
    { z: [266, 296], n: q === 'low' ? 30 : 52, h: [16, 58], w: [10, 22], k: 0.3 },
    { z: [308, 348], n: q === 'low' ? 26 : 44, h: [40, 130], w: [12, 24], k: 0.42 },
    { z: [360, 410], n: q === 'low' ? 12 : 22, h: [100, 225], w: [14, 26], k: 0.55 },
    { z: [430, 500], n: q === 'low' ? 14 : 26, h: [60, 170], w: [18, 34], k: 0.72 }, // horizon silhouettes
  ]
  const tops: THREE.Vector3[] = []
  const trims: THREE.BufferGeometry[] = []
  const trimColors: number[] = []
  const neonPalette = [new THREE.Color('#ff3d8b'), new THREE.Color('#38e1ff'), new THREE.Color('#ffb347'), new THREE.Color('#b26bff')]
  bands.forEach((b, bi) => {
    const geos: Record<Style, THREE.BufferGeometry[]> = { glass: [], punched: [], ribbon: [] }
    for (let i = 0; i < b.n; i++) {
      const x = (R() - 0.5) * 2 * (200 + R() * 70) * (0.5 + R() * 0.5)
      if (Math.abs(x - 46) < 30 && (bi === 1 || bi === 0)) continue // keep the casino clear
      const z = b.z[0] + R() * (b.z[1] - b.z[0])
      const centre = 1 - Math.min(0.65, Math.abs(x) / 380) // downtown is taller
      const h = b.h[0] + Math.pow(R(), 1.5) * (b.h[1] - b.h[0]) * centre
      const w = b.w[0] + R() * (b.w[1] - b.w[0])
      const d = b.w[0] + R() * (b.w[1] - b.w[0])
      const style: Style = h > 90 ? (R() < 0.7 ? 'glass' : 'ribbon') : R() < 0.55 ? 'punched' : R() < 0.5 ? 'ribbon' : 'glass'
      const u0 = Math.floor(R() * 8) / 8
      const add = (g: THREE.BufferGeometry, gx: number, gy: number, gz: number) => {
        g.translate(gx, gy, gz)
        facadeUV(g, u0)
        geos[style].push(g)
      }
      const kind = R()
      let roofY = Y + h
      let rw = w
      let rd = d
      if (kind < 0.18 && bi < 3) {
        // round tower with a slimmer drum on top
        const r = w * 0.5
        add(prism(r, h, 14), x, Y + h / 2, z)
        const h2 = 6 + R() * 12
        add(prism(r * 0.7, h2, 14), x, Y + h + h2 / 2, z)
        roofY += h2
        rw = rd = r * 1.2
      } else if (kind < 0.34) {
        // chamfered (octagonal) tower
        add(prism(w * 0.55, h, 8, Math.PI / 8), x, Y + h / 2, z)
        rw = rd = w * 0.8
      } else if (kind < 0.5 && h < 70) {
        // long residential slab
        add(box(w * 2.2, h, d * 0.7), x, Y + h / 2, z)
        rw = w * 2.2
        rd = d * 0.7
      } else {
        // stepped setback tower: 1–3 tiers
        const tiers = h > 80 ? 2 + Math.floor(R() * 2) : 1
        let tw = w
        let td = d
        let y = Y
        const parts = tiers === 1 ? [1] : tiers === 2 ? [0.68, 0.32] : [0.55, 0.28, 0.17]
        for (const f of parts) {
          const th = h * f
          add(box(tw, th, td), x, y + th / 2, z)
          y += th
          tw *= 0.72
          td *= 0.72
        }
        roofY = y
        rw = tw / 0.72
        rd = td / 0.72
        // a wedge (slanted) roof on some
        if (R() < 0.22 && bi < 3) {
          const wedge = new THREE.CylinderGeometry(0, rw * 0.5, rw * 0.45, 4, 1).toNonIndexed()
          wedge.rotateY(Math.PI / 4)
          wedge.scale(1, 1, rd / rw)
          wedge.translate(x, roofY + rw * 0.22, z)
          const uv = wedge.attributes.uv as THREE.BufferAttribute
          for (let k = 0; k < uv.count; k++) uv.setXY(k, ROOF_UV, ROOF_UV)
          geos[style].push(wedge)
          roofY += rw * 0.45
        }
      }
      // spires / antennas on the tall ones, beacons on top
      if (h > 95 && bi < 3) {
        const spH = 12 + R() * 26
        const sp = new THREE.CylinderGeometry(0.25, 0.8, spH, 5).toNonIndexed()
        sp.translate(x, roofY + spH / 2, z)
        const uv = sp.attributes.uv as THREE.BufferAttribute
        for (let k = 0; k < uv.count; k++) uv.setXY(k, ROOF_UV, ROOF_UV)
        geos[style].push(sp)
        tops.push(new THREE.Vector3(x, roofY + spH, z))
      } else if (R() < 0.3) tops.push(new THREE.Vector3(x, roofY + 0.6, z))
      // neon edge trims on a few downtown towers (vertical light lines at two corners + a crown band)
      if (bi < 3 && h > 60 && R() < 0.3) {
        const col = neonPalette[Math.floor(R() * neonPalette.length)]
        const t = 0.45
        for (const [ox, oz] of [[-rw / 2, -rd / 2], [rw / 2, -rd / 2]]) {
          const line = new THREE.BoxGeometry(t, roofY - Y - 2, t).toNonIndexed()
          line.translate(x + ox, Y + (roofY - Y) / 2, z + oz - 0.3)
          trims.push(line)
          for (let k = 0; k < line.attributes.position.count; k++) trimColors.push(col.r, col.g, col.b)
        }
        const band = new THREE.BoxGeometry(rw + 0.6, 0.8, 0.5).toNonIndexed()
        band.translate(x, roofY - 0.6, z - rd / 2 - 0.3)
        trims.push(band)
        for (let k = 0; k < band.attributes.position.count; k++) trimColors.push(col.r, col.g, col.b)
      }
    }
    for (const style of Object.keys(geos) as Style[]) {
      if (!geos[style].length) continue
      const merged = mergeGeometries(geos[style])!
      geos[style].forEach((g) => g.dispose())
      D.push(merged)
      const mesh = new THREE.Mesh(merged, hazeMaterial(tex[style], haze, b.k, D))
      mesh.matrixAutoUpdate = false
      mesh.frustumCulled = false // one huge mesh; always partly in view from the lookout
      group.add(mesh)
    }
  })
  // neon trims: one merged, vertex-coloured, HDR mesh (bloom picks them up)
  if (trims.length) {
    const tg = mergeGeometries(trims)!
    trims.forEach((g) => g.dispose())
    tg.setAttribute('color', new THREE.Float32BufferAttribute(trimColors, 3))
    const tm = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false, color: new THREE.Color(1.8, 1.8, 1.8) })
    D.push(tg, tm)
    const trimMesh = new THREE.Mesh(tg, tm)
    trimMesh.frustumCulled = false
    group.add(trimMesh)
  }

  // ── CHAD CASINO landmark: curved gold podium, chamfered gold tower, crown, LED screen, neon, searchlights ──
  const cx = 46
  const cz = 326
  const goldTex = facadeTexture('glass', 99)
  D.push(goldTex)
  const casinoMat = hazeMaterial(goldTex, haze, 0.3, D, new THREE.Color('#ffd27a'))
  const casinoGeos: THREE.BufferGeometry[] = []
  const podium = new THREE.CylinderGeometry(36, 36, 18, 28, 1, false, -Math.PI / 2, Math.PI).toNonIndexed()
  podium.scale(1, 1, 0.55)
  podium.translate(cx, Y + 9, cz + 6)
  facadeUV(podium, 0)
  casinoGeos.push(podium)
  const tower = prism(13, 132, 8, Math.PI / 8)
  tower.translate(cx, Y + 18 + 66, cz + 8)
  facadeUV(tower, 0.25)
  casinoGeos.push(tower)
  const upper = prism(9.5, 16, 8, Math.PI / 8)
  upper.translate(cx, Y + 18 + 132 + 8, cz + 8)
  facadeUV(upper, 0.5)
  casinoGeos.push(upper)
  const casinoMerged = mergeGeometries(casinoGeos)!
  casinoGeos.forEach((g) => g.dispose())
  D.push(casinoMerged)
  const casino = new THREE.Mesh(casinoMerged, casinoMat)
  casino.frustumCulled = false
  group.add(casino)
  const gold = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffbf4d').multiplyScalar(1.7), fog: false, toneMapped: false })
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff5fa8').multiplyScalar(2.4), fog: false, toneMapped: false })
  D.push(gold, ringMat)
  const top = Y + 18 + 132 + 16
  const crownGeo = new THREE.CylinderGeometry(10, 12.5, 9, 8, 1, true)
  const crown = new THREE.Mesh(crownGeo, gold)
  crown.position.set(cx, top + 4.5, cz + 8)
  group.add(crown)
  const spikeGeo = new THREE.ConeGeometry(1.5, 9, 4)
  D.push(spikeGeo)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const spike = new THREE.Mesh(spikeGeo, gold)
    spike.position.set(cx + Math.cos(a) * 10.5, top + 13, cz + 8 + Math.sin(a) * 10.5)
    group.add(spike)
  }
  const ringGeo = new THREE.TorusGeometry(15, 0.8, 6, 48)
  for (const ry of [top - 22, top - 60]) {
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = Math.PI / 2
    ring.position.set(cx, ry, cz + 8)
    group.add(ring)
  }
  // vertical gold light fins up the tower's front
  const finGeo = new THREE.BoxGeometry(0.7, 120, 0.7)
  for (const fx of [-6, 6]) {
    const fin = new THREE.Mesh(finGeo, gold)
    fin.position.set(cx + fx, Y + 18 + 62, cz + 8 - 12.4)
    group.add(fin)
  }
  D.push(crownGeo, ringGeo, finGeo)
  // giant LED screen on the podium (colours cycle) + the neon sign facing the kingdom
  const screenTex = (() => {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 192
    const g = c.getContext('2d')!
    const gr = g.createLinearGradient(0, 0, 512, 192)
    gr.addColorStop(0, '#2a0a3a')
    gr.addColorStop(1, '#5a0f2a')
    g.fillStyle = gr
    g.fillRect(0, 0, 512, 192)
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillStyle = '#ffd36b'
    g.font = '900 96px Anton, Impact, sans-serif'
    g.fillText('777 JACKPOT', 256, 82)
    g.fillStyle = '#ffffff'
    g.font = '700 34px Anton, Impact, sans-serif'
    g.fillText('CHAD CASINO · FREE PLAY · SOON', 256, 156)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  })()
  D.push(screenTex)
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex, color: new THREE.Color('#ffffff'), fog: false, toneMapped: false })
  const screenGeo = new THREE.PlaneGeometry(30, 11)
  const screen = new THREE.Mesh(screenGeo, screenMat)
  screen.position.set(cx - 2, Y + 30, cz - 13.6)
  screen.rotation.y = Math.PI
  group.add(screen)
  D.push(screenMat, screenGeo)
  const neon = neonTexture('CHAD CASINO', 'COMING SOON')
  const neonMat = new THREE.MeshBasicMaterial({ map: neon, transparent: true, fog: false, toneMapped: false, color: new THREE.Color(2.2, 2.2, 2.2), depthWrite: false })
  D.push(neon, neonMat)
  const signGeo = new THREE.PlaneGeometry(64, 24)
  const sign = new THREE.Mesh(signGeo, neonMat)
  sign.position.set(cx, Y + 48, cz - 14)
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
      b.position.set(cx + s * 26, Y + 18, cz + 4)
      group.add(b)
      beams.push(b)
    }

  // aircraft beacons on the tallest roofs (blink)
  const bPos = new Float32Array(tops.length * 3)
  tops.forEach((p, i) => bPos.set([p.x, p.y, p.z], i * 3))
  const bGeo = new THREE.BufferGeometry()
  bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3))
  const bMat = new THREE.PointsMaterial({ color: new THREE.Color('#ff3b30').multiplyScalar(2), size: 3, sizeAttenuation: true, fog: false, toneMapped: false, transparent: true })
  D.push(bGeo, bMat)
  group.add(new THREE.Points(bGeo, bMat))

  // street-light grid at the city's feet (avenues + cross streets), sodium orange with a few white LEDs
  {
    const pts: number[] = []
    const cols: number[] = []
    const warm = new THREE.Color('#ffb060').multiplyScalar(1.6)
    const white = new THREE.Color('#dff1ff').multiplyScalar(1.4)
    const step = q === 'low' ? 14 : 9
    for (let x = -300; x <= 300; x += step)
      for (const z of [262, 304, 356, 420]) {
        pts.push(x + R() * 2, Y + 1.5, z + R() * 2)
        const c = R() < 0.2 ? white : warm
        cols.push(c.r, c.g, c.b)
      }
    for (const x of [-180, -110, -40, 20, 90, 160, 230])
      for (let z = 262; z <= 430; z += step) {
        pts.push(x + R() * 2, Y + 1.5, z)
        cols.push(warm.r, warm.g, warm.b)
      }
    const sg = new THREE.BufferGeometry()
    sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    sg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3))
    const sm = new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: true, vertexColors: true, fog: false, toneMapped: false, transparent: true, opacity: 0.85 })
    D.push(sg, sm)
    group.add(new THREE.Points(sg, sm))
  }

  // warm light-pollution glow rising behind the skyline
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
  const glowGeo = new THREE.PlaneGeometry(1200, 340)
  const glow = new THREE.Mesh(glowGeo, glowMat)
  glow.position.set(0, Y + 120, 515)
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

  // traffic on the valley road (beyond the closed gate): headlights heading out, tail lights coming back
  const CARS = q === 'low' ? 0 : 18
  const carT = Array.from({ length: CARS }, (_, i) => (i / CARS + R() * 0.03) % 1)
  const cPos = new Float32Array(CARS * 3)
  const cCol = new Float32Array(CARS * 3)
  const head = new THREE.Color('#fff4d6').multiplyScalar(2)
  const tail = new THREE.Color('#ff2a1a').multiplyScalar(2)
  for (let i = 0; i < CARS; i++) {
    const c = i % 2 ? tail : head
    cCol.set([c.r, c.g, c.b], i * 3)
  }
  const cGeo = new THREE.BufferGeometry()
  cGeo.setAttribute('position', new THREE.BufferAttribute(cPos, 3))
  cGeo.setAttribute('color', new THREE.BufferAttribute(cCol, 3))
  const cMat = new THREE.PointsMaterial({ size: 0.9, sizeAttenuation: true, vertexColors: true, fog: false, toneMapped: false, transparent: true })
  D.push(cGeo, cMat)
  const cars = new THREE.Points(cGeo, cMat)
  cars.frustumCulled = false
  if (CARS) group.add(cars)
  const P = new THREE.Vector3()
  const T = new THREE.Vector3()
  const placeCars = () => {
    for (let i = 0; i < CARS; i++) {
      const u = 0.12 + carT[i] * 0.88 // traffic only runs past the barricade, never through the gate
      road.getPoint(u, P)
      road.getTangent(u, T)
      const lane = i % 2 ? -1.6 : 1.6
      cPos.set([P.x - T.z * lane, P.y + 0.7, P.z + T.x * lane], i * 3)
    }
    cGeo.attributes.position.needsUpdate = true
  }
  placeCars()

  let t = 0
  const hue = new THREE.Color()
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
      screenMat.color.copy(hue.setHSL((t * 0.05) % 1, 0.45, 0.72)).multiplyScalar(1.3) // the LED wall shimmers through colours
      for (let i = 0; i < CARS; i++) carT[i] = (carT[i] + (i % 2 ? -1 : 1) * dt * 0.012 + 1) % 1
      if (CARS) placeCars()
    },
  }
}
