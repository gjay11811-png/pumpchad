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

export const site = {
  projectName: 'Pumpchad',
  ticker: '$PCHAD',
  network: 'Solana',
  totalSupply: 1_000_000_000,
  tax: '0%',
  taxNote: 'Planned structure',

  slogan: 'Markets dump. Chads pump.',
  secondary: 'Pumpchad has entered the chat.',
  heroLine: 'Built for red candles, bad decisions and unreasonably high confidence.',

  /**
   * Paste the real Solana mint address here at launch.
   * While this is an empty string the site shows "NOT LIVE YET" everywhere.
   * Never put a guessed or example address here.
   */
  contractAddress: '',

  /** Official trading / launch link. Leave empty until it exists. */
  buyUrl: '',

  url: 'https://pumpchad.com', // TODO: replace with the real domain (used for OG tags in index.html too)
  copyright: '© 2026 Pumpchad',
}

export const social = {
  telegramHandle: 'PumpchadPCHAD',
  telegramUrl: 'https://t.me/PumpchadPCHAD',
  /**
   * TODO: set the official X handle (without @), e.g. 'PumpchadPCHAD'. Do not guess it.
   * While this is empty, every "Follow on X" button shows "X — coming soon" instead of a dead link.
   */
  xHandle: '',
}
export const xUrl = social.xHandle ? `https://x.com/${social.xHandle}` : ''

/**
 * ─── LAUNCH ───
 * Official date: 31 October 2026 (Halloween).
 * Provisional time: midnight UK time on 31 October, pending final confirmation.
 * UK clocks go back on 25 October 2026, so midnight UK on the 31st is 00:00 GMT (UTC+0).
 * To change the time, edit `target` — keep the explicit offset so every visitor's timer agrees.
 */
export const launch = {
  target: '2026-10-31T00:00:00+00:00',
  dateLabel: 'October 31',
  countdownTitle: 'The Chad era begins in…',
  countdownTagline: 'October 31 — the Chads are coming.',
  doneTitle: 'The Chad era has begun.',
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

/** Launch status board. Flip states here as things go live. */
export const launchStatus: { label: string; state: LaunchState; text: string }[] = [
  { label: 'Website', state: 'live', text: 'LIVE' },
  { label: 'X', state: 'live', text: 'LIVE' },
  { label: 'Launch date', state: 'soon', text: '31 OCT 2026' },
  { label: 'Telegram', state: 'live', text: 'LIVE' },
  { label: 'Token', state: 'soon', text: 'COMING SOON' },
  { label: 'Contract', state: 'not-live', text: 'NOT LIVE' },
  { label: 'Trading', state: 'not-live', text: 'NOT LIVE' },
]

/**
 * Allocation is NOT final. Keep `final: false` until the real split is published.
 * When it is final, set `final: true` and give each row a numeric `percent`.
 */
export const tokenomics = {
  final: false,
  allocationNote: 'Final token allocation will be published before launch.',
  allocation: [
    { label: 'Public / Liquidity', percent: null as number | null },
    { label: 'Community / Marketing', percent: null as number | null },
    { label: 'Team', percent: null as number | null },
  ],
  status: [
    { label: 'Mint Authority', value: 'To be confirmed at launch' },
    { label: 'Liquidity', value: 'Launch details coming soon' },
    { label: 'Contract Address', value: 'Not live yet' },
  ],
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
  { q: 'What is Pumpchad?', a: 'Pumpchad is a Solana meme coin built around the Pumpchad character, memes and community.' },
  { q: 'When does Pumpchad launch?', a: 'The official launch date is 31 October 2026 (Halloween). The countdown on this page shows the time remaining; the exact time will be confirmed on our official channels.' },
  { q: 'What is the Chadverse?', a: 'An interactive 3D world we are building for the community: customisable characters, a gym, places to explore and mini-games. It is in development and not open to the public yet.' },
  { q: 'What is the ticker?', a: '$PCHAD.' },
  { q: 'What is the total supply?', a: '1,000,000,000 $PCHAD.' },
  { q: 'Is there a buy or sell tax?', a: 'The planned structure is 0% tax.' },
  {
    q: 'Is $PCHAD live yet?',
    a: 'No. The official contract will only be displayed on this website and our official social channels after launch.',
  },
  { q: 'Which blockchain is Pumpchad on?', a: 'Solana.' },
  {
    q: 'Where do I find the real contract address?',
    a: 'Only trust the contract displayed on the official Pumpchad website, X account and Telegram.',
  },
  {
    q: 'Is Pumpchad financial advice?',
    a: 'No. $PCHAD is a meme token. Crypto assets are highly speculative. Always do your own research.',
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
  { label: 'About', href: '#about' },
  { label: 'Chadverse 3D', href: '#chadverse-3d' },
  { label: 'Progress', href: '#progress' },
  { label: 'Tokenomics', href: '#tokenomics' },
  { label: 'FAQ', href: '#faq' },
]

export const disclaimer =
  '$PCHAD is a meme token with no promise of financial return. Crypto assets are highly speculative. Always verify official links and contract addresses.'

/** Derived helpers — no need to edit. */
export const isSolanaAddress = (v: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v.trim())
export const contractLive = isSolanaAddress(site.contractAddress)
export const formatSupply = (n: number) => n.toLocaleString('en-US')
