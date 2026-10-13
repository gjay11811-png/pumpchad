import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

/**
 * Chad Gym look: procedural textures (no downloads) and detailed, low-poly equipment builders.
 * Everything here is stylised-realistic: real proportions, bevelled edges, proper metals and rubber,
 * but kept to a few hundred triangles per piece so the hall stays smooth on phones.
 */

type D = (THREE.Material | THREE.BufferGeometry | THREE.Texture)[]

const canvas = (w: number, h: number) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}
let seed = 7
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
const tex = (c: HTMLCanvasElement, D: D, repeat: [number, number] = [1, 1], srgb = true) => {
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(...repeat)
  t.anisotropy = 4
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  D.push(t)
  return t
}

/** 1 m rubber gym tiles: charcoal with EPDM flecks and bevelled seams */
export function rubberFloorTexture(D: D) {
  seed = 11
  const [c, g] = canvas(512, 512)
  g.fillStyle = '#1c1b1f'
  g.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 9000; i++) {
    const r = rnd()
    g.fillStyle = r < 0.035 ? '#c2561c' : r < 0.09 ? '#4a4850' : r < 0.5 ? '#232227' : '#161518'
    g.fillRect(rnd() * 512, rnd() * 512, 1 + rnd() * 2.2, 1 + rnd() * 2.2)
  }
  // seams (2 × 2 tiles per texture)
  for (const p of [0, 256]) {
    g.fillStyle = '#0c0b0d'
    g.fillRect(p, 0, 3, 512)
    g.fillRect(0, p, 512, 3)
    g.fillStyle = 'rgba(255,255,255,0.05)'
    g.fillRect(p + 3, 0, 1, 512)
    g.fillRect(0, p + 3, 512, 1)
  }
  return tex(c, D)
}

/** dark industrial brick for the upper walls */
export function brickTexture(D: D) {
  seed = 23
  const [c, g] = canvas(512, 512)
  g.fillStyle = '#1a1416'
  g.fillRect(0, 0, 512, 512)
  const bw = 64
  const bh = 26
  for (let row = 0; row < 512 / bh + 1; row++) {
    const off = row % 2 ? bw / 2 : 0
    for (let col = -1; col < 512 / bw + 1; col++) {
      const x = col * bw + off
      const y = row * bh
      const k = rnd()
      const r = 52 + k * 22
      g.fillStyle = `rgb(${r}, ${r * 0.62}, ${r * 0.56})`
      g.fillRect(x + 2, y + 2, bw - 4, bh - 4)
      // soot / wear
      g.fillStyle = `rgba(0,0,0,${0.15 + rnd() * 0.3})`
      g.fillRect(x + 2, y + 2 + (bh - 4) * rnd(), bw - 4, 3)
    }
  }
  // vertical grime gradient toward the floor
  const grd = g.createLinearGradient(0, 0, 0, 512)
  grd.addColorStop(0, 'rgba(0,0,0,0.25)')
  grd.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 512, 512)
  return tex(c, D)
}

/** vertical-slat wainscot panelling for the lower walls */
export function panelTexture(D: D) {
  const [c, g] = canvas(256, 256)
  g.fillStyle = '#17151a'
  g.fillRect(0, 0, 256, 256)
  for (let x = 0; x < 256; x += 32) {
    g.fillStyle = '#0d0c0f'
    g.fillRect(x, 0, 3, 256)
    g.fillStyle = 'rgba(255,255,255,0.05)'
    g.fillRect(x + 3, 0, 2, 256)
  }
  return tex(c, D)
}

/** oak lifting-platform planks */
export function woodTexture(D: D) {
  seed = 41
  const [c, g] = canvas(256, 512)
  for (let i = 0; i < 4; i++) {
    const base = 120 + rnd() * 30
    g.fillStyle = `rgb(${base}, ${base * 0.68}, ${base * 0.42})`
    g.fillRect(i * 64, 0, 64, 512)
    for (let k = 0; k < 60; k++) {
      g.strokeStyle = `rgba(60,35,15,${0.08 + rnd() * 0.12})`
      g.lineWidth = 1
      g.beginPath()
      const x = i * 64 + rnd() * 64
      g.moveTo(x, 0)
      g.bezierCurveTo(x + rnd() * 6 - 3, 170, x + rnd() * 6 - 3, 340, x + rnd() * 4 - 2, 512)
      g.stroke()
    }
    g.fillStyle = '#3a2412'
    g.fillRect(i * 64, 0, 2, 512)
  }
  return tex(c, D)
}

