/**
 * Сгенерированные сцены — вместо фотографий.
 *
 * Фотографий у компании нет, сток запрещён разделом 5.6 ТЗ, людей владелец
 * снимать не хочет. Поэтому сцены строятся: рабочее место, площадка, стопка
 * томов, четыре объекта.
 *
 * Что делает их изображением, а не иконкой:
 *   · три уровня тона — небо светлее объекта, объект светлее переднего плана.
 *     Без этой лестницы силуэт не читается и картинка выглядит серым пятном;
 *   · перспектива объёмом: у здания видно торцевую грань, у стола — уход
 *     плоскости, поэтому предметы стоят, а не наклеены;
 *   · один источник света слева сверху, от него тени и тёплый разлив;
 *   · зерно поверх кадра: чистый градиент полосит и сразу выдаёт вектор.
 *
 * Рисуется в SVG и растрируется в WebP на сборке (`src/pages/scene`): растр
 * грузится лениво, кэшируется по имени и обрезается по контейнеру, как
 * фотография. Восемь чертёжных листов остаются инлайновыми — они читаются
 * как документы, а не как кадры.
 *
 * Палитра — из tokens.css плюс четыре тона неба. Ни одного цвета мимо системы.
 */

const C = {
  ink: '#0b0e12',
  d: '#171c22',
  d2: '#1e242c',
  d3: '#262e38',
  d4: '#323b47',
  d5: '#465262',
  d6: '#5d6b7d',
  bp: '#8fb6e0',
  bpDim: '#5b7ea8',
  g: '#e0a94a',
  gHi: '#f3cd84',
  gDim: '#a87c33',
  ok: '#3ec46d',
  paper: '#eceef2',
  paper2: '#d3d8e0',
  paper3: '#aab2c0',
  white: '#f4f5f7',
  /** Сумеречное небо: объект читается силуэтом, как на архитектурной подаче. */
  sky1: '#2a3646',
  sky2: '#3d4d61',
  sky3: '#5a6d84',
  sky4: '#7d8ea3',
};

const n = (v: number) => (Math.round(v * 100) / 100).toString();

/* ── Общие определения ────────────────────────────────────────────────────── */

function defs(id: string) {
  return `<defs>
    <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${C.sky1}"/>
      <stop offset="0.45" stop-color="${C.sky2}"/>
      <stop offset="0.8" stop-color="${C.sky3}"/>
      <stop offset="1" stop-color="${C.sky4}"/>
    </linearGradient>
    <linearGradient id="${id}-air" x1="0.1" y1="0" x2="0.9" y2="1">
      <stop offset="0" stop-color="${C.d3}"/>
      <stop offset="0.55" stop-color="${C.d2}"/>
      <stop offset="1" stop-color="${C.ink}"/>
    </linearGradient>
    <linearGradient id="${id}-desk" x1="0" y1="0" x2="0.25" y2="1">
      <stop offset="0" stop-color="${C.d4}"/>
      <stop offset="0.6" stop-color="${C.d2}"/>
      <stop offset="1" stop-color="${C.ink}"/>
    </linearGradient>
    <linearGradient id="${id}-paper" x1="0.05" y1="0" x2="0.7" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.45" stop-color="${C.paper}"/>
      <stop offset="1" stop-color="${C.paper2}"/>
    </linearGradient>
    <linearGradient id="${id}-face" x1="0" y1="0" x2="0.15" y2="1">
      <stop offset="0" stop-color="${C.d3}"/>
      <stop offset="1" stop-color="${C.d}"/>
    </linearGradient>
    <linearGradient id="${id}-side" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="${C.d}"/>
      <stop offset="1" stop-color="${C.ink}"/>
    </linearGradient>
    <linearGradient id="${id}-glass" x1="0" y1="0" x2="0.7" y2="1">
      <stop offset="0" stop-color="${C.sky3}" stop-opacity="0.85"/>
      <stop offset="0.55" stop-color="${C.bpDim}" stop-opacity="0.5"/>
      <stop offset="1" stop-color="${C.ink}" stop-opacity="0.95"/>
    </linearGradient>
    <linearGradient id="${id}-water" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${C.sky3}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${C.ink}" stop-opacity="0.95"/>
    </linearGradient>
    <radialGradient id="${id}-lamp" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${C.gHi}" stop-opacity="0.42"/>
      <stop offset="0.5" stop-color="${C.g}" stop-opacity="0.12"/>
      <stop offset="1" stop-color="${C.g}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${id}-glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${C.gHi}" stop-opacity="0.9"/>
      <stop offset="1" stop-color="${C.g}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${id}-vign" cx="0.5" cy="0.42" r="0.78">
      <stop offset="0.6" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.34"/>
    </radialGradient>
    <filter id="${id}-soft" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="10"/>
    </filter>
    <filter id="${id}-haze" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="26"/>
    </filter>
    <filter id="${id}-grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.5"/></feComponentTransfer>
    </filter>
  </defs>`;
}

/* Зерно даётся без режима наложения: растеризатор его не поддерживает,
   а полупрозрачный шум поверх кадра работает и так. */
const grain = (id: string, w: number, h: number, o = 0.085) =>
  `<rect width="${w}" height="${h}" filter="url(#${id}-grain)" opacity="${o}"/>`;

const vignette = (id: string, w: number, h: number) =>
  `<rect width="${w}" height="${h}" fill="url(#${id}-vign)"/>`;

const drop = (id: string, x: number, y: number, rx: number, ry: number, o = 0.6) =>
  `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" fill="${C.ink}" opacity="${o}" filter="url(#${id}-soft)"/>`;

const glow = (id: string, x: number, y: number, r: number, o = 0.5) =>
  `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="url(#${id}-glow)" opacity="${o}"/>`;

const poly = (pts: [number, number][], fill: string, extra = '') =>
  `<polygon points="${pts.map(([x, y]) => `${n(x)},${n(y)}`).join(' ')}" fill="${fill}"${extra}/>`;

const rect = (x: number, y: number, w: number, h: number, fill: string, extra = '') =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}"${extra}/>`;

const line = (x1: number, y1: number, x2: number, y2: number, stroke: string, sw = 1, o = 1) =>
  `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${stroke}" stroke-width="${n(sw)}" opacity="${o}" stroke-linecap="round"/>`;

const rnd = (seed: number) => {
  let t = (seed * 9301 + 49297) % 233280;
  return () => (t = (t * 9301 + 49297) % 233280) / 233280;
};

/** Лист бумаги в лёгкой перспективе с торцом. */
function sheet(id: string, x: number, y: number, w: number, h: number, skew = 0.05, rot = 0) {
  const dx = w * skew;
  return (
    `<g transform="rotate(${rot} ${n(x + w / 2)} ${n(y + h / 2)})">` +
    poly([[x + dx, y], [x + w - dx, y], [x + w, y + h], [x, y + h]], `url(#${id}-paper)`) +
    poly([[x, y + h], [x + w, y + h], [x + w - 1, y + h + 4], [x + 1, y + h + 4]], C.paper3) +
    '</g>'
  );
}

function textLines(x: number, y: number, w: number, rows: number, gap = 7, seed = 1, col = C.d3) {
  const r = rnd(seed);
  const out: string[] = [];
  for (let i = 0; i < rows; i++) out.push(line(x, y + i * gap, x + w * (0.4 + r() * 0.6), y + i * gap, col, gap * 0.2, 0.55));
  return out.join('');
}

/** Штамп «принято» — зелёная рамка с галочкой, слегка повёрнутая. */
function stamp(x: number, y: number, w: number, h: number, rot = -6) {
  return (
    `<g transform="rotate(${rot} ${n(x + w / 2)} ${n(y + h / 2)})">` +
    `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="none" stroke="${C.ok}" stroke-width="${n(h * 0.09)}" rx="${n(h * 0.08)}"/>` +
    `<path d="M${n(x + w * 0.12)} ${n(y + h * 0.55)}l${n(w * 0.1)} ${n(h * 0.2)} ${n(w * 0.2)} -${n(h * 0.42)}" fill="none" stroke="${C.ok}" stroke-width="${n(h * 0.12)}" stroke-linecap="round"/>` +
    `<rect x="${n(x + w * 0.42)}" y="${n(y + h * 0.3)}" width="${n(w * 0.46)}" height="${n(h * 0.12)}" fill="${C.ok}" opacity="0.75" rx="1"/>` +
    `<rect x="${n(x + w * 0.42)}" y="${n(y + h * 0.54)}" width="${n(w * 0.32)}" height="${n(h * 0.09)}" fill="${C.ok}" opacity="0.5" rx="1"/>` +
    '</g>'
  );
}

