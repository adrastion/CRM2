#!/bin/bash
# Быстрый запуск ПрофСпортСРМ на Kali Linux

set -e  # Остановить при ошибке

echo "🚀 Быстрый запуск ПрофСпортСРМ на Kali Linux"
echo "================================================"

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Проверка, что мы в правильной директории
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Ошибка: package.json не найден. Запустите скрипт из корня проекта.${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 Шаг 1: Проверка зависимостей...${NC}"

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js не установлен. Установите Node.js 18+${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Требуется Node.js 18+, установлена версия: $(node -v)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js: $(node -v)${NC}"

# Проверка npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm не установлен${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm: $(npm -v)${NC}"

# Проверка PostgreSQL
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠️  PostgreSQL не установлен. Установите PostgreSQL 13+${NC}"
    echo "Команда: sudo apt install postgresql-15 postgresql-contrib-15"
    exit 1
fi
echo -e "${GREEN}✅ PostgreSQL: $(psql --version)${NC}"

# Проверка .env файла
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  Файл .env не найден. Создаю из env.example...${NC}"
    if [ -f "env.example" ]; then
        cp env.example .env
        echo -e "${YELLOW}⚠️  Не забудьте отредактировать .env файл с правильными настройками!${NC}"
    else
        echo -e "${RED}❌ env.example не найден${NC}"
        exit 1
    fi
fi

echo -e "${YELLOW}📦 Шаг 2: Установка зависимостей...${NC}"

# Установка зависимостей backend
if [ ! -d "node_modules" ]; then
    echo "Установка зависимостей backend..."
    npm install
else
    echo "Зависимости backend уже установлены"
fi

# Установка зависимостей frontend
if [ ! -d "client/node_modules" ]; then
    echo "Установка зависимостей frontend..."
    cd client
    npm install
    cd ..
else
    echo "Зависимости frontend уже установлены"
fi

echo -e "${YELLOW}🗄️  Шаг 3: Настройка базы данных...${NC}"

# Генерация Prisma клиента
echo "Генерация Prisma клиента..."
npx prisma generate

# Применение миграций
echo "Применение миграций..."
npx prisma migrate dev --name init || echo "Миграции уже применены"

echo -e "${GREEN}✅ База данных настроена${NC}"

echo -e "${YELLOW}🚀 Шаг 4: Запуск приложения...${NC}"
echo ""
echo -e "${GREEN}================================================"
echo "✅ Всё готово! Запускаю приложение..."
echo "================================================${NC}"
echo ""
echo "Backend будет доступен на: http://localhost:3001"
echo "Frontend будет доступен на: http://localhost:3000"
echo ""
echo "Для остановки нажмите Ctrl+C"
echo ""

# Запуск приложения
npm run dev
