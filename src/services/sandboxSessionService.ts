import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { BCRYPT_ROUNDS } from '../constants/security';
import { createAuthSession, expiresAtFromTtl, AuthActorType } from './authSessionService';

export const SANDBOX_SUBDOMAIN = 'sa-sandbox';

export const SANDBOX_ROLES = [
  'OWNER',
  'ADMIN',
  'TRAINER',
  'CLIENT',
  'PARENT',
  'MARKETER',
  'TESTER',
  'PLATFORM_STAFF',
] as const;

export type SandboxRole = (typeof SANDBOX_ROLES)[number];

const LABELS: Record<SandboxRole, string> = {
  OWNER: 'Владелец',
  ADMIN: 'Администратор',
  TRAINER: 'Тренер',
  CLIENT: 'Клиент',
  PARENT: 'Родитель',
  MARKETER: 'Маркетолог',
  TESTER: 'Тестировщик',
  PLATFORM_STAFF: 'Сотрудник платформы',
};

function emailFor(role: SandboxRole) {
  return `sandbox-${role.toLowerCase().replace('_', '-')}@sa-sandbox.local`;
}

async function signToken(
  actorType: AuthActorType | 'MARKETER' | 'PLATFORM_STAFF',
  actorId: string,
  payload: Record<string, unknown>
) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  const expiresIn = actorType === 'CLIENT' || actorType === 'PARENT' ? '30d' : process.env.JWT_EXPIRES_IN || '7d';
  if (actorType === 'MARKETER' || actorType === 'PLATFORM_STAFF') {
    return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
  }
  const authSession = await createAuthSession({
    actorType,
    actorId,
    expiresAt: expiresAtFromTtl(expiresIn),
    meta: {},
  });
  return jwt.sign({ ...payload, jti: authSession.id }, secret, { expiresIn } as jwt.SignOptions);
}

async function ensureSandboxTenant() {
  let tenant = await prisma.tenant.findUnique({ where: { subdomain: SANDBOX_SUBDOMAIN } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: 'Песочница',
        subdomain: SANDBOX_SUBDOMAIN,
        email: 'school@sa-sandbox.local',
        isActive: true,
      },
    });
  }
  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: tenant.id } });
  if (!settings) {
    await prisma.tenantSettings.create({
      data: { tenantId: tenant.id, hasCompletedOnboarding: true },
    });
  } else if (!settings.hasCompletedOnboarding) {
    await prisma.tenantSettings.update({
      where: { id: settings.id },
      data: { hasCompletedOnboarding: true },
    });
  }
  const sub = await prisma.subscription.findUnique({ where: { tenantId: tenant.id } });
  if (!sub) {
    await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planType: 'FREE',
        status: 'active',
        isGranted: true,
        grantedAt: new Date(),
      },
    });
  }
  return tenant;
}

async function ensureUser(tenantId: string, role: 'OWNER' | 'ADMIN' | 'TRAINER', password: string) {
  const email = emailFor(role);
  let user = await prisma.user.findFirst({ where: { tenantId, email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        password,
        firstName: 'Тест',
        lastName: LABELS[role],
        role,
        tenantId,
        isActive: true,
        emailVerified: true,
        hasCompletedOnboarding: true,
      },
    });
  }
  if (role === 'TRAINER') {
    const trainer = await prisma.trainer.findUnique({ where: { userId: user.id } });
    if (!trainer) {
      await prisma.trainer.create({
        data: {
          userId: user.id,
          tenantId,
          salaryType: 'fixed',
          isActive: true,
        },
      });
    }
  }
  return user;
}

