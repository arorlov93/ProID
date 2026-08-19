import { acceptStamp, bg, circle, dimH, line, path, poche, rect, titleBlock, txt } from './draw';

/**
 * Второй набор листов: стройгенплан, акт, журнал работ и смета.
 *
 * Первые четыре листа (план, разрез, титул, узел) показывали объект.
 * Эти показывают документы — то, что заказчик на самом деле получает
 * от отдела ПТО. Разделение нужно было ещё и по практической причине:
 * на семи посадочных страницах один и тот же титульный лист повторялся
 * четырежды, и картинка переставала что-либо значить.
 *
 * Размер листа общий с drawings.ts — 720×620, иначе компонент не сможет
 * подставлять их в одно и то же место.
 */

const W = 720;
const H = 620;

/** Рамка листа с полем подшивки 20 мм слева — ГОСТ 2.301. */
function frame() {
  return rect(10, 10, W - 20, H - 20, 'd-thin') + rect(52, 20, W - 72, H - 40, 'd-cut');
}

/** Заполненная строка бланка: подчёркивание и вписанное над ним значение. */
function fill(x: number, y: number, w: number, value: string, cls = 'd-txt-s') {
  return line(x, y, x + w, y, 'd-thin') + txt(x + 4, y - 5, value, cls);
}

/** Плашка цветом фона под надписью — чтобы текст читался поверх заливки. */
function chip(x: number, y: number, w: number, h: number) {
  return rect(x, y, w, h, 'd-void');
}

/**
 * Росчерк. Считается детерминированным псевдослучайным блужданием от номера:
 * четыре одинаковые подписи на листе читаются как копипаста и сразу выдают
 * рисунок, а синусоида — как график, а не как подпись.
 */
function signature(x: number, y: number, seed: number) {
  let t = (seed * 9301 + 49297) % 233280;
  const rnd = () => (t = (t * 9301 + 49297) % 233280) / 233280;
  let d = `M${x} ${y}`;
  for (let i = 0; i < 4; i++) {
    const dx = 9 + rnd() * 9;
    const up = -5 - rnd() * 9;
    const dn = 3 + rnd() * 7;
    d += `c${(dx * 0.3).toFixed(1)} ${up.toFixed(1)} ${(dx * 0.7).toFixed(1)} ${dn.toFixed(1)} ${dx.toFixed(1)} ${(up * 0.35).toFixed(1)}`;
  }
  d += `l${(5 + rnd() * 9).toFixed(1)} ${(5 - rnd() * 9).toFixed(1)}`;
  return path(d, 'd-sign');
}

/* ═══ СТРОЙГЕНПЛАН ═════════════════════════════════════════════════════════
   Лист ППР: кран с рабочим радиусом, зона складирования, бытовой городок,
   временная дорога, въезд с мойкой колёс и ограждение площадки. М 1:500. */

