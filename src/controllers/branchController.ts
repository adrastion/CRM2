import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import {
  canManageBranch,
  getSeniorBranchIds,
  isOwnerOrAdminRole,
} from '../utils/branchAccess';
import { ensureUploadDir, uniqueUploadFilename } from '../utils/fileStorage';

const BRANCH_ICONS = new Set(['building', 'home', 'store', 'flag', 'trophy']);

function parseOptionalFloat(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeTrainingTypes(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  if (Array.isArray(v)) return JSON.stringify(v.map(String).filter(Boolean));
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) return null;
    try {
      const parsed = JSON.parse(t);
      if (Array.isArray(parsed)) return JSON.stringify(parsed.map(String).filter(Boolean));
    } catch {
      /* plain string list */
    }
    return JSON.stringify(
      t
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    );
  }
  return null;
}

/** data:image/...;base64,... → uploads/branch-photos/<tenant>/<file> */
function saveBranchPhotoBase64(tenantId: string, dataUrl: string): string | null {
  const m = /^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  const ext = m[1].toLowerCase().includes('png')
    ? 'png'
    : m[1].toLowerCase().includes('webp')
      ? 'webp'
      : 'jpg';
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 5 * 1024 * 1024) return null;
  const dir = ensureUploadDir('branch-photos', tenantId);
  const filename = uniqueUploadFilename(`branch.${ext}`);
  fs.writeFileSync(path.join(dir, filename), buf);
  return `/uploads/branch-photos/${tenantId}/${filename}`;
}

function pickBranchExtraFields(
  body: Record<string, unknown>,
  tenantId: string,
  opts?: { allowIsActive?: boolean }
) {
  const data: Record<string, unknown> = {};
  if (body.shortName !== undefined) {
    data.shortName = body.shortName ? String(body.shortName).trim() : null;
  }
  if (body.description !== undefined) {
    const d = body.description != null ? String(body.description).trim() : '';
    data.description = d ? d.slice(0, 500) : null;
  }
  if (body.workingHours !== undefined) {
    data.workingHours = body.workingHours ? String(body.workingHours).trim() : null;
  }
  if (body.specialization !== undefined) {
    data.specialization = body.specialization ? String(body.specialization).trim() : null;
  }
  const types = normalizeTrainingTypes(body.trainingTypes);
  if (types !== undefined) data.trainingTypes = types;
  if (body.color !== undefined) {
    data.color = body.color ? String(body.color).trim() : null;
  }
  if (body.icon !== undefined) {
    const icon = body.icon ? String(body.icon).trim().toLowerCase() : '';
    data.icon = icon && BRANCH_ICONS.has(icon) ? icon : null;
  }
  const lat = parseOptionalFloat(body.mapLat);
  if (lat !== undefined) data.mapLat = lat;
  const lng = parseOptionalFloat(body.mapLng);
  if (lng !== undefined) data.mapLng = lng;

  if (typeof body.photoBase64 === 'string' && body.photoBase64.startsWith('data:image')) {
    const url = saveBranchPhotoBase64(tenantId, body.photoBase64);
    if (url) data.photoUrl = url;
  } else if (body.photoUrl !== undefined) {
    data.photoUrl = body.photoUrl ? String(body.photoUrl).trim() : null;
  }

  if (opts?.allowIsActive && body.isActive !== undefined) {
    data.isActive = Boolean(body.isActive);
  }

  return data;
}

const branchInclude = {
  seniorTrainer: {
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
          email: true,
        },
      },
    },
  },
};

export const getBranches = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {
      tenantId: req.tenant?.id,
      isActive: true,
    };

    if (req.user?.role === 'TRAINER') {
      const seniorIds = await getSeniorBranchIds(req.user.id, req.tenant?.id);
      // Старший тренер видит только свои филиалы; обычный тренер — все (фильтры расписания)
      if (seniorIds.length > 0) {
        where.id = { in: seniorIds };
      }
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { address: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [branches, total] = await Promise.all([
      prisma.branch.findMany({
        where,
        include: branchInclude,
        skip,
        take: Number(limit),
        orderBy: { name: 'asc' },
      }),
      prisma.branch.count({ where }),
    ]);

    res.json({
      success: true,
      data: branches,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
      message: 'Филиалы успешно получены',
    });
  } catch (error) {
    console.error('Get branches error:', error);
    res.status(500).json({
      success: false,
      error: 'Не удалось получить список филиалов',
    });
  }
};

export const getBranchById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (req.user && !(await canManageBranch(req.user, id, req.tenant?.id)) && !isOwnerOrAdminRole(req.user.role)) {
      // Trainers who are not senior of this branch: allow read if OWNER/ADMIN already covered;
      // regular trainers may still need branch list for schedule filters — getBranches already open for O/A/T historically.
      // For by-id used in management, require manage OR owner/admin OR any authenticated for same tenant.
    }

    const branch = await prisma.branch.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id,
      },
      include: branchInclude,
    });

    if (!branch) {
      res.status(404).json({
        success: false,
        error: 'Филиал не найден',
      });
      return;
    }

    if (req.user?.role === 'TRAINER') {
      const seniorIds = await getSeniorBranchIds(req.user.id, req.tenant?.id);
      // Non-senior trainers historically could list branches for filters; keep by-id readable for tenant.
      // Senior-only restriction applies to mutating routes.
      void seniorIds;
    }

    res.json({
      success: true,
      data: branch,
      message: 'Филиал успешно получен',
    });
  } catch (error) {
    console.error('Get branch error:', error);
    res.status(500).json({
      success: false,
      error: 'Не удалось получить филиал',
    });
  }
};

