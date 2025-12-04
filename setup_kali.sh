#!/bin/bash
# Скрипт установки и запуска ПрофСпортСРМ на Kali Linux

set -e

echo "🚀 Установка и запуск ПрофСпортСРМ на Kali Linux"
echo "================================================"

# Цвета
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js не установлен${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js: $(node -v)${NC}"

# Установка npm (если не установлен)
if ! command -v npm &> /dev/null; then
    echo -e "${YELLOW}📦 Установка npm...${NC}"
    echo "Выполните вручную: sudo apt install -y npm"
    echo "Или: sudo apt install -y nodejs-npm"
    read -p "Нажмите Enter после установки npm..."
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm не установлен. Установите npm и запустите скрипт снова.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm: $(npm -v)${NC}"

# Проверка PostgreSQL
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠️  PostgreSQL не установлен${NC}"
    echo "Выполните: sudo apt install -y postgresql postgresql-contrib"
    echo "Затем: sudo systemctl start postgresql"
    echo "И: sudo systemctl enable postgresql"
    read -p "Нажмите Enter после установки PostgreSQL..."
fi

if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ PostgreSQL не установлен${NC}"
    exit 1
fi
echo -e "${GREEN}✅ PostgreSQL: $(psql --version)${NC}"

# Проверка/создание .env
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}📝 Создание .env файла...${NC}"
    cp env.example .env
    echo -e "${GREEN}✅ .env файл создан${NC}"
    echo -e "${YELLOW}⚠️  Проверьте настройки базы данных в .env файле!${NC}"
fi

# Установка зависимостей backend
echo -e "${YELLOW}📦 Установка зависимостей backend...${NC}"
if [ ! -d "node_modules" ]; then
    npm install
else
    echo "Зависимости backend уже установлены"
fi

# Установка зависимостей frontend
echo -e "${YELLOW}📦 Установка зависимостей frontend...${NC}"
if [ ! -d "client/node_modules" ]; then
    cd client
    npm install
    cd ..
else
    echo "Зависимости frontend уже установлены"
fi

# Настройка базы данных
echo -e "${YELLOW}🗄️  Настройка базы данных...${NC}"

# Проверка подключения к PostgreSQL
echo "Проверка подключения к PostgreSQL..."
if ! PGPASSWORD=0408 psql -h localhost -U postgres -d postgres -c "SELECT 1;" &>/dev/null; then
    echo -e "${YELLOW}⚠️  Не удалось подключиться к PostgreSQL${NC}"
    echo "Попытка создания базы данных..."
    
    # Создание базы данных (может потребоваться пароль)
    sudo -u postgres psql <<EOF || echo "База данных уже существует или требуется ручная настройка"
CREATE DATABASE martial_arts_crm;
CREATE USER crm_user WITH PASSWORD '0408';
GRANT ALL PRIVILEGES ON DATABASE martial_arts_crm TO crm_user;
\c martial_arts_crm
GRANT ALL ON SCHEMA public TO crm_user;
EOF
fi

# Генерация Prisma клиента
echo "Генерация Prisma клиента..."
npx prisma generate

# Применение миграций
echo "Применение миграций..."
npx prisma migrate dev --name init || echo "Миграции уже применены или требуется ручная настройка"

# Заполнение тестовыми данными (опционально)
read -p "Заполнить базу данных тестовыми данными? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Заполнение тестовыми данными..."
    npx prisma db seed || echo "Ошибка заполнения данными (может быть нормально)"
fi

echo -e "${GREEN}================================================"
echo "✅ Всё готово!"
echo "================================================${NC}"
echo ""
echo "Запуск приложения..."
echo "Backend: http://localhost:3001"
echo "Frontend: http://localhost:3000"
echo ""
echo "Для остановки нажмите Ctrl+C"
echo ""

# Запуск приложения
npm run dev