export function strojgenplan() {
  const s: string[] = [bg(W, H), frame()];

  // Участок 120×72 м. Один множитель на весь лист — как и на остальных.
  const S = 600 / 120000; // px на мм
  const [SX, SY, SW, SH] = [60, 90, 600, 360];

  // Ограждение площадки: контур со столбиками наружу
  s.push(rect(SX, SY, SW, SH, 'd-main'));
  for (let x = SX + 20; x < SX + SW; x += 40) {
    s.push(line(x, SY, x, SY - 5, 'd-thin'));
    s.push(line(x, SY + SH, x, SY + SH + 5, 'd-thin'));
  }
  for (let y = SY + 20; y < SY + SH; y += 40) {
    s.push(line(SX, y, SX - 5, y, 'd-thin'));
    s.push(line(SX + SW, y, SX + SW + 5, y, 'd-thin'));
  }

  // Временная дорога: буквой Г от въезда к складу, а не кольцом вокруг
  // площадки — кольцо на этом размере читается вторым ограждением.
  s.push(path('M112 450V390H640V150', 'd-thin'));
  s.push(path('M128 450V406H624V195', 'd-thin'));

  // Строящийся корпус: 31×26 м
  const [BX, BY, BW, BH] = [300, 175, 150, 130];
  s.push(poche(BX, BY, BW, BH, 'solid'));
  s.push(chip(BX + 12, BY + 50, BW - 24, 32));
  s.push(txt(BX + BW / 2, BY + 65, 'КОРПУС 2', 'd-txt', 'middle'));
  s.push(txt(BX + BW / 2, BY + 78, 'монолит · 9 этажей', 'd-txt-xs', 'middle'));

  // Башенный кран на рельсовом пути со шпалами
  const CX = 270;
  const CY = 252;
  const R = 180; // 36 м вылета
  s.push(line(CX - 7, CY - 75, CX - 7, CY + 80, 'd-main'));
  s.push(line(CX + 7, CY - 75, CX + 7, CY + 80, 'd-main'));
  for (let y = CY - 71; y <= CY + 76; y += 11) s.push(line(CX - 7, y, CX + 7, y, 'd-hair'));
  s.push(circle(CX, CY, R, 'd-node'));
  s.push(line(CX, CY, CX - R, CY, 'd-leaf'));
  s.push(circle(CX - R, CY, 3.5, 'd-dot'));
  s.push(rect(CX - 12, CY - 12, 24, 24, 'd-main'));
  s.push(line(CX - 12, CY - 12, CX + 12, CY + 12, 'd-thin'));
  s.push(line(CX + 12, CY - 12, CX - 12, CY + 12, 'd-thin'));
  s.push(txt(CX - R + 14, CY - 9, `R ${(R / S / 1000).toFixed(1).replace('.', ',')} м`, 'd-dim-txt'));
  s.push(txt(CX - 46, CY + 104, 'Кран КБ-408 · путь 32 м', 'd-txt-xs'));

  // Открытый склад конструкций
  s.push(rect(494, 115, 130, 80, 'd-thin'));
  for (let i = 0; i < 3; i++) s.push(rect(504, 126 + i * 22, 110, 14, 'd-thin'));
  s.push(txt(559, 208, 'Открытый склад', 'd-txt-xs', 'middle'));

  // Бытовой городок: шесть блок-контейнеров
  for (let i = 0; i < 6; i++) {
    s.push(rect(494 + (i % 3) * 44, 250 + Math.floor(i / 3) * 26, 40, 22, 'd-thin'));
  }
  s.push(txt(560, 320, 'Бытовой городок', 'd-txt-xs', 'middle'));

  // Въезд: разрыв ограждения, стрелка, мойка колёс и пост охраны
  s.push(line(SX + 45, SY + SH, SX + 75, SY + SH, 'd-void'));
  s.push(path('M112 450l8-13 8 13', 'd-arrow'));
  s.push(rect(66, 410, 40, 34, 'd-thin'));
  s.push(rect(140, 412, 30, 24, 'd-thin'));
  s.push(txt(182, 440, 'Мойка колёс и пост охраны', 'd-txt-xs'));
  s.push(txt(300, 380, 'Временная дорога · щебень 300 мм', 'd-txt-xs'));

  // Легенда
  const lx = 24;
  const ly = 500;
  s.push(txt(lx, ly, 'УСЛОВНЫЕ ОБОЗНАЧЕНИЯ', 'd-txt-xs'));
  const legend: ['solid' | 'node' | 'main', string][] = [
    ['solid', 'строящееся здание'],
    ['node', 'граница рабочей зоны крана'],
    ['main', 'ограждение площадки'],
  ];
  legend.forEach(([kind, label], i) => {
    const y = ly + 20 + i * 18;
    if (kind === 'solid') s.push(poche(lx, y - 8, 24, 10, 'solid'));
    else s.push(line(lx, y - 3, lx + 24, y - 3, kind === 'node' ? 'd-node' : 'd-main'));
    s.push(txt(lx + 34, y, label, 'd-txt-xs'));
  });

  s.push(txt(24, 44, 'СТРОЙГЕНПЛАН', 'd-title'));
  s.push(txt(24, 62, 'на период возведения надземной части', 'd-txt-s'));
  s.push(txt(24, 78, 'М 1:500', 'd-txt-xs'));

  s.push(
    dimH({
      marks: [SX, SX + SW],
      at: SY + SH + 26,
      from: SY + SH,
      labels: [],
      total: (SW / S).toFixed(0),
    }),
  );

  s.push(
    titleBlock(348, 502, 348, {
      name: 'Стройгенплан',
      sheet: 'ППР · корпус 2',
      stage: 'ППР',
      num: '4',
      total: '38',
      org: 'ПроПТО · внешний отдел ПТО',
    }),
  );

  return s.join('');
}