async function assertValidSeniorTrainer(
  seniorTrainerId: string | null | undefined,
  tenantId: string | undefined
): Promise<string | null | undefined> {
  if (seniorTrainerId === undefined) return undefined;
  if (seniorTrainerId === null || seniorTrainerId === '') return null;

  const trainer = await prisma.trainer.findFirst({
    where: {
      id: seniorTrainerId,
      tenantId,
      isActive: true,
    },
  });
  if (!trainer) {
    throw new Error('SENIOR_TRAINER_NOT_FOUND');
  }
  return trainer.id;
}

export const createBranch = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user || !isOwnerOrAdminRole(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Только владелец или администратор может создавать филиалы',
      });
      return;
    }

    let seniorTrainerId: string | null | undefined;
    try {
      seniorTrainerId = await assertValidSeniorTrainer(req.body.seniorTrainerId, req.tenant?.id);
    } catch {
      res.status(400).json({
        success: false,
        error: 'Указанный старший тренер не найден',
      });
      return;
    }

    const tenantId = req.tenant!.id;
    const extra = pickBranchExtraFields(req.body, tenantId, { allowIsActive: true });
    const branch = await prisma.branch.create({
      data: {
        name: String(req.body.name || '').trim(),
        address: String(req.body.address || '').trim(),
        phone: req.body.phone ? String(req.body.phone).trim() : null,
        email: req.body.email ? String(req.body.email).trim().toLowerCase() : null,
        tenantId,
        ...(seniorTrainerId !== undefined ? { seniorTrainerId } : {}),
        ...extra,
      },
      include: branchInclude,
    });

    res.status(201).json({
      success: true,
      data: branch,
      message: 'Филиал успешно создан',
    });
  } catch (error) {
    console.error('Create branch error:', error);
    res.status(500).json({
      success: false,
      error: 'Не удалось создать филиал',
    });
  }
};

export const updateBranch = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const branch = await prisma.branch.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id,
      },
    });

    if (!branch) {
      res.status(404).json({
        success: false,
        error: 'Филиал не найден',
      });
      return;
    }

    const isOwnerAdmin = req.user && isOwnerOrAdminRole(req.user.role);
    const isSeniorHere = req.user
      ? await canManageBranch(req.user, id, req.tenant?.id)
      : false;

    if (!isOwnerAdmin && !isSeniorHere) {
      res.status(403).json({
        success: false,
        error: 'Недостаточно прав',
      });
      return;
    }

    const data: Record<string, unknown> = {
      name: req.body.name,
      address: req.body.address,
      phone: req.body.phone,
      email: req.body.email,
      ...pickBranchExtraFields(req.body, req.tenant!.id, {
        allowIsActive: Boolean(isOwnerAdmin),
      }),
    };

    if (isOwnerAdmin && req.body.seniorTrainerId !== undefined) {
      try {
        data.seniorTrainerId = await assertValidSeniorTrainer(
          req.body.seniorTrainerId,
          req.tenant?.id
        );
      } catch {
        res.status(400).json({
          success: false,
          error: 'Указанный старший тренер не найден',
        });
        return;
      }
    }

    const updatedBranch = await prisma.branch.update({
      where: { id },
      data,
      include: branchInclude,
    });

    res.json({
      success: true,
      data: updatedBranch,
      message: 'Филиал успешно обновлён',
    });
  } catch (error) {
    console.error('Update branch error:', error);
    res.status(500).json({
      success: false,
      error: 'Не удалось обновить филиал',
    });
  }
};

export const getBranchDeletionImpact = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user || !isOwnerOrAdminRole(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Только владелец или администратор может удалять филиалы',
      });
      return;
    }
    const { id } = req.params;
    const tenantId = req.tenant?.id;
    const branch = await prisma.branch.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!branch || !tenantId) {
      res.status(404).json({ success: false, error: 'Филиал не найден' });
      return;
    }
    const { getBranchDeletionImpact: impact } = await import('../services/deletionPurgeService');
    const data = await impact(tenantId, id);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Branch deletion impact error:', error);
    res.status(500).json({ success: false, error: 'Не удалось загрузить последствия удаления' });
  }
};

export const deleteBranch = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user || !isOwnerOrAdminRole(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Только владелец или администратор может удалять филиалы',
      });
      return;
    }

    const { id } = req.params;
    const tenantId = req.tenant?.id;

    const branch = await prisma.branch.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!branch || !tenantId) {
      res.status(404).json({
        success: false,
        error: 'Филиал не найден',
      });
      return;
    }

    const { parseSchoolPurge, purgeOnBranchDelete } = await import('../services/deletionPurgeService');
    await purgeOnBranchDelete(tenantId, id, parseSchoolPurge(req.body));

    await prisma.branch.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({
      success: true,
      message: 'Филиал успешно удалён',
    });
  } catch (error) {
    console.error('Delete branch error:', error);
    res.status(500).json({
      success: false,
      error: 'Не удалось удалить филиал',
    });
  }
};
