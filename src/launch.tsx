import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { launch, site } from './config'

export const LAUNCH_AT = Date.parse(launch.target)

/**
 * Launch clock + trading status.
 *  - The clock is corrected with the server's Date header, so a wrong device clock does not shift the countdown.
 *  - It never goes negative: at 0 it stops and switches to a status view.
 *  - After the scheduled time we do NOT assume trading is live: we ask Raydium's public API whether the
 *    PCHAD/USDC pool exists and is open, and show exactly what it says.
 */
export type TradingState = 'before' | 'checking' | 'open' | 'scheduled' | 'unconfirmed'

type Ctx = {
  msLeft: number
  reached: boolean
  trading: TradingState
  poolOpensAt: number | null
  recheck: () => void
}

const LaunchCtx = createContext<Ctx | null>(null)

const POOL_API = `https://api-v3.raydium.io/pools/info/mint?mint1=${site.contractAddress}&mint2=${site.usdcMint}&poolType=all&poolSortField=default&sortType=desc&pageSize=10&page=1`

type PoolResult = { found: boolean; opensAt: number | null }

async function lookupPool(signal: AbortSignal): Promise<PoolResult> {
  const r = await fetch(POOL_API, { signal, cache: 'no-store' })
  if (!r.ok) throw new Error(`raydium ${r.status}`)
  const j = await r.json()
  const pools: { mintA?: { address?: string }; mintB?: { address?: string }; openTime?: string | number }[] = j?.data?.data ?? []
  const p = pools.find((x) => [x.mintA?.address, x.mintB?.address].includes(site.contractAddress) && [x.mintA?.address, x.mintB?.address].includes(site.usdcMint))
  if (!p) return { found: false, opensAt: null }
  const t = Number(p.openTime)
  return { found: true, opensAt: Number.isFinite(t) && t > 0 ? t * 1000 : 0 }
}

export function LaunchProvider({ children }: { children: ReactNode }) {
  const [offset, setOffset] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [pool, setPool] = useState<PoolResult | 'loading' | 'error' | null>(null)
  const [tries, setTries] = useState(0)

  // correct for a wrong device clock using the server's Date header
  useEffect(() => {
    const c = new AbortController()
    fetch(import.meta.env.BASE_URL, { method: 'HEAD', cache: 'no-store', signal: c.signal })
      .then((r) => {
        const t = Date.parse(r.headers.get('date') ?? '')
        if (!Number.isNaN(t)) setOffset(t - Date.now())
      })
      .catch(() => {})
    return () => c.abort()
  }, [])

  const t = now + offset
  const reached = t >= LAUNCH_AT

  // tick once a second until the launch time, then stop
  useEffect(() => {
    if (reached) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [reached])

  // after launch time: ask Raydium (and keep asking every 30 s until the pool is confirmed open)
  const opensAt = pool && pool !== 'loading' && pool !== 'error' && pool.found ? pool.opensAt : null
  const open = opensAt !== null && opensAt <= t
  useEffect(() => {
    if (!reached) return
    const c = new AbortController()
    setPool((p) => (p && p !== 'loading' && p !== 'error' ? p : 'loading'))
    lookupPool(c.signal).then(setPool).catch(() => !c.signal.aborted && setPool('error'))
    return () => c.abort()
  }, [reached, tries])
  useEffect(() => {
    if (!reached || open) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    const poll = setInterval(() => setTries((n) => n + 1), 30000)
    return () => {
      clearInterval(id)
      clearInterval(poll)
    }
  }, [reached, open])

  const trading: TradingState = !reached
    ? 'before'
    : pool === null || pool === 'loading'
      ? 'checking'
      : pool === 'error'
        ? 'unconfirmed'
        : !pool.found
          ? 'unconfirmed'
          : open
            ? 'open'
            : 'scheduled'

  const value = useMemo<Ctx>(
    () => ({ msLeft: Math.max(0, LAUNCH_AT - t), reached, trading, poolOpensAt: opensAt, recheck: () => setTries((n) => n + 1) }),
    [t, reached, trading, opensAt],
  )
  return <LaunchCtx.Provider value={value}>{children}</LaunchCtx.Provider>
}

export function useLaunch(): Ctx {
  const c = useContext(LaunchCtx)
  if (!c) throw new Error('useLaunch outside LaunchProvider')
  return c
}

export const countdownParts = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 }
}

/** Plain-English trading status, used by the launch panel, hero badge, FAQ board and How-to-buy. */
export const tradingCopy = (s: TradingState, opensAt: number | null) => {
  const when = opensAt ? new Date(opensAt).toISOString().slice(11, 16) + ' UTC' : ''
  switch (s) {
    case 'before':
      return { short: 'Opens at launch', long: 'Trading is not open yet. It is scheduled to open at launch time.', tone: 'soon' as const }
    case 'checking':
      return { short: 'Checking Raydium…', long: 'Launch time reached. Checking Raydium for the pool status…', tone: 'soon' as const }
    case 'open':
      return { short: 'Pool open on Raydium', long: 'Raydium reports the PCHAD/USDC pool as open. Verify the contract before you trade.', tone: 'live' as const }
    case 'scheduled':
      return { short: `Opens ${when}`, long: `Raydium lists the PCHAD/USDC pool but shows it opening at ${when}. Trading is not confirmed open yet.`, tone: 'soon' as const }
    default:
      return { short: 'Not confirmed', long: 'Launch time reached, but trading status could not be confirmed. Check Raydium directly before you trade.', tone: 'not-live' as const }
  }
}
