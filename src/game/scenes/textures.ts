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

/** Banner cloth with the PUMP CHAD wordmark in gold. */
export function bannerTexture() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 512
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 512)
  grad.addColorStop(0, '#1a1418')
  grad.addColorStop(1, '#0b090c')
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 512)
  g.strokeStyle = '#c89b3c'
  g.lineWidth = 6
  g.strokeRect(14, 14, 228, 484)
  g.fillStyle = '#e8b84a'
  g.textAlign = 'center'
  g.font = 'bold 92px Anton, Impact, sans-serif'
  g.fillText('PUMP', 128, 170)
  g.fillText('CHAD', 128, 270)
  // crown
  g.beginPath()
  g.moveTo(78, 380)
  g.lineTo(88, 330)
  g.lineTo(108, 360)
  g.lineTo(128, 320)
  g.lineTo(148, 360)
  g.lineTo(168, 330)
  g.lineTo(178, 380)
  g.closePath()
  g.fill()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
