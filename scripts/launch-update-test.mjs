// Launch-update verification: desktop + phone, links, copy button, countdown states, overflow, JS errors.
// URL=http://127.0.0.1:5396/ OUT=dir node scripts/launch-update-test.mjs
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const URL_ = process.env.URL || 'http://127.0.0.1:5396/'
const OUT = process.env.OUT || 'C:/pumpchad-web-out'
mkdirSync(OUT, { recursive: true })
const MINT = 'BGu6efXwXkdMdRg8U3zfEnPkGmJAGkARSMgoo2r4XyQo'
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const fails = []
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m) }
const exe = process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe'
const b = await chromium.launch({ executablePath: exe })

async function load(ctxOpts, iso) {
  const ctx = await b.newContext({ permissions: ['clipboard-read', 'clipboard-write'], ...ctxOpts })
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(e.message))
  p.on('console', (m) => m.type() === 'error' && !/Failed to load resource|fonts\.g/.test(m.text()) && errs.push(m.text()))
  // no server Date header so the mocked clock is not "corrected" back to real time
  await p.route('**/', (r) => (r.request().method() === 'HEAD' ? r.fulfill({ status: 200, headers: {} }) : r.continue()))
  if (iso) await p.clock.install({ time: new Date(iso) })
  await p.goto(URL_, { waitUntil: 'load' })
  if (iso) await p.clock.resume()
  await p.waitForTimeout(1500)
  return { ctx, p, errs }
}

// ── 1. before launch, desktop ──
let { ctx, p, errs } = await load({ viewport: { width: 1440, height: 900 } }, '2026-10-31T17:00:00Z')
const txt = (sel) => p.locator(sel).first().innerText()
await p.waitForTimeout(1500)
const cd = await p.locator('#launch [role=timer]').innerText()
ok(/01\s*\n?\s*HOURS|HOURS/i.test(cd) && /^00|^01/m.test(cd), 'launch countdown shows ~1h at 17:00 UTC: ' + cd.replace(/\s+/g, ' ').slice(0, 60))
ok(/trading: opens at launch/i.test(await p.locator('#launch').innerText()), 'before launch: trading shown as NOT open')
ok((await p.locator('[data-testid=contract-address]').innerText()) === MINT, 'contract address text exact')
await p.screenshot({ path: `${OUT}/desktop-top.png` })
await p.locator('#launch').scrollIntoViewIfNeeded()
await p.screenshot({ path: `${OUT}/desktop-launch.png` })
// copy button
await p.click('[data-testid=copy-contract]')
await p.waitForTimeout(300)
ok((await p.evaluate(() => navigator.clipboard.readText())) === MINT, 'copy button puts exact mint on clipboard')
ok(/contract address copied/i.test(await p.locator('#launch').innerText()), 'copy confirmation shown')
// tokenomics
await p.locator('#tokenomics').scrollIntoViewIfNeeded()
await p.waitForTimeout(1600)
const tk = await p.locator('#tokenomics').innerText()
const tkl = tk.toLowerCase()
for (const s of ['82%', '10%', '4%', '3%', '1%', '100%', 'Initial Liquidity', 'Community Rewards', 'Chadverse Development Fund', 'Founder Allocation', 'Development Team', 'not locked', 'Revoked']) ok(tkl.includes(s.toLowerCase()), 'tokenomics contains ' + s)
ok(!/(is|are) (now )?(locked|burned|vested|audited)/i.test(tk.replace(/not (locked|burned|vested|audited)/gi,'').replace(/until it is locked or burned/gi,'')), 'no false lock/vest/audit claims')
await p.locator('#tokenomics').screenshot({ path: `${OUT}/desktop-tokenomics.png` })
await p.locator('#tokenomics button[aria-pressed]').nth(1).click()
ok((await p.locator('#tokenomics [aria-live=polite]').innerText()).includes('10%'), 'donut legend click updates detail panel')
// links
const links = await p.$$eval('a[href]', (as) => as.map((a) => a.href))
const uniq = [...new Set(links)]
const has = (s) => uniq.some((u) => u === s)
ok(has('https://t.me/PUMPCHADPCHAD'), 'Telegram link exact')
ok(has('https://x.com/PumpChad_soll'), 'X link exact')
ok(has(`https://raydium.io/swap/?inputMint=${USDC}&outputMint=${MINT}`), 'Raydium buy link has USDC->PCHAD mints')
ok(has(`https://solscan.io/token/${MINT}`), 'Solscan link exact')
ok(!uniq.some((u) => /jaygd5d5|PumpchadPCHAD(?!$)/.test(u) && !u.includes('PUMPCHADPCHAD')), 'no outdated social links')
const html = await p.content()
ok(!/jaygd5d5/.test(html), 'old X username gone from page')
ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'desktop: no horizontal scroll')
ok(errs.length === 0, 'desktop: no JS errors ' + errs.join('|'))
console.log('LINKS', uniq.filter((u) => !u.startsWith(URL_)).join('\n  '))
await ctx.close()

