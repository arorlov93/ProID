import sharp from 'sharp';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const dir = process.argv[2] || 'dist/scene';
const out = process.argv[3] || '/tmp/scenes.png';
const cell = Number(process.argv[4] || 560);
const cols = Number(process.argv[5] || 2);

const files = (await readdir(dir)).filter((f) => f.includes('-900.webp')).sort();
const tiles = [];
for (const f of files) {
  const buf = await sharp(join(dir, f))
    .resize({ width: cell, height: Math.round(cell * 0.7), fit: 'contain', background: '#000' })
    .toBuffer();
  tiles.push({ name: f, buf });
}
const rows = Math.ceil(tiles.length / cols);
const ch = Math.round(cell * 0.7);
const canvas = sharp({
  create: { width: cols * cell, height: rows * ch, channels: 3, background: '#111' },
});
await canvas
  .composite(
    tiles.map((t, i) => ({
      input: t.buf,
      left: (i % cols) * cell,
      top: Math.floor(i / cols) * ch,
    })),
  )
  .png()
  .toFile(out);
console.log(files.join('\n'));
