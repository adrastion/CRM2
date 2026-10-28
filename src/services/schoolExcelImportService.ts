import * as XLSX from 'xlsx';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { BCRYPT_ROUNDS } from '../constants/security';

export type SchoolImportError = { sheet: string; row: number; message: string };

export type SchoolImportCreated = {
  branches: number;
  halls: number;
  staff: number;
  trainers: number;
  groups: number;
  memberships: number;
  membershipGroups: number;
  clients: number;
  groupMemberships: number;
  clientMemberships: number;
};

export type SchoolImportResult = {
  ok: boolean;
  emptyCheckFailed?: string;
  created: SchoolImportCreated;
  errors: SchoolImportError[];
  staffPasswords: Array<{ email: string; password: string; role: string }>;
};

const emptyCreated = (): SchoolImportCreated => ({
  branches: 0,
  halls: 0,
  staff: 0,
  trainers: 0,
  groups: 0,
  memberships: 0,
  membershipGroups: 0,
  clients: 0,
  groupMemberships: 0,
  clientMemberships: 0,
});

/** Роль сотрудника: русские подписи + старые коды. */
const STAFF_ROLE_MAP: Record<string, 'ADMIN' | 'TRAINER' | 'PROMOTER'> = {
  администратор: 'ADMIN',
  админ: 'ADMIN',
  admin: 'ADMIN',
  тренер: 'TRAINER',
  trainer: 'TRAINER',
  промоутер: 'PROMOTER',
  promoter: 'PROMOTER',
};

/** Схема зарплаты — как в кабинете школы. */
const SALARY_SCHEME_MAP: Record<
  string,
  'per_training_person' | 'fixed_per_student_month' | 'percent_month' | 'fixed_monthly'
> = {
  'фикс за тренировку с человека': 'per_training_person',
  'за тренировку с человека': 'per_training_person',
  'на группах': 'per_training_person',
  per_training_person: 'per_training_person',
  'фикс с ученика в месяц': 'fixed_per_student_month',
  'с ученика в месяц': 'fixed_per_student_month',
  fixed_per_student_month: 'fixed_per_student_month',
  'фикс % в месяц': 'percent_month',
  'фикс процент в месяц': 'percent_month',
  'процент в месяц': 'percent_month',
  percent_month: 'percent_month',
  'фикс плата в месяц': 'fixed_monthly',
  'фиксированная плата в месяц': 'fixed_monthly',
  'оклад': 'fixed_monthly',
  fixed_monthly: 'fixed_monthly',
};

const MEMBERSHIP_CATEGORY_MAP: Record<string, 'CLIENT' | 'GROUP' | 'PERSONAL'> = {
  клиентский: 'CLIENT',
  'клиентский (на человека)': 'CLIENT',
  client: 'CLIENT',
  групповой: 'GROUP',
  'групповой (ежемесячная оплата группы)': 'GROUP',
  group: 'GROUP',
  персональный: 'PERSONAL',
  personal: 'PERSONAL',
};

const MEMBERSHIP_TYPE_MAP: Record<string, string> = {
  посещения: 'visits',
  'по числу занятий': 'visits',
  'число занятий': 'visits',
  занятия: 'visits',
  visits: 'visits',
  ежемесячный: 'monthly',
  месяц: 'monthly',
  monthly: 'monthly',
  'групповой ежемесячный': 'group_monthly',
  'ежемесячный групповой': 'group_monthly',
  group_monthly: 'group_monthly',
};

function cell(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = row[key];
    if (v == null || v === '') continue;
    return String(v).trim();
  }
  return '';
}

function mapLookup<T extends string>(map: Record<string, T>, raw: string): T | null {
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  return map[key] || null;
}

