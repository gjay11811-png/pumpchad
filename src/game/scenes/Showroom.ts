import * as THREE from 'three'
import { createCharacter, disposeCharacter, type Character } from '../character/character'
import type { Pose } from '../character/build'
import type { Appearance } from '../character/types'
import { disposeObject, type Engine, type GameScene } from '../engine/Engine'

export type PreviewPose = 'idle' | 'walk' | 'flex' | 'dance' | 'wave'

/**
 * Character-select stage: curved panelled backdrop, polished floor, tiered display
 * platform, controlled orange rim lighting, light shafts and drifting dust.
 * Camera supports drag-rotate, wheel/pinch zoom and framing around the UI panels.
 */
export class Showroom implements GameScene {
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(28, 1, 0.1, 80)
  bloom = 0.42
  rig: Character | null = null
  private loadToken = 0
  loading = false
  private turntable = new THREE.Group()
  private ring: THREE.Mesh
  private rimL: THREE.SpotLight
  private rimR: THREE.SpotLight
  private dust: THREE.Points
  yaw = -0.35
  private yawVel = 0
  /** 0 = full body, 1 = head-and-shoulders close-up */
  zoom = 0
  private zoomNow = 0
  private pointers = new Map<number, { x: number; y: number }>()
  private pinchStart = 0
  private pinchZoom = 0
  private lastX = 0
  private flexUntil = 0
  previewPose: PreviewPose = 'idle'
  /** turntable auto-spin (QA freezes it for measurements) */
  autoRotate = true
  /** QA: drive the character at a fixed speed (units of walk speed) */
  forceSpeed: number | null = null
  /** QA: pin animation playback rate */
  forceTimeScale: number | null = null
  forcePose: Pose | null = null
  private t = 0
  private w = 1
  private h = 1
  /** pixels covered by UI on each side; the character is centred in what's left */
  private frameInsets = { left: 0, right: 0, bottom: 0, top: 0 }
  private disposables: (THREE.Material | THREE.Texture | THREE.BufferGeometry)[] = []

