// Kingdom v4 interactions: notice board, fountain lore, talking gourds (one-time), Pip the guide, b4s, wardrobe,
// lookout, plaza benches, environmental prompts. Checks prompts, open/close, no overlap, no repeat XP.
//   SHOTS=dir URL=http://localhost:4318/chadverse/ node scripts/kingdom-interact-test.mjs
import { chromium } from 'playwright'
const out = process.env.SHOTS
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1100, height: 760 } })
const errs = []
let fails = 0
const check = (ok, msg) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fails++ }
p.on('pageerror', (e) => errs.push(e.message))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)))
await p.goto(process.env.URL || 'http://localhost:4318/chadverse/', { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.clear())
await p.reload({ waitUntil: 'networkidle' })
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Kingdom Test')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.playerInspect(), null, { timeout: 60000 })
await p.waitForTimeout(1500)

const save = () => p.evaluate(() => window.__chadverse.save().progress)
const promptText = () => p.evaluate(() => document.querySelector('[data-testid=prompt]')?.textContent ?? '')
const dialogues = () => p.locator('[data-testid=dialogue]').count()
const go = async (x, z, yaw) => {
  await p.evaluate(([x, z, yaw]) => window.__chadverse.teleport(x, z, yaw), [x, z, yaw])
  await p.waitForTimeout(700)
}
/** walk up, check the prompt, press E, check a single dialogue opened, close it with Escape */
const talk = async (name, x, z, yaw, label, shot) => {
  await go(x, z, yaw)
  const pt = await promptText()
  check(pt.includes(label), `${name}: prompt "${label}" (got "${pt}")`)
  await p.keyboard.press('e')
  await p.waitForTimeout(600)
  const n = await dialogues()
  check(n === 1, `${name}: exactly one dialogue opens (${n})`)
  const text = n ? await p.locator('[data-testid=dialogue]').innerText() : ''
  if (shot && out) await p.screenshot({ path: `${out}/int-${shot}.jpg`, quality: 78 })
  await p.keyboard.press('Escape')
  await p.waitForTimeout(500)
  check((await dialogues()) === 0, `${name}: Escape closes it`)
  return text
}

// ── fountain lore: discovered once, toast once
const xp0 = (await save()).xp
let t = await talk('fountain', 0, 7.3, Math.PI, 'fountain', 'fountain')
let s = await save()
check(s.discoveries.includes('lore_fountain'), 'fountain: lore_fountain discovered')
const xp1 = s.xp
await talk('fountain again', 0, 7.3, Math.PI, 'fountain')
s = await save()
check(s.xp === xp1, `fountain: no repeat XP (${xp0} → ${xp1} → ${s.xp})`)

// ── notice board panel
await go(5.7, 22.4, Math.PI)
check((await promptText()).includes('notice board'), 'board: prompt shown')
await p.keyboard.press('e')
await p.waitForTimeout(700)
const now = await p.locator('[data-testid=board-now]').innerText().catch(() => '')
const soon = await p.locator('[data-testid=board-soon]').innerText().catch(() => '')
check(/Gym/i.test(now) && /Rush/i.test(now), 'board: "what\'s on" lists the gym + Pumpkin Rush')
check(/Castle/i.test(soon) && /Casino/i.test(soon) && /No real money/i.test(soon), 'board: unreleased places only under "coming soon", casino says no real money')
check(!/Casino/i.test(now) && !/Arcade/i.test(now), 'board: nothing unreleased listed as available')
check((await dialogues()) === 0, 'board: no dialogue overlaps the panel')
if (out) await p.screenshot({ path: `${out}/int-board.jpg`, quality: 78 })
await p.keyboard.press('Escape')
await p.waitForTimeout(500)
check((await p.locator('[data-testid=board-now]').count()) === 0, 'board: Escape closes it')
await p.waitForTimeout(600)
check((await p.locator('[data-testid=board-now]').count()) === 0, 'board: stays closed after Escape (no repeat-fire)')

// ── talking gourds: each one discovered once, achievement at 3, no repeat XP
const G = [
  ['gourd_1', -8.4, 16.95, Math.PI, 'Sage Gourd'],
  ['gourd_2', -28.8, -6.1, 0, 'Grumpy Gourd'],
  ['gourd_3', 3.7, -25.45, 0, 'Tiny Gourd'],
]
for (const [id, x, z, yaw, name] of G) {
  await talk(id, x, z, yaw, name, id)
  s = await save()
  check(s.discoveries.includes(id), `${id}: discovered`)
}
check(s.achievements.includes('gourd_council'), 'gourds: gourd_council unlocked after all three')
const xpG = s.xp
await talk('gourd_1 again', -8.4, 16.95, Math.PI, 'Sage Gourd')
check((await save()).xp === xpG, 'gourds: no repeat XP on a second chat')

// ── NPCs: Pip the guide and b4s (renamed, seated)
t = await talk('guide', -27, 0.7, Math.PI, 'Pip', 'guide')
check(/pip/i.test(t) && /guide/i.test(t), 'guide: Pip, the village guide, speaks')
t = await talk('b4s', -5.2, 7.2, Math.PI * 0.75, 'b4s', 'b4s')
check(t.includes('b4s') && !t.includes('Sir Hodl'), 'b4s: dialogue uses the new name')
check(!t.includes('B4S'), 'b4s: name shown lowercase, exactly "b4s"')
check(await p.evaluate(() => !document.body.innerText.includes('Sir Hodl')), 'b4s: "Sir Hodl" appears nowhere on screen')

// ── lookout + environmental prompts
await talk('lookout', -5.4, 33.2, 0, 'view', 'lookout')
check((await save()).discoveries.includes('lookout'), 'lookout: discovered')
await talk('castle gate', 0, -27.4, Math.PI, 'castle gate')
await talk('city sign', 2.9, 31.0, 0, 'Chad City')

// ── plaza bench (the free one at NE), sit + stand
await go(5.55, 5.55, -Math.PI * 0.75)
check((await promptText()).includes('Sit by the fountain'), 'plaza bench: prompt shown')
await p.keyboard.press('e')
await p.waitForFunction(() => window.__chadverse.seat()?.phase === 'sit', null, { timeout: 8000 }).catch(() => {})
check((await p.evaluate(() => window.__chadverse.seat()))?.phase === 'sit', 'plaza bench: sits down')
if (out) await p.screenshot({ path: `${out}/int-plaza-bench.jpg`, quality: 78 })
await p.keyboard.down('s')
await p.waitForTimeout(250)
await p.keyboard.up('s')
await p.waitForFunction(() => window.__chadverse.seat() === null, null, { timeout: 8000 }).catch(() => {})
check((await p.evaluate(() => window.__chadverse.seat())) === null, 'plaza bench: stands back up, not trapped')
// b4s's own bench is not sittable
await go(-5.55, 5.55, Math.PI * 0.75)
check(!(await promptText()).includes('Sit'), 'b4s bench: no sit prompt (b4s is sitting there)')

// ── wardrobe stall: dialogue, then the option opens the creator (no purchases)
await go(-24, 5.0, 0)
check((await promptText()).toLowerCase().includes('wardrobe'), 'wardrobe: prompt shown')
await p.keyboard.press('e')
await p.waitForTimeout(600)
// click through to the options
for (let i = 0; i < 8 && !(await p.getByRole('button', { name: /Open the wardrobe/ }).count()); i++) {
  await p.locator('[data-testid=dialogue]').click()
  await p.waitForTimeout(350)
}
const body = await p.evaluate(() => document.body.innerText)
check(!/\b(buy|purchase|\$|£)\b/i.test(body.replace(/No real money/gi, '')), 'wardrobe: no buy/price wording')
await p.getByRole('button', { name: /Open the wardrobe/ }).click()
await p.waitForFunction(() => window.__chadverse.phase === 'creator', null, { timeout: 15000 }).catch(() => {})
check((await p.evaluate(() => window.__chadverse.phase)) === 'creator', 'wardrobe: opens the character wardrobe')

check(errs.length === 0, `no page errors (${JSON.stringify(errs)})`)
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED')
await b.close()
process.exit(fails ? 1 : 0)
