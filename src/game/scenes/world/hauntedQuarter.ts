import * as THREE from 'three'
import type { Town } from './buildings'
import { boxUV, gableGeo } from './kit'
import { DISTRICTS, HQ } from './city'
import { Frame, PANEL, channelLetters, hangingSign, panelTexture, postedBoard, type SignMats } from './signs'
import { isNight } from './daylight'

/**
 * THE HAUNTED QUARTER — the old west end, through the iron gate where the market road runs out.
 * Two crooked lanes (the main lane runs west from the gate, the cross lane north–south) meet at a little square
 * with a broken fountain and a dead oak. Seven haunted houses — no two alike — and a graveyard with a crypt.
 * Every house (and the crypt) is enterable: see interiors/haunted.ts for what's inside.
 * Cold green door lanterns, boarded windows, a few that glow from within, low mist in the lanes.
 */
export type HauntedHouse = {
  id: string
  x: number
  z: number
  /** the direction the front door faces (yaw: door looks along (sin, cos)) */
  yaw: number
  w: number
  d: number
  floors: 1 | 2 | 3
  roof: 'steep' | 'gable' | 'mansard' | 'turret'
  /** the house leans (shear per metre of height) */
  lean?: number
  wall: string
  /** window glow: some haunted houses still have a light on */
  glow?: string
  /** fraction of windows boarded up */
  boarded?: number
  tower?: boolean
  porch?: boolean
  fence?: boolean
}

export const HAUNTED_HOUSES: HauntedHouse[] = [
  { id: 'crooked', x: -64.6, z: -5.2, yaw: 0, w: 5, d: 5, floors: 3, roof: 'steep', lean: 0.07, wall: '#4a4250', glow: '#9affc8', boarded: 0.3 },
  { id: 'apothecary', x: -72.6, z: -5.6, yaw: 0, w: 6.4, d: 6, floors: 2, roof: 'mansard', wall: '#3a4a44', glow: '#c8ff8a', boarded: 0.2, porch: true },
  { id: 'ravenswood', x: -92, z: -9.4, yaw: 0, w: 12, d: 9, floors: 3, roof: 'turret', wall: '#3a3440', glow: '#ffb86a', boarded: 0.35, fence: true },
  { id: 'dollmaker', x: -65.2, z: 9.4, yaw: Math.PI, w: 6, d: 5, floors: 2, roof: 'gable', lean: -0.03, wall: '#5a4448', glow: '#ff9ac8', boarded: 0.15 },
  { id: 'widow', x: -73.8, z: 10.2, yaw: Math.PI, w: 5.6, d: 6, floors: 2, roof: 'steep', wall: '#2e3440', glow: '#a8c8ff', tower: true },
  { id: 'lanternless', x: -86.8, z: 14.6, yaw: Math.PI / 2, w: 6, d: 7, floors: 2, roof: 'gable', lean: 0.04, wall: '#2a2a2e', boarded: 0.6 },
  { id: 'gravedigger', x: -73.8, z: 18.8, yaw: -Math.PI / 2, w: 4.6, d: 4.2, floors: 1, roof: 'steep', wall: '#4a4036', glow: '#ffb070' },
]
/** the crypt in the graveyard (enterable): door faces east, toward the cross lane */
export const CRYPT = { id: 'crypt', x: -96.5, z: 20.2, yaw: Math.PI / 2, w: 4.6, d: 5.4 }

