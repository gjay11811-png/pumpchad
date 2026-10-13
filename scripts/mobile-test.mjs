// Mobile controls: touch buttons laid out without overlaps, Sprint toggle really speeds up a half-stick walk.
//   SHOTS=dir node scripts/mobile-test.mjs     (dev server on :4318)
import { chromium } from 'playwright'
const out = process.env.SHOTS || '.'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
let pass = 0
let fail = 0
const check = (ok, msg) => {
  ok ? pass++ : fail++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`)
}
for (const [w, h, tag] of [
  [393, 852, 'iphone'],
  [360, 640, 'small-android'],
  [844, 390, 'iphone-landscape'],
]) {
  console.log(`\n=== ${tag} ${w}x${h} ===`)
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true })
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(e.message))
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)))
  await p.goto(process.env.URL || 'http://localhost:4318/chadverse/', { waitUntil: 'networkidle' })
  await p.evaluate(() => localStorage.clear())
  await p.reload({ waitUntil: 'networkidle' })
  await p.click('[data-testid=enter-muted]')
  await p.waitForSelector('[role=tablist]')
  await p.getByRole('tab', { name: 'Name' }).click()
  await p.fill('#chad-name', 'Thumbs')
  await p.getByRole('button', { name: /Enter Chad Square/ }).click()
  await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.playerInspect(), null, { timeout: 40000 })
  await p.waitForTimeout(1200)

  // layout: every touch control on screen, none overlapping
  const boxes = await p.evaluate(() => {
    const pick = (sel) => {
      const e = document.querySelector(sel)
      if (!e) return null
      const r = e.getBoundingClientRect()
      return { x: r.left, y: r.top, w: r.width, h: r.height }
    }
    return {
      sprint: pick('[data-testid=sprint]'),
      jump: pick('button[aria-label="Jump"]'),
      action: pick('button[aria-label^="Interact"], button[aria-label*="nearby"]'),
      emote: [...document.querySelectorAll('button')].map((x) => (x.textContent?.trim() === 'Emote' || x.getAttribute('aria-label')?.includes('mote') ? x : null)).filter(Boolean).map((e) => {
        const r = e.getBoundingClientRect()
        return { x: r.left, y: r.top, w: r.width, h: r.height }
      })[0] ?? null,
      stick: pick('[data-testid=joystick-zone]'),
    }
  })
  check(!!boxes.sprint, 'Sprint button present on touch')
  const ctrls = Object.entries(boxes).filter(([k, v]) => v && k !== 'stick')
  const onScreen = ctrls.every(([, r]) => r.x >= 0 && r.y >= 0 && r.x + r.w <= w + 0.5 && r.y + r.h <= h + 0.5)
  check(onScreen, `all touch buttons fully on screen (${ctrls.map(([k]) => k).join(', ')})`)
  const overlap = (a, c) => a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h
  const clashes = []
  for (let i = 0; i < ctrls.length; i++) for (let j = i + 1; j < ctrls.length; j++) if (overlap(ctrls[i][1], ctrls[j][1])) clashes.push(`${ctrls[i][0]}×${ctrls[j][0]}`)
  check(clashes.length === 0, `no overlapping buttons${clashes.length ? ' (' + clashes.join(', ') + ')' : ''}`)
  check(boxes.sprint && boxes.sprint.w >= 44 && boxes.sprint.h >= 44, `Sprint is a comfortable tap target (${boxes.sprint?.w}×${boxes.sprint?.h})`)
  await p.screenshot({ path: `${out}/mobile-${tag}.jpg`, quality: 78 })

  // half-stick walk with and without Sprint (same push, same duration)
  const walk = async () => {
    await p.evaluate(() => window.__chadverse.teleport(0, 14, 0))
    await p.waitForTimeout(500)
    const a = await p.evaluate(() => window.__chadverse.world())
    await p.evaluate(async () => {
      const z = document.querySelector('[data-testid=joystick-zone]')
      const r = z.getBoundingClientRect()
      const x = r.left + Math.min(90, r.width / 3)
      const y = r.bottom - 110
      const ev = (type, d) => z.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y + d, bubbles: true, isPrimary: true }))
      ev('pointerdown', 0)
      for (let i = 1; i <= 6; i++) {
        ev('pointermove', (-34 * i) / 6) // about half the stick's throw: a walk, not the far-stick run
        await new Promise((res) => setTimeout(res, 16))
      }
      await new Promise((res) => setTimeout(res, 1100))
      ev('pointerup', -34)
    })
    await p.waitForTimeout(150)
    const c = await p.evaluate(() => window.__chadverse.world())
    return Math.hypot(c.x - a.x, c.z - a.z)
  }
  const d0 = await walk()
  await p.locator('[data-testid=sprint]').dispatchEvent('pointerdown')
  await p.waitForTimeout(150)
  check((await p.locator('[data-testid=sprint]').getAttribute('aria-pressed')) === 'true', 'tap Sprint → toggled on (aria-pressed)')
  const d1 = await walk()
  check(d0 > 0.5 && d1 > d0 * 1.4, `Sprint speeds up the same half-stick push (${d0.toFixed(2)} m → ${d1.toFixed(2)} m)`)
  await p.screenshot({ path: `${out}/mobile-${tag}-sprint.jpg`, quality: 78 })
  await p.locator('[data-testid=sprint]').dispatchEvent('pointerdown')
  await p.waitForTimeout(150)
  check((await p.locator('[data-testid=sprint]').getAttribute('aria-pressed')) === 'false', 'tap again → off')
  check(errs.length === 0, `no console errors${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`)
  await ctx.close()
}
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`)
console.log(fail ? `${fail} FAILURE(S)` : 'ALL CHECKS PASSED')
await b.close()
