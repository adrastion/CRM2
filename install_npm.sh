#!/bin/bash
# Установка npm для Node.js

echo "📦 Установка npm..."

# Проверка прав sudo
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  Требуются права sudo. Запустите скрипт с sudo:"
    echo "sudo bash install_npm.sh"
    exit 1
fi

# Установка npm
apt-get update
apt-get install -y npm

# Проверка установки
if command -v npm &> /dev/null; then
    echo "✅ npm установлен: $(npm --version)"
else
    echo "❌ Ошибка при установке npm"
    exit 1
fi

echo ""
echo "✅ Готово! Теперь можно запускать проект:"
echo "   bash quick_setup.sh"

