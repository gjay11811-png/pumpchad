/**
 * ─────────────────────────────────────────────────────────────
 *  PUMPCHAD — SITE CONFIG
 *  Every launch detail lives here. Update this file, rebuild, done.
 *  Rule: never put anything here that hasn't actually happened.
 * ─────────────────────────────────────────────────────────────
 */

/** Prefixes public files with the deploy base path (e.g. /pumpchad/ on GitHub Pages). */
const asset = (p: string) => import.meta.env.BASE_URL + p.replace(/^\//, '')

export type LaunchState = 'live' | 'soon' | 'not-live'

const MINT = 'BGu6efXwXkdMdRg8U3zfEnPkGmJAGkARSMgoo2r4XyQo'
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

export const site = {
  projectName: 'PumpChad',
  ticker: '$PCHAD',
  network: 'Solana',
  totalSupply: 1_000_000_000,
  tax: '0%',
  taxNote: 'Standard SPL token · no transfer fee',

  slogan: 'Markets dump. Chads pump.',
  secondary: 'The pumpkin has awakened.',
  heroLine: '1 billion $PCHAD. One community. One Chadverse.',

  /** Official Solana mint (token) address. Verified on-chain 31 Oct 2026. */
  contractAddress: MINT,
  usdcMint: USDC_MINT,

  dex: 'Raydium',
  pair: 'PCHAD/USDC',
  poolType: 'CPMM',

  /** Raydium swap with USDC -> PCHAD preselected; the PCHAD mint is the one above. */
  buyUrl: `https://raydium.io/swap/?inputMint=${USDC_MINT}&outputMint=${MINT}`,
  solscanUrl: `https://solscan.io/token/${MINT}`,

  url: 'https://pumpchad.pchad.workers.dev',
  copyright: '© 2026 PumpChad',
}

export const social = {
  telegramHandle: 'PUMPCHADPCHAD',
  telegramUrl: 'https://t.me/PUMPCHADPCHAD',
  xHandle: 'PumpChad_soll',
  xUrl: 'https://x.com/PumpChad_soll',
}
export const xUrl = social.xUrl

/**
 * ─── LAUNCH ───
 * Official date: 31 October 2026 (Halloween).
 * Official time: 18:00 UTC on 31 October. UK clocks go back on 25 October 2026, so 18:00 UK time is 18:00 GMT (UTC+0).
 * To change the time, edit `target` — keep the explicit offset so every visitor's timer agrees.
 */
export const launch = {
  target: '2026-10-31T18:00:00+00:00',
  label: '31 October 2026 · 18:00 UTC / UK time',
  dateLabel: 'October 31',
  countdownTitle: 'The Chad era begins in…',
  countdownTagline: 'October 31 · 18:00 UTC — the Chads are coming.',
  doneTitle: 'Launch time reached.',
  headline: ['The Chad era', 'is coming.'],
  subheading: 'More than a meme. More than a community. A whole new world is coming.',
}

/**
 * Development progress — flip `state` as things finish ('done' | 'building' | 'date').
 * Keep it honest: only mark something done when it actually is.
 */
export const milestones: { label: string; state: 'done' | 'building' | 'date'; note: string }[] = [
  { label: 'PumpChad characters', state: 'done', note: 'Complete' },
  { label: 'Chadverse world', state: 'building', note: 'In development' },
  { label: 'Interactive gym', state: 'building', note: 'In development' },
  { label: 'Mini-games', state: 'building', note: 'In development' },
  { label: 'Public launch', state: 'date', note: '31 October 2026' },
]

/** Chadverse 3D teaser — real screenshots from the in-development game (static images; the game itself is not on this site). */
export const chadverse3d = {
  characters: [
    { name: 'Pumpkin Chad', src: asset('/art/chadverse-3d/char-pumpkin.webp'), alt: 'Pumpkin Chad flexing on the character-creator stage of the in-development Chadverse' },
    { name: 'Skeleton Chad', src: asset('/art/chadverse-3d/char-skeleton.webp'), alt: 'Hooded Skeleton Chad flexing on the character-creator stage' },
    { name: 'Demon Chad', src: asset('/art/chadverse-3d/char-demon.webp'), alt: 'Horned Demon Chad flexing on the character-creator stage' },
  ],
  world: { src: asset('/art/chadverse-3d/chad-square.webp'), alt: 'Chad Square at night: the Pump Fountain, lanterns and pumpkin-headed chads, from the in-development Chadverse' },
  gym: [
    { label: 'Bench press', src: asset('/art/chadverse-3d/gym-bench.webp'), alt: 'Pumpkin Chad on the bench press in the Chad Gym' },
    { label: 'Back squat', src: asset('/art/chadverse-3d/gym-squat.webp'), alt: 'Pumpkin Chad squatting in the Chad Gym rack' },
    { label: 'Heavy bag', src: asset('/art/chadverse-3d/gym-bag.webp'), alt: 'Pumpkin Chad punching the heavy bag in the Chad Gym' },
  ],
  features: [
    { title: 'Customisable 3D characters', text: 'Pumpkin, Skeleton and Demon Chads — skins, gear, glow and attitude.' },
    { title: 'Interactive gym', text: 'Bench, squat, curls and the heavy bag. Reps on the beat build strength.' },
    { title: 'Explorable environments', text: 'Chad Square, its residents, secrets and hidden golden seeds.' },
    { title: 'Mini-games & challenges', text: 'Timing challenges now; more activities on the way.' },
    { title: 'Community activities', text: 'Planned for the future — built with the community.' },
  ],
}

/** Launch status board (static rows). The Trading row is live: see src/launch.tsx. */
export const launchStatus: { label: string; state: LaunchState; text: string }[] = [
  { label: 'Website', state: 'live', text: 'LIVE' },
  { label: 'X', state: 'live', text: 'LIVE' },
  { label: 'Telegram', state: 'live', text: 'LIVE' },
  { label: 'Token', state: 'live', text: 'ON-CHAIN' },
  { label: 'Contract', state: 'live', text: 'PUBLISHED' },
  { label: 'Raydium pool', state: 'live', text: 'CREATED' },
]

/** Official allocation. Percentages are the project's stated split; none of it is claimed to be locked, vested or audited. */
export const tokenomics = {
  allocation: [
    {
      id: 'liquidity',
      label: 'Initial Liquidity',
      percent: 82,
      color: '#ff7a1a',
      blurb:
        'Deposited into the PCHAD/USDC Raydium CPMM pool so the token can be traded. Raydium’s pool data shows 820,000,000 $PCHAD deposited.',
    },
    {
      id: 'community',
      label: 'Community Rewards & Competitions',
      percent: 10,
      color: '#f6c870',
      blurb:
        'Set aside for community rewards, giveaways and competitions, including Chadverse events. No reward programme is live yet; rules will be announced on official channels first.',
    },
    {
      id: 'chadverse',
      label: 'Chadverse Development Fund',
      percent: 4,
      color: '#19f19a',
      blurb: 'Funds building the Chadverse game: art, 3D worlds, parkour and bike gameplay, tools and hosting. Spending is at the team’s discretion.',
    },
    {
      id: 'founder',
      label: 'Founder Allocation',
      percent: 3,
      color: '#9b5cff',
      blurb: 'Allocated to the founder. We do not claim this allocation is locked or vested.',
    },
    {
      id: 'team',
      label: 'Development Team',
      percent: 1,
      color: '#f3ece2',
      blurb: 'Allocated to the people building the website and the game. We do not claim this allocation is locked or vested.',
    },
  ],
  allocationNote:
    'The split above is the project’s stated allocation. Per-allocation wallet balances are not independently verified on-chain, and none of the allocations is claimed to be locked, vested or audited.',
  liquidityWarning:
    'The Raydium PCHAD/USDC liquidity is NOT locked or burned. The liquidity position is held and controlled by the project wallet (Raydium currently shows 0% of the LP burned), so until it is locked or burned the project wallet can add or remove that liquidity.',
  /** Checked against Solana mainnet RPC on 31 Oct 2026. Revoked authorities cannot be restored. */
  onchain: [
    { label: 'Total supply', value: '1,000,000,000', note: '9 decimals · fixed' },
    { label: 'Mint authority', value: 'Revoked', note: 'No new tokens can be minted' },
    { label: 'Freeze authority', value: 'None', note: 'Wallets cannot be frozen' },
    { label: 'Token program', value: 'SPL Token', note: 'Standard, no transfer-fee extension' },
  ],
  onchainChecked: '31 Oct 2026',
}

/**
 * Mascot art slots. Swap any `src` for final artwork (drop the file in /public/art).
 * Set `src: ''` to show the branded placeholder instead.
 * All current art is cropped from the master Pumpchad reference image.
 */
export const art = {
  hero: {
    src: asset('/art/pumpchad-hero-1254.webp'),
    srcSmall: asset('/art/pumpchad-hero-760.webp'),
    alt: 'Pumpchad — a jacked jack-o-lantern in sunglasses and a PUMP CHAD chain, flexing under a full moon',
  },
  /** About section artwork (uncropped). Shown only in About, not in the Chadverse gallery. */
  about: {
    src: asset('/art/chadverse/01-pumpchad-throne.webp'),
    width: 767,
    height: 497,
    alt: 'Pumpchad in a gold crown and fur coat on a golden throne, holding a goblet, beside a Doberman and stacks of cash',
  },
  logo: { src: asset('/art/pumpchad-logo.webp'), alt: 'Pumpchad logo' },
  /** Background silhouette. Ideally a transparent PNG/WebP cut-out of Pumpchad. */
  silhouette: { src: asset('/art/pumpchad-hero-760.webp'), alt: '' },
}

export type Artwork = {
  id: string
  title: string
  caption: string
  src: string
  /** Intrinsic pixel size — keeps the card at the artwork's real proportions (no cropping). */
  width: number
  height: number
  alt: string
}

/**
 * THE CHADVERSE — website-exclusive artwork (not the memes posted on X).
 * Add a piece: drop the file in /public/art/chadverse and add an entry with its real width/height.
 */
export const chadverse: Artwork[] = [
  {
    id: '01',
    title: 'The Trading Room',
    caption: 'Discipline. Execution. Patience. Freedom.',
    src: asset('/art/chadverse/02-pumpchad-trading-room.webp'),
    width: 765,
    height: 497,
    alt: 'Crowned Pumpchad in a PUMP CHAD chair, watching a wall of green charts over a night skyline with a coffee mug',
  },
  {
    id: '02',
    title: 'Bears Get Buried',
    caption: 'Red candles build character.',
    src: asset('/art/chadverse/03-pumpchad-bears-buried.webp'),
    width: 513,
    height: 523,
    alt: 'Pumpchad smashing through a wall of red candles with the words Bears Get Buried',
  },
  {
    id: '03',
    title: 'Charts to Cars',
    caption: 'Manifesting. Not financial advice.',
    src: asset('/art/chadverse/04-pumpchad-charts-to-cars.webp'),
    width: 497,
    height: 523,
    alt: 'Pumpchad sitting on a black supercar in front of a private jet at sunset, with the words From Charts to Cars',
  },
  {
    id: '04',
    title: 'The Army',
    caption: 'Not just a coin. A movement.',
    src: asset('/art/chadverse/05-pumpchad-army.webp'),
    width: 519,
    height: 523,
    alt: 'Pumpchad holding a giant PUMP CHAD flag in front of an army of pumpkin-headed chads under a full moon',
  },
]

export const faq: { q: string; a: string }[] = [
  { q: 'What is PumpChad?', a: 'PumpChad is a Solana meme token built around the PumpChad character, memes and the Chadverse game world.' },
  { q: 'What is the ticker and supply?', a: '$PCHAD, with a total supply of 1,000,000,000.' },
  {
    q: 'What is the official contract address?',
    a: `${MINT}. Always compare it with the address shown in the Launch section, on the official X account and in the official Telegram before you trade.`,
  },
  { q: 'When does it launch?', a: 'The scheduled launch is 31 October 2026 at 18:00 UTC (UK time). The site only shows trading as open once Raydium reports the pool as open.' },
  { q: 'Where can I trade it?', a: 'On Raydium, in the PCHAD/USDC pool (CPMM). Use the Buy button on this website: it opens Raydium with the official $PCHAD mint selected.' },
  {
    q: 'Is the liquidity locked?',
    a: 'No. The Raydium liquidity position is not locked or burned and is controlled by the project wallet. That means the project wallet can add or remove liquidity.',
  },
  { q: 'Are the allocations locked or vested?', a: 'We do not claim that. The split is 82% liquidity, 10% community, 4% Chadverse development, 3% founder and 1% development team; none of it is audited or independently verified.' },
  { q: 'Is there a buy or sell tax?', a: 'The token is a standard SPL token with no transfer-fee extension, so the token itself charges no tax. Raydium’s pool trading fee (0.25%) and network fees still apply.' },
  { q: 'Which blockchain is PumpChad on?', a: 'Solana.' },
  {
    q: 'Is the Chadverse game finished?',
    a: 'No. Parts of it are playable as an early build; much of it is still in development or planned. The Chadverse section shows exactly which is which.',
  },
  {
    q: 'Is PumpChad financial advice?',
    a: 'No. $PCHAD is a meme token with no promise of returns or value. Crypto assets are highly speculative and you can lose everything you put in. Do your own research.',
  },
]

export const tickerPhrases = [
  'Markets dump',
  'Chads pump',
  '$PCHAD',
  'Solana',
  'Pumpchad has entered the chat',
  'No panic',
  'Full chad mode',
  'Protein loaded',
  'Panic disabled',
]

export const nav = [
  { label: 'Launch', href: '#launch' },
  { label: 'About', href: '#about' },
  { label: 'Tokenomics', href: '#tokenomics' },
  { label: 'How to Buy', href: '#how-to-buy' },
  { label: 'Chadverse', href: '#chadverse' },
  { label: 'FAQ', href: '#faq' },
]

export const disclaimer =
  '$PCHAD is a meme token with no promise of financial return, profit or value. Crypto assets are highly speculative and you can lose everything. This is not financial advice. Liquidity is not locked or burned. Always verify the contract address and only use official links.'


/** Derived helpers — no need to edit. */
export const isSolanaAddress = (v: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v.trim())
export const contractLive = isSolanaAddress(site.contractAddress)
export const formatSupply = (n: number) => n.toLocaleString('en-US')
