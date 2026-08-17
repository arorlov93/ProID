import {
  DEFS,
  breakLine,
  mmLabels,
  mmTotal,
  acceptStamp,
  axis,
  bg,
  circle,
  dimH,
  dimV,
  leader,
  leaderLayers,
  levelMark,
  line,
  path,
  poche,
  rect,
  sectionMark,
  titleBlock,
  txt,
} from './draw';

/**
 * Четыре листа. Геометрия считается в миллиметрах объекта и переводится в
 * координаты листа одним множителем — так размерные числа на чертеже всегда
 * соответствуют нарисованному, а не подписаны на глаз.
 */

const W = 720;
const H = 620;

/** Масштабная фигура человека, 1750 мм. На чертежах её ставят для сомасштабности. */
function figure(x: number, base: number, h = 48) {
  const head = h * 0.13;
  return [
    circle(x, base - h + head, head, 'd-fig'),
    path(
      `M${x} ${base - h + head * 2}v${h * 0.36}` +
        `M${x} ${base - h + head * 2.6}l${-h * 0.15} ${h * 0.2}` +
        `M${x} ${base - h + head * 2.6}l${h * 0.15} ${h * 0.2}` +
        `M${x} ${base - h * 0.51}l${-h * 0.13} ${h * 0.51}` +
        `M${x} ${base - h * 0.51}l${h * 0.13} ${h * 0.51}`,
      'd-fig',
    ),
  ].join('');
}

/** Оконный проём в наружной стене на плане: четверти и переплёт тремя линиями. */
function windowH(x1: number, x2: number, top: number, bot: number) {
  const m = (top + bot) / 2;
  return [
    rect(x1, top, x2 - x1, bot - top, 'd-void'),
    line(x1, top, x2, top, 'd-main'),
    line(x1, m, x2, m, 'd-thin'),
    line(x1, bot, x2, bot, 'd-main'),
  ].join('');
}

function windowV(y1: number, y2: number, left: number, right: number) {
  const m = (left + right) / 2;
  return [
    rect(left, y1, right - left, y2 - y1, 'd-void'),
    line(left, y1, left, y2, 'd-main'),
    line(m, y1, m, y2, 'd-thin'),
    line(right, y1, right, y2, 'd-main'),
  ].join('');
}

/** Дверь на плане: полотно и дуга открывания на 90°. */
function doorH(x1: number, x2: number, top: number, bot: number, swing: 1 | -1 = 1, hinge: 'l' | 'r' = 'l') {
  const w = x2 - x1;
  const hx = hinge === 'l' ? x1 : x2;
  const dir = hinge === 'l' ? 1 : -1;
  const base = swing === 1 ? bot : top;
  return [
    rect(x1, top, w, bot - top, 'd-void'),
    line(x1, top, x1, bot, 'd-main'),
    line(x2, top, x2, bot, 'd-main'),
    line(hx, base, hx, base + swing * w, 'd-leaf'),
    path(`M${hx} ${base + swing * w}A${w} ${w} 0 0 ${swing === 1 ? (dir === 1 ? 0 : 1) : dir === 1 ? 1 : 0} ${hx + dir * w} ${base}`, 'd-arc'),
  ].join('');
}

function doorV(y1: number, y2: number, left: number, right: number, swing: 1 | -1 = 1) {
  const w = y2 - y1;
  const base = swing === 1 ? right : left;
  return [
    rect(left, y1, right - left, w, 'd-void'),
    line(left, y1, right, y1, 'd-main'),
    line(left, y2, right, y2, 'd-main'),
    line(base, y1, base + swing * w, y1, 'd-leaf'),
    path(`M${base + swing * w} ${y1}A${w} ${w} 0 0 ${swing === 1 ? 1 : 0} ${base} ${y1 + w}`, 'd-arc'),
  ].join('');
}

/** Подпись помещения: номер в кружке, название, площадь с подчёркиванием. */
function roomLabel(cx: number, cy: number, num: number, name: string, area: string) {
  return [
    circle(cx, cy - 17, 8.5, 'd-room-n'),
    txt(cx, cy - 13.6, num, 'd-txt-s', 'middle'),
    txt(cx, cy + 3, name, 'd-txt', 'middle'),
    txt(cx, cy + 17, area, 'd-txt-s', 'middle'),
    line(cx - 20, cy + 20.5, cx + 20, cy + 20.5, 'd-thin'),
  ].join('');
}

