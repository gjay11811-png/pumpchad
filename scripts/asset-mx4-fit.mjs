// MX4 stage 2a: load the fused scan in WORLD space (metres, y up, ground at 0, front = +x) and fit the two wheel circles in the centre plane.
import { NodeIO, getBounds } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { writeFileSync } from 'node:fs'
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read('C:/Users/zafe5/Downloads/talaria_sting_r_mx4.glb')
const P = [], N = [], U = []
const v = [0, 0, 0]
for (const n of doc.getRoot().listNodes()) {
  const m = n.getMesh()
  if (!m) continue
  const W = n.getWorldMatrix()
  for (const p of m.listPrimitives()) {
    const pos = p.getAttribute('POSITION'), nor = p.getAttribute('NORMAL'), uv = p.getAttribute('TEXCOORD_0'), idx = p.getIndices()
    const base = P.length / 3
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, v)
      const x = W[0] * v[0] + W[4] * v[1] + W[8] * v[2] + W[12], y = W[1] * v[0] + W[5] * v[1] + W[9] * v[2] + W[13], z = W[2] * v[0] + W[6] * v[1] + W[10] * v[2] + W[14]
      P.push(x * 0.001, y * 0.001 + 0.29059, z * 0.001) // mm → m, ground (lowest tread) at y = 0
      nor.getElement(i, v)
      N.push(W[0] * v[0] + W[4] * v[1] + W[8] * v[2], W[1] * v[0] + W[5] * v[1] + W[9] * v[2], W[2] * v[0] + W[6] * v[1] + W[10] * v[2])
      uv.getElement(i, v)
      U.push(v[0], v[1])
    }
    const I = idx.getArray()
    for (let i = 0; i < I.length; i++) (globalThis.__I ??= []).push(I[i] + base)
  }
}
const I = globalThis.__I
let minY = 1e9, maxY = -1e9, minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9
for (let i = 0; i < P.length; i += 3) { minX = Math.min(minX, P[i]); maxX = Math.max(maxX, P[i]); minY = Math.min(minY, P[i + 1]); maxY = Math.max(maxY, P[i + 1]); minZ = Math.min(minZ, P[i + 2]); maxZ = Math.max(maxZ, P[i + 2]) }
console.log('world metres: x', minX.toFixed(3), maxX.toFixed(3), ' y', minY.toFixed(3), maxY.toFixed(3), ' z', minZ.toFixed(3), maxZ.toFixed(3), ' verts', P.length / 3, 'tris', I.length / 3)
// centre plane points
const zc = (minZ + maxZ) / 2
const pts = []
for (let i = 0; i < P.length; i += 3) if (Math.abs(P[i + 2] - zc) < 0.035) pts.push(P[i], P[i + 1])
console.log('centre-plane points', pts.length / 2, 'zc', zc.toFixed(3))
const fit = (x0, x1, y0, y1, rs) => {
  const sub = []
  for (let i = 0; i < pts.length; i += 2) if (pts[i] > x0 - 0.5 && pts[i] < x1 + 0.5 && pts[i + 1] < 0.9 && (i / 2) % 7 === 0) sub.push(pts[i], pts[i + 1])
  let best = { s: 0 }
  for (let cx = x0; cx <= x1; cx += 0.01) for (let cy = y0; cy <= y1; cy += 0.01) for (const R of rs) {
    let s = 0
    for (let i = 0; i < sub.length; i += 2) { const d = Math.hypot(sub[i] - cx, sub[i + 1] - cy); if (Math.abs(d - R) < 0.006) s++ }
    if (s > best.s) best = { s, cx, cy, R }
  }
  return best
}
const rs = []
for (let R = 0.28; R <= 0.42; R += 0.01) rs.push(R)
const rear = fit(-0.55, -0.2, 0.25, 0.42, rs)
const front = fit(0.5, 0.85, 0.25, 0.42, rs)
console.log('rear', rear, 'front', front)
writeFileSync('tmp-viewer/mx4-fit.json', JSON.stringify({ rear, front, bounds: { minX, maxX, minY, maxY, minZ, maxZ, zc } }))
// dump merged arrays for the next stage
writeFileSync('tmp-viewer/mx4-world.bin', Buffer.concat([Buffer.from(new Float32Array(P).buffer), Buffer.from(new Float32Array(N).buffer), Buffer.from(new Float32Array(U).buffer), Buffer.from(new Uint32Array(I).buffer)]))
writeFileSync('tmp-viewer/mx4-world.json', JSON.stringify({ nv: P.length / 3, ni: I.length }))
