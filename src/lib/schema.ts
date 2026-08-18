import { site } from '../data/site';
import { priceGroups, prices, unitAcc } from '../data/prices';

const abs = (p: string) => site.url + (p === '/' ? '/' : p);

export function breadcrumbs(items: { href: string; t: string }[]) {
  const all = [{ href: '/', t: 'Главная' }, ...items];
  const last = items.at(-1)?.href ?? '/';
  return {
    '@type': 'BreadcrumbList',
    '@id': abs(last) + '#breadcrumb',
    itemListElement: all.map((i, n) => ({
      '@type': 'ListItem',
      position: n + 1,
      name: i.t,
      item: abs(i.href),
    })),
  };
}

export function faqSchema(items: { q: string; a: string }[]) {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({
      '@type': 'Question',
      name: i.q,
      acceptedAnswer: { '@type': 'Answer', text: i.a.replace(/<[^>]+>/g, '') },
    })),
  };
}

export function serviceSchema(o: {
  name: string;
  description: string;
  path: string;
  priceFrom: number;
  unit: string;
}) {
  return {
    '@type': 'Service',
    '@id': abs(o.path) + '#service',
    name: o.name,
    description: o.description,
    serviceType: o.name,
    url: abs(o.path),
    provider: { '@id': `${site.url}/#org` },
    areaServed: site.serviceArea.map((n) => ({ '@type': 'City', name: n })),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'RUB',
      price: o.priceFrom,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        priceCurrency: 'RUB',
        price: o.priceFrom,
        minPrice: o.priceFrom,
        unitText: o.unit,
      },
      availability: 'https://schema.org/InStock',
      url: abs(o.path),
    },
  };
}

export function articleSchema(o: {
  headline: string;
  description: string;
  path: string;
  published: Date;
  updated?: Date;
  words: number;
}) {
  return {
    '@type': 'Article',
    '@id': abs(o.path) + '#article',
    headline: o.headline,
    description: o.description,
    inLanguage: 'ru-RU',
    datePublished: o.published.toISOString(),
    dateModified: (o.updated ?? o.published).toISOString(),
    wordCount: o.words,
    author: { '@id': `${site.url}/#org` },
    publisher: { '@id': `${site.url}/#org` },
    mainEntityOfPage: { '@type': 'WebPage', '@id': abs(o.path) },
    image: `${site.url}/og${o.path}.png`,
  };
}

export function itemListSchema(name: string, items: { href: string; t: string }[]) {
  return {
    '@type': 'ItemList',
    name,
    itemListElement: items.map((i, n) => ({
      '@type': 'ListItem',
      position: n + 1,
      name: i.t,
      url: abs(i.href),
    })),
  };
}

/**
 * Каталог предложений — весь прайс в машинном виде.
 *
 * Зачем. Поисковик и языковая модель видят цену в таблице как текст: чтобы
 * ответить на «сколько стоит акт освидетельствования», модели приходится
 * разбирать вёрстку и угадывать, к чему относится число. Каталог снимает
 * догадки: у каждой работы своя единица, валюта и вилка.
 *
 * Ставится не на всех страницах, а на главной, «Услугах» и «Ценах» — это
 * четыре килобайта разметки, и повторять их на каждой странице ради того же
 * узла @id смысла нет: поисковик склеивает узлы по идентификатору.
 */
export function offerCatalog() {
  return {
    '@type': 'OfferCatalog',
    '@id': `${site.url}/#catalog`,
    name: 'Прайс ПроПТО',
    url: abs('/ceny'),
    numberOfItems: prices.length,
    itemListElement: priceGroups.map((g) => ({
      '@type': 'OfferCatalog',
      name: g.t,
      description: g.d,
      itemListElement: prices
        .filter((r) => r.group === g.id)
        .map((r) => ({
          '@type': 'Offer',
          name: r.name,
          ...(r.note ? { description: r.note } : {}),
          priceCurrency: 'RUB',
          availability: 'https://schema.org/InStock',
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            priceCurrency: 'RUB',
            ...(r.to
              ? { minPrice: r.from, maxPrice: r.to }
              : { price: r.from, minPrice: r.from }),
            unitText: unitAcc(r.unit),
            valueAddedTaxIncluded: true,
          },
        })),
    })),
  };
}

/** Сводка по всему прайсу: нижняя и верхняя граница, число позиций. */
export function aggregateOffer() {
  const paid = prices.filter((p) => p.from > 0);
  return {
    '@type': 'AggregateOffer',
    '@id': abs('/ceny') + '#offers',
    priceCurrency: 'RUB',
    lowPrice: Math.min(...paid.map((p) => p.from)),
    highPrice: Math.max(...paid.map((p) => p.to ?? p.from)),
    offerCount: prices.length,
    offeredBy: { '@id': `${site.url}/#org` },
    url: abs('/ceny'),
  };
}

/**
 * Узел страницы. Без него граф разметки состоит из организации и сайта,
 * а сама страница в нём не представлена: роботу не за что зацепить ни
 * дату обновления, ни язык, ни картинку, ни хлебные крошки.
 */
export function webPage(o: {
  path: string;
  title: string;
  description: string;
  image: string;
  hasBreadcrumb: boolean;
  published?: Date;
  updated?: Date;
  speakable?: boolean;
}) {
  return {
    '@type': 'WebPage',
    '@id': abs(o.path) + '#webpage',
    url: abs(o.path),
    name: o.title,
    description: o.description,
    inLanguage: 'ru-RU',
    isPartOf: { '@id': `${site.url}/#website` },
    about: { '@id': `${site.url}/#org` },
    primaryImageOfPage: { '@type': 'ImageObject', url: o.image, width: 1200, height: 630 },
    ...(o.hasBreadcrumb ? { breadcrumb: { '@id': abs(o.path) + '#breadcrumb' } } : {}),
    ...(o.published ? { datePublished: o.published.toISOString() } : {}),
    ...(o.updated ? { dateModified: o.updated.toISOString() } : {}),
    ...(o.speakable
      ? {
          speakable: {
            '@type': 'SpeakableSpecification',
            cssSelector: ['h1', '.lead'],
          },
        }
      : {}),
  };
}
