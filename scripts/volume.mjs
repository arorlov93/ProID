/** Объём текста по страницам: ТЗ задаёт 2 500–4 000 знаков без пробелов на
 *  посадочную и 4 000–7 000 на статью. Считаем по готовому HTML. */
import { readdir, readFile } from 'node:fs/promises';
import { join, extname, relative } from 'node:path';

async function walk(d, a = []) {
  for (const e of await readdir(d, { withFileTypes: true })) {
    const f = join(d, e.name);
    if (e.isDirectory()) await walk(f, a);
    else if (extname(e.name) === '.html') a.push(f);
  }
  return a;
}
const files = (await walk('dist')).sort();
const rows = [];
for (const f of files) {
  const html = await readFile(f, 'utf8');
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? html;
  const text = main
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ');
  const noSpace = text.replace(/\s/g, '').length;
  rows.push([('/' + relative('dist', f).replace(/\.html$/, '').replace(/^index$/, '')), noSpace]);
}
rows.sort((a, b) => b[1] - a[1]);
rows.forEach(([u, n]) => console.log(String(n).padStart(6), u));
console.log('ИТОГО'.padStart(6), rows.reduce((s, r) => s + r[1], 0), 'знаков без пробелов на', rows.length, 'страницах');