/* ═══ РАБОЧЕЕ МЕСТО ════════════════════════════════════════════════════════ */

function stol(id: string, W: number, H: number, monitors: 1 | 2) {
  const s: string[] = [];
  const dy = H * 0.44;

  // Стена и разлив света от лампы
  s.push(rect(0, 0, W, H, `url(#${id}-air)`));
  s.push(`<ellipse cx="${n(W * 0.3)}" cy="${n(H * 0.12)}" rx="${n(W * 0.55)}" ry="${n(H * 0.42)}" fill="url(#${id}-lamp)"/>`);

  // Лампа: конус света на стол
  s.push(poly([[W * 0.06, 0], [W * 0.2, 0], [W * 0.52, H], [-W * 0.14, H]], C.gHi, ' opacity="0.07"'));

  // Столешница
  s.push(poly([[-60, dy], [W + 60, dy], [W + 200, H + 60], [-200, H + 60]], `url(#${id}-desk)`));
  s.push(line(-60, dy, W + 60, dy, C.d6, 2, 0.55));

  // Мониторы
  const mw = W * (monitors === 2 ? 0.31 : 0.44);
  const mh = mw * 0.6;
  const my = dy - mh - H * 0.05;
  const put = (mx: number, kind: 'plan' | 'table') => {
    s.push(drop(id, mx + mw / 2, dy + 14, mw * 0.46, 12, 0.7));
    s.push(rect(mx - 5, my - 5, mw + 10, mh + 10, C.d5, ' rx="5"'));
    s.push(rect(mx, my, mw, mh, C.ink));
    s.push(rect(mx, my, mw, mh * 0.42, C.sky2, ' opacity="0.06"'));
    const px = mx + mw * 0.1;
    const py = my + mh * 0.14;
    const pw = mw * 0.8;
    const ph = mh * 0.72;
    if (kind === 'plan') {
      s.push(rect(px, py, pw, ph, C.bp, ' opacity="0.07"'));
      s.push(`<rect x="${n(px)}" y="${n(py)}" width="${n(pw)}" height="${n(ph)}" fill="none" stroke="${C.bp}" stroke-width="${n(mw * 0.012)}" opacity="0.9"/>`);
      s.push(line(px + pw * 0.44, py, px + pw * 0.44, py + ph, C.bp, mw * 0.009, 0.75));
      s.push(line(px, py + ph * 0.56, px + pw * 0.44, py + ph * 0.56, C.bp, mw * 0.009, 0.75));
      s.push(rect(px + pw * 0.5, py + ph * 0.12, pw * 0.36, ph * 0.34, C.bp, ' opacity="0.16"'));
      for (let i = 0; i <= 4; i++) {
        const x1 = px + (pw / 4) * i;
        s.push(line(x1, py + ph + mh * 0.06, x1, py + ph + mh * 0.1, C.bp, mw * 0.004, 0.5));
      }
      s.push(line(px, py + ph + mh * 0.08, px + pw, py + ph + mh * 0.08, C.bp, mw * 0.004, 0.5));
    } else {
      for (let i = 0; i < 11; i++) {
        const y = py + i * (ph / 11);
        s.push(line(px, y, px + pw * (0.3 + ((i * 7) % 5) * 0.13), y, C.bp, mh * 0.012, 0.45));
        s.push(line(px + pw * 0.78, y, px + pw, y, C.g, mh * 0.012, 0.45));
      }
      s.push(line(px, py + ph * 0.5, px + pw, py + ph * 0.5, C.bp, mh * 0.008, 0.25));
    }
    s.push(rect(mx + mw / 2 - mw * 0.02, my + mh, mw * 0.04, H * 0.04, C.d5));
    s.push(rect(mx + mw / 2 - mw * 0.16, my + mh + H * 0.04, mw * 0.32, H * 0.012, C.d5, ' rx="3"'));
  };
  if (monitors === 2) {
    put(W * 0.06, 'plan');
    put(W * 0.44, 'table');
  } else {
    put(W * 0.46, 'plan');
  }

  // Раскрытый комплект на столе
  s.push(drop(id, W * 0.27, H * 0.86, W * 0.24, 20, 0.6));
  s.push(sheet(id, W * 0.03, H * 0.6, W * 0.34, H * 0.3, 0.04, -5));
  s.push(sheet(id, W * 0.09, H * 0.63, W * 0.33, H * 0.3, 0.04, 3));
  s.push(`<g transform="rotate(3 ${n(W * 0.25)} ${n(H * 0.78)})">${textLines(W * 0.13, H * 0.7, W * 0.22, 9, H * 0.019, 3)}</g>`);
  s.push(`<g transform="rotate(3 ${n(W * 0.25)} ${n(H * 0.78)})">${line(W * 0.13, H * 0.675, W * 0.28, H * 0.675, C.d, H * 0.006, 0.8)}</g>`);
  s.push(stamp(W * 0.3, H * 0.66, W * 0.11, H * 0.052, -7));

  // Стопка папок с ярлыками
  const fx = W * 0.71;
  s.push(drop(id, fx + W * 0.11, H * 0.94, W * 0.13, 16, 0.6));
  for (let i = 0; i < 5; i++) {
    const y = H * 0.9 - i * H * 0.048;
    s.push(rect(fx - i * 4, y, W * 0.22, H * 0.046, i % 2 ? C.d4 : C.d3, ' rx="3"'));
    s.push(rect(fx - i * 4, y, W * 0.22, H * 0.008, C.d5, ' opacity="0.8" rx="3"'));
    s.push(rect(fx - i * 4 + W * 0.014, y + H * 0.014, W * 0.055, H * 0.02, C.g, ' opacity="0.85" rx="2"'));
    s.push(line(fx - i * 4 + W * 0.078, y + H * 0.021, fx - i * 4 + W * 0.16, y + H * 0.021, C.d6, H * 0.004, 0.6));
  }

  // Линейка, карандаш, кружка
  s.push(`<g transform="rotate(7 ${n(W * 0.55)} ${n(H * 0.72)})">${rect(W * 0.44, H * 0.7, W * 0.22, H * 0.016, C.bp, ' opacity="0.3" rx="3"')}${Array.from({ length: 11 }, (_, i) => line(W * 0.45 + i * (W * 0.02), H * 0.7, W * 0.45 + i * (W * 0.02), H * 0.708, C.white, 1.6, 0.45)).join('')}</g>`);
  s.push(`<g transform="rotate(-15 ${n(W * 0.5)} ${n(H * 0.93)})">${rect(W * 0.42, H * 0.925, W * 0.15, H * 0.011, C.g, ' rx="3"')}${rect(W * 0.42, H * 0.925, W * 0.03, H * 0.011, C.gDim, ' rx="3"')}${poly([[W * 0.57, H * 0.925], [W * 0.595, H * 0.9305], [W * 0.57, H * 0.936]], C.paper)}</g>`);
  s.push(drop(id, W * 0.9, H * 0.72, W * 0.045, 10, 0.55));
  s.push(rect(W * 0.865, H * 0.6, W * 0.075, H * 0.11, C.d5, ' rx="4"'));
  s.push(`<path d="M${n(W * 0.94)} ${n(H * 0.625)}h${n(W * 0.012)}a${n(W * 0.022)} ${n(H * 0.028)} 0 0 1 0 ${n(H * 0.056)}h-${n(W * 0.012)}" fill="none" stroke="${C.d5}" stroke-width="${n(W * 0.011)}"/>`);
  s.push(`<ellipse cx="${n(W * 0.9025)}" cy="${n(H * 0.6)}" rx="${n(W * 0.0375)}" ry="${n(H * 0.011)}" fill="${C.d2}"/>`);
  s.push(`<ellipse cx="${n(W * 0.9025)}" cy="${n(H * 0.601)}" rx="${n(W * 0.03)}" ry="${n(H * 0.008)}" fill="${C.gDim}" opacity="0.55"/>`);

  s.push(vignette(id, W, H));
  s.push(grain(id, W, H));
  return s.join('');
}

/* ═══ ПЛОЩАДКА ════════════════════════════════════════════════════════════ */

