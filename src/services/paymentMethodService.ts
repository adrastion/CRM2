import { prisma } from '../lib/prisma';

export type PaymentMethodWithBindings = {
  id: string;
  title: string;
  paymentUrl: string | null;
  qrStoragePath: string | null;
  mimeType: string | null;
  isDefault: boolean;
  sortOrder: number;
  isActive: boolean;
  groups: Array<{ groupId: string; group: { id: string; name: string } }>;
  memberships: Array<{ membershipId: string; membership: { id: string; name: string } }>;
};

const methodInclude = {
  groups: { include: { group: { select: { id: true, name: true } } } },
  memberships: { include: { membership: { select: { id: true, name: true } } } },
} as const;

export async function listActivePaymentMethods(tenantId: string) {
  return prisma.schoolPaymentMethod.findMany({
    where: { tenantId, isActive: true },
    include: methodInclude,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
}

/** Resolve which payment method applies to a payment (membership → group → default). */
export function resolvePaymentMethodForPayment(
  methods: PaymentMethodWithBindings[],
  payment: { groupId?: string | null; membershipId?: string | null }
): PaymentMethodWithBindings | null {
  if (!methods.length) return null;

  if (payment.membershipId) {
    const byMem = methods.find((m) =>
      m.memberships.some((x) => x.membershipId === payment.membershipId)
    );
    if (byMem) return byMem;
  }

  if (payment.groupId) {
    const byGrp = methods.find((m) => m.groups.some((x) => x.groupId === payment.groupId));
    if (byGrp) return byGrp;
  }

  const def = methods.find((m) => m.isDefault);
  if (def) return def;

  // Fallback: method with no bindings
  const unbound = methods.find((m) => m.groups.length === 0 && m.memberships.length === 0);
  return unbound || null;
}

export function serializePaymentMethod(m: PaymentMethodWithBindings & { createdAt?: Date; updatedAt?: Date }) {
  return {
    id: m.id,
    title: m.title,
    paymentUrl: m.paymentUrl,
    hasQr: Boolean(m.qrStoragePath),
    mimeType: m.mimeType,
    isDefault: m.isDefault,
    sortOrder: m.sortOrder,
    isActive: m.isActive,
    groupIds: m.groups.map((g) => g.groupId),
    groups: m.groups.map((g) => ({ id: g.group.id, name: g.group.name })),
    membershipIds: m.memberships.map((x) => x.membershipId),
    memberships: m.memberships.map((x) => ({ id: x.membership.id, name: x.membership.name })),
    createdAt: (m as any).createdAt,
    updatedAt: (m as any).updatedAt,
  };
}

export { methodInclude };
