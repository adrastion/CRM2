#!/bin/bash
echo "🔍 Диагностика PostgreSQL..."
echo ""

# Проверка 1: Установлен ли PostgreSQL
echo "1. Проверка установки PostgreSQL:"
if dpkg -l | grep -q postgresql; then
    echo "   ✅ PostgreSQL установлен"
    dpkg -l | grep postgresql | head -5
else
    echo "   ❌ PostgreSQL НЕ установлен"
    echo ""
    echo "   Для установки выполните:"
    echo "   sudo apt update"
    echo "   sudo apt install -y postgresql postgresql-contrib"
    exit 1
fi

echo ""

# Проверка 2: Запущена ли служба
echo "2. Проверка службы PostgreSQL:"
SERVICE=$(systemctl list-units --type=service --all 2>/dev/null | grep -i postgres | head -1 | awk '{print $1}')

if [ -n "$SERVICE" ]; then
    echo "   Найдена служба: $SERVICE"
    
    if systemctl is-active --quiet $SERVICE 2>/dev/null; then
        echo "   ✅ Служба запущена"
    else
        echo "   ⚠️  Служба не запущена"
        echo "   Попробуйте запустить: sudo systemctl start $SERVICE"
    fi
else
    echo "   ⚠️  Служба не найдена в systemd"
    
    # Проверить все возможные имена служб
    echo "   Поиск всех служб PostgreSQL..."
    systemctl list-units --type=service --all 2>/dev/null | grep -i postgres || echo "   Службы не найдены"
fi

echo ""

# Проверка 3: Проверка порта
echo "3. Проверка порта 5432:"
if ss -tuln 2>/dev/null | grep -q ":5432" || netstat -tuln 2>/dev/null | grep -q ":5432"; then
    echo "   ✅ Что-то слушает на порту 5432"
else
    echo "   ❌ Порт 5432 не используется"
fi

echo ""
echo "Для решения проблемы выполните:"
echo "  bash fix_postgresql.sh"
