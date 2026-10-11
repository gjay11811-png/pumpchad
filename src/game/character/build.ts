import * as THREE from 'three'
import type { Appearance } from './types'

/**
 * Procedural, fully 3D characters. Every species shares one joint hierarchy so
 * animation code is species-agnostic; only meshes differ.
 *
 * root ─ hips ─┬ legL/legR ─ knee ─ shin/shoe
 *              └ spine ─┬ torso, top, chain
 *                       ├ armL/armR ─ elbow ─ forearm/fist
 *                       └ neck ─ head (species head, headwear, eyewear)
 */
export type Pose = 'idle' | 'walk' | 'flex' | 'press' | 'wave'

export class CharacterRig {
  kind: 'procedural' | 'model' = 'procedural'
  root = new THREE.Group()
  hips = new THREE.Group()
  spine = new THREE.Group()
  neck = new THREE.Group()
  armL = new THREE.Group()
  armR = new THREE.Group()
  elbowL = new THREE.Group()
  elbowR = new THREE.Group()
  legL = new THREE.Group()
  legR = new THREE.Group()
  kneeL = new THREE.Group()
  kneeR = new THREE.Group()
  fistL = new THREE.Object3D()
  fistR = new THREE.Object3D()
  headHeight = 1.95
  private phase = 0
  private t = 0
  private blend = { flex: 0, press: 0, wave: 0 }
  pose: Pose = 'idle'
  speed = 0
  /** 0 = bar at shoulders, 1 = locked out overhead (press pose) */
  pressAmount = 0
  /** stepped(): called on each footfall so the scene can play a footstep */
  onStep: (() => void) | null = null
  private lastStepSign = 0

  update(dt: number) {
    this.t += dt
    const s = Math.min(this.speed, 1.6)
    const walking = s > 0.05
    const k = 1 - Math.exp(-dt * 10)
    for (const p of ['flex', 'press', 'wave'] as const) this.blend[p] += ((this.pose === p ? 1 : 0) - this.blend[p]) * k

    // locomotion
    this.phase += dt * (walking ? 5.5 + s * 3.5 : 0)
    const sw = Math.sin(this.phase)
    const amp = walking ? Math.min(1, s) : 0
    const sign = Math.sign(sw)
    if (walking && sign !== this.lastStepSign) this.onStep?.()
    this.lastStepSign = sign

    this.legL.rotation.x = sw * 0.75 * amp
    this.legR.rotation.x = -sw * 0.75 * amp
    this.kneeL.rotation.x = Math.max(0, -sw) * 1.0 * amp + 0.02
    this.kneeR.rotation.x = Math.max(0, sw) * 1.0 * amp + 0.02
    this.hips.position.y = 0.95 + Math.abs(Math.cos(this.phase)) * 0.06 * amp - 0.03 * amp
    this.spine.rotation.y = sw * 0.12 * amp
    this.spine.rotation.x = 0.08 * amp
    const breathe = Math.sin(this.t * 2.2) * 0.012
    this.spine.scale.set(1 + breathe, 1 + breathe * 0.6, 1 + breathe)
    this.neck.rotation.y = Math.sin(this.t * 0.6) * 0.15 * (1 - amp)

    // base arm pose: walk swing / idle lats-spread
    const baseZ = 0.18
    let lz = baseZ, rz = -baseZ, lx = -sw * 0.7 * amp, rx = sw * 0.7 * amp
    let lez = 0.15, rez = -0.15, lex = -0.35 - 0.3 * amp, rex = -0.35 - 0.3 * amp

    // flex: double biceps
    const f = this.blend.flex
    const pump = Math.sin(this.t * 3) * 0.06
    lz = lerp(lz, 1.5 + pump, f); rz = lerp(rz, -1.5 - pump, f)
    lx = lerp(lx, 0, f); rx = lerp(rx, 0, f)
    lez = lerp(lez, 1.75, f); rez = lerp(rez, -1.75, f)
    lex = lerp(lex, 0, f); rex = lerp(rex, 0, f)

    // overhead press
    const p = this.blend.press
    const pa = this.pressAmount
    lz = lerp(lz, lerp(1.25, 2.85, pa), p); rz = lerp(rz, -lerp(1.25, 2.85, pa), p)
    lx = lerp(lx, -0.15, p); rx = lerp(rx, -0.15, p)
    lez = lerp(lez, lerp(1.85, 0.2, pa), p); rez = lerp(rez, -lerp(1.85, 0.2, pa), p)
    lex = lerp(lex, 0, p); rex = lerp(rex, 0, p)

    // wave (NPC greeting) — right arm only
    const w = this.blend.wave
    rz = lerp(rz, -2.6, w)
    rez = lerp(rez, -0.5 + Math.sin(this.t * 9) * 0.45, w)
    rx = lerp(rx, 0, w)

    this.armL.rotation.set(lx, 0, lz)
    this.armR.rotation.set(rx, 0, rz)
    this.elbowL.rotation.set(lex, 0, lez)
    this.elbowR.rotation.set(rex, 0, rez)
  }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/* ─────────────── builders ─────────────── */

type Mats = ReturnType<typeof makeMats>
function makeMats(a: Appearance) {
  const std = (color: string, o: Partial<THREE.MeshPhysicalMaterialParameters> = {}) =>
    new THREE.MeshPhysicalMaterial({ color, roughness: 0.62, metalness: 0.05, sheen: 0.25, sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.4), ...o })
  return {
    skin: std(a.skin, a.species === 'skeleton' ? { roughness: 0.8 } : { roughness: 0.55 }),
    skinDark: std(new THREE.Color(a.skin).multiplyScalar(0.72).getStyle()),
    outfit: std(a.outfit, { roughness: 0.85 }),
    metal: std(a.outfit, { metalness: 0.85, roughness: 0.28, clearcoat: 0.6, sheen: 0 }),
    gold: std('#e8b84a', { metalness: 1, roughness: 0.38, sheen: 0, envMapIntensity: 0.8 }),
    glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(a.glow).multiplyScalar(3.96), toneMapped: false }),
    dark: std('#0b0a0d', { roughness: 0.9 }),
    lens: std('#0a0a0c', { metalness: 0.4, roughness: 0.05, clearcoat: 1, sheen: 0 }),
    shoe: std('#f1ece4', { roughness: 0.7 }),
    sole: std('#141216'),
    stem: std('#3f5a2a', { roughness: 0.9 }),
    bone: std('#e9e2d0', { roughness: 0.8 }),
  }
}

