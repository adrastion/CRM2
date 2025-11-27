# 🚀 Инструкция по запуску проекта

## ⚠️ Требования

Для запуска проекта необходимо установить:

1. **Node.js 18+** и **npm**
2. **PostgreSQL 13+**

## 📦 Установка зависимостей

### 1. Установка Node.js на Debian

```bash
# Обновление пакетов
sudo apt update

# Установка Node.js 18.x через NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Проверка установки
node --version  # Должно быть v18.x.x или выше
npm --version   # Должна быть версия npm
```

Или альтернативно через nvm:

```bash
# Установка nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

# Установка Node.js 18
nvm install 18
nvm use 18

# Проверка
node --version
npm --version
```

### 2. Установка PostgreSQL

```bash
# Установка PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Проверка версии
psql --version

# Запуск службы PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 3. Настройка базы данных

```bash
# Переключение на пользователя postgres
sudo -u postgres psql

# В psql выполните:
CREATE DATABASE martial_arts_crm;
CREATE USER crm_user WITH PASSWORD '0408';
GRANT ALL PRIVILEGES ON DATABASE martial_arts_crm TO crm_user;
\c martial_arts_crm
GRANT ALL ON SCHEMA public TO crm_user;
\q
```

### 4. Настройка .env файла

Файл `.env` уже создан. Убедитесь, что он содержит правильные настройки:

- `DATABASE_URL` - путь к базе данных
- `YOOKASSA_SHOP_ID` и `YOOKASSA_SECRET_KEY` - уже настроены

## 🚀 Запуск проекта

После установки всех зависимостей:

```bash
# 1. Установка зависимостей backend
cd /home/bes/CRM2
npm install

# 2. Установка зависимостей frontend
cd client
npm install
cd ..

# 3. Генерация Prisma клиента
npx prisma generate

# 4. Применение миграций базы данных
npx prisma migrate deploy

# 5. Заполнение тестовыми данными (опционально)
npx prisma db seed

# 6. Запуск проекта
npm run dev
```

После запуска:
- **Backend**: http://localhost:3001
- **Frontend**: http://localhost:3000

## 🔑 Тестовые аккаунты

После запуска `npx prisma db seed`:

- **Owner**: owner@dragonacademy.com / password123
- **Admin**: admin@dragonacademy.com / password123
- **Trainer**: trainer1@dragonacademy.com / password123

## ⚡ Быстрый запуск (если всё установлено)

```bash
cd /home/bes/CRM2
npm install
cd client && npm install && cd ..
npx prisma generate
npx prisma migrate deploy
npm run dev
```

