import * as THREE from 'three'
import { isLocked } from '../../launch'
import { createCharacter, disposeCharacter, type Character } from '../../character/character'
import { createVillager, type VillagerLook } from '../../character/villager'
import type { Appearance } from '../../character/types'
import type { Pose } from '../../character/build'
import { B4S_BENCH, PLAZA_BENCHES, SEAT_FWD } from './props'

/** b4s sits on his plaza bench: root a little in front of the bench centre, facing the fountain */
const B4S_SEAT = (() => {
  const b = PLAZA_BENCHES[B4S_BENCH]
  return { x: b.x + Math.sin(b.ry) * SEAT_FWD, z: b.z + Math.cos(b.ry) * SEAT_FWD, face: b.ry }
})()

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
export type ResidentDef = { id: string; a?: Appearance; v?: VillagerLook; x: number; z: number; face: number; talk?: string; pose?: Pose; minQuality?: 'low' | 'medium' | 'high'; /** where the player stands to talk, if not next to the NPC (e.g. across a counter) */ talkAt?: [number, number] }
export type WalkerDef = { id: string; /** daily routine: only out by day / only out at night (default: always) */ when?: 'day' | 'night'; a?: Appearance; v?: VillagerLook; path: [number, number][]; speed: number; pause: number; minQuality?: 'low' | 'medium' | 'high' }

/** a villager look with sensible defaults (peasant clothes as painted, natural skin, brown hair) */
const V = (p: Partial<VillagerLook> & Pick<VillagerLook, 'body'>): VillagerLook => ({ outfit: 'peasant', cloth: '#ffffff', skin: 0, hair: p.body === 'f' ? 'long' : 'simpleparted', hairColor: '#4a3020', ...p })

/**
 * The people of Chad City are villagers (real human proportions, real clothes) — not copies of the playable Chads.
 * Two special characters keep their own looks: Coach Gourdon (the Pump Gym's coach) and b4s (a community legend).
 */
