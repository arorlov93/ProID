/**
 * Общий интерактив сайта. Ничего не рендерит — весь контент уже в HTML,
 * скрипт только оживляет то, что и так читается.
 * Всё движение выключается при prefers-reduced-motion.
 */

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Цель Метрики. Молча ничего не делает, пока счётчик не подключён. */
function goal(name: string, params?: Record<string, unknown>) {
  const w = window as any;
  const id = w.Ya?.Metrika2?.counters?.()?.[0]?.id ?? w.__ymId;
  if (typeof w.ym === 'function' && id) w.ym(id, 'reachGoal', name, params);
  w.dataLayer?.push?.({ event: name, ...params });
}
(window as any).profidGoal = goal;

/* ── Появление секций при скролле ─────────────────────────────────────────── */

/** Подстраховка: при резком скролле (End, перетаскивание ползунка) браузер
 *  склеивает наблюдения, и часть элементов может не получить сигнал. Невидимый
 *  контент хуже отсутствующей анимации, поэтому подметаем вручную. */
let sweepReveal: () => void = () => {};

{
  const items = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if (reduce || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-in'));
  } else {
    // Индекс внутри общего родителя даёт лесенку в 60 мс.
    const seen = new Map<Element, number>();
    items.forEach((el) => {
      const p = el.parentElement!;
      const i = seen.get(p) ?? 0;
      seen.set(p, i + 1);
      if (!el.style.getPropertyValue('--i')) el.style.setProperty('--i', String(Math.min(i, 8)));
    });

    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add('is-in');
          io.unobserve(e.target); // один раз, обратный скролл ничего не повторяет
        }),
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
    );
    items.forEach((el) => io.observe(el));

    let rest = Array.from(items);
    sweepReveal = () => {
      if (!rest.length) return;
      rest = rest.filter((el) => {
        if (el.classList.contains('is-in')) return false;
        if (el.getBoundingClientRect().top > innerHeight) return true;
        el.classList.add('is-in');
        io.unobserve(el);
        return false;
      });
    };
  }
}

/* ── Шапка: прячется вниз, возвращается вверх. Плюс полоса связи снизу ────── */
{
  const root = document.documentElement;
  let last = window.scrollY;
  let ticking = false;

  const onScroll = () => {
    const y = window.scrollY;
    root.classList.toggle('hd-scrolled', y > 8);
    // Полоса связи выезжает, когда первый экран уже позади.
    root.classList.toggle('cb-on', y > 420);
    if (Math.abs(y - last) > 6) {
      root.classList.toggle('hd-down', y > last && y > 260 && !document.body.dataset.navOpen);
      last = y;
    }
    sweepReveal();
    ticking = false;
  };

  addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(onScroll);
      }
    },
    { passive: true },
  );
  onScroll();
}

/* ── Счётчики цифр ─────────────────────────────────────────────────────────── */
{
  const nums = document.querySelectorAll<HTMLElement>('[data-count]');
  const run = (el: HTMLElement) => {
    const to = Number(el.dataset.count || 0);
    if (reduce || !to) {
      el.textContent = String(to);
      return;
    }
    const dur = 900;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      el.textContent = String(Math.round(to * eased));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  if (nums.length && 'IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (!e.isIntersecting) return;
          run(e.target as HTMLElement);
          io.unobserve(e.target);
        }),
      { threshold: 0.4 },
    );
    nums.forEach((n) => io.observe(n));
  }
}

/* ── Отрисовка чертежей линиями ───────────────────────────────────────────── */
{
  const svgs = document.querySelectorAll<SVGSVGElement>('[data-draw]');
  if (reduce) {
    svgs.forEach((s) => s.classList.add('drawn'));
  } else if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add('drawn');
          io.unobserve(e.target);
        }),
      { threshold: 0.2 },
    );
    svgs.forEach((s) => io.observe(s));
  } else {
    svgs.forEach((s) => s.classList.add('drawn'));
  }
}

/* ── Бургер ────────────────────────────────────────────────────────────────── */
{
  const b = document.getElementById('burger');
  const m = document.getElementById('mnav');
  if (b && m) {
    const set = (open: boolean) => {
      b.setAttribute('aria-expanded', String(open));
      m.hidden = !open;
      document.body.dataset.navOpen = open ? '1' : '';
      document.documentElement.classList.remove('hd-down');
    };
    b.addEventListener('click', () => set(b.getAttribute('aria-expanded') !== 'true'));
    m.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('a')) set(false);
    });
    addEventListener('keydown', (e) => e.key === 'Escape' && set(false));
    matchMedia('(min-width: 981px)').addEventListener('change', (e) => e.matches && set(false));
  }
}

/* ── Формы ─────────────────────────────────────────────────────────────────── */

const RATE_KEY = 'profid:lastSend';
const RATE_MS = 20_000;

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').replace(/^8/, '7').replace(/^([^7])/, '7$1').slice(0, 11);
  if (!d) return '';
  const p = ['+7'];
  if (d.length > 1) p.push(' ' + d.slice(1, 4));
  if (d.length >= 5) p.push(' ' + d.slice(4, 7));
  if (d.length >= 8) p.push('-' + d.slice(7, 9));
  if (d.length >= 10) p.push('-' + d.slice(9, 11));
  return p.join('');
}

