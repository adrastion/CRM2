# 🚀 Быстрый запуск проекта

## Предварительные требования

- Node.js 18+ 
- npm или yarn
- PostgreSQL 13+ (обязательно)

## Пошаговая инструкция

### 1. Установка зависимостей

```bash
# Перейдите в корневую директорию проекта
cd /home/bes/projects/CRM

# Установите зависимости backend
npm install

# Установите зависимости frontend
cd client
npm install
cd ..
```

### 2. Настройка переменных окружения

Убедитесь, что файл `.env` существует и содержит необходимые переменные:

```bash
# Проверьте наличие .env файла
cat .env
```

Если файла нет, скопируйте из примера:
```bash
cp env.example .env
```

Минимальные настройки для работы:
```env
DATABASE_URL="postgresql://crm_user:your_password@localhost:5432/martial_arts_crm?schema=public"
JWT_SECRET="your-super-secret-jwt-key-here-change-in-production"
JWT_EXPIRES_IN="7d"
PORT=3001
NODE_ENV="development"
CORS_ORIGIN="http://localhost:3000"
```

**Примечание:** Перед настройкой убедитесь, что PostgreSQL установлен и база данных создана. См. `POSTGRESQL_MIGRATION.md` для подробных инструкций.

### 3. Настройка базы данных

```bash
# Генерация Prisma клиента
npx prisma generate

# Применение миграций (создание таблиц)
npx prisma migrate dev

# Заполнение тестовыми данными (опционально)
npx prisma db seed
```

### 4. Запуск проекта

#### Вариант 1: Запуск всего проекта одной командой (рекомендуется)

```bash
npm run dev
```

Эта команда запустит:
- Backend сервер на http://localhost:3001
- Frontend приложение на http://localhost:3000

#### Вариант 2: Запуск по отдельности

**Терминал 1 - Backend:**
```bash
npm run dev:server
```

**Терминал 2 - Frontend:**
```bash
npm run dev:client
```

### 5. Проверка работы

После запуска откройте в браузере:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001/health

## Тестовые аккаунты

После выполнения `npx prisma db seed` будут созданы следующие аккаунты:

- **Владелец:** owner@dragonacademy.com / password123
- **Администратор:** admin@dragonacademy.com / password123
- **Тренер 1:** trainer1@dragonacademy.com / password123
- **Тренер 2:** trainer2@dragonacademy.com / password123
- **Админ промокодов:** promo-admin@dragonacademy.com / password123
- **Маркетолог:** marketer@dragonacademy.com / password123
- **Медиа-партнер:** media-partner@dragonacademy.com / password123

## Полезные команды

```bash
# Остановка всех процессов
pkill -f "ts-node|react-scripts|nodemon"

# Просмотр логов Prisma
npx prisma studio  # Откроет веб-интерфейс для просмотра БД

# Сборка для production
npm run build

# Запуск production версии
npm start  # (только backend, frontend нужно собрать отдельно)
```

## Решение проблем

### Порт уже занят

```bash
# Остановите процессы на портах 3000 и 3001
lsof -ti :3001 | xargs kill -9
lsof -ti :3000 | xargs kill -9
```

### Ошибки с базой данных

```bash
# Пересоздайте базу данных (PostgreSQL)
# Сначала удалите базу данных через psql или pgAdmin
psql -U postgres -c "DROP DATABASE IF EXISTS martial_arts_crm;"
psql -U postgres -c "CREATE DATABASE martial_arts_crm;"

# Затем примените миграции заново
npx prisma migrate dev
npx prisma db seed
```

### Проблемы с зависимостями

```bash
# Очистите и переустановите зависимости
rm -rf node_modules package-lock.json
rm -rf client/node_modules client/package-lock.json
npm install
cd client && npm install && cd ..
```

## Структура проекта

```
CRM/
├── src/              # Backend код (TypeScript)
├── client/           # Frontend код (React)
├── prisma/           # Схема базы данных и миграции
├── dist/             # Скомпилированный backend код
└── .env              # Переменные окружения
```

## Дополнительная информация

Подробная документация находится в файле [README.md](README.md)

