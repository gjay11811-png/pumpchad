import * as THREE from 'three'
import { placer, ROT, type Facing, type Town } from './buildings'
import { boxUV } from './kit'
import { shopSign } from './textures'

/**
 * Market Row stalls (v4). One sturdy timber build — square posts with knee braces, front/back beams, a planked
 * counter with an overhanging top, a cloth awning with real folds and sag, a scalloped valance, rope ties, a
 * hanging name sign and an iron lantern — dressed four different ways so no two stalls look alike.
 * All static parts go into the town batch (merged by material).
 */
export type StallKind = 'produce' | 'apothecary' | 'guide' | 'wardrobe'

const SIGNS: Record<StallKind, [string, string]> = {
  produce: ['GOURD & GO', 'fresh pumpkins · daily'],
  apothecary: ['MARROWPOT', 'potions · tonics · gains'],
  guide: ['VILLAGE GUIDE', 'maps · directions · lore'],
  wardrobe: ['WARDROBE', 'new fits · coming soon'],
}

/** awning cloth: subdivided plane, folds across the width, sagging toward the front edge */
function awningCloth(w: number, d: number, folds: number) {
  const g = new THREE.PlaneGeometry(w, d, 24, 8)
  const pos = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i) // across the depth (−d/2 back … +d/2 front)
    const t = (d / 2 - y) / d // 0 at the (high) back edge → 1 at the (low) front edge, after the tilt below
    const fold = Math.sin((x / w) * Math.PI * folds) * 0.035 * (0.4 + t)
    const sag = -Math.sin(t * Math.PI) * 0.09
    pos.setZ(i, fold + sag)
  }
  g.computeVertexNormals()
  return g
}

/** scalloped valance strip (hangs from the awning's front edge) */
function valance(w: number, h: number, scallops: number) {
  const s = new THREE.Shape()
  s.moveTo(-w / 2, 0)
  s.lineTo(w / 2, 0)
  s.lineTo(w / 2, -h * 0.55)
  const sw = w / scallops
  for (let i = scallops - 1; i >= 0; i--) {
    const x0 = -w / 2 + (i + 1) * sw
    const x1 = -w / 2 + i * sw
    s.quadraticCurveTo((x0 + x1) / 2, -h * 1.25, x1, -h * 0.55)
  }
  s.closePath()
  const g = new THREE.ShapeGeometry(s, 4)
  const uv = g.attributes.uv as THREE.BufferAttribute
  const pos = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, 1 + pos.getY(i) / h)
  return g
}

