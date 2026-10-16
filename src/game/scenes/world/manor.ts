import * as THREE from 'three'
import type { Quality } from '../../save'
import type { Town } from './buildings'
import { boxUV, gableGeo, rng } from './kit'
import { Frame, PANEL, channelLetters, panelTexture, postedBoard, type SignMats } from './signs'
import { terrainHeight } from './city'
import { VALLEY_Y } from './descent'
import { DRIVE, MANOR, MANOR_PAD, VIEW_PATH, VIEWPOINT } from './valley'
import { archMats, type ArchMats } from './architecture'
import { flowerTub } from './ornament'
import { parkBench, type BenchSpot } from './westside'
import { inFrame } from './frame'
import { pathRibbon } from './hamlet'
import { CARS, heroCarAt } from './vehicles'
import { isNight } from './daylight'
import { plantCrown } from './treegeo'

/**
 * MOONCREST MANOR — a secluded hillside mansion over the lake. Arrival: a winding drive from the Lakeside Landing, ornate
 * iron gates between stone piers, a gravelled forecourt with a fountain, a stone terrace across the lake-facing front. The
 * house (26 m × 20 m, two storeys): a central portico bay with columns and a balcony, a tall left wing with bay windows
 * and a hipped slate roof, a kitchen block at the right-back, a glass conservatory at the right-front (iron mullions, glass
 * roof), a copper-domed lantern over the great hall, tall chimney stacks, dormers. Grounds: a walled garden with a
 * greenhouse, an octagonal pavilion, a carriage house, a hedged forecourt, framing trees, and a garden path down to a
 * shoreline viewpoint.  Everything is built in a frame at the manor's centre (local = world − (150, y, 516)); the house sits
 * in a rotated sub-frame so that its +z (front) faces west, toward the lake and the drive.
 */
const SMt = (P: Town['P']): SignMats => ({ frame: P.iron, metal: P.iron, gold: P.gold, stone: P.stoneLight })
const toLocal = (wx: number, wz: number): [number, number] => [wx - MANOR.x, wz - MANOR.z]