export const RESIDENTS: ResidentDef[] = [
  { id: 'coach', a: A({ species: 'skeleton', glow: '#19f19a', headwear: 'cap', chain: true }), x: 13.4, z: 0.6, face: -2.2, talk: 'Talk to Coach Gourdon' },
  // b4s keeps his bench by the fountain
  { id: 'hodl', a: A({ species: 'demon', outfit: '#2a262c', glow: '#ff4d3d', top: 'armor', headwear: 'horns' }), x: B4S_SEAT.x, z: B4S_SEAT.z, face: B4S_SEAT.face, talk: 'Talk to b4s', pose: 'sit' },
  { id: 'barkeep', v: V({ body: 'm', cloth: '#e8dcc8', apron: '#efe6d4', beard: true, hair: 'buzzed', hairColor: '#6a3a1e', skin: 0.5 }), x: -6.4, z: 21.2, face: Math.PI / 2, talk: 'Talk to Barley' },
  { id: 'smith', v: V({ body: 'm', cloth: '#9a948e', apron: '#4a3020', beard: true, hair: 'none', hairColor: '#2a1a12', skin: -0.4, height: 1.06 }), x: -15.9, z: -11.6, face: 0.9, talk: 'Talk to Anvilus', pose: 'hammer' },
  { id: 'potion', v: V({ body: 'f', cloth: '#b8a0d8', hat: 'witch', hatColor: '#2a1838', hair: 'long', hairColor: '#1e1418', skin: 0.7, prop: 'broom' }), x: -21, z: -2.6, face: 0, talk: 'Talk to Madame Marrowpot', talkAt: [-21, 0.6] },
  { id: 'captain', v: V({ body: 'm', outfit: 'ranger', cloth: '#d8c8a0', beard: true, hairColor: '#3a2a1a', skin: 0.2, height: 1.04 }), x: 3.6, z: -23.4, face: 0.25, talk: 'Talk to Captain Tibia', pose: 'folded' },
  { id: 'guide', v: V({ body: 'f', cloth: '#d8eccc', hat: 'cap', hatColor: '#2f4a2c', hair: 'buns', hairColor: '#8a4a22', skin: 0.4 }), x: -27, z: -2.6, face: 0, talk: 'Talk to Pip, the village guide', talkAt: [-27, 0.7] },
  // market traders
  { id: 'grocer', v: V({ body: 'm', cloth: '#e0d0b0', apron: '#e8e0cc', hat: 'cap', hatColor: '#5a3a22', prop: 'basket', skin: -0.7 }), x: -15, z: -2.6, face: 0, minQuality: 'medium' },
  { id: 'tailor', v: V({ body: 'f', cloth: '#f2d4e6', hat: 'bonnet', hatColor: '#efe4f2', hair: 'buns', hairColor: '#c8a070', skin: 0.8 }), x: -24, z: 7.6, face: Math.PI, minQuality: 'medium' },
  // the roadside hamlet: Rowan tends the courtyard well and the noticeboard
  { id: 'hamlet_rowan', v: V({ body: 'm', cloth: '#d8c8a0', apron: '#8a6a3a', hat: 'cap', hatColor: '#4a3a2a', beard: true, hairColor: '#8a7a5a', prop: 'basket', skin: 0.1 }), x: -23.4, z: 213.6, face: -2.2, talk: 'Talk to Rowan, the hamlet gardener', minQuality: 'medium' },
  // CHAD CITY: the greeter at the gate, Mo at the shake stall
  { id: 'greeter', v: V({ body: 'f', cloth: '#ffe2b8', hair: 'long', hairColor: '#d8a03a', prop: 'lantern', skin: 0.3 }), x: -3.6, z: 60.8, face: 0.9, talk: 'Talk to Goldie, the greeter' },
  { id: 'shakes', v: V({ body: 'm', cloth: '#d0f0dc', apron: '#5fae6a', hat: 'cap', hatColor: '#3a7a4a', hair: 'buzzed', hairColor: '#1a1210', skin: -0.9 }), x: -39, z: -4.55, face: 0, talk: 'Talk to Mo at Pump Shakes', talkAt: [-39, -1.9] },
  // the social corner: a couple on the picnic bench
  { id: 'sitterA', v: V({ body: 'm', cloth: '#c8d8f0', beard: true, hairColor: '#5a3a22', skin: 0.1 }), x: -43.2, z: 8.1, face: -Math.PI / 2, pose: 'sit', minQuality: 'medium' },
  { id: 'sitterB', v: V({ body: 'f', cloth: '#f0c8c0', hair: 'buns', hairColor: '#2a1a14', skin: -0.5 }), x: -44.2, z: 8.1, face: Math.PI / 2, pose: 'sit', minQuality: 'high' },
  // gossip by the noticeboard
  { id: 'chatA', v: V({ body: 'f', cloth: '#ffd8a8', hat: 'bonnet', hatColor: '#e8641a', hair: 'long', hairColor: '#6a2a1a', skin: 0.6 }), x: -4.4, z: -7.4, face: 2.2, pose: 'point', minQuality: 'medium' },
  { id: 'chatB', v: V({ body: 'm', cloth: '#e8e4da', hat: 'cap', hatColor: '#2a2a3a', beard: true, hairColor: '#8a8070', skin: 0.3 }), x: -3.1, z: -8.3, face: -1.0, minQuality: 'high' },
  // watching the training in the gym yard
  { id: 'stretcher', v: V({ body: 'm', cloth: '#c8c0d8', hair: 'buzzed', hairColor: '#2a1a12', skin: -0.2 }), x: 18.6, z: 7.4, face: Math.PI / 2, pose: 'folded', minQuality: 'medium' },
  { id: 'flexer', v: V({ body: 'f', outfit: 'ranger', cloth: '#d8e0c8', hair: 'buzzedfemale', hairColor: '#1a1210', skin: -0.6 }), x: 26.5, z: 8.2, face: -Math.PI / 2 - 0.5, pose: 'point', minQuality: 'high' },
  // the Haunted Quarter: Grim the gravedigger at the graveyard gate, a mourner at Mortimer's crypt, a lamplighter's widow by the fountain
  { id: 'gravedig', v: V({ body: 'm', cloth: '#8a8070', hat: 'cap', hatColor: '#2a2420', beard: true, hairColor: '#6a6050', prop: 'lantern', skin: 0.3, height: 1.04 }), x: -89.4, z: 21.6, face: -Math.PI / 2, talk: 'Talk to Grim, the gravedigger', pose: 'folded' },
  { id: 'mourner', v: V({ body: 'f', cloth: '#5a5068', hat: 'bonnet', hatColor: '#1e1a24', hair: 'long', hairColor: '#1a1414', skin: 0.6 }), x: -92.6, z: 12.4, face: -Math.PI / 2 - 0.4, minQuality: 'medium' },
  // Pumbledore the wizard, reading in the garden
  { id: 'reader', v: V({ body: 'm', cloth: '#a8b8f0', hat: 'wizard', hatColor: '#1a2244', beard: true, hairColor: '#d8d4cc', skin: 0.6 }), x: -51.98, z: 23, face: Math.PI / 2, pose: 'sit', minQuality: 'medium' },
]

