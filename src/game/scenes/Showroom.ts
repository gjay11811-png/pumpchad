import * as THREE from 'three'
import { createCharacter, disposeCharacter, type Character } from '../character/character'
import type { Appearance } from '../character/types'
import { disposeObject, type Engine, type GameScene } from '../engine/Engine'

/** Character-creator stage: pedestal, three-point lighting, drag/auto rotation. */
export class Showroom implements GameScene {
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60)
  bloom = 0.55
  private rig: Character | null = null
  private loadToken = 0
  /** true while a model is downloading (UI shows a spinner) */
  loading = false
  private turntable = new THREE.Group()
  private ring: THREE.Mesh
  private rimL: THREE.SpotLight
  private embers: THREE.Points
  yaw = -0.35
  private yawVel = 0
  private dragging = false
  private lastX = 0
  private flexUntil = 0
  private t = 0
  /** framing: on narrow portrait screens the character sits in the top half (panel covers bottom) */
  private portrait = false

  constructor(engine: Engine, private canvas: HTMLCanvasElement) {
    const s = this.scene
    s.background = new THREE.Color('#07060a')
    s.fog = new THREE.Fog('#07060a', 9, 22)
    s.environment = engine.env
    s.environmentIntensity = 0.35

    // floor + pedestal
    const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 48), new THREE.MeshStandardMaterial({ color: '#0d0b10', roughness: 0.35, metalness: 0.4 }))
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    s.add(floor)
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, 0.18, 48), new THREE.MeshStandardMaterial({ color: '#16131a', roughness: 0.3, metalness: 0.7 }))
    ped.position.y = 0.09
    ped.receiveShadow = true
    ped.castShadow = true
    s.add(ped)
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.018, 8, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff7a1a').multiplyScalar(3.6), toneMapped: false }))
    this.ring.rotation.x = Math.PI / 2
    this.ring.position.y = 0.185
    s.add(this.ring)
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.008, 6, 96), new THREE.MeshBasicMaterial({ color: '#c89b3c', toneMapped: false, transparent: true, opacity: 0.5 }))
    ring2.rotation.x = Math.PI / 2
    ring2.position.y = 0.01
    s.add(ring2)

    this.turntable.position.y = 0.18
    s.add(this.turntable)

    // lighting: warm key, cool fill, orange rims
    s.add(new THREE.HemisphereLight('#3a2a40', '#0a0806', 0.6))
    const key = new THREE.DirectionalLight('#ffe2c0', 2.4)
    key.position.set(2.5, 5, 4)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.camera.near = 1
    key.shadow.camera.far = 14
    key.shadow.camera.left = -2
    key.shadow.camera.right = 2
    key.shadow.camera.top = 3
    key.shadow.camera.bottom = -1
    key.shadow.bias = -0.0004
    s.add(key)
    const fill = new THREE.DirectionalLight('#8aa0ff', 0.45)
    fill.position.set(-4, 2, 2)
    s.add(fill)
    this.rimL = new THREE.SpotLight('#ff7a1a', 30, 12, 0.5, 0.6)
    this.rimL.position.set(-2.5, 3.5, -3)
    this.rimL.target = this.turntable
    s.add(this.rimL)
    const rimR = new THREE.SpotLight('#ffb347', 22, 12, 0.5, 0.6)
    rimR.position.set(2.8, 2.5, -2.8)
    rimR.target = this.turntable
    s.add(rimR)

    // drifting embers (cheap: one Points draw call)
    const N = 140
    const pos = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      const r = 2 + Math.random() * 5
      const a = Math.random() * Math.PI * 2
      pos.set([Math.cos(a) * r, Math.random() * 5, Math.sin(a) * r - 2], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.embers = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ff9a3c', size: 0.045, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }))
    s.add(this.embers)

    canvas.addEventListener('pointerdown', this.down)
    window.addEventListener('pointermove', this.move)
    window.addEventListener('pointerup', this.up)
    window.addEventListener('pointercancel', this.up)
  }

  private down = (e: PointerEvent) => {
    this.dragging = true
    this.lastX = e.clientX
  }
  private move = (e: PointerEvent) => {
    if (!this.dragging) return
    const dx = e.clientX - this.lastX
    this.lastX = e.clientX
    this.yawVel = dx * 0.012
    this.yaw += dx * 0.012
  }
  private up = () => (this.dragging = false)

  rotateBy(d: number) {
    this.yawVel = d * 0.15
  }

  async setAppearance(a: Appearance, flex = false) {
    const token = ++this.loadToken
    this.loading = true
    const next = await createCharacter(a)
    if (token !== this.loadToken || this.disposed) {
      disposeCharacter(next) // a newer selection won the race
      return
    }
    this.loading = false
    if (this.rig) disposeCharacter(this.rig)
    this.rig = next
    this.turntable.add(next.root)
    this.ring.material = this.ring.material as THREE.MeshBasicMaterial
    ;(this.ring.material as THREE.MeshBasicMaterial).color.set(a.glow).multiplyScalar(3.6)
    if (flex) this.flexUntil = this.t + 1.6
  }

  flex() {
    this.flexUntil = this.t + 1.8
  }

  resize(w: number, h: number) {
    this.portrait = h > w * 1.05
    this.frame(w, h)
  }

  private frame(w: number, h: number) {
    const aspect = w / h
    if (this.portrait) {
      // whole character inside the top ~45% of the screen; the options sheet covers the rest
      this.camera.fov = 30
      this.camera.position.set(0, 2.2, 12)
      this.camera.lookAt(0, 1.15, 0)
      this.camera.setViewOffset(w, h, 0, h * 0.26, w, h)
    } else {
      this.camera.clearViewOffset()
      this.camera.fov = 26
      this.camera.position.set(0, 1.85, 7.6)
      this.camera.lookAt(0, 1.1, 0)
      // wide screens: a 420px panel sits on the right, so centre the character in the space to its left
      if (aspect > 1.2 && w > 900) this.camera.setViewOffset(w, h, 230, 0, w, h)
    }
    this.camera.updateProjectionMatrix()
  }

  update(dt: number) {
    this.t += dt
    if (!this.dragging) {
      this.yawVel *= Math.exp(-dt * 3)
      this.yaw += this.yawVel + dt * 0.18 * (Math.abs(this.yawVel) < 0.002 ? 1 : 0)
    }
    this.turntable.rotation.y = this.yaw
    if (this.rig) {
      this.rig.pose = this.t < this.flexUntil ? 'flex' : 'idle'
      this.rig.update(dt)
    }
    const p = this.embers.geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + dt * (0.15 + (i % 7) * 0.03)
      if (y > 5) y = 0
      p.setY(i, y)
    }
    p.needsUpdate = true
    this.rimL.intensity = 28 + Math.sin(this.t * 1.3) * 4
  }

  private disposed = false

  dispose() {
    this.disposed = true
    if (this.rig) disposeCharacter(this.rig)
    this.canvas.removeEventListener('pointerdown', this.down)
    window.removeEventListener('pointermove', this.move)
    window.removeEventListener('pointerup', this.up)
    window.removeEventListener('pointercancel', this.up)
    disposeObject(this.scene)
  }
}
