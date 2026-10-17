import * as THREE from 'three'
import { house, placer, type Town } from './buildings'
import { SHOW_HOMES, SHOW_LOT, type ShowHome } from '../../estates'
import { boxUV, gableGeo } from './kit'
import { ornateSign } from './ornament'
import { Frame } from './signs'

/**
 * The three SHOW HOMES at the head of Chadville Heights' north row: a timber cottage, a contemporary flat-roofed house and a premium
 * two-storey manor with a columned portico. They are walk-round models (not for sale, not buildable): each sits in its own kerbed lawn
 * with a path to the lane, a hedge and a standing sign. All geometry goes through the static batch (a handful of materials, no lights).
 */
export function showHomes(T: Town) {
  const P = T.P
  const lawn = new THREE.MeshStandardMaterial({ map: P.ground.map, color: '#8aa86a', roughness: 1 })
  T.disposables.push(lawn)
  const { w, d } = SHOW_LOT
  for (const h of SHOW_HOMES) {
    const x0 = h.x - w / 2
    const z0 = h.z - 5 // the site is a plot-sized lot (12 x 10), 26..36
    const z1 = z0 + d
    // lawn, kerbs (open at the path), path to the lane
    const plane = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2)
    const u = plane.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < u.count; i++) u.setXY(i, (u.getX(i) * w) / 3, (u.getY(i) * d) / 3)
    T.batch.put(plane, lawn, h.x, 0.012, z0 + d / 2, 0, 1, 1, 1, { cast: false })
    const kerb = (ax: number, az: number, bx: number, bz: number) => T.batch.put(boxUV(Math.max(0.25, bx - ax), 0.22, Math.max(0.25, bz - az), 1), P.stoneLight, (ax + bx) / 2, 0.11, (az + bz) / 2, 0, 1, 1, 1, { cast: false })
    kerb(x0, z0 - 0.12, x0 + w, z0 + 0.12)
    kerb(x0 - 0.12, z0, x0 + 0.12, z1)
    kerb(x0 + w - 0.12, z0, x0 + w + 0.12, z1)
    kerb(x0, z1 - 0.12, h.x - 1.2, z1 + 0.12)
    kerb(h.x + 1.2, z1 - 0.12, x0 + w, z1 + 0.12)
    const path = new THREE.PlaneGeometry(2, 7.2).rotateX(-Math.PI / 2)
    T.batch.put(path, P.cobble, h.x, 0.022, z1 - 2.5 + 1.1, 0, 1, 1, 1, { cast: false }) // on to the boulevard
    for (const sx of [-1, 1]) {
      // low hedge along each side of the path
      T.batch.put(boxUV(0.7, 0.8, 5.5, 1.2), P.foliageDark, h.x + sx * 1.7, 0.4, z1 - 4.3)
      T.batch.put(boxUV(2.6, 0.8, 0.7, 1.2), P.foliageDark, h.x + sx * 3.2, 0.4, z1 - 1.0)
    }
    if (h.id === 'cottage') cottage(T, h, z0)
    else if (h.id === 'contemporary') contemporary(T, h, z0)
    else premium(T, h, z0)
    // standing sign by the path
    const F = Frame.at(T.batch, h.x + 3.6, 1.2, z1 - 0.8, 0)
    for (const px of [-0.8, 0.8]) F.box(0.1, 1.2, 0.1, P.bark, px, -0.6 + 0.05, -0.04)
    ornateSign(T, F, `${h.name.toUpperCase()} · SHOW HOME`, { h: 0.5, crest: null })
    for (const px of [-0.8, 0.8]) T.colliders.push({ kind: 'circle', x: h.x + 3.6 + px, z: z1 - 0.8, r: 0.12, h: 1.2 })
  }
}

function cottage(T: Town, h: ShowHome, z0: number) {
  house(T, { x: h.x, z: z0 + 4.2, w: 7.4, d: 5.6, floors: 1, face: 's', roof: T.P.roofOrange, chimney: true, seed: 11, lit: 0.9 })
}

