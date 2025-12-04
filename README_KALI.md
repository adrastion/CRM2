# 🚀 Быстрый запуск на Kali Linux

## Текущий статус проекта

✅ **Готово:**
- Node.js v20.19.5 установлен
- PostgreSQL установлен
- .env файл создан
- Скрипты установки подготовлены

⚠️ **Требуется:**
- Установка npm (требует sudo)
- Запуск и настройка PostgreSQL (требует sudo)

## 📋 Инструкция по запуску

### Шаг 1: Установите npm

```bash
sudo apt update
sudo apt install -y npm
```

Проверьте установку:
```bash
npm --version
```

### Шаг 2: Запустите PostgreSQL

```bash
# Запуск PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Проверка статуса
sudo systemctl status postgresql
```

### Шаг 3: Создайте базу данных

```bash
sudo -u postgres psql
```

В консоли PostgreSQL выполните:
```sql
CREATE DATABASE martial_arts_crm;
CREATE USER crm_user WITH PASSWORD '0408';
GRANT ALL PRIVILEGES ON DATABASE martial_arts_crm TO crm_user;
\c martial_arts_crm
GRANT ALL ON SCHEMA public TO crm_user;
\q
```

### Шаг 4: Запустите автоматическую установку

После выполнения шагов 1-3, запустите:

```bash
cd /home/bes/CRM2
./auto_setup.sh
```

Скрипт автоматически:
- Установит все зависимости
- Настроит базу данных
- Применит миграции
- Запустит проект

## 🎯 Альтернативный способ (вручную)

Если предпочитаете выполнить шаги вручную:

```bash
cd /home/bes/CRM2

# 1. Установка зависимостей
npm install
cd client && npm install && cd ..

# 2. Настройка базы данных
npx prisma generate
npx prisma migrate dev --name init

# 3. Заполнение тестовыми данными (опционально)
npx prisma db seed

# 4. Запуск проекта
npm run dev
```

## 🌐 Доступ к приложению

После запуска:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

## 👤 Тестовые аккаунты

После выполнения `npx prisma db seed`:

### Владелец школы:
- **Email**: `owner@dragonacademy.com`
- **Пароль**: `password123`

### Администратор:
- **Email**: `admin@dragonacademy.com`
- **Пароль**: `password123`

### Тренер:
- **Email**: `trainer1@dragonacademy.com`
- **Пароль**: `password123`

## 🔧 Решение проблем

### npm не найден
```bash
sudo apt install -y npm
```

### PostgreSQL не запускается
```bash
sudo systemctl start postgresql
sudo systemctl status postgresql
```

### Ошибка подключения к базе данных
- Проверьте пароль в `.env` файле
- Убедитесь, что база данных создана
- Проверьте, что PostgreSQL запущен

### Порт занят
```bash
# Проверка портов
lsof -i :3000
lsof -i :3001

# Остановка процесса (если нужно)
kill -9 <PID>
```

## 📁 Полезные файлы

- `auto_setup.sh` - Автоматическая установка (рекомендуется)
- `quick_start.sh` - Быстрый запуск (после установки зависимостей)
- `START_TEST.md` - Подробная инструкция
- `.env` - Файл конфигурации

## ✅ Проверка готовности

Выполните для проверки:
```bash
./auto_setup.sh
```

Скрипт покажет, что готово и что нужно сделать.

---

**Готово к запуску!** 🎉

После установки npm и настройки PostgreSQL просто выполните:
```bash
./auto_setup.sh
```

