import * as THREE from 'three'
import type { Town } from './buildings'
import { CASTLE_Z } from './props'
import { isNight } from './daylight'
import { boxUV, rng } from './kit'
import { Frame, PANEL, boardTexture, channelLetters, lectern, panelTexture, postedBoard, type SignMats } from './signs'
import type { styleMaterials } from './style'

type SM = ReturnType<typeof styleMaterials>

/** the citadel's door + forecourt anchors (World uses them for the inspect prompts) */
export const CITADEL = { doorZ: CASTLE_Z + 1.25, forecourt: { x0: -6, x1: 6, z0: -23.8, z1: -11.5 }, lore: { x: -4.4, z: -21.4 }, notice: { x: 4.75, z: -22.9 } }

/**
 * CHAD CITADEL gatehouse + forecourt. Replaces the old block door: a deep gatehouse with battlements and a
 * machicolation gallery, recessed lancet windows, a stepped arch surround with a crown keystone, recessed timber
 * double doors (planks, iron strap hinges, studs, ring handles) on a stone threshold, the CHAD CITADEL nameplate,
 * and a paved forecourt with flagpoles, topiary planters, a lore lectern and a "closed for now" notice.
 */
export function citadel(T: Town, M: SM) {
  const P = T.P
  const Dp = T.disposables
  const Z = CASTLE_Z
  const front = Z + 1.3 // gatehouse front face (the approach platform stops just in front of it)
  const sill = 0.88 // the platform at the top of the steps
  const W = 10
  const H = 13
  const DEP = 5
  const signM: SignMats = { frame: P.iron, metal: P.iron, gold: P.gold, stone: M.trim }
  const timber = new THREE.MeshStandardMaterial({ map: P.woodLight.map, color: '#7a4e2c', roughness: 0.75 })
  const timberDark = new THREE.MeshStandardMaterial({ map: P.woodLight.map, color: '#5a3820', roughness: 0.8 })
  const ironM = new THREE.MeshStandardMaterial({ color: '#22211f', metalness: 0.75, roughness: 0.45 })
  const reveal = new THREE.MeshStandardMaterial({ map: M.stone.map, color: '#8d7f6a', roughness: 0.95 })
  const nameMat = new THREE.MeshStandardMaterial({ color: '#e8b04a', metalness: 0.4, roughness: 0.45, ...(isNight() ? { emissive: '#ffa648', emissiveIntensity: 1.6 } : {}) })
  Dp.push(timber, timberDark, ironM, reveal, nameMat)

  // ── gatehouse body: stone mass with a plinth, string courses, machicolation gallery + crenellations ──
  const cz = front - DEP / 2
  // the body: a solid back block + a 1.25 m front slab with the doorway cut out of it (round-headed opening)
  const SLAB = 1.25
  T.batch.put(boxUV(W, H, DEP - SLAB, 2.5), M.stone, 0, H / 2, cz - SLAB / 2)
  {
    const OPENW = 1.85
    const spring = 0.88 + 3.2
    const sh = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(W / 2, H), new THREE.Vector2(-W / 2, H)])
    const hole = new THREE.Path()
    hole.moveTo(-OPENW, 0.9)
    hole.lineTo(OPENW, 0.9)
    hole.lineTo(OPENW, spring)
    hole.absarc(0, spring, OPENW, 0, Math.PI, false)
    hole.lineTo(-OPENW, 0.9)
    sh.holes.push(hole)
    const slab = new THREE.ExtrudeGeometry(sh, { depth: SLAB, bevelEnabled: false, curveSegments: 20 })
    const u = slab.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) / 2.5, u.getY(i) / 2.5)
    T.batch.put(slab, M.stone, 0, 0, front - SLAB)
  }
  T.batch.put(boxUV(W + 0.4, 0.9, DEP + 0.4, 1.5), M.trim, 0, 0.45, cz)
  for (const y of [6.6, 10.1]) T.batch.put(boxUV(W + 0.2, 0.22, DEP + 0.2, 1.4), M.trim, 0, y, cz)
  // gallery: a projecting parapet on corbels
  T.batch.put(boxUV(W + 1.0, 1.3, 0.7, 1.5), M.stone, 0, H - 0.2, front + 0.3)
  for (let k = 0; k < 9; k++) T.batch.put(boxUV(0.4, 0.6, 0.6, 1), M.trim, -W / 2 + 0.6 + k * ((W - 1.2) / 8), H - 1.15, front + 0.3)
  for (let k = 0; k < 6; k++) T.batch.put(boxUV(1.0, 0.9, 0.75, 1), M.stone, -W / 2 - 0.1 + k * ((W + 0.2) / 5.5) + 0.5, H + 0.9, front + 0.3)
  // lancet windows (recessed, framed, with a stone hood) either side above the nameplate
  for (const sx of [-2.8, 2.8]) {
    T.batch.put(new THREE.BoxGeometry(0.9, 1.6, 0.3), reveal, sx, 8.85, front - 0.1)
    T.batch.put(new THREE.PlaneGeometry(0.62, 1.3), P.windowLit, sx, 8.8, front + 0.06, 0, 1, 1, 1, { cast: false })
    T.batch.put(new THREE.CircleGeometry(0.31, 12, 0, Math.PI), P.windowLit, sx, 9.45, front + 0.06, 0, 1, 1, 1, { cast: false })
    T.batch.put(boxUV(1.2, 0.16, 0.3, 1), M.trim, sx, 8.06, front + 0.14)
    T.batch.put(new THREE.TorusGeometry(0.5, 0.09, 6, 14, Math.PI), M.trim, sx, 9.45, front + 0.1)
  }
  // collision: the gatehouse (the doors are part of it — closed)
  T.colliders.push({ kind: 'box', minX: -W / 2, maxX: W / 2, minZ: cz - DEP / 2, maxZ: front + 0.35, h: H })

  // ── the arch: stepped surround (two orders of voussoirs) with a crown keystone, a deep reveal ──
  const OPEN = 1.85 // half-width of the doorway
  const SPRING = sill + 3.2
  for (const [r0, r1, depth, mat, zoff] of [[OPEN, OPEN + 0.45, 0.32, M.trim, 0.04], [OPEN + 0.45, OPEN + 0.85, 0.2, M.stone, 0.1]] as const) {
    const sh = new THREE.Shape()
    sh.moveTo(r1, 0)
    sh.absarc(0, 0, r1, 0, Math.PI, false)
    sh.lineTo(-r0, 0)
    sh.absarc(0, 0, r0, Math.PI, 0, true)
    sh.closePath()
    const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 20 })
    T.batch.put(g, mat, 0, SPRING, front + zoff - depth + 0.3)
    // jambs below the springing line
    for (const s of [-1, 1]) T.batch.put(boxUV(r1 - r0, SPRING - sill, depth, 1), mat, s * (r0 + (r1 - r0) / 2), sill + (SPRING - sill) / 2, front + zoff - depth / 2 + 0.3)
  }
  T.batch.put(boxUV(0.62, 0.8, 0.5, 1), M.trim, 0, SPRING + OPEN + 0.25, front + 0.25)
  const crown = new THREE.Shape([[-1, 0], [1, 0], [1.08, 1.0], [0.62, 0.62], [0.32, 1.25], [0, 0.72], [-0.32, 1.25], [-0.62, 0.62], [-1.08, 1.0]].map(([a, b]) => new THREE.Vector2(a * 0.22, b * 0.22)))
  T.batch.put(new THREE.ExtrudeGeometry(crown, { depth: 0.05, bevelEnabled: false }), P.gold, 0, SPRING + OPEN + 0.1, front + 0.51)
  // the reveal: dark stone soffit + side walls, 0.9 m deep
  const rz = front - 0.6
  for (const s of [-1, 1]) T.batch.put(new THREE.BoxGeometry(0.2, SPRING - sill, 0.9), reveal, s * (OPEN - 0.1), sill + (SPRING - sill) / 2, rz)
  {
    const sh = new THREE.Shape()
    sh.moveTo(OPEN, 0)
    sh.absarc(0, 0, OPEN, 0, Math.PI, false)
    sh.lineTo(-OPEN + 0.2, 0)
    sh.absarc(0, 0, OPEN - 0.2, Math.PI, 0, true)
    sh.closePath()
    T.batch.put(new THREE.ExtrudeGeometry(sh, { depth: 0.9, bevelEnabled: false, curveSegments: 20 }), reveal, 0, SPRING, rz - 0.45)
  }
  // threshold slab + a worn step
  T.batch.put(boxUV(OPEN * 2 + 0.4, 0.12, 1.2, 1), M.trim, 0, sill + 0.06, front - 0.45)

  // ── the doors: two leaves of vertical planks filling the arch, set back in the reveal ──
  const dz = front - 0.95
  const leafW = OPEN - 0.06
  const R = rng(7)
  for (const s of [-1, 1]) {
    const cx = s * (leafW / 2 + 0.02)
    const nPl = 6
    for (let k = 0; k < nPl; k++) {
      const px = cx - leafW / 2 + (leafW / nPl) * (k + 0.5)
      // plank height follows the arch: taller toward the centre
      const ax = Math.abs(px)
      const top = SPRING + Math.sqrt(Math.max(0, (OPEN - 0.04) ** 2 - ax * ax)) - 0.04
      const h = top - (sill + 0.12)
      T.batch.put(boxUV(leafW / nPl - 0.012, h, 0.12, 1), R() < 0.5 ? timber : timberDark, px, sill + 0.12 + h / 2, dz)
    }
    // iron straps with strap hinges (long arrowed bands from the outer edge), studs, a ring handle
    for (const y of [sill + 0.7, sill + 1.9, sill + 3.0]) {
      const len = leafW * 0.92
      T.batch.put(new THREE.BoxGeometry(len, 0.09, 0.03), ironM, cx, y, dz + 0.075)
      T.batch.put(new THREE.ConeGeometry(0.08, 0.16, 4).rotateZ(s > 0 ? Math.PI / 2 : -Math.PI / 2), ironM, cx - s * (len / 2 + 0.06), y, dz + 0.075)
      T.batch.put(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 8), ironM, s * (OPEN - 0.08), y, dz + 0.06)
      for (let k = 0; k < 5; k++) T.batch.put(new THREE.SphereGeometry(0.025, 6, 4), ironM, cx - len / 2 + 0.12 + k * ((len - 0.24) / 4), y, dz + 0.1)
    }
    T.batch.put(new THREE.TorusGeometry(0.12, 0.02, 6, 16), P.gold, s * 0.24, sill + 1.35, dz + 0.12)
    T.batch.put(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 10).rotateX(Math.PI / 2), P.gold, s * 0.24, sill + 1.47, dz + 0.09)
  }
  T.batch.put(new THREE.BoxGeometry(0.04, SPRING + OPEN - sill - 0.2, 0.14), ironM, 0, sill + (SPRING + OPEN - sill - 0.2) / 2 + 0.06, dz + 0.01) // meeting stile

  // ── nameplate: CHAD CITADEL in raised gilt letters on a dark stone panel above the arch ──
  T.batch.put(boxUV(6.4, 0.95, 0.18, 1), reveal, 0, 7.15, front + 0.09)
  for (const y of [6.66, 7.64]) T.batch.put(boxUV(6.6, 0.08, 0.26, 1), M.trim, 0, y, front + 0.13)
  channelLetters(Frame.at(T.batch, 0, 6.85, front + 0.2, 0), 'CHAD CITADEL', 0.58, 0.07, nameMat)

  // ── forecourt: paving with a stone border, flagpoles, topiary planters, a lore lectern, a notice ──
  const { x0, x1, z0, z1 } = CITADEL.forecourt
  {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2)
    const u = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < u.count; i++) u.setXY(i, (u.getX(i) * (x1 - x0)) / 2.4, (u.getY(i) * (z1 - z0)) / 2.4)
    T.batch.put(g, P.stoneLight, (x0 + x1) / 2, 0.026, (z0 + z1) / 2, 0, 1, 1, 1, { cast: false })
    for (const x of [x0, x1]) T.batch.put(boxUV(0.3, 0.06, z1 - z0, 1), M.trim, x, 0.03, (z0 + z1) / 2, 0, 1, 1, 1, { cast: false })
    for (let z = z0 + 2; z < z1; z += 3) T.batch.put(new THREE.BoxGeometry(x1 - x0, 0.01, 0.2), M.trim, 0, 0.032, z, 0, 1, 1, 1, { cast: false })
  }
  const flagTex = (() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 160
    const g = c.getContext('2d')!
    g.fillStyle = '#e8641a'
    g.fillRect(0, 0, 256, 160)
    g.fillStyle = '#1c1820'
    g.beginPath()
    g.moveTo(78, 112)
    g.lineTo(178, 112)
    g.lineTo(186, 52)
    g.lineTo(156, 78)
    g.lineTo(128, 36)
    g.lineTo(100, 78)
    g.lineTo(70, 52)
    g.closePath()
    g.fill()
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    Dp.push(t)
    return t
  })()
  const flagMat = new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.8 })
  Dp.push(flagMat)
  const flags: { mesh: THREE.Mesh; base: Float32Array }[] = []
  for (const x of [x0 - 0.9, x1 + 0.9])
    for (const z of [z0 + 2.4, z1 - 2.4]) {
      T.batch.put(new THREE.CylinderGeometry(0.07, 0.1, 7.5, 10), P.iron, x, 3.75, z)
      T.batch.put(new THREE.SphereGeometry(0.13, 10, 8), P.gold, x, 7.6, z)
      T.batch.put(boxUV(0.6, 0.4, 0.6, 1), M.trim, x, 0.2, z)
      T.colliders.push({ kind: 'circle', x, z, r: 0.38, h: 7.5 })
      const fg = new THREE.PlaneGeometry(1.8, 1.1, 12, 4).translate(0.9, 0, 0)
      const m = new THREE.Mesh(fg, flagMat)
      m.position.set(x + 0.05, 6.8, z)
      m.rotation.y = x < 0 ? 0 : Math.PI
      T.scene.add(m)
      Dp.push(fg)
      flags.push({ mesh: m, base: (fg.attributes.position.array as Float32Array).slice() })
    }
  // flags ripple in the breeze (vertex wave, amplitude grows toward the free edge)
  T.dynamic.push({
    update: (t) => {
      for (const [i, f] of flags.entries()) {
        const pos = f.mesh.geometry.attributes.position as THREE.BufferAttribute
        for (let k = 0; k < pos.count; k++) {
          const bx = f.base[k * 3]
          pos.setZ(k, Math.sin(bx * 2.6 - t * 3.2 + i) * 0.12 * (bx / 1.8))
        }
        pos.needsUpdate = true
      }
    },
  })
  // shrubs in low stone planters along the forecourt edges (leafy FoliageBuilder bushes, planted by vegetation())
  const pots: [number, number, number, number][] = []
  // (kept clear of the steward's and Widow Marrow's front doors at z ≈ -19)
  for (const x of [x0 - 0.2, x1 + 0.2])
    for (const z of [z1 - 1.2, z1 - 4.5]) {
      T.batch.put(boxUV(1.3, 0.5, 1.3, 1), M.trim, x, 0.25, z)
      T.batch.put(boxUV(1.12, 0.04, 1.12, 1), P.soil, x, 0.5, z, 0, 1, 1, 1, { cast: false })
      pots.push([x, 0.48, z, 0.95])
      T.colliders.push({ kind: 'box', minX: x - 0.7, maxX: x + 0.7, minZ: z - 0.7, maxZ: z + 0.7, h: 1.8 })
    }
  // the lore lectern + the notice (doors are closed; a physical sign says so)
  const lore = new THREE.MeshStandardMaterial({
    map: boardTexture('CHAD CITADEL', ['Seat of the Pump King. Built in a', 'single, very long leg day. Its gates', 'open to the people in a future update.'], 1.6, { bg: '#7a5a2a', ink: '#ffe9b8', sub: '#f6e2b4', rule: '#e0b860' }, Dp, true),
    metalness: 0.7,
    roughness: 0.4,
  })
  Dp.push(lore)
  lectern(Frame.at(T.batch, CITADEL.lore.x, 0, CITADEL.lore.z, 0.5), 0.7, 0.44, lore, signM)
  T.colliders.push({ kind: 'circle', x: CITADEL.lore.x, z: CITADEL.lore.z, r: 0.45, h: 1.1 })
  const notice = new THREE.MeshStandardMaterial({ map: panelTexture('GATES CLOSED', 'the King is training · opens soon', 2.4, PANEL.cream, Dp), roughness: 0.75 })
  Dp.push(notice)
  // stands at the foot of the citadel steps, beside (not across) the approach to the doors
  postedBoard(Frame.at(T.batch, CITADEL.notice.x, 0, CITADEL.notice.z, -0.2), 1.7, 0.7, 1.15, notice, signM, true)
  T.colliders.push({ kind: 'box', minX: CITADEL.notice.x - 0.9, maxX: CITADEL.notice.x + 0.9, minZ: CITADEL.notice.z - 0.25, maxZ: CITADEL.notice.z + 0.25, h: 2 })
  return pots
}
