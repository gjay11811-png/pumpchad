// Which shader programs does entering the world compile? Hooks linkProgram and records each program's
// SHADER_NAME + a hash of its defines, so two builds can be diffed.
//   URL=http://localhost:4318/chadverse/ node scripts/program-census.mjs > a.txt
import { chromium } from 'playwright'
const url = process.env.URL || 'http://localhost:4318/chadverse/'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
await p.addInitScript(() => {
  const src = new WeakMap()
  const progs = (window.__progs = [])
  for (const C of [WebGL2RenderingContext, WebGLRenderingContext]) {
    const ss = C.prototype.shaderSource
    C.prototype.shaderSource = function (sh, s) {
      src.set(sh, s)
      return ss.call(this, sh, s)
    }
    const as = C.prototype.attachShader
    C.prototype.attachShader = function (pr, sh) {
      ;(pr.__sh ||= []).push(src.get(sh) || '')
      return as.call(this, pr, sh)
    }
    const lp = C.prototype.linkProgram
    C.prototype.linkProgram = function (pr) {
      const v = (pr.__sh || [])[0] || ''
      const name = (v.match(/#define SHADER_NAME (\S+)/) || [])[1] || (v.includes('DEPTH_PACKING') ? 'depth' : '?')
      const defs = (v.match(/#define [A-Z_0-9]+( [^\n]*)?/g) || []).filter((d) => !/SHADER_NAME|PRECISION|VERSION/.test(d))
      progs.push(`${name} | ${defs.join(' ').slice(0, 400)}`)
      return lp.call(this, pr)
    }
  }
})
await p.goto(url, { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.clear())
await p.reload({ waitUntil: 'networkidle' })
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Census')
const before = await p.evaluate(() => window.__progs.length)
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 90000, polling: 50 })
await p.waitForTimeout(3000)
const all = await p.evaluate(() => window.__progs)
const world = all.slice(before)
console.log(`# programs linked entering the world: ${world.length}`)
for (const l of world.sort()) console.log(l)
await b.close()
