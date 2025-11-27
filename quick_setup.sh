#!/bin/bash
# Быстрая установка и запуск проекта

echo "🚀 Быстрая установка и запуск ПрофСпортСРМ"
echo "=========================================="

# Проверка Node.js
if ! command -v nodejs &> /dev/null && ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен. Установите зависимости:"
    echo "   sudo bash install_dependencies.sh"
    exit 1
fi

# Проверка npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm не установлен. Установите npm:"
    echo "   sudo bash install_npm.sh"
    exit 1
fi

# Проверка PostgreSQL
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL не установлен. Установите зависимости:"
    echo "   sudo bash install_dependencies.sh"
    exit 1
fi

echo "✅ Все зависимости установлены"
echo ""

# Установка зависимостей backend
if [ ! -d "node_modules" ]; then
    echo "📦 Установка зависимостей backend..."
    npm install
else
    echo "✅ Зависимости backend уже установлены"
fi

# Установка зависимостей frontend
if [ ! -d "client/node_modules" ]; then
    echo "📦 Установка зависимостей frontend..."
    cd client
    npm install
    cd ..
else
    echo "✅ Зависимости frontend уже установлены"
fi

# Генерация Prisma клиента
echo "🔧 Генерация Prisma клиента..."
npx prisma generate

# Применение миграций
echo "🗄️  Применение миграций..."
npx prisma migrate deploy || npx prisma migrate dev

echo ""
echo "✅ Всё готово! Запускаю проект..."
echo ""
echo "Backend: http://localhost:3001"
echo "Frontend: http://localhost:3000"
echo ""
echo "Для остановки нажмите Ctrl+C"
echo ""

# Запуск проекта
npm run dev
