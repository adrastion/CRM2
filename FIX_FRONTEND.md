# Исправление проблемы с react-scripts

## Проблема
Ошибка: `sh: 1: react-scripts: not found`

## Решение
Зависимости frontend были переустановлены. Теперь можно запускать проект.

## Запуск проекта

### Вариант 1: Запуск всего проекта (рекомендуется)
```bash
cd /home/bes/CRM2
npm run dev
```

Это запустит одновременно:
- Backend на порту 3001
- Frontend на порту 3000

### Вариант 2: Запуск по отдельности

**Terminal 1 - Backend:**
```bash
cd /home/bes/CRM2
npm run dev:server
```

**Terminal 2 - Frontend:**
```bash
cd /home/bes/CRM2
npm run dev:client
```

### Вариант 3: Использование скрипта
```bash
cd /home/bes/CRM2
./START_PROJECT.sh
```

## Проверка

После запуска:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

## Если проблема повторится

Переустановите зависимости frontend:
```bash
cd /home/bes/CRM2/client
rm -rf node_modules package-lock.json
npm install
```

