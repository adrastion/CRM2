#!/bin/bash
# Простой скрипт установки PostgreSQL для Kali Linux

echo "🐘 Установка PostgreSQL для Kali Linux"
echo "======================================"

# Способ 1: Стандартные пакеты (рекомендуется)
echo ""
echo "Вариант 1: Установка из стандартных репозиториев Kali (РЕКОМЕНДУЕТСЯ)"
echo "Это установит PostgreSQL 13 или 14, что полностью подходит для проекта."
echo ""
read -p "Использовать стандартные пакеты? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Установка PostgreSQL из стандартных репозиториев..."
    sudo apt update
    sudo apt install -y postgresql postgresql-contrib
    
    echo ""
    echo "✅ PostgreSQL установлен!"
    psql --version
    
    echo ""
    echo "Запуск службы PostgreSQL..."
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
    
    echo ""
    echo "✅ PostgreSQL готов к использованию!"
    exit 0
fi

# Способ 2: Официальный репозиторий PostgreSQL
echo ""
echo "Вариант 2: Установка из официального репозитория PostgreSQL"
echo ""
echo "Сначала нужно установить gpg:"
sudo apt install -y gpg wget

echo "Создание директории для ключей..."
sudo mkdir -p /etc/apt/keyrings

echo "Скачивание GPG ключа..."
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo gpg --dearmor -o /etc/apt/keyrings/postgresql.gpg
sudo chmod 644 /etc/apt/keyrings/postgresql.gpg

echo "Определение кодового имени для Kali..."
CODENAME=$(lsb_release -cs)
echo "Кодовое имя: $CODENAME"

# Kali часто использует bookworm (Debian Testing) или sid (Debian Unstable)
echo "Использование bookworm (Debian Testing) для репозитория..."
sudo sh -c 'echo "deb [signed-by=/etc/apt/keyrings/postgresql.gpg] http://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list'

echo "Обновление списка пакетов..."
sudo apt update

echo ""
echo "Проверка доступных версий PostgreSQL:"
apt-cache search postgresql | grep "^postgresql-[0-9]" | head -5

echo ""
read -p "Какую версию установить? (например, 15, 14, 13 или оставить пустым для стандартной): " VERSION

if [ -z "$VERSION" ]; then
    echo "Установка стандартного PostgreSQL..."
    sudo apt install -y postgresql postgresql-contrib
else
    echo "Установка PostgreSQL $VERSION..."
    sudo apt install -y postgresql-$VERSION postgresql-contrib-$VERSION
fi

echo ""
echo "✅ PostgreSQL установлен!"
psql --version

echo ""
echo "Запуск службы PostgreSQL..."
sudo systemctl start postgresql
sudo systemctl enable postgresql

echo ""
echo "✅ PostgreSQL готов к использованию!"
