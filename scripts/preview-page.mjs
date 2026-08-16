/**
 * Собирает одну страницу сборки в самодостаточный HTML для показа заказчику.
 *
 * Зачем: готовый сайт — это 24 файла плюс каталог со скриптами, а показать надо
 * одной ссылкой. Скрипты сшиваются esbuild в один блок, внешние ссылки на
 * иконки и манифест убираются, вёрстка и стили остаются ровно теми же, что
 * в production-сборке. Ничего не перерисовываем — показываем как есть.
 *
 * Запуск: node scripts/preview-page.mjs [страница] [файл-результат]
 *   node scripts/preview-page.mjs index /tmp/preview-index.html
 */
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { build } from 'esbuild';

const page = process.argv[2] || 'index';
const out = process.argv[3] || `/tmp/preview-${page.replace(/\//g, '-')}.html`;

const html = await readFile(join('dist', `${page}.html`), 'utf8');

/* ── Скрипты страницы сшиваем в один самодостаточный блок ─────────────────── */
const srcs = [...html.matchAll(/<script type="module" src="(\/_astro\/[^"]+)"><\/script>/g)];
const tmp = await mkdtemp(join(tmpdir(), 'profid-'));
const entry = join(tmp, 'entry.mjs');
await writeFile(entry, srcs.map(([, s]) => `import ${JSON.stringify('../..' + join(process.cwd(), 'dist', s))};`).join('\n'));

const bundled = await build({
  stdin: {
    contents: srcs.map(([, s]) => `import ${JSON.stringify(join(process.cwd(), 'dist', s))};`).join('\n'),
    resolveDir: process.cwd(),
    loader: 'js',
  },
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
  target: 'es2020',
});
await rm(tmp, { recursive: true, force: true });
const js = bundled.outputFiles[0].text;

/* ── Разбираем документ ───────────────────────────────────────────────────── */
const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? 'ПрофИД';
const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
const inlineHead = [...html.matchAll(/<script>(document\.documentElement[\s\S]*?)<\/script>/g)]
  .map((m) => m[1])
  .join('\n');
let body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/)?.[1] ?? '';

// Внешние файлы недоступны в превью — убираем, чтобы не ловить пустые запросы.
body = body
  .replace(/<script type="module" src="\/_astro\/[^"]+"><\/script>/g, '')
  .replace(/<link rel="(icon|apple-touch-icon|manifest|mask-icon)"[^>]*>/g, '');

/* ── Подсказка про внутренние ссылки ──────────────────────────────────────────
   В превью живёт одна страница из двадцати четырёх, и переход по ссылке привёл
   бы в никуда. Перехватываем и объясняем вместо пустой ошибки. */
const hint = `
<div class="pv-hint" id="pv-hint" role="status" aria-live="polite" hidden>
  <span class="pv-hint-t"></span>
  <span class="pv-hint-d">В превью открыта одна страница из 24. Остальные — в скриншотах и в репозитории.</span>
</div>
<style>
  .pv-hint {
    position: fixed;
    left: 50%;
    bottom: 24px;
    transform: translate(-50%, 16px);
    z-index: 200;
    display: grid;
    gap: 4px;
    max-width: min(440px, calc(100vw - 32px));
    padding: 14px 20px;
    background: #1e242c;
    border: 1px solid #333c48;
    border-left: 3px solid #e0a94a;
    border-radius: 12px;
    box-shadow: 0 24px 64px rgb(0 0 0 / 0.42);
    color: #f2f4f6;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.24s cubic-bezier(0.2, 0.7, 0.3, 1), transform 0.24s cubic-bezier(0.2, 0.7, 0.3, 1);
  }
  .pv-hint[hidden] { display: none; }
  .pv-hint.on { opacity: 1; transform: translate(-50%, 0); }
  .pv-hint-t { font-size: 14.5px; font-weight: 600; color: #e0a94a; }
  .pv-hint-d { font-size: 13px; line-height: 1.5; color: #a6afbb; }
  @media (prefers-reduced-motion: reduce) {
    .pv-hint { transition: none; }
  }
</style>
<script>
  (function () {
    var box = document.getElementById('pv-hint');
    var t;
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="/"]');
      if (!a) return;
      e.preventDefault();
      box.hidden = false;
      box.querySelector('.pv-hint-t').textContent = 'Страница ' + a.getAttribute('href');
      requestAnimationFrame(function () { box.classList.add('on'); });
      clearTimeout(t);
      t = setTimeout(function () {
        box.classList.remove('on');
        setTimeout(function () { box.hidden = true; }, 240);
      }, 2600);
    });
  })();
</script>`;

const result = `<title>${title}</title>
<style>
${styles}
</style>
<script>${inlineHead}</script>
${body}
${hint}
<script>${js}</script>
`;

await writeFile(out, result, 'utf8');
console.log(`${out}: ${(result.length / 1024).toFixed(0)} КБ (скриптов ${(js.length / 1024).toFixed(0)} КБ)`);
