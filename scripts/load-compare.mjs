// world load time + scene cost at the arrival spawn, closed (launch) vs ?expansion=open. Headless software GL: compare the two, not absolutes.
//   URLQ="?expansion=open" node scripts/load-compare.mjs
import { chromium } from 'playwright'
const BASE = (process.env.URL || 'http://localhost:4318/chadverse/') + (process.env.URLQ || '')
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 900, height: 600 } })
await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: {}, settings: { quality: 'medium', muted: true } })))
await p.goto(BASE)
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Explorer')
const t0 = Date.now()
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
const loadMs = Date.now() - t0
await p.waitForTimeout(4000)
const st = await p.evaluate(() => ({ ...window.__chadverse.stats(), mem: window.__chadverse.memAudit?.() }))
const s = Array.isArray(st) ? st[0] : st
const out = { mode: process.env.URLQ || 'closed', loadMs, ...s }
delete out.mem
const m = await p.evaluate(() => { const x = window.__chadverse.memAudit?.(); return x && { textures: x.textures, textureMB: x.textureMB, geometries: x.geometries, vertices: x.vertices, geometryMB: x.geometryMB, jsHeapMB: x.jsHeapMB } })
console.log(JSON.stringify({ ...out, ...m }))
await b.close()
