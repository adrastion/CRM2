 # Анализ производительности для 60 одновременных пользователей

## ⚠️ Текущее состояние

### Проблемы с текущей конфигурацией:

1. **SQLite - критическая проблема**
   - SQLite блокирует всю базу данных при записи
   - Не поддерживает реальный connection pooling
   - Максимум ~10-20 одновременных пользователей с записью
   - При 60 пользователях будут частые блокировки и таймауты

2. **Множественные экземпляры PrismaClient**
   - Создается новый `PrismaClient` в каждом контроллере/сервисе
   - Это не критично, но не оптимально
   - Prisma Client имеет встроенный connection pooling, но для SQLite это не работает

3. **Rate Limiting**
   - Текущий лимит: 100 запросов за 15 минут на IP
   - Для активных пользователей может быть недостаточно
   - 60 пользователей × активность = может быть превышен лимит

4. **Отсутствие кэширования**
   - Каждый запрос идет в базу данных
   - Нет кэширования часто запрашиваемых данных

## ✅ Решения для поддержки 60 пользователей

### 1. Миграция на PostgreSQL (ОБЯЗАТЕЛЬНО)

**Почему PostgreSQL:**
- Поддерживает сотни одновременных подключений
- Реальный connection pooling
- Лучшая производительность для многопользовательских систем
- Горизонтальное масштабирование

**Шаги миграции:**

1. Обновить `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

2. Обновить `.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/martial_arts_crm?schema=public"
```

3. Создать базу данных:
```bash
createdb martial_arts_crm
```

4. Применить миграции:
```bash
npx prisma migrate deploy
```

### 2. Оптимизация Prisma Client

**Создать единый экземпляр PrismaClient:**

Создать файл `src/lib/prisma.ts`:
```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

**Настроить connection pooling:**
```typescript
new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + "?connection_limit=20&pool_timeout=20"
    }
  }
})
```

### 3. Настройка Connection Pooling для PostgreSQL

**Использовать PgBouncer или встроенный пул Prisma:**

В `DATABASE_URL`:
```
postgresql://user:password@localhost:5432/dbname?connection_limit=20&pool_timeout=20
```

**Рекомендуемые настройки для 60 пользователей:**
- `connection_limit`: 20-30 (Prisma будет переиспользовать соединения)
- `pool_timeout`: 20 секунд

### 4. Оптимизация Rate Limiting

**Текущие настройки:**
```typescript
max: 100 requests per 15 minutes
```

**Рекомендуемые для 60 пользователей:**
```typescript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Увеличить до 200 запросов
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Разные лимиты для разных эндпоинтов
  skip: (req) => {
    // Не ограничивать health check
    return req.path === '/health';
  }
});
```

### 5. Добавить кэширование (опционально)

**Для часто запрашиваемых данных:**
- Использовать Redis или in-memory cache
- Кэшировать: список филиалов, групп, тренеров
- TTL: 5-10 минут

### 6. Оптимизация запросов

**Уже реализовано:**
- ✅ Использование `Promise.all` для параллельных запросов
- ✅ Пагинация для больших списков
- ✅ Индексы в базе данных (через Prisma)

**Дополнительно:**
- Использовать `select` для получения только нужных полей
- Избегать N+1 запросов (уже используется `include`)

### 7. Настройка сервера

**Использовать PM2 с кластеризацией:**
```bash
pm2 start dist/server.js -i max
```

**Или настроить в `ecosystem.config.js`:**
```javascript
module.exports = {
  apps: [{
    name: 'crm-api',
    script: './dist/server.js',
    instances: 2, // 2 процесса для балансировки
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  }]
}
```

## 📊 Ожидаемая производительность

### С SQLite (текущая конфигурация):
- ❌ **НЕ РЕКОМЕНДУЕТСЯ** для 60 пользователей
- Максимум: 10-20 активных пользователей
- Проблемы: блокировки, таймауты, медленные запросы

### С PostgreSQL (после миграции):
- ✅ **РЕКОМЕНДУЕТСЯ** для 60 пользователей
- Поддержка: 60+ одновременных пользователей
- Производительность: хорошая
- Масштабируемость: до 200+ пользователей с оптимизацией

### С PostgreSQL + оптимизации:
- ✅ **ОПТИМАЛЬНО** для 60 пользователей
- Поддержка: 100+ одновременных пользователей
- Производительность: отличная
- Масштабируемость: до 500+ пользователей

## 🚀 Быстрая миграция на PostgreSQL

### Шаг 1: Установка PostgreSQL
```bash
# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# macOS
brew install postgresql
brew services start postgresql
```

### Шаг 2: Создание базы данных
```bash
sudo -u postgres psql
CREATE DATABASE martial_arts_crm;
CREATE USER crm_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE martial_arts_crm TO crm_user;
\q
```

### Шаг 3: Обновление конфигурации
```bash
# Обновить prisma/schema.prisma
# Изменить provider с "sqlite" на "postgresql"

# Обновить .env
DATABASE_URL="postgresql://crm_user:your_password@localhost:5432/martial_arts_crm?schema=public"
```

### Шаг 4: Миграция данных
```bash
# Сгенерировать Prisma Client
npx prisma generate

# Применить миграции
npx prisma migrate deploy

# Если нужно перенести данные из SQLite:
# Использовать инструменты миграции или скрипт
```

## 📈 Мониторинг производительности

### Рекомендуемые метрики:
- Время ответа API (должно быть < 200ms для 95% запросов)
- Количество активных подключений к БД
- Использование памяти и CPU
- Количество запросов в секунду

### Инструменты:
- PM2 monitoring: `pm2 monit`
- PostgreSQL monitoring: `pg_stat_activity`
- Application logs: Morgan + Winston

## ✅ Итоговые рекомендации

**Для поддержки 60 одновременных пользователей:**

1. ✅ **ОБЯЗАТЕЛЬНО**: Мигрировать на PostgreSQL
2. ✅ **РЕКОМЕНДУЕТСЯ**: Оптимизировать Prisma Client (единый экземпляр)
3. ✅ **РЕКОМЕНДУЕТСЯ**: Настроить connection pooling
4. ✅ **РЕКОМЕНДУЕТСЯ**: Увеличить rate limiting
5. ⚠️ **ОПЦИОНАЛЬНО**: Добавить кэширование (Redis)
6. ⚠️ **ОПЦИОНАЛЬНО**: Использовать PM2 с кластеризацией

**Минимальные требования сервера для 60 пользователей:**
- CPU: 2 ядра
- RAM: 2-4 GB
- Диск: 20 GB SSD
- PostgreSQL: 1 GB RAM для БД

**Рекомендуемые требования:**
- CPU: 4 ядра
- RAM: 4-8 GB
- Диск: 50 GB SSD
- PostgreSQL: 2 GB RAM для БД

