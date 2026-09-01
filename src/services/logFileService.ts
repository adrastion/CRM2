import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { badRequest, notFound } from '../utils/httpError';

const prisma = new PrismaClient();

/**
 * Путь к файлу логов по умолчанию.
 * На сервере (Ubuntu) проект развёрнут в /var/www/CRM2, поэтому по умолчанию
 * используем logs/err.log относительно корня проекта — это тот же файл.
 */
const DEFAULT_RELATIVE_PATH = path.join('logs', 'err.log');

/** Максимальный размер отдаваемого фрагмента при просмотре: 2 МБ. */
const MAX_PREVIEW_BYTES = 2 * 1024 * 1024;

export interface LogFileInfo {
  path: string;
  exists: boolean;
  /** Размер в байтах. */
  size: number;
  modifiedAt: Date | null;
  /** Можно ли писать в файл (нужно для очистки). */
  writable: boolean;
}

/**
 * Работа с файлом ошибок сервера: настройка пути, просмотр, выгрузка, очистка.
 *
 * Путь задаётся супер-админом и хранится в SuperAdminSettings.errorLogPath.
 * Поскольку значение приходит извне и используется для доступа к файловой
 * системе, оно проходит проверку в `validatePath`.
 */
export class LogFileService {
  /** Корень проекта (на уровень выше src/ или dist/). */
  private static projectRoot(): string {
    return path.resolve(__dirname, '..', '..');
  }

  /** Путь по умолчанию — абсолютный. */
  static defaultPath(): string {
    return path.join(this.projectRoot(), DEFAULT_RELATIVE_PATH);
  }

  /**
   * Проверяет и нормализует путь к файлу логов.
   *
   * Ограничения намеренно строгие: эндпоинты просмотра и выгрузки читают этот
   * файл с диска, поэтому произвольный путь превратил бы панель в средство
   * чтения любых файлов сервера.
   */
  static validatePath(rawPath: string): string {
    const value = (rawPath || '').trim();
    if (!value) {
      throw badRequest('Укажите путь к файлу логов', 'errorLogPath');
    }

    if (value.includes('\0')) {
      throw badRequest('Недопустимый путь', 'errorLogPath');
    }

    if (!path.isAbsolute(value)) {
      throw badRequest('Путь должен быть абсолютным, например /var/www/CRM2/logs/err.log', 'errorLogPath');
    }

    const normalized = path.normalize(value);

    // Обход каталогов не имеет смысла в абсолютном пути после нормализации,
    // но проверяем явно: так ошибка будет понятной, а не «файл не найден».
    if (normalized.split(path.sep).includes('..')) {
      throw badRequest('Путь не должен содержать «..»', 'errorLogPath');
    }

    const allowedExtensions = ['.log', '.txt', '.out', '.err'];
    const ext = path.extname(normalized).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      throw badRequest(
        `Допустимые расширения файла логов: ${allowedExtensions.join(', ')}`,
        'errorLogPath'
      );
    }

    // Каталоги с секретами и системными данными закрываем явно.
    const forbiddenPrefixes = ['/etc', '/proc', '/sys', '/dev', '/root/.ssh', '/boot'];
    const lower = normalized.replace(/\\/g, '/').toLowerCase();
    if (forbiddenPrefixes.some((p) => lower === p || lower.startsWith(`${p}/`))) {
      throw badRequest('Этот каталог недоступен для чтения логов', 'errorLogPath');
    }

