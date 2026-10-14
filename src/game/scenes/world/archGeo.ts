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
