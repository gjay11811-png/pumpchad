// MX4 stage 2b: split the fused scan into rideable parts (rear wheel, front wheel, front end = fork + bars + front fender, body) around fitted axles.
// writes tmp-viewer/mx4_parts_debug.glb (colour-coded, full detail decimated for looking) when called with --debug, or the game parts via asset-mx4-build.mjs
import { readFileSync, writeFileSync } from 'node:fs'
const J = JSON.parse(readFileSync('tmp-viewer/mx4-world.json', 'utf8'))
const F = JSON.parse(readFileSync('tmp-viewer/mx4-fit.json', 'utf8'))
const buf = readFileSync('tmp-viewer/mx4-world.bin')
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
const nv = J.nv, ni = J.ni
J.zc0 = F.bounds.zc
export const P = new Float32Array(ab, 0, nv * 3); export const N = new Float32Array(ab, nv * 12, nv * 3); const U = new Float32Array(ab, nv * 24, nv * 2); const I = new Uint32Array(ab, nv * 32, ni)
// the scan sits slightly yawed (about 1.8°) and the rear tyre floats 2 cm: bake a yaw about the vertical and a pitch about the front contact so the bike is straight and both tyres touch the ground
const YAW = 0.032
const ZC0 = -0.012
{
  const c = Math.cos(YAW), sn = Math.sin(YAW)
  for (let i = 0; i < nv; i++) {
    const x = P[i * 3], z = P[i * 3 + 2] - J.zc0
    P[i * 3] = x * c + z * sn
    P[i * 3 + 2] = -x * sn + z * c - ZC0 - 0 + 0
    const nx = N[i * 3], nz = N[i * 3 + 2]
    N[i * 3] = nx * c + nz * sn
    N[i * 3 + 2] = -nx * sn + nz * c
  }
}
function kasa(c0, R0) {
  let cx = c0.cx, cy = c0.cy, R = R0
  for (let it = 0; it < 6; it++) {
    let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sz = 0, sxz = 0, syz = 0, n = 0
    for (let i = 0; i < nv; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2]
      if (Math.abs(z) > 0.03) continue
      const d = Math.hypot(x - cx, y - cy)
      if (d < R - 0.012 || d > R + 0.02) continue
      const q = x * x + y * y
      sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; sz += q; sxz += x * q; syz += y * q; n++
    }
    const A = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]], B = [sxz, syz, sz]
    const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
    const D = det(A), rep = (k) => A.map((r, i) => r.map((v, j) => (j === k ? B[i] : v)))
    cx = det(rep(0)) / D / 2; cy = det(rep(1)) / D / 2; R = Math.sqrt(det(rep(2)) / D + cx * cx + cy * cy)
  }
  return { x: cx, y: cy, r: R }
}
const rr = kasa(F.rear, 0.31), ff = kasa(F.front, 0.30)
// pitch about the front contact (x = front axle x, y = 0) so the rear tread bottom lands on y = 0
const PITCH = (() => { const bottom = rr.y - rr.r; return bottom / (ff.x - rr.x) })()
{
  const c = Math.cos(PITCH), sn = Math.sin(PITCH), x0 = ff.x
  const rot = (x, y) => [(x - x0) * c - y * sn + x0, (x - x0) * sn + y * c]
  for (let i = 0; i < nv; i++) { const [x, y] = rot(P[i * 3], P[i * 3 + 1]); P[i * 3] = x; P[i * 3 + 1] = y; const [a, b] = rot(N[i * 3] + x0, N[i * 3 + 1]); N[i * 3] = a - x0; N[i * 3 + 1] = b }
  const r2 = rot(rr.x, rr.y); rr.x = r2[0]; rr.y = r2[1]
}
export const RIG = { rear: rr, front: ff, zc: 0, rake: (24 * Math.PI) / 180 }
export function classify() {
  const part = new Uint8Array(ni / 3) // 0 body, 1 rear wheel, 2 front wheel, 3 front end
  const ux = -Math.sin(RIG.rake), uy = Math.cos(RIG.rake) // up the steering axis (leans back)
  const nx = Math.cos(RIG.rake), ny = Math.sin(RIG.rake) // forward normal
  for (let t = 0; t < ni / 3; t++) {
    const a = I[t * 3], b = I[t * 3 + 1], c = I[t * 3 + 2]
    const x = (P[a * 3] + P[b * 3] + P[c * 3]) / 3, y = (P[a * 3 + 1] + P[b * 3 + 1] + P[c * 3 + 1]) / 3, z = (P[a * 3 + 2] + P[b * 3 + 2] + P[c * 3 + 2]) / 3 - RIG.zc
    const dr = Math.hypot(x - RIG.rear.x, y - RIG.rear.y), df = Math.hypot(x - RIG.front.x, y - RIG.front.y)
    if (dr < RIG.rear.r + 0.012 && Math.abs(z) < 0.07) { part[t] = 1; continue }
    if (df < RIG.front.r + 0.012 && Math.abs(z) < 0.07) { part[t] = 2; continue }
    const dx = x - RIG.front.x, dy = y - RIG.front.y
    const s = dx * nx + dy * ny // ahead of the steering axis through the front axle
    const h = dx * ux + dy * uy // up the axis
    if ((s > -0.045 && h > -0.06 && y < 0.88 && x > 0.3) || (y >= 0.92 && x > 0.2 && s > -0.14)) part[t] = 3
  }
  return part
}
if (process.argv.includes('--stats')) {
  const part = classify()
  const cnt = [0, 0, 0, 0]
  part.forEach((p) => cnt[p]++)
  console.log('triangles per part [body, rear wheel, front wheel, front end]', cnt)
}
