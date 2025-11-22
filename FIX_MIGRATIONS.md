# 🔧 Исправление миграций для PostgreSQL

## Проблема

Ошибка `ОШИБКА: тип "datetime" не существует` возникает потому, что:
- Старые миграции были созданы для SQLite (используют `DATETIME`)
- PostgreSQL использует `TIMESTAMP` вместо `DATETIME`

## Решение

Старые миграции уже удалены. Теперь нужно создать новые миграции для PostgreSQL.

### Шаг 1: Убедитесь, что база данных пустая

Если база данных уже существует и содержит таблицы, удалите их:

```powershell
# Подключитесь к PostgreSQL
psql -U postgres -d martial_arts_crm

# В консоли PostgreSQL выполните:
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
\q
```

### Шаг 2: Создайте новые миграции

```powershell
# Создать новую миграцию для PostgreSQL
npx prisma migrate dev --name init_postgresql
```

Эта команда:
- Создаст новые миграции на основе текущей схемы Prisma
- Автоматически использует правильные типы данных для PostgreSQL (`TIMESTAMP` вместо `DATETIME`)
- Применит миграции к базе данных

### Шаг 3: Заполните базу данных тестовыми данными

```powershell
npx prisma db seed
```

## Альтернативное решение (если миграции не создаются)

Если возникают проблемы, можно использовать `prisma db push`:

```powershell
# Это создаст таблицы напрямую без миграций
npx prisma db push

# Затем заполните данными
npx prisma db seed
```

**Примечание:** `db push` не создает файлы миграций, но создает таблицы в базе данных.

## Проверка

После выполнения команд проверьте:

```powershell
# Откройте Prisma Studio для просмотра данных
npx prisma studio
```

Или проверьте через psql:

```powershell
psql -U postgres -d martial_arts_crm -c "\dt"
```

Должны отобразиться все таблицы проекта.