/** stitched leather for the heavy bag and bench pads */
export function leatherTexture(color: string, D: D) {
  seed = 59
  const [c, g] = canvas(256, 256)
  g.fillStyle = color
  g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 2500; i++) {
    g.fillStyle = `rgba(0,0,0,${rnd() * 0.12})`
    g.fillRect(rnd() * 256, rnd() * 256, 2, 2)
  }
  g.strokeStyle = 'rgba(255,190,120,0.35)'
  g.setLineDash([5, 4])
  g.lineWidth = 2
  for (const x of [6, 250]) {
    g.beginPath()
    g.moveTo(x, 0)
    g.lineTo(x, 256)
    g.stroke()
  }
  return tex(c, D)
}

/** a framed poster from the PumpChad art (loaded lazily; the frame shows straight away) */
export function poster(url: string, w: number, h: number, D: D) {
  const group = new THREE.Group()
  const frameMat = new THREE.MeshStandardMaterial({ color: '#c9a14a', metalness: 0.9, roughness: 0.35 })
  const backMat = new THREE.MeshStandardMaterial({ color: '#111014', roughness: 0.9 })
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.14, h + 0.14, 0.05), frameMat)
  const back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, h + 0.04, 0.052), backMat)
  back.position.z = 0.002
  const artMat = new THREE.MeshStandardMaterial({ color: '#2a2328', roughness: 0.55 })
  const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), artMat)
  art.position.z = 0.03
  D.push(frameMat, backMat, artMat, frame.geometry, back.geometry, art.geometry)
  new THREE.TextureLoader().load(
    import.meta.env.BASE_URL + url.replace(/^\//, ''),
    (t) => {
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 4
      artMat.map = t
      artMat.color.set('#ffffff')
      artMat.emissive.set('#ffffff')
      artMat.emissiveMap = t
      artMat.emissiveIntensity = 0.22 // a little lit, like a gallery spot on it
      artMat.needsUpdate = true
      D.push(t)
    },
    undefined,
    () => {},
  )
  group.add(frame, back, art)
  return group
}

/* ───────── equipment parts ───────── */

/** bevelled bumper plate (lathe profile) with a steel hub; axis along X */
export function bumperGeo(radius: number, width: number) {
  const r0 = 0.026
  const pts = [
    new THREE.Vector2(r0, -width / 2),
    new THREE.Vector2(radius - 0.012, -width / 2),
    new THREE.Vector2(radius, -width / 2 + 0.012),
    new THREE.Vector2(radius, width / 2 - 0.012),
    new THREE.Vector2(radius - 0.012, width / 2),
    new THREE.Vector2(r0, width / 2),
  ]
  const g = new THREE.LatheGeometry(pts, 28)
  g.rotateZ(Math.PI / 2)
  return g
}

export function hubGeo(width: number) {
  const g = new THREE.CylinderGeometry(0.07, 0.07, width + 0.006, 20)
  g.rotateZ(Math.PI / 2)
  return g
}

/**
 * Olympic barbell along X: knurled shaft, collar flanges, sleeves, and bumper plates.
 * `plates` lists plate radii from the inside out. Returns parts so callers can batch or group them.
 */
export function barbellParts(len: number, plates: { r: number; w: number; color: 'black' | 'orange' }[]) {
  const parts: { geo: THREE.BufferGeometry; mat: 'chrome' | 'knurl' | 'rubber' | 'orange' | 'steel'; x: number }[] = []
  const shaft = new THREE.CylinderGeometry(0.0145, 0.0145, len * 0.62, 12)
  shaft.rotateZ(Math.PI / 2)
  parts.push({ geo: shaft, mat: 'knurl', x: 0 })
  const sleeveLen = len * 0.19
  for (const s of [-1, 1]) {
    const flange = new THREE.CylinderGeometry(0.038, 0.038, 0.022, 18)
    flange.rotateZ(Math.PI / 2)
    parts.push({ geo: flange, mat: 'chrome', x: s * (len * 0.31 + 0.011) })
    const sleeve = new THREE.CylinderGeometry(0.025, 0.025, sleeveLen, 14)
    sleeve.rotateZ(Math.PI / 2)
    parts.push({ geo: sleeve, mat: 'chrome', x: s * (len * 0.31 + 0.022 + sleeveLen / 2) })
    let x = len * 0.31 + 0.03
    for (const p of plates) {
      parts.push({ geo: bumperGeo(p.r, p.w), mat: p.color === 'orange' ? 'orange' : 'rubber', x: s * (x + p.w / 2) })
      parts.push({ geo: hubGeo(p.w), mat: 'steel', x: s * (x + p.w / 2) })
      x += p.w + 0.004
    }
    // spring collar
    const collar = new THREE.TorusGeometry(0.03, 0.007, 6, 16)
    collar.rotateY(Math.PI / 2)
    parts.push({ geo: collar, mat: 'steel', x: s * (x + 0.012) })
  }
  return parts
}

