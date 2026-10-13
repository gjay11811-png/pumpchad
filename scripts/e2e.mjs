// End-to-end acceptance journey (Part 29). Fresh storage → create → explore → gym → save → reload → restored.
import { chromium } from 'playwright'
const out = process.env.SHOTS
const base = process.env.URL || 'http://localhost:4318/chadverse/'
const exe = process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe'
const b = await chromium.launch({ executablePath: exe })
let failures = 0
const check = (ok, msg) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!ok) failures++
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function joystick(p, id, dy, holdMs) {
  await p.evaluate(
    async ([id, dy, holdMs]) => {
      const z = document.querySelector('[data-testid=joystick-zone]')
      const r = z.getBoundingClientRect()
      const x = r.left + 80
      const y = r.bottom - 120
      const ev = (type, d) => z.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y + d, bubbles: true, isPrimary: true }))
      ev('pointerdown', 0)
      for (let i = 1; i <= 6; i++) {
        ev('pointermove', (dy * i) / 6)
        await new Promise((res) => setTimeout(res, 16))
      }
      await new Promise((res) => setTimeout(res, holdMs))
      ev('pointerup', dy)
    },
    [id, dy, holdMs],
  )
}

for (const [w, h, tag, mobile] of [
  [1440, 900, 'desktop', false],
  [393, 852, 'iphone', true],
]) {
  console.log(`\n=== ${tag} ${w}x${h} ===`)
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile })
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(e.message))
  p.on('console', (m) => m.type() === 'error' && errs.push(`[${phaseNow}] ` + m.text()))
  const cv = (fn) => p.evaluate(fn)
  let phaseNow = 'start'
  setInterval(async () => { try { phaseNow = await p.evaluate(() => window.__chadverse?.phase) } catch {} }, 300)
  await p.goto(base, { waitUntil: 'networkidle' })
  await p.evaluate(() => localStorage.clear())
  await p.reload({ waitUntil: 'networkidle' })

  // 1-4 entry
  await p.waitForSelector('[data-testid=enter-muted]', { timeout: 15000 })
  check(true, 'title screen shown')
  await p.click('[data-testid=enter-muted]')
  await p.waitForSelector('[role=tablist]')
  check(true, 'creator opened')

  // 5 species + 6 customise
  await sleep(400)
  const before = await cv(() => window.__chadverse.showroom()?.rig?.root.uuid)
  await p.getByRole('radio', { name: /Skeleton/ }).click()
  await sleep(600)
  const after = await cv(() => window.__chadverse.showroom()?.rig?.root.uuid)
  check(before && after && before !== after, 'species change rebuilds the 3D character')
  await p.getByRole('tab', { name: 'Look' }).click()
  await p.getByRole('radio', { name: 'Glow #19f19a' }).click()
  await p.getByRole('tab', { name: 'Gear' }).click()
  await p.getByRole('radio', { name: 'Crown' }).click()
  await sleep(400)
  const yaw0 = await cv(() => window.__chadverse.showroom().yaw)
  if (mobile) {
    // phones rotate by dragging the character
    await p.mouse.move(w / 2, h * 0.3)
    await p.mouse.down()
    await p.mouse.move(w / 2 + 120, h * 0.3, { steps: 6 })
    await p.mouse.up()
  } else await p.getByRole('button', { name: 'Rotate right' }).click()
  await sleep(500)
  const yaw1 = await cv(() => window.__chadverse.showroom().yaw)
  check(Math.abs(yaw1 - yaw0) > 0.05, 'rotate control turns the character')
  await p.screenshot({ path: `${out}/e2e-${tag}-creator.jpg`, quality: 70 })

  // 7 username validation
  await p.getByRole('button', { name: /Enter Chad Square/ }).click()
  await sleep(300)
  check(await p.locator('#chad-name').isVisible(), 'missing name blocks entry and opens the Name tab')
  await p.fill('#chad-name', 'x')
  await p.locator('#chad-name').blur()
  check((await p.textContent('#name-help')).includes('At least 3'), 'short name rejected with a message')
  await p.fill('#chad-name', 'Bone Daddy')
  await p.getByRole('button', { name: /Enter Chad Square/ }).click()

  // 8-9 save + enter world
  await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 60000 })
  await sleep(1200)
  const saved = await cv(() => JSON.parse(localStorage.getItem('pumpchad.chadverse.save')))
  const ap = saved?.character?.appearance
  check(saved?.character?.name === 'Bone Daddy' && ap?.species === 'skeleton' && ap?.headwear === 'crown' && ap?.glow === '#19f19a', 'character saved with chosen species, gear and glow')
  check(saved.progress.achievements.includes('welcome'), 'welcome achievement awarded')
  await p.screenshot({ path: `${out}/e2e-${tag}-world.jpg`, quality: 70 })

  // 10 movement
  const s0 = await cv(() => window.__chadverse.world())
  if (!mobile) {
    await p.keyboard.down('w')
    await sleep(900)
    await p.keyboard.up('w')
  } else await joystick(p, 7, -72, 900)
  await sleep(300)
  const s1 = await cv(() => window.__chadverse.world())
  const moved = Math.hypot(s1.x - s0.x, s1.z - s0.z)
  check(moved > 1.5, `${mobile ? 'joystick' : 'keyboard'} moves the player (${moved.toFixed(2)} m)`)
  check(s1.z < s0.z, 'forward input moves away from the camera (toward the statue)')

  // collision: push into the statue
  await cv(() => window.__chadverse.teleport(0, 5.2))
  if (!mobile) {
    await p.keyboard.down('w')
    await sleep(1500)
    await p.keyboard.up('w')
  } else await joystick(p, 8, -70, 1500)
  const s2 = await cv(() => window.__chadverse.world())
  check(Math.hypot(s2.x, s2.z) >= 4.3, `statue collision holds (distance ${Math.hypot(s2.x, s2.z).toFixed(2)})`)
  // boundary
  await cv(() => window.__chadverse.teleport(-80, 10)) // far past the west districts' cliff edge
  const s3 = await cv(() => window.__chadverse.world())
  check(s3.x >= -58.05, `world boundary clamps to the city edge (x=${s3.x.toFixed(2)})`)

  // 11 NPC interaction
  await cv(() => window.__chadverse.teleport(12.2, 1.6))
  await sleep(500)
  const pr = await cv(() => window.__chadverse.world().prompt)
  check(pr === 'coach', 'interaction prompt appears next to Coach Gourdon')
  if (mobile) await p.getByRole('button', { name: /Talk to Coach Gourdon/ }).click()
  else await p.keyboard.press('e')
  await p.waitForSelector('[data-testid=dialogue]')
  check(true, 'dialogue opens')
  const d0 = await cv(() => window.__chadverse.world())
  if (!mobile) {
    await p.keyboard.down('a')
    await sleep(400)
    await p.keyboard.up('a')
  }
  const d1 = await cv(() => window.__chadverse.world())
  check(Math.hypot(d1.x - d0.x, d1.z - d0.z) < 0.05, 'player cannot walk away mid-dialogue')
  await sleep(500)
  await p.screenshot({ path: `${out}/e2e-${tag}-dialogue.jpg`, quality: 70 })
  for (let i = 0; i < 8; i++) {
    if (await p.getByRole('button', { name: 'Take me to the gym' }).isVisible().catch(() => false)) break
    await p.click('[data-testid=dialogue]')
    await sleep(150)
  }

  // 12 enter gym via the dialogue option
  await p.getByRole('button', { name: 'Take me to the gym' }).click()
  await p.waitForFunction(() => window.__chadverse?.phase === 'gym' && window.__chadverse.gym()?.mode === 'free', null, { timeout: 15000 })
  await sleep(700)
  check(true, 'entered Chad Gym')
  // the gym is a walkable hall now: step onto the Chad Press platform and use it
  const useGym = async (id, label) => {
    await p.evaluate((id) => window.__chadverse.gymGoto(id), id)
    await sleep(500)
    if (mobile) await p.getByRole('button', { name: label }).click()
    else await p.keyboard.press('e')
  }
  await useGym('press', 'Chad Press — timing challenge')
  await p.waitForSelector('[data-testid=press-start]')
  await sleep(500)
  await p.screenshot({ path: `${out}/e2e-${tag}-gym.jpg`, quality: 70 })

  // 13 play: press when the marker is inside the gold zone (read from the DOM, like a player's eyes)
  await p.click('[data-testid=press-start]')
  await sleep(2400)
  for (let rep = 0; rep < 10; rep++) {
    await p.waitForFunction(() => document.querySelector('[data-testid=press-button]') && !document.querySelector('[data-testid=press-button]').disabled, null, { timeout: 6000 })
    if (rep === 4) await p.screenshot({ path: `${out}/e2e-${tag}-press.jpg`, quality: 70 })
    await p.evaluate(
      () =>
        new Promise((res) => {
          const bar = document.querySelector('[data-testid=press-bar]')
          const gold = bar.children[1]
          const marker = bar.children[2]
          const tick = () => {
            const g = gold.getBoundingClientRect()
            const mk = marker.getBoundingClientRect()
            const cx = mk.left + mk.width / 2
            if (cx > g.left + 1 && cx < g.right - 1) {
              document.querySelector('[data-testid=press-button]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
              res()
            } else requestAnimationFrame(tick)
          }
          tick()
        }),
    )
    await sleep(850)
  }
  await p.waitForSelector('[data-testid=press-final]', { timeout: 8000 })
  const final = +(await p.textContent('[data-testid=press-final]'))
  const xpText = await p.textContent('[data-testid=press-xp]')
  check(final > 0, `set completes with a score (${final})`)
  await sleep(600)
  await p.screenshot({ path: `${out}/e2e-${tag}-results.jpg`, quality: 70 })

  // 14-15 XP + achievements persisted
  const sv = await cv(() => JSON.parse(localStorage.getItem('pumpchad.chadverse.save')))
  const expectedXp = 20 + Math.floor(final / 10)
  check(xpText.includes(`+${expectedXp}`), `XP shown matches the formula (+${expectedXp})`)
  check(sv.progress.gymRuns === 1 && sv.progress.gymBest === final, 'run count and best score saved')
  check(sv.progress.achievements.includes('first_set'), 'First Set achievement saved')
  const xpBefore = sv.progress.xp

  await p.click('[data-testid=press-exit]')
  await p.waitForFunction(() => window.__chadverse?.gym()?.mode === 'free', null, { timeout: 8000 })
  check(true, 'Chad Press hands back to the gym floor')
  await useGym('exit', 'Back to Chad Square')
  await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 60000 })
  await sleep(600)
  const back = await cv(() => window.__chadverse.world())
  check(back.x > 10 && back.x < 14, 'returned to Chad Square at the gym door')
  check((await p.textContent('[data-testid=objective]')).includes('Explore'), 'objective advanced')

  if (!mobile) {
    await p.keyboard.press('Escape')
    await sleep(400)
    check(await p.getByRole('dialog', { name: 'Paused' }).isVisible(), 'Esc opens the pause menu')
    await p.keyboard.press('Escape')
    await sleep(500)
    const m0 = await cv(() => window.__chadverse.world())
    await p.keyboard.down('s')
    await sleep(600)
    await p.keyboard.up('s')
    const m1 = await cv(() => window.__chadverse.world())
    check(Math.hypot(m1.x - m0.x, m1.z - m0.z) > 0.8, 'movement works after closing the menu')
  }

  // 16-17 leave and return
  await p.reload({ waitUntil: 'networkidle' })
  await p.waitForSelector('[data-testid=enter-muted]', { timeout: 15000 })
  const welcome = await p.textContent('body')
  check(welcome.includes('Welcome back') && welcome.includes('Bone Daddy'), 'after reload: title greets the saved character')
  await p.click('[data-testid=enter-muted]')
  await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 60000 })
  const sv2 = await cv(() => window.__chadverse.save())
  check(sv2.progress.xp === xpBefore && sv2.character.appearance.species === 'skeleton', 'after reload: XP and character restored')
  if (errs.length) (await import('node:fs')).writeFileSync(`${out}/e2e-errors-${tag}.txt`, errs.join(' ===== '))
  check(errs.length === 0, `no console errors${errs.length ? ': ' + errs.join(' | ') : ''}`)
  await ctx.close()
}

