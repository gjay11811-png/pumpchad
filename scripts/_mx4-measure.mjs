import { readFileSync } from 'node:fs'
const J = JSON.parse(readFileSync('tmp-viewer/mx4-world.json', 'utf8')), F = JSON.parse(readFileSync('tmp-viewer/mx4-fit.json', 'utf8'))
const buf = readFileSync('tmp-viewer/mx4-world.bin'); const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
const nv = J.nv; const P = new Float32Array(ab, 0, nv * 3)
const zc = F.bounds.zc
function refine(c0, R0) {
  let cx = c0.cx, cy = c0.cy, R = R0
  for (let it = 0; it < 6; it++) {
    const pts = []
    for (let i = 0; i < nv; i++) { const x = P[i*3], y = P[i*3+1] + 0.0, z = P[i*3+2] - zc; if (Math.abs(z) > 0.03) continue; const d = Math.hypot(x - cx, y - cy); if (Math.abs(d - R) < 0.02 && d > R - 0.012 ) pts.push([x, y]) }
    // Kasa fit
    let sx=0,sy=0,sxx=0,syy=0,sxy=0,sz=0,sxz=0,syz=0; const n=pts.length
    for (const [x,y] of pts){ const z=x*x+y*y; sx+=x;sy+=y;sxx+=x*x;syy+=y*y;sxy+=x*y;sz+=z;sxz+=x*z;syz+=y*z }
    // solve [sxx sxy sx; sxy syy sy; sx sy n][a b c]=[sxz syz sz]
    const A=[[sxx,sxy,sx],[sxy,syy,sy],[sx,sy,n]], B=[sxz,syz,sz]
    const det=(m)=>m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0])
    const D=det(A); const rep=(k)=>A.map((r,i)=>r.map((v,j)=>j===k?B[i]:v))
    const a=det(rep(0))/D,b=det(rep(1))/D,c=det(rep(2))/D
    cx=a/2; cy=b/2; R=Math.sqrt(c+cx*cx+cy*cy)
  }
  return { cx, cy, R }
}
const rear = refine(F.rear, 0.32), front = refine(F.front, 0.32)
console.log('rear', rear, 'front', front)
// tyre width + hub extents per wheel
for (const [name, w] of [['rear', rear], ['front', front]]) {
  const bands = { tyre: [w.R - 0.03, w.R + 0.02], rim: [w.R - 0.09, w.R - 0.05], spokes: [0.06, 0.2], hub: [0, 0.06] }
  for (const [bn, [lo, hi]] of Object.entries(bands)) {
    let mn = 9, mx = -9, n = 0
    const zs = []
    for (let i = 0; i < nv; i++) { const x = P[i*3], y = P[i*3+1], z = P[i*3+2] - zc; const d = Math.hypot(x - w.cx, y - w.cy); if (d >= lo && d <= hi && Math.abs(z) < 0.2) { zs.push(z) } }
    zs.sort((a,b)=>a-b)
    console.log(name, bn, 'n', zs.length, 'z p2', zs[Math.floor(zs.length*0.02)]?.toFixed(3), 'p50', zs[Math.floor(zs.length*0.5)]?.toFixed(3), 'p98', zs[Math.floor(zs.length*0.98)]?.toFixed(3))
  }
}
// fork axis: PCA on stanchion points
const pts = []
for (let i = 0; i < nv; i++) { const x = P[i*3], y = P[i*3+1], z = Math.abs(P[i*3+2] - zc); if (z > 0.07 && z < 0.17 && x > 0.35 && x < 0.78 && y > 0.45 && y < 0.95) pts.push([x, y]) }
const mx = pts.reduce((a,p)=>a+p[0],0)/pts.length, my = pts.reduce((a,p)=>a+p[1],0)/pts.length
let cxx=0,cyy=0,cxy=0; for (const [x,y] of pts){cxx+=(x-mx)**2;cyy+=(y-my)**2;cxy+=(x-mx)*(y-my)}
const ang = 0.5*Math.atan2(2*cxy, cxx-cyy) // principal axis angle from +x
console.log('fork pts', pts.length, 'principal axis angle from +x (deg)', (ang*180/Math.PI).toFixed(1), '=> rake from vertical', (90 - Math.abs(ang*180/Math.PI)).toFixed(1), 'mean', mx.toFixed(3), my.toFixed(3))
// tyre ring z extents (tread only) and the frame's centre line (seat / tank region)
for (const [name, w] of [['rear', rear], ['front', front]]) {
  const zs = []
  for (let i = 0; i < nv; i++) { const x = P[i*3], y = P[i*3+1], z = P[i*3+2] - zc; const d = Math.hypot(x - w.cx, y - w.cy); if (d > w.R - 0.012 && d < w.R + 0.004 && Math.abs(z) < 0.15 && y < w.cy + 0.1) zs.push(z) }
  zs.sort((a,b)=>a-b)
  const lo = zs[Math.floor(zs.length*0.03)], hi = zs[Math.floor(zs.length*0.97)]
  console.log(name, 'tread z', lo.toFixed(3), hi.toFixed(3), 'centre', ((lo+hi)/2).toFixed(3), 'width', (hi-lo).toFixed(3))
}
for (const [x0,x1] of [[-0.7,-0.4],[-0.4,-0.1],[-0.1,0.2]]) {
  const zs = []
  for (let i = 0; i < nv; i++) { const x = P[i*3], y = P[i*3+1], z = P[i*3+2] - zc; if (x > x0 && x < x1 && y > 0.6 && y < 0.95 && Math.abs(z) < 0.25) zs.push(z) }
  zs.sort((a,b)=>a-b)
  console.log('seat/tank x', x0, x1, 'z p3', zs[Math.floor(zs.length*0.03)]?.toFixed(3), 'p97', zs[Math.floor(zs.length*0.97)]?.toFixed(3), 'mid', ((zs[Math.floor(zs.length*0.03)]+zs[Math.floor(zs.length*0.97)])/2).toFixed(3))
}
