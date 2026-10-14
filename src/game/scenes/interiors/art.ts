import * as THREE from 'three'
import { rng } from '../world/kit'

/**
 * Interior textures (all canvas, seeded so each house is stable): floorboards, wallpapers, wainscot, book spines,
 * rugs, paintings, the moonlit view through a window, cobwebs, tiles. Every texture is registered in `D` so the
 * scene frees it on exit.
 */
type D = (THREE.Material | THREE.Texture | THREE.BufferGeometry)[]

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return { c, g: c.getContext('2d')! }
}
function tex(c: HTMLCanvasElement, D: D, repeat = true) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 4
  D.push(t)
  return t
}

/** wide oak / walnut / pine floorboards with grain, knots and staggered joints (one tile = 2 m × 2 m) */
export function floorboards(D: D, tone: string, seed = 1) {
  const { c, g } = canvas(512, 512)
  const R = rng(seed)
  const base = new THREE.Color(tone)
  const rows = 8
  const rh = 512 / rows
  for (let r = 0; r < rows; r++) {
    let x = -R() * 200
    while (x < 512) {
      const len = 160 + R() * 220
      const col = base.clone().offsetHSL((R() - 0.5) * 0.012, (R() - 0.5) * 0.05, (R() - 0.5) * 0.035)
      g.fillStyle = `#${col.getHexString()}`
      g.fillRect(x, r * rh, len, rh)
      // grain
      g.globalAlpha = 0.08
      for (let k = 0; k < 9; k++) {
        g.strokeStyle = R() < 0.5 ? '#000' : '#fff'
        g.lineWidth = 1
        g.beginPath()
        const y = r * rh + 4 + R() * (rh - 8)
        g.moveTo(x, y)
        g.bezierCurveTo(x + len * 0.3, y + (R() - 0.5) * 6, x + len * 0.6, y + (R() - 0.5) * 6, x + len, y)
        g.stroke()
      }
      if (R() < 0.25) {
        g.fillStyle = '#000'
        g.beginPath()
        g.ellipse(x + R() * len, r * rh + rh / 2, 5, 3, 0, 0, Math.PI * 2)
        g.fill()
      }
      g.globalAlpha = 1
      g.fillStyle = 'rgba(0,0,0,0.3)'
      g.fillRect(x, r * rh, 2, rh) // butt joint
      x += len
    }
    g.fillStyle = 'rgba(0,0,0,0.32)'
    g.fillRect(0, r * rh, 512, 2) // board edge
  }
  return tex(c, D)
}