  constructor(engine: Engine, private canvas: HTMLCanvasElement) {
    const s = this.scene
    s.background = new THREE.Color('#060508')
    s.fog = new THREE.Fog('#060508', 10, 24)
    s.environment = engine.env
    s.environmentIntensity = 0.28

    // curved panelled backdrop with gold seams + faint light strips
    const backTex = panelTexture()
    backTex.repeat.set(6, 1)
    const back = new THREE.Mesh(
      new THREE.CylinderGeometry(9, 9, 9, 64, 1, true, Math.PI * 0.62, Math.PI * 0.76),
      new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.7, metalness: 0.35, side: THREE.BackSide, color: '#8a7c86' }),
    )
    back.position.y = 4.2
    s.add(back)
    const stripMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff8a30').multiplyScalar(1.5), toneMapped: false })
    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue
      const a = Math.PI + i * 0.19
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 5.5, 0.03), stripMat)
      strip.position.set(Math.sin(a) * 8.9, 3.2, Math.cos(a) * 8.9)
      s.add(strip)
    }

    // polished floor with radial inlay
    const floor = new THREE.Mesh(new THREE.CircleGeometry(16, 64), new THREE.MeshStandardMaterial({ map: floorTexture(), color: '#6d6470', roughness: 0.32, metalness: 0.35 }))
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    s.add(floor)

    // tiered octagonal platform: stone base, gold band, dark top with engraved glow ring
    const stone = new THREE.MeshStandardMaterial({ color: '#1a161d', roughness: 0.45, metalness: 0.3 })
    const gold = new THREE.MeshPhysicalMaterial({ color: '#d9a548', metalness: 1, roughness: 0.28, clearcoat: 0.4 })
    const top = new THREE.MeshStandardMaterial({ color: '#141117', roughness: 0.25, metalness: 0.55 })
    const tiers: [number, number, number, number, THREE.Material][] = [
      [1.75, 1.85, 0.16, 0.08, stone],
      [1.5, 1.58, 0.05, 0.185, gold],
      [1.42, 1.48, 0.12, 0.27, top],
    ]
    for (const [rt, rb, hgt, y, m] of tiers) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, hgt, 8), m)
      c.rotation.y = Math.PI / 8
      c.position.y = y
      c.receiveShadow = c.castShadow = true
      s.add(c)
    }
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.012, 6, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff7a1a').multiplyScalar(2.2), toneMapped: false }))
    this.ring.rotation.x = Math.PI / 2
    this.ring.position.y = 0.335
    s.add(this.ring)
    for (const r of [2.6, 3.4]) {
      const inlay = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.02, 96), gold)
      inlay.rotation.x = -Math.PI / 2
      inlay.position.y = 0.005
      s.add(inlay)
    }
    this.turntable.position.y = 0.33
    s.add(this.turntable)

    // lighting: soft warm key, dim cool fill, two orange rims from behind
    s.add(new THREE.HemisphereLight('#2a2232', '#0a0605', 0.45))
    const key = new THREE.SpotLight('#ffe6cc', 55, 16, 0.42, 0.65, 1.2)
    key.position.set(2.6, 5.8, 4.6)
    key.target = this.turntable
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.bias = -0.0003
    s.add(key)
    const fill = new THREE.DirectionalLight('#7f90c8', 0.35)
    fill.position.set(-4, 2.5, 3)
    s.add(fill)
    this.rimL = new THREE.SpotLight('#ff7a1a', 42, 14, 0.34, 0.7, 1.3)
    this.rimL.position.set(-3.2, 4.4, -2.8)
    this.rimL.target = this.turntable
    s.add(this.rimL)
    this.rimR = new THREE.SpotLight('#ffa040', 34, 14, 0.34, 0.7, 1.3)
    this.rimR.position.set(3.3, 3.8, -2.6)
    this.rimR.target = this.turntable
    s.add(this.rimR)

    this.disposables.push(backTex)

    // drifting dust motes
    const N = 90
    const pos = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) pos.set([(Math.random() - 0.5) * 7, Math.random() * 4.5, (Math.random() - 0.5) * 5 - 0.5], i * 3)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.dust = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffb067', size: 0.025, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }))
    s.add(this.dust)

    canvas.addEventListener('pointerdown', this.down)
    window.addEventListener('pointermove', this.move)
    window.addEventListener('pointerup', this.up)
    window.addEventListener('pointercancel', this.up)
    canvas.addEventListener('wheel', this.wheel, { passive: false })
  }

  /* ── input: drag to rotate, pinch / wheel to zoom ── */
  private down = (e: PointerEvent) => {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    this.lastX = e.clientX
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()]
      this.pinchStart = Math.hypot(a.x - b.x, a.y - b.y)
      this.pinchZoom = this.zoom
    }
  }
  private move = (e: PointerEvent) => {
    if (!this.pointers.has(e.pointerId)) return
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      this.zoom = THREE.MathUtils.clamp(this.pinchZoom + (d - this.pinchStart) / 260, 0, 1)
      return
    }
    const dx = e.clientX - this.lastX
    this.lastX = e.clientX
    this.yawVel = dx * 0.011
    this.yaw += dx * 0.011
  }
  private up = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId)
  }
  private wheel = (e: WheelEvent) => {
    e.preventDefault()
    this.zoom = THREE.MathUtils.clamp(this.zoom - e.deltaY * 0.0012, 0, 1)
  }

  rotateBy(d: number) {
    this.yawVel = d * 0.15
  }
  zoomBy(d: number) {
    this.zoom = THREE.MathUtils.clamp(this.zoom + d, 0, 1)
  }

  async setAppearance(a: Appearance, flex = false) {
    const token = ++this.loadToken
    this.loading = true
    const next = await createCharacter(a)
    if (token !== this.loadToken || this.disposed) {
      disposeCharacter(next)
      return
    }
    this.loading = false
    if (this.rig) disposeCharacter(this.rig)
    this.rig = next
    this.turntable.add(next.root)
    ;(this.ring.material as THREE.MeshBasicMaterial).color.set(a.glow).multiplyScalar(2.2)
    if (flex) this.flexUntil = this.t + 1.6
  }

  flex() {
    this.flexUntil = this.t + 1.8
  }

  /** UI reports how much of the screen its panels cover so the character stays centred in view. */
  setInsets(i: Partial<{ left: number; right: number; bottom: number; top: number }>) {
    this.frameInsets = { ...this.frameInsets, ...i }
    this.applyFraming()
  }

  resize(w: number, h: number) {
    this.w = w
    this.h = h
    this.applyFraming()
  }

  private applyFraming() {
    const { left, right, bottom, top } = this.frameInsets
    const freeW = Math.max(1, this.w - left - right)
    const freeH = Math.max(1, this.h - bottom - top)
    // shift the projection so the free area's centre becomes the optical centre
    const offX = (right - left) / 2
    const offY = (bottom - top) / 2
    this.camera.setViewOffset(this.w, this.h, offX, offY, this.w, this.h)
    // pick a distance that fits the character's height into the free area
    const tall = freeH / freeW > 1.15
    this.camera.fov = tall ? 30 : 26
    this.camera.updateProjectionMatrix()
  }

  private placeCamera() {
    const z = this.zoomNow
    const fitH = THREE.MathUtils.lerp(2.75, 1.05, z) // metres of character visible vertically
    const freeH = Math.max(1, this.h - this.frameInsets.bottom - this.frameInsets.top)
    const fracH = freeH / this.h
    const vfov = THREE.MathUtils.degToRad(this.camera.fov)
    const dist = fitH / fracH / 2 / Math.tan(vfov / 2)
    const lookY = THREE.MathUtils.lerp(1.28, 1.95, z)
    this.camera.position.set(0, lookY + THREE.MathUtils.lerp(0.55, 0.1, z), dist)
    this.camera.lookAt(0, lookY, 0)
  }

  update(dt: number) {
    this.t += dt
    if (this.pointers.size === 0) {
      this.yawVel *= Math.exp(-dt * 3)
      this.yaw += this.yawVel + (this.autoRotate ? dt * 0.14 * (Math.abs(this.yawVel) < 0.002 ? 1 : 0) : 0)
    }
    this.turntable.rotation.y = this.yaw
    this.zoomNow += (this.zoom - this.zoomNow) * (1 - Math.exp(-dt * 8))
    this.placeCamera()
    if (this.rig) {
      const p = this.t < this.flexUntil ? 'flex' : this.previewPose
      this.rig.pose = this.forcePose ?? p
      this.rig.speed = this.forceSpeed ?? (p === 'walk' ? 0.42 : 0)
      ;(this.rig as unknown as { forceTimeScale?: number | null }).forceTimeScale = this.forceTimeScale
      this.rig.update(dt)
    }
    const dp = this.dust.geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < dp.count; i++) {
      let y = dp.getY(i) + dt * (0.06 + (i % 5) * 0.015)
      if (y > 4.5) y = 0
      dp.setY(i, y)
      dp.setX(i, dp.getX(i) + Math.sin(this.t * 0.5 + i) * dt * 0.03)
    }
    dp.needsUpdate = true
    this.rimL.intensity = 40 + Math.sin(this.t * 1.1) * 4
    this.rimR.intensity = 32 + Math.sin(this.t * 0.9 + 1) * 3
  }

  private disposed = false

  dispose() {
    this.disposed = true
    if (this.rig) disposeCharacter(this.rig)
    this.canvas.removeEventListener('pointerdown', this.down)
    window.removeEventListener('pointermove', this.move)
    window.removeEventListener('pointerup', this.up)
    window.removeEventListener('pointercancel', this.up)
    this.canvas.removeEventListener('wheel', this.wheel)
    disposeObject(this.scene)
    this.disposables.forEach((d) => d.dispose())
  }
}

