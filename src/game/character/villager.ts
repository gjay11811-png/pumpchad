import * as THREE from 'three'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Pose } from './build'
import type { Character } from './character'
import { modelFile } from './chad'

/**
 * Villagers: the people of the Chadverse — real human proportions, real clothes, not copies of the playable Chads.
 *
 * Assembled at runtime from CC0 Quaternius parts that all share one 65-bone rig (so the same animation library
 * drives them): a Peasant or Ranger outfit on a regular body (villager_*.glb / chad_ranger.glb), a human head +
 * eyes + brows cut from the base body (chad_body.glb / villager_fbody.glb), a head-rigged hairstyle, then role
 * pieces built here — witch / wizard hats, a guard's kettle helmet, a flat cap, a bonnet, an apron, a lantern,
 * a staff, a broom, a basket. Cloth, skin and hair are tinted per villager, so a handful of files make a whole town.
 */
export type VillagerLook = {
  body: 'm' | 'f'
  outfit: 'peasant' | 'ranger'
  /** multiplies the outfit texture (keep it light: '#ffffff' = as painted) */
  cloth: string
  /** skin tone, -1 (deep) … 0 (as painted) … +1 (fair) — tints the painted skin texture */
  skin: number
  hair: 'none' | 'long' | 'buns' | 'buzzed' | 'buzzedfemale' | 'simpleparted'
  beard?: boolean
  hairColor: string
  hat?: 'witch' | 'wizard' | 'guard' | 'cap' | 'bonnet' | null
  hatColor?: string
  apron?: string | null
  prop?: 'lantern' | 'staff' | 'broom' | 'basket' | null
  /** body height scale (people aren't all the same size) */
  height?: number
}

const OUTFIT: Record<'m' | 'f', Record<'peasant' | 'ranger', string>> = {
  m: { peasant: 'villager_m.glb', ranger: 'chad_ranger.glb' },
  f: { peasant: 'villager_f.glb', ranger: 'villager_rf.glb' },
}
const BODY = { m: 'chad_body.glb', f: 'villager_fbody.glb' }
const CLIPS: Record<string, string> = { idle: 'Idle_Loop', walk: 'Walk_Loop', talk: 'Idle_Talking_Loop', sit: 'Sitting_Idle_Loop', folded: 'Idle_FoldArms_Loop', dance: 'Dance_Loop', work: 'Farm_Harvest', yes: 'Yes' }
/** Walk_Loop covers ~0.92 m per second of clip at 1× */
const WALK_SPEED = 0.92

/** bind = the source mesh's bindMatrix: its geometry is in that mesh's space, bones live in bind (skeleton) space */
type Part = { id: string; geo: THREE.BufferGeometry; mat: THREE.Material; bones: string[]; headPos: THREE.Vector3; bind: THREE.Matrix4 }
const partCache = new Map<string, Promise<Part[]>>()

/** bind-pose world position of a named bone */
function bindPosOf(names: string[], inverses: THREE.Matrix4[], name: string) {
  const i = names.indexOf(name)
  if (i < 0) return new THREE.Vector3()
  return new THREE.Vector3().setFromMatrixPosition(inverses[i].clone().invert())
}
const bindPos = (sk: THREE.Skeleton, name: string) => bindPosOf(sk.bones.map((b) => b.name), sk.boneInverses, name)

/** a new geometry holding only the given triangles' vertices (position, normal, uv, skinning) */
function compact(g: THREE.BufferGeometry, tris: number[]) {
  const remap = new Map<number, number>()
  const keys = ['position', 'normal', 'uv', 'skinIndex', 'skinWeight'].filter((k) => g.attributes[k])
  const data: Record<string, number[]> = Object.fromEntries(keys.map((k) => [k, []]))
  const index: number[] = []
  for (const v of tris) {
    let n = remap.get(v)
    if (n === undefined) {
      n = remap.size
      remap.set(v, n)
      for (const k of keys) {
        const a = g.attributes[k] as THREE.BufferAttribute
        for (let c = 0; c < a.itemSize; c++) data[k].push(a.getComponent(v, c))
      }
    }
    index.push(n)
  }
  const out = new THREE.BufferGeometry()
  for (const k of keys) {
    const a = g.attributes[k] as THREE.BufferAttribute
    out.setAttribute(k, k === 'skinIndex' ? new THREE.Uint16BufferAttribute(data[k], 4) : new THREE.Float32BufferAttribute(data[k], a.itemSize))
  }
  out.setIndex(index)
  return out
}

