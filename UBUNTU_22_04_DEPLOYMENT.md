# 🐧 Инструкция по развертыванию на Ubuntu 22.04

Полное руководство по установке и настройке ПрофСпортСРМ на сервере Ubuntu 22.04.

## 📋 Содержание

1. [Требования к серверу](#требования-к-серверу)
2. [Подготовка сервера](#подготовка-сервера)
3. [Установка зависимостей](#установка-зависимостей)
4. [Настройка PostgreSQL](#настройка-postgresql)
5. [Развертывание приложения](#развертывание-приложения)
6. [Настройка Nginx](#настройка-nginx)
7. [Настройка PM2](#настройка-pm2)
8. [Настройка SSL/HTTPS](#настройка-sslhttps)
9. [Настройка Firewall](#настройка-firewall)
10. [Автоматические бэкапы](#автоматические-бэкапы)
11. [Мониторинг и обслуживание](#мониторинг-и-обслуживание)
12. [Решение проблем](#решение-проблем)

---

## 🖥 Требования к серверу

### Минимальные требования:
- **ОС:** Ubuntu 22.04 LTS
- **RAM:** 2GB (рекомендуется 4GB)
- **CPU:** 2 ядра
- **Диск:** 20GB свободного места
- **Сеть:** Статический IP-адрес или доменное имя

### Рекомендуемые требования:
- **RAM:** 4GB+
- **CPU:** 4+ ядра
- **Диск:** 50GB+ SSD
- **Доменное имя:** для SSL сертификата

---

## 🔧 Подготовка сервера

### 1. Подключение к серверу

```bash
# Подключитесь к серверу по SSH
ssh root@your-server-ip
# или
ssh your-username@your-server-ip
```

### 2. Обновление системы

```bash
# Обновить список пакетов
sudo apt update

# Обновить установленные пакеты
sudo apt upgrade -y

# Установить базовые утилиты
sudo apt install -y curl wget git build-essential software-properties-common
```

### 3. Создание пользователя для приложения (опционально, но рекомендуется)

```bash
# Создать нового пользователя
sudo adduser crmuser

# Добавить пользователя в группу sudo
sudo usermod -aG sudo crmuser

# Переключиться на нового пользователя
su - crmuser
```

---

## 📦 Установка зависимостей

### 1. Установка Node.js 18.x

```bash
# Добавить репозиторий NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Установить Node.js
sudo apt-get install -y nodejs

# Проверить версию
node --version  # Должно быть v18.x.x или выше
npm --version
```

### 2. Установка PostgreSQL 15

```bash
# Добавить официальный репозиторий PostgreSQL
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# Обновить список пакетов
sudo apt update

# Установить PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Проверить версию
psql --version

# Проверить статус службы
sudo systemctl status postgresql
```

### 3. Установка Nginx

```bash
# Установить Nginx
sudo apt install -y nginx

# Запустить и включить автозапуск
sudo systemctl start nginx
sudo systemctl enable nginx

# Проверить статус
sudo systemctl status nginx
```

### 4. Установка PM2 (менеджер процессов)

```bash
# Установить PM2 глобально
sudo npm install -g pm2

# Настроить автозапуск PM2 при перезагрузке
pm2 startup systemd

# Следовать инструкциям, которые появятся на экране
# Обычно нужно выполнить команду вида:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u crmuser --hp /home/crmuser
```

---

## 🗄 Настройка PostgreSQL

### 1. Создание базы данных и пользователя

```bash
# Переключиться на пользователя postgres
sudo -u postgres psql

# В консоли PostgreSQL выполнить:
```

```sql
-- Создать пользователя для приложения
CREATE USER crm_user WITH PASSWORD '0408';

-- Создать базу данных
CREATE DATABASE martial_arts_crm OWNER crm_user;

-- Выдать все права на базу данных
GRANT ALL PRIVILEGES ON DATABASE martial_arts_crm TO crm_user;

-- Подключиться к базе данных
\c martial_arts_crm

-- Выдать права на схему public
GRANT ALL ON SCHEMA public TO crm_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO crm_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO crm_user;

-- Выйти из psql
\q
```

### 2. Настройка доступа PostgreSQL (опционально)

Если нужно разрешить удаленный доступ к PostgreSQL:

```bash
# Отредактировать файл конфигурации
sudo nano /etc/postgresql/15/main/postgresql.conf

# Найти строку и раскомментировать/изменить:
# listen_addresses = 'localhost'
# на:
# listen_addresses = '*'

# Настроить доступ в pg_hba.conf
sudo nano /etc/postgresql/15/main/pg_hba.conf

# Добавить строку для локального доступа:
# host    martial_arts_crm    crm_user    127.0.0.1/32    md5

# Перезапустить PostgreSQL
sudo systemctl restart postgresql
```

**⚠️ ВАЖНО:** Для production рекомендуется оставить доступ только с localhost для безопасности.

---

## 🚀 Развертывание приложения

### 1. Клонирование репозитория

```bash
# Перейти в домашнюю директорию или создать директорию для приложений
cd ~
# или
sudo mkdir -p /var/www
cd /var/www

# Клонировать репозиторий (замените на ваш URL)
git clone https://github.com/your-username/martial-arts-crm.git
# или загрузить проект через scp/sftp

# Перейти в директорию проекта
cd martial-arts-crm
```

### 2. Установка зависимостей

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

Настройте следующие переменные:

```env
# Database (используйте созданного пользователя и пароль)
DATABASE_URL="postgresql://crm_user:ВАШ_БЕЗОПАСНЫЙ_ПАРОЛЬ@localhost:5432/martial_arts_crm?schema=public"

# JWT (сгенерируйте безопасный ключ)
JWT_SECRET="ВАШ_СЛУЧАЙНЫЙ_БЕЗОПАСНЫЙ_КЛЮЧ_МИНИМУМ_32_СИМВОЛА"
JWT_EXPIRES_IN="7d"

# Server
PORT=3001
NODE_ENV="production"

# Email (настройте SMTP для отправки писем)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
FROM_EMAIL="noreply@yourdomain.com"

# File Upload
MAX_FILE_SIZE=5242880
UPLOAD_PATH="./uploads"

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS (укажите ваш домен)
CORS_ORIGIN="https://yourdomain.com"
```

**Генерация безопасного JWT_SECRET:**

```bash
# Сгенерировать случайный ключ
openssl rand -base64 32
```

### 4. Настройка базы данных

```bash
# Сгенерировать Prisma клиент
npx prisma generate

# Применить миграции (создать таблицы)
npx prisma migrate deploy

# Заполнить тестовыми данными (опционально, только для тестирования)
# npx prisma db seed
```

### 5. Сборка приложения

```bash
# Собрать backend
npm run build:server

# Собрать frontend
npm run build:client
```

### 6. Создание директории для загрузок

```bash
# Создать директорию для загрузок
mkdir -p uploads

# Установить права доступа
chmod 755 uploads
```

---

## 🌐 Настройка Nginx

### 1. Создание конфигурации сайта

```bash
# Создать файл конфигурации
sudo nano /etc/nginx/sites-available/martial-arts-crm
```

Вставьте следующую конфигурацию (замените `yourdomain.com` на ваш домен):

```nginx
# HTTP сервер (будет перенаправлять на HTTPS)
server {
    listen 80;
    listen [::]:80;
    server_name profsportcrm.ru www.profsportcrm.ru;

    # Перенаправление на HTTPS (после настройки SSL)
    return 301 https://$server_name$request_uri;
}

# HTTPS сервер
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL сертификаты (будут настроены позже)
    # ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Логи
    access_log /var/log/nginx/martial-arts-crm-access.log;
    error_log /var/log/nginx/martial-arts-crm-error.log;

    # Максимальный размер загружаемых файлов
    client_max_body_size 10M;

    # Frontend (статичные файлы)
    location / {
        root /var/www/martial-arts-crm/client/build;
        index index.html;
        try_files $uri $uri/ /index.html;
        
        # Кэширование статических файлов
        location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Таймауты
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3001/health;
        access_log off;
    }
}
```

### 2. Активация конфигурации

```bash
# Создать символическую ссылку
sudo ln -s /etc/nginx/sites-available/martial-arts-crm /etc/nginx/sites-enabled/

# Проверить конфигурацию
sudo nginx -t

# Если проверка прошла успешно, перезагрузить Nginx
sudo systemctl reload nginx
```

### 3. Временная настройка без SSL (для тестирования)

Если у вас еще нет SSL сертификата, используйте упрощенную конфигурацию:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    client_max_body_size 10M;

    location / {
        root /var/www/martial-arts-crm/client/build;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## ⚙️ Настройка PM2

### 1. Создание конфигурационного файла PM2

```bash
# Создать файл конфигурации
nano ecosystem.config.js
```

Вставьте следующую конфигурацию:

```javascript
module.exports = {
  apps: [{
    name: 'martial-arts-crm',
    script: './dist/server.js',
    instances: 'max', // Использовать все доступные CPU ядра
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    // Автоматический перезапуск при сбое
    min_uptime: '10s',
    max_restarts: 10
  }]
};
```

### 2. Создание директории для логов

```bash
mkdir -p logs
```

### 3. Запуск приложения через PM2

```bash
# Запустить приложение
pm2 start ecosystem.config.js

# Сохранить конфигурацию PM2 для автозапуска
pm2 save

# Проверить статус
pm2 status

# Просмотр логов
pm2 logs martial-arts-crm

# Мониторинг в реальном времени
pm2 monit
```

### 4. Полезные команды PM2

```bash
# Перезапустить приложение
pm2 restart martial-arts-crm

# Остановить приложение
pm2 stop martial-arts-crm

# Удалить из PM2
pm2 delete martial-arts-crm

# Просмотр информации о процессе
pm2 info martial-arts-crm

# Просмотр использования ресурсов
pm2 list
```

---

## 🔒 Настройка SSL/HTTPS

### 1. Установка Certbot

```bash
# Установить Certbot
sudo apt install -y certbot python3-certbot-nginx
```

### 2. Получение SSL сертификата

```bash
# Получить сертификат для вашего домена
sudo certbot --nginx -d profsportcrm.ru -d www.profsportcrm.ru

# Следовать инструкциям на экране:
# - Ввести email для уведомлений
# - Согласиться с условиями
# - Выбрать, перенаправлять ли HTTP на HTTPS (рекомендуется: Yes)
```

### 3. Автоматическое обновление сертификата

Certbot автоматически настраивает cron-задачу для обновления сертификатов. Проверить можно командой:

```bash
# Проверить статус таймера
sudo systemctl status certbot.timer

# Тестовое обновление
sudo certbot renew --dry-run
```

### 4. Обновление конфигурации Nginx

После получения сертификата Certbot автоматически обновит конфигурацию Nginx. Проверьте:

```bash
# Проверить конфигурацию
sudo nginx -t

# Перезагрузить Nginx
sudo systemctl reload nginx
```

---

## 🔥 Настройка Firewall

### 1. Настройка UFW (Uncomplicated Firewall)

```bash
# Проверить статус
sudo ufw status

# Разрешить SSH (ВАЖНО: сделать до включения firewall!)
sudo ufw allow 22/tcp

# Разрешить HTTP и HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Включить firewall
sudo ufw enable

# Проверить статус
sudo ufw status verbose
```

### 2. Дополнительная безопасность (опционально)

```bash
# Ограничить SSH доступ только с определенных IP (опционально)
sudo ufw allow from YOUR_IP_ADDRESS to any port 22

# Заблокировать все остальные подключения к порту 22
sudo ufw deny 22/tcp
```

---

## 💾 Автоматические бэкапы

### 1. Создание скрипта бэкапа

```bash
# Создать директорию для бэкапов
sudo mkdir -p /backups/martial-arts-crm

# Создать скрипт бэкапа
sudo nano /usr/local/bin/backup-crm.sh
```

Вставьте следующий скрипт:

```bash
#!/bin/bash

# Настройки
BACKUP_DIR="/backups/martial-arts-crm"
DB_NAME="martial_arts_crm"
DB_USER="crm_user"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Создать директорию, если не существует
mkdir -p $BACKUP_DIR

# Создать бэкап базы данных
PGPASSWORD='ВАШ_ПАРОЛЬ_БД' pg_dump -U $DB_USER -h localhost $DB_NAME | gzip > $BACKUP_DIR/db_backup_$DATE.sql.gz

# Бэкап файлов загрузок (если есть)
if [ -d "/var/www/martial-arts-crm/uploads" ]; then
    tar -czf $BACKUP_DIR/uploads_backup_$DATE.tar.gz /var/www/martial-arts-crm/uploads
fi

# Удалить старые бэкапы (старше RETENTION_DAYS дней)
find $BACKUP_DIR -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete

# Логирование
echo "$(date): Backup completed - db_backup_$DATE.sql.gz" >> $BACKUP_DIR/backup.log
```

**⚠️ ВАЖНО:** Замените `ВАШ_ПАРОЛЬ_БД` на реальный пароль базы данных!

```bash
# Сделать скрипт исполняемым
sudo chmod +x /usr/local/bin/backup-crm.sh

# Протестировать скрипт
sudo /usr/local/bin/backup-crm.sh
```

### 2. Настройка автоматического бэкапа через cron

```bash
# Открыть crontab
sudo crontab -e

# Добавить строку для ежедневного бэкапа в 2:00 ночи
0 2 * * * /usr/local/bin/backup-crm.sh
```

### 3. Восстановление из бэкапа

```bash
# Распаковать бэкап
gunzip /backups/martial-arts-crm/db_backup_YYYYMMDD_HHMMSS.sql.gz

# Восстановить базу данных
psql -U crm_user -h localhost -d martial_arts_crm < /backups/martial-arts-crm/db_backup_YYYYMMDD_HHMMSS.sql
```

---

## 📊 Мониторинг и обслуживание

### 1. Мониторинг через PM2

```bash
# Просмотр статуса
pm2 status

# Мониторинг в реальном времени
pm2 monit

# Просмотр логов
pm2 logs martial-arts-crm --lines 100

# Просмотр использования ресурсов
pm2 list
```

### 2. Мониторинг системы

```bash
# Использование диска
df -h

# Использование памяти
free -h

# Использование CPU
top
# или
htop  # если установлен: sudo apt install htop

# Проверка логов Nginx
sudo tail -f /var/log/nginx/martial-arts-crm-error.log
sudo tail -f /var/log/nginx/martial-arts-crm-access.log
```

### 3. Обновление приложения

```bash
# Перейти в директорию проекта
cd /var/www/martial-arts-crm

# Получить последние изменения из Git
git pull origin main

# Установить новые зависимости (если есть)
npm install
cd client && npm install && cd ..

# Применить новые миграции базы данных
npx prisma migrate deploy

# Пересобрать приложение
npm run build:server
npm run build:client

# Перезапустить приложение через PM2
pm2 restart martial-arts-crm

# Сохранить состояние PM2
pm2 save
```

### 4. Ротация логов

PM2 может автоматически ротировать логи. Для настройки:

```bash
# Установить pm2-logrotate
pm2 install pm2-logrotate

# Настроить параметры
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

---

## 🔍 Решение проблем

### Проблема: Приложение не запускается

```bash
# Проверить логи PM2
pm2 logs martial-arts-crm --err

# Проверить переменные окружения
pm2 env 0

# Проверить, что порт 3001 свободен
sudo netstat -tulpn | grep 3001

# Проверить подключение к базе данных
psql -U crm_user -h localhost -d martial_arts_crm -c "SELECT 1;"
```

### Проблема: Ошибки подключения к базе данных

```bash
# Проверить статус PostgreSQL
sudo systemctl status postgresql

# Проверить логи PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-15-main.log

# Проверить права доступа пользователя
sudo -u postgres psql -c "\du crm_user"
```

### Проблема: Nginx возвращает 502 Bad Gateway

```bash
# Проверить, что backend запущен
pm2 status

# Проверить, что порт 3001 слушается
sudo netstat -tulpn | grep 3001

# Проверить логи Nginx
sudo tail -f /var/log/nginx/martial-arts-crm-error.log

# Проверить конфигурацию Nginx
sudo nginx -t
```

### Проблема: Файлы не загружаются

```bash
# Проверить права доступа на директорию uploads
ls -la /var/www/martial-arts-crm/uploads

# Установить правильные права
chmod 755 /var/www/martial-arts-crm/uploads
chown -R crmuser:crmuser /var/www/martial-arts-crm/uploads

# Проверить настройку client_max_body_size в Nginx
sudo grep client_max_body_size /etc/nginx/sites-available/martial-arts-crm
```

### Проблема: Высокое использование памяти

```bash
# Проверить использование памяти
pm2 monit

# Ограничить использование памяти в ecosystem.config.js
# max_memory_restart: '1G'

# Перезапустить с новыми настройками
pm2 restart martial-arts-crm --update-env
```

### Проблема: SSL сертификат не обновляется

```bash
# Проверить статус certbot
sudo systemctl status certbot.timer

# Вручную обновить сертификат
sudo certbot renew

# Проверить логи
sudo journalctl -u certbot.timer
```

---

## ✅ Чеклист развертывания

- [ ] Сервер обновлен и настроен
- [ ] Node.js 18+ установлен
- [ ] PostgreSQL установлен и настроен
- [ ] База данных создана
- [ ] Nginx установлен и настроен
- [ ] Приложение развернуто и собрано
- [ ] Переменные окружения настроены
- [ ] Миграции применены
- [ ] PM2 настроен и приложение запущено
- [ ] Nginx проксирует запросы к backend
- [ ] SSL сертификат установлен (для production)
- [ ] Firewall настроен
- [ ] Бэкапы настроены
- [ ] Мониторинг настроен
- [ ] Тестовые аккаунты созданы (если использовался seed)

---

## 📞 Полезные команды

### Быстрая проверка статуса

```bash
# Статус всех сервисов
sudo systemctl status nginx postgresql
pm2 status

# Проверка доступности
curl http://localhost:3001/health
curl https://yourdomain.com/health
```

### Просмотр логов

```bash
# Логи приложения
pm2 logs martial-arts-crm

# Логи Nginx
sudo tail -f /var/log/nginx/martial-arts-crm-*.log

# Логи PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-15-main.log

# Системные логи
sudo journalctl -xe
```

### Перезапуск сервисов

```bash
# Перезапуск приложения
pm2 restart martial-arts-crm

# Перезапуск Nginx
sudo systemctl restart nginx

# Перезапуск PostgreSQL
sudo systemctl restart postgresql
```

---

## 🎯 Дополнительные рекомендации

### Безопасность

1. **Регулярно обновляйте систему:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **Используйте сильные пароли** для базы данных и JWT_SECRET

3. **Настройте fail2ban** для защиты от брутфорса:
   ```bash
   sudo apt install fail2ban
   sudo systemctl enable fail2ban
   ```

4. **Регулярно проверяйте логи** на подозрительную активность

5. **Настройте мониторинг** (например, через PM2 Plus или внешние сервисы)

### Производительность

1. **Настройте кэширование** в Nginx для статических файлов

2. **Используйте CDN** для статических ресурсов (опционально)

3. **Настройте индексы базы данных** для часто используемых запросов

4. **Мониторьте использование ресурсов** и масштабируйте при необходимости

---

## 📚 Дополнительные ресурсы

- [Документация Node.js](https://nodejs.org/docs/)
- [Документация PostgreSQL](https://www.postgresql.org/docs/)
- [Документация Nginx](https://nginx.org/en/docs/)
- [Документация PM2](https://pm2.keymetrics.io/docs/)
- [Документация Prisma](https://www.prisma.io/docs/)

---

**Удачного развертывания!** 🚀

Если у вас возникли проблемы, проверьте раздел [Решение проблем](#решение-проблем) или создайте Issue в репозитории проекта.