export function stallV4(T: Town, x: number, z: number, face: Facing, stripe: THREE.Material, kind: StallKind) {
  const P = T.P
  const L = placer(T, x, z, face)
  const W = 3.2
  const DEP = 1.5
  const H = 2.55
  // ── frame: four square posts, knee braces, beams ──
  const post = boxUV(0.12, H, 0.12, 0.8)
  for (const lx of [-W / 2, W / 2])
    for (const lz of [-DEP / 2, DEP / 2]) L.put(post, P.timber, lx, H / 2, lz)
  for (const lz of [-DEP / 2, DEP / 2]) L.put(boxUV(W + 0.3, 0.14, 0.12, 0.8), P.timber, 0, H - 0.05, lz)
  for (const lx of [-W / 2, W / 2]) L.put(boxUV(0.1, 0.12, DEP + 0.2, 0.8), P.timber, lx, H - 0.18, 0)
  const brace = boxUV(0.07, 0.62, 0.07, 0.5)
  for (const lx of [-W / 2, W / 2])
    for (const lz of [-DEP / 2, DEP / 2]) {
      const g = brace.clone()
      g.rotateZ(Math.sign(-lx) * 0.75)
      L.put(g, P.timber, lx + Math.sign(-lx) * 0.2, H - 0.42, lz)
    }
  // ── counter: planked front, overhanging top, a step of shadow underneath ──
  L.put(boxUV(W - 0.1, 0.92, 0.12, 0.8), P.woodLight, 0, 0.46, DEP / 2 - 0.1)
  for (let i = 0; i < 7; i++) L.put(new THREE.BoxGeometry(0.02, 0.9, 0.02), P.timber, -W / 2 + 0.3 + i * ((W - 0.6) / 6), 0.46, DEP / 2 - 0.03, 0, 1, 1, 1, false) // plank seams
  L.put(boxUV(W + 0.1, 0.07, 0.62, 0.8), P.timber, 0, 0.95, DEP / 2 - 0.2)
  for (const lx of [-W / 2 + 0.06, W / 2 - 0.06]) L.put(boxUV(0.08, 0.92, 0.55, 0.8), P.woodLight, lx, 0.46, DEP / 2 - 0.35)
  // ── awning (sloping down to the front), scalloped valance, rope ties ──
  const cloth = awningCloth(W + 0.6, DEP + 0.7, kind === 'apothecary' ? 5 : 4)
  cloth.rotateX(-Math.PI / 2 + 0.32)
  L.put(cloth, stripe, 0, H + 0.24, 0.05, 0, 1, 1, 1)
  L.put(valance(W + 0.6, 0.32, 8), stripe, 0, H - 0.02, DEP / 2 + 0.41, 0, 1, 1, 1, false)
  const rope = new THREE.CylinderGeometry(0.012, 0.012, 1.0, 4)
  for (const lx of [-W / 2 - 0.25, W / 2 + 0.25]) {
    const g = rope.clone().rotateX(0.62)
    L.put(g, P.woodRotten, lx, H - 0.2, DEP / 2 + 0.55, 0, 1, 1, 1, false)
    L.put(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 6), P.woodRotten, lx, H - 0.6, DEP / 2 + 0.83, 0, 1, 1, 1, false) // ground peg
  }
  // ── hanging name sign under the front beam + an iron lantern ──
  const [title, sub] = SIGNS[kind]
  const signTex = shopSign(title, sub)
  const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.7, emissive: '#ffffff', emissiveMap: signTex, emissiveIntensity: 0.18 })
  T.disposables.push(signTex, signMat)
  L.put(new THREE.PlaneGeometry(1.25, 0.62), signMat, 0, H - 0.5, DEP / 2 + 0.07, 0, 1, 1, 1, false)
  for (const lx of [-0.5, 0.5]) L.put(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 3), P.iron, lx, H - 0.08, DEP / 2 + 0.07, 0, 1, 1, 1, false)
  L.put(new THREE.BoxGeometry(0.18, 0.24, 0.18), P.iron, W / 2 - 0.25, H - 0.35, DEP / 2 + 0.12)
  L.put(new THREE.BoxGeometry(0.12, 0.17, 0.12), P.glowGold, W / 2 - 0.25, H - 0.35, DEP / 2 + 0.12, 0, 1, 1, 1, false)
  L.put(new THREE.ConeGeometry(0.15, 0.12, 4), P.iron, W / 2 - 0.25, H - 0.17, DEP / 2 + 0.12, Math.PI / 4)

  // ── dressing per kind ──
  const crate = boxUV(0.55, 0.42, 0.42, 0.6)
  if (kind === 'produce') {
    // angled display crates on the counter, baskets on the ground
    for (const lx of [-0.9, 0, 0.9]) {
      const g = crate.clone().rotateX(-0.25)
      L.put(g, P.woodLight, lx, 1.12, DEP / 2 - 0.25, 0, 1.4, 0.5, 1)
    }
    if (T.pumpkins)
      for (let i = 0; i < 9; i++) {
        const [px, pz] = L.world(-1.15 + i * 0.29, DEP / 2 - 0.22 + (i % 2) * 0.1)
        T.pumpkins.add(px, 1.17 + (i % 2) * 0.04, pz, { r: 0.1 + (i % 3) * 0.025, tint: i % 4 === 1 ? 'pale' : i % 5 === 2 ? 'green' : 'orange', face: i === 4 ? 0 : undefined, facing: ROT[face] })
      }
    const basket = new THREE.CylinderGeometry(0.28, 0.22, 0.32, 12, 1, true)
    for (const [lx, lz] of [[-W / 2 - 0.5, DEP / 2], [W / 2 + 0.45, DEP / 2 - 0.3]] as const) {
      L.put(basket, P.woodLight, lx, 0.16, lz)
      if (T.pumpkins) {
        const [px, pz] = L.world(lx, lz)
        T.pumpkins.cluster(px, pz, 0.15, 0.16, 0.2)
      }
    }
  } else if (kind === 'apothecary') {
    // back shelves of glowing bottles + a little cauldron
    for (const y of [1.25, 1.75]) L.put(boxUV(W - 0.3, 0.05, 0.3, 0.8), P.timber, 0, y, -DEP / 2 + 0.2)
    const bottle = new THREE.CylinderGeometry(0.05, 0.07, 0.24, 8)
    const neck = new THREE.CylinderGeometry(0.02, 0.025, 0.08, 6)
    const mats = [P.glowTeal, P.glowPurple, P.glowOrange, P.glowGold]
    for (let s = 0; s < 2; s++)
      for (let i = 0; i < 9; i++) {
        const lx = -1.3 + i * 0.32
        const y = (s ? 1.75 : 1.25) + 0.15
        L.put(bottle, mats[(i + s) % 4], lx, y, -DEP / 2 + 0.2, 0, 1, 0.8 + ((i * 7) % 5) * 0.1, 1, false)
        L.put(neck, P.iron, lx, y + 0.17, -DEP / 2 + 0.2, 0, 1, 1, 1, false)
      }
    for (let i = 0; i < 5; i++) L.put(bottle, mats[i % 4], -0.9 + i * 0.42, 1.1, DEP / 2 - 0.25, 0, 1.2, 1, 1.2, false)
    L.put(new THREE.SphereGeometry(0.32, 14, 10, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65), P.iron, W / 2 + 0.55, 0.36, 0.2)
    L.put(new THREE.CircleGeometry(0.26, 14).rotateX(-Math.PI / 2), P.glowTeal, W / 2 + 0.55, 0.5, 0.2, 0, 1, 1, 1, false)
    T.embers.push({ x: L.world(W / 2 + 0.55, 0.2)[0], y: 0.6, z: L.world(W / 2 + 0.55, 0.2)[1] })
  } else if (kind === 'guide') {
    // back panel with a hand-drawn map of the kingdom; a rack of rolled maps on the counter
    const mapTex = kingdomMapTexture()
    const mapMat = new THREE.MeshStandardMaterial({ map: mapTex, roughness: 0.85, emissive: '#ffffff', emissiveMap: mapTex, emissiveIntensity: 0.12 })
    T.disposables.push(mapTex, mapMat)
    L.put(boxUV(W - 0.2, 1.3, 0.06, 0.8), P.timber, 0, 1.6, -DEP / 2 + 0.05)
    L.put(new THREE.PlaneGeometry(W - 0.4, 1.15), mapMat, 0, 1.6, -DEP / 2 + 0.09, 0, 1, 1, 1, false)
    const scroll = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8).rotateZ(Math.PI / 2)
    for (let i = 0; i < 5; i++) L.put(scroll, P.plaster, -0.8 + (i % 3) * 0.08, 1.03 + Math.floor(i / 3) * 0.08, DEP / 2 - 0.25 + (i % 2) * 0.06, 0.2 * i, 1, 1, 1, false)
    L.put(crate, P.woodLight, W / 2 + 0.5, 0.21, 0.1, 0.3)
    L.put(crate, P.woodLight, W / 2 + 0.55, 0.63, 0.15, 0.1)
  } else {
    // wardrobe preview: a dressed mannequin + bolts of cloth (purchases are NOT implemented — the sign says so)
    const mq = new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.2, 0.02), new THREE.Vector2(0.26, 0.25), new THREE.Vector2(0.18, 0.45), new THREE.Vector2(0.24, 0.62), new THREE.Vector2(0.1, 0.72), new THREE.Vector2(0, 0.74)], 16)
    L.put(mq, P.roofSlate, -W / 2 + 0.6, 1.0, -DEP / 2 + 0.35)
    L.put(new THREE.CylinderGeometry(0.02, 0.02, 1.0, 6), P.iron, -W / 2 + 0.6, 0.5, -DEP / 2 + 0.35)
    L.put(new THREE.CylinderGeometry(0.18, 0.2, 0.04, 12), P.iron, -W / 2 + 0.6, 0.02, -DEP / 2 + 0.35)
    L.put(new THREE.TorusGeometry(0.16, 0.03, 6, 16).rotateX(Math.PI / 2), P.gold, -W / 2 + 0.6, 1.66, -DEP / 2 + 0.35) // gold chain on the dummy
    const bolt = new THREE.CylinderGeometry(0.09, 0.09, 0.62, 10).rotateZ(Math.PI / 2)
    const cloths = [P.roofRed, P.roofSlate, P.roofOrange, stripe, P.woodLight] // stripe: reuses the awning program (P.cloth would compile its own double-sided variant)
    for (let i = 0; i < 5; i++) L.put(bolt, cloths[i], 0.0 + (i % 3) * 0.2 - 0.1, 1.06 + Math.floor(i / 3) * 0.17, DEP / 2 - 0.25 + (i % 2) * 0.1, 0.1 * i, 1, 1, 1, false)
    L.put(boxUV(0.9, 0.5, 0.06, 0.6), P.timber, 0.9, 1.75, -DEP / 2 + 0.08) // mirror frame
    L.put(new THREE.PlaneGeometry(0.78, 0.38), P.windowDark, 0.9, 1.75, -DEP / 2 + 0.12, 0, 1, 1, 1, false)
  }

  // collision: the counter + posts (customers stand in front)
  const r = ROT[face]
  const [cx, cz] = L.world(0, 0)
  const hw = Math.abs(Math.cos(r)) > 0.5 ? W / 2 + 0.1 : DEP / 2 + 0.05
  const hd = Math.abs(Math.cos(r)) > 0.5 ? DEP / 2 + 0.05 : W / 2 + 0.1
  T.colliders.push({ kind: 'box', minX: cx - hw, maxX: cx + hw, minZ: cz - hd, maxZ: cz + hd, h: 1 })
}

