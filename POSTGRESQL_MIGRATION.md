# Миграция на PostgreSQL

## 📋 Предварительные требования

1. **Установленный PostgreSQL 13+**
   ```bash
   # Ubuntu/Debian
   sudo apt-get update
   sudo apt-get install postgresql postgresql-contrib

   # macOS
   brew install postgresql
   brew services start postgresql

   # Проверка версии
   psql --version
   ```

2. **Создание базы данных и пользователя**

   ```bash
   # Войти в PostgreSQL
   sudo -u postgres psql
   # Или на macOS:
   psql postgres
   ```

   ```sql
   -- Создать базу данных
   CREATE DATABASE martial_arts_crm;

   -- Создать пользователя
   CREATE USER crm_user WITH PASSWORD 'your_secure_password_here';

   -- Выдать права
   GRANT ALL PRIVILEGES ON DATABASE martial_arts_crm TO crm_user;

   -- Подключиться к базе данных
   \c martial_arts_crm

   -- Выдать права на схему
   GRANT ALL ON SCHEMA public TO crm_user;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO crm_user;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO crm_user;

   -- Выйти
   \q
   ```

## 🔄 Шаги миграции

### Шаг 1: Обновить переменные окружения

Обновите файл `.env`:

```env
# Изменить DATABASE_URL на PostgreSQL
DATABASE_URL="postgresql://crm_user:your_secure_password_here@localhost:5432/martial_arts_crm?schema=public"

# Остальные настройки остаются без изменений
JWT_SECRET="your-super-secret-jwt-key-here"
JWT_EXPIRES_IN="7d"
PORT=3001
NODE_ENV="development"
CORS_ORIGIN="http://localhost:3000"
```

### Шаг 2: Сгенерировать Prisma Client

```bash
# Удалить старый Prisma Client (если был для SQLite)
rm -rf node_modules/.prisma

# Сгенерировать новый Prisma Client для PostgreSQL
npx prisma generate
```

### Шаг 3: Создать новую миграцию

```bash
# Создать миграцию для PostgreSQL
npx prisma migrate dev --name init_postgresql
```

Это создаст все таблицы в PostgreSQL базе данных.

### Шаг 4: Заполнить базу данных тестовыми данными (опционально)

```bash
npx prisma db seed
```

### Шаг 5: Проверить подключение

```bash
# Открыть Prisma Studio для проверки
npx prisma studio
```

Или проверить через psql:

```bash
psql -U crm_user -d martial_arts_crm -c "\dt"
```

## 🔍 Проверка миграции

### Проверить, что все таблицы созданы:

```sql
-- Подключиться к базе
psql -U crm_user -d martial_arts_crm

-- Показать все таблицы
\dt

-- Должны быть таблицы:
-- - tenants
-- - users
-- - clients
-- - trainers
-- - branches
-- - groups
-- - group_memberships
-- - memberships
-- - payments
-- - trainings
-- - attendances
-- - achievements
-- - trainer_branches
```

### Проверить работу приложения:

```bash
# Запустить сервер
npm run dev:server

# Проверить health endpoint
curl http://localhost:3001/health
```

## ⚠️ Важные замечания

### 1. Резервное копирование данных (если есть данные в SQLite)

Если у вас уже есть данные в SQLite, которые нужно перенести:

```bash
# Экспорт данных из SQLite (если нужно)
# Используйте инструменты для миграции данных или создайте скрипт
```

### 2. Connection Pooling

PostgreSQL поддерживает connection pooling. Prisma автоматически использует пул соединений.

Для настройки пула в `DATABASE_URL`:
```
postgresql://user:password@localhost:5432/dbname?connection_limit=20&pool_timeout=20
```

### 3. Индексы

Все индексы из схемы Prisma будут автоматически созданы при миграции.

### 4. Различия SQLite vs PostgreSQL

- ✅ **Case-insensitive поиск**: Теперь можно использовать `mode: 'insensitive'` в запросах
- ✅ **Типы данных**: PostgreSQL поддерживает больше типов данных
- ✅ **Производительность**: Значительно лучше для многопользовательских систем
- ✅ **Транзакции**: Полная поддержка ACID

## 🚀 После миграции

### Оптимизация для production:

1. **Настроить connection pooling:**
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/dbname?connection_limit=20&pool_timeout=20"
   ```

2. **Использовать единый экземпляр Prisma Client:**
   - Используйте `src/lib/prisma.ts` вместо создания нового экземпляра в каждом файле

3. **Настроить резервное копирование:**
   ```bash
   # Пример cron job для бэкапа
   0 2 * * * pg_dump -U crm_user martial_arts_crm > /backup/crm_$(date +\%Y\%m\%d).sql
   ```

## 📊 Производительность

После миграции на PostgreSQL:
- ✅ Поддержка 60+ одновременных пользователей
- ✅ Нет блокировок при записи
- ✅ Лучшая производительность запросов
- ✅ Возможность горизонтального масштабирования

## 🔧 Устранение проблем

### Ошибка подключения:

```bash
# Проверить, запущен ли PostgreSQL
sudo systemctl status postgresql  # Linux
brew services list | grep postgresql  # macOS

# Проверить права доступа
psql -U crm_user -d martial_arts_crm
```

### Ошибка миграции:

```bash
# Сбросить миграции (ОСТОРОЖНО: удалит все данные!)
npx prisma migrate reset

# Или создать новую миграцию
npx prisma migrate dev
```

### Проблемы с правами:

```sql
-- Войти как суперпользователь
sudo -u postgres psql

-- Выдать права
GRANT ALL PRIVILEGES ON DATABASE martial_arts_crm TO crm_user;
\c martial_arts_crm
GRANT ALL ON SCHEMA public TO crm_user;
```

## ✅ Чеклист миграции

- [ ] PostgreSQL установлен и запущен
- [ ] База данных и пользователь созданы
- [ ] `.env` обновлен с PostgreSQL URL
- [ ] `prisma/schema.prisma` обновлен (provider = "postgresql")
- [ ] Prisma Client сгенерирован (`npx prisma generate`)
- [ ] Миграции применены (`npx prisma migrate dev`)
- [ ] Тестовые данные загружены (опционально)
- [ ] Приложение запущено и работает
- [ ] Проверена работа основных функций

## 📝 Примечания

- Старый файл `prisma/dev.db` (SQLite) можно удалить после успешной миграции
- Все миграции будут храниться в `prisma/migrations/`
- Для production используйте `npx prisma migrate deploy` вместо `migrate dev`

