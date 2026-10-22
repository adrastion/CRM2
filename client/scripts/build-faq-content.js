const fs = require('fs');
const path = require('path');

const items = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/_faq_parsed.json'), 'utf8'));

/** @type {Record<string, { topic: string; summary: string }>} */
const META = {
  'С чего начать работу в системе?': {
    topic: 'start',
    summary: 'Пошаговая инструкция для быстрого старта.',
  },
  'Как добавить первого клиента?': {
    topic: 'clients',
    summary: 'Создание карточки ученика и заполнение данных.',
  },
  'Как создать группу и добавить в неё клиентов?': {
    topic: 'groups',
    summary: 'Создание группы и добавление участников.',
  },
  'Как создать расписание тренировок?': {
    topic: 'calendar',
    summary: 'Разовые, групповые и повторяющиеся занятия.',
  },
  'Как работает замена тренера?': {
    topic: 'staff',
    summary: 'Назначение замены и учёт заработка.',
  },
  'Как зафиксировать платеж от клиента?': {
    topic: 'finance',
    summary: 'Фиксация оплаты в разделе «Финансы».',
  },
  'Как просмотреть статистику и отчеты?': {
    topic: 'start',
    summary: 'Ключевые метрики на панели управления.',
  },
  'Какие тарифные планы доступны?': {
    topic: 'tariffs',
    summary: 'FREE, STARTER, BUSINESS и другие планы.',
  },
  'Что входит в бесплатный тариф?': {
    topic: 'tariffs',
    summary: 'Лимиты и возможности тарифа FREE.',
  },
  'Можно ли изменить тариф в процессе использования?': {
    topic: 'tariffs',
    summary: 'Смена тарифа без потери данных.',
  },
  'Как происходит оплата?': {
    topic: 'tariffs',
    summary: 'Оплата подписки школы.',
  },
  'Как использовать промокод?': {
    topic: 'tariffs',
    summary: 'Активация промокода при оплате.',
  },
  'Есть ли возврат средств?': {
    topic: 'tariffs',
    summary: 'Условия возврата по подписке.',
  },
  'Как работает система промокодов?': {
    topic: 'tariffs',
    summary: 'Как создаются и применяются промокоды.',
  },
  'Сколько пользователей может быть в одной школе?': {
    topic: 'start',
    summary: 'Лимиты пользователей по тарифу.',
  },
  'Какие роли пользователей доступны?': {
    topic: 'staff',
    summary: 'Владелец, администратор, тренер и другие роли.',
  },
  'Какие основные функции доступны в системе?': {
    topic: 'start',
    summary: 'Обзор разделов и возможностей CRM.',
  },
  'Можно ли работать с несколькими филиалами?': {
    topic: 'groups',
    summary: 'Несколько филиалов в одной школе.',
  },
  'Как работает учет посещаемости?': {
    topic: 'calendar',
    summary: 'Отметки присутствия на тренировке.',
  },
  'Есть ли мобильная версия?': {
    topic: 'start',
    summary: 'Адаптивный интерфейс для телефона.',
  },
  'Безопасны ли мои данные?': {
    topic: 'security',
    summary: 'Хранение и защита данных школы.',
  },
  'Кто имеет доступ к моим данным?': {
    topic: 'security',
    summary: 'Роли и разграничение доступа.',
  },
  'Как получить техническую поддержку?': {
    topic: 'support',
    summary: 'Каналы связи с поддержкой.',
  },
  'Есть ли обучающие материалы?': {
    topic: 'support',
    summary: 'FAQ, база знаний и видеоинструкции.',
  },
  'Что делать, если возникла проблема?': {
    topic: 'support',
    summary: 'Диагностика и обращение в поддержку.',
  },
  'Как работает система нормативов?': {
    topic: 'clients',
    summary: 'Нормативы и прогресс ученика.',
  },
  'Как управлять сотрудниками и зарплатой?': {
    topic: 'staff',
    summary: 'Сотрудники, схемы оплаты и начисления.',
  },
  'Что такое панель супер админа?': {
    topic: 'start',
    summary: 'Кабинет платформы для владельцев продукта.',
  },
  'Как настроить зарплату сотрудника?': {
    topic: 'staff',
    summary: 'Схема зарплаты в карточке сотрудника.',
  },
  'Как настроить цену индивидуальной тренировки?': {
    topic: 'finance',
    summary: 'Цена разового индивидуального занятия.',
  },
  'Как работает статус аккаунта клиента?': {
    topic: 'clients',
    summary: 'Регистрация и подтверждение доступа.',
  },
  'Как пользоваться глобальным поиском?': {
    topic: 'start',
    summary: 'Быстрый поиск клиентов, групп и сотрудников.',
  },
  'Как войти в систему?': {
    topic: 'start',
    summary: 'Вход для сотрудников и клиентов.',
  },
  'Как настроить push-уведомления о тренировках?': {
    topic: 'calendar',
    summary: 'Подписка на уведомления в браузере.',
  },
  'Как работает ежемесячная оплата в группах?': {
    topic: 'finance',
    summary: 'Автоначисление ежемесячных счетов группы.',
  },
};

