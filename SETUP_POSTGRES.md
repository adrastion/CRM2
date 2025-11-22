# 🔧 Настройка PostgreSQL для проекта

## Проблема: Ошибка аутентификации

Если вы видите ошибку:
```
Error: P1000: Authentication failed against database server at `localhost`
```

Это означает, что пароль в файле `.env` не совпадает с паролем пользователя `postgres` в PostgreSQL.

## Решение проблемы

### Вариант 1: Узнать/вспомнить пароль PostgreSQL

1. **Откройте pgAdmin 4** (должен быть установлен вместе с PostgreSQL)
2. При первом запуске вас попросят ввести пароль для пользователя `postgres`
3. Это и есть пароль, который нужно указать в `.env`

### Вариант 2: Сбросить пароль PostgreSQL

Если вы забыли пароль, можно его сбросить:

**Шаг 1:** Остановите службу PostgreSQL
```powershell
Stop-Service postgresql-x64-13  # Замените на вашу версию
```

**Шаг 2:** Найдите файл `pg_hba.conf`
Обычно находится в: `C:\Program Files\PostgreSQL\13\data\pg_hba.conf`

**Шаг 3:** Откройте файл `pg_hba.conf` в текстовом редакторе (от имени администратора)

**Шаг 4:** Найдите строку:
```
host    all             all             127.0.0.1/32            md5
```

И замените `md5` на `trust`:
```
host    all             all             127.0.0.1/32            trust
```

**Шаг 5:** Сохраните файл и запустите PostgreSQL:
```powershell
Start-Service postgresql-x64-13
```

**Шаг 6:** Подключитесь и установите новый пароль:
```powershell
psql -U postgres
```

В консоли PostgreSQL выполните:
```sql
ALTER USER postgres WITH PASSWORD 'новый_пароль';
\q
```

**Шаг 7:** Верните `md5` обратно в `pg_hba.conf` и перезапустите службу

### Вариант 3: Создать нового пользователя (рекомендуется)

```powershell
# Подключитесь к PostgreSQL (если знаете пароль postgres)
psql -U postgres
```

В консоли PostgreSQL:
```sql
-- Создать нового пользователя
CREATE USER crm_user WITH PASSWORD 'ваш_безопасный_пароль';

-- Создать базу данных
CREATE DATABASE martial_arts_crm;

-- Выдать права
GRANT ALL PRIVILEGES ON DATABASE martial_arts_crm TO crm_user;

-- Подключиться к базе данных
\c martial_arts_crm

-- Выдать права на схему
GRANT ALL ON SCHEMA public TO crm_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO crm_user;

-- Выйти
\q
```

Затем обновите `.env`:
```env
DATABASE_URL="postgresql://crm_user:ваш_безопасный_пароль@localhost:5432/martial_arts_crm?schema=public"
```

## Проверка подключения

После настройки пароля проверьте подключение:

```powershell
# Проверка подключения с паролем из .env
npx prisma db pull
```

Или напрямую через psql:
```powershell
psql -U postgres -d martial_arts_crm
```

## Создание базы данных

Если база данных еще не создана:

```powershell
psql -U postgres
```

В консоли PostgreSQL:
```sql
CREATE DATABASE martial_arts_crm;
\q
```

## Быстрая проверка

Выполните эту команду для проверки всех настроек:

```powershell
# 1. Проверить, что PostgreSQL запущен
Get-Service -Name postgresql*

# 2. Проверить подключение
psql -U postgres -c "SELECT version();"

# 3. Проверить существование базы данных
psql -U postgres -c "\l" | Select-String "martial_arts_crm"
```

## После настройки

Когда все настроено, выполните:

```powershell
npx prisma generate
npx prisma migrate dev
npx prisma db seed
```

