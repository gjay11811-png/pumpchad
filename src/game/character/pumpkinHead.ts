import * as THREE from 'three'
import type { Appearance } from './types'

type D = (THREE.Material | THREE.BufferGeometry | THREE.Texture)[]

/**
 * PumpChad's pumpkin head, v3 — the exterior rebuilt against the original artwork (art-source-pumpchad.png):
 *   • form: twelve lobes of DIFFERENT width and depth (a slow, seeded irregularity), grooves that pinch toward the stem and the base, a squat egg profile, a
 *     tight dimple around the stem with a raised calyx ring, a little overall asymmetry. The mesh is a custom 96×56 grid whose normals are taken from the
 *     surface function itself (central differences), so there is no seam and no polygon banding, whatever the lobe depth;
 *   • rind: a fine fibrous canvas texture (streaks, cracks, speckle, ochre and darker patches, scuffs near the stem, grooves that go brown-orange), a matching
 *     bump map and a ROUGHNESS map (waxy on the lobe crests, matte in the grooves and blemishes) — texture detail does the fine work, geometry only the form;
 *   • stem: a curved, ridged, tapered tube with a flared base, green at the base fading to a dried brown tip, a flat cut end;
 *   • sunglasses: wide wrap-around lenses and frames FITTED to the rind (each vertex is placed on the head's actual front surface), a nose bridge and temples.
 * The face is the artwork's: angled eyes, a nose triangle and a toothed grin with a dark cut rim, an inner flesh gradient and a controlled warm glow.
 */
export const R = 0.235 // pumpkin radius (m): the rig's proportions are unchanged
const RIBS = 12
const SQUASH = 0.8

const rngFrom = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646

/** per-lobe character, fixed: a width wobble (shifts the grooves) and a depth factor */
const LOBE_DEPTH = Array.from({ length: RIBS }, (_, k) => 0.82 + 0.34 * (0.5 + 0.5 * Math.sin(k * 2.399 + 0.7)))
const LOBE_SHIFT = Array.from({ length: RIBS }, (_, k) => 0.07 * Math.sin(k * 1.713 + 2.1))

/** the unit-sphere direction for (u, v): u around (0.25 faces +z, like THREE.SphereGeometry), v from the top (0) to the bottom (1) */
function dirOf(u: number, v: number) {
  const phi = u * Math.PI * 2
  const psi = v * Math.PI
  return { x: -Math.cos(phi) * Math.sin(psi), y: Math.cos(psi), z: Math.sin(phi) * Math.sin(psi), psi }
}

/** the pumpkin surface point (metres, head-local, y up, face toward +z) */
export function surfaceAt(u: number, v: number, out = new THREE.Vector3()) {
  const { x, y, z, psi } = dirOf(u, v)
  const theta = Math.atan2(x, z)
  // lobes: a smooth crease profile whose centre-lines drift a little; depth varies per lobe and fades toward the poles (so the grooves converge, not stripe)
  // lobe k spans f 0…1 with its CREST at f = 0.5; the crest of lobe 0 faces front (theta 0), grooves sit at f = 0 / 1
  const t = ((theta + Math.PI) / (Math.PI * 2)) * RIBS + RIBS / 2 + 0.5
  const k = ((Math.floor(t) % RIBS) + RIBS) % RIBS
  const f = t - Math.floor(t)
  const shift = LOBE_SHIFT[k] * (1 - Math.abs(f - 0.5) * 2) // widest drift mid-lobe
  const ff = Math.min(1, Math.max(0, f + shift))
  const crease = Math.pow(Math.abs(Math.sin(ff * Math.PI)), 0.55) // 1 on the crest, 0 in the groove
  const sinPsi = Math.sin(psi)
  const dPrev = (LOBE_DEPTH[(k + RIBS - 1) % RIBS] + LOBE_DEPTH[k]) / 2 // the groove between two lobes takes the average of both, so it has no step
  const dNext = (LOBE_DEPTH[k] + LOBE_DEPTH[(k + 1) % RIBS]) / 2
  const ds = f * f * (3 - 2 * f)
  const depth = 0.118 * (dPrev + (dNext - dPrev) * ds) * Math.pow(sinPsi, 0.6) * (1 + 0.5 * Math.pow(Math.max(0, 0.3 - psi / Math.PI) / 0.3, 2)) // pinch toward the stem
  let rad = 1 - depth * (1 - crease)
  // a slow asymmetry: one side a touch fuller, a very slight lean, an egg profile
  rad *= 1 + 0.028 * Math.sin(theta + 0.8) * sinPsi + 0.018 * Math.sin(2 * theta + psi * 2.6) - 0.05 * Math.cos(psi) * Math.cos(psi) * 0.4
  rad *= 1 - Math.pow(Math.abs(Math.cos(psi)), 6) * 0.1
  let ny = y * SQUASH
  // the stem dimple (a tight, deep pit with a raised calyx rim) and a shallower base dimple
  if (y > 0) ny -= Math.pow(Math.max(0, y - 0.7) / 0.3, 2) * 0.2 - Math.exp(-Math.pow((psi - 0.36) / 0.07, 2)) * 0.012
  else ny += Math.pow(Math.max(0, -y - 0.8) / 0.2, 2) * 0.1
  return out.set(x * rad * R, ny * R, z * rad * R)
}

