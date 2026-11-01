import { prisma } from '../lib/prisma';
import { SubscriptionService } from './subscriptionService';

/**
 * Личный промокод маркетолога: закрепление школы (как у /ref), без скидки.
 * Скидка применяется отдельно при оплате подписки.
 */
export async function applyPromoCodeAttribution(
  promoCode: string | null | undefined,
  tenantId: string
): Promise<void> {
  const raw = String(promoCode || '').trim();
  if (!raw || !tenantId) return;

  const code =
    (await prisma.promoCode.findUnique({ where: { code: raw.toUpperCase() } })) ||
    (await prisma.promoCode.findUnique({ where: { code: raw } }));

  if (!code || !code.isActive || !code.marketerId) return;

  const now = new Date();
  if (new Date(code.validFrom) > now) return;
  if (code.validUntil && new Date(code.validUntil) < now) return;

  await SubscriptionService.linkTenantToMarketer(tenantId, code.marketerId);
}

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
