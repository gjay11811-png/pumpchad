import * as THREE from 'three'

/**
 * SCRAPE SPARKS — a tiny pool of orange points thrown from the exact spot where a bike part touches the road. Restrained on purpose: a few points, a third of a second,
 * emitted only while the riding model reports real contact (a peg on a hard lean, the tail of an over-rotated wheelie, the bash plate when the suspension bottoms).
 */
export function makeSparks(scene: THREE.Scene) {
  const N = 36
  const pos = new Float32Array(N * 3)
  const vel = new Float32Array(N * 3)
  const life = new Float32Array(N)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const mat = new THREE.PointsMaterial({ color: 0xffa640, size: 0.07, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })
  const pts = new THREE.Points(geo, mat)
  pts.frustumCulled = false
  pts.visible = false
  scene.add(pts)
  let next = 0
  let alive = 0
  for (let i = 0; i < N; i++) pos[i * 3 + 1] = -999
  return {
    /** throw a few sparks from `p`, kicked back along `n` (the bike's travel direction reversed) */
    emit(p: THREE.Vector3, n: THREE.Vector3, k: number) {
      const count = k > 0.7 ? 3 : 2
      for (let c = 0; c < count; c++) {
        const i = next++ % N
        pos[i * 3] = p.x
        pos[i * 3 + 1] = p.y + 0.02
        pos[i * 3 + 2] = p.z
        vel[i * 3] = n.x * (1.2 + Math.random() * 1.6) + (Math.random() - 0.5) * 0.9
        vel[i * 3 + 1] = 0.6 + Math.random() * 1.1
        vel[i * 3 + 2] = n.z * (1.2 + Math.random() * 1.6) + (Math.random() - 0.5) * 0.9
        life[i] = 0.18 + Math.random() * 0.17
      }
    },
    update(dt: number) {
      alive = 0
      for (let i = 0; i < N; i++) {
        if (life[i] <= 0) continue
        life[i] -= dt
        if (life[i] <= 0) {
          pos[i * 3 + 1] = -999
          continue
        }
        alive++
        vel[i * 3 + 1] -= 9.8 * dt
        pos[i * 3] += vel[i * 3] * dt
        pos[i * 3 + 1] = Math.max(pos[i * 3 + 1] + vel[i * 3 + 1] * dt, pos[i * 3 + 1] > -900 ? 0 : -999)
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt
      }
      pts.visible = alive > 0
      geo.attributes.position.needsUpdate = true
    },
    dispose() {
      scene.remove(pts)
      geo.dispose()
      mat.dispose()
    },
  }
}