const cap = (r: number, len: number, seg = 8) => new THREE.CapsuleGeometry(r, len, 6, seg * 2)
/** Smooth tapered limb along -y: radius r1 at the joint, bulge rm, r2 at the far end. */
function limb(r1: number, rm: number, r2: number, len: number, bulgeAt = 0.4) {
  const pts: THREE.Vector2[] = []
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2)
    pts.push(new THREE.Vector2(Math.sin(a) * r2, -len - Math.cos(a) * r2))
  }
  for (let i = 1; i < 12; i++) {
    const t = i / 12
    const y = -len + t * len
    const bell = Math.exp(-((t - (1 - bulgeAt)) ** 2) / 0.06)
    const base = r2 + (r1 - r2) * t
    pts.push(new THREE.Vector2(base + (rm - Math.max(r1, r2)) * bell + 0.0001, y))
  }
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2)
    pts.push(new THREE.Vector2(Math.cos(a) * r1, Math.sin(a) * r1))
  }
  return new THREE.LatheGeometry(pts, 20)
}

/** V-taper torso: profile of radius vs height, squashed front-to-back. */
function torsoGeo(scale = 1) {
  const prof: [number, number][] = [
    [0.001, -0.02], [0.17, -0.02], [0.2, 0.04], [0.205, 0.14], [0.215, 0.22], [0.25, 0.32],
    [0.3, 0.42], [0.325, 0.5], [0.315, 0.56], [0.26, 0.61], [0.16, 0.65], [0.08, 0.68], [0.001, 0.69],
  ]
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r * scale, y)), 36)
  g.scale(1.38, 1, 0.7)
  g.computeVertexNormals()
  return g
}

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  m.castShadow = true
  return m
}