/* ── procedural textures for the stage ── */
function panelTexture() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 512
  const g = c.getContext('2d')!
  const grd = g.createLinearGradient(0, 0, 0, 512)
  grd.addColorStop(0, '#0d0b10')
  grd.addColorStop(0.6, '#1a161e')
  grd.addColorStop(1, '#0b090d')
  g.fillStyle = grd
  g.fillRect(0, 0, 256, 512)
  g.fillStyle = 'rgba(255,255,255,0.025)'
  for (let y = 0; y < 512; y += 64) g.fillRect(14, y + 10, 228, 46)
  g.fillStyle = '#b8873a'
  g.fillRect(0, 0, 3, 512)
  g.fillStyle = 'rgba(184,135,58,0.35)'
  g.fillRect(0, 380, 256, 2)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function floorTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const g = c.getContext('2d')!
  g.fillStyle = '#121014'
  g.fillRect(0, 0, 512, 512)
  g.strokeStyle = 'rgba(255,255,255,0.05)'
  for (let r = 40; r < 256; r += 34) {
    g.beginPath()
    g.arc(256, 256, r, 0, Math.PI * 2)
    g.stroke()
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    g.beginPath()
    g.moveTo(256 + Math.cos(a) * 40, 256 + Math.sin(a) * 40)
    g.lineTo(256 + Math.cos(a) * 256, 256 + Math.sin(a) * 256)
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
