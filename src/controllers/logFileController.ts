import { Response } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { LogFileService } from '../services/logFileService';
import { createAuditLog, getIpAddress, getUserAgent } from '../utils/auditLogger';

/**
 * Управление файлом ошибок сервера из панели супер-админа:
 * путь, просмотр, выгрузка и очистка.
 */

/** Сведения о файле логов и текущий путь. */
export const getLogFileInfo = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const info = await LogFileService.getInfo();

    res.json({
      success: true,
      data: {
        ...info,
        defaultPath: LogFileService.defaultPath(),
        sizeHuman: formatBytes(info.size),
      },
    });
  }
);

/** Последние строки файла для просмотра в интерфейсе. */
export const readLogFile = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const linesParam = Number(req.query.lines);
    const lines = Number.isFinite(linesParam) ? Math.min(Math.max(linesParam, 10), 5000) : 500;

    const { info, content, truncated } = await LogFileService.readTail(lines);

    res.json({
      success: true,
      data: {
        path: info.path,
        exists: info.exists,
        size: info.size,
        sizeHuman: formatBytes(info.size),
        modifiedAt: info.modifiedAt,
        lines,
        truncated,
        content,
      },
    });
  }
);

/** Выгрузка файла логов целиком. */
export const downloadLogFile = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const superAdmin = (req as any).superAdmin;
    const { info, stream } = await LogFileService.createDownloadStream();

    await createAuditLog({
      superAdminId: superAdmin?.id,
      action: 'download_error_log',
      entityType: 'log_file',
      entityId: info.path,
      description: `Выгружен файл логов (${formatBytes(info.size)})`,
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    });

    const fileName = `server-error-log-${new Date().toISOString().slice(0, 10)}.log`;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', String(info.size));

    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Не удалось прочитать файл логов' });
      } else {
        res.end();
      }
    });

    stream.pipe(res);
  }
);

/** Очистка файла логов. */
export const clearLogFile = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const superAdmin = (req as any).superAdmin;
    const result = await LogFileService.clear();

    await createAuditLog({
      superAdminId: superAdmin?.id,
      action: 'clear_error_log',
      entityType: 'log_file',
      entityId: result.path,
      description: `Файл логов очищен (освобождено ${formatBytes(result.clearedBytes)})`,
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    });

    res.json({
      success: true,
      data: { path: result.path, clearedBytes: result.clearedBytes },
      message: `Файл логов очищен, освобождено ${formatBytes(result.clearedBytes)}`,
    });
  }
);

/** Человекочитаемый размер. */
function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 Б';
  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
