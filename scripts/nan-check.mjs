// Focused check for the Hollow House "Computed radius is NaN" warning: enter the house, scan the live scene for meshes whose
// geometry has non-finite positions, and report the offenders (type, parameters, world position).
//   URL=http://localhost:4318/chadverse/ node scripts/nan-check.mjs [houseId]
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:4318/chadverse/'
const HOUSE = process.argv[2] || 'hollow'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 900, height: 600 } })
const warns = []
p.on('console', (m) => m.type() !== 'log' && m.text().includes('NaN') && warns.push(m.text().slice(0, 140)))
await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: {}, settings: { quality: 'low', muted: true } })))
await p.goto(BASE)
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Scanner')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 90000 })
const C = (fn, ...a) => p.evaluate(([f, a]) => window.__chadverse[f](...a), [fn, a])
console.log('world scene NaN meshes:', JSON.stringify(await C('nanScan')))
const h = (await C('houses')).find((x) => x.id === HOUSE)
await C('teleport', h.door.x, h.door.z, h.door.yaw + Math.PI)
await p.waitForTimeout(900)
await p.keyboard.press('e')
await p.waitForFunction(() => window.__chadverse.phase === 'interior' && window.__chadverse.interior(), null, { timeout: 30000 })
await p.waitForTimeout(1500)
console.log(`interior ${HOUSE} NaN meshes:`, JSON.stringify(await C('nanScan')))
console.log('console NaN warnings:', warns.length, warns.slice(0, 3))
await b.close()
