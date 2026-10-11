# Pumpchad ($PCHAD) — website

React + TypeScript + Vite + Tailwind v4 + Framer Motion.

```bash
npm install
npm run dev       # local dev
npm run build     # production build -> dist/
npm run preview   # serve the build
```

## Updating launch details — edit ONE file: `src/config.ts`

| What | Field |
|---|---|
| Contract address (shows NOT LIVE YET until a valid Solana address is set; copy button + short/full toggle appear automatically) | `site.contractAddress` |
| Official trading link (How to Buy button unlocks once this AND the contract are set) | `site.buyUrl` |
| X profile (**placeholder — replace**) | `social.xUrl`, `social.xHandle` |
| Telegram | `social.telegramUrl` |
| Launch status board | `launchStatus` (`live` / `soon` / `not-live`) |
| Token allocation (set `final: true` + numeric `percent`s only when published) | `tokenomics` |
| Mint authority / liquidity text | `tokenomics.status` |
| Memes (Chad Archives) | `memes` — drop images in `public/art/` |
| FAQ, ticker phrases, nav | `faq`, `tickerPhrases`, `nav` |
| Domain (also update `index.html` OG tags) | `site.url` |

## Mascot art slots

All slots live in `art` in `src/config.ts`: `hero`, `logo`, `standing`, `reaction`, `silhouette`.
Every image is currently cropped from the master reference (`art-source-pumpchad.png`).
Replace `src` with final art; set `src: ''` to show a branded placeholder. Elements carry
`data-art-slot="…"` so they are easy to find. For `silhouette`, a transparent cut-out PNG/WebP looks best.

Icons: `public/favicon.ico`, `favicon-64.png`, `apple-touch-icon.png`, `icon-512.png`, `og-image.jpg` (1200×630).

## QA scripts (`scripts/`)
Playwright helpers used for visual QA (`shoot.mjs` screenshots, `interact.mjs` menu/anchors/lightbox/FAQ checks).
Run against `npm run preview -- --port 4317`.
