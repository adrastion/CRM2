import { prisma } from '../lib/prisma';
import { SubscriptionService } from './subscriptionService';

/**
 * Отметить конверсию по реферальному коду при регистрации/оплате школы.
 */
export async function applyReferralConversion(refCode: string | null | undefined, tenantId: string): Promise<void> {
  const code = String(refCode || '').trim();
  if (!code || !tenantId) return;

  const link =
    (await prisma.referralLink.findUnique({ where: { code: code.toUpperCase() } })) ||
    (await prisma.referralLink.findUnique({ where: { code } }));

  if (!link || !link.isActive) return;

  const existingConverted = await prisma.referralClick.findFirst({
    where: { referralLinkId: link.id, tenantId, converted: true },
  });
  if (existingConverted) {
    if (link.marketerId) {
      await SubscriptionService.linkTenantToMarketer(tenantId, link.marketerId);
    }
    return;
  }

  const openClick = await prisma.referralClick.findFirst({
    where: { referralLinkId: link.id, converted: false },
    orderBy: { clickedAt: 'desc' },
  });

  if (openClick) {
    await prisma.referralClick.update({
      where: { id: openClick.id },
      data: {
        converted: true,
        conversionDate: new Date(),
        tenantId,
      },
    });
  } else {
    await prisma.referralClick.create({
      data: {
        referralLinkId: link.id,
        converted: true,
        conversionDate: new Date(),
        tenantId,
      },
    });
  }

  if (link.marketerId) {
    await SubscriptionService.linkTenantToMarketer(tenantId, link.marketerId);
  }
}
