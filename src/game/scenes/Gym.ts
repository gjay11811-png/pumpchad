import * as THREE from 'three'
import { createCharacter, disposeCharacter, type Character } from '../character/character'
import type { Appearance } from '../character/types'
import { disposeObject, type Engine, type GameScene } from '../engine/Engine'
import { signTexture } from './textures'

/** Chad Gym interior: the stage for the Chad Press mini-game. */
export class Gym implements GameScene {
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80)
  bloom = 0.55
  player: Character | null = null
  private coach: Character | null = null
  private bar = new THREE.Group()
  private target = 0
  private shake = 0
  private flash = 0
  private strip: THREE.MeshBasicMaterial
  private t = 0
  private disposed = false
  private portrait = false

  constructor(engine: Engine) {
    const s = this.scene
    s.background = new THREE.Color('#09070b')
    s.fog = new THREE.Fog('#09070b', 12, 26)
    s.environment = engine.env
    s.environmentIntensity = 0.25

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), new THREE.MeshStandardMaterial({ color: '#141116', roughness: 0.92 }))
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    s.add(floor)
    const platform = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 3.6), new THREE.MeshStandardMaterial({ color: '#3b2a1c', roughness: 0.55 }))
    platform.position.y = 0.06
    platform.receiveShadow = true
    s.add(platform)
    const wallMat = new THREE.MeshStandardMaterial({ color: '#16121a', roughness: 0.75, metalness: 0.2 })
    const back = new THREE.Mesh(new THREE.PlaneGeometry(18, 8), wallMat)
    back.position.set(0, 4, -6)
    back.receiveShadow = true
    s.add(back)
    for (const x of [-9, 9]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), wallMat)
      side.position.set(x, 4, 1)
      side.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2
      s.add(side)
    }
    // neon strips + sign
    this.strip = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff7a1a').multiplyScalar(3.6), toneMapped: false })
    for (const y of [0.4, 5.6]) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(18, 0.05, 0.05), this.strip)
      st.position.set(0, y, -5.95)
      s.add(st)
    }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.6), new THREE.MeshBasicMaterial({ map: signTexture('CHAD GYM', { sub: 'NO PAIN · NO PUMP' }), toneMapped: false, color: new THREE.Color(2.7, 2.7, 2.7) }))
    sign.position.set(0, 4.9, -5.93)
    s.add(sign)

    // racks + plates (props)
    const iron = new THREE.MeshStandardMaterial({ color: '#2a262c', metalness: 0.9, roughness: 0.35 })
    const rubber = new THREE.MeshStandardMaterial({ color: '#1a1a1c', roughness: 0.8 })
    for (const x of [-6, 6]) {
      for (const dx of [-0.8, 0.8]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 0.12), iron)
        post.position.set(x + dx, 1.2, -4.6)
        post.castShadow = true
        s.add(post)
      }
      for (let i = 0; i < 4; i++) {
        const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.42 - i * 0.05, 0.42 - i * 0.05, 0.08, 24), rubber)
        plate.rotation.x = Math.PI / 2
        plate.position.set(x, 0.42 - i * 0.05, -4 + i * 0.1)
        plate.castShadow = true
        s.add(plate)
      }
    }

    // barbell (positioned between the fists every frame)
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.1, 10), new THREE.MeshStandardMaterial({ color: '#d8d4cc', metalness: 1, roughness: 0.25 }))
    shaft.rotation.z = Math.PI / 2
    shaft.castShadow = true
    this.bar.add(shaft)
    for (const sx of [-0.85, -0.75, 0.75, 0.85]) {
      const big = Math.abs(sx) > 0.8
      const pl = new THREE.Mesh(new THREE.CylinderGeometry(big ? 0.3 : 0.24, big ? 0.3 : 0.24, 0.07, 24), new THREE.MeshStandardMaterial({ color: big ? '#ff7a1a' : '#1a1a1c', roughness: 0.5 }))
      pl.rotation.z = Math.PI / 2
      pl.position.x = sx
      pl.castShadow = true
      this.bar.add(pl)
    }
    s.add(this.bar)

    // lighting: overhead key + orange rim
    s.add(new THREE.HemisphereLight('#4a3a52', '#120a06', 0.5))
    const key = new THREE.SpotLight('#fff0dc', 42, 16, 0.55, 0.5, 1.3)
    key.position.set(1.5, 7, 3)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.target.position.set(0, 1, 0)
    s.add(key, key.target)
    const rim = new THREE.PointLight('#ff7a1a', 18, 10, 1.6)
    rim.position.set(-2.5, 2.5, -3)
    s.add(rim)
  }

  async populate(a: Appearance) {
    const [p, coach] = await Promise.all([
      createCharacter(a),
      createCharacter({ species: 'skeleton', skin: '#e9e2d0', outfit: '#141216', glow: '#19f19a', top: 'shirtless', headwear: 'cap', eyewear: 'none', chain: true }),
    ])
    if (this.disposed) return [p, coach].forEach(disposeCharacter)
    this.player = p
    p.root.position.set(0, 0.12, 0)
    p.pose = 'press'
    this.scene.add(p.root)
    this.coach = coach
    coach.root.position.set(3.1, 0, -1.2)
    coach.root.rotation.y = -0.75
    this.scene.add(coach.root)
  }

  /** 0..1 target bar height; animated toward smoothly. */
  setPress(v: number) {
    this.target = v
  }
  missShake() {
    this.shake = 0.5
  }
  perfectFlash() {
    this.flash = 1
  }
  celebrate() {
    if (this.player) this.player.pose = 'flex'
    if (this.coach) this.coach.pose = 'wave'
  }
  reset() {
    if (this.player) this.player.pose = 'press'
    if (this.coach) this.coach.pose = 'idle'
    this.target = 0
  }

  resize(w: number, h: number) {
    this.portrait = h > w
    if (this.portrait) {
      this.camera.fov = 50
      this.camera.position.set(1.4, 1.9, 6.4)
      // character in the top half; mini-game UI sits below
      this.camera.setViewOffset(w, h, 0, h * 0.18, w, h)
    } else {
      this.camera.clearViewOffset()
      this.camera.fov = 40
      this.camera.position.set(2.2, 1.7, 6)
    }
    this.camera.lookAt(0, 1.45, 0)
    this.camera.updateProjectionMatrix()
  }

  update(dt: number) {
    this.t += dt
    const p = this.player
    if (p) {
      p.pressAmount += (this.target - p.pressAmount) * (1 - Math.exp(-dt * 12))
      p.speed = 0
      p.update(dt)
      p.root.updateMatrixWorld(true)
      const a = p.fistL.getWorldPosition(new THREE.Vector3())
      const b = p.fistR.getWorldPosition(new THREE.Vector3())
      this.bar.position.copy(a).add(b).multiplyScalar(0.5)
      this.bar.visible = p.pose === 'press'
      if (this.shake > 0) {
        this.shake = Math.max(0, this.shake - dt)
        this.bar.rotation.z = Math.sin(this.t * 40) * this.shake * 0.3
      } else this.bar.rotation.z = 0
    }
    this.coach?.update(dt)
    this.flash = Math.max(0, this.flash - dt * 2.5)
    this.strip.color.set('#ff7a1a').multiplyScalar(3.4 + this.flash * 4)
  }

  dispose() {
    this.disposed = true
    if (this.player) disposeCharacter(this.player)
    if (this.coach) disposeCharacter(this.coach)
    disposeObject(this.scene)
  }
}