function ploshchadka(id: string, W: number, H: number) {
  const s: string[] = [];
  const hor = H * 0.74;
  const r = rnd(11);

  s.push(rect(0, 0, W, H, `url(#${id}-sky)`));
  s.push(`<ellipse cx="${n(W * 0.76)}" cy="${n(hor)}" rx="${n(W * 0.4)}" ry="${n(H * 0.55)}" fill="url(#${id}-lamp)"/>`);

  // Дальний город силуэтом
  for (let x = -20; x < W + 40; ) {
    const w = 34 + r() * 74;
    const h = 40 + r() * 130;
    s.push(rect(x, hor - h, w, h, C.sky1, ' opacity="0.65"'));
    x += w + 3 + r() * 14;
  }
  s.push(rect(0, hor - H * 0.16, W, H * 0.16, C.sky3, ` opacity="0.16" filter="url(#${id}-haze)"`));

  // Возводимый каркас: девять этажей, верхний недостроен
  const bx = W * 0.42;
  const bw = W * 0.34;
  const bd = W * 0.05; // торцевая грань
  const floors = 9;
  const fh = (hor - H * 0.1) / floors;
  s.push(drop(id, bx + bw / 2, hor + 10, bw * 0.75, 18, 0.7));
  for (let f = 0; f < floors; f++) {
    const y = hor - (f + 1) * fh;
    const w = f === floors - 1 ? bw * 0.6 : bw;
    // Торец
    s.push(poly([[bx + w, y], [bx + w + bd, y - bd * 0.5], [bx + w + bd, y + fh - bd * 0.5], [bx + w, y + fh]], `url(#${id}-side)`));
    // Фасад
    s.push(rect(bx, y, w, fh, `url(#${id}-face)`));
    // Перекрытие
    s.push(rect(bx, y + fh - fh * 0.16, w, fh * 0.16, C.d5, ' opacity="0.9"'));
    s.push(poly([[bx + w, y + fh - fh * 0.16], [bx + w + bd, y + fh - fh * 0.16 - bd * 0.5], [bx + w + bd, y + fh - bd * 0.5], [bx + w, y + fh]], C.d4));
    // Колонны
    for (let c = 0; c <= 4; c++) s.push(line(bx + (w / 4) * c, y, bx + (w / 4) * c, y + fh - fh * 0.16, C.d5, W * 0.005, 0.95));
    // Остекление на нижних этажах
    // Остекление только на нижней трети: выше — открытый каркас
    if (f < 3)
      for (let c = 0; c < 4; c++)
        s.push(rect(bx + (w / 4) * c + w * 0.02, y + fh * 0.14, w / 4 - w * 0.04, fh * 0.62, `url(#${id}-glass)`));
    // Выше третьего этажа видно небо между колоннами и стойки опалубки
    if (f >= 3 && f < floors - 1)
      for (let c = 0; c < 4; c++) {
        const x0 = bx + (w / 4) * c + w * 0.03;
        const bwid = w / 4 - w * 0.06;
        s.push(rect(x0, y + fh * 0.16, bwid, fh * 0.6, C.ink, ' opacity="0.55"'));
        for (let k = 0; k < 3; k++)
          s.push(line(x0 + bwid * (0.25 + k * 0.25), y + fh * 0.16, x0 + bwid * (0.25 + k * 0.25), y + fh * 0.76, C.d5, W * 0.0018, 0.6));
      }
    // Свет в паре окон
    if (f < 3 && r() > 0.5)
      s.push(rect(bx + (w / 4) * Math.floor(r() * 4) + w * 0.02, y + fh * 0.14, w / 4 - w * 0.04, fh * 0.62, C.g, ' opacity="0.22"'));
  }
  // Выпуски арматуры
  for (let i = 0; i < 14; i++) {
    const x1 = bx + 8 + i * ((bw * 0.6 - 16) / 13);
    s.push(line(x1, hor - floors * fh, x1, hor - floors * fh - H * 0.02 - r() * H * 0.012, C.d5, W * 0.0022, 0.85));
  }

  // Башенный кран — главный силуэт кадра
  const cx = W * 0.26;
  const top = H * 0.04;
  const mast = W * 0.008;
  s.push(line(cx, hor, cx, top, C.d3, mast * 3, 1));
  for (let y = top + 18; y < hor; y += H * 0.045) {
    s.push(line(cx - mast * 1.6, y, cx + mast * 1.6, y - H * 0.024, C.d4, mast, 0.9));
    s.push(line(cx - mast * 1.6, y - H * 0.024, cx + mast * 1.6, y, C.d4, mast, 0.9));
    s.push(line(cx - mast * 1.6, y, cx + mast * 1.6, y, C.d4, mast * 0.7, 0.6));
  }
  // Кабина, стрела, противовес, расчалки
  s.push(rect(cx + mast * 1.6, top + H * 0.02, W * 0.016, H * 0.045, C.d3, ' rx="2"'));
  s.push(line(cx, top + H * 0.012, cx + W * 0.34, top + H * 0.035, C.d3, mast * 3.2, 1));
  s.push(line(cx, top + H * 0.012, cx - W * 0.12, top + H * 0.03, C.d3, mast * 3.2, 1));
  s.push(rect(cx - W * 0.145, top + H * 0.012, W * 0.04, H * 0.042, C.d3, ' rx="2"'));
  s.push(rect(cx - W * 0.145, top + H * 0.012, W * 0.04, H * 0.01, C.d5, ' opacity="0.6" rx="2"'));
  s.push(line(cx, top - H * 0.06, cx + W * 0.32, top + H * 0.033, C.d4, mast * 0.7, 0.85));
  s.push(line(cx, top - H * 0.06, cx - W * 0.095, top + H * 0.026, C.d4, mast * 0.7, 0.85));
  s.push(line(cx, top + H * 0.012, cx, top - H * 0.07, C.d3, mast * 1.6, 1));
  for (let i = 1; i < 9; i++) {
    const t = i / 9;
    s.push(line(cx + W * 0.34 * t, top + H * 0.035 * t + H * 0.012 * (1 - t), cx + W * 0.34 * (t + 0.055), top + H * 0.012, C.d4, mast * 0.5, 0.5));
  }
  // Трос и груз
  const hx = cx + W * 0.24;
  s.push(line(hx, top + H * 0.03, hx, hor - H * 0.26, C.d4, mast * 0.5, 0.9));
  s.push(rect(hx - W * 0.02, hor - H * 0.26, W * 0.04, H * 0.022, C.g, ' opacity="0.85" rx="2"'));
  // Проблесковый огонь
  s.push(glow(id, cx, top - H * 0.078, W * 0.028, 0.85));
  s.push(`<circle cx="${n(cx)}" cy="${n(top - H * 0.078)}" r="${n(W * 0.0035)}" fill="${C.gHi}"/>`);

  // Земля, ограждение, бытовки, прожекторы
  s.push(rect(0, hor, W, H - hor, C.ink));
  s.push(poly([[0, hor], [W, hor], [W, hor + H * 0.02], [0, hor + H * 0.03]], C.d2));
  const fy = hor + H * 0.03;
  for (let i = 0; i * (W * 0.026) < W + 20; i++) {
    const x1 = i * W * 0.026;
    s.push(rect(x1, fy, W * 0.021, H * 0.07, i % 3 ? C.d2 : C.d3, ' rx="1"'));
  }
  s.push(rect(0, fy, W, H * 0.007, C.d5, ' opacity="0.5"'));
  s.push(rect(0, fy + H * 0.062, W, H * 0.008, C.d4, ' opacity="0.35"'));
  // Передний план: штабели материалов у ограждения — глубина кадра
  for (const [px2, pw2, ph2] of [[W * 0.05, W * 0.11, H * 0.05], [W * 0.62, W * 0.14, H * 0.04], [W * 0.86, W * 0.1, H * 0.055]] as [number, number, number][]) {
    for (let k = 0; k < 3; k++)
      s.push(rect(px2 + k * 3, H - ph2 - H * 0.02 + k * (ph2 / 3.4), pw2 - k * 6, ph2 / 3.6, k % 2 ? C.d2 : C.d3, ' rx="1"'));
  }
  const vx = W * 0.8;
  for (let i = 0; i < 2; i++) {
    const y = hor - H * 0.05 - i * H * 0.045;
    s.push(rect(vx + i * W * 0.012, y, W * 0.11, H * 0.045, i ? C.d3 : C.d4, ' rx="2"'));
    s.push(rect(vx + i * W * 0.012 + W * 0.012, y + H * 0.012, W * 0.018, H * 0.018, C.g, ' opacity="0.5"'));
    s.push(rect(vx + i * W * 0.012 + W * 0.042, y + H * 0.012, W * 0.018, H * 0.018, C.g, ' opacity="0.28"'));
  }
  for (const px of [W * 0.34, W * 0.72]) {
    s.push(line(px, hor, px, hor - H * 0.2, C.d3, W * 0.004, 0.95));
    s.push(rect(px - W * 0.014, hor - H * 0.215, W * 0.028, H * 0.018, C.d3, ' rx="2"'));
    s.push(glow(id, px, hor - H * 0.206, W * 0.05, 0.5));
  }

  s.push(vignette(id, W, H));
  s.push(grain(id, W, H));
  return s.join('');
}

