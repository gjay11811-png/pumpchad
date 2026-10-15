// Companion close-ups: each pet standing beside PumpChad on open ground, from the front-quarter, at the gameplay camera's distance and a closer zoom.
//   SHOTS=dir TAG=pets node scripts/pet-shots.mjs [cat,ghost,bat,pumpkin]
import { chromium } from 'playwright'
const out = process.env.SHOTS || '.'
const tag = process.env.TAG || 'pets'
const kinds = (process.argv[2] || 'cat,ghost,bat,pumpkin').split(',')
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
for (const kind of kinds) {
  const p = await b.newPage({ viewport: { width: 1000, height: 640 } })
  await p.addInitScript((k) => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'], owned: [`pet_${k}`], pet: `pet_${k}`, coins: 50 }, settings: { quality: 'high', muted: true } })), kind)
  await p.goto(process.env.URL || 'http://localhost:4318/chadverse/')
  await p.click('[data-testid=enter-muted]')
  await p.waitForSelector('[role=tablist]')
  await p.getByRole('tab', { name: 'Name' }).click()
  await p.fill('#chad-name', 'Explorer')
  await p.getByRole('button', { name: /Enter Chad Square/ }).click()
  await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
  const C = (fn, ...a) => p.evaluate(([f, a]) => window.__chadverse[f](...a), [fn, a])
  await C('teleport', 0, 24, Math.PI)
  await p.waitForTimeout(2500)
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))
  // look at the pet's side (it stands at the player's right shoulder): camera ~35 degrees off the front
  for (let i = 0; i < 5; i++) {
    const w = await C('world')
    const e = wrap(w.yaw + 0.55 - w.camYaw)
    if (Math.abs(e) < 0.05) break
    await p.mouse.move(500, 220); await p.mouse.down(); await p.mouse.move(500 + Math.max(-300, Math.min(300, -e / 0.006)), 220, { steps: 4 }); await p.mouse.up()
    await p.waitForTimeout(300)
  }
  await p.waitForTimeout(1200)
  await p.screenshot({ path: `${out}/${tag}-${kind}.jpg`, type: 'jpeg', quality: 88 })
  console.log('shot', kind)
  await p.close()
}
await b.close()