/** a smooth outward normal from the surface function itself (central differences): seam-free and band-free */
function normalAt(u: number, v: number, out = new THREE.Vector3()) {
  const e = 0.0012
  const a = surfaceAt(u + e, v)
  const b = surfaceAt(u - e, v)
  const vv = Math.min(0.995, Math.max(0.005, v))
  const c = surfaceAt(u, vv + e)
  const d = surfaceAt(u, vv - e)
  const du = a.sub(b)
  const dv = c.sub(d)
  // u runs +φ (counter-clockwise seen from above is −x→+z…), v runs top → bottom: the outward normal is du × dv with the sign fixed by the sample at the front
  out.crossVectors(du, dv).normalize()
  const p = surfaceAt(u, v)
  if (out.dot(p) < 0) out.negate()
  return out
}

/** the front (+z) surface height at (x, y) in head space: a finely sampled height field built once, used to FIT the sunglasses to the rind */
let FRONT: { w: number; h: number; x0: number; y0: number; cell: number; z: Float32Array } | null = null
function frontField() {
  if (FRONT) return FRONT
  const cell = 0.002
  const x0 = -0.3
  const y0 = -0.25
  const w = Math.ceil(0.6 / cell)
  const h = Math.ceil(0.5 / cell)
  const z = new Float32Array(w * h).fill(-1)
  const p = new THREE.Vector3()
  for (let iu = 0; iu <= 720; iu++) {
    const u = 0.0 + iu / 1440 // the front half-turn: φ from 0 to π covers z ≥ 0
    for (let iv = 0; iv <= 400; iv++) {
      surfaceAt(u, iv / 400, p)
      if (p.z <= 0) continue
      const ix = Math.round((p.x - x0) / cell)
      const iy = Math.round((p.y - y0) / cell)
      if (ix < 0 || iy < 0 || ix >= w || iy >= h) continue
      const i = iy * w + ix
      if (p.z > z[i]) z[i] = p.z
    }
  }
  // fill any hole from its neighbours (the grid is denser than the samples at the sides)
  for (let pass = 0; pass < 3; pass++)
    for (let iy = 1; iy < h - 1; iy++)
      for (let ix = 1; ix < w - 1; ix++) {
        const i = iy * w + ix
        if (z[i] >= 0) continue
        const n = [z[i - 1], z[i + 1], z[i - w], z[i + w]].filter((q) => q >= 0)
        if (n.length) z[i] = n.reduce((s, q) => s + q, 0) / n.length
      }
  FRONT = { w, h, x0, y0, cell, z }
  return FRONT
}
export function frontZ(x: number, y: number) {
  const F = frontField()
  const fx = (x - F.x0) / F.cell
  const fy = (y - F.y0) / F.cell
  const ix = Math.min(F.w - 2, Math.max(0, Math.floor(fx)))
  const iy = Math.min(F.h - 2, Math.max(0, Math.floor(fy)))
  const tx = fx - ix
  const ty = fy - iy
  const g = (a: number, b: number) => Math.max(0, F.z[(iy + b) * F.w + ix + a])
  return (g(0, 0) * (1 - tx) + g(1, 0) * tx) * (1 - ty) + (g(0, 1) * (1 - tx) + g(1, 1) * tx) * ty
}

