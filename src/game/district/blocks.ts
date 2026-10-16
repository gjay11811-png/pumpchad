import * as THREE from 'three'
import { ST } from './config'
import { box, cyl, floor, rng, slab, wall, type Ctx } from './kit'
import { AVE } from './street'

/**
 * The commercial blocks that frame the avenue (the gym is on the west side, see gym.ts). Each is a different design on purpose:
 *   E1  a curved-glass residential / office tower with stacked, undulating floor plates and balconies (east, opposite the gym);
 *   E2  a brick shopfront terrace: café, boutique, bistro, with awnings, signs, stone sills and a cornice (east, by the gate);
 *   E3  a concrete-and-glass office block on a colonnade (east, deeper);
 *   W2  a low glass-and-timber showroom wing (west, beyond the gym), W3 a small brick corner building;
 *   plus the arcade's reserved plot with a hoarding, and the closed street end.
 * East frontages stand on x = FRONT; west ones on x = −FRONT.
 */
const FRONT = 14.4
const CZ = ST.crossZ

export function buildBlocks(c: Ctx) {
  const { M } = c
  const rnd = rng(23)

  /* ═════ E1: curved-glass tower ═════ */
  {
    const z0 = -48
    const z1 = -12
    const x0 = FRONT + 0.6
    const depth = 20
    const floors = 9
    const fh = 3.4
    // ground floor: recessed glazed retail behind slim columns
    slab(c, M.concrete, x0, x0 + depth, 0, 0.2, z0, z1, 3)
    wall(c, M.glass, 'w', z0 + 0.5, z1 - 0.5, 0.2, 4.2, x0 + 1.8)
    for (let z = z0 + 0.5; z <= z1 - 0.5 + 0.01; z += 1.8) slab(c, M.steel, x0 + 1.74, x0 + 1.86, 0.2, 4.2, z - 0.04, z + 0.04, 1)
    for (let z = z0 + 1.5; z <= z1 - 1 + 0.01; z += 4.5) cyl(c, M.steel, x0 + 0.2, 0.2, z, 0.2, 0.2, 4.0, 14)
    wall(c, M.warmLight, 'w', z0 + 1, z1 - 1, 0.5, 3.4, x0 + 3.3) // lit shop interior
    slab(c, M.timber, x0, x0 + 1.8, 4.1, 4.3, z0, z1, 1.2) // soffit
    // the stacked floor plates: each a slightly different curve on the street side, dark slab edge, glass band, glass balustrade
    for (let i = 0; i < floors; i++) {
      const y = 4.3 + i * fh
      const bulge = 1.1 + Math.sin(i * 0.9 + 0.4) * 0.9 // how far this plate bellies toward the avenue
      const shape = new THREE.Shape()
      const n = 24
      shape.moveTo(0, 0)
      for (let k = 0; k <= n; k++) {
        const u = k / n
        shape.lineTo(-Math.sin(Math.PI * u) * bulge - (u < 0.5 ? 0 : 0), u * (z1 - z0))
      }
      shape.lineTo(depth, z1 - z0)
      shape.lineTo(depth, 0)
      shape.closePath()
      const plate = new THREE.ExtrudeGeometry(shape, { depth: 0.38, bevelEnabled: false })
      plate.rotateX(Math.PI / 2) // shape (x, y=z) → plane xz; extrude along −y
      plate.translate(0, 0.38, 0)
      c.B.put(plate, M.cladding, x0 + 1.0, y, z0)
      // the glazing band: the same outline, inset, as a solid reflective volume
      const inset = new THREE.Shape()
      inset.moveTo(0.35, 0.3)
      for (let k = 0; k <= n; k++) {
        const u = k / n
        inset.lineTo(-Math.sin(Math.PI * u) * (bulge - 0.35) + 0.0, 0.3 + u * (z1 - z0 - 0.6))
      }
      inset.lineTo(depth - 1, z1 - z0 - 0.3)
      inset.lineTo(depth - 1, 0.3)
      inset.closePath()
      const band = new THREE.ExtrudeGeometry(inset, { depth: fh - 0.55, bevelEnabled: false })
      band.rotateX(Math.PI / 2)
      band.translate(0, fh - 0.17, 0)
      c.B.put(band, M.glassDark, x0 + 1.0, y, z0, 0, 1, 1, 1, { cast: false })
      // vertical mullion fins down the curve, every ~1.8 m of arc
      for (let k = 1; k < n; k += 2) {
        const u = k / n
        c.B.put(new THREE.BoxGeometry(0.09, fh - 0.5, 0.09), M.steel, x0 + 1.0 - Math.sin(Math.PI * u) * (bulge - 0.35), y + 0.4 + (fh - 0.5) / 2, z0 + 0.3 + u * (z1 - z0 - 0.6))
      }
      // balcony rail: a glass balustrade along the plate's edge on alternate floors
      if (i % 2 === 1) for (let k = 0; k < n; k += 1) {
        const u = (k + 0.5) / n
        c.B.put(new THREE.BoxGeometry(0.03, 1.0, (z1 - z0) / n), M.glass, x0 + 1.0 - Math.sin(Math.PI * u) * bulge - 0.05, y + 0.38 + 0.5, z0 + u * (z1 - z0), 0, 1, 1, 1, { cast: false })
      }
    }
    slab(c, M.cladding, x0 + 0.9, x0 + depth, 4.3 + floors * fh, 4.3 + floors * fh + 0.5, z0 - 0.2, z1 + 0.2, 3) // roof
    slab(c, M.steel, x0 + 8, x0 + 13, 4.8 + floors * fh, 6.6 + floors * fh, z0 + 6, z1 - 10, 2) // plant screen
    c.block(x0, x0 + depth, z0, z1)
  }

  /* ═════ E2: a brick shopfront terrace by the gate ═════ */
  {
    const units: { z0: number; z1: number; floors: number; sign: string; awning: THREE.Material; paint: string }[] = [
      { z0: -8, z1: 8, floors: 3, sign: 'CAFÉ', awning: M.signGreen, paint: '#e8e0d0' },
      { z0: 8, z1: 22, floors: 4, sign: 'ATELIER', awning: M.black, paint: '#d8cfc0' },
      { z0: 22, z1: 38, floors: 3, sign: 'BISTRO', awning: M.signRed, paint: '#e0d4bc' },
    ]
    const aw = (m: THREE.Material, z0: number, z1: number) => {
      // a sloping canvas awning on slim arms
      const g = new THREE.BoxGeometry(2.0, 0.05, z1 - z0 - 1.0)
      g.rotateZ(0.18)
      c.B.put(g, m, FRONT + 1.0, 3.2, (z0 + z1) / 2, 0, 1, 1, 1)
      c.B.put(new THREE.BoxGeometry(0.04, 0.3, z1 - z0 - 1.0), m, FRONT + 1.95, 2.85, (z0 + z1) / 2)
    }
    for (const u of units) {
      const h = u.floors * 3.6 + 1
      const x1 = FRONT + 14
      // brick body (the avenue face is a plane carrying the PBR brick; a darker box behind gives the thickness)
      slab(c, M.concrete, FRONT, x1, 3.9, h, u.z0, u.z1, 3) // the upper floors start at the shop fascia
      slab(c, M.concrete, FRONT + 3.2, x1, 0, 3.9, u.z0, u.z1, 3) // the ground-floor body stands 3.2 m back: the shop is hollow in front of it
      wall(c, M.brick, 'w', u.z0, u.z1, 3.9, h, FRONT - 0.005, 2.2)
      wall(c, M.brick, 'w', u.z0, u.z0 + 0.8, 0.2, 3.9, FRONT - 0.005, 2.2) // pilasters between the shopfronts
      wall(c, M.brick, 'w', u.z1 - 0.8, u.z1, 0.2, 3.9, FRONT - 0.005, 2.2)
      slab(c, M.concrete, FRONT - 0.02, FRONT + 0.4, 3.3, 3.9, u.z0, u.z1, 3) // lintel / fascia beam over the shop level
      slab(c, M.concrete, FRONT - 0.2, FRONT + 0.0, h - 0.5, h + 0.1, u.z0 - 0.05, u.z1 + 0.05, 3) // cornice
      slab(c, M.concrete, FRONT - 0.35, FRONT - 0.2, h + 0.1, h + 0.28, u.z0 - 0.05, u.z1 + 0.05, 3)
      // ground-floor shop window with a stone plinth, a door and a fascia sign
      const zm = (u.z0 + u.z1) / 2
      wall(c, M.glass, 'w', u.z0 + 0.8, zm - 1.4, 0.7, 3.2, FRONT - 0.04)
      wall(c, M.glass, 'w', zm + 1.4, u.z1 - 0.8, 0.7, 3.2, FRONT - 0.04)
      for (const [a, bb] of [[u.z0 + 0.9, zm - 1.5], [zm + 1.5, u.z1 - 0.9]] as const) {
        wall(c, M.warmLight, 'w', a, bb, 0.5, 3.2, FRONT + 3.1) // the lit back wall of the shop
        slab(c, M.timber, FRONT + 0.8, FRONT + 1.6, 0.2, 1.0, a + 0.3, bb - 0.3, 1.2) // a display counter
        slab(c, M.wallInt, FRONT + 0.1, FRONT + 3.2, 3.2, 3.3, a, bb, 2, false) // the shop ceiling
        slab(c, M.floorInt, FRONT + 0.0, FRONT + 3.2, 0.19, 0.2, a, bb, 2, false)
        for (let z = a + 0.6; z < bb - 0.3; z += 1.1) c.B.put(new THREE.BoxGeometry(0.5, 0.05, 0.3), M.ceilLight, FRONT + 2.0, 3.15, z, 0, 1, 1, 1, { cast: false }) // downlights
      }
      for (const [a, b] of [[u.z0 + 0.8, zm - 1.4], [zm + 1.4, u.z1 - 0.8]] as const) {
        slab(c, M.steel, FRONT - 0.1, FRONT + 0.02, 0.7, 3.25, a - 0.05, a + 0.05, 1)
        slab(c, M.steel, FRONT - 0.1, FRONT + 0.02, 0.7, 3.25, b - 0.05, b + 0.05, 1)
        slab(c, M.steel, FRONT - 0.1, FRONT + 0.02, 3.2, 3.28, a, b, 1)
      }
      slab(c, M.kerb, FRONT - 0.25, FRONT, 0.2, 0.7, u.z0 + 0.6, u.z1 - 0.6, 2) // stone plinth
      wall(c, M.glass, 'w', zm - 0.9, zm + 0.9, 0.2, 2.6, FRONT - 0.04)
      slab(c, M.steel, FRONT - 0.1, FRONT + 0.03, 0.2, 2.7, zm - 0.95, zm - 0.9, 1)
      slab(c, M.steel, FRONT - 0.1, FRONT + 0.03, 0.2, 2.7, zm + 0.9, zm + 0.95, 1)
      // fascia sign: a dark board with gold-lit lettering drawn as a plane
      c.B.put(new THREE.BoxGeometry(0.12, 0.6, Math.min(8, u.z1 - u.z0 - 2)), M.black, FRONT - 0.1, 3.75, zm)
      c.B.put(new THREE.PlaneGeometry(Math.min(7, u.z1 - u.z0 - 2.4), 0.46), signTex(c, u.sign), FRONT - 0.17, 3.75, zm, -Math.PI / 2, 1, 1, 1, { cast: false })
      aw(u.awning, u.z0, u.z1)
      // upper windows: stone-framed openings with dark glass, in a regular rhythm
      for (let f = 1; f < u.floors; f++) {
        const y0 = 0.2 + f * 3.6 + 0.9
        for (let z = u.z0 + 1.8; z <= u.z1 - 1.0 + 0.01; z += 2.6) {
          wall(c, M.glassDark, 'w', z - 0.7, z + 0.7, y0, y0 + 1.9, FRONT - 0.03)
          slab(c, M.kerb, FRONT - 0.18, FRONT, y0 - 0.12, y0, z - 0.85, z + 0.85, 2) // sill
          slab(c, M.kerb, FRONT - 0.12, FRONT, y0 + 1.9, y0 + 2.05, z - 0.85, z + 0.85, 2) // lintel
          slab(c, M.white, FRONT - 0.05, FRONT - 0.02, y0, y0 + 1.9, z - 0.02, z + 0.02, 1) // glazing bar
        }
      }
      // chimneys and a roof edge
      for (const z of [u.z0 + 2, u.z1 - 2]) slab(c, M.brick, x1 - 5, x1 - 4.2, h, h + 1.6, z - 0.4, z + 0.4, 2)
      c.block(FRONT - 0.2, x1, u.z0, u.z1)
    }
    // party walls between the units
    for (const z of [8, 22]) slab(c, M.concrete, FRONT - 0.25, FRONT + 0.1, 0, 4 * 3.6 + 1.4, z - 0.1, z + 0.1, 3)
  }

  /* ═════ E3: concrete and glass office block on a colonnade ═════ */
  {
    const z0 = 42
    const z1 = 90
    const floors = 6
    const fh = 3.7
    const x1 = FRONT + 22
    slab(c, M.concrete, FRONT + 2.5, x1, 0, floors * fh + 4.4, z0, z1, 3)
    // colonnade: tall concrete columns on the pavement edge, a glazed retail core set back behind them
    for (let z = z0 + 1; z <= z1 - 1 + 0.01; z += 4.8) cyl(c, M.concrete, FRONT + 0.8, 0.16, z, 0.38, 0.38, 4.2, 20)
    slab(c, M.concrete, FRONT + 0.4, FRONT + 2.5, 4.2, 4.6, z0, z1, 3)
    wall(c, M.glass, 'w', z0 + 0.4, z1 - 0.4, 0.2, 4.2, FRONT + 2.5)
    wall(c, M.warmLight, 'w', z0 + 0.6, z1 - 0.6, 0.6, 3.6, FRONT + 2.7)
    for (let z = z0 + 0.4; z <= z1 - 0.4 + 0.01; z += 2.4) slab(c, M.steel, FRONT + 2.44, FRONT + 2.56, 0.2, 4.2, z - 0.04, z + 0.04, 1)
    // upper floors: horizontal strip windows between concrete spandrels
    for (let f = 0; f < floors; f++) {
      const y = 4.6 + f * fh
      wall(c, M.concrete, 'w', z0, z1, y, y + 1.1, FRONT + 2.48, 3)
      wall(c, M.facade, 'w', z0 + 0.3, z1 - 0.3, y + 1.1, y + fh, FRONT + 2.49, 3.6)
      for (let z = z0 + 0.3; z <= z1 - 0.3 + 0.01; z += 2.4) slab(c, M.steel, FRONT + 2.4, FRONT + 2.58, y + 1.1, y + fh, z - 0.035, z + 0.035, 1)
    }
    slab(c, M.cladding, FRONT + 2.2, x1, floors * fh + 4.6, floors * fh + 5.2, z0 - 0.3, z1 + 0.3, 3)
    c.block(FRONT, x1, z0, z1)
    // a bus shelter on the pavement in front (glass, steel, a lit timetable panel)
    const bx = FRONT - 3.4
    const bz = 60
    slab(c, M.steel, bx - 0.8, bx + 0.8, 2.6, 2.68, bz - 2.0, bz + 2.0, 1)
    wall(c, M.glass, 'e', bz - 2.0, bz + 2.0, 0.16, 2.6, bx + 0.8)
    wall(c, M.glass, 'n', bx - 0.8, bx + 0.8, 0.16, 2.6, bz - 2.0)
    wall(c, M.glass, 's', bx - 0.8, bx + 0.8, 0.16, 2.6, bz + 2.0)
    for (const z of [bz - 2, bz + 2]) cyl(c, M.steel, bx + 0.8, 0.16, z, 0.04, 0.04, 2.44, 8)
    c.B.put(new THREE.BoxGeometry(0.06, 1.1, 0.8), M.warmLight, bx - 0.75, 1.5, bz, 0, 1, 1, 1, { cast: false })
    c.B.put(new THREE.BoxGeometry(0.4, 0.05, 2.6), M.timber, bx, 0.5, bz)
    c.block(bx - 0.9, bx + 0.9, bz - 2.1, bz + 2.1)
  }

  /* ═════ W2 / W3: west side, beyond the gym ═════ */
  {
    // W2: a low glass-and-timber showroom wing across from the terrace
    const z0 = -4
    const z1 = 26
    const x1 = -FRONT - 16
    slab(c, M.concrete, x1, -FRONT, 0, 0.2, z0, z1, 3)
    slab(c, M.timber, x1, -FRONT + 1.0, 5.6, 6.2, z0 - 0.4, z1 + 0.4, 1.2)
    slab(c, M.cladding, x1, -FRONT + 1.2, 6.2, 6.6, z0 - 0.4, z1 + 0.4, 3)
    wall(c, M.glass, 'e', z0 + 0.3, z1 - 0.3, 0.2, 5.6, -FRONT - 1.4)
    for (let z = z0 + 0.3; z <= z1 - 0.3 + 0.01; z += 2.5) slab(c, M.steel, -FRONT - 1.46, -FRONT - 1.34, 0.2, 5.6, z - 0.04, z + 0.04, 1)
    slab(c, M.steel, -FRONT - 1.46, -FRONT - 1.34, 5.5, 5.6, z0, z1, 1)
    wall(c, M.warmLight, 'e', z0 + 0.5, z1 - 0.5, 0.4, 5.3, -FRONT - 3.0)
    for (let z = z0 + 2; z < z1 - 1; z += 5) cyl(c, M.steel, -FRONT + 0.3, 0.2, z, 0.16, 0.16, 5.4, 14)
    slab(c, M.cladding, x1, x1 + 0.3, 0, 6.6, z0 - 0.4, z1 + 0.4, 3)
    c.block(x1, -FRONT + 1.2, z0 - 0.4, z1 + 0.4)
  }
  {
    // W3: a small brick corner building at the junction
    const z0 = CZ - ST.cross - 16
    const z1 = CZ - ST.cross - 3
    const x1 = -FRONT - 14
    slab(c, M.concrete, x1, -FRONT, 0, 12.4, z0, z1, 3)
    wall(c, M.brick, 'e', z0, z1, 0.2, 12.4, -FRONT + 0.005, 2.2)
    for (let f = 0; f < 3; f++) for (let z = z0 + 1.6; z <= z1 - 1 + 0.01; z += 2.6) {
      wall(c, M.glassDark, 'e', z - 0.7, z + 0.7, 1.2 + f * 3.6, 3.1 + f * 3.6, -FRONT + 0.03)
      slab(c, M.kerb, -FRONT, -FRONT + 0.18, 1.08 + f * 3.6, 1.2 + f * 3.6, z - 0.85, z + 0.85, 2)
    }
    slab(c, M.concrete, -FRONT, -FRONT + 0.3, 11.9, 12.5, z0 - 0.05, z1 + 0.05, 3)
    c.block(x1, -FRONT, z0, z1)
  }

  /* ═════ the arcade's reserved plot (west, south of the gym): a hoarding and a car park ═════ */
  {
    const px0 = -46
    const px1 = -19
    const pz0 = 30
    const pz1 = 72
    floor(c, M.asphalt, px0, px1, pz0, pz1, 0.01, 4.2)
    // bays (2.5 × 5 m) with white lines, two rows facing a central aisle
    for (let z = pz0 + 2; z <= pz1 - 2 + 0.01; z += 2.6) {
      floor(c, M.paint, px1 - 5.2, px1 - 0.4, z - 0.05, z + 0.05, 0.02, 1)
      floor(c, M.paint, px0 + 0.4, px0 + 5.4, z - 0.05, z + 0.05, 0.02, 1)
    }
    // a hoarding along the park's edge announcing the arcade
    slab(c, M.cladding, px0, px0 + 0.3, 0, 3.2, pz0, pz1, 3)
    c.B.put(new THREE.PlaneGeometry(12, 1.6), signTex(c, 'PUMPCHAD ARCADE · COMING SOON'), px0 + 0.34, 2.2, (pz0 + pz1) / 2, Math.PI / 2, 1, 1, 1, { cast: false })
    // kerb round the park, trees on the avenue side
    slab(c, M.kerb, px1, px1 + 0.2, 0, 0.16, pz0, pz1, 1.5)
    for (let z = pz0 + 4; z < pz1; z += 12) c.trees.push({ kind: 'island', x: -16.5, z, s: 0.32 + rnd() * 0.06, yaw: rnd() * 6 })
    c.block(px0, px0 + 0.3, pz0, pz1)
  }

  /* ═════ the closed street end and the district edge ═════ */
  {
    // a deep building closes the avenue at its far end, so the street ends in architecture, not in sky
    const z = AVE.z0
    slab(c, M.concrete, -60, 60, 0, 34, z - 14, z, 3)
    wall(c, M.concrete, 's', -60, 60, 0, 34, z, 3)
    wall(c, M.facade, 's', -60, 60, 0, 34, z + 0.03, 7.2)
    for (let x = -56; x <= 56; x += 3.5) slab(c, M.steel, x - 0.05, x + 0.05, 2.2, 34, z, z + 0.12, 1)
    c.block(-60, 60, z - 14, z)
    // cross street end caps
    for (const sx of [-1, 1]) {
      const x = sx * 90
      slab(c, M.concrete, sx > 0 ? x : x - 12, sx > 0 ? x + 12 : x, 0, 22, CZ - 30, CZ + 30, 3)
      c.block(sx > 0 ? x : x - 12, sx > 0 ? x + 12 : x, CZ - 30, CZ + 30)
    }
    // low fill buildings behind the main blocks so the skyline has depth
    for (const [x, zz, w, d, h] of [[44, -24, 22, 30, 26], [48, 60, 20, 40, 19], [-70, -22, 26, 36, 22], [-62, 20, 24, 30, 14], [66, -96, 30, 24, 28], [-66, -96, 30, 24, 20]] as const) {
      slab(c, M.concrete, x - w / 2, x + w / 2, 0, h, zz - d / 2, zz + d / 2, 3)
      wall(c, M.facade, x > 0 ? 'w' : 'e', zz - d / 2, zz + d / 2, 0, h, x > 0 ? x - w / 2 - 0.03 : x + w / 2 + 0.03, 7.2)
      c.block(x - w / 2, x + w / 2, zz - d / 2, zz + d / 2)
    }
    // the cross street beyond the avenue: a few facades so it does not read as empty tarmac
    void box
  }
}

/** a small sign texture: gold capitals on near-black */
function signTex(c: Ctx, text: string) {
  const cv = document.createElement('canvas')
  cv.width = 1024
  cv.height = 128
  const g = cv.getContext('2d')!
  g.fillStyle = '#0e0e10'
  g.fillRect(0, 0, 1024, 128)
  const grad = g.createLinearGradient(0, 0, 0, 128)
  grad.addColorStop(0, '#fff0b8')
  grad.addColorStop(1, '#c8902c')
  g.fillStyle = grad
  g.font = '700 78px "Trebuchet MS", Arial, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text.split('').join(text.length < 10 ? ' ' : ''), 512, 66, 960)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  const m = new THREE.MeshBasicMaterial({ map: t, toneMapped: false })
  c.D.push(t, m)
  return m
}
