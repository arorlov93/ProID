/**
 * Построение инженерных чертежей.
 *
 * Чертёж отличается от схемы не количеством линий, а порядком:
 *
 *   — иерархия толщин по ГОСТ 2.303: контур сечения толстый, видимый контур
 *     средний, размерные и осевые тонкие, штриховка волосяная;
 *   — то, что попало в секущую плоскость, залито или заштриховано, а не
 *     обведено контуром (поше);
 *   — размерных цепочек три: по проёмам, межосевая и габаритная, каждая со
 *     своими выносными линиями и засечками под 45° по ГОСТ 2.307;
 *   — координационные оси штрихпунктиром, марки в кружках за размерными
 *     цепочками по ГОСТ 21.101;
 *   — штриховки материалов по ГОСТ 2.306;
 *   — основная надпись, выноски с полкой, отметки уровня, марка разреза.
 *
 * Функции возвращают строки разметки: так геометрию можно считать выражением,
 * а не выписывать сотни узлов руками. Классы описаны в styles/draw.css.
 */

/* ── Примитивы ───────────────────────────────────────────────────────────── */

const n = (v: number) => (Math.round(v * 100) / 100).toString();

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const line = (x1: number, y1: number, x2: number, y2: number, cls = 'd-thin') =>
  `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" class="${cls}"/>`;

export const rect = (x: number, y: number, w: number, h: number, cls = 'd-main') =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" class="${cls}"/>`;

export const path = (d: string, cls = 'd-main') => `<path d="${d}" class="${cls}"/>`;

export const circle = (cx: number, cy: number, r: number, cls = 'd-thin') =>
  `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" class="${cls}"/>`;

export function txt(
  x: number,
  y: number,
  s: string | number,
  cls = 'd-txt',
  anchor: 'start' | 'middle' | 'end' = 'start',
  rotate?: number,
) {
  const tr = rotate ? ` transform="rotate(${rotate} ${n(x)} ${n(y)})"` : '';
  return `<text x="${n(x)}" y="${n(y)}" class="${cls}" text-anchor="${anchor}"${tr}>${esc(String(s))}</text>`;
}

/**
 * Прямоугольник-поше: рассечённое плоскостью заливается, а не обводится.
 * На плане в масштабе 1:100 стена толщиной девять точек не покажет штриховку —
 * её и на бумаге в таком масштабе заливают сплошь. Штриховка по ГОСТ 2.306
 * включается там, где сечение достаточно крупное: в разрезе и в узле.
 */