/** skinIndex rewritten from one skeleton's joint order to another's (by bone name) */
function reindex(g: THREE.BufferGeometry, from: string[], to: string[]) {
  const map = from.map((n) => Math.max(0, to.indexOf(n)))
  const si = g.attributes.skinIndex as THREE.BufferAttribute
  const SI = new Uint16Array(si.count * 4)
  for (let i = 0; i < si.count; i++) for (let k = 0; k < 4; k++) SI[i * 4 + k] = map[si.getComponent(i, k)] ?? 0
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4))
}

/**
 * The head (+ upper neck), eyes and brows of a base body, as standalone skinned geometry (cached per body file;
 * the head is compacted to its own vertices, so it costs a few thousand verts, not the whole body).
 */
function headParts(bodyFile: string) {
  if (!partCache.has(bodyFile))
    partCache.set(
      bodyFile,
      modelFile(bodyFile).then(({ scene }) => {
        const out: Part[] = []
        scene.updateMatrixWorld(true)
        scene.traverse((o) => {
          const m = o as THREE.SkinnedMesh
          if (!m.isSkinnedMesh) return
          const sk = m.skeleton
          const bones = sk.bones.map((b) => b.name)
          const name = (m.material as THREE.Material).name
          let geo = m.geometry
          if (name === 'Skin') {
            // keep only the head + the top of the neck (the outfit's collar covers the rest)
            const head = bones.indexOf('Head')
            const neck = bones.indexOf('neck_01')
            const neckY = bindPos(sk, 'neck_01').y
            const si = geo.attributes.skinIndex as THREE.BufferAttribute
            const sw = geo.attributes.skinWeight as THREE.BufferAttribute
            const pos = geo.attributes.position as THREE.BufferAttribute
            const w = (v: number) => {
              let s = 0
              for (let k = 0; k < 4; k++) {
                const j = si.getComponent(v, k)
                if (j === head || j === neck) s += sw.getComponent(v, k)
              }
              return s
            }
            const idx = geo.index!
            const keep: number[] = []
            for (let t = 0; t < idx.count; t += 3) {
              const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2)
              if (Math.min(w(a), w(b), w(c)) < 0.5) continue
              if (Math.min(pos.getY(a), pos.getY(b), pos.getY(c)) < neckY + 0.02) continue
              keep.push(a, b, c)
            }
            geo = compact(geo, keep)
          }
          out.push({ id: `${bodyFile}:${name}`, geo, mat: m.material as THREE.Material, bones, headPos: bindPos(sk, 'Head'), bind: m.bindMatrix.clone() })
        })
        return out
      }),
    )
  return partCache.get(bodyFile)!
}

/** head-rigged hairstyle geometry (cached per file) */
const hairCache = new Map<string, Promise<Part>>()
function hairPart(name: string) {
  if (!hairCache.has(name))
    hairCache.set(
      name,
      modelFile(`vhair_${name}.glb`).then(({ scene }) => {
        let part: Part | null = null
        scene.updateMatrixWorld(true)
        scene.traverse((o) => {
          const m = o as THREE.SkinnedMesh
          if (m.isSkinnedMesh && !part) part = { id: `hair:${name}`, geo: m.geometry, mat: m.material as THREE.Material, bones: m.skeleton.bones.map((b) => b.name), headPos: bindPos(m.skeleton, 'Head'), bind: m.bindMatrix.clone() }
        })
        return part!
      }),
    )
  return hairCache.get(name)!
}

/**
 * An outfit prepared once per file: every piece re-indexed onto ONE joint order and merged by material, in the
 * space of the first mesh. A villager then needs one skeleton (one bone texture) and a draw per material.
 */
