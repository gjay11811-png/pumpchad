// Pre-launch landing page checks (desktop + phone): countdown correctness across time zones and after launch,
// links, images, gate, share, milestones, reduced motion, overflow, console errors. Screenshots → $SHOTS.
//   node scripts/landing-test.mjs            (vite dev on :4330, or URL=...)
import { chromium } from 'playwright'
const URL = process.env.URL || 'http://localhost:4330/'
const out = process.env.SHOTS
const TARGET = Date.parse('2026-10-31T00:00:00+00:00')
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
let pass = 0
let fail = 0
const check = (ok, msg) => {
  ok ? pass++ : fail++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`)
}
const readCountdown = (p) => p.evaluate(() => Object.fromEntries(['days', 'hours', 'minutes', 'seconds'].map((k) => [k, +document.querySelector(`[data-testid=countdown-${k}]`).dataset.value])))
const toMs = (c) => ((c.days * 24 + c.hours) * 60 + c.minutes) * 60000 + c.seconds * 1000

for (const [tag, ctxOpts] of [
  ['desktop', { viewport: { width: 1440, height: 900 } }],
  ['iphone', { viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
]) {
  console.log(`\n=== ${tag} ===`)
  const ctx = await b.newContext({ ...ctxOpts, timezoneId: 'Europe/London' })
  const p = await ctx.newPage()
  const errs = []
  const bad = []
  p.on('pageerror', (e) => errs.push(e.message))
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)))
  p.on('response', (r) => r.status() >= 400 && bad.push(`${r.status()} ${r.url()}`))
  await p.goto(URL, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1500)

  // hero copy
  const text = await p.locator('#top').innerText()
  check(/THE CHAD ERA/i.test(text) && /IS COMING\./i.test(text), 'hero headline: THE CHAD ERA IS COMING.')
  check(text.includes('More than a meme. More than a community. A whole new world is coming.'), 'hero subheading quote')
  check(/THE CHAD ERA BEGINS IN/i.test(text), 'countdown title')
  check(/OCTOBER 31 — THE CHADS ARE COMING\./i.test(text), 'countdown tagline')

  // countdown correctness
  const c1 = await readCountdown(p)
  const expected = TARGET - Date.now()
  check(Math.abs(toMs(c1) - expected) < 3000, `countdown matches the target (${c1.days}d ${c1.hours}h ${c1.minutes}m ${c1.seconds}s)`)
  check(Object.values(c1).every((v) => v >= 0) && c1.hours < 24 && c1.minutes < 60 && c1.seconds < 60, 'all units in range, none negative')
  await p.waitForTimeout(2200)
  const c2 = await readCountdown(p)
  check(toMs(c1) - toMs(c2) >= 1000 && toMs(c1) - toMs(c2) <= 4000, `ticks every second (${((toMs(c1) - toMs(c2)) / 1000).toFixed(0)} s in 2.2 s)`)

  // links
  const tg = await p.locator('a[href="https://t.me/PUMPCHADPCHAD"]').count()
  check(tg >= 3, `Telegram links point at t.me/PUMPCHADPCHAD (${tg})`)
  const xLinks = await p.locator('a[href="https://x.com/jaygd5d5"]').count()
  check(xLinks >= 3, `X links point at x.com/jaygd5d5 (${xLinks})`)
  check((await p.locator('a[href="https://x.com/"]').count()) === 0 && (await p.getByText('X — coming soon').count()) === 0, 'no dead x.com links and no "coming soon" placeholders left')
  const ext = await p.$$eval('a[target=_blank]', (as) => as.every((a) => (a.getAttribute('rel') || '').includes('noopener')))
  check(ext, 'external links open safely (noopener)')

  // images
  await p.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 60))
    }
  })
  await p.waitForTimeout(1200)
  const broken = await p.$$eval('img', (imgs) => imgs.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src))
  check(broken.length === 0, `all images load${broken.length ? ': ' + broken.join(', ') : ''}`)
  check(bad.length === 0, `no failed requests${bad.length ? ': ' + bad.slice(0, 3).join(' | ') : ''}`)

  // Chadverse teaser + gate
  check((await p.locator('#chadverse-3d img').count()) === 7, 'Chadverse teaser shows the 7 real screenshots')
  check(!(await p.evaluate(() => [...document.scripts].some((s) => /chadverse\//.test(s.src)) || !!document.querySelector('canvas'))), 'the 3D game is not loaded on the landing page')
  await p.locator('[data-testid=chadverse-gate]').scrollIntoViewIfNeeded()
  await p.locator('[data-testid=chadverse-gate]').click()
  await p.waitForTimeout(700)
  check(await p.locator('[data-testid=gate-telegram]').isVisible(), 'knocking on the locked gate shows the Telegram message')
  out && (await p.locator('#chadverse-3d').screenshot({ path: `${out}/lp-${tag}-chadverse.jpg`, quality: 75 }))

  // progress
  const ms = await p.locator('[data-testid=milestone]').allInnerTexts()
  check(ms.length === 5 && /PUMPCHAD CHARACTERS[\s\S]*COMPLETE/i.test(ms[0]) && /PUBLIC LAUNCH[\s\S]*31 OCTOBER 2026/i.test(ms[4]), `5 milestones (${ms.map((m) => m.split('\n')[1]).join(', ')})`)

  // share
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'])
  await p.locator('[data-testid=share-button]').scrollIntoViewIfNeeded()
  await p.locator('[data-testid=share-button]').click()
  await p.waitForTimeout(400)
  const shareTxt = await p.locator('[data-testid=share-button]').innerText()
  check(/copied|share/i.test(shareTxt), `share button responds (${shareTxt.trim()})`)

  // layout
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check(overflow <= 1, `no horizontal scroll (${overflow}px)`)
  check(errs.length === 0, `no console errors${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`)

  if (out) {
    await p.evaluate(() => window.scrollTo(0, 0))
    await p.waitForTimeout(900)
    await p.screenshot({ path: `${out}/lp-${tag}-hero.jpg`, quality: 80 })
    // the page is taller than the browser's single-capture limit: capture it in viewport-sized frames
    const H = await p.evaluate(() => document.body.scrollHeight)
    const vh = ctxOpts.viewport.height
    for (let i = 0, y = 0; y < H && i < 14; i++, y += vh) {
      await p.evaluate((y) => window.scrollTo(0, y), y)
      await p.waitForTimeout(700)
      await p.screenshot({ path: `${out}/lp-${tag}-p${String(i).padStart(2, '0')}.jpg`, quality: 70 })
    }
  }
  await ctx.close()
}

/* time zones: every visitor counts to the same instant */
{
  console.log('\n=== time zones ===')
  const vals = []
  for (const tz of ['America/Los_Angeles', 'Europe/London', 'Asia/Tokyo']) {
    const ctx = await b.newContext({ timezoneId: tz })
    const p = await ctx.newPage()
    await p.goto(URL, { waitUntil: 'networkidle' })
    await p.waitForTimeout(800)
    const c = await readCountdown(p)
    vals.push([tz, toMs(c), Date.now()])
    await ctx.close()
  }
  const adj = vals.map(([tz, ms, at]) => [tz, ms + (at - vals[0][2])])
  check(adj.every(([, ms]) => Math.abs(ms - adj[0][1]) < 3000), `same countdown in ${vals.map((v) => v[0]).join(', ')}`)
}

/* after launch: zeros + done message, never negative */
{
  console.log('\n=== after the target ===')
  const ctx = await b.newContext()
  const p = await ctx.newPage()
  await p.clock.install({ time: new Date(TARGET + 3 * 86400000) })
  await p.goto(URL, { waitUntil: 'networkidle' })
  await p.waitForTimeout(800)
  const c = await readCountdown(p)
  check(Object.values(c).every((v) => v === 0), `shows 00:00:00:00 after launch (${JSON.stringify(c)})`)
  check(/THE CHAD ERA HAS BEGUN/i.test(await p.locator('[data-testid=countdown]').innerText()), 'switches to "The Chad era has begun."')
  const ctx2 = await b.newContext()
  const p2 = await ctx2.newPage()
  await p2.clock.install({ time: new Date(TARGET - 2500) })
  await p2.goto(URL, { waitUntil: 'networkidle' })
  await p2.clock.runFor(6000)
  await p2.waitForTimeout(300)
  const c2 = await readCountdown(p2)
  check(Object.values(c2).every((v) => v === 0), `crossing zero live stops at 0 (${JSON.stringify(c2)})`)
  await ctx.close()
  await ctx2.close()
}

/* reduced motion */
{
  console.log('\n=== reduced motion ===')
  const ctx = await b.newContext({ reducedMotion: 'reduce' })
  const p = await ctx.newPage()
  await p.goto(URL, { waitUntil: 'networkidle' })
  check((await p.locator('.ember').count()) === 0 && (await p.locator('.bat').count()) === 0, 'no embers / bats with reduced motion')
  await ctx.close()
}

await b.close()
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`)
console.log(fail ? `${fail} FAILURE(S)` : 'ALL CHECKS PASSED')
process.exit(fail ? 1 : 0)
