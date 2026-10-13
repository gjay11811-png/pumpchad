import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Pose } from './build'
import type { Character } from './character'
import { normaliseForSpecies, type Appearance } from './types'
import { buildChain, buildPumpkinHead, buildShades, buildHeadwear, PUMPKIN_LOOK, shortsLogoTexture } from './chadParts'
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js'
import { Fire } from '../scenes/world/fx'

/**
 * Pumpkin Chad on a real rigged body.
 *   Body + rig: Quaternius "Universal Base Characters" Superhero Male (CC0)
 *   Animations: Quaternius "Universal Animation Library" (CC0) — same 65-bone rig
 * The human head is removed from the mesh; a modelled jack-o'-lantern rides the Head bone.
 * Gameplay only talks to the Character interface, never to bone names.
 */

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
const base = () => import.meta.env.BASE_URL
export type ChadAssets = { body: THREE.Group; clips: Map<string, THREE.AnimationClip>; ranger?: THREE.Group; skull?: THREE.Group }
const files = new Map<string, Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>>()
function file(name: string) {
  if (!files.has(name)) {
    const pr = loader.loadAsync(`${base()}chadverse/models/${name}`).then((g) => ({ scene: g.scene, animations: g.animations }))
    pr.catch(() => files.delete(name))
    files.set(name, pr)
  }
  return files.get(name)!
}
/** Loads only what a species needs (Pumpkin never downloads the Ranger outfit or skull). */
export async function loadChadAssets(species: Appearance['species'] = 'pumpkin'): Promise<ChadAssets> {
  const [body, anims, anims2, ranger, skull] = await Promise.all([
    file('chad_body.glb'),
    file('chad_anims.glb'),
    file('chad_anims2.glb'),
    species === 'pumpkin' ? null : file('chad_ranger.glb'),
    species === 'skeleton' ? file('chad_skull.glb') : null,
  ])
  return { body: body.scene, clips: new Map([...anims.animations, ...anims2.animations].map((c) => [c.name, c])), ranger: ranger?.scene, skull: skull?.scene }
}

/* Clip names in the library, and the speed (m/s) each locomotion clip was authored at,
   so playback rate can match ground speed (no foot sliding). */
const CLIPS = {
  idle: 'Idle_Loop', walk: 'Walk_Loop', jog: 'Jog_Fwd_Loop', sprint: 'Sprint_Loop', dance: 'Dance_Loop', interact: 'Interact', talk: 'Idle_Talking_Loop',
  jumpStart: 'Jump_Start', jumpLoop: 'Jump_Loop', jumpLand: 'Jump_Land', jab: 'Punch_Jab', cross: 'Punch_Cross', hook: 'Melee_Hook',
  sitDown: 'Sitting_Enter', sit: 'Sitting_Idle_Loop', standUp: 'Sitting_Exit', pickup: 'Farm_Harvest',
  yes: 'Yes', folded: 'Idle_FoldArms_Loop', throw: 'OverhandThrow', climb: 'ClimbUp_1m', slideStart: 'Slide_Start', slide: 'Slide_Loop', slideExit: 'Slide_Exit',
}
/** clips that play once and hand back to the pose-driven base clip */
export type OneShot = 'jab' | 'cross' | 'hook' | 'yes' | 'throw' | 'climb' | 'jumpStart' | 'jumpLand' | 'interact' | 'sitDown' | 'standUp' | 'pickup'
/* Measured with scripts/sweep-stride.mjs: zero-slip speeds are walk 0.91, jog 6.2, sprint 9.4 m/s.
   Jog/sprint are set slightly lower (≈8% slip) for a livelier cadence at game speeds. */
const CLIP_SPEED = { walk: 0.91, jog: 5.8, sprint: 8.8 }

/**
 * Locomotion blendspace. Each library clip has a fixed stride (metres per cycle, measured with
 * scripts/measure-stride.mjs) and a natural cadence (cycles per second). Instead of time-stretching ONE
 * clip to the ground speed (a jog played at 0.55× looks like slow motion), walk / jog / sprint play
 * together, phase-locked, weighted so that the blended stride × cadence equals the ground speed.
 * Result: real walking at walking speeds, a natural jog in between, a sprint at the top, no foot sliding.
 */
const GAIT = [
  { key: 'walk', stride: 1.23, cadence: 1.1 }, // Walk_Loop 1.333 s, played a touch brisker (×1.47) → 1.35 m/s
  { key: 'jog', stride: 5.67, cadence: 1.07 }, // Jog_Fwd_Loop 0.933 s → 6.1 m/s
  { key: 'sprint', stride: 7.04, cadence: 1.38 }, // Sprint_Loop 0.667 s (×0.92) → 9.7 m/s
] as const
const gaitSpeed = (i: number, w: number) => {
  const a = GAIT[i]
  const b = GAIT[i + 1]
  return (a.stride + (b.stride - a.stride) * w) * (a.cadence + (b.cadence - a.cadence) * w)
}
/**
 * Measured correction (scripts/sweep-gait.mjs): blended poses don't stride exactly linearly, so the cadence is
 * scaled by target ÷ measured planted-foot speed at each sample speed. Keeps foot slide within a few %.
 */
const CADENCE_FIX: [number, number][] = [[0.8, 1], [1.35, 0.952], [2.2, 0.891], [3.2, 0.884], [4.2, 0.913], [5.2, 0.948], [6.1, 0.983], [7, 1.007], [7.6, 1.05], [8.6, 1.089], [10, 1.124]]
function cadenceFix(v: number) {
  const T = CADENCE_FIX
  if (v <= T[0][0]) return T[0][1]
  for (let i = 1; i < T.length; i++)
    if (v <= T[i][0]) {
      const u = (v - T[i - 1][0]) / (T[i][0] - T[i - 1][0])
      return T[i - 1][1] + (T[i][1] - T[i - 1][1]) * u
    }
  return T[T.length - 1][1]
}
/** clip weights + cycle rate (cycles/s) for a ground speed in m/s */
export function gaitFor(v: number) {
  const g = gaitRaw(v)
  return { weights: g.weights, rate: g.rate * cadenceFix(v) }
}
function gaitRaw(v: number): { weights: Record<string, number>; rate: number } {
  const weights: Record<string, number> = { walk: 0, jog: 0, sprint: 0 }
  const vWalk = GAIT[0].stride * GAIT[0].cadence
  if (v <= vWalk) {
    weights.walk = 1
    return { weights, rate: Math.max(0.62, v / GAIT[0].stride) } // very slow shuffles keep a believable cadence
  }
  const seg = v <= gaitSpeed(0, 1) ? 0 : 1
  if (seg === 1 && v >= gaitSpeed(1, 1)) {
    weights.sprint = 1
    return { weights, rate: v / GAIT[2].stride }
  }
  let lo = 0
  let hi = 1
  for (let k = 0; k < 14; k++) {
    const m = (lo + hi) / 2
    if (gaitSpeed(seg, m) < v) lo = m
    else hi = m
  }
  const w = (lo + hi) / 2
  weights[GAIT[seg].key] = 1 - w
  weights[GAIT[seg + 1].key] = w
  return { weights, rate: v / (GAIT[seg].stride + (GAIT[seg + 1].stride - GAIT[seg].stride) * w) }
}
/** the mascot's identity is a BIG pumpkin head */
const HEAD_SCALE = 1.32