export function manor(T: Town, q: Quality, stoneTex: THREE.Texture, seats: BenchSpot[]) {
  /* the drive and the garden path are surfaced in world space (their y follows the hill) */
  {
    const gravel = new THREE.MeshStandardMaterial({ map: T.P.ground.map, color: '#d8c8a4', roughness: 0.95 })
    T.disposables.push(gravel)
    pathRibbon(T, DRIVE, T.P.cobble, DRIVE.width, 0.06)
    pathRibbon(T, VIEW_PATH, gravel, VIEW_PATH.width, 0.05)
    // low retaining walls along the drive where the hill falls away, and lanterns every ~18 m
    const post = new THREE.CylinderGeometry(0.06, 0.09, 2.7, 6)
    const glow = new THREE.BoxGeometry(0.22, 0.3, 0.22)
    const cap = new THREE.ConeGeometry(0.24, 0.2, 4).rotateY(Math.PI / 4)
    for (let s = 6; s < DRIVE.len; s += 3.2) {
      const p = DRIVE.pointAt(s)
      const ang = Math.atan2(p.tx, p.tz)
      for (const side of [-1, 1]) {
        const off = (DRIVE.width / 2 + 0.25) * side
        const x = p.x - p.tz * off
        const z = p.z + p.tx * off
        const drop = p.y - terrainHeight(x - p.tz * side * 3, z + p.tx * side * 3)
        if (drop > 0.7) {
          const h = Math.min(4, 0.8 + drop * 0.8)
          T.batch.put(boxUV(0.6, h, 3.3, 2), T.P.stone, x, p.y - h / 2 + 0.05, z, ang)
          T.batch.put(boxUV(0.7, 0.14, 3.4, 1), T.P.stoneLight, x, p.y + 0.12, z, ang)
        } else T.batch.put(boxUV(0.3, 0.22, 3.3, 1), T.P.stoneLight, x, p.y + 0.1, z, ang)
      }
    }
    for (let s = 12; s < DRIVE.len - 6; s += 18) {
      const p = DRIVE.pointAt(s)
      const side = (Math.round(s / 18) % 2) * 2 - 1
      const x = p.x - p.tz * side * (DRIVE.width / 2 + 0.2)
      const z = p.z + p.tx * side * (DRIVE.width / 2 + 0.2)
      T.batch.put(post, T.P.iron, x, p.y + 1.35, z)
      T.batch.put(glow, T.P.glowOrange, x, p.y + 2.85, z, 0, 1, 1, 1, { cast: false })
      T.batch.put(cap, T.P.iron, x, p.y + 3.08, z)
      T.lights.push({ x, y: p.y + 2.85, z, color: '#ffb060', intensity: 3.4, dist: 9, priority: 1 })
    }
  }

  inFrame(T, { x: MANOR.x, y: MANOR.y, z: MANOR.z }, q !== 'low', (L) => {
    const P = L.P
    const D = L.disposables
    const R = rng(1892)
    const night = isNight()
    const glass = new THREE.MeshStandardMaterial({ color: '#3a5068', roughness: 0.08, metalness: 0.65, emissive: '#0c1422' })
    const greenhouseGlass = new THREE.MeshStandardMaterial({ color: '#c8e8f0', transparent: true, opacity: night ? 0.14 : 0.3, roughness: 0.05, metalness: 0.2, depthWrite: false, emissive: night ? '#2a4a40' : '#000000' })
    const copper = new THREE.MeshStandardMaterial({ color: '#4a9a86', metalness: 0.7, roughness: 0.4 })
    const slate = new THREE.MeshStandardMaterial({ color: '#3f4658', roughness: 0.7 })
    const lit = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd89a').multiplyScalar(1.1), toneMapped: false })
    D.push(glass, greenhouseGlass, copper, slate, lit)
    const M: ArchMats = archMats(L, 'stone', stoneTex, glass)
    const B = Frame.at(L.batch, 0, 0, 0, -Math.PI / 2) // the house: local +z = west (the drive, the forecourt, the lake)
    const WIDTH = 26
    const DEPTH = 20
    const HH = 7.2

    /* ── the house: wing blocks, plinth, string course, cornice ── */
    // left wing (x −13..−4.2): the living room, dining room and library, with the master bedroom above; the central bay (x ±4.2): hall + trophy room;
    // the kitchen block (right-back); the conservatory (right-front) is glass and has no solid block
    const block = (x0: number, x1: number, z0: number, z1: number, h: number) => B.put(boxUV(x1 - x0, h, z1 - z0, 2), M.wall, (x0 + x1) / 2, h / 2, (z0 + z1) / 2)
    block(-13, -4.2, -10, 10, HH)
    block(-4.2, 4.2, -10, 10, HH)
    block(4.2, 13, -10, 3, HH)
    B.put(boxUV(WIDTH + 0.4, 0.9, DEPTH + 0.4, 1.2), M.plinth, 0, 0.45, 0)
    B.put(boxUV(WIDTH + 0.36, 0.22, DEPTH + 0.36, 1.2), M.trim, 0, 3.55, 0)
    B.put(boxUV(WIDTH + 0.7, 0.4, DEPTH + 0.7, 1.2), M.trim, 0, HH + 0.1, 0)
    for (const sx of [-1, 1]) for (let y = 0.9, k = 0; y < HH - 0.4; y += 0.7, k++) B.put(boxUV(k % 2 ? 0.34 : 0.55, 0.34, 0.1, 1), M.trim, sx * (WIDTH / 2 - (k % 2 ? 0.17 : 0.27)), y, DEPTH / 2 + 0.05) // quoins
    // the portico bay: four columns carrying a pediment, a balcony over the door, steps up from the terrace
    const fz = DEPTH / 2
    for (const cx of [-3.4, -1.15, 1.15, 3.4]) {
      B.put(new THREE.CylinderGeometry(0.34, 0.4, 3.6, 14), P.stoneLight, cx, 1.8 + 0.1, fz + 1.5)
      B.put(boxUV(0.95, 0.3, 0.95, 1), P.stoneLight, cx, 0.25, fz + 1.5)
      B.put(boxUV(0.95, 0.3, 0.95, 1), P.stoneLight, cx, 3.75, fz + 1.5)
      L.colliders.push({ kind: 'circle', x: -(fz + 1.5), z: cx, r: 0.45, h: 4 })
    }
    B.put(boxUV(8.8, 0.5, 2.6, 1.2), P.stoneLight, 0, 4.15, fz + 1.2) // entablature
    B.put(boxUV(9.3, 0.18, 3.0, 1.2), P.stone, 0, 4.5, fz + 1.2) // balcony floor
    for (let k = -8; k <= 8; k++) B.put(new THREE.CylinderGeometry(0.05, 0.05, 0.95, 6), P.iron, k * 0.52, 5.1, fz + 2.6)
    B.put(boxUV(9.0, 0.1, 0.16, 1), P.stoneLight, 0, 5.6, fz + 2.6)
    for (const sx of [-1, 1]) B.put(boxUV(0.14, 1.1, 2.6, 1), P.stoneLight, sx * 4.55, 5.1, fz + 1.3)
    const ped = new THREE.Shape([new THREE.Vector2(-4.6, 0), new THREE.Vector2(4.6, 0), new THREE.Vector2(0, 1.9)])
    B.put(new THREE.ExtrudeGeometry(ped, { depth: 0.5, bevelEnabled: false }), P.stoneLight, 0, 6.9, fz + 0.95)
    B.put(new THREE.CircleGeometry(0.5, 16), P.gold, 0, 7.6, fz + 1.5, 0, 0, 0, false)
    for (let k = 0; k < 6; k++) B.put(boxUV(10 - k * 0.3, 0.2, 3.4, 1), P.stoneLight, 0, 0.1 + k * 0.15, fz + 1.2 + (5 - k) * 0.3 + 0.4) // steps
    // the great door: double leaves in a stone surround with a fanlight (the interior's doorway is 1.3 m: this is its outer frame)
    for (const sx of [-1, 1]) B.put(boxUV(0.55, 3.9, 0.7, 1), P.stoneLight, sx * 1.45, 1.95, fz + 0.15)
    B.put(boxUV(3.5, 0.6, 0.7, 1), P.stoneLight, 0, 4.0, fz + 0.15)
    B.put(new THREE.TorusGeometry(1.2, 0.2, 6, 16, Math.PI), P.stoneLight, 0, 3.55, fz + 0.2)
    B.put(boxUV(2.4, 3.5, 0.12, 1), M.door, 0, 1.75, fz + 0.04)
    for (const sx of [-1, 1]) for (const y of [0.9, 2.1]) B.put(boxUV(1.0, 1.0, 0.04, 1), M.frame, sx * 0.6, y, fz + 0.11)
    B.put(new THREE.PlaneGeometry(2.2, 0.8), L.P.windowLit, 0, 3.62, fz + 0.1, 0, 0, 0, false)
    for (const sx of [-1, 1]) {
      B.put(new THREE.SphereGeometry(0.16, 10, 8), P.gold, sx * 1.0, 1.2, fz + 0.18)
      B.put(new THREE.BoxGeometry(0.3, 0.42, 0.3), P.glowOrange, sx * 2.5, 2.4, fz + 0.5, 0, 0, 0, false)
      L.lights.push({ x: -(fz + 0.9), y: 2.4, z: sx * 2.5, color: '#ffb060', intensity: 4, dist: 11, priority: 2 })
    }

    /* ── windows (framed, sills, lintels; the lit ones are the rooms the interior lights) ── */
    const win = (F: Frame, x: number, y: number, w: number, h: number, litWin: boolean, z0 = 0.02) => {
      F.put(new THREE.PlaneGeometry(w, h), litWin ? P.windowLit : glass, x, y, z0, 0, 0, 0, false)
      for (const dy of [-1, 1]) F.box(w + 0.3, 0.14, 0.18, M.frame, x, y + dy * (h / 2 + 0.05), z0 + 0.05)
      for (const dx of [-1, 1]) F.box(0.12, h + 0.2, 0.18, M.frame, x + dx * (w / 2 + 0.03), y, z0 + 0.05)
      F.box(0.07, h, 0.12, M.frame, x, y, z0 + 0.04)
      F.box(w * 0.9, 0.06, 0.1, M.frame, x, y + h * 0.18, z0 + 0.04)
      F.box(w + 0.7, 0.14, 0.4, M.trim, x, y - h / 2 - 0.15, z0 + 0.14) // sill
      F.box(w + 0.7, 0.34, 0.26, M.trim, x, y + h / 2 + 0.26, z0 + 0.1) // lintel
      F.box(0.3, 0.3, 0.3, P.gold, x, y + h / 2 + 0.3, z0 + 0.18)
    }
    // front (west): the tall living-room windows left of the portico; the hall's two windows behind the columns; (the right is the glass conservatory)
    for (const x of [-8.5]) win(B.sub(x, 0, fz, 0, 0, 0), 0, 3.0, 1.5, 3.4, true)
    for (const x of [-2.8, 2.8]) win(B.sub(x, 0, fz, 0, 0, 0), 0, 3.3, 1.2, 3.2, true)
    // upper-front windows on the left wing (the master bedroom's neighbour) and over the portico balcony: French doors
    B.put(boxUV(2.2, 3.0, 0.1, 1), M.glass, 0, 6.0, fz + 0.05)
    // left wall (north): the living room + dining room windows (z 7.2, 1.0) and the master bedroom (z −5); bay window projecting off the living room
    const Lw = B.sub(-13, 0, 0, 0, -Math.PI / 2, 0) // local +z = north (outwards)
    win(Lw.sub(-1.0, 0, 0, 0, 0, 0), 0, 2.9, 1.2, 3.0, true) // dining (z 1.0 ↔ Lw x −1.0)
    win(Lw.sub(5.0, 0, 0, 0, 0, 0), 0, 5.4, 1.4, 1.6, true) // master bedroom (z −5 ↔ Lw x 5)
    const bay = Lw.sub(-7.2, 0, 0, 0, 0, 0)
    bay.put(boxUV(3.4, 3.6, 1.4, 1.4), M.wall, 0, 1.8 + 0.2, 0.7)
    bay.put(boxUV(3.6, 0.4, 1.6, 1.2), M.trim, 0, 4.0, 0.7)
    for (const sx of [-1, 0, 1]) win(bay.sub(sx * 0.95, 0, 1.42, 0, 0, 0), 0, 2.2, 0.8, 2.4, true)
    bay.put(new THREE.ConeGeometry(2.2, 1.6, 6), slate, 0, 4.9, 0.7)
    // right wall (south): kitchen block (z −8.8), the conservatory glass (z 3..10), upper guest bedroom (z −5)
    const Rw = B.sub(13, 0, 0, 0, Math.PI / 2, 0) // local +z = south (outwards)
    win(Rw.sub(8.8, 0, 0, 0, 0, 0), 0, 2.5, 1.3, 1.5, true) // kitchen (z −8.8 ↔ Rw x +8.8)
    win(Rw.sub(5.0, 0, 0, 0, 0, 0), 0, 5.4, 1.4, 1.6, true) // guest bedroom (z −5 ↔ Rw x 5)
    // back (east): kitchen window, bedrooms, the little hall window
    const Bk = B.sub(0, 0, -fz, 0, Math.PI, 0)
    win(Bk.sub(-9.4, 0, 0, 0, 0, 0), 0, 2.4, 1.3, 1.3, true)
    win(Bk.sub(9.2, 0, 0, 0, 0, 0), 0, 5.4, 1.4, 1.6, true)
    win(Bk.sub(-9.2, 0, 0, 0, 0, 0), 0, 5.4, 1.4, 1.6, true)
    win(Bk.sub(0, 0, 0, 0, 0, 0), 0, 5.6, 0.9, 1.0, false)
    // the conservatory: iron-framed glass walls on the front and the south side, a glazed ridge roof, a door onto the terrace
    {
      const cx0 = 4.2
      const cx1 = 13
      const cz0 = 3
      const cz1 = 10
      const gh = 4.4
      for (let x = cx0; x <= cx1 + 0.01; x += 1.45) {
        B.box(0.12, gh, 0.12, M.frame, x, gh / 2, cz1)
        B.box(0.1, gh, 0.1, M.frame, x, gh / 2, cz1 - 0.01)
      }
      for (let z = cz0; z <= cz1 + 0.01; z += 1.4) B.box(0.12, gh, 0.12, M.frame, cx1, gh / 2, z)
      for (const y of [0.9, 2.4, gh]) {
        B.box(cx1 - cx0, 0.1, 0.14, M.frame, (cx0 + cx1) / 2, y, cz1)
        B.box(0.14, 0.1, cz1 - cz0, M.frame, cx1, y, (cz0 + cz1) / 2)
      }
      B.put(new THREE.PlaneGeometry(cx1 - cx0, gh - 0.4), greenhouseGlass, (cx0 + cx1) / 2, gh / 2 + 0.2, cz1 - 0.02, 0, 0, 0, false)
      B.put(new THREE.PlaneGeometry(cz1 - cz0, gh - 0.4), greenhouseGlass, cx1 - 0.02, gh / 2 + 0.2, (cz0 + cz1) / 2, 0, Math.PI / 2, 0, false)
      B.put(boxUV(cx1 - cx0 + 0.3, 0.7, 0.3, 1), P.stoneLight, (cx0 + cx1) / 2, 0.35, cz1 + 0.05)
      // the glazed roof: two pitches with a ridge along z
      const rg = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-4.6, 0), new THREE.Vector2(4.6, 0), new THREE.Vector2(0, 1.9)]), { depth: cz1 - cz0 + 0.4, bevelEnabled: false })
      rg.translate(0, 0, -(cz1 - cz0 + 0.4) / 2)
      B.put(rg, greenhouseGlass, (cx0 + cx1) / 2, gh, (cz0 + cz1) / 2, 0, 0, 0, false)
      for (let k = 0; k < 6; k++) B.box(0.1, 0.1, cz1 - cz0, M.frame, cx0 + 0.4 + k * 1.6, gh + 0.9 * (1 - Math.abs(k - 2.5) / 2.6) * 0.0 + 0.05, (cz0 + cz1) / 2)
      B.box(0.14, 0.14, cz1 - cz0 + 0.5, P.gold, (cx0 + cx1) / 2, gh + 1.92, (cz0 + cz1) / 2)
      L.lights.push({ x: -8.5, y: 3.0, z: 8.6, color: '#d8ffe0', intensity: 3.5, dist: 9, priority: 2 })
    }

    /* ── roofs of different heights: a steep gable over the central bay, a hipped slate roof over the left wing, a flat-topped kitchen block, a copper lantern over the great hall ── */
    {
      const cen = gableGeo(8.8 + 1.0, DEPTH + 1.0, 4.6, 2)
      B.put(cen, slate, 0, HH + 0.2, 0)
      B.box(1.0, 0.14, DEPTH + 1.1, P.gold, 0, HH + 0.2 + 4.62, 0)
      const lw = gableGeo(8.8 + 0.6, DEPTH + 1.0, 3.2, 2)
      B.put(lw, slate, -8.6, HH + 0.2, 0)
      B.box(0.6, 0.12, DEPTH + 1.1, M.trim, -8.6, HH + 0.2 + 3.22, 0)
      // dormers on the left wing's roof
      for (const z of [-5, 0, 5]) {
        B.put(boxUV(1.6, 1.5, 1.4, 1), M.wall, -10.6, HH + 0.7, z)
        B.put(new THREE.PlaneGeometry(0.9, 0.9), L.P.windowLit, -11.4 - 0.0, HH + 0.7, z, 0, -Math.PI / 2, 0, false)
        B.put(gableGeo(1.9, 1.9, 0.9, 1), slate, -10.6, HH + 1.45, z)
      }
      // the kitchen block: a low hipped roof; the conservatory is glass
      B.put(gableGeo(8.8 + 0.6, 13 + 1.0, 2.6, 2), slate, 8.6, HH + 0.2, -3.5)
      // the copper lantern over the great hall: an octagonal drum, windows, a ribbed dome, a spire
      const dx = 0
      const dz = -1
      B.put(new THREE.CylinderGeometry(1.7, 1.9, 1.6, 8), P.stoneLight, dx, HH + 4.9, dz)
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + Math.PI / 8
        B.put(new THREE.PlaneGeometry(0.7, 0.9), L.P.windowLit, dx + Math.cos(a) * 1.75, HH + 4.9, dz + Math.sin(a) * 1.75, 0, -a + Math.PI / 2, 0, false)
      }
      B.put(new THREE.SphereGeometry(1.8, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), copper, dx, HH + 5.7, dz)
      B.put(new THREE.CylinderGeometry(0.06, 0.1, 1.6, 6), P.gold, dx, HH + 7.5, dz)
      B.put(new THREE.SphereGeometry(0.16, 8, 6), P.gold, dx, HH + 8.4, dz)
      // chimney stacks
      for (const [cx, cz, h] of [[-12.2, -6.5, 3.6], [-12.2, 3.5, 3.4], [12.0, -8.5, 2.8], [3.4, -9.0, 4.2]] as const) {
        B.put(boxUV(1.0, h, 0.9, 1), M.trim, cx, HH + 1.5 + h / 2 - 0.5, cz)
        B.put(boxUV(1.3, 0.2, 1.2, 1), P.stoneLight, cx, HH + 1.5 + h - 0.4, cz)
        for (const px of [-0.25, 0.25]) B.put(new THREE.CylinderGeometry(0.12, 0.15, 0.4, 8), M.frame, cx + px, HH + 1.5 + h + 0.0, cz)
      }
    }
    // solid for the player and the camera (house footprint in world-local axes: the room's x → world z, depth → world x)
    L.colliders.push({ kind: 'box', minX: -10.4, maxX: 10.4, minZ: -13.4, maxZ: 7.8, h: HH })
    L.colliders.push({ kind: 'box', minX: -10.4, maxX: 6.6, minZ: 7.8, maxZ: 13.4, h: HH }) // the kitchen block and conservatory (the back is solid, the glass wall too)

    /* ── forecourt + terrace: gravel court with a fountain and hedged edges; a stone terrace across the lake-facing front with a balustrade ── */
    {
      const court = new THREE.MeshStandardMaterial({ map: P.ground.map, color: '#dccaa4', roughness: 0.96 })
      D.push(court)
      const g = new THREE.CircleGeometry(15, 40).rotateX(-Math.PI / 2)
      L.batch.put(g, court, -26, 0.03, 0, 0, 1, 1, 1, { cast: false })
      // the terrace in front of the house: x −20..−10 (local), z −14..14, raised 0.5 with steps down to the court
      L.batch.put(boxUV(9.4, 0.5, 29, 1.6), P.stoneLight, -15.1, 0.25, 0)
      for (let k = 0; k < 3; k++) L.batch.put(boxUV(0.7, 0.16, 8 + k * 0.4, 1), P.stoneLight, -20.6 - k * 0.66, 0.1 + (2 - k) * 0.16, 0)
      for (let z = -14; z <= 14; z += 2) {
        if (Math.abs(z) < 5) continue
        L.batch.put(boxUV(0.4, 0.9, 1.95, 1), P.stone, -19.8, 0.95, z)
        L.batch.put(boxUV(0.55, 0.12, 2.0, 1), P.stoneLight, -19.8, 1.46, z)
      }
      for (const z of [-14, -9, 9, 14]) {
        L.batch.put(boxUV(0.7, 1.5, 0.7, 1), P.stone, -19.8, 1.25, z)
        L.batch.put(new THREE.SphereGeometry(0.2, 8, 6), P.gold, -19.8, 2.1, z)
      }
      L.colliders.push({ kind: 'box', minX: -20.2, maxX: -19.4, minZ: -14.4, maxZ: -5, h: 1.4 })
      L.colliders.push({ kind: 'box', minX: -20.2, maxX: -19.4, minZ: 5, maxZ: 14.4, h: 1.4 })
      // the fountain: a stepped basin, a column, a gilded finial, jets of light
      const fx = -29
      L.batch.put(new THREE.CylinderGeometry(3.4, 3.6, 0.7, 28), P.stoneLight, fx, 0.35, 0)
      L.batch.put(new THREE.CylinderGeometry(3.0, 3.0, 0.1, 28), P.glowTeal, fx, 0.7, 0, 0, 1, 1, 1, { cast: false })
      L.batch.put(new THREE.CylinderGeometry(0.5, 0.8, 1.6, 12), P.stone, fx, 1.5, 0)
      L.batch.put(new THREE.CylinderGeometry(1.3, 0.5, 0.35, 16), P.stoneLight, fx, 2.2, 0)
      L.batch.put(new THREE.SphereGeometry(0.34, 10, 8), P.gold, fx, 2.7, 0)
      L.colliders.push({ kind: 'circle', x: fx, z: 0, r: 3.7, h: 1 })
      L.lights.push({ x: fx, y: 3.4, z: 0, color: '#bfe8ff', intensity: 4, dist: 12, priority: 2 })
      for (const [bx, bz, ry] of [[-26, 6.2, Math.PI], [-26, -6.2, 0], [-31, 4.5, Math.PI / 2]] as const) parkBench(L, bx, bz, ry, 'Sit in the manor court', seats)
      for (const z of [-13, -9, 9, 13]) flowerTub(L, -22.2, z, { long: 2.2, ry: Math.PI / 2 })
    }

    /* ── the ornate gates: stone piers, a wrought-iron arch and a lettered name, estate walls running off to either side ── */
    {
      const gx = -34
      for (const sz of [-1, 1]) {
        L.batch.put(boxUV(1.5, 4.4, 1.5, 1.6), P.stone, gx, 2.2, sz * 3.9)
        L.batch.put(boxUV(1.9, 0.3, 1.9, 1.2), P.stoneLight, gx, 4.55, sz * 3.9)
        L.batch.put(new THREE.ConeGeometry(1.2, 1.6, 4).rotateY(Math.PI / 4), P.stoneLight, gx, 5.5, sz * 3.9)
        L.batch.put(new THREE.SphereGeometry(0.3, 10, 8), P.gold, gx, 6.5, sz * 3.9)
        L.colliders.push({ kind: 'box', minX: gx - 0.85, maxX: gx + 0.85, minZ: sz * 3.9 - 0.85, maxZ: sz * 3.9 + 0.85, h: 5 })
        // gate leaf swung fully open against its pier: bars + gilded finials lying along the drive's edge
        for (let k = 0; k < 6; k++) {
          const lx = gx - 0.7 - k * 0.36
          L.batch.put(new THREE.BoxGeometry(0.05, 3.0 + Math.sin((k / 5) * Math.PI) * 0.3, 0.05), P.iron, lx, 1.6, sz * 3.0)
          L.batch.put(new THREE.ConeGeometry(0.07, 0.2, 4), P.gold, lx, 3.25 + Math.sin((k / 5) * Math.PI) * 0.3, sz * 3.0)
        }
        L.batch.put(new THREE.BoxGeometry(2.0, 0.08, 0.06), P.iron, gx - 1.7, 0.4, sz * 3.0)
        L.batch.put(new THREE.BoxGeometry(2.0, 0.08, 0.06), P.iron, gx - 1.7, 2.6, sz * 3.0)
      }
      L.batch.put(new THREE.TorusGeometry(3.9, 0.12, 8, 28, Math.PI).rotateZ(0).rotateY(Math.PI / 2), P.iron, gx, 4.55, 0)
      L.batch.put(new THREE.TorusGeometry(3.3, 0.08, 8, 28, Math.PI).rotateY(Math.PI / 2), P.iron, gx, 4.55, 0)
      const gold = new THREE.MeshStandardMaterial({ color: '#ffcf5a', metalness: 0.85, roughness: 0.3, ...(night ? { emissive: '#ff9a1a', emissiveIntensity: 0.7 } : {}) })
      D.push(gold)
      const GF = Frame.at(L.batch, gx - 0.4, 6.0, 0, -Math.PI / 2)
      channelLetters(GF.sub(0, 0, 0), 'MOONCREST MANOR', 0.55, 0.14, gold)
      const GF2 = Frame.at(L.batch, gx + 0.4, 6.0, 0, Math.PI / 2)
      channelLetters(GF2.sub(0, 0, 0), 'MOONCREST MANOR', 0.55, 0.14, gold)
      // estate walls + hedges either side, following the plateau edge
      for (const sz of [-1, 1])
        for (let k = 0; k < 7; k++) {
          const a = 0.34 + k * 0.1
          const wx = -26 - Math.cos(a) * 11
          const wz = sz * (4.8 + k * 2.4)
          L.batch.put(boxUV(0.55, 1.5, 2.5, 1.4), P.stone, gx + 0.8, 0.75, wz)
          L.batch.put(boxUV(0.7, 0.14, 2.6, 1), P.stoneLight, gx + 0.8, 1.55, wz)
          L.batch.put(new THREE.SphereGeometry(0.7, 8, 6).scale(1.1, 1.2, 1.5), P.foliageDark, gx + 1.5, 1.2, wz)
          L.colliders.push({ kind: 'box', minX: gx + 0.5, maxX: gx + 1.1, minZ: wz - 1.25, maxZ: wz + 1.25, h: 1.5 })
          void wx
          void a
        }
      const sign = new THREE.MeshStandardMaterial({ map: panelTexture('MOONCREST MANOR', 'private grounds · visitors welcome by the lantern road', 3.0, PANEL.dark, D), roughness: 0.6 })
      D.push(sign)
      postedBoard(Frame.at(L.batch, gx - 2.4, 0, -5.4, Math.PI / 2 + 0.4), 1.9, 0.8, 1.2, sign, SMt(P), true)
    }

    /* ── the walled garden (north), its greenhouse, an octagonal pavilion, the carriage house (south-east), framing trees ── */
    {
      const gx = 4
      const gz = -26
      for (const [w, d, x, z] of [[24, 0.5, gx, gz - 7], [24, 0.5, gx, gz + 7], [0.5, 14, gx - 12, gz], [0.5, 14, gx + 12, gz]] as const) {
        L.batch.put(boxUV(w, 2.2, d, 1.4), P.stone, x, 1.1, z)
        L.batch.put(boxUV(w + 0.2, 0.16, d + 0.2, 1), P.stoneLight, x, 2.28, z)
      }
      L.colliders.push({ kind: 'box', minX: gx - 12.3, maxX: gx + 12.3, minZ: gz - 7.3, maxZ: gz - 6.7, h: 2.2 })
      L.colliders.push({ kind: 'box', minX: gx - 12.3, maxX: gx - 11.7, minZ: gz - 7.3, maxZ: gz + 7.3, h: 2.2 })
      L.colliders.push({ kind: 'box', minX: gx + 11.7, maxX: gx + 12.3, minZ: gz - 7.3, maxZ: gz + 7.3, h: 2.2 })
      L.colliders.push({ kind: 'box', minX: gx - 12.3, maxX: gx + 12.3, minZ: gz + 6.7, maxZ: gz + 7.3, h: 2.2 }) // (the garden gate is on its west side: see below)
      // the gate gap in the west wall (a doorway in the wall) — remove the wall piece by leaving a 2.4 m opening: the collider above spans the whole wall, so the opening is on the south side instead
      L.batch.put(boxUV(0.4, 2.8, 0.4, 1), P.stoneLight, gx - 12, 1.4, gz + 1.5)
      // inside: beds of pumpkins and flowers, paths, a sundial, the greenhouse against the north wall, an apple tree
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
        L.batch.put(boxUV(5.4, 0.3, 1.6, 1), P.soil, gx - 6.8 + c * 6.6, 0.15, gz - 1.5 + r * 2.4 - (r > 1 ? 0 : 0))
        for (let k = 0; k < 4; k++) L.batch.put(new THREE.SphereGeometry(0.34, 8, 6).scale(1, 0.75, 1), (r + c) % 2 ? P.pumpkin : P.foliage, gx - 8.4 + c * 6.6 + k * 1.3, 0.55, gz - 1.5 + r * 2.4)
      }
      const gh = Frame.at(L.batch, gx, 0, gz - 6.4, 0)
      for (let x = -5.5; x <= 5.51; x += 1.1) gh.box(0.08, 2.4, 0.08, M.frame, x, 1.2, 1.4)
      gh.put(new THREE.PlaneGeometry(11, 2.2), greenhouseGlass, 0, 1.2, 1.4, 0, 0, 0, false)
      const sl = new THREE.PlaneGeometry(11, 2.2).rotateX(-Math.PI / 2 + 0.7)
      gh.put(sl, greenhouseGlass, 0, 2.9, 0.4, 0, 0, 0, false)
      gh.put(boxUV(11.2, 0.6, 0.3, 1), P.stoneLight, 0, 0.3, 1.45)
      L.lights.push({ x: gx, y: 1.6, z: gz - 5.5, color: '#d8ffe0', intensity: 3, dist: 9, priority: 2 })
      // the octagonal pavilion (a cream-roofed summer house) at the garden's east end
      const px = gx + 8.4
      const pz = gz + 3.4
      L.batch.put(new THREE.CylinderGeometry(2.4, 2.6, 0.3, 8), P.stoneLight, px, 0.15, pz)
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2
        L.batch.put(new THREE.CylinderGeometry(0.1, 0.12, 2.6, 6), P.woodLight, px + Math.cos(a) * 2.1, 1.6, pz + Math.sin(a) * 2.1)
      }
      L.batch.put(new THREE.ConeGeometry(3.0, 1.6, 8), slate, px, 3.7, pz)
      L.batch.put(new THREE.SphereGeometry(0.16, 8, 6), P.gold, px, 4.6, pz)
      L.colliders.push({ kind: 'circle', x: px, z: pz, r: 2.4, h: 3 })
      L.batch.put(new THREE.CylinderGeometry(0.2, 0.28, 0.9, 8), P.stoneLight, gx, 0.45, gz + 2.5)
      L.batch.put(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 12), P.gold, gx, 0.93, gz + 2.5)
      // the carriage house (south-east): brick-and-stone, two arched doors, a clock, a vintage car inside the open bay
      const cx = 14
      const cz = 22
      const CF = Frame.at(L.batch, cx, 0, cz, Math.PI)
      CF.put(boxUV(12, 4.4, 7, 2), M.wall, 0, 2.2, 0)
      CF.put(boxUV(12.3, 0.4, 7.3, 1), M.trim, 0, 4.5, 0)
      CF.put(gableGeo(7.8, 12.6, 2.6, 2), slate, 0, 4.6, 0)
      for (const sx of [-1, 1]) {
        CF.put(new THREE.ShapeGeometry(archShape(1.6, 3.0)), P.iron, sx * 2.9, 0.1, 3.54, 0, 0, 0, false)
        CF.put(new THREE.TorusGeometry(1.6, 0.14, 6, 16, Math.PI), P.stoneLight, sx * 2.9, 3.1, 3.58)
        for (const dx of [-1.6, 1.6]) CF.box(0.3, 3.1, 0.3, P.stoneLight, sx * 2.9 + dx, 1.55, 3.55)
      }
      CF.put(new THREE.CircleGeometry(0.5, 16), P.gold, 0, 5.4, 3.6, 0, 0, 0, false)
      heroCarAt(CF.sub(-2.9, 0.1, 5.4, 0, 0.35, 0), T.scene, CARS[1].paint)
      L.colliders.push({ kind: 'box', minX: cx - 3.8, maxX: cx + 3.8, minZ: cz - 6.2, maxZ: cz + 6.2, h: 4.4 })
      // framing trees (mixed), planted deliberately so the lake stays visible from the terrace
      const treePts: [number, number, number, number][] = [[18, -14, 1.2, 0], [20, 6, 1.3, 1], [22, 16, 1.1, 0], [-8, -34, 1.2, 1], [12, -37, 1.0, 0], [-16, 24, 1.15, 0], [-8, 33, 1.2, 1], [26, -2, 1.0, 2], [-34, -16, 1.25, 0], [-34, 16, 1.25, 1], [-14, -18, 1.0, 2]]
      const leafA = new THREE.MeshStandardMaterial({ color: '#c8661c', roughness: 0.92, flatShading: true })
      const leafG = new THREE.MeshStandardMaterial({ color: '#40703e', roughness: 0.92, flatShading: true })
      D.push(leafA, leafG)
      for (const [tx, tz, s, k] of treePts) {
        plantCrown(L.batch, k === 0 ? leafA : leafG, P.bark, tx, 0, tz, s, k === 1 ? 'spread' : k === 2 ? 'oval' : 'broad', Math.round(tx * 5 + tz))
        L.colliders.push({ kind: 'circle', x: tx, z: tz, r: 0.5, h: 5 })
      }
      void R
      // lantern posts along the court and the terrace
      for (const [lx, lz] of [[-22, -8], [-22, 8], [-36, -8.5], [-36, 8.5], [-14, -15], [-14, 15], [10, 20], [6, -19]] as const) {
        L.batch.put(new THREE.CylinderGeometry(0.06, 0.09, 2.8, 6), P.iron, lx, 1.4, lz)
        L.batch.put(new THREE.BoxGeometry(0.24, 0.32, 0.24), P.glowOrange, lx, 2.95, lz, 0, 1, 1, 1, { cast: false })
        L.batch.put(new THREE.ConeGeometry(0.26, 0.22, 4).rotateY(Math.PI / 4), P.iron, lx, 3.2, lz)
        L.lights.push({ x: lx, y: 2.95, z: lz, color: '#ffb060', intensity: 3.6, dist: 10, priority: 1 })
        L.colliders.push({ kind: 'circle', x: lx, z: lz, r: 0.22, h: 3 })
      }
    }
    // the shoreline viewpoint pavilion is built at the foot of the garden path, in world space (below)
    void toLocal
  })

  /* the viewpoint at the end of the garden path: a stone belvedere over the water with a bench and a lantern */
  inFrame(T, { x: VIEWPOINT.x, y: VIEWPOINT.y, z: VIEWPOINT.z }, false, (L) => {
    const P = L.P
    L.batch.put(new THREE.CylinderGeometry(3.4, 3.7, 0.5, 14), P.stoneLight, 0, 0.25, 0)
    for (let k = 0; k <= 10; k++) {
      const a = Math.PI * (0.5 + (k / 10) * 1.0)
      L.batch.put(boxUV(0.5, 1.1, 0.5, 1), P.stone, Math.cos(a) * 3.2, 1.0, Math.sin(a) * 3.2, -a)
      L.batch.put(new THREE.SphereGeometry(0.14, 8, 6), P.gold, Math.cos(a) * 3.2, 1.65, Math.sin(a) * 3.2)
      L.colliders.push({ kind: 'circle', x: Math.cos(a) * 3.2, z: Math.sin(a) * 3.2, r: 0.3, h: 1.2 })
    }
    L.batch.put(boxUV(1.7, 0.08, 0.5, 1), P.woodLight, 0.2, 0.9, 0.2)
    L.batch.put(new THREE.CylinderGeometry(0.06, 0.09, 2.7, 6), P.iron, -2.2, 1.85, 1.2)
    L.batch.put(new THREE.BoxGeometry(0.22, 0.3, 0.22), P.glowOrange, -2.2, 3.3, 1.2, 0, 1, 1, 1, { cast: false })
    L.lights.push({ x: -2.2, y: 3.3, z: 1.2, color: '#ffb060', intensity: 4, dist: 11, priority: 2 })
  })
  void VALLEY_Y
  void MANOR_PAD
}

function archShape(r: number, h: number) {
  const s = new THREE.Shape()
  s.moveTo(-r, 0)
  s.lineTo(r, 0)
  s.lineTo(r, h - r)
  s.absarc(0, h - r, r, 0, Math.PI, false)
  s.lineTo(-r, 0)
  return s
}
