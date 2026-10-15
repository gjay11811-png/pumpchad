import * as THREE from 'three'

/**
 * PROCEDURAL TREES AND SHRUBS — real branching structure, not blobs on sticks.
 *
 * A tree is grown recursively: a tapered, slightly curved trunk; primary limbs leaving it at varied heights and angles (golden-angle
 * spacing so no two sides match); secondary branches and twigs off those; and a clump of alpha-tested leaf (or needle) cards at every
 * twig end, shaded darker inside and lower down so the crown reads as layered volume with gaps you can see sky through. Different species
 * are different growth recipes (oak, birch, willow, pine, poplar, dead tree) and every seed grows a different individual.
 *
 * Geometry goes straight into typed arrays (one pass, no per-branch THREE objects) so growing a few hundred trees at load is cheap.
 * `detail` thins the branching and the cards for phones and for the far LOD; `far` = trunk + primary limbs + a few big cards.
 * Origin = the tree's base on the ground, +y up, metres, at scale 1 (an oak ≈ 6.5 m tall and ≈ 6 m across).
 */
export type TreeKind = 'oak' | 'birch' | 'willow' | 'pine' | 'poplar' | 'dead' | 'shrub'
export type TreeOpts = { detail: number; far?: boolean; leaf: THREE.Color[]; bark: THREE.Color }
export type TreeGeo = { bark: THREE.BufferGeometry | null; leaves: THREE.BufferGeometry | null; needles: THREE.BufferGeometry | null }

class Buf {
  pos: number[] = []
  nor: number[] = []
  uv: number[] = []
  col: number[] = []
  idx: number[] = []
  get n() {
    return this.pos.length / 3
  }
  geo() {
    if (!this.pos.length) return null
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3))
    g.setIndex(this.idx)
    g.computeBoundingSphere()
    return g
  }
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)
const GOLDEN = 2.399963

/** a tapered tube along a bent path: `pts` centre line, `r0` → `r1` radius, `rad` sides; UV v runs along the length in 1 m tiles */
function tube(b: Buf, pts: THREE.Vector3[], r0: number, r1: number, rad: number, col: THREE.Color, shade = 1) {
  const base = b.n
  const up = Math.abs(pts[1].clone().sub(pts[0]).normalize().y) > 0.95 ? V(1, 0, 0) : V(0, 1, 0)
  let along = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const t = i / (pts.length - 1)
    const dir = (i < pts.length - 1 ? pts[i + 1].clone().sub(p) : p.clone().sub(pts[i - 1])).normalize()
    const side = dir.clone().cross(up).normalize()
    const fwd = dir.clone().cross(side).normalize()
    const r = THREE.MathUtils.lerp(r0, r1, Math.pow(t, 0.85))
    if (i > 0) along += p.distanceTo(pts[i - 1])
    for (let k = 0; k <= rad; k++) {
      const a = (k / rad) * Math.PI * 2
      const nx = side.x * Math.cos(a) + fwd.x * Math.sin(a)
      const ny = side.y * Math.cos(a) + fwd.y * Math.sin(a)
      const nz = side.z * Math.cos(a) + fwd.z * Math.sin(a)
      b.pos.push(p.x + nx * r, p.y + ny * r, p.z + nz * r)
      b.nor.push(nx, ny, nz)
      b.uv.push((k / rad) * Math.max(1, Math.round(r0 * 14)), along)
      const g = shade * (0.82 + 0.18 * (k % 2)) // faint ridges so the bark does not read as a smooth tube
      b.col.push(col.r * g, col.g * g, col.b * g)
    }
    if (i > 0) {
      const row = rad + 1
      const a0 = base + (i - 1) * row
      const a1 = base + i * row
      for (let k = 0; k < rad; k++) b.idx.push(a0 + k, a1 + k, a0 + k + 1, a0 + k + 1, a1 + k, a1 + k + 1)
    }
  }
}

/** a bent path from `a` heading `dir`, length `len`, drooping by `droop` and wandering by `wob` */
function path(a: THREE.Vector3, dir: THREE.Vector3, len: number, segs: number, droop: number, wob: number, r: () => number) {
  const pts = [a.clone()]
  const d = dir.clone().normalize()
  const side = d.clone().cross(V(0, 1, 0))
  if (side.lengthSq() < 1e-4) side.set(1, 0, 0)
  side.normalize()
  const bend = side.clone().multiplyScalar((r() - 0.5) * wob)
  let p = a.clone()
  for (let i = 1; i <= segs; i++) {
    d.add(bend.clone().multiplyScalar(1 / segs)).add(V(0, -droop / segs, 0)).normalize()
    p = p.clone().addScaledVector(d, len / segs)
    pts.push(p)
  }
  return pts
}

