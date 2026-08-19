import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Русская типографика на этапе сборки.
 *
 * Почему так, а не вручную и не на клиенте: правил семнадцать, текста на сайте
 * порядка 120 000 знаков, руками их не расставить без пропусков. Обработка идёт
 * по готовому HTML в dist/, поэтому покрывает всё разом — .astro-страницы,
 * компоненты и статьи из Markdown, — и ничего не стоит браузеру: в отданном
 * HTML уже стоят готовые неразрывные пробелы.
 *
 * Трогаем только текстовые узлы. Содержимое script/style/pre/code/svg и любые
 * значения атрибутов остаются нетронутыми: неразрывный пробел в title или в
 * description портит сниппет, а в JSON-LD — ломает разметку.
 */

const SKIP_TAGS = new Set(['script', 'style', 'pre', 'code', 'textarea', 'svg', 'kbd', 'samp']);

// Предлоги, союзы и частицы, которые не должны висеть в конце строки.
const SHORT_WORDS = [
  'а', 'б', 'бы', 'в', 'во', 'вы', 'да', 'до', 'же', 'за', 'и', 'из', 'изо', 'или', 'их', 'к', 'ко',
  'ли', 'мы', 'на', 'над', 'не', 'ни', 'но', 'о', 'об', 'обо', 'от', 'ото', 'по', 'под', 'при', 'про',
  'с', 'со', 'та', 'то', 'ту', 'у', 'уж', 'что', 'чем', 'как', 'для', 'без', 'вне', 'меж', 'она', 'они',
  'он', 'мы', 'вы', 'я', 'ты', 'все', 'уже', 'ещё', 'два', 'три', 'сам', 'там', 'тут', 'это', 'эти',
];

// Единицы измерения и слова-спутники числа.
const UNITS = [
  '₽', '%', '‰', '€', '\\$', 'м', 'мм', 'см', 'км', 'м²', 'м³', 'кв', 'га', 'кг', 'т', 'шт', 'экз',
  'тыс', 'млн', 'млрд', 'руб', 'р', 'ч', 'мин', 'сек', 'с', 'дн', 'день', 'дня', 'дней', 'год', 'года',
  'лет', 'мес', 'месяц', 'месяца', 'месяцев', 'нед', 'неделя', 'недели', 'недель', 'раз', 'раза',
  'том', 'тома', 'томов', 'лист', 'листа', 'листов', 'акт', 'акта', 'актов', 'этаж', 'этажа', 'этажей',
  'объект', 'объекта', 'объектов', 'позиц', 'страниц', 'человек', 'сотрудник', 'инженер', 'инженера',
];

const NB = ' '; // неразрывный пробел, ставим символом — короче &nbsp; и не ломает сравнение
const rxShort = new RegExp(`(^|[\\s(«„—–-])(${SHORT_WORDS.join('|')})\\s+`, 'gi');
const rxUnit = new RegExp(`(\\d)\\s+(${UNITS.join('|')})(?![а-яё])`, 'gi');

