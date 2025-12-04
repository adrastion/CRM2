# ✅ Статус установки проекта

## Выполнено:

✅ **Node.js** v20.19.5 установлен  
✅ **npm** 9.2.0 установлен  
✅ **PostgreSQL** 18.1 установлен и запущен  
✅ **База данных** `martial_arts_crm` создана  
✅ **Зависимости** установлены (backend и frontend)  
✅ **Prisma клиент** сгенерирован  
✅ **Миграции** применены  
✅ **Тестовые данные** заполнены  
✅ **Скрипты** автоматизации созданы  

## 🚀 Запуск проекта

### Вариант 1: Автоматический скрипт
```bash
cd /home/bes/CRM2
./START_PROJECT.sh
```

### Вариант 2: Вручную
```bash
cd /home/bes/CRM2
npm run dev
```

### Вариант 3: По отдельности
```bash
# Terminal 1 - Backend
cd /home/bes/CRM2
npm run dev:server

# Terminal 2 - Frontend  
cd /home/bes/CRM2
npm run dev:client
```

## 🌐 Доступ к приложению

После запуска:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

## 👤 Тестовые аккаунты

### Владелец школы:
- **Email**: `owner@dragonacademy.com`
- **Пароль**: `password123`
- **URL**: http://localhost:3000/login

### Администратор:
- **Email**: `admin@dragonacademy.com`
- **Пароль**: `password123`

### Тренер:
- **Email**: `trainer1@dragonacademy.com`
- **Пароль**: `password123`

### Маркетолог:
- **Email**: `marketer@dragonacademy.com`
- **Пароль**: `password123`
- **URL**: http://localhost:3000/marketer/login

### Администратор промокодов:
- **Email**: `promo-admin@dragonacademy.com`
- **Пароль**: `password123`
- **URL**: http://localhost:3000/promo-code-admin/login

## 📝 Примечания

- Все миграции применены успешно
- База данных синхронизирована со схемой Prisma
- Тестовые данные загружены
- Проект готов к работе в тестовом режиме

## 🔧 Полезные команды

```bash
# Остановка проекта: Ctrl+C

# Просмотр базы данных
npx prisma studio

# Применение новых миграций
npx prisma migrate dev

# Сброс базы данных (осторожно!)
npx prisma migrate reset
```

---

**Проект готов к запуску!** 🎉