/** hex dumbbell along X (head = 6-sided prism) */
export function hexDumbbellParts(head: number) {
  const parts: { geo: THREE.BufferGeometry; mat: 'rubber' | 'knurl' | 'chrome'; x: number }[] = []
  const handle = new THREE.CylinderGeometry(0.017, 0.017, 0.15, 10)
  handle.rotateZ(Math.PI / 2)
  parts.push({ geo: handle, mat: 'knurl', x: 0 })
  for (const s of [-1, 1]) {
    const h = new THREE.CylinderGeometry(head, head, head * 1.1, 6)
    h.rotateZ(Math.PI / 2)
    parts.push({ geo: h, mat: 'rubber', x: s * (0.075 + head * 0.55) })
    const cap = new THREE.CylinderGeometry(head * 0.45, head * 0.45, head * 1.12, 12)
    cap.rotateZ(Math.PI / 2)
    parts.push({ geo: cap, mat: 'chrome', x: s * (0.075 + head * 0.55) })
  }
  return parts
}

export function kettlebellGeo() {
  const body = new THREE.SphereGeometry(0.11, 16, 12)
  body.scale(1, 0.95, 1)
  body.translate(0, 0.11, 0)
  const handle = new THREE.TorusGeometry(0.07, 0.016, 8, 16, Math.PI)
  handle.translate(0, 0.2, 0)
  return [body, handle]
}

export const roundedPad = (w: number, h: number, d: number) => new RoundedBoxGeometry(w, h, d, 3, Math.min(h, w) * 0.35)

/** steel tube between two points (for frames: benches, pull-up stations, racks) */
export function tube(a: THREE.Vector3, b: THREE.Vector3, r: number, seg = 8) {
  const len = a.distanceTo(b)
  const g = new THREE.CylinderGeometry(r, r, len, seg)
  g.translate(0, len / 2, 0)
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()))
  g.translate(a.x, a.y, a.z)
  return g
}

/** knurled-steel look for bar shafts and handles */
export function knurlTexture(D: D) {
  const [c, g] = canvas(64, 64)
  g.fillStyle = '#9a9890'
  g.fillRect(0, 0, 64, 64)
  g.strokeStyle = 'rgba(30,30,30,0.55)'
  g.lineWidth = 1
  for (let i = -64; i < 128; i += 6) {
    g.beginPath()
    g.moveTo(i, 0)
    g.lineTo(i + 64, 64)
    g.stroke()
    g.beginPath()
    g.moveTo(i + 64, 0)
    g.lineTo(i, 64)
    g.stroke()
  }
  return tex(c, D, [8, 1])
}

/** squat-rack upright: steel with a column of numbered holes */
export function uprightTexture(D: D) {
  const [c, g] = canvas(64, 512)
  g.fillStyle = '#26232a'
  g.fillRect(0, 0, 64, 512)
  for (let y = 12; y < 512; y += 28) {
    g.fillStyle = '#060507'
    g.beginPath()
    g.arc(32, y, 7, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = 'rgba(255,255,255,0.18)'
    g.fillRect(44, y - 2, 10, 3)
  }
  return tex(c, D)
}

/** the treadmill console screen (static branding; the pace number lives in the UI) */
export function consoleTexture(D: D) {
  const [c, g] = canvas(256, 96)
  g.fillStyle = '#05070a'
  g.fillRect(0, 0, 256, 96)
  g.fillStyle = '#ff7a1a'
  g.font = '900 34px Anton, Impact, sans-serif'
  g.textAlign = 'center'
  g.fillText('CHAD RUN', 128, 46)
  g.fillStyle = '#7fd6ff'
  g.font = '600 16px monospace'
  g.fillText('PACE · DIST · KCAL', 128, 76)
  return tex(c, D, [1, 1])
}
