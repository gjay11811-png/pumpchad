import * as THREE from 'three'
import { rng } from './kit'

const canvas = (w: number, h = w) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}
const tex = (c: HTMLCanvasElement, repeat = true, srgb = true) => {
  const t = new THREE.CanvasTexture(c)
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** Rounded cobblestones: colour + matching bump (height) map. */
export function cobble(size = 512) {
  const [c, g] = canvas(size)
  const [b, gb] = canvas(size)
  const r = rng(7)
  g.fillStyle = '#0d0b0e'
  g.fillRect(0, 0, size, size)
  gb.fillStyle = '#000'
  gb.fillRect(0, 0, size, size)
  const rows = 9
  const h = size / rows
  for (let y = 0; y < rows; y++) {
    let x = y % 2 ? -h * 0.55 : 0
    while (x < size) {
      const w = h * (0.75 + r() * 0.6)
      const pad = 2.5
      const L = 16 + r() * 15
      const grd = g.createLinearGradient(0, y * h, 0, y * h + h)
      grd.addColorStop(0, `hsl(${20 + r() * 16},${9 + r() * 7}%,${L + 7}%)`)
      grd.addColorStop(1, `hsl(${18 + r() * 10},${8 + r() * 6}%,${L - 4}%)`)
      g.fillStyle = grd
      g.beginPath()
      g.roundRect(x + pad, y * h + pad, w - pad * 2, h - pad * 2, h * 0.32)
      g.fill()
      const bg = gb.createRadialGradient(x + w / 2, y * h + h / 2, 2, x + w / 2, y * h + h / 2, w * 0.6)
      bg.addColorStop(0, '#fff')
      bg.addColorStop(1, '#555')
      gb.fillStyle = bg
      gb.beginPath()
      gb.roundRect(x + pad, y * h + pad, w - pad * 2, h - pad * 2, h * 0.32)
      gb.fill()
      x += w
    }
  }
  for (let i = 0; i < 3000; i++) {
    g.fillStyle = `rgba(0,0,0,${r() * 0.22})`
    g.fillRect(r() * size, r() * size, 2, 2)
  }
  // moss in the cracks
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(60,80,40,${0.15 + r() * 0.2})`
    g.fillRect(r() * size, r() * size, 3, 2)
  }
  return { map: tex(c), bump: tex(b, true, false) }
}

/**
 * Radial plaza paving (v4): many small, hand-laid-looking stones in concentric courses.
 * Irregular jittered outlines, per-stone colour gradient + speckle, chipped corners, dark worn seams with moss
 * and dirt, darker basalt accent courses — plus a bump map with soft bevels. 2048 px over the 23 m plaza (~89 px/m).
 */
export function plaza(size = 2048) {
  const [c, g] = canvas(size)
  const [b, gb] = canvas(size)
  const r = rng(21)
  const cx = size / 2
  const pxPerM = size / 23
  // mortar / dirt between the stones
  g.fillStyle = '#17120f'
  g.fillRect(0, 0, size, size)
  gb.fillStyle = '#000'
  gb.fillRect(0, 0, size, size)
  const course = 0.42 * pxPerM // ring width (m → px)
  const startR = 6.2 * pxPerM // under the fountain is never seen
  const shape = (ctx: CanvasRenderingContext2D, pts: [number, number][]) => {
    ctx.beginPath()
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    ctx.closePath()
  }
  let ring = 0
  for (let r0 = startR; r0 < size / 2; r0 += course) {
    ring++
    const accent = ring % 6 === 0 // darker basalt course
    const len = (accent ? 0.34 : 0.45 + r() * 0.15) * pxPerM
    const n = Math.max(8, Math.floor((Math.PI * 2 * r0) / len))
    const off = r() * Math.PI * 2
    for (let k = 0; k < n; k++) {
      const a0 = off + (k / n) * Math.PI * 2 + (r() - 0.5) * 0.004
      const a1 = off + ((k + 1) / n) * Math.PI * 2 - (2.6 + r() * 2) / r0 // seam
      const ri = r0 + 2 + r() * 1.5
      const ro = r0 + course - 2 - r() * 1.5
      // outline: corners + jittered mid-edges, so no stone is a perfect trapezoid
      const P = (a: number, rad: number): [number, number] => [cx + Math.cos(a) * rad, cx + Math.sin(a) * rad]
      const am = (a0 + a1) / 2
      const j = () => (r() - 0.5) * 2.4
      const pts: [number, number][] = [
        P(a0 + j() / r0, ri + j()), P(am, ri - 0.8 + j()), P(a1 + j() / r0, ri + j()),
        P(a1 + 1.2 / ro, (ri + ro) / 2 + j()), P(a1 + j() / ro, ro + j()), P(am, ro + 0.8 + j()), P(a0 + j() / ro, ro + j()), P(a0 - 1.2 / ri, (ri + ro) / 2 + j()),
      ]
      // chipped corner on some stones
      if (r() < 0.18) pts.splice(4, 1, P(a1 - 3 / ro, ro - 2), P(a1, ro - 4))
      const hue = accent ? 250 + r() * 30 : 18 + r() * 22
      const sat = accent ? 6 + r() * 5 : 7 + r() * 9
      const L = accent ? 13 + r() * 6 : 24 + r() * 16
      const [mx, my] = P(am, (ri + ro) / 2)
      const grd = g.createRadialGradient(mx - 4, my - 4, 1, mx, my, course * 0.9)
      grd.addColorStop(0, `hsl(${hue},${sat}%,${L + 6}%)`)
      grd.addColorStop(1, `hsl(${hue},${sat}%,${L - 6}%)`)
      g.fillStyle = grd
      shape(g, pts)
      g.fill()
      // darkened worn rim
      g.strokeStyle = 'rgba(10,6,4,0.45)'
      g.lineWidth = 1.6
      g.stroke()
      // bump: soft bevel (blurred fill)
      gb.save()
      gb.shadowColor = '#fff'
      gb.shadowBlur = 5
      gb.fillStyle = `rgb(${170 + r() * 60},${170 + r() * 60},${170 + r() * 60})`
      shape(gb, pts)
      gb.fill()
      gb.restore()
    }
  }
  // grain, pits and scuffs over everything (keeps big flat colour areas from looking like plastic)
  for (let i = 0; i < 90000; i++) {
    const x = r() * size
    const y = r() * size
    const k = r()
    g.fillStyle = k < 0.55 ? `rgba(0,0,0,${0.08 + r() * 0.12})` : `rgba(255,240,220,${0.04 + r() * 0.05})`
    g.fillRect(x, y, 1.3, 1.3)
    if (k < 0.04) {
      gb.fillStyle = 'rgba(0,0,0,0.5)'
      gb.fillRect(x, y, 2, 2)
    }
  }
  // moss and dirt gathering toward the plaza edge and in the seams
  for (let i = 0; i < 2600; i++) {
    const a = r() * Math.PI * 2
    const rad = (8.5 + Math.pow(r(), 0.6) * 3) * pxPerM
    const x = cx + Math.cos(a) * rad
    const y = cx + Math.sin(a) * rad
    g.fillStyle = r() < 0.6 ? `rgba(54,72,38,${0.18 + r() * 0.25})` : `rgba(40,28,18,${0.2 + r() * 0.2})`
    g.beginPath()
    g.arc(x, y, 1 + r() * 3, 0, Math.PI * 2)
    g.fill()
  }
  // a few darker wet patches near the fountain (splash)
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2
    const rad = (6.4 + r() * 1.4) * pxPerM
    const px = cx + Math.cos(a) * rad
    const py = cx + Math.sin(a) * rad
    const pr = 40 + r() * 60
    const grd = g.createRadialGradient(px, py, 0, px, py, pr)
    grd.addColorStop(0, 'rgba(10,12,16,0.35)')
    grd.addColorStop(1, 'rgba(10,12,16,0)')
    g.fillStyle = grd
    g.fillRect(px - pr, py - pr, pr * 2, pr * 2)
  }
  const map = tex(c, false)
  map.anisotropy = 8
  return { map, bump: tex(b, false, false) }
}

/** Dirt + dark grass ground. */
export function ground(size = 512) {
  const [c, g] = canvas(size)
  const r = rng(3)
  g.fillStyle = '#211a17'
  g.fillRect(0, 0, size, size)
  for (let i = 0; i < 1400; i++) {
    const x = r() * size, y = r() * size, rad = 4 + r() * 22
    const grass = r() > 0.45
    g.fillStyle = grass ? `rgba(${36 + r() * 20},${52 + r() * 24},${32 + r() * 12},${0.25 + r() * 0.3})` : `rgba(${50 + r() * 20},${38 + r() * 14},${30 + r() * 10},${0.25 + r() * 0.3})`
    g.beginPath()
    g.ellipse(x, y, rad, rad * (0.5 + r() * 0.5), r() * 3, 0, Math.PI * 2)
    g.fill()
  }
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = `rgba(${r() > 0.5 ? '70,90,50' : '20,16,14'},${0.3 + r() * 0.4})`
    g.fillRect(r() * size, r() * size, 1.5, 3)
  }
  return tex(c)
}

/** Lime plaster with subtle stains; the timber frame is modelled, not painted. */
export function plaster(size = 256) {
  const [c, g] = canvas(size)
  const r = rng(11)
  g.fillStyle = '#cfc0aa'
  g.fillRect(0, 0, size, size)
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${90 + r() * 40},${70 + r() * 30},${50 + r() * 20},${r() * 0.08})`
    g.beginPath()
    g.arc(r() * size, r() * size, 2 + r() * 14, 0, Math.PI * 2)
    g.fill()
  }
  const grd = g.createLinearGradient(0, size * 0.75, 0, size)
  grd.addColorStop(0, 'rgba(40,30,20,0)')
  grd.addColorStop(1, 'rgba(40,30,20,0.35)')
  g.fillStyle = grd
  g.fillRect(0, 0, size, size)
  return tex(c)
}

