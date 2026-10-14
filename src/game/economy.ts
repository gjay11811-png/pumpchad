/**
 * Chad Coins — the in-game currency (never real money, never the PumpChad token).
 * One simple, readable rule: every 2 XP you earn also pays 1 Chad Coin. XP rewards are already once-only
 * (discoveries, achievements, records), so coins can't be farmed or double-claimed; spending never goes below 0.
 *
 * The catalogue: things a shop actually sells. Only items whose feature exists are listed — premium colours for
 * the wardrobe today; companions and cars join when following / driving are implemented.
 */
export const XP_PER_COIN = 2
export const coinsForXp = (xp: number) => Math.floor(Math.max(0, xp) / XP_PER_COIN)

export type ItemKind = 'outfit' | 'glow'
export type Item = { id: string; shop: 'fits'; kind: ItemKind; name: string; desc: string; price: number; color: string }

export const CATALOG: Item[] = [
  { id: 'fit_pumpkinspice', shop: 'fits', kind: 'outfit', name: 'Pumpkin Spice', desc: 'Burnt-orange outfit colour', price: 40, color: '#c2540c' },
  { id: 'fit_violet', shop: 'fits', kind: 'outfit', name: 'Haunted Violet', desc: 'Deep purple outfit colour', price: 60, color: '#6a2ab8' },
  { id: 'fit_silver', shop: 'fits', kind: 'outfit', name: 'Moonlight Silver', desc: 'Pale silver outfit colour', price: 60, color: '#c8ccd8' },
  { id: 'fit_gold', shop: 'fits', kind: 'outfit', name: 'Gold Lamé', desc: 'Shiny gold outfit colour', price: 120, color: '#e0a83e' },
  { id: 'glow_teal', shop: 'fits', kind: 'glow', name: 'Ghostfire Teal', desc: 'Glow colour for eyes + visor', price: 50, color: '#5fe0d0' },
  { id: 'glow_gold', shop: 'fits', kind: 'glow', name: 'Royal Gold', desc: 'Glow colour for eyes + visor', price: 80, color: '#ffd25a' },
]
export const ITEM = (id: string) => CATALOG.find((i) => i.id === id)
export const PREMIUM_OUTFITS = CATALOG.filter((i) => i.kind === 'outfit').map((i) => i.color)
export const PREMIUM_GLOWS = CATALOG.filter((i) => i.kind === 'glow').map((i) => i.color)
/** the catalogue item that unlocks a colour (null = a free colour) */
export const itemForColor = (kind: ItemKind, color: string) => CATALOG.find((i) => i.kind === kind && i.color === color) ?? null