type OutfitPrep = { file: string; scene: THREE.Group; boneNames: string[]; boneInverses: THREE.Matrix4[]; bind: THREE.Matrix4; local: THREE.Matrix4; pieces: { geo: THREE.BufferGeometry; mat: THREE.Material }[] }
const outfitCache = new Map<string, Promise<OutfitPrep>>()
function prepOutfit(file: string) {
  if (!outfitCache.has(file))
    outfitCache.set(
      file,
      modelFile(file).then(({ scene }) => {
        scene.updateMatrixWorld(true)
        const meshes: THREE.SkinnedMesh[] = []
        scene.traverse((o) => (o as THREE.SkinnedMesh).isSkinnedMesh && meshes.push(o as THREE.SkinnedMesh))
        const m0 = meshes[0]
        const boneNames = m0.skeleton.bones.map((b) => b.name)
        const toM0 = m0.bindMatrix.clone().invert()
        const byMat = new Map<string, { geos: THREE.BufferGeometry[]; mat: THREE.Material }>()
        for (const m of meshes) {
          const g = new THREE.BufferGeometry()
          for (const k of ['position', 'normal', 'uv', 'skinIndex', 'skinWeight']) if (m.geometry.attributes[k]) g.setAttribute(k, m.geometry.attributes[k].clone())
          g.setIndex(m.geometry.index!.clone())
          reindex(g, m.skeleton.bones.map((b) => b.name), boneNames)
          g.applyMatrix4(m.bindMatrix)
          g.applyMatrix4(toM0)
          const mat = m.material as THREE.Material
          const e = byMat.get(mat.name) ?? { geos: [], mat }
          e.geos.push(g)
          byMat.set(mat.name, e)
        }
        const pieces = [...byMat.values()].map((e) => ({ geo: e.geos.length > 1 ? mergeGeometries(e.geos)! : e.geos[0], mat: e.mat }))
        // the merged pieces replace the originals: mark them so scene teardown never frees the cache
        for (const p of pieces) p.geo.userData.shared = true
        return { file, scene, boneNames, boneInverses: m0.skeleton.boneInverses.map((b) => b.clone()), bind: m0.bindMatrix.clone(), local: m0.matrix.clone(), pieces }
      }),
    )
  return outfitCache.get(file)!
}

/** a head / hair part fitted to an outfit's skeleton (cached per part × outfit: shared by every villager) */
const fitted = new Map<string, THREE.BufferGeometry>()
function fitPart(p: Part, o: OutfitPrep) {
  const key = `${p.id}→${o.file}`
  let g = fitted.get(key)
  if (!g) {
    g = new THREE.BufferGeometry()
    for (const k of ['position', 'normal', 'uv', 'skinIndex', 'skinWeight']) if (p.geo.attributes[k]) g.setAttribute(k, p.geo.attributes[k].clone())
    g.setIndex(p.geo.index!.clone())
    reindex(g, p.bones, o.boneNames)
    // into bind space with the SOURCE mesh's bind matrix, onto this skeleton's head bone, then into the outfit mesh's space
    g.applyMatrix4(p.bind)
    const d = bindPosOf(o.boneNames, o.boneInverses, 'Head').sub(p.headPos)
    g.translate(d.x, d.y, d.z)
    g.applyMatrix4(o.bind.clone().invert())
    g.userData.shared = true
    fitted.set(key, g)
  }
  return g
}

export async function createVillager(look: VillagerLook): Promise<Villager> {
  const [outfit, anims, anims2, head, hair, beard] = await Promise.all([
    prepOutfit(OUTFIT[look.body][look.outfit]),
    modelFile('chad_anims.glb'),
    modelFile('chad_anims2.glb'),
    headParts(BODY[look.body]),
    look.hair !== 'none' ? hairPart(look.hair) : null,
    look.beard ? hairPart('beard') : null,
  ])
  const clips = new Map([...anims.animations, ...anims2.animations].map((c) => [c.name, c]))
  return new Villager(outfit, clips, head, hair, beard, look)
}