    return normalized;
  }

  /** Текущий путь к файлу логов: из настроек либо значение по умолчанию. */
  static async getConfiguredPath(): Promise<string> {
    const settings = await (prisma as any).superAdminSettings.findFirst();
    const configured = settings?.errorLogPath as string | undefined | null;

    if (!configured) {
      return this.defaultPath();
    }

    try {
      return this.validatePath(configured);
    } catch {
      // Настройка повреждена — не роняем панель, возвращаем путь по умолчанию.
      console.warn('[logFile] Некорректный путь в настройках, использую путь по умолчанию');
      return this.defaultPath();
    }
  }

  /** Сведения о файле: существует ли, размер, дата изменения. */
  static async getInfo(): Promise<LogFileInfo> {
    const filePath = await this.getConfiguredPath();

    try {
      const stat = await fsp.stat(filePath);
      if (!stat.isFile()) {
        throw badRequest('Указанный путь не является файлом', 'errorLogPath');
      }

      let writable = true;
      try {
        await fsp.access(filePath, fs.constants.W_OK);
      } catch {
        writable = false;
      }

      return {
        path: filePath,
        exists: true,
        size: stat.size,
        modifiedAt: stat.mtime,
        writable,
      };
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return { path: filePath, exists: false, size: 0, modifiedAt: null, writable: false };
      }
      if (error?.code === 'EACCES') {
        throw badRequest('Нет прав на чтение файла логов', 'errorLogPath');
      }
      throw error;
    }
  }

  /**
   * Последние строки файла для просмотра в панели.
   * Читаем только хвост файла, чтобы не выгружать многомегабайтный лог целиком.
   */
  static async readTail(lines = 500): Promise<{ info: LogFileInfo; content: string; truncated: boolean }> {
    const info = await this.getInfo();

    if (!info.exists) {
      return { info, content: '', truncated: false };
    }

    const readBytes = Math.min(info.size, MAX_PREVIEW_BYTES);
    const start = info.size - readBytes;

    const handle = await fsp.open(info.path, 'r');
    try {
      const buffer = Buffer.alloc(readBytes);
      await handle.read(buffer, 0, readBytes, start);
      const text = buffer.toString('utf8');

      const allLines = text.split(/\r?\n/);
      // Первая строка могла быть обрезана посередине — отбрасываем её.
      if (start > 0 && allLines.length > 1) {
        allLines.shift();
      }

      const tail = allLines.slice(-Math.max(1, lines));
      return {
        info,
        content: tail.join('\n'),
        truncated: start > 0 || allLines.length > lines,
      };
    } finally {
      await handle.close();
    }
  }

  /** Поток для выгрузки файла целиком. */
  static async createDownloadStream(): Promise<{ info: LogFileInfo; stream: fs.ReadStream }> {
    const info = await this.getInfo();
    if (!info.exists) {
      throw notFound('Файл логов не найден', 'errorLogPath');
    }
    return { info, stream: fs.createReadStream(info.path) };
  }

  /**
   * Очистка файла: содержимое обнуляется, файл сохраняется.
   * Truncate вместо удаления — иначе процесс, держащий дескриптор,
   * продолжил бы писать в удалённый файл.
   */
  static async clear(): Promise<{ path: string; clearedBytes: number }> {
    const info = await this.getInfo();

    if (!info.exists) {
      // Создаём пустой файл, чтобы последующие записи не падали.
      await fsp.mkdir(path.dirname(info.path), { recursive: true });
      await fsp.writeFile(info.path, '');
      return { path: info.path, clearedBytes: 0 };
    }

    try {
      await fsp.truncate(info.path, 0);
    } catch (error: any) {
      if (error?.code === 'EACCES' || error?.code === 'EPERM') {
        throw badRequest('Нет прав на запись в файл логов', 'errorLogPath');
      }
      throw error;
    }

    return { path: info.path, clearedBytes: info.size };
  }

  /**
   * Дописывает запись об ошибке в файл логов.
   *
   * Вызывается из обработчика ошибок. Ошибки записи намеренно игнорируются:
   * сбой логирования не должен приводить к сбою запроса.
   */
  static appendError(message: string): void {
    // Путь берём синхронно из кэша: обращение к БД в обработчике ошибок
    // может само упасть, а логировать нужно всегда.
    const filePath = this.cachedPath || this.defaultPath();
    const line = `[${new Date().toISOString()}] ${message}\n`;

    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.appendFileSync(filePath, line);
    } catch {
      // Файл недоступен — молча продолжаем, запись уже попала в stdout.
    }
  }

  /** Кэш пути, чтобы синхронная запись не обращалась к БД. */
  private static cachedPath: string | null = null;

  /** Обновляет кэш пути. Вызывается при старте и после смены настроек. */
  static async refreshCachedPath(): Promise<string> {
    this.cachedPath = await this.getConfiguredPath();
    return this.cachedPath;
  }
}
