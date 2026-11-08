import shotDashboard from '../assets/landing-shot-dashboard.webp';
import shotClients from '../assets/landing-shot-clients.webp';
import shotSchedule from '../assets/landing-shot-schedule.webp';
import shotFinance from '../assets/landing-shot-finance.webp';
import sectionDesk from '../assets/landing-section-desk.webp';

export type LandingVariant =
  | 'arena'
  | 'motion'
  | 'editorial'
  | 'pulse'
  | 'ledger'
  | 'volt'
  | 'ribbon'
  | 'atlas';

export const LANDING_VARIANTS: Array<{
  id: LandingVariant;
  label: string;
  blurb: string;
}> = [
  {
    id: 'arena',
    label: 'Arena Blue',
    blurb: 'Продуктовый: экраны кабинета и tech-синий',
  },
  {
    id: 'motion',
    label: 'Motion Court',
    blurb: 'Спортивный full-bleed hero с атмосферой зала',
  },
  {
    id: 'editorial',
    label: 'Soft Editorial',
    blurb: 'Редакционный: воздух, крупные заголовки',
  },
  {
    id: 'pulse',
    label: 'Pulse Split',
    blurb: 'Два пути сразу: кабинет школы и кабинет ученика',
  },
  {
    id: 'ledger',
    label: 'Concrete Ledger',
    blurb: 'Журнальная композиция в фирменных цветах',
  },
  {
    id: 'volt',
    label: 'Volt Field',
    blurb: 'Модульная сетка в фирменных цветах',
  },
  {
    id: 'ribbon',
    label: 'Blue Ribbon',
    blurb: 'Горизонтальные ленты секций + фирменный синий hero',
  },
  {
    id: 'atlas',
    label: 'Section Atlas',
    blurb: 'Главы кабинета школы и отдельная глава для ученика',
  },
];

export function normalizeLandingVariant(raw?: string | null): LandingVariant {
  const v = String(raw || '').trim().toLowerCase();
  if (
    v === 'motion' ||
    v === 'editorial' ||
    v === 'arena' ||
    v === 'pulse' ||
    v === 'ledger' ||
    v === 'volt' ||
    v === 'ribbon' ||
    v === 'atlas'
  ) {
    return v;
  }
  return 'arena';
}

export const PATHS = [
  {
    id: 'school',
    title: 'Кабинет школы',
    text: 'Владелец, админ и тренер: клиенты, расписание, финансы, чаты и документы.',
    cta: 'Подключить школу',
    anchor: 'schools',
  },
  {
    id: 'client',
    title: 'Кабинет ученика',
    text: 'Ученик и родитель: занятия, абонементы, оплаты и связь со школой.',
    cta: 'Как это выглядит',
    anchor: 'clients',
  },
] as const;

export const ROLES = [
  {
    title: 'Владелец и администратор',
    text: 'Школа целиком: люди, расписание, деньги и настройки.',
  },
  {
    title: 'Тренер',
    text: 'Свои группы, посещаемость и раздел «Мой заработок».',
  },
  {
    title: 'Ученик и родитель',
    text: 'Личный кабинет: занятия, платежи, документы и уведомления.',
  },
] as const;

export type FeatureBlock = {
  id: string;
  title: string;
  text: string;
  points: string[];
  shot?: string;
  alt?: string;
};

/** ЛК школы — расширенный функционал. */
export const SCHOOL_FEATURES: FeatureBlock[] = [
  {
    id: 'clients',
    title: 'Клиенты и воронка',
    text: 'От лида и пробного занятия до постоянного ученика: статусы, карточка спортсмена, родители, группы и история платежей.',
    points: ['Лиды и пробные', 'Карточка ученика', 'Родители и контакты', 'История по клиенту'],
    shot: shotClients,
    alt: 'Раздел «Клиенты» в кабинете школы',
  },
  {
    id: 'schedule',
    title: 'Расписание и календарь',
    text: 'Группы, залы, филиалы и тренеры в одном календаре. Конфликты с соревнованиями и замены — без переписки в чатах.',
    points: ['Группы и залы', 'Замена тренера', 'События школы', 'Заметки в календаре'],
    shot: shotSchedule,
    alt: 'Календарь школы',
  },
  {
    id: 'finance',
    title: 'Финансы и абонементы',
    text: 'Выдача абонементов, оплаты, журнал операций и зарплата тренеров по схемам школы — прозрачно для владельца.',
    points: ['Абонементы', 'Платежи и QR', 'Журнал операций', 'Зарплата тренеров'],
    shot: shotFinance,
    alt: 'Финансы школы',
  },
  {
    id: 'team',
    title: 'Команда, филиалы и чаты',
    text: 'Тренеры, сотрудники, филиалы и рабочие чаты: личные и групповые переписки, задачи и быстрый поиск.',
    points: ['Тренеры и роли', 'Филиалы', 'Чаты и задачи', 'Уведомления'],
    shot: shotDashboard,
    alt: 'Кабинет школы',
  },
  {
    id: 'sport',
    title: 'Спорт и документы',
    text: 'Соревнования, нормативы, тренировочные планы и документы учеников — всё рядом с расписанием и карточкой клиента.',
    points: ['Соревнования', 'Нормативы', 'Планы циклов', 'Документы'],
    shot: sectionDesk,
    alt: 'Рабочее место администратора',
  },
];

/** ЛК клиента / родителя. */
export const CLIENT_FEATURES: FeatureBlock[] = [
  {
    id: 'week',
    title: 'Панель и неделя',
    text: 'Ближайшие тренировки, метрики и быстрые действия на одном экране — удобно ученику и родителю.',
    points: ['Ближайшие занятия', 'Метрики недели', 'Быстрые действия'],
  },
  {
    id: 'calendar',
    title: 'Календарный план',
    text: 'Тренировки и соревнования в понятном виде: что будет на этой неделе и куда ехать.',
    points: ['Тренировки', 'Соревнования', 'Напоминания'],
  },
  {
    id: 'pay',
    title: 'Платежи и абонементы',
    text: 'Статус абонемента, история оплат и понятные счета — без звонков в администрацию.',
    points: ['Абонементы', 'История оплат', 'Документы'],
  },
  {
    id: 'family',
    title: 'Связь со школой',
    text: 'Уведомления, новости школы и доступ родителя к кабинету ребёнка — школа и семья на одной волне.',
    points: ['Уведомления', 'Новости', 'Кабинет родителя'],
  },
];

export const HERO = {
  brand: 'ПРОФСПОРТСРМ',
  title: 'CRM, созданная для удобства спортивных секций',
  subtitle:
    'Кабинет школы и личный кабинет ученика в одной платформе. Нам важно ваше мнение — скажите, что нужно вашей секции.',
} as const;