export function buildCharacter(a: Appearance): CharacterRig {
  const rig = new CharacterRig()
  const M = makeMats(a)
  const skel = a.species === 'skeleton'
  const bulk = skel ? 0.72 : 1
  const shirtless = a.top === 'shirtless'

  rig.root.add(rig.hips)
  rig.hips.position.y = 0.95
  rig.hips.add(rig.spine)
  rig.spine.position.y = 0.04

  /* pelvis / shorts */
  const pelvis = mesh(cap(0.2 * (skel ? 0.85 : 1), 0.18), skel && shirtless ? M.bone : M.outfit, 0, -0.02, 0)
  pelvis.scale.set(1.25, 0.8, 0.85)
  rig.hips.add(pelvis)

  /* legs */
  for (const side of [1, -1] as const) {
    const leg = side === 1 ? rig.legL : rig.legR
    const knee = side === 1 ? rig.kneeL : rig.kneeR
    leg.position.set(0.14 * side, -0.05, 0)
    rig.hips.add(leg)
    const thighMat = skel && shirtless ? M.bone : M.outfit
    leg.add(mesh(limb(0.14 * bulk, 0.155 * bulk, 0.095 * bulk, 0.4, 0.35), thighMat, 0, 0, 0))
    knee.position.y = -0.44
    leg.add(knee)
    const shinMat = a.top === 'armor' ? M.metal : shirtless ? (skel ? M.bone : M.skin) : M.outfit
    knee.add(mesh(limb(0.095 * bulk, 0.11 * bulk, 0.07 * bulk, 0.38, 0.25), shinMat, 0, 0, 0))
    const shoe = mesh(cap(0.085, 0.16, 8), a.top === 'armor' ? M.metal : M.shoe, 0, -0.45, 0.06)
    shoe.rotation.x = Math.PI / 2
    shoe.scale.set(1.05, 1, 0.75)
    knee.add(shoe)
    const sole = mesh(cap(0.088, 0.17, 8), M.sole, 0, -0.5, 0.06)
    sole.rotation.x = Math.PI / 2
    sole.scale.set(1.08, 1, 0.3)
    knee.add(sole)
  }

  /* torso */
  if (skel) buildRibcage(rig, M)
  else {
    rig.spine.add(mesh(torsoGeo(), M.skin, 0, 0, 0))
    // trapezius + deltoids give the shoulder line its mass
    const traps = mesh(new THREE.SphereGeometry(0.2, 20, 14), M.skin, 0, 0.6, -0.03)
    traps.scale.set(1.5, 0.55, 0.8)
    rig.spine.add(traps)
    rig.spine.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.16, 16), M.skin, 0, 0.7, 0))
    if (shirtless) {
      for (const s of [1, -1]) {
        const pec = mesh(new THREE.SphereGeometry(0.17, 20, 14), M.skin, 0.13 * s, 0.47, 0.11)
        pec.scale.set(1.15, 0.72, 0.62)
        rig.spine.add(pec)
      }
      for (let r = 0; r < 3; r++)
        for (const s of [1, -1]) {
          const ab = mesh(new THREE.SphereGeometry(0.062, 14, 10), M.skin, 0.06 * s, 0.32 - r * 0.095, 0.135)
          ab.scale.set(1.1, 0.85, 0.5)
          rig.spine.add(ab)
        }
    }
  }
  buildTop(rig, M, a)
  if (a.chain) buildChain(rig, M)

  /* arms */
  for (const side of [1, -1] as const) {
    const arm = side === 1 ? rig.armL : rig.armR
    const elbow = side === 1 ? rig.elbowL : rig.elbowR
    const fistMarker = side === 1 ? rig.fistL : rig.fistR
    arm.position.set((skel ? 0.33 : 0.43) * side, 0.56, 0)
    rig.spine.add(arm)
    const sleeve = a.top === 'hoodie'
    const upperMat = sleeve ? M.outfit : skel ? M.bone : M.skin
    arm.add(mesh(limb(0.12 * bulk, (skel ? 0.08 : 0.15) * (sleeve ? 0.92 : 1), 0.085 * bulk, 0.38, 0.45), upperMat, 0, 0, 0))
    // deltoid cap
    const delt = mesh(new THREE.SphereGeometry(0.14 * bulk, 18, 12), upperMat, 0, -0.02, 0)
    delt.scale.set(1.05, 0.95, 1)
    arm.add(delt)
    if (a.top === 'armor') {
      const pad = mesh(new THREE.SphereGeometry(0.15, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.metal, 0, 0.02, 0)
      pad.scale.set(1.05, 0.8, 1.05)
      arm.add(pad)
    }
    elbow.position.y = -0.38
    arm.add(elbow)
    const foreMat = a.top === 'armor' ? M.metal : sleeve ? M.outfit : skel ? M.bone : M.skin
    elbow.add(mesh(limb(0.09 * bulk, 0.11 * bulk, 0.065 * bulk, 0.32, 0.3), foreMat, 0, 0, 0))
    const fist = mesh(new THREE.SphereGeometry(0.085 * (skel ? 0.85 : 1), 16, 12), skel ? M.bone : M.skin, 0, -0.39, 0.01)
    fist.scale.set(0.9, 1.05, 1.1)
    elbow.add(fist)
    fistMarker.position.y = -0.38
    elbow.add(fistMarker)
  }

  /* head */
  rig.neck.position.y = 0.66
  rig.spine.add(rig.neck)
  const head = new THREE.Group()
  rig.neck.add(head)
  const faceZ = buildHead(head, M, a)
  buildHeadwear(head, M, a)
  buildEyewear(head, M, a, faceZ)
  rig.headHeight = 0.95 + 0.04 + 0.66 + 0.3

  rig.root.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh) m.receiveShadow = false
  })
  return rig
}

