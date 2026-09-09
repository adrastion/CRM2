# ПРОФСПОРТСРМ

Полнофункциональная CRM-система для управления спортивными школами и секциями с мультитенантной архитектурой (SaaS).

## 🥋 Особенности

### Основные модули:
- **Мультитенантная система** - Изоляция данных между школами
- **Единый вход и смена аккаунтов** - один логин для школы / клиента / супер-админа; переключение сохранённых аккаунтов в профиле
- **Управление клиентами** - карточки учеников, статусы лидов, пробные занятия
- **Управление сотрудниками** - тренеры и администраторы; один email/телефон тренера может работать в нескольких школах
- **Группы и расписание** - организация занятий; при выборе группы подставляется её тренер
- **Учет посещаемости** - отслеживание посещений и выгрузка в Excel (по тренеру, клиенту, группе)
- **Финансовый модуль** - абонементы, платежи, ежемесячные платежи, перерасчет
- **Система нормативов** - привязка нормативов к группам, отслеживание результатов
- **Замена тренера** - автоматическое предложение замены при конфликтах с соревнованиями
- **Расчет зарплаты** - гибкая система начисления (в т.ч. схемы на карточке группы)
- **Аналитика** - дашборд с ключевыми метриками
- **Панель супер-админа** - школы, тарифы, финансы, заметки разработок, привязка OWNER школы к супер-админу

### Технические особенности:
- **Безопасность** - JWT аутентификация, хеширование паролей
- **Масштабируемость** - Мультитенантная архитектура
- **Современный UI** - Material-UI с адаптивным дизайном
- **API-first** - RESTful архитектура с валидацией

## 🚀 Технологический стек

### Backend:
- **Node.js** + **Express** + **TypeScript**
- **PostgreSQL** с **Prisma ORM**
- **JWT** аутентификация
- **bcryptjs** для хеширования паролей
- **Joi** для валидации данных
- **Nodemailer** для email уведомлений
- **node-cron** для автоматических задач (создание ежемесячных платежей)
- **express-rate-limit** для защиты от перегрузки API

### Frontend:
- **React** + **TypeScript**
- **Material-UI** для компонентов
- **React Router** для навигации
- **Axios** для API запросов
- **Context API** для управления состоянием

## 📋 Требования

- Node.js 18+ 
- PostgreSQL 13+ (обязательно)
- npm или yarn

## 🛠 Установка и запуск

### 1. Клонирование репозитория
```bash
git clone <repository-url>
cd CRM
```

### 2. Установка зависимостей
```bash
# Backend
npm install

# Frontend
cd client
npm install
cd ..
```

### 3. Настройка базы данных

**⚠️ ВАЖНО:** Проект использует PostgreSQL по умолчанию. Установка PostgreSQL обязательна!

**Установка PostgreSQL:**

```bash
# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# macOS
brew install postgresql
brew services start postgresql

# Windows
# Скачайте установщик с https://www.postgresql.org/download/windows/
```

**Создание базы данных:**

```bash
# Войти в PostgreSQL
sudo -u postgres psql
# Или на Windows/macOS: psql -U postgres

# Создать базу данных и пользователя
CREATE DATABASE martial_arts_crm;
CREATE USER crm_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE martial_arts_crm TO crm_user;
\c martial_arts_crm
GRANT ALL ON SCHEMA public TO crm_user;
\q
```

**Для Windows:** См. подробную инструкцию в `WINDOWS_SETUP.md`

**Настройка окружения:**

```bash
# Скопируйте файл окружения
cp env.example .env

# Отредактируйте .env файл с вашими настройками PostgreSQL
```

### 4. Настройка переменных окружения
Отредактируйте файл `.env`:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/martial_arts_crm?schema=public"
JWT_SECRET="your-super-secret-jwt-key-here"
JWT_EXPIRES_IN="7d"
PORT=3001
NODE_ENV="development"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
FROM_EMAIL="noreply@martialartscrm.com"
CORS_ORIGIN="http://localhost:3000"

