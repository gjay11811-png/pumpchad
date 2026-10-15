import * as THREE from 'three'
import type { Town } from './buildings'
import { CELL, HEIGHTS, PIECE, PLOTS, PLOT_PRICE, plotGate, plotSize, pieceWorld, type Estate, type Piece, type Plot } from '../../estates'
import { showHomes } from './showHomes'
import { boxUV } from './kit'
import { ornateSign } from './ornament'
import { Frame } from './signs'
import { fingerpost } from './wayfinding'
import type { Collider } from './buildings'

/**
 * CHADVILLE ESTATES in the world: an arched entrance off the canal promenade's west end, cobbled lanes, four
 * plots with stone kerbs and signposts, and the live view of whatever the owner has built (rebuilt from the save
 * whenever it changes). Pieces share geometry + materials, so a rebuild is cheap.
 */
export const ESTATES = {
  arch: { x: -31.2, z: 47 },
  laneEW: { x0: -64, x1: -30, z0: 45, z1: 49 },
  laneNS: { x0: -50, x1: -44, z0: 49, z1: 77 },
}
/** lamps: the old estate's six + Chadville Heights' lanes (every 26 m, alternating sides) and spine */
export const ESTATE_LAMPS: [number, number][] = [
  [-36, 44.6], [-56, 44.6], [-44.5, 57], [-49.5, 57], [-44.5, 71], [-49.5, 71],
  ...[0, 1, 2, 3, 4, 5, 6].flatMap((i): [number, number][] => [[-78 - i * 26, i % 2 ? 35.6 : 40.4], [-78 - i * 26, i % 2 ? 59.6 : 64.4]]),
  [-68, 31], [-68, 54], [-68, 70],
]

