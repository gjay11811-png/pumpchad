import * as THREE from 'three'
import type { Frame } from './signs'
import { isNight } from './daylight'

/**
 * CHAD MOTORS' fictional cars (original designs, no real makes): a low wedge supercar body extruded from a side
 * profile, a tinted glass canopy, wheels with gold or chrome rims, light bars front and rear, a rear wing and an
 * underglow. Built through a Frame (static, batched) at the car's centre on the ground, nose toward local +z.
 */
export type CarModel = { id: string; name: string; tagline: string; paint: string; rim: 'gold' | 'chrome'; glow: string; wing?: boolean }
export const CARS: CarModel[] = [
  { id: 'phantom', name: 'Pumpkin Phantom GT', tagline: 'gold paint · gold rims · zero chill', paint: '#e0a83e', rim: 'chrome', glow: '#ffb24a', wing: true },
  { id: 'nightshade', name: 'Nightshade V8', tagline: 'midnight purple · a howl at the moon', paint: '#7a3ad8', rim: 'gold', glow: '#c08aff' },
  { id: 'raptor', name: 'Gourd Raptor', tagline: 'pumpkin orange · built for leg day', paint: '#e8641a', rim: 'gold', glow: '#ff8a3a', wing: true },
]

type D = (THREE.Material | THREE.Texture | THREE.BufferGeometry)[]
const matCache = new Map<string, Record<string, THREE.Material>>()
export function carMats(m: CarModel, D: D) {
  const key = m.id
  let s = matCache.get(key)
  if (!s || (s.paint as THREE.Material & { disposed?: boolean }).disposed) {
    const night = isNight()
    const std = (p: THREE.MeshStandardMaterialParameters) => {
      const mm = new THREE.MeshStandardMaterial(p)
      D.push(mm)
      return mm
    }
    const glow = (c: string, k: number) => {
      const mm = new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), toneMapped: false })
      D.push(mm)
      return mm
    }
    s = {
      paint: (() => {
        const mm = new THREE.MeshPhysicalMaterial({ color: m.paint, metalness: 0.5, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.5 })
        D.push(mm)
        return mm
      })(),
      glass: std({ color: '#0c1018', metalness: 0.9, roughness: 0.08 }),
      tyre: std({ color: '#141416', roughness: 0.85 }),
      rim: std({ color: m.rim === 'gold' ? '#e0a83e' : '#d8d6d0', metalness: 1, roughness: 0.22 }),
      trim: std({ color: '#1a1a1e', metalness: 0.6, roughness: 0.4 }),
      head: glow('#fff2d8', night ? 2.4 : 1.4),
      tail: glow('#ff2a3a', night ? 2.2 : 1.2),
      under: glow(m.glow, night ? 1.8 : 0.6),
    }
    matCache.set(key, s)
    // freed with the scene: forget them so the next scene builds fresh ones
    for (const mm of Object.values(s)) mm.addEventListener('dispose', () => matCache.delete(key))
  }
  return s
}

export function sportsCar(F: Frame, m: CarModel, D: D) {
  const M = carMats(m, D)
  const L = 4.5
  const Wd = 2.0
  // side profile (z along the car, y up): low curved tail, flat deck, long hood sweeping down to a sharp nose
  const side = new THREE.Shape()
  side.moveTo(-2.15, 0.24)
  side.quadraticCurveTo(-2.3, 0.3, -2.26, 0.6)
  side.quadraticCurveTo(-2.15, 0.72, -1.6, 0.74)
  side.lineTo(0.7, 0.76)
  side.quadraticCurveTo(1.6, 0.72, 2.0, 0.54)
  side.quadraticCurveTo(2.3, 0.42, 2.26, 0.34)
  side.quadraticCurveTo(2.2, 0.22, 1.9, 0.22)
  side.lineTo(-1.9, 0.22)
  side.closePath()
  const body = new THREE.ExtrudeGeometry(side, { depth: Wd, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.09, bevelSegments: 4, curveSegments: 10 })
  body.translate(0, 0, -Wd / 2)
  body.rotateY(-Math.PI / 2) // profile z → car length along local z
  // shape it: tumblehome (sides lean in above the shoulder line) + taper toward nose and tail
  const bp = body.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < bp.count; i++) {
    const t = Math.abs(bp.getZ(i)) / (L / 2)
    const y = bp.getY(i)
    bp.setX(i, bp.getX(i) * (1 - 0.14 * t * t) * (1 - 0.16 * Math.max(0, (y - 0.5) / 0.3)))
  }
  body.computeVertexNormals()
  F.put(body, M.paint, 0, 0, 0)
  // the canopy: a teardrop of tinted glass, narrower toward the roof
  const cab = new THREE.Shape()
  cab.moveTo(-1.35, 0.74)
  cab.quadraticCurveTo(-0.7, 1.12, -0.1, 1.16)
  cab.quadraticCurveTo(0.45, 1.16, 1.15, 0.76)
  cab.closePath()
  const cw = Wd - 0.3
  const canopy = new THREE.ExtrudeGeometry(cab, { depth: cw, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 10 })
  canopy.translate(0, 0, -cw / 2)
  canopy.rotateY(-Math.PI / 2)
  const cpos = canopy.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < cpos.count; i++) cpos.setX(i, cpos.getX(i) * (1 - 0.32 * Math.max(0, (cpos.getY(i) - 0.74) / 0.42)))
  canopy.computeVertexNormals()
  F.put(canopy, M.glass, 0, 0, 0)
  // side intakes behind the doors
  for (const sx of [-1, 1]) F.box(0.04, 0.16, 0.6, M.trim, sx * (Wd / 2 - 0.02), 0.5, -0.9)
  // wheels: tyre + rim + spokes hint
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const wz = sz * (L / 2 - 0.85)
      const wx = sx * (Wd / 2 - 0.12) // inboard: the body covers the tops of the wheels
      F.put(new THREE.CylinderGeometry(0.37, 0.37, 0.28, 24).rotateZ(Math.PI / 2), M.tyre, wx, 0.37, wz)
      F.put(new THREE.CylinderGeometry(0.25, 0.25, 0.3, 18).rotateZ(Math.PI / 2), M.rim, wx + sx * 0.002, 0.37, wz)
      for (let k = 0; k < 5; k++) F.put(new THREE.BoxGeometry(0.31, 0.04, 0.2).rotateX((k / 5) * Math.PI), M.trim, wx, 0.37, wz)
    }
  // light bars, grille, wing, underglow
  F.box(Wd - 0.5, 0.05, 0.04, M.head, 0, 0.62, L / 2 - 0.02, false)
  F.box(Wd - 0.4, 0.06, 0.04, M.tail, 0, 0.66, -L / 2 + 0.02, false)
  F.box(Wd - 0.8, 0.12, 0.05, M.trim, 0, 0.38, L / 2 + 0.03)
  if (m.wing) {
    F.box(Wd - 0.3, 0.05, 0.34, M.trim, 0, 0.98, -L / 2 + 0.35)
    for (const sx of [-0.55, 0.55]) F.box(0.05, 0.26, 0.12, M.trim, sx, 0.85, -L / 2 + 0.38)
  }
  F.box(Wd - 0.2, 0.01, L - 0.8, M.under, 0, 0.05, 0, false)
}