async function ensureClientAndParent(tenantId: string, password: string) {
  const clientEmail = emailFor('CLIENT');
  let client = await prisma.client.findFirst({ where: { tenantId, email: clientEmail } });
  if (!client) {
    client = await prisma.client.create({
      data: {
        firstName: 'Тест',
        lastName: 'Клиент',
        email: clientEmail,
        password,
        tenantId,
        isActive: true,
        isAccountApproved: true,
        emailVerified: true,
      },
    });
  } else if (!client.isAccountApproved) {
    client = await prisma.client.update({
      where: { id: client.id },
      data: { isAccountApproved: true, password: client.password || password },
    });
  }
  const parentEmail = emailFor('PARENT');
  let parent = await prisma.parent.findFirst({ where: { tenantId, email: parentEmail } });
  if (!parent) {
    parent = await prisma.parent.create({
      data: {
        fullName: 'Тест Родитель',
        email: parentEmail,
        password,
        clientId: client.id,
        tenantId,
        isAccountApproved: true,
        isApproved: true,
        emailVerified: true,
      },
    });
  }
  return { client, parent };
}

export async function issueSandboxSession(superAdminId: string, role: SandboxRole) {
  const password = await bcrypt.hash('sandbox-not-for-login', BCRYPT_ROUNDS);
  const tenant = await ensureSandboxTenant();
  const tenantBrief = { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain };
  let keys: Record<string, string> = {};
  let storageKey = 'token';
  let dashboardPath = '/dashboard';

  if (role === 'OWNER' || role === 'ADMIN' || role === 'TRAINER') {
    const user = await ensureUser(tenant.id, role, password);
    const token = await signToken('USER', user.id, {
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      sv: user.sessionVersion,
    });
    keys = {
      token,
      user: JSON.stringify({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        hasCompletedOnboarding: true,
      }),
      tenant: JSON.stringify(tenantBrief),
    };
    storageKey = 'token';
    dashboardPath = '/dashboard';
  } else if (role === 'CLIENT' || role === 'PARENT') {
    const { client, parent } = await ensureClientAndParent(tenant.id, password);
    if (role === 'CLIENT') {
      const token = await signToken('CLIENT', client.id, {
        clientId: client.id,
        tenantId: client.tenantId,
        type: 'client',
        sv: client.sessionVersion,
      });
      keys = {
        clientToken: token,
        client: JSON.stringify({
          id: client.id,
          firstName: client.firstName,
          lastName: client.lastName,
          email: client.email,
          tenantId: client.tenantId,
        }),
        clientTenant: JSON.stringify(tenantBrief),
        userType: 'client',
        clientApproved: 'true',
      };
    } else {
      const token = await signToken('PARENT', parent.id, {
        parentId: parent.id,
        tenantId: parent.tenantId,
        type: 'parent',
        sv: parent.sessionVersion,
      });
      keys = {
        clientToken: token,
        client: JSON.stringify({
          id: parent.id,
          fullName: parent.fullName,
          email: parent.email,
          tenantId: parent.tenantId,
          clientId: parent.clientId,
        }),
        clientTenant: JSON.stringify(tenantBrief),
        userType: 'parent',
        clientApproved: 'true',
      };
    }
    storageKey = 'clientToken';
    dashboardPath = '/client/dashboard';
  } else if (role === 'MARKETER') {
    const email = emailFor('MARKETER');
    let marketer = await prisma.marketer.findUnique({ where: { email } });
    if (!marketer) {
      marketer = await prisma.marketer.create({
        data: {
          name: 'Тест Маркетолог',
          email,
          password,
          type: 'MARKETER',
          isActive: true,
          tenantId: null,
        },
      });
    }
    const token = await signToken('MARKETER', marketer.id, {
      userId: marketer.id,
      email: marketer.email,
      type: 'MARKETER',
      tenantId: null,
    });
    keys = {
      marketerToken: token,
      marketer: JSON.stringify({ id: marketer.id, name: marketer.name, email: marketer.email }),
      marketerTenant: 'null',
    };
    storageKey = 'marketerToken';
    dashboardPath = '/marketer/dashboard';
  } else if (role === 'TESTER') {
    const email = emailFor('TESTER');
    let tester = await prisma.tester.findUnique({ where: { email } });
    if (!tester) {
      tester = await prisma.tester.create({
        data: { email, password, firstName: 'Тест', lastName: 'Тестировщик', isActive: true },
      });
    }
    const token = await signToken('TESTER', tester.id, {
      userId: tester.id,
      email: tester.email,
      type: 'TESTER',
      sv: tester.sessionVersion,
    });
    keys = {
      testerToken: token,
      tester: JSON.stringify({
        id: tester.id,
        email: tester.email,
        firstName: tester.firstName,
        lastName: tester.lastName,
      }),
    };
    storageKey = 'testerToken';
    dashboardPath = '/tester/dashboard';
  } else {
    const email = emailFor('PLATFORM_STAFF');
    let staff = await prisma.platformStaffUser.findUnique({ where: { email } });
    if (!staff) {
      staff = await prisma.platformStaffUser.create({
        data: {
          email,
          password,
          firstName: 'Тест',
          lastName: 'Сотрудник',
          role: 'SUPPORT',
          isActive: true,
          mustChangePassword: false,
          passwordChangedAt: new Date(),
        },
      });
    } else if (staff.mustChangePassword) {
      staff = await prisma.platformStaffUser.update({
        where: { id: staff.id },
        data: { mustChangePassword: false },
      });
    }
    const token = await signToken('PLATFORM_STAFF', staff.id, {
      userId: staff.id,
      email: staff.email,
      type: 'PLATFORM_STAFF',
      role: staff.role,
    });
    keys = {
      platformStaffToken: token,
      platformStaff: JSON.stringify({
        id: staff.id,
        email: staff.email,
        firstName: staff.firstName,
        lastName: staff.lastName,
        role: staff.role,
        mustChangePassword: false,
      }),
    };
    storageKey = 'platformStaffToken';
    dashboardPath = '/platform-staff/desk';
  }

  await prisma.superAdminTestSession.deleteMany({
    where: { superAdminId, role, saved: false },
  });
  const row = await prisma.superAdminTestSession.create({
    data: {
      superAdminId,
      role,
      label: LABELS[role],
      token: JSON.stringify(keys),
      storageKey,
      dashboardPath,
      saved: false,
    },
  });

  return {
    sessionId: row.id,
    role,
    label: LABELS[role],
    dashboardPath,
    storageKey,
    keys,
    saved: false,
  };
}