function cellNum(row: Record<string, unknown>, ...keys: string[]): number | undefined {
  const s = cell(row, ...keys);
  if (!s) return undefined;
  const n = Number(String(s).replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function parseDate(raw: unknown): Date | undefined {
  if (raw == null || raw === '') return undefined;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    // Excel serial date → JS Date (UTC day)
    const utc = Math.round((raw - 25569) * 86400 * 1000);
    const d = new Date(utc);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const s = String(raw).trim();
  const ru = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (ru) {
    const d = new Date(Number(ru[3]), Number(ru[2]) - 1, Number(ru[1]));
    if (!Number.isNaN(d.getTime())) return d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parseGender(raw: string): string | undefined {
  const g = raw.toLowerCase();
  if (!g) return undefined;
  if (['м', 'муж', 'мужской', 'male', 'm'].includes(g)) return 'male';
  if (['ж', 'жен', 'женский', 'female', 'f'].includes(g)) return 'female';
  return raw;
}

function normKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function clientKey(lastName: string, firstName: string, email?: string): string {
  if (email?.trim()) return `e:${normKey(email)}`;
  return `n:${normKey(lastName)}|${normKey(firstName)}`;
}

function sheetRows(workbook: XLSX.WorkBook, name: string): Array<Record<string, unknown>> {
  const sheet = workbook.Sheets[name];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
}

function splitList(raw: string): string[] {
  return raw
    .split(/[;|,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function genPassword(): string {
  return crypto.randomBytes(6).toString('base64url').slice(0, 10);
}

function addSheet(
  wb: XLSX.WorkBook,
  name: string,
  rows: Record<string, unknown>[],
  widths?: number[]
) {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
  if (widths) ws['!cols'] = widths.map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, ws, name);
}

/** Пустая школа: нет филиалов/групп/учеников/абонементов и нет сотрудников кроме OWNER. */
export async function assertTenantEmptyForImport(tenantId: string): Promise<string | null> {
  const [branches, groups, clients, memberships, extraStaff] = await Promise.all([
    prisma.branch.count({ where: { tenantId } }),
    prisma.group.count({ where: { tenantId } }),
    prisma.client.count({ where: { tenantId } }),
    prisma.membership.count({ where: { tenantId } }),
    prisma.user.count({ where: { tenantId, role: { not: 'OWNER' } } }),
  ]);
  const blockers: string[] = [];
  if (branches > 0) blockers.push(`филиалы (${branches})`);
  if (groups > 0) blockers.push(`группы (${groups})`);
  if (clients > 0) blockers.push(`ученики (${clients})`);
  if (memberships > 0) blockers.push(`абонементы (${memberships})`);
  if (extraStaff > 0) blockers.push(`сотрудники кроме OWNER (${extraStaff})`);
  if (!blockers.length) return null;
  return `Школа не пустая: уже есть ${blockers.join(', ')}. Импорт разрешён только в пустую школу.`;
}

export function buildSchoolImportTemplateBuffer(): Buffer {
  const wb = XLSX.utils.book_new();

  addSheet(
    wb,
    'Инструкция',
    [
      {
        Раздел: 'Порядок заполнения',
        Описание:
          'Заполните листы по порядку: Филиалы → Залы → Сотрудники → Тренеры → Группы → Абонементы → Абонементы_группы → Ученики → Ученики_группы → Ученики_абонементы. Строки-примеры замените своими данными.',
      },
      {
        Раздел: 'Ссылки между листами',
        Описание:
          'Связи указываются по имени филиала/группы/абонемента и по email сотрудника — как в колонках, без внутренних номеров. Владельца школы (роль владельца) в файл не добавляйте — он уже есть после регистрации.',
      },
      {
        Раздел: 'Роль сотрудника',
        Описание:
          'На листе «Сотрудники» в колонке «Роль» укажите одно из: Администратор, Тренер, Промоутер. Для каждого тренера дополнительно заполните лист «Тренеры» (тот же email).',
      },
      {
        Раздел: 'Схема зарплаты',
        Описание:
          'На листе «Тренеры», колонка «Схема зарплаты». Допустимые значения: «Фикс за тренировку с человека» — ставка с каждого отмеченного на занятии; «Фикс с ученика в месяц» — сумма с ученика при оплате месяца/абонемента группы; «Фикс % в месяц» — процент от оплаты ученика группы (в колонке «Ставка» укажите процент); «Фикс плата в месяц» — фиксированный оклад. В колонке «Ставка» — рубли или процент в зависимости от схемы.',
      },
      {
        Раздел: 'Категория абонемента',
        Описание:
          'На листе «Абонементы», колонка «Категория»: «Клиентский» — пакет на ученика; «Групповой» — ежемесячная оплата за группу (привязка групп — лист «Абонементы_группы»); «Персональный» — персональный пакет ученика.',
      },
      {
        Раздел: 'Тип абонемента',
        Описание:
          'На листе «Абонементы», колонка «Тип»: «Посещения» — пакет по числу занятий (заполните «Визиты»); «Ежемесячный» — оплата за период; «Групповой ежемесячный» — для категории «Групповой» (можно указать «Окно оплаты с» / «Окно оплаты по» — дни месяца, например 1 и 6).',
      },
      {
        Раздел: 'Что не входит',
        Описание:
          'Расписание занятий в этот шаблон не входит — его настраивают уже в кабинете школы.',
      },
      {
        Раздел: 'Куда отправить',
        Описание:
          'Отправьте заполненный файл супер-администратору ПРОФСПОРТСРМ. Импорт выполняется только в пустую школу (без филиалов, групп, учеников и лишних сотрудников).',
      },
    ],
    [28, 100]
  );

  addSheet(
    wb,
    'Филиалы',
    [
      {
        Имя: 'Центральный',
        Адрес: 'г. Москва, ул. Примерная, 1',
        Телефон: '+7 900 000-00-01',
        Email: 'branch@example.com',
        'Часы работы': 'Пн – Вс 08:00 – 22:00',
      },
    ],
    [20, 40, 18, 25, 28]
  );

  addSheet(
    wb,
    'Залы',
    [{ Имя: 'Зал 1', Филиал: 'Центральный', Вместимость: 30 }],
    [20, 20, 14]
  );

  addSheet(
    wb,
    'Сотрудники',
    [
      {
        Email: 'trainer@example.com',
        Имя: 'Иван',
        Фамилия: 'Иванов',
        Отчество: 'Иванович',
        Роль: 'Тренер',
        Телефон: '+7 900 000-00-02',
      },
      {
        Email: 'admin@example.com',
        Имя: 'Анна',
        Фамилия: 'Петрова',
        Отчество: '',
        Роль: 'Администратор',
        Телефон: '+7 900 000-00-03',
      },
    ],
    [28, 14, 14, 14, 16, 18]
  );

  addSheet(
    wb,
    'Тренеры',
    [
      {
        'Email сотрудника': 'trainer@example.com',
        Филиалы: 'Центральный',
        Квалификация: 'Мастер спорта',
        Стаж: 5,
        'Схема зарплаты': 'Фикс за тренировку с человека',
        Ставка: 500,
      },
    ],
    [28, 24, 20, 8, 34, 10]
  );

  addSheet(
    wb,
    'Группы',
    [
      {
        Имя: 'Группа А',
        Филиал: 'Центральный',
        'Email тренера': 'trainer@example.com',
        'Возраст мин': 6,
        'Возраст макс': 9,
        'Макс. учеников': 16,
      },
    ],
    [18, 18, 28, 12, 12, 14]
  );

  addSheet(
    wb,
    'Абонементы',
    [
      {
        Имя: '8 занятий',
        Категория: 'Клиентский',
        Цена: 8000,
        Тип: 'Посещения',
        Визиты: 8,
        'Окно оплаты с': '',
        'Окно оплаты по': '',
      },
      {
        Имя: 'Групповой месяц',
        Категория: 'Групповой',
        Цена: 6000,
        Тип: 'Групповой ежемесячный',
        Визиты: '',
        'Окно оплаты с': 1,
        'Окно оплаты по': 6,
      },
    ],
    [20, 14, 10, 22, 10, 14, 14]
  );

  addSheet(
    wb,
    'Абонементы_группы',
    [{ 'Имя абонемента': 'Групповой месяц', 'Имя группы': 'Группа А' }],
    [24, 18]
  );

  addSheet(
    wb,
    'Ученики',
    [
      {
        Имя: 'Мария',
        Фамилия: 'Сидорова',
        Отчество: '',
        'Email ребенка': '',
        'Телефон ребенка': '+7 900 000-00-10',
        'Дата рождения': '01.05.2016',
        Пол: 'Ж',
        'Адрес проживания': '',
        'Номер свидетельства о рождении': '',
        'Номер справки': '',
        'Место учебы/дет.сада': '',
        'Родитель 1 - ФИО': 'Сидоров Пётр',
        'Родитель 1 - Телефон': '+7 900 000-00-11',
        'Родитель 1 - Email': 'parent@example.com',
        'Родитель 1 - Место работы': '',
        'Родитель 1 - Контакт на работе': '',
        'Родитель 2 - ФИО': '',
        'Родитель 2 - Телефон': '',
        'Родитель 2 - Email': '',
        'Родитель 2 - Место работы': '',
        'Родитель 2 - Контакт на работе': '',
        Группы: 'Группа А',
        Абонемент: '8 занятий',
      },
    ],
    [12, 14, 12, 22, 16, 14, 6, 20, 18, 12, 16, 20, 16, 22, 16, 16, 16, 16, 16, 16, 16, 16, 16]
  );

  addSheet(
    wb,
    'Ученики_группы',
    [{ Ученик: 'Сидорова Мария', 'Имя группы': 'Группа А' }],
    [28, 18]
  );

  addSheet(
    wb,
    'Ученики_абонементы',
    [{ Ученик: 'Сидорова Мария', 'Имя абонемента': '8 занятий', 'Дата начала': '01.10.2026' }],
    [28, 20, 14]
  );

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

export async function importSchoolFromExcelBuffer(params: {
  tenantId: string;
  buffer: Buffer;
  superAdminId: string;
}): Promise<SchoolImportResult> {
  const { tenantId, buffer, superAdminId } = params;
  const created = emptyCreated();
  const errors: SchoolImportError[] = [];
  const staffPasswords: Array<{ email: string; password: string; role: string }> = [];

  const emptyMsg = await assertTenantEmptyForImport(tenantId);
  if (emptyMsg) {
    await prisma.schoolImportLog.create({
      data: {
        tenantId,
        superAdminId,
        success: false,
        summary: JSON.stringify({ emptyCheckFailed: emptyMsg }),
      },
    });
    return {
      ok: false,
      emptyCheckFailed: emptyMsg,
      created,
      errors: [{ sheet: '—', row: 0, message: emptyMsg }],
      staffPasswords: [],
    };
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  } catch {
    return {
      ok: false,
      created,
      errors: [{ sheet: '—', row: 0, message: 'Не удалось прочитать Excel-файл' }],
      staffPasswords: [],
    };
  }

  const branchRows = sheetRows(workbook, 'Филиалы');
  const hallRows = sheetRows(workbook, 'Залы');
  const staffRows = sheetRows(workbook, 'Сотрудники');
  const trainerRows = sheetRows(workbook, 'Тренеры');
  const groupRows = sheetRows(workbook, 'Группы');
  const membershipRows = sheetRows(workbook, 'Абонементы');
  const membershipGroupRows = sheetRows(workbook, 'Абонементы_группы');
  const clientRows = sheetRows(workbook, 'Ученики');
  const clientGroupRows = sheetRows(workbook, 'Ученики_группы');
  const clientMembershipRows = sheetRows(workbook, 'Ученики_абонементы');

  // --- validate (no DB writes) ---
  const branchNames = new Map<string, number>(); // norm -> excel row
  for (let i = 0; i < branchRows.length; i++) {
    const row = branchRows[i];
    const excelRow = i + 2;
    const name = cell(row, 'Имя');
    const address = cell(row, 'Адрес');
    if (!name && !address) continue;
    if (!name) errors.push({ sheet: 'Филиалы', row: excelRow, message: 'Укажите Имя' });
    if (!address) errors.push({ sheet: 'Филиалы', row: excelRow, message: 'Укажите Адрес' });
    if (name) {
      const k = normKey(name);
      if (branchNames.has(k)) {
        errors.push({ sheet: 'Филиалы', row: excelRow, message: `Дубликат филиала «${name}»` });
      } else branchNames.set(k, excelRow);
    }
  }

  for (let i = 0; i < hallRows.length; i++) {
    const row = hallRows[i];
    const excelRow = i + 2;
    const name = cell(row, 'Имя');
    const branch = cell(row, 'Филиал');
    if (!name && !branch) continue;
    if (!name) errors.push({ sheet: 'Залы', row: excelRow, message: 'Укажите Имя' });
    if (!branch) errors.push({ sheet: 'Залы', row: excelRow, message: 'Укажите Филиал' });
    else if (!branchNames.has(normKey(branch))) {
      errors.push({ sheet: 'Залы', row: excelRow, message: `Филиал «${branch}» не найден на листе Филиалы` });
    }
  }

  const staffEmails = new Map<string, { role: 'ADMIN' | 'TRAINER' | 'PROMOTER'; row: number }>();
  for (let i = 0; i < staffRows.length; i++) {
    const row = staffRows[i];
    const excelRow = i + 2;
    const email = cell(row, 'Email').toLowerCase();
    const firstName = cell(row, 'Имя');
    const lastName = cell(row, 'Фамилия');
    const roleRaw = cell(row, 'Роль');
    const role = mapLookup(STAFF_ROLE_MAP, roleRaw);
    if (!email && !firstName && !lastName) continue;
    if (!email) errors.push({ sheet: 'Сотрудники', row: excelRow, message: 'Укажите Email' });
    if (!firstName || !lastName) {
      errors.push({ sheet: 'Сотрудники', row: excelRow, message: 'Укажите Имя и Фамилию' });
    }
    if (!role) {
      errors.push({
        sheet: 'Сотрудники',
        row: excelRow,
        message: 'Роль: Администратор, Тренер или Промоутер',
      });
    }
    if (email && role) {
      if (staffEmails.has(email)) {
        errors.push({ sheet: 'Сотрудники', row: excelRow, message: `Дубликат email ${email}` });
      } else staffEmails.set(email, { role, row: excelRow });
    }
  }

  for (let i = 0; i < trainerRows.length; i++) {
    const row = trainerRows[i];
    const excelRow = i + 2;
    const email = cell(row, 'Email сотрудника', 'Email').toLowerCase();
    if (!email) continue;
    const staff = staffEmails.get(email);
    if (!staff) {
      errors.push({
        sheet: 'Тренеры',
        row: excelRow,
        message: `Сотрудник ${email} не найден на листе Сотрудники`,
      });
    } else if (staff.role !== 'TRAINER') {
      errors.push({
        sheet: 'Тренеры',
        row: excelRow,
        message: `Сотрудник ${email} должен иметь роль «Тренер»`,
      });
    }
    const branches = splitList(cell(row, 'Филиалы'));
    for (const b of branches) {
      if (!branchNames.has(normKey(b))) {
        errors.push({
          sheet: 'Тренеры',
          row: excelRow,
          message: `Филиал «${b}» не найден`,
        });
      }
    }
    const schemeRaw = cell(row, 'Схема зарплаты') || 'Фикс за тренировку с человека';
    if (!mapLookup(SALARY_SCHEME_MAP, schemeRaw)) {
      errors.push({
        sheet: 'Тренеры',
        row: excelRow,
        message:
          `Неизвестная схема зарплаты «${schemeRaw}». Укажите: Фикс за тренировку с человека / Фикс с ученика в месяц / Фикс % в месяц / Фикс плата в месяц`,
      });
    }
  }

  const groupNames = new Map<string, number>();
  for (let i = 0; i < groupRows.length; i++) {
    const row = groupRows[i];
    const excelRow = i + 2;
    const name = cell(row, 'Имя');
    const branch = cell(row, 'Филиал');
    const trainerEmail = cell(row, 'Email тренера').toLowerCase();
    if (!name && !branch && !trainerEmail) continue;
    if (!name) errors.push({ sheet: 'Группы', row: excelRow, message: 'Укажите Имя' });
    if (!branch) errors.push({ sheet: 'Группы', row: excelRow, message: 'Укажите Филиал' });
    else if (!branchNames.has(normKey(branch))) {
      errors.push({ sheet: 'Группы', row: excelRow, message: `Филиал «${branch}» не найден` });
    }
    if (!trainerEmail) {
      errors.push({ sheet: 'Группы', row: excelRow, message: 'Укажите Email тренера' });
    } else {
      const staff = staffEmails.get(trainerEmail);
      if (!staff || staff.role !== 'TRAINER') {
        errors.push({
          sheet: 'Группы',
          row: excelRow,
          message: `Тренер ${trainerEmail} не найден (нужна роль «Тренер»)`,
        });
      }
    }
    if (name) {
      const k = normKey(name);
      if (groupNames.has(k)) {
        errors.push({ sheet: 'Группы', row: excelRow, message: `Дубликат группы «${name}»` });
      } else groupNames.set(k, excelRow);
    }
  }

  const membershipNames = new Map<string, { category: 'CLIENT' | 'GROUP' | 'PERSONAL'; row: number }>();
  for (let i = 0; i < membershipRows.length; i++) {
    const row = membershipRows[i];
    const excelRow = i + 2;
    const name = cell(row, 'Имя');
    const categoryRaw = cell(row, 'Категория');
    const category = mapLookup(MEMBERSHIP_CATEGORY_MAP, categoryRaw);
    const typeRaw = cell(row, 'Тип');
    const price = cellNum(row, 'Цена');
    if (!name && !categoryRaw && price == null) continue;
    if (!name) errors.push({ sheet: 'Абонементы', row: excelRow, message: 'Укажите Имя' });
    if (!category) {
      errors.push({
        sheet: 'Абонементы',
        row: excelRow,
        message: 'Категория: Клиентский, Групповой или Персональный',
      });
    }
    if (typeRaw && !mapLookup(MEMBERSHIP_TYPE_MAP, typeRaw)) {
      errors.push({
        sheet: 'Абонементы',
        row: excelRow,
        message: 'Тип: Посещения, Ежемесячный или Групповой ежемесячный',
      });
    }
    if (price == null) errors.push({ sheet: 'Абонементы', row: excelRow, message: 'Укажите Цена' });
    if (name && category) {
      const k = normKey(name);
      if (membershipNames.has(k)) {
        errors.push({ sheet: 'Абонементы', row: excelRow, message: `Дубликат «${name}»` });
      } else membershipNames.set(k, { category, row: excelRow });
    }
  }

  for (let i = 0; i < membershipGroupRows.length; i++) {
    const row = membershipGroupRows[i];
    const excelRow = i + 2;
    const mName = cell(row, 'Имя абонемента');
    const gName = cell(row, 'Имя группы');
    if (!mName && !gName) continue;
    if (!mName || !gName) {
      errors.push({
        sheet: 'Абонементы_группы',
        row: excelRow,
        message: 'Укажите Имя абонемента и Имя группы',
      });
      continue;
    }
    const m = membershipNames.get(normKey(mName));
    if (!m) {
      errors.push({
        sheet: 'Абонементы_группы',
        row: excelRow,
        message: `Абонемент «${mName}» не найден`,
      });
    } else if (m.category !== 'GROUP') {
      errors.push({
        sheet: 'Абонементы_группы',
        row: excelRow,
        message: `Абонемент «${mName}» должен быть категории «Групповой»`,
      });
    }
    if (!groupNames.has(normKey(gName))) {
      errors.push({
        sheet: 'Абонементы_группы',
        row: excelRow,
        message: `Группа «${gName}» не найдена`,
      });
    }
  }

  type ParsedClient = {
    excelRow: number;
    firstName: string;
    lastName: string;
    middleName?: string;
    email?: string;
    phone?: string;
    dateOfBirth?: Date;
    gender?: string;
    address?: string;
    birthCertificateNumber?: string;
    medicalCertificateNumber?: string;
    schoolOrKindergarten?: string;
    parents: Array<{
      fullName: string;
      phone?: string;
      email?: string;
      workplace?: string;
      workplaceContact?: string;
    }>;
    groupsInline: string[];
    membershipInline?: string;
    key: string;
  };

  const parsedClients: ParsedClient[] = [];
  const clientKeys = new Map<string, number>();

  for (let i = 0; i < clientRows.length; i++) {
    const row = clientRows[i];
    const excelRow = i + 2;
    const firstName = cell(row, 'Имя');
    const lastName = cell(row, 'Фамилия');
    if (!firstName && !lastName) continue;
    if (!firstName || !lastName) {
      errors.push({ sheet: 'Ученики', row: excelRow, message: 'Имя и Фамилия обязательны' });
      continue;
    }
    const email = cell(row, 'Email ребенка') || undefined;
    const key = clientKey(lastName, firstName, email);
    if (clientKeys.has(key)) {
      errors.push({ sheet: 'Ученики', row: excelRow, message: 'Дубликат ученика в файле' });
    } else clientKeys.set(key, excelRow);

    const groupsInline = splitList(cell(row, 'Группы'));
    for (const g of groupsInline) {
      if (!groupNames.has(normKey(g))) {
        errors.push({ sheet: 'Ученики', row: excelRow, message: `Группа «${g}» не найдена` });
      }
    }
    const membershipInline = cell(row, 'Абонемент') || undefined;
    if (membershipInline) {
      const m = membershipNames.get(normKey(membershipInline));
      if (!m) {
        errors.push({
          sheet: 'Ученики',
          row: excelRow,
          message: `Абонемент «${membershipInline}» не найден`,
        });
      } else if (m.category !== 'CLIENT' && m.category !== 'PERSONAL') {
        errors.push({
          sheet: 'Ученики',
          row: excelRow,
          message: `Абонемент «${membershipInline}» должен быть «Клиентский» или «Персональный»`,
        });
      }
    }

    const parents: ParsedClient['parents'] = [];
    if (cell(row, 'Родитель 1 - ФИО')) {
      parents.push({
        fullName: cell(row, 'Родитель 1 - ФИО'),
        phone: cell(row, 'Родитель 1 - Телефон') || undefined,
        email: cell(row, 'Родитель 1 - Email') || undefined,
        workplace: cell(row, 'Родитель 1 - Место работы') || undefined,
        workplaceContact: cell(row, 'Родитель 1 - Контакт на работе') || undefined,
      });
    }
    if (cell(row, 'Родитель 2 - ФИО')) {
      parents.push({
        fullName: cell(row, 'Родитель 2 - ФИО'),
        phone: cell(row, 'Родитель 2 - Телефон') || undefined,
        email: cell(row, 'Родитель 2 - Email') || undefined,
        workplace: cell(row, 'Родитель 2 - Место работы') || undefined,
        workplaceContact: cell(row, 'Родитель 2 - Контакт на работе') || undefined,
      });
    }

    parsedClients.push({
      excelRow,
      firstName,
      lastName,
      middleName: cell(row, 'Отчество') || undefined,
      email,
      phone: cell(row, 'Телефон ребенка') || undefined,
      dateOfBirth: parseDate(row['Дата рождения']),
      gender: parseGender(cell(row, 'Пол')),
      address: cell(row, 'Адрес проживания') || undefined,
      birthCertificateNumber: cell(row, 'Номер свидетельства о рождении') || undefined,
      medicalCertificateNumber: cell(row, 'Номер справки') || undefined,
      schoolOrKindergarten: cell(row, 'Место учебы/дет.сада') || undefined,
      parents,
      groupsInline,
      membershipInline,
      key,
    });
  }

  const resolveClientKeyFromLabel = (label: string): string | null => {
    const t = label.trim();
    if (!t) return null;
    if (t.includes('@')) {
      const k = `e:${normKey(t)}`;
      return clientKeys.has(k) ? k : null;
    }
    const parts = t.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const k1 = clientKey(parts[0], parts[1]);
      if (clientKeys.has(k1)) return k1;
      const k2 = clientKey(parts[1], parts[0]);
      if (clientKeys.has(k2)) return k2;
    }
    return null;
  };

  for (let i = 0; i < clientGroupRows.length; i++) {
    const row = clientGroupRows[i];
    const excelRow = i + 2;
    const pupil = cell(row, 'Ученик');
    const gName = cell(row, 'Имя группы');
    if (!pupil && !gName) continue;
    if (!pupil || !gName) {
      errors.push({
        sheet: 'Ученики_группы',
        row: excelRow,
        message: 'Укажите Ученик и Имя группы',
      });
      continue;
    }
    if (!resolveClientKeyFromLabel(pupil)) {
      errors.push({
        sheet: 'Ученики_группы',
        row: excelRow,
        message: `Ученик «${pupil}» не найден на листе Ученики`,
      });
    }
    if (!groupNames.has(normKey(gName))) {
      errors.push({
        sheet: 'Ученики_группы',
        row: excelRow,
        message: `Группа «${gName}» не найдена`,
      });
    }
  }

  for (let i = 0; i < clientMembershipRows.length; i++) {
    const row = clientMembershipRows[i];
    const excelRow = i + 2;
    const pupil = cell(row, 'Ученик');
    const mName = cell(row, 'Имя абонемента');
    if (!pupil && !mName) continue;
    if (!pupil || !mName) {
      errors.push({
        sheet: 'Ученики_абонементы',
        row: excelRow,
        message: 'Укажите Ученик и Имя абонемента',
      });
      continue;
    }
    if (!resolveClientKeyFromLabel(pupil)) {
      errors.push({
        sheet: 'Ученики_абонементы',
        row: excelRow,
        message: `Ученик «${pupil}» не найден`,
      });
    }
    const m = membershipNames.get(normKey(mName));
    if (!m) {
      errors.push({
        sheet: 'Ученики_абонементы',
        row: excelRow,
        message: `Абонемент «${mName}» не найден`,
      });
    } else if (m.category !== 'CLIENT' && m.category !== 'PERSONAL') {
      errors.push({
        sheet: 'Ученики_абонементы',
        row: excelRow,
        message: `Абонемент «${mName}» должен быть «Клиентский» или «Персональный»`,
      });
    }
  }

  if (errors.length) {
    await prisma.schoolImportLog.create({
      data: {
        tenantId,
        superAdminId,
        success: false,
        summary: JSON.stringify({ errors, created }),
      },
    });
    return { ok: false, created, errors, staffPasswords: [] };
  }

  // --- commit ---
  try {
    await prisma.$transaction(
      async (tx) => {
        const branchIdByName = new Map<string, string>();
        for (const row of branchRows) {
          const name = cell(row, 'Имя');
          const address = cell(row, 'Адрес');
          if (!name) continue;
          const branch = await tx.branch.create({
            data: {
              tenantId,
              name,
              address,
              phone: cell(row, 'Телефон') || null,
              email: cell(row, 'Email') || null,
              workingHours: cell(row, 'Часы работы') || null,
            },
          });
          branchIdByName.set(normKey(name), branch.id);
          created.branches += 1;
        }

        for (const row of hallRows) {
          const name = cell(row, 'Имя');
          const branch = cell(row, 'Филиал');
          if (!name) continue;
          const branchId = branchIdByName.get(normKey(branch));
          if (!branchId) continue;
          await tx.hall.create({
            data: {
              tenantId,
              branchId,
              name,
              capacity: cellNum(row, 'Вместимость') ?? null,
            },
          });
          created.halls += 1;
        }

        const userIdByEmail = new Map<string, string>();
        const trainerUserEmails = new Set<string>();

        for (const row of staffRows) {
          const email = cell(row, 'Email').toLowerCase();
          if (!email) continue;
          const role = mapLookup(STAFF_ROLE_MAP, cell(row, 'Роль'));
          if (!role) continue;
          const password = genPassword();
          const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
          const user = await tx.user.create({
            data: {
              tenantId,
              email,
              password: hashed,
              firstName: cell(row, 'Имя'),
              lastName: cell(row, 'Фамилия'),
              middleName: cell(row, 'Отчество') || null,
              phone: cell(row, 'Телефон') || null,
              role,
              emailVerified: true,
            },
          });
          userIdByEmail.set(email, user.id);
          staffPasswords.push({ email, password, role });
          created.staff += 1;
          if (role === 'TRAINER') trainerUserEmails.add(email);
        }

        const trainerIdByEmail = new Map<string, string>();
        for (const row of trainerRows) {
          const email = cell(row, 'Email сотрудника', 'Email').toLowerCase();
          if (!email) continue;
          const userId = userIdByEmail.get(email);
          if (!userId) continue;
          const scheme =
            mapLookup(SALARY_SCHEME_MAP, cell(row, 'Схема зарплаты')) || 'per_training_person';
          const rate = cellNum(row, 'Ставка');
          const trainer = await tx.trainer.create({
            data: {
              tenantId,
              userId,
              qualification: cell(row, 'Квалификация') || null,
              experience: cellNum(row, 'Стаж') ?? null,
              salaryType: scheme,
              salaryScheme: scheme,
              salaryRate: rate ?? null,
              salaryAmount: rate ?? null,
            },
          });
          trainerIdByEmail.set(email, trainer.id);
          created.trainers += 1;
          const branches = splitList(cell(row, 'Филиалы'));
          for (const b of branches) {
            const branchId = branchIdByName.get(normKey(b));
            if (!branchId) continue;
            await tx.trainerBranch.create({
              data: { trainerId: trainer.id, branchId },
            });
          }
        }

        // Auto-create trainer profile for TRAINER staff without Тренеры row
        for (const email of trainerUserEmails) {
          if (trainerIdByEmail.has(email)) continue;
          const userId = userIdByEmail.get(email)!;
          const trainer = await tx.trainer.create({
            data: {
              tenantId,
              userId,
              salaryType: 'per_training_person',
              salaryScheme: 'per_training_person',
            },
          });
          trainerIdByEmail.set(email, trainer.id);
          created.trainers += 1;
        }

        const groupIdByName = new Map<string, string>();
        for (const row of groupRows) {
          const name = cell(row, 'Имя');
          if (!name) continue;
          const branchId = branchIdByName.get(normKey(cell(row, 'Филиал')));
          const trainerId = trainerIdByEmail.get(cell(row, 'Email тренера').toLowerCase());
          if (!branchId || !trainerId) continue;
          const group = await tx.group.create({
            data: {
              tenantId,
              name,
              branchId,
              trainerId,
              ageMin: cellNum(row, 'Возраст мин') ?? null,
              ageMax: cellNum(row, 'Возраст макс') ?? null,
              maxMembers: cellNum(row, 'Макс. учеников') ?? null,
            },
          });
          groupIdByName.set(normKey(name), group.id);
          created.groups += 1;
        }

        const membershipIdByName = new Map<
          string,
          { id: string; category: 'CLIENT' | 'GROUP' | 'PERSONAL'; visits?: number | null }
        >();
        for (const row of membershipRows) {
          const name = cell(row, 'Имя');
          if (!name) continue;
          const category = mapLookup(MEMBERSHIP_CATEGORY_MAP, cell(row, 'Категория'));
          if (!category) continue;
          const price = cellNum(row, 'Цена') ?? 0;
          const visits = cellNum(row, 'Визиты');
          const typeMapped = mapLookup(MEMBERSHIP_TYPE_MAP, cell(row, 'Тип'));
          const typeRaw =
            typeMapped ||
            (category === 'GROUP' ? 'group_monthly' : visits ? 'visits' : 'monthly');
          const membership = await tx.membership.create({
            data: {
              tenantId,
              name,
              category,
              price,
              type: typeRaw,
              visits: visits ?? null,
              paymentWindowStartDay: cellNum(row, 'Окно оплаты с') ?? null,
              paymentWindowEndDay: cellNum(row, 'Окно оплаты по') ?? null,
            },
          });
          membershipIdByName.set(normKey(name), {
            id: membership.id,
            category,
            visits: visits ?? null,
          });
          created.memberships += 1;
        }

        const linkedGroups = new Set<string>();
        for (const row of membershipGroupRows) {
          const mName = cell(row, 'Имя абонемента');
          const gName = cell(row, 'Имя группы');
          if (!mName || !gName) continue;
          const m = membershipIdByName.get(normKey(mName));
          const groupId = groupIdByName.get(normKey(gName));
          if (!m || !groupId) continue;
          if (linkedGroups.has(groupId)) continue;
          await tx.membershipGroup.create({
            data: { membershipId: m.id, groupId },
          });
          linkedGroups.add(groupId);
          created.membershipGroups += 1;
        }

        const clientIdByKey = new Map<string, string>();
        for (const c of parsedClients) {
          const client = await tx.client.create({
            data: {
              tenantId,
              firstName: c.firstName,
              lastName: c.lastName,
              middleName: c.middleName || null,
              email: c.email || null,
              phone: c.phone || null,
              dateOfBirth: c.dateOfBirth || null,
              gender: c.gender || null,
              address: c.address || null,
              birthCertificateNumber: c.birthCertificateNumber || null,
              medicalCertificateNumber: c.medicalCertificateNumber || null,
              schoolOrKindergarten: c.schoolOrKindergarten || null,
              parents:
                c.parents.length > 0
                  ? {
                      create: c.parents.map((p, idx) => ({
                        tenantId,
                        fullName: p.fullName,
                        phone: p.phone || null,
                        email: p.email || null,
                        workplace: p.workplace || null,
                        workplaceContact: p.workplaceContact || null,
                        isPrimaryContact: idx === 0,
                        isApproved: true,
                        approvedAt: new Date(),
                      })),
                    }
                  : undefined,
            },
          });
          clientIdByKey.set(c.key, client.id);
          created.clients += 1;

          const gmPairs = new Set<string>();
          for (const g of c.groupsInline) {
            const groupId = groupIdByName.get(normKey(g));
            if (!groupId) continue;
            const pair = `${client.id}:${groupId}`;
            if (gmPairs.has(pair)) continue;
            await tx.groupMembership.create({
              data: { clientId: client.id, groupId, isActive: true },
            });
            gmPairs.add(pair);
            created.groupMemberships += 1;
          }

          if (c.membershipInline) {
            const m = membershipIdByName.get(normKey(c.membershipInline));
            if (m) {
              await tx.clientMembership.create({
                data: {
                  tenantId,
                  clientId: client.id,
                  membershipId: m.id,
                  visitsTotal: m.visits ?? null,
                  isActive: true,
                },
              });
              created.clientMemberships += 1;
            }
          }
        }

        for (const row of clientGroupRows) {
          const pupil = cell(row, 'Ученик');
          const gName = cell(row, 'Имя группы');
          if (!pupil || !gName) continue;
          const key = resolveClientKeyFromLabel(pupil);
          if (!key) continue;
          const clientId = clientIdByKey.get(key);
          const groupId = groupIdByName.get(normKey(gName));
          if (!clientId || !groupId) continue;
          const existing = await tx.groupMembership.findUnique({
            where: { clientId_groupId: { clientId, groupId } },
          });
          if (existing) continue;
          await tx.groupMembership.create({
            data: { clientId, groupId, isActive: true },
          });
          created.groupMemberships += 1;
        }

        for (const row of clientMembershipRows) {
          const pupil = cell(row, 'Ученик');
          const mName = cell(row, 'Имя абонемента');
          if (!pupil || !mName) continue;
          const key = resolveClientKeyFromLabel(pupil);
          if (!key) continue;
          const clientId = clientIdByKey.get(key);
          const m = membershipIdByName.get(normKey(mName));
          if (!clientId || !m) continue;
          await tx.clientMembership.create({
            data: {
              tenantId,
              clientId,
              membershipId: m.id,
              startDate: parseDate(row['Дата начала']) || new Date(),
              visitsTotal: m.visits ?? null,
              isActive: true,
            },
          });
          created.clientMemberships += 1;
        }
      },
      { timeout: 120_000 }
    );
  } catch (e: any) {
    const message = e?.message || 'Ошибка транзакции импорта';
    errors.push({ sheet: '—', row: 0, message });
    await prisma.schoolImportLog.create({
      data: {
        tenantId,
        superAdminId,
        success: false,
        summary: JSON.stringify({ errors, created, exception: message }),
      },
    });
    return { ok: false, created: emptyCreated(), errors, staffPasswords: [] };
  }

  await prisma.schoolImportLog.create({
    data: {
      tenantId,
      superAdminId,
      success: true,
      summary: JSON.stringify({
        created,
        staffEmails: staffPasswords.map((s) => s.email),
      }),
    },
  });

  return { ok: true, created, errors: [], staffPasswords };
}