/* ───────────── textures ───────────── */
function rindTextures(skin: string) {
  const W = 1024
  const H = 512
  const mk = () => {
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    return [c, c.getContext('2d')!] as const
  }
  const [cMap, g] = mk()
  const [cEm, ge] = mk()
  const [cBump, gb] = mk()
  const [cRough, gr] = mk()
  const rnd = rngFrom(9)
  const base = new THREE.Color(skin)
  const hsl = { h: 0, s: 0, l: 0 }
  base.getHSL(hsl)
  const col = (dl: number, ds = 0, dh = 0) => `hsl(${(hsl.h + dh) * 360}, ${Math.min(100, Math.max(0, (hsl.s + ds) * 100))}%, ${Math.max(0, Math.min(100, (hsl.l + dl) * 100))}%)`
  // base: a slow vertical grade (paler on the shoulders, deeper toward the base) …
  const grd = g.createLinearGradient(0, 0, 0, H)
  grd.addColorStop(0, col(-0.07, 0.03))
  grd.addColorStop(0.4, col(0.05, 0.0))
  grd.addColorStop(0.8, col(-0.02, 0.0))
  grd.addColorStop(1, col(-0.09, 0.04))
  g.fillStyle = grd
  g.fillRect(0, 0, W, H)
  // … big soft ochre and darker patches (a real rind never has one flat tone)
  for (let i = 0; i < 46; i++) {
    const x = rnd() * W
    const y = H * (0.12 + rnd() * 0.78)
    const r = 30 + rnd() * 90
    const gg = g.createRadialGradient(x, y, 0, x, y, r)
    const ochre = rnd() < 0.55
    gg.addColorStop(0, ochre ? 'rgba(230,170,70,0.22)' : 'rgba(110,40,6,0.2)')
    gg.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = gg
    g.fillRect(x - r, y - r, r * 2, r * 2)
  }
  gb.fillStyle = '#808080'
  gb.fillRect(0, 0, W, H)
  gr.fillStyle = '#7a7a7a'
  gr.fillRect(0, 0, W, H)
  ge.fillStyle = '#2a1205'
  ge.fillRect(0, 0, W, H)
  // grooves: brown-orange darkening with an ochre shoulder either side, and a lighter, glossier crest between them
  for (let k = 0; k < RIBS; k++) {
    const uC = 0.25 + (k + 0.5) / RIBS // the groove between lobe k and k+1 (lobe 0's crest faces front)
    const x = ((uC % 1) + 1) % 1 * W
    for (const off of [0, -W, W]) {
      const xx = x + off
      const a = g.createLinearGradient(xx - 34, 0, xx + 34, 0)
      a.addColorStop(0, 'rgba(0,0,0,0)')
      a.addColorStop(0.35, 'rgba(210,140,40,0.14)')
      a.addColorStop(0.5, 'rgba(70,24,2,0.62)')
      a.addColorStop(0.65, 'rgba(210,140,40,0.14)')
      a.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = a
      g.fillRect(xx - 34, 0, 68, H)
      const rr = gr.createLinearGradient(xx - 34, 0, xx + 34, 0)
      rr.addColorStop(0, 'rgba(0,0,0,0)')
      rr.addColorStop(0.5, 'rgba(255,255,255,0.35)') // rougher in the groove
      rr.addColorStop(1, 'rgba(0,0,0,0)')
      gr.fillStyle = rr
      gr.fillRect(xx - 34, 0, 68, H)
      const bb = gb.createLinearGradient(xx - 26, 0, xx + 26, 0)
      bb.addColorStop(0, 'rgba(128,128,128,0)')
      bb.addColorStop(0.5, 'rgba(30,30,30,0.7)')
      bb.addColorStop(1, 'rgba(128,128,128,0)')
      gb.fillStyle = bb
      gb.fillRect(xx - 26, 0, 52, H)
    }
    // the crest highlight (waxy)
    const cx = x + W / RIBS / 2
    for (const off of [0, -W, W]) {
      const hl = g.createLinearGradient(cx + off - 40, 0, cx + off + 40, 0)
      hl.addColorStop(0, 'rgba(255,190,90,0)')
      hl.addColorStop(0.5, 'rgba(255,190,90,0.16)')
      hl.addColorStop(1, 'rgba(255,190,90,0)')
      g.fillStyle = hl
      g.fillRect(cx + off - 40, 0, 80, H)
      const rl = gr.createLinearGradient(cx + off - 40, 0, cx + off + 40, 0)
      rl.addColorStop(0, 'rgba(0,0,0,0)')
      rl.addColorStop(0.5, 'rgba(0,0,0,0.3)') // glossier on the crest
      rl.addColorStop(1, 'rgba(0,0,0,0)')
      gr.fillStyle = rl
      gr.fillRect(cx + off - 40, 0, 80, H)
    }
  }
  // fine fibrous streaks, running pole to pole (a pumpkin's rind grain)
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * W
    const y = rnd() * H
    const len = 14 + rnd() * 60
    const light = rnd() > 0.5
    g.strokeStyle = light ? `rgba(255,214,140,${0.03 + rnd() * 0.06})` : `rgba(80,26,0,${0.04 + rnd() * 0.08})`
    g.lineWidth = 0.6 + rnd() * 1.6
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + (rnd() - 0.5) * 5, y + len)
    g.stroke()
    gb.strokeStyle = light ? 'rgba(170,170,170,0.35)' : 'rgba(95,95,95,0.4)'
    gb.lineWidth = 0.8
    gb.beginPath()
    gb.moveTo(x, y)
    gb.lineTo(x + (rnd() - 0.5) * 4, y + len * 0.7)
    gb.stroke()
  }
  // small cracks and creases (short, slightly branching), speckles, and a few dried scuffs
  for (let i = 0; i < 80; i++) {
    const x = rnd() * W
    const y = H * (0.08 + rnd() * 0.82)
    const ang = Math.PI / 2 + (rnd() - 0.5) * 1.1
    const len = 8 + rnd() * 30
    g.strokeStyle = 'rgba(70,22,0,0.3)'
    g.lineWidth = 0.8 + rnd()
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len)
    g.stroke()
    gb.strokeStyle = 'rgba(40,40,40,0.7)'
    gb.lineWidth = 1
    gb.beginPath()
    gb.moveTo(x, y)
    gb.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len)
    gb.stroke()
  }
  for (let i = 0; i < 700; i++) {
    const x = rnd() * W
    const y = rnd() * H
    const r = 0.8 + rnd() * 2.2
    g.fillStyle = rnd() < 0.6 ? 'rgba(90,40,8,0.22)' : 'rgba(255,225,160,0.2)'
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.fill()
    gb.fillStyle = 'rgba(70,70,70,0.6)'
    gb.beginPath()
    gb.arc(x, y, r, 0, Math.PI * 2)
    gb.fill()
    gr.fillStyle = 'rgba(255,255,255,0.18)'
    gr.beginPath()
    gr.arc(x, y, r * 1.6, 0, Math.PI * 2)
    gr.fill()
  }
  // near the stem (the top strip) the rind is paler and dry; the base darkens
  const top = g.createLinearGradient(0, 0, 0, 70)
  top.addColorStop(0, 'rgba(200,150,70,0.38)')
  top.addColorStop(1, 'rgba(200,150,70,0)')
  g.fillStyle = top
  g.fillRect(0, 0, W, 70)
  // ── the carved face: centred on u = 0.25 ──
  const cx = 0.25 * W
  const carve = (path: (c: CanvasRenderingContext2D) => void, glowK = 1) => {
    // colour map: a dark cut rim, an inner flesh gradient (pale gold centre → orange edge) and a thin bright inner lip
    g.save()
    path(g)
    g.lineJoin = 'round'
    g.lineWidth = 11
    g.strokeStyle = '#2a0c02'
    g.stroke()
    const fl = g.createLinearGradient(0, 200, 0, 380)
    fl.addColorStop(0, '#ffd978')
    fl.addColorStop(1, '#ff9a2a')
    g.fillStyle = fl
    g.fill()
    g.lineWidth = 3
    g.strokeStyle = 'rgba(255,240,170,0.8)'
    g.stroke()
    g.restore()
    ge.save()
    path(ge)
    ge.fillStyle = `rgb(${Math.round(255 * glowK)},${Math.round(236 * glowK)},${Math.round(200 * glowK)})`
    ge.fill()
    ge.lineJoin = 'round'
    ge.lineWidth = 2
    ge.strokeStyle = 'rgba(255,255,255,0.6)'
    ge.stroke()
    ge.restore()
    // bump: the opening is a hole (dark), with a raised lip of cut rind around it (thickness)
    gb.save()
    path(gb)
    gb.lineJoin = 'round'
    gb.lineWidth = 16
    gb.strokeStyle = 'rgba(205,205,205,0.9)'
    gb.stroke()
    gb.lineWidth = 8
    gb.strokeStyle = '#1a1a1a'
    gb.stroke()
    gb.fillStyle = '#0a0a0a'
    gb.fill()
    gb.restore()
    gr.save()
    path(gr)
    gr.fillStyle = '#d0d0d0'
    gr.fill()
    gr.restore()
  }
  const tri = (x: number, y: number, w: number, h: number, flip = false) => (c: CanvasRenderingContext2D) => {
    c.beginPath()
    c.moveTo(x - w / 2, flip ? y - h / 2 : y + h / 2)
    c.lineTo(x + w / 2, flip ? y - h / 2 : y + h / 2)
    c.lineTo(x + (flip ? 0.08 : -0.08) * w, flip ? y + h / 2 : y - h / 2)
    c.closePath()
  }
  carve(tri(cx - 52, 222, 64, 44))
  carve(tri(cx + 52, 222, 64, 44))
  carve(tri(cx, 268, 28, 24))
  carve((c) => {
    c.beginPath()
    c.moveTo(cx - 118, 288)
    c.quadraticCurveTo(cx, 380, cx + 118, 288)
    c.lineTo(cx + 92, 320)
    c.lineTo(cx + 70, 310)
    c.lineTo(cx + 54, 332)
    c.lineTo(cx + 30, 320)
    c.lineTo(cx + 10, 338)
    c.lineTo(cx - 12, 322)
    c.lineTo(cx - 32, 338)
    c.lineTo(cx - 54, 320)
    c.lineTo(cx - 72, 334)
    c.lineTo(cx - 94, 316)
    c.closePath()
  })
  const tex = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c)
    t.wrapS = THREE.RepeatWrapping
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
  }
  return { map: tex(cMap, true), emissive: tex(cEm, true), bump: tex(cBump, false), rough: tex(cRough, false) }
}