/** a clump of leaf cards around `c` (an ellipsoid with radius `rad`), tinted and shaded by height inside the crown */
function clump(b: Buf, c: THREE.Vector3, rad: THREE.Vector3, n: number, size: number, tint: THREE.Color, crownLo: number, crownHi: number, r: () => number, droop = 0) {
  for (let i = 0; i < n; i++) {
    const u = r() * Math.PI * 2
    const v = Math.acos(1 - 2 * Math.pow(r(), 0.8) * 0.9 - 0.05)
    const dir = V(Math.sin(v) * Math.cos(u), Math.cos(v) - droop, Math.sin(v) * Math.sin(u)).normalize()
    const k = Math.pow(r(), 0.55)
    const p = V(c.x + dir.x * rad.x * k, c.y + dir.y * rad.y * k, c.z + dir.z * rad.z * k)
    // card orientation: faces outward-and-up with a random twist, so the clump has layers and gaps
    const nrm = dir.clone().multiplyScalar(0.6).add(V(0, 0.45, 0)).normalize()
    const tx = nrm.clone().cross(V(0, 1, 0))
    if (tx.lengthSq() < 1e-4) tx.set(1, 0, 0)
    tx.normalize()
    const ty = nrm.clone().cross(tx).normalize()
    const twist = r() * Math.PI
    const c1 = Math.cos(twist)
    const s1 = Math.sin(twist)
    const ax = tx.clone().multiplyScalar(c1).addScaledVector(ty, s1)
    const ay = ty.clone().multiplyScalar(c1).addScaledVector(tx, -s1)
    const sz = size * (0.72 + r() * 0.55)
    const hgt = THREE.MathUtils.clamp((p.y - crownLo) / Math.max(0.01, crownHi - crownLo), 0, 1)
    const shade = (0.5 + 0.55 * hgt) * (0.9 + r() * 0.2) * (0.82 + 0.18 * k)
    const t = tint.clone().offsetHSL((r() - 0.5) * 0.035, 0, (r() - 0.5) * 0.06)
    const base = b.n
    for (const [ux, uy] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]] as const) {
      b.pos.push(p.x + (ax.x * ux + ay.x * uy) * sz, p.y + (ax.y * ux + ay.y * uy) * sz, p.z + (ax.z * ux + ay.z * uy) * sz)
      b.nor.push(nrm.x, nrm.y, nrm.z)
      b.uv.push(ux + 0.5, uy + 0.5)
      b.col.push(t.r * shade, t.g * shade, t.b * shade)
    }
    b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
}

/** a needle spray along a branch: three crossed strips standing off the branch, drooping at the tip */
function needleSpray(b: Buf, a: THREE.Vector3, tip: THREE.Vector3, w: number, tint: THREE.Color, shade: number, r: () => number, strips = 2) {
  const dir = tip.clone().sub(a)
  const len = dir.length()
  if (len < 0.05) return
  dir.normalize()
  const side0 = dir.clone().cross(V(0, 1, 0))
  if (side0.lengthSq() < 1e-4) side0.set(1, 0, 0)
  side0.normalize()
  for (let s = 0; s < strips; s++) {
    const ang = (s / strips) * Math.PI + r() * 0.3
    const side = side0.clone().applyAxisAngle(dir, ang)
    const nrm = dir.clone().cross(side).normalize()
    const t = tint.clone().offsetHSL((r() - 0.5) * 0.02, 0, (r() - 0.5) * 0.05)
    const base = b.n
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]] as const) {
      const along = v * len
      const droop = v * v * 0.12 * len
      const p = V(a.x + dir.x * along + side.x * (u - 0.5) * w, a.y + dir.y * along + side.y * (u - 0.5) * w - droop, a.z + dir.z * along + side.z * (u - 0.5) * w)
      b.pos.push(p.x, p.y, p.z)
      b.nor.push(nrm.x * 0.4, 0.8, nrm.z * 0.4)
      b.uv.push(u, v)
      b.col.push(t.r * shade, t.g * shade, t.b * shade)
    }
    b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
}

const rngS = (seed: number) => {
  let s = (Math.abs(Math.round(seed)) * 9301 + 49297) % 233280
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280)
}

