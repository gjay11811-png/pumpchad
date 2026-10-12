// Scroll-behaviour check: while scrolling DOWN and back UP (desktop + phone), every key element that is
// on screen must be fully opaque (own opacity × every ancestor's), not covered by another element, and not
// clipped. Catches scroll-linked fade-outs, early exit animations and sliding-underneath bugs.
//   node scripts/scroll-test.mjs            (vite dev on :4330, or URL=...)
import { chromium } from 'playwright'
const URL = process.env.URL || 'http://localhost:4330/'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
let pass = 0
let fail = 0
const check = (ok, msg) => {
  ok ? pass++ : fail++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`)
}

/** runs in the page: measures every key element that is mostly on screen */
const MEASURE = () => {
  const HEADER = 84 // fixed header covers the top of the viewport
  const vh = window.innerHeight
  const out = []
  const eff = (el) => {
    let o = 1
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity)
    return o
  }
  const nodes = new Set()
  document.querySelectorAll('main h2, main [data-testid=countdown], main [data-testid=share-button], main [data-testid=chadverse-gate], main a[href^="http"], main [aria-disabled=true], footer a').forEach((e) => nodes.add(e))
  // the "X — coming soon" placeholders (hero, community, footer)
  document.querySelectorAll('main span, main div, footer span').forEach((e) => {
    if (e.children.length <= 3 && /X — coming soon/i.test(e.textContent || '') && (e.textContent || '').length < 90) nodes.add(e)
  })
  for (const el of nodes) {
    const r = el.getBoundingClientRect()
    if (r.width < 4 || r.height < 4) continue
    const top = Math.max(r.top, HEADER)
    const bottom = Math.min(r.bottom, vh)
    const visible = Math.max(0, bottom - top) / r.height
    if (visible < 0.6) continue // only judge elements the reader can actually see
    const cx = r.left + r.width / 2
    const cy = Math.min(Math.max(r.top + r.height / 2, HEADER + 2), vh - 2)
    const hit = document.elementFromPoint(Math.min(Math.max(cx, 1), window.innerWidth - 2), cy)
    out.push({
      what: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} "${(el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 34)}"`,
      opacity: +eff(el).toFixed(3),
      covered: !!hit && !(el.contains(hit) || hit.contains(el)),
      coveredBy: hit ? `${hit.tagName.toLowerCase()}.${(hit.className?.toString?.() || '').slice(0, 30)}` : null,
      x0: Math.round(r.left),
      x1: Math.round(r.right),
    })
  }
  return out
}

