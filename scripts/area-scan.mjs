// connected walkable area (1 m grid, flood-filled from the spawn) — compare with the documented baselines
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:4318/chadverse/'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 640, height: 400 } })
await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: {}, settings: { quality: 'low', muted: true } })))
await p.goto(BASE)
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Explorer')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
console.log(JSON.stringify(await p.evaluate(() => window.__chadverse.areaScan())))
await b.close()
