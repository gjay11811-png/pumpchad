import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Appearance } from './types'

type D = (THREE.Material | THREE.BufferGeometry | THREE.Texture)[]
const RIBS = 12
const R = 0.235 // pumpkin radius (m)

/** Rib profile: broad lobes, sharp grooves. 1 at rib centre, (1-depth) in a groove. */
const rib = (theta: number, depth = 0.075) => 1 - depth * (1 - Math.pow(Math.abs(Math.cos((theta * RIBS) / 2)), 0.45))

/* ───────────── pumpkin skin + carved face textures ───────────── */
function pumpkinTextures(skin: string, glow: string) {
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
  // base skin: vertical gradient + darker grooves between ribs + fine streaks
  const base = new THREE.Color(skin)
  const hsl = { h: 0, s: 0, l: 0 }
  base.getHSL(hsl)
  const shade = (dl: number, ds = 0) => `hsl(${hsl.h * 360}, ${Math.min(100, (hsl.s + ds) * 100)}%, ${Math.max(0, Math.min(100, (hsl.l + dl) * 100))}%)`
  const grd = g.createLinearGradient(0, 0, 0, H)
  grd.addColorStop(0, shade(-0.06, 0.04))
  grd.addColorStop(0.45, shade(0.07, 0.02))
  grd.addColorStop(1, shade(-0.06))
  g.fillStyle = grd
  g.fillRect(0, 0, W, H)
  gb.fillStyle = '#808080'
  gb.fillRect(0, 0, W, H)
  for (let k = 0; k < RIBS; k++) {
    const u = (0.25 + (k + 0.5) / RIBS) % 1 // grooves sit between ribs; rib 0 faces forward
    const x = u * W
    const gr = g.createLinearGradient(x - 30, 0, x + 30, 0)
    gr.addColorStop(0, 'rgba(0,0,0,0)')
    gr.addColorStop(0.5, 'rgba(60,18,0,0.32)')
    gr.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = gr
    g.fillRect(x - 30, 0, 60, H)
    if (x < 30) g.fillRect(x - 30 + W, 0, 60, H)
  }
  let seed = 9
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  for (let i = 0; i < 900; i++) {
    const x = rnd() * W
    const y = rnd() * H
    g.strokeStyle = `rgba(${rnd() > 0.5 ? '255,220,150' : '80,25,0'},${0.04 + rnd() * 0.06})`
    g.lineWidth = 1 + rnd() * 2
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + (rnd() - 0.5) * 6, y + 20 + rnd() * 50)
    g.stroke()
    gb.strokeStyle = `rgba(${rnd() > 0.5 ? '160,160,160' : '100,100,100'},0.5)`
    gb.beginPath()
    gb.moveTo(x, y)
    gb.lineTo(x, y + 30)
    gb.stroke()
  }
  // carved face: centred on u=0.25 (front), drawn on all three maps
  ge.fillStyle = '#000'
  ge.fillRect(0, 0, W, H)
  const cx = 0.25 * W
  const carve = (path: (ctx: CanvasRenderingContext2D) => void) => {
    // map: dark cut rim + glowing inner flesh
    g.save()
    path(g)
    g.lineWidth = 9
    g.strokeStyle = '#2a0c02'
    g.stroke()
    g.fillStyle = '#ffcf6a'
    g.fill()
    g.restore()
    ge.save()
    path(ge)
    ge.fillStyle = '#ffffff'
    ge.fill()
    ge.restore()
    gb.save()
    path(gb)
    gb.lineWidth = 8
    gb.strokeStyle = '#202020'
    gb.stroke()
    gb.fillStyle = '#0a0a0a'
    gb.fill()
    gb.restore()
  }
  const tri = (x: number, y: number, w: number, h: number, flip = false) => (ctx: CanvasRenderingContext2D) => {
    ctx.beginPath()
    ctx.moveTo(x - w / 2, flip ? y - h / 2 : y + h / 2)
    ctx.lineTo(x + w / 2, flip ? y - h / 2 : y + h / 2)
    ctx.lineTo(x + (flip ? 0.08 : -0.08) * w, flip ? y + h / 2 : y - h / 2)
    ctx.closePath()
  }
  // eyes: angled, confident
  // eyes sit behind the sunglasses line
  carve(tri(cx - 52, 222, 64, 44))
  carve(tri(cx + 52, 222, 64, 44))
  carve(tri(cx, 268, 28, 24))
  // grin with teeth
  carve((ctx) => {
    ctx.beginPath()
    ctx.moveTo(cx - 118, 288)
    ctx.quadraticCurveTo(cx, 380, cx + 118, 288)
    ctx.lineTo(cx + 92, 320)
    ctx.lineTo(cx + 70, 310)
    ctx.lineTo(cx + 54, 332)
    ctx.lineTo(cx + 30, 320)
    ctx.lineTo(cx + 10, 338)
    ctx.lineTo(cx - 12, 322)
    ctx.lineTo(cx - 32, 338)
    ctx.lineTo(cx - 54, 320)
    ctx.lineTo(cx - 72, 334)
    ctx.lineTo(cx - 94, 316)
    ctx.closePath()
  })
  const tex = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c)
    t.wrapS = THREE.RepeatWrapping
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
  }
  void glow
  return { map: tex(cMap, true), emissive: tex(cEm, true), bump: tex(cBump, false) }
}

