/**
 * Проверка единой авторизации на реальной базе.
 * Запуск: npx ts-node scripts/verify-unified-auth.ts
 */
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { UnifiedAuthService } from '../src/services/unifiedAuthService';
import { detectIdentifierType, phoneTail, normalizePhone } from '../src/utils/identifier';

const prisma = new PrismaClient();

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, extra?: unknown) {
  if (condition) {
    passed++;
    console.log(`  OK   ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}`, extra !== undefined ? extra : '');
  }
}

async function main() {
  console.log('\n== Утилиты идентификатора ==');
  check('телефон +7 (999) 123-45-67 → phone', detectIdentifierType('+7 (999) 123-45-67') === 'phone');
  check('89991234567 → phone', detectIdentifierType('89991234567') === 'phone');
  check('a@b.ru → email', detectIdentifierType('a@b.ru') === 'email');
  check('мусор → null', detectIdentifierType('abc') === null);
  check(
    'хвост номера одинаков для разных форматов',
    phoneTail('+7 (999) 123-45-67') === phoneTail('89991234567') &&
      phoneTail('9991234567') === phoneTail('79991234567')
  );
  check('нормализация → +79991234567', normalizePhone('8 (999) 123-45-67') === '+79991234567');

  console.log('\n== Состояние базы ==');
  const [tenants, users, clients, parents] = await Promise.all([
    prisma.tenant.count(),
    prisma.user.count(),
    prisma.client.count(),
    prisma.parent.count(),
  ]);
  console.log(`  tenants=${tenants} users=${users} clients=${clients} parents=${parents}`);

  console.log('\n== Тестовые данные ==');
  const stamp = Date.now();
  const phone = `+7999${String(stamp).slice(-7)}`;
  const email = `verify_${stamp}@example.test`;
  const password = 'Passw0rd!';

  // Две школы, чтобы проверить выбор организации.
  const tenantA = await prisma.tenant.create({
    data: { name: `Проверка A ${stamp}`, subdomain: `verify-a-${stamp}`, email: `a_${stamp}@example.test` },
  });
  const tenantB = await prisma.tenant.create({
    data: { name: `Проверка B ${stamp}`, subdomain: `verify-b-${stamp}`, email: `b_${stamp}@example.test` },
  });

  // Ученик без пароля в школе A (формат номера — «человеческий»).
  const clientA = await prisma.client.create({
    data: {
      firstName: 'Иван',
      lastName: 'Иванов',
      phone: `+7 (999) ${String(stamp).slice(-7, -4)}-${String(stamp).slice(-4, -2)}-${String(stamp).slice(-2)}`,
      tenantId: tenantA.id,
    },
  });

  // Ученик с тем же номером в школе B, записанным без форматирования.
  const clientB = await prisma.client.create({
    data: {
      firstName: 'Иван',
      lastName: 'Иванов',
      phone: phone.replace('+7', '8'),
      tenantId: tenantB.id,
    },
  });

  // Сотрудник с тем же email в школе A.
  const staff = await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash(password, 12),
      firstName: 'Пётр',
      lastName: 'Петров',
      phone,
      role: 'OWNER',
      tenantId: tenantA.id,
    },
  });

  try {
    console.log('\n== findAccounts по телефону (разные форматы в БД) ==');
    const found = await UnifiedAuthService.findAccounts(phone);
    const clientIds = found.filter((a) => a.accountType === 'CLIENT').map((a) => a.id);
    check('найден ученик школы A с форматированным номером', clientIds.includes(clientA.id), clientIds);
    check('найден ученик школы B с номером через 8', clientIds.includes(clientB.id), clientIds);
    check(
      'найден сотрудник с тем же номером',
      found.some((a) => a.accountType === 'TENANT_USER' && a.id === staff.id)
    );

    console.log('\n== identify: пароля нет ни у одного клиента ==');
    // У сотрудника пароль есть, поэтому needsPasswordSetup=false — это ожидаемо.
    const identifyPhone = await UnifiedAuthService.identify(phone);
    check('identifierType=phone', identifyPhone.identifierType === 'phone');
    check('accountsCount >= 3', identifyPhone.accountsCount >= 3, identifyPhone.accountsCount);
    check('needsPasswordSetup=false (у сотрудника пароль есть)', identifyPhone.needsPasswordSetup === false);

    console.log('\n== identify для клиента без пароля ==');
    const onlyClientPhone = `+7999${String(stamp + 1).slice(-7)}`;
    const lonely = await prisma.client.create({
      data: { firstName: 'Без', lastName: 'Пароля', phone: onlyClientPhone, tenantId: tenantA.id },
    });
    const identifyLonely = await UnifiedAuthService.identify(onlyClientPhone);
    check('needsPasswordSetup=true', identifyLonely.needsPasswordSetup === true);

    console.log('\n== setupPassword создаёт пароль и сразу впускает ==');
    const setup = await UnifiedAuthService.setupPassword(onlyClientPhone, 'Secret123');
    check('выдана сессия без выбора', setup.requiresSelection === false);
    if (setup.requiresSelection === false) {
      check('accountType=CLIENT', setup.accountType === 'CLIENT');
      check('токен выдан', typeof setup.token === 'string' && setup.token.length > 20);
      check('isAccountApproved=false (ожидает подтверждения)', setup.isAccountApproved === false);
    }

    console.log('\n== повторный setupPassword запрещён ==');
    let rejected = false;
    try {
      await UnifiedAuthService.setupPassword(onlyClientPhone, 'Another123');
    } catch (e) {
      rejected = true;
    }
    check('второй раз пароль создать нельзя', rejected);

    console.log('\n== login с неверным паролем ==');
    let wrongPasswordRejected = false;
    try {
      await UnifiedAuthService.login(onlyClientPhone, 'WrongPass');
    } catch {
      wrongPasswordRejected = true;
    }
    check('неверный пароль отклонён', wrongPasswordRejected);

    console.log('\n== login по email сотрудника ==');
    const staffLogin = await UnifiedAuthService.login(email, password);
    check('вход без выбора (email уникален)', staffLogin.requiresSelection === false);
    if (staffLogin.requiresSelection === false) {
      check('accountType=TENANT_USER', staffLogin.accountType === 'TENANT_USER');
      check('школа A', staffLogin.tenant?.id === tenantA.id);
    }

    console.log('\n== несколько аккаунтов с одним паролем → выбор организации ==');
    // Задаём обоим ученикам тот же пароль, что у сотрудника.
    const sharedHash = await bcrypt.hash(password, 12);
    await prisma.client.updateMany({
      where: { id: { in: [clientA.id, clientB.id] } },
      data: { password: sharedHash },
    });

    const multi = await UnifiedAuthService.login(phone, password);
    check('запрошен выбор аккаунта', multi.requiresSelection === true);

    if (multi.requiresSelection === true) {
      check('клиентских аккаунтов 2', multi.clientAccounts.length === 2, multi.clientAccounts.length);
      check('аккаунтов сотрудника 1', multi.staffAccounts.length === 1, multi.staffAccounts.length);
      check(
        'у клиентских аккаунтов указаны школы',
        multi.clientAccounts.every((a) => Boolean(a.tenant?.name))
      );

      console.log('\n== selectAccount выдаёт сессию выбранной школы ==');
      const target = multi.clientAccounts.find((a) => a.tenant?.id === tenantB.id);
      check('в списке есть школа B', Boolean(target));
      if (target) {
        const session = await UnifiedAuthService.selectAccount(
          multi.selectionToken,
          target.accountType,
          target.id
        );
        check('accountType=CLIENT', session.accountType === 'CLIENT');
        check('выбрана школа B', session.tenant?.id === tenantB.id);
      }

      console.log('\n== selectAccount с чужим id отклоняется ==');
      let forged = false;
      try {
        await UnifiedAuthService.selectAccount(multi.selectionToken, 'CLIENT', 'not-in-token');
      } catch {
        forged = true;
      }
      check('подделка id аккаунта отклонена', forged);
    }

    console.log('\n== неизвестный идентификатор ==');
    let unknownRejected = false;
    try {
      await UnifiedAuthService.identify('+79000000000');
    } catch {
      unknownRejected = true;
    }
    check('неизвестный номер отклонён', unknownRejected);

    await prisma.client.delete({ where: { id: lonely.id } }).catch(() => undefined);
  } finally {
    // Полная очистка тестовых данных.
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
