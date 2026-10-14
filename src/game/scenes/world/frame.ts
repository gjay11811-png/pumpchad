import * as THREE from 'three'
import type { Town } from './buildings'
import { StaticBatch } from './kit'

/**
 * Build part of the world in its own LOCAL frame and place it somewhere else (the valley city and the castle mountain are
 * authored around the origin and set 52 m below the village). The builder gets a Town whose batch, scene, colliders, lights
 * and dynamic list are private; afterwards the group is positioned at `at`, and the colliders, lights and updaters are
 * translated into the main Town (colliders and lights are plain numbers, so they simply shift).
 */
export function inFrame(T: Town, at: { x: number; y: number; z: number }, shadows: boolean, build: (L: Town) => void) {
  const group = new THREE.Group()
  group.position.set(at.x, at.y, at.z)
  const L: Town = { ...T, batch: new StaticBatch(), scene: group as unknown as THREE.Scene, colliders: [], lights: [], dynamic: [] }
  build(L)
  L.batch.build(group, shadows)
  T.scene.add(group)
  for (const c of L.colliders) T.colliders.push(c.kind === 'circle' ? { ...c, x: c.x + at.x, z: c.z + at.z } : { ...c, minX: c.minX + at.x, maxX: c.maxX + at.x, minZ: c.minZ + at.z, maxZ: c.maxZ + at.z })
  for (const l of L.lights) T.lights.push({ ...l, x: l.x + at.x, y: l.y + at.y, z: l.z + at.z })
  T.dynamic.push(...L.dynamic)
  return group
}
