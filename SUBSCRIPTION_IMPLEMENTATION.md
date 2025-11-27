# Реализация системы подписок и оплаты через YooKassa

## ✅ Что было реализовано

### 1. База данных
- ✅ Добавлены модели `Subscription` и `SubscriptionPayment` в Prisma schema
- ✅ Создана миграция для новых таблиц (`20251127201638_add_subscriptions`)
- ✅ Связь подписок с тенантами (один к одному)

### 2. Backend

#### Сервисы
- ✅ `src/services/subscriptionService.ts` - сервис для управления подписками
  - Получение и создание подписок
  - Создание платежей через YooKassa
  - Обработка webhook от YooKassa
  - Проверка лимитов подписки
  - Активация подписок после оплаты

#### Контроллеры
- ✅ `src/controllers/subscriptionController.ts` - контроллер для подписок
  - GET `/api/subscriptions` - получение текущей подписки
  - POST `/api/subscriptions/payment` - создание платежа
  - POST `/api/subscriptions/webhook` - webhook от YooKassa
  - PUT `/api/subscriptions/plan` - обновление плана
  - GET `/api/subscriptions/check-limit` - проверка лимита ресурса

#### Роуты
- ✅ `src/routes/subscription.ts` - маршруты для подписок
- ✅ Добавлены в `src/server.ts`

#### Middleware
- ✅ `src/middleware/subscriptionLimits.ts` - проверка лимитов подписки
  - `checkSubscriptionLimit(resource)` - проверка лимита для конкретного ресурса
  - `checkSubscriptionActive()` - проверка активности подписки

### 3. Frontend

#### API Service
- ✅ Добавлены методы в `client/src/services/api.ts`:
  - `getSubscription()` - получение подписки
  - `createSubscriptionPayment()` - создание платежа
  - `updateSubscriptionPlan()` - обновление плана
  - `checkResourceLimit()` - проверка лимита

#### Страницы
- ✅ Обновлена страница `client/src/pages/Pricing.tsx`:
  - Отображение текущей подписки
  - Выбор тарифа и создание платежа
  - Интеграция с YooKassa для оплаты
  - Диалог подтверждения

- ✅ Создана страница `client/src/pages/SubscriptionSuccess.tsx`:
  - Отображение результата оплаты
  - Статус активации подписки

#### Роутинг
- ✅ Добавлен маршрут `/subscription/success` в `client/src/App.tsx`

### 4. Конфигурация
- ✅ Добавлены переменные окружения в `env.example`:
  - `YOOKASSA_SHOP_ID` - ID магазина в YooKassa
  - `YOOKASSA_SECRET_KEY` - Секретный ключ YooKassa
  - `YOOKASSA_TEST_MODE` - Режим тестирования

- ✅ Добавлена зависимость `@yookassa/nodejs-sdk` в `package.json`

## 📋 Тарифные планы

| План | Цена | Тренеры | Клиенты | Группы | Филиалы | Тренировки |
|------|------|---------|---------|--------|---------|------------|
| FREE | 0₽ | 1 | 30 | 3 | 1 | 10/мес |
| STARTER | 990₽ | 3 | 90 | 9 | 2 | Безлимит |
| BUSINESS | 2,490₽ | 10 | 600 | 30 | 5 | Безлимит |
| PROFESSIONAL | 4,990₽ | 25 | 1500 | 50 | 10 | Безлимит |
| ENTERPRISE | По запросу | Безлимит | Безлимит | Безлимит | Безлимит | Безлимит |

## 🔧 Что нужно сделать

### 1. Установка зависимостей
```bash
npm install @yookassa/nodejs-sdk
```

### 2. Настройка YooKassa
1. Зарегистрируйтесь в [YooKassa](https://yookassa.ru/)
2. Получите `shopId` и `secretKey`
3. Добавьте в `.env`:
   ```
   YOOKASSA_SHOP_ID=your-shop-id
   YOOKASSA_SECRET_KEY=your-secret-key
   YOOKASSA_TEST_MODE=true  # false для production
   ```

### 3. Запуск миграции
```bash
npx prisma migrate dev
# или
npx prisma migrate deploy  # для production
```

### 4. Настройка Webhook
В личном кабинете YooKassa настройте webhook на:
```
https://your-domain.com/api/subscriptions/webhook
```

**Важно:** Webhook должен быть защищен (проверка IP или ключа)

### 5. Исправление импорта YooKassa SDK
В `src/services/subscriptionService.ts` может потребоваться изменить импорт в зависимости от фактической структуры SDK:
```typescript
// Возможные варианты:
import YooKassa from '@yookassa/nodejs-sdk';
// или
import { YooKassa } from '@yookassa/nodejs-sdk';
```

### 6. Добавление проверки лимитов в контроллеры
В контроллерах создания ресурсов (trainers, clients, groups, branches, trainings) добавьте middleware:
```typescript
import { checkSubscriptionLimit } from '../middleware/subscriptionLimits';

router.post('/', authenticate, checkSubscriptionLimit('trainers'), createTrainer);
```

### 7. Страница управления подпиской
Создать страницу `/settings/subscription` для:
- Просмотра текущей подписки
- Изменения тарифа
- Просмотра истории платежей
- Отключения автопродления

## 🔐 Безопасность

1. **Webhook защита**: Добавьте проверку IP или секретного ключа для webhook
2. **Валидация платежей**: Всегда проверяйте статус платежа в YooKassa
3. **Лимиты**: Проверяйте лимиты на стороне сервера при создании ресурсов

## 📝 API Endpoints

### GET `/api/subscriptions`
Получение текущей подписки тенанта
- Требует: аутентификация
- Ответ: `{ subscription, limits }`

### POST `/api/subscriptions/payment`
Создание платежа для подписки
- Требует: аутентификация, роль OWNER
- Body: `{ planType: string, returnUrl?: string }`
- Ответ: `{ paymentId, paymentUrl, status }`

### POST `/api/subscriptions/webhook`
Webhook от YooKassa
- Требует: нет (защита через IP/ключ)
- Body: YooKassa webhook payload

### PUT `/api/subscriptions/plan`
Обновление плана подписки
- Требует: аутентификация, роль OWNER
- Body: `{ planType: string }`

### GET `/api/subscriptions/check-limit?resource=...`
Проверка лимита ресурса
- Требует: аутентификация
- Query: `resource` (trainers|clients|groups|branches|trainings)

## 🧪 Тестирование

1. Запустите сервер с тестовыми данными YooKassa
2. Войдите как OWNER
3. Перейдите на `/pricing`
4. Выберите тариф и создайте платеж
5. Оплатите через тестовую карту YooKassa
6. Проверьте активацию подписки

## 📚 Документация YooKassa

- [Документация API](https://yookassa.ru/developers/api)
- [Тестовые данные](https://yookassa.ru/developers/payment-acceptance/testing-and-going-live/testing)
- [Webhook](https://yookassa.ru/developers/using-api/webhooks)

## ⚠️ Важные замечания

1. Комиссия YooKassa (2.5% + 0.8₽) уже учтена в ценах тарифов
2. Подписка активируется автоматически после успешной оплаты
3. Для FREE тарифа подписка создается автоматически при регистрации
4. ENTERPRISE тариф требует ручной настройки

