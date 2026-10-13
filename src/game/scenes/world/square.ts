import * as THREE from 'three'
import type { Town } from './buildings'
import { noticeBoard } from './textures'
import { Frame, boardTexture, lectern, plaque, postedBoard, type SignMats } from './signs'

/** Chad Square additions: the community noticeboard + the COMMUNITY CHAMPIONS case (reserved, no winners yet). */
export const NOTICE = { x: 9.7, z: -8.1 }
export const CHAMPIONS = { x: -9.7, z: -8.1 }
/** both face the middle of the square */
const faceCentre = (x: number, z: number) => Math.atan2(-x, -z)
/** where a player stands to read each (in front of the face) */
export const standFor = (p: { x: number; z: number }, d = 1.5) => {
  const ry = faceCentre(p.x, p.z)
  return { x: p.x + Math.sin(ry) * d, z: p.z + Math.cos(ry) * d }
}

export function squareExtras(T: Town, trim: THREE.Material) {
  const P = T.P
  const Dp = T.disposables
  const SM: SignMats = { frame: P.timber, metal: P.iron, gold: P.gold, stone: trim }

  // ── community noticeboard: a roofed timber board on posts, the pinned-paper collage ──
  {
    const nb = new THREE.MeshStandardMaterial({ map: noticeBoard(), roughness: 0.9 })
    Dp.push(nb, nb.map!)
    const ry = faceCentre(NOTICE.x, NOTICE.z)
    postedBoard(Frame.at(T.batch, NOTICE.x, 0, NOTICE.z, ry), 2.3, 1.6, 1.55, nb, SM, false)
    T.colliders.push({ kind: 'circle', x: NOTICE.x, z: NOTICE.z, r: 1.3, h: 2.6 })
  }

  // ── the statue plaque: a bronze lectern at the fountain's south edge (read it with the 'statue' prompt) ──
  {
    const pl = new THREE.MeshStandardMaterial({
      map: boardTexture('PUMPCHAD', ['First of his name, King of Chad Square.', '“Markets dump. Chads pump.”'], 1.7, { bg: '#7a5a2a', ink: '#ffe9b8', sub: '#f6e2b4', rule: '#e0b860' }, Dp, true),
      metalness: 0.7,
      roughness: 0.4,
    })
    Dp.push(pl)
    lectern(Frame.at(T.batch, 0, 0, 6.95, 0), 0.7, 0.42, pl, SM) // just outside the fountain steps (r 6.45)
    T.colliders.push({ kind: 'circle', x: 0, z: 6.95, r: 0.42, h: 1.1 })
  }

  // ── COMMUNITY CHAMPIONS: a glass display case on a stone plinth, three empty pedestals, an engraved plaque ──
  {
    const ry = faceCentre(CHAMPIONS.x, CHAMPIONS.z)
    const F = Frame.at(T.batch, CHAMPIONS.x, 0, CHAMPIONS.z, ry)
    const glass = new THREE.MeshStandardMaterial({ color: '#cfe4f2', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false })
    const velvet = new THREE.MeshStandardMaterial({ color: '#4a1f6a', roughness: 0.9 })
    Dp.push(glass, velvet)
    F.box(2.8, 0.9, 1.1, trim, 0, 0.45, 0) // plinth
    F.box(2.95, 0.1, 1.25, P.gold, 0, 0.92, 0)
    F.box(2.6, 0.06, 0.9, velvet, 0, 1.0, 0)
    // three stepped pedestals, waiting
    for (const [x, h] of [[-0.85, 0.28], [0, 0.42], [0.85, 0.2]] as const) {
      F.box(0.5, h, 0.42, P.stoneLight, x, 1.03 + h / 2, 0)
      F.box(0.56, 0.04, 0.48, P.gold, x, 1.03 + h + 0.02, 0)
    }
    // glass case: four panes + a lid, slim dark frame posts
    F.put(new THREE.PlaneGeometry(2.6, 1.3), glass, 0, 1.68, 0.45, 0, 0, 0, false)
    F.put(new THREE.PlaneGeometry(2.6, 1.3), glass, 0, 1.68, -0.45, 0, Math.PI, 0, false)
    for (const s of [-1, 1]) F.put(new THREE.PlaneGeometry(0.9, 1.3), glass, s * 1.3, 1.68, 0, 0, s * (Math.PI / 2), 0, false)
    F.box(2.7, 0.08, 1.0, P.iron, 0, 2.37, 0)
    for (const x of [-1.3, 1.3]) for (const z of [-0.45, 0.45]) F.box(0.05, 1.32, 0.05, P.iron, x, 1.68, z)
    // the crown on top + the engraved plaque on the plinth face
    const crown = new THREE.Shape([[-1, 0], [1, 0], [1.08, 1.0], [0.62, 0.62], [0.32, 1.25], [0, 0.72], [-0.32, 1.25], [-0.62, 0.62], [-1.08, 1.0]].map(([a, b]) => new THREE.Vector2(a * 0.3, b * 0.3)))
    F.put(new THREE.ExtrudeGeometry(crown, { depth: 0.08, bevelEnabled: false }), P.gold, 0, 2.42, -0.04)
    const pl = new THREE.MeshStandardMaterial({
      map: boardTexture('COMMUNITY CHAMPIONS', ['Reserved for future competition winners.', 'No champions crowned yet —', 'this space is waiting for the first.'], 2.4, { bg: '#7a5a2a', ink: '#ffe9b8', sub: '#f6e2b4', rule: '#e0b860' }, Dp, true),
      metalness: 0.7,
      roughness: 0.4,
    })
    Dp.push(pl)
    plaque(F.sub(0, 0.5, 0.56), 1.6, 0.66, pl, SM)
    T.colliders.push({ kind: 'circle', x: CHAMPIONS.x, z: CHAMPIONS.z, r: 1.55, h: 2.5 })
  }
}