export function growTree(kind: TreeKind, seed: number, o: TreeOpts): TreeGeo {
  const r = rngS(seed * 7 + kind.length * 131)
  const bark = new Buf()
  const leaves = new Buf()
  const needles = new Buf()
  const det = THREE.MathUtils.clamp(o.detail, 0.2, 1)
  const far = !!o.far
  const rad = far ? 5 : det > 0.7 ? 7 : 6
  const leafPick = () => o.leaf[Math.floor(r() * o.leaf.length)]
  const cardsFor = (n: number) => Math.max(2, Math.round(n * det * (far ? 0.4 : 1)))
  const sizeFor = (s: number) => s * (far ? 1.45 : 1 + (1 - det) * 0.5)

  /** a branch: tube + children + a leaf clump at the end */
  const branch = (from: THREE.Vector3, dir: THREE.Vector3, len: number, r0: number, depth: number, maxDepth: number, k: { clumpR: number; cards: number; size: number; droop: number; kids: number; lo: number; hi: number; spread: number; leafy: boolean }) => {
    const pts = path(from, dir, len, depth === 0 ? 4 : 3, k.droop * (depth + 1) * 0.15, 0.5 + depth * 0.2, r)
    const r1 = Math.max(0.012, r0 * (depth >= maxDepth ? 0.35 : 0.55))
    tube(bark, pts, r0, r1, depth <= 1 ? 6 : 5, o.bark, 0.8 + depth * 0.06)
    const tip = pts[pts.length - 1]
    if (depth < maxDepth && !(far && depth >= 1)) {
      const kids = Math.max(1, Math.round(k.kids * (depth === 0 ? 1 : det)))
      for (let i = 0; i < kids; i++) {
        const t = 0.4 + 0.55 * ((i + r() * 0.5) / kids)
        const pi = Math.min(pts.length - 1, Math.floor(t * (pts.length - 1)) + 1)
        const base = pts[pi].clone()
        const azim = i * GOLDEN + r() * 0.8
        const polar = 0.55 + r() * 0.5 // radians off the parent's heading
        const pd = pts[pi].clone().sub(pts[pi - 1]).normalize()
        const side = pd.clone().cross(V(0, 1, 0))
        if (side.lengthSq() < 1e-4) side.set(1, 0, 0)
        side.normalize()
        const up2 = pd.clone().cross(side).normalize()
        const cd = pd.clone().multiplyScalar(Math.cos(polar)).addScaledVector(side, Math.sin(polar) * Math.cos(azim)).addScaledVector(up2, Math.sin(polar) * Math.sin(azim))
        cd.y += 0.12 + k.spread * 0.1
        branch(base, cd.normalize(), len * (0.55 + r() * 0.2), r1 * 1.15, depth + 1, maxDepth, k)
      }
    }
    if (k.leafy && (depth >= maxDepth || (far && depth >= 0))) {
      const tint = leafPick()
      const R = k.clumpR * (0.8 + r() * 0.4)
      clump(leaves, tip.clone().add(V(0, R * 0.12, 0)), V(R, R * 0.62, R), cardsFor(k.cards), sizeFor(k.size), tint, k.lo, k.hi, r, k.droop > 0.5 ? 0.5 : 0)
      // a second, lower clump along the branch gives the layered look
      if (!far && depth >= maxDepth - 1 && det > 0.5 && pts.length > 2) {
        const m = pts[Math.floor(pts.length * 0.6)]
        clump(leaves, m, V(R * 0.7, R * 0.45, R * 0.7), cardsFor(k.cards * 0.5), sizeFor(k.size), tint, k.lo, k.hi, r, k.droop > 0.5 ? 0.5 : 0)
      }
    }
  }

  const trunk = (h: number, r0: number, lean: number, sides = rad) => {
    const a = r() * Math.PI * 2
    const pts: THREE.Vector3[] = []
    const n = 5
    for (let i = 0; i <= n; i++) {
      const t = i / n
      pts.push(V(Math.cos(a) * lean * t * t, h * t, Math.sin(a) * lean * t * t).add(V(Math.sin(t * 5 + seed) * 0.04, 0, Math.cos(t * 4 + seed) * 0.04)))
    }
    tube(bark, pts, r0 * 1.35, r0 * 0.5, sides, o.bark, 0.78)
    // buttress roots: short flared tubes so the trunk meets the ground like a real tree, not a pole
    if (!far) {
      const roots = det > 0.6 ? 5 : 3
      for (let i = 0; i < roots; i++) {
        const ra = (i / roots) * Math.PI * 2 + r()
        const rp = path(V(Math.cos(ra) * r0 * 0.6, 0.35, Math.sin(ra) * r0 * 0.6), V(Math.cos(ra), -0.55, Math.sin(ra)), r0 * 2.2, 2, 0, 0.3, r)
        tube(bark, rp, r0 * 0.45, r0 * 0.12, 4, o.bark, 0.7)
      }
    }
    return pts
  }

  if (kind === 'oak' || kind === 'birch' || kind === 'willow' || kind === 'poplar') {
    const spec = {
      oak: { h: 2.3, r0: 0.2, lean: 0.35, limbs: 6, len: 2.5, kids: 3, depth: 2, clump: 1.1, cards: 15, size: 0.66, droop: 0.25, up: 0.5, lo: 2.4, hi: 6.6, spread: 1 },
      birch: { h: 3.4, r0: 0.11, lean: 0.5, limbs: 7, len: 1.7, kids: 3, depth: 2, clump: 0.75, cards: 11, size: 0.5, droop: 0.4, up: 0.85, lo: 3, hi: 7.4, spread: 0.6 },
      willow: { h: 2.6, r0: 0.22, lean: 0.4, limbs: 6, len: 2.8, kids: 3, depth: 2, clump: 0.9, cards: 14, size: 0.62, droop: 1.1, up: 0.55, lo: 0.8, hi: 6.2, spread: 1 },
      poplar: { h: 2.4, r0: 0.12, lean: 0.2, limbs: 9, len: 1.1, kids: 2, depth: 1, clump: 0.8, cards: 12, size: 0.5, droop: 0.05, up: 1.25, lo: 2.2, hi: 8.2, spread: 0.15 },
    }[kind]
    const tp = trunk(spec.h, spec.r0, spec.lean)
    const top = tp[tp.length - 1]
    const limbs = Math.max(far ? 4 : 3, Math.round(spec.limbs * (0.6 + 0.4 * det)))
    for (let i = 0; i < limbs; i++) {
      const t = 0.5 + 0.5 * (i / limbs)
      const pi = Math.min(tp.length - 1, Math.round(t * (tp.length - 1)))
      const a = i * GOLDEN + r() * 0.5
      const polar = kind === 'poplar' ? 0.3 + r() * 0.25 : 0.7 + r() * 0.5
      const dir = V(Math.cos(a) * Math.sin(polar), Math.cos(polar) * spec.up + 0.25, Math.sin(a) * Math.sin(polar))
      branch(tp[pi].clone(), dir.normalize(), spec.len * (0.8 + r() * 0.4), spec.r0 * 0.75, 0, spec.depth, { clumpR: spec.clump, cards: spec.cards, size: spec.size, droop: spec.droop, kids: spec.kids, lo: spec.lo, hi: spec.hi, spread: spec.spread, leafy: true })
    }
    // the leader keeps going up and carries a crown clump
    clump(leaves, top.clone().add(V(0, 0.9, 0)), V(spec.clump * 1.1, spec.clump * 0.8, spec.clump * 1.1), cardsFor(spec.cards * 1.4), sizeFor(spec.size), leafPick(), spec.lo, spec.hi, r, spec.droop > 0.5 ? 0.3 : 0)
  } else if (kind === 'pine') {
    const H = 6.2 + r() * 1.4
    const tp = trunk(H, 0.17, 0.2, 6)
    const whorls = Math.round((far ? 7 : 12) * (0.6 + 0.4 * det))
    for (let w = 0; w < whorls; w++) {
      const t = 0.2 + 0.78 * (w / whorls)
      const y = H * t
      const len = (2.2 - 1.9 * t) * (0.85 + r() * 0.3)
      const arms = far ? 4 : det > 0.6 ? 6 : 4
      for (let a = 0; a < arms; a++) {
        const ang = (a / arms) * Math.PI * 2 + w * GOLDEN
        const p0 = V(0, y, 0)
        const dir = V(Math.cos(ang), 0.1 - 0.34 * (1 - t), Math.sin(ang)).normalize()
        const pts = path(p0, dir, len, 2, 0.35 * (1 - t), 0.3, r)
        if (!far) tube(bark, pts, 0.045 * (1 - t * 0.6), 0.012, 4, o.bark, 0.75)
        const tint = o.leaf[(w + a) % o.leaf.length]
        const shade = 0.55 + 0.45 * t
        needleSpray(needles, pts[0], pts[pts.length - 1], len * (far ? 1.25 : 0.95), tint, shade, r, far ? 1 : det > 0.6 ? 2 : 1)
        if (!far && len > 0.9) needleSpray(needles, pts[0].clone().lerp(pts[pts.length - 1], 0.35).add(V(0, 0.05, 0)), pts[pts.length - 1].clone().add(V(0, -0.18, 0)), len * 0.7, tint, shade * 0.9, r, 1)
      }
    }
    needleSpray(needles, V(0, H * 0.96, 0), V(0, H + 1.1, 0), 0.5, o.leaf[0], 1, r, 2) // the leader's tuft
  } else if (kind === 'dead') {
    const tp = trunk(3.4 + r() * 1.2, 0.2, 0.5)
    const limbs = far ? 3 : 5 + Math.floor(r() * 3)
    for (let i = 0; i < limbs; i++) {
      const t = 0.35 + 0.6 * (i / limbs)
      const pi = Math.min(tp.length - 1, Math.round(t * (tp.length - 1)))
      const a = i * GOLDEN + r()
      branch(tp[pi].clone(), V(Math.cos(a) * 0.8, 0.35 + r() * 0.5, Math.sin(a) * 0.8).normalize(), 1.7 * (0.7 + r() * 0.6), 0.07, 0, far ? 0 : 2, { clumpR: 0, cards: 0, size: 0, droop: 0.5, kids: 2, lo: 0, hi: 1, spread: 1, leafy: false })
    }
  } else {
    // shrub: a fan of thin stems from the ground, each with leaf clumps down its length — no ball, a varied outline
    const stems = Math.max(5, Math.round((8 + Math.floor(r() * 5)) * (0.6 + 0.4 * det)))
    const wide = 0.7 + r() * 0.8 // how far the outline spreads
    const tall = 0.65 + r() * 0.7
    for (let i = 0; i < stems; i++) {
      const a = i * GOLDEN + r() * 0.4
      const polar = 0.25 + r() * 0.7 * wide
      const len = (0.55 + r() * 0.55) * tall
      const pts = path(V(Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05), V(Math.cos(a) * Math.sin(polar), Math.cos(polar) + 0.3, Math.sin(a) * Math.sin(polar)), len, 2, 0.12, 0.3, r)
      if (!far) tube(bark, pts, 0.014, 0.006, 3, o.bark, 0.75)
      const tip = pts[pts.length - 1]
      const tint = leafPick()
      clump(leaves, tip, V(0.3 * wide + 0.12, 0.26, 0.3 * wide + 0.12), cardsFor(9), sizeFor(0.38), tint, 0, 1.2 * tall, r, 0)
      if (!far) clump(leaves, pts[1], V(0.22, 0.18, 0.22), cardsFor(5), sizeFor(0.32), tint, 0, 1.2 * tall, r, 0)
    }
  }
  return { bark: bark.geo(), leaves: leaves.geo(), needles: needles.geo() }
}