function stemTexture() {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 256
  const g = c.getContext('2d')!
  const rnd = rngFrom(17)
  // v runs along the tube (0 at the base): a dark brown ring, olive green, a lighter green shoulder, then dried brown toward the tip
  const grd = g.createLinearGradient(0, 256, 0, 0)
  grd.addColorStop(0, '#3a2a14')
  grd.addColorStop(0.08, '#3d4a1c')
  grd.addColorStop(0.35, '#4f6a24')
  grd.addColorStop(0.62, '#5a6a28')
  grd.addColorStop(0.85, '#6a5a2a')
  grd.addColorStop(1, '#4a3418')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 256)
  for (let i = 0; i < 260; i++) {
    g.strokeStyle = rnd() > 0.5 ? `rgba(20,30,6,${0.12 + rnd() * 0.18})` : `rgba(180,190,100,${0.06 + rnd() * 0.1})`
    g.lineWidth = 1 + rnd() * 2
    const x = rnd() * 128
    const y = rnd() * 256
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + (rnd() - 0.5) * 3, y + 10 + rnd() * 40)
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/* ───────────── the head ───────────── */
export function buildPumpkinHeadV3(a: Appearance, D: D) {
  const group = new THREE.Group()
  const SU = 96
  const SV = 56
  const pos: number[] = []
  const nor: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const p = new THREE.Vector3()
  const n = new THREE.Vector3()
  for (let iv = 0; iv <= SV; iv++) {
    const v = iv / SV
    for (let iu = 0; iu <= SU; iu++) {
      const u = iu / SU
      surfaceAt(u, v, p)
      normalAt(u, v, n)
      pos.push(p.x, p.y, p.z)
      nor.push(n.x, n.y, n.z)
      uv.push(u, 1 - v)
    }
  }
  for (let iv = 0; iv < SV; iv++)
    for (let iu = 0; iu < SU; iu++) {
      const a0 = iv * (SU + 1) + iu
      const b0 = a0 + SU + 1
      // the same winding SphereGeometry uses, so the outside faces out and the stage's lighting is unchanged
      if (iv !== 0) idx.push(a0, b0, a0 + 1)
      if (iv !== SV - 1) idx.push(b0, b0 + 1, a0 + 1)
    }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setIndex(idx)
  geo.computeBoundingSphere()
  const t = rindTextures(a.skin)
  const mat = new THREE.MeshPhysicalMaterial({
    map: t.map,
    bumpMap: t.bump,
    bumpScale: 1.7,
    roughnessMap: t.rough,
    roughness: 0.8, // the map multiplies this: crests ~0.5, grooves and blemishes ~0.75
    emissiveMap: t.emissive,
    emissive: new THREE.Color(a.glow),
    emissiveIntensity: 2.6,
    sheen: 0.3,
    sheenColor: new THREE.Color('#ffd9a8'),
    clearcoat: 0.22, // a waxy bloom, not lacquer
    clearcoatRoughness: 0.45,
  })
  D.push(geo, mat, t.map, t.bump, t.emissive, t.rough)
  const head = new THREE.Mesh(geo, mat)
  head.castShadow = true
  group.add(head)

  // ── the stem: a ridged, tapered tube that rises from the calyx, bends and hooks over; green at the base, dried brown at the tip ──
  const top = surfaceAt(0, 0).y
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.002, 0.04, 0.004),
    new THREE.Vector3(0.014, 0.088, 0.008),
    new THREE.Vector3(0.05, 0.132, 0.006),
    new THREE.Vector3(0.1, 0.142, 0.0),
    new THREE.Vector3(0.14, 0.118, -0.006),
  ])
  const TS = 40
  const RS = 20
  const sp: number[] = []
  const sn: number[] = []
  const su: number[] = []
  const si: number[] = []
  const frames = curve.computeFrenetFrames(TS, false)
  const c0 = new THREE.Vector3()
  for (let i = 0; i <= TS; i++) {
    const tt = i / TS
    curve.getPointAt(tt, c0)
    // radius: flared foot → tapered neck → slight swell at the hook → a blunt cut end
    const rad = (0.046 - 0.026 * Math.min(1, tt / 0.3) + 0.007 * Math.sin(tt * Math.PI * 2.4) - 0.006 * Math.max(0, tt - 0.7)) * (tt < 0.06 ? 1 + (0.06 - tt) * 5 : 1)
    for (let j = 0; j <= RS; j++) {
      const ang = (j / RS) * Math.PI * 2 + tt * 0.9 // a slight twist
      const ridge = 1 + Math.cos(ang * 5) * 0.14 // five ridges
      const nx = frames.normals[i]
      const bx = frames.binormals[i]
      const dir = nx.clone().multiplyScalar(Math.cos(ang)).addScaledVector(bx, Math.sin(ang))
      const pt = c0.clone().addScaledVector(dir, rad * ridge)
      sp.push(pt.x, pt.y, pt.z)
      sn.push(dir.x, dir.y, dir.z)
      su.push(j / RS, tt)
    }
  }
  for (let i = 0; i < TS; i++)
    for (let j = 0; j < RS; j++) {
      const a0 = i * (RS + 1) + j
      const b0 = a0 + RS + 1
      si.push(a0, a0 + 1, b0, b0, a0 + 1, b0 + 1)
    }
  const sg = new THREE.BufferGeometry()
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3))
  sg.setAttribute('normal', new THREE.Float32BufferAttribute(sn, 3))
  sg.setAttribute('uv', new THREE.Float32BufferAttribute(su, 2))
  sg.setIndex(si)
  const stemTex = stemTexture()
  const stemMat = new THREE.MeshStandardMaterial({ map: stemTex, roughness: 0.78, metalness: 0 })
  D.push(sg, stemMat, stemTex)
  const stem = new THREE.Mesh(sg, stemMat)
  stem.position.set(0, top - 0.018, 0)
  stem.castShadow = true
  group.add(stem)
  // the calyx: a dark, ridged, slightly raised collar where the stem meets the rind
  const calyxPts: THREE.Vector2[] = []
  for (let i = 0; i <= 8; i++) calyxPts.push(new THREE.Vector2(0.075 - Math.pow(i / 8, 0.7) * 0.04 + (i === 0 ? 0.01 : 0), (i / 8) * 0.03))
  const cg = new THREE.LatheGeometry(calyxPts, 30)
  const cpos = cg.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < cpos.count; i++) {
    const ang = Math.atan2(cpos.getZ(i), cpos.getX(i))
    const r = Math.hypot(cpos.getX(i), cpos.getZ(i))
    const k = 1 + Math.cos(ang * 6) * 0.12
    cpos.setXYZ(i, Math.cos(ang) * r * k, cpos.getY(i), Math.sin(ang) * r * k)
  }
  cg.computeVertexNormals()
  const calyxMat = new THREE.MeshStandardMaterial({ map: stemTex, color: '#8a7a50', roughness: 0.9 })
  D.push(cg, calyxMat)
  const calyx = new THREE.Mesh(cg, calyxMat)
  calyx.position.set(0, top - 0.026, 0)
  group.add(calyx)
  return group
}

