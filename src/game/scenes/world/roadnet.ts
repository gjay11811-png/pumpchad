/**
 * ROAD NETWORK maths (no three.js): a polyline road with a height per point, and the queries every road in the world
 * needs — nearest point, walkable ground height, clamping, and the terrain it carves (a road-driven hillside: level across
 * the road bed, an even slope between two legs, easing into the surrounding base ground). The Castle Road (climbing) and the
 * Valley Road (descending) are both RoadSys instances.
 */
export type RoadPt = { x: number; z: number; y: number; s: number }
export const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export class RoadSys {
  readonly pts: RoadPt[]
  readonly len: number
  constructor(
    raw: [number, number][],
    readonly y0: number,
    readonly y1: number,
    readonly width: number,
    /** metres at the start (and end) with no climb, so the road leaves its gate level */
    flat: { start?: number; end?: number } = {},
  ) {
    let total = 0
    const pts = raw.map(([x, z], i) => {
      if (i) total += Math.hypot(x - raw[i - 1][0], z - raw[i - 1][1])
      return { x, z, y: 0, s: total }
    })
    const a = flat.start ?? 0
    const b = flat.end ?? 0
    for (const p of pts) {
      const u = Math.min(1, Math.max(0, (p.s - a) / Math.max(1e-6, total - a - b)))
      p.y = y0 + (y1 - y0) * u
    }
    this.pts = pts
    this.len = total
  }

  /** a point on the centreline at arc length s, with its unit tangent */
  pointAt(s: number) {
    const c = Math.min(Math.max(s, 0), this.len)
    let i = 1
    while (i < this.pts.length - 1 && this.pts[i].s < c) i++
    const a = this.pts[i - 1]
    const b = this.pts[i]
    const t = b.s > a.s ? (c - a.s) / (b.s - a.s) : 0
    const L = Math.hypot(b.x - a.x, b.z - a.z) || 1
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, y: a.y + (b.y - a.y) * t, tx: (b.x - a.x) / L, tz: (b.z - a.z) / L, s: c }
  }

  /** nearest point on the centreline: distance, interpolated height, arc length, the point itself */
  nearest(x: number, z: number) {
    let best = { d: Infinity, y: 0, s: 0, px: 0, pz: 0 }
    for (let i = 1; i < this.pts.length; i++) {
      const a = this.pts[i - 1]
      const b = this.pts[i]
      const vx = b.x - a.x
      const vz = b.z - a.z
      const L2 = vx * vx + vz * vz
      const t = L2 > 0 ? Math.min(1, Math.max(0, ((x - a.x) * vx + (z - a.z) * vz) / L2)) : 0
      const px = a.x + vx * t
      const pz = a.z + vz * t
      const d = Math.hypot(x - px, z - pz)
      if (d < best.d) best = { d, y: a.y + (b.y - a.y) * t, s: a.s + (b.s - a.s) * t, px, pz }
    }
    return best
  }

  /** is (x, z) on the road (margin m shrinks it)? */
  on(x: number, z: number, m = 0) {
    return this.nearest(x, z).d < this.width / 2 - m
  }

  /** the road's surface height at (x, z), or null off it */
  ground(x: number, z: number): number | null {
    const n = this.nearest(x, z)
    return n.d < this.width / 2 + 0.4 ? n.y : null
  }

  clamp(p: { x: number; z: number }, m: number) {
    const n = this.nearest(p.x, p.z)
    const k = (this.width / 2 - m) / Math.max(1e-6, n.d)
    if (k < 1) {
      p.x = n.px + (p.x - n.px) * k
      p.z = n.pz + (p.z - n.pz) * k
    }
  }

  /**
   * The road-driven hillside: at the road the ground is the road's level; between two separate legs it slopes evenly from one
   * level to the other; beyond the outermost leg it eases to `base` over a distance proportional to the height difference
   * (≈ 40° banks), with a little lumpiness. Returns the terrain height.
   */
  terrain(x: number, z: number, base: number, lumpy = true) {
    let b1 = { d: Infinity, y: 0, s: 0 }
    for (let i = 1; i < this.pts.length; i++) {
      const a = this.pts[i - 1]
      const b = this.pts[i]
      const vx = b.x - a.x
      const vz = b.z - a.z
      const L2 = vx * vx + vz * vz
      const t = L2 > 0 ? Math.min(1, Math.max(0, ((x - a.x) * vx + (z - a.z) * vz) / L2)) : 0
      const d = Math.hypot(x - (a.x + vx * t), z - (a.z + vz * t))
      if (d < b1.d) b1 = { d, y: a.y + (b.y - a.y) * t, s: a.s + (b.s - a.s) * t }
    }
    const bed = this.width / 2 + 0.7
    if (b1.d < bed) return b1.y - 0.05
    let b2 = { d: Infinity, y: 0 }
    for (let i = 1; i < this.pts.length; i++) {
      const a = this.pts[i - 1]
      const b = this.pts[i]
      if (Math.abs((a.s + b.s) / 2 - b1.s) < 24) continue // the same leg (or its hairpin)
      const vx = b.x - a.x
      const vz = b.z - a.z
      const L2 = vx * vx + vz * vz
      const t = L2 > 0 ? Math.min(1, Math.max(0, ((x - a.x) * vx + (z - a.z) * vz) / L2)) : 0
      const d = Math.hypot(x - (a.x + vx * t), z - (a.z + vz * t))
      if (d < b2.d) b2 = { d, y: a.y + (b.y - a.y) * t }
    }
    let y = b1.y
    if (b2.d < 24 && b2.d < b1.d * 3) y = b1.y + (b2.y - b1.y) * (b1.d / (b1.d + b2.d))
    const lump = lumpy ? Math.sin(x * 0.21 + z * 0.13) * 3 + Math.sin(x * 0.07 - z * 0.19) * 4 : 0
    const dd = Math.max(0, b1.d + lump * Math.min(1, b1.d / 12))
    const reach = 8 + Math.abs(y - base) * 0.95
    const w = 1 - smooth(reach * 0.4, reach + 14, dd)
    return base + (y - base) * w
  }
}
