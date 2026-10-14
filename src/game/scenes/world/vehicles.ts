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
        const mm = new THREE.MeshPhysicalMaterial({ color: m.paint, metalness: 0.35, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.5, emissive: m.paint, emissiveIntensity: night ? 0.16 : 0.05 })
        D.push(mm)
        return mm
      })(),
      glass: std({ color: '#2a3c56', metalness: 0.85, roughness: 0.1, emissive: '#0a1220' }),
      tyre: std({ color: '#141416', roughness: 0.85 }),
      rim: std({ color: m.rim === 'gold' ? '#e0a83e' : '#d8d6d0', metalness: 1, roughness: 0.22 }),
      trim: std({ color: '#1a1a1e', metalness: 0.6, roughness: 0.4 }),
      head: glow('#fff2d8', night ? 1.5 : 1.1),
      tail: glow('#ff2a3a', night ? 1.6 : 1.0),
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
  const hw = 0.98 // half the body width at the wheels
  // ── lower body: a plan-view slab (pointed nose, wide haunches, blunt tail) with softened edges ──
  const plan = new THREE.Shape()
  plan.moveTo(-0.5, -2.25) // nose (the shape's −y becomes the car's +z)
  plan.quadraticCurveTo(-0.85, -2.1, -hw, -1.45)
  plan.lineTo(-hw, 1.3)
  plan.quadraticCurveTo(-hw, 2.1, -0.78, 2.2)
  plan.lineTo(0.78, 2.2)
  plan.quadraticCurveTo(hw, 2.1, hw, 1.3)
  plan.lineTo(hw, -1.45)
  plan.quadraticCurveTo(0.85, -2.1, 0.5, -2.25)
  plan.quadraticCurveTo(0, -2.34, -0.5, -2.25)
  const slab = new THREE.ExtrudeGeometry(plan, { depth: 0.34, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07, bevelSegments: 3, curveSegments: 10 })
  slab.rotateX(-Math.PI / 2)
  slab.translate(0, 0.2, 0)
  F.put(slab, M.paint, 0, 0, 0)
  // ── the shoulder: a narrower deck on top, sloping down over the bonnet to the nose and to the tail ──
  const deck = new THREE.Shape()
  deck.moveTo(-1.95, 0)
  deck.lineTo(2.0, 0)
  deck.quadraticCurveTo(2.25, 0.02, 2.2, 0.12)
  deck.lineTo(-1.2, 0.2)
  deck.lineTo(-1.95, 0.14)
  deck.closePath()
  const dw = 1.62
  const deckG = new THREE.ExtrudeGeometry(deck, { depth: dw, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 2, curveSegments: 6 })
  deckG.translate(0, 0, -dw / 2)
  deckG.rotateY(-Math.PI / 2)
  F.put(deckG, M.paint, 0, 0.6, 0)
  // ── cabin: a glasshouse (tinted, but lighter than the body so it reads) under a painted roof, with pillars ──
  const cab = new THREE.Shape()
  cab.moveTo(-1.3, 0)
  cab.quadraticCurveTo(-0.8, 0.46, -0.3, 0.5)
  cab.lineTo(0.3, 0.5)
  cab.quadraticCurveTo(0.85, 0.44, 1.2, 0)
  cab.closePath()
  const cw = 1.38
  const cabG = new THREE.ExtrudeGeometry(cab, { depth: cw, bevelEnabled: false })
  cabG.translate(0, 0, -cw / 2)
  cabG.rotateY(-Math.PI / 2)
  const cp = cabG.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < cp.count; i++) cp.setX(i, cp.getX(i) * (1 - 0.2 * (cp.getY(i) / 0.5)))
  cabG.computeVertexNormals()
  F.put(cabG, M.glass, 0, 0.78, 0)
  F.box(1.0, 0.05, 0.62, M.paint, 0, 1.28, -0.02) // roof panel
  for (const sx of [-1, 1]) {
    F.put(new THREE.BoxGeometry(0.06, 0.06, 1.0).rotateX(0.5), M.paint, sx * 0.62, 1.04, 0.78) // A pillars
    F.box(0.05, 0.5, 0.08, M.paint, sx * 0.68, 1.04, -0.42) // B pillar
    F.box(0.04, 0.06, 0.5, M.trim, sx * 0.99, 0.7, -0.05) // door shut-line
    F.box(0.1, 0.07, 0.16, M.paint, sx * 0.86, 0.98, 0.72) // mirror
  }
  // seats + a wheel hint, so the cabin isn't empty
  for (const sx of [-0.32, 0.32]) F.box(0.36, 0.34, 0.12, M.trim, sx, 0.98, -0.45)
  F.box(0.5, 0.04, 0.04, M.trim, 0, 1.0, 0.45)
  // ── wheels: tyre, rim with spokes, brake disc + caliper; dark arches painted around each wheel ──
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const wz = sz * 1.4
      const wx = sx * (hw - 0.05)
      F.put(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 24).rotateZ(Math.PI / 2), M.tyre, wx, 0.38, wz)
      F.put(new THREE.CylinderGeometry(0.27, 0.27, 0.32, 20).rotateZ(Math.PI / 2), M.rim, wx + sx * 0.002, 0.38, wz)
      F.put(new THREE.CylinderGeometry(0.2, 0.2, 0.2, 14).rotateZ(Math.PI / 2), M.trim, wx - sx * 0.04, 0.38, wz) // brake disc
      F.box(0.05, 0.16, 0.1, M.under, wx - sx * 0.02, 0.5, wz - sz * 0.12) // caliper
    }
  return finishCar(F, M, m, L, hw)
}