/* ───────────── sunglasses fitted to the rind ───────────── */
/** an outline helper: rounded wrap-around lens, wider at the top, a touch narrower at the bottom outer corner */
function lensOutline(inset = 0) {
  const s = new THREE.Shape()
  const w = 0.056 - inset
  const hT = 0.03 - inset
  const hB = 0.034 - inset
  s.moveTo(-w + 0.012, hT)
  s.lineTo(w - 0.008, hT + 0.003)
  s.quadraticCurveTo(w + 0.004, hT + 0.002, w + 0.003, hT - 0.012)
  s.quadraticCurveTo(w - 0.002, -hB + 0.004, w - 0.02, -hB)
  s.lineTo(-w + 0.02, -hB + 0.004)
  s.quadraticCurveTo(-w - 0.003, -hB + 0.008, -w - 0.002, hT - 0.012)
  s.quadraticCurveTo(-w - 0.002, hT, -w + 0.012, hT)
  return s
}
export function buildShadesV3(D: D, visorColor?: string) {
  const g = new THREE.Group()
  const lensMat = visorColor
    ? new THREE.MeshPhysicalMaterial({ color: '#111', emissive: new THREE.Color(visorColor), emissiveIntensity: 2.2, roughness: 0.1, clearcoat: 1 })
    : new THREE.MeshPhysicalMaterial({ color: '#030305', metalness: 0.0, roughness: 0.22, clearcoat: 0.5, clearcoatRoughness: 0.15, specularIntensity: 0.55, envMapIntensity: 0.35 })
  const frameMat = new THREE.MeshStandardMaterial({ color: '#0b0b0e', metalness: 0.5, roughness: 0.3 })
  D.push(lensMat, frameMat)
  /** place a flat 2-D geometry on the head: each vertex goes to the front surface at its own (x, y), lifted by its own z */
  const fit = (geo: THREE.BufferGeometry, cx: number, cy: number, lift: number, roll: number) => {
    const p = geo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      const lx = p.getX(i)
      const ly = p.getY(i)
      const x = cx + lx * Math.cos(roll) - ly * Math.sin(roll)
      const y = cy + lx * Math.sin(roll) + ly * Math.cos(roll)
      p.setXYZ(i, x, y, frontZ(x, y) + lift + p.getZ(i))
    }
    geo.computeVertexNormals()
    return geo
  }
  for (const s of [-1, 1]) {
    const cx = s * 0.07
    const cy = 0.052
    const roll = s * -0.05 // the outer corner a touch lower: the artwork's slightly angled, confident set
    // lens (thin), then the frame ring around it a little proud of it
    const lens = fit(new THREE.ShapeGeometry(lensOutline(0.0035), 14), cx, cy, 0.0085, roll)
    const lensMesh = new THREE.Mesh(lens, lensMat)
    g.add(lensMesh)
    const ring = lensOutline(0)
    ring.holes.push(new THREE.Path(lensOutline(0.0065).getPoints(14).reverse()))
    const frame = fit(new THREE.ExtrudeGeometry(ring, { depth: 0.004, bevelEnabled: false, curveSegments: 14 }), cx, cy, 0.0075, roll)
    D.push(lens, frame)
    g.add(new THREE.Mesh(frame, frameMat))
    // temple: from the outer frame corner back along the side of the head (it sinks into the rind)
    const outer = new THREE.Vector3(s * 0.125, cy + 0.006, frontZ(s * 0.125, cy) + 0.006)
    const back = new THREE.Vector3(s * 0.205, cy + 0.01, 0.08)
    const arm = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([outer, outer.clone().lerp(back, 0.45).add(new THREE.Vector3(s * 0.004, 0, 0.002)), back]), 10, 0.0042, 6, false)
    D.push(arm)
    g.add(new THREE.Mesh(arm, frameMat))
  }
  // the nose bridge: a short arc across the gap, on the rind
  const bz = frontZ(0, 0.056) + 0.009
  const bridge = new THREE.TorusGeometry(0.011, 0.0033, 6, 12, Math.PI)
  D.push(bridge)
  const bm = new THREE.Mesh(bridge, frameMat)
  bm.position.set(0, 0.058, bz)
  g.add(bm)
  g.traverse((o) => (o.castShadow = true))
  return g
}
