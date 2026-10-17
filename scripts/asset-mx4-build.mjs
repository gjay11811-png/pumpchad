// MX4 stage 3: write the optimised, rideable parts. node scripts/asset-mx4-build.mjs [--debug]
//   --debug: one colour-coded GLB at ~10% for looking.   default: public/chadverse/models/mx4/{body,fork,wheel_f,wheel_r}.glb + rig.json
import { Document, NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { weld, simplify, prune, quantize, dedup } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { classify, RIG, P as P_, N as N_ } from './asset-mx4-split.mjs'
await MeshoptSimplifier.ready
const debug = process.argv.includes('--debug')
const J = JSON.parse(readFileSync('tmp-viewer/mx4-world.json', 'utf8'))
const buf = readFileSync('tmp-viewer/mx4-world.bin')
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
const nv = J.nv, ni = J.ni
const P = P_, N = N_, I = new Uint32Array(ab, nv * 32, ni)
const part = classify()
const NAMES = ['body', 'wheel_r', 'wheel_f', 'fork']
const COLORS = [[0.25, 0.27, 0.3], [0.9, 0.2, 0.2], [0.2, 0.8, 0.3], [0.95, 0.75, 0.15]]
// tris per part in the GAME version: the rider cam sees the bike from 3-6 m, so wheels (spokes, knobs) and the fork keep more than the body's hidden insides
const LOD = process.argv.includes('--lod') // a low-detail set for bikes seen from afar (parked on the forecourt): about a fifth of the triangles
const TARGET = LOD ? { body: 6500, wheel_r: 3600, wheel_f: 3600, fork: 4200 } : { body: 30000, wheel_r: 16000, wheel_f: 16000, fork: 18000 }
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
mkdirSync('public/chadverse/models/mx4', { recursive: true })
const info = {}
const all = debug ? new Document() : null
const allScene = debug ? all.createScene() : null
for (let pi = 0; pi < 4; pi++) {
  const pname = NAMES[pi]
  const doc = debug ? all : new Document()
  const bufr = debug ? (globalThis.__b ??= doc.createBuffer()) : doc.createBuffer()
  const scene = debug ? allScene : doc.createScene()
  const mesh = doc.createMesh(pname)
  // split a wheel into tyre and rim by radius from the axle
  const ax0 = pi === 1 ? RIG.rear : RIG.front
  const groups = pi === 1 || pi === 2 ? [['tyre', (r) => r > ax0.r - 0.05], ['rim', (r) => r <= ax0.r - 0.05]] : [[pname, () => true]]
  for (const [gname, test] of groups) {
    const remap = new Map(), pos = [], nor = [], idx = []
    const ax = pi === 1 ? RIG.rear : RIG.front
    for (let t = 0; t < ni / 3; t++) {
      if (part[t] !== pi) continue
      if (pi === 1 || pi === 2) {
        const a = I[t * 3], b = I[t * 3 + 1], c = I[t * 3 + 2]
        const x = (P[a * 3] + P[b * 3] + P[c * 3]) / 3, y = (P[a * 3 + 1] + P[b * 3 + 1] + P[c * 3 + 1]) / 3
        if (!test(Math.hypot(x - ax.x, y - ax.y))) continue
      }
      for (let k = 0; k < 3; k++) {
        const v = I[t * 3 + k]
        let m = remap.get(v)
        if (m === undefined) { m = pos.length / 3; remap.set(v, m); pos.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); nor.push(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]) }
        idx.push(m)
      }
    }
    if (!idx.length) continue
    const mat = doc.createMaterial(debug ? pname : gname).setBaseColorFactor(debug ? [...COLORS[pi], 1] : gname === 'tyre' ? [0.05, 0.05, 0.05, 1] : gname === 'rim' ? [0.55, 0.57, 0.6, 1] : gname === 'fork' ? [0.75, 0.6, 0.2, 1] : [0.2, 0.22, 0.25, 1]).setMetallicFactor(gname === 'tyre' ? 0 : 0.6).setRoughnessFactor(gname === 'tyre' ? 0.95 : 0.45)
    const prim = doc.createPrimitive().setMaterial(mat)
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(bufr))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(nor)).setBuffer(bufr))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(idx)).setBuffer(bufr))
    mesh.addPrimitive(prim)
  }
  const node = doc.createNode(pname).setMesh(mesh)
  scene.addChild(node)
  if (!debug) {
    let before = 0
    for (const p of mesh.listPrimitives()) before += p.getIndices().getCount() / 3
    const ratio = Math.min(1, TARGET[pname] / before)
    await doc.transform(weld({ tolerance: 0.00002 }), simplify({ simplifier: MeshoptSimplifier, ratio, error: +(process.env.ERR || 0.1), lockBorder: process.env.LOCK === "1" }), prune(), dedup(), quantize({ quantizePosition: 14, quantizeNormal: 10 }))
    let after = 0
    for (const p of doc.getRoot().listMeshes()[0].listPrimitives()) after += p.getIndices().getCount() / 3
    info[pname] = { before, after }
    await io.write(`public/chadverse/models/mx4/${LOD ? 'lod_' : ''}${pname}.glb`, doc)
    console.log(pname, before, '->', after)
  }
}
if (debug) {
  await all.transform(weld({ tolerance: 0.00002 }), simplify({ simplifier: MeshoptSimplifier, ratio: 0.08, error: 0.02 }), prune())
  await io.write('tmp-viewer/mx4_parts_debug.glb', all)
  console.log('debug written')
} else if (!LOD) {
  const rig = { source: 'Talaria Sting R MX4 by nicknothom, CC-BY-4.0', units: 'm', front: '+x', up: '+y', groundY: 0, rear: { x: RIG.rear.x, y: RIG.rear.y }, frontAxle: { x: RIG.front.x, y: RIG.front.y }, wheelRear: RIG.rear.r, wheelFront: RIG.front.r, rake: RIG.rake, tris: info }
  writeFileSync('public/chadverse/models/mx4/rig.json', JSON.stringify(rig, null, 1))
}