/* ═══ ПЛАН ЭТАЖА ═════════════════════════════════════════════════════════════
   Оси 1–5 и А–В, наружные стены 510, внутренние 250, перегородки 120.
   Три размерные цепочки снизу, две слева, марки осей за цепочками. */

export function plan() {
  /* Масштаб листа: 24 000 мм габарита ложатся в 420 px. Все размерные числа
     считаются из этого множителя, поэтому цепочки сходятся с габаритом. */
  const S = 420 / 24000;
  const AX = [180, 285, 390, 469, 600]; // оси 1…5
  const AY = [130, 235, 380]; // оси А, Б, В
  const we = 4.5; // половина толщины наружной стены, 510 мм
  const wi = 2.2; // внутренней, 250 мм
  const wp = 1.1; // перегородки, 120 мм
  const [L, , , , R] = AX;
  const [T, MID, B] = AY;

  const s: string[] = [bg(W, H)];

  AX.forEach((x, i) => s.push(axis(x, String(i + 1), { dir: 'v', from: T - 30, to: B, mark: 484 })));
  ['А', 'Б', 'В'].forEach((t, i) => s.push(axis(AY[i], t, { dir: 'h', from: R + 30, to: L, mark: 78 })));

  // Наружные стены — замкнутое поше по правилу чётности
  const shell =
    `M${L - we} ${T - we}H${R + we}V${B + we}H${L - we}Z` + `M${L + we} ${T + we}H${R - we}V${B - we}H${L + we}Z`;
  s.push(`<path class="d-poche d-solid" fill-rule="evenodd" d="${shell}"/>`);
  s.push(`<path class="d-cut" d="${shell}"/>`);

  // Внутренние стены: поперечная по оси 3 и продольная по оси Б во всю ширину
  s.push(poche(AX[2] - wi, T + we, wi * 2, B - T - we * 2, 'solid'));
  s.push(poche(L + we, MID - wi, R - L - we * 2, wi * 2, 'solid'));
  s.push(poche(AX[1] - wp, MID + wi, wp * 2, B - we - MID - wi, 'solid'));

  // Колонна 400×400 на пересечении осей 4 и Б
  s.push(poche(AX[3] - 3.5, MID - 3.5, 7, 7, 'solid'));

  // Проёмы
  s.push(windowH(214, 258, T - we, T + we));
  s.push(windowH(310, 354, T - we, T + we));
  s.push(windowH(500, 556, T - we, T + we));
  s.push(windowV(160, 204, R - we, R + we));
  s.push(windowV(300, 344, R - we, R + we));
  s.push(doorH(215, 257, B - we, B + we, -1, 'l'));
  s.push(doorV(292, 322, AX[2] - wi, AX[2] + wi, 1));
  s.push(doorH(206, 236, MID - wi, MID + wi, 1, 'r'));
  s.push(doorH(430, 462, MID - wi, MID + wi, 1, 'l'));

  // Лестница: марш, проступи, стрелка подъёма, линия обрыва
  const sx1 = 292;
  const sx2 = 382;
  const sy1 = 262;
  const sy2 = 369;
  const tread = (sy2 - sy1) / 11;
  s.push(rect(sx1, sy1, sx2 - sx1, sy2 - sy1, 'd-main'));
  for (let i = 1; i < 11; i++) s.push(line(sx1, sy1 + i * tread, sx2, sy1 + i * tread, 'd-thin'));
  s.push(circle(337, sy2 - 6, 2.4, 'd-dot'));
  s.push(line(337, sy2 - 6, 337, sy1 + 10, 'd-thin'));
  s.push(path(`M334 ${sy1 + 15}L337 ${sy1 + 7}L340 ${sy1 + 15}`, 'd-arrow'));
  s.push(path(`M${sx1 - 4} 336L${sx2 + 4} 306`, 'd-break'));
  s.push(path(`M${sx1 - 4} 346L${sx2 + 4} 316`, 'd-break'));

  // Помещения
  s.push(roomLabel(232, 178, 1, 'Кабинет', '38,4 м²'));
  s.push(roomLabel(495, 178, 2, 'Переговорная', '31,2 м²'));
  s.push(roomLabel(232, 300, 3, 'Архив', '24,7 м²'));
  s.push(roomLabel(494, 300, 5, 'Техническое', '42,3 м²'));
  s.push(circle(337, 251, 8.5, 'd-room-n'));
  s.push(txt(337, 254.4, 4, 'd-txt-s', 'middle'));

  s.push(levelMark(410, 344, '±0,000', 'r', 52));

  s.push(sectionMark(440, T - 20, '1', 'down'));
  s.push(sectionMark(440, 472, '1', 'up'));

  // Размерные цепочки: по проёмам, межосевая, габаритная
  const d1 = [L, 214, 258, 310, 354, 500, 556, R];
  s.push(dimH({ marks: d1, at: 404, from: B + we, labels: mmLabels(d1, S) }));
  s.push(dimH({ marks: AX, at: 430, from: B + we, labels: mmLabels(AX, S) }));
  s.push(dimH({ marks: [L, R], at: 456, from: B + we, total: mmTotal([L, R], S) }));
  s.push(dimV({ marks: AY, at: 142, from: L - we, labels: mmLabels(AY, S) }));
  s.push(dimV({ marks: [T, B], at: 110, from: L - we, total: mmTotal([T, B], S) }));

  // Выноски: состав наружной стены и состав пола
  s.push(
    leaderLayers([528, T - we], [566, 56], 92, [
      'Штукатурка 20',
      'Кладка 380',
      'Утеплитель 150',
      'Облицовка 120',
    ]),
  );

  s.push(txt(24, 34, 'ПЛАН 1-го ЭТАЖА', 'd-title'));
  s.push(txt(24, 52, 'на отм. ±0,000', 'd-txt-s'));
  s.push(txt(24, 70, 'М 1:100', 'd-txt-xs'));

  s.push(
    titleBlock(348, 502, 348, {
      name: 'План 1-го этажа',
      sheet: 'Корпус 2 · монолит',
      stage: 'Р',
      num: '14',
      total: '264',
      org: 'ПрофИД · внешний отдел ПТО',
    }),
  );

  return `${DEFS}${s.join('')}`;
}