/* ───────────── the head ───────────── */
export function buildPumpkinHead(a: Appearance, D: D) {
  const group = new THREE.Group()
  const geo = new THREE.SphereGeometry(1, 60, 36)
  const p = geo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    const theta = Math.atan2(x, z)
    const f = rib(theta) * (1 + Math.sin(theta * 3 + 1.3) * 0.012) // slight irregularity
    const lat = Math.abs(y)
    // squat shape with dimples at the top (stem) and bottom
    let ny = y * 0.8
    if (y > 0) ny -= Math.pow(Math.max(0, y - 0.72) / 0.28, 2) * 0.16
    else ny += Math.pow(Math.max(0, -y - 0.82) / 0.18, 2) * 0.08
    const radial = f * (1 - Math.pow(lat, 6) * 0.08)
    p.setXYZ(i, x * radial * R, ny * R, z * radial * R)
  }
  geo.computeVertexNormals()
  const t = pumpkinTextures(a.skin, a.glow)
  const mat = new THREE.MeshPhysicalMaterial({
    map: t.map,
    bumpMap: t.bump,
    bumpScale: 3,
    emissiveMap: t.emissive,
    emissive: new THREE.Color(a.glow),
    emissiveIntensity: 2.4,
    roughness: 0.5,
    sheen: 0.35,
    sheenColor: new THREE.Color('#ffd9a8'),
    clearcoat: 0.15,
    clearcoatRoughness: 0.6,
  })
  D.push(geo, mat, t.map, t.bump, t.emissive)
  const head = new THREE.Mesh(geo, mat)
  head.castShadow = true
  group.add(head)

  // curved, tapered, ribbed stem
  const sg = new THREE.CylinderGeometry(0.016, 0.034, 0.11, 8, 8)
  const sp = sg.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < sp.count; i++) {
    const y = sp.getY(i) + 0.055
    const tt = y / 0.11
    const ang = Math.atan2(sp.getZ(i), sp.getX(i))
    const ridge = 1 + Math.cos(ang * 8) * 0.12
    sp.setXYZ(i, sp.getX(i) * ridge + tt * tt * 0.045, sp.getY(i), sp.getZ(i) * ridge - tt * 0.01)
  }
  sg.computeVertexNormals()
  const stemMat = new THREE.MeshStandardMaterial({ color: '#4a5a2a', roughness: 0.85 })
  D.push(sg, stemMat)
  const stem = new THREE.Mesh(sg, stemMat)
  stem.position.y = R * 0.8 - 0.035 + 0.055
  stem.castShadow = true
  group.add(stem)
  return group
}