for (const [tag, opts] of [
  ['desktop 1440x900', { viewport: { width: 1440, height: 900 } }],
  ['phone 393x852', { viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
]) {
  console.log(`\n=== ${tag} ===`)
  const ctx = await b.newContext({ ...opts, timezoneId: 'Europe/London' })
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(e.message))
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 160)))
  await p.goto(URL, { waitUntil: 'networkidle' })
  await p.waitForTimeout(2200) // entrance animations finish
  const H = await p.evaluate(() => document.documentElement.scrollHeight)
  const vh = opts.viewport.height
  const step = Math.round(vh * 0.4)
  const stops = []
  for (let y = 0; y <= H - vh; y += step) stops.push(y)
  stops.push(H - vh)
  const sweeps = [['down', stops], ['up', [...stops].reverse()]]
  const seen = new Map() // what → worst reading
  const problems = []
  let measured = 0
  for (const [dir, ys] of sweeps) {
    for (const y of ys) {
      await p.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y)
      await p.waitForTimeout(1250) // let entrance animations + scroll-linked values settle
      const rows = await p.evaluate(MEASURE)
      measured += rows.length
      for (const r of rows) {
        const w = seen.get(r.what)
        if (!w || r.opacity < w.opacity) seen.set(r.what, { ...r, y, dir })
        if (r.opacity < 0.98) problems.push(`${dir} y=${y}: ${r.what} opacity ${r.opacity}`)
        if (r.covered) problems.push(`${dir} y=${y}: ${r.what} covered by ${r.coveredBy}`)
        if (r.x0 < -2 || r.x1 > opts.viewport.width + 2) problems.push(`${dir} y=${y}: ${r.what} clipped horizontally (${r.x0}..${r.x1})`)
      }
    }
  }
  // the hero buttons must be among what was measured on the way down
  const heroX = [...seen.keys()].filter((k) => /X — coming soon|Follow on X/i.test(k)).length
  check(measured > 50, `measured ${measured} on-screen readings across ${stops.length} stops each way`)
  check(heroX >= 1, 'the X buttons were measured while on screen')
  check(problems.length === 0, `every on-screen element stays fully opaque, uncovered and unclipped${problems.length ? ` — ${problems.length} problem(s)` : ''}`)
  const uniq = [...new Set(problems.map((x) => x.replace(/^(down|up) y=\d+: /, '')))]
  uniq.slice(0, 14).forEach((x) => console.log(`        · ${x}`))
  if (process.env.VERBOSE) problems.forEach((x) => console.log(`          ${x}`))
  if (problems.length) console.log(`        first: ${problems[0]}`)

  /* ── animations are still alive (this is not a static page) ── */
  const t0 = await p.evaluate(() => getComputedStyle(document.querySelector('#top img')?.closest('div[style]') ?? document.body).transform)
  await p.evaluate(() => window.scrollTo({ top: 400, behavior: 'instant' }))
  await p.waitForTimeout(700)
  const t1 = await p.evaluate(() => getComputedStyle(document.querySelector('#top img')?.closest('div[style]') ?? document.body).transform)
  check(t0 !== t1, 'hero parallax still moves the mascot while scrolling')
  await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await p.waitForTimeout(500)
  check(await p.evaluate(() => !!document.querySelector('.fog') && getComputedStyle(document.querySelector('.fog')).animationName !== 'none'), 'Halloween atmosphere animations still running (fog / embers)')

  // entrance animations on a FRESH load: armed (transparent) before arrival, play once, then stay at 100% for good
  {
    const fp = await ctx.newPage()
    await fp.goto(URL, { waitUntil: 'networkidle' })
    await fp.waitForTimeout(1500)
    const eff = () =>
      fp.evaluate(() => {
        const t = document.querySelector('#progress-title')
        let o = 1
        for (let n = t; n; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity)
        return +o.toFixed(2)
      })
    const go = async (y) => {
      await fp.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y)
      await fp.waitForTimeout(1300)
      return eff()
    }
    const before = await eff()
    const target = await fp.evaluate(() => Math.round(document.querySelector('#progress-title').getBoundingClientRect().top + window.scrollY - 200))
    const arrive = await go(target)
    const away = await go(0)
    const back = await go(target)
    check(before < 0.1, `entrance animation armed: a section far below starts transparent (${before})`)
    check(arrive === 1 && away === 1 && back === 1, `…fades in once, then stays at 100% (arrive ${arrive}, scrolled away ${away}, back ${back})`)
    await fp.close()
  }

  /* ── real continuous scrolling: sample the hero copy EVERY FRAME during wheel / touch gestures ── */
  await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await p.waitForTimeout(800)
  await p.evaluate(() => {
    window.__min = 1
    window.__frames = 0
    const els = [document.querySelector('[data-testid=countdown]'), document.querySelector('#top a[href*="t.me"]'), document.querySelector('#top [aria-disabled=true], #top a[href^="https://x.com/"]'), document.querySelector('#top h2')].filter(Boolean)
    const eff = (el) => {
      let o = 1
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity)
      return o
    }
    const loop = () => {
      window.__frames++
      for (const el of els) {
        const r = el.getBoundingClientRect()
        const vis = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 84)) / r.height
        if (vis > 0.2) window.__min = Math.min(window.__min, eff(el))
      }
      window.__raf = requestAnimationFrame(loop)
    }
    loop()
  })
  if (opts.isMobile) {
    const cdp = await ctx.newCDPSession(p)
    const swipe = (dy) => cdp.send('Input.synthesizeScrollGesture', { x: 196, y: 500, yDistance: dy, speed: 600, gestureSourceType: 'touch' })
    for (let i = 0; i < 4; i++) await swipe(-260) // finger up = page scrolls down
    for (let i = 0; i < 4; i++) await swipe(260)
  } else {
    await p.mouse.move(720, 450)
    for (let i = 0; i < 14; i++) { await p.mouse.wheel(0, 90); await p.waitForTimeout(40) }
    for (let i = 0; i < 14; i++) { await p.mouse.wheel(0, -90); await p.waitForTimeout(40) }
  }
  await p.waitForTimeout(500)
  const live = await p.evaluate(() => { cancelAnimationFrame(window.__raf); return { min: +window.__min.toFixed(3), frames: window.__frames } })
  check(live.min >= 0.99, `during live ${opts.isMobile ? 'touch swipes' : 'wheel scrolling'} (${live.frames} frames) the hero copy never drops below ${live.min} opacity`)
  check(errs.length === 0, `no console errors${errs.length ? ': ' + errs[0] : ''}`)
  await ctx.close()
}

await b.close()
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`)
console.log(fail ? `${fail} FAILURE(S)` : 'ALL CHECKS PASSED')
process.exit(fail ? 1 : 0)
