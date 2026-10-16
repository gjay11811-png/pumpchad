import * as THREE from 'three'
import { box, cyl, floor, rng, slab, wall, type Ctx } from './kit'

/**
 * THE FLAGSHIP PUMPCHAD GYM — a three-storey contemporary fitness destination on the avenue's west side.
 *
 *   • an upper volume that cantilevers 2.5 m over a recessed, column-lined ground floor (timber soffit with downlights, like the reference LUXGYM);
 *   • floor-to-ceiling glazing on a dark-framed mullion grid, so the three lit floors read from the street;
 *   • a feature core over the entrance: a gold-lit perforated screen with the PumpChad mark and wordmark (after the lattice-fronted reference);
 *   • dark cladding, timber end wings, a deep roof fascia and a rooftop plant screen;
 *   • a recessed double-glass entrance with a flush (step-free) threshold, a forecourt of pavers with planters, trees, benches and lighting;
 *   • the interior visible through the glass: treadmills, cross-trainers, squat racks, benches, dumbbell wall, reception desk, strip lighting.
 *
 * Frame: the facade faces +x (the avenue). X1 is the glazing line of the ground floor; the upper floors project to XU.
 */
export const GYM = { x0: -46, x1: -22, z0: -48, z1: -10, xu: -19.5 }
const FL = [0.2, 4.6, 8.8] // floor levels
const ROOF = 13.2