/* ═══ РАЗРЕЗ 1—1 ═══════════════════════════════════════════════════════════
   Перекрытия и стены в сечении заштрихованы, отметки уровней справа,
   высотные цепочки слева, оси снизу. */

export function section() {
  /* По вертикали 3300 мм этажа ложатся в 85 px, по горизонтали шаг осей —
     в том же масштабе, поэтому разрез сомасштабен плану. */
  const SV = 85 / 3300;
  const AX = [150, 305, 519]; // оси А, Б, В, шаг как на плане
  const FL = [370, 285, 200, 115]; // ±0,000 / +3,300 / +6,600 / +9,900
  const slab = 6;
  const we = 7; // половина толщины наружной стены
  const wi = 4;
  const ground = 386;

  const s: string[] = [bg(W, H)];

  // Грунт по ГОСТ 2.306
  s.push(line(40, ground, 680, ground, 'd-main'));
  for (let x = 46; x < 676; x += 13) s.push(line(x, ground, x - 7, ground + 11, 'd-thin'));

  // Фундаменты
  for (const [x, w] of [
    [AX[0], we + 9],
    [AX[1], wi + 9],
    [AX[2], we + 9],
  ])
    s.push(poche(x - w, ground - 4, w * 2, 44, 'p-c'));

  // Видимый контур за секущей плоскостью: проёмы дальней стены
  for (const f of [FL[0], FL[1], FL[2]])
    for (const x of [AX[0] + 46, AX[1] + 36, AX[1] + 128]) {
      s.push(rect(x, f - 70, 58, 46, 'd-thin'));
      s.push(line(x + 29, f - 70, x + 29, f - 24, 'd-thin'));
      s.push(line(x, f - 47, x + 58, f - 47, 'd-thin'));
    }

  // Перекрытия и покрытие — железобетон
  FL.forEach((y) => s.push(poche(AX[0] - we, y, AX[2] - AX[0] + we * 2, slab, 'p-rc')));

  // Наружные стены и средняя опора
  s.push(poche(AX[0] - we, FL[3], we * 2, FL[0] - FL[3], 'p-brick'));
  s.push(poche(AX[2] - we, FL[3], we * 2, FL[0] - FL[3], 'p-brick'));
  s.push(poche(AX[1] - wi, FL[3] + slab, wi * 2, FL[0] - FL[3] - slab, 'solid'));

  // Оконные проёмы: подоконник +900, верх +2700
  for (const f of [FL[0], FL[1], FL[2]]) {
    const sill = f - 24;
    const head = f - 70;
    for (const x of [AX[0], AX[2]]) {
      s.push(rect(x - we, head, we * 2, sill - head, 'd-void'));
      s.push(line(x - we, head, x - we, sill, 'd-main'));
      s.push(line(x, head, x, sill, 'd-thin'));
      s.push(line(x + we, head, x + we, sill, 'd-main'));
      s.push(line(x - we, sill, x + we, sill, 'd-main'));
      s.push(line(x - we, head, x + we, head, 'd-main'));
    }
  }

  // Парапет и кровельный пирог
  s.push(poche(AX[0] - we, FL[3] - 18, we * 2, 18, 'p-brick'));
  s.push(poche(AX[2] - we, FL[3] - 18, we * 2, 18, 'p-brick'));
  s.push(
    `<rect x="${AX[0] + we}" y="${FL[3] - 8}" width="${AX[2] - AX[0] - we * 2}" height="8" style="fill:url(#p-ins)" class="d-poche"/>`,
  );
  s.push(line(AX[0] + we, FL[3] - 8, AX[2] - we, FL[3] - 8, 'd-main'));

  s.push(figure(232, FL[0]));
  s.push(figure(408, FL[1]));
  s.push(figure(466, FL[2]));

  // Отметки уровня справа. Земля вынесена ниже, чтобы не слиться с нулём.
  const MARKS: [number, string, number][] = [
    [FL[3], '+9,900', 88],
    [FL[2], '+6,600', 88],
    [FL[1], '+3,300', 88],
    [FL[0], '±0,000', 88],
    [ground, '−0,600', 128],
  ];
  MARKS.forEach(([y, v, len]) => s.push(levelMark(AX[2] + we + 4, y, v, 'r', len)));

  // Высотные цепочки слева
  const hv = [FL[3], FL[2], FL[1], FL[0]];
  s.push(dimV({ marks: hv, at: 106, from: AX[0] - we, labels: mmLabels(hv, SV, 100) }));
  s.push(dimV({ marks: [FL[3] - 18, FL[0]], at: 74, from: AX[0] - we, total: mmTotal([FL[3] - 18, FL[0]], SV, 10) }));

  // Пролёты и оси
  s.push(dimH({ marks: AX, at: 452, from: ground + 46, labels: mmLabels(AX, SV, 100) }));
  s.push(dimH({ marks: [AX[0], AX[2]], at: 478, from: ground + 46, total: mmTotal([AX[0], AX[2]], SV, 100) }));
  ['А', 'Б', 'В'].forEach((t, i) => s.push(axis(AX[i], t, { dir: 'v', from: FL[3] - 40, to: ground, mark: 506 })));

  s.push(
    leaderLayers([AX[1] + 40, FL[3] - 8], [470, 52], 104, [
      'Гидроизоляция 2 слоя',
      'Стяжка армир. 50',
      'Утеплитель 200',
      'Плита ж/б 220',
    ]),
  );

  s.push(txt(24, 34, 'РАЗРЕЗ 1—1', 'd-title'));
  s.push(txt(24, 52, 'монолитный каркас, отм. ±0,000 … +9,900', 'd-txt-s'));
  s.push(txt(24, 70, 'М 1:100', 'd-txt-xs'));

  s.push(
    titleBlock(348, 518, 348, {
      name: 'Разрез 1—1',
      sheet: 'Корпус 2 · монолит',
      stage: 'Р',
      num: '27',
      total: '264',
      org: 'ПрофИД · внешний отдел ПТО',
    }),
  );

  return `${DEFS}${s.join('')}`;
}