/* ═══ АКТ ОСВИДЕТЕЛЬСТВОВАНИЯ СКРЫТЫХ РАБОТ ════════════════════════════════
   Форма по действующему приказу Минстроя № 344/пр: участники, предъявленные работы,
   ссылки на проект, применённые материалы, разрешение на продолжение. */

export function akt() {
  const s: string[] = [bg(W, H), frame()];

  s.push(txt(W / 2, 74, 'АКТ', 'd-title-lg', 'middle'));
  s.push(line(300, 84, 420, 84, 'd-hair'));
  s.push(txt(W / 2, 100, 'освидетельствования скрытых работ', 'd-txt', 'middle'));
  s.push(txt(W / 2, 118, '№ 128 от 14.03.2025 · г. Москва', 'd-txt-xs', 'middle'));

  // Штамп приёмки — ставится поверх листа, как на сданном комплекте
  s.push(`<g transform="rotate(-4 583 172)">${acceptStamp(508, 150, 150, 44)}</g>`);

  // Участники освидетельствования. Строки короче обычного: справа стоит штамп.
  const parties: [string, string][] = [
    ['Объект капитального строительства', 'Корпус 2, монолитный каркас'],
    ['Застройщик, технический заказчик', 'ООО «Технический заказчик»'],
    ['Лицо, осуществляющее строительство', 'ООО «Генподрядчик»'],
    ['Лицо, подготовившее проектную документацию', 'ООО «Проектное бюро»'],
  ];
  parties.forEach(([label, value], i) => {
    const y = 186 + i * 24;
    s.push(txt(72, y - 5, label, 'd-txt-xs'));
    s.push(fill(316, y, 190, value, 'd-txt-xs'));
  });

  // Разделы акта
  const blocks: [string, string][] = [
    ['1. К освидетельствованию предъявлены работы:', 'армирование плиты перекрытия на отм. +6,600, оси 1–3 / А–Б'],
    ['2. Работы выполнены по проектной документации:', 'шифр 2024-114-КЖ, лист 27, изменение 2'],
    ['3. При выполнении работ применены материалы:', 'арматура А500С ø12, сертификат № 4417/25'],
    ['4. Даты выполнения работ:', 'начало 03.03.2025 · окончание 12.03.2025'],
    ['5. Разрешается производство последующих работ:', 'устройство опалубки и бетонирование захватки 1'],
  ];
  blocks.forEach(([head, value], i) => {
    const y = 312 + i * 40;
    s.push(txt(72, y, head, 'd-txt-s'));
    s.push(fill(84, y + 18, 480, value, 'd-txt-xs'));
  });

  // Подписи участников
  s.push(txt(72, 540, 'Подписи лиц, участвовавших в освидетельствовании', 'd-txt-xs'));
  s.push(txt(W - 72, 540, 'Приложение: исполнительная схема на 2 л.', 'd-txt-xs', 'end'));
  ['Застройщик', 'Строительство', 'Проектировщик'].forEach((label, i) => {
    const x = 72 + i * 200;
    s.push(signature(x + 12, 570, i + 1));
    s.push(line(x, 580, x + 160, 580, 'd-thin'));
    s.push(txt(x, 594, label, 'd-txt-xs'));
  });

  return s.join('');
}

/* ═══ ОБЩИЙ ЖУРНАЛ РАБОТ ═══════════════════════════════════════════════════
   Раздел 3 по действующему приказу 344/пр: даты, содержание работ, отметка о контроле. */

