import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Pose } from './build'
import type { Character } from './character'
import type { Appearance } from './types'
import { buildChain, buildPumpkinHead, buildShades, buildHeadwear } from './chadParts'

/**
 * Pumpkin Chad on a real rigged body.
 *   Body + rig: Quaternius "Universal Base Characters" Superhero Male (CC0)
 *   Animations: Quaternius "Universal Animation Library" (CC0) — same 65-bone rig
 * The human head is removed from the mesh; a modelled jack-o'-lantern rides the Head bone.
 * Gameplay only talks to the Character interface, never to bone names.
 */

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
const base = () => import.meta.env.BASE_URL
let assets: Promise<{ body: THREE.Group; clips: Map<string, THREE.AnimationClip> }> | null = null
export function loadChadAssets() {
  if (!assets) {
    assets = Promise.all([
      loader.loadAsync(`${base()}chadverse/models/chad_body.glb`),
      loader.loadAsync(`${base()}chadverse/models/chad_anims.glb`),
    ]).then(([b, a]) => ({ body: b.scene, clips: new Map(a.animations.map((c) => [c.name, c])) }))
    assets.catch(() => (assets = null))
  }
  return assets
}

/* Clip names in the library, and the speed (m/s) each locomotion clip was authored at,
   so playback rate can match ground speed (no foot sliding). */
const CLIPS = { idle: 'Idle_Loop', walk: 'Walk_Loop', jog: 'Jog_Fwd_Loop', sprint: 'Sprint_Loop', dance: 'Dance_Loop', interact: 'Interact', talk: 'Idle_Talking_Loop' }
/* Measured with scripts/sweep-stride.mjs: zero-slip speeds are walk 0.91, jog 6.2, sprint 9.4 m/s.
   Jog/sprint are set slightly lower (≈8% slip) for a livelier cadence at game speeds. */
const CLIP_SPEED = { walk: 0.91, jog: 5.8, sprint: 8.8 }
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
function mergeStatic(root: THREE.Object3D) {
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
  private layer = { flex: 0, press: 0, wave: 0 }
  private t = 0
  private lastPhase = 0
  private disposables: (THREE.Material | THREE.BufferGeometry | THREE.Texture)[] = []
  private headObj: THREE.Object3D | null = null
  private chainObj: THREE.Object3D | null = null
  private skinColor = new THREE.Color()
  private shortsColor = new THREE.Color()
  private glowColor = new THREE.Color()
  /** character-space side sign of the left hand (+1 if left is +X) */
  private leftSign = 1

  constructor(src: { body: THREE.Group; clips: Map<string, THREE.AnimationClip> }, a: Appearance) {
    const model = SkeletonUtils.clone(src.body) as THREE.Group
    this.root.add(model)
    let body: THREE.SkinnedMesh | null = null
    model.traverse((o) => {
      if ((o as THREE.Bone).isBone) this.bones.set(o.name, o as THREE.Bone)
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) body = o as THREE.SkinnedMesh
    })
    if (!body) throw new Error('chad body missing skinned mesh')
    const B = body as THREE.SkinnedMesh
    B.castShadow = true
    B.frustumCulled = false
    removeHead(B)

    // skin + shorts recolour on a private material clone
    const skinMat = (B.material as THREE.MeshStandardMaterial).clone()
    skinMat.roughness = 0.62
    this.skinColor.set(a.skin)
    this.shortsColor.set(a.top === 'armor' ? '#1a181c' : a.outfit)
    this.glowColor.set(a.glow)
    recolour(skinMat, this.skinColor, this.shortsColor)
    B.material = skinMat
    this.disposables.push(skinMat, B.geometry)

    model.updateMatrixWorld(true)
    const hl = this.bone('hand_l').getWorldPosition(new THREE.Vector3())
    this.leftSign = Math.sign(hl.x) || 1

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
    mergeStatic(pumpkin)
    head.attach(pumpkin)
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

    this.fistL = this.bone('hand_l')
    this.fistR = this.bone('hand_r')
    const box = new THREE.Box3().setFromObject(pumpkin)
    this.headHeight = box.max.y - 0.1

    this.mixer = new THREE.AnimationMixer(model)
    for (const [k, name] of Object.entries(CLIPS)) {
      const clip = src.clips.get(name)
      if (clip) this.actions.set(k, this.mixer.clipAction(clip))
    }
    this.play('idle', 0)
  }

  private bone(n: string) {
    const b = this.bones.get(n)
    if (!b) throw new Error(`bone ${n} missing`)
    return b
  }

  private play(name: string, fade = 0.25) {
    const next = this.actions.get(name) ?? this.actions.get('idle')!
    if (next === this.current) return
    next.reset().setEffectiveWeight(1).fadeIn(fade).play()
    this.current?.fadeOut(fade)
    this.current = next
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
  }

  update(dt: number) {
    this.t += dt
    const k = 1 - Math.exp(-dt * 10)
    this.layer.flex += ((this.pose === 'flex' ? 1 : 0) - this.layer.flex) * k
    this.layer.press += ((this.pose === 'press' ? 1 : 0) - this.layer.press) * k
    this.layer.wave += ((this.pose === 'wave' ? 1 : 0) - this.layer.wave) * k

    // base clip from pose + ground speed (speed is in units of WALK = 3.4 m/s)
    const ms = this.speed * 3.4
    let name = 'idle'
    if (this.pose === 'hammer') name = 'interact'
    else if (this.pose === 'dance') name = 'dance'
    else if (this.pose === 'idle' || this.pose === 'walk') name = ms < 0.15 ? 'idle' : ms < 1.6 ? 'walk' : ms < 4.8 ? 'jog' : 'sprint'
    this.play(name)
    if (name === 'walk' || name === 'jog' || name === 'sprint') {
      const act = this.current!
      const qa = (globalThis as unknown as { __chadClipSpeed?: Record<string, number> }).__chadClipSpeed
      act.timeScale = this.forceTimeScale ?? THREE.MathUtils.clamp(ms / (qa?.[name] ?? CLIP_SPEED[name]), 0.4, 2.4)
      const ph = (act.time / act.getClip().duration) % 1
      if ((this.lastPhase < 0.5 && ph >= 0.5) || ph < this.lastPhase) this.onStep?.()
      this.lastPhase = ph
    } else if (this.current) this.current.timeScale = 1
    this.mixer.update(dt)
    this.root.updateMatrixWorld(true)
    this.applyLayers()
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
    return {
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
    this.disposables.forEach((d) => d.dispose())
  }
}