/** Skin/shorts recolour on the painted texture: keeps the sculpted shading, swaps hue. */
function recolour(mat: THREE.MeshStandardMaterial, skin: THREE.Color, shorts: THREE.Color) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSkin = { value: skin }
    sh.uniforms.uShorts = { value: shorts }
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSkin;\nuniform vec3 uShorts;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        {
          vec3 c = diffuseColor.rgb;
          float lum = dot(c, vec3(0.299, 0.587, 0.114));
          float skinMask = smoothstep(0.03, 0.10, c.r - c.b); // painted skin is warm, shorts are grey
          vec3 skinCol = uSkin * pow(lum / 0.42, 1.15) * 1.05;
          vec3 shortsCol = uShorts * (0.35 + lum * 2.4);
          diffuseColor.rgb = mix(shortsCol, skinCol, skinMask);
        }`,
      )
  }
  mat.customProgramCacheKey = () => 'chad-recolour'
}

/** Collapse a rigid accessory tree into one mesh per material (draw-call budget). */
function mergeStatic(root: THREE.Object3D, D: (THREE.Material | THREE.BufferGeometry | THREE.Texture)[]) {
  root.updateMatrixWorld(true)
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>()
  const victims: THREE.Mesh[] = []
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || Array.isArray(m.material)) return
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k)
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2))
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld))
    if (!byMat.has(m.material)) byMat.set(m.material, [])
    byMat.get(m.material)!.push(g)
    victims.push(m)
  })
  for (const v of victims) v.removeFromParent()
  const names = new Set<string>()
  root.traverse((o) => o.name.startsWith('acc:') && o !== root && names.add(o.name))
  // drop now-empty groups but keep their names as tags on the root for QA
  for (const c of [...root.children]) root.remove(c)
  for (const [mat, geos] of byMat) {
    const merged = mergeGeometries(geos)!
    geos.forEach((g) => g.dispose())
    D.push(merged)
    const mesh = new THREE.Mesh(merged, mat)
    mesh.castShadow = true
    root.add(mesh)
  }
  for (const n of names) {
    const tag = new THREE.Object3D()
    tag.name = n
    root.add(tag)
  }
  return root
}

/** Remove triangles driven mainly by the Head bone (the human head + face). */
function removeHead(mesh: THREE.SkinnedMesh) {
  const headIdx = mesh.skeleton.bones.findIndex((b) => b.name === 'Head')
  if (headIdx < 0) return
  const g = mesh.geometry
  const si = g.attributes.skinIndex as THREE.BufferAttribute
  const sw = g.attributes.skinWeight as THREE.BufferAttribute
  const headW = (v: number) => {
    let w = 0
    for (let k = 0; k < 4; k++) if (si.getComponent(v, k) === headIdx) w += sw.getComponent(v, k)
    return w
  }
  const idx = g.index!
  const keep: number[] = []
  for (let t = 0; t < idx.count; t += 3) {
    const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2)
    if (Math.max(headW(a), headW(b), headW(c)) > 0.45) continue
    keep.push(a, b, c)
  }
  const ng = g.clone()
  ng.setIndex(keep)
  mesh.geometry = ng
}

/**
 * Build a fitted clothing shell from the body itself: take triangles whose vertices are
 * weighted to the given bones, push them out along the normal, keep the same skin weights.
 * Result: clothing that deforms exactly with the body and never clips through it.
 */
function shell(body: THREE.SkinnedMesh, bones: string[], offset: number | ((y: number) => number), mat: THREE.Material, opts: { maxY?: number; minY?: number } = {}) {
  const set = new Set(bones.map((n) => body.skeleton.bones.findIndex((b) => b.name === n)).filter((i) => i >= 0))
  const g = body.geometry
  const pos = g.attributes.position as THREE.BufferAttribute
  const nor = g.attributes.normal as THREE.BufferAttribute
  const si = g.attributes.skinIndex as THREE.BufferAttribute
  const sw = g.attributes.skinWeight as THREE.BufferAttribute
  const uv = g.attributes.uv as THREE.BufferAttribute
  const owned = (v: number) => {
    let w = 0
    for (let k = 0; k < 4; k++) if (set.has(si.getComponent(v, k))) w += sw.getComponent(v, k)
    const y = pos.getY(v)
    if (opts.maxY !== undefined && y > opts.maxY) return false
    if (opts.minY !== undefined && y < opts.minY) return false
    return w > 0.5
  }
  const idx = g.index!
  const tris: number[] = []
  for (let t = 0; t < idx.count; t += 3) {
    const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2)
    if (owned(a) && owned(b) && owned(c)) tris.push(a, b, c)
  }
  const remap = new Map<number, number>()
  const P: number[] = [], N: number[] = [], SI: number[] = [], SW: number[] = [], U: number[] = [], Y: number[] = []
  const out: number[] = []
  for (const v of tris) {
    if (!remap.has(v)) {
      remap.set(v, P.length / 3)
      const o = typeof offset === 'number' ? offset : offset(pos.getY(v))
      P.push(pos.getX(v) + nor.getX(v) * o, pos.getY(v) + nor.getY(v) * o, pos.getZ(v) + nor.getZ(v) * o)
      N.push(nor.getX(v), nor.getY(v), nor.getZ(v))
      SI.push(si.getX(v), si.getY(v), si.getZ(v), si.getW(v))
      SW.push(sw.getX(v), sw.getY(v), sw.getZ(v), sw.getW(v))
      U.push(uv.getX(v), uv.getY(v))
      Y.push(pos.getY(v))
    }
    out.push(remap.get(v)!)
  }
  const ng = new THREE.BufferGeometry()
  ng.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
  ng.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3))
  ng.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4))
  ng.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4))
  ng.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2))
  ng.setAttribute('bindY', new THREE.Float32BufferAttribute(Y, 1))
  ng.setIndex(out)
  const m = new THREE.SkinnedMesh(ng, mat)
  m.bind(body.skeleton, body.bindMatrix)
  m.castShadow = true
  m.frustumCulled = false
  return m
}

export class PumpkinChad implements Character {
  kind = 'model' as const
  root = new THREE.Group()
  pose: Pose = 'idle'
  speed = 0
  pressAmount = 0
  headHeight = 1.9
  fistL: THREE.Object3D
  fistR: THREE.Object3D
  onStep: (() => void) | null = null
  /** QA hook: pin locomotion playback rate */
  forceTimeScale: number | null = null
  private mixer: THREE.AnimationMixer
  private actions = new Map<string, THREE.AnimationAction>()
  private current: THREE.AnimationAction | null = null
  private bones = new Map<string, THREE.Bone>()
  /**
   * Clean animated pose of every bone, captured right after the mixer runs. three.js only rewrites a bone when
   * the clip's value CHANGED since last frame, so procedural layers (lean, gym poses, IK) applied on top would
   * otherwise stack up frame after frame on bones whose clip value holds still (that was the sideways slump).
   * Restoring this snapshot before the next mixer update keeps every layer a pure per-frame offset.
   */
  private pose0: { b: THREE.Bone; q: THREE.Quaternion; p: THREE.Vector3 }[] = []
  private layer = { flex: 0, press: 0, wave: 0, bench: 0, squat: 0, curl: 0, guard: 0, pushup: 0, hips: 0, point: 0, deadlift: 0, pullup: 0 }
  /** body lean set by the scene each frame (turning / accelerating) */
  lean = { turn: 0, accel: 0 }
  private leanNow = { turn: 0, accel: 0 }
  /** personality fidgets while standing idle (off in cut-scenes / stations) */
  fidgets = true
  private persona!: Persona
  private nextFidget = 6
  private fidget: { kind: Persona['fidget']; t0: number; dur: number } | null = null
  private air: 'ground' | 'air' = 'ground'
  private airT = 0
  private model!: THREE.Group
  /** model offset set by the species build (soles / boots on the ground) — posture changes are added on top */
  private modelBase = new THREE.Vector3()
  private oneShot: { act: THREE.AnimationAction; end: number } | null = null
  private t = 0
  private lastPhase = 0
  /** locomotion blendspace state: group weight (fades in/out as a whole), shared gait phase, per-clip phase offsets */
  private loco = { active: false, w: 0, phase: 0, off: { walk: 0, jog: 0, sprint: 0 } as Record<string, number> }
  private disposables: (THREE.Material | THREE.BufferGeometry | THREE.Texture)[] = []
  private headObj: THREE.Object3D | null = null
  private chainObj: THREE.Object3D | null = null
  private skinColor = new THREE.Color()
  private shortsColor = new THREE.Color()
  private glowColor = new THREE.Color()
  /** character-space side sign of the left hand (+1 if left is +X) */
  private leftSign = 1

  readonly species: Appearance['species']
  private fires: Fire[] = []

  constructor(src: ChadAssets, a0: Appearance) {
    const a = normaliseForSpecies(a0)
    this.species = a.species
    const source = a.species === 'skeleton' ? src.ranger : src.body
    if (!source) throw new Error(`assets for ${a.species} not loaded`)
    const model = SkeletonUtils.clone(source) as THREE.Group
    this.model = model
    this.root.add(model)
    const meshes: THREE.SkinnedMesh[] = []
    model.traverse((o) => {
      if ((o as THREE.Bone).isBone) this.bones.set(o.name, o as THREE.Bone)
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
        const m = o as THREE.SkinnedMesh
        m.castShadow = true
        m.frustumCulled = false
        meshes.push(m)
      }
    })
    model.updateMatrixWorld(true)
    const hl = this.bone('hand_l').getWorldPosition(new THREE.Vector3())
    this.leftSign = Math.sign(hl.x) || 1
    this.skinColor.set(a.skin)
    this.glowColor.set(a.glow)

    if (a.species === 'pumpkin') this.buildPumpkin(model, meshes, a)
    else if (a.species === 'demon') this.buildDemon(model, meshes, a, src)
    else this.buildSkeleton(model, meshes, a, src)

    this.modelBase.copy(model.position)
    this.fistL = this.bone('hand_l')
    this.fistR = this.bone('hand_r')
    const box = new THREE.Box3().setFromObject(this.headObj ?? model)
    this.headHeight = box.max.y - 0.1

    this.mixer = new THREE.AnimationMixer(model)
    for (const [k, name] of Object.entries(CLIPS)) {
      const clip = src.clips.get(name)
      if (clip) this.actions.set(k, this.mixer.clipAction(clip))
    }
    const js = this.actions.get('jumpStart')
    if (js) {
      js.setLoop(THREE.LoopOnce, 1)
      js.clampWhenFinished = true
    }
    this.persona = PERSONA[a.species] ?? PERSONA.pumpkin
    this.nextFidget = 4 + Math.random() * 5
    this.calibrateLoco(model)
    this.play('idle', 0)
  }

  /* ═════════ PUMPKIN CHAD (approved — unchanged look) ═════════ */
  private buildPumpkin(model: THREE.Group, meshes: THREE.SkinnedMesh[], a: Appearance) {
    const B = meshes.find((m) => (m.material as THREE.Material).name === 'Skin')!
    for (const m of meshes) if (m !== B) m.visible = false // no human eyes / brows under the pumpkin
    removeHead(B)

    // skin + shorts recolour on a private material clone
    const skinMat = (B.material as THREE.MeshStandardMaterial).clone()
    skinMat.roughness = 0.62
    this.skinColor.set(a.skin)
    this.shortsColor.set(a.top === 'armor' ? '#1a181c' : a.outfit)
    recolour(skinMat, this.skinColor, this.shortsColor)
    B.material = skinMat
    this.disposables.push(skinMat, B.geometry)

    // clothing shells (fitted, skinned to the same skeleton)
    const fabric = new THREE.MeshStandardMaterial({ color: a.outfit, roughness: 0.92, metalness: 0 })
    const shoeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 })
    this.disposables.push(fabric, shoeMat)
    const shoes = shell(B, ['foot_l', 'foot_r', 'ball_l', 'ball_r', 'ball_leaf_l', 'ball_leaf_r', 'calf_l', 'calf_r'], (y) => (y < 0.035 ? 0.03 : y < 0.05 ? 0.022 : 0.014), shoeMat, { maxY: 0.15 })
    // trainers: white upper, dark sole band, gold accent stripe
    const by = shoes.geometry.attributes.bindY as THREE.BufferAttribute
    const col = new Float32Array(by.count * 3)
    const white = new THREE.Color('#ece6dc'), sole = new THREE.Color('#141216'), stripe = new THREE.Color('#e0a83e')
    for (let i = 0; i < by.count; i++) {
      const y = by.getX(i)
      const c = y < 0.034 ? sole : y > 0.07 && y < 0.085 ? stripe : y > 0.125 ? sole : white
      col.set([c.r, c.g, c.b], i * 3)
    }
    shoes.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3))
    shoes.name = 'cloth:shoes'
    model.add(shoes)
    shoes.geometry.computeBoundingBox()
    const soleY = Math.min(shoes.geometry.boundingBox!.min.y, 0)
    model.position.y = -soleY // trainer soles sit exactly on the ground
    this.disposables.push(shoes.geometry)

    if (a.top === 'hoodie') {
      const top = shell(B, ['spine_01', 'spine_02', 'spine_03', 'clavicle_l', 'clavicle_r', 'upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r', 'neck_01'], 0.018, fabric, { minY: 0.93 })
      top.name = 'cloth:hoodie'
      model.add(top)
      this.disposables.push(top.geometry)
    } else if (a.top === 'armor') {
      const plate = new THREE.MeshPhysicalMaterial({ color: a.outfit, metalness: 0.72, roughness: 0.42, clearcoat: 0.25 })
      this.disposables.push(plate)
      // full cuirass: whole torso + shoulders/upper arms (not a crop top)
      const top = shell(B, ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'clavicle_l', 'clavicle_r', 'upperarm_l', 'upperarm_r', 'neck_01'], 0.026, plate, { minY: 0.98 })
      top.name = 'cloth:armor'
      model.add(top)
      this.disposables.push(top.geometry)
    }

    // head + accessories in bind pose, then attached to their bones
    const head = this.bone('Head')
    const hp = head.getWorldPosition(new THREE.Vector3())
    const pumpkin = buildPumpkinHead(a, this.disposables)
    pumpkin.name = 'acc:head'
    this.headObj = pumpkin
    pumpkin.scale.setScalar(HEAD_SCALE)
    pumpkin.position.set(hp.x, hp.y + 0.165, hp.z - 0.01)
    if (a.eyewear !== 'none') {
      const ew = buildShades(this.disposables, a.eyewear === 'visor' ? a.glow : undefined)
      ew.name = `acc:${a.eyewear}`
      pumpkin.add(ew)
    }
    const hw = buildHeadwear(a, this.disposables)
    if (hw) {
      hw.name = `acc:${a.headwear}`
      pumpkin.add(hw)
    }
    this.root.add(pumpkin)
    this.root.updateMatrixWorld(true)
    mergeStatic(pumpkin, this.disposables)
    head.attach(pumpkin)
    if (PUMPKIN_LOOK === 'v2') this.addShortsDetails(B)
    if (a.chain) {
      const chest = this.bone('spine_03')
      const neck = this.bone('neck_01').getWorldPosition(new THREE.Vector3())
      const chain = buildChain(this.disposables)
      chain.name = 'acc:chain'
      this.chainObj = chain
      chain.position.set(neck.x, neck.y - 0.02, neck.z + 0.0)
      this.root.add(chain)
      this.root.updateMatrixWorld(true)
      chest.attach(chain)
    }
  }

  /**
   * v2 (artwork match): jack-o'-lantern logo on the left leg of the shorts + a white drawstring.
   * The logo is a DecalGeometry projected onto the bind-pose body (so it hugs the thigh) and rides the thigh bone.
   */
  private addShortsDetails(B: THREE.SkinnedMesh) {
    const g = B.geometry
    const pos = g.attributes.position as THREE.BufferAttribute
    const si = g.attributes.skinIndex as THREE.BufferAttribute
    const sw = g.attributes.skinWeight as THREE.BufferAttribute
    const thighIdx = B.skeleton.bones.findIndex((b) => b.name === 'thigh_l')
    const pelvisIdx = B.skeleton.bones.findIndex((b) => b.name === 'pelvis')
    if (thighIdx < 0) return
    B.updateMatrixWorld(true)
    const thigh = this.bone('thigh_l')
    const ty = thigh.getWorldPosition(new THREE.Vector3()).y
    const v = new THREE.Vector3()
    const best = new THREE.Vector3(0, 0, -Infinity)
    let waistFront = -Infinity
    let waistY = 0
    for (let i = 0; i < pos.count; i++) {
      let w = 0
      let wp = 0
      for (let k = 0; k < 4; k++) {
        if (si.getComponent(i, k) === thighIdx) w += sw.getComponent(i, k)
        if (si.getComponent(i, k) === pelvisIdx) wp += sw.getComponent(i, k)
      }
      v.fromBufferAttribute(pos, i).applyMatrix4(B.matrixWorld)
      if (w > 0.6 && v.y < ty - 0.07 && v.y > ty - 0.12 && v.z > best.z) best.copy(v)
      if (wp > 0.6 && Math.abs(v.x) < 0.03 && v.y > ty + 0.02 && v.y < ty + 0.09 && v.z > waistFront) {
        waistFront = v.z
        waistY = v.y
      }
    }
    if (!Number.isFinite(best.z)) return
    const tex = shortsLogoTexture()
    const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.4, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false })
    const dg = new DecalGeometry(B as unknown as THREE.Mesh, best, new THREE.Euler(0, 0.25 * Math.sign(best.x || 1), 0), new THREE.Vector3(0.1, 0.1, 0.08))
    this.disposables.push(tex, mat, dg)
    const logo = new THREE.Mesh(dg, mat)
    logo.name = 'cloth:shortsLogo'
    this.root.add(logo)
    this.root.updateMatrixWorld(true)
    thigh.attach(logo)
    // drawstring: two short cords with aglets hanging from the front of the waistband
    if (!Number.isFinite(waistFront) || pelvisIdx < 0) return
    const cordMat = new THREE.MeshStandardMaterial({ color: '#efe9df', roughness: 0.8 })
    const bits: THREE.BufferGeometry[] = []
    for (const sx of [-1, 1]) {
      bits.push(new THREE.CylinderGeometry(0.0028, 0.0028, 0.07, 5).rotateZ(sx * 0.12).translate(sx * 0.011, -0.035, 0))
      bits.push(new THREE.CylinderGeometry(0.0036, 0.0036, 0.012, 6).translate(sx * 0.0153, -0.075, 0))
    }
    const cordGeo = mergeGeometries(bits.map((g) => g.toNonIndexed()))!
    bits.forEach((g) => g.dispose())
    this.disposables.push(cordMat, cordGeo)
    const knot = new THREE.Mesh(cordGeo, cordMat) // one draw call
    knot.name = 'cloth:drawstring'
    knot.position.set(0, waistY, waistFront + 0.006)
    this.root.add(knot)
    this.root.updateMatrixWorld(true)
    this.bone('pelvis').attach(knot)
  }

  /** Gold chain on the upper chest, sized per species. */
  private addChain(scale = 1, drop = 0, fwd = 0) {
    const chest = this.bone('spine_03')
    const neck = this.bone('neck_01').getWorldPosition(new THREE.Vector3())
    const chain = buildChain(this.disposables)
    chain.name = 'acc:chain'
    this.chainObj = chain
    chain.scale.setScalar(scale)
    chain.position.set(neck.x, neck.y - 0.02 - drop, neck.z + fwd)
    this.root.add(chain)
    this.root.updateMatrixWorld(true)
    chest.attach(chain)
  }

  /** Attach an accessory built in bind-pose world space to a bone. */
  private attachTo(boneName: string, obj: THREE.Object3D) {
    this.root.add(obj)
    this.root.updateMatrixWorld(true)
    this.bone(boneName).attach(obj)
  }

  /** Lift the model so the lowest point of the given mesh (bind pose) touches the ground. */
  private groundOn(model: THREE.Group, mesh: THREE.Mesh) {
    mesh.geometry.computeBoundingBox()
    model.position.y = -Math.min(mesh.geometry.boundingBox!.min.y, 0)
  }

  /* ═════════ DEMON CHAD ═════════
     Same sculpted Superhero body (real face kept), demon skin with glowing veins,
     sculpted ridged horns, glowing eyes, ember-tipped horns, real Ranger gear (CC0). */
  private buildDemon(model: THREE.Group, meshes: THREE.SkinnedMesh[], a: Appearance, src: ChadAssets) {
    const B = meshes.find((m) => (m.material as THREE.Material).name === 'Skin')!
    const eyes = meshes.find((m) => (m.material as THREE.Material).name === 'EyeMat')
    const brows = meshes.find((m) => (m.material as THREE.Material).name === 'Brows')
    const top = a.top
    this.shortsColor.set(top === 'armor' ? '#1a181c' : a.outfit)
    const skinMat = (B.material as THREE.MeshStandardMaterial).clone()
    skinMat.roughness = 0.74
    skinMat.roughnessMap = null // the human skin roughness map makes demon skin look like plastic
    recolour(skinMat, this.skinColor.clone().multiplyScalar(0.78), this.shortsColor)
    const veins = veinTexture()
    skinMat.emissiveMap = veins
    skinMat.emissive = new THREE.Color(a.glow)
    skinMat.emissiveIntensity = 0.7
    B.material = skinMat
    this.disposables.push(skinMat, veins)
    if (eyes) {
      const em = new THREE.MeshStandardMaterial({ color: '#160404', emissive: new THREE.Color(a.glow), emissiveIntensity: 2.6, roughness: 0.2 })
      eyes.material = em
      eyes.name = 'acc:eyes'
      this.disposables.push(em)
    }
    if (brows) {
      const bm = (brows.material as THREE.MeshStandardMaterial).clone()
      bm.color.set('#1a0a08')
      brows.material = bm
      this.disposables.push(bm)
    }

    // real Ranger pieces rebound onto the muscular skeleton
    const DF = { ...DEMON_FIT, ...((globalThis as unknown as { __demon?: Partial<typeof DEMON_FIT> }).__demon ?? {}) }
    const pieces: [RegExp, number, number?, number?][] = [[/Boots/, 0.004], [/Belt_1$/, ...DF.belt]]
    if (top !== 'hoodie') pieces.push([/Bracer/, 0.016], [/Pauldron/, ...DF.pauldron])
    const gear = rebind(src.ranger!, B, pieces, a.outfit, 0.55, this.disposables)
    gear.forEach((g) => model.add(g))
    const boots = gear.find((g) => /Boots/.test(g.userData.piece))
    if (boots) {
      this.disposables.push(hideUnder(B, ['foot_l', 'foot_r', 'ball_l', 'ball_r', 'ball_leaf_l', 'ball_leaf_r', 'calf_l', 'calf_r'], DF.bootHide))
      this.groundOn(model, boots)
    }

    if (top === 'hoodie') {
      const fabric = new THREE.MeshStandardMaterial({ color: a.outfit, roughness: 0.92 })
      this.disposables.push(fabric)
      const t = shell(B, ['spine_01', 'spine_02', 'spine_03', 'clavicle_l', 'clavicle_r', 'upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r'], 0.018, fabric, { minY: 0.93, maxY: 1.6 })
      t.name = 'cloth:hoodie'
      model.add(t)
      this.disposables.push(t.geometry)
    } else if (top === 'armor') {
      const plate = new THREE.MeshPhysicalMaterial({ color: a.outfit, metalness: 0.72, roughness: 0.42, clearcoat: 0.25 })
      this.disposables.push(plate)
      const t = shell(B, ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'clavicle_l', 'clavicle_r', 'upperarm_l', 'upperarm_r'], 0.026, plate, { minY: 0.98, maxY: 1.6 })
      t.name = 'cloth:armor'
      model.add(t)
      this.disposables.push(t.geometry)
    }

    // horns + ember tips, riding the Head bone
    const hp = this.bone('Head').getWorldPosition(new THREE.Vector3())
    const horns = buildDemonHorns(this.disposables)
    horns.name = 'acc:horns'
    horns.position.set(hp.x, hp.y + 0.1, hp.z + 0.005)
    for (const tip of horns.userData.tips as THREE.Vector3[]) {
      const f = new Fire(tip.x, tip.y - 0.01, tip.z, 0.07)
      horns.add(f.group)
      this.fires.push(f)
    }
    if (a.headwear === 'crown') {
      const crown = buildHeadwear({ ...a, headwear: 'crown' }, this.disposables)!
      crown.name = 'acc:crown'
      crown.scale.setScalar(0.62)
      crown.position.set(0, 0.03, -0.01)
      horns.add(crown)
    }
    this.attachTo('Head', horns)
    this.headObj = horns
    if (a.eyewear !== 'none') {
      const ew = buildShades(this.disposables, a.eyewear === 'visor' ? a.glow : undefined)
      ew.name = `acc:${a.eyewear}`
      ew.scale.setScalar(0.5)
      // lenses sit on the real eyes (Eyes mesh bounds in bind pose)
      const eb = new THREE.Box3().setFromObject(eyes ?? B)
      ew.position.set(0, (eb.min.y + eb.max.y) / 2 - 0.045 * 0.5, eb.max.z + 0.012 - 0.2256 * 0.5)
      this.attachTo('Head', ew)
    }
    if (a.chain) this.addChain(1)
  }

  /* ═════════ SKELETON CHAD ═════════
     Hooded Ranger outfit (CC0, rigged to the same skeleton) with a real sculpted skull (CC0),
     glowing eye sockets and leather gloves. Lean silhouette — no human muscle. */
  private buildSkeleton(model: THREE.Group, meshes: THREE.SkinnedMesh[], a: Appearance, src: ChadAssets) {
    const SK = { ...SKULL, ...((globalThis as unknown as { __skull?: Partial<typeof SKULL> }).__skull ?? {}) }
    const top = a.top === 'shirtless' ? 'armor' : a.top
    const tint = new THREE.Color(a.outfit)
    const rangerMats = new Map<THREE.Material, THREE.Material>()
    for (const m of meshes) {
      const name = pieceName(m)
      const mat = m.material as THREE.MeshStandardMaterial
      if (mat.name === 'Hands') {
        const glove = new THREE.MeshStandardMaterial({ color: '#17120f', roughness: 0.55, metalness: 0.05, normalMap: mat.normalMap })
        m.material = glove
        this.disposables.push(glove)
        continue
      }
      if (!rangerMats.has(mat)) {
        const c = mat.clone()
        tintShader(c, tint, 0.85)
        rangerMats.set(mat, c)
        this.disposables.push(c)
      }
      m.material = rangerMats.get(mat)!
      if (/Pauldron|Bracer/.test(name)) m.visible = top === 'armor'
      m.userData.piece = name
      if (/Hood/.test(name)) m.name = 'cloth:hood' // always up: frames the skull and hides the neck
      if (/Body$/.test(name)) m.name = top === 'armor' ? 'cloth:armor' : 'cloth:hoodie'
    }
    const boots = meshes.find((m) => /Boots/.test(pieceName(m)))
    if (boots) this.groundOn(model, boots)

    // the skull: real CC0 asset, sized to sit inside the hood, riding the Head bone
    const hp = this.bone('Head').getWorldPosition(new THREE.Vector3())
    const skull = SkeletonUtils.clone(src.skull!) as THREE.Group
    const holder = new THREE.Group()
    holder.name = 'acc:head'
    skull.rotation.set(SK.rx, SK.ry, 0)
    holder.add(skull)
    holder.updateMatrixWorld(true)
    const sb = new THREE.Box3().setFromObject(skull)
    const size = sb.getSize(new THREE.Vector3())
    const k = SK.width / size.x
    skull.scale.setScalar(k)
    holder.updateMatrixWorld(true)
    const sb2 = new THREE.Box3().setFromObject(skull)
    const c2 = sb2.getCenter(new THREE.Vector3())
    skull.position.sub(c2) // centre the skull on the holder
    skull.traverse((o) => {
      const mm = o as THREE.Mesh
      if (!mm.isMesh) return
      const srcMat = mm.material as THREE.MeshStandardMaterial
      const mat = new THREE.MeshStandardMaterial({ map: srcMat.map, normalMap: srcMat.normalMap, roughness: 0.72, metalness: 0, color: this.skinColor.clone().multiplyScalar(0.92) })
      mm.material = mat
      mm.castShadow = true
      this.disposables.push(mat)
    })
    const sz = sb2.getSize(new THREE.Vector3())
    // glowing eyes deep in the sockets
    const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(a.glow).multiplyScalar(1.9), toneMapped: false })
    const eyeGeo = new THREE.SphereGeometry(sz.x * 0.05, 12, 8)
    this.disposables.push(eyeMat, eyeGeo)
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(eyeGeo, eyeMat)
      e.position.set(s * sz.x * SK.eyeX, sz.y * SK.eyeY, sz.z * SK.eyeZ)
      e.scale.set(1, 0.8, 0.6)
      holder.add(e)
    }
    holder.position.set(hp.x, hp.y + SK.lift, hp.z + SK.fwd)
    if (a.eyewear !== 'none') {
      const ew = buildShades(this.disposables, a.eyewear === 'visor' ? a.glow : undefined)
      ew.name = `acc:${a.eyewear}`
      const sc = (sz.x * SK.eyeX) / 0.068
      ew.scale.setScalar(sc)
      ew.position.set(0, sz.y * SK.eyeY - 0.045 * sc, sz.z * 0.5 + 0.006 - 0.2256 * sc)
      holder.add(ew)
    }
    this.attachTo('Head', holder)
    // crown / horns sit on the hood, fitted to its measured bounds (bind pose)
    const hood = meshes.find((m) => /Hood/.test(m.userData.piece))
    const hw = a.headwear !== 'none' && hood ? buildHeadwear({ ...a }, this.disposables) : null
    if (hw && hood) {
      const hb = new THREE.Box3().setFromObject(hood)
      const hc = hb.getCenter(new THREE.Vector3())
      const hs = hb.getSize(new THREE.Vector3())
      hw.position.set(0, 0, 0)
      hw.rotation.set(0, 0, a.headwear === 'crown' ? 0.06 : 0)
      const own = new THREE.Box3().setFromObject(hw)
      const ow = own.getSize(new THREE.Vector3())
      const fit = a.headwear === 'crown' ? { w: SK.crownW, sink: SK.crownSink, z: SK.crownZ } : { w: 1.05, sink: 0.07, z: 0.0 }
      const sc = (hs.x * fit.w) / ow.x
      hw.scale.setScalar(sc)
      hw.position.set(hc.x - ((own.min.x + own.max.x) / 2) * sc, hb.max.y - fit.sink - own.min.y * sc, hc.z + fit.z - ((own.min.z + own.max.z) / 2) * sc)
      hw.name = `acc:${a.headwear}`
      this.attachTo('Head', hw)
    }
    this.headObj = holder
    if (a.chain) this.addChain(SK.chainScale, SK.chainDrop, SK.chainFwd)
  }

  private bone(n: string) {
    const b = this.bones.get(n)
    if (!b) throw new Error(`bone ${n} missing`)
    return b
  }

  /**
   * Phase-align the gait clips so blends never cross legs. Each clip is sampled over one cycle and its stride
   * signal (left foot ahead of right foot) is cross-correlated against the jog clip's; the best shift is the offset.
   */
  private calibrateLoco(model: THREE.Object3D) {
    const fl = this.bones.get('foot_l')
    const fr = this.bones.get('foot_r')
    if (!fl || !fr) return
    const N = 32
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    const signal: Record<string, number[]> = {}
    for (const g of GAIT) {
      const act = this.actions.get(g.key)
      if (!act) continue
      act.reset().setEffectiveWeight(1).setEffectiveTimeScale(0).play()
      const dur = act.getClip().duration
      const sig: number[] = []
      for (let i = 0; i < N; i++) {
        act.time = (i / N) * dur
        this.mixer.update(0)
        model.updateMatrixWorld(true)
        sig.push(fl.getWorldPosition(a).z - fr.getWorldPosition(b).z)
      }
      act.stop()
      const mean = sig.reduce((x, y) => x + y, 0) / N
      signal[g.key] = sig.map((x) => x - mean)
    }
    const ref = signal.jog
    if (!ref) return
    for (const g of GAIT) {
      const sig = signal[g.key]
      if (!sig) continue
      let best = -Infinity
      for (let k = 0; k < N; k++) {
        let c = 0
        for (let i = 0; i < N; i++) c += ref[i] * sig[(i + k) % N]
        if (c > best) {
          best = c
          this.loco.off[g.key] = k / N
        }
      }
    }
  }

  /** Fade the whole locomotion blend out (another clip is taking over). */
  private endLoco(fade: number) {
    if (!this.loco.active) return
    this.loco.active = false
    for (const g of GAIT) this.actions.get(g.key)?.fadeOut(fade)
    this.loco.w = 0
  }

  /** Drive the walk / jog / sprint blend for ground speed `ms` (m/s). */
  private updateLoco(ms: number, dt: number) {
    const L = this.loco
    if (!L.active) {
      // entering locomotion: the previous base clip fades out while the blend fades in
      if (this.current) this.current.fadeOut(0.25)
      L.active = true
      // re-entering mid fade-out (stop, then go again): carry on from the weight the blend still has — no snap
      let carried = 0
      for (const g of GAIT) {
        const act = this.actions.get(g.key)
        if (!act) continue
        const wNow = act.isRunning() ? act.getEffectiveWeight() : 0
        carried = Math.max(carried, wNow)
        act.stopFading()
        if (!act.isRunning()) act.reset()
        act.setEffectiveTimeScale(0).play()
      }
      L.w = Math.min(1, carried)
    }
    L.w = Math.min(1, L.w + dt / 0.25)
    const { weights, rate } = gaitFor(ms)
    const prev = L.phase
    L.phase = (L.phase + rate * dt) % 1
    // two footfalls per cycle
    if ((prev < 0.5 && L.phase >= 0.5) || L.phase < prev) this.onStep?.()
    let top: THREE.AnimationAction | null = null
    let topW = -1
    for (const g of GAIT) {
      const act = this.actions.get(g.key)
      if (!act) continue
      const wgt = weights[g.key] * L.w
      act.setEffectiveWeight(wgt)
      act.time = ((L.phase + L.off[g.key]) % 1) * act.getClip().duration
      if (wgt > topW) {
        topW = wgt
        top = act
      }
    }
    this.current = top // for QA / inspect: the dominant gait clip
  }

  private play(name: string, fade = 0.25) {
    if (this.oneShot) return // a one-shot clip owns the body until it finishes
    if (this.loco.active) {
      this.endLoco(fade)
      this.current = null
    }
    const next = this.actions.get(name) ?? this.actions.get('idle')!
    if (next === this.current) return
    next.reset().setEffectiveWeight(1).fadeIn(fade).play()
    this.current?.fadeOut(fade)
    this.current = next
  }

  /** Play a library clip once (punch, celebrate, throw...), then blend back to the pose-driven clip. Returns its length (s). */
  playOnce(name: OneShot, fade = 0.12, opts: { timeScale?: number; maxDur?: number } = {}) {
    const act = this.actions.get(name)
    if (!act) return 0
    const ts = opts.timeScale ?? 1
    if (this.loco.active) {
      this.endLoco(fade)
      this.current = null
    }
    act.reset().setLoop(THREE.LoopOnce, 1)
    act.clampWhenFinished = true
    act.setEffectiveTimeScale(ts).setEffectiveWeight(1).fadeIn(fade).play()
    if (this.current && this.current !== act) this.current.fadeOut(fade)
    this.current = act
    const dur = Math.min(act.getClip().duration / ts, opts.maxDur ?? Infinity)
    this.oneShot = { act, end: this.t + dur - fade }
    this.fidget = null
    return dur
  }

  /** Jump: the take-off clip starts crouched and extends; the scene adds the vertical velocity ~0.07 s later. */
  jump() {
    if (this.air !== 'ground') return
    this.cancelOneShot(0.08)
    this.fidget = null
    this.air = 'air'
    this.airT = 0
    const js = this.actions.get('jumpStart')
    if (this.loco.active) {
      this.endLoco(0.06)
      this.current = null
    }
    if (js) {
      js.reset().setEffectiveTimeScale(0.65).setEffectiveWeight(1).fadeIn(0.06).play() // slow crouch → extension, then sped up in update
      this.current?.fadeOut(0.06)
      this.current = js
    }
  }

  /** Landing: a full recovery when standing, a quick absorb when landing on the move (so running never stalls). */
  setGrounded(grounded: boolean, quiet = false) {
    if (grounded && quiet) {
      this.air = 'ground' // e.g. snapped onto a gym station: no landing reaction
      return
    }
    if (grounded && this.air === 'air' && this.airT > 0.12) {
      this.air = 'ground'
      const ms = this.speed * 3.4
      if (ms > 1.2) this.playOnce('jumpLand', 0.08, { timeScale: 1.9, maxDur: 0.3 })
      else this.playOnce('jumpLand', 0.08, { timeScale: 1.25, maxDur: 0.75 })
    } else if (!grounded && this.air === 'ground') {
      // walked off a ledge: straight into the air loop
      this.air = 'air'
      this.airT = 0.5
    }
  }

  /** End any one-shot clip early and blend back to the pose-driven clip (e.g. leaving a station mid-celebration). */
  cancelOneShot(fade = 0.2) {
    if (!this.oneShot) return
    this.oneShot.act.fadeOut(fade)
    this.oneShot = null
    this.current = null
  }

  /* ── procedural pose layers on the real skeleton (no flex/press clips exist in the library) ── */
  private v = new THREE.Vector3()
  private w = new THREE.Vector3()
  private q = new THREE.Quaternion()
  private qp = new THREE.Quaternion()
  private qd = new THREE.Quaternion()
  /** Rotate `bone` so its child points along `dir` (character space), blended by `k`. */
  private aim(bone: THREE.Bone, child: THREE.Bone, dir: THREE.Vector3, k: number) {
    if (k < 0.001) return
    bone.updateWorldMatrix(true, false)
    child.updateWorldMatrix(false, false)
    const from = child.getWorldPosition(this.v).sub(bone.getWorldPosition(this.w)).normalize()
    const to = dir.clone().normalize().applyQuaternion(this.root.getWorldQuaternion(this.qp))
    this.qd.setFromUnitVectors(from, to)
    bone.getWorldQuaternion(this.q)
    const targetWorld = this.qd.multiply(this.q)
    bone.parent!.getWorldQuaternion(this.qp)
    const targetLocal = this.qp.invert().multiply(targetWorld)
    bone.quaternion.slerp(targetLocal, k)
    bone.updateWorldMatrix(false, true)
  }

  private applyLayers() {
    const L = this.leftSign
    const { flex, press, wave } = this.layer
    const pump = Math.sin(this.t * 3) * 0.06
    const arm = (side: 'l' | 'r', upper: THREE.Vector3, fore: THREE.Vector3, k: number) => {
      this.aim(this.bone(`upperarm_${side}`), this.bone(`lowerarm_${side}`), upper, k)
      this.aim(this.bone(`lowerarm_${side}`), this.bone(`hand_${side}`), fore, k)
    }
    for (const side of ['l', 'r'] as const) {
      const s = side === 'l' ? L : -L
      if (flex > 0.001) arm(side, new THREE.Vector3(s, 0.32 + pump, 0.12), new THREE.Vector3(s * 0.12, 1, 0.1), flex)
      if (press > 0.001) {
        const p = this.pressAmount
        arm(side, new THREE.Vector3(s * (0.6 - p * 0.2), -0.75 + p * 1.8, 0.45 - p * 0.4), new THREE.Vector3(s * (0.05 + p * 0.15), 1, 0.12 - p * 0.12), press)
      }
    }
    if (wave > 0.001) arm('r', new THREE.Vector3(-L * 0.55, 0.85, 0.15), new THREE.Vector3(-L * (0.25 + Math.sin(this.t * 9) * 0.45), 1, 0.1), wave)

    const { bench, squat, curl, guard } = this.layer
    const e = this.pressAmount // rep phase: 0 = start of the movement, 1 = top (curl / bench) or bottom (squat)
    const mix = (a: THREE.Vector3, b: THREE.Vector3, t: number) => a.clone().lerp(b, t)
    // dumbbell curl: elbows pinned at the sides, forearms swing up; the torso braces back a touch at the top
    if (curl > 0.001) {
      for (const side of ['l', 'r'] as const) {
        const s = side === 'l' ? L : -L
        arm(side, new THREE.Vector3(s * 0.14, -1, 0.1 + e * 0.12), mix(new THREE.Vector3(s * 0.08, -1, 0.22), new THREE.Vector3(s * 0.12, 0.82, 0.55), e), curl)
      }
      this.turnBone('spine_02', AX.x, -0.07 * e * curl)
      this.turnBone('neck_01', AX.x, 0.06 * e * curl)
    }
    // boxing guard (the real punch clips play over it)
    const g = guard * (this.oneShot ? 0.15 : 1)
    if (g > 0.001) {
      const bob = Math.sin(this.t * 7.5) * 0.04 // boxer's bounce in the hands
      for (const side of ['l', 'r'] as const) {
        const s = side === 'l' ? L : -L
        arm(side, new THREE.Vector3(s * 0.42, -0.55 + bob, 0.6), new THREE.Vector3(-s * 0.18, 0.85, 0.45), g)
      }
      this.turnBone('spine_01', AX.x, 0.08 * g) // chin down, shoulders forward
    }
    // back squat: bar across the shoulders, hips sink, feet stay planted (two-bone IK)
    if (squat > 0.001) {
      for (const side of ['l', 'r'] as const) {
        const s = side === 'l' ? L : -L
        arm(side, new THREE.Vector3(s * 0.95, 0.12, -0.3), new THREE.Vector3(-s * 0.25, 0.75, -0.6), squat)
      }
      this.squatLegs(e * squat)
    }
    // deadlift: hip hinge with a flat back (hips drop + travel back, torso pitches forward, feet planted by IK),
    // arms hang straight down to the bar; e = 0 bar on the floor → 1 locked out standing tall
    const { deadlift, pullup } = this.layer
    if (deadlift > 0.001) {
      const d = (1 - e) * deadlift
      this.squatLegs(d, { drop: 0.4, back: 0.2, lean: 0.9 })
      this.turnBone('spine_03', AX.x, -0.22 * d) // flat back: chest up against the hinge
      this.turnBone('neck_01', AX.x, -0.6 * d) // eyes forward, not at the floor
      this.turnBone('spine_03', AX.x, -0.08 * deadlift * e) // chest proud at lockout
      for (const side of ['l', 'r'] as const) {
        const s = side === 'l' ? L : -L
        arm(side, new THREE.Vector3(s * 0.12, -1, 0.04 * d), new THREE.Vector3(s * 0.05, -1, 0.02), deadlift)
      }
    }
    // pull-ups: hands overhead on the bar (the scene lifts the whole body so the fists stay ON the bar),
    // e = 0 dead hang → 1 chin over the bar: elbows drive down and back; knees bent, ankles crossed
    if (pullup > 0.001) {
      for (const side of ['l', 'r'] as const) {
        const s = side === 'l' ? L : -L
        arm(side, mix(new THREE.Vector3(s * 0.34, 1, 0.04), new THREE.Vector3(s * 0.92, -0.32, -0.22), e), mix(new THREE.Vector3(s * 0.14, 1, 0.02), new THREE.Vector3(-s * 0.2, 1, 0.12), e), pullup)
        this.aim(this.bone(`thigh_${side}`), this.bone(`calf_${side}`), new THREE.Vector3(s * 0.06, -1, 0.18 + e * 0.12), pullup)
        this.aim(this.bone(`calf_${side}`), this.bone(`foot_${side}`), new THREE.Vector3(-s * 0.14, -0.72, -0.7), pullup)
      }
      this.turnBone('spine_01', AX.x, -0.06 * pullup * (1 - e) - 0.12 * pullup * e) // slight arch at the top
      this.turnBone('neck_01', AX.x, -0.18 * pullup * e) // chin up over the bar
    }
    // ── emotes ──
    const { hips, point, pushup } = this.layer
    // "Chad pose": fists on hips, chest out
    if (hips > 0.001)
      for (const side of ['l', 'r'] as const) {
        const s = side === 'l' ? L : -L
        arm(side, new THREE.Vector3(s * 0.8, -0.55, -0.18), new THREE.Vector3(-s * 0.65, -0.5, 0.2), hips)
      }
    if (hips > 0.001) this.turnBone('spine_03', AX.x, -0.16 * hips)
    // "You're next": right arm points at the camera, left fist on the hip
    if (point > 0.001) {
      const bob = Math.sin(this.t * 2.2) * 0.04
      arm('r', new THREE.Vector3(-L * 0.18, 0.12 + bob, 1), new THREE.Vector3(-L * 0.1, 0.16 + bob, 1), point)
      arm('l', new THREE.Vector3(L * 0.8, -0.55, -0.18), new THREE.Vector3(-L * 0.65, -0.5, 0.2), point)
      this.turnBone('spine_02', AX.y, -L * 0.12 * point)
    }
    // push-ups: the model is pitched into a plank (see update); arms lock out at the top, elbows flare at the bottom
    if (pushup > 0.001)
      for (const side of ['l', 'r'] as const) {
        const s = side === 'l' ? L : -L
        const u = this.pushPhase
        arm(side, mix(new THREE.Vector3(s * 0.85, -0.5, -0.2), new THREE.Vector3(s * 0.2, -1, 0.05), u), mix(new THREE.Vector3(s * 0.08, -1, 0.12), new THREE.Vector3(s * 0.05, -1, 0.04), u), pushup)
      }

    // bench press: lying on the bench (model pitched onto its back), feet on the floor, bar from chest to lockout
    if (bench > 0.001)
      for (const side of ['l', 'r'] as const) {
        const s = side === 'l' ? L : -L
        arm(side, mix(new THREE.Vector3(s * 0.85, -0.35, 0.05), new THREE.Vector3(s * 0.22, 1, 0.02), e), mix(new THREE.Vector3(s * 0.05, 1, 0), new THREE.Vector3(s * 0.08, 1, 0), e), bench)
        this.aim(this.bone(`thigh_${side}`), this.bone(`calf_${side}`), new THREE.Vector3(s * 0.35, -0.62, 0.7), bench)
        this.aim(this.bone(`calf_${side}`), this.bone(`foot_${side}`), new THREE.Vector3(s * 0.1, -1, 0.08), bench)
      }
  }

  private pushPhase = 1
  private tb = { pos: new THREE.Vector3(), scl: new THREE.Vector3(), pq: new THREE.Quaternion(), ax: new THREE.Vector3(), rq: new THREE.Quaternion(), rot: new THREE.Quaternion() }
  /** Rotate a bone about a character-space axis (independent of the bone's own local axes).
   *  Cheap: reads the parent's current world transform and leaves descendant matrices to the renderer's
   *  once-per-frame update (the tiny lag from earlier turns in the same chain is invisible at these angles). */
  private turnBone(name: string, axis: THREE.Vector3, angle: number) {
    if (Math.abs(angle) < 1e-4) return
    const b = this.bone(name)
    const T = this.tb
    b.parent!.matrixWorld.decompose(T.pos, T.pq, T.scl)
    this.root.matrixWorld.decompose(T.pos, T.rq, T.scl)
    T.ax.copy(axis).applyQuaternion(T.rq).applyQuaternion(T.pq.invert())
    b.quaternion.premultiply(T.rot.setFromAxisAngle(T.ax, angle))
  }

  /** Per-species idle character: posture, breathing rhythm and an occasional fidget. Plus lean from movement. */
  private applyPersonality(dt: number) {
    const P = this.persona
    const standing = this.pose === 'idle' || this.pose === 'walk'
    const still = standing && this.speed < 0.05 && this.air === 'ground' && !this.oneShot
    const kStand = standing ? 1 : 0
    // posture (always on while standing / walking)
    if (kStand) {
      this.turnBone('spine_03', AX.x, P.chest)
      this.turnBone('neck_01', AX.x, P.headDown)
      if (P.sway) this.turnBone('spine_02', AX.z, Math.sin(this.t * P.swayRate) * P.sway * (still ? 1 : 0.3))
    }
    // lean into turns and acceleration (smoothed, scaled by speed so standing turns stay upright)
    const kl = 1 - Math.exp(-dt * 6)
    this.leanNow.turn += (THREE.MathUtils.clamp(this.lean.turn, -1, 1) - this.leanNow.turn) * kl
    this.leanNow.accel += (THREE.MathUtils.clamp(this.lean.accel, -1, 1) - this.leanNow.accel) * kl
    if (kStand && this.air === 'ground') {
      // subtle: a few degrees into turns and with acceleration, never a sideways slump
      this.turnBone('spine_01', AX.z, -this.leanNow.turn * 0.07)
      this.turnBone('spine_01', AX.x, this.leanNow.accel * 0.05)
    }
    // fidgets
    if (!still || !this.fidgets) {
      this.fidget = null
      this.nextFidget = Math.max(this.nextFidget, this.t + 3)
      return
    }
    if (!this.fidget && this.t > this.nextFidget) this.fidget = { kind: P.fidget, t0: this.t, dur: P.fidget === 'flex' ? 1.6 : 1.4 }
    const f = this.fidget
    if (!f) return
    const u = (this.t - f.t0) / f.dur
    if (u >= 1) {
      this.fidget = null
      this.nextFidget = this.t + 6 + Math.random() * 7
      return
    }
    const env = Math.sin(Math.PI * Math.min(1, u * 1.15))
    if (f.kind === 'flex') {
      const L = this.leftSign
      const k = env * 0.95
      for (const side of ['l', 'r'] as const) {
        const s = side === 'l' ? L : -L
        this.aim(this.bone(`upperarm_${side}`), this.bone(`lowerarm_${side}`), new THREE.Vector3(s, 0.32, 0.12), k)
        this.aim(this.bone(`lowerarm_${side}`), this.bone(`hand_${side}`), new THREE.Vector3(s * 0.12, 1, 0.1), k)
      }
      this.turnBone('spine_03', AX.x, -0.1 * env)
    } else if (f.kind === 'creak') {
      // the skeleton's skull tilts one way, then clicks back
      this.turnBone('Head', AX.z, env * 0.38 * (u < 0.55 ? 1 : 1 + Math.sin(this.t * 40) * 0.05))
      this.turnBone('neck_01', AX.x, env * 0.08)
    } else {
      // the demon rolls his neck
      const a = u * Math.PI * 2
      this.turnBone('Head', AX.z, Math.sin(a) * 0.28 * env)
      this.turnBone('Head', AX.x, (Math.cos(a) * 0.5 + 0.5) * 0.22 * env)
    }
  }

  private ik = { hip: new THREE.Vector3(), knee: new THREE.Vector3(), ankle: new THREE.Vector3(), d: new THREE.Vector3(), bend: new THREE.Vector3() }
  /** Squat: drop the pelvis, lean the torso, then re-solve each leg so the ankles stay where the idle pose planted them. */
  private squatLegs(depth: number, shape = { drop: 0.42, back: 0.12, lean: 0.5 }) {
    if (depth < 0.001) return
    const P = this.ik
    const rq = this.root.getWorldQuaternion(new THREE.Quaternion())
    const inv = rq.clone().invert()
    const ankles = (['l', 'r'] as const).map((s) => this.bone(`foot_${s}`).getWorldPosition(new THREE.Vector3()))
    const pelvis = this.bone('pelvis')
    const pw = pelvis.getWorldPosition(new THREE.Vector3())
    pw.y -= depth * shape.drop
    pw.addScaledVector(new THREE.Vector3(0, 0, -1).applyQuaternion(rq), depth * shape.back) // hips travel back
    pelvis.position.copy(pelvis.parent!.worldToLocal(pw))
    pelvis.updateWorldMatrix(false, true)
    // torso leans forward to stay balanced over mid-foot
    const sp = this.bone('spine_01')
    sp.rotateX(depth * shape.lean)
    sp.updateWorldMatrix(false, true)
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(rq)
    ;(['l', 'r'] as const).forEach((side, i) => {
      const thigh = this.bone(`thigh_${side}`)
      const calf = this.bone(`calf_${side}`)
      const foot = this.bone(`foot_${side}`)
      thigh.getWorldPosition(P.hip)
      calf.getWorldPosition(P.knee)
      foot.getWorldPosition(P.ankle)
      const l1 = P.hip.distanceTo(P.knee)
      const l2 = P.knee.distanceTo(P.ankle)
      const target = ankles[i]
      P.d.subVectors(target, P.hip)
      const dist = THREE.MathUtils.clamp(P.d.length(), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3)
      P.d.normalize()
      const a = Math.acos(THREE.MathUtils.clamp((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1))
      // knees track forward and slightly out over the toes
      const out = new THREE.Vector3(1, 0, 0).applyQuaternion(rq).multiplyScalar((side === 'l' ? this.leftSign : -this.leftSign) * 0.35)
      P.bend.copy(fwd).add(out)
      P.bend.addScaledVector(P.d, -P.bend.dot(P.d)).normalize()
      const knee = P.hip.clone().addScaledVector(P.d, Math.cos(a) * l1).addScaledVector(P.bend, Math.sin(a) * l1)
      this.aim(thigh, calf, knee.sub(P.hip).applyQuaternion(inv), 1)
      calf.getWorldPosition(P.knee)
      this.aim(calf, foot, target.clone().sub(P.knee).applyQuaternion(inv), 1)
    })
  }

  update(dt: number) {
    for (const s of this.pose0) {
      s.b.quaternion.copy(s.q)
      s.b.position.copy(s.p)
    }
    this.t += dt
    const k = 1 - Math.exp(-dt * 10)
    this.layer.flex += ((this.pose === 'flex' ? 1 : 0) - this.layer.flex) * k
    this.layer.press += ((this.pose === 'press' ? 1 : 0) - this.layer.press) * k
    this.layer.wave += ((this.pose === 'wave' ? 1 : 0) - this.layer.wave) * k
    for (const key of ['bench', 'squat', 'curl', 'guard', 'hips', 'point', 'deadlift', 'pullup'] as const) this.layer[key] += ((this.pose === key ? 1 : 0) - this.layer[key]) * k
    // push-ups blend in a little slower so dropping into the plank reads as a movement, not a snap
    this.layer.pushup += ((this.pose === 'pushup' ? 1 : 0) - this.layer.pushup) * (1 - Math.exp(-dt * 5))
    // lying down for the bench: pitch the whole model onto its back (head toward -Z), raised onto the pad
    const lie = this.layer.bench
    // push-up plank: pivot on the toes; shoulder height cycles 0.28 → 0.56 m
    this.pushPhase = 0.5 + 0.5 * Math.sin(this.t * 3.1)
    const plank = Math.acos(THREE.MathUtils.clamp((0.28 + 0.28 * this.pushPhase) / 1.34, -1, 1))
    this.model.rotation.x = (-Math.PI / 2) * lie + plank * this.layer.pushup
    // pivoting at the ankles would push the toes through the floor: lift by the toe length
    const toeLift = 0.19 * Math.sin(plank) * this.layer.pushup
    this.model.position.set(this.modelBase.x, this.modelBase.y + 0.7 * lie + toeLift, this.modelBase.z + 0.95 * lie) // bench: back on the pad, head under the J-hooks
    if (this.air === 'air') {
      this.airT += dt
      const js = this.actions.get('jumpStart')
      if (js && this.current === js && this.airT > 0.11) js.timeScale = 1.25 // off the ground: into the airborne pose
    }
    if (this.oneShot && this.t >= this.oneShot.end) {
      this.oneShot.act.fadeOut(0.2)
      this.oneShot = null
      this.current = null // let the base clip fade back in
    }

    // base clip from pose + ground speed (speed is in units of WALK = 3.4 m/s)
    const ms = this.speed * 3.4
    let name = 'idle'
    if (this.air === 'air') name = this.airT < 0.5 ? 'jumpStart' : 'jumpLoop'
    else if (this.pose === 'hammer') name = 'interact'
    else if (this.pose === 'dance') name = 'dance'
    else if (this.pose === 'folded') name = 'folded'
    else if (this.pose === 'sit') name = 'sit'
    // hysteresis: start the gait above 0.2 m/s, stop below 0.1 (no flicker while coming to a halt)
    else if (this.pose === 'idle' || this.pose === 'walk') name = ms < (this.loco.active ? 0.1 : 0.2) ? 'idle' : ms < 1.6 ? 'walk' : ms < 4.8 ? 'jog' : 'sprint'
    const moving = name === 'walk' || name === 'jog' || name === 'sprint'
    if (moving && this.forceTimeScale === null && !this.oneShot) this.updateLoco(ms, dt)
    else this.play(name, name === 'jumpLoop' ? 0.3 : 0.25)
    if (moving && this.forceTimeScale !== null && !this.oneShot && this.current) {
      // QA path (scripts/measure-stride.mjs): one clip at a forced time scale
      const act = this.current
      const qa = (globalThis as unknown as { __chadClipSpeed?: Record<string, number> }).__chadClipSpeed
      act.timeScale = this.forceTimeScale ?? THREE.MathUtils.clamp(ms / (qa?.[name] ?? CLIP_SPEED[name as keyof typeof CLIP_SPEED]), 0.4, 2.4)
      const ph = (act.time / act.getClip().duration) % 1
      if ((this.lastPhase < 0.5 && ph >= 0.5) || ph < this.lastPhase) this.onStep?.()
      this.lastPhase = ph
    } else if (!this.loco.active && this.current && this.current !== this.oneShot?.act && name !== 'jumpStart') this.current.timeScale = name === 'idle' ? this.persona.idleRate : 1
    this.mixer.update(dt)
    if (this.pose0.length !== this.bones.size) this.pose0 = [...this.bones.values()].map((b) => ({ b, q: new THREE.Quaternion(), p: new THREE.Vector3() }))
    for (const s of this.pose0) {
      s.q.copy(s.b.quaternion)
      s.p.copy(s.b.position)
    }
    this.root.updateMatrixWorld(true)
    this.applyPersonality(dt)
    this.applyLayers()
    for (const f of this.fires) f.update(this.t)
  }

  /** QA: everything a test needs to verify the character, in world space. */
  inspect() {
    const wp = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3())
    const rootY = this.root.getWorldPosition(new THREE.Vector3()).y
    const parts: string[] = []
    let tris = 0
    let draws = 0
    this.root.traverse((o) => {
      if (o.name.startsWith('acc:') || o.name.startsWith('cloth:')) parts.push(o.name)
      const m = o as THREE.Mesh
      if (m.isMesh && m.visible) {
        draws++
        tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3
      }
    })
    const headBone = wp(this.bone('Head'))
    const v = (p: THREE.Vector3) => [+p.x.toFixed(4), +(p.y - rootY).toFixed(4), +p.z.toFixed(4)]
    let headGlow = ''
    this.headObj?.traverse((o) => {
      const mm = (o as THREE.Mesh).material as THREE.MeshPhysicalMaterial | undefined
      if (mm?.emissiveMap) headGlow = '#' + mm.emissive.getHexString()
    })
    if (!headGlow) headGlow = '#' + this.glowColor.getHexString()
    return {
      species: this.species,
      pose: this.pose,
      air: this.air,
      fidget: this.fidget?.kind ?? null,
      idleRate: this.persona.idleRate,
      lean: [+this.leanNow.turn.toFixed(3), +this.leanNow.accel.toFixed(3)],
      weights: Object.fromEntries([...this.actions].filter(([, a]) => a.isRunning() || (a.getEffectiveWeight() > 0.001 && a.timeScale === 0)).map(([k, a]) => [k, +a.getEffectiveWeight().toFixed(3)])),
      modelRot: [+this.model.rotation.x.toFixed(3), +this.model.rotation.z.toFixed(3)],
      layers: Object.fromEntries(Object.entries(this.layer).map(([k, v]) => [k, +v.toFixed(3)])),
      parts: parts.sort(),
      tris: Math.round(tris),
      draws,
      skin: '#' + this.skinColor.getHexString(),
      shorts: '#' + this.shortsColor.getHexString(),
      glow: headGlow,
      clip: this.current?.getClip().name ?? null,
      headBone: v(headBone),
      headObj: this.headObj ? v(wp(this.headObj)) : null,
      headAttach: this.headObj ? +wp(this.headObj).distanceTo(headBone).toFixed(4) : null,
      chainAttach: this.chainObj ? +wp(this.chainObj).distanceTo(wp(this.bone('spine_03'))).toFixed(4) : null,
      footL: v(wp(this.bone('foot_l'))),
      footR: v(wp(this.bone('foot_r'))),
      ballL: v(wp(this.bone('ball_l'))),
      ballR: v(wp(this.bone('ball_r'))),
      handL: v(wp(this.bone('hand_l'))),
      handR: v(wp(this.bone('hand_r'))),
      shoulderL: v(wp(this.bone('upperarm_l'))),
      shoulderR: v(wp(this.bone('upperarm_r'))),
      pelvis: v(wp(this.bone('pelvis'))),
      leftSign: this.leftSign,
      upperArmQ: this.bone('upperarm_r').quaternion.toArray().map((n) => +n.toFixed(4)),
      thighQ: this.bone('thigh_l').quaternion.toArray().map((n) => +n.toFixed(4)),
    }
  }

  dispose() {
    this.mixer.stopAllAction()
    this.mixer.uncacheRoot(this.mixer.getRoot())
    // every skinned mesh owns a Skeleton whose bone matrices live in a GPU texture: free them too
    const skeletons = new Set<THREE.Skeleton>()
    this.root.traverse((o) => (o as THREE.SkinnedMesh).isSkinnedMesh && skeletons.add((o as THREE.SkinnedMesh).skeleton))
    skeletons.forEach((s) => s.dispose())
    this.disposables.forEach((d) => d.dispose())
  }
}


/* ───────────── species helpers ───────────── */

/** Outfit piece name: single-primitive meshes carry the node name; multi-primitive ones sit under a named group. */
function pieceName(m: THREE.Object3D) {
  return /^Male_Ranger/.test(m.name) ? m.name : m.parent?.name ?? m.name
}

/** Skull placement inside the hood (tuned against the CC0 skull's axes). */
/** character-space axes for turnBone (x = right/left pitch axis, y = up, z = forward roll axis) */
const AX = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) }
type Persona = { idleRate: number; chest: number; headDown: number; sway: number; swayRate: number; fidget: 'flex' | 'creak' | 'neck' }
/** Each species stands and fidgets differently: Pumpkin = proud show-off, Skeleton = slow, slouched, creaky, Demon = restless menace. */
const PERSONA: Record<string, Persona> = {
  pumpkin: { idleRate: 1, chest: -0.07, headDown: -0.03, sway: 0.02, swayRate: 1.1, fidget: 'flex' },
  skeleton: { idleRate: 0.8, chest: 0.12, headDown: 0.06, sway: 0.035, swayRate: 0.7, fidget: 'creak' },
  demon: { idleRate: 1.15, chest: -0.03, headDown: 0.1, sway: 0.015, swayRate: 1.6, fidget: 'neck' },
}

/** Ranger pieces on the muscular body: [normal offset, uniform scale, lift] */
const DEMON_FIT: { belt: [number, number, number]; pauldron: [number, number, number]; bootHide: number } = { belt: [0.014, 0.95, -0.05], pauldron: [0.004, 1.14, 0.01], bootHide: 0.5 }
const SKULL = { rx: 0, ry: 0, width: 0.155, lift: 0.095, fwd: 0.02, eyeX: 0.2, eyeY: 0.03, eyeZ: 0.44, chainScale: 1.12, chainDrop: 0.03, chainFwd: 0.01, crownW: 0.7, crownSink: 0.06, crownZ: 0 }

/** Tint a textured material toward a colour while keeping its painted detail. */
function tintShader(mat: THREE.MeshStandardMaterial, color: THREE.Color, amount: number) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTint = { value: color }
    sh.uniforms.uAmt = { value: amount }
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uTint;\nuniform float uAmt;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        {
          float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          diffuseColor.rgb = mix(diffuseColor.rgb, uTint * (0.25 + lum * 1.9), uAmt);
        }`,
      )
  }
  mat.customProgramCacheKey = () => 'chad-tint'
}

