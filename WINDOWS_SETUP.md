# 🪟 Установка и запуск проекта на Windows 11

Пошаговая инструкция для чистой установки на Windows 11.

## ⚡ Быстрый старт (TL;DR)

Если вы хотите быстро запустить проект:

1. **Установите Node.js** (https://nodejs.org/) - версия 18+
2. **Установите PostgreSQL** (https://www.postgresql.org/download/windows/) - версия 13+
3. **Создайте базу данных** (см. Шаг 3.3 ниже)
4. **Откройте PowerShell** в папке проекта
5. **Выполните команды:**
   ```powershell
   npm install
   cd client
   npm install
   cd ..
   Copy-Item env.example .env
   # Отредактируйте .env и укажите пароль PostgreSQL
   npx prisma generate
   npx prisma migrate dev
   npx prisma db seed
   npm run dev
   ```
6. **Откройте браузер:** http://localhost:3000
7. **Войдите:** owner@dragonacademy.com / password123

**Готово!** Проект использует PostgreSQL по умолчанию.

---

## 📖 Подробная инструкция

## 📋 Шаг 1: Установка необходимого ПО

### 1.1. Установка Node.js

1. Перейдите на https://nodejs.org/
2. Скачайте **LTS версию** (рекомендуется 18.x или выше)
3. Запустите установщик и следуйте инструкциям
4. Убедитесь, что опция "Add to PATH" включена
5. После установки откройте **PowerShell** или **Command Prompt** и проверьте:
   ```powershell
   node --version
   npm --version
   ```
   Должны отобразиться версии (например, v18.17.0 и 9.6.7)

### 1.2. Установка PostgreSQL

**⚠️ ВАЖНО:** Проект использует **PostgreSQL** по умолчанию. Установка PostgreSQL обязательна!

1. Перейдите на https://www.postgresql.org/download/windows/
2. Скачайте установщик PostgreSQL (рекомендуется версия 13 или выше)
3. Запустите установщик:
   - Выберите компоненты: **PostgreSQL Server**, **pgAdmin 4**, **Command Line Tools**
   - Установите пароль для пользователя `postgres` (**запомните его!** - он понадобится для настройки)
   - Порт по умолчанию: **5432** (можно оставить)
   - Локаль: можно оставить по умолчанию
4. После установки PostgreSQL должен запуститься автоматически

**Проверка установки:**
```powershell
# Проверьте, что служба PostgreSQL запущена
Get-Service -Name postgresql*

# Должна быть служба типа: postgresql-x64-13 или подобная
```

Если служба не запущена, запустите её:
```powershell
Start-Service postgresql-x64-13  # Замените на вашу версию
```

### 1.3. Установка Git (если еще не установлен)

1. Перейдите на https://git-scm.com/download/win
2. Скачайте и установите Git для Windows
3. При установке выберите "Git from the command line and also from 3rd-party software"

## 📦 Шаг 2: Клонирование и подготовка проекта

### 2.1. Откройте PowerShell или Command Prompt

Нажмите `Win + X` и выберите "Windows PowerShell" или "Terminal"

### 2.2. Перейдите в нужную директорию и клонируйте проект

```powershell
# Перейдите в нужную папку (например, Desktop)
cd C:\Users\ВашеИмя\Desktop

# Если проект уже скачан, просто перейдите в его папку
cd CRM-main
```

### 2.3. Установка зависимостей

```powershell
# Установка зависимостей backend
npm install

# Установка зависимостей frontend
cd client
npm install
cd ..
```

**Примечание:** Установка может занять несколько минут. Если возникают ошибки с правами доступа, запустите PowerShell **от имени администратора**.

## 🗄️ Шаг 3: Настройка базы данных

### 3.1. Создание файла .env

```powershell
# Скопируйте пример файла окружения
Copy-Item env.example .env
```

### 3.2. Настройка .env файла

Откройте файл `.env` в любом текстовом редакторе (Notepad, VS Code и т.д.)

**Важно:** Замените `ВАШ_ПАРОЛЬ` на пароль, который вы установили при установке PostgreSQL!

```env
# Database (PostgreSQL)
# Замените ВАШ_ПАРОЛЬ на пароль пользователя postgres
DATABASE_URL="postgresql://postgres:ВАШ_ПАРОЛЬ@localhost:5432/martial_arts_crm?schema=public"
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_EXPIRES_IN="7d"
PORT=3001
NODE_ENV="development"
CORS_ORIGIN="http://localhost:3000"
```

**Пример:**
Если ваш пароль PostgreSQL - `mypassword123`, то строка будет:
```env
DATABASE_URL="postgresql://postgres:mypassword123@localhost:5432/martial_arts_crm?schema=public"
```

### 3.3. Создание базы данных PostgreSQL

**Способ 1: Через pgAdmin 4**
1. Откройте pgAdmin 4 (должен быть установлен вместе с PostgreSQL)
2. Подключитесь к серверу (пароль, который вы установили при установке)
3. Правой кнопкой на "Databases" → "Create" → "Database"
4. Имя базы: `martial_arts_crm`
5. Нажмите "Save"

**Способ 2: Через командную строку**
```powershell
# Откройте psql (должен быть в PATH после установки PostgreSQL)
psql -U postgres

# В консоли PostgreSQL выполните:
CREATE DATABASE martial_arts_crm;
\q
```

## 🔧 Шаг 4: Настройка Prisma и миграции

### 4.1. Генерация Prisma клиента

```powershell
npx prisma generate
```

### 4.2. Применение миграций

```powershell
npx prisma migrate dev
```

При первом запуске вас могут спросить имя миграции - введите `init` или просто нажмите Enter.

### 4.3. Заполнение тестовыми данными (опционально)

```powershell
npx prisma db seed
```

Это создаст тестовые аккаунты:
- **Владелец:** owner@dragonacademy.com / password123
- **Администратор:** admin@dragonacademy.com / password123
- **Тренеры:** trainer1@dragonacademy.com / password123

## 🚀 Шаг 5: Запуск проекта

### Вариант 1: Запуск всего проекта одной командой (рекомендуется)

```powershell
npm run dev
```

Эта команда запустит:
- Backend сервер на http://localhost:3001
- Frontend приложение на http://localhost:3000

### Вариант 2: Запуск по отдельности

**Терминал 1 - Backend:**
```powershell
npm run dev:server
```

**Терминал 2 - Frontend:**
Откройте новый терминал PowerShell и выполните:
```powershell
cd C:\Users\ВашеИмя\Desktop\CRM-main
npm run dev:client
```

## ✅ Шаг 6: Проверка работы

1. Откройте браузер и перейдите на:
   - **Frontend:** http://localhost:3000
   - **Backend API:** http://localhost:3001/health

2. Если все работает, вы увидите:
   - Страницу входа в систему
   - В ответе на `/health` будет JSON с информацией о сервере

3. Войдите с тестовым аккаунтом:
   - Email: `owner@dragonacademy.com`
   - Пароль: `password123`

## 🛠️ Полезные команды

```powershell
# Просмотр базы данных через Prisma Studio
npx prisma studio

# Остановка процессов (если нужно)
# Нажмите Ctrl+C в терминале, где запущен проект

# Пересоздание базы данных (если что-то пошло не так)
npx prisma migrate reset
npx prisma db seed
```

## ❗ Решение проблем

### Проблема: "Port 3000/3001 already in use"

```powershell
# Найти процесс, использующий порт
netstat -ano | findstr :3001
netstat -ano | findstr :3000

# Убить процесс (замените PID на номер процесса из предыдущей команды)
taskkill /PID <PID> /F
```

### Проблема: "Cannot find module" или ошибки установки

```powershell
# Очистите кэш и переустановите зависимости
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
cd client
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
cd ..
```

### Проблема: Ошибки подключения к PostgreSQL

1. Убедитесь, что служба PostgreSQL запущена:
   ```powershell
   Get-Service -Name postgresql*
   ```

2. Если служба не запущена:
   ```powershell
   Start-Service postgresql-x64-13  # Замените на вашу версию
   ```

3. Проверьте правильность пароля в `.env` файле

### Проблема: "Prisma Client not generated"

```powershell
# Перегенерируйте Prisma клиент
npx prisma generate
```

### Проблема: Ошибки при миграциях

```powershell
# Сбросьте базу данных и примените миграции заново
npx prisma migrate reset
npx prisma migrate dev
npx prisma db seed
```

## 📝 Дополнительные настройки

### Настройка VS Code (опционально)

Если используете VS Code, рекомендуется установить расширения:
- Prisma
- ESLint
- Prettier
- TypeScript и JavaScript Language Features

### Настройка Git (опционально)

```powershell
git config --global user.name "Ваше Имя"
git config --global user.email "ваш@email.com"
```

## 🎯 Следующие шаги

После успешного запуска:
1. Изучите документацию в `README.md`
2. Ознакомьтесь с API в разделе "API Документация"
3. Настройте SMTP для отправки email (если нужно)
4. Настройте production переменные окружения

---

**Готово!** Теперь ваш проект должен работать. Если возникли проблемы, проверьте логи в терминале и убедитесь, что все шаги выполнены правильно.

