import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { BikeRig } from './visual'
import type { BikeView } from './sim'

/**
 * A photogrammetry-scan bike (the Talaria Sting R MX4, CC-BY-4.0 by nicknothom — see ASSETS.md / CREDITS.md) as a RIDEABLE visual.
 * The download is one fused scan: no separate wheels, fork or swingarm. `scripts/asset-mx4-*.mjs` cut it into body / fork+bars+fender / two wheels around fitted axles,
 * straighten and ground it, and optimise each part (about 80k triangles in all). This class assembles the parts into the same moving hierarchy the procedural bikes
 * use, so the riding model and the rider pose see no difference:
 *   root → tilt (ground slope, at the rear contact) → roll → inner → [rear wheel (never pitches), pitchPivot at the rear axle → bodyG → frontPivot (steers about the
 *   fork axis) → [fork + bars, unsprung → front wheel]]
 */
export type ScanRig = {
  rear: { x: number; y: number }
  frontAxle: { x: number; y: number }
  wheelRear: number
  wheelFront: number
  rake: number
  seat: number[]
  gripL: number[]
  gripR: number[]
  pegL: number[]
  pegR: number[]
}
export type ScanParts = { rig: ScanRig; body: THREE.Group; fork: THREE.Group; wheel_f: THREE.Group; wheel_r: THREE.Group }

let loading: Promise<ScanParts> | null = null
/** load (once) the four optimised parts and the rig numbers */
export function loadScanBike(dir = 'chadverse/models/mx4/'): Promise<ScanParts> {
  if (loading) return loading
  const base = `${import.meta.env.BASE_URL}${dir}`
  const loader = new GLTFLoader()
  loading = (async () => {
    const [rig, body, fork, wf, wr] = await Promise.all([
      fetch(`${base}rig.json`).then((r) => {
        if (!r.ok) throw new Error('rig.json ' + r.status)
        return r.json() as Promise<ScanRig>
      }),
      loader.loadAsync(`${base}body.glb`),
      loader.loadAsync(`${base}fork.glb`),
      loader.loadAsync(`${base}wheel_f.glb`),
      loader.loadAsync(`${base}wheel_r.glb`),
    ])
    return { rig, body: body.scene, fork: fork.scene, wheel_f: wf.scene, wheel_r: wr.scene }
  })()
  loading.catch(() => (loading = null))
  return loading
}

export class ScanBikeVisual implements BikeRig {
  root = new THREE.Group()
  seat = new THREE.Object3D()
  gripL = new THREE.Object3D()
  gripR = new THREE.Object3D()
  pegL = new THREE.Object3D()
  pegR = new THREE.Object3D()
  private tilt = new THREE.Group()
  private roll = new THREE.Group()
  private inner = new THREE.Group()
  private pitchPivot = new THREE.Group()
  private bodyG = new THREE.Group()
  private frontPivot = new THREE.Group()
  private unsprung = new THREE.Group()
  private wheelF = new THREE.Group()
  private wheelR = new THREE.Group()
  private stand = new THREE.Mesh()
  private axis: THREE.Vector3
  private rear: THREE.Vector3
  private front: THREE.Vector3
  private geos: THREE.BufferGeometry[] = []
  private mats: THREE.Material[] = []
  readonly kind = 'surron' as const