/* ───────── textures (painted once on a canvas; shared by every tree) ───────── */

export function barkTexture(D: (THREE.Texture | THREE.Material | THREE.BufferGeometry)[]) {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#9a9288'
  g.fillRect(0, 0, 128, 256)
  const rr = rngS(31)
  // long vertical fissures with a lighter ridge beside each, broken by occasional horizontal cracks
  for (let i = 0; i < 46; i++) {
    const x = rr() * 128
    const w = 1 + rr() * 3
    const y0 = rr() * 256
    const len = 40 + rr() * 140
    g.fillStyle = `rgba(30,24,20,${0.25 + rr() * 0.35})`
    g.fillRect(x, y0, w, len)
    g.fillStyle = `rgba(210,200,185,${0.12 + rr() * 0.18})`
    g.fillRect(x + w, y0 + 4, 1.5, len * 0.8)
  }
  for (let i = 0; i < 18; i++) {
    g.fillStyle = `rgba(25,20,16,${0.18 + rr() * 0.25})`
    g.fillRect(rr() * 120, rr() * 256, 6 + rr() * 22, 1.5)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 4
  D.push(t)
  return t
}

/** a conifer needle spray: many fine strokes fanning from the base of the card, on transparent */
export function needleTexture(D: (THREE.Texture | THREE.Material | THREE.BufferGeometry)[]) {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const g = c.getContext('2d')!
  const rr = rngS(57)
  g.lineCap = 'round'
  for (let i = 0; i < 90; i++) {
    const a = (rr() - 0.5) * 1.5
    const x0 = 64 + (rr() - 0.5) * 20
    const len = 50 + rr() * 70
    const L = 60 + Math.round(rr() * 40)
    g.strokeStyle = `rgb(${L},${L + 40},${L})`
    g.lineWidth = 1.2 + rr() * 1.3
    g.beginPath()
    g.moveTo(x0, 126 - rr() * 14)
    g.lineTo(x0 + Math.sin(a) * len, 126 - Math.cos(a) * len)
    g.stroke()
  }
  g.strokeStyle = 'rgb(70,60,40)'
  g.lineWidth = 2.5
  g.beginPath()
  g.moveTo(64, 128)
  g.lineTo(64, 20)
  g.stroke()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  D.push(t)
  return t
}