// attachment points (rider seat / grips / pegs) measured from the aligned scan
if (!debug && !LOD) {
  const mean = (pts) => pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length, a[2] + p[2] / pts.length], [0, 0, 0])
  const sel = (pi, f) => { const out = []; for (let t = 0; t < ni / 3; t++) { if (part[t] !== pi) continue; for (let k = 0; k < 3; k++) { const v = I[t * 3 + k]; const p = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]; if (f(p)) out.push(p) } } return out }
  // the rider sits on the saddle about a third of the way back from the tank: x = -0.25, on the top surface there (the tail is higher, but nobody sits on it)
  const seatPts = sel(0, (p) => p[0] > -0.11 && p[0] < -0.01 && Math.abs(p[2]) < 0.07 && p[1] > 0.6)
  const maxY = seatPts.reduce((m, p) => Math.max(m, p[1]), -9)
  const seat = [-0.06, maxY - 0.01, 0]
  const gripPts = (side) => sel(3, (p) => p[1] > 0.93 && p[0] > 0.15 && p[2] * side > 0.22 && p[2] * side < 0.34)
  const gL = mean(gripPts(1)), gR = mean(gripPts(-1))
  const pegPts = (side) => sel(0, (p) => p[1] < 0.5 && p[0] > -0.5 && p[0] < 0.15 && p[2] * side > 0.17)
  const pL = pegPts(1), pR = pegPts(-1)
  const pm = mean(pL.concat(pR)) // the scan's pegs differ left to right (one is the brake pedal): use a symmetric pair
  const pegL = [-0.1, pm[1], 0.22], pegR = [-0.1, pm[1], -0.22]
  const rig = JSON.parse(readFileSync('public/chadverse/models/mx4/rig.json', 'utf8'))
  rig.seat = seat.map((x) => +x.toFixed(3)); rig.gripL = gL.map((x) => +x.toFixed(3)); rig.gripR = gR.map((x) => +x.toFixed(3)); rig.pegL = pegL.map((x) => +x.toFixed(3)); rig.pegR = pegR.map((x) => +x.toFixed(3))
  rig.counts = { seat: seatPts.length, gripL: gripPts(1).length, gripR: gripPts(-1).length, pegL: pL.length, pegR: pR.length }
  writeFileSync('public/chadverse/models/mx4/rig.json', JSON.stringify(rig, null, 1))
  console.log('seat', rig.seat, 'gripL', rig.gripL, 'gripR', rig.gripR, 'pegL', rig.pegL, 'pegR', rig.pegR, rig.counts)
}
