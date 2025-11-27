#!/bin/bash
# Скрипт установки зависимостей для ПрофСпортСРМ на Debian

set -e

echo "🚀 Установка зависимостей для ПрофСпортСРМ"
echo "=========================================="
echo ""

# Цвета
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Проверка прав sudo
if [ "$EUID" -ne 0 ]; then 
    echo -e "${YELLOW}⚠️  Требуются права sudo. Запустите скрипт с sudo:${NC}"
    echo "sudo bash install_dependencies.sh"
    exit 1
fi

echo -e "${YELLOW}📦 Установка Node.js 18.x...${NC}"
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

echo -e "${GREEN}✅ Node.js установлен: $(node --version)${NC}"
echo -e "${GREEN}✅ npm установлен: $(npm --version)${NC}"

echo ""
echo -e "${YELLOW}📦 Установка PostgreSQL...${NC}"
apt-get update
apt-get install -y postgresql postgresql-contrib

echo -e "${GREEN}✅ PostgreSQL установлен: $(psql --version)${NC}"

echo ""
echo -e "${YELLOW}🗄️  Настройка базы данных...${NC}"

# Запуск PostgreSQL
systemctl start postgresql
systemctl enable postgresql

# Создание базы данных
sudo -u postgres psql << EOF
-- Создание базы данных
CREATE DATABASE martial_arts_crm;

-- Создание пользователя
CREATE USER crm_user WITH PASSWORD '0408';

-- Выдача прав
GRANT ALL PRIVILEGES ON DATABASE martial_arts_crm TO crm_user;

-- Подключение к базе и выдача прав на схему
\c martial_arts_crm
GRANT ALL ON SCHEMA public TO crm_user;
\q
EOF

echo -e "${GREEN}✅ База данных настроена${NC}"

echo ""
echo -e "${GREEN}=========================================="
echo "✅ Все зависимости установлены!"
echo "==========================================${NC}"
echo ""
echo "Следующие шаги:"
echo "1. cd /home/bes/CRM2"
echo "2. npm install"
echo "3. cd client && npm install && cd .."
echo "4. npx prisma generate"
echo "5. npx prisma migrate deploy"
echo "6. npm run dev"