/* ═══ ТИТУЛЬНЫЙ ЛИСТ ТОМА ══════════════════════════════════════════════════
   Рамка с полем подшивки, опись состава, основная надпись и штамп приёмки. */

export function title() {
  const s: string[] = [bg(W, H)];

  // Рамка листа: поле подшивки 20 мм слева, по 5 мм с остальных сторон
  s.push(rect(10, 10, W - 20, H - 20, 'd-thin'));
  s.push(rect(52, 20, W - 72, H - 40, 'd-cut'));

  s.push(txt(W / 2, 108, 'ИСПОЛНИТЕЛЬНАЯ ДОКУМЕНТАЦИЯ', 'd-title-lg', 'middle'));
  s.push(line(180, 126, W - 128, 126, 'd-thin'));
  s.push(txt(W / 2, 152, 'ТОМ 3. МОНОЛИТНЫЕ КОНСТРУКЦИИ', 'd-txt', 'middle'));
  s.push(txt(W / 2, 172, 'Объект капитального строительства · корпус 2', 'd-txt-s', 'middle'));

  // Опись состава тома
  const rows: [string, string, string][] = [
    ['1', 'Общий журнал работ по РД-11-05-2007', '1 кн.'],
    ['2', 'Акты освидетельствования скрытых работ', '128 шт.'],
    ['3', 'Акты освидетельствования отв. конструкций', '34 шт.'],
    ['4', 'Исполнительные схемы и ведомости отклонений', '46 л.'],
    ['5', 'Паспорта, сертификаты, декларации', '74 поз.'],
    ['6', 'Протоколы испытаний и лабораторного контроля', '19 шт.'],
    ['7', 'Реестр и опись тома', '4 л.'],
  ];
  const tx = 96;
  const tw = 528;
  const ty = 214;
  const rh = 26;
  s.push(rect(tx, ty, tw, rh * (rows.length + 1), 'd-main'));
  s.push(line(tx, ty + rh, tx + tw, ty + rh, 'd-main'));
  s.push(line(tx + 34, ty, tx + 34, ty + rh * (rows.length + 1), 'd-thin'));
  s.push(line(tx + tw - 88, ty, tx + tw - 88, ty + rh * (rows.length + 1), 'd-thin'));
  s.push(txt(tx + 17, ty + 17, '№', 'd-txt-s', 'middle'));
  s.push(txt(tx + 46, ty + 17, 'Наименование документа', 'd-txt-s'));
  s.push(txt(tx + tw - 44, ty + 17, 'Кол-во', 'd-txt-s', 'middle'));
  rows.forEach(([num, name, qty], i) => {
    const y = ty + rh * (i + 1);
    if (i) s.push(line(tx, y, tx + tw, y, 'd-thin'));
    s.push(txt(tx + 17, y + 17, num, 'd-txt-s', 'middle'));
    s.push(txt(tx + 46, y + 17, name, 'd-txt-s'));
    s.push(txt(tx + tw - 44, y + 17, qty, 'd-txt-s', 'middle'));
  });

  s.push(acceptStamp(96, 434, 176, 50));
  s.push(txt(96, 502, 'Технический заказчик · комиссия приёмки', 'd-txt-xs'));

  s.push(
    titleBlock(360, 434, 298, {
      name: 'Титульный лист тома',
      sheet: 'Комплект по объекту',
      stage: 'Р',
      num: '1',
      total: '264',
      org: 'ПрофИД · внешний отдел ПТО',
    }),
  );

  return `${DEFS}${s.join('')}`;
}