export async function listSandboxSessions(superAdminId: string) {
  const rows = await prisma.superAdminTestSession.findMany({
    where: { superAdminId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      role: true,
      label: true,
      saved: true,
      dashboardPath: true,
      updatedAt: true,
    },
  });
  return rows;
}

export async function reopenSandboxSession(superAdminId: string, sessionId: string) {
  const row = await prisma.superAdminTestSession.findFirst({
    where: { id: sessionId, superAdminId, saved: true },
  });
  if (!row) return null;
  const fresh = await issueSandboxSession(superAdminId, row.role as SandboxRole);
  await prisma.superAdminTestSession.delete({ where: { id: fresh.sessionId } });
  const updated = await prisma.superAdminTestSession.update({
    where: { id: row.id },
    data: {
      token: JSON.stringify(fresh.keys),
      storageKey: fresh.storageKey,
      dashboardPath: fresh.dashboardPath,
      saved: true,
    },
  });
  return {
    sessionId: updated.id,
    role: updated.role,
    label: updated.label,
    dashboardPath: updated.dashboardPath,
    storageKey: updated.storageKey,
    keys: fresh.keys,
    saved: true,
  };
}

export async function saveSandboxSession(superAdminId: string, sessionId: string) {
  const row = await prisma.superAdminTestSession.findFirst({
    where: { id: sessionId, superAdminId },
  });
  if (!row) return null;
  await prisma.superAdminTestSession.deleteMany({
    where: { superAdminId, role: row.role, saved: true, id: { not: row.id } },
  });
  return prisma.superAdminTestSession.update({
    where: { id: row.id },
    data: { saved: true },
    select: { id: true, role: true, label: true, saved: true },
  });
}

export async function deleteSandboxSession(superAdminId: string, sessionId: string) {
  const row = await prisma.superAdminTestSession.findFirst({
    where: { id: sessionId, superAdminId },
  });
  if (!row) return false;
  await prisma.superAdminTestSession.delete({ where: { id: row.id } });
  return true;
}