export const WALKERS: WalkerDef[] = [
  // the night watch: lanterns lit, walking their beats
  { id: 'guardN', v: V({ body: 'm', cloth: '#9aa0b0', hat: 'guard', beard: true, hairColor: '#3a2a1a', prop: 'lantern', skin: 0.1, height: 1.05 }), path: [[0.8, -12.5], [0.8, -23.6]], speed: 1.3, pause: 2.5 },
  { id: 'guardW', v: V({ body: 'm', cloth: '#9aa0b0', hat: 'guard', prop: 'lantern', skin: -0.8, height: 1.03 }), path: [[-12.5, 3.4], [-29, 3.4]], speed: 1.25, pause: 3 },
  {
    id: 'wander1',
    v: V({ body: 'f', cloth: '#f0e0c0', hair: 'buns', hairColor: '#4a2a1a', prop: 'basket', skin: 0.5 }),
    path: [[-1.2, 15.5], [-1, 12.5], [-6.5, 9.5], [-10.5, 4.5], [-18, 4], [-10.5, 4.5], [-8.7, -2], [-6.5, 9.5]],
    speed: 1.35,
    pause: 2,
    minQuality: 'medium',
  },
  {
    id: 'wander2',
    v: V({ body: 'm', outfit: 'ranger', cloth: '#c8d0c0', hairColor: '#2a1a12', skin: -0.3 }),
    path: [[7, 19], [1.2, 15], [7.5, 8.5], [10.8, -3.2], [14.6, -3.2], [10.8, -3.2], [8, -8.8], [1.4, -11.5], [8, -8.8], [7.5, 8.5], [1.2, 15]],
    speed: 1.4,
    pause: 2.5,
    minQuality: 'medium',
  },
  // CHAD CITY walkers: Arcade Street, the canal promenade, the garden loop, the forecourt
  { id: 'wander3', when: 'day', v: V({ body: 'm', cloth: '#d8d0f0', hat: 'cap', hatColor: '#5b2a86', skin: 0.4 }), path: [[6, 18.2], [43, 18.2], [43, 20], [6, 20]], speed: 1.3, pause: 3, minQuality: 'medium' },
  { id: 'wander4', v: V({ body: 'f', cloth: '#c0a8d8', hat: 'witch', hatColor: '#1e1428', hair: 'long', hairColor: '#5a1a2a', prop: 'broom', skin: 0.9 }), path: [[-24, 36.6], [-4.5, 36.6], [4.5, 36.6], [24, 36.6]], speed: 1.2, pause: 4, minQuality: 'medium' },
  { id: 'wander5', when: 'day', v: V({ body: 'f', cloth: '#e0f0d0', hat: 'bonnet', hatColor: '#d8e8c8', hair: 'buns', hairColor: '#a06a3a', prop: 'basket', skin: -0.2 }), path: [[-54.2, 13.8], [-33.8, 13.8], [-33.8, 32.2], [-54.2, 32.2]], speed: 1.1, pause: 5, minQuality: 'high' },
  // the hamlet's villager strolls the courtyard ring and the lane to the road
  { id: 'hamlet_walker', v: V({ body: 'f', cloth: '#e8d0c0', hat: 'bonnet', hatColor: '#c8a0a0', hair: 'buns', hairColor: '#4a2a1a', prop: 'basket', skin: -0.2 }), path: [[-34, 209], [-20, 209], [-19, 226], [-34, 226], [-34, 215], [-12, 209], [-34, 209]], speed: 1.15, pause: 3.2, minQuality: 'medium' },
  // the lamplighter on the arrival forecourt
  { id: 'wander6', when: 'night', v: V({ body: 'm', cloth: '#e8d8c0', hat: 'cap', hatColor: '#26242a', beard: true, hairColor: '#6a6050', prop: 'lantern', skin: 0.2 }), path: [[-5, 53.5], [-5, 66], [5, 66], [5, 53.5]], speed: 1.25, pause: 3, minQuality: 'high' },
  // NIGHT ROUTINES: the lamplighter makes his rounds (the paths are legs the day walkers already prove clear), and a late
  // shopper hurries home along Arcade Street while the day crowd is indoors
  { id: 'lamplighter', when: 'night', v: V({ body: 'm', cloth: '#cdb98a', hat: 'cap', hatColor: '#26242a', beard: true, hairColor: '#6a6050', prop: 'lantern', skin: 0.1 }), path: [[-18, 4], [-10.5, 4.5], [-6.5, 9.5], [-1, 12.5], [-1.2, 15.5], [-1, 12.5], [-6.5, 9.5], [-10.5, 4.5]], speed: 1.0, pause: 4.5, minQuality: 'medium' },
  { id: 'lateShopper', when: 'night', v: V({ body: 'f', cloth: '#b8a0d8', hat: 'bonnet', hatColor: '#7a5aa8', hair: 'buns', hairColor: '#3a2030', prop: 'basket', skin: -0.4 }), path: [[43, 20], [6, 20], [6, 18.2], [43, 18.2]], speed: 1.9, pause: 1.5, minQuality: 'medium' },
]

