import { prisma } from '../lib/prisma';

interface AuditLogData {
  superAdminId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  description: string;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Создание записи в логе аудита
 */
export async function createAuditLog(data: AuditLogData): Promise<void> {
  try {
    await (prisma as any).adminAuditLog.create({
      data: {
        superAdminId: data.superAdminId || null,
        action: data.action,
        entityType: data.entityType || null,
        entityId: data.entityId || null,
        description: data.description,
        oldValue: data.oldValue ? JSON.stringify(data.oldValue) : null,
        newValue: data.newValue ? JSON.stringify(data.newValue) : null,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
      },
    });
  } catch (error) {
    console.error('Error creating audit log:', error);
    // Не прерываем выполнение, если логирование не удалось
  }
}

/**
 * Получение IP адреса из запроса
 */
export function getIpAddress(req: any): string | undefined {
  return (
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress
  );
}

/**
 * Получение User Agent из запроса
 */
export function getUserAgent(req: any): string | undefined {
  return req.headers['user-agent'];
}

