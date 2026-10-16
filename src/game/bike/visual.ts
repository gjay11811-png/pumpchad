import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Frame } from '../scenes/world/signs'
import { BIKE_LAYOUT, eBike, motoMats, streetBike, type MotoMats } from '../scenes/world/motorbikes'
import type { BikeSim } from './sim'

/**
 * THE BIKE'S LOOK, SEPARATE FROM ITS HANDLING. A `BikeVisual` is a small scene graph with named parts and attachment points; the riding model (`sim.ts`)
 * only ever feeds it numbers (`apply`). To use a better downloaded bike later, build another `BikeVisual` from the GLB with the same nodes and the same
 * contract (see `BikeRig` below) — nothing in the riding, rider or camera code needs to change.
 *
 * The two bikes here are the EXISTING Chad Rides models (`scenes/world/motorbikes.ts`: the Sur-Ron-style e-bike and the naked street bike). Those are
 * written as static geometry, so they are drawn once into a collector that sorts every piece into the part it belongs to (body, front end that steers,
 * the unsprung front wheel + fender that the fork moves, the two spinning wheels), then merged per part and material.
 *
 * Frame: the bike faces +x, wheels along z, ground at y = 0; the root sits at the middle of the wheelbase.
 */
export type BikeKind = 'surron' | 'street'

/** what the rest of the game relies on from any bike visual */
export interface BikeRig {
  root: THREE.Group
  /** where the rider sits / holds / stands, as live Object3Ds (read their world positions after `apply`) */
  seat: THREE.Object3D
  gripL: THREE.Object3D
  gripR: THREE.Object3D
  pegL: THREE.Object3D
  pegR: THREE.Object3D
  /** pose it from the riding model (and a parked lean) */
  apply(sim: BikeSim, groundPitch?: number): void
  /** stand it up parked on its kickstand, leaning, with no rider */
  park(): void
  dispose(): void
}

/** captures what the static bike builders would have put in the town's batch */
class Collector {
  items: { geo: THREE.BufferGeometry; mat: THREE.Material; c: THREE.Vector3; ctr: THREE.Vector3 }[] = []
  add(geo: THREE.BufferGeometry, mat: THREE.Material, matrix: THREE.Matrix4) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone()
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k)
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2))
    if (!g.attributes.normal) g.computeVertexNormals()
    g.applyMatrix4(matrix)
    g.computeBoundingBox()
    const c = g.boundingBox!.getCenter(new THREE.Vector3())
    this.items.push({ geo: g, mat, c, ctr: c })
    if (g !== geo) geo.dispose()
    g = null as unknown as THREE.BufferGeometry
  }
}

type PartName = 'body' | 'front' | 'unsprung' | 'wheelF' | 'wheelR'

export class ModelBikeVisual implements BikeRig {
  root = new THREE.Group()
  seat = new THREE.Object3D()
  gripL = new THREE.Object3D()
  gripR = new THREE.Object3D()
  pegL = new THREE.Object3D()
  pegR = new THREE.Object3D()
  private tilt = new THREE.Group() // the slope of the ground under the bike, about the rear contact patch
  private roll = new THREE.Group()
  private inner = new THREE.Group() // puts the model's own origin back where it was drawn
  private pitchPivot = new THREE.Group() // the wheelie: the body pivots about the REAR AXLE (the wheel itself stays on the ground)
  private bodyG = new THREE.Group()
  private frontPivot = new THREE.Group() // at the front axle; rotates about the steering axis
  private unsprung = new THREE.Group() // fender + wheel: moves along the fork when it compresses
  private wheelF = new THREE.Group()
  private wheelR = new THREE.Group()
  private stand = new THREE.Mesh()
  private axis: THREE.Vector3
  private rear: THREE.Vector3
  private front: THREE.Vector3
  private geos: THREE.BufferGeometry[] = []
  readonly kind: BikeKind