export function estatesDistrict(T: Town) {
  const P = T.P
  const pave = (x0: number, x1: number, z0: number, z1: number, mat: THREE.Material, y = 0.022) => {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2)
    const u = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < u.count; i++) u.setXY(i, (u.getX(i) * (x1 - x0)) / 3, (u.getY(i) * (z1 - z0)) / 3)
    T.batch.put(g, mat, (x0 + x1) / 2, y, (z0 + z1) / 2, 0, 1, 1, 1, { cast: false })
  }
  const { laneEW: a, laneNS: b } = ESTATES
  pave(a.x0, a.x1, a.z0, a.z1, P.cobble)
  pave(b.x0, b.x1, b.z0, b.z1, P.cobble)
  // CHADVILLE HEIGHTS: the spine, two lanes and a short link to the old estate lane
  for (const l of [HEIGHTS.spine, HEIGHTS.laneA, HEIGHTS.laneB]) pave(l.x0, l.x1, l.z0, l.z1, P.cobble)
  pave(-66.2, -63.8, 45, 49, P.cobble)
  showHomes(T)
  const lawn = new THREE.MeshStandardMaterial({ map: P.ground.map, color: '#8aa86a', roughness: 1 })
  T.disposables.push(lawn)
  for (const p of PLOTS) {
    const { w, d } = plotSize
    pave(p.x0, p.x0 + w, p.z0, p.z0 + d, lawn, 0.012)
    // a low stone kerb round the plot, open at the gate (the gate can face any side)
    const g = plotGate(p)
    const kerb = (x0: number, z0: number, x1: number, z1: number) => {
      if (x1 - x0 < 0.05 || z1 - z0 < 0.05) return
      T.batch.put(boxUV(Math.max(0.25, x1 - x0), 0.22, Math.max(0.25, z1 - z0), 1), P.stoneLight, (x0 + x1) / 2, 0.11, (z0 + z1) / 2, 0, 1, 1, 1, { cast: false })
    }
    const X1 = p.x0 + w
    const Z1 = p.z0 + d
    const gx = [g.x - 1.4, g.x + 1.4]
    const gz = [g.z - 1.4, g.z + 1.4]
    // north / south edges
    if (p.gate === 'n') {
      kerb(p.x0, p.z0 - 0.12, gx[0], p.z0 + 0.12)
      kerb(gx[1], p.z0 - 0.12, X1, p.z0 + 0.12)
    } else kerb(p.x0, p.z0 - 0.12, X1, p.z0 + 0.12)
    if (p.gate === 's') {
      kerb(p.x0, Z1 - 0.12, gx[0], Z1 + 0.12)
      kerb(gx[1], Z1 - 0.12, X1, Z1 + 0.12)
    } else kerb(p.x0, Z1 - 0.12, X1, Z1 + 0.12)
    // west / east edges
    if (p.gate === 'w') {
      kerb(p.x0 - 0.12, p.z0, p.x0 + 0.12, gz[0])
      kerb(p.x0 - 0.12, gz[1], p.x0 + 0.12, Z1)
    } else kerb(p.x0 - 0.12, p.z0, p.x0 + 0.12, Z1)
    if (p.gate === 'e') {
      kerb(X1 - 0.12, p.z0, X1 + 0.12, gz[0])
      kerb(X1 - 0.12, gz[1], X1 + 0.12, Z1)
    } else kerb(X1 - 0.12, p.z0, X1 + 0.12, Z1)
    for (const [cx, cz] of [[p.x0, p.z0], [p.x0 + w, p.z0], [p.x0, p.z0 + d], [p.x0 + w, p.z0 + d]]) T.batch.put(boxUV(0.4, 0.5, 0.4, 1), P.stone, cx, 0.25, cz)
  }
  // the entrance: two stone pillars, an iron arch, the ornate sign both ways, and a fingerpost
  {
    const { x, z } = ESTATES.arch
    for (const dz of [-2.4, 2.4]) {
      T.batch.put(boxUV(0.8, 2.8, 0.8, 1.2), P.stone, x, 1.4, z + dz)
      T.batch.put(boxUV(0.95, 0.14, 0.95, 1), P.stoneLight, x, 2.87, z + dz)
      T.batch.put(new THREE.SphereGeometry(0.22, 12, 8), P.gold, x, 3.1, z + dz)
      T.colliders.push({ kind: 'circle', x, z: z + dz, r: 0.55, h: 3 })
    }
    T.batch.put(new THREE.TorusGeometry(2.4, 0.08, 6, 24, Math.PI).rotateY(Math.PI / 2), P.iron, x, 2.85, z)
    for (const ry of [Math.PI / 2, -Math.PI / 2]) ornateSign(T, Frame.at(T.batch, x + (ry > 0 ? 0.07 : -0.07), 3.75, z, ry), 'CHADVILLE ESTATES', { h: 0.56, crest: 'crown' })
    fingerpost(T, x + 2.8, z - 3.6, [
      { label: 'CHADVILLE ESTATES', to: [-47, 60] },
      { label: 'CHADVILLE HEIGHTS', to: [-120, 38] },
      { label: 'CHAD VIEW', to: [-53, 38.5] },
      { label: 'CANAL · GATEWAY', to: [0, 50] },
    ])
  }
}

/* ── the live part: plot signs + the pieces people have built ── */

type Mats = Record<'plaster' | 'roof' | 'wood' | 'door' | 'stone' | 'hedge' | 'leaf' | 'bark' | 'iron' | 'glow' | 'window' | 'water' | 'flowerA' | 'flowerB' | 'pumpkin' | 'path', THREE.Material>

export class EstateView {
  private group = new THREE.Group()
  private signs = new Map<string, { mat: THREE.MeshStandardMaterial; tex: THREE.CanvasTexture; ctx: CanvasRenderingContext2D }>()
  private M: Mats
  private G: Record<string, THREE.BufferGeometry> = {}
  private colliders: Collider[] = []
  private disposables: (THREE.Material | THREE.Texture | THREE.BufferGeometry)[] = []