/** wallpaper: damask / stripe / diamond / plain plaster, on a 1 m tile */
export function wallpaper(D: D, kind: 'damask' | 'stripe' | 'diamond' | 'plaster' | 'stone', a: string, b: string, seed = 1) {
  const { c, g } = canvas(256, 256)
  const R = rng(seed)
  g.fillStyle = a
  g.fillRect(0, 0, 256, 256)
  if (kind === 'stripe') {
    g.fillStyle = b
    for (let x = 0; x < 256; x += 64) g.fillRect(x, 0, 22, 256)
    g.globalAlpha = 0.5
    for (let x = 30; x < 256; x += 64) g.fillRect(x, 0, 3, 256)
    g.globalAlpha = 1
  } else if (kind === 'damask') {
    g.fillStyle = b
    // staggered damask motifs (wrapped at the tile edges so it repeats seamlessly)
    const motif = (x: number, y: number) => {
      g.fillStyle = b
      g.beginPath()
      g.moveTo(x, y - 40)
      g.bezierCurveTo(x + 30, y - 24, x + 26, y + 8, x, y + 40)
      g.bezierCurveTo(x - 26, y + 8, x - 30, y - 24, x, y - 40)
      g.fill()
      g.fillStyle = a
      g.beginPath()
      g.arc(x, y - 4, 7, 0, Math.PI * 2)
      g.fill()
    }
    for (const [cx, cy] of [[64, 64], [192, 192]] as const) for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) motif(cx + ox, cy + oy)
    g.fillStyle = b
    g.globalAlpha = 0.35
    for (let k = 0; k < 4; k++) {
      g.beginPath()
      g.arc(R() * 256, R() * 256, 18 + R() * 10, 0, Math.PI * 2)
      g.fill()
    }
    g.globalAlpha = 1
  } else if (kind === 'diamond') {
    g.strokeStyle = b
    g.lineWidth = 3
    for (let k = -256; k < 512; k += 64) {
      g.beginPath()
      g.moveTo(k, 0)
      g.lineTo(k + 256, 256)
      g.moveTo(k + 256, 0)
      g.lineTo(k, 256)
      g.stroke()
    }
    g.fillStyle = b
    for (let y = 0; y < 256; y += 64) for (let x = 0; x < 256; x += 64) g.fillRect(x + 30, y + 30, 4, 4)
  } else if (kind === 'stone') {
    // rough ashlar for cellars, the forge, the haunted house
    for (let y = 0; y < 256; y += 42) {
      let x = -((y / 42) % 2) * 40
      while (x < 256) {
        const w = 60 + R() * 50
        const col = new THREE.Color(a).offsetHSL(0, 0, (R() - 0.5) * 0.08)
        g.fillStyle = `#${col.getHexString()}`
        g.fillRect(x + 2, y + 2, w - 4, 38)
        x += w
      }
    }
    g.fillStyle = b
    g.globalAlpha = 0.6
    for (let y = 0; y < 256; y += 42) g.fillRect(0, y, 256, 3)
    g.globalAlpha = 1
  }
  // plaster mottling on everything
  for (let k = 0; k < 400; k++) {
    g.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${0.02 + R() * 0.03})`
    g.fillRect(R() * 256, R() * 256, 4 + R() * 14, 4 + R() * 14)
  }
  return tex(c, D)
}

/** book spines filling a shelf (u spans the shelf width, v one shelf height) */
export function bookSpines(D: D, seed = 1, palette = ['#6a1f22', '#1f3a5a', '#2c4a2a', '#5a3a1a', '#3a2a4a', '#8a6a2a', '#1a1a1e', '#7a4a2a']) {
  const { c, g } = canvas(512, 128)
  const R = rng(seed)
  g.fillStyle = '#1a120c'
  g.fillRect(0, 0, 512, 128)
  let x = 2
  while (x < 510) {
    const w = 10 + R() * 16
    const h = 80 + R() * 44
    const col = palette[Math.floor(R() * palette.length)]
    const lean = R() < 0.06
    g.save()
    g.translate(x, 128)
    if (lean) g.rotate(-0.18)
    g.fillStyle = col
    g.fillRect(0, -h, w, h)
    g.fillStyle = 'rgba(232,190,90,0.75)'
    g.fillRect(1, -h + 10, w - 2, 2)
    g.fillRect(1, -18, w - 2, 2)
    g.fillStyle = 'rgba(0,0,0,0.25)'
    g.fillRect(w - 2, -h, 2, h)
    g.restore()
    x += w + (lean ? 10 : 1)
    if (R() < 0.04) x += 20 + R() * 30 // gaps
  }
  return tex(c, D, false)
}

/** woven rug: border bands + a central medallion */
export function rugTexture(D: D, a: string, b: string, cc: string, seed = 1) {
  const { c, g } = canvas(256, 256)
  const R = rng(seed)
  g.fillStyle = a
  g.fillRect(0, 0, 256, 256)
  g.strokeStyle = b
  for (const [inset, w] of [[10, 8], [26, 3], [34, 3]] as const) {
    g.lineWidth = w
    g.strokeRect(inset, inset, 256 - inset * 2, 256 - inset * 2)
  }
  g.fillStyle = cc
  g.beginPath()
  g.moveTo(128, 70)
  g.lineTo(186, 128)
  g.lineTo(128, 186)
  g.lineTo(70, 128)
  g.closePath()
  g.fill()
  g.fillStyle = b
  g.beginPath()
  g.arc(128, 128, 18, 0, Math.PI * 2)
  g.fill()
  for (let k = 0; k < 1200; k++) {
    g.fillStyle = `rgba(0,0,0,${R() * 0.06})`
    g.fillRect(R() * 256, R() * 256, 2, 2)
  }
  return tex(c, D, false)
}

/** an oil painting in the house style: moonlit landscape, a castle, a portrait (with optional glowing eyes) */
export function painting(D: D, kind: 'landscape' | 'castle' | 'portrait' | 'pumpkin', seed = 1, haunted = false) {
  const { c, g } = canvas(256, 320)
  const R = rng(seed)
  const sky = g.createLinearGradient(0, 0, 0, 320)
  sky.addColorStop(0, '#1a1638')
  sky.addColorStop(1, '#4a3a5a')
  g.fillStyle = sky
  g.fillRect(0, 0, 256, 320)
  if (kind === 'portrait') {
    g.fillStyle = '#2a2026'
    g.fillRect(0, 0, 256, 320)
    g.fillStyle = '#3a2a2a'
    g.beginPath()
    g.ellipse(128, 300, 110, 90, 0, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#c99a72'
    g.beginPath()
    g.ellipse(128, 140, 52, 66, 0, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#3a2418'
    g.beginPath()
    g.ellipse(128, 92, 58, 34, 0, Math.PI, 0)
    g.fill()
    g.fillStyle = haunted ? '#ff5a3a' : '#2a1a14'
    for (const x of [108, 148]) {
      g.beginPath()
      g.arc(x, 138, haunted ? 6 : 5, 0, Math.PI * 2)
      g.fill()
    }
    g.fillStyle = '#7a3a2a'
    g.fillRect(112, 172, 32, 5)
  } else {
    g.fillStyle = '#f2e6c8'
    g.beginPath()
    g.arc(60 + R() * 140, 70, 22, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#1a1626'
    g.beginPath()
    g.moveTo(0, 230)
    for (let x = 0; x <= 256; x += 32) g.lineTo(x, 200 + R() * 40)
    g.lineTo(256, 320)
    g.lineTo(0, 320)
    g.fill()
    if (kind === 'castle') {
      g.fillStyle = '#100c18'
      g.fillRect(90, 140, 76, 90)
      for (const [x, h] of [[84, 120], [160, 110], [122, 80]] as const) {
        g.fillRect(x, h, 14, 230 - h)
        g.beginPath()
        g.moveTo(x - 4, h)
        g.lineTo(x + 7, h - 30)
        g.lineTo(x + 18, h)
        g.fill()
      }
      g.fillStyle = '#ffb24a'
      for (let k = 0; k < 8; k++) g.fillRect(96 + R() * 60, 150 + R() * 60, 4, 6)
    }
    if (kind === 'pumpkin') {
      g.fillStyle = '#e8641a'
      g.beginPath()
      g.ellipse(128, 250, 60, 44, 0, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#ffd25a'
      g.beginPath()
      g.moveTo(100, 240)
      g.lineTo(118, 222)
      g.lineTo(122, 244)
      g.fill()
      g.beginPath()
      g.moveTo(156, 240)
      g.lineTo(138, 222)
      g.lineTo(134, 244)
      g.fill()
    }
  }
  // varnish crackle + vignette
  const v = g.createRadialGradient(128, 160, 60, 128, 160, 200)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(0,0,0,0.55)')
  g.fillStyle = v
  g.fillRect(0, 0, 256, 320)
  return tex(c, D, false)
}

/** what you see through a window at night: the moon, distant spires with lit windows, a garden wall */
export function windowView(D: D, seed = 1) {
  const { c, g } = canvas(128, 192)
  const R = rng(seed)
  const sky = g.createLinearGradient(0, 0, 0, 192)
  sky.addColorStop(0, '#0a0e2e')
  sky.addColorStop(1, '#3a2a5e')
  g.fillStyle = sky
  g.fillRect(0, 0, 128, 192)
  for (let k = 0; k < 30; k++) {
    g.fillStyle = `rgba(255,255,255,${0.4 + R() * 0.6})`
    g.fillRect(R() * 128, R() * 110, 1, 1)
  }
  g.fillStyle = '#f4ead0'
  g.beginPath()
  g.arc(30 + R() * 60, 40 + R() * 20, 11, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#14101e'
  for (let x = 0; x < 128; x += 12 + R() * 14) {
    const h = 40 + R() * 60
    g.fillRect(x, 192 - h, 10 + R() * 8, h)
    g.beginPath()
    g.moveTo(x - 2, 192 - h)
    g.lineTo(x + 6, 192 - h - 16 - R() * 14)
    g.lineTo(x + 16, 192 - h)
    g.fill()
  }
  g.fillStyle = '#ffb24a'
  for (let k = 0; k < 14; k++) g.fillRect(R() * 128, 130 + R() * 55, 2, 3)
  return tex(c, D, false)
}

/** a corner cobweb (alpha) */
export function cobweb(D: D) {
  const { c, g } = canvas(128, 128)
  g.clearRect(0, 0, 128, 128)
  g.strokeStyle = 'rgba(230,230,240,0.55)'
  g.lineWidth = 1
  for (let k = 0; k < 9; k++) {
    const a = (k / 8) * (Math.PI / 2)
    g.beginPath()
    g.moveTo(0, 0)
    g.lineTo(Math.cos(a) * 128, Math.sin(a) * 128)
    g.stroke()
  }
  for (let r = 14; r < 128; r += 14) {
    g.beginPath()
    for (let k = 0; k <= 8; k++) {
      const a = (k / 8) * (Math.PI / 2)
      const rr = r + Math.sin(k * 2.3) * 3
      if (k === 0) g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr)
      else g.quadraticCurveTo(Math.cos(a - 0.1) * rr * 0.9, Math.sin(a - 0.1) * rr * 0.9, Math.cos(a) * rr, Math.sin(a) * rr)
    }
    g.stroke()
  }
  return tex(c, D, false)
}

/** checker / hex tiles (kitchens, the barber shop, bathrooms) */
export function tiles(D: D, a: string, b: string, kind: 'checker' | 'hex' = 'checker') {
  const { c, g } = canvas(256, 256)
  g.fillStyle = a
  g.fillRect(0, 0, 256, 256)
  g.fillStyle = b
  if (kind === 'checker') {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2) g.fillRect(x * 64, y * 64, 64, 64)
  } else {
    for (let y = 0; y < 256; y += 32)
      for (let x = (y / 32) % 2 ? 16 : 0; x < 256; x += 32) {
        g.beginPath()
        g.arc(x + 16, y + 16, 13, 0, Math.PI * 2)
        g.fill()
      }
  }
  g.strokeStyle = 'rgba(0,0,0,0.25)'
  g.lineWidth = 2
  for (let k = 0; k <= 256; k += 64) {
    g.beginPath()
    g.moveTo(k, 0)
    g.lineTo(k, 256)
    g.moveTo(0, k)
    g.lineTo(256, k)
    g.stroke()
  }
  return tex(c, D)
}

/** product labels for shop shelves: rows of tubs, tins and bottles in the shop's colours */
export function shelfGoods(D: D, palette: string[], seed = 1) {
  const { c, g } = canvas(512, 128)
  const R = rng(seed)
  g.clearRect(0, 0, 512, 128)
  let x = 4
  while (x < 500) {
    const w = 18 + R() * 22
    const h = 40 + R() * 70
    const col = palette[Math.floor(R() * palette.length)]
    const round = R() < 0.5
    g.fillStyle = col
    if (round) {
      g.beginPath()
      g.roundRect(x, 128 - h, w, h, 6)
      g.fill()
    } else g.fillRect(x, 128 - h, w, h)
    g.fillStyle = 'rgba(255,255,255,0.75)'
    g.fillRect(x + 3, 128 - h * 0.6, w - 6, h * 0.22)
    g.fillStyle = 'rgba(0,0,0,0.3)'
    g.fillRect(x + w - 3, 128 - h, 3, h)
    x += w + 4
  }
  return tex(c, D, false)
}
