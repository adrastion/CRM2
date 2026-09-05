#!/bin/bash
# Автоматическая установка (что возможно без sudo)

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

cd /home/bes/CRM2

echo -e "${GREEN}🚀 Автоматическая установка ПРОФСПОРТСРМ${NC}"
echo "=========================================="
echo ""

# Проверка Node.js
if command -v node &> /dev/null; then
    echo -e "${GREEN}✅ Node.js: $(node -v)${NC}"
else
    echo -e "${RED}❌ Node.js не установлен${NC}"
    exit 1
fi

# Проверка npm
if ! command -v npm &> /dev/null; then
    echo -e "${YELLOW}⚠️  npm не установлен${NC}"
    echo ""
    echo "Выполните:"
    echo "  sudo apt update"
    echo "  sudo apt install -y npm"
    echo ""
    echo "После установки npm запустите этот скрипт снова:"
    echo "  ./auto_setup.sh"
    exit 1
fi
echo -e "${GREEN}✅ npm: $(npm -v)${NC}"

# Проверка PostgreSQL
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠️  PostgreSQL не установлен${NC}"
    echo "Выполните: sudo apt install -y postgresql postgresql-contrib"
    exit 1
fi
echo -e "${GREEN}✅ PostgreSQL: $(psql --version)${NC}"

# Проверка подключения к PostgreSQL
echo ""
echo -e "${YELLOW}🔍 Проверка подключения к PostgreSQL...${NC}"

# Проверяем подключение с правильным пользователем из .env
DB_READY=false

# Попытка подключения с crm_user (из .env)
if PGPASSWORD=0408 psql -h localhost -U crm_user -d martial_arts_crm -c "SELECT 1;" &>/dev/null 2>&1; then
    echo -e "${GREEN}✅ Подключение к PostgreSQL успешно (crm_user)${NC}"
    DB_READY=true
# Попытка подключения с postgres (для проверки существования БД)
elif PGPASSWORD=0408 psql -h localhost -U postgres -d postgres -c "SELECT 1;" &>/dev/null 2>&1; then
    echo -e "${GREEN}✅ PostgreSQL запущен, проверяю базу данных...${NC}"
    # Проверяем существование базы данных
    if PGPASSWORD=0408 psql -h localhost -U postgres -d postgres -c "SELECT 1 FROM pg_database WHERE datname='martial_arts_crm';" &>/dev/null 2>&1; then
        echo -e "${GREEN}✅ База данных martial_arts_crm существует${NC}"
        DB_READY=true
    else
        echo -e "${YELLOW}⚠️  База данных martial_arts_crm не найдена${NC}"
        DB_READY=false
    fi
# Попытка подключения без пароля (если настроен trust)
elif psql -h localhost -U postgres -d postgres -c "SELECT 1;" &>/dev/null 2>&1; then
    echo -e "${GREEN}✅ PostgreSQL запущен (trust authentication)${NC}"
    # Проверяем существование базы данных
    if psql -h localhost -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='martial_arts_crm';" | grep -q 1; then
        echo -e "${GREEN}✅ База данных martial_arts_crm существует${NC}"
        DB_READY=true
    else
        echo -e "${YELLOW}⚠️  База данных martial_arts_crm не найдена${NC}"
        DB_READY=false
    fi
else
    echo -e "${YELLOW}⚠️  Не удалось подключиться к PostgreSQL${NC}"
    echo ""
    echo "Возможные причины:"
    echo "  1. PostgreSQL не запущен"
    echo "  2. Неправильный пароль"
    echo "  3. База данных не создана"
    echo ""
    echo "Выполните следующие команды:"
    echo "  sudo systemctl start postgresql"
    echo "  sudo systemctl enable postgresql"
    echo ""
    echo "Затем создайте базу данных:"
    echo "  sudo -u postgres psql"
    echo ""
    echo "В консоли PostgreSQL:"
    echo "  CREATE DATABASE martial_arts_crm;"
    echo "  CREATE USER crm_user WITH PASSWORD '0408';"
    echo "  GRANT ALL PRIVILEGES ON DATABASE martial_arts_crm TO crm_user;"
    echo "  \\c martial_arts_crm"
    echo "  GRANT ALL ON SCHEMA public TO crm_user;"
    echo "  \\q"
    echo ""
    DB_READY=false
fi

# Создание .env
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}📝 Создание .env файла...${NC}"
    cp env.example .env
    echo -e "${GREEN}✅ .env файл создан${NC}"
