import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import { disposeObject } from '../engine/Engine'
import { buildCharacter, type Pose } from './build'
import { PumpkinChad, loadChadAssets, type OneShot } from './chad'
import { MODELS, TEST_MODEL, type ModelSpec } from './models'
import type { Appearance } from './types'

/** What the game needs from any character, procedural or GLB. */
export interface Character {
  root: THREE.Object3D
  pose: Pose
  speed: number
  pressAmount: number
  headHeight: number
  fistL: THREE.Object3D
  fistR: THREE.Object3D
  onStep: (() => void) | null
  /** 'procedural' stand-in or a loaded 'model' */
  kind: 'procedural' | 'model'
  update(dt: number): void
  /** real models only: play a library clip once (punches, celebrate...), returns its length in seconds */
  playOnce?(name: OneShot, fade?: number, opts?: { timeScale?: number; maxDur?: number }): number
  cancelOneShot?(): void
  /** real models: start a jump (crouch → take-off clip); the scene owns the physics */
  jump?(): void
  /** real models: tell the rig whether the feet are on the ground (drives air / landing clips) */
  setGrounded?(grounded: boolean, quiet?: boolean): void
  /** real models: body lean from turning (-1..1) and acceleration (-1..1) */
  lean?: { turn: number; accel: number }
  /** real models: allow personality fidgets while standing idle */
  fidgets?: boolean
}

const loader = new GLTFLoader()
const cache = new Map<string, Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>>()

function loadGLB(url: string) {
  if (!cache.has(url)) {
    const full = import.meta.env.BASE_URL + url.replace(/^\//, '')
    const p = loader.loadAsync(full).then((g) => ({ scene: g.scene, animations: g.animations }))
    p.catch(() => cache.delete(url)) // allow retry after a failed download
    cache.set(url, p)
  }
  return cache.get(url)!
}

/** Preload a species' model in the background (no-op for procedural species). */
export function preloadModel(species: Appearance['species']) {
  void loadChadAssets(species).catch(() => {})
  const spec = MODELS[species]
  if (spec) void loadGLB(spec.url).catch(() => {})
}

class ModelCharacter implements Character {
  kind = 'model' as const
  root = new THREE.Group()
  pose: Pose = 'idle'
  speed = 0
  pressAmount = 0
  headHeight = 1.9
  fistL: THREE.Object3D
  fistR: THREE.Object3D
  onStep: (() => void) | null = null
  private mixer: THREE.AnimationMixer
  private actions = new Map<string, THREE.AnimationAction>()
  private current: THREE.AnimationAction | null = null
  private lastWalkT = 0

  constructor(src: { scene: THREE.Group; animations: THREE.AnimationClip[] }, private spec: ModelSpec, a: Appearance) {
    const model = SkeletonUtils.clone(src.scene) as THREE.Group
    if (spec.scale) model.scale.setScalar(spec.scale)
    this.root.add(model)
    const tint = (names: string[] | undefined, color: string, emissive = false) => {
      if (!names?.length) return
      model.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh) return
        const mats = Array.isArray(m.material) ? m.material : [m.material]
        m.material = mats.map((mat) => {
          if (!names.includes(mat.name)) return mat
          const c = (mat as THREE.MeshStandardMaterial).clone() // never mutate the shared cached material
          if (emissive) {
            c.emissive = new THREE.Color(color)
            c.emissiveIntensity = 2
          } else c.color = new THREE.Color(color)
          return c
        }) as unknown as THREE.Material
        if ((m.material as unknown as THREE.Material[]).length === 1) m.material = (m.material as unknown as THREE.Material[])[0]
      })
    }
    tint(spec.tint?.skin, a.skin)
    tint(spec.tint?.outfit, a.outfit)
    tint(spec.tint?.glow, a.glow, true)
    model.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true
    })

    const bone = (n?: string) => (n ? model.getObjectByName(n) : undefined)
    this.fistL = bone(spec.bones?.handL) ?? this.root
    this.fistR = bone(spec.bones?.handR) ?? this.root
    const box = new THREE.Box3().setFromObject(model)
    this.headHeight = Math.max(1, box.max.y - 0.15)

    this.mixer = new THREE.AnimationMixer(model)
    for (const [pose, clipName] of Object.entries(spec.clips)) {
      const clip = src.animations.find((c) => c.name === clipName)
      if (clip) this.actions.set(pose, this.mixer.clipAction(clip))
    }
    this.play('idle', 0)
  }

  private play(name: string, fade = 0.25) {
    const next = this.actions.get(name) ?? this.actions.get('idle')
    if (!next || next === this.current) return
    next.reset().setEffectiveWeight(1).fadeIn(fade).play()
    this.current?.fadeOut(fade)
    this.current = next
  }

  update(dt: number) {
    let name: string = this.pose
    if (this.pose === 'idle' || this.pose === 'walk') name = this.speed > 1.05 ? 'run' : this.speed > 0.05 ? 'walk' : 'idle'
    this.play(name)
    const walk = this.actions.get(name === 'run' ? 'run' : 'walk')
    if (walk && this.current === walk) {
      walk.timeScale = Math.max(0.6, Math.min(1.4, this.speed))
      const t = (walk.time / walk.getClip().duration) % 1
      for (const f of this.spec.footfalls ?? [])
        if (this.lastWalkT < f && t >= f) this.onStep?.()
      this.lastWalkT = t
    }
    this.mixer.update(dt)
  }
}

/**
 * Create a character: the species' GLB if one is configured (or `?model=robot` for the
 * pipeline test), otherwise the procedural stand-in. A failed download falls back too.
 */
export async function createCharacter(a: Appearance): Promise<Character> {
  const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams()
  const forceTest = params.get('model') === 'robot'
  // Pumpkin Chad: real rigged body + library animations (falls back to the stand-in if loading fails)
  if (!forceTest && params.get('legacy') !== '1') {
    try {
      return new PumpkinChad(await loadChadAssets(a.species), a)
    } catch (err) {
      console.warn('[chadverse] Pumpkin Chad model failed, using stand-in:', err)
    }
  }
  const spec = forceTest ? TEST_MODEL : MODELS[a.species]
  if (spec) {
    try {
      const src = await loadGLB(spec.url)
      return new ModelCharacter(src, spec, a)
    } catch (err) {
      console.warn('[chadverse] model failed to load, using stand-in:', spec.url, err)
    }
  }
  return buildCharacter(a)
}

/** Free a character. GLB clones share geometry with the cache, so only procedural meshes are disposed. */
export function disposeCharacter(c: Character) {
  c.root.removeFromParent()
  if (c instanceof PumpkinChad) c.dispose()
  else if (c.kind === 'procedural') disposeObject(c.root)
  else c.root.traverse((o) => (o as THREE.SkinnedMesh).isSkinnedMesh && (o as THREE.SkinnedMesh).skeleton.dispose()) // bone textures are per clone
}
