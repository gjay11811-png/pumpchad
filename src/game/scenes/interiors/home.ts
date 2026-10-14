import * as THREE from 'three'
import type { SaveData } from '../../save'
import { SPECIES } from '../../minigames/fishing'
import * as Fu from './furniture'
import type { HouseSpec } from './houses'

/**
 * YOUR COTTAGE — the inside of the cottage you built in Chadville Estates. Cosy and furnished (a lit fireplace,
 * a bed, a table for two, books), with a trophy wall that shows what you've actually done: the Golden Sigil and
 * moonstone from the curse chapters, the Chad Press cup, the Pumpkin Rush medal, and a mounted fish for every
 * species in your fish log. Empty slots stay on the wall so you can see what's still out there.
 */
export type Trophy = { id: string; label: string; got: boolean }

export function homeTrophies(s: SaveData): { shelf: Trophy[]; fish: Trophy[] } {
  const d = s.progress.discoveries
  return {
    shelf: [
      { id: 'sigil', label: 'the Golden Sigil (a replica — the real one hums in your pocket)', got: d.includes('q1_sigil') },
      { id: 'moonstone', label: 'a moonstone shard from the forest glade', got: d.includes('q2_stone') },
      { id: 'cup', label: 'the Chad Press cup (finish a set at Pump Gym)', got: s.progress.gymRuns > 0 },
      { id: 'medal', label: 'the Pumpkin Rush medal (play a Pumpkin Rush)', got: (s.progress.records.pumpkin_rush ?? 0) > 0 },
    ],
    fish: SPECIES.map((sp) => ({ id: sp.id, label: sp.name, got: d.includes(`fish_${sp.id}`) })),
  }
}

/** the home's spec for a cottage whose front door is at (x, z) facing `face` (radians) */
export function homeSpec(door: { x: number; z: number; face: number; half: number }, s: SaveData): HouseSpec {
  const T = homeTrophies(s)
  const got = [...T.shelf, ...T.fish].filter((t) => t.got)
  const missing = [...T.shelf.filter((t) => !t.got).map((t) => t.label), ...(T.fish.some((t) => !t.got) ? [`${T.fish.filter((t) => !t.got).length} more fish for the wall`] : [])]
  return {
    id: 'home',
    name: 'Your Cottage',
    door: { x: door.x, z: door.z, face: door.face, half: door.half, out: 0.7 },
    room: { w: 7, d: 6, h: 3.2 },
    look: { wall: ['stripe', '#efe2c8', '#e2d2b4'], floor: '#9a6b44', trim: '#5b2a86', ceiling: '#f4ecdc' },
    mood: 'warm',
    looks: {
      trophies: {
        at: [2.4, 0.2],
        r: 1.4,
        label: 'Look at your trophy wall',
        speaker: 'Your trophy wall',
        role: `${got.length} of ${T.shelf.length + T.fish.length} spaces filled`,
        lines: [
          got.length ? `On the wall: ${got.map((t) => t.label.replace(/ \(.*\)$/, '')).join(' · ')}.` : 'Empty for now — every space is waiting for something you’ve done.',
          missing.length ? `Still to earn: ${missing.slice(0, 4).join(' · ')}.` : 'Every space is filled. Absolute chad.',
        ],
      },
    },
    build(K, S) {
      const M = K.M
      Fu.rug(K, 0, 0.3, 3.0, 2.2, 0, ['#5b2a86', '#e0a83e', '#efe2c8'], 0.006, 61)
      Fu.fireplace(K, ...S.against('left', -0.6, 0.8), { lit: true })
      Fu.bed(K, -2.2, -2.0, 0, { blanket: '#5b2a86' })
      Fu.table(K, 0.4, 0.6, 0, { round: true, w: 1.0, mat: M.woodDark })
      Fu.chair(K, -0.4, 0.6, Math.PI / 2, { mat: M.woodDark, pad: '#e0a83e' })
      Fu.chair(K, 1.2, 0.6, -Math.PI / 2, { mat: M.woodDark, pad: '#e0a83e' })
      Fu.bookshelf(K, ...S.against('back', 1.4, 0.42), { w: 1.6, h: 2.2, seed: 21 })
      Fu.plant(K, -3.1, 2.5, 1.0)
      S.window('front', -2.2, '#5b2a86')
      S.window('front', 2.2, '#5b2a86')
      Fu.paintingOnWall(K, S.on('back', -0.6), 0.9, 1.9, 'castle', 33)
      K.light(0, 2.8, 0.4, '#ffe2b0', 4, 8)

      // the trophy wall (right-hand wall): a shelf with four trophies, a row of mounted fish above it
      const gold = new THREE.MeshStandardMaterial({ color: '#ffcf5a', metalness: 0.85, roughness: 0.3, emissive: '#7a4e08', emissiveIntensity: 0.6 })
      const crystal = new THREE.MeshBasicMaterial({ color: new THREE.Color('#7fe8ff').multiplyScalar(1.6), toneMapped: false })
      const empty = new THREE.MeshStandardMaterial({ color: '#4a4040', roughness: 0.9 })
      M.D.push(gold, crystal, empty)
      const W = S.on('right', 0.2)
      W.box(2.8, 0.06, 0.32, M.woodDark, 0, 1.15, 0.16)
      for (const sx of [-1.25, 1.25]) W.box(0.06, 0.2, 0.28, M.woodDark, sx, 1.03, 0.14)
      T.shelf.forEach((t, i) => {
        const x = -1.05 + i * 0.7
        W.box(0.24, 0.06, 0.2, t.got ? M.brass : empty, x, 1.21, 0.16)
        if (!t.got) return
        if (t.id === 'sigil') {
          W.put(new THREE.TorusGeometry(0.11, 0.015, 6, 20), gold, x, 1.4, 0.16)
          W.put(new THREE.SphereGeometry(0.065, 12, 10), gold, x, 1.4, 0.16)
        } else if (t.id === 'moonstone') {
          W.put(new THREE.OctahedronGeometry(0.09, 0).scale(0.7, 1.4, 0.7), crystal, x, 1.37, 0.16, 0, 0, 0, false)
        } else if (t.id === 'cup') {
          W.put(new THREE.CylinderGeometry(0.09, 0.04, 0.16, 12), gold, x, 1.36, 0.16)
          W.put(new THREE.CylinderGeometry(0.03, 0.06, 0.06, 10), gold, x, 1.26, 0.16)
        } else {
          W.put(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 16).rotateX(Math.PI / 2), gold, x, 1.36, 0.16)
          W.box(0.05, 0.1, 0.01, M.fab('#e8641a', 0.6), x, 1.48, 0.16)
        }
      })
      SPECIES.forEach((sp, i) => {
        const x = -1.25 + i * 0.5
        const caught = T.fish[i].got
        W.box(0.42, 0.26, 0.04, caught ? M.woodDark : empty, x, 2.0, 0.02)
        if (!caught) return
        const body = new THREE.SphereGeometry(0.1, 12, 8).scale(1.6, 0.7, 0.35)
        const tail = new THREE.ConeGeometry(0.06, 0.1, 3).rotateZ(Math.PI / 2)
        const fm = M.fab(sp.color, 0.5)
        W.put(body, fm, x - 0.02, 2.0, 0.07)
        W.put(tail, fm, x + 0.17, 2.0, 0.07)
      })
      K.light(2.6, 2.2, 0.2, '#ffe2b0', 1.8, 4)
    },
  }
}
