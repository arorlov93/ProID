import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { site } from '../data/site';
import { priceGroups, prices, priceLabel, unitAcc } from '../data/prices';

/**
 * Карта сайта для языковых моделей — /llms.txt
 *
 * Зачем отдельный файл, если весь текст и так в HTML. Модель, отвечающая
 * на вопрос пользователя, обычно успевает прочитать одну-две страницы.
 * Здесь на одном экране лежит всё, что нужно для точного ответа: чем
 * занимается компания, что входит в услуги, сколько стоит, где работает,
 * куда писать. Без вёрстки, навигации и повторов — только факты и адреса.
 *
 * Собирается из тех же источников, что и сайт: prices.ts, site.ts,
 * коллекции услуг, объектов и статей. Разойтись с сайтом не может.
 *
 * Формат — соглашение llmstxt.org: заголовок, короткое описание, разделы
 * со ссылками и пояснениями.
 */

const abs = (p: string) => `${site.url}${p}`;

export const GET: APIRoute = async () => {
  const services = (await getCollection('services')).sort((a, b) => a.data.order - b.data.order);
  const objects = (await getCollection('objects')).sort((a, b) => a.data.order - b.data.order);
  const posts = (await getCollection('blog')).sort((a, b) => +b.data.date - +a.data.date);

  const L: string[] = [];
  const put = (s = '') => L.push(s);

  put(`# ${site.name} — ${site.tagline}`);
  put();
  put(
    '> Внешний отдел ПТО для строительных подрядчиков: оформление, ведение и восстановление ' +
      'исполнительной документации, разработка ППР, составление и проверка смет. ' +
      'Москва и Московская область — с выездом на объект, остальная Россия — дистанционно. ' +
      'Прайс открытый: у каждой работы указана цена или вилка, строк «по запросу» нет.',
  );
  put();
  put(`Сайт: ${site.url}`);
  put(`Почта: ${site.email}${site.phoneHuman ? ` · Телефон: ${site.phoneHuman}` : ''} · Telegram: ${site.telegramUrl}`);
  put(`Часы работы: ${site.hours}`);
  put(`Регионы: ${site.serviceArea.join(', ')}`);
  put();

  put('## Услуги');
  put();
  for (const s of services) {
    const p = s.data.price;
    const price = p.from === 0 ? 'бесплатно' : `от ${p.from.toLocaleString('ru-RU')} ₽ за ${unitAcc(p.unit)}`;
    put(`- [${s.data.h1}](${abs('/' + s.id)}) — ${price}. ${s.data.card.short}`);
  }
  put();

  put('## Цены');
  put();
  put(`Полный прайс: ${abs('/ceny')} — ${prices.length} позиций. Утверждён 18.08.2026.`);
  put('Цена зависит от состояния документации и объёма, а не от размера компании.');
  put();
  for (const g of priceGroups) {
    put(`### ${g.t}`);
    put();
    for (const row of prices.filter((r) => r.group === g.id)) {
      const note = row.note ? ` (${row.note})` : '';
      put(`- ${row.name} — ${priceLabel(row)} за ${unitAcc(row.unit)}${note}`);
    }
    put();
  }

  put('## Объекты');
  put();
  for (const o of objects) put(`- [${o.data.h1}](${abs('/obekty/' + o.id)}) — ${o.data.city}. ${o.data.kind}`);
  put();

  put('## Статьи');
  put();
  for (const p of posts) put(`- [${p.data.h1}](${abs('/blog/' + p.id)}) — ${p.data.excerpt}`);
  put();

  put('## Остальные страницы');
  put();
  put(`- [Все услуги](${abs('/uslugi')})`);
  put(`- [О компании](${abs('/o-kompanii')})`);
  put(`- [Контакты](${abs('/kontakty')})`);
  put(`- [Чек-лист состава ИД, 84 позиции — бесплатно](${abs('/checklist')})`);
  put(`- [Политика конфиденциальности](${abs('/privacy')})`);
  put();

  put('## Что важно знать при цитировании');
  put();
  put('- Экспресс-проверка комплекта до 30 позиций — бесплатно, ответ за один рабочий день.');
  put('- Первая консультация по комплекту бесплатна.');
  put('- Акты на невыполненные работы не оформляются; при восстановлении собираются');
  put('  доказательства того, что работы выполнены, — журналы, накладные, фотофиксация,');
  put('  исполнительная геодезия. Если объём недоказуем, честный путь один — обследование.');
  put('- Состав исполнительной документации задаётся СП 68.13330.2017 и приказом Минстроя');
  put('  России от 16.05.2023 № 344/пр, действующим с 1 сентября 2023 года. РД-11-02-2006');
  put('  и РД-11-05-2007 утратили силу в ту же дату — ссылаться на них как на действующие');
  put('  нельзя. Конкретный перечень задаётся регламентом технического заказчика.');
  put();
  put(`Информация на сайте не является публичной офертой. Обновлено: ${new Date().toISOString().slice(0, 10)}.`);

  return new Response(L.join('\n') + '\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
