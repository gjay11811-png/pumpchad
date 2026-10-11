import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { Quality } from '../save'

export interface GameScene {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  /** bloom strength for this scene (0 = none) */
  bloom?: number
  update(dt: number, t: number): void
  resize?(w: number, h: number): void
  dispose(): void
}

/** Frees GPU memory for everything under an object (geometries, materials, textures). */
export function disposeObject(root: THREE.Object3D) {
  const mats = new Set<THREE.Material>()
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.geometry) m.geometry.dispose()
    if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => mats.add(x))
  })
  mats.forEach((mat) => {
    for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose()
    mat.dispose()
  })
}

const PIXEL_RATIO: Record<Quality, number> = { low: 1, medium: 1.5, high: 2 }

export class Engine {
  renderer: THREE.WebGLRenderer
  private current: GameScene | null = null
  private timer = new THREE.Timer()
  private running = false
  private ro: ResizeObserver
  quality: Quality = 'medium'
  reducedEffects = false
  /** studio reflection map for metals/gold; shared by every scene */
  env: THREE.Texture
  private composer: EffectComposer | null = null
  private bloomPass: UnrealBloomPass | null = null
  /** rolling frame-time stats, read by the debug overlay / tests */
  stats = { fps: 0, frameMs: 0, worstMs: 0 }
  private frames = 0
  private acc = 0
  private worst = 0

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.info.autoReset = false
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    const room = new RoomEnvironment()
    this.env = pmrem.fromScene(room, 0.04).texture
    room.traverse((o) => (o as THREE.Mesh).geometry?.dispose())
    pmrem.dispose()
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(canvas.parentElement ?? canvas)
    canvas.addEventListener('webglcontextlost', this.onLost, false)
    document.addEventListener('visibilitychange', this.onVis)
  }

  private onLost = (e: Event) => e.preventDefault()
  private onVis = () => (document.hidden ? this.stop() : this.start())

  setQuality(q: Quality, reducedEffects = this.reducedEffects) {
    this.quality = q
    this.reducedEffects = reducedEffects
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PIXEL_RATIO[q]))
    this.renderer.shadowMap.enabled = q !== 'low'
    this.renderer.shadowMap.needsUpdate = true
    this.buildComposer()
    this.resize()
  }

  /** Bloom only on medium/high and when the player hasn't asked for reduced effects. */
  private buildComposer() {
    this.composer?.dispose()
    this.composer = null
    this.bloomPass = null
    const s = this.current
    if (!s || !s.bloom || this.quality === 'low' || this.reducedEffects) return
    const c = new EffectComposer(this.renderer)
    c.addPass(new RenderPass(s.scene, s.camera))
    const size = this.renderer.getSize(new THREE.Vector2())
    const scale = this.quality === 'high' ? 0.5 : 0.35 // bloom at reduced resolution — cheap on phones
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(size.x * scale, size.y * scale), s.bloom, 0.55, 1.6)
    c.addPass(this.bloomPass)
    c.addPass(new OutputPass())
    this.composer = c
  }

  setScene(s: GameScene | null) {
    const prev = this.current
    this.current = s
    prev?.dispose()
    this.renderer.renderLists.dispose()
    this.buildComposer()
    this.resize()
  }

  get scene() {
    return this.current
  }

  resize() {
    const p = this.canvas.parentElement
    const w = p?.clientWidth || window.innerWidth
    const h = p?.clientHeight || window.innerHeight
    this.renderer.setSize(w, h, false)
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio())
      this.composer.setSize(w, h)
      const scale = this.quality === 'high' ? 0.5 : 0.35
      this.bloomPass?.resolution.set(w * scale, h * scale)
    }
    if (this.current) {
      this.current.camera.aspect = w / h
      this.current.camera.updateProjectionMatrix()
      this.current.resize?.(w, h)
    }
  }

  start() {
    if (this.running || document.hidden) return
    this.running = true
    this.timer.reset()
    this.renderer.setAnimationLoop(this.tick)
  }

  stop() {
    this.running = false
    this.renderer.setAnimationLoop(null)
  }

  private tick = (ts?: number) => {
    this.timer.update(ts)
    const raw = this.timer.getDelta()
    const dt = Math.min(raw, 1 / 20) // clamp so a hitch never teleports the player through walls
    const t = this.timer.getElapsed()
    if (this.current) {
      this.renderer.info.reset() // accumulate stats across all passes of this frame
      this.current.update(dt, t)
      if (this.composer) this.composer.render(dt)
      else this.renderer.render(this.current.scene, this.current.camera)
    }
    this.frames++
    this.acc += raw
    this.worst = Math.max(this.worst, raw)
    if (this.acc >= 1) {
      this.stats = { fps: Math.round(this.frames / this.acc), frameMs: +((this.acc / this.frames) * 1000).toFixed(1), worstMs: +(this.worst * 1000).toFixed(1) }
      this.frames = 0
      this.acc = 0
      this.worst = 0
    }
  }

  dispose() {
    this.stop()
    this.current?.dispose()
    this.current = null
    this.composer?.dispose()
    this.env.dispose()
    this.ro.disconnect()
    this.canvas.removeEventListener('webglcontextlost', this.onLost)
    document.removeEventListener('visibilitychange', this.onVis)
    this.renderer.dispose()
  }
}
