import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const faq = z.array(z.object({ q: z.string(), a: z.string() })).min(5).max(8);

const seo = {
  title: z.string().max(62),
  description: z.string().min(120).max(180),
  key: z.string(), // главный ключ кластера, идёт в h1 и первый абзац
};

/** Посадочные страницы услуг — раздел 3 ТЗ. */
const services = defineCollection({
  loader: glob({ base: './src/content/services', pattern: '**/*.md' }),
  schema: z.object({
    ...seo,
    h1: z.string(),
    eyebrow: z.string(),
    order: z.number(),
    /** Первый абзац, 300–400 знаков, с ключом и ответом «что я получу». */
    lead: z.string().min(280).max(460),
    /** Блок «что входит» — не меньше восьми позиций. */
    includes: z.array(z.string()).min(8),
    price: z.object({
      from: z.number(),
      unit: z.string(),
      note: z.string(),
      /** Ссылка на строку прайса, чтобы цифры не разъезжались. */
      rows: z.array(z.string()).optional(),
    }),
    /** «Когда это нужно» — 3–4 ситуации. */
    when: z.array(z.object({ t: z.string(), d: z.string() })).min(3).max(4),
    /** Отличие от конкурентов: опыт приёмки. */
    edge: z.object({ t: z.string(), d: z.string(), points: z.array(z.string()).min(3) }),
    faq,
    /** Перелинковка: 3–5 ссылок на смежные услуги и статьи. */
    related: z.array(z.object({ href: z.string(), t: z.string(), d: z.string() })).min(3).max(5),
    /** Что рисовать в шапке страницы. */
    drawing: z.enum(['plan', 'section', 'title', 'node', 'strojgenplan', 'akt', 'zhurnal', 'smeta']).default('plan'),
    card: z.object({ short: z.string(), tag: z.string() }),
  }),
});

/** Статьи блога — кластеры Б и В. */
const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.md' }),
  schema: z.object({
    ...seo,
    h1: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    cluster: z.enum(['Б', 'В']),
    /** Лист, который стоит в шапке карточки статьи. */
    drawing: z.enum(['plan', 'section', 'title', 'node', 'strojgenplan', 'akt', 'zhurnal', 'smeta']).default('title'),
    /** Аннотация для листинга и og:description. */
    excerpt: z.string().min(90).max(280),
    readingMin: z.number(),
    faq: faq.optional(),
    related: z.array(z.object({ href: z.string(), t: z.string(), d: z.string() })).min(2).max(5),
    /** Ключевой вывод, выносится в начало статьи. */
    tldr: z.array(z.string()).min(2).max(5),
  }),
});

/** Карточки объектов — портфолио. */
const objects = defineCollection({
  loader: glob({ base: './src/content/objects', pattern: '**/*.md' }),
  schema: z.object({
    ...seo,
    h1: z.string(),
    order: z.number(),
    city: z.string(),
    kind: z.string(),
    /** Самодостаточный первый абзац: что за объект и в чём была задача.
     *  Его вытаскивают и поисковая выдача, и языковые модели, поэтому он
     *  обязан читаться отдельно от заголовка и от остального текста. */
    lead: z.string().min(200).max(480),
    year: z.string(),
    /** Паспорт объекта. Показываем только заполненные строки —
     *  выдумывать цифры нельзя, а прочерк в таблице выглядит как недоделка. */
    spec: z.array(z.object({ k: z.string(), v: z.string() })),
    scope: z.array(z.string()).min(4),
    result: z.string(),
    drawing: z.enum(['plan', 'section', 'title', 'node', 'strojgenplan', 'akt', 'zhurnal', 'smeta']).default('plan'),
  }),
});

export const collections = { services, blog, objects };