export function buildGym(c: Ctx) {
  const { M } = c
  const { x0, x1, z0, z1, xu } = GYM
  const zc = (z0 + z1) / 2 // the entrance sits on the building's centre line (z = -29)

  /* ── structure: ground slab, floor slabs (the upper two cantilever to xu), roof ── */
  slab(c, M.concrete, x0, x1 + 0.4, 0.0, 0.2, z0, z1, 3)
  for (const y of [FL[1], FL[2]]) slab(c, M.concrete, x0, xu, y - 0.25, y, z0, z1, 3)
  slab(c, M.cladding, x0 - 0.3, xu + 0.9, ROOF - 0.4, ROOF + 0.35, z0 - 0.3, z1 + 0.3, 3) // roof slab with a deep fascia and 0.9 m overhang
  slab(c, M.steel, x0 - 0.3, xu + 0.9, ROOF - 0.46, ROOF - 0.4, z0 - 0.3, z1 + 0.3, 3)
  // end and rear walls (dark cladding), full height
  slab(c, M.cladding, x0 - 0.3, x0, 0, ROOF - 0.4, z0, z1, 3) // rear
  slab(c, M.cladding, x0, xu, 0, ROOF - 0.4, z0 - 0.3, z0, 3) // north end
  slab(c, M.cladding, x0, xu, 0, ROOF - 0.4, z1, z1 + 0.3, 3) // south end
  c.block(x0 - 0.3, xu, z0 - 0.3, z1 + 0.3) // the whole volume is solid (the interior is for looking at, for now)

  /* ── the recessed ground floor: columns on the facade line, glazing set back 1.6 m, a deeper entrance recess ── */
  const gx = x1 - 1.6 // ground glazing line
  for (let z = z0 + 2; z <= z1 - 2 + 0.01; z += 4) {
    if (Math.abs(z - zc) < 4.1) continue // the entrance bay stays open
    cyl(c, M.steel, x1 + 0.4, 0.2, z, 0.24, 0.24, FL[1] - 0.45, 18)
    cyl(c, M.gold, x1 + 0.4, 0.2, z, 0.255, 0.255, 0.06, 18)
    cyl(c, M.gold, x1 + 0.4, FL[1] - 0.5, z, 0.255, 0.255, 0.05, 18)
  }
  for (const [za, zb] of [[z0, zc - 6], [zc + 6, z1]] as const) {
    // storefront glazing, a bronze-dark frame grid, a low plinth of dark stone
    wall(c, M.glass, 'e', za + 0.2, zb - 0.2, 0.2, FL[1] - 0.45, gx)
    slab(c, M.steel, gx - 0.04, gx + 0.04, 0.2, 0.5, za + 0.2, zb - 0.2, 1)
    for (let z = za + 0.2; z <= zb - 0.2 + 0.01; z += 1.8) slab(c, M.steel, gx - 0.05, gx + 0.1, 0.2, FL[1] - 0.45, z - 0.04, z + 0.04, 1)
    slab(c, M.steel, gx - 0.05, gx + 0.1, 2.5, 2.58, za + 0.2, zb - 0.2, 1)
    slab(c, M.steel, gx - 0.05, gx + 0.1, FL[1] - 0.55, FL[1] - 0.45, za + 0.2, zb - 0.2, 1)
  }
  // the entrance: a 12 m bay, glazing pushed back a further 2.2 m, double glass doors, a lit reveal, timber-lined recess
  const ex = gx - 2.2
  wall(c, M.glass, 'e', zc - 6, zc + 6, 0.2, FL[1] - 0.45, ex)
  slab(c, M.steel, ex - 0.05, ex + 0.1, 0.2, FL[1] - 0.45, zc - 0.05, zc + 0.05, 1)
  for (const dz of [-3, -1.5, 1.5, 3]) slab(c, M.steel, ex - 0.05, ex + 0.1, 0.2, FL[1] - 0.45, zc + dz - 0.04, zc + dz + 0.04, 1)
  slab(c, M.steel, ex - 0.05, ex + 0.1, 2.75, 2.85, zc - 6, zc + 6, 1) // door head transom
  for (const dz of [-0.55, 0.55]) c.B.put(new THREE.BoxGeometry(0.04, 1.6, 0.05), M.steelLight, ex + 0.12, 1.2, zc + dz * 2.2 * 0.5 + (dz < 0 ? 1.0 : -1.0) * 0.5) // pull handles
  wall(c, M.timber, 'e', zc - 6, zc - 4.5, 0.2, FL[1] - 0.45, ex + 0.05, 1.2)
  wall(c, M.timber, 'e', zc + 4.5, zc + 6, 0.2, FL[1] - 0.45, ex + 0.05, 1.2)
  slab(c, M.timber, ex, x1 + 0.4, FL[1] - 0.52, FL[1] - 0.45, zc - 6, zc + 6, 1.2) // the entrance soffit
  slab(c, M.timber, ex, ex + 2.2, 0.2, 0.22, zc - 6, zc + 6, 1.2, false)
  for (const sz of [-1, 1]) slab(c, M.timber, ex, x1 + 0.4, 0.2, FL[1] - 0.45, zc + sz * 6 - (sz > 0 ? 0 : 0.12), zc + sz * 6 + (sz > 0 ? 0.12 : 0), 1.2) // recess side walls
  // downlights in the soffits (the cantilever and the entrance)
  for (let z = z0 + 3; z < z1 - 2; z += 3.2) for (const x of [x1 + 0.8, x1 + 1.8]) c.B.put(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 10), M.warmLight, x, FL[1] - 0.47, z, 0, 1, 1, 1, { cast: false })
  // timber soffit under the cantilever (outside the entrance), with a gold LED edge
  slab(c, M.timber, x1 + 0.4, xu, FL[1] - 0.47, FL[1] - 0.25, z0, z1, 1.2)
  slab(c, M.ledGold, xu - 0.02, xu + 0.02, FL[1] - 0.3, FL[1] - 0.26, z0, z1, 1)

  /* ── the upper volume: a curtain wall on a 1.8 m mullion grid, two storeys, with a gold feature core over the entrance ── */
  const core = 6.6 // half-width of the feature core (z)
  for (const [za, zb] of [[z0 + 3.2, zc - core], [zc + core, z1 - 3.2]] as const) {
    wall(c, M.glass, 'e', za, zb, FL[1], ROOF - 0.46, xu)
    for (let z = za; z <= zb + 0.01; z += 1.8) slab(c, M.steel, xu - 0.04, xu + 0.12, FL[1], ROOF - 0.46, z - 0.045, z + 0.045, 1)
    for (const y of [FL[1], FL[1] + 1.0, FL[2] - 0.1, FL[2] + 1.0, ROOF - 0.5]) slab(c, M.steel, xu - 0.04, xu + 0.12, y, y + 0.1, za, zb, 1)
    slab(c, M.steel, xu - 0.06, xu + 0.16, FL[2] - 0.35, FL[2], za, zb, 1) // the floor-edge spandrel band
  }
  // timber end wings (vertical boards) at both ends of the upper volume
  for (const [za, zb] of [[z0, z0 + 3.2], [z1 - 3.2, z1]] as const) {
    slab(c, M.timber, xu - 0.1, xu + 0.12, FL[1] - 0.25, ROOF - 0.46, za, zb, 1.1)
    slab(c, M.steel, xu + 0.12, xu + 0.16, FL[1] - 0.25, ROOF - 0.46, za, za + 0.05, 1)
  }
  // the feature core: dark frame, a gold-lit perforated lattice screen, the mark and the wordmark
  slab(c, M.cladding, xu - 0.05, xu + 0.5, FL[1], ROOF - 0.46, zc - core - 0.5, zc - core, 2)
  slab(c, M.cladding, xu - 0.05, xu + 0.5, FL[1], ROOF - 0.46, zc + core, zc + core + 0.5, 2)
  const latG = new THREE.PlaneGeometry(core * 2, ROOF - 0.46 - FL[1])
  const lu = latG.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < lu.count; i++) lu.setXY(i, (lu.getX(i) * core * 2) / 2.6, (lu.getY(i) * (ROOF - 0.46 - FL[1])) / 2.6)
  c.B.put(latG, M.lattice, xu + 0.2, (FL[1] + ROOF - 0.46) / 2, zc, Math.PI / 2, 1, 1, 1, { cast: false })
  // a dark plate behind the mark, then the mark and the wordmark (gold, lit)
  c.B.put(new THREE.PlaneGeometry(5.4, 5.4), M.cladding, xu + 0.215, 10.3, zc, Math.PI / 2, 1, 1, 1, { cast: false })
  c.B.put(new THREE.PlaneGeometry(4.2, 4.2), M.logo, xu + 0.23, 10.4, zc, Math.PI / 2, 1, 1, 1, { cast: false })
  const wm = wordmark(c)
  c.B.put(new THREE.PlaneGeometry(11.6, 1.9), M.cladding, xu + 0.215, 7.35, zc, Math.PI / 2, 1, 1, 1, { cast: false }) // a dark plate so the lettering reads against the lit lattice
  c.B.put(new THREE.PlaneGeometry(10.4, 1.3), wm, xu + 0.235, 7.35, zc, Math.PI / 2, 1, 1, 1, { cast: false })

  /* ── roof: a plant screen of louvres, a lift overrun, a parapet sign ── */
  slab(c, M.cladding, x0 + 4, x0 + 16, ROOF + 0.35, ROOF + 2.2, z0 + 6, z1 - 12, 3)
  slab(c, M.steel, x0 + 16, x0 + 18, ROOF + 0.35, ROOF + 1.4, z0 + 8, z0 + 14, 2)
  box(c, M.steelLight, x0 + 8, ROOF + 2.2, zc + 4, 3.2, 0.8, 2.2)

  /* ── the interior, seen through the glass ── */
  interior(c)

  /* ── forecourt: paver apron, a gold inlay line to the door, planters, trees, benches, bollards, uplights ── */
  floor(c, M.plaza, x1 + 0.4, -13.7, z0 - 2, z1 + 2, 0.16, 2.2)
  floor(c, M.ledGold, x1 + 0.4, -13.7, zc - 0.05, zc + 0.05, 0.168, 1) // a thin gold inlay running to the door
  for (const dz of [-6, 6]) floor(c, M.ledGold, x1 + 0.4, -13.7, zc + dz - 0.03, zc + dz + 0.03, 0.168, 1)
  const rnd = rng(77)
  const planter = (px: number, pz: number, w: number, d: number) => {
    slab(c, M.concrete, px - w / 2, px + w / 2, 0.16, 0.7, pz - d / 2, pz + d / 2, 2)
    floor(c, M.soil, px - w / 2 + 0.1, px + w / 2 - 0.1, pz - d / 2 + 0.1, pz + d / 2 - 0.1, 0.71, 1)
    // dense low planting: ornamental shrubs (built by the foliage generator, see `plantBushes`)
    for (let i = 0; i < Math.round((w * d) / 1.4); i++) c.bushes.push({ x: px + (rnd() - 0.5) * (w - 0.5), y: 0.7, z: pz + (rnd() - 0.5) * (d - 0.5), s: 0.55 + rnd() * 0.5 })
    c.block(px - w / 2, px + w / 2, pz - d / 2, pz + d / 2)
  }
  for (const pz of [z0 + 4, z0 + 11, z1 - 11, z1 - 4]) planter(-16.2, pz, 1.8, 5.2)
  planter(-23.2, zc - 9.5, 1.4, 4.2)
  planter(-23.2, zc + 9.5, 1.4, 4.2)
  for (const pz of [z0 + 7.5, z1 - 7.5, zc - 15, zc + 15]) c.trees.push({ kind: 'jacaranda', x: -17.4, z: pz, s: 0.38 + rnd() * 0.06, yaw: rnd() * 6 })
  // low in-ground uplights washing the columns and the soffit
  for (let z = z0 + 2; z <= z1 - 2 + 0.01; z += 4) if (Math.abs(z - zc) >= 4.1) c.B.put(new THREE.BoxGeometry(0.3, 0.04, 0.3), M.warmLight, x1 + 0.4, 0.17, z, 0, 1, 1, 1, { cast: false })
  // benches facing the avenue
  for (const pz of [zc - 17, zc + 17]) {
    for (let k = 0; k < 4; k++) c.B.put(new THREE.BoxGeometry(0.09, 0.04, 1.8), M.timber, -14.9 + k * 0.1, 0.46, pz)
    for (const dz of [-0.75, 0.75]) c.B.put(new THREE.BoxGeometry(0.5, 0.3, 0.06), M.steel, -14.75, 0.31, pz + dz)
  }
}

