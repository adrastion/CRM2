import type { NavIconName } from '../assets/icons/registry';

/** Канонические секции кабинета супер-админа после слияния. */
export const SA_SECTIONS = [
  'overview',
  'metrics',
  'transactions',
  'tariffs',
  'marketers',
  'accounts',
  'changelog',
  'chats',
  'client-ideas',
  'development',
  'planner',
  'monitoring',
  'maintenance',
  'notifications',
  'legal',
  'audit',
] as const;

export type SaSection = (typeof SA_SECTIONS)[number];

export type SaMetricsTab = 'analytics' | 'kpi';
export type SaMonitoringTab = 'server' | 'traffic';
export type SaLegalTab = 'terms' | 'privacy';

export type SaTab = SaMetricsTab | SaMonitoringTab | SaLegalTab;

export type SaNavItem = {
  section: SaSection;
  label: string;
  iconName: NavIconName;
};

export type SaNavGroup = {
  id: string;
  label: string;
  items: SaNavItem[];
};

/** Группы сайдбара SA. */
export const SA_NAV_GROUPS: SaNavGroup[] = [
  {
    id: 'overview',
    label: 'Обзор',
    items: [
      { section: 'overview', label: 'Общая статистика', iconName: 'dashboard' },
      { section: 'metrics', label: 'Метрики', iconName: 'standards' },
    ],
  },
  {
    id: 'money',
    label: 'Деньги',
    items: [
      { section: 'transactions', label: 'История транзакций', iconName: 'finance' },
      { section: 'tariffs', label: 'Управление тарифами', iconName: 'tariffs' },
      { section: 'marketers', label: 'Маркетологи', iconName: 'clients' },
    ],
  },
  {
    id: 'schools',
    label: 'Школы',
    items: [{ section: 'accounts', label: 'Все аккаунты', iconName: 'staff' }],
  },
  {
    id: 'product',
    label: 'Продукт',
    items: [
      { section: 'changelog', label: 'Новости', iconName: 'issued-tariffs' },
      { section: 'chats', label: 'Чаты', iconName: 'chats' },
      { section: 'client-ideas', label: 'Идеи клиентов', iconName: 'groups' },
      { section: 'development', label: 'Разработка', iconName: 'knowledge-base' },
      { section: 'planner', label: 'Планировщик', iconName: 'schedule' },
    ],
  },
  {
    id: 'platform',
    label: 'Платформа',
    items: [
      { section: 'monitoring', label: 'Мониторинг', iconName: 'competitions' },
      { section: 'maintenance', label: 'Техобслуживание', iconName: 'settings' },
      { section: 'notifications', label: 'Уведомления', iconName: 'earnings' },
    ],
  },
  {
    id: 'legal',
    label: 'Документы',
    items: [{ section: 'legal', label: 'Документы', iconName: 'branches' }],
  },
  {
    id: 'security',
    label: 'Безопасность',
    items: [{ section: 'audit', label: 'Логи аудита', iconName: 'faq' }],
  },
];

/** Старые ?section= → каноническая секция и опциональный tab. */
export const SA_SECTION_ALIASES: Record<string, { section: SaSection; tab?: SaTab }> = {
  analytics: { section: 'metrics', tab: 'analytics' },
  kpi: { section: 'metrics', tab: 'kpi' },
  'server-load': { section: 'monitoring', tab: 'server' },
  'site-traffic': { section: 'monitoring', tab: 'traffic' },
  terms: { section: 'legal', tab: 'terms' },
  privacy: { section: 'legal', tab: 'privacy' },
};

export const SA_SECTION_TITLES: Record<SaSection, string> = Object.fromEntries(
  SA_NAV_GROUPS.flatMap((g) => g.items.map((i) => [i.section, i.label]))
) as Record<SaSection, string>;

export function isSaSection(value: string): value is SaSection {
  return (SA_SECTIONS as readonly string[]).includes(value);
}

export type ResolvedSaLocation = {
  section: SaSection;
  tab?: SaTab;
  /** true, если исходный ключ был алиасом — нужен URL replace */
  wasAlias: boolean;
  rawSection: string;
};

/**
 * Разбирает ?section= и ?tab= с учётом алиасов.
 * Неизвестное → overview.
 */
export function resolveSaLocation(search: string): ResolvedSaLocation {
  const params = new URLSearchParams(search);
  const rawSection = params.get('section') || 'overview';
  const rawTab = params.get('tab') || undefined;

  if (SA_SECTION_ALIASES[rawSection]) {
    const alias = SA_SECTION_ALIASES[rawSection];
    return {
      section: alias.section,
      tab: alias.tab || (rawTab as SaTab | undefined),
      wasAlias: true,
      rawSection,
    };
  }

  if (isSaSection(rawSection)) {
    return {
      section: rawSection,
      tab: rawTab as SaTab | undefined,
      wasAlias: false,
      rawSection,
    };
  }

  return {
    section: 'overview',
    tab: undefined,
    wasAlias: false,
    rawSection,
  };
}

/** Обратная совместимость: только секция. */
export function resolveSaDashboardSection(search: string): SaSection {
  return resolveSaLocation(search).section;
}

export function defaultTabForSection(section: SaSection): SaTab | undefined {
  if (section === 'metrics') return 'analytics';
  if (section === 'monitoring') return 'server';
  if (section === 'legal') return 'terms';
  return undefined;
}

export function resolveSaTab(section: SaSection, tab: SaTab | undefined): SaTab | undefined {
  const def = defaultTabForSection(section);
  if (!def) return undefined;
  if (section === 'metrics') {
    return tab === 'kpi' || tab === 'analytics' ? tab : 'analytics';
  }
  if (section === 'monitoring') {
    return tab === 'traffic' || tab === 'server' ? tab : 'server';
  }
  if (section === 'legal') {
    return tab === 'privacy' || tab === 'terms' ? tab : 'terms';
  }
  return def;
}

export function saDashboardPath(section: SaSection, tab?: SaTab): string {
  const params = new URLSearchParams();
  params.set('section', section);
  const resolvedTab = resolveSaTab(section, tab);
  if (resolvedTab) params.set('tab', resolvedTab);
  return `/admin/dashboard?${params.toString()}`;
}