/** flat roof, a glazed ground floor, an upper storey cantilevering over the entrance, timber slats and a slim steel column */
function contemporary(T: Town, h: ShowHome, z0: number) {
  const P = T.P
  const L = placer(T, h.x + 0.6, z0 + 4.2, 's')
  const H1 = 3.0
  const H2 = 2.8
  // ground floor (x -4.8..3.6 local), upper floor (x -2.3..4.7) pushed 1.2 m forward
  L.put(boxUV(8.4, 0.3, 5.6, 2), P.stone, -0.6, 0.15, 0)
  L.put(boxUV(8.4, H1, 5.6, 3), P.stoneLight, -0.6, 0.3 + H1 / 2, 0)
  L.put(boxUV(7, H2, 5.6, 3), P.stoneLight, 1.2, 0.3 + H1 + H2 / 2, 1.2)
  // dark roof slabs with a deep overhang
  L.put(boxUV(7.8, 0.28, 6.4, 1), P.plasterDark, 1.2, 0.3 + H1 + H2 + 0.14, 1.2)
  // glazed ground floor: big panes in thin iron frames
  const glass = new THREE.PlaneGeometry(1, 1)
  const gz = 2.8 + 0.03
  L.put(glass, P.windowLit, -2.7, 0.3 + 1.25, gz, 0, 4.4, 2.3, 1, false)
  for (const mx of [-4.9, -3.8, -2.7, -1.6, -0.5]) L.put(boxUV(0.07, 2.4, 0.1, 1), P.iron, mx, 0.3 + 1.25, gz + 0.02)
  L.put(boxUV(4.6, 0.07, 0.1, 1), P.iron, -2.7, 0.3 + 2.4, gz + 0.02)
  // front door: warm wood, framed in iron
  L.put(boxUV(1.1, 2.3, 0.1, 1), P.woodLight, 1.9, 0.3 + 1.15, gz)
  L.put(boxUV(1.3, 0.1, 0.14, 1), P.iron, 1.9, 0.3 + 2.35, gz + 0.02)
  L.put(new THREE.BoxGeometry(0.1, 0.5, 0.06), P.glowGold, 1.35, 0.3 + 1.2, gz + 0.1, 0, 1, 1, 1, false)
  // upper floor: a continuous ribbon window + a timber slat screen
  const uz = 1.2 + 2.8 + 0.03
  L.put(glass, P.windowLit, 1.2, 0.3 + H1 + 1.4, uz, 0, 5.2, 1.7, 1, false)
  for (const mx of [-1.4, -0.1, 1.2, 2.5, 3.8]) L.put(boxUV(0.07, 1.8, 0.1, 1), P.iron, mx, 0.3 + H1 + 1.4, uz + 0.02)
  for (let i = 0; i < 9; i++) L.put(boxUV(0.07, 2.6, 0.12, 1), P.woodLight, 3.2 + i * 0.16 - 0.0, 0.3 + H1 + 1.4, uz + 0.1 + (i % 2) * 0.03, 0, 1, 1, 1, false)
  // the cantilever's support: one slim steel column at its outer corner, plus a planter
  L.put(new THREE.CylinderGeometry(0.07, 0.07, H1, 8), P.iron, 4.3, 0.3 + H1 / 2, 4.0)
  L.put(boxUV(1.4, 0.45, 0.5, 1), P.stone, -2.4, 0.22, 3.25)
  L.put(boxUV(1.3, 0.3, 0.4, 1), P.soil, -2.4, 0.5, 3.25, 0, 1, 1, 1, false)
  L.put(new THREE.IcosahedronGeometry(0.45, 1), P.foliageDark, -2.7, 0.85, 3.25)
  L.put(new THREE.IcosahedronGeometry(0.35, 1), P.foliage, -2.0, 0.78, 3.25)
  // roof terrace rail on the lower slab's exposed part (above the ground floor, behind the upper floor)
  for (let i = 0; i <= 10; i++) L.put(new THREE.BoxGeometry(0.03, 0.9, 0.03), P.iron, -4.8 + i * 0.52, 0.3 + H1 + 0.45 + 0.3, -2.7)
  L.put(new THREE.BoxGeometry(5.4, 0.04, 0.05), P.iron, -2.1, 0.3 + H1 + 0.9 + 0.3, -2.7)
  L.put(boxUV(2.2, 0.35, 1.0, 1), P.stone, 5.4, 0.18, 2.6) // a bench-height stone step by the path
  L.box(-4.8, 3.6, -2.8, 2.8, 6)
  L.box(-2.3, 4.7, 2.8, 4.0, 6) // (the cantilever's underside is 3 m up: it blocks the walk through its footprint like a wall — kept simple)
}