/* ───────────── sunglasses (or a glowing visor if a colour is given) ───────────── */
export function buildShades(D: D, visorColor?: string) {
  const g = new THREE.Group()
  const lensShape = new THREE.Shape()
  lensShape.moveTo(-0.05, 0.02)
  lensShape.quadraticCurveTo(-0.052, 0.034, -0.035, 0.034)
  lensShape.lineTo(0.04, 0.03)
  lensShape.quadraticCurveTo(0.056, 0.028, 0.052, 0.01)
  lensShape.quadraticCurveTo(0.045, -0.03, 0.005, -0.032)
  lensShape.quadraticCurveTo(-0.045, -0.03, -0.05, 0.02)
  const lensGeo = new THREE.ExtrudeGeometry(lensShape, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 10 })
  const lensMat = visorColor
    ? new THREE.MeshPhysicalMaterial({ color: '#111', emissive: new THREE.Color(visorColor), emissiveIntensity: 2.2, roughness: 0.1, clearcoat: 1 })
    : new THREE.MeshPhysicalMaterial({ color: '#07070a', metalness: 0.3, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02 })
  const frameMat = new THREE.MeshStandardMaterial({ color: '#0d0d10', metalness: 0.6, roughness: 0.35 })
  D.push(lensGeo, lensMat, frameMat)
  const z = R * 0.96
  for (const s of [-1, 1]) {
    const lens = new THREE.Mesh(lensGeo, lensMat)
    lens.position.set(s * 0.068, 0.045, z - 0.012)
    lens.rotation.y = s * 0.28
    if (s < 0) lens.scale.x = -1
    g.add(lens)
    // arm running back along the side of the head
    const armGeo = new THREE.BoxGeometry(0.006, 0.01, 0.16)
    D.push(armGeo)
    const arm = new THREE.Mesh(armGeo, frameMat)
    arm.position.set(s * 0.155, 0.06, z - 0.09)
    arm.rotation.y = s * 0.55
    g.add(arm)
  }
  const bridgeGeo = new THREE.TorusGeometry(0.014, 0.003, 6, 10, Math.PI)
  D.push(bridgeGeo)
  const bridge = new THREE.Mesh(bridgeGeo, frameMat)
  bridge.position.set(0, 0.066, z + 0.004)
  g.add(bridge)
  g.traverse((o) => (o.castShadow = true))
  return g
}

/* ───────────── gold chain: real interlocking links + medallion ───────────── */
const CH = { rx: 0.16, rz: 0.15, drop: 0.13 }
export function buildChain(D: D) {
  const linkGeo = new THREE.TorusGeometry(0.0135, 0.0052, 6, 12)
  const parts: THREE.BufferGeometry[] = []
  const N = 40
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2
    // ellipse round the neck, dropping lower at the front onto the chest
    const x = Math.sin(a) * CH.rx
    const z = Math.cos(a) * CH.rz
    const y = -Math.max(0, Math.cos(a)) * CH.drop
    const g = linkGeo.clone()
    g.rotateY(i % 2 ? Math.PI / 2 : 0)
    const tangent = Math.atan2(Math.cos(a) * CH.rx, -Math.sin(a) * CH.rz)
    g.rotateY(tangent)
    g.rotateX(Math.max(0, Math.cos(a)) * 0.6)
    g.translate(x, y, z)
    parts.push(g)
  }
  // medallion: disc + raised crown
  const disc = new THREE.CylinderGeometry(0.034, 0.034, 0.008, 24)
  disc.rotateX(Math.PI / 2)
  disc.translate(0, -CH.drop - 0.045, CH.rz + 0.012)
  parts.push(disc)
  const crown = new THREE.Shape()
  crown.moveTo(-0.022, -0.012)
  crown.lineTo(0.022, -0.012)
  crown.lineTo(0.024, 0.012)
  crown.lineTo(0.012, 0.002)
  crown.lineTo(0, 0.016)
  crown.lineTo(-0.012, 0.002)
  crown.lineTo(-0.024, 0.012)
  crown.closePath()
  const cg = new THREE.ExtrudeGeometry(crown, { depth: 0.004, bevelEnabled: false })
  cg.translate(0, -CH.drop - 0.044, CH.rz + 0.016)
  parts.push(cg.toNonIndexed())
  const merged = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => {
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k)
    return g
  }))!
  parts.forEach((g) => g.dispose())
  linkGeo.dispose()
  const gold = new THREE.MeshPhysicalMaterial({ color: '#e8b54a', metalness: 1, roughness: 0.22, clearcoat: 0.4 })
  D.push(merged, gold)
  const m = new THREE.Mesh(merged, gold)
  m.castShadow = true
  return m
}