# Яндекс Почта (пример): создайте пароль приложения в настройках Яндекса
# SMTP_HOST=smtp.yandex.ru
# SMTP_PORT=587
# # или 465 — тогда соединение идёт с secure: true автоматически
# SMTP_USER=your@yandex.ru
# SMTP_PASS=пароль-приложения
# FROM_EMAIL=your@yandex.ru

# Настройки cron-задач (опционально)
CRON_SCHEDULE="0 0 * * *"  # Расписание для ежемесячных платежей (по умолчанию: каждый день в полночь)
CRON_TIMEZONE="Europe/Moscow"  # Часовой пояс для cron-задач
```

### 5. Запуск миграций и сидов
```bash
# Генерация Prisma клиента
npx prisma generate

# Запуск миграций
npx prisma migrate dev

# Заполнение тестовыми данными
npx prisma db seed
```

### 6. Создание супер-администратора

Супер-администратор необходим для управления платформой (все аккаунты, финансы, маркетологи).

**Способ 1: Использование скрипта (рекомендуется)**

```bash
# Запуск интерактивного скрипта
npx ts-node scripts/create-super-admin.ts
```

Скрипт запросит:
- Email
- Пароль
- Имя
- Фамилию

**Способ 2: Создание через SQL (альтернативный)**

Если скрипт не работает, можно создать супер-администратора напрямую в базе данных:

```sql
-- Подключитесь к базе данных
psql -U crm_user -d martial_arts_crm

-- Создайте супер-администратора
-- ВАЖНО: Замените 'your-password-hash' на хеш пароля, полученный через bcrypt
-- Для генерации хеша можно использовать Node.js:
-- const bcrypt = require('bcryptjs');
-- const hash = await bcrypt.hash('your-password', 10);
-- console.log(hash);

INSERT INTO super_admins (id, email, password, "firstName", "lastName", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'admin@platform.com',
  '$2a$10$YOUR_PASSWORD_HASH_HERE',  -- Замените на реальный хеш пароля
  'Admin',
  'Super',
  true,
  NOW(),
  NOW()
);
```

**После создания супер-администратора:**
- Войдите через единую страницу входа: http://localhost:3000/auth
- Используйте указанные при создании email и пароль
- Старый путь `/super-admin/login` перенаправляет на `/auth`

### 7. Запуск 
```bash
# Запуск в режиме разработки (backend + frontend)
npm run dev

# Или запуск по отдельности:
# Backend
npm run dev:server

