import { prisma } from '../lib/prisma';
import { removeTenantUploadFiles } from '../utils/fileStorage';
import { notFound } from '../utils/httpError';

export type TenantDeletionSummary = {
  tenantId: string;
  name: string;
  subdomain: string;
  email: string;
  clients: number;
  users: number;
  payments: number;
};

/**
 * Полное необратимое удаление школы (Tenant) и связанных данных.
 */
export async function deleteTenantCompletely(tenantId: string): Promise<TenantDeletionSummary> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      subdomain: true,
      email: true,
      _count: {
        select: {
          clients: true,
          users: true,
          payments: true,
        },
      },
    },
  });
  if (!tenant) throw notFound('Школа не найдена');

  const summary: TenantDeletionSummary = {
    tenantId: tenant.id,
    name: tenant.name,
    subdomain: tenant.subdomain,
    email: tenant.email,
    clients: tenant._count.clients,
    users: tenant._count.users,
    payments: tenant._count.payments,
  };

  const users = await prisma.user.findMany({
    where: { tenantId },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);

  const clients = await prisma.client.findMany({
    where: { tenantId },
    select: { id: true },
  });
  const clientIds = clients.map((c) => c.id);

  const parents = await prisma.parent.findMany({
    where: { tenantId },
    select: { id: true },
  });
  const parentIds = parents.map((p) => p.id);

  const schoolMarketers = await prisma.marketer.findMany({
    where: { tenantId },
    select: { id: true },
  });
  const schoolMarketerIds = schoolMarketers.map((m) => m.id);

  await prisma.$transaction(async (tx) => {
    if (userIds.length > 0) {
      await tx.pushSubscription.deleteMany({ where: { userId: { in: userIds } } });
      await tx.notificationPreference.deleteMany({
        where: { actorType: 'USER', actorId: { in: userIds } },
      });
      await tx.inAppNotification.deleteMany({
        where: { actorType: 'USER', actorId: { in: userIds } },
      });
      await tx.superAdmin.deleteMany({ where: { linkedUserId: { in: userIds } } });
      await tx.tester.deleteMany({ where: { linkedUserId: { in: userIds } } });
    }

    if (clientIds.length > 0) {
      await tx.portalPushSubscription.deleteMany({ where: { clientId: { in: clientIds } } });
      await tx.notificationPreference.deleteMany({
        where: { actorType: 'CLIENT', actorId: { in: clientIds } },
      });
      await tx.inAppNotification.deleteMany({
        where: { actorType: 'CLIENT', actorId: { in: clientIds } },
      });
    }

    if (parentIds.length > 0) {
      await tx.portalPushSubscription.deleteMany({ where: { parentId: { in: parentIds } } });
      await tx.notificationPreference.deleteMany({
        where: { actorType: 'PARENT', actorId: { in: parentIds } },
      });
      await tx.inAppNotification.deleteMany({
        where: { actorType: 'PARENT', actorId: { in: parentIds } },
      });
    }

    await tx.inAppNotification.deleteMany({ where: { tenantId } });
    await tx.clientFeatureIdea.deleteMany({ where: { tenantId } });
    await tx.subscriptionGrantLog.deleteMany({ where: { tenantId } });

    // Клики/промо без Cascade на Client — иначе tenant.delete упадёт на Restrict
    if (clientIds.length > 0) {
      await tx.referralClick.deleteMany({ where: { clientId: { in: clientIds } } });
      await tx.promoCodeUsage.deleteMany({ where: { clientId: { in: clientIds } } });
    }
    await tx.referralClick.deleteMany({ where: { tenantId } });

    // Школьные промо/рефералки (у Tenant onDelete: SetNull — иначе останутся сиротами)
    await tx.promoCode.deleteMany({ where: { tenantId } });
    await tx.referralLink.deleteMany({ where: { tenantId } });

    // Школьные маркетологи: FK без Cascade — сначала отвязать
    if (schoolMarketerIds.length > 0) {
      await tx.adminTransaction.updateMany({
        where: { marketerId: { in: schoolMarketerIds } },
        data: { marketerId: null },
      });
      await tx.promoCode.updateMany({
        where: { marketerId: { in: schoolMarketerIds } },
        data: { marketerId: null },
      });
      await tx.referralLink.updateMany({
        where: { marketerId: { in: schoolMarketerIds } },
        data: { marketerId: null },
      });
      await tx.marketer.deleteMany({ where: { id: { in: schoolMarketerIds } } });
    }

    await tx.tenant.delete({ where: { id: tenantId } });
  });

  removeTenantUploadFiles(tenantId);

  return summary;
}
