// Génère les icônes de l'application sans dépendance : encodeur PNG minimal
// (RGBA, sans filtre). Produit build/icon.png (256) et build/tray.png (32).
//
//   node scripts/generate-assets.mjs

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const body = Buffer.concat([typeBuf, data])
  const out = Buffer.alloc(8 + data.length + 4)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE(crc32(body), 8 + data.length)
  return out
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0 // filtre "none"
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const NAVY = [0x09, 0x14, 0x28, 0xff]
const GOLD = [0xc8, 0xaa, 0x6e, 0xff]
const GOLD_DK = [0x78, 0x5a, 0x28, 0xff]
const CLEAR = [0, 0, 0, 0]

function render(size) {
  const buf = Buffer.alloc(size * size * 4)
  const c = (size - 1) / 2
  const put = (x, y, [r, g, b, a]) => {
    const i = (y * size + x) * 4
    buf[i] = r
    buf[i + 1] = g
    buf[i + 2] = b
    buf[i + 3] = a
  }
  const border = Math.max(1, Math.round(size * 0.06))
  const diamondR = size * 0.34
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const edge = Math.min(x, y, size - 1 - x, size - 1 - y)
      const manh = Math.abs(x - c) + Math.abs(y - c)
      if (edge < border * 0.5) put(x, y, CLEAR)
      else if (edge < border) put(x, y, GOLD_DK)
      else if (Math.abs(manh - diamondR) < border * 0.9) put(x, y, GOLD)
      else if (manh < diamondR) put(x, y, [0x0a, 0x1a, 0x2f, 0xff])
      else put(x, y, NAVY)
    }
  }
  return encodePng(size, size, buf)
}

for (const [name, size] of [
  ['build/icon.png', 256],
  ['build/tray.png', 32],
]) {
  const file = resolve(ROOT, name)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, render(size))
  console.log('écrit', name)
}
