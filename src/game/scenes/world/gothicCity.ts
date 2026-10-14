import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Quality } from '../../save'
import { rng } from './kit'
import { bannerTexture } from '../textures'
import { softDot } from './textures'

/**
 * The great Gothic city across the valley, south of Chad City (not walkable yet: the valley gate stays closed).
 *
 * Built for distance and kept cheap (a dozen draw calls): procedural terraces of steep-roofed townhouses with
 * chimneys, Gothic towers with needle spires, three walled castles with round towers, a cathedral with a lit
 * clock face, and the Great Citadel in the middle with giant PUMP CHAD banners. Facades are canvas atlases at
 * real scale (3 m floors) with hundreds of lit windows. Unlit, fog-free materials with a baked distance haze
 * (scene fog would erase a city this far away). Between the buildings: street-lantern points, slow-moving
 * lantern lights, strings of hanging lights between towers, drifting mist layers and chimney smoke.
 *
 * `night` picks the palette: midnight stone + warm windows, or the daytime stone + dark glass.
 */
export const CITY = { z0: 265, z1: 500, floorY: -44 }

type Disposable = THREE.Material | THREE.Texture | THREE.BufferGeometry
type Facade = 'house' | 'tower' | 'castle'
const TILE_W = 24
const TILE_H = 48
const ROOF_UV = 0.985