export const poche = (x: number, y: number, w: number, h: number, fill: string | 'solid' = 'p-rc') =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" class="d-poche${
    fill === 'solid' ? ' d-solid' : ''
  }"${fill === 'solid' ? '' : ` style="fill:url(#${fill})"`}/>` +
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" class="d-cut"/>`;

/* ── Размерные цепочки по ГОСТ 2.307 ─────────────────────────────────────── */

type Chain = {
  /** Координаты засечек вдоль цепочки. */
  marks: number[];
  /** Положение размерной линии. */
  at: number;
  /** Откуда тянуть выносные линии — контур детали. */
  from: number;
  /** Подписи между засечками; по умолчанию считаются из шага. */
  labels?: (string | number)[];
  /** Показать габаритное число одной подписью. */
  total?: string | number;
};

/** Размеры в миллиметрах по расстояниям на листе. Округление до 50 мм —
 *  чтобы числа выглядели как проектные, а не как результат деления. */
export function mmLabels(marks: number[], pxPerMm: number, round = 50) {
  return marks.slice(1).map((m, i) => Math.round((m - marks[i]) / pxPerMm / round) * round);
}

export function mmTotal(marks: number[], pxPerMm: number, round = 50) {
  return Math.round((marks[marks.length - 1] - marks[0]) / pxPerMm / round) * round;
}

/** Горизонтальная цепочка: выносные линии, размерная линия, засечки, числа. */
export function dimH({ marks, at, from, labels, total }: Chain) {
  const out: string[] = [];
  const a = marks[0];
  const b = marks[marks.length - 1];
  out.push(line(a, at, b, at, 'd-dim'));
  for (const m of marks) {
    out.push(line(m, from, m, at + 5, 'd-dim-ext'));
    // Засечка под 45° — вместо стрелки, как принято в строительных чертежах.
    out.push(line(m - 3.2, at + 3.2, m + 3.2, at - 3.2, 'd-tick'));
  }
  if (total !== undefined) {
    out.push(txt((a + b) / 2, at - 6, total, 'd-dim-txt', 'middle'));
  } else {
    for (let i = 0; i < marks.length - 1; i++) {
      const v = labels?.[i];
      if (v === undefined || v === '') continue;
      out.push(txt((marks[i] + marks[i + 1]) / 2, at - 6, v, 'd-dim-txt', 'middle'));
    }
  }
  return out.join('');
}

/** Вертикальная цепочка. Числа развёрнуты на 90° против часовой, как на листе. */
export function dimV({ marks, at, from, labels, total }: Chain) {
  const out: string[] = [];
  const a = marks[0];
  const b = marks[marks.length - 1];
  out.push(line(at, a, at, b, 'd-dim'));
  for (const m of marks) {
    out.push(line(from, m, at - 5, m, 'd-dim-ext'));
    out.push(line(at - 3.2, m + 3.2, at + 3.2, m - 3.2, 'd-tick'));
  }
  const put = (y: number, v: string | number) => txt(at - 6, y, v, 'd-dim-txt', 'middle', -90);
  if (total !== undefined) out.push(put((a + b) / 2, total));
  else
    for (let i = 0; i < marks.length - 1; i++) {
      const v = labels?.[i];
      if (v === undefined || v === '') continue;
      out.push(put((marks[i] + marks[i + 1]) / 2, v));
    }
  return out.join('');
}

/* ── Координационные оси ─────────────────────────────────────────────────── */

/** Ось с маркой в кружке. Цифровые снизу, буквенные слева — как на листе. */
export function axis(
  pos: number,
  label: string,
  o: { dir: 'v' | 'h'; from: number; to: number; mark: number; r?: number },
) {
  const r = o.r ?? 10;
  const out: string[] = [];
  if (o.dir === 'v') {
    out.push(line(pos, o.from, pos, o.mark - r, 'd-axis'));
    out.push(circle(pos, o.mark, r, 'd-axis-mark'));
    out.push(txt(pos, o.mark + 3.6, label, 'd-axis-txt', 'middle'));
  } else {
    out.push(line(o.from, pos, o.mark + r, pos, 'd-axis'));
    out.push(circle(o.mark, pos, r, 'd-axis-mark'));
    out.push(txt(o.mark, pos + 3.6, label, 'd-axis-txt', 'middle'));
  }
  return out.join('');
}

/* ── Отметка уровня по ГОСТ 21.101 ───────────────────────────────────────── */

/** Треугольник на выносной линии и число над полкой. Знак обязателен. */
export function levelMark(x: number, y: number, value: string, side: 'l' | 'r' = 'r', len = 46) {
  const dir = side === 'r' ? 1 : -1;
  const tip = x + dir * len;
  return [
    line(x, y, tip, y, 'd-thin'),
    path(`M${n(x)} ${n(y)}l${n(dir * 6)} ${n(-7)}l${n(-dir * 12)} 0z`, 'd-lvl'),
    line(tip - dir * 30, y - 4, tip, y - 4, 'd-thin'),
    txt(tip - dir * 2, y - 8, value, 'd-lvl-txt', side === 'r' ? 'end' : 'start'),
  ].join('');
}

/* ── Выноска с полкой ────────────────────────────────────────────────────── */

/** Однострочная выноска: точка, наклонный отрезок, полка, надпись над и под. */
export function leader(
  from: [number, number],
  bend: [number, number],
  shelf: number,
  above: string,
  below?: string,
) {
  const [x0, y0] = from;
  const [x1, y1] = bend;
  const end = x1 + shelf;
  const anchor = shelf > 0 ? 'start' : 'end';
  return [
    circle(x0, y0, 1.8, 'd-dot'),
    path(`M${n(x0)} ${n(y0)}L${n(x1)} ${n(y1)}H${n(end)}`, 'd-thin'),
    txt(x1 + (shelf > 0 ? 4 : -4), y1 - 5, above, 'd-txt-s', anchor as 'start'),
    below ? txt(x1 + (shelf > 0 ? 4 : -4), y1 + 11, below, 'd-txt-xs', anchor as 'start') : '',
  ].join('');
}

/** Многослойная выноска: ступенчатая полка с номерами слоёв. */
export function leaderLayers(
  from: [number, number],
  bend: [number, number],
  shelf: number,
  layers: string[],
) {
  const [x0, y0] = from;
  const [x1, y1] = bend;
  const step = 15;
  const top = y1 - ((layers.length - 1) * step) / 2;
  const out = [
    circle(x0, y0, 1.8, 'd-dot'),
    path(`M${n(x0)} ${n(y0)}L${n(x1)} ${n(y1)}`, 'd-thin'),
    line(x1, top - 8, x1, top + (layers.length - 1) * step + 4, 'd-thin'),
  ];
  layers.forEach((t, i) => {
    const y = top + i * step;
    out.push(line(x1, y, x1 + shelf, y, 'd-thin'));
    out.push(txt(x1 + 5, y - 4, `${i + 1}. ${t}`, 'd-txt-xs'));
  });
  return out.join('');
}

/** Линия обрыва: конструкция продолжается за пределы листа. Без неё узел
 *  выглядит отдельно стоящим предметом, а не фрагментом стены. */
export function breakLine(a: number, b: number, at: number, dir: 'h' | 'v', amp = 5) {
  const len = b - a;
  const steps = Math.max(3, Math.round(len / 13));
  const step = len / steps;
  let d = dir === 'h' ? `M${n(a)} ${n(at)}` : `M${n(at)} ${n(a)}`;
  for (let i = 1; i <= steps; i++) {
    const p = a + i * step;
    const off = i % 2 ? amp : -amp;
    d += dir === 'h' ? `L${n(p)} ${n(at + off)}` : `L${n(at + off)} ${n(p)}`;
  }
  return path(d, 'd-break');
}

/* ── Марка разреза по ГОСТ 21.101 ────────────────────────────────────────── */

/** Разомкнутая линия со стрелкой направления взгляда и буквой. */
export function sectionMark(x: number, y: number, label: string, dir: 'down' | 'up') {
  const d = dir === 'down' ? 1 : -1;
  return [
    line(x - 9, y, x + 9, y, 'd-cut-mark'),
    path(`M${n(x)} ${n(y)}v${n(d * 13)}`, 'd-thin'),
    path(`M${n(x - 3)} ${n(y + d * 9)}L${n(x)} ${n(y + d * 14)}L${n(x + 3)} ${n(y + d * 9)}z`, 'd-arrow'),
    txt(x + 13, y + d * 6, label, 'd-txt', 'start'),
  ].join('');
}

/* ── Штриховки по ГОСТ 2.306 ─────────────────────────────────────────────── */

/** Определения узоров. Вставляется один раз в каждый svg. */
export const DEFS = `<defs>
  <pattern id="p-rc" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <line x1="0" y1="0" x2="0" y2="9" class="d-hatch"/>
    <circle cx="4.5" cy="4.5" r="0.85" class="d-hatch-dot"/>
  </pattern>
  <pattern id="p-c" width="14" height="14" patternUnits="userSpaceOnUse">
    <circle cx="3" cy="4" r="1" class="d-hatch-dot"/>
    <circle cx="10" cy="9" r="0.8" class="d-hatch-dot"/>
    <path d="M6 10l2.4-4 2.4 4z" class="d-hatch"/>
  </pattern>
  <pattern id="p-brick" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <line x1="0" y1="0" x2="0" y2="7" class="d-hatch"/>
  </pattern>
  <pattern id="p-ins" width="10" height="10" patternUnits="userSpaceOnUse">
    <path d="M0 5q2.5-4 5 0t5 0" class="d-hatch"/>
  </pattern>
  <pattern id="p-soil" width="16" height="10" patternUnits="userSpaceOnUse">
    <line x1="0" y1="10" x2="16" y2="10" class="d-hatch"/>
    <line x1="3" y1="10" x2="-2" y2="0" class="d-hatch"/>
    <line x1="11" y1="10" x2="6" y2="0" class="d-hatch"/>
  </pattern>
  <pattern id="p-scr" width="8" height="8" patternUnits="userSpaceOnUse">
    <circle cx="2" cy="2" r="0.7" class="d-hatch-dot"/>
    <circle cx="6" cy="5.5" r="0.7" class="d-hatch-dot"/>
  </pattern>
  <pattern id="p-grid" width="20" height="20" patternUnits="userSpaceOnUse">
    <path d="M20 0H0V20" class="d-grid"/>
  </pattern>
</defs>`;

/** Подложка «миллиметровка» — фон листа, а не часть чертежа. */
export const bg = (w: number, h: number) =>
  `<rect x="0" y="0" width="${w}" height="${h}" style="fill:url(#p-grid)" opacity="0.5"/>`;

/* ── Основная надпись по ГОСТ Р 21.101, форма 1 ──────────────────────────── */

export function titleBlock(
  x: number,
  y: number,
  w: number,
  o: { name: string; sheet: string; stage: string; num: string; total: string; org: string },
) {
  /* Форма 1 по ГОСТ Р 21.101 в честных пропорциях 185×55. Подписи проставлены
     только там, где на нашем размере они читаются: микрографы «Изм./№ док./
     Подп./Дата» оставлены разграфлёнными, но без надписей — на 5 px текст в них
     превращается в грязь и налезает на соседние клетки. */
  const h = w * (55 / 185);
  const r = h / 5; // высота строки
  const sig = w * (50 / 185); // блок подписей
  const nameCol = w * (75 / 185); // графа наименования
  const c1 = x + sig;
  const c2 = c1 + nameCol;
  const right = x + w;
  const out: string[] = [rect(x, y, w, h, 'd-cut')];

  // Блок подписей: пять строк, столбец должностей и три узкие графы
  for (let i = 1; i < 5; i++) out.push(line(x, y + i * r, c1, y + i * r, 'd-thin'));
  const sigCols = [0.42, 0.6, 0.78].map((k) => x + sig * k);
  for (const cx of sigCols) out.push(line(cx, y, cx, y + h, 'd-thin'));
  ['', 'Разраб.', 'Пров.', 'Н. контр.', 'ГИП'].forEach((t, i) => {
    if (t) out.push(txt(x + r * 0.4, y + (i + 0.68) * r, t, 'd-txt-xs'));
  });

  // Графа наименования
  out.push(line(c1, y, c1, y + h, 'd-thin'));
  out.push(line(c1, y + 3 * r, right, y + 3 * r, 'd-thin'));
  out.push(txt(c1 + r * 0.5, y + 1.35 * r, o.name, 'd-tb-name'));
  out.push(txt(c1 + r * 0.5, y + 2.4 * r, o.sheet, 'd-txt-xs'));
  out.push(txt(c1 + r * 0.5, y + 4.3 * r, o.org, 'd-txt-xs'));

  // Графы стадии, листа и количества листов
  out.push(line(c2, y, c2, y + 3 * r, 'd-thin'));
  out.push(line(c2, y + r, right, y + r, 'd-thin'));
  const cw = (right - c2) / 3;
  for (let i = 1; i < 3; i++) out.push(line(c2 + i * cw, y, c2 + i * cw, y + 3 * r, 'd-thin'));
  ['Стадия', 'Лист', 'Листов'].forEach((t, i) =>
    out.push(txt(c2 + cw * (i + 0.5), y + 0.7 * r, t, 'd-txt-xs', 'middle')),
  );
  [o.stage, o.num, o.total].forEach((t, i) =>
    out.push(txt(c2 + cw * (i + 0.5), y + 2.3 * r, t, 'd-tb-val', 'middle')),
  );
  return out.join('');
}

/** Штамп приёмки — не по ГОСТ, а как его ставят на сданном комплекте. */
export function acceptStamp(x: number, y: number, w = 150, h = 44) {
  return [
    `<g class="d-ok">`,
    rect(x, y, w, h, 'd-ok-box'),
    path(`M${n(x + 13)} ${n(y + h / 2)}l7 7 13-15`, 'd-ok-tick'),
    txt(x + 44, y + 19, 'ПРИНЯТО', 'd-ok-t'),
    txt(x + 44, y + 32, 'замечаний нет', 'd-ok-s'),
    `</g>`,
  ].join('');
}
