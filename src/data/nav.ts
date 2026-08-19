export type NavItem = { href: string; t: string; d?: string };

/** Услуги — порядок совпадает с приоритетом в семантическом ядре. */
export const servicesNav: NavItem[] = [
  { href: '/oformlenie-id', t: 'Оформление ИД', d: 'Комплект с нуля, поштучно или под ключ' },
  { href: '/vedenie-id', t: 'Ведение ИД', d: 'Документы закрываются в темпе работ' },
  { href: '/vosstanovlenie-id', t: 'Восстановление ИД', d: 'Когда документация не велась' },
  { href: '/autsorsing-pto', t: 'Аутсорсинг ПТО', d: 'Внешний отдел на абонентской плате' },
  { href: '/ppr', t: 'Разработка ППР', d: 'Проекты производства работ и техкарты' },
  { href: '/smety', t: 'Сметы', d: 'Составление, проверка, КС-2 и КС-3' },
  { href: '/audit-komplekta', t: 'Аудит комплекта', d: 'Проверка до того, как проверит заказчик' },
];

export const mainNav: NavItem[] = [
  { href: '/uslugi', t: 'Услуги' },
  { href: '/ceny', t: 'Цены' },
  { href: '/obekty', t: 'Объекты' },
  { href: '/blog', t: 'Блог' },
  { href: '/o-kompanii', t: 'О компании' },
  { href: '/kontakty', t: 'Контакты' },
];

export const footerNav: { t: string; items: NavItem[] }[] = [
  { t: 'Услуги', items: servicesNav },
  {
    t: 'Компания',
    items: [
      { href: '/o-kompanii', t: 'О компании' },
      { href: '/obekty', t: 'Объекты' },
      { href: '/ceny', t: 'Цены' },
      { href: '/kontakty', t: 'Контакты' },
      { href: '/checklist', t: 'Чек-лист состава ИД' },
    ],
  },
  {
    t: 'Читать',
    items: [
      { href: '/blog', t: 'Все статьи' },
      { href: '/blog/akt-osvidetelstvovaniya-skrytyh-rabot', t: 'Акт освидетельствования: разбор формы' },
      { href: '/blog/obshchiy-zhurnal-rabot', t: 'Общий журнал работ' },
      { href: '/blog/sostav-ispolnitelnoy-dokumentacii', t: 'Состав ИД по СП 68.13330' },
      { href: '/blog/prichiny-vozvrata-id', t: '12 причин возврата ИД' },
    ],
  },
  {
    t: 'Разборы',
    items: [
      { href: '/blog/ispolnitelnye-shemy', t: 'Исполнительные схемы' },
      { href: '/blog/prikaz-344-pr', t: 'Приказ 344/пр вместо РД-11-02-2006' },
      { href: '/blog/id-i-proektnaya-dokumentaciya', t: 'ИД и проектная документация' },
      { href: '/blog/ne-podpisyvayut-ks-2', t: 'Не подписывают КС-2' },
      { href: '/blog/kogda-nuzhen-ppr', t: 'Когда нужен ППР' },
      { href: '/blog/id-ne-velas', t: 'Если ИД не велась' },
    ],
  },
];