export function wood(size = 256) {
  const [c, g] = canvas(size)
  const r = rng(5)
  const planks = 6
  for (let i = 0; i < planks; i++) {
    const L = 30 + r() * 14
    g.fillStyle = `hsl(25,35%,${L}%)`
    g.fillRect(0, (i * size) / planks, size, size / planks)
    for (let k = 0; k < 40; k++) {
      g.strokeStyle = `rgba(20,10,5,${r() * 0.25})`
      g.beginPath()
      const y = (i * size) / planks + r() * (size / planks)
      g.moveTo(0, y)
      g.bezierCurveTo(size * 0.3, y + r() * 4 - 2, size * 0.7, y + r() * 4 - 2, size, y)
      g.stroke()
    }
    g.fillStyle = 'rgba(0,0,0,0.5)'
    g.fillRect(0, (i * size) / planks, size, 2)
  }
  return tex(c)
}

export function roof(size = 256) {
  const [c, g] = canvas(size)
  const r = rng(9)
  g.fillStyle = '#1a1414'
  g.fillRect(0, 0, size, size)
  const rows = 8
  const h = size / rows
  for (let y = 0; y < rows; y++)
    for (let x = (y % 2) * -h * 0.5; x < size; x += h) {
      const L = 40 + r() * 25
      g.fillStyle = `hsl(0,0%,${L}%)`
      g.beginPath()
      g.roundRect(x + 1.5, y * h + 1, h - 3, h * 1.15, [0, 0, h * 0.45, h * 0.45])
      g.fill()
    }
  return tex(c)
}

