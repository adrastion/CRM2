# Инструкция по запуску проекта на Kali Linux

## Шаг 1: Установка npm (требует sudo)

Выполните в терминале:
```bash
sudo apt update
sudo apt install -y npm
```

Или если npm уже установлен через другой способ, проверьте:
```bash
npm --version
```

## Шаг 2: Настройка PostgreSQL

### Проверка статуса PostgreSQL:
```bash
sudo systemctl status postgresql
```

### Если PostgreSQL не запущен:
```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Создание базы данных:
```bash
sudo -u postgres psql
```

В консоли PostgreSQL выполните:
```sql
CREATE DATABASE martial_arts_crm;
CREATE USER crm_user WITH PASSWORD '0408';
GRANT ALL PRIVILEGES ON DATABASE martial_arts_crm TO crm_user;
\c martial_arts_crm
GRANT ALL ON SCHEMA public TO crm_user;
\q
```

## Шаг 3: Установка зависимостей

```bash
cd /home/bes/CRM2

# Backend зависимости
npm install

# Frontend зависимости
cd client
npm install
cd ..
```

## Шаг 4: Настройка базы данных

```bash
# Генерация Prisma клиента
npx prisma generate

# Применение миграций
npx prisma migrate dev --name init

# Заполнение тестовыми данными (опционально)
npx prisma db seed
```

## Шаг 5: Запуск проекта

```bash
# Запуск в режиме разработки (backend + frontend одновременно)
npm run dev
```

Или по отдельности:
```bash
# Terminal 1 - Backend
npm run dev:server

# Terminal 2 - Frontend
npm run dev:client
```

## Доступ к приложению

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

## Тестовые аккаунты

После выполнения `npx prisma db seed`:

### Владелец:
- Email: `owner@dragonacademy.com`
- Пароль: `password123`

### Администратор:
- Email: `admin@dragonacademy.com`
- Пароль: `password123`

### Тренер:
- Email: `trainer1@dragonacademy.com`
- Пароль: `password123`

## Быстрый запуск (после установки npm)

Если npm уже установлен, можно использовать автоматический скрипт:
```bash
./setup_kali.sh
```

## Решение проблем

### Ошибка подключения к PostgreSQL:
- Проверьте, что PostgreSQL запущен: `sudo systemctl status postgresql`
- Проверьте пароль в `.env` файле
- Убедитесь, что база данных создана

### Ошибка портов заняты:
- Backend использует порт 3001
- Frontend использует порт 3000
- Проверьте: `lsof -i :3000` и `lsof -i :3001`

### Ошибка зависимостей:
- Удалите `node_modules` и `package-lock.json`
- Выполните `npm install` заново

