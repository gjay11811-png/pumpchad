/** Character appearance model + the options the creator offers. */

export type Species = 'pumpkin' | 'skeleton' | 'demon'
export type Top = 'shirtless' | 'hoodie' | 'armor'
export type Headwear = 'none' | 'crown' | 'cap' | 'horns'
export type Eyewear = 'shades' | 'visor' | 'none'

export type Appearance = {
  species: Species
  skin: string
  outfit: string
  glow: string
  top: Top
  headwear: Headwear
  eyewear: Eyewear
  chain: boolean
}

export const SPECIES: { id: Species; name: string; tagline: string; skins: string[] }[] = [
  {
    id: 'pumpkin',
    name: 'Pumpkin',
    tagline: 'The original. Carved confidence, glowing grin.',
    skins: ['#e8741c', '#f08a2a', '#c9581a', '#e0a23a', '#9fb84a'],
  },
  {
    id: 'skeleton',
    name: 'Skeleton',
    tagline: 'All bone, no fear. Paper hands are physically impossible.',
    skins: ['#e9e2d0', '#d4c9ad', '#b9b2a4', '#cfd6dc', '#2b2a2e'],
  },
  {
    id: 'demon',
    name: 'Demon',
    tagline: 'Horns, heat and zero chill. Born in the red candle.',
    skins: ['#b3261e', '#7e1a1a', '#5b2a86', '#2f2f3a', '#1f6b5a'],
  },
]

export const OUTFITS = ['#141216', '#2a262c', '#ff7a1a', '#c89b3c', '#4b2a7a', '#e9e4da']
export const GLOWS = ['#ffb347', '#19f19a', '#9b5cff', '#ff4d3d', '#7fd6ff']
export const TOPS: { id: Top; name: string }[] = [
  { id: 'shirtless', name: 'Shirtless' },
  { id: 'hoodie', name: 'Hoodie' },
  { id: 'armor', name: 'Future armour' },
]
export const HEADWEAR: { id: Headwear; name: string }[] = [
  { id: 'none', name: 'None' },
  { id: 'crown', name: 'Crown' },
  { id: 'cap', name: 'Cap' },
  { id: 'horns', name: 'Horns' },
]
export const EYEWEAR: { id: Eyewear; name: string }[] = [
  { id: 'shades', name: 'Shades' },
  { id: 'visor', name: 'Visor' },
  { id: 'none', name: 'None' },
]

export const defaultAppearance = (species: Species = 'pumpkin'): Appearance => {
  const base: Record<Species, Partial<Appearance>> = {
    pumpkin: { top: 'shirtless', headwear: 'none', eyewear: 'shades', chain: true, outfit: '#141216', glow: '#ffb347' },
    skeleton: { top: 'armor', headwear: 'none', eyewear: 'visor', chain: false, outfit: '#2a262c', glow: '#7fd6ff' },
    demon: { top: 'hoodie', headwear: 'horns', eyewear: 'none', chain: true, outfit: '#141216', glow: '#ff4d3d' },
  }
  return {
    species,
    skin: SPECIES.find((s) => s.id === species)!.skins[0],
    outfit: '#141216',
    glow: '#ffb347',
    top: 'shirtless',
    headwear: 'none',
    eyewear: 'shades',
    chain: true,
    ...base[species],
  }
}

export const randomAppearance = (): Appearance => {
  const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]
  const sp = pick(SPECIES)
  return {
    species: sp.id,
    skin: pick(sp.skins),
    outfit: pick(OUTFITS),
    glow: pick(GLOWS),
    top: pick(TOPS).id,
    headwear: pick(HEADWEAR).id,
    eyewear: pick(EYEWEAR).id,
    chain: Math.random() > 0.35,
  }
}