/** Striped market awning (two-tone with scalloped edge alpha baked into colour). */
export function awning(a: string, b: string) {
  const [c, g] = canvas(256, 128)
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? a : b
    g.fillRect(i * 32, 0, 32, 128)
  }
  g.fillStyle = 'rgba(0,0,0,0.25)'
  g.fillRect(0, 110, 256, 18)
  return tex(c, false)
}

/** Hand-painted wooden shop sign. */
export function shopSign(title: string, sub: string, ink = '#e8b84a') {
  const [c, g] = canvas(512, 256)
  const grd = g.createLinearGradient(0, 0, 0, 256)
  grd.addColorStop(0, '#4a2e1c')
  grd.addColorStop(1, '#2a180e')
  g.fillStyle = grd
  g.fillRect(0, 0, 512, 256)
  g.strokeStyle = '#c89b3c'
  g.lineWidth = 8
  g.strokeRect(12, 12, 488, 232)
  g.fillStyle = ink
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = 'bold 74px Anton, Impact, sans-serif'
  g.fillText(title, 256, 112)
  g.font = '28px "JetBrains Mono", monospace'
  g.fillStyle = '#f3ece2'
  g.fillText(sub, 256, 196)
  return tex(c, false)
}

/** Notice board paper collage. */
export function noticeBoard() {
  const [c, g] = canvas(512, 384)
  g.fillStyle = '#3a2416'
  g.fillRect(0, 0, 512, 384)
  const notes = [
    { x: 30, y: 30, w: 200, h: 150, t: ['WANTED', 'PAPER HANDS', 'reward: 1 shake'], col: '#e9dcc0' },
    { x: 260, y: 40, w: 220, h: 130, t: ['LOST', 'one (1) bear', 'last seen: buried'], col: '#e2d2b0' },
    { x: 60, y: 210, w: 180, h: 140, t: ['LEG DAY', 'cancelled', 'forever'], col: '#efe4cc' },
    { x: 280, y: 200, w: 200, h: 150, t: ['ARCADE', 'opening soon', 'probably'], col: '#e6d7b8' },
  ]
  for (const n of notes) {
    g.save()
    g.translate(n.x + n.w / 2, n.y + n.h / 2)
    g.rotate((n.x % 7) / 40 - 0.08)
    g.fillStyle = n.col
    g.fillRect(-n.w / 2, -n.h / 2, n.w, n.h)
    g.fillStyle = '#b32a1e'
    g.beginPath()
    g.arc(0, -n.h / 2 + 10, 6, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#2a1a10'
    g.textAlign = 'center'
    g.font = 'bold 34px Anton, Impact, sans-serif'
    g.fillText(n.t[0], 0, -n.h / 2 + 52)
    g.font = '22px "JetBrains Mono", monospace'
    g.fillText(n.t[1], 0, 6)
    g.font = 'italic 18px "JetBrains Mono", monospace'
    g.fillText(n.t[2], 0, 40)
    g.restore()
  }
  return tex(c, false)
}

/** Curved gold inscription band for the fountain. */
export function inscription(text: string) {
  const [c, g] = canvas(2048, 96)
  g.fillStyle = '#17131a'
  g.fillRect(0, 0, 2048, 96)
  g.fillStyle = '#e8b84a'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = 'bold 54px Anton, Impact, sans-serif'
  const parts = `${text} · `.repeat(3)
  g.fillText(parts, 1024, 50)
  const t = tex(c, false)
  t.wrapS = THREE.RepeatWrapping
  return t
}

/** Soft round sprite for smoke/embers (white, alpha in the red channel via colour). */
export function softDot() {
  const [c, g] = canvas(64)
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.4, 'rgba(255,255,255,0.55)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 64, 64)
  return tex(c, false, false)
}

export function leaf() {
  const [c, g] = canvas(64)
  g.fillStyle = '#fff'
  g.beginPath()
  g.moveTo(32, 4)
  g.quadraticCurveTo(60, 26, 32, 60)
  g.quadraticCurveTo(4, 26, 32, 4)
  g.fill()
  g.strokeStyle = 'rgba(0,0,0,0.4)'
  g.lineWidth = 2
  g.beginPath()
  g.moveTo(32, 8)
  g.lineTo(32, 56)
  g.stroke()
  return tex(c, false)
}

export function grassTuft() {
  const [c, g] = canvas(64)
  const r = rng(2)
  for (let i = 0; i < 26; i++) {
    const x = 8 + r() * 48
    const tipX = x + (r() - 0.5) * 26
    const tipY = 4 + r() * 24
    const grd = g.createLinearGradient(0, 64, 0, tipY)
    const v = 0.8 + r() * 0.4
    grd.addColorStop(0, `rgb(${40 * v},${62 * v},${32 * v})`)
    grd.addColorStop(1, `rgb(${120 * v},${150 * v},${78 * v})`)
    g.strokeStyle = grd
    g.lineWidth = 1.6 + r() * 1.8
    g.beginPath()
    g.moveTo(x, 64)
    g.quadraticCurveTo(x + (r() - 0.5) * 18, 34, tipX, tipY)
    g.stroke()
  }
  return tex(c, false)
}

/** Animated water normal map (tiling noise). */
export function waterNormal(size = 128) {
  const [c, g] = canvas(size)
  const img = g.createImageData(size, size)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const a = Math.sin((x / size) * Math.PI * 4) + Math.sin((y / size) * Math.PI * 6 + (x / size) * 3)
      const b = Math.cos((y / size) * Math.PI * 4) + Math.sin((x / size) * Math.PI * 6 - (y / size) * 2)
      const i = (y * size + x) * 4
      img.data[i] = 128 + a * 30
      img.data[i + 1] = 128 + b * 30
      img.data[i + 2] = 255
      img.data[i + 3] = 255
    }
  g.putImageData(img, 0, 0)
  return tex(c, true, false)
}
