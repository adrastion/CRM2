# Исправление ошибок компиляции на сервере

## Проблема
После удаления модели `ClientCategory` из схемы базы данных, остались файлы контроллера и маршрутов, которые пытаются использовать несуществующую модель.

## Решение

Выполните следующие команды на сервере:

```bash
cd /var/www/CRM2

# Удалить контроллер категорий клиентов
rm -f src/controllers/clientCategoryController.ts

# Удалить маршруты категорий клиентов
rm -f src/routes/clientCategory.ts

# Проверить, что файлы удалены
ls -la src/controllers/clientCategoryController.ts 2>&1
ls -la src/routes/clientCategory.ts 2>&1

# Проверить компиляцию TypeScript
npx tsc --noEmit

# Если ошибок нет, собрать проект
npm run build:server
```

## Альтернативный вариант (если используете git)

Если изменения уже закоммичены в репозиторий:

```bash
cd /var/www/CRM2
git pull origin main  # или ваша ветка
npm run build:server
```

## Проверка

После выполнения команд проверьте, что:
1. Файлы `clientCategoryController.ts` и `clientCategory.ts` удалены
2. В `src/server.ts` нет импорта `clientCategoryRoutes`
3. Компиляция проходит без ошибок