/** second half of the car: arches, lights, bumpers, exhausts, wing, underglow (split to keep the wheel loop readable) */
function finishCar(F: Frame, M: Record<string, THREE.Material>, m: CarModel, L: number, hw: number) {
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const wz = sz * 1.4
      const wx = sx * (hw - 0.05)
      for (let k = 0; k < 5; k++) F.put(new THREE.BoxGeometry(0.03, 0.04, 0.46).rotateX((k / 5) * Math.PI), M.rim, wx + sx * 0.16, 0.38, wz) // spokes
      F.put(new THREE.CircleGeometry(0.47, 20), M.trim, sx * (hw + 0.02), 0.4, wz, 0, sx * Math.PI / 2, 0, false) // arch shadow
    }
  // lights: slim headlamp units with a DRL line, and tail lamps — bright but small, so they don't bloom into a blob
  for (const sx of [-1, 1]) {
    F.box(0.36, 0.07, 0.05, M.head, sx * 0.55, 0.55, L / 2 - 0.06, false)
    F.box(0.4, 0.09, 0.06, M.trim, sx * 0.55, 0.55, L / 2 - 0.08)
    F.box(0.4, 0.07, 0.05, M.tail, sx * 0.62, 0.62, -L / 2 + 0.04, false)
    F.put(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 10).rotateX(Math.PI / 2), M.rim, sx * 0.4, 0.3, -L / 2 - 0.02) // exhaust tip
  }
  F.box(1.0, 0.1, 0.05, M.trim, 0, 0.36, L / 2 - 0.02) // grille
  F.box(1.5, 0.05, 0.3, M.trim, 0, 0.2, L / 2 - 0.1) // splitter
  F.box(1.3, 0.08, 0.22, M.trim, 0, 0.22, -L / 2 + 0.05) // diffuser
  F.box(0.34, 0.1, 0.02, M.rim, 0, 0.44, -L / 2 - 0.01, false) // plate
  F.box(0.04, 0.12, 2.6, M.trim, hw - 0.02, 0.3, 0) // side skirts
  F.box(0.04, 0.12, 2.6, M.trim, -(hw - 0.02), 0.3, 0)
  if (m.wing) {
    F.box(1.7, 0.05, 0.36, M.paint, 0, 1.1, -L / 2 + 0.32)
    for (const sx of [-0.7, 0.7]) F.box(0.05, 0.34, 0.14, M.trim, sx, 0.92, -L / 2 + 0.38)
  }
  F.box(1.5, 0.01, 3.4, M.under, 0, 0.04, 0, false)
}
