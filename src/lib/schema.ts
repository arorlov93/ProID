import { site } from '../data/site';

const abs = (p: string) => site.url + (p === '/' ? '/' : p);

export function breadcrumbs(items: { href: string; t: string }[]) {
  const all = [{ href: '/', t: 'Главная' }, ...items];
  return {
    '@type': 'BreadcrumbList',
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