export class Villager implements Character {
  kind = 'model' as const
  root = new THREE.Group()
  pose: Pose = 'idle'
  speed = 0
  pressAmount = 0
  headHeight = 1.75
  fistL: THREE.Object3D
  fistR: THREE.Object3D
  onStep: (() => void) | null = null
  private mixer: THREE.AnimationMixer
  private actions = new Map<string, THREE.AnimationAction>()
  private current: THREE.AnimationAction | null = null
  private lastPhase = 0
  private D: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = []
  private glow: THREE.Mesh | null = null
  private t = Math.random() * 10
  private skeleton: THREE.Skeleton

  constructor(o: OutfitPrep, clips: Map<string, THREE.AnimationClip>, head: Part[], hair: Part | null, beard: Part | null, look: VillagerLook) {
    const model = SkeletonUtils.clone(o.scene) as THREE.Group
    this.root.add(model)
    const bones = new Map<string, THREE.Bone>()
    const cloned: THREE.SkinnedMesh[] = []
    model.traverse((n) => {
      if ((n as THREE.Bone).isBone) bones.set(n.name, n as THREE.Bone)
      if ((n as THREE.SkinnedMesh).isSkinnedMesh) cloned.push(n as THREE.SkinnedMesh)
    })
    // one skeleton for the whole villager; the merged pieces hang where the first original mesh did
    const holder = cloned[0].parent!
    for (const m of cloned) m.removeFromParent()
    const sk = new THREE.Skeleton(
      o.boneNames.map((n) => bones.get(n)!),
      o.boneInverses.map((b) => b.clone()),
    )
    this.skeleton = sk
    const t = look.skin
    const skinTint = t >= 0 ? new THREE.Color(1 + t * 0.55, 1 + t * 0.42, 1 + t * 0.36) : new THREE.Color(1 + t * 0.32, 1 + t * 0.38, 1 + t * 0.42)
    const add = (geo: THREE.BufferGeometry, src: THREE.Material, tint?: (m: THREE.MeshStandardMaterial) => void) => {
      const mat = (src as THREE.MeshStandardMaterial).clone()
      tint?.(mat)
      this.D.push(mat)
      const m = new THREE.SkinnedMesh(geo, mat)
      m.matrix.copy(o.local)
      m.matrix.decompose(m.position, m.quaternion, m.scale)
      m.bind(sk, o.bind)
      m.frustumCulled = false
      m.castShadow = true
      holder.add(m)
    }
    for (const p of o.pieces)
      add(p.geo, p.mat, (m) => {
        if (m.name === 'Outfit' || m.name === 'Ranger') m.color.set(look.cloth)
        if (m.name === 'Hands') m.color.copy(skinTint)
      })
    // the human face: head, eyes, brows — then hair + beard
    for (const p of head)
      add(fitPart(p, o), p.mat, (m) => {
        if (m.name === 'Skin') m.color.copy(skinTint)
        if (m.name === 'Brows') m.color.set(look.hairColor)
      })
    for (const p of [hair, beard]) if (p) add(fitPart(p, o), p.mat, (m) => m.color.set(look.hairColor))
    model.updateMatrixWorld(true)
    const headBone = bones.get('Head')!
    const hp = headBone.getWorldPosition(new THREE.Vector3())
    this.headHeight = hp.y + 0.22
    this.fistL = bones.get('hand_l')!
    this.fistR = bones.get('hand_r')!
    this.dressUp(look, bones, hp)
    if (look.height) this.root.scale.setScalar(look.height)

    this.mixer = new THREE.AnimationMixer(model)
    for (const [k, name] of Object.entries(CLIPS)) {
      const c = clips.get(name)
      if (c) this.actions.set(k, this.mixer.clipAction(c))
    }
    this.play('idle', 0)
    this.mixer.update(Math.random() * 3) // no two villagers breathe in sync
  }

