// frames → contact sheet:  DIR=... TAG=seq COLS=6 FROM=0 TO=99 node scripts/strip.mjs out.jpg
import { createRequire } from 'node:module'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
const require = createRequire(join(process.env.TEMP, 'gtf', 'noop.js'))
const sharp = require('sharp')
const dir = process.env.DIR, tag = process.env.TAG || 'seq', cols = +(process.env.COLS || 6)
const from = +(process.env.FROM || 0), to = +(process.env.TO || 999)
const files = readdirSync(dir).filter((f) => f.startsWith(tag + '-f') && f.endsWith('.jpg')).sort().slice(from, to)
const TW = 320, TH = 180
const tiles = []
for (let i = 0; i < files.length; i++) tiles.push({ input: await sharp(join(dir, files[i])).resize(TW, TH, { fit: 'cover' }).toBuffer(), left: (i % cols) * (TW + 4), top: Math.floor(i / cols) * (TH + 4) })
await sharp({ create: { width: cols * (TW + 4), height: Math.ceil(files.length / cols) * (TH + 4), channels: 3, background: '#111' } }).composite(tiles).jpeg({ quality: 80 }).toFile(process.argv[2])
console.log(files.length)
