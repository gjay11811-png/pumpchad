// screenshot a GLB (served from the project root on :5190) from given azimuths: node scripts/glb-shot.mjs tmp-viewer/x.glb out-prefix az1,az2.. [el] [w] [h]
import { chromium } from 'playwright'
const [m, out, azs = '0,90', el = '10', w = '900', h = '600'] = process.argv.slice(2)
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog'] })
const p = await b.newPage({ viewport: { width: +w, height: +h } })
p.on('pageerror', (e) => console.log('pageerror', e.message))
for (const az of azs.split(',')) {
  await p.goto(`http://localhost:5190/tmp-viewer/viewer.html?m=/${m}&az=${az}&el=${el}&w=${w}&h=${h}`)
  await p.waitForFunction(() => window.__done, null, { timeout: 120000 })
  console.log(az, JSON.stringify(await p.evaluate(() => window.__done)))
  await p.screenshot({ path: `${out}-${az}.png` })
}
await b.close()