/* ═══ СТОПКА ТОМОВ ════════════════════════════════════════════════════════ */

function toma(id: string, W: number, H: number) {
  const s: string[] = [];
  const dy = H * 0.42;
  s.push(rect(0, 0, W, H, `url(#${id}-air)`));
  s.push(`<ellipse cx="${n(W * 0.34)}" cy="${n(H * 0.1)}" rx="${n(W * 0.6)}" ry="${n(H * 0.45)}" fill="url(#${id}-lamp)"/>`);
  s.push(poly([[-60, dy], [W + 60, dy], [W + 220, H + 60], [-220, H + 60]], `url(#${id}-desk)`));
  s.push(line(-60, dy, W + 60, dy, C.d6, 2, 0.5));

  // Стеллаж на заднем плане: верх кадра перестаёт быть пустым
  for (let i = 0; i < 2; i++) {
    const sy = H * (0.1 + i * 0.16);
    s.push(rect(W * 0.06, sy, W * 0.88, H * 0.012, C.d3, ' opacity="0.9"'));
    s.push(rect(W * 0.06, sy + H * 0.012, W * 0.88, H * 0.006, C.ink, ' opacity="0.6"'));
    const rr = rnd(31 + i * 7);
    let x = W * 0.09;
    while (x < W * 0.9) {
      const bwid = W * (0.024 + rr() * 0.03);
      const bhh = H * (0.085 + rr() * 0.035);
      s.push(rect(x, sy - bhh, bwid, bhh, rr() > 0.5 ? C.d3 : C.d4, ' rx="1"'));
      s.push(rect(x + bwid * 0.2, sy - bhh * 0.72, bwid * 0.6, bhh * 0.16, C.g, ' opacity="0.5" rx="1"'));
      x += bwid + W * 0.007;
    }
  }

  const bw = W * 0.46;
  const bh = H * 0.082;
  const bd = W * 0.055;
  const bx = W * 0.24;
  s.push(drop(id, bx + bw * 0.52, H * 0.9, bw * 0.62, 22, 0.65));

  // Пять томов: торец блока, корешок слева, верхняя грань
  for (let i = 0; i < 5; i++) {
    const y = H * 0.86 - i * bh;
    const off = (i % 2 ? 1 : -1) * i * 5;
    s.push(`<g transform="translate(${n(off)} 0)">`);
    s.push(poly([[bx, y], [bx + bw, y], [bx + bw + bd * 0.5, y - bh * 0.3], [bx + bd * 0.5, y - bh * 0.3]], C.paper));
    s.push(rect(bx, y, bw, bh, i % 2 ? C.paper2 : C.paper, ' rx="1"'));
    for (let k = 1; k < 7; k++) s.push(line(bx, y + (bh / 7) * k, bx + bw, y + (bh / 7) * k, C.paper3, bh * 0.045, 0.5));
    // Корешок
    s.push(rect(bx - W * 0.042, y - bh * 0.3, W * 0.042, bh * 1.3, i % 2 ? C.d4 : C.d5, ' rx="2"'));
    s.push(rect(bx - W * 0.036, y + bh * 0.08, W * 0.03, bh * 0.55, C.g, ' opacity="0.8" rx="1"'));
    s.push(line(bx - W * 0.042, y - bh * 0.3, bx - W * 0.042, y + bh, C.ink, 2, 0.5));
    s.push('</g>');
  }

  // Второй штабель справа, ниже и дальше
  const sx2 = W * 0.71;
  s.push(drop(id, sx2 + W * 0.1, H * 0.895, W * 0.11, 14, 0.6));
  for (let i = 0; i < 3; i++) {
    const y = H * 0.87 - i * H * 0.042;
    s.push(rect(sx2, y, W * 0.2, H * 0.041, i % 2 ? C.paper3 : C.d6, ' rx="1" opacity="0.9"'));
    s.push(rect(sx2 - W * 0.028, y, W * 0.028, H * 0.041, i % 2 ? C.d4 : C.d5, ' rx="1"'));
    s.push(rect(sx2 - W * 0.024, y + H * 0.007, W * 0.02, H * 0.021, C.g, ' opacity="0.7" rx="1"'));
  }

  // Верхний том раскрыт: титул с описью и штампом
  const tx = bx + W * 0.02;
  const ty = H * 0.3;
  const tw = W * 0.44;
  const th = H * 0.33;
  s.push(drop(id, tx + tw * 0.5, ty + th + 10, tw * 0.5, 14, 0.55));
  s.push(`<g transform="rotate(-4 ${n(tx + tw / 2)} ${n(ty + th / 2)})">`);
  s.push(rect(tx, ty, tw, th, `url(#${id}-paper)`, ' rx="2"'));
  s.push(`<rect x="${n(tx + tw * 0.05)}" y="${n(ty + th * 0.06)}" width="${n(tw * 0.9)}" height="${n(th * 0.88)}" fill="none" stroke="${C.bpDim}" stroke-width="${n(tw * 0.005)}" opacity="0.7"/>`);
  s.push(line(tx + tw * 0.18, ty + th * 0.2, tx + tw * 0.82, ty + th * 0.2, C.d, th * 0.035, 0.85));
  s.push(line(tx + tw * 0.3, ty + th * 0.28, tx + tw * 0.7, ty + th * 0.28, C.d3, th * 0.02, 0.55));
  for (let i = 0; i < 6; i++) {
    const y = ty + th * 0.4 + i * (th * 0.075);
    s.push(line(tx + tw * 0.12, y, tx + tw * 0.62, y, C.d3, th * 0.014, 0.45));
    s.push(line(tx + tw * 0.72, y, tx + tw * 0.86, y, C.d3, th * 0.014, 0.3));
  }
  s.push(stamp(tx + tw * 0.5, ty + th * 0.76, tw * 0.38, th * 0.16, -7));
  s.push('</g>');

  s.push(vignette(id, W, H));
  s.push(grain(id, W, H));
  return s.join('');
}

/* ═══ ЧЕРТЁЖ НА СТОЛЕ ═════════════════════════════════════════════════════ */