// ── 2. after launch (18:05 UTC): must query Raydium, not assume ──
;({ ctx, p, errs } = await load({ viewport: { width: 1440, height: 900 } }, '2026-10-31T18:05:00Z'))
await p.waitForTimeout(6000)
const after = await p.locator('#launch').innerText()
ok(/Launch time reached/i.test(after), 'after launch: shows launch time reached (no negative countdown)')
ok(!/-\d/.test(await p.locator('[data-testid=countdown]').innerText()), 'hero countdown never negative')
console.log('AFTER status:', after.match(/Trading:[^\n]*/)?.[0])
await p.locator('#launch').screenshot({ path: `${OUT}/desktop-after-launch.png` })
await ctx.close()

// ── 2b. after launch, Raydium unreachable -> "not confirmed", never "open" ──
;({ ctx, p, errs } = await load({ viewport: { width: 1440, height: 900 } }, null))
await ctx.close()
{
  const c2 = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const q = await c2.newPage()
  await q.route('**/', (r) => (r.request().method() === 'HEAD' ? r.fulfill({ status: 200, headers: {} }) : r.continue()))
  await q.route('**/api-v3.raydium.io/**', (r) => r.abort())
  await q.clock.install({ time: new Date('2026-10-31T18:05:00Z') })
  await q.goto(URL_)
  await q.clock.resume()
  await q.waitForTimeout(3000)
  const t = await q.locator('#launch').innerText()
  ok(/trading: not confirmed/i.test(t) && !/pool open on raydium/i.test(t), 'API down after launch: shows Not confirmed, not open')
  await c2.close()
}

// ── 3. phone ──
for (const [name, vp] of [['iphone', { width: 390, height: 844 }], ['small', { width: 360, height: 740 }]]) {
  ;({ ctx, p, errs } = await load({ viewport: vp, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, '2026-10-31T16:00:00Z'))
  await p.screenshot({ path: `${OUT}/${name}-top.png` })
  const over = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }))
  ok(over.sw <= over.iw, `${name}: no horizontal scroll (${over.sw}<=${over.iw})`)
  for (const id of ['launch', 'tokenomics', 'how-to-buy', 'game-status']) {
    await p.locator('#' + id).scrollIntoViewIfNeeded()
    await p.waitForTimeout(1500)
    await p.locator('#' + id).screenshot({ path: `${OUT}/${name}-${id}.png` })
  }
  // tap targets: every visible button/link in launch + header >= 40px high
  const small = await p.$$eval('#launch a, #launch button, header a, header button', (els) =>
    els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.height < 40) }).map((e) => (e.textContent || e.ariaLabel || '').trim().slice(0, 20)))
  ok(small.length === 0, `${name}: tap targets >= 40px ${small.join(',')}`)
  // overflowing elements
  const wide = await p.$$eval('body *', (els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 1 && r.width > 0 && getComputedStyle(e).position !== 'fixed' && !e.closest('[aria-hidden=true]') }).slice(0, 5).map((e) => e.tagName + '.' + String(e.className).slice(0, 30)))
  console.log(name, 'elements past viewport:', wide.join(' | ') || 'none')
  // mobile menu
  await p.evaluate(() => scrollTo(0, 0))
  await p.click('button[aria-label="Open menu"]')
  await p.waitForTimeout(900)
  await p.screenshot({ path: `${OUT}/${name}-menu.png` })
  ok(errs.length === 0, `${name}: no JS errors ${errs.join('|')}`)
  await ctx.close()
}
await b.close()
console.log(fails.length ? `\n${fails.length} FAILED:\n- ` + fails.join('\n- ') : '\nALL PASSED')