/** the wordmark: PUMPCHAD in gold capitals with a hairline rule, lit (basic material, so it glows by day too) */
function wordmark(c: Ctx) {
  const cv = document.createElement('canvas')
  cv.width = 1024
  cv.height = 128
  const g = cv.getContext('2d')!
  g.clearRect(0, 0, 1024, 128)
  const grad = g.createLinearGradient(0, 0, 0, 128)
  grad.addColorStop(0, '#fff0b8')
  grad.addColorStop(0.55, '#e8b04a')
  grad.addColorStop(1, '#b0801f')
  g.fillStyle = grad
  g.font = '800 104px "Arial Black", Impact, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const letters = 'PUMPCHAD'
  let x = 512 - ((letters.length - 1) * 118) / 2
  for (const ch of letters) {
    g.fillText(ch, x, 66)
    x += 118
  }
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false, depthWrite: false })
  c.D.push(t, m)
  return m
}

/** gym equipment and fit-out on the three floors, built so the street sees it through the glass */
function interior(c: Ctx) {
  const { M } = c
  const { x0, x1, z0, z1, xu } = GYM
  const rnd = rng(5)
  // floors and ceilings
  for (const [i, y] of FL.entries()) {
    floor(c, M.floorInt, x0 + 0.2, i === 0 ? x1 - 1.6 : xu - 0.1, z0 + 0.2, z1 - 0.2, y + 0.005, 3)
    // a gold-edged rubber training zone on each floor
    floor(c, M.rubber, x0 + 3, x0 + 14, z0 + 3, z1 - 3, y + 0.012, 2)
  }
  // a back wall in a warm pale finish with a big gold graphic, so the room has a far plane to read against
  for (const y of FL) wall(c, M.wallInt, 'e', z0 + 0.2, z1 - 0.2, y, y + 3.7, x0 + 0.4, 3)
  // ceiling lights: strips down each floor, plus the underside of the slab above
  for (const y of FL) {
    slab(c, M.wallInt, x0 + 0.2, y === FL[0] ? x1 - 1.6 : xu - 0.1, y + 3.78, y + 3.84, z0 + 0.2, z1 - 0.2, 3, false)
    for (let k = 0; k < 6; k++) {
      const xx = x0 + 3 + k * ((y === FL[0] ? x1 - 3 - x0 : xu - 3 - x0) / 5.2)
      c.B.put(new THREE.BoxGeometry(0.16, 0.04, z1 - z0 - 3), M.ceilLight, xx, y + 3.75, (z0 + z1) / 2, 0, 1, 1, 1, { cast: false })
    }
  }
  // supporting columns inside
  for (const y of FL) for (const x of [x0 + 12, x0 + 20]) for (let z = z0 + 5; z < z1; z += 8) cyl(c, M.concrete, x, y, z, 0.28, 0.28, 3.75, 12)

  const treadmill = (x: number, y: number, z: number, faceE: boolean) => {
    const s = faceE ? 1 : -1
    c.B.put(new THREE.BoxGeometry(1.9, 0.16, 0.8), M.machine, x, y + 0.14, z)
    c.B.put(new THREE.BoxGeometry(1.7, 0.03, 0.62), M.rubber, x - s * 0.02, y + 0.23, z)
    c.B.put(new THREE.BoxGeometry(0.1, 1.15, 0.7), M.machine, x + s * 0.8, y + 0.7, z)
    c.B.put(new THREE.BoxGeometry(0.3, 0.2, 0.62), M.machineAccent, x + s * 0.82, y + 1.28, z, 0, 1, 1, 1, { cast: false })
    for (const dz of [-0.34, 0.34]) c.B.put(new THREE.BoxGeometry(0.9, 0.05, 0.05), M.machine, x + s * 0.4, y + 0.98, z + dz)
  }
  const cross = (x: number, y: number, z: number) => {
    c.B.put(new THREE.BoxGeometry(1.5, 0.12, 0.6), M.machine, x, y + 0.1, z)
    c.B.put(new THREE.BoxGeometry(0.1, 1.5, 0.1), M.machine, x + 0.55, y + 0.85, z)
    c.B.put(new THREE.BoxGeometry(0.34, 0.3, 0.45), M.machineAccent, x + 0.62, y + 1.55, z, 0, 1, 1, 1, { cast: false })
    for (const dz of [-0.22, 0.22]) c.B.put(new THREE.BoxGeometry(0.9, 0.06, 0.05), M.machine, x + 0.1, y + 0.75, z + dz, 0, 1, 1, 1, { cast: false })
  }
  const rack = (x: number, y: number, z: number) => {
    for (const dx of [-0.6, 0.6]) for (const dz of [-0.55, 0.55]) c.B.put(new THREE.BoxGeometry(0.08, 2.3, 0.08), M.steel, x + dx, y + 1.15, z + dz)
    c.B.put(new THREE.BoxGeometry(1.4, 0.06, 0.06), M.steelLight, x, y + 1.55, z)
    c.B.put(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 14).rotateZ(Math.PI / 2), M.rubber, x - 0.55, y + 1.55, z)
    c.B.put(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 14).rotateZ(Math.PI / 2), M.rubber, x + 0.55, y + 1.55, z)
    c.B.put(new THREE.BoxGeometry(0.45, 0.12, 1.2), M.leather, x, y + 0.45, z)
    c.B.put(new THREE.BoxGeometry(1.4, 0.04, 1.4), M.rubber, x, y + 0.03, z)
  }
  const dumbbellWall = (x: number, y: number, z0w: number, len: number) => {
    c.B.put(new THREE.BoxGeometry(0.5, 0.9, len), M.steel, x, y + 0.45, z0w + len / 2)
    for (let i = 0; i < Math.floor(len / 0.3); i++) for (const lvl of [0.55, 0.85]) c.B.put(new THREE.SphereGeometry(0.1, 8, 6), rnd() < 0.3 ? M.machineAccent : M.rubber, x + 0.28, y + lvl, z0w + 0.2 + i * 0.3, 0, 1, 1.0, 1, { cast: false })
  }
  const bench = (x: number, y: number, z: number) => {
    c.B.put(new THREE.BoxGeometry(1.2, 0.12, 0.35), M.leather, x, y + 0.45, z)
    for (const dz of [-0.4, 0.4]) c.B.put(new THREE.BoxGeometry(0.06, 0.45, 0.06), M.steel, x + dz, y + 0.225, z)
  }
  const GXE = x1 - 3.0 // equipment starts a little behind the glazing so it reads through the glass
  // ground floor: cardio row facing the street, reception desk at the door, free-weights further back
  for (let z = z0 + 3; z < z1 - 2; z += 2.3) {
    if (Math.abs(z - (z0 + z1) / 2) < 6.2) continue
    treadmill(GXE, FL[0], z, true)
    cross(GXE - 4.2, FL[0], z + 0.6)
  }
  // the reception desk: a curved timber-and-gold counter behind the doors, a lit gold wall graphic behind it
  c.B.put(new THREE.BoxGeometry(1.0, 1.1, 6.0), M.timber, x1 - 6.5, 0.2 + 0.55, (z0 + z1) / 2)
  c.B.put(new THREE.BoxGeometry(1.06, 0.06, 6.06), M.gold, x1 - 6.5, 1.33, (z0 + z1) / 2)
  c.B.put(new THREE.BoxGeometry(0.06, 2.6, 6), M.warmLight, x0 + 0.5, 1.6, (z0 + z1) / 2, 0, 1, 1, 1, { cast: false })
  for (let z = z0 + 4; z < z1 - 3; z += 3.4) rack(x0 + 7, FL[0], z)
  dumbbellWall(x0 + 3, FL[0], z0 + 4, 12)
  for (let z = z0 + 5; z < z1 - 4; z += 2.6) bench(x0 + 10.5, FL[0], z)
  // first floor: cross-trainers and bikes along the glass, a studio zone at the back
  for (let z = z0 + 3; z < z1 - 2; z += 2.2) {
    cross(xu - 2.8, FL[1], z)
    cross(xu - 6.8, FL[1], z + 0.4)
  }
  for (let z = z0 + 5; z < z1 - 4; z += 4) rack(x0 + 8, FL[1], z)
  // second floor: strength zone: racks and benches in rows
  for (let z = z0 + 4; z < z1 - 3; z += 3.6) {
    rack(xu - 3.0, FL[2], z)
    rack(xu - 7.4, FL[2], z + 0.8)
    bench(xu - 11, FL[2], z)
  }
  dumbbellWall(x0 + 3, FL[2], z0 + 4, 14)
}