/** two storeys, a hipped slate roof, wings either side and a columned portico with a balcony */
function premium(T: Town, h: ShowHome, z0: number) {
  const P = T.P
  const L = placer(T, h.x, z0 + 4, 's')
  const MW = 6.6
  const MD = 5.6
  const H = 6.2
  // plinth + main block + stone quoins
  L.put(boxUV(MW + 0.4, 0.5, MD + 0.4, 1.5), P.stone, 0, 0.25, 0)
  L.put(boxUV(MW, H, MD, 3), P.plaster, 0, 0.5 + H / 2, 0)
  for (const sx of [-1, 1]) for (let k = 0; k < 8; k++) L.put(boxUV(0.34, 0.36, 0.34, 1), P.stoneLight, sx * (MW / 2 + 0.02), 0.7 + k * 0.78, MD / 2 + 0.02)
  // string course + cornice
  L.put(boxUV(MW + 0.2, 0.18, MD + 0.2, 1), P.stoneLight, 0, 0.5 + H / 2 + 0.1, 0)
  L.put(boxUV(MW + 0.5, 0.3, MD + 0.5, 1), P.stoneLight, 0, 0.5 + H, 0)
  // hipped slate roof (two gables crossed) + chimneys
  L.put(gableGeo(MD + 1.2, MW + 1.0, 2.6), P.roofSlate, 0, 0.5 + H + 0.15, 0, Math.PI / 2)
  for (const sx of [-1, 1]) L.put(boxUV(0.7, 2.3, 0.7, 1), P.stone, sx * 2.1, 0.5 + H + 1.9, -0.6)
  // wings
  for (const sx of [-1, 1]) {
    const wx = sx * (MW / 2 + 1.5)
    L.put(boxUV(3.0, 0.4, 5.0, 1.5), P.stone, wx, 0.2, -0.3)
    L.put(boxUV(2.8, 3.8, 4.8, 3), P.plaster, wx, 0.4 + 1.9, -0.3)
    L.put(gableGeo(3.4, 5.4, 1.4), P.roofSlate, wx, 0.4 + 3.8 + 0.1, -0.3)
    L.put(new THREE.PlaneGeometry(0.85, 1.35), P.windowLit, wx, 2.0, 2.12, 0, 1, 1, 1, false)
    L.put(boxUV(1.05, 0.1, 0.14, 1), P.stoneLight, wx, 1.3, 2.14)
    L.put(boxUV(1.05, 0.1, 0.14, 1), P.stoneLight, wx, 2.74, 2.14)
  }
  // main-block windows: 2 rows, 4 across the front, a light surround each
  const fz = MD / 2 + 0.03
  for (const row of [0, 1]) {
    for (const wx of [-2.4, -0.8, 0.8, 2.4]) {
      if (row === 0 && Math.abs(wx) < 1) continue // the doorway
      const y = row === 0 ? 2.2 : 5.1
      L.put(new THREE.PlaneGeometry(0.9, 1.5), row === 1 && Math.abs(wx) < 1 ? P.windowDark : P.windowLit, wx, y, fz, 0, 1, 1, 1, false)
      L.put(boxUV(1.1, 0.12, 0.16, 1), P.stoneLight, wx, y - 0.84, fz + 0.04)
      L.put(boxUV(1.1, 0.14, 0.16, 1), P.stoneLight, wx, y + 0.82, fz + 0.04)
    }
  }
  // the portico: steps, four columns, an entablature, a pediment, and the balcony it carries
  const pz = MD / 2 + 1.4
  L.put(boxUV(5.2, 0.5, 2.6, 1), P.stone, 0, 0.25, MD / 2 + 1.0)
  L.put(boxUV(4.4, 0.18, 0.9, 1), P.stone, 0, 0.09, MD / 2 + 2.6)
  for (const cx of [-1.9, -0.65, 0.65, 1.9]) {
    L.put(new THREE.CylinderGeometry(0.2, 0.23, 3.4, 14), P.stoneLight, cx, 0.5 + 1.7, pz)
    L.put(boxUV(0.56, 0.16, 0.56, 1), P.stoneLight, cx, 0.5 + 3.48, pz)
  }
  L.put(boxUV(5.0, 0.5, 2.0, 1), P.stoneLight, 0, 0.5 + 3.4 + 0.25 + 0.16, MD / 2 + 1.0) // entablature = balcony slab
  // balcony: iron rail + the balcony door (windowLit) above the entrance
  for (let i = 0; i <= 12; i++) L.put(new THREE.BoxGeometry(0.03, 0.95, 0.03), P.iron, -2.3 + i * 0.383, 0.5 + 4.31 + 0.47, MD / 2 + 1.95)
  L.put(new THREE.BoxGeometry(4.6, 0.04, 0.05), P.iron, 0, 0.5 + 4.31 + 0.95, MD / 2 + 1.95)
  for (const sx of [-1, 1]) L.put(new THREE.BoxGeometry(0.05, 0.95, 1.9), P.iron, sx * 2.3, 0.5 + 4.31 + 0.47, MD / 2 + 1.0, 0, 1, 0.02, 1)
  L.put(new THREE.PlaneGeometry(1.0, 2.0), P.windowLit, 0, 0.5 + 4.31 + 1.0 + 0.05, fz, 0, 1, 1, 1, false)
  L.put(gableGeo(5.6, 0.5, 1.1), P.stoneLight, 0, 0.5 + H - 0.5, MD / 2 + 1.1)
  // the front door: tall, dark wood, a gold fanlight lantern
  L.put(new THREE.PlaneGeometry(1.25, 2.4), P.timber, 0, 0.5 + 1.2, fz, 0, 1, 1, 1, false)
  L.put(boxUV(1.5, 0.14, 0.14, 1), P.stoneLight, 0, 0.5 + 2.5, fz + 0.04)
  L.put(new THREE.BoxGeometry(0.18, 0.28, 0.18), P.glowGold, 1.1, 0.5 + 2.2, fz + 0.12, 0, 1, 1, 1, false)
  // urns at the steps
  for (const sx of [-1, 1]) {
    L.put(new THREE.CylinderGeometry(0.28, 0.2, 0.7, 10), P.stoneLight, sx * 2.7, 0.35, MD / 2 + 2.5)
    L.put(new THREE.IcosahedronGeometry(0.32, 1), P.foliage, sx * 2.7, 0.9, MD / 2 + 2.5)
  }
  L.box(-MW / 2 - 3.0, MW / 2 + 3.0, -3.1, MD / 2 + 0.1, 8)
  for (const cx of [-1.9, 1.9]) T.colliders.push({ kind: 'circle', x: L.world(cx, pz)[0], z: L.world(cx, pz)[1], r: 0.3, h: 4 })
}