/** Rebind selected Ranger outfit pieces onto another body's skeleton (same bone names). */
function rebind(ranger: THREE.Group, body: THREE.SkinnedMesh, pieces: [RegExp, number, number?, number?][], tint: string, amount: number, D: (THREE.Material | THREE.BufferGeometry | THREE.Texture)[]) {
  const out: THREE.SkinnedMesh[] = []
  const byName = new Map(body.skeleton.bones.map((b) => [b.name, b]))
  const mats = new Map<THREE.Material, THREE.Material>()
  ranger.traverse((o) => {
    const src = o as THREE.SkinnedMesh
    if (!src.isSkinnedMesh) return
    const name = pieceName(src)
    const hit = pieces.find(([re]) => re.test(name))
    if (!hit) return
    const srcMat = src.material as THREE.MeshStandardMaterial
    if (srcMat.name === 'Hands') return
    if (!mats.has(srcMat)) {
      const c = srcMat.clone()
      tintShader(c, new THREE.Color(tint), amount)
      mats.set(srcMat, c)
      D.push(c)
    }
    const g = src.geometry.clone()
    if (hit[1]) {
      const pos = g.attributes.position as THREE.BufferAttribute
      const nor = g.attributes.normal as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) + nor.getX(i) * hit[1], pos.getY(i) + nor.getY(i) * hit[1], pos.getZ(i) + nor.getZ(i) * hit[1])
    }
    // uniform scale about the piece's own centre (+ lift): fits a bulkier body without pushing layered parts through each other
    if ((hit[2] && hit[2] !== 1) || hit[3]) {
      g.computeBoundingBox()
      const c = g.boundingBox!.getCenter(new THREE.Vector3())
      const k = hit[2] ?? 1
      g.translate(-c.x, -c.y, -c.z).scale(k, k, k).translate(c.x, c.y + (hit[3] ?? 0), c.z)
    }
    D.push(g)
    const bones = src.skeleton.bones.map((b) => byName.get(b.name)!)
    const skel = new THREE.Skeleton(bones, src.skeleton.boneInverses.map((m) => m.clone()))
    const m = new THREE.SkinnedMesh(g, mats.get(srcMat)!)
    m.bind(skel, src.bindMatrix.clone())
    m.castShadow = true
    m.frustumCulled = false
    m.name = 'cloth:' + name.replace(/^Male_Ranger_/, '').toLowerCase()
    m.userData.piece = name
    out.push(m)
  })
  return out
}

