import * as THREE from 'three'
import { createCharacter, disposeCharacter, type Character } from '../../character/character'
import type { Appearance } from '../../character/types'
import type { Pose } from '../../character/build'

const A = (p: Partial<Appearance> & Pick<Appearance, 'species'>): Appearance => ({
  skin: p.species === 'skeleton' ? '#e9e2d0' : p.species === 'demon' ? '#7e1a1a' : '#e8741c',
  outfit: '#141216',
  glow: '#ffb347',
  top: 'shirtless',
  headwear: 'none',
  eyewear: 'none',
  chain: false,
  ...p,
})

/** Residents stand at a post (optionally with dialogue). Walkers follow waypoint loops. */
export type ResidentDef = { id: string; a: Appearance; x: number; z: number; face: number; talk?: string; pose?: Pose; minQuality?: 'low' | 'medium'; /** where the player stands to talk, if not next to the NPC (e.g. across a counter) */ talkAt?: [number, number] }
export type WalkerDef = { id: string; a: Appearance; path: [number, number][]; speed: number; pause: number; minQuality?: 'low' | 'medium' }

export const RESIDENTS: ResidentDef[] = [
  { id: 'coach', a: A({ species: 'skeleton', glow: '#19f19a', headwear: 'cap', chain: true }), x: 13.4, z: 0.6, face: -2.2, talk: 'Talk to Coach Gourdon' },
  { id: 'hodl', a: A({ species: 'demon', outfit: '#2a262c', glow: '#ff4d3d', top: 'armor', headwear: 'horns' }), x: -5.6, z: 6.4, face: 2.4, talk: 'Talk to Sir Hodl' },
  { id: 'barkeep', a: A({ species: 'pumpkin', skin: '#c9581a', outfit: '#5a3a26', top: 'hoodie', headwear: 'cap', chain: true }), x: -6.4, z: 21.2, face: Math.PI / 2, talk: 'Talk to Barley' },
  { id: 'smith', a: A({ species: 'demon', skin: '#5b2a86', glow: '#ffb347', headwear: 'horns' }), x: -15.9, z: -11.6, face: 0.9, talk: 'Talk to Anvilus', pose: 'hammer' },
  { id: 'potion', a: A({ species: 'skeleton', skin: '#cfd6dc', outfit: '#4b2a7a', glow: '#9b5cff', top: 'hoodie', eyewear: 'none' }), x: -21, z: -2.6, face: 0, talk: 'Talk to Madame Marrowpot', talkAt: [-21, 0.6] },
  { id: 'captain', a: A({ species: 'skeleton', outfit: '#c89b3c', glow: '#ffb347', top: 'armor', headwear: 'crown' }), x: 3.6, z: -23.4, face: 0.25, talk: 'Talk to Captain Tibia' },
  // decorative stall keepers (no dialogue — they just mind their stalls)
  { id: 'grocer', a: A({ species: 'pumpkin', skin: '#e0a23a', outfit: '#2f4a2c', top: 'hoodie' }), x: -15, z: -2.6, face: 0, minQuality: 'medium' },
  { id: 'tailor', a: A({ species: 'demon', skin: '#1f6b5a', outfit: '#e9e4da', top: 'hoodie' }), x: -24, z: 7.6, face: Math.PI, minQuality: 'medium' },
]

export const WALKERS: WalkerDef[] = [
  { id: 'guardN', a: A({ species: 'skeleton', outfit: '#2a262c', glow: '#9b5cff', top: 'armor', eyewear: 'visor' }), path: [[0.8, -12.5], [0.8, -23.6]], speed: 1.3, pause: 2.5 },
  { id: 'guardW', a: A({ species: 'skeleton', outfit: '#2a262c', glow: '#9b5cff', top: 'armor', eyewear: 'visor' }), path: [[-12.5, 3.4], [-29, 3.4]], speed: 1.25, pause: 3 },
  {
    id: 'wander1',
    a: A({ species: 'pumpkin', skin: '#f08a2a', outfit: '#ff7a1a', top: 'hoodie', eyewear: 'shades' }),
    path: [[-1.2, 15.5], [-1, 12.5], [-6.5, 9.5], [-10.5, 4.5], [-18, 4], [-10.5, 4.5], [-8.7, -2], [-6.5, 9.5]],
    speed: 1.35,
    pause: 2,
    minQuality: 'medium',
  },
  {
    id: 'wander2',
    a: A({ species: 'demon', skin: '#2f2f3a', outfit: '#141216', top: 'hoodie', glow: '#19f19a' }),
    path: [[7, 19], [1.2, 15], [7.5, 8.5], [10.8, -3.2], [14.6, -3.2], [10.8, -3.2], [8, -8.8], [1.4, -11.5], [8, -8.8], [7.5, 8.5], [1.2, 15]],
    speed: 1.4,
    pause: 2.5,
    minQuality: 'medium',
  },
]