# Frontend (в отдельном терминале)
npm run dev:client
```

## 🎯 Тестовые аккаунты

После запуска сидов будут созданы следующие тестовые аккаунты:

### Владелец школы:
- **Email:** owner@dragonacademy.com
- **Пароль:** password123
- **Роль:** OWNER

### Администратор:
- **Email:** admin@dragonacademy.com
- **Пароль:** password123
- **Роль:** ADMIN

### Тренеры:
- **Email:** trainer1@dragonacademy.com
- **Пароль:** password123
- **Роль:** TRAINER
- **URL:** http://localhost:3000/login

- **Email:** trainer2@dragonacademy.com
- **Пароль:** password123
- **Роль:** TRAINER
- **URL:** http://localhost:3000/login

### Администратор промокодов:
- **Email:** promo-admin@dragonacademy.com
- **Пароль:** password123
- **Роль:** PROMO_CODE_ADMIN
- **URL:** http://localhost:3000/promo-code-admin/login

### Маркетолог:
- **Email:** marketer@dragonacademy.com
- **Пароль:** password123
- **Тип:** MARKETER
- **URL:** http://localhost:3000/marketer/login

### Медиа-партнер:
- **Email:** media-partner@dragonacademy.com
- **Пароль:** password123
- **Тип:** MEDIA_PARTNER
- **URL:** http://localhost:3000/marketer/login

### Клиенты:
- Клиенты могут регистрироваться самостоятельно через `/client/register`
- После регистрации требуется подтверждение администратором
- URL для входа: http://localhost:3000/client/login
- URL для регистрации: http://localhost:3000/client/register

### Тенант:
- **Название:** Спортивная школа
- **Поддомен:** profsportcrm.ru

### Супер-администратор (владелец платформы):
- **URL:** http://localhost:3000/auth (единый вход) → панель `/admin/dashboard`
- **Доступ:** Панель управления всеми аккаунтами (тенантами)
- **Функции:** статистика, тарифы, финансы, маркетологи, нагрузка сервера, заметки разработок, привязка OWNER школы к супер-админу со сменой аккаунта
- **Создание:** `npx ts-node scripts/create-super-admin.ts` (см. раздел выше)

### Выбор типа пользователя / смена аккаунта:
- Вход через `/auth` (email или телефон) с выбором организации/роли при нескольких совпадениях
- В меню профиля: список сохранённых аккаунтов, «Добавить аккаунт», выход
- Связанные OWNER ↔ супер-админ после логина сразу доступны для переключения школа ↔ панель супер-админа

## 📚 API Документация

### Аутентификация
```
POST /api/auth/identify - Определение аккаунтов по email/телефону
POST /api/auth/unified-login - Единый вход (пароль + выбор аккаунта при необходимости)
POST /api/auth/select-account - Выбор организации/роли после пароля
POST /api/auth/register - Регистрация нового тенанта
POST /api/auth/login - Классический вход сотрудника (тенант)
POST /api/auth/logout - Выход из системы
GET  /api/auth/profile - Получение профиля пользователя
PUT  /api/auth/profile - Обновление профиля
POST /api/auth/change-password - Смена пароля
POST /api/auth/users - Создание пользователя (администратора или тренера)
PUT  /api/auth/users/:id - Обновление пользователя (только для владельца)
```

### Клиентская авторизация
```
POST /api/client-auth/register - Регистрация клиента
POST /api/client-auth/login - Вход клиента в систему
GET  /api/client-auth/profile - Профиль клиента
PUT  /api/client-auth/profile - Обновление профиля клиента
```

### Клиенты
```
GET    /api/clients - Список клиентов
GET    /api/clients/:id - Получение клиента
POST   /api/clients - Создание клиента
PUT    /api/clients/:id - Обновление клиента
DELETE /api/clients/:id - Удаление клиента
POST   /api/clients/:id/trial - Запись лида на пробное занятие (временное членство в группе)
POST   /api/clients/:id/achievements - Добавление достижения
DELETE /api/clients/:id/achievements/:achievementId - Удаление достижения
GET    /api/clients/:id/stats - Статистика клиента
```

### Сотрудники (Тренеры и Администраторы)
```
GET    /api/trainers?includeAdmins=true - Список сотрудников (тренеры и администраторы)
GET    /api/trainers/:id - Получение сотрудника
POST   /api/trainers - Создание тренера
PUT    /api/trainers/:id - Обновление тренера
DELETE /api/trainers/:id - Удаление тренера
POST   /api/auth/users - Создание администратора (только для владельца)
PUT    /api/auth/users/:id - Обновление пользователя (только для владельца)
```

### Группы
```
GET    /api/groups - Список групп
GET    /api/groups/:id - Получение группы
POST   /api/groups - Создание группы
PUT    /api/groups/:id - Обновление группы
DELETE /api/groups/:id - Удаление группы
```
**Новые возможности:**
- Настройка ежемесячной оплаты
- Настройка зарплаты тренера (процент, фиксированная, за посещение)
- Установка сроков оплаты
- Привязка нормативов к группам

### Тренировки
```
GET    /api/trainings - Список тренировок
GET    /api/trainings/:id - Получение тренировки
POST   /api/trainings - Создание тренировки
PUT    /api/trainings/:id - Обновление тренировки
DELETE /api/trainings/:id - Удаление тренировки
```
**Новые возможности:**
- Индивидуальные и групповые тренировки
- Настройка цены и заработка тренера для индивидуальных тренировок
- Замена тренера с автоматическим расчетом зарплаты
- Проверка конфликтов с соревнованиями

### Посещаемость
```
GET    /api/attendances - Список посещений
GET    /api/attendances/:id - Получение посещения
POST   /api/attendances - Создание посещения
PUT    /api/attendances/:id - Обновление посещения
DELETE /api/attendances/:id - Удаление посещения
GET    /api/attendances/export/excel - Выгрузка посещаемости в Excel
       ?scope=trainer|client|group&id=...&from=YYYY-MM-DD&to=YYYY-MM-DD