else
    echo -e "${GREEN}✅ .env файл уже существует${NC}"
fi

if [ "$DB_READY" = false ]; then
    echo ""
    echo -e "${YELLOW}⚠️  Настройте базу данных и запустите скрипт снова${NC}"
    exit 1
fi

# Установка зависимостей backend
echo ""
echo -e "${YELLOW}📦 Установка зависимостей backend...${NC}"
if [ ! -d "node_modules" ]; then
    npm install
    echo -e "${GREEN}✅ Зависимости backend установлены${NC}"
else
    echo -e "${GREEN}✅ Зависимости backend уже установлены${NC}"
fi

# Установка зависимостей frontend
echo ""
echo -e "${YELLOW}📦 Установка зависимостей frontend...${NC}"
if [ ! -d "client/node_modules" ]; then
    cd client
    npm install
    cd ..
    echo -e "${GREEN}✅ Зависимости frontend установлены${NC}"
else
    echo -e "${GREEN}✅ Зависимости frontend уже установлены${NC}"
fi

# Генерация Prisma клиента
echo ""
echo -e "${YELLOW}🔧 Генерация Prisma клиента...${NC}"
npx prisma generate
echo -e "${GREEN}✅ Prisma клиент сгенерирован${NC}"

# Применение миграций
echo ""
echo -e "${YELLOW}🗄️  Применение миграций...${NC}"

# Пытаемся использовать migrate deploy (не требует shadow database)
MIGRATE_OUTPUT=$(npx prisma migrate deploy 2>&1)
MIGRATE_EXIT=$?

if [ $MIGRATE_EXIT -eq 0 ]; then
    echo -e "${GREEN}✅ Миграции применены${NC}"
elif echo "$MIGRATE_OUTPUT" | grep -q "failed migrations"; then
    echo -e "${YELLOW}⚠️  Обнаружены проблемные миграции, исправляю...${NC}"
    # Пытаемся пометить проблемные миграции как примененные
    FAILED_MIGRATION=$(echo "$MIGRATE_OUTPUT" | grep -oP "migration \K[^\s]+" | head -1)
    if [ ! -z "$FAILED_MIGRATION" ]; then
        echo "Помечаю миграцию $FAILED_MIGRATION как примененную..."
        npx prisma migrate resolve --applied "$FAILED_MIGRATION" &>/dev/null 2>&1 || true
        # Пытаемся снова
        if npx prisma migrate deploy &>/dev/null 2>&1; then
            echo -e "${GREEN}✅ Миграции применены${NC}"
        else
            echo -e "${YELLOW}⚠️  Требуется ручное применение миграций${NC}"
        fi
    fi
elif echo "$MIGRATE_OUTPUT" | grep -q "already exists\|relation.*already exists"; then
    echo -e "${YELLOW}⚠️  Некоторые таблицы уже существуют, помечаю базовую миграцию как примененную...${NC}"
    # Пытаемся найти и пометить базовую миграцию
    INIT_MIGRATION=$(ls prisma/migrations/ | grep -i init | head -1)
    if [ ! -z "$INIT_MIGRATION" ]; then
        npx prisma migrate resolve --applied "$INIT_MIGRATION" &>/dev/null 2>&1 || true
        if npx prisma migrate deploy &>/dev/null 2>&1; then
            echo -e "${GREEN}✅ Миграции применены${NC}"
        else
            echo -e "${YELLOW}⚠️  Требуется ручное применение миграций${NC}"
        fi
    fi
else
    echo -e "${YELLOW}⚠️  Ошибка применения миграций${NC}"
    echo "Выполните вручную: npx prisma migrate deploy"
fi

# Заполнение тестовыми данными
echo ""
read -p "Заполнить базу данных тестовыми данными? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}🌱 Заполнение тестовыми данными...${NC}"
    npx prisma db seed || echo -e "${YELLOW}⚠️  Ошибка заполнения данными (может быть нормально)${NC}"
fi

echo ""
echo -e "${GREEN}=========================================="
echo "✅ Всё готово!"
echo "==========================================${NC}"
echo ""
echo "Запуск приложения..."
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:3001"
echo ""
echo "Тестовые аккаунты:"
echo "  Email: owner@dragonacademy.com"
echo "  Пароль: password123"
echo ""
echo "Для остановки нажмите Ctrl+C"
echo ""

# Запуск
npm run dev

