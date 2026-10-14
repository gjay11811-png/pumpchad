import { useState } from 'react'
import { CATALOG, type Item } from '../economy'
import type { SaveData } from '../save'
import { Btn } from './kit'
import { Header, Overlay, useEsc } from './Menus'

/**
 * A shop counter: browse the catalogue, buy with Chad Coins (in-game only), put a bought colour on.
 * Buying never goes below zero coins; an item you own can't be bought twice.
 */
export function ShopPanel({
  shop,
  title,
  keeper,
  save,
  onBuy,
  onWear,
  onBack,
}: {
  shop: Item['shop']
  title: string
  keeper: string
  save: SaveData
  onBuy: (id: string) => boolean
  onWear: (id: string) => void
  onBack: () => void
}) {
  useEsc(onBack)
  const [msg, setMsg] = useState(`${keeper}: “Have a look — everything here is paid in Chad Coins, never real money.”`)
  const p = save.progress
  const a = save.character?.appearance
  const items = CATALOG.filter((i) => i.shop === shop)
  return (
    <Overlay label={title}>
      <Header title={title} onBack={onBack} />
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="min-w-0 flex-1 text-[13px] leading-snug text-bone/80" data-testid="shop-msg">
          {msg}
        </p>
        <span className="shrink-0 rounded-full bg-[#ffd25a]/15 px-3 py-1.5 font-mono text-[12px] font-semibold text-[#ffd25a] ring-1 ring-[#ffd25a]/40" data-testid="shop-coins">
          ◉ {p.coins}
        </span>
      </div>
      <ul className="mt-3 grid max-h-[52vh] gap-2 overflow-y-auto overscroll-contain pr-1" data-testid="shop-items">
        {items.map((it) => {
          const owned = p.owned.includes(it.id)
          const wearing = owned && (it.kind === 'outfit' ? a?.outfit : a?.glow) === it.color
          return (
            <li key={it.id} className="flex items-center gap-3 rounded-2xl bg-bone/[0.04] p-2.5 ring-1 ring-bone/10" data-item={it.id}>
              <span
                className="h-10 w-10 shrink-0 rounded-xl ring-1 ring-bone/20"
                style={{ background: it.color, boxShadow: it.kind === 'glow' ? `0 0 14px ${it.color}` : undefined }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold">{it.name}</p>
                <p className="truncate font-mono text-[10px] uppercase tracking-[0.15em] text-ash">{it.desc}</p>
              </div>
              {!owned ? (
                <Btn
                  size="sm"
                  sound={null}
                  className={p.coins < it.price ? 'opacity-60' : ''}
                  onClick={() => {
                    if (onBuy(it.id)) setMsg(`${keeper}: “${it.name} — it’s yours. Put it on whenever you like.”`)
                    else setMsg(`${keeper}: “That one’s ${it.price} coins — you have ${p.coins}. Earn more by exploring, training and playing.”`)
                  }}
                >
                  ◉ {it.price}
                </Btn>
              ) : wearing ? (
                <span className="px-3 font-mono text-[11px] uppercase tracking-[0.15em] text-[#ffd25a]">Wearing</span>
              ) : (
                <Btn
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    onWear(it.id)
                    setMsg(`${keeper}: “${it.name} suits you.”`)
                  }}
                >
                  Wear
                </Btn>
              )}
            </li>
          )
        })}
      </ul>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.15em] text-ash">Owned colours also appear in Edit Character</p>
    </Overlay>
  )
}
