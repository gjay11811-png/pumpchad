import * as THREE from 'three'

/** Seeded RNG so procedural textures look identical every visit. */
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

/** Dark volcanic cobblestones with mortar + colour + roughness variation. */
export function cobbleTexture(size = 512) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const r = rng(7)
  g.fillStyle = '#0c0a0d'
  g.fillRect(0, 0, size, size)
  const rows = 8
  const h = size / rows
  for (let y = 0; y < rows; y++) {
    let x = y % 2 ? -h * 0.5 : 0
    while (x < size) {
      const w = h * (0.8 + r() * 0.7)
      const l = 14 + r() * 14
      g.fillStyle = `hsl(${18 + r() * 14}, ${8 + r() * 8}%, ${l}%)`
      const pad = 3
      g.beginPath()
      g.roundRect(x + pad, y * h + pad, w - pad * 2, h - pad * 2, 8)
      g.fill()
      // highlight edge
      g.fillStyle = 'rgba(255,200,150,0.05)'
      g.fillRect(x + pad + 3, y * h + pad + 2, w - pad * 2 - 6, 3)
      x += w
    }
  }
  // grime speckle
  for (let i = 0; i < 2500; i++) {
    g.fillStyle = `rgba(0,0,0,${r() * 0.25})`
    g.fillRect(r() * size, r() * size, 2, 2)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** Stone block wall texture for the castle. */
export function stoneTexture(size = 256) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const r = rng(13)
  g.fillStyle = '#121014'
  g.fillRect(0, 0, size, size)
  const rows = 6
  const h = size / rows
  for (let y = 0; y < rows; y++)
    for (let x = (y % 2) * -h; x < size; x += h * 1.6) {
      g.fillStyle = `hsl(260, ${4 + r() * 6}%, ${12 + r() * 9}%)`
      g.fillRect(x + 2, y * h + 2, h * 1.6 - 4, h - 4)
    }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Neon-style sign rendered to a canvas (used with an HDR basic material so it blooms). */
export function signTexture(text: string, opts: { w?: number; h?: number; color?: string; font?: string; sub?: string } = {}) {
  const w = opts.w ?? 1024
  const h = opts.h ?? 256
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.fillStyle = '#0a080c'
  g.fillRect(0, 0, w, h)
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = opts.font ?? `bold ${h * 0.55}px Anton, Impact, sans-serif`
  g.shadowColor = opts.color ?? '#ff7a1a'
  g.shadowBlur = 28
  g.fillStyle = opts.color ?? '#ff9a3c'
  g.fillText(text, w / 2, opts.sub ? h * 0.42 : h / 2)
  if (opts.sub) {
    g.shadowBlur = 10
    g.font = `${h * 0.14}px "JetBrains Mono", monospace`
    g.fillStyle = '#f6c870'
    g.fillText(opts.sub, w / 2, h * 0.82)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/**
 * Heraldic castle banner (512×1024, swallow-tailed via alpha): midnight cloth with a woven sheen, a double gold
 * border, a gold crown, an embroidered jack-o'-lantern crest (ribbed body, stem, glowing carved face) and a
 * PUMP CHAD wordmark. Materials using it should set alphaTest so the tail notch is cut out.
 */
export function bannerTexture() {
  const W = 512
  const H = 1024
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  // swallow-tail silhouette
  const notch = 150
  g.beginPath()
  g.moveTo(0, 0)
  g.lineTo(W, 0)
  g.lineTo(W, H)
  g.lineTo(W / 2, H - notch)
  g.lineTo(0, H)
  g.closePath()
  g.save()
  g.clip()
  const grad = g.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, '#231a3a')
  grad.addColorStop(0.55, '#170f28')
  grad.addColorStop(1, '#0d0918')
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)
  // woven sheen: fine diagonal threads + a soft vertical fold highlight
  g.globalAlpha = 0.06
  g.strokeStyle = '#ffffff'
  g.lineWidth = 1
  for (let k = -H; k < W + H; k += 6) {
    g.beginPath()
    g.moveTo(k, 0)
    g.lineTo(k - H * 0.4, H)
    g.stroke()
  }
  g.globalAlpha = 1
  const fold = g.createLinearGradient(0, 0, W, 0)
  fold.addColorStop(0, 'rgba(0,0,0,0.35)')
  fold.addColorStop(0.35, 'rgba(255,255,255,0.05)')
  fold.addColorStop(0.65, 'rgba(0,0,0,0.05)')
  fold.addColorStop(1, 'rgba(0,0,0,0.35)')
  g.fillStyle = fold
  g.fillRect(0, 0, W, H)
  // double gold border following the tail
  const gold = g.createLinearGradient(0, 0, W, H)
  gold.addColorStop(0, '#f6d27a')
  gold.addColorStop(0.5, '#c8902e')
  gold.addColorStop(1, '#f0c25e')
  const border = (inset: number, w: number) => {
    g.beginPath()
    g.moveTo(inset, inset)
    g.lineTo(W - inset, inset)
    g.lineTo(W - inset, H - inset * 1.6)
    g.lineTo(W / 2, H - notch - inset * 0.9)
    g.lineTo(inset, H - inset * 1.6)
    g.closePath()
    g.strokeStyle = gold
    g.lineWidth = w
    g.stroke()
  }
  border(22, 10)
  border(42, 3)
  // crown
  g.fillStyle = gold
  g.beginPath()
  g.moveTo(166, 236)
  g.lineTo(150, 120)
  g.lineTo(206, 176)
  g.lineTo(256, 96)
  g.lineTo(306, 176)
  g.lineTo(362, 120)
  g.lineTo(346, 236)
  g.closePath()
  g.fill()
  g.fillRect(160, 238, 192, 22)
  for (const [x, y] of [[150, 112], [256, 88], [362, 112]]) {
    g.beginPath()
    g.arc(x, y, 13, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = '#b8321e'
  for (const x of [206, 256, 306]) {
    g.beginPath()
    g.arc(x, 214, 9, 0, Math.PI * 2)
    g.fill()
  }
  // jack-o'-lantern crest: ribbed body (overlapping lobes), stem, glowing face
  const cx = W / 2
  const cy = 470
  g.fillStyle = '#4a6a2a'
  g.beginPath()
  g.moveTo(cx - 16, cy - 150)
  g.quadraticCurveTo(cx - 6, cy - 200, cx + 30, cy - 210)
  g.lineTo(cx + 34, cy - 194)
  g.quadraticCurveTo(cx + 12, cy - 186, cx + 16, cy - 150)
  g.closePath()
  g.fill()
  const lobes = [-118, -62, 0, 62, 118]
  for (const dx of lobes) {
    const rx = dx === 0 ? 92 : Math.abs(dx) > 100 ? 78 : 88
    const lg = g.createRadialGradient(cx + dx - 20, cy - 50, 10, cx + dx, cy, rx * 1.3)
    lg.addColorStop(0, '#ffa040')
    lg.addColorStop(0.6, '#e8641a')
    lg.addColorStop(1, '#8a2e08')
    g.fillStyle = lg
    g.beginPath()
    g.ellipse(cx + dx, cy, rx, 150, 0, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = 'rgba(70,20,0,0.55)'
    g.lineWidth = 4
    g.stroke()
  }
  // carved face (glow)
  const face = g.createRadialGradient(cx, cy + 10, 10, cx, cy + 10, 170)
  face.addColorStop(0, '#fff6c0')
  face.addColorStop(0.5, '#ffd25a')
  face.addColorStop(1, '#ff9a20')
  g.fillStyle = face
  g.shadowColor = '#ffb040'
  g.shadowBlur = 24
  for (const s of [-1, 1]) {
    g.beginPath()
    g.moveTo(cx + s * 30, cy - 18)
    g.lineTo(cx + s * 110, cy - 18)
    g.lineTo(cx + s * 68, cy - 86)
    g.closePath()
    g.fill()
  }
  g.beginPath()
  g.moveTo(cx - 14, cy + 22)
  g.lineTo(cx + 14, cy + 22)
  g.lineTo(cx, cy - 6)
  g.closePath()
  g.fill()
  g.beginPath()
  g.moveTo(cx - 128, cy + 50)
  const teeth = [[-96, 92], [-74, 64], [-46, 104], [-18, 72], [12, 108], [40, 70], [70, 104], [96, 64]]
  for (const [x, y] of teeth) g.lineTo(cx + x, cy + y)
  g.lineTo(cx + 128, cy + 50)
  g.quadraticCurveTo(cx, cy + 170, cx - 128, cy + 50)
  g.closePath()
  g.fill()
  g.shadowBlur = 0
  // wordmark
  g.fillStyle = gold
  g.textAlign = 'center'
  g.font = '700 92px Cinzel, "Trajan Pro", Georgia, "Times New Roman", serif'
  g.fillText('PUMP', W / 2, 735)
  g.fillText('CHAD', W / 2, 835)
  g.fillRect(150, 760, 212, 4)
  g.restore()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}