type Live = { def: ResidentDef | WalkerDef; c: Character; pos: THREE.Vector3; yaw: number; target: number; wait: number; facing: number; walker: boolean; shadow: boolean }

export class Crowd {
  live: Live[] = []
  private disposed = false

  private quality: 'low' | 'medium' | 'high' = 'medium'

  async load(scene: THREE.Scene, quality: 'low' | 'medium' | 'high', heightAt: (x: number, z: number) => number) {
    this.quality = quality
    const allowed = (m?: 'low' | 'medium') => !m || (m === 'medium' ? quality !== 'low' : true)
    const defs: (ResidentDef | WalkerDef)[] = [...RESIDENTS.filter((r) => allowed(r.minQuality)), ...WALKERS.filter((w) => allowed(w.minQuality))]
    const chars = await Promise.all(defs.map((d) => createCharacter(d.a)))
    if (this.disposed) return chars.forEach(disposeCharacter)
    defs.forEach((def, i) => {
      const c = chars[i]
      const walker = 'path' in def
      const [x, z] = walker ? def.path[0] : [def.x, def.z]
      const pos = new THREE.Vector3(x, heightAt(x, z), z)
      const yaw = walker ? 0 : def.face
      c.root.position.copy(pos)
      c.root.rotation.y = yaw
      if (!walker && def.pose) c.pose = def.pose
      scene.add(c.root)
      this.live.push({ def, c, pos, yaw, target: 1, wait: Math.random() * 2, facing: yaw, walker, shadow: true })
    })
  }

  get(id: string) {
    return this.live.find((l) => l.def.id === id)
  }

  /** Residents with dialogue are solid; walkers are handled as moving obstacles by World. */
  update(dt: number, player: THREE.Vector3, camera: THREE.Vector3, paused: boolean, heightAt: (x: number, z: number) => number) {
    for (const l of this.live) {
      const dPlayer = Math.hypot(l.pos.x - player.x, l.pos.z - player.z)
      const camD = l.pos.distanceTo(camera)
      const far = camD > 38
      // hidden beyond the fog; shadows only for nearby NPCs on High (each caster costs a second draw)
      l.c.root.visible = camD < 34
      const wantShadow = this.quality === 'high' && camD < 14
      if (wantShadow !== l.shadow) {
        l.shadow = wantShadow
        l.c.root.traverse((o) => (o.castShadow = wantShadow && (o as THREE.Mesh).isMesh))
      }
      if (l.walker) {
        const def = l.def as WalkerDef
        const [tx, tz] = def.path[l.target]
        const dx = tx - l.pos.x
        const dz = tz - l.pos.z
        const dist = Math.hypot(dx, dz)
        // polite: stop if the player is right in front
        const ahead = dPlayer < 1.5 && Math.cos(Math.atan2(player.x - l.pos.x, player.z - l.pos.z) - l.yaw) > 0.3
        let speed = 0
        if (l.wait > 0) l.wait -= dt
        else if (ahead || paused) {
          /* hold */
        } else if (dist < 0.15) {
          l.target = (l.target + 1) % def.path.length
          l.wait = def.pause * (0.6 + Math.random() * 0.8)
        } else {
          speed = def.speed
          const step = Math.min(dist, speed * dt)
          l.pos.x += (dx / dist) * step
          l.pos.z += (dz / dist) * step
          l.facing = Math.atan2(dx, dz)
        }
        if ((ahead || l.wait > 0) && dPlayer < 3.5) l.facing = Math.atan2(player.x - l.pos.x, player.z - l.pos.z)
        l.pos.y = heightAt(l.pos.x, l.pos.z)
        l.c.speed = speed / 3.4
        l.c.pose = speed > 0 ? 'walk' : 'idle'
      } else {
        const def = l.def as ResidentDef
        if (def.talk && dPlayer < 5 && !paused) l.facing = Math.atan2(player.x - l.pos.x, player.z - l.pos.z)
        else if (dPlayer > 6) l.facing = def.face
        if (def.pose === 'hammer') l.c.pose = dPlayer < 3 ? 'idle' : 'hammer'
        else l.c.pose = def.talk && dPlayer < 4.2 && dPlayer > 2.4 ? 'wave' : 'idle'
        l.c.speed = 0
      }
      let dy = l.facing - l.yaw
      dy = Math.atan2(Math.sin(dy), Math.cos(dy))
      l.yaw += dy * (1 - Math.exp(-dt * 6))
      l.c.root.position.copy(l.pos)
      l.c.root.rotation.y = l.yaw
      if (!far) l.c.update(dt)
    }
  }

  dispose() {
    this.disposed = true
    this.live.forEach((l) => disposeCharacter(l.c))
    this.live = []
  }
}