  constructor(private T: Town, private worldColliders: Collider[]) {
    const P = T.P
    const std = (p: THREE.MeshStandardMaterialParameters) => {
      const m = new THREE.MeshStandardMaterial(p)
      this.disposables.push(m)
      return m
    }
    this.M = {
      plaster: std({ map: P.plaster.map ?? undefined, color: '#e8d8b8', roughness: 0.95 }),
      roof: std({ map: P.roofSlate.map ?? undefined, color: '#5a4a6a', roughness: 0.8 }),
      wood: P.woodLight,
      door: std({ color: '#5b2a86', roughness: 0.7 }),
      stone: P.stoneLight,
      hedge: std({ color: '#35553a', roughness: 0.95, flatShading: true }),
      leaf: std({ color: '#4a7a46', roughness: 0.9, flatShading: true }),
      bark: P.bark,
      iron: P.iron,
      glow: (() => {
        const m = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd28a').multiplyScalar(2.2), toneMapped: false })
        this.disposables.push(m)
        return m
      })(),
      window: P.windowLit,
      water: std({ color: '#3a7aa8', roughness: 0.1, metalness: 0.2, emissive: '#0a2038' }),
      flowerA: std({ color: '#ff8ad8', roughness: 0.8 }),
      flowerB: std({ color: '#ffd25a', roughness: 0.8 }),
      pumpkin: std({ color: '#e8641a', roughness: 0.6 }),
      path: std({ map: P.plaza.map ?? undefined, color: '#c8c0b0', roughness: 0.95 }),
    }
    const G = this.G
    const geo = (k: string, g: THREE.BufferGeometry) => {
      G[k] = g
      this.disposables.push(g)
    }
    geo('box', new THREE.BoxGeometry(1, 1, 1))
    geo('cyl', new THREE.CylinderGeometry(0.5, 0.5, 1, 14))
    geo('cone4', new THREE.ConeGeometry(0.5, 1, 4).rotateY(Math.PI / 4))
    geo('cone12', new THREE.ConeGeometry(0.5, 1, 12))
    geo('ball', new THREE.IcosahedronGeometry(0.5, 1))
    geo('sphere', new THREE.SphereGeometry(0.5, 14, 10))
    geo('prism', (() => {
      const s = new THREE.Shape()
      s.moveTo(-0.5, 0)
      s.lineTo(0.5, 0)
      s.lineTo(0, 0.5)
      s.closePath()
      return new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5)
    })())
    T.scene.add(this.group)
    for (const p of PLOTS) this.makeSign(p)
  }

  private makeSign(p: Plot) {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 128
    const ctx = c.getContext('2d')!
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.25 })
    this.disposables.push(tex, mat)
    const g = plotGate(p)
    // post + board facing the lane
    // beside the gate, on the lane side, facing the lane
    const ry = { w: -Math.PI / 2, e: Math.PI / 2, n: Math.PI, s: 0 }[p.gate]
    const side = p.gate === 'w' || p.gate === 'e' ? { x: p.gate === 'w' ? -0.2 : 0.2, z: -1.9 } : { x: 1.9, z: p.gate === 'n' ? -0.2 : 0.2 }
    const sx = g.x + side.x
    const sz = g.z + side.z
    const F = Frame.at(this.T.batch, sx, 0, sz, ry)
    // a proper sign: two posts at the board's edges, a top rail and a backing board — never a post through the lettering
    for (const px of [-0.72, 0.72]) F.box(0.1, 1.75, 0.1, this.T.P.bark, px, 0.875, 0)
    F.box(1.54, 0.07, 0.12, this.T.P.bark, 0, 1.72, 0)
    F.box(1.28, 0.68, 0.05, this.T.P.timber, 0, 1.35, 0)
    const nx = Math.sin(ry)
    const nz = Math.cos(ry)
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), mat)
    this.disposables.push(board.geometry)
    board.position.set(sx + nx * 0.032, 1.35, sz + nz * 0.032)
    board.rotation.y = ry
    const back = board.clone()
    back.position.set(sx - nx * 0.032, 1.35, sz - nz * 0.032)
    back.rotation.y = ry + Math.PI
    this.T.scene.add(board, back)
    for (const px of [-0.72, 0.72]) this.T.colliders.push({ kind: 'circle', x: sx + Math.cos(ry) * px, z: sz - Math.sin(ry) * px, r: 0.12, h: 1.75 })
    this.signs.set(p.id, { mat, tex, ctx })
  }

  private paintSign(p: Plot, owner: string | null, mine: boolean) {
    const s = this.signs.get(p.id)!
    const g = s.ctx
    g.fillStyle = owner ? '#2a2034' : '#1e2a22'
    g.fillRect(0, 0, 256, 128)
    g.strokeStyle = '#e0a83e'
    g.lineWidth = 6
    g.strokeRect(6, 6, 244, 116)
    g.fillStyle = '#ffd25a'
    g.textAlign = 'center'
    g.font = 'bold 30px Georgia, serif'
    g.fillText(p.name.toUpperCase(), 128, 50)
    g.font = '20px Georgia, serif'
    g.fillStyle = '#f2efe6'
    g.fillText(owner ? (mine ? `${owner}'s place`.slice(0, 22) : 'SOLD') : `FOR SALE · ${PLOT_PRICE} coins`, 128, 90)
    s.tex.needsUpdate = true
  }

  /** show the save: who owns which plot, and what they've built */
  set(estate: Estate, ownerName: string) {
    for (const p of PLOTS) this.paintSign(p, estate.plot === p.id ? ownerName || 'Your' : null, estate.plot === p.id)
    for (const c of this.colliders) {
      const i = this.worldColliders.indexOf(c)
      if (i >= 0) this.worldColliders.splice(i, 1)
    }
    this.colliders = []
    this.group.clear()
    const plot = PLOTS.find((p) => p.id === estate.plot)
    if (!plot) return
    for (const piece of estate.pieces) this.addPiece(plot, piece)
  }

  private addPiece(plot: Plot, piece: Piece) {
    const def = PIECE(piece.k)
    if (!def) return
    const w = pieceWorld(plot, piece)
    const g = new THREE.Group()
    g.position.set(w.x, 0, w.z)
    g.rotation.y = w.ry
    // local frame: the piece's unrotated footprint, centred, "front" toward local +z
    const fw = def.w * CELL
    const fd = def.d * CELL
    const M = this.M
    const G = this.G
    const put = (geo: string, mat: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0) => {
      const m = new THREE.Mesh(G[geo], mat)
      m.position.set(x, y, z)
      m.scale.set(sx, sy, sz)
      m.rotation.y = ry
      m.castShadow = true
      m.receiveShadow = true
      g.add(m)
      return m
    }
    switch (piece.k) {
      case 'cottage': {
        const W = fw - 0.6
        const D = fd - 0.6
        put('box', M.plaster, 0, 1.3, 0, W, 2.6, D)
        put('prism', M.roof, 0, 2.6, 0, W + 0.5, 2.6, D + 0.5)
        put('box', M.stone, 0, 0.12, 0, W + 0.2, 0.24, D + 0.2)
        put('box', M.door, 0, 0.95, D / 2 + 0.03, 0.9, 1.7, 0.08)
        for (const sx of [-1, 1]) put('box', M.window, sx * (W / 2 - 0.75), 1.5, D / 2 + 0.03, 0.7, 0.7, 0.06)
        put('box', M.stone, W / 2 - 0.6, 3.6, -D / 4, 0.45, 1.2, 0.45)
        break
      }
      case 'tower':
        put('cyl', M.stone, 0, 1.8, 0, 1.4, 3.6, 1.4)
        put('cone12', M.roof, 0, 4.2, 0, 1.8, 1.4, 1.8)
        put('box', M.window, 0, 2.4, 0.7, 0.35, 0.6, 0.06)
        break
      case 'fountain':
        put('cyl', M.stone, 0, 0.25, 0, 1.7, 0.5, 1.7)
        put('cyl', M.water, 0, 0.46, 0, 1.45, 0.06, 1.45)
        put('cyl', M.stone, 0, 0.8, 0, 0.25, 1.0, 0.25)
        put('sphere', M.water, 0, 1.35, 0, 0.4, 0.25, 0.4)
        break
      case 'tree':
        put('cyl', M.bark, 0, 1.1, 0, 0.3, 2.2, 0.3)
        put('ball', M.leaf, 0, 2.7, 0, 1.8, 1.6, 1.8)
        put('ball', M.leaf, 0.4, 3.3, 0.2, 1.1, 1.0, 1.1)
        break
      case 'lamp':
        put('cyl', M.iron, 0, 1.25, 0, 0.12, 2.5, 0.12)
        put('box', M.iron, 0, 2.55, 0, 0.36, 0.06, 0.36)
        put('box', M.glow, 0, 2.35, 0, 0.26, 0.34, 0.26)
        break
      case 'bench':
        put('box', M.wood, 0, 0.46, 0.05, 1.6, 0.08, 0.45)
        put('box', M.wood, 0, 0.75, -0.18, 1.6, 0.35, 0.06)
        for (const sx of [-0.7, 0.7]) put('box', M.iron, sx, 0.23, 0.05, 0.08, 0.46, 0.45)
        break
      case 'hedge':
        put('box', M.hedge, 0, 0.6, 0, fw - 0.1, 1.2, fd - 0.1)
        break
      case 'fence':
        // along the cell's front edge
        put('box', M.wood, 0, 0.5, fd / 2 - 0.15, fw, 0.08, 0.06)
        put('box', M.wood, 0, 0.85, fd / 2 - 0.15, fw, 0.08, 0.06)
        for (const sx of [-fw / 2 + 0.1, 0, fw / 2 - 0.1]) put('box', M.wood, sx, 0.5, fd / 2 - 0.15, 0.1, 1.0, 0.1)
        break
      case 'flowers':
        put('box', M.wood, 0, 0.12, 0, fw - 0.3, 0.24, fd - 0.3)
        for (let i = 0; i < 9; i++) put('sphere', i % 2 ? M.flowerA : M.flowerB, ((i % 3) - 1) * 0.5, 0.32, (Math.floor(i / 3) - 1) * 0.5, 0.28, 0.2, 0.28)
        break
      case 'pumpkins':
        for (const [x, z, s] of [[-0.4, -0.3, 0.7], [0.4, 0.2, 0.55], [-0.1, 0.5, 0.45]] as const) put('sphere', M.pumpkin, x, s * 0.4, z, s, s * 0.8, s)
        break
      case 'path':
        put('box', M.path, 0, 0.02, 0, fw - 0.1, 0.04, fd - 0.1)
        break
    }
    this.group.add(g)
    if (def.solid) {
      const odd = piece.r % 2 === 1
      const hw = ((odd ? fd : fw) / 2) * (piece.k === 'cottage' || piece.k === 'hedge' ? 0.92 : 0.45)
      const hd = ((odd ? fw : fd) / 2) * (piece.k === 'cottage' || piece.k === 'hedge' ? 0.92 : 0.45)
      const c: Collider = piece.k === 'fence' || piece.k === 'cottage' || piece.k === 'hedge' ? { kind: 'box', minX: w.x - hw, maxX: w.x + hw, minZ: w.z - hd, maxZ: w.z + hd, h: 2 } : { kind: 'circle', x: w.x, z: w.z, r: Math.min(hw, hd), h: 2 }
      this.colliders.push(c)
      this.worldColliders.push(c)
    }
  }

  dispose() {
    this.group.removeFromParent()
    this.disposables.forEach((d) => d.dispose())
  }
}