function buildRibcage(rig: CharacterRig, M: Mats) {
  rig.spine.add(mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.6, 6), M.bone, 0, 0.3, -0.06))
  for (let i = 0; i < 4; i++) {
    const r = 0.2 - i * 0.012
    const rib = mesh(new THREE.TorusGeometry(r, 0.025, 5, 14, Math.PI * 1.6), M.bone, 0, 0.5 - i * 0.09, 0)
    rib.rotation.set(Math.PI / 2, 0, Math.PI * 0.7)
    rib.scale.set(1.25, 0.9, 1)
    rig.spine.add(rib)
  }
  const shoulder = mesh(cap(0.05, 0.6), M.bone, 0, 0.57, -0.02)
  shoulder.rotation.z = Math.PI / 2
  rig.spine.add(shoulder)
}

function buildTop(rig: CharacterRig, M: Mats, a: Appearance) {
  if (a.top === 'hoodie') {
    const body = mesh(torsoGeo(a.species === 'skeleton' ? 0.86 : 1.07), M.outfit, 0, 0, 0)
    rig.spine.add(body)
    const hood = mesh(new THREE.TorusGeometry(0.17, 0.07, 6, 12), M.outfit, 0, 0.64, -0.08)
    hood.rotation.x = Math.PI / 2.3
    rig.spine.add(hood)
    const pocket = mesh(new THREE.BoxGeometry(0.3, 0.12, 0.05), M.dark, 0, 0.18, 0.22)
    rig.spine.add(pocket)
    // drawstrings in glow colour = brand detail
    for (const s of [1, -1]) rig.spine.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.16), M.glow, 0.05 * s, 0.5, 0.24))
  } else if (a.top === 'armor') {
    const plate = mesh(torsoGeo(a.species === 'skeleton' ? 0.82 : 1.06), M.metal, 0, 0.02, 0)
    rig.spine.add(plate)
    const core = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 16), M.glow, 0, 0.45, 0.22)
    core.rotation.x = Math.PI / 2
    rig.spine.add(core)
    const belt = mesh(new THREE.BoxGeometry(0.62, 0.08, 0.38), M.dark, 0, 0.1, 0)
    rig.spine.add(belt)
    for (const y of [0.3, 0.22]) rig.spine.add(mesh(new THREE.BoxGeometry(0.34, 0.015, 0.02), M.glow, 0, y, 0.215))
  }
}

function buildChain(rig: CharacterRig, M: Mats) {
  const chain = mesh(new THREE.TorusGeometry(0.2, 0.022, 6, 24), M.gold, 0, 0.55, 0.06)
  chain.rotation.x = Math.PI / 2.6
  rig.spine.add(chain)
  const plate = mesh(new THREE.BoxGeometry(0.15, 0.085, 0.02), M.gold, 0, 0.42, 0.235)
  plate.rotation.x = 0.18
  rig.spine.add(plate)
}

