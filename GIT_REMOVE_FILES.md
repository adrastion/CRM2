# Удаление файлов категорий клиентов из GitHub

## Команды для выполнения

Выполните следующие команды в терминале в директории проекта:

```bash
cd /home/bes/CRM2

# 1. Проверить статус (файлы должны быть помечены как удаленные)
git status

# 2. Добавить удаление файлов в staging
git add src/controllers/clientCategoryController.ts
git add src/routes/clientCategory.ts

# Или добавить все изменения сразу:
git add -A

# 3. Закоммитить удаление
git commit -m "Удалены файлы категорий клиентов (заменены на паспорт спортсмена)"

# 4. Отправить изменения в GitHub
git push origin main
# или если ваша ветка называется по-другому:
# git push origin master
# git push origin develop
```

## Альтернативный способ (если файлы еще не удалены локально)

Если файлы еще существуют и нужно удалить их через git:

```bash
cd /home/bes/CRM2

# Удалить файлы через git
git rm src/controllers/clientCategoryController.ts
git rm src/routes/clientCategory.ts

# Закоммитить
git commit -m "Удалены файлы категорий клиентов (заменены на паспорт спортсмена)"

# Отправить в GitHub
git push origin main
```

## Проверка

После отправки проверьте на GitHub, что файлы удалены:
- `src/controllers/clientCategoryController.ts` - должен отсутствовать
- `src/routes/clientCategory.ts` - должен отсутствовать

