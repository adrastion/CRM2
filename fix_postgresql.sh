#!/bin/bash
# Скрипт для диагностики и исправления проблем с PostgreSQL

echo "🔍 Диагностика PostgreSQL"
echo "========================="
echo ""

# Цвета
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 1. Проверка установки
echo "1. Проверка установки PostgreSQL..."
if command -v psql &> /dev/null; then
    echo -e "${GREEN}✅ PostgreSQL установлен: $(psql --version)${NC}"
    PSQL_VERSION=$(psql --version | grep -oP '\d+' | head -1)
else
    echo -e "${RED}❌ PostgreSQL не установлен!${NC}"
    echo ""
    echo "Для установки выполните:"
    echo "  sudo apt update"
    echo "  sudo apt install -y postgresql postgresql-contrib"
    exit 1
fi

echo ""

# 2. Проверка службы
echo "2. Проверка службы PostgreSQL..."
if systemctl list-unit-files | grep -q postgresql; then
    echo -e "${GREEN}✅ Служба PostgreSQL найдена${NC}"
    
    # Найти точное имя службы
    SERVICE_NAME=$(systemctl list-units --type=service --all | grep postgresql | head -1 | awk '{print $1}')
    
    if [ -n "$SERVICE_NAME" ]; then
        echo "   Имя службы: $SERVICE_NAME"
        
        # Проверить статус
        if systemctl is-active --quiet $SERVICE_NAME 2>/dev/null; then
            echo -e "${GREEN}✅ Служба запущена${NC}"
        else
            echo -e "${YELLOW}⚠️  Служба не запущена. Попытка запуска...${NC}"
            sudo systemctl start $SERVICE_NAME
            sleep 2
            
            if systemctl is-active --quiet $SERVICE_NAME 2>/dev/null; then
                echo -e "${GREEN}✅ Служба успешно запущена${NC}"
                sudo systemctl enable $SERVICE_NAME
            else
                echo -e "${RED}❌ Не удалось запустить службу${NC}"
                echo "   Попробуйте вручную: sudo systemctl start $SERVICE_NAME"
                echo "   Или посмотрите логи: sudo journalctl -u $SERVICE_NAME -n 50"
            fi
        fi
    else
        echo -e "${YELLOW}⚠️  Служба не найдена в списке активных${NC}"
    fi
else
    echo -e "${RED}❌ Служба PostgreSQL не найдена${NC}"
fi

echo ""

# 3. Проверка порта
echo "3. Проверка порта 5432..."
if sudo netstat -tuln 2>/dev/null | grep -q ":5432 " || sudo ss -tuln 2>/dev/null | grep -q ":5432 "; then
    echo -e "${GREEN}✅ PostgreSQL слушает на порту 5432${NC}"
else
    echo -e "${YELLOW}⚠️  PostgreSQL не слушает на порту 5432${NC}"
fi

echo ""

# 4. Проверка подключения
echo "4. Проверка подключения..."
if sudo -u postgres psql -c "SELECT version();" &>/dev/null; then
    echo -e "${GREEN}✅ Подключение к PostgreSQL работает!${NC}"
    echo ""
    echo "Вы можете теперь выполнить:"
    echo "  sudo -u postgres psql"
else
    echo -e "${RED}❌ Не удалось подключиться к PostgreSQL${NC}"
    echo ""
    echo "Попробуйте:"
    echo "  1. Запустить службу: sudo systemctl start postgresql"
    echo "  2. Или найти правильное имя: systemctl list-units --type=service | grep postgres"
    echo "  3. Проверить логи: sudo journalctl -u postgresql -n 50"
fi

echo ""
