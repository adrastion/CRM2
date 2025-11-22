# Инструкция по загрузке проекта на GitHub

## Шаг 1: Создайте репозиторий на GitHub

1. Войдите в свой аккаунт на [GitHub.com](https://github.com)
2. Нажмите кнопку **"+"** в правом верхнем углу → выберите **"New repository"**
3. Заполните форму:
   - **Repository name**: `CRM` (или любое другое имя)
   - **Description**: `CRM система для управления школой единоборств`
   - **Visibility**: выберите **Private** 🔒 (репозиторий будет приватным)
   - **НЕ** ставьте галочки на "Initialize with README", "Add .gitignore", "Choose a license" (у нас уже есть эти файлы)
4. Нажмите **"Create repository"**

> **Примечание:** Приватный репозиторий доступен только вам и пользователям, которым вы явно предоставите доступ. Это безопаснее для проектов с конфиденциальными данными.

## Шаг 2: Подключите локальный репозиторий к GitHub

После создания репозитория GitHub покажет инструкции. Выполните следующие команды в терминале:

```bash
# Перейдите в директорию проекта (если еще не там)
cd /home/bes/projects/CRM

# Добавьте удаленный репозиторий (замените YOUR_USERNAME на ваш GitHub username)
git remote add origin https://github.com/adrastion/CRM.git

# Или если используете SSH:
# git remote add origin git@github.com:adrastion/CRM.git

# Проверьте, что remote добавлен
git remote -v
```

## Шаг 3: Загрузите код на GitHub

```bash
# Загрузите код в репозиторий (первый раз)
git push -u origin master

# Если ваша ветка называется 'main' вместо 'master':
# git branch -M main
# git push -u origin main
```

## Шаг 4: Проверьте результат

Откройте ваш репозиторий на GitHub в браузере - вы должны увидеть все файлы проекта.

---

## Дополнительные команды

### Если нужно изменить URL удаленного репозитория:
```bash
git remote set-url origin https://github.com/YOUR_USERNAME/NEW_REPO_NAME.git
```

### Для последующих обновлений (после изменений в коде):
```bash
git add .
git commit -m "Описание изменений"
git push
```

### Если нужно клонировать репозиторий на другой компьютер:
```bash
git clone https://github.com/YOUR_USERNAME/CRM.git
cd CRM
npm install
cd client && npm install && cd ..
```

---

## Важные замечания

✅ **Убедитесь, что в репозиторий НЕ попали:**
- Файлы `.env` или `config.env` (содержат секретные данные)
- База данных `prisma/dev.db`
- Папки `node_modules/`
- Папки `dist/` и `client/build/`

✅ **Все эти файлы уже добавлены в `.gitignore`**, поэтому они автоматически будут игнорироваться.

---

## Если возникли проблемы

### Ошибка: "remote origin already exists"
```bash
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/CRM.git
```

### Ошибка: "failed to push some refs"
```bash
# Сначала получите изменения (если они есть)
git pull origin master --allow-unrelated-histories
# Затем попробуйте снова
git push -u origin master
```

### Нужна аутентификация
Для приватных репозиториев GitHub всегда требует аутентификацию:
- **HTTPS**: Используйте **Personal Access Token** вместо пароля
  - Создайте токен: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
  - При push используйте токен как пароль
- **SSH** (рекомендуется): Настройте SSH ключи для более удобной работы
  - Генерируйте ключ: `ssh-keygen -t ed25519 -C "your_email@example.com"`
  - Добавьте публичный ключ в GitHub: Settings → SSH and GPG keys

---

**Готово!** Ваш проект теперь на GitHub 🎉

