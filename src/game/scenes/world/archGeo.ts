import * as THREE from 'three'

/**
 * A semicircular arch ring for a bridge or viaduct: opening radius `r`, ring thickness `t`, `width` across the deck. The
 * ring lies in the road's vertical plane (the road runs along local z, the width along local x), springing from y = 0.
 */
export function archGeo(r: number, t: number, width: number) {
  const s = new THREE.Shape()
  s.absarc(0, 0, r + t, 0, Math.PI, false)
  s.lineTo(-r, 0)
  s.absarc(0, 0, r, Math.PI, 0, true)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: false, curveSegments: 18 })
  g.translate(0, 0, -width / 2)
  g.rotateY(Math.PI / 2) // the ring's x axis becomes the road's z; the extrusion becomes the width
  return g
}

/**
 * A segmental arch ring: horizontal half-span `a`, rise `b` (so it can spring from the same level and still span a fixed gap
 * whatever the deck height above it), ring thickness `t`, `width` across the deck. Springs at y = 0; opening along local z.
 */
export function archEllipse(a: number, b: number, t: number, width: number) {
  const s = new THREE.Shape()
  s.absellipse(0, 0, a + t, b + t, 0, Math.PI, false, 0)
  s.lineTo(-a, 0)
  s.absellipse(0, 0, a, b, Math.PI, 0, true, 0)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: false, curveSegments: 20 })
  g.translate(0, 0, -width / 2)
  g.rotateY(Math.PI / 2)
  return g
}
