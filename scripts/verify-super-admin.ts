/**
 * Проверка панели супер-админа: каталог тарифов, выдача и продление,
 * финансовые метрики, права персонала платформы и работа с файлом логов.
 *
 * Запуск: npx ts-node scripts/verify-super-admin.ts
 */
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const BASE = process.env.VERIFY_BASE_URL || 'http://localhost:3001/api';

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, extra?: unknown) {
  if (ok) {
    passed++;
    console.log(`  OK   ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}`, extra !== undefined ? JSON.stringify(extra) : '');
  }
}

async function call(
  method: string,
  pathname: string,
  token?: string,
  body?: unknown
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = (await res.json().catch(() => ({}))) as any;
  return { status: res.status, json };
}

async function main() {
  const stamp = Date.now();
  const secret = process.env.JWT_SECRET!;

  /* --- Тестовые аккаунты --- */
  const superAdmin = await prisma.superAdmin.create({
    data: {
      email: `sa_${stamp}@example.test`,
      password: await bcrypt.hash('Secret123', 12),
      firstName: 'Тест',
      lastName: 'Суперадмин',
    },
  });
  const superToken = jwt.sign(
    { userId: superAdmin.id, email: superAdmin.email, type: 'SUPER_ADMIN' },
    secret,
    { expiresIn: '1h' }
  );

  const staff = await prisma.platformStaffUser.create({
    data: {
      email: `staff_${stamp}@example.test`,
      password: await bcrypt.hash('Secret123', 12),
      firstName: 'Тест',
      lastName: 'Поддержка',
      role: 'SUPPORT',
      mustChangePassword: false,
    },
  });
  const staffToken = jwt.sign(
    { userId: staff.id, email: staff.email, type: 'PLATFORM_STAFF', role: staff.role },
    secret,
    { expiresIn: '1h' }
  );

  const tenant = await prisma.tenant.create({
    data: {
      name: `Проверка тарифов ${stamp}`,
      subdomain: `plan-check-${stamp}`,
      email: `tenant_${stamp}@example.test`,
      subscription: {
        create: {
          planType: 'FREE',
          status: 'active',
          endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 100),
        },
      },
    },
    include: { subscription: true },
  });

  const customCode = `TEST_${String(stamp).slice(-6)}`;
  const individualCode = `IND_${String(stamp).slice(-6)}`;

  try {
    /* ---------------- Каталог тарифов ---------------- */
    console.log('\n== Каталог тарифов: чтение ==');
    const list = await call('GET', '/admin-dashboard/plans/prices', superToken);
    check('200', list.status === 200, list.json);
    const codes = (list.json?.data || []).map((p: any) => p.code);
    check('пять сидированных тарифов на месте',
      ['FREE', 'STARTER', 'BUSINESS', 'PROFESSIONAL', 'ENTERPRISE'].every((c) => codes.includes(c)),
      codes);

    const enterprise = (list.json?.data || []).find((p: any) => p.code === 'ENTERPRISE');
    check('ENTERPRISE — цена договорная', enterprise?.price === null && enterprise?.isNegotiable === true, enterprise);
    check('у тарифов есть название', typeof enterprise?.name === 'string' && enterprise.name.length > 0);
    check('показано число подписок на тарифе', typeof enterprise?.subscriptionsCount === 'number');

    console.log('\n== Создание тарифа (п.2) ==');
    const created = await call('POST', '/admin-dashboard/plans', superToken, {
      code: customCode,
      name: 'Тестовый тариф',
      price: 1500,
      limits: { trainers: 5, clients: 200, groups: 12, branches: 3, trainings: 'unlimited' },
      sortOrder: 2,
    });
    check('201', created.status === 201, created.json);
    check('код сохранён', created.json?.data?.code === customCode);
    check('лимит «unlimited» сохранён', created.json?.data?.limits?.trainings === 'unlimited');

    const duplicate = await call('POST', '/admin-dashboard/plans', superToken, {
      code: customCode,
      name: 'Дубликат',
      price: 100,
    });
    check('повторный код отклонён', duplicate.status === 400, duplicate.json);

    const badCode = await call('POST', '/admin-dashboard/plans', superToken, {
      code: 'плохой код',
      name: 'Тест',
      price: 1,
    });
    check('некорректный код отклонён', badCode.status === 400, badCode.json);

    console.log('\n== Переименование тарифа (п.1: история не меняется) ==');
    const renamed = await call('PUT', `/admin-dashboard/plans/${customCode}`, superToken, {
      name: 'Переименованный тариф',
      price: 1700,
    });
    check('200', renamed.status === 200, renamed.json);
    check('название изменено', renamed.json?.data?.name === 'Переименованный тариф');
    check('код не изменился', renamed.json?.data?.code === customCode);

    console.log('\n== Индивидуальный тариф (п.4) ==');
    const individual = await call('POST', '/admin-dashboard/plans', superToken, {
      code: individualCode,
      name: 'Индивидуальный',
      price: 9900,
      isPublic: false,
      limits: { trainers: 'unlimited', clients: 'unlimited' },
    });
    check('201', individual.status === 201, individual.json);
    check('isPublic=false', individual.json?.data?.isPublic === false);

    const publicPlans = await call('GET', '/subscriptions/plans');
    check('публичный список доступен без токена', publicPlans.status === 200, publicPlans.json);
    const publicCodes = (publicPlans.json?.data || []).map((p: any) => p.code);
    check('индивидуальный тариф скрыт на /pricing', !publicCodes.includes(individualCode), publicCodes);
    check('обычный тариф виден на /pricing', publicCodes.includes(customCode), publicCodes);

    console.log('\n== Права персонала платформы (п.5) ==');
    const staffRead = await call('GET', '/admin-dashboard/plans/prices', staffToken);
    check('персонал видит тарифы', staffRead.status === 200, staffRead.json);

    const staffCreate = await call('POST', '/admin-dashboard/plans', staffToken, {
      code: `NOPE_${stamp}`,
      name: 'Нельзя',
      price: 1,
    });
    check('персонал не может создать тариф → 403', staffCreate.status === 403, staffCreate.json);

    const staffUpdate = await call('PUT', `/admin-dashboard/plans/${customCode}`, staffToken, {
      name: 'Взлом',
    });
    check('персонал не может изменить тариф → 403', staffUpdate.status === 403, staffUpdate.json);

    const staffDashboard = await call('GET', '/admin-dashboard', staffToken);
    check('персонал не видит дашборд супер-админа → 403', staffDashboard.status === 403, staffDashboard.json);

    console.log('\n== Выдача тарифа применяется сразу (п.1) ==');
    // FREE → индивидуальный: раньше «понижение/равный уровень» откладывалось,
    // и в списке аккаунтов тариф оставался прежним.
    const grant = await call('PUT', `/admin-dashboard/tenants/${tenant.id}/plan`, superToken, {
      planType: individualCode,
      comment: 'Проверка выдачи',
    });
    check('200', grant.status === 200, grant.json);
    check('тариф применён сразу', grant.json?.data?.planType === individualCode, grant.json?.data);
    check('помечен как выданный', grant.json?.data?.isGranted === true);

    const tenantsAfterGrant = await call('GET', '/admin-dashboard/tenants', superToken);
    const row = (tenantsAfterGrant.json?.data || []).find((t: any) => t.id === tenant.id);
    check('в списке аккаунтов новый тариф', row?.subscription?.planType === individualCode, row?.subscription);
    check('отдаётся nextPlanType', 'nextPlanType' in (row?.subscription || {}));
    check('отдаётся isGranted', row?.subscription?.isGranted === true);
    check('отдаётся название тарифа', row?.subscription?.planName === 'Индивидуальный', row?.subscription);

    console.log('\n== Понижение тарифа тоже применяется сразу ==');
    const downgrade = await call('PUT', `/admin-dashboard/tenants/${tenant.id}/plan`, superToken, {
      planType: 'FREE',
    });
    check('тариф понижен немедленно', downgrade.json?.data?.planType === 'FREE', downgrade.json?.data);

    console.log('\n== Архивный тариф выдать нельзя ==');
    await call('POST', `/admin-dashboard/plans/${customCode}/archive`, superToken);
    const grantArchived = await call('PUT', `/admin-dashboard/tenants/${tenant.id}/plan`, superToken, {
      planType: customCode,
    });
    check('400', grantArchived.status === 400, grantArchived.json);
    await call('POST', `/admin-dashboard/plans/${customCode}/restore`, superToken);

    console.log('\n== Тариф с подписками архивировать нельзя ==');
    const archiveInUse = await call('POST', '/admin-dashboard/plans/FREE/archive', superToken);
    check('400 для FREE', archiveInUse.status === 400, archiveInUse.json);

    console.log('\n== Срок действия и история (п.3) ==');
    const newEnd = new Date(Date.now() + 1000 * 60 * 60 * 24 * 45);
    const extend = await call(
      'PUT',
      `/admin-dashboard/tenants/${tenant.id}/subscription/end-date`,
      superToken,
      { endDate: newEnd.toISOString(), comment: 'Продление на 45 дней' }
    );
    check('200', extend.status === 200, extend.json);
    check('дата обновлена',
      new Date(extend.json?.data?.endDate).toISOString().slice(0, 10) === newEnd.toISOString().slice(0, 10),
      extend.json?.data?.endDate);

    const badDate = await call(
      'PUT',
      `/admin-dashboard/tenants/${tenant.id}/subscription/end-date`,
      superToken,
      { endDate: 'не дата' }
    );
    check('некорректная дата отклонена', badDate.status === 400, badDate.json);

    const history = await call('GET', `/admin-dashboard/tenants/${tenant.id}/grant-history`, superToken);
    check('200', history.status === 200, history.json);
    const logs = history.json?.data || [];
    check('в истории есть записи', logs.length >= 3, logs.length);
    check('записана выдача', logs.some((l: any) => l.action === 'grant'));
    check('записано продление', logs.some((l: any) => l.action === 'extend'));
    check('указан автор действия',
      logs.every((l: any) => l.superAdmin && l.superAdmin.name.includes('Суперадмин')),
      logs.map((l: any) => l.superAdmin));
    check('сохранён комментарий', logs.some((l: any) => l.comment === 'Продление на 45 дней'));
    check('сохранены старая и новая даты',
      logs.some((l: any) => l.action === 'extend' && l.newEndDate));

    console.log('\n== Выданные тарифы вне финансов (п.3) ==');
    // Выдаём платный тариф и проверяем, что MRR его не учитывает.
    await call('PUT', `/admin-dashboard/tenants/${tenant.id}/plan`, superToken, {
      planType: customCode,
    });

    const kpi = await call('GET', '/admin-dashboard/analytics/kpi', superToken);
    check('200', kpi.status === 200, kpi.json);
    check('выданные подписки посчитаны отдельно',
      (kpi.json?.data?.grantedSubscriptions || 0) >= 1,
      kpi.json?.data);

    const grantedInMrr = await prisma.subscription.findMany({
      where: { isGranted: true, status: 'active' },
      select: { planType: true },
    });
    const plansMap = new Map(
      (await prisma.subscriptionPlan.findMany()).map((p) => [p.code, p.price ? Number(p.price) : null])
    );
    const grantedSum = grantedInMrr.reduce((s, g) => s + (plansMap.get(g.planType) || 0), 0);
    check('MRR не включает стоимость выданных тарифов',
      grantedSum > 0 ? kpi.json?.data?.mrr < grantedSum + kpi.json?.data?.mrr : true,
      { mrr: kpi.json?.data?.mrr, grantedSum });

    check('есть метрика скидок', 'discountsInPeriod' in (kpi.json?.data || {}), kpi.json?.data);

    const dash = await call('GET', '/admin-dashboard', superToken);
    check('дашборд отдаёт скидки отдельно', 'discountsGiven' in (dash.json?.data?.revenue || {}), dash.json?.data?.revenue);
    check('дашборд считает выданные подписки', typeof dash.json?.data?.tenants?.granted === 'number');
    check('в статистике тарифов есть новый тариф', customCode in (dash.json?.data?.subscriptions?.byPlan || {}),
      Object.keys(dash.json?.data?.subscriptions?.byPlan || {}));

    const forecast = await call('GET', '/admin-dashboard/analytics/forecast', superToken);
    check('прогноз исключает выданные подписки',
      (forecast.json?.data?.excludedGrantedCount || 0) >= 1,
      forecast.json?.data);

    console.log('\n== Файл логов (п.6) ==');
    const logInfo = await call('GET', '/admin-dashboard/logs/error-file', superToken);
    check('200', logInfo.status === 200, logInfo.json);
    check('путь по умолчанию задан', typeof logInfo.json?.data?.defaultPath === 'string', logInfo.json?.data);

    const relativePath = await call('PUT', '/admin-dashboard/settings', superToken, {
      errorLogPath: 'logs/err.log',
    });
    check('относительный путь отклонён', relativePath.status === 400, relativePath.json);

    const traversal = await call('PUT', '/admin-dashboard/settings', superToken, {
      errorLogPath: '/var/www/CRM2/logs/../../../etc/passwd',
    });
    check('выход за пределы каталога отклонён', traversal.status === 400, traversal.json);

    const wrongExt = await call('PUT', '/admin-dashboard/settings', superToken, {
      errorLogPath: '/var/www/CRM2/.env',
    });
    check('чужое расширение отклонено', wrongExt.status === 400, wrongExt.json);

    const etc = await call('PUT', '/admin-dashboard/settings', superToken, {
      errorLogPath: '/etc/app.log',
    });
    check('системный каталог отклонён', etc.status === 400, etc.json);

    // Валидный путь: временный файл на текущей машине.
    const tmpLog = path.join(process.cwd(), 'logs', `verify-${stamp}.log`);
    fs.mkdirSync(path.dirname(tmpLog), { recursive: true });
    fs.writeFileSync(tmpLog, 'первая строка\nвторая строка\n');

    const setPath = await call('PUT', '/admin-dashboard/settings', superToken, {
      errorLogPath: tmpLog,
    });
    check('корректный путь принят', setPath.status === 200, setPath.json);
    check('путь сохранён в настройках', setPath.json?.data?.errorLogPath === tmpLog, setPath.json?.data);

    const content = await call('GET', '/admin-dashboard/logs/error-file/content?lines=10', superToken);
    check('содержимое прочитано', content.status === 200 && content.json?.data?.content?.includes('вторая строка'),
      content.json?.data);
    check('размер отдан', content.json?.data?.size > 0);

    const download = await fetch(`${BASE}/admin-dashboard/logs/error-file/download`, {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    const downloaded = await download.text();
    check('выгрузка вернула файл', download.status === 200 && downloaded.includes('первая строка'), {
      status: download.status,
    });
    check('заголовок вложения выставлен',
      (download.headers.get('content-disposition') || '').includes('attachment'),
      download.headers.get('content-disposition'));

    const cleared = await call('DELETE', '/admin-dashboard/logs/error-file', superToken);
    check('очистка выполнена', cleared.status === 200, cleared.json);
    check('файл стал пустым', fs.statSync(tmpLog).size === 0, fs.statSync(tmpLog).size);

    const staffLogs = await call('GET', '/admin-dashboard/logs/error-file', staffToken);
    check('персонал не имеет доступа к логам → 403', staffLogs.status === 403, staffLogs.json);

    fs.unlinkSync(tmpLog);

    console.log('\n== Лимиты читаются из каталога ==');
    const { PlanCatalogService } = await import('../src/services/planCatalogService');
    const limits = await PlanCatalogService.getLimits(customCode);
    check('лимиты из БД', limits.trainers === 5 && limits.trainings === 'unlimited', limits);
  } finally {
    /* --- Очистка --- */
    await prisma.subscriptionGrantLog.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.subscriptionPayment.deleteMany({
      where: { subscription: { tenantId: tenant.id } },
    });
    await prisma.subscription.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } }).catch(() => undefined);
    await prisma.subscriptionPlan.deleteMany({
      where: { code: { in: [customCode, individualCode] } },
    });
    await prisma.adminAuditLog.deleteMany({ where: { superAdminId: superAdmin.id } });
    await prisma.superAdmin.delete({ where: { id: superAdmin.id } }).catch(() => undefined);
    await prisma.platformStaffUser.delete({ where: { id: staff.id } }).catch(() => undefined);
    // Возвращаем настройку пути к логам в исходное состояние
    const settings = await prisma.superAdminSettings.findFirst();
    if (settings) {
      await prisma.superAdminSettings.update({
        where: { id: settings.id },
        data: { errorLogPath: null },
      });
    }
    await prisma.$disconnect();
  }

  console.log(`\n=== Итог: ${passed} пройдено, ${failed} провалено ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error('Ошибка выполнения:', e);
  await prisma.$disconnect();
  process.exit(1);
});