function razbor(id: string, W: number, H: number) {
  const s: string[] = [];
  s.push(rect(0, 0, W, H, `url(#${id}-desk)`));
  s.push(`<ellipse cx="${n(W * 0.38)}" cy="${n(H * 0.14)}" rx="${n(W * 0.6)}" ry="${n(H * 0.6)}" fill="url(#${id}-lamp)"/>`);

  const px = W * 0.09;
  const py = H * 0.14;
  const pw = W * 0.74;
  const ph = H * 0.7;
  s.push(drop(id, px + pw / 2, py + ph + 14, pw * 0.52, 20, 0.7));
  s.push(`<g transform="rotate(-2.5 ${n(W / 2)} ${n(H / 2)})">`);
  s.push(rect(px, py, pw, ph, `url(#${id}-paper)`, ' rx="2"'));
  s.push(`<rect x="${n(px + pw * 0.03)}" y="${n(py + ph * 0.035)}" width="${n(pw * 0.94)}" height="${n(ph * 0.93)}" fill="none" stroke="${C.bpDim}" stroke-width="${n(pw * 0.004)}" opacity="0.75"/>`);

  const gx = px + pw * 0.14;
  const gy = py + ph * 0.22;
  const gw = pw * 0.54;
  const gh = ph * 0.46;
  s.push(`<rect x="${n(gx)}" y="${n(gy)}" width="${n(gw)}" height="${n(gh)}" fill="none" stroke="${C.bpDim}" stroke-width="${n(gw * 0.018)}"/>`);
  s.push(line(gx + gw * 0.44, gy, gx + gw * 0.44, gy + gh, C.bpDim, gw * 0.012, 0.95));
  s.push(line(gx, gy + gh * 0.58, gx + gw * 0.44, gy + gh * 0.58, C.bpDim, gw * 0.012, 0.95));
  s.push(rect(gx + gw * 0.48, gy + gh * 0.1, gw * 0.4, gh * 0.34, C.bp, ' opacity="0.16"'));
  // Лестница
  for (let i = 0; i < 7; i++) s.push(line(gx + gw * 0.06, gy + gh * 0.66 + i * gh * 0.042, gx + gw * 0.34, gy + gh * 0.66 + i * gh * 0.042, C.bpDim, gw * 0.006, 0.7));
  // Размерная цепочка и оси
  for (let i = 0; i <= 4; i++) {
    const x1 = gx + (gw / 4) * i;
    s.push(line(x1, gy + gh + ph * 0.03, x1, gy + gh + ph * 0.06, C.d3, gw * 0.004, 0.55));
    s.push(line(x1, gy - ph * 0.05, x1, gy, C.d3, gw * 0.003, 0.4));
    s.push(`<circle cx="${n(x1)}" cy="${n(gy - ph * 0.07)}" r="${n(gw * 0.026)}" fill="none" stroke="${C.d3}" stroke-width="${n(gw * 0.004)}" opacity="0.6"/>`);
  }
  s.push(line(gx, gy + gh + ph * 0.045, gx + gw, gy + gh + ph * 0.045, C.d3, gw * 0.004, 0.6));
  // Штамп чертежа
  s.push(`<rect x="${n(px + pw * 0.5)}" y="${n(py + ph * 0.76)}" width="${n(pw * 0.44)}" height="${n(ph * 0.15)}" fill="none" stroke="${C.d3}" stroke-width="${n(pw * 0.004)}" opacity="0.85"/>`);
  s.push(line(px + pw * 0.5, py + ph * 0.83, px + pw * 0.94, py + ph * 0.83, C.d3, pw * 0.003, 0.5));
  s.push(line(px + pw * 0.66, py + ph * 0.76, px + pw * 0.66, py + ph * 0.91, C.d3, pw * 0.003, 0.5));
  s.push(line(px + pw * 0.82, py + ph * 0.76, px + pw * 0.82, py + ph * 0.91, C.d3, pw * 0.003, 0.5));
  s.push(textLines(px + pw * 0.07, py + ph * 0.79, pw * 0.34, 4, ph * 0.032, 9));
  // Пометки инженера
  s.push(`<circle cx="${n(gx + gw * 0.22)}" cy="${n(gy + gh * 0.34)}" r="${n(gh * 0.18)}" fill="none" stroke="${C.g}" stroke-width="${n(gh * 0.022)}" opacity="0.95"/>`);
  s.push(`<path d="M${n(gx + gw * 0.5)} ${n(gy + gh * 0.78)}c${n(gw * 0.06)} -${n(gh * 0.1)} ${n(gw * 0.14)} ${n(gh * 0.06)} ${n(gw * 0.22)} -${n(gh * 0.04)}" fill="none" stroke="${C.g}" stroke-width="${n(gh * 0.022)}" stroke-linecap="round" opacity="0.95"/>`);
  s.push(`<path d="M${n(gx + gw * 0.34)} ${n(gy + gh * 0.22)}l${n(gw * 0.12)} -${n(gh * 0.14)}" stroke="${C.g}" stroke-width="${n(gh * 0.018)}" opacity="0.8" stroke-linecap="round"/>`);
  s.push('</g>');

  // Линейка и карандаш
  s.push(`<g transform="rotate(-26 ${n(W * 0.82)} ${n(H * 0.58)})">${rect(W * 0.64, H * 0.54, W * 0.36, H * 0.026, C.bp, ' opacity="0.32" rx="4"')}${Array.from({ length: 15 }, (_, i) => line(W * 0.652 + i * (W * 0.023), H * 0.54, W * 0.652 + i * (W * 0.023), H * 0.552, C.white, 2, 0.5)).join('')}</g>`);
  s.push(drop(id, W * 0.6, H * 0.94, W * 0.13, 9, 0.55));
  s.push(`<g transform="rotate(10 ${n(W * 0.6)} ${n(H * 0.92)})">${rect(W * 0.48, H * 0.905, W * 0.22, H * 0.014, C.g, ' rx="4"')}${rect(W * 0.48, H * 0.905, W * 0.045, H * 0.014, C.gDim, ' rx="4"')}${poly([[W * 0.7, H * 0.905], [W * 0.73, H * 0.912], [W * 0.7, H * 0.919]], C.paper)}</g>`);

  s.push(vignette(id, W, H));
  s.push(grain(id, W, H));
  return s.join('');
}

/* ═══ ЖУРНАЛ РАБОТ ════════════════════════════════════════════════════════ */

function zhurnal(id: string, W: number, H: number) {
  const s: string[] = [];
  s.push(rect(0, 0, W, H, `url(#${id}-desk)`));
  s.push(`<ellipse cx="${n(W * 0.44)}" cy="${n(H * 0.12)}" rx="${n(W * 0.6)}" ry="${n(H * 0.55)}" fill="url(#${id}-lamp)"/>`);

  const cx = W * 0.5;
  const top = H * 0.2;
  const bot = H * 0.82;
  const half = W * 0.38;
  s.push(drop(id, cx, bot + 16, half * 1.05, 22, 0.7));
  // Блок страниц под разворотом
  s.push(poly([[cx - half - 8, top + 26], [cx + half + 8, top + 26], [cx + half, bot + 16], [cx - half, bot + 16]], C.paper3));
  // Левая и правая страницы
  s.push(poly([[cx - half, top + 20], [cx, top], [cx, bot], [cx - half + 12, bot + 12]], `url(#${id}-paper)`));
  s.push(poly([[cx, top], [cx + half, top + 20], [cx + half - 12, bot + 12], [cx, bot]], C.paper2));
  s.push(line(cx, top, cx, bot, C.paper3, 4, 0.85));
  s.push(poly([[cx - 12, top + 4], [cx, top], [cx, bot], [cx - 10, bot - 2]], C.paper3, ' opacity="0.5"'));

  // Разграфка: три графы, шапка, строки
  const colL = [0.34, 0.72];
  for (const c of colL) s.push(line(cx - half * (1 - c) - half * 0.02, top + 30, cx - half * (1 - c) + half * 0.01, bot - 6, C.d3, 2.4, 0.35));
  s.push(line(cx - half + 14, top + 34, cx - 12, top + 26, C.d, 4, 0.65));
  for (let i = 0; i < 10; i++) {
    const t = i / 10;
    const y1 = top + 48 + t * (bot - top - 64);
    s.push(line(cx - half + 16 + t * 8, y1 + t * 6, cx - 12, y1, C.d3, 2, 0.28));
    // Записи в графах: дата, содержание, отметка
    if (i < 9) {
      s.push(line(cx - half + 26 + t * 8, y1 - 8 + t * 6, cx - half * 0.78, y1 - 8 + t * 5, C.d3, 2.6, 0.5));
      s.push(line(cx - half * 0.62, y1 - 8 + t * 5, cx - half * (0.3 + ((i * 3) % 3) * 0.06), y1 - 8 + t * 4, C.d3, 2.6, 0.45));
      s.push(line(cx - half * 0.24, y1 - 8 + t * 4, cx - half * 0.12, y1 - 8 + t * 4, C.d3, 2.6, 0.3));
    }
  }
  // Заполненные строки и росчерки на правой
  for (let i = 0; i < 9; i++) {
    const t = i / 9;
    const y1 = top + 52 + t * (bot - top - 70);
    s.push(line(cx + 16, y1, cx + half * (0.4 + ((i * 5) % 4) * 0.11), y1, C.d3, 2.4, 0.42));
    s.push(
      `<path d="M${n(cx + half * 0.64)} ${n(y1 + 3)}c${n(W * 0.008)} -${n(H * 0.012)} ${n(W * 0.016)} ${n(H * 0.01)} ${n(W * 0.024)} -${n(H * 0.003)}s${n(W * 0.012)} ${n(H * 0.008)} ${n(W * 0.022)} -${n(H * 0.002)}" fill="none" stroke="${C.d4}" stroke-width="2.4" opacity="0.8" stroke-linecap="round"/>`,
    );
  }
  s.push(line(cx + 16, top + 34, cx + half * 0.78, top + 30, C.d, 4, 0.6));

  // Ручка
  s.push(drop(id, W * 0.7, H * 0.72, W * 0.11, 8, 0.5));
  s.push(
    `<g transform="rotate(-34 ${n(W * 0.7)} ${n(H * 0.68)})">${rect(W * 0.58, H * 0.665, W * 0.24, H * 0.016, C.d5, ' rx="8"')}${rect(W * 0.76, H * 0.665, W * 0.06, H * 0.016, C.g, ' rx="8"')}${poly([[W * 0.82, H * 0.665], [W * 0.85, H * 0.673], [W * 0.82, H * 0.681]], C.d3)}</g>`,
  );

  // Каска
  s.push(drop(id, W * 0.15, H * 0.86, W * 0.075, 12, 0.6));
  s.push(`<path d="M${n(W * 0.075)} ${n(H * 0.845)}a${n(W * 0.075)} ${n(H * 0.1)} 0 0 1 ${n(W * 0.15)} 0z" fill="${C.g}"/>`);
  s.push(`<path d="M${n(W * 0.09)} ${n(H * 0.79)}a${n(W * 0.06)} ${n(H * 0.075)} 0 0 1 ${n(W * 0.12)} 0" fill="${C.gHi}" opacity="0.35"/>`);
  s.push(`<path d="M${n(W * 0.055)} ${n(H * 0.845)}h${n(W * 0.19)}" stroke="${C.gDim}" stroke-width="${n(H * 0.014)}" stroke-linecap="round"/>`);
  s.push(`<path d="M${n(W * 0.115)} ${n(H * 0.772)}a${n(W * 0.035)} ${n(H * 0.05)} 0 0 1 ${n(W * 0.07)} 0" fill="none" stroke="${C.gDim}" stroke-width="${n(H * 0.005)}" opacity="0.8"/>`);

  s.push(vignette(id, W, H));
  s.push(grain(id, W, H));
  return s.join('');
}