type Live = { def: ResidentDef | WalkerDef; c: Character; pos: THREE.Vector3; yaw: number; target: number; wait: number; facing: number; walker: boolean; shadow: boolean }

export class Crowd {
  live: Live[] = []
  private disposed = false

  private quality: 'low' | 'medium' | 'high' = 'medium'

  async load(scene: THREE.Scene, quality: 'low' | 'medium' | 'high', heightAt: (x: number, z: number) => number, night = false) {
    this.quality = quality
    const allowed = (m?: 'low' | 'medium' | 'high') => !m || (m === 'high' ? quality === 'high' : m === 'medium' ? quality !== 'low' : true)
    // anyone whose post or beat lies in the locked expansion stays out of the first release (their data stays defined for the next update)
    const reachable = (d: ResidentDef | WalkerDef) => !('path' in d ? d.path : [[d.x, d.z] as [number, number]]).some(([x, z]) => isLocked(x, z))
    const defs: (ResidentDef | WalkerDef)[] = [...RESIDENTS.filter((r) => allowed(r.minQuality) && reachable(r)), ...WALKERS.filter((w) => allowed(w.minQuality) && reachable(w) && (!w.when || w.when === (night ? 'night' : 'day')))]
    const chars = await Promise.all(defs.map((d) => (d.v ? createVillager(d.v) : createCharacter(d.a!))))
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
        // seated residents stay facing the way their bench faces (no swivelling on the seat)
        if (def.pose === 'sit') l.facing = def.face
        else if (def.talk && dPlayer < 5 && !paused) l.facing = Math.atan2(player.x - l.pos.x, player.z - l.pos.z)
        else if (dPlayer > 6) l.facing = def.face
        if (def.pose === 'sit') l.c.pose = 'sit'
        else if (def.pose === 'hammer') l.c.pose = dPlayer < 3 ? 'idle' : 'hammer'
        else if (def.pose && !(def.talk && dPlayer < 4.2)) l.c.pose = def.pose // stretching, chatting, posing
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
