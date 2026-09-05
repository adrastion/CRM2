#!/bin/bash
# Быстрый запуск проекта (после установки npm и настройки PostgreSQL)

set -e

echo "🚀 Быстрый запуск ПРОФСПОРТСРМ"
echo "================================"

cd /home/bes/CRM2

# Проверка npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm не установлен. Установите: sudo apt install -y npm"
    exit 1
fi

# Проверка .env
if [ ! -f ".env" ]; then
    echo "📝 Создание .env файла..."
    cp env.example .env
fi

# Установка зависимостей backend
if [ ! -d "node_modules" ]; then
    echo "📦 Установка зависимостей backend..."
    npm install
fi

# Установка зависимостей frontend
if [ ! -d "client/node_modules" ]; then
    echo "📦 Установка зависимостей frontend..."
    cd client
    npm install
    cd ..
fi

# Генерация Prisma клиента
echo "🔧 Генерация Prisma клиента..."
npx prisma generate

# Применение миграций
echo "🗄️  Применение миграций..."
npx prisma migrate dev --name init 2>&1 | grep -v "already applied" || true

echo ""
echo "✅ Готово! Запуск приложения..."
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:3001"
echo ""
echo "Для остановки нажмите Ctrl+C"
echo ""

# Запуск
npm run dev

