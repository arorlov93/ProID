/**
 * Контактный лист кандидатов — photos/sheet.html.
 *
 * Выбор кадра нельзя сделать по названию файла: решает то, что видно.
 * Лист показывает всех кандидатов темы рядом, с лицензией и автором,
 * и по клику копирует строку для photos/chosen.json.
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RAW = join(ROOT, 'photos', 'raw');

const cfg = JSON.parse(await readFile(join(ROOT, 'photos', 'themes.json'), 'utf8'));
const esc = (s = '') => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);

let body = '';
let total = 0;

for (const t of cfg.themes) {
  const dir = join(RAW, t.id);
  if (!existsSync(dir)) continue;
  const meta = existsSync(join(dir, 'candidates.json'))
    ? JSON.parse(await readFile(join(dir, 'candidates.json'), 'utf8'))
    : [];
  const files = (await readdir(dir)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
  if (!files.length) continue;
  total += files.length;

  body += `<section><h2>${esc(t.id)} <small>${esc(t.page)} · ${esc(t.role)}</small></h2>`;
  body += `<p class="want">${esc(t.want)}</p><div class="grid">`;
  for (const f of files) {
    const m = meta.find((x) => x.file === f) || {};
    const rel = relative(join(ROOT, 'photos'), join(dir, f));
    body += `<figure data-pick='"${esc(t.id)}": "${esc(f)}",'>
      <img src="${esc(rel)}" loading="lazy" alt="">
      <figcaption><b>${esc(f)}</b><br>${esc(m.license || 'лицензия?')} · ${esc(m.author || 'автор?')}<br>
      <span class="q">${esc(m.query || '')}</span></figcaption></figure>`;
  }
  body += '</div></section>';
}

const html = `<!doctype html><meta charset="utf-8"><title>Кандидаты — ПроПТО</title>
<style>
 body{font:15px/1.5 system-ui,sans-serif;margin:0;padding:24px;background:#f6f5f3;color:#1a1a1a}
 h1{margin:0 0 4px} h2{margin:32px 0 4px;font-size:19px} h2 small{font-weight:400;color:#666;font-size:13px}
 .want{margin:0 0 10px;color:#555;max-width:70ch}
 .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}
 figure{margin:0;background:#fff;border:1px solid #ddd;border-radius:6px;overflow:hidden;cursor:pointer}
 figure:hover{border-color:#333} figure.on{outline:3px solid #2b6cb0}
 img{width:100%;height:170px;object-fit:cover;display:block;background:#eee}
 figcaption{padding:8px 10px;font-size:12px;line-height:1.4;color:#444}
 .q{color:#888} .bar{position:sticky;top:0;background:#f6f5f3;padding:8px 0;z-index:2}
 textarea{width:100%;height:120px;font:12px/1.4 ui-monospace,monospace}
</style>
<h1>Кандидаты: ${total} снимков</h1>
<p>Клик по кадру — строка уходит в поле внизу. Скопируйте его в <code>photos/chosen.json</code>.</p>
<div class="bar"><textarea id="out" readonly>{\n}</textarea></div>
${body}
<script>
 const picked = new Map();
 document.querySelectorAll('figure').forEach(f => f.addEventListener('click', () => {
   const line = f.dataset.pick, id = line.split('"')[1];
   document.querySelectorAll('figure').forEach(o => { if (o.dataset.pick.split('"')[1] === id) o.classList.remove('on'); });
   picked.set(id, line); f.classList.add('on');
   document.getElementById('out').value = '{\\n  ' + [...picked.values()].join('\\n  ').replace(/,$/, '') + '\\n}';
 }));
</script>`;

await writeFile(join(ROOT, 'photos', 'sheet.html'), html);
console.log(`photos/sheet.html — ${total} кандидатов. Откройте в браузере и выберите кадры.`);
