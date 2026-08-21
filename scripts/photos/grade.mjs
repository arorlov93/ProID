/**
 * Единая обработка снимков.
 *
 * Премиальность набора даёт не удачный отдельный кадр, а то, что все
 * кадры выглядят снятыми в один день одной камерой. Поэтому обработка
 * здесь не фиксированный фильтр, а подтягивание каждого снимка
 * к общей цели: замеряем насыщенность и цветовую температуру,
 * считаем поправку, применяем, замеряем снова.
 *
 * Результат — AVIF и WebP в двух ширинах на роль плюс реестр
 * с источником и лицензией по каждому файлу.
 *
 *   node scripts/photos/grade.mjs            собрать всё по photos/chosen.json
 *   node scripts/photos/grade.mjs --measure  только замер, без записи
 */

import { mkdir, writeFile, readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RAW = join(ROOT, 'photos', 'raw');
const OUT = join(ROOT, 'public', 'photos');
const MEASURE_ONLY = process.argv.includes('--measure');

/* Замер по уменьшенной копии: 64 px хватает, чтобы поймать общий тон,
   и не хватает, чтобы отдельная яркая деталь перекосила среднее. */
async function measure(input) {
  const { data } = await sharp(input).resize(64, 64, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let sat = 0, r = 0, g = 0, b = 0;
  const n = data.length / 3;
  for (let i = 0; i < data.length; i += 3) {
    const R = data[i] / 255, G = data[i + 1] / 255, B = data[i + 2] / 255;
    const mx = Math.max(R, G, B), mn = Math.min(R, G, B), l = (mx + mn) / 2;
    sat += mx === mn ? 0 : l > 0.5 ? (mx - mn) / (2 - mx - mn) : (mx - mn) / (mx + mn);
    r += R; g += G; b += B;
  }
  return { sat: sat / n, temp: (r / n) / Math.max(b / n, 1e-6), lum: (r + g + b) / (3 * n) };
}

const RATIO = { '16:7': 16 / 7, '3:2': 3 / 2, '4:3': 4 / 3 };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Один конвейер и для замера, и для выдачи.
 *
 * Прежняя версия считала поправку по чистому кадру, а мерила результат
 * после контраста и виньетки — цикл сходился не к тому, что измеряется.
 * Теперь обе ветки идут через одну функцию, отличаясь только размером. */
function pipeline(input, { satMul, k, width, height }) {
  return sharp(input)
    .resize(width, height, { fit: 'cover', position: sharp.strategy.attention })
    .removeAlpha()
    /* Порядок не случаен: recomb сильно поднимает насыщенность как
       побочный эффект, а modulate почти не двигает температуру. Значит
       сперва ставим температуру, потом — насыщенность поверх неё. */
    .recomb([[k, 0, 0], [0, 1, 0], [0, 0, 1 / k]])
    .modulate({ saturation: satMul })
    /* Небольшой подъём контраста: на глаз почти незаметно, но приводит
       разные исходники к общей плотности. */
    .linear(1.06, -6)
    .composite([{ input: vignette(width, height), blend: 'multiply' }]);
}

/** Поправка к общей цели.
 *
 * Оси связаны: усиление красного канала ради температуры само по себе
 * поднимает насыщенность, иногда в разы. Поэтому не решаем обе задачи
 * одновременно — сначала выставляем температуру, затем поверх неё
 * насыщенность, и один раз уточняем температуру после.
 *
 * Возвращает ещё и признак fits: снимок, который не встал в коридор
 * в разумных пределах, набору не подходит. Такой надо менять, а не
 * выкручивать до неестественного цвета.
 */
async function correction(srcPath, target, ratio) {
  const w = 96, h = Math.round(w / ratio);
  const probe = async (satMul, k) =>
    measure(await pipeline(srcPath, { satMul, k, width: w, height: h }).jpeg({ quality: 92 }).toBuffer());

  let satMul = 1, k = 1;

  const solveK = async () => {
    for (let i = 0; i < 8; i++) {
      const m = await probe(satMul, k);
      const d = clamp(Math.sqrt(target.temperature / Math.max(m.temp, 1e-3)), 0.96, 1.05);
      if (Math.abs(m.temp / target.temperature - 1) < 0.02) break;
      k = clamp(k * d, 0.82, 1.22);
    }
  };
  const solveSat = async () => {
    for (let i = 0; i < 8; i++) {
      const m = await probe(satMul, k);
      const d = clamp(target.saturation / Math.max(m.sat, 1e-3), 0.75, 1.35);
      if (Math.abs(m.sat / target.saturation - 1) < 0.05) break;
      satMul = clamp(satMul * d, 0.5, 1.9);
    }
  };

  await solveK();
  await solveSat();
  await solveK();
  await solveSat();

  const final = await probe(satMul, k);
  const fits =
    Math.abs(final.sat / target.saturation - 1) < 0.25 && Math.abs(final.temp / target.temperature - 1) < 0.06;

  return { satMul, k, fits, reached: final };
}

/** Виньетка отдельным слоем: мягкое затемнение краёв, без чёрной рамки. */
function vignette(w, h) {
  return Buffer.from(
    `<svg width="${w}" height="${h}"><defs><radialGradient id="v" cx="50%" cy="46%" r="72%">` +
      `<stop offset="55%" stop-color="#fff"/><stop offset="100%" stop-color="#b9b9b9"/>` +
      `</radialGradient></defs><rect width="${w}" height="${h}" fill="url(#v)"/></svg>`,
  );
}

async function render(theme, srcPath, role, roles, targets) {
  const ratio = RATIO[roles[role].ratio];
  const before = await measure(srcPath);
  if (MEASURE_ONLY) return { theme: theme.id, before };

  const c = await correction(srcPath, targets, ratio);
  const files = [];

  for (const width of roles[role].widths) {
    const height = Math.round(width / ratio);
    const base = pipeline(srcPath, { ...c, width, height });
    for (const [fmt, opts] of [
      ['avif', { quality: 52, effort: 5 }],
      ['webp', { quality: 80, effort: 5 }],
    ]) {
      const name = `${theme.id}-${width}.${fmt}`;
      const buf = await base.clone()[fmt](opts).toBuffer();
      await writeFile(join(OUT, name), buf);
      files.push({ file: `/photos/${name}`, width, height, format: fmt, bytes: buf.length });
    }
  }

  /* Замер после — по самой большой webp, то есть по тому, что видит
     посетитель, а не по промежуточному буферу. */
  const biggest = files.filter((f) => f.format === 'webp').sort((a, b) => b.width - a.width)[0];
  const after = await measure(join(OUT, biggest.file.split('/').pop()));
  return { theme: theme.id, before, after, correction: c, files };
}

const cfg = JSON.parse(await readFile(join(ROOT, 'photos', 'themes.json'), 'utf8'));
const chosenPath = join(ROOT, 'photos', 'chosen.json');
const chosen = existsSync(chosenPath) ? JSON.parse(await readFile(chosenPath, 'utf8')) : {};

await mkdir(OUT, { recursive: true });

const report = [];
const registry = [];

for (const t of cfg.themes) {
  const dir = join(RAW, t.id);
  if (!existsSync(dir)) {
    console.warn(`${t.id}: кандидатов нет — сначала fetch.mjs`);
    continue;
  }
  const pick = chosen[t.id];
  const files = (await readdir(dir)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
  const file = pick || files[0];
  if (!file) {
    console.warn(`${t.id}: не из чего выбирать`);
    continue;
  }
  if (!pick) console.warn(`${t.id}: выбор не сделан, взят ${file} — проверьте по контактному листу`);

  const meta = JSON.parse(await readFile(join(dir, 'candidates.json'), 'utf8')).find((c) => c.file === file) || {};
  const res = await render(t, join(dir, file), t.role, cfg.roles, cfg.targets);
  report.push(res);

  if (!MEASURE_ONLY) {
    registry.push({
      id: t.id,
      page: t.page,
      role: t.role,
      alt: '',
      caption: '',
      want: t.want,
      files: res.files,
      source: meta.source || '',
      author: meta.author || '',
      license: meta.license || '',
      licenseUrl: meta.licenseUrl || '',
      provider: meta.provider || '',
    });
  }
}

const spread = (key, stage) => {
  const v = report.map((r) => r[stage]?.[key]).filter((x) => typeof x === 'number');
  if (!v.length) return '—';
  return `${Math.min(...v).toFixed(3)}–${Math.max(...v).toFixed(3)} (разброс ${(Math.max(...v) - Math.min(...v)).toFixed(3)})`;
};

console.log('\nНасыщенность  до:', spread('sat', 'before'), ' после:', spread('sat', 'after'));
console.log('Температура   до:', spread('temp', 'before'), ' после:', spread('temp', 'after'));

const misfit = report.filter((r) => r.correction && !r.correction.fits);
console.log(
  misfit.length
    ? `\nНе встали в коридор и требуют замены кадра: ${misfit.map((r) => r.theme).join(', ')}`
    : '\nВсе кадры встали в коридор.',
);

if (!MEASURE_ONLY) {
  await writeFile(join(ROOT, 'photos', 'registry.json'), JSON.stringify(registry, null, 2));
  const heavy = registry.flatMap((r) => r.files).filter((f) => f.bytes > 200 * 1024);
  const total = registry.flatMap((r) => r.files).reduce((s, f) => s + f.bytes, 0);
  console.log(`\nФайлов: ${registry.flatMap((r) => r.files).length}, общий вес ${(total / 1048576).toFixed(2)} МБ`);
  console.log(heavy.length ? `Тяжелее 200 КБ: ${heavy.map((f) => f.file).join(', ')}` : 'Тяжелее 200 КБ: нет');
  console.log('Реестр: photos/registry.json — alt и подписи заполняются вручную.');
}
