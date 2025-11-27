#!/bin/bash
# Скрипт для настройки подключения к базе данных

echo "🔧 Настройка подключения к базе данных"
echo "========================================"

cd /home/bes/CRM2

# Создаем резервную копию .env
if [ -f .env ]; then
    cp .env .env.backup
    echo "✅ Создана резервная копия .env"
fi

# Обновляем DATABASE_URL для использования crm_user
sed -i 's|DATABASE_URL="postgresql://postgres:0408@localhost:5432/martial_arts_crm?schema=public"|DATABASE_URL="postgresql://crm_user:0408@localhost:5432/martial_arts_crm?schema=public"|' .env

echo "✅ Обновлен DATABASE_URL в .env для использования crm_user"
echo ""
echo "Новый DATABASE_URL:"
grep DATABASE_URL .env
echo ""
echo "Теперь можно применить миграции:"
echo "npx prisma migrate deploy"