function setError(input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, msg: string) {
  const box = input.closest('.field')?.querySelector<HTMLElement>('.err');
  input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  if (box) box.textContent = msg;
  return !msg;
}

function validate(f: HTMLFormElement): boolean {
  let ok = true;
  f.querySelectorAll<HTMLInputElement>('input, textarea, select').forEach((i) => {
    if (i.type === 'hidden' || i.classList.contains('hp-input')) return;
    let msg = '';
    const v = i.value.trim();
    if (i.required && !v && i.type !== 'checkbox') msg = 'Заполните поле';
    else if (i.required && i.type === 'checkbox' && !(i as HTMLInputElement).checked)
      msg = 'Без согласия отправить не получится';
    else if (i.type === 'tel' && v && v.replace(/\D/g, '').length < 11) msg = 'Номер из 11 цифр: +7 XXX XXX-XX-XX';
    else if (i.type === 'email' && v && !/^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/.test(v)) msg = 'Проверьте адрес почты';
    if (msg) ok = false;
    setError(i, msg);
  });
  return ok;
}

document.querySelectorAll<HTMLFormElement>('form[data-form]').forEach((f) => {
  const kind = f.dataset.form || 'zayavka';

  f.querySelectorAll<HTMLInputElement>('input[type=tel]').forEach((i) => {
    i.addEventListener('input', () => {
      const p = i.selectionStart === i.value.length;
      i.value = maskPhone(i.value);
      if (p) i.setSelectionRange(i.value.length, i.value.length);
    });
    i.addEventListener('focus', () => !i.value && (i.value = '+7 '));
  });

  f.addEventListener(
    'input',
    (e) => {
      const t = e.target as HTMLInputElement;
      if (t.getAttribute('aria-invalid') === 'true') setError(t, '');
    },
    true,
  );

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = f.querySelector<HTMLButtonElement>('button[type=submit]');
    const status = f.querySelector<HTMLElement>('[data-status]');

    // Honeypot: заполнено — значит бот. Отвечаем как при успехе и ничего не шлём.
    if ((f.querySelector<HTMLInputElement>('.hp-input')?.value || '') !== '') {
      f.dataset.sent = '1';
      return;
    }

    const last = Number(localStorage.getItem(RATE_KEY) || 0);
    if (Date.now() - last < RATE_MS) {
      if (status) status.textContent = 'Заявка уже ушла. Если нужно дополнить — напишите в Telegram.';
      return;
    }

    if (!validate(f)) {
      f.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }

    btn && ((btn.disabled = true), (btn.dataset.label = btn.textContent || ''), (btn.textContent = 'Отправляем…'));
    if (status) status.textContent = '';

    const payload = Object.fromEntries(new FormData(f).entries());
    payload._kind = kind;
    payload._page = location.pathname;

    try {
      const endpoint = f.dataset.endpoint || '';
      if (endpoint) {
        // TODO(разработчик): точка подключения. Функция должна отправить заявку
        // в Telegram обоим получателям и продублировать на почту. См. README.md.
        const r = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!r.ok) throw new Error('HTTP ' + r.status);
      } else {
        // Заглушка: приёмник не подключён. Заявка не уходит никуда,
        // но интерфейс отрабатывает целиком, и цель в Метрике срабатывает.
        console.info('[ПрофИД] форма отправлена в заглушку:', payload);
        await new Promise((res) => setTimeout(res, 420));
      }
      localStorage.setItem(RATE_KEY, String(Date.now()));
      goal(kind === 'checklist' ? 'checklist_send' : 'form_send', { kind });
      f.dataset.sent = '1';
      f.closest('[data-form-wrap]')?.querySelector<HTMLElement>('[data-thanks]')?.focus();
    } catch (err) {
      if (status)
        status.textContent = 'Не отправилось. Напишите в Telegram — так быстрее всего.';
      console.error(err);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = btn.dataset.label || 'Отправить';
      }
    }
  });
});

/* ── Всплывающее окно: не раньше 30 секунд и один раз за сессию ───────────── */
{
  const p = document.getElementById('popup') as HTMLDialogElement | null;
  const KEY = 'profid:popupShown';
  if (p && !sessionStorage.getItem(KEY)) {
    const show = () => {
      if (sessionStorage.getItem(KEY)) return;
      if (document.body.dataset.navOpen) return;
      sessionStorage.setItem(KEY, '1');
      p.showModal?.();
      goal('popup_show');
    };
    const t = setTimeout(show, 30_000);
    // Уход курсора за верхнюю кромку — но всё равно не раньше тридцатой секунды.
    const t0 = Date.now();
    document.addEventListener('mouseout', (e) => {
      if (e.relatedTarget || (e as MouseEvent).clientY > 0) return;
      if (Date.now() - t0 < 30_000) return;
      clearTimeout(t);
      show();
    });
    p.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => p.close()));
  }
}

/* ── Цели: телефон, Telegram, почта, глубина скролла ──────────────────────── */
{
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-goal]');
    if (a) goal(a.dataset.goal!);
  });

  let fired = false;
  addEventListener(
    'scroll',
    () => {
      if (fired) return;
      const h = document.documentElement;
      const p = (h.scrollTop + innerHeight) / h.scrollHeight;
      if (p >= 0.75) {
        fired = true;
        goal('scroll_75');
      }
    },
    { passive: true },
  );
}

export {};
