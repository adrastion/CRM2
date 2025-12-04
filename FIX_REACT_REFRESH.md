# Исправление ошибки react-refresh-webpack-plugin

## Проблема
```
ERROR in ./src/index.tsx
Module build failed: TypeError: normalizeOptions is not a function
```

## Решение
Проблема была решена путем:
1. Очистки кеша npm
2. Переустановки всех зависимостей frontend
3. Обновления react-refresh-webpack-plugin

## Запуск проекта

### Полный запуск (Backend + Frontend)
```bash
cd /home/bes/CRM2
npm run dev
```

### Только Frontend
```bash
cd /home/bes/CRM2
npm run dev:client
```

## Если проблема повторится

Выполните полную переустановку:

```bash
cd /home/bes/CRM2/client

# Остановите все процессы (Ctrl+C)

# Очистка
rm -rf node_modules package-lock.json .cache
npm cache clean --force

# Переустановка
npm install

# Запуск
npm run dev
```

## Примечания

- Предупреждения о deprecation (DEP_WEBPACK_DEV_SERVER) не критичны
- Frontend компилируется и запускается на http://localhost:3000
- Первая компиляция может занять 1-2 минуты

