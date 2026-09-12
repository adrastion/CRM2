import { prisma } from '../lib/prisma';
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types';

export function isOwnerOrAdminRole(role?: string | null): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

/** Филиалы, где пользователь назначен старшим тренером. */
export async function getSeniorBranchIds(userId: string, tenantId?: string): Promise<string[]> {
  const trainer = await prisma.trainer.findFirst({
    where: {
      userId,
      ...(tenantId ? { tenantId } : {}),
      isActive: true,
    },
    select: { id: true },
  });
  if (!trainer) return [];

  const branches = await prisma.branch.findMany({
    where: {
      seniorTrainerId: trainer.id,
      isActive: true,
      ...(tenantId ? { tenantId } : {}),
    },
    select: { id: true },
  });
  return branches.map((b) => b.id);
}

export async function getSeniorAccessMeta(userId: string, tenantId?: string): Promise<{
  isSeniorTrainer: boolean;
  seniorBranchIds: string[];
  trainerId: string | null;
}> {
  const trainer = await prisma.trainer.findFirst({
    where: {
      userId,
      ...(tenantId ? { tenantId } : {}),
      isActive: true,
    },
    select: { id: true },
  });
  if (!trainer) {
    return { isSeniorTrainer: false, seniorBranchIds: [], trainerId: null };
  }

  const branches = await prisma.branch.findMany({
    where: {
      seniorTrainerId: trainer.id,
      isActive: true,
      ...(tenantId ? { tenantId } : {}),
    },
    select: { id: true },
  });
  const seniorBranchIds = branches.map((b) => b.id);
  return {
    isSeniorTrainer: seniorBranchIds.length > 0,
    seniorBranchIds,
    trainerId: trainer.id,
  };
}

export async function canManageBranch(
  user: { id: string; role: string },
  branchId: string,
  tenantId?: string
): Promise<boolean> {
  if (isOwnerOrAdminRole(user.role)) return true;
  if (user.role !== 'TRAINER') return false;
  const ids = await getSeniorBranchIds(user.id, tenantId);
  return ids.includes(branchId);
}

/** OWNER/ADMIN или старший тренер хотя бы одного филиала. */
export const requireOwnerAdminOrSenior = async (
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  if (isOwnerOrAdminRole(req.user.role)) {
    next();
    return;
  }

  if (req.user.role === 'TRAINER') {
    const ids = await getSeniorBranchIds(req.user.id, req.tenant?.id);
    if (ids.length > 0) {
      (req as AuthenticatedRequest & { seniorBranchIds?: string[] }).seniorBranchIds = ids;
      next();
      return;
    }
  }

  res.status(403).json({ success: false, error: 'Insufficient permissions' });
};

/** Пересечение запрошенных branchIds с доступными старшему; для OWNER/ADMIN — без ограничений. */
export async function resolveAccessibleBranchIds(
  user: { id: string; role: string },
  tenantId: string | undefined,
  requested?: string[] | string | null
): Promise<{ allAccess: boolean; branchIds: string[] }> {
  if (isOwnerOrAdminRole(user.role)) {
    const list = Array.isArray(requested)
      ? requested
      : requested
        ? [requested]
        : [];
    return { allAccess: list.length === 0, branchIds: list };
  }

  const seniorIds = await getSeniorBranchIds(user.id, tenantId);
  if (seniorIds.length === 0) {
    return { allAccess: false, branchIds: [] };
  }

  const requestedList = Array.isArray(requested)
    ? requested
    : requested
      ? [requested]
      : [];

  if (requestedList.length === 0) {
    return { allAccess: false, branchIds: seniorIds };
  }

  return {
    allAccess: false,
    branchIds: requestedList.filter((id) => seniorIds.includes(id)),
  };
}