/** Returns the z of the face front, for eyewear placement. */
function buildHead(head: THREE.Group, M: Mats, a: Appearance): number {
  if (a.species === 'pumpkin') {
    head.position.y = 0.28
    const seg = new THREE.SphereGeometry(0.22, 24, 18)
    const N = 10
    for (let i = 0; i < N; i++) {
      const ang = (i / N) * Math.PI * 2
      const m = mesh(seg, i % 2 ? M.skin : M.skinDark, Math.sin(ang) * 0.14, 0, Math.cos(ang) * 0.14)
      m.rotation.y = ang
      m.scale.set(0.62, 0.92, 1)
      head.add(m)
    }
    const stem = mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.14, 6), M.stem, 0.01, 0.23, 0)
    stem.rotation.z = -0.25
    head.add(stem)
    // carved face (glows)
    const face = (shape: THREE.Shape, x: number, y: number) => {
      const z = Math.sqrt(Math.max(0, 0.36 * 0.36 - x * x)) - 0.005
      const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), M.glow)
      m.position.set(x, y, z)
      m.rotation.y = Math.asin(Math.min(1, x / 0.36))
      head.add(m)
    }
    const tri = (w: number, h: number) => {
      const s = new THREE.Shape()
      s.moveTo(-w / 2, -h / 2)
      s.lineTo(w / 2, -h / 2)
      s.lineTo(0, h / 2)
      return s
    }
    face(tri(0.1, 0.08), -0.1, 0.06)
    face(tri(0.1, 0.08), 0.1, 0.06)
    face(tri(0.05, 0.05), 0, -0.01)
    const mouth = new THREE.Shape()
    mouth.moveTo(-0.16, -0.06)
    mouth.lineTo(-0.1, -0.1)
    mouth.lineTo(-0.06, -0.075)
    mouth.lineTo(-0.02, -0.11)
    mouth.lineTo(0.03, -0.075)
    mouth.lineTo(0.07, -0.11)
    mouth.lineTo(0.11, -0.08)
    mouth.lineTo(0.16, -0.06)
    mouth.lineTo(0.1, -0.15)
    mouth.lineTo(-0.1, -0.15)
    face(mouth, 0, 0)
    return 0.34
  }
  if (a.species === 'skeleton') {
    head.position.y = 0.24
    const skull = mesh(new THREE.SphereGeometry(0.24, 14, 12), M.skin, 0, 0.03, 0)
    skull.scale.set(1, 1.05, 1.08)
    head.add(skull)
    const jaw = mesh(new THREE.BoxGeometry(0.26, 0.1, 0.2, 2, 1, 2), M.skin, 0, -0.17, 0.06)
    head.add(jaw)
    for (const s of [1, -1]) {
      const sock = mesh(new THREE.SphereGeometry(0.065, 10, 8), M.dark, 0.085 * s, 0.03, 0.2)
      sock.scale.set(1, 1.1, 0.5)
      head.add(sock)
      head.add(mesh(new THREE.SphereGeometry(0.022, 8, 6), M.glow, 0.085 * s, 0.03, 0.235))
    }
    const nose = mesh(new THREE.ConeGeometry(0.03, 0.05, 3), M.dark, 0, -0.05, 0.245)
    nose.rotation.x = Math.PI
    head.add(nose)
    for (let i = -2; i <= 2; i++) head.add(mesh(new THREE.BoxGeometry(0.035, 0.04, 0.02), M.bone, i * 0.042, -0.135, 0.165))
    return 0.25
  }
  // demon
  head.position.y = 0.25
  const skull = mesh(new THREE.SphereGeometry(0.25, 14, 12), M.skin, 0, 0, 0)
  skull.scale.set(1, 1.08, 1.02)
  head.add(skull)
  const jaw = mesh(new THREE.SphereGeometry(0.17, 10, 8), M.skin, 0, -0.13, 0.06)
  jaw.scale.set(1.15, 0.8, 1)
  head.add(jaw)
  const brow = mesh(new THREE.BoxGeometry(0.34, 0.05, 0.08), M.skinDark, 0, 0.07, 0.2)
  brow.rotation.x = -0.2
  head.add(brow)
  for (const s of [1, -1]) {
    const eye = mesh(new THREE.SphereGeometry(0.04, 10, 8), M.glow, 0.085 * s, 0.02, 0.225)
    eye.scale.set(1.4, 0.7, 0.6)
    eye.rotation.z = -0.3 * s
    head.add(eye)
    const ear = mesh(new THREE.ConeGeometry(0.05, 0.16, 4), M.skin, 0.25 * s, 0.03, 0)
    ear.rotation.z = -1.2 * s
    head.add(ear)
  }
  head.add(mesh(new THREE.BoxGeometry(0.12, 0.015, 0.02), M.dark, 0, -0.12, 0.23))
  return 0.26
}

