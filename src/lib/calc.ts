import { byId } from '../data/prices';

/**
 * Модель калькулятора. Живёт отдельно, потому что считает дважды:
 * на сервере — чтобы в HTML сразу лежал готовый результат, и в браузере —
 * когда пользователь двигает поля. Формула одна, расхождений быть не может.
 */

export type CalcInput = {
  acts: number; // акты освидетельствования
  schemes: number; // исполнительные схемы, листов
  months: number; // месяцев ведения журналов
  volumes: number; // томов на комплектацию
  mode: 'new' | 'restore'; // с нуля или восстановление задним числом
  urgent: boolean;
};

export const defaults: CalcInput = {
  acts: 120,
  schemes: 30,
  months: 6,
  volumes: 3,
  mode: 'new',
  urgent: false,
};

export const limits = {
  acts: { min: 0, max: 600, step: 10 },
  schemes: { min: 0, max: 200, step: 5 },
  months: { min: 0, max: 24, step: 1 },
  volumes: { min: 0, max: 20, step: 1 },
};

/** Восстановление дороже: исходные данные приходится собирать по кускам. */
export const K_RESTORE = 1.4;
/** Срочно — работа в две смены и по выходным. */
export const K_URGENT = 1.25;

export type CalcRow = { t: string; qty: string; from: number; to: number };
export type CalcResult = { rows: CalcRow[]; from: number; to: number; days: number };

const r = (n: number) => Math.round(n / 500) * 500;

export function calc(i: CalcInput): CalcResult {
  const k = (i.mode === 'restore' ? K_RESTORE : 1) * (i.urgent ? K_URGENT : 1);

  const raw = [
    { t: 'Акты освидетельствования', qty: `${i.acts} шт.`, p: byId.aosr, n: i.acts },
    { t: 'Исполнительные схемы', qty: `${i.schemes} л.`, p: byId.shema, n: i.schemes },
    { t: 'Журналы работ', qty: `${i.months} мес.`, p: byId.ojr, n: i.months },
    { t: 'Комплектация томов', qty: `${i.volumes} шт.`, p: byId.reestr, n: i.volumes },
  ];

  const rows: CalcRow[] = raw
    .filter((x) => x.n > 0)
    .map((x) => ({
      t: x.t,
      qty: x.qty,
      from: r(x.p.from * x.n * k),
      to: r((x.p.to ?? x.p.from * 1.5) * x.n * k),
    }));

  const from = rows.reduce((s, x) => s + x.from, 0);
  const to = rows.reduce((s, x) => s + x.to, 0);

  // Срок: примерно 22 акта, 12 схем или один том в рабочий день на инженера.
  const load = i.acts / 22 + i.schemes / 12 + i.months * 0.8 + i.volumes * 1.5;
  const days = Math.max(2, Math.ceil(load * (i.mode === 'restore' ? 1.3 : 1) * (i.urgent ? 0.6 : 1)));

  return { rows, from, to, days };
}

export function money(n: number): string {
  return n.toLocaleString('ru-RU').replace(/ /g, ' ').replace(/ /g, ' ');
}

/** «7 рабочих дней» / «14 рабочих дней» — правильное окончание. */
export function daysWord(n: number): string {
  const a = n % 100;
  const b = n % 10;
  if (a > 10 && a < 20) return 'дней';
  if (b === 1) return 'день';
  if (b >= 2 && b <= 4) return 'дня';
  return 'дней';
}
