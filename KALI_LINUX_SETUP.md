# 🐧 Инструкция по запуску на Kali Linux

Полное руководство по установке и настройке ПрофСпортСРМ на Kali Linux.

> **Примечание:** Kali Linux основана на Debian, поэтому большинство команд аналогичны Ubuntu/Debian, но есть некоторые особенности.

## 📋 Содержание

1. [Требования](#требования)
2. [Подготовка системы](#подготовка-системы)
3. [Установка зависимостей](#установка-зависимостей)
4. [Настройка PostgreSQL](#настройка-postgresql)
5. [Настройка проекта](#настройка-проекта)
6. [Запуск приложения](#запуск-приложения)
7. [Решение проблем](#решение-проблем)

---

## 📦 Требования

### Минимальные требования:
- **ОС:** Kali Linux (любая версия)
- **RAM:** 4GB (рекомендуется 8GB)
- **CPU:** 2 ядра
- **Диск:** 10GB свободного места
- **Интернет:** для установки пакетов

### Необходимые компоненты:
- Node.js 18+
- PostgreSQL 13+
- npm или yarn
- Git

---

## 🔧 Подготовка системы

### 1. Обновление системы

```bash
# Обновить список пакетов
sudo apt update

# Обновить установленные пакеты
sudo apt upgrade -y

# Установить базовые утилиты
sudo apt install -y curl wget git build-essential software-properties-common apt-transport-https ca-certificates gnupg lsb-release
```

### 2. Проверка версии системы

```bash
# Проверить версию Kali
cat /etc/os-release

# Проверить архитектуру
uname -m
```

---

## 📦 Установка зависимостей

### 1. Установка Node.js 18.x

Kali Linux обычно поставляется с устаревшей версией Node.js, поэтому установим последнюю LTS версию:

```bash
# Вариант 1: Использование NodeSource (рекомендуется)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Вариант 2: Использование nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18
nvm alias default 18

# Проверить версии
node --version  # Должно быть v18.x.x или выше
npm --version
```

### 2. Установка PostgreSQL

Kali Linux может не иметь PostgreSQL в стандартных репозиториях, поэтому добавим официальный репозиторий:

```bash
# Удалить старую версию (если установлена)
sudo apt remove --purge postgresql* -y
sudo apt autoremove -y

# Добавить официальный репозиторий PostgreSQL
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# Обновить список пакетов
sudo apt update

# Установить PostgreSQL 15 (или 14/13)
sudo apt install -y postgresql-15 postgresql-contrib-15

# Проверить версию
psql --version

# Проверить статус службы
sudo systemctl status postgresql
```

Если служба не запущена:

```bash
# Запустить PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql  # Автозапуск при загрузке

# Проверить статус
sudo systemctl status postgresql
```

### 3. Установка дополнительных зависимостей

```bash
# Установить Python (нужен для некоторых npm пакетов)
sudo apt install -y python3 python3-pip

# Установить другие необходимые инструменты
sudo apt install -y libpq-dev
```

---

## 🗄 Настройка PostgreSQL

### 1. Создание пользователя и базы данных

```bash
# Переключиться на пользователя postgres
sudo -u postgres psql

# Внутри psql выполнить:
CREATE DATABASE martial_arts_crm;
CREATE USER crm_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE martial_arts_crm TO crm_user;
ALTER DATABASE martial_arts_crm OWNER TO crm_user;

# Для Prisma требуется доступ к схеме public
\c martial_arts_crm
GRANT ALL ON SCHEMA public TO crm_user;
ALTER SCHEMA public OWNER TO crm_user;

# Выйти из psql
\q
```

### 2. Настройка аутентификации PostgreSQL

```bash
# Отредактировать файл pg_hba.conf
sudo nano /etc/postgresql/15/main/pg_hba.conf

# Найти строку:
# local   all             all                                     peer
# И заменить на:
# local   all             all                                     md5

# Или добавить строку для локальных подключений:
host    all             all             127.0.0.1/32            md5

# Перезапустить PostgreSQL
sudo systemctl restart postgresql
```

### 3. Настройка postgresql.conf (опционально)

```bash
# Отредактировать конфигурационный файл
sudo nano /etc/postgresql/15/main/postgresql.conf

# Найти и убедиться, что:
# listen_addresses = 'localhost'
# port = 5432

# Перезапустить PostgreSQL
sudo systemctl restart postgresql
```

### 4. Проверка подключения

```bash
# Проверить подключение
psql -U crm_user -d martial_arts_crm -h localhost

# Если всё работает, вы увидите приглашение:
# martial_arts_crm=>

# Выйти:
\q
```

---

## 🚀 Настройка проекта

### 1. Клонирование/переход в директорию проекта

```bash
# Если проект ещё не склонирован:
# git clone <repository-url>
# cd CRM2

# Если проект уже есть (как в вашем случае):
cd /home/bes/CRM2
```

### 2. Установка зависимостей проекта

```bash
# Установить зависимости backend
npm install

# Установить зависимости frontend
cd client
npm install
cd ..
```

### 3. Настройка переменных окружения

```bash
# Скопировать файл примера
cp env.example .env

# Отредактировать .env файл
nano .env
```

Измените следующие переменные в `.env`:

```env
# Database (PostgreSQL)
# Используйте данные, созданные ранее
DATABASE_URL="postgresql://crm_user:your_secure_password@localhost:5432/martial_arts_crm?schema=public"

# JWT (сгенерируйте безопасный ключ)
JWT_SECRET="your-super-secret-jwt-key-minimum-32-characters-long"
JWT_EXPIRES_IN="7d"

# Server
PORT=3001
NODE_ENV="development"

# Email (опционально, для восстановления пароля)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
FROM_EMAIL="noreply@martialartscrm.com"

# CORS
CORS_ORIGIN="http://localhost:3000"
```

**Генерация безопасного JWT_SECRET:**

```bash
# Сгенерировать случайный ключ
openssl rand -base64 32
# Скопируйте результат в JWT_SECRET
```

### 4. Настройка Prisma

```bash
# Сгенерировать Prisma клиент
npx prisma generate

# Применить миграции базы данных
npx prisma migrate dev

# Заполнить базу тестовыми данными (опционально)
npx prisma db seed
```

**Если миграции не работают:**

```bash
# Сбросить базу данных (⚠️ удалит все данные!)
npx prisma migrate reset

# Или применить миграции вручную
npx prisma migrate deploy
```

---

## 🎯 Запуск приложения

### Вариант 1: Режим разработки (рекомендуется для начала)

```bash
# Запустить backend и frontend одновременно
npm run dev

# Или по отдельности в разных терминалах:

# Терминал 1 - Backend
npm run dev:server

# Терминал 2 - Frontend
npm run dev:client
```

### Вариант 2: Production режим

```bash
# Собрать проект
npm run build

# Запустить только backend (frontend будет статическими файлами)
npm start
```

### 3. Проверка запуска

После запуска вы должны увидеть:

```
✅ Backend запущен на: http://localhost:3001
✅ Frontend запущен на: http://localhost:3000
```

### 4. Открыть приложение в браузере

```
http://localhost:3000
```

### 5. Тестовые аккаунты

После выполнения `npx prisma db seed` будут созданы следующие тестовые аккаунты:

**Владелец школы:**
- Email: `owner@dragonacademy.com`
- Пароль: `password123`

**Администратор:**
- Email: `admin@dragonacademy.com`
- Пароль: `password123`

**Тренер:**
- Email: `trainer1@dragonacademy.com`
- Пароль: `password123`

---

## 🔧 Настройка Firewall (опционально)

Если вам нужно открыть порты для внешнего доступа:

```bash
# Проверить статус firewall
sudo ufw status

# Разрешить порты (если firewall включен)
sudo ufw allow 3000/tcp  # Frontend
sudo ufw allow 3001/tcp  # Backend

# Или использовать iptables
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 3001 -j ACCEPT
```

> **Примечание:** В Kali Linux firewall может быть отключен по умолчанию. Для production используйте настройку через ufw или iptables.

---

## 🐛 Решение проблем

### Проблема 1: PostgreSQL не запускается

```bash
# Проверить статус
sudo systemctl status postgresql

# Посмотреть логи
sudo journalctl -u postgresql -n 50

# Перезапустить
sudo systemctl restart postgresql

# Проверить порт
sudo netstat -tulpn | grep 5432
```

### Проблема 2: Ошибка подключения к базе данных

```bash
# Проверить, что PostgreSQL слушает на localhost
sudo -u postgres psql -c "SHOW listen_addresses;"

# Проверить подключение
psql -U crm_user -d martial_arts_crm -h localhost

# Проверить права доступа
sudo -u postgres psql -c "\du"
```

### Проблема 3: Ошибки при установке npm пакетов

```bash
# Очистить кэш npm
npm cache clean --force

# Удалить node_modules и переустановить
rm -rf node_modules package-lock.json
npm install

# Для frontend
cd client
rm -rf node_modules package-lock.json
npm install
cd ..
```

### Проблема 4: Ошибки Prisma

```bash
# Сбросить Prisma клиент
rm -rf node_modules/.prisma

# Перегенерировать клиент
npx prisma generate

# Если проблема с миграциями
npx prisma migrate reset
npx prisma migrate dev
```

### Проблема 5: Порт уже занят

```bash
# Найти процесс, использующий порт
sudo lsof -i :3000
sudo lsof -i :3001
sudo lsof -i :5432

# Убить процесс (замените PID на реальный)
sudo kill -9 <PID>

# Или изменить порт в .env файле
```

### Проблема 6: Ошибки прав доступа

```bash
# Дать права на директорию проекта
sudo chown -R $USER:$USER /home/bes/CRM2

# Дать права на выполнение скриптов
chmod +x node_modules/.bin/*
```

### Проблема 7: Ошибки с bcrypt

```bash
# Переустановить bcrypt
npm uninstall bcrypt bcryptjs
npm install bcryptjs

# Или установить нативные зависимости
sudo apt install -y build-essential python3-dev
npm rebuild bcrypt
```

---

## 🔐 Дополнительные настройки безопасности (для production)

### 1. Настройка Nginx как reverse proxy

```bash
# Установить Nginx
sudo apt install -y nginx

# Создать конфигурацию
sudo nano /etc/nginx/sites-available/crm

# Добавить конфигурацию (пример):
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
# Активировать сайт
sudo ln -s /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/

# Проверить конфигурацию
sudo nginx -t

# Перезапустить Nginx
sudo systemctl restart nginx
```

### 2. Настройка PM2 для управления процессом

```bash
# Установить PM2 глобально
sudo npm install -g pm2

# Запустить backend через PM2
cd /home/bes/CRM2
pm2 start npm --name "crm-backend" -- run start

# Сохранить конфигурацию PM2
pm2 save

# Настроить автозапуск
pm2 startup
# Выполнить команду, которую покажет PM2

# Просмотр статуса
pm2 status
pm2 logs
```

---

## 📝 Полезные команды

```bash
# Очистить базу данных и пересоздать
npx prisma migrate reset

# Открыть Prisma Studio (визуальный редактор БД)
npx prisma studio

# Просмотр логов PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-15-main.log

# Проверить использование ресурсов
htop
# или
top

# Проверить открытые порты
sudo netstat -tulpn
```

---

## ✅ Чек-лист запуска

- [ ] Обновлена система (`sudo apt update && sudo apt upgrade`)
- [ ] Установлен Node.js 18+ (`node --version`)
- [ ] Установлен PostgreSQL 13+ (`psql --version`)
- [ ] PostgreSQL запущен (`sudo systemctl status postgresql`)
- [ ] Создана база данных и пользователь
- [ ] Настроен файл `.env`
- [ ] Установлены зависимости (`npm install` в корне и в `client/`)
- [ ] Выполнены миграции Prisma (`npx prisma migrate dev`)
- [ ] Приложение запускается (`npm run dev`)
- [ ] Приложение доступно на http://localhost:3000

---

## 🆘 Получение помощи

Если у вас возникли проблемы:

1. Проверьте логи:
   ```bash
   # Логи backend в терминале
   # Логи frontend в терминале
   # Логи PostgreSQL
   sudo tail -f /var/log/postgresql/postgresql-15-main.log
   ```

2. Проверьте переменные окружения:
   ```bash
   cat .env
   ```

3. Проверьте подключение к базе:
   ```bash
   psql -U crm_user -d martial_arts_crm -h localhost
   ```

---

**Успешного запуска! 🚀**