/* ═══ УЗЕЛ ПРИМЫКАНИЯ ══════════════════════════════════════════════════════
   Опирание плиты перекрытия на наружную стену. Слои показаны штриховками
   по ГОСТ 2.306, состав раскрыт многослойной выноской. М 1:10. */

export function node() {
  const s: string[] = [bg(W, H)];

  // Наружная стена по слоям, снаружи внутрь
  const x0 = 118; // наружная грань облицовки
  const lay: [number, string, string][] = [
    [34, 'p-brick', 'Облицовка 120'],
    [11, '', 'Вентзазор 40'],
    [42, 'p-ins', 'Утеплитель 150'],
    [106, 'p-brick', 'Кладка 380'],
  ];
  const top = 104;
  const bot = 466;
  let x = x0;
  const edges = [x0];
  for (const [w, p] of lay) {
    if (p) s.push(poche(x, top, w, bot - top, p));
    else {
      s.push(rect(x, top, w, bot - top, 'd-void'));
      s.push(line(x, top, x, bot, 'd-main'));
      s.push(line(x + w, top, x + w, bot, 'd-main'));
    }
    x += w;
    edges.push(x);
  }
  const inner = x;
  const inner0 = x;

  // Стена и плита продолжаются за лист
  s.push(breakLine(x0, inner0, top, 'h'));
  s.push(breakLine(x0, inner0, bot, 'h'));

  // Плита перекрытия заходит в кладку на 200 мм
  const slabTop = 282;
  const slabH = 62;
  const slabFrom = inner - 56;
  s.push(poche(slabFrom, slabTop, 600 - slabFrom, slabH, 'p-rc'));

  // Пирог пола поверх плиты
  const floor: [number, string][] = [
    [11, 'p-ins'],
    [18, 'p-scr'],
    [4, ''],
  ];
  let fy = slabTop;
  for (const [h, p] of floor) {
    fy -= h;
    if (p) s.push(poche(inner, fy, 600 - inner, h, p));
    else s.push(poche(inner, fy, 600 - inner, h, 'p-c'));
  }

  // Гибкие связи через утеплитель
  for (let i = 0; i < 5; i++) {
    const y = 130 + i * 66;
    s.push(line(edges[1] - 6, y, edges[3] + 14, y - 5, 'd-thin'));
  }

  // Отсечная гидроизоляция под плитой
  s.push(line(slabFrom, slabTop + slabH + 2, 600, slabTop + slabH + 2, 'd-leaf'));

  // Перекрытие продолжается за лист
  s.push(breakLine(slabTop - 33, slabTop + slabH, 600, 'v'));


  // Выноски
  s.push(
    leaderLayers([edges[2] + 20, 150], [332, 118], 130, [
      'Облицовка керамическая 120',
      'Вентилируемый зазор 40',
      'Минеральная вата 150',
      'Кладка несущая 380',
    ]),
  );
  s.push(
    leaderLayers([420, slabTop - 22], [446, 404], 122, [
      'Покрытие 10',
      'Стяжка Ц/П армир. 64',
      'Звукоизоляция 40',
      'Плита ж/б 220',
    ]),
  );

  // Размерные цепочки
  s.push(dimH({ marks: edges, at: 508, from: bot, labels: [120, 40, 150, 380] }));
  s.push(dimH({ marks: [x0, inner], at: 536, from: bot, total: 690 }));
  s.push(dimV({ marks: [slabTop - 33, slabTop, slabTop + slabH], at: 636, from: 600, labels: [114, 220] }));

  s.push(levelMark(inner + 30, slabTop - 33, '+3,300', 'r', 76));

  // Марка узла

  s.push(txt(24, 36, 'УЗЕЛ ПРИМЫКАНИЯ', 'd-title'));
  s.push(txt(24, 54, 'опирание плиты перекрытия на наружную стену', 'd-txt-s'));
  s.push(txt(24, 74, 'М 1:10', 'd-txt-xs'));

  s.push(
    titleBlock(400, 528, 312, {
      name: 'Узел 1. Примыкание',
      sheet: 'Корпус 2 · монолит',
      stage: 'Р',
      num: '58',
      total: '264',
      org: 'ПрофИД · внешний отдел ПТО',
    }),
  );

  return `${DEFS}${s.join('')}`;
}

export const KINDS = { plan, section, title, node } as const;
export type DrawingKind = keyof typeof KINDS;
export const VIEWBOX = `0 0 ${W} ${H}`;