function facadeTexture(kind: Facade, seed: number, night: boolean, small: boolean) {
  const W = small ? 256 : 512
  const H = small ? 512 : 1024
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const R = rng(seed)
  const floors = 16
  const fh = H / floors
  const wall = night ? (kind === 'castle' ? '#3d3650' : kind === 'tower' ? '#2f2a40' : '#2a2436') : kind === 'castle' ? '#b7a98f' : kind === 'tower' ? '#a39782' : '#c2ae92'
  g.fillStyle = wall
  g.fillRect(0, 0, W, H)
  // stone courses / weathering
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${night ? '255,255,255' : '0,0,0'},${0.015 + R() * 0.03})`
    g.fillRect(R() * W, R() * H, 6 + R() * 26, 2 + R() * 4)
  }
  const lit = () => {
    const k = R()
    if (!night) return k < 0.12 ? '#e9c890' : '#2c3442'
    if (k < (kind === 'house' ? 0.5 : kind === 'tower' ? 0.36 : 0.28)) return R() < 0.08 ? '#c9a2ff' : R() < 0.5 ? '#ffc56a' : '#ffa648'
    return '#14111c'
  }
  if (kind === 'house') {
    // timber-and-plaster terraces: string courses, 6 window bays per tile, mullioned windows, sills
    const cols = 6
    const cw = W / cols
    for (let f = 0; f < floors; f++) {
      g.fillStyle = night ? '#1a1622' : '#7a5a3e'
      g.fillRect(0, f * fh, W, 3) // floor beam
      for (let k = 0; k < cols; k++) {
        if (R() < 0.12) continue
        const x = k * cw + cw * 0.28
        const y = f * fh + fh * 0.2
        const w = cw * 0.44
        const h = fh * 0.58
        g.fillStyle = lit()
        g.fillRect(x, y, w, h)
        g.fillStyle = night ? '#120f18' : '#4a3a2a'
        g.fillRect(x + w / 2 - 1.5, y, 3, h)
        g.fillRect(x, y + h * 0.45, w, 3)
        g.fillStyle = night ? '#4a4258' : '#efe4d0'
        g.fillRect(x - 3, y + h, w + 6, 4)
      }
    }
  } else if (kind === 'tower') {
    // Gothic tower: tall paired lancets every second floor, buttress shadows
    const cols = 4
    const cw = W / cols
    for (let f = 0; f < floors; f += 2) {
      for (let k = 0; k < cols; k++) {
        if (R() < 0.18) continue
        const x = k * cw + cw * 0.36
        const y = f * fh + fh * 0.35
        const w = cw * 0.28
        const h = fh * 1.3
        g.fillStyle = lit()
        g.beginPath()
        g.moveTo(x, y + h)
        g.lineTo(x, y + w * 0.6)
        g.quadraticCurveTo(x, y, x + w / 2, y - w * 0.4)
        g.quadraticCurveTo(x + w, y, x + w, y + w * 0.6)
        g.lineTo(x + w, y + h)
        g.closePath()
        g.fill()
      }
      g.fillStyle = night ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.12)'
      g.fillRect(0, f * fh + fh * 1.85, W, 5)
    }
    g.fillStyle = night ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.08)'
    for (let k = 0; k <= cols; k++) g.fillRect(k * cw - 4, 0, 8, H)
  } else {
    // castle masonry: big ashlar courses, few small windows, arrow slits
    for (let y = 0; y < H; y += fh / 2) {
      g.fillStyle = night ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.1)'
      g.fillRect(0, y, W, 2)
    }
    for (let f = 1; f < floors; f += 3)
      for (let k = 0; k < 5; k++) {
        if (R() < 0.35) continue
        const x = (k + 0.5) * (W / 5) - 6
        g.fillStyle = lit()
        g.fillRect(x, f * fh, 12, fh * 0.9)
      }
  }
  // roof swatch (top-right corner): slate
  g.fillStyle = night ? '#1b1926' : '#4c5668'
  g.fillRect(W - 14, 0, 14, 14)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  return t
}

/** vertical sides → facade metres; caps / roofs → the slate swatch */
function facadeUV(g: THREE.BufferGeometry, u0: number, roofOnly = false) {
  const pos = g.attributes.position as THREE.BufferAttribute
  const nor = g.attributes.normal as THREE.BufferAttribute
  const uv = g.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    if (roofOnly || Math.abs(nor.getY(i)) > 0.5) {
      uv.setXY(i, ROOF_UV, ROOF_UV)
      continue
    }
    const along = -nor.getZ(i) * pos.getX(i) + nor.getX(i) * pos.getZ(i)
    uv.setXY(i, u0 + along / TILE_W, pos.getY(i) / TILE_H)
  }
}

/** unlit, fog-free, with baked haze (stronger with distance band and toward the valley floor) */
function hazeMaterial(map: THREE.Texture | null, haze: THREE.Color, k: number, D: Disposable[], opts: { color?: THREE.Color; alphaTest?: number; side?: THREE.Side; floorY: number }) {
  const m = new THREE.MeshBasicMaterial({ map, fog: false, color: opts.color ?? new THREE.Color(1, 1, 1), alphaTest: opts.alphaTest ?? 0, side: opts.side ?? THREE.FrontSide })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uHaze = { value: haze }
    sh.uniforms.uK = { value: k }
    sh.uniforms.uFloor = { value: opts.floorY }
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vWY;').replace('#include <fog_vertex>', '#include <fog_vertex>\nvWY = (modelMatrix * vec4(transformed, 1.0)).y;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uHaze;\nuniform float uK;\nuniform float uFloor;\nvarying float vWY;')
      .replace('#include <opaque_fragment>', '#include <opaque_fragment>\nfloat mist = 1.0 - smoothstep(uFloor, uFloor + 60.0, vWY);\ngl_FragColor.rgb = mix(gl_FragColor.rgb, uHaze, clamp(uK + mist * 0.45, 0.0, 0.92));')
  }
  m.customProgramCacheKey = () => `gothic-haze-${k.toFixed(2)}-${opts.alphaTest ?? 0}`
  D.push(m)
  return m
}

function clockTexture(night: boolean) {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = night ? '#ffe2a8' : '#f2e8d4'
  g.beginPath()
  g.arc(128, 128, 120, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = '#3a2a1a'
  g.lineWidth = 8
  g.stroke()
  g.fillStyle = '#3a2a1a'
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    g.save()
    g.translate(128 + Math.sin(a) * 96, 128 - Math.cos(a) * 96)
    g.rotate(a)
    g.fillRect(-4, -12, 8, 24)
    g.restore()
  }
  g.lineCap = 'round'
  g.lineWidth = 10
  g.beginPath()
  g.moveTo(128, 128)
  g.lineTo(128 + Math.sin(-0.5) * 56, 128 - Math.cos(-0.5) * 56) // ten to midnight
  g.stroke()
  g.lineWidth = 6
  g.beginPath()
  g.moveTo(128, 128)
  g.lineTo(128 + Math.sin(-1.05) * 88, 128 - Math.cos(-1.05) * 88)
  g.stroke()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function mistTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  const R = rng(4242)
  g.clearRect(0, 0, 256, 256)
  for (let i = 0; i < 70; i++) {
    const x = R() * 256
    const y = R() * 256
    const r = 20 + R() * 60
    const grd = g.createRadialGradient(x, y, 0, x, y, r)
    grd.addColorStop(0, 'rgba(255,255,255,0.22)')
    grd.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grd
    for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

export function buildChadCity(scene: THREE.Scene, q: Quality, D: Disposable[], night = true) {
  const group = new THREE.Group()
  group.name = 'gothic-city'
  scene.add(group)
  const R = rng(1337)
  const Y = CITY.floorY
  const haze = new THREE.Color(night ? '#231d3a' : '#c3d6ea')
  const small = q !== 'high'
  const tex: Record<Facade, THREE.Texture> = { house: facadeTexture('house', 7, night, small), tower: facadeTexture('tower', 8, night, small), castle: facadeTexture('castle', 9, night, small) }
  Object.values(tex).forEach((t) => D.push(t))
  const geos: Record<Facade, THREE.BufferGeometry[]>[] = [0, 1, 2, 3].map(() => ({ house: [], tower: [], castle: [] }))
  const goldGeos: THREE.BufferGeometry[] = []
  const chimneys: { x: number; y: number; z: number }[] = []
  const spireTops: THREE.Vector3[] = []
  const lanternPts: number[] = []
  const stringPts: number[] = []
  const stringCols: number[] = []

  const add = (band: number, kind: Facade, g: THREE.BufferGeometry, x: number, y: number, z: number, u0: number, roof = false) => {
    g.translate(x, y, z)
    facadeUV(g, u0, roof)
    geos[band][kind].push(g)
  }
  const gable = (w: number, d: number, h: number) => {
    const s = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)])
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false })
    g.translate(0, 0, -d / 2)
    return g
  }
  const cone = (r: number, h: number, sides: number) => new THREE.ConeGeometry(r, h, sides, 1).toNonIndexed()
  const cyl = (r: number, h: number, sides: number) => new THREE.CylinderGeometry(r, r, h, sides, 1).toNonIndexed()
  const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d).toNonIndexed()

  // ── a terrace of townhouses along a street (x run), each with its own height, roof pitch and chimneys ──
  const terrace = (band: number, x0: number, x1: number, z: number, hMin: number, hMax: number) => {
    let x = x0
    while (x < x1) {
      const w = 7 + R() * 7
      const d = 9 + R() * 4
      const h = hMin + R() * (hMax - hMin)
      const cx = x + w / 2
      const u0 = Math.floor(R() * 6) / 6
      add(band, 'house', box(w, h, d), cx, Y + h / 2, z, u0)
      const rh = w * (0.55 + R() * 0.45)
      if (R() < 0.7) {
        const g = gable(d + 0.6, w + 0.3, rh)
        g.rotateY(Math.PI / 2)
        add(band, 'house', g, cx, Y + h, z, 0, true)
      } else {
        // gable facing the street (Dutch / Gothic front)
        add(band, 'house', gable(w + 0.4, d + 0.4, rh), cx, Y + h, z, 0, true)
      }
      if (R() < 0.75) {
        const chx = cx + (R() - 0.5) * w * 0.6
        const chH = rh * 0.6 + 2
        add(band, 'house', box(1.2, chH, 1.2), chx, Y + h + chH / 2, z + (R() - 0.5) * d * 0.4, 0, true)
        chimneys.push({ x: chx, y: Y + h + chH, z })
      }
      // a lantern at the door on the street side
      if (R() < 0.6) lanternPts.push(cx + (R() - 0.5) * w * 0.5, Y + 3, z - d / 2 - 1.5)
      x += w + (R() < 0.15 ? 4 + R() * 6 : 0)
    }
  }
  // ── a Gothic tower: square or octagonal shaft, belfry stage, pinnacles, a needle spire with a gold finial ──
  const tower = (band: number, x: number, z: number, h: number, w: number) => {
    const oct = R() < 0.4
    const u0 = Math.floor(R() * 4) / 4
    if (oct) add(band, 'tower', cyl(w * 0.58, h, 8), x, Y + h / 2, z, u0)
    else add(band, 'tower', box(w, h, w), x, Y + h / 2, z, u0)
    const bh = w * 0.9
    add(band, 'tower', oct ? cyl(w * 0.5, bh, 8) : box(w * 0.86, bh, w * 0.86), x, Y + h + bh / 2, z, u0)
    const sh = w * (2.6 + R() * 1.8)
    add(band, 'tower', cone(w * (oct ? 0.56 : 0.66), sh, oct ? 8 : 4), x, Y + h + bh + sh / 2, z, 0, true)
    if (!oct)
      for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(band, 'tower', cone(w * 0.1, w * 0.9, 4), x + (px * w) / 2, Y + h + w * 0.45, z + (pz * w) / 2, 0, true)
    const tip = new THREE.Vector3(x, Y + h + bh + sh, z)
    spireTops.push(tip)
    const fin = new THREE.SphereGeometry(w * 0.06 + 0.3, 6, 4).toNonIndexed()
    fin.translate(tip.x, tip.y + 0.3, tip.z)
    goldGeos.push(fin)
    return tip
  }
  // ── a castle: curtain block, round towers with conical roofs, a keep ──
  const castle = (band: number, x: number, z: number, s: number) => {
    const W = 60 * s
    const Dd = 28 * s
    const H = 26 * s
    add(band, 'castle', box(W, H, Dd), x, Y + H / 2, z, 0)
    for (let k = 0; k < Math.floor(W / 6); k++) add(band, 'castle', box(2.6 * s, 3 * s, Dd + 1), x - W / 2 + 3 * s + k * 6 * s, Y + H + 1.5 * s, z, 0, true)
    for (const [tx, tz] of [[-W / 2, -Dd / 2], [W / 2, -Dd / 2], [-W / 2, Dd / 2], [W / 2, Dd / 2], [-W / 6, -Dd / 2], [W / 6, -Dd / 2]]) {
      const r = (5 + R() * 2) * s
      const th = H + (10 + R() * 14) * s
      add(band, 'castle', cyl(r, th, 12), x + tx, Y + th / 2, z + tz, Math.floor(R() * 5) / 5)
      const rh = r * (2.6 + R())
      add(band, 'castle', cone(r * 1.25, rh, 12), x + tx, Y + th + rh / 2, z + tz, 0, true)
      spireTops.push(new THREE.Vector3(x + tx, Y + th + rh, z + tz))
    }
    const kh = H * 1.9
    add(band, 'castle', box(W * 0.36, kh, Dd * 0.7), x, Y + kh / 2, z + Dd * 0.1, 0.3)
    return { W, H, kh }
  }

  // ── band 0: the near quarter (terraced streets running east–west, a few towers) ──
  const quarter = q === 'low' ? 0.6 : 1
  for (let z = 270; z < 300; z += 15) {
    for (let x0 = -260; x0 < 260; x0 += 70 + R() * 30) {
      if (R() > quarter) continue
      terrace(0, x0, x0 + 40 + R() * 25, z + (R() - 0.5) * 3, 9, 17)
    }
    // street lanterns along the street in front of the row
    for (let x = -250; x < 250; x += 12 + R() * 8) lanternPts.push(x, Y + 3.5, z - 9)
  }
  for (let i = 0; i < (q === 'low' ? 5 : 9); i++) tower(0, (R() - 0.5) * 460, 285 + R() * 12, 24 + R() * 18, 7 + R() * 3)

  // ── band 1: the old town (taller terraces, Gothic towers, two castles) ──
  for (let z = 310; z < 350; z += 16) {
    for (let x0 = -280; x0 < 280; x0 += 60 + R() * 40) {
      if (R() > quarter) continue
      terrace(1, x0, x0 + 35 + R() * 30, z, 14, 26)
    }
    for (let x = -260; x < 260; x += 16 + R() * 10) lanternPts.push(x, Y + 3.5, z - 10)
  }
  const towers1: THREE.Vector3[] = []
  for (let i = 0; i < (q === 'low' ? 8 : 14); i++) towers1.push(tower(1, (R() - 0.5) * 500, 318 + R() * 26, 38 + R() * 34, 9 + R() * 4))
  castle(1, -170, 338, 1)
  castle(1, 175, 332, 0.9)

  // ── band 2: the landmarks — the Great Citadel (centre), the cathedral + clock tower, more spires ──
  const GC = { x: 8, z: 392 }
  const gc = castle(2, GC.x, GC.z, 1.6)
  // great keep spire: the tallest thing on the skyline
  const keepTop = Y + gc.kh
  add(2, 'castle', cyl(11, 40, 12), GC.x, keepTop + 20, GC.z, 0.2)
  add(2, 'castle', cone(14, 62, 12), GC.x, keepTop + 40 + 31, GC.z, 0, true)
  const gtip = new THREE.Vector3(GC.x, keepTop + 40 + 62, GC.z)
  spireTops.push(gtip)
  {
    const fin = new THREE.SphereGeometry(1.6, 10, 8).toNonIndexed()
    fin.translate(gtip.x, gtip.y + 1, gtip.z)
    goldGeos.push(fin)
  }
  // cathedral: long nave with a steep roof, west front with twin towers, a clock tower over the crossing
  const CA = { x: -88, z: 372 }
  add(2, 'tower', box(22, 34, 70), CA.x, Y + 17, CA.z + 20, 0.1)
  {
    const r = gable(24, 72, 18)
    add(2, 'tower', r, CA.x, Y + 34, CA.z + 20, 0, true)
  }
  tower(2, CA.x - 9, CA.z - 16, 62, 11)
  tower(2, CA.x + 9, CA.z - 16, 62, 11)
  // clock tower
  const CT = { x: CA.x, z: CA.z + 18, h: 92, w: 14 }
  add(2, 'tower', box(CT.w, CT.h, CT.w), CT.x, Y + CT.h / 2, CT.z, 0.5)
  add(2, 'tower', box(CT.w * 0.8, 14, CT.w * 0.8), CT.x, Y + CT.h + 7, CT.z, 0.25)
  add(2, 'tower', cone(CT.w * 0.62, 46, 4), CT.x, Y + CT.h + 14 + 23, CT.z, 0, true)
  spireTops.push(new THREE.Vector3(CT.x, Y + CT.h + 60, CT.z))
  for (let i = 0; i < (q === 'low' ? 6 : 12); i++) {
    const x = (R() - 0.5) * 520
    if (Math.abs(x - GC.x) < 70 || Math.abs(x - CA.x) < 40) continue
    tower(2, x, 365 + R() * 45, 60 + R() * 60, 11 + R() * 5)
  }
  // ── band 3: horizon silhouettes ──
  for (let i = 0; i < (q === 'low' ? 10 : 20); i++) tower(3, (R() - 0.5) * 620, 440 + R() * 60, 50 + R() * 90, 12 + R() * 8)
  for (let i = 0; i < (q === 'low' ? 3 : 6); i++) castle(3, (R() - 0.5) * 560, 470 + R() * 30, 0.9 + R() * 0.6)

  // ── merge per band × facade (haze grows with distance) ──
  const bandK = night ? [0.18, 0.3, 0.42, 0.62] : [0.3, 0.42, 0.55, 0.72]
  geos.forEach((byKind, bi) => {
    for (const kind of Object.keys(byKind) as Facade[]) {
      const list = byKind[kind]
      if (!list.length) continue
      const merged = mergeGeometries(list)!
      list.forEach((g) => g.dispose())
      D.push(merged)
      const mesh = new THREE.Mesh(merged, hazeMaterial(tex[kind], haze, bandK[bi], D, { floorY: Y }))
      mesh.matrixAutoUpdate = false
      mesh.frustumCulled = false
      group.add(mesh)
    }
  })
  if (goldGeos.length) {
    const gg = mergeGeometries(goldGeos)!
    goldGeos.forEach((g) => g.dispose())
    const gm = hazeMaterial(null, haze, 0.25, D, { floorY: Y, color: new THREE.Color(night ? '#e0a83e' : '#d9a640') })
    D.push(gg)
    group.add(new THREE.Mesh(gg, gm))
  }

  // ── the clock face (lit at night) on the north face of the clock tower ──
  {
    const ct = clockTexture(night)
    const cm = new THREE.MeshBasicMaterial({ map: ct, fog: false, toneMapped: !night, color: night ? new THREE.Color(1.5, 1.4, 1.2) : new THREE.Color(1, 1, 1) })
    const cg = new THREE.CircleGeometry(5.2, 32)
    D.push(ct, cm, cg)
    const face = new THREE.Mesh(cg, cm)
    face.position.set(CT.x, Y + CT.h - 9, CT.z - CT.w / 2 - 0.2)
    face.rotation.y = Math.PI // looks north, toward Chad City
    group.add(face)
  }

  // ── giant PUMP CHAD banners on the Great Citadel's north face ──
  {
    const bt = bannerTexture()
    const bm = hazeMaterial(bt, haze, bandK[2] * 0.7, D, { floorY: Y, alphaTest: 0.5, side: THREE.DoubleSide, color: night ? new THREE.Color(1.6, 1.5, 1.5) : undefined })
    D.push(bt)
    for (const dx of [-gc.W * 0.32, -gc.W * 0.12, gc.W * 0.12, gc.W * 0.32]) {
      const bg = new THREE.PlaneGeometry(8, 16)
      D.push(bg)
      const b = new THREE.Mesh(bg, bm)
      b.position.set(GC.x + dx, Y + gc.H - 9, GC.z - 28 * 1.6 * 0.5 - 0.6)
      b.rotation.y = Math.PI
      group.add(b)
    }
  }

  // ── strings of hanging lights between neighbouring towers of the old town (catenaries) ──
  const sPal = [new THREE.Color('#ffb04a'), new THREE.Color('#ff7a1a'), new THREE.Color('#b98cff')]
  towers1.sort((a, b) => a.x - b.x)
  for (let i = 0; i < towers1.length - 1; i++) {
    const a = towers1[i]
    const b = towers1[i + 1]
    if (b.x - a.x > 90) continue
    const ya = Y + 22
    const yb = Y + 20
    const n = 26
    for (let k = 1; k < n; k++) {
      const t = k / n
      stringPts.push(a.x + (b.x - a.x) * t, ya + (yb - ya) * t - Math.sin(Math.PI * t) * 6, a.z + (b.z - a.z) * t)
      const c = sPal[k % sPal.length]
      stringCols.push(c.r, c.g, c.b)
    }
  }

  // ── lights: street lanterns + light strings (HDR points so bloom catches them at night) ──
  const dot = softDot()
  D.push(dot)
  const pointsOf = (arr: number[], cols: number[] | null, size: number, color: THREE.Color) => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3))
    if (cols) g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3))
    const m = new THREE.PointsMaterial({ size, map: dot, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: !!cols, color, fog: false, toneMapped: false, sizeAttenuation: true })
    D.push(g, m)
    const p = new THREE.Points(g, m)
    p.frustumCulled = false
    group.add(p)
    return p
  }
  if (night) {
    pointsOf(lanternPts, null, 4.5, new THREE.Color('#ffb860').multiplyScalar(2.2))
    if (stringPts.length) pointsOf(stringPts, stringCols, 3.2, new THREE.Color(2.4, 2.4, 2.4))
  }

  // ── slow-moving lantern lights in the streets (night watchmen, carriages) ──
  const MOVERS = night && q !== 'low' ? 40 : 0
  const mPos = new Float32Array(Math.max(1, MOVERS) * 3)
  const mSpd = Array.from({ length: MOVERS }, () => (R() < 0.5 ? -1 : 1) * (2 + R() * 4))
  const mZ = Array.from({ length: MOVERS }, () => [261, 276, 291, 300, 316, 332][Math.floor(R() * 6)])
  for (let i = 0; i < MOVERS; i++) mPos.set([(R() - 0.5) * 500, Y + 2.5, mZ[i]], i * 3)
  let movers: THREE.Points | null = null
  if (MOVERS) movers = pointsOf(Array.from(mPos), null, 3.6, new THREE.Color('#ffd08a').multiplyScalar(2.4))

  // ── mist drifting between the bands ──
  const mistTex = mistTexture()
  D.push(mistTex)
  const mists: THREE.Mesh[] = []
  for (const [z, y, op] of [[305, Y + 7, 0.55], [355, Y + 12, 0.5], [425, Y + 18, 0.55]] as const) {
    const t = mistTex.clone()
    t.needsUpdate = true
    t.repeat.set(4, 1)
    const m = new THREE.MeshBasicMaterial({ map: t, color: haze.clone().multiplyScalar(night ? 2.2 : 1.05), transparent: true, opacity: op, depthWrite: false, fog: false })
    const g = new THREE.PlaneGeometry(760, 40)
    D.push(t, m, g)
    const mesh = new THREE.Mesh(g, m)
    mesh.position.set(0, y, z)
    mesh.rotation.y = Math.PI // faces north, toward the viewer in town
    group.add(mesh)
    mists.push(mesh)
  }

  // the road from the valley gate down into the city
  const road = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 75), new THREE.Vector3(1, -3, 84), new THREE.Vector3(-5, -14, 97), new THREE.Vector3(4, -29, 116), new THREE.Vector3(-2, -33, 140), new THREE.Vector3(8, -38, 200), new THREE.Vector3(14, -44, 262)])
  // carriage lanterns on the valley road
  const CARS = q === 'low' ? 0 : 14
  const carT = Array.from({ length: CARS }, (_, i) => (i / CARS + R() * 0.03) % 1)
  const cPos = new Float32Array(Math.max(1, CARS) * 3)
  const cGeo = new THREE.BufferGeometry()
  cGeo.setAttribute('position', new THREE.BufferAttribute(cPos, 3))
  const cMat = new THREE.PointsMaterial({ size: night ? 2.2 : 1.4, map: dot, transparent: true, depthWrite: false, blending: night ? THREE.AdditiveBlending : THREE.NormalBlending, color: night ? new THREE.Color('#ffc070').multiplyScalar(2) : new THREE.Color('#e8e4dc'), fog: false, toneMapped: !night })
  D.push(cGeo, cMat)
  const cars = new THREE.Points(cGeo, cMat)
  cars.frustumCulled = false
  if (CARS) group.add(cars)
  const P = new THREE.Vector3()
  const Tn = new THREE.Vector3()
  const placeCars = () => {
    for (let i = 0; i < CARS; i++) {
      const u = 0.12 + carT[i] * 0.88 // only past the closed gate, never through it
      road.getPoint(u, P)
      road.getTangent(u, Tn)
      const lane = i % 2 ? -1.6 : 1.6
      cPos.set([P.x - Tn.z * lane, P.y + 1.2, P.z + Tn.x * lane], i * 3)
    }
    cGeo.attributes.position.needsUpdate = true
  }
  placeCars()

  return {
    group,
    road,
    /** chimney tops (world space) for the smoke emitters */
    chimneys: chimneys.filter((_, i) => i % 3 === 0).slice(0, q === 'high' ? 40 : 18),
    update(dt: number) {
      for (let i = 0; i < CARS; i++) carT[i] = (carT[i] + (i % 2 ? -1 : 1) * dt * 0.01 + 1) % 1
      if (CARS) placeCars()
      if (movers) {
        const a = movers.geometry.attributes.position as THREE.BufferAttribute
        for (let i = 0; i < MOVERS; i++) {
          let x = a.getX(i) + mSpd[i] * dt
          if (x > 260) x = -260
          if (x < -260) x = 260
          a.setX(i, x)
        }
        a.needsUpdate = true
      }
      for (const [i, m] of mists.entries()) ((m.material as THREE.MeshBasicMaterial).map as THREE.Texture).offset.x += dt * (0.004 + i * 0.002)
    },
  }
}
