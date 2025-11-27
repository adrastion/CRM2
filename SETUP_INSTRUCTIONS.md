# 🔧 Инструкция по установке и запуску

## Текущая ситуация

✅ **Node.js установлен** (v20.19.2)  
❌ **npm не установлен**  
❓ **PostgreSQL** (нужно проверить)

## Шаг 1: Установка npm

Установите npm, выполнив:

```bash
sudo bash install_npm.sh
```

Или вручную:

```bash
sudo apt-get update
sudo apt-get install -y npm
```

## Шаг 2: Проверка PostgreSQL

Проверьте, установлен ли PostgreSQL:

```bash
psql --version
```

Если не установлен, установите:

```bash
sudo bash install_dependencies.sh
```

Или установите только PostgreSQL:

```bash
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

## Шаг 3: Настройка базы данных

После установки PostgreSQL создайте базу данных:

```bash
sudo -u postgres psql << EOF
CREATE DATABASE martial_arts_crm;
CREATE USER crm_user WITH PASSWORD '0408';
GRANT ALL PRIVILEGES ON DATABASE martial_arts_crm TO crm_user;
\c martial_arts_crm
GRANT ALL ON SCHEMA public TO crm_user;
\q
EOF
```

## Шаг 4: Запуск проекта

После установки всех зависимостей:

```bash
bash quick_setup.sh
```

Или вручную:

```bash
# 1. Установка зависимостей backend
npm install

# 2. Установка зависимостей frontend
cd client
npm install
cd ..

# 3. Генерация Prisma клиента
npx prisma generate

# 4. Применение миграций
npx prisma migrate deploy

# 5. Запуск проекта
npm run dev
```

## Быстрый старт (если всё уже установлено)

```bash
sudo bash install_npm.sh          # Только npm
bash quick_setup.sh                # Весь проект
```

