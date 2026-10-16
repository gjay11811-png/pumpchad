// joins the numbered JPEG frames of one take into a .webm with Playwright's bundled ffmpeg (VP8): node scripts/bike-encode.mjs <framesDir> <out.webm> [fps]
import { spawn } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
const [dir, out, fps = '12'] = process.argv.slice(2)
const files = readdirSync(dir).filter((f) => f.endsWith('.jpg')).sort()
const ff = process.env.LOCALAPPDATA + '/ms-playwright/ffmpeg-1011/ffmpeg-win64.exe'
const enc = spawn(ff, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', fps, '-c:v', 'mjpeg', '-i', 'pipe:0', '-c:v', 'libvpx', '-b:v', '2500k', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] })
for (const f of files) if (!enc.stdin.write(readFileSync(dir + '/' + f))) await new Promise((r) => enc.stdin.once('drain', r))
enc.stdin.end()
await new Promise((r) => enc.on('close', r))
console.log(`encoded ${files.length} frames -> ${out}`)
