import * as THREE from 'three'
import type { Town } from './buildings'
import { boxUV } from './kit'

/**
 * The opening adventure's pieces in the world: three Guardian Lanterns (Chad Bridge, Chad Square, before the
 * Citadel) on stone plinths — cold and dark until the player relights them — and the Golden Sigil, which rises at
 * the Citadel doors once all three burn. Static stone is batched; the glass, flames, markers and sigil are live
 * meshes the quest state switches on and off.
 */
export const LANTERNS = [
  { id: 'bridge', name: 'Chad Bridge', x: 4.7, z: 36.8 },
  { id: 'square', name: 'Chad Square', x: -7.2, z: 7.4 },
  { id: 'citadel', name: 'the Citadel forecourt', x: -4.6, z: -16.6 },
] as const
export type LanternId = (typeof LANTERNS)[number]['id']
export const SIGIL = { x: 0, z: -22.6 }

export type GuardianLanterns = {
  setLit(id: LanternId, lit: boolean): void
  setMarker(id: LanternId, on: boolean): void
  setSigil(on: boolean): void
}

export function guardianLanterns(T: Town): GuardianLanterns {
  const P = T.P
  const D = T.disposables
  const cold = new THREE.MeshStandardMaterial({ color: '#1a2230', roughness: 0.25, metalness: 0.4, emissive: '#05080e' })
  const warm = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc864').multiplyScalar(2.4), toneMapped: false })
  const flameM = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff0b0').multiplyScalar(3), toneMapped: false })
  const halo = new THREE.SpriteMaterial({ map: haloTexture(D), color: '#ffc864', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 })
  D.push(cold, warm, flameM, halo)
  const glassGeo = new THREE.BoxGeometry(0.4, 0.5, 0.4)
  const flameGeo = new THREE.ConeGeometry(0.07, 0.2, 6)
  const markerGeo = new THREE.OctahedronGeometry(0.2, 0).scale(1, 1.5, 1)
  D.push(glassGeo, flameGeo, markerGeo)

  const live = new Map<LanternId, { glass: THREE.Mesh; flame: THREE.Mesh; glow: THREE.Sprite; marker: THREE.Mesh }>()
  for (const L of LANTERNS) {
    // plinth + an iron lantern cage with a little pitched cap
    T.batch.put(boxUV(0.8, 0.9, 0.8, 1), P.stone, L.x, 0.45, L.z)
    T.batch.put(boxUV(0.95, 0.12, 0.95, 1), P.stoneLight, L.x, 0.96, L.z)
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) T.batch.put(new THREE.BoxGeometry(0.05, 0.62, 0.05), P.iron, L.x + dx * 0.23, 1.33, L.z + dz * 0.23)
    T.batch.put(new THREE.BoxGeometry(0.56, 0.06, 0.56), P.iron, L.x, 1.04, L.z)
    T.batch.put(new THREE.ConeGeometry(0.42, 0.34, 4).rotateY(Math.PI / 4), P.iron, L.x, 1.81, L.z)
    T.batch.put(new THREE.SphereGeometry(0.06, 8, 6), P.gold, L.x, 2.0, L.z)
    T.colliders.push({ kind: 'box', minX: L.x - 0.45, maxX: L.x + 0.45, minZ: L.z - 0.45, maxZ: L.z + 0.45, h: 2 })

    const glass = new THREE.Mesh(glassGeo, cold)
    glass.position.set(L.x, 1.32, L.z)
    const flame = new THREE.Mesh(flameGeo, flameM)
    flame.position.set(L.x, 1.3, L.z)
    flame.visible = false
    const glow = new THREE.Sprite(halo)
    glow.scale.setScalar(2.4)
    glow.position.set(L.x, 1.32, L.z)
    glow.visible = false
    const marker = new THREE.Mesh(markerGeo, P.glowGold)
    marker.position.set(L.x, 2.7, L.z)
    marker.visible = false
    T.scene.add(glass, flame, glow, marker)
    live.set(L.id, { glass, flame, glow, marker })
  }
  T.dynamic.push({
    update: (t) => {
      for (const [, v] of live) {
        if (v.marker.visible) {
          v.marker.position.y = 2.7 + Math.sin(t * 2.4) * 0.12
          v.marker.rotation.y = t * 1.5
        }
        if (v.flame.visible) {
          v.flame.scale.set(1, 1 + Math.sin(t * 13 + v.flame.position.x) * 0.15, 1)
          v.glow.material.opacity = 0.75 + Math.sin(t * 7 + v.flame.position.z) * 0.1
        }
      }
    },
  })

  // the Golden Sigil: a gold pumpkin inside a ring, crowned, turning slowly above a beam of light
  const sigil = new THREE.Group()
  {
    // its own gold: metallic but self-lit, so it reads as treasure at night (the shared gold goes dark without env light)
    const gold = new THREE.MeshStandardMaterial({ color: '#ffcf5a', metalness: 0.85, roughness: 0.3, emissive: '#b8780e', emissiveIntensity: 0.9 })
    D.push(gold)
    const pk = new THREE.SphereGeometry(0.34, 20, 14)
    const pos = pk.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const k = 1 - 0.08 * Math.abs(Math.sin(Math.atan2(pos.getZ(i), pos.getX(i)) * 4))
      pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * 0.85, pos.getZ(i) * k)
    }
    pk.computeVertexNormals()
    const ring = new THREE.TorusGeometry(0.62, 0.05, 8, 40)
    const crown = new THREE.CylinderGeometry(0.16, 0.2, 0.14, 5, 1, true)
    const beam = new THREE.CylinderGeometry(0.5, 0.9, 6, 20, 1, true)
    const beamM = new THREE.MeshBasicMaterial({ color: '#ffd25a', transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
    D.push(pk, ring, crown, beam, beamM)
    const spin = new THREE.Group()
    spin.add(new THREE.Mesh(pk, gold), new THREE.Mesh(ring, gold))
    const c = new THREE.Mesh(crown, gold)
    c.position.y = 0.36
    spin.add(c)
    spin.position.y = 1.7
    const b = new THREE.Mesh(beam, beamM)
    b.position.y = 3
    const g = new THREE.Sprite(halo)
    g.scale.setScalar(3.4)
    g.position.y = 1.7
    sigil.add(spin, b, g)
    sigil.position.set(SIGIL.x, 0, SIGIL.z)
    sigil.visible = false
    T.scene.add(sigil)
    T.dynamic.push({
      update: (t) => {
        if (!sigil.visible) return
        spin.rotation.y = t * 0.9
        spin.position.y = 1.7 + Math.sin(t * 1.6) * 0.1
      },
    })
  }

  return {
    setLit(id, lit) {
      const v = live.get(id)
      if (!v) return
      v.glass.material = lit ? warm : cold
      v.flame.visible = lit
      v.glow.visible = lit
      if (lit) v.marker.visible = false
    },
    setMarker(id, on) {
      const v = live.get(id)
      if (v) v.marker.visible = on && !v.flame.visible
    },
    setSigil(on) {
      sigil.visible = on
    },
  }
}

function haloTexture(D: (THREE.Material | THREE.Texture | THREE.BufferGeometry)[]) {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  r.addColorStop(0, 'rgba(255,255,255,1)')
  r.addColorStop(0.35, 'rgba(255,255,255,0.35)')
  r.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = r
  g.fillRect(0, 0, 64, 64)
  const t = new THREE.CanvasTexture(c)
  D.push(t)
  return t
}
