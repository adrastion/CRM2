/**
 * Ошибка с явным HTTP-статусом. Позволяет контроллерам отдавать понятные
 * пользователю сообщения без разбора текста ошибки в глобальном обработчике.
 */
export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly field?: string;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, options?: { field?: string; details?: unknown }) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.field = options?.field;
    this.details = options?.details;
  }
}

export const badRequest = (message: string, field?: string) => new HttpError(400, message, { field });
export const unauthorized = (message: string, field?: string) => new HttpError(401, message, { field });
export const forbidden = (message: string, field?: string) => new HttpError(403, message, { field });
export const notFound = (message: string, field?: string) => new HttpError(404, message, { field });