  constructor(parts: ScanParts) {
    const R = parts.rig
    this.rear = new THREE.Vector3(R.rear.x, R.rear.y, 0)
    this.front = new THREE.Vector3(R.frontAxle.x, R.frontAxle.y, 0)
    this.axis = new THREE.Vector3(-Math.sin(R.rake), Math.cos(R.rake), 0)
    // clone each part's meshes (the loaded scenes are shared by every bike) and re-centre their geometry on the node they ride in
    const take = (src: THREE.Group, origin: THREE.Vector3, into: THREE.Object3D) => {
      src.updateMatrixWorld(true) // the optimised parts are quantised: the real scale and offset live on the node
      src.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh) return
        const g = m.geometry.clone()
        g.applyMatrix4(m.matrixWorld)
        g.translate(-origin.x, -origin.y, -origin.z)
        this.geos.push(g)
        const base = m.material as THREE.MeshStandardMaterial
        const mat = base.clone()
        this.tune(mat)
        this.mats.push(mat)
        const mesh = new THREE.Mesh(g, mat)
        mesh.castShadow = true
        into.add(mesh)
      })
    }
    const zero = new THREE.Vector3()
    this.root.add(this.tilt)
    this.tilt.position.set(this.rear.x, 0, 0)
    this.tilt.add(this.roll)
    this.roll.add(this.inner)
    this.inner.position.set(-this.rear.x, 0, 0)
    this.inner.add(this.wheelR)
    this.wheelR.position.copy(this.rear)
    take(parts.wheel_r, this.rear, this.wheelR)
    this.inner.add(this.pitchPivot)
    this.pitchPivot.position.copy(this.rear)
    this.pitchPivot.add(this.bodyG)
    this.bodyG.position.set(-this.rear.x, -this.rear.y, 0)
    take(parts.body, zero, this.bodyG)
    this.bodyG.add(this.frontPivot)
    this.frontPivot.position.copy(this.front)
    take(parts.fork, this.front, this.frontPivot)
    this.frontPivot.add(this.unsprung)
    this.unsprung.add(this.wheelF)
    take(parts.wheel_f, this.front, this.wheelF)
    // attachment points
    this.seat.position.set(R.seat[0], R.seat[1], 0)
    this.bodyG.add(this.seat)
    this.gripL.position.set(R.gripL[0] - this.front.x, R.gripL[1] - this.front.y, R.gripL[2])
    this.gripR.position.set(R.gripR[0] - this.front.x, R.gripR[1] - this.front.y, R.gripR[2])
    this.frontPivot.add(this.gripL, this.gripR)
    this.pegL.position.set(R.pegL[0], R.pegL[1], R.pegL[2])
    this.pegR.position.set(R.pegR[0], R.pegR[1], R.pegR[2])
    this.bodyG.add(this.pegL, this.pegR)
    // a kickstand for when it is parked
    const sg = new THREE.CylinderGeometry(0.014, 0.014, 0.4, 6)
    this.geos.push(sg)
    const sm = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6, roughness: 0.5 })
    this.mats.push(sm)
    this.stand = new THREE.Mesh(sg, sm)
    this.stand.position.set(-0.08, 0.17, 0.12)
    this.stand.rotation.set(0.5, 0, -0.2)
    this.bodyG.add(this.stand)
    this.stand.visible = false
  }

  /** the scan has no textures: give each material a sensible game response (rubber, anodised metal, satin plastic) */
  private tune(m: THREE.MeshStandardMaterial) {
    if (m.name === 'tyre') {
      m.color.set(0x0c0c0c)
      m.metalness = 0
      m.roughness = 0.95
    } else if (m.name === 'rim') {
      m.color.set(0xb4b8bf)
      m.metalness = 0.7
      m.roughness = 0.4
    } else if (m.name === 'fork') {
      m.color.set(0x4a3f2c)
      m.metalness = 0.65
      m.roughness = 0.35
    } else {
      m.color.set(0x2b2e33)
      m.metalness = 0.35
      m.roughness = 0.55
    }
    m.envMapIntensity = 1
  }

  park() {
    this.stand.visible = true
    this.tilt.rotation.z = 0
    this.roll.rotation.x = -0.17
    this.pitchPivot.rotation.z = 0
    this.pitchPivot.position.y = this.rear.y
    this.frontPivot.quaternion.setFromAxisAngle(this.axis, -0.25)
    this.unsprung.position.set(0, 0, 0)
    this.wheelR.rotation.z = 0
    this.wheelF.rotation.z = 0
  }

  apply(sim: BikeView, groundPitch = 0) {
    this.stand.visible = false
    this.tilt.rotation.z = groundPitch
    this.roll.rotation.x = -sim.roll
    this.pitchPivot.rotation.z = sim.pitch + sim.chassis
    this.pitchPivot.position.y = this.rear.y - sim.shockC * 0.7 - (sim.pitch > 0.05 ? 0 : sim.forkC * 0.25)
    this.frontPivot.quaternion.setFromAxisAngle(this.axis, -sim.delta)
    this.unsprung.position.copy(this.axis).multiplyScalar(sim.forkC)
    this.wheelR.rotation.z = -sim.rearSpin
    this.wheelF.rotation.z = -sim.frontSpin
  }

  dispose() {
    this.geos.forEach((g) => g.dispose())
    this.mats.forEach((m) => m.dispose())
    this.root.removeFromParent()
  }
}
