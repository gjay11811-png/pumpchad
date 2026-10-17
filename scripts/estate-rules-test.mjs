// pure rules tests for the large-plot layout and the v1 → v2 migration (no browser).  node scripts/estate-rules-test.mjs
import * as E from '../src/game/estates.ts'
let fails = 0
const check = (ok, msg) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fails++ }
const { PLOTS, COLS, ROWS, CELL, HEIGHTS, plotSize, plotGate, PIECE, canPlace, migrateEstate, sanitizeEstate, exampleMansion, cottageDoor, MAX_PIECES } = E

/* layout */
check(PLOTS.length === 52, `52 plots (${PLOTS.length}): A–D + H01…H48`)
check(new Set(PLOTS.map((p) => p.id)).size === 52 && ['A', 'B', 'C', 'D', 'H01', 'H48'].every((id) => E.PLOT(id)), 'plot ids are unique and the original A–D are kept')
check(plotSize.w === 22 && plotSize.d === 26 && COLS === 11 && ROWS === 13, `plot is ${plotSize.w} × ${plotSize.d} m (${COLS} × ${ROWS} cells), was 12 × 10 m`)
let overlap = false, outside = false
for (const a of PLOTS) {
  if (a.x0 < HEIGHTS.rect.x0 + 1 || a.x0 + plotSize.w > HEIGHTS.rect.x1 || a.z0 < HEIGHTS.rect.z0 || a.z0 + plotSize.d > 78) outside = true
  for (const b of PLOTS) if (a !== b && a.x0 < b.x0 + plotSize.w && b.x0 < a.x0 + plotSize.w && a.z0 < b.z0 + plotSize.d && b.z0 < a.z0 + plotSize.d) overlap = true
}
check(!overlap, 'no two plots overlap')
check(!outside, 'every plot lies inside the district rectangle and north of the Valley Gate line (z ≤ 78)')
const lanesOk = PLOTS.every((p) => { const g = plotGate(p); const l = g.z < 0 ? HEIGHTS.laneA : HEIGHTS.laneB; return g.x > l.x0 && g.x < l.x1 && g.z > l.z0 && g.z < l.z1 })
check(lanesOk, 'every plot\'s gate stands on its lane')

/* the example large house fits and is valid on a street-south plot */
{
  const ex = exampleMansion()
  const placed = []
  let ok = true
  for (const p of ex) { if (canPlace(placed, p) !== null) { ok = false; console.log('   cannot place', p) } else placed.push(p) }
  check(ok, `the example mansion (manor 12 × 10 m + double garage 6 × 6 m + driveway + gates + gardens, ${ex.length} pieces) fits the plot`)
  check(ex.length <= MAX_PIECES, `…within the ${MAX_PIECES}-piece limit`)
  const cells = ex.reduce((a, p) => { const d = PIECE(p.k); return a + d.w * d.d }, 0)
  console.log(`   (${cells} of ${COLS * ROWS} cells used = ${Math.round((cells / (COLS * ROWS)) * 100)} %)`)
  const mansion = ex.find((p) => p.k === 'manor'), garage = ex.find((p) => p.k === 'garage')
  check(mansion && garage && garage.x === mansion.x + 6, 'manor and garage stand side by side with the garage beyond the manor')
  const e = sanitizeEstate({ plot: 'H14', pieces: ex, v: 2 })
  check(e.pieces.length === ex.length, 'sanitizeEstate keeps the whole example (v2 saves are not migrated)')
}

/* migration: a furnished old plot keeps its relationship to its gate */
const DIRV = { s: [0, 1], w: [-1, 0], n: [0, -1], e: [1, 0] }
const faceOf = (r) => [[0, 1], [-1, 0], [0, -1], [1, 0]][r % 4]
const rOfGate = { s: 0, w: 1, n: 2, e: 3 }
let migOk = true, count = 0
for (const p of PLOTS) {
  const og = p.id.length === 1 ? E.OLD_GATES[p.id] : (() => { const n = Number(p.id.slice(1)); return n <= 9 || (n >= 23 && n <= 35) ? 's' : 'n' })()
  // an old furnished plot: a cottage next to its gate (door facing the street), a path, hedges, a tree and a bench
  const cx = og === 'w' ? 0 : og === 'e' ? 4 : 2
  const cz = og === 'n' ? 0 : og === 's' ? 3 : 1
  const old = [{ k: 'cottage', x: cx, z: cz, r: rOfGate[og] }, { k: 'tree', x: og === 'w' || og === 'e' ? cx : 5, z: og === 'n' || og === 's' ? cz : 4, r: 0 }, { k: 'bench', x: 3, z: 2, r: 0 }, { k: 'flowers', x: 1, z: 4, r: 0 }]
  // keep them in the old bounds and non-overlapping
  const o2 = []
  for (const q of old) { const d = PIECE(q.k); const odd = q.r % 2 === 1; const w = odd ? d.d : d.w, h = odd ? d.w : d.d; if (q.x + w <= 6 && q.z + h <= 5 && !o2.some((a) => { const da = PIECE(a.k); const oa = a.r % 2 === 1; const aw = oa ? da.d : da.w, ah = oa ? da.w : da.d; return q.x < a.x + aw && a.x < q.x + w && q.z < a.z + ah && a.z < q.z + h })) o2.push(q) }
  const mig = migrateEstate(p.id, o2)
  count += o2.length
  const placed = []
  for (const m of mig) { if (canPlace(placed, m) !== null) { migOk = false; console.log('   bad', p.id, m); break } placed.push(m) }
  const c = mig.find((m) => m.k === 'cottage')
  const f = faceOf(c.r)
  const want = DIRV[p.gate]
  if (f[0] !== want[0] || f[1] !== want[1]) { migOk = false; console.log('   door faces', f, 'want', want, p.id) }
  // the cottage is against the gate edge
  const w = PIECE('cottage').w
  const near = p.gate === 'n' ? c.z === 0 : p.gate === 's' ? c.z + 2 === ROWS : p.gate === 'w' ? c.x === 0 : c.x + 2 === COLS
  if (!near) { migOk = false; console.log('   cottage not at the gate edge', p.id, c, p.gate) }
}
check(migOk, `all 52 plots: a furnished old plot (${count} pieces) migrates in bounds, no overlaps, its cottage door faces the new street and sits on the gate edge`)
const sv1 = sanitizeEstate({ plot: 'A', pieces: [{ k: 'cottage', x: 2, z: 1, r: 1 }, { k: 'tree', x: 5, z: 4, r: 0 }] })
check(sv1.v === 2 && sv1.pieces.length === 2, 'sanitizeEstate migrates a version-less (v1) save and stamps v2')
const door = cottageDoor(sv1)
check(!!door && Number.isFinite(door.x), 'the migrated cottage still has its front door (the Enter-your-cottage interaction)')
check(sanitizeEstate({ plot: 'NOPE', pieces: [{ k: 'cottage', x: 0, z: 0, r: 0 }] }).plot === null, 'an unknown plot id is dropped, not crashed on')
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
process.exit(fails ? 1 : 0)