```

### Платежи
```
GET    /api/payments - Список платежей
GET    /api/payments/:id - Получение платежа
POST   /api/payments - Создание платежа
PUT    /api/payments/:id - Обновление платежа
DELETE /api/payments/:id - Удаление платежа
POST   /api/payments/monthly/create - Создание ежемесячных платежей для всех групп
POST   /api/payments/:id/recalculate - Перерасчет ежемесячного платежа (только для владельца/администратора)
```

### Нормативы
```
GET    /api/standards - Список нормативов (с фильтрацией по группам)
GET    /api/standards/:id - Получение норматива
POST   /api/standards - Создание норматива
PUT    /api/standards/:id - Обновление норматива
DELETE /api/standards/:id - Удаление норматива
GET    /api/clients/:id/standards - Нормативы клиента
POST   /api/clients/:id/standards - Добавление норматива клиенту
```

### Отчеты
```
GET /api/reports/dashboard - Статистика дашборда
GET /api/reports/revenue - Отчет по доходам
GET /api/reports/attendance - Отчет по посещаемости
GET /api/reports/trainer-salary - Отчет по зарплатам тренеров
```

### Супер-администратор (Панель владельца платформы)
```
POST /api/super-admin/auth/login - Вход супер-администратора (также через единый /api/auth)
GET  /api/admin-dashboard - Статистика дашборда
GET  /api/admin-dashboard/tenants - Список всех аккаунтов
GET  /api/admin-dashboard/tenants/:tenantId - Детали аккаунта
PUT  /api/admin-dashboard/tenants/:tenantId/plan - Изменение тарифа
POST /api/admin-dashboard/tenants/:tenantId/link-super-admin - Привязать OWNER школы к супер-админу
DELETE /api/admin-dashboard/tenants/:tenantId/link-super-admin - Отвязать
GET  /api/admin-dashboard/dev-notes - Заметки разработок
POST /api/admin-dashboard/dev-notes - Создать заметку
PUT  /api/admin-dashboard/dev-notes/:id - Изменить заметку
DELETE /api/admin-dashboard/dev-notes/:id - Удалить заметку
GET  /api/admin-dashboard/transactions - История транзакций
POST /api/admin-dashboard/expenses - Создание расхода
POST /api/admin-dashboard/marketers/pay - Выплата маркетологу
PUT  /api/admin-dashboard/settings - Настройки (резерв средств)
```

## 🏗 Архитектура

### Мультитенантность
Система использует подход "Shared Database, Shared Schema" с изоляцией данных на уровне приложения:
- Каждая запись содержит `tenantId`
- Все запросы фильтруются по тенанту
- Строгая проверка прав доступа

### Роли пользователей
- **SUPER_ADMIN** - Супер-администратор платформы (владелец сайта, управление всеми аккаунтами, финансами, маркетологами)
- **OWNER** - Владелец школы (полный доступ: отмена финансовых операций, тариф/подписка, создание администраторов, школьные финансовые настройки)
- **ADMIN** - Администратор (операционное управление и финансы, кроме отмены операций; может создавать только тренеров)
- **TRAINER** - Тренер (ограниченный доступ, видит только свои группы или все группы при соответствующей настройке)
- **CLIENT** - Клиент (доступ к личному кабинету)

### Безопасность
- JWT токены с истечением срока действия
- Хеширование паролей с bcrypt
- Валидация всех входных данных
- Защита от XSS, CSRF, SQL-инъекций
- Rate limiting для API

## 📊 База данных

### Основные таблицы:
- `tenants` - Тенанты (школы)
- `users` - Пользователи системы (владельцы, администраторы, тренеры)
- `clients` - Клиенты (ученики)
- `trainers` - Тренеры
- `groups` - Группы (с настройками ежемесячной оплаты и зарплаты тренера)
- `branches` - Филиалы
- `trainings` - Тренировки (групповые и индивидуальные)
- `group_memberships` - Членство в группах (в т.ч. пробное: `isTrial`, `trialTrainingId`)
- `attendances` - Посещаемость
- `payments` - Платежи (включая ежемесячные)
- `memberships` - Типы абонементов
- `achievements` - Достижения клиентов
- `standards` - Нормативы (шаблоны)
- `client_standards` - Записанные нормативы клиентов
- `standard_groups` - Связь нормативов с группами
- `competitions` - Соревнования
- `super_admins` - Супер-администраторы платформы (`linkedUserId` — связь с OWNER школы)
- `super_admin_dev_notes` - Заметки разработок супер-админов
- `super_admin_settings` - Настройки супер-администратора (резерв средств)
- `admin_transactions` - Транзакции супер-администратора (расходы, выплаты маркетологам)
- `subscriptions` - Подписки школ на тарифы
- `subscription_payments` - Платежи за подписки
- `marketers` - Маркетологи
- `promo_codes` - Промокоды

## 🚀 Развертывание

### Production сборка
```bash
# Backend
npm run build:server