/* ═══ ЗДАНИЯ ══════════════════════════════════════════════════════════════ */

type BuildingKind = 'public' | 'heritage' | 'port' | 'industrial';

function building(id: string, W: number, H: number, kind: BuildingKind) {
  const s: string[] = [];
  const hor = H * 0.8;
  const r = rnd(kind.length * 17 + 3);
  const bd = W * 0.055; // глубина торцевой грани

  s.push(rect(0, 0, W, H, `url(#${id}-sky)`));
  s.push(`<ellipse cx="${n(W * 0.74)}" cy="${n(hor)}" rx="${n(W * 0.45)}" ry="${n(H * 0.6)}" fill="url(#${id}-lamp)"/>`);

  // Дальний силуэт и дымка у горизонта
  for (let x = -20; x < W + 40; ) {
    const w = 40 + r() * 90;
    const h = 26 + r() * 80;
    s.push(rect(x, hor - h, w, h, C.sky1, ' opacity="0.55"'));
    x += w + 5 + r() * 18;
  }
  s.push(rect(0, hor - H * 0.14, W, H * 0.14, C.sky3, ` opacity="0.18" filter="url(#${id}-haze)"`));

  const litWin = (x: number, y: number, w: number, h: number) =>
    rect(x, y, w, h, r() > 0.62 ? C.g : `url(#${id}-glass)`, r() > 0.62 ? ' opacity="0.3"' : '');

  if (kind === 'public') {
    const bx = W * 0.16;
    const bw = W * 0.62;
    const bh = H * 0.54;
    const by = hor - bh;
    s.push(drop(id, bx + bw / 2, hor + 8, bw * 0.6, 16, 0.7));
    // Торец
    s.push(poly([[bx + bw, by], [bx + bw + bd, by + bd * 0.55], [bx + bw + bd, hor + bd * 0.55], [bx + bw, hor]], `url(#${id}-side)`));
    s.push(rect(bx, by, bw, bh, `url(#${id}-face)`));
    // Аттик и стилобат
    s.push(rect(bx - W * 0.008, by, bw + W * 0.016, H * 0.032, C.d4));
    s.push(poly([[bx + bw + W * 0.008, by], [bx + bw + bd, by + bd * 0.55], [bx + bw + bd, by + bd * 0.55 + H * 0.032], [bx + bw + W * 0.008, by + H * 0.032]], C.d3));
    s.push(rect(bx - W * 0.01, hor - H * 0.1, bw + W * 0.02, H * 0.1, C.d4));
    // Колоннада
    const cols = 9;
    for (let i = 0; i < cols; i++) {
      const cx2 = bx + bw * 0.055 + i * ((bw * 0.89) / (cols - 1));
      s.push(rect(cx2 - W * 0.011, by + H * 0.042, W * 0.022, bh - H * 0.14, C.d5));
      s.push(rect(cx2 - W * 0.015, by + H * 0.036, W * 0.03, H * 0.012, C.d5));
      s.push(rect(cx2 - W * 0.015, hor - H * 0.104, W * 0.03, H * 0.012, C.d5));
      s.push(line(cx2 + W * 0.008, by + H * 0.05, cx2 + W * 0.008, hor - H * 0.11, C.ink, W * 0.004, 0.45));
    }
    // Окна между колоннами
    for (let row = 0; row < 3; row++)
      for (let i = 0; i < cols - 1; i++) {
        const x1 = bx + bw * 0.055 + i * ((bw * 0.89) / (cols - 1)) + W * 0.015;
        s.push(litWin(x1, by + H * 0.095 + row * H * 0.125, (bw * 0.89) / (cols - 1) - W * 0.03, H * 0.085));
      }
    // Вход, козырёк, ступени
    s.push(rect(bx + bw * 0.43, hor - H * 0.1, bw * 0.14, H * 0.1, C.ink, ' opacity="0.85"'));
    s.push(rect(bx + bw * 0.43, hor - H * 0.1, bw * 0.14, H * 0.012, C.gHi, ' opacity="0.35"'));
    for (let i = 0; i < 4; i++) s.push(rect(bx + bw * 0.38 - i * W * 0.008, hor + i * H * 0.012, bw * 0.24 + i * W * 0.016, H * 0.014, i % 2 ? C.d3 : C.d4));
  }

  if (kind === 'heritage') {
    const cx2 = W * 0.48;
    const wingH = H * 0.24;
    const bh = H * 0.36;
    const by = hor - bh;
    s.push(drop(id, cx2, hor + 8, W * 0.36, 16, 0.7));
    // Крылья
    s.push(poly([[cx2 + W * 0.3, hor - wingH], [cx2 + W * 0.3 + bd, hor - wingH + bd * 0.55], [cx2 + W * 0.3 + bd, hor + bd * 0.55], [cx2 + W * 0.3, hor]], `url(#${id}-side)`));
    s.push(rect(cx2 - W * 0.3, hor - wingH, W * 0.6, wingH, `url(#${id}-face)`));
    s.push(rect(cx2 - W * 0.31, hor - wingH, W * 0.62, H * 0.022, C.d4));
    for (let i = 0; i < 12; i++) s.push(litWin(cx2 - W * 0.285 + i * W * 0.048, hor - wingH + H * 0.05, W * 0.03, H * 0.11));
    // Центральный объём, портик, купол, шпиль
    s.push(rect(cx2 - W * 0.13, by, W * 0.26, bh, C.d3));
    s.push(poly([[cx2 - W * 0.155, by], [cx2 + W * 0.155, by], [cx2 + W * 0.135, by - H * 0.035], [cx2 - W * 0.135, by - H * 0.035]], C.d4));
    s.push(`<path d="M${n(cx2 - W * 0.105)} ${n(by - H * 0.035)}a${n(W * 0.105)} ${n(H * 0.13)} 0 0 1 ${n(W * 0.21)} 0z" fill="${C.d4}"/>`);
    s.push(`<path d="M${n(cx2 - W * 0.105)} ${n(by - H * 0.035)}a${n(W * 0.105)} ${n(H * 0.13)} 0 0 1 ${n(W * 0.09)} -${n(H * 0.126)}" fill="${C.d5}" opacity="0.6"/>`);
    s.push(line(cx2, by - H * 0.16, cx2, by - H * 0.27, C.g, W * 0.004, 1));
    s.push(glow(id, cx2, by - H * 0.285, W * 0.035, 0.9));
    for (let i = 0; i < 6; i++) {
      const x1 = cx2 - W * 0.1 + i * W * 0.04;
      s.push(rect(x1, by + H * 0.06, W * 0.017, bh - H * 0.06, C.d5));
      s.push(rect(x1 - W * 0.003, by + H * 0.054, W * 0.023, H * 0.011, C.d5));
    }
    s.push(rect(cx2 - W * 0.038, hor - H * 0.11, W * 0.076, H * 0.11, C.ink, ' opacity="0.85"'));
    s.push(rect(cx2 - W * 0.038, hor - H * 0.11, W * 0.076, H * 0.01, C.gHi, ' opacity="0.3"'));
    // Леса на правом крыле — объект в реставрации
    const lx = cx2 + W * 0.14;
    for (let i = 0; i < 5; i++) s.push(line(lx, hor - wingH + i * (wingH / 5), lx + W * 0.15, hor - wingH + i * (wingH / 5), C.d6, W * 0.0035, 0.8));
    for (let i = 0; i < 6; i++) s.push(line(lx + i * W * 0.03, hor - wingH - H * 0.012, lx + i * W * 0.03, hor, C.d6, W * 0.0035, 0.8));
    s.push(rect(lx, hor - wingH - H * 0.012, W * 0.15, H * 0.012, C.d5, ' opacity="0.8"'));
  }

  if (kind === 'port') {
    // Вода занимает передний план, объект — причальный фронт
    s.push(rect(0, hor - H * 0.02, W, H - hor + H * 0.02, `url(#${id}-water)`));
    const kx = W * 0.38;
    const kt = H * 0.13;
    const legW = W * 0.034;
    const span = W * 0.15;

    // Причальная стенка с отбойниками
    s.push(rect(0, hor - H * 0.09, W, H * 0.09, C.d3));
    s.push(rect(0, hor - H * 0.09, W, H * 0.014, C.d5, ' opacity="0.85"'));
    for (let i = 0; i * W * 0.055 < W; i++) {
      const x1 = i * W * 0.055 + W * 0.014;
      s.push(rect(x1, hor - H * 0.076, W * 0.014, H * 0.076, C.ink, ' opacity="0.6"'));
    }
    // Кнехты на кромке
    for (let i = 0; i < 6; i++) {
      const x1 = W * 0.06 + i * W * 0.17;
      s.push(rect(x1, hor - H * 0.115, W * 0.014, H * 0.026, C.d4, ' rx="3"'));
      s.push(rect(x1 - W * 0.004, hor - H * 0.121, W * 0.022, H * 0.009, C.d5, ' rx="3"'));
    }

    // Портальный кран: две коробчатые опоры с раскосами и ригель
    const legs = [kx - span, kx + span];
    for (const lx of legs) {
      s.push(rect(lx - legW / 2, kt + H * 0.1, legW, hor - H * 0.09 - kt - H * 0.1, `url(#${id}-face)`));
      s.push(rect(lx + legW / 2, kt + H * 0.1, legW * 0.35, hor - H * 0.09 - kt - H * 0.1, C.ink, ' opacity="0.7"'));
      for (let y = kt + H * 0.14; y < hor - H * 0.11; y += H * 0.05) {
        s.push(line(lx - legW / 2, y, lx + legW / 2, y + H * 0.05, C.d5, W * 0.0028, 0.7));
        s.push(line(lx + legW / 2, y, lx - legW / 2, y + H * 0.05, C.d5, W * 0.0028, 0.7));
      }
      s.push(rect(lx - legW * 0.9, hor - H * 0.105, legW * 1.8, H * 0.022, C.d4, ' rx="2"'));
    }
    // Ригель и машинное отделение
    s.push(rect(kx - span - legW, kt + H * 0.08, span * 2 + legW * 2, H * 0.042, `url(#${id}-face)`));
    s.push(rect(kx - span - legW, kt + H * 0.08, span * 2 + legW * 2, H * 0.009, C.d5, ' opacity="0.8"'));
    s.push(rect(kx - span * 0.5, kt + H * 0.03, span, H * 0.05, C.d3, ' rx="3"'));
    for (let i = 0; i < 3; i++) s.push(rect(kx - span * 0.4 + i * span * 0.3, kt + H * 0.044, span * 0.18, H * 0.02, C.g, ' opacity="0.45" rx="2"'));
    // Стрела с оттяжками
    s.push(line(kx, kt + H * 0.03, kx + W * 0.3, kt - H * 0.04, C.d3, W * 0.009, 1));
    s.push(line(kx, kt + H * 0.03, kx - W * 0.16, kt + H * 0.012, C.d3, W * 0.009, 1));
    s.push(line(kx, kt - H * 0.09, kx + W * 0.28, kt - H * 0.036, C.d4, W * 0.003, 0.9));
    s.push(line(kx, kt - H * 0.09, kx - W * 0.15, kt + H * 0.014, C.d4, W * 0.003, 0.9));
    s.push(line(kx, kt + H * 0.03, kx, kt - H * 0.1, C.d3, W * 0.006, 1));
    for (let i = 1; i < 8; i++) {
      const t = i / 8;
      s.push(line(kx + W * 0.3 * t, kt + H * 0.03 - H * 0.07 * t, kx + W * 0.3 * (t + 0.06), kt + H * 0.03 - H * 0.07 * (t + 0.06), C.d4, W * 0.0022, 0.55));
    }
    // Грейфер на тросе
    const gx = kx + W * 0.21;
    s.push(line(gx, kt - H * 0.019, gx, hor - H * 0.24, C.d4, W * 0.0022, 0.95));
    s.push(poly([[gx - W * 0.026, hor - H * 0.24], [gx + W * 0.026, hor - H * 0.24], [gx + W * 0.016, hor - H * 0.2], [gx - W * 0.016, hor - H * 0.2]], C.g, ' opacity="0.85"'));
    s.push(glow(id, kx + W * 0.3, kt - H * 0.045, W * 0.032, 0.9));

    // Дальний кран поменьше — глубина
    const fx2 = W * 0.87;
    const ft = kt + H * 0.14;
    s.push(rect(fx2 - W * 0.016, ft, W * 0.032, hor - H * 0.09 - ft, C.sky1, ' opacity="0.7"'));
    for (let y = ft + H * 0.03; y < hor - H * 0.1; y += H * 0.045) {
      s.push(line(fx2 - W * 0.016, y, fx2 + W * 0.016, y + H * 0.045, C.sky2, W * 0.0022, 0.6));
      s.push(line(fx2 + W * 0.016, y, fx2 - W * 0.016, y + H * 0.045, C.sky2, W * 0.0022, 0.6));
    }
    s.push(rect(fx2 - W * 0.03, ft - H * 0.025, W * 0.06, H * 0.028, C.sky1, ' opacity="0.75" rx="2"'));
    s.push(line(fx2, ft - H * 0.012, fx2 - W * 0.17, ft - H * 0.045, C.sky1, W * 0.006, 0.7));
    s.push(line(fx2, ft - H * 0.012, fx2 + W * 0.07, ft, C.sky1, W * 0.006, 0.7));
    s.push(line(fx2, ft - H * 0.012, fx2, ft - H * 0.07, C.sky1, W * 0.004, 0.7));
    s.push(line(fx2, ft - H * 0.07, fx2 - W * 0.15, ft - H * 0.04, C.sky1, W * 0.002, 0.6));

    // Судно у причала
    const sx = W * 0.52;
    s.push(`<path d="M${n(sx)} ${n(hor + H * 0.005)}h${n(W * 0.42)}l-${n(W * 0.05)} ${n(H * 0.085)}h-${n(W * 0.32)}z" fill="${C.d3}"/>`);
    s.push(rect(sx, hor + H * 0.005, W * 0.42, H * 0.012, C.d5, ' opacity="0.8"'));
    s.push(rect(sx + W * 0.055, hor - H * 0.062, W * 0.13, H * 0.067, C.d4, ' rx="3"'));
    for (let i = 0; i < 4; i++) s.push(rect(sx + W * 0.07 + i * W * 0.027, hor - H * 0.046, W * 0.017, H * 0.024, C.g, ' opacity="0.5"'));
    s.push(rect(sx + W * 0.24, hor - H * 0.04, W * 0.09, H * 0.045, C.d3));
    s.push(line(sx + W * 0.12, hor - H * 0.062, sx + W * 0.12, hor - H * 0.13, C.d4, W * 0.0035, 0.9));
    s.push(line(sx + W * 0.12, hor - H * 0.128, sx + W * 0.16, hor - H * 0.118, C.d4, W * 0.002, 0.7));
    // Швартовы к кнехтам
    s.push(`<path d="M${n(sx + W * 0.01)} ${n(hor + H * 0.008)}q-${n(W * 0.05)} ${n(H * 0.03)} -${n(W * 0.1)} -${n(H * 0.1)}" fill="none" stroke="${C.d5}" stroke-width="${n(W * 0.0018)}" opacity="0.8"/>`);
    s.push(`<path d="M${n(sx + W * 0.3)} ${n(hor + H * 0.008)}q${n(W * 0.05)} ${n(H * 0.03)} ${n(W * 0.09)} -${n(H * 0.1)}" fill="none" stroke="${C.d5}" stroke-width="${n(W * 0.0018)}" opacity="0.8"/>`);

    // Отражения: вертикальные столбы света под источниками и рябь
    for (const [rx2, rw, ro] of [[kx + W * 0.3, W * 0.03, 0.3], [gx, W * 0.02, 0.18], [sx + W * 0.12, W * 0.05, 0.14]] as [number, number, number][]) {
      for (let i = 0; i < 16; i++) {
        const y = hor + H * 0.02 + i * ((H - hor) / 17);
        const jitter = ((i * 53) % 20) / 20 - 0.5;
        s.push(line(rx2 - rw / 2 + jitter * rw, y, rx2 + rw / 2 + jitter * rw, y, C.gHi, H * 0.006, ro * (1 - i / 20)));
      }
    }
    for (let i = 0; i < 44; i++) {
      const y = hor + H * 0.02 + (i % 12) * ((H - hor) / 13);
      const x1 = (((i * 137) % 100) / 100) * W;
      s.push(line(x1, y, x1 + W * 0.012 + ((i * 31) % 46), y, C.sky4, H * 0.005, 0.05 + (i % 5) * 0.025));
    }
  }

  if (kind === 'industrial') {
    const bx = W * 0.12;
    const bw = W * 0.7;
    const bh = H * 0.4;
    const by = hor - bh;
    s.push(drop(id, bx + bw / 2, hor + 8, bw * 0.6, 16, 0.7));
    s.push(poly([[bx + bw, by], [bx + bw + bd, by + bd * 0.55], [bx + bw + bd, hor + bd * 0.55], [bx + bw, hor]], `url(#${id}-side)`));
    s.push(rect(bx, by, bw, bh, `url(#${id}-face)`));
    // Профилированная стена
    for (let i = 0; i * W * 0.011 < bw; i++) s.push(line(bx + i * W * 0.011, by, bx + i * W * 0.011, hor, C.d4, W * 0.0016, 0.5));
    // Кровля с зенитными фонарями
    s.push(poly([[bx - W * 0.012, by], [bx + bw * 0.5, by - H * 0.075], [bx + bw + W * 0.012, by], [bx + bw + bd, by + bd * 0.4]], C.d4));
    s.push(poly([[bx - W * 0.012, by], [bx + bw * 0.5, by - H * 0.075], [bx + bw * 0.5, by - H * 0.06], [bx - W * 0.012, by + H * 0.012]], C.d5, ' opacity="0.5"'));
    for (let i = 0; i < 3; i++) {
      const x1 = bx + bw * (0.22 + i * 0.22);
      s.push(rect(x1, by - H * 0.05, bw * 0.11, H * 0.026, C.bp, ' opacity="0.4" rx="3"'));
      s.push(rect(x1, by - H * 0.05, bw * 0.11, H * 0.008, C.gHi, ' opacity="0.3" rx="3"'));
    }
    // Ленточное остекление
    for (let i = 0; i < 15; i++) s.push(litWin(bx + W * 0.012 + i * (bw / 15), by + H * 0.055, bw / 19, H * 0.055));
    // Ворота, рампа, фура
    for (let i = 0; i < 3; i++) {
      const x1 = bx + bw * (0.1 + i * 0.29);
      s.push(rect(x1, hor - H * 0.18, bw * 0.17, H * 0.18, C.ink, ' opacity="0.8"'));
      for (let k = 0; k < 6; k++) s.push(line(x1, hor - H * 0.18 + k * H * 0.03, x1 + bw * 0.17, hor - H * 0.18 + k * H * 0.03, C.d4, W * 0.0022, 0.5));
      s.push(rect(x1 - W * 0.006, hor - H * 0.012, bw * 0.19, H * 0.024, C.d4));
      s.push(rect(x1 + bw * 0.06, hor - H * 0.2, bw * 0.05, H * 0.014, C.gHi, ' opacity="0.3"'));
    }
    s.push(rect(bx + bw * 0.72, hor - H * 0.11, W * 0.16, H * 0.09, C.d3, ' rx="3"'));
    s.push(rect(bx + bw * 0.86, hor - H * 0.13, W * 0.06, H * 0.11, C.d4, ' rx="3"'));
    s.push(rect(bx + bw * 0.875, hor - H * 0.122, W * 0.03, H * 0.03, C.sky3, ' opacity="0.55" rx="2"'));
    for (const wx of [bx + bw * 0.76, bx + bw * 0.84, bx + bw * 0.9]) s.push(`<circle cx="${n(wx)}" cy="${n(hor - H * 0.016)}" r="${n(H * 0.018)}" fill="${C.ink}"/>`);
  }

  // Земля и передний план
  if (kind !== 'port') {
    s.push(rect(0, hor, W, H - hor, C.ink));
    s.push(poly([[0, hor], [W, hor], [W, hor + H * 0.024], [0, hor + H * 0.034]], C.d2));
    s.push(rect(0, hor + H * 0.1, W, H * 0.012, C.d3, ' opacity="0.55"'));
    for (let i = 0; i < 8; i++) s.push(line(W * 0.06 + i * W * 0.13, hor + H * 0.155, W * 0.13 + i * W * 0.13, hor + H * 0.155, C.d4, H * 0.008, 0.5));
  }

  s.push(vignette(id, W, H));
  s.push(grain(id, W, H));
  return s.join('');
}