/* ───────────── headwear sits on the pumpkin ───────────── */
export function buildHeadwear(a: Appearance, D: D) {
  const top = R * 0.8 - 0.02
  if (a.headwear === 'crown') {
    const g = new THREE.Group()
    const gold = new THREE.MeshPhysicalMaterial({ color: '#e8b54a', metalness: 1, roughness: 0.25, clearcoat: 0.5 })
    const gem = new THREE.MeshPhysicalMaterial({ color: '#7a0f1a', roughness: 0.05, transmission: 0, clearcoat: 1, emissive: new THREE.Color(a.glow), emissiveIntensity: 0.6 })
    const band = new THREE.CylinderGeometry(0.15, 0.14, 0.06, 32, 1, true)
    const spike = new THREE.ConeGeometry(0.022, 0.08, 6)
    const ball = new THREE.SphereGeometry(0.012, 8, 6)
    D.push(gold, gem, band, spike, ball)
    g.add(new THREE.Mesh(band, gold))
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2
      const s = new THREE.Mesh(spike, gold)
      s.position.set(Math.sin(ang) * 0.145, 0.06, Math.cos(ang) * 0.145)
      g.add(s)
      const b = new THREE.Mesh(ball, gold)
      b.position.set(Math.sin(ang) * 0.145, 0.105, Math.cos(ang) * 0.145)
      g.add(b)
    }
    const gemGeo = new THREE.OctahedronGeometry(0.018)
    D.push(gemGeo)
    const front = new THREE.Mesh(gemGeo, gem)
    front.position.set(0, 0.005, 0.152)
    g.add(front)
    g.position.y = top + 0.01
    g.rotation.z = 0.1
    g.traverse((o) => (o.castShadow = true))
    return g
  }
  if (a.headwear === 'cap') {
    const g = new THREE.Group()
    const cloth = new THREE.MeshStandardMaterial({ color: a.outfit, roughness: 0.9 })
    const dome = new THREE.SphereGeometry(0.2, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2)
    dome.scale(1.08, 0.62, 1.08)
    const brim = new THREE.CylinderGeometry(0.14, 0.15, 0.012, 24, 1, false, -Math.PI / 2, Math.PI)
    const button = new THREE.SphereGeometry(0.014, 8, 6)
    D.push(cloth, dome, brim, button)
    g.add(new THREE.Mesh(dome, cloth))
    const b = new THREE.Mesh(brim, cloth)
    b.position.set(0, 0.005, 0.15)
    b.rotation.x = 0.12
    g.add(b)
    const btn = new THREE.Mesh(button, cloth)
    btn.position.y = 0.125
    g.add(btn)
    g.position.y = top - 0.03
    g.traverse((o) => (o.castShadow = true))
    return g
  }
  if (a.headwear === 'horns') {
    const g = new THREE.Group()
    const mat = new THREE.MeshStandardMaterial({ color: '#16110f', roughness: 0.45, metalness: 0.1 })
    D.push(mat)
    for (const s of [-1, 1]) {
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(s * 0.09, 0.05, 0), new THREE.Vector3(s * 0.08, 0.17, -0.02))
      const tube = new THREE.TubeGeometry(curve, 12, 0.025, 8)
      // taper toward the tip
      const tp = tube.attributes.position as THREE.BufferAttribute
      const segs = 13
      for (let i = 0; i < tp.count; i++) {
        const ring = Math.floor(i / 9) / (segs - 1)
        const c = curve.getPoint(Math.min(1, ring))
        tp.setXYZ(i, c.x + (tp.getX(i) - c.x) * (1 - ring * 0.85), c.y + (tp.getY(i) - c.y) * (1 - ring * 0.85), c.z + (tp.getZ(i) - c.z) * (1 - ring * 0.85))
      }
      tube.computeVertexNormals()
      D.push(tube)
      const h = new THREE.Mesh(tube, mat)
      h.position.set(s * 0.11, top - 0.02, 0.02)
      g.add(h)
    }
    g.traverse((o) => (o.castShadow = true))
    return g
  }
  return null
}
