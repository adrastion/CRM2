# Применение миграции для нормативов

## Проблема
Prisma Migrate не может создать shadow database из-за ограничений прав доступа. 

## Решение 1: Использовать `prisma db push` (быстрое решение)

```bash
# Применить схему напрямую без миграции
npx prisma db push

# Сгенерировать Prisma Client
npx prisma generate

# Пересобрать сервер
npm run build:server
```

## Решение 2: Применить SQL миграцию вручную

1. Подключитесь к базе данных:
```bash
psql -U postgres -d martial_arts_crm
```

2. Выполните SQL из файла `prisma/migrations/add_standards_manual.sql`:
```bash
\i prisma/migrations/add_standards_manual.sql
```

Или скопируйте и вставьте SQL команды напрямую в psql.

3. После применения SQL, сгенерируйте Prisma Client:
```bash
npx prisma generate
```

4. Пересоберите сервер:
```bash
npm run build:server
```

## Решение 3: Исправить права доступа для shadow database

Если хотите использовать обычные миграции, нужно дать пользователю БД права на создание базы данных:

```sql
-- Подключитесь как superuser (postgres)
psql -U postgres

-- Дайте права на создание БД
ALTER USER ваш_пользователь CREATEDB;

-- Или создайте shadow database вручную
CREATE DATABASE martial_arts_crm_shadow;
```

Затем можно использовать:
```bash
npx prisma migrate dev --name add_standards
```

## Рекомендация

Используйте **Решение 1** (`prisma db push`) - это самый быстрый способ для разработки и не требует дополнительных прав.