// hostile / corrupt save
{
  const ctx = await b.newContext()
  const p = await ctx.newPage()
  const pe = []
  p.on('pageerror', (e) => pe.push(e.message))
  p.on('dialog', (d) => {
    pe.push('ALERT FIRED')
    d.dismiss()
  })
  await p.goto(base, { waitUntil: 'networkidle' })
  await p.evaluate(() => localStorage.setItem('pumpchad.chadverse.save', '{"version":1,"character":{"name":"<img src=x onerror=alert(1)>","appearance":{"species":"dragon"}},"progress":{"xp":"lots","achievements":[1,{}]}}'))
  await p.reload({ waitUntil: 'networkidle' })
  await p.waitForSelector('[data-testid=enter-muted]', { timeout: 15000 })
  const txt = await p.textContent('body')
  console.log('\n=== hostile save ===')
  check(!txt.includes('Welcome back') && pe.length === 0, 'malformed/hostile save discarded safely; game still boots, no script ran')
  await p.evaluate(() => localStorage.setItem('pumpchad.chadverse.save', 'not json{{{'))
  await p.reload({ waitUntil: 'networkidle' })
  await p.waitForSelector('[data-testid=enter-muted]', { timeout: 15000 })
  check(pe.length === 0, 'unparseable save handled without errors')
  await ctx.close()
}
await b.close()
console.log(`\n${failures ? failures + ' FAILURE(S)' : 'ALL CHECKS PASSED'}`)
process.exit(failures ? 1 : 0)