# Frontend
npm run build:client
```

### Переменные окружения для production
```env
NODE_ENV=production
DATABASE_URL="your-production-database-url"
JWT_SECRET="your-production-jwt-secret"
SMTP_HOST="your-smtp-host"
SMTP_USER="your-smtp-user"
SMTP_PASS="your-smtp-password"
CORS_ORIGIN="https://your-domain.com"
```

## 🤝 Вклад в проект

1. Fork репозитория
2. Создайте feature branch (`git checkout -b feature/amazing-feature`)
3. Commit изменения (`git commit -m 'Add amazing feature'`)
4. Push в branch (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

## 📝 Лицензия

Этот проект лицензирован под MIT License - см. файл [LICENSE](LICENSE) для деталей.

## ✨ Новые функции

### Единый вход и несколько аккаунтов
- Вход по email или телефону через `/auth`
- Сохранённые аккаунты в меню профиля с быстрым переключением
- Один email/телефон тренера можно использовать в нескольких школах (уникальность email в рамках тенанта)

### Клиенты: лиды и пробные занятия
- Статусы учёта: лид / незарегистрированный / зарегистрированный
- Пробное занятие (`isTrial`) — временное членство в группе без смены статуса лида
- Автоочистка истёкших пробных членств (cron)

### Посещаемость и расписание
- Выгрузка посещаемости в Excel по тренеру, клиенту или группе с выбором периода
- Имя файла содержит ФИО (или название группы) и даты «с–по»
- При выборе группы в расписании автоматически подставляется тренер группы

### Управление сотрудниками
- Раздел «Сотрудники» объединяет тренеров и администраторов
- Владелец может создавать администраторов
- Администраторы могут создавать только тренеров

### Финансовый модуль
- **Ежемесячные платежи** — автоматическое создание для групп с ежемесячной оплатой
- **Перерасчет платежей** — изменение суммы (владелец/администратор)
- **Отображение задолженности** — просроченные платежи клиентов
- **Зарплата тренера** — схемы начисления, в т.ч. настройки на карточке группы

### Расписание и тренировки
- Индивидуальные и групповые тренировки
- Настройка цены и заработка тренера для индивидуальных занятий
- Замена тренера с расчётом зарплаты
- Проверка конфликтов с соревнованиями

### Нормативы
- Привязка к группам и фильтрация для клиентов
- Отслеживание даты последнего изменения

### Автоматизация
- Cron: ежемесячные платежи, уведомления о тренировках, очистка пробных членств и служебных данных

### Панель супер-администратора
- Все аккаунты школ, тарифы, финансы, маркетологи, нагрузка сервера
- **Заметки разработок** — общие задачи со статусами «Идея» / «В работе» / «Готово»
- **Привязка OWNER** — сделать владельца школы супер-админом и переключаться между школой и панелью как между аккаунтами
- Support Hub: обращения, записи дизайнеров, база знаний

## 🎯 Roadmap

### Планируемые функции:
- [ ] Мобильное приложение
- [ ] Интеграция с платежными системами
- [ ] Видео-уроки и онлайн тренировки
- [x] Система уведомлений (push / напоминания о тренировках)
- [x] Экспорт данных (клиенты, посещаемость в Excel)
- [ ] API для сторонних интеграций
- [ ] Многоязычность
- [ ] Темная тема

---

**ПРОФСПОРТСРМ** - Управляйте своей спортивной школой как профессионал! 🏆