/* ── Реестр сцен ──────────────────────────────────────────────────────────── */

export type SceneId =
  | 'hero'
  | 'ploshchadka'
  | 'komplekt'
  | 'razbor'
  | 'vedenie'
  | 'komanda'
  | 'obekt-dom-pravosudiya'
  | 'obekt-vdnh'
  | 'obekt-port-holmsk'
  | 'obekt-dmitrov';

type Scene = { w: number; h: number; draw: (id: string, w: number, h: number) => string };

export const SCENES: Record<SceneId, Scene> = {
  hero: { w: 1440, h: 1240, draw: (i, w, h) => stol(i, w, h, 1) },
  komanda: { w: 1440, h: 1240, draw: (i, w, h) => stol(i, w, h, 2) },
  ploshchadka: { w: 2100, h: 900, draw: ploshchadka },
  komplekt: { w: 1440, h: 1240, draw: toma },
  razbor: { w: 1440, h: 1240, draw: razbor },
  vedenie: { w: 1440, h: 1240, draw: zhurnal },
  'obekt-dom-pravosudiya': { w: 1600, h: 1000, draw: (i, w, h) => building(i, w, h, 'public') },
  'obekt-vdnh': { w: 1600, h: 1000, draw: (i, w, h) => building(i, w, h, 'heritage') },
  'obekt-port-holmsk': { w: 1600, h: 1000, draw: (i, w, h) => building(i, w, h, 'port') },
  'obekt-dmitrov': { w: 1600, h: 1000, draw: (i, w, h) => building(i, w, h, 'industrial') },
};

/** Готовый SVG сцены. Идентификаторы градиентов уникальны на сцену. */
export function sceneSvg(id: SceneId): string {
  const sc = SCENES[id];
  const uid = id.replace(/[^a-z]/g, '');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${sc.w}" height="${sc.h}" viewBox="0 0 ${sc.w} ${sc.h}">` +
    defs(uid) +
    sc.draw(uid, sc.w, sc.h) +
    '</svg>'
  );
}
