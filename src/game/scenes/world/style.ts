import * as THREE from 'three'

/**
 * Chad Kingdom architecture style. The community vote will pick between a Dark Gothic Castle and a
 * Grand Medieval Fantasy Kingdom, so every castle / wall / tower piece reads its look from here.
 * `balanced` (dark-fantasy, current Halloween identity) is the default until the vote is in.
 * Preview: /chadverse/?castle=gothic | ?castle=fantasy
 */
export type KingdomStyleId = 'balanced' | 'gothic' | 'fantasy'
export type KingdomStyle = {
  id: KingdomStyleId
  stone: string
  stoneTrim: string
  roof: string
  /** spire height multiplier (gothic needles are tall, fantasy cones are friendlier) */
  spire: number
  /** gold finials on spire tips */
  finials: boolean
  banner: [string, string]
  windowGlow: string
}

export const KINGDOM_STYLES: Record<KingdomStyleId, KingdomStyle> = {
  // CHAD CITADEL: warm maintained sandstone, pale dressed trims, dark slate-blue metal roofs, gold finials
  balanced: { id: 'balanced', stone: '#d4c3a6', stoneTrim: '#efe3cb', roof: '#3a4558', spire: 1.45, finials: true, banner: ['#ff7a1a', '#141216'], windowGlow: '#ffb057' },
  gothic: { id: 'gothic', stone: '#8f8794', stoneTrim: '#b3abb6', roof: '#262230', spire: 2.15, finials: false, banner: ['#8a1424', '#0b0a0d'], windowGlow: '#ff8a4a' },
  fantasy: { id: 'fantasy', stone: '#d4ccc0', stoneTrim: '#eee6da', roof: '#2a4f93', spire: 1.2, finials: true, banner: ['#1f4ea8', '#f2c14e'], windowGlow: '#ffd27a' },
}

export function kingdomStyle(): KingdomStyle {
  const q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('castle') : null
  return KINGDOM_STYLES[(q as KingdomStyleId) in KINGDOM_STYLES ? (q as KingdomStyleId) : 'balanced']
}

/** Materials shared by every kingdom piece for the active style (added to the town's disposables). */
export function styleMaterials(style: KingdomStyle, tex: { stone?: THREE.Texture; roof?: THREE.Texture }, D: (THREE.Material | THREE.Texture | THREE.BufferGeometry)[]) {
  const std = (p: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.88, metalness: 0.02, ...p })
    D.push(m)
    return m
  }
  return {
    stone: std({ map: tex.stone, color: style.stone }),
    trim: std({ map: tex.stone, color: style.stoneTrim, roughness: 0.82 }),
    roof: std({ map: tex.roof, color: style.roof, roughness: 0.7 }),
    finial: std({ color: '#e0a83e', metalness: 1, roughness: 0.3 }),
    // the keep is a landmark seen through the fog from all over town: a dark, fog-free silhouette
    // the keep: same stone in daylight, slightly cooler so it sits back a little behind the gatehouse
    farStone: std({ map: tex.stone, color: new THREE.Color(style.stone).multiplyScalar(0.92), roughness: 0.92 }),
    farRoof: std({ map: tex.roof, color: new THREE.Color(style.roof), roughness: 0.75 }),
    // keep windows read from across town through the fog: unlit, ignores scene fog, a little dimmer to compensate
    farWindow: (() => {
      const m = new THREE.MeshStandardMaterial({ color: '#253348', roughness: 0.12, metalness: 0.6, emissive: '#0c1422' })
      D.push(m)
      return m
    })(),
  }
}