  constructor(kind: BikeKind, paint: THREE.Material, D: (THREE.Material | THREE.Texture | THREE.BufferGeometry)[]) {
    this.kind = kind
    const L = BIKE_LAYOUT[kind]
    this.rear = new THREE.Vector3(L.rear[0], L.rear[1], 0)
    this.front = new THREE.Vector3(L.front[0], L.front[1], 0)
    // the steering axis: from the front axle up to the top of the fork
    this.axis = new THREE.Vector3(L.steerTop[0] - L.front[0], L.steerTop[1] - L.front[1], 0).normalize()
    // 1. draw the existing model into the collector
    const M: MotoMats = motoMats(D)
    const col = new Collector()
    const F = new Frame(col as never, new THREE.Matrix4())
    ;(kind === 'surron' ? eBike : streetBike)(F, paint, M, { ride: true })
    // 2. sort every piece into its part
    const parts: Record<PartName, typeof col.items> = { body: [], front: [], unsprung: [], wheelF: [], wheelR: [] }
    const near = (c: THREE.Vector3, p: THREE.Vector3, r: number) => Math.hypot(c.x - p.x, c.y - p.y) < r
    for (const it of col.items) {
      const isPaint = it.mat === paint
      if (!isPaint && near(it.c, this.rear, L.R + 0.07)) parts.wheelR.push(it)
      else if (!isPaint && near(it.c, this.front, L.R + 0.07)) parts.wheelF.push(it)
      else if (isPaint && it.c.x > this.front.x - 0.4 && it.c.y < L.front[1] + L.R + 0.2 && it.c.y > 0.3) parts.unsprung.push(it) // the front fender
      else if (it.c.x >= L.frontEndX && it.c.y > 0.25) parts.front.push(it)
      else parts.body.push(it)
    }
    // 3. build the hierarchy:  root → roll → pitchPivot (at the rear contact) → bodyG → [rear wheel, front pivot → [front fork parts, unsprung → [fender, wheel]]]
    const mesh = (items: typeof col.items, origin: THREE.Vector3, into: THREE.Object3D) => {
      const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>()
      for (const it of items) {
        const g = it.geo.clone().translate(-origin.x, -origin.y, -origin.z)
        const arr = byMat.get(it.mat) ?? []
        arr.push(g)
        byMat.set(it.mat, arr)
      }
      for (const [mat, gs] of byMat) {
        const merged = mergeGeometries(gs, false)
        gs.forEach((g) => g.dispose())
        if (!merged) continue
        this.geos.push(merged)
        const m = new THREE.Mesh(merged, mat)
        m.castShadow = true
        into.add(m)
      }
    }
    const zero = new THREE.Vector3()
    this.root.add(this.tilt)
    this.tilt.position.set(this.rear.x, 0, 0)
    this.tilt.add(this.roll)
    this.roll.add(this.inner)
    this.inner.position.set(-this.rear.x, 0, 0)
    this.inner.add(this.wheelR) // the rear wheel never pitches: it stays on the ground under the axle
    this.wheelR.position.copy(this.rear)
    mesh(parts.wheelR, this.rear, this.wheelR)
    this.inner.add(this.pitchPivot)
    this.pitchPivot.position.copy(this.rear)
    this.pitchPivot.add(this.bodyG)
    this.bodyG.position.set(-this.rear.x, -this.rear.y, 0)
    mesh(parts.body, zero, this.bodyG)
    this.bodyG.add(this.frontPivot)
    this.frontPivot.position.copy(this.front)
    mesh(parts.front, this.front, this.frontPivot)
    this.frontPivot.add(this.unsprung)
    mesh(parts.unsprung, this.front, this.unsprung)
    this.unsprung.add(this.wheelF)
    mesh(parts.wheelF, this.front, this.wheelF)
    // 4. attachment points (in the node each rides with)
    this.seat.position.set(L.seat[0], L.seat[1], 0)
    this.bodyG.add(this.seat)
    for (const [o, s] of [[this.gripL, 1], [this.gripR, -1]] as const) {
      o.position.set(L.grips[0] - this.front.x, L.grips[1] - this.front.y, s * L.grips[2])
      this.frontPivot.add(o)
    }
    for (const [o, s] of [[this.pegL, 1], [this.pegR, -1]] as const) {
      o.position.set(L.pegs[0], L.pegs[1], s * L.pegs[2])
      this.bodyG.add(o)
    }
    // 5. a kickstand for when it is parked
    const sg = new THREE.CylinderGeometry(0.014, 0.014, 0.4, 6)
    this.geos.push(sg)
    this.stand = new THREE.Mesh(sg, M.steel)
    this.stand.position.set(-0.08, 0.17, 0.12)
    this.stand.rotation.set(0.5, 0, -0.2)
    this.bodyG.add(this.stand)
    this.stand.visible = false
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

  apply(sim: BikeSim, groundPitch = 0) {
    this.stand.visible = false
    this.tilt.rotation.z = groundPitch
    this.roll.rotation.x = -sim.roll // + roll = leaning right; the bike's +z is its left, so right-lean is a negative rotation about +x
    this.pitchPivot.rotation.z = sim.pitch
    // the body settles on the rear shock (the wheel stays put); the unsprung front sinks into the fork travel
    this.pitchPivot.position.y = this.rear.y - sim.shockC * 0.7 - (sim.pitch > 0.05 ? 0 : sim.forkC * 0.25)
    this.frontPivot.quaternion.setFromAxisAngle(this.axis, -sim.delta) // + delta = steering right = clockwise seen from above = negative about the up axis
    this.unsprung.position.copy(this.axis).multiplyScalar(sim.forkC)
    this.wheelR.rotation.z = -sim.rearSpin
    this.wheelF.rotation.z = -sim.frontSpin
  }

  dispose() {
    this.geos.forEach((g) => g.dispose())
    this.root.removeFromParent()
  }
}