  /** role pieces in bind-pose world space, attached to their bones so they follow the animation */
  private dressUp(look: VillagerLook, bones: Map<string, THREE.Bone>, hp: THREE.Vector3) {
    const D = this.D
    const std = (color: string, p: THREE.MeshStandardMaterialParameters = {}) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...p })
      D.push(m)
      return m
    }
    const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
      const o = new THREE.Mesh(g, m)
      o.position.set(x, y, z)
      o.castShadow = true
      D.push(g)
      return o
    }
    const attach = (bone: string, obj: THREE.Object3D) => bones.get(bone)?.attach(obj)
    const top = hp.y + 0.2 // crown of the head
    const hc = look.hatColor ?? '#1e1428'
    if (look.hat) {
      const g = new THREE.Group()
      if (look.hat === 'witch' || look.hat === 'wizard') {
        const tall = look.hat === 'wizard' ? 0.62 : 0.5
        const m = std(hc, { roughness: 0.9 })
        g.add(mesh(new THREE.CylinderGeometry(look.hat === 'witch' ? 0.34 : 0.27, look.hat === 'witch' ? 0.34 : 0.27, 0.014, 28), m, hp.x, top - 0.02, hp.z + 0.01))
        const cone = new THREE.ConeGeometry(0.15, tall, 20, 6)
        // a crooked tip
        const p = cone.attributes.position as THREE.BufferAttribute
        for (let i = 0; i < p.count; i++) {
          const y = p.getY(i) / tall + 0.5
          p.setX(i, p.getX(i) + Math.pow(Math.max(0, y - 0.55), 2) * (look.hat === 'witch' ? 0.35 : 0.12))
        }
        cone.computeVertexNormals()
        g.add(mesh(cone, m, hp.x, top + tall / 2 - 0.03, hp.z + 0.01))
        if (look.hat === 'witch') {
          g.add(mesh(new THREE.CylinderGeometry(0.152, 0.158, 0.05, 20, 1, true), std('#5b2a86'), hp.x, top + 0.02, hp.z + 0.01))
          g.add(mesh(new THREE.BoxGeometry(0.06, 0.05, 0.012), std('#e0a83e', { metalness: 1, roughness: 0.3 }), hp.x, top + 0.02, hp.z + 0.16))
        } else
          for (let k = 0; k < 5; k++)
            g.add(mesh(new THREE.OctahedronGeometry(0.022), std('#ffd27a', { emissive: '#ffb84a', emissiveIntensity: 0.8 }), hp.x + Math.sin(k * 2.4) * 0.11, top + 0.06 + k * 0.08, hp.z + Math.cos(k * 2.4) * 0.11))
      } else if (look.hat === 'guard') {
        const iron = std('#7a7a80', { metalness: 0.85, roughness: 0.35 })
        g.add(mesh(new THREE.SphereGeometry(0.135, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), iron, hp.x, top - 0.08, hp.z + 0.015))
        g.add(mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.012, 24), iron, hp.x, top - 0.075, hp.z + 0.015))
        g.add(mesh(new THREE.ConeGeometry(0.03, 0.12, 8), std('#b8321e'), hp.x, top + 0.1, hp.z))
      } else if (look.hat === 'cap') {
        const m = std(hc, { roughness: 0.95 })
        g.add(mesh(new THREE.CylinderGeometry(0.13, 0.125, 0.07, 20).scale(1, 1, 1.12), m, hp.x, top - 0.04, hp.z + 0.01))
        g.add(mesh(new THREE.BoxGeometry(0.16, 0.012, 0.08), m, hp.x, top - 0.07, hp.z + 0.14))
      } else if (look.hat === 'bonnet') {
        const m = std(hc, { roughness: 0.95, side: THREE.DoubleSide })
        g.add(mesh(new THREE.SphereGeometry(0.15, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), m, hp.x, top - 0.1, hp.z - 0.01))
        g.add(mesh(new THREE.TorusGeometry(0.15, 0.012, 6, 24), std('#e8e0cc'), hp.x, top - 0.08, hp.z + 0.02))
      }
      attach('Head', g)
    }
    if (look.apron) {
      // a cloth apron hanging from the waist (a curved panel riding the pelvis)
      const pel = bones.get('pelvis')!.getWorldPosition(new THREE.Vector3())
      const ap = new THREE.CylinderGeometry(0.2, 0.25, 0.62, 16, 1, true, -0.9, 1.8)
      attach('pelvis', mesh(ap, std(look.apron, { roughness: 0.95, side: THREE.DoubleSide }), pel.x, pel.y - 0.22, pel.z + 0.01))
    }
    if (look.prop) {
      const hand = bones.get('hand_r')!.getWorldPosition(new THREE.Vector3())
      const g = new THREE.Group()
      if (look.prop === 'lantern') {
        const iron = std('#26242a', { metalness: 0.8, roughness: 0.4 })
        g.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6), iron, hand.x, hand.y - 0.1, hand.z))
        g.add(mesh(new THREE.ConeGeometry(0.08, 0.06, 4).rotateY(Math.PI / 4), iron, hand.x, hand.y - 0.2, hand.z))
        const glow = mesh(new THREE.BoxGeometry(0.09, 0.13, 0.09), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc070').multiplyScalar(2.2), toneMapped: false }), hand.x, hand.y - 0.3, hand.z)
        D.push(glow.material as THREE.Material)
        this.glow = glow
        g.add(glow)
        g.add(mesh(new THREE.BoxGeometry(0.11, 0.02, 0.11), iron, hand.x, hand.y - 0.38, hand.z))
      } else if (look.prop === 'staff') {
        g.add(mesh(new THREE.CylinderGeometry(0.018, 0.024, 1.7, 8), std('#4a3020'), hand.x, hand.y - 0.2, hand.z))
        const orb = mesh(new THREE.SphereGeometry(0.05, 14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color('#8ad8ff').multiplyScalar(2), toneMapped: false }), hand.x, hand.y + 0.68, hand.z)
        D.push(orb.material as THREE.Material)
        this.glow = orb
        g.add(orb)
      } else if (look.prop === 'broom') {
        g.add(mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.35, 6), std('#6a4428'), hand.x, hand.y - 0.1, hand.z))
        g.add(mesh(new THREE.ConeGeometry(0.11, 0.34, 10), std('#a07a3a'), hand.x, hand.y - 0.86, hand.z))
      } else {
        g.add(mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.14, 14, 1, true), std('#a07848', { side: THREE.DoubleSide }), hand.x, hand.y - 0.22, hand.z))
        g.add(mesh(new THREE.TorusGeometry(0.12, 0.01, 6, 16, Math.PI), std('#8a6438'), hand.x, hand.y - 0.1, hand.z))
        for (let k = 0; k < 3; k++) g.add(mesh(new THREE.SphereGeometry(0.045, 10, 8), std(['#e8641a', '#d9a42a', '#5a8a3a'][k]), hand.x + (k - 1) * 0.06, hand.y - 0.16, hand.z))
      }
      attach('hand_r', g)
    }
  }

  private play(name: string, fade = 0.3) {
    const next = this.actions.get(name) ?? this.actions.get('idle')!
    if (next === this.current) return
    next.reset().setEffectiveWeight(1).fadeIn(fade).play()
    if (this.current) this.current.fadeOut(fade)
    this.current = next
  }

  update(dt: number) {
    this.t += dt
    const ms = this.speed * 3.4
    const p = this.pose
    const name =
      p === 'sit' ? 'sit'
      : p === 'folded' || p === 'hips' || p === 'guard' || p === 'pushup' ? 'folded'
      : p === 'point' || p === 'wave' || p === 'flex' ? 'talk'
      : p === 'dance' ? 'dance'
      : p === 'hammer' ? 'work'
      : ms > 0.15 ? 'walk'
      : 'idle'
    this.play(name)
    if (this.current) {
      this.current.timeScale = name === 'walk' ? THREE.MathUtils.clamp(ms / WALK_SPEED, 0.5, 2.2) : 1
      if (name === 'walk') {
        const ph = (this.current.time / this.current.getClip().duration) % 1
        if ((this.lastPhase < 0.5 && ph >= 0.5) || ph < this.lastPhase) this.onStep?.()
        this.lastPhase = ph
      }
    }
    this.mixer.update(dt)
    if (this.glow) this.glow.scale.setScalar(1 + Math.sin(this.t * 9) * 0.04)
  }

  /** frees only this villager's own clones (shared source geometry / textures stay cached for the next one) */
  dispose() {
    this.mixer.stopAllAction()
    this.mixer.uncacheRoot(this.mixer.getRoot())
    this.skeleton.dispose() // its bone texture (geometry is shared through the caches)
    this.D.forEach((d) => d.dispose())
  }
}