export function zhurnal() {
  const s: string[] = [bg(W, H), frame()];

  // Отверстия под прошивку — журнал прошнурован и пронумерован
  [190, 310, 430].forEach((y) => s.push(circle(31, y, 5, 'd-thin')));

  s.push(txt(72, 62, 'ОБЩИЙ ЖУРНАЛ РАБОТ', 'd-title'));
  s.push(txt(72, 82, 'Раздел 3. Сведения о выполнении работ в процессе строительства', 'd-txt-s'));
  s.push(txt(72, 100, 'Объект: корпус 2 · форма по приказу 344/пр', 'd-txt-xs'));
  s.push(txt(W - 72, 62, 'Лист 47', 'd-txt-s', 'end'));

  const rows: [string, string, string][] = [
    ['03.03', 'Устройство опалубки перекрытия на отм. +6,600, оси 1–3 / А–Б', 'Прораб Ковалёв'],
    ['05.03', 'Армирование плиты: сетка ø12 А500С, шаг 200, защитный слой 25', 'Прораб Ковалёв'],
    ['07.03', 'Бетонирование захватки 1: В25 W6 F150, 84 м³, вибрирование', 'Инженер Седов'],
    ['08.03', 'Уход за бетоном: укрытие плёнкой, полив, t не ниже +5 °С', 'Мастер Гринёв'],
    ['11.03', 'Распалубка боковых щитов, прочность 71% проектной', 'Инженер Седов'],
    ['12.03', 'Освидетельствование скрытых работ, акт № 128, замечаний нет', 'Технадзор'],
    ['14.03', 'Геодезическая исполнительная съёмка плиты, отклонения в допуске', 'Геодезист'],
  ];

  const tx = 72;
  const tw = 576;
  const ty = 128;
  const hh = 34; // шапка
  const rh = 48;
  const c1 = tx + 62; // граница графы даты
  const c2 = tx + tw - 132; // граница графы контроля
  const th = hh + rh * rows.length;

  s.push(rect(tx, ty, tw, th, 'd-main'));
  s.push(line(tx, ty + hh, tx + tw, ty + hh, 'd-main'));
  s.push(line(c1, ty, c1, ty + th, 'd-thin'));
  s.push(line(c2, ty, c2, ty + th, 'd-thin'));

  s.push(txt(tx + 31, ty + 21, 'Дата', 'd-txt-xs', 'middle'));
  s.push(txt(c1 + 10, ty + 21, 'Наименование работ, место, объём', 'd-txt-xs'));
  s.push(txt((c2 + tx + tw) / 2, ty + 21, 'Отметка о контроле', 'd-txt-xs', 'middle'));

  rows.forEach(([date, work, who], i) => {
    const y = ty + hh + i * rh;
    if (i) s.push(line(tx, y, tx + tw, y, 'd-hair'));
    s.push(txt(tx + 31, y + 28, date, 'd-txt-s', 'middle'));
    s.push(txt(c1 + 10, y + 28, work, 'd-txt-s'));
    s.push(signature(c2 + 26, y + 24, i + 2));
    s.push(txt((c2 + tx + tw) / 2, y + 40, who, 'd-txt-xs', 'middle'));
  });

  s.push(txt(72, ty + th + 30, 'Журнал прошнурован, пронумерован и скреплён печатью', 'd-txt-xs'));
  s.push(txt(W - 72, ty + th + 30, 'Записей на листе: 7 · продолжение на листе 48', 'd-txt-xs', 'end'));

  return s.join('');
}

/* ═══ ЛОКАЛЬНАЯ СМЕТА ══════════════════════════════════════════════════════
   Фрагмент сметы базисно-индексным методом. Суммы в строках и итоги
   считаются здесь же, а не подписываются на глаз: смета, в которой строки
   не сходятся с итогом, — первое, что видит проверяющий. */

