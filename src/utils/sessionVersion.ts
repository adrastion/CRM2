/**
 * Проверка версии сессии (SuperAdmin / Tester / User / Client / Parent).
 * JWT без sv считаем версией 0 (обратная совместимость до первой инвалидации).
 */
export function isSessionVersionValid(
  decoded: { sv?: number } | null | undefined,
  currentVersion: number | null | undefined
): boolean {
  const tokenSv = typeof decoded?.sv === 'number' ? decoded.sv : 0;
  const dbSv = typeof currentVersion === 'number' ? currentVersion : 0;
  return tokenSv === dbSv;
}
