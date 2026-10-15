import * as THREE from 'three'

/**
 * Real-scan texture detail for the procedural trees: the leaf and bark maps are greyscale crops of Poly Haven's Jacaranda Tree textures
 * (CC0, Rico Cilliers — see ASSETS.md) so they carry real leaflet / fissure detail while the vertex colours still set the species palette.
 * The canvas-painted maps stay as the fallback: the scan image is swapped into the same texture object when it has loaded (or never, if
 * it cannot load).
 */
const base = () => import.meta.env.BASE_URL

export function swapInScan(tex: THREE.Texture, file: string) {
  if (typeof Image === 'undefined') return
  const img = new Image()
  img.decoding = 'async'
  img.onload = () => {
    tex.image = img
    tex.needsUpdate = true
  }
  img.src = `${base()}chadverse/textures/veg/${file}`
}