export function hauntedQuarter(T: Town, stone: THREE.Material, trim: THREE.Material) {
  const P = T.P
  const D = T.disposables
  const night = isNight()
  const std = (p: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.9, ...p })
    D.push(m)
    return m
  }
  const glowM = (c: string, k = 1.8) => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(night ? k : k * 0.55), toneMapped: false })
    D.push(m)
    return m
  }
  const H = DISTRICTS.haunted
  const HX1 = -58 // the quarter's drawn ground ends at the gate; its walkable rect reaches 2 m further east so the seam can be crossed
  const LZ = HQ.laneZ
  const CX = HQ.crossX

  /* ── ground: dead grass, the lanes, the square ── */
  {
    const g = new THREE.PlaneGeometry(HX1 - H.x0, H.z1 - H.z0).rotateX(-Math.PI / 2)
    const u = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < u.count; i++) u.setXY(i, (u.getX(i) * (HX1 - H.x0)) / 6, (u.getY(i) * (H.z1 - H.z0)) / 6)
    T.batch.put(g, std({ map: P.ground.map, color: '#5a5040', roughness: 1 }), (H.x0 + HX1) / 2, 0.008, (H.z0 + H.z1) / 2, 0, 1, 1, 1, { cast: false })
    const lane = (x0: number, x1: number, z0: number, z1: number) => {
      const lg = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2)
      const lu = lg.attributes.uv as THREE.BufferAttribute
      for (let i = 0; i < lu.count; i++) lu.setXY(i, (lu.getX(i) * (x1 - x0)) / 3, (lu.getY(i) * (z1 - z0)) / 3)
      T.batch.put(lg, P.cobble, (x0 + x1) / 2, 0.024, (z0 + z1) / 2, 0, 1, 1, 1, { cast: false })
    }
    lane(-100, HQ.gateX, LZ - 2.3, LZ + 2.3)
    lane(CX - 2.1, CX + 2.1, -16, 22)
    // the square: a ring of setts round the fountain
    T.batch.put(new THREE.CircleGeometry(5.6, 40).rotateX(-Math.PI / 2), P.cobble, CX, 0.026, LZ, 0, 1, 1, 1, { cast: false })
    T.batch.put(new THREE.RingGeometry(5.5, 5.75, 40).rotateX(-Math.PI / 2), trim, CX, 0.03, LZ, 0, 1, 1, 1, { cast: false })
    // garden paths to each door
    for (const h of HAUNTED_HOUSES) {
      const s = Math.sin(h.yaw)
      const c = Math.cos(h.yaw)
      const fx = h.x + s * (h.d / 2 + 0.2)
      const fz = h.z + c * (h.d / 2 + 0.2)
      // to the nearest lane edge
      const toLane = Math.abs(c) > 0.5 ? Math.abs(LZ - fz) - 2.3 : Math.abs(CX - fx) - 2.1
      if (toLane > 0.2) {
        const len = toLane + 0.2
        const pg = new THREE.PlaneGeometry(1.3, len).rotateX(-Math.PI / 2)
        Frame.at(T.batch, fx + s * (len / 2), 0.02, fz + c * (len / 2), h.yaw).put(pg, P.cobble, 0, 0, 0, 0, 0, 0, false)
      }
    }
  }

  /* ── the gate: two stone piers with gargoyle crouches, a wrought-iron arch, the quarter's name, green lanterns ── */
  {
    const gx = HQ.gateX
    const iron = std({ color: '#1a1a1e', metalness: 0.8, roughness: 0.45 })
    const green = glowM('#7affb0', 2.2)
    for (const s of [-1, 1]) {
      const z = LZ + s * 3.1
      T.batch.put(boxUV(1.1, 3.4, 1.1, 1.4), stone, gx, 1.7, z)
      T.batch.put(boxUV(1.3, 0.25, 1.3, 1), trim, gx, 3.5, z)
      // a crouching gargoyle: hunched body, head, folded wings
      const gF = Frame.at(T.batch, gx, 3.62, z, Math.PI / 2)
      gF.put(new THREE.SphereGeometry(0.32, 12, 8).scale(1, 0.85, 1.25), stone, 0, 0.28, 0)
      gF.put(new THREE.SphereGeometry(0.18, 10, 8), stone, 0, 0.55, 0.3)
      for (const sx of [-1, 1]) gF.put(new THREE.ConeGeometry(0.16, 0.5, 4).rotateZ(sx * 0.9).rotateX(-0.5), stone, sx * 0.3, 0.45, -0.1)
      gF.put(new THREE.ConeGeometry(0.04, 0.14, 6), stone, -0.08, 0.7, 0.32)
      gF.put(new THREE.ConeGeometry(0.04, 0.14, 6), stone, 0.08, 0.7, 0.32)
      T.colliders.push({ kind: 'box', minX: gx - 0.6, maxX: gx + 0.6, minZ: z - 0.6, maxZ: z + 0.6, h: 3.4 })
      // a green lantern on each pier's lane face
      const lF = Frame.at(T.batch, gx + 0.62, 2.4, z - s * 0.0, Math.PI / 2)
      lF.box(0.05, 0.05, 0.4, iron, 0, 0.2, 0.2)
      lF.box(0.22, 0.32, 0.22, green, 0, -0.04, 0.38, false)
      lF.put(new THREE.ConeGeometry(0.18, 0.16, 4).rotateY(Math.PI / 4), iron, 0, 0.2, 0.38)
      T.lights.push({ x: gx + 1.2, y: 2.3, z, color: '#7affb0', intensity: 5, dist: 7, priority: 4 })
    }
    // the iron arch: two curved bars with spikes + a cross-bar carrying the sign
    const arch = new THREE.TorusGeometry(3.1, 0.05, 6, 32, Math.PI)
    for (const dx of [-0.1, 0.1]) Frame.at(T.batch, gx + dx, 3.6, LZ, Math.PI / 2).put(arch.clone(), iron, 0, 0, 0, 0, 0, 0)
    for (let k = 0; k <= 10; k++) {
      const a = (k / 10) * Math.PI
      T.batch.put(new THREE.ConeGeometry(0.04, 0.26, 6), iron, gx, 3.6 + Math.sin(a) * 3.1 + 0.13, LZ - Math.cos(a) * 3.1)
    }
    const sign = std({ map: panelTexture('HAUNTED QUARTER', 'enter if you dare · mind the ghosts', 4.2, { ...PANEL.dark, ink: '#9affc8', rule: '#7affb0' }, D), roughness: 0.7 })
    const SMt: SignMats = { frame: iron, metal: iron, gold: P.gold, stone: trim }
    hangingSign(Frame.at(T.batch, gx, 5.3, LZ, Math.PI / 2), 3.6, 0.86, sign, SMt, 0.6)
    // a crumbling wall along the quarter's edge with the gate as the only way in
    for (const [z0, z1] of [[-6, LZ - 3.7], [LZ + 3.7, 24]] as const) {
      const len = z1 - z0
      const n = Math.max(1, Math.round(len / 2.2))
      for (let k = 0; k < n; k++) {
        const za = z0 + (k / n) * len
        const zb = z0 + ((k + 1) / n) * len
        const h = 1.6 + Math.sin(k * 2.3) * 0.35 - (k % 4 === 3 ? 0.6 : 0)
        T.batch.put(boxUV(0.55, h, zb - za + 0.02, 1.4), stone, gx, h / 2, (za + zb) / 2)
      }
      T.colliders.push({ kind: 'box', minX: gx - 0.4, maxX: gx + 0.4, minZ: z0, maxZ: z1, h: 1.8 })
    }
  }

  /* ── the houses ── */
  const plaster = (c: string) => std({ map: P.plaster.map, color: c, roughness: 0.95 })
  const wood = std({ map: P.timber.map, color: '#2a2220', roughness: 0.95 })
  const roofM = std({ map: P.roofSlate.map, color: '#2a2834', roughness: 0.8 })
  const darkGlass = std({ color: '#0e1016', roughness: 0.2, metalness: 0.5 })
  const ironM = std({ color: '#1e1e22', metalness: 0.75, roughness: 0.45 })
  const doorGlow = glowM('#7affb0', 2.0)
  for (const h of HAUNTED_HOUSES) {
    const F = Frame.at(T.batch, h.x, 0, h.z, h.yaw)
    const fh = 2.8
    const top = 0.5 + fh * h.floors
    const lean = h.lean ?? 0
    const wallM = plaster(h.wall)
    const glow = h.glow ? glowM(h.glow, 1.6) : null
    // plinth + leaning body (sheared box), floor bands, corner posts
    F.put(boxUV(h.w + 0.3, 0.5, h.d + 0.3, 1.4), stone, 0, 0.25, 0)
    const body = boxUV(h.w, top - 0.5, h.d, 2.5)
    body.translate(0, (top - 0.5) / 2, 0)
    const bp = body.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < bp.count; i++) bp.setX(i, bp.getX(i) + bp.getY(i) * lean)
    body.computeVertexNormals()
    F.put(body, wallM, 0, 0.5, 0)
    for (let f = 1; f < h.floors; f++) {
      const y = 0.5 + f * fh
      F.put(new THREE.BoxGeometry(h.w + 0.24, 0.2, h.d + 0.24), wood, (y - 0.5) * lean, y, 0)
    }
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const post = new THREE.BoxGeometry(0.22, top - 0.5, 0.22)
        post.translate(0, (top - 0.5) / 2, 0)
        const pp = post.attributes.position as THREE.BufferAttribute
        for (let i = 0; i < pp.count; i++) pp.setX(i, pp.getX(i) + pp.getY(i) * lean)
        F.put(post, wood, sx * (h.w / 2), 0.5, sz * (h.d / 2))
      }
    // windows: per floor, per bay, on the front + sides — dark, glowing, or boarded, with crooked shutters
    let seed = h.id.length * 7
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
    const bays = Math.max(1, Math.round(h.w / 2.2))
    for (let f = 0; f < h.floors; f++) {
      const y = 0.5 + f * fh + 1.55
      for (let b = 0; b < bays; b++) {
        const wx = -h.w / 2 + (h.w / bays) * (b + 0.5) + (y - 0.5) * lean
        if (f === 0 && Math.abs(wx - (y - 0.5) * lean) < 0.9) continue // the door
        const r = rnd()
        const fz = h.d / 2 + 0.01
        const pane = glow && r < 0.4 ? glow : darkGlass
        F.put(new THREE.PlaneGeometry(0.8, 1.3), pane, wx, y, fz, 0, 0, 0, false)
        F.box(0.96, 0.08, 0.1, wood, wx, y + 0.69, fz + 0.03)
        F.box(0.96, 0.08, 0.16, wood, wx, y - 0.69, fz + 0.05)
        F.box(0.05, 1.3, 0.06, wood, wx, y, fz + 0.02)
        if (r > 1 - (h.boarded ?? 0)) {
          // boarded: two planks across
          F.put(new THREE.BoxGeometry(1.05, 0.14, 0.04).rotateZ(0.5), wood, wx, y + 0.1, fz + 0.07)
          F.put(new THREE.BoxGeometry(1.05, 0.14, 0.04).rotateZ(-0.4), wood, wx, y - 0.2, fz + 0.07)
        } else if (r > 0.45) {
          // a shutter hanging askew from one hinge
          F.put(new THREE.BoxGeometry(0.42, 1.25, 0.04).rotateZ(r * 0.35), wood, wx + 0.66, y - 0.08, fz + 0.06)
        }
      }
      // side windows (one per side per floor)
      for (const sx of [-1, 1]) {
        const p = F.sub(sx * (h.w / 2 + 0.01) + (0.5 + f * fh + 1.55 - 0.5) * lean, 0, 0, 0, sx * Math.PI / 2, 0)
        p.put(new THREE.PlaneGeometry(0.7, 1.1), glow && rnd() < 0.3 ? glow : darkGlass, 0, 0.5 + f * fh + 1.55, 0, 0, 0, 0, false)
        p.box(0.84, 0.07, 0.1, wood, 0, 0.5 + f * fh + 2.12, 0.03)
      }
    }
    // the door: planked, under a little pointed hood, with iron straps and a green lantern beside it
    const dz = h.d / 2
    F.box(1.15, 2.1, 0.08, wood, 0, 1.55, dz + 0.02)
    for (const yy of [1.0, 2.0]) F.box(1.1, 0.06, 0.04, ironM, 0, yy, dz + 0.08)
    F.put(new THREE.TorusGeometry(0.06, 0.012, 6, 14), ironM, 0.38, 1.5, dz + 0.1)
    F.put(gableGeo(1.6, 0.7, 0.5, 1).rotateY(Math.PI / 2), roofM, 0, 2.7, dz + 0.3)
    F.box(1.5, 0.3, 0.9, stone, 0, 0.15, dz + 0.45) // step
    F.box(0.05, 0.05, 0.3, ironM, 0.95, 2.35, dz + 0.15)
    F.box(0.18, 0.26, 0.18, doorGlow, 0.95, 2.2, dz + 0.32, false)
    {
      const lp = F.world(0.95, 2.2, dz + 0.9)
      T.lights.push({ x: lp.x, y: lp.y, z: lp.z, color: '#7affb0', intensity: 3.2, dist: 6, priority: 5 })
    }
    if (h.porch) {
      F.box(h.w * 0.7, 0.1, 1.6, wood, 0, 0.05, dz + 0.8)
      for (const sx of [-1, 1]) F.box(0.12, 2.5, 0.12, wood, sx * h.w * 0.32, 1.75, dz + 1.5)
      F.put(new THREE.BoxGeometry(h.w * 0.74, 0.1, 1.9).rotateX(0.25), roofM, 0, 3.05, dz + 0.9)
    }
    // the roof
    const rx = (top - 0.5) * lean
    if (h.roof === 'steep' || h.roof === 'gable') {
      const rise = h.roof === 'steep' ? h.w * 1.05 : h.w * 0.6
      const g = gableGeo(h.w + 0.6, h.d + 0.5, rise, 2)
      g.rotateY(Math.PI / 2)
      F.put(g, roofM, rx, top, 0)
    } else if (h.roof === 'mansard') {
      const hd = (h.d + 0.3) / 2
      const prof = new THREE.Shape([new THREE.Vector2(-hd, 0), new THREE.Vector2(hd, 0), new THREE.Vector2(hd - 0.8, 2.0), new THREE.Vector2(-hd + 0.8, 2.0)])
      const m = new THREE.ExtrudeGeometry(prof, { depth: h.w + 0.3, bevelEnabled: false })
      m.translate(0, 0, -(h.w + 0.3) / 2)
      m.rotateY(Math.PI / 2)
      F.put(m, roofM, rx, top, 0)
      for (let b = 0; b < bays; b++) {
        const wx = -h.w / 2 + (h.w / bays) * (b + 0.5) + rx
        F.put(boxUV(0.8, 0.9, 0.7, 1), wallM, wx, top + 0.9, h.d / 2 - 0.35)
        F.put(new THREE.PlaneGeometry(0.5, 0.6), glow ?? darkGlass, wx, top + 0.9, h.d / 2 + 0.02, 0, 0, 0, false)
      }
    } else {
      // turreted manor: a hipped main roof + round corner turrets with candle-snuffer caps
      const g = gableGeo(h.w + 0.6, h.d + 0.5, h.w * 0.45, 2)
      g.rotateY(Math.PI / 2)
      F.put(g, roofM, rx, top, 0)
      for (const sx of [-1, 1]) {
        const tx = sx * (h.w / 2 + 0.3)
        const tz = h.d / 2 - 0.4
        F.put(new THREE.CylinderGeometry(1.2, 1.25, top + 1.6, 14), wallM, tx, (top + 1.6) / 2, tz)
        F.put(new THREE.ConeGeometry(1.5, 4.2, 14), roofM, tx, top + 1.6 + 2.1, tz)
        F.put(new THREE.SphereGeometry(0.12, 8, 6), ironM, tx, top + 1.6 + 4.25, tz)
        for (let f = 0; f < h.floors; f++) F.put(new THREE.PlaneGeometry(0.5, 1.1), glow && f === h.floors - 1 ? glow : darkGlass, tx, 0.5 + f * fh + 1.6, tz + 1.26, 0, 0, 0, false)
        const c = F.world(tx, 0, tz)
        T.colliders.push({ kind: 'circle', x: c.x, z: c.z, r: 1.4, h: top })
      }
    }
    if (h.tower) {
      // the widow's walk: a square tower with a railed lookout
      const tx = h.w / 2 - 1
      const tz = -h.d / 2 + 1.2
      F.put(boxUV(2, top + 3.4, 2, 2.5), wallM, tx, (top + 3.4) / 2, tz)
      F.put(new THREE.ConeGeometry(1.7, 2.6, 4).rotateY(Math.PI / 4), roofM, tx, top + 3.4 + 1.3, tz)
      F.put(new THREE.PlaneGeometry(0.6, 0.9), glow ?? darkGlass, tx, top + 2.2, tz + 1.01, 0, 0, 0, false)
    }
    // a crooked chimney
    F.put(boxUV(0.7, 2.6, 0.7, 1).rotateZ(-0.12 - lean), stone, -h.w / 2 + 0.9 + rx, top + 1.1, -h.d / 4)
    if (T.smoke && h.glow) {
      const cp = F.world(-h.w / 2 + 0.9 + rx - 0.2, top + 2.4, -h.d / 4)
      T.smoke.push({ x: cp.x, y: cp.y, z: cp.z })
    }
    // a little iron fence round the manor's front garden
    if (h.fence) {
      const fz0 = h.d / 2 + 0.6
      const fz1 = h.d / 2 + 3.6
      for (const sx of [-1, 1]) {
        for (let k = 0; k <= 14; k++) F.put(new THREE.CylinderGeometry(0.02, 0.02, 1.3, 5), ironM, sx * (0.9 + (k / 14) * (h.w / 2 - 0.9)), 0.65, fz1)
        F.box(h.w / 2 - 0.9, 0.04, 0.04, ironM, sx * (0.9 + (h.w / 2 - 0.9) / 2), 1.2, fz1)
      }
      for (const sx of [-1, 1]) for (let k = 0; k <= 5; k++) F.put(new THREE.CylinderGeometry(0.02, 0.02, 1.3, 5), ironM, sx * (h.w / 2), 0.65, fz0 + (k / 5) * (fz1 - fz0))
      for (const sx of [-1, 1]) {
        const a = F.world(sx * (0.9 + (h.w / 2 - 0.9) / 2), 0, fz1)
        const hw = Math.abs(Math.cos(h.yaw)) > 0.5 ? (h.w / 2 - 0.9) / 2 : 0.1
        const hd = Math.abs(Math.cos(h.yaw)) > 0.5 ? 0.1 : (h.w / 2 - 0.9) / 2
        T.colliders.push({ kind: 'box', minX: a.x - hw, maxX: a.x + hw, minZ: a.z - hd, maxZ: a.z + hd, h: 1.3 })
      }
    }
    // pumpkins left out on the step (carved, guttering)
    if (T.pumpkins) {
      const pp = F.world(-0.75, 0, dz + 0.7)
      T.pumpkins.add(pp.x, 0.3, pp.z, { r: 0.2, face: h.id.length % 4, facing: h.yaw })
    }
    // solid body
    const a = F.world(-h.w / 2 - 0.15, 0, -h.d / 2 - 0.15)
    const b = F.world(h.w / 2 + 0.15, 0, h.d / 2 + 0.3)
    T.colliders.push({ kind: 'box', minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minZ: Math.min(a.z, b.z), maxZ: Math.max(a.z, b.z), h: top })
  }

  /* ── the square: a broken fountain with a weeping statue, the dead oak, two benches ── */
  {
    const { x: sx, z: sz } = HQ.square
    T.batch.put(new THREE.CylinderGeometry(2.3, 2.5, 0.7, 20, 1, true), stone, sx, 0.35, sz)
    T.batch.put(new THREE.TorusGeometry(2.4, 0.12, 6, 28).rotateX(Math.PI / 2), trim, sx, 0.72, sz)
    const water = std({ color: '#1a2a24', roughness: 0.1, metalness: 0.3 })
    T.batch.put(new THREE.CircleGeometry(2.3, 24).rotateX(-Math.PI / 2), water, sx, 0.45, sz, 0, 1, 1, 1, { cast: false })
    T.batch.put(new THREE.CylinderGeometry(0.35, 0.5, 1.2, 10), stone, sx, 1.0, sz)
    // the weeping figure: a hooded shape with its face in its hands
    const fig = Frame.at(T.batch, sx, 1.6, sz, 0.4)
    fig.put(new THREE.ConeGeometry(0.42, 1.5, 12), stone, 0, 0.75, 0)
    fig.put(new THREE.SphereGeometry(0.2, 12, 10), stone, 0, 1.55, 0.04)
    fig.put(new THREE.SphereGeometry(0.24, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6).scale(1, 1.1, 1.1), stone, 0, 1.6, -0.02)
    for (const s of [-1, 1]) fig.put(new THREE.CylinderGeometry(0.06, 0.07, 0.5, 6).rotateX(-0.9).rotateZ(s * 0.25), stone, s * 0.12, 1.32, 0.2)
    T.colliders.push({ kind: 'circle', x: sx, z: sz, r: 2.6, h: 1 })
    // dead oak at the square's edge
    const ox = sx - 4.6
    const oz = sz - 4.2
    T.batch.put(new THREE.CylinderGeometry(0.28, 0.5, 4.8, 8), P.bark, ox, 2.4, oz)
    for (let k = 0; k < 7; k++) {
      const br = new THREE.CylinderGeometry(0.05, 0.16, 2.6 - (k % 3) * 0.4, 5)
      br.translate(0, 1.2, 0)
      br.rotateZ(0.7 + (k % 2) * 0.35)
      br.rotateY(k * 0.95)
      T.batch.put(br, P.bark, ox, 2.6 + (k % 4) * 0.55, oz)
    }
    T.colliders.push({ kind: 'circle', x: ox, z: oz, r: 0.55, h: 5 })
    // a noose-free swing: just a broken plank swing on old ropes (spooky, not grim)
    T.batch.put(new THREE.CylinderGeometry(0.012, 0.012, 2, 4), P.cloth, ox + 1.1, 2.6, oz + 0.3)
    T.batch.put(new THREE.CylinderGeometry(0.012, 0.012, 2.1, 4).rotateZ(0.12), P.cloth, ox + 1.6, 2.55, oz + 0.3)
    T.batch.put(new THREE.BoxGeometry(0.62, 0.04, 0.2).rotateZ(-0.2), P.woodRotten, ox + 1.35, 1.55, oz + 0.3)
    // the quarter's name on a crooked post
    const board = std({ map: panelTexture('THE HAUNTED QUARTER', 'seven houses · one crypt · no refunds', 3.2, { ...PANEL.dark, ink: '#9affc8', rule: '#7affb0' }, D), roughness: 0.8 })
    const SMt: SignMats = { frame: P.woodRotten, metal: P.iron, gold: P.gold, stone: trim }
    postedBoard(Frame.at(T.batch, sx - 3.8, 0, sz + 4.6, Math.PI * 1.15), 1.9, 0.6, 1.25, board, SMt, true)
    T.colliders.push({ kind: 'circle', x: sx - 3.8, z: sz + 4.6, r: 0.9, h: 2 })
  }

  /* ── the graveyard: iron fence, headstones, crosses, a leaning angel, and the crypt ── */
  {
    const gx0 = -101
    const gx1 = -91.4
    const gz0 = 7.6
    const gz1 = 23.6
    const iron = ironM
    // fence (with a gate gap toward the cross lane on the east side)
    const fence = (ax: number, az: number, bx: number, bz: number) => {
      const len = Math.hypot(bx - ax, bz - az)
      const n = Math.round(len / 0.22)
      for (let k = 0; k <= n; k++) {
        const t = k / n
        T.batch.put(new THREE.CylinderGeometry(0.018, 0.018, 1.25, 5), iron, ax + (bx - ax) * t, 0.62, az + (bz - az) * t)
        if (k % 6 === 0) T.batch.put(new THREE.ConeGeometry(0.04, 0.12, 5), iron, ax + (bx - ax) * t, 1.3, az + (bz - az) * t)
      }
      const ang = Math.atan2(bx - ax, bz - az)
      for (const y of [0.25, 1.1]) T.batch.put(new THREE.BoxGeometry(0.04, 0.04, len), iron, (ax + bx) / 2, y, (az + bz) / 2, ang)
      T.colliders.push({ kind: 'box', minX: Math.min(ax, bx) - 0.08, maxX: Math.max(ax, bx) + 0.08, minZ: Math.min(az, bz) - 0.08, maxZ: Math.max(az, bz) + 0.08, h: 1.3 })
    }
    fence(gx0, gz0, gx1, gz0)
    fence(gx0, gz1, gx1, gz1)
    fence(gx0, gz0, gx0, gz1)
    fence(gx1, gz0, gx1, CRYPT.z - 1.4)
    fence(gx1, CRYPT.z + 1.4, gx1, gz1)
    // headstones in loose rows (rounded tops, crosses, an obelisk), some leaning
    const slab = std({ map: P.stone.map, color: '#8a8478', roughness: 0.95 })
    let seed = 11
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
    for (let row = 0; row < 3; row++)
      for (let k = 0; k < 4; k++) {
        const x = gx0 + 1.4 + k * 1.9 + rnd() * 0.3
        const z = gz0 + 1.4 + row * 1.9
        const lean = (rnd() - 0.5) * 0.3
        const kind = rnd()
        const F = Frame.at(T.batch, x, 0, z, Math.PI / 2 + (rnd() - 0.5) * 0.2)
        if (kind < 0.55) {
          F.put(new THREE.BoxGeometry(0.62, 0.8, 0.14).translate(0, 0.4, 0).rotateZ(lean), slab, 0, 0, 0)
          F.put(new THREE.CylinderGeometry(0.31, 0.31, 0.14, 14, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(-Math.PI / 2 + lean), slab, Math.sin(-lean) * 0.8, 0.8, 0)
        } else if (kind < 0.85) {
          F.put(new THREE.BoxGeometry(0.12, 1.0, 0.12).translate(0, 0.5, 0).rotateZ(lean), slab, 0, 0, 0)
          F.put(new THREE.BoxGeometry(0.5, 0.12, 0.12).rotateZ(lean), slab, Math.sin(-lean) * 0.72, 0.72, 0)
        } else {
          F.put(new THREE.CylinderGeometry(0.1, 0.18, 1.5, 4).rotateY(Math.PI / 4), slab, 0, 0.75, 0)
          F.put(new THREE.ConeGeometry(0.13, 0.25, 4).rotateY(Math.PI / 4), slab, 0, 1.62, 0)
        }
        F.put(new THREE.BoxGeometry(0.5, 0.06, 1.3), P.soil, 0, 0.03, 0.75, 0, 0, 0, false) // the grave
        T.colliders.push({ kind: 'circle', x, z, r: 0.38, h: 1 })
      }
    // the crypt: a stone mausoleum with columns, a pediment and an iron door (enterable)
    const C = CRYPT
    const F = Frame.at(T.batch, C.x, 0, C.z, C.yaw)
    F.put(boxUV(C.w + 0.6, 0.4, C.d + 0.6, 1.4), stone, 0, 0.2, 0)
    F.put(boxUV(C.w, 3.2, C.d, 2), slab, 0, 2.0, 0)
    F.put(boxUV(C.w + 0.4, 0.3, C.d + 0.4, 1), trim, 0, 3.75, 0)
    const ped = new THREE.Shape([new THREE.Vector2(-C.w / 2 - 0.2, 0), new THREE.Vector2(C.w / 2 + 0.2, 0), new THREE.Vector2(0, 1.2)])
    const pg = new THREE.ExtrudeGeometry(ped, { depth: C.d + 0.4, bevelEnabled: false })
    pg.translate(0, 0, -(C.d + 0.4) / 2)
    F.put(pg, slab, 0, 3.9, 0)
    for (const sx of [-1, 1]) F.put(new THREE.CylinderGeometry(0.18, 0.2, 3.2, 12), trim, sx * 1.4, 2.0, C.d / 2 + 0.25)
    F.box(1.4, 2.4, 0.08, ironM, 0, 1.6, C.d / 2 + 0.03)
    for (let k = 0; k < 5; k++) F.box(0.03, 2.3, 0.1, ironM, -0.56 + k * 0.28, 1.6, C.d / 2 + 0.07)
    F.put(new THREE.TorusGeometry(0.09, 0.015, 6, 14), P.gold, 0.4, 1.5, C.d / 2 + 0.1)
    // a skull carving + the name over the door
    const cryptSign = std({ map: panelTexture('MORTIMER', 'rest in pumpkin', 2.6, { ...PANEL.dark, bg: '#5a564e', ink: '#1a1a1e', sub: '#2a2a2e', rule: '#3a3a3e' }, D), roughness: 0.9 })
    F.put(new THREE.PlaneGeometry(1.8, 0.7), cryptSign, 0, 3.3, C.d / 2 + 0.02, 0, 0, 0, false)
    const cp = F.world(0, 0, C.d / 2 + 1.0)
    T.lights.push({ x: cp.x, y: 1.8, z: cp.z, color: '#7affb0', intensity: 2.6, dist: 5, priority: 5 })
    const ca = F.world(-C.w / 2 - 0.3, 0, -C.d / 2 - 0.3)
    const cb = F.world(C.w / 2 + 0.3, 0, C.d / 2 + 0.4)
    T.colliders.push({ kind: 'box', minX: Math.min(ca.x, cb.x), maxX: Math.max(ca.x, cb.x), minZ: Math.min(ca.z, cb.z), maxZ: Math.max(ca.z, cb.z), h: 4 })
    // a path from the graveyard gate to the cross lane
    const pathM = std({ map: P.ground.map, color: '#4a4036', roughness: 1 })
    T.batch.put(new THREE.PlaneGeometry(CX - 2.1 - gx1, 1.4).rotateX(-Math.PI / 2), pathM, (gx1 + CX - 2.1) / 2, 0.018, C.z, 0, 1, 1, 1, { cast: false })
  }

  /* ── ghost lamps along the lanes: crooked iron posts with cold green lanterns ── */
  const lampM = glowM('#9affd0', 2.0)
  const post = new THREE.CylinderGeometry(0.06, 0.09, 3.0, 6)
  for (const [x, z] of [[-62, LZ - 2.6], [-70, LZ + 2.6], [-86, LZ - 2.6], [-94, LZ + 2.6], [CX + 2.4, -10], [CX - 2.4, -3], [CX + 2.4, 10], [CX - 2.4, 19]] as const) {
    const tilt = Math.sin(x * 3.1) * 0.08
    T.batch.put(post.clone().rotateZ(tilt), ironM, x, 1.5, z)
    T.batch.put(new THREE.BoxGeometry(0.24, 0.32, 0.24), lampM, x - tilt * 3, 3.1, z, 0, 1, 1, 1, { cast: false })
    T.batch.put(new THREE.ConeGeometry(0.22, 0.2, 4).rotateY(Math.PI / 4), ironM, x - tilt * 3, 3.35, z)
    T.colliders.push({ kind: 'circle', x, z, r: 0.2, h: 3 })
    T.lights.push({ x, y: 3, z, color: '#8affc8', intensity: 4.5, dist: 9, priority: 4 })
  }
  void channelLetters
}