/** a hand-drawn parchment map of Chad Kingdom for the guide's stall */
function kingdomMapTexture() {
  const c = document.createElement('canvas')
  c.width = 768
  c.height = 320
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(384, 160, 40, 384, 160, 420)
  grd.addColorStop(0, '#e9d9b4')
  grd.addColorStop(1, '#b8996a')
  g.fillStyle = grd
  g.fillRect(0, 0, 768, 320)
  g.strokeStyle = '#5a3a1a'
  g.lineWidth = 3
  g.strokeRect(10, 10, 748, 300)
  // town circle, roads, labels
  const cx = 384
  const cy = 165
  g.strokeStyle = '#6b4a24'
  g.lineWidth = 4
  g.beginPath()
  g.arc(cx, cy, 120, 0, Math.PI * 2)
  g.stroke()
  g.lineWidth = 10
  g.strokeStyle = 'rgba(110,80,40,0.55)'
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    g.beginPath()
    g.moveTo(cx + dx * 24, cy + dy * 24)
    g.lineTo(cx + dx * 118, cy + dy * 118)
    g.stroke()
  }
  g.fillStyle = '#3a6a8a'
  g.beginPath()
  g.arc(cx, cy, 20, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#2a1a0a'
  g.textAlign = 'center'
  g.font = 'bold 22px Georgia, serif'
  g.fillText('CHAD KINGDOM', cx, 34)
  g.font = '16px Georgia, serif'
  const label = (t: string, x: number, y: number) => g.fillText(t, x, y)
  label('Castle', cx, cy - 128)
  label('Lookout ▸ Chad City', cx, cy + 142)
  label('Market Row', cx - 190, cy + 4)
  label('Chad Gym', cx + 170, cy + 4)
  label('Fountain', cx, cy + 44)
  label('★ you are here', cx - 120, cy + 60)
  g.font = 'italic 14px Georgia, serif'
  label('Chad City (coming soon) →', 640, 290)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}