const RUB = (v: number) => v.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const QTY = (v: number) => v.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function smeta() {
  const s: string[] = [bg(W, H), frame()];

  s.push(txt(72, 62, 'ЛОКАЛЬНАЯ СМЕТА № 02-01-03', 'd-title'));
  s.push(txt(72, 82, 'на монолитные конструкции корпуса 2', 'd-txt-s'));
  s.push(txt(72, 100, 'Базисно-индексный метод · ФЕР-2020 в редакции 2022 г.', 'd-txt-xs'));

  type Row = { code: string; name: string; note: string; unit: string; qty: number; price: number };
  const rows: Row[] = [
    { code: 'ФЕР06-01-041-04', name: 'Устройство безбалочных перекрытий', note: 'толщина до 200 мм, бетон В25', unit: '100 м³', qty: 1.84, price: 78420 },
    { code: 'ФЕР06-01-015-07', name: 'Устройство бетонных стен', note: 'и перегородок, высота этажа до 3,3 м', unit: '100 м³', qty: 0.96, price: 92150 },
    { code: 'ФЕР06-01-092-05', name: 'Устройство щитовой опалубки', note: 'перекрытий, оборачиваемость 40', unit: '100 м²', qty: 6.4, price: 31780 },
    { code: 'ФЕР06-01-001-11', name: 'Заделка выпусков арматуры', note: 'с ремонтом поверхностей', unit: '100 м²', qty: 1.2, price: 18950 },
    { code: 'ФССЦ-204-0100', name: 'Арматура класса А500С, ø12 мм', note: 'горячекатаная, ГОСТ 34028-2016', unit: 'т', qty: 14.6, price: 46800 },
    { code: 'ФССЦ-401-0088', name: 'Бетон тяжёлый В25 (М350)', note: 'W6 F150, подвижность П4', unit: 'м³', qty: 196, price: 6240 },
  ];

  const tx = 60;
  const tw = 600;
  const ty = 126;
  const hh = 32;
  const rh = 44;
  // Границы граф: №, обоснование, наименование, ед. изм., кол-во, цена, всего
  const cols = [tx, tx + 24, tx + 116, tx + 342, tx + 388, tx + 438, tx + 504, tx + tw];
  const th = hh + rh * rows.length;

  s.push(rect(tx, ty, tw, th, 'd-main'));
  s.push(line(tx, ty + hh, tx + tw, ty + hh, 'd-main'));
  cols.slice(1, -1).forEach((x) => s.push(line(x, ty, x, ty + th, 'd-thin')));

  ['№', 'Обоснование', 'Наименование работ и затрат', 'Ед. изм.', 'Кол-во', 'Цена, ₽', 'Всего, ₽'].forEach((h, i) => {
    const start = i === 2;
    s.push(txt(start ? cols[i] + 8 : (cols[i] + cols[i + 1]) / 2, ty + 20, h, 'd-txt-xs', start ? 'start' : 'middle'));
  });

  let direct = 0;
  rows.forEach((r, i) => {
    const y = ty + hh + i * rh;
    const sum = r.qty * r.price;
    direct += sum;
    if (i) s.push(line(tx, y, tx + tw, y, 'd-hair'));
    s.push(txt((cols[0] + cols[1]) / 2, y + 26, i + 1, 'd-txt-s', 'middle'));
    s.push(txt(cols[1] + 6, y + 26, r.code, 'd-txt-xs'));
    s.push(txt(cols[2] + 8, y + 22, r.name, 'd-txt-s'));
    s.push(txt(cols[2] + 8, y + 35, r.note, 'd-txt-xs'));
    s.push(txt((cols[3] + cols[4]) / 2, y + 26, r.unit, 'd-txt-xs', 'middle'));
    s.push(txt(cols[5] - 8, y + 26, QTY(r.qty), 'd-txt-s', 'end'));
    s.push(txt(cols[6] - 8, y + 26, RUB(r.price), 'd-txt-s', 'end'));
    s.push(txt(cols[7] - 8, y + 26, RUB(sum), 'd-txt', 'end'));
  });

  // Итоги: накладные и сметная прибыль берутся долей от прямых затрат,
  // итог по смете — их суммой. Ни одна цифра не набрана вручную.
  const overhead = direct * 0.3;
  const totals: [string, number, string][] = [
    ['Итого прямые затраты', direct, 'd-txt-s'],
    ['Накладные расходы и сметная прибыль, 30%', overhead, 'd-txt-s'],
    ['ВСЕГО ПО СМЕТЕ', direct + overhead, 'd-txt'],
  ];
  totals.forEach(([label, value, cls], i) => {
    const y = ty + th + 24 + i * 22;
    if (i === 2) s.push(line(cols[3], y - 15, tx + tw, y - 15, 'd-main'));
    s.push(txt(cols[5] - 10, y, label, cls, 'end'));
    s.push(txt(cols[7] - 8, y, RUB(value), cls, 'end'));
  });

  ['Составил · инженер-сметчик', 'Проверил · ГИП'].forEach((label, i) => {
    const x = 60 + i * 232;
    s.push(signature(x + 12, 566, i + 4));
    s.push(line(x, 576, x + 190, 576, 'd-thin'));
    s.push(txt(x, 590, label, 'd-txt-xs'));
  });

  return s.join('');
}