/** Hide body triangles that sit under footwear (avoids toes poking through boots). */
function hideUnder(mesh: THREE.SkinnedMesh, bones: string[], maxY: number) {
  const set = new Set(bones.map((n) => mesh.skeleton.bones.findIndex((b) => b.name === n)))
  const g = mesh.geometry
  const si = g.attributes.skinIndex as THREE.BufferAttribute
  const sw = g.attributes.skinWeight as THREE.BufferAttribute
  const pos = g.attributes.position as THREE.BufferAttribute
  const w = (v: number) => {
    let t = 0
    for (let k = 0; k < 4; k++) if (set.has(si.getComponent(v, k))) t += sw.getComponent(v, k)
    return t
  }
  const idx = g.index!
  const keep: number[] = []
  for (let t = 0; t < idx.count; t += 3) {
    const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2)
    if (w(a) > 0.5 && w(b) > 0.5 && w(c) > 0.5 && pos.getY(a) < maxY) continue
    keep.push(a, b, c)
  }
  const ng = g.clone()
  ng.setIndex(keep)
  mesh.geometry = ng
  return ng
}

/** Faint branching vein pattern for demon skin (emissive mask). */
function veinTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 1024
  const g = c.getContext('2d')!
  g.fillStyle = '#000'
  g.fillRect(0, 0, 1024, 1024)
  let seed = 17
  const r = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  for (let n = 0; n < 70; n++) {
    let x = r() * 1024
    let y = r() * 1024
    let ang = r() * Math.PI * 2
    g.lineWidth = 1 + r() * 1.6
    g.strokeStyle = `rgba(255,255,255,${0.35 + r() * 0.4})`
    g.beginPath()
    g.moveTo(x, y)
    for (let i = 0; i < 26; i++) {
      ang += (r() - 0.5) * 0.9
      x += Math.cos(ang) * 9
      y += Math.sin(ang) * 9
      g.lineTo(x, y)
      if (r() < 0.08) {
        g.stroke()
        g.lineWidth *= 0.7
        g.beginPath()
        g.moveTo(x, y)
      }
    }
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Sculpted, ridged, tapering demon horns (one draw call, gradient via vertex colours). */
function buildDemonHorns(D: (THREE.Material | THREE.BufferGeometry | THREE.Texture)[]) {
  const group = new THREE.Group()
  const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.5 })
  D.push(mat)
  const tips: THREE.Vector3[] = []
  const base = new THREE.Color('#4a2a1a')
  const tipC = new THREE.Color('#0b0808')
  for (const s of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(s * 0.05, 0.0, 0.035),
      new THREE.Vector3(s * 0.1, 0.06, 0.01),
      new THREE.Vector3(s * 0.15, 0.1, -0.05),
      new THREE.Vector3(s * 0.17, 0.07, -0.12),
      new THREE.Vector3(s * 0.15, 0.0, -0.13),
      new THREE.Vector3(s * 0.14, -0.03, -0.08),
    ])
    const SEG = 40
    const RAD = 12
    const tube = new THREE.TubeGeometry(curve, SEG, 1, RAD, false)
    const pos = tube.attributes.position as THREE.BufferAttribute
    const col = new Float32Array(pos.count * 3)
    for (let ring = 0; ring <= SEG; ring++) {
      const t = ring / SEG
      const center = curve.getPointAt(t)
      const radius = (0.05 * Math.pow(1 - t, 1.1) + 0.004) * (1 + 0.1 * Math.sin(t * 52)) // taper + growth ridges
      const c = base.clone().lerp(tipC, Math.pow(t, 0.8))
      for (let k = 0; k <= RAD; k++) {
        const i = ring * (RAD + 1) + k
        const dx = pos.getX(i) - center.x
        const dy = pos.getY(i) - center.y
        const dz = pos.getZ(i) - center.z
        pos.setXYZ(i, center.x + dx * radius, center.y + dy * radius, center.z + dz * radius)
        col.set([c.r, c.g, c.b], i * 3)
      }
    }
    tube.setAttribute('color', new THREE.BufferAttribute(col, 3))
    tube.computeVertexNormals()
    D.push(tube)
    const m = new THREE.Mesh(tube, mat)
    m.castShadow = true
    group.add(m)
    tips.push(curve.getPointAt(1))
  }
  group.userData.tips = tips
  return group
}
