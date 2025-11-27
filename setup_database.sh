#!/bin/bash
# Скрипт настройки базы данных PostgreSQL

echo "🗄️  Настройка базы данных PostgreSQL"
echo "======================================"

# Проверка прав sudo
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  Требуются права sudo. Запустите скрипт с sudo:"
    echo "sudo bash setup_database.sh"
    exit 1
fi

# Создание базы данных и пользователя
sudo -u postgres psql << EOF
-- Создание базы данных (если не существует)
SELECT 'CREATE DATABASE martial_arts_crm'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'martial_arts_crm')\gexec

-- Создание пользователя (если не существует)
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'crm_user') THEN
        CREATE USER crm_user WITH PASSWORD '0408';
    END IF;
END
\$\$;

-- Выдача прав на базу данных
GRANT ALL PRIVILEGES ON DATABASE martial_arts_crm TO crm_user;

-- Подключение к базе и выдача прав на схему
\c martial_arts_crm
GRANT ALL ON SCHEMA public TO crm_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO crm_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO crm_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO crm_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO crm_user;
\q
EOF

if [ $? -eq 0 ]; then
    echo "✅ База данных настроена успешно!"
    echo ""
    echo "Теперь можно применить миграции:"
    echo "npx prisma migrate deploy"
else
    echo "❌ Ошибка при настройке базы данных"
    exit 1
fi