const EXTRA = [
  {
    question: 'Как выдать абонемент клиенту?',
    answer: `Выдача абонемента:

1. Откройте раздел «Финансы» → вкладка «Абонементы» или карточку клиента
2. Нажмите «Выдать абонемент» / «Добавить операцию» с типом выдачи абонемента
3. Выберите клиента, тариф/пакет, филиал и дату начала
4. При необходимости зафиксируйте оплату в «Все операции»
5. Проверьте статус абонемента в карточке клиента и сводке по абонементам

Абонемент учитывается при посещаемости и в финансовой аналитике школы.`,
    category: 'Инструкция',
    topic: 'finance',
    summary: 'Выдача пакета занятий и фиксация оплаты.',
  },
  {
    question: 'Как настроить права доступа?',
    answer: `Права доступа зависят от роли пользователя:

1. **Владелец (OWNER)** — полный доступ ко всем разделам и отмена финансовых операций
2. **Администратор (ADMIN)** — управление школой в рамках выданных прав
3. **Тренер (TRAINER)** — расписание, группы, клиенты (по доступу), свой заработок
4. **Промоутер (PROMOTER)** — работа с клиентами в рамках роли

Настройка видимости пунктов меню: «Настройки» → параметры кабинета.
Доступ тренера к филиалам и группам задаётся при создании/редактировании сотрудника.
Подтверждение аккаунтов клиентов выполняют OWNER/ADMIN в разделе «Клиенты».`,
    category: 'Функционал',
    topic: 'staff',
    summary: 'Роли сотрудников и видимость разделов.',
  },
];

const CATEGORY_FALLBACK = {
  Инструкция: 'start',
  Функционал: 'clients',
  Тарифы: 'tariffs',
  Регистрация: 'start',
  Безопасность: 'security',
  Поддержка: 'support',
};

const SUMMARY_FALLBACK = {
  start: 'Подсказки по началу работы в системе.',
  clients: 'Работа с учениками и их данными.',
  staff: 'Сотрудники, роли и зарплата.',
  groups: 'Филиалы, группы и участники.',
  calendar: 'Расписание и посещаемость.',
  finance: 'Платежи, абонементы и операции.',
  tariffs: 'Тарифы и оплата подписки.',
  security: 'Безопасность и доступ к данным.',
  support: 'Помощь и поддержка.',
};

const ORDER = [
  'С чего начать работу в системе?',
  'Как добавить первого клиента?',
  'Как создать группу и добавить в неё клиентов?',
  'Как создать расписание тренировок?',
  'Как работает замена тренера?',
  'Как выдать абонемент клиенту?',
  'Как настроить зарплату сотрудника?',
  'Как настроить права доступа?',
];

const enriched = [
  ...items.map((item) => {
    const meta = META[item.question];
    const topic = meta?.topic || CATEGORY_FALLBACK[item.category] || 'start';
    return {
      question: item.question,
      answer: item.answer,
      category: item.category,
      topic,
      summary: meta?.summary || SUMMARY_FALLBACK[topic] || 'Ответ из базы знаний.',
    };
  }),
  ...EXTRA,
];

enriched.sort((a, b) => {
  const ia = ORDER.indexOf(a.question);
  const ib = ORDER.indexOf(b.question);
  if (ia === -1 && ib === -1) return 0;
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
});

const esc = (s) =>
  String(s)
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');

const lines = [];
lines.push(`/** Автогенерация: npm/node scripts/build-faq-content.js — контент FAQ. */`);
lines.push(`export type FaqTopic =`);
lines.push(
  `  | 'start' | 'clients' | 'staff' | 'groups' | 'calendar' | 'finance' | 'tariffs' | 'security' | 'support';`
);
lines.push(``);
lines.push(`export interface FaqContentItem {`);
lines.push(`  question: string;`);
lines.push(`  answer: string;`);
lines.push(`  category: string;`);
lines.push(`  topic: FaqTopic;`);
lines.push(`  summary: string;`);
lines.push(`}`);
lines.push(``);
lines.push(`export const FAQ_CONTENT: FaqContentItem[] = [`);
for (const item of enriched) {
  lines.push(`  {`);
  lines.push(`    question: '${item.question.replace(/'/g, "\\'")}',`);
  lines.push(`    answer: \`${esc(item.answer)}\`,`);
  lines.push(`    category: '${item.category.replace(/'/g, "\\'")}',`);
  lines.push(`    topic: '${item.topic}',`);
  lines.push(`    summary: '${item.summary.replace(/'/g, "\\'")}',`);
  lines.push(`  },`);
}
lines.push(`];`);
lines.push(``);

fs.writeFileSync(path.join(__dirname, '../src/content/faqContent.ts'), lines.join('\n'), 'utf8');
console.log('wrote', enriched.length, 'items');
