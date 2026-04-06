/** Токен для /api/support (сотрудник тенанта / маркетолог / админ промокодов). */
export function getSupportRequesterToken(): string | null {
  return (
    localStorage.getItem('token') ||
    localStorage.getItem('marketerToken') ||
    localStorage.getItem('promoCodeAdminToken') ||
    null
  );
}
