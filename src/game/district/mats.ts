import * as THREE from 'three'

type Disposables = (THREE.Material | THREE.Texture | THREE.BufferGeometry)[]

/**
 * The district's materials. Surfaces that carry the realism (asphalt, pavement, pavers, concrete, brick, plaza tiles) use real PBR texture sets from
 * Poly Haven (CC0; see ASSETS.md), at 1K WebP. Everything else is a physically based colour with sensible metalness / roughness; a few canvas-drawn
 * textures (timber cladding, the gold lattice screen, the logo) are made here. UVs are in metres, so `tile` below is "metres per texture repeat".
 */
export function districtMats(D: Disposables, anisotropy: number) {
  const loader = new THREE.TextureLoader()
  const base = `${import.meta.env.BASE_URL}chadverse/district/tex/`
  const tex = (file: string, srgb: boolean) => {
    const t = loader.load(base + file)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = anisotropy
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    D.push(t)
    return t
  }
  const pbr = (name: string, o: THREE.MeshStandardMaterialParameters = {}, normalScale = 1) => {
    const m = new THREE.MeshStandardMaterial({ map: tex(`${name}_diff.webp`, true), normalMap: tex(`${name}_nor.webp`, false), roughnessMap: tex(`${name}_rough.webp`, false), roughness: 1, metalness: 0, ...o })
    m.normalScale.set(normalScale, normalScale)
    D.push(m)
    return m
  }
  const std = (p: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.6, ...p })
    D.push(m)
    return m
  }
  const glow = (c: string, k: number) => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), toneMapped: false })
    D.push(m)
    return m
  }
  const canvas = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    draw(c.getContext('2d')!)
    const t = new THREE.CanvasTexture(c)
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = anisotropy
    D.push(t)
    return t
  }

  // timber cladding: vertical boards with grain, knots and shade variation (warm oak, like a premium soffit / feature wall)
  const woodTex = canvas(256, 256, (g) => {
    for (let x = 0; x < 256; x += 32) {
      const l = 36 + Math.random() * 10
      g.fillStyle = `hsl(${26 + Math.random() * 6}, ${44 + Math.random() * 10}%, ${l}%)`
      g.fillRect(x, 0, 31, 256)
      for (let k = 0; k < 22; k++) {
        g.fillStyle = `rgba(60,32,14,${0.05 + Math.random() * 0.12})`
        g.fillRect(x + Math.random() * 30, 0, 0.6 + Math.random() * 1.2, 256)
      }
      g.fillStyle = 'rgba(0,0,0,0.5)'
      g.fillRect(x + 31, 0, 1, 256)
    }
  })
  woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping

  // a gold-lit lattice (the perforated screen over the entrance core): dark metal with a repeating star-and-diamond cut-out, glowing gold behind
  const latticeTex = canvas(256, 256, (g) => {
    g.fillStyle = '#e8b04a'
    g.fillRect(0, 0, 256, 256)
    g.fillStyle = '#17130e'
    const cell = 64
    for (let y = 0; y < 256; y += cell)
      for (let x = 0; x < 256; x += cell) {
        const cx = x + cell / 2
        const cy = y + cell / 2
        g.save()
        g.translate(cx, cy)
        for (let k = 0; k < 8; k++) {
          g.rotate(Math.PI / 4)
          g.beginPath()
          g.moveTo(0, 0)
          g.lineTo(cell * 0.12, cell * 0.26)
          g.lineTo(0, cell * 0.44)
          g.lineTo(-cell * 0.12, cell * 0.26)
          g.closePath()
          g.fill()
        }
        g.restore()
        g.fillRect(x, y, cell, 3)
        g.fillRect(x, y, 3, cell)
      }
  })
  latticeTex.wrapS = latticeTex.wrapT = THREE.RepeatWrapping

  // the PumpChad mark: a gold pumpkin-shaped shield around a bold P, on transparent
  const logoTex = canvas(512, 512, (g) => {
    g.clearRect(0, 0, 512, 512)
    const gold = g.createLinearGradient(0, 0, 0, 512)
    gold.addColorStop(0, '#fff0b8')
    gold.addColorStop(0.5, '#e8b04a')
    gold.addColorStop(1, '#a8741c')
    g.fillStyle = gold
    g.strokeStyle = gold
    g.lineWidth = 18
    // pumpkin outline: three ribs
    g.beginPath()
    g.ellipse(256, 290, 190, 170, 0, 0, Math.PI * 2)
    g.stroke()
    g.lineWidth = 10
    for (const dx of [-88, 88]) {
      g.beginPath()
      g.ellipse(256, 290, 190 - Math.abs(dx) * 0.0 + 0, 170, 0, 0, 0)
      g.moveTo(256 + dx * 0.45, 124)
      g.quadraticCurveTo(256 + dx * 1.15, 290, 256 + dx * 0.45, 456)
      g.stroke()
    }
    // stem
    g.beginPath()
    g.moveTo(236, 128)
    g.quadraticCurveTo(250, 60, 300, 40)
    g.lineTo(312, 70)
    g.quadraticCurveTo(278, 86, 278, 128)
    g.closePath()
    g.fill()
    // the P
    g.font = '900 250px "Arial Black", Impact, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('P', 256, 300)
  })

  // a curtain-wall facade: panes in slightly varied blue-greys (some lit warm), mullions and a spandrel strip per floor — 3.6 m per floor, 1.8 m per pane
  const facadeTex = canvas(256, 256, (g) => {
    g.fillStyle = '#2a3036'
    g.fillRect(0, 0, 256, 256)
    for (let fy = 0; fy < 2; fy++)
      for (let fx = 0; fx < 4; fx++) {
        const x = fx * 64
        const y = fy * 128
        const lit = Math.random() < 0.16
        const base = 62 + Math.random() * 26
        g.fillStyle = lit ? `rgb(${200 + Math.random() * 40},${170 + Math.random() * 30},${110 + Math.random() * 30})` : `rgb(${base * 0.78},${base * 0.95},${base * 1.15})`
        g.fillRect(x + 3, y + 30, 58, 94)
        const gr = g.createLinearGradient(x, y + 30, x + 64, y + 124)
        gr.addColorStop(0, 'rgba(255,255,255,0.28)')
        gr.addColorStop(0.5, 'rgba(255,255,255,0)')
        g.fillStyle = gr
        g.fillRect(x + 3, y + 30, 58, 94)
      }
    g.fillStyle = '#4a5058'
    for (let fy = 0; fy < 2; fy++) g.fillRect(0, fy * 128, 256, 26)
  })
  facadeTex.wrapS = facadeTex.wrapT = THREE.RepeatWrapping
  const m = {
    facade: new THREE.MeshStandardMaterial({ map: facadeTex, roughness: 0.3, metalness: 0.35, envMapIntensity: 1.6 }),
    asphalt: pbr('asphalt_04', { color: '#c9c9cc' }, 1.1),
    pavement: pbr('large_grey_tiles', { color: '#c2c0ba' }),
    pavers: pbr('concrete_pavement_03', { color: '#c2bfb9' }),
    plaza: pbr('large_grey_tiles', { color: '#a8a6a0' }),
    concrete: pbr('concrete_wall_007', { color: '#bdbab4' }),
    brick: pbr('red_brick_03', { color: '#e6cdbb' }),
    ground: std({ color: '#6d7064', roughness: 1 }),
    kerb: std({ color: '#b9b7b0', roughness: 0.85 }),
    // paint markings sit a hair above the asphalt: slightly rough white / yellow thermoplastic
    paint: std({ color: '#f1f1ea', roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    paintYellow: std({ color: '#e8b81c', roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    steel: std({ color: '#23252b', metalness: 0.75, roughness: 0.38 }),
    steelLight: std({ color: '#9aa0a8', metalness: 0.85, roughness: 0.3 }),
    cladding: std({ color: '#20232b', metalness: 0.55, roughness: 0.42 }),
    timber: std({ map: woodTex, roughness: 0.55 }),
    gold: std({ color: '#d6a43a', metalness: 1, roughness: 0.28 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#7f9fb4', metalness: 0.15, roughness: 0.06, transparent: true, opacity: 0.3, envMapIntensity: 2.2, clearcoat: 1, clearcoatRoughness: 0.03, depthWrite: false, side: THREE.DoubleSide }),
    glassDark: new THREE.MeshPhysicalMaterial({ color: '#34495a', metalness: 0.4, roughness: 0.05, transparent: true, opacity: 0.55, envMapIntensity: 2.4, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide }),
    lattice: new THREE.MeshStandardMaterial({ map: latticeTex, emissiveMap: latticeTex, emissive: '#ffffff', emissiveIntensity: 0.55, roughness: 0.5, metalness: 0.3 }),
    logo: new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, toneMapped: false, depthWrite: false }),
    // the gym inside, seen through the glass: warm, evenly lit surfaces so the equipment reads in daylight
    floorInt: std({ color: '#3a3a40', roughness: 0.55 }),
    wallInt: std({ color: '#cfcac0', roughness: 0.9 }),
    rubber: std({ color: '#17181b', roughness: 0.9 }),
    machine: std({ color: '#2d3038', metalness: 0.6, roughness: 0.4 }),
    machineAccent: std({ color: '#d6a43a', metalness: 0.8, roughness: 0.35 }),
    leather: std({ color: '#5a1f1f', roughness: 0.6 }),
    ceilLight: glow('#fff3d8', 2.4),
    warmLight: glow('#ffd9a0', 1.6),
    ledGold: glow('#ffc766', 2.2),
    leaf: std({ color: '#4d7a36', roughness: 0.85 }),
    bark: std({ color: '#4a3a2c', roughness: 0.95 }),
    soil: std({ color: '#3b2f25', roughness: 1 }),
    grass: std({ color: '#5f8a3e', roughness: 1 }),
    hedge: std({ color: '#2f5a2c', roughness: 0.9 }),
    white: std({ color: '#ecebe6', roughness: 0.6 }),
    postbox: std({ color: '#1d3f9a', roughness: 0.45, metalness: 0.3 }),
    signRed: std({ color: '#b32024', roughness: 0.5 }),
    signGreen: std({ color: '#0f6a3a', roughness: 0.5 }),
    black: std({ color: '#0e0e10', roughness: 0.7 }),
    redLamp: glow('#ff3030', 2),
    amberLamp: glow('#ffb020', 2),
    greenLamp: glow('#30ff70', 2),
  }
  return m
}
export type DMats = ReturnType<typeof districtMats>
