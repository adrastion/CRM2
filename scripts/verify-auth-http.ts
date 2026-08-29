/**
 * Проверка HTTP-эндпоинтов единой авторизации на запущенном сервере.
 * Запуск: npx ts-node scripts/verify-auth-http.ts
 */
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

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

async function post(pathname: string, body: unknown) {
  const res = await fetch(`${BASE}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as any;
  return { status: res.status, json };
}

async function get(pathname: string, token?: string) {
  const res = await fetch(`${BASE}${pathname}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const json = (await res.json().catch(() => ({}))) as any;
  return { status: res.status, json };
}

async function main() {
  const stamp = Date.now();
  const digits = String(stamp).slice(-7);
  const phone = `+7999${digits}`;
  const password = 'Secret123';

  const tenantA = await prisma.tenant.create({
    data: { name: `HTTP A ${stamp}`, subdomain: `http-a-${stamp}`, email: `ha_${stamp}@example.test` },
  });
  const tenantB = await prisma.tenant.create({
    data: { name: `HTTP B ${stamp}`, subdomain: `http-b-${stamp}`, email: `hb_${stamp}@example.test` },
  });

  // Ученик без пароля в школе A — сценарий «создать пароль».
  const clientA = await prisma.client.create({
    data: { firstName: 'Тест', lastName: 'Ученик', phone, tenantId: tenantA.id },
  });

  try {
    console.log('\n== POST /auth/identify (валидация) ==');
    const bad = await post('/auth/identify', { identifier: 'abc' });
    check('мусор → 400', bad.status === 400, bad.json);

    const unknown = await post('/auth/identify', { identifier: '+79000000001' });
    check('неизвестный номер → 401', unknown.status === 401, unknown.json);
    check('есть текст ошибки', typeof unknown.json.error === 'string' && unknown.json.error.length > 0);

    console.log('\n== POST /auth/identify (клиент без пароля) ==');
    const ident = await post('/auth/identify', { identifier: phone });
    check('200', ident.status === 200, ident.json);
    check('identifierType=phone', ident.json?.data?.identifierType === 'phone');
    check('needsPasswordSetup=true', ident.json?.data?.needsPasswordSetup === true);
    const normalized = ident.json?.data?.identifier;
    check('нормализованный идентификатор вернулся', normalized === phone, normalized);

    console.log('\n== POST /auth/setup-password (валидация) ==');
    const shortPass = await post('/auth/setup-password', {
      identifier: phone,
      password: '123',
      confirmPassword: '123',
      acceptTerms: true,
    });
    check('короткий пароль → 400', shortPass.status === 400, shortPass.json);

    const mismatch = await post('/auth/setup-password', {
      identifier: phone,
      password: 'Secret123',
      confirmPassword: 'Other123',
      acceptTerms: true,
    });
    check('пароли не совпадают → 400', mismatch.status === 400, mismatch.json);

    const noTerms = await post('/auth/setup-password', {
      identifier: phone,
      password,
      confirmPassword: password,
      acceptTerms: false,
    });
    check('без согласия → 400', noTerms.status === 400, noTerms.json);

    console.log('\n== POST /auth/setup-password (успех) ==');
    const setup = await post('/auth/setup-password', {
      identifier: phone,
      password,
      confirmPassword: password,
      acceptTerms: true,
      rememberMe: true,
    });
    check('200', setup.status === 200, setup.json);
    check('requiresSelection=false', setup.json?.data?.requiresSelection === false);
    check('accountType=CLIENT', setup.json?.data?.accountType === 'CLIENT');
    check('isAccountApproved=false', setup.json?.data?.isAccountApproved === false);
    const clientToken: string = setup.json?.data?.token;
    check('токен получен', typeof clientToken === 'string' && clientToken.length > 20);

    console.log('\n== GET /client-auth/dashboard (аккаунт не подтверждён) ==');
    const dashPending = await get('/client-auth/dashboard', clientToken);
    check('200', dashPending.status === 200, dashPending.json);
    check('isAccountApproved=false', dashPending.json?.data?.isAccountApproved === false);
    check('данные школы скрыты (tenant=null)', dashPending.json?.data?.tenant === null);
    check('баланс скрыт', dashPending.json?.data?.balance === null);
    check('посещаемость скрыта', dashPending.json?.data?.attendance === null);
    check('персонал пуст', Array.isArray(dashPending.json?.data?.staff) && dashPending.json.data.staff.length === 0);
    check('события пусты', Array.isArray(dashPending.json?.data?.monthEvents) && dashPending.json.data.monthEvents.length === 0);
    check('имя пользователя есть', typeof dashPending.json?.data?.viewerName === 'string' && dashPending.json.data.viewerName.length > 0);

    console.log('\n== GET /client-auth/dashboard без токена ==');
    const noToken = await get('/client-auth/dashboard');
    check('401', noToken.status === 401, noToken.json);

    console.log('\n== POST /auth/unified-login (неверный пароль) ==');
    const wrong = await post('/auth/unified-login', { identifier: phone, password: 'Nope12345' });
    check('401', wrong.status === 401, wrong.json);
    check('сообщение «Неверный пароль»', String(wrong.json?.error).includes('Неверный пароль'), wrong.json);

    console.log('\n== POST /auth/unified-login (успех) ==');
    const ok = await post('/auth/unified-login', { identifier: phone, password });
    check('200', ok.status === 200, ok.json);
    check('requiresSelection=false', ok.json?.data?.requiresSelection === false);

    console.log('\n== identify после создания пароля ==');
    const ident2 = await post('/auth/identify', { identifier: phone });
    check('needsPasswordSetup=false', ident2.json?.data?.needsPasswordSetup === false);

    console.log('\n== Подтверждение аккаунта администратором ==');
    await prisma.client.update({
      where: { id: clientA.id },
      data: { isAccountApproved: true, accountApprovedAt: new Date() },
    });
    const dashApproved = await get('/client-auth/dashboard', clientToken);
    check('200', dashApproved.status === 200, dashApproved.json);
    check('isAccountApproved=true', dashApproved.json?.data?.isAccountApproved === true);
    check('школа отдана', dashApproved.json?.data?.tenant?.id === tenantA.id, dashApproved.json?.data?.tenant);
    check('баланс отдан', typeof dashApproved.json?.data?.balance?.amount === 'number');
    check('посещаемость отдана', typeof dashApproved.json?.data?.attendance?.total === 'number');
    check('weekRange присутствует', Boolean(dashApproved.json?.data?.weekRange?.start));

    console.log('\n== Второй аккаунт в другой школе → выбор организации ==');
    const hash = await bcrypt.hash(password, 12);
    const clientB = await prisma.client.create({
      data: {
        firstName: 'Тест',
        lastName: 'Ученик',
        // Тот же номер, но в другом формате — проверяем нормализацию поиска.
        phone: `8 (999) ${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 7)}`,
        tenantId: tenantB.id,
        password: hash,
        isAccountApproved: true,
      },
    });

    const multi = await post('/auth/unified-login', { identifier: phone, password });
    check('200', multi.status === 200, multi.json);
    check('requiresSelection=true', multi.json?.data?.requiresSelection === true, multi.json?.data);
    const clientAccounts = multi.json?.data?.clientAccounts || [];
    check('два клиентских аккаунта', clientAccounts.length === 2, clientAccounts.length);
    check(
      'в списке обе школы',
      clientAccounts.some((a: any) => a.tenant?.id === tenantA.id) &&
        clientAccounts.some((a: any) => a.tenant?.id === tenantB.id),
      clientAccounts.map((a: any) => a.tenant?.name)
    );

    console.log('\n== POST /auth/select-account ==');
    const selectionToken = multi.json?.data?.selectionToken;
    const targetB = clientAccounts.find((a: any) => a.tenant?.id === tenantB.id);
    const selected = await post('/auth/select-account', {
      selectionToken,
      accountType: targetB.accountType,
      accountId: targetB.id,
    });
    check('200', selected.status === 200, selected.json);
    check('выбрана школа B', selected.json?.data?.tenant?.id === tenantB.id);
    check('токен выдан', typeof selected.json?.data?.token === 'string');

    const forged = await post('/auth/select-account', {
      selectionToken,
      accountType: 'CLIENT',
      accountId: 'fake-id',
    });
    check('подделка accountId → 401', forged.status === 401, forged.json);

    const badToken = await post('/auth/select-account', {
      selectionToken: 'not-a-jwt',
      accountType: 'CLIENT',
      accountId: targetB.id,
    });
    check('битый selectionToken → 401', badToken.status === 401, badToken.json);

    console.log('\n== Сотрудник + клиент по одному email ==');
    const email = `mix_${stamp}@example.test`;
    await prisma.user.create({
      data: {
        email,
        password: hash,
        firstName: 'Пётр',
        lastName: 'Петров',
        role: 'OWNER',
        tenantId: tenantA.id,
      },
    });
    await prisma.client.update({ where: { id: clientB.id }, data: { email } });

    const mixed = await post('/auth/unified-login', { identifier: email, password });
    check('requiresSelection=true', mixed.json?.data?.requiresSelection === true, mixed.json?.data);
    check('есть клиентские аккаунты', (mixed.json?.data?.clientAccounts || []).length >= 1);
    check('есть аккаунты сотрудника', (mixed.json?.data?.staffAccounts || []).length >= 1);

    const staffAccount = (mixed.json?.data?.staffAccounts || [])[0];
    const staffSession = await post('/auth/select-account', {
      selectionToken: mixed.json?.data?.selectionToken,
      accountType: staffAccount.accountType,
      accountId: staffAccount.id,
    });
    check('вход как сотрудник', staffSession.json?.data?.accountType === 'TENANT_USER', staffSession.json?.data);

    console.log('\n== Токен сотрудника работает на защищённом маршруте ==');
    const profile = await get('/auth/profile', staffSession.json?.data?.token);
    check('GET /auth/profile → 200', profile.status === 200, profile.json);
    check('роль OWNER', profile.json?.data?.role === 'OWNER');
  } finally {
    await prisma.client.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.user.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });
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