function typographText(s) {
  if (!s.trim()) return s;

  // 1. Кавычки: внешние — ёлочки, вложенные — лапки.
  s = s.replace(/"([^"]*)"/g, (_, inner) => `«${inner.replace(/"([^"]*)"/g, '„$1“')}»`);

  // 2. Тире. Дефис между пробелами — всегда длинное тире, привязанное к слову слева,
  //    чтобы не начинать им строку.
  s = s.replace(/(\S)[  ]+[-–—][  ]+/g, `$1${NB}— `);
  //    Тире в начале строки (прямая речь, список) не трогаем по привязке, только вид.
  s = s.replace(/(^|\n)\s*-\s+/g, '$1— ');

  // 3. Числовые диапазоны — среднее тире без пробелов: 2 500–4 000, 15–25.
  //
  // Но не в номерах документов: РД-11-02-2006, ГОСТ Р 21.101-2020, СНиП 3.01.04-87
  // и 152-ФЗ пишутся через дефис, и правило превращало их в «РД-11–02–2006».
  // Ошибка тем неприятнее, что видна только на отрисованной странице: в исходном
  // тексте номер написан верно. Поэтому номера вырезаются до замены и
  // возвращаются после.
  const DOCNUM = /\b(?:[А-ЯЁ]{2,5}(?:\s+[А-ЯЁ])?\s*)?\d+(?:[.\d]+)?(?:-\d+){1,3}(?:-[А-ЯЁ]{2,4})?\b/g;
  const kept = [];
  s = s.replace(DOCNUM, (m) => {
    // Диапазон вида «2 500-4 000» под это не подпадает: там пробелы уже
    // расставлены, а частей всегда две и обе многозначные.
    kept.push(m);
    return `\u0000${kept.length - 1}\u0000`;
  });
  s = s.replace(/(\d)\s*[-–]\s*(\d)/g, '$1–$2');
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => kept[+i]);

  // 4. Разряды в числах не разрываются: 1 200 → 1 200 неразрывным.
  s = s.replace(/(\d)[  ](?=\d{3}\b)/g, `$1${NB}`);

  // 5. Число и единица измерения: 16 млрд ₽, 3 500 ₽, 44×44 px.
  s = s.replace(rxUnit, `$1${NB}$2`);
  s = s.replace(/(\d)\s+(px|pt|em|rem|кв\.\s?м)/gi, `$1${NB}$2`);

  // 6. Номера нормативов и законов: СП 68.13330, РД-11-02-2006, 152-ФЗ, № 87.
  s = s.replace(/\b([А-ЯЁA-Z]{2,4})\s+(?=[\d№])/g, `$1${NB}`);
  s = s.replace(/№\s+(?=\d)/g, `№${NB}`);

  // 7. Инициалы: И. И. Иванов.
  s = s.replace(/\b([А-ЯЁ])\.\s*([А-ЯЁ])\.\s*(?=[А-ЯЁ][а-яё])/g, `$1.${NB}$2.${NB}`);

  // 8. Короткие слова не висят в конце строки.
  //    Два прохода: «и в этом случае» — цепочка из двух коротких слов подряд.
  s = s.replace(rxShort, `$1$2${NB}`);
  s = s.replace(rxShort, `$1$2${NB}`);

  // 9. Многоточие и знак умножения.
  s = s.replace(/\.{3}/g, '…').replace(/(\d)\s?[xх]\s?(?=\d)/g, '$1×');

  // 10. Пробел перед знаком препинания — убрать; после — поставить.
  s = s.replace(/[  ]+([,;:!?](?![)»]))/g, '$1');

  return s;
}

/**
 * Заголовки статей начинаются с номера («1. Неполная опись»), и генератор
 * якорей делает из них идентификаторы вида «1-nepolnaya-opis». Идентификатор,
 * начинающийся с цифры, не выбирается селектором CSS и бракуется валидатором,
 * поэтому добавляем буквенный префикс — и в id, и в ссылающихся на него якорях.
 */
export function fixNumericIds(html) {
  let n = 0;
  const out = html
    .replace(/\bid="(\d[^"]*)"/g, (_, id) => {
      n++;
      return `id="p-${id}"`;
    })
    .replace(/\bhref="#(\d[^"]*)"/g, (_, id) => `href="#p-${id}"`);
  return { html: out, changed: n };
}

/** Разбор HTML на теги и текстовые узлы без сборки дерева: нам нужен только текст. */
export function typographHtml(html) {
  const parts = html.split(/(<!--[\s\S]*?-->|<[^>]*>)/);
  let skipDepth = 0;
  let changed = 0;

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!p) continue;

    if (p[0] === '<') {
      if (p.startsWith('<!--')) continue;
      const m = /^<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9-]*)/.exec(p);
      if (!m) continue;
      const [, closing, rawTag] = m;
      const tag = rawTag.toLowerCase();
      if (!SKIP_TAGS.has(tag)) continue;
      if (closing) skipDepth = Math.max(0, skipDepth - 1);
      else if (!/\/>$/.test(p)) skipDepth++;
      continue;
    }

    if (skipDepth > 0) continue;
    const out = typographText(p);
    if (out !== p) {
      parts[i] = out;
      changed++;
    }
  }

  return { html: parts.join(''), changed };
}

async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) await walk(full, out);
    else if (extname(e.name) === '.html') out.push(full);
  }
  return out;
}

export default function typograf() {
  return {
    name: 'profid:typograf',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const files = await walk(root);
        let touched = 0;
        let nodes = 0;
        let ids = 0;
        for (const f of files) {
          const src = await readFile(f, 'utf8');
          const typo = typographHtml(src);
          const fixed = fixNumericIds(typo.html);
          if (typo.changed || fixed.changed) {
            await writeFile(f, fixed.html, 'utf8');
            touched++;
            nodes += typo.changed;
            ids += fixed.changed;
          }
        }
        logger.info(`типографика: ${nodes} текстовых узлов в ${touched} из ${files.length} страниц`);
        if (ids) logger.info(`якоря: исправлено ${ids} идентификаторов, начинавшихся с цифры`);
      },
    },
  };
}