function buildHeadwear(head: THREE.Group, M: Mats, a: Appearance) {
  const top = a.species === 'pumpkin' ? 0.2 : 0.22
  if (a.headwear === 'crown') {
    const g = new THREE.Group()
    g.position.y = top + 0.04
    g.add(mesh(new THREE.CylinderGeometry(0.17, 0.16, 0.09, 16, 1, true), M.gold))
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2
      const spike = mesh(new THREE.ConeGeometry(0.035, 0.11, 4), M.gold, Math.sin(ang) * 0.165, 0.09, Math.cos(ang) * 0.165)
      g.add(spike)
    }
    g.add(mesh(new THREE.OctahedronGeometry(0.03), M.glow, 0, 0.01, 0.17))
    g.rotation.z = 0.12
    head.add(g)
  } else if (a.headwear === 'cap') {
    const g = new THREE.Group()
    g.position.y = top - 0.02
    const dome = mesh(new THREE.SphereGeometry(0.25, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.outfit)
    dome.scale.set(a.species === 'pumpkin' ? 1.25 : 1.05, 0.7, a.species === 'pumpkin' ? 1.25 : 1.08)
    g.add(dome)
    const brim = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 14, 1, false, -Math.PI / 2, Math.PI), M.outfit, 0, 0, a.species === 'pumpkin' ? 0.22 : 0.17)
    g.add(brim)
    g.add(mesh(new THREE.SphereGeometry(0.025, 6, 4), M.glow, 0, 0.17, 0))
    head.add(g)
  } else if (a.headwear === 'horns' || (a.species === 'demon' && a.headwear === 'none')) {
    if (a.headwear === 'none') return
    for (const s of [1, -1]) {
      const horn = new THREE.Group()
      horn.position.set(0.15 * s, top - 0.02, 0.02)
      const h1 = mesh(new THREE.ConeGeometry(0.06, 0.2, 6), M.dark, 0, 0.08, 0)
      h1.rotation.z = -0.6 * s
      horn.add(h1)
      const h2 = mesh(new THREE.ConeGeometry(0.035, 0.14, 6), M.dark, 0.09 * s, 0.2, 0)
      h2.rotation.z = 0.25 * s
      horn.add(h2)
      head.add(horn)
    }
  }
}

function buildEyewear(head: THREE.Group, M: Mats, a: Appearance, faceZ: number) {
  const y = a.species === 'pumpkin' ? 0.06 : 0.03
  if (a.eyewear === 'shades') {
    const g = new THREE.Group()
    g.position.set(0, y, faceZ + 0.02)
    for (const s of [1, -1]) {
      const lens = mesh(new THREE.BoxGeometry(0.15, 0.075, 0.025), M.lens, 0.09 * s, 0, 0)
      lens.rotation.y = -0.18 * s
      g.add(lens)
    }
    g.add(mesh(new THREE.BoxGeometry(0.06, 0.018, 0.02), M.lens, 0, 0.02, 0.005))
    head.add(g)
  } else if (a.eyewear === 'visor') {
    const v = mesh(new THREE.TorusGeometry(faceZ - 0.02, 0.035, 4, 24, Math.PI * 0.75), M.glow, 0, y, 0)
    v.rotation.set(Math.PI / 2, 0, Math.PI * 0.125)
    v.scale.set(1.08, 1, 0.6)
    head.add(v)
  }
}
