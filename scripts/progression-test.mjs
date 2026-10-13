// Progression: pure rules (fatigue / daily roll / level-ups), save migration + tamper clamps, in-game fatigue,
// level-up banner, profile screen.   node scripts/progression-test.mjs   (dev server on :4318)
import { chromium } from 'playwright'
import { fatigueMult, levelsGained, rollDaily, setRewards, statLevel, today } from '../src/game/progression.ts'

let pass = 0
let fail = 0
const check = (ok, msg) => {
  ok ? pass++ : fail++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`)
}

console.log('\n══════ Progression rules ══════')
check(fatigueMult(0) === 1 && fatigueMult(2) === 1, 'sets 1–3 at a station pay in full')
check(fatigueMult(3) === 0.5 && fatigueMult(5) === 0.5, 'sets 4–6 pay half')
check(fatigueMult(6) === 0.1 && fatigueMult(60) === 0.1, 'sets 7+ pay 10%')
check(setRewards(20, 30, 9).xp === 2 && setRewards(3, 2, 9).xp === 1, 'a fatigued set still gives at least 1 XP')
const lv = (xp) => Math.floor(Math.sqrt(xp / 50)) + 1
check(levelsGained(45, 55, lv).join() === '2' && levelsGained(0, 460, lv).join() === '2,3,4' && levelsGained(60, 70, lv).length === 0, 'level-ups detected across one or several levels')
check(rollDaily({ day: '2000-01-01', sets: { bench: 9 } }).sets.bench === undefined && rollDaily({ day: today(), sets: { bench: 2 } }).sets.bench === 2, 'daily counters reset on a new day only')
check(statLevel(0) === 1 && statLevel(20) === 2 && statLevel(80) === 3, 'stat level curve')

const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1200, height: 800 } })
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)))
const URL = process.env.URL || 'http://localhost:4318/chadverse/'
const KEY = 'pumpchad.chadverse.save'
const w = (ms) => p.waitForTimeout(ms)
const save = () => p.evaluate(() => window.__chadverse.save())
const loadWith = async (data) => {
  await p.goto(URL, { waitUntil: 'networkidle' })
  await p.evaluate(([k, d]) => localStorage.setItem(k, JSON.stringify(d)), [KEY, data])
  await p.reload({ waitUntil: 'networkidle' })
}
const character = { name: 'Prog Test', appearance: { species: 'pumpkin', skin: '#e8741c', outfit: '#141216', glow: '#ffb347', top: 'shirtless', headwear: 'none', eyewear: 'shades', chain: true } }

console.log('\n══════ Save migration + tamper ══════')
// a save from before this update: no stamina / stats / daily / records
await loadWith({ version: 1, character, progress: { xp: 120, achievements: ['welcome'], gymBest: 300, gymRuns: 2, discoveries: ['seed_1'], strength: 40, reps: { bench: 10 } }, settings: {} })
let s = await save()
check(s.progress.xp === 120 && s.progress.strength === 40 && s.progress.reps.bench === 10, 'old save keeps its progress')
check(s.progress.stamina === 0 && s.progress.stats.sets === 0 && s.progress.daily.day === '' && Object.keys(s.progress.records).length === 0, 'old save gets the new fields with safe defaults')
// tampered values are clamped / dropped
await loadWith({ version: 1, character, progress: { xp: 10, stamina: 1e12, stats: { sets: -4, clean: 'x', bestCombo: 99999 }, daily: { day: '<script>', sets: { bench: -5, hack: 7 } }, records: { pumpkin_rush: 1e9, evil: 5 } }, settings: {} })
s = await save()
check(s.progress.stamina === 1e7, `huge stamina clamped (${s.progress.stamina})`)
check(s.progress.stats.sets === 0 && s.progress.stats.clean === 0 && s.progress.stats.bestCombo === 1000, 'bad workout stats sanitised')
check(s.progress.daily.day === '' && !('hack' in s.progress.daily.sets) && !('bench' in s.progress.daily.sets), 'bad daily data dropped')
check(s.progress.records.pumpkin_rush === 1e6 && !('evil' in s.progress.records), 'records whitelisted + clamped')

console.log('\n══════ In-game fatigue + level-up + profile ══════')
// 3 pull-up sets already done today and 45 XP (level 2 starts at 50): the next set is fatigued AND levels up
await loadWith({ version: 1, character, progress: { xp: 45, achievements: ['welcome'], gymBest: 0, gymRuns: 0, discoveries: ['talk_coach'], strength: 0, reps: {}, daily: { day: today(), sets: { pullup: 3 } } }, settings: { muted: true } })
await p.click('[data-testid=enter-muted]')
await p.getByRole('button', { name: /Enter Chad Square|Continue|Enter/ }).first().click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.playerInspect(), null, { timeout: 40000 })
await w(800)
await p.evaluate(() => window.__chadverse.teleport(14.4, -4))
await w(400)
await p.keyboard.press('e')
await p.waitForFunction(() => window.__chadverse?.phase === 'gym' && window.__chadverse.gym()?.mode === 'free', null, { timeout: 20000 })
await w(700)
await p.evaluate(() => window.__chadverse.gymGoto('pullup'))
await w(400)
await p.keyboard.press('e')
await p.waitForSelector('[data-testid=workout-start]', { timeout: 5000 })
await p.click('[data-testid=workout-start]')
await w(300)
const tapOnBeat = () =>
  p.evaluate(
    () =>
      new Promise((res) => {
        const btn = document.querySelector('[data-testid=workout-rep]')
        const ring = btn?.closest('.panel')?.querySelector('[class*="ring-bone"]')
        const t0 = performance.now()
        let armed = false
        const tick = () => {
          const m = /scale\(([\d.]+)\)/.exec(ring?.style.transform ?? '')
          const ph = m ? 1 - (parseFloat(m[1]) - 1) / 1.25 : 1
          if (ph < 0.6) armed = true
          if ((armed && ph > 0.95) || performance.now() - t0 > 4000) {
            btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
            res(ph)
          } else requestAnimationFrame(tick)
        }
        tick()
      }),
  )
for (let r = 0; r < 8; r++) {
  await p.waitForSelector('[data-testid=workout-rep]', { timeout: 5000 })
  await tapOnBeat()
}
await p.waitForSelector('[data-testid=workout-done]', { timeout: 6000 })
const fat = await p.locator('[data-testid=workout-fatigue]').textContent().catch(() => '')
check(/50%/.test(fat), `fatigue note on the 4th set today (${fat?.trim()})`)
s = await save()
check(s.progress.daily.sets.pullup === 4 && s.progress.stats.sets === 1 && s.progress.reps.pullup === 8, `daily + lifetime counters (daily ${s.progress.daily.sets.pullup}, sets ${s.progress.stats.sets}, reps ${s.progress.reps.pullup})`)
check(s.progress.strength > 0 && s.progress.strength <= 24, `strength at half rate (${s.progress.strength} ≤ 24 for 8 reps)`)
const banner = await p.waitForSelector('[data-testid=level-up]', { timeout: 3000 }).then(() => true, () => false)
check(banner && s.progress.xp >= 50, `LEVEL UP banner when crossing level 2 (xp ${s.progress.xp})`)
await p.screenshot({ path: `${process.env.SHOTS || '.'}/prog-levelup.jpg`, quality: 78 })
await p.click('[data-testid=workout-leave]')
await w(800)
await p.click('[data-testid=hud-profile]')
const prof = await p.waitForSelector('[data-testid=profile]', { timeout: 3000 }).then(() => true, () => false)
check(prof, 'HUD level badge opens the profile')
const lvTxt = await p.locator('[data-testid=profile-level]').textContent().catch(() => '')
check(lvTxt?.trim() === '2', `profile shows level ${lvTxt?.trim()}`)
const body = await p.locator('[role=dialog]').textContent()
check(/Stamina/.test(body) && /Pull-Ups/.test(body) && /50% today/.test(body), 'profile lists stats, stations and today\'s fatigue')
check(/no cash value/i.test(body), 'profile states there is no monetary value')
await p.screenshot({ path: `${process.env.SHOTS || '.'}/prog-profile.jpg`, quality: 78 })
await p.keyboard.press('Escape')
await w(400)
check(!(await p.locator('[data-testid=profile]').isVisible().catch(() => false)), 'Esc closes the profile')

check(errs.length === 0, `no console errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`)
console.log(fail ? `${fail} FAILURE(S)` : 'ALL CHECKS PASSED')
await b.close()
