import * as THREE from 'three'

/**
 * REAL GROUND MATERIALS (Poly Haven, CC0 — see ASSETS.md): stone setts for the historic streets, small-sett paving for lanes and paths, asphalt for vehicle routes.
 * 1K WebP (diffuse + GL normal + roughness each, about 0.5 MB per set on disk; ~4 MB of GPU memory per set with mipmaps). UVs everywhere in the town are
 * "distance / 3 m per repeat", so `repeat` rescales each set so one repeat covers the set's real-world size:  setts 2.5 m · paving 3.45 m · asphalt 3.0 m.
 */
export type Surface = { map: THREE.Texture; normal: THREE.Texture; rough: THREE.Texture }
export type Surfaces = Record<'setts' | 'paving' | 'asphalt' | 'plaster' | 'slate' | 'clay' | 'timber', Surface>

/** [Poly Haven id, metres one repeat covers in the real world, metres per UV repeat the town's geometry uses (boxUV / gableGeo tile arguments, averaged)] */
const REAL: Record<keyof Surfaces, [string, number, number]> = {
  setts: ['cobblestone_pavement', 2.5, 3],
  paving: ['pavement_05', 3.45, 3],
  asphalt: ['asphalt_02', 3.0, 3],
  plaster: ['beige_wall_001', 3.0, 2.2],
  slate: ['roof_slates_02', 3.0, 2],
  clay: ['clay_roof_tiles_03', 2.6, 2],
  timber: ['dark_wood', 2.0, 1.5],
}

export function loadSurfaces(D: (THREE.Texture | THREE.Material | THREE.BufferGeometry)[], aniso = 8): Surfaces {
  const loader = new THREE.TextureLoader()
  const base = `${import.meta.env.BASE_URL}chadverse/district/tex/`
  const out = {} as Surfaces
  for (const [k, [id, metres, tile]] of Object.entries(REAL) as [keyof Surfaces, [string, number, number]][]) {
    const t = (suffix: string, srgb: boolean) => {
      const x = loader.load(`${base}${id}_${suffix}.webp`)
      x.wrapS = x.wrapT = THREE.RepeatWrapping
      x.anisotropy = aniso
      x.repeat.set(tile / metres, tile / metres)
      if (srgb) x.colorSpace = THREE.SRGBColorSpace
      D.push(x)
      return x
    }
    out[k] = { map: t('diff', true), normal: t('nor', false), rough: t('rough', false) }
  }
  return out
}
