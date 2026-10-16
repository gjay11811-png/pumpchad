// Chad Motors showroom + garage interiors: walk to the door (ordinary world teleport + E), enter, and photograph each car from fixed cameras (front, side, three-quarter).
//   SHOTS=dir SET=showroom|garage [Q=medium] node scripts/car-interior-shots.mjs     (SIMULATED browser, software GL)
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const OUT = process.env.SHOTS || '.'
const SET = process.env.SET || 'showroom'
const SETS = {
  // door spot in the world, then fixed cameras in the room's own frame
  showroom: {
    at: [54, 43.3],
    views: {
      'hero-front': [[-4.6 + 1.5, 1.2, 3.0], [-4.6, 0.8, -1.8], 44],
      'hero-side': [[-1.9, 1.9, -1.8], [-4.6, 0.8, -1.8], 46],
      'hero-34': [[-7.4, 1.6, 1.4], [-4.6, 0.8, -1.8], 46],
      'gt3p-front': [[0, 1.1, 2.0], [0, 0.8, -3.0], 44],
      'gt3p-side': [[-2.6, 1.8, -5.2], [0, 0.8, -3.0], 46],
      'gt3p-34': [[-3.0, 1.5, 0.5], [0, 0.8, -3.0], 46],
      'gt3o-front': [[4.6 - 1.5, 1.2, 3.0], [4.6, 0.8, -1.8], 44],
      'gt3o-side': [[1.9, 1.9, -1.8], [4.6, 0.8, -1.8], 46],
      'gt3o-34': [[7.6, 1.6, 1.4], [4.6, 0.8, -1.8], 46],
    },
  },
  garage: {
    at: [72.4, 43.2],
    views: {
      'lift-front': [[2.9, 1.5, -0.6], [-2.6, 2.2, -0.6], 44],
      'lift-side': [[-2.6, 1.9, 3.5], [-2.6, 2.1, -0.6], 46],
      'lift-34': [[0.9, 1.8, 3.2], [-2.6, 2.1, -0.6], 48],
      'floor-front': [[5.8, 1.1, -3.4], [3.3, 0.8, -1.5], 46],
      'floor-side': [[3.3, 1.2, 1.6], [3.3, 0.8, -1.5], 46],
      'floor-34': [[5.9, 1.6, 0.4], [3.3, 0.8, -1.5], 46],
    },
  },
}
const cfg = SETS[SET]
const b = await chromium.launch({
  executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe',
  args: (process.env.GLARGS ?? '--use-angle=swiftshader --enable-unsafe-swiftshader --disable-gpu-watchdog').split(' ').filter(Boolean),
})
const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
await p.addInitScript((q) => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'], xp: 800 }, settings: { quality: q, muted: true } })), process.env.Q || 'medium')
await p.goto(BASE)
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Visitor')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
await p.evaluate(([x, z]) => window.__chadverse.teleport(x, z, Math.PI), cfg.at)
await p.waitForTimeout(1200)
await p.keyboard.press('e')
await p.waitForFunction(() => window.__chadverse.phase === 'interior', null, { timeout: 60000 })
await p.waitForTimeout(9000) // the car models load a few seconds after the room
await p.evaluate(() => window.__chadverse.interiorTeleport(5.8, 4.0, 0)) // the player stands out of every camera's way
await p.addStyleTag({ content: '.panel, [data-testid=objective] { opacity: 0 !important }' })
const only = process.env.VIEWS ? process.env.VIEWS.split(',') : null
for (const [name, [c, l, fov]] of Object.entries(cfg.views)) {
  if (only && !only.includes(name)) continue
  await p.evaluate(([c, l, fov]) => window.__chadverse.shotCam({ cam: c, look: l, fov }), [c, l, fov])
  await p.waitForTimeout(1600)
  await p.screenshot({ path: `${OUT}/${SET}-${name}.jpg`, type: 'jpeg', quality: 86, timeout: 120000 })
  console.log('shot', name)
}
await b.close()
