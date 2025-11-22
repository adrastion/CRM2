# Martial Arts CRM

Полнофункциональная CRM-система для управления секциями единоборств с мультитенантной архитектурой (SaaS).

## 🥋 Особенности

### Основные модули:
- **Мультитенантная система** - Изоляция данных между школами
- **Управление клиентами** - Подробные карточки учеников с достижениями
- **Система тренеров** - Управление персоналом и расчет зарплаты
- **Группы и расписание** - Организация занятий и календарь
- **Учет посещаемости** - Отслеживание посещений учеников
- **Финансовый модуль** - Абонементы, платежи, отчеты
- **Аналитика** - Дашборд с ключевыми метриками

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

### 6. Запуск приложения
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

### Тенант:
- **Название:** Школа единоборств
- **Поддомен:** profsportcrm.ru

## 📚 API Документация

### Аутентификация
```
POST /api/auth/register - Регистрация нового тенанта
POST /api/auth/login - Вход в систему
POST /api/auth/logout - Выход из системы
GET  /api/auth/profile - Получение профиля пользователя
PUT  /api/auth/profile - Обновление профиля
POST /api/auth/change-password - Смена пароля
```

### Клиенты
```
GET    /api/clients - Список клиентов
GET    /api/clients/:id - Получение клиента
POST   /api/clients - Создание клиента
PUT    /api/clients/:id - Обновление клиента
DELETE /api/clients/:id - Удаление клиента
POST   /api/clients/:id/achievements - Добавление достижения
DELETE /api/clients/:id/achievements/:achievementId - Удаление достижения
GET    /api/clients/:id/stats - Статистика клиента
```

### Тренеры
```
GET    /api/trainers - Список тренеров
GET    /api/trainers/:id - Получение тренера
POST   /api/trainers - Создание тренера
PUT    /api/trainers/:id - Обновление тренера
DELETE /api/trainers/:id - Удаление тренера
```

### Группы
```
GET    /api/groups - Список групп
GET    /api/groups/:id - Получение группы
POST   /api/groups - Создание группы
PUT    /api/groups/:id - Обновление группы
DELETE /api/groups/:id - Удаление группы
```

### Тренировки
```
GET    /api/trainings - Список тренировок
GET    /api/trainings/:id - Получение тренировки
POST   /api/trainings - Создание тренировки
PUT    /api/trainings/:id - Обновление тренировки
DELETE /api/trainings/:id - Удаление тренировки
```

### Посещаемость
```
GET    /api/attendances - Список посещений
GET    /api/attendances/:id - Получение посещения
POST   /api/attendances - Создание посещения
PUT    /api/attendances/:id - Обновление посещения
DELETE /api/attendances/:id - Удаление посещения
```

### Платежи
```
GET    /api/payments - Список платежей
GET    /api/payments/:id - Получение платежа
POST   /api/payments - Создание платежа
PUT    /api/payments/:id - Обновление платежа
DELETE /api/payments/:id - Удаление платежа
```

### Отчеты
```
GET /api/reports/dashboard - Статистика дашборда
GET /api/reports/revenue - Отчет по доходам
GET /api/reports/attendance - Отчет по посещаемости
GET /api/reports/trainer-salary - Отчет по зарплатам тренеров
```

## 🏗 Архитектура

### Мультитенантность
Система использует подход "Shared Database, Shared Schema" с изоляцией данных на уровне приложения:
- Каждая запись содержит `tenantId`
- Все запросы фильтруются по тенанту
- Строгая проверка прав доступа

### Роли пользователей
- **OWNER** - Владелец школы (полный доступ)
- **ADMIN** - Администратор (управление без финансов)
- **TRAINER** - Тренер (ограниченный доступ)

### Безопасность
- JWT токены с истечением срока действия
- Хеширование паролей с bcrypt
- Валидация всех входных данных
- Защита от XSS, CSRF, SQL-инъекций
- Rate limiting для API

## 📊 База данных

### Основные таблицы:
- `tenants` - Тенанты (школы)
- `users` - Пользователи системы
- `clients` - Клиенты (ученики)
- `trainers` - Тренеры
- `groups` - Группы
- `branches` - Филиалы
- `trainings` - Тренировки
- `attendances` - Посещаемость
- `payments` - Платежи
- `memberships` - Типы абонементов
- `achievements` - Достижения клиентов

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

## 🎯 Roadmap

### Планируемые функции:
- [ ] Мобильное приложение
- [ ] Интеграция с платежными системами
- [ ] Видео-уроки и онлайн тренировки
- [ ] Система уведомлений
- [ ] Экспорт данных
- [ ] API для сторонних интеграций
- [ ] Многоязычность
- [ ] Темная тема

---

**ПрофСпортСРМ** - Управляйте своей школой единоборств как профессионал! 🥋
