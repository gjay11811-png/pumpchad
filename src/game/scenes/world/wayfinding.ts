import * as THREE from 'three'
import type { Town } from './buildings'
import { boxUV } from './kit'

/**
 * Wayfinding (v4): a carved timber fingerpost by the spawn road. Each arm points at a real destination and
 * reads correctly from both sides (one text plane per side, the arrow tip shows the direction).
 * All the arm labels live in one canvas atlas → one material for the whole post.
 */
export type Finger = { label: string; to: [number, number] }

const ROW_H = 96

function fingerAtlas(labels: string[]) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = ROW_H * labels.length
  const g = c.getContext('2d')!
  labels.forEach((label, i) => {
    const y = i * ROW_H
    const grd = g.createLinearGradient(0, y, 0, y + ROW_H)
    grd.addColorStop(0, '#6b4528')
    grd.addColorStop(1, '#3e2615')
    g.fillStyle = grd
    g.fillRect(0, y, 512, ROW_H)
    // wood grain
    g.globalAlpha = 0.18
    g.strokeStyle = '#1e1008'
    for (let k = 0; k < 7; k++) {
      g.lineWidth = 1 + Math.random() * 2
      g.beginPath()
      const gy = y + 8 + Math.random() * (ROW_H - 16)
      g.moveTo(0, gy)
      g.bezierCurveTo(170, gy + (Math.random() - 0.5) * 10, 340, gy + (Math.random() - 0.5) * 10, 512, gy)
      g.stroke()
    }
    g.globalAlpha = 1
    g.strokeStyle = '#c89b3c'
    g.lineWidth = 5
    g.strokeRect(8, y + 8, 496, ROW_H - 16)
    g.fillStyle = '#f0c35a'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = 'bold 50px Anton, Impact, sans-serif'
    g.fillText(label, 256, y + ROW_H / 2 + 2)
  })
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

/** a text plane whose UVs cover row `i` of `n` in the atlas */
function labelPlane(w: number, h: number, i: number, n: number) {
  const g = new THREE.PlaneGeometry(w, h)
  const uv = g.attributes.uv as THREE.BufferAttribute
  for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - (i + 1 - uv.getY(k)) / n)
  return g
}

export function fingerpost(T: Town, x: number, z: number, fingers: Finger[]) {
  const P = T.P
  const tex = fingerAtlas(fingers.map((f) => f.label))
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.14 })
  T.disposables.push(tex, mat)
  const H = 3.5
  // post: square timber with a stone footing and a little roofed cap
  T.batch.put(new THREE.CylinderGeometry(0.32, 0.4, 0.3, 8), P.stone, x, 0.15, z)
  T.batch.put(boxUV(0.18, H, 0.18, 1), P.timber, x, H / 2, z)
  T.batch.put(new THREE.ConeGeometry(0.22, 0.24, 4).rotateY(Math.PI / 4), P.iron, x, H + 0.12, z)
  T.batch.put(new THREE.SphereGeometry(0.05, 6, 4), P.iron, x, H + 0.27, z)
  const L = 1.25
  const BH = 0.26
  fingers.forEach((f, i) => {
    const dx = f.to[0] - x
    const dz = f.to[1] - z
    const ry = Math.atan2(-dz, dx) // local +X (arrow tip) → toward the destination
    const y = H - 0.35 - i * 0.36
    const c = Math.cos(ry)
    const s = Math.sin(ry)
    // board centre sits off the post so its root end touches it
    const off = L / 2 - 0.02
    const bx = x + c * off
    const bz = z - s * off
    T.batch.put(boxUV(L, BH, 0.05, 1), P.woodLight, bx, y, bz, ry)
    // pointed tip: a flat 3-sided prism at the far end
    const R = BH / 2 / Math.sin(Math.PI / 3)
    const tip = new THREE.CylinderGeometry(R, R, 0.05, 3)
    tip.rotateX(Math.PI / 2).rotateZ(Math.PI / 2) // one vertex → local +X
    const td = L - 0.02 + R * 0.5 - 0.01
    T.batch.put(tip, P.woodLight, x + c * td, y, z - s * td, ry, 1, 1, 1, { cast: false })
    // label on both faces
    const front = labelPlane(L - 0.08, BH - 0.04, i, fingers.length).translate(0, 0, 0.028)
    T.batch.put(front, mat, bx, y, bz, ry, 1, 1, 1, { cast: false })
    const back = labelPlane(L - 0.08, BH - 0.04, i, fingers.length).rotateY(Math.PI).translate(0, 0, -0.028)
    T.batch.put(back, mat, bx, y, bz, ry, 1, 1, 1, { cast: false })
  })
  T.colliders.push({ kind: 'circle', x, z, r: 0.3, h: H })
}
