# ✅ Проект успешно настроен!

## Что было сделано:

1. ✅ Удален несуществующий пакет `@yookassa/nodejs-sdk`
2. ✅ Интеграция YooKassa переведена на прямые HTTP запросы
3. ✅ Установлены все зависимости (backend и frontend)
4. ✅ Сгенерирован Prisma клиент
5. ✅ Настроена база данных PostgreSQL
6. ✅ Применены все миграции (включая подписки)

## 🚀 Запуск проекта

Проект уже запущен в фоновом режиме. Если нужно запустить заново:

```bash
cd /home/bes/CRM2
npm run dev
```

## 📍 Адреса

- **Backend API**: http://localhost:3001
- **Frontend**: http://localhost:3000
- **Health Check**: http://localhost:3001/health

## 🔑 Тестовые аккаунты

После заполнения тестовыми данными:

```bash
npx prisma db seed
```

Будут доступны:
- **Owner**: owner@dragonacademy.com / password123
- **Admin**: admin@dragonacademy.com / password123
- **Trainer**: trainer1@dragonacademy.com / password123

## 📝 Настройки YooKassa

Настройки уже добавлены в `.env`:
- `YOOKASSA_SHOP_ID="1216914"`
- `YOOKASSA_SECRET_KEY="test_vt7b7ScEI08nPJcAiMrxem_tNYWXEomvyoUd0pvh1qU"`
- `YOOKASSA_TEST_MODE="true"`

## 🔧 Управление проектом

### Остановка:
Нажмите `Ctrl+C` в терминале где запущен проект, или:
```bash
pkill -f "npm run dev"
```

### Перезапуск:
```bash
cd /home/bes/CRM2
npm run dev
```

### Просмотр логов:
Логи отображаются в терминале, где запущен проект.

## 📚 Полезные команды

```bash
# Применить новые миграции
npx prisma migrate deploy

# Сгенерировать Prisma клиент после изменений схемы
npx prisma generate

# Открыть Prisma Studio (GUI для БД)
npx prisma studio

# Проверить статус базы данных
npx prisma db status
```

## ✨ Готово к использованию!

Проект готов к тестированию. Откройте браузер и перейдите на http://localhost:3000

