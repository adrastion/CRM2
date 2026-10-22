-- Локальная БД была мигрирована на Tochka-поля, а Prisma-схема всё ещё
-- ожидает YooKassa-колонки. Без них падает любой include payments.
ALTER TABLE "subscription_payments"
ADD COLUMN IF NOT EXISTS "yookassaPaymentId" TEXT;

ALTER TABLE "subscription_payments"
ADD COLUMN IF NOT EXISTS "yookassaPaymentUrl" TEXT;
