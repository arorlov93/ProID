import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import sharp from 'sharp';
import { site } from '../../data/site';
import { unitAcc } from '../../data/prices';

/**
 * Открытая графика 1200×630 для каждой страницы.
 *
 * Рисуется SVG и растрируется sharp в PNG: соцсети и Телеграм не показывают SVG
 * как og:image, а PNG показывают все. Шрифт — DejaVu Sans, единственный
 * гарантированно доступный в сборочном окружении с полной кириллицей.
 */

const W = 1200;
const H = 630;
const FONT = 'DejaVu Sans, Liberation Sans, sans-serif';

type Card = { slug: string; eyebrow: string; title: string; note: string };

export const getStaticPaths = (async () => {
  const services = await getCollection('services');
  const posts = await getCollection('blog');
  const objects = await getCollection('objects');

  const cards: Card[] = [
    {
      slug: 'index',
      eyebrow: 'Внешний отдел ПТО · Москва',
      title: 'Исполнительная документация, которую принимают с первого раза',
      note: 'ИД · ППР · сметы · аудит комплекта',
    },
    { slug: 'uslugi', eyebrow: 'Услуги', title: 'Услуги ПТО в строительстве', note: 'Семь направлений, открытый прайс' },
    { slug: 'ceny', eyebrow: 'Прайс', title: 'Исполнительная документация: цена', note: '28 позиций без «по запросу»' },
    { slug: 'obekty', eyebrow: 'Объекты', title: 'Где мы вели документацию', note: 'Здания, наследие, порт, производство' },
    { slug: 'o-kompanii', eyebrow: 'О компании', title: 'Внешний отдел ПТО', note: 'Опыт приёмки со стороны заказчика' },
    { slug: 'kontakty', eyebrow: 'Контакты', title: 'Напишите — посмотрим ваш комплект', note: 'Первая консультация бесплатна' },
    { slug: 'blog', eyebrow: 'Блог', title: 'Как это устроено на практике', note: 'Разборы, а не пересказ сводов правил' },
    { slug: 'checklist', eyebrow: 'Бесплатно', title: 'Чек-лист состава ИД: 84 позиции', note: 'По СП 68.13330 и приказу 344/пр' },
    { slug: 'privacy', eyebrow: 'Документ', title: 'Политика конфиденциальности', note: site.domain },
    { slug: '404', eyebrow: 'Ошибка 404', title: 'Такой страницы нет', note: site.domain },
  ];

  for (const s of services) {
    cards.push({
      slug: s.id,
      eyebrow: s.data.eyebrow,
      title: s.data.h1,
      note: s.data.price.from === 0 ? 'Экспресс-проверка бесплатно' : `от ${s.data.price.from.toLocaleString('ru-RU')} ₽ за ${unitAcc(s.data.price.unit)}`,
    });
  }
  for (const p of posts) {
    cards.push({ slug: `blog/${p.id}`, eyebrow: `Блог · ${p.data.readingMin} мин`, title: p.data.h1, note: site.domain });
  }
  for (const o of objects) {
    cards.push({ slug: `obekty/${o.id}`, eyebrow: `Объект · ${o.data.city}`, title: o.data.h1, note: o.data.kind });
  }

  return cards.map((c) => ({ params: { slug: c.slug }, props: { card: c } }));
}) satisfies GetStaticPaths;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Перенос по словам: у DejaVu Sans средняя ширина знака ≈ 0,54 кегля. */
function wrap(text: string, size: number, maxWidth: number, maxLines: number): string[] {
  const perChar = size * 0.54;
  const limit = Math.floor(maxWidth / perChar);
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length > limit && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    } else {
      line = next;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    if (words.join(' ').length > lines.join(' ').length) lines[maxLines - 1] = last.replace(/\S+$/, '…');
  }
  return lines;
}

function svg(c: Card): string {
  // Кегль подбираем под длину: длинный заголовок не должен вылезать за поле.
  const size = c.title.length > 46 ? 54 : c.title.length > 30 ? 64 : 74;
  const lines = wrap(c.title, size, 900, 3);
  const lh = Math.round(size * 1.18);
  const startY = 348 - ((lines.length - 1) * lh) / 2;

  const grid = Array.from({ length: 25 }, (_, i) => `<line x1="${i * 50}" y1="0" x2="${i * 50}" y2="${H}"/>`)
    .concat(Array.from({ length: 13 }, (_, i) => `<line x1="0" y1="${i * 50}" x2="${W}" y2="${i * 50}"/>`))
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#171c22"/>
  <g stroke="#8fb6e0" stroke-width="1" opacity="0.07">${grid}</g>
  <rect x="0" y="0" width="${W}" height="6" fill="#e0a94a"/>

  <g transform="translate(72 64)">
    <rect x="0" y="0" width="52" height="52" stroke="#e0a94a" stroke-width="2.4" fill="none"/>
    <path d="M0 13h52M0 39h52M13 0v13M13 39v13" stroke="#e0a94a" stroke-width="1" opacity="0.45" fill="none"/>
    <path d="M15 27l8 8 15-17" stroke="#e0a94a" stroke-width="5" stroke-linecap="square" fill="none"/>
    <text x="70" y="26" font-family="${FONT}" font-size="27" font-weight="bold" fill="#f2f4f6">Проф<tspan fill="#e0a94a">ИД</tspan></text>
    <text x="71" y="45" font-family="${FONT}" font-size="12" letter-spacing="1.8" fill="#8f99a6">ВНЕШНИЙ ОТДЕЛ ПТО</text>
  </g>

  <text x="72" y="196" font-family="${FONT}" font-size="20" font-weight="bold" letter-spacing="3.4" fill="#e0a94a">${esc(c.eyebrow.toUpperCase())}</text>

  ${lines
    .map(
      (l, i) =>
        `<text x="72" y="${startY + i * lh}" font-family="${FONT}" font-size="${size}" font-weight="bold" fill="#f2f4f6">${esc(l)}</text>`,
    )
    .join('\n  ')}

  <line x1="72" y1="512" x2="${W - 72}" y2="512" stroke="#333c48" stroke-width="1"/>
  <text x="72" y="556" font-family="${FONT}" font-size="24" fill="#a6afbb">${esc(c.note)}</text>
  <text x="${W - 72}" y="556" text-anchor="end" font-family="${FONT}" font-size="24" font-weight="bold" fill="#e0a94a">${esc(site.domain)}</text>
</svg>`;
}

export const GET: APIRoute = async ({ props }) => {
  const png = await sharp(Buffer.from(svg((props as { card: Card }).card)))
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
};
