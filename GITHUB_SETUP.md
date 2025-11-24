# 📦 Инструкция по загрузке проекта на GitHub

Полное руководство по загрузке ПрофСпортСРМ в новый репозиторий GitHub.

## 📋 Содержание

1. [Подготовка проекта](#подготовка-проекта)
2. [Создание репозитория на GitHub](#создание-репозитория-на-github)
3. [Инициализация Git](#инициализация-git)
4. [Загрузка проекта](#загрузка-проекта)
5. [Настройка аутентификации](#настройка-аутентификации)
6. [Последующие обновления](#последующие-обновления)
7. [Решение проблем](#решение-проблем)

---

## 🔧 Подготовка проекта

### 1. Проверка наличия .gitignore

Убедитесь, что файл `.gitignore` существует в корне проекта. Он должен исключать из репозитория:

- `node_modules/` - зависимости
- `.env` - секретные данные
- `dist/` и `build/` - скомпилированные файлы
- `uploads/` - загруженные файлы
- Логи и временные файлы

Если файла нет, он будет создан автоматически при инициализации Git.

### 2. Проверка секретных данных

**⚠️ ВАЖНО:** Убедитесь, что файл `.env` НЕ будет загружен в репозиторий!

```bash
# Проверьте, что .env в .gitignore
# Файл .env должен быть в списке игнорируемых файлов
```

---

## 🆕 Создание репозитория на GitHub

### Вариант 1: Через веб-интерфейс (рекомендуется)

1. Войдите в свой аккаунт на [GitHub.com](https://github.com)
2. Нажмите кнопку **"+"** в правом верхнем углу → выберите **"New repository"**
3. Заполните форму:
   - **Repository name**: `martial-arts-crm` (или любое другое имя)
   - **Description**: `ПрофСпортСРМ - CRM система для управления спортивными школами с мультитенантной архитектурой`
   - **Visibility**: 
     - **Public** 🌐 - виден всем (рекомендуется для open-source)
     - **Private** 🔒 - только для вас и приглашенных
   - **НЕ** ставьте галочки на:
     - ❌ "Add a README file" (у нас уже есть README.md)
     - ❌ "Add .gitignore" (у нас уже есть .gitignore)
     - ❌ "Choose a license" (можно добавить позже)
4. Нажмите **"Create repository"**

### Вариант 2: Через GitHub CLI (если установлен)

```bash
# Установить GitHub CLI (если не установлен)
# Windows: winget install GitHub.cli
# macOS: brew install gh
# Linux: sudo apt install gh

# Авторизоваться
gh auth login

# Создать репозиторий
gh repo create martial-arts-crm --public --description "ПрофСпортСРМ - CRM система для управления спортивными школами"
```

---

## 🔨 Инициализация Git

### 1. Проверка установки Git

```bash
# Проверить версию Git
git --version

# Если Git не установлен:
# Windows: скачайте с https://git-scm.com/download/win
# macOS: brew install git
# Linux: sudo apt install git
```

### 2. Настройка Git (если еще не настроен)

```bash
# Установить имя пользователя (замените на ваше)
git config --global user.name "Ваше Имя"

# Установить email (должен совпадать с GitHub)
git config --global user.email "your.email@example.com"

# Проверить настройки
git config --list
```

### 3. Инициализация репозитория

```bash
# Перейти в директорию проекта
cd Z:\

# Инициализировать Git репозиторий
git init

# Проверить статус
git status
```

---

## 📤 Загрузка проекта

### Шаг 1: Добавление файлов

```bash
# Добавить все файлы (кроме тех, что в .gitignore)
git add .

# Проверить, что будет закоммичено (убедитесь, что .env НЕ в списке!)
git status
```

**⚠️ ВАЖНО:** Убедитесь, что файл `.env` НЕ появился в списке файлов для коммита!

### Шаг 2: Первый коммит

```bash
# Создать первый коммит
git commit -m "Initial commit: ПрофСпортСРМ - CRM система для спортивных школ"

# Или более подробное сообщение:
git commit -m "Initial commit

- Backend: Node.js + Express + TypeScript + Prisma
- Frontend: React + TypeScript + Material-UI
- Database: PostgreSQL
- Features: Multi-tenant SaaS, клиенты, тренеры, расписание, платежи"
```

### Шаг 3: Подключение к GitHub

```bash
# Добавить удаленный репозиторий (замените YOUR_USERNAME на ваш GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/martial-arts-crm.git

# Или если используете SSH (рекомендуется):
# git remote add origin git@github.com:YOUR_USERNAME/martial-arts-crm.git

# Проверить, что remote добавлен
git remote -v
```

### Шаг 4: Переименование ветки (если нужно)

GitHub по умолчанию использует ветку `main`, а старые версии Git используют `master`:

```bash
# Проверить текущую ветку
git branch

# Переименовать ветку в main (если нужно)
git branch -M main
```

### Шаг 5: Загрузка на GitHub

```bash
# Загрузить код в репозиторий (первый раз)
git push -u origin main

# Если ваша ветка называется 'master':
# git push -u origin master
```

### Шаг 6: Проверка результата

Откройте ваш репозиторий на GitHub в браузере:
```
https://github.com/YOUR_USERNAME/martial-arts-crm
```

Вы должны увидеть все файлы проекта.

---

## 🔐 Настройка аутентификации

GitHub больше не принимает пароли для HTTPS. Нужно использовать один из методов:

### Метод 1: Personal Access Token (HTTPS) - Простой способ

1. **Создать токен:**
   - GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Нажмите "Generate new token (classic)"
   - Название: `CRM Project`
   - Срок действия: выберите нужный период
   - Права: отметьте `repo` (полный доступ к репозиториям)
   - Нажмите "Generate token"
   - **⚠️ СКОПИРУЙТЕ ТОКЕН СРАЗУ!** Он больше не будет показан

2. **Использовать токен:**
   ```bash
   # При push Git попросит ввести:
   # Username: ваш_github_username
   # Password: вставьте токен (НЕ пароль!)
   ```

3. **Сохранить токен (опционально):**
   ```bash
   # Windows: Git Credential Manager сохранит токен автоматически
   # Или использовать:
   git config --global credential.helper wincred
   ```

### Метод 2: SSH ключи (Рекомендуется для постоянной работы)

1. **Проверить наличие SSH ключей:**
   ```bash
   # Проверить существующие ключи
   ls -al ~/.ssh
   # Windows: dir %USERPROFILE%\.ssh
   ```

2. **Создать новый SSH ключ (если нет):**
   ```bash
   # Создать SSH ключ
   ssh-keygen -t ed25519 -C "your_email@example.com"
   
   # Нажать Enter для сохранения в стандартное место
   # Ввести пароль (или оставить пустым)
   ```

3. **Добавить ключ в SSH агент:**
   ```bash
   # Запустить SSH агент
   eval "$(ssh-agent -s)"
   
   # Добавить ключ
   ssh-add ~/.ssh/id_ed25519
   # Windows: ssh-add %USERPROFILE%\.ssh\id_ed25519
   ```

4. **Добавить публичный ключ в GitHub:**
   ```bash
   # Показать публичный ключ
   cat ~/.ssh/id_ed25519.pub
   # Windows: type %USERPROFILE%\.ssh\id_ed25519.pub
   ```
   
   - Скопируйте весь вывод
   - GitHub → Settings → SSH and GPG keys → New SSH key
   - Title: `My Computer` (или любое имя)
   - Key: вставьте скопированный ключ
   - Нажмите "Add SSH key"

5. **Использовать SSH URL:**
   ```bash
   # Изменить remote на SSH
   git remote set-url origin git@github.com:YOUR_USERNAME/martial-arts-crm.git
   
   # Проверить подключение
   ssh -T git@github.com
   # Должно вывести: "Hi YOUR_USERNAME! You've successfully authenticated..."
   ```

### Метод 3: GitHub CLI (Самый простой)

```bash
# Установить GitHub CLI
# Windows: winget install GitHub.cli
# macOS: brew install gh
# Linux: sudo apt install gh

# Авторизоваться
gh auth login

# Выбрать GitHub.com → HTTPS → Authenticate Git with your GitHub credentials? Yes
# Теперь можно использовать обычные git команды без токенов
```

---

## 🔄 Последующие обновления

После внесения изменений в проект:

```bash
# Проверить изменения
git status

# Добавить измененные файлы
git add .

# Или добавить конкретные файлы
git add src/server.ts
git add client/src/App.tsx

# Создать коммит с описанием изменений
git commit -m "Описание изменений"

# Загрузить на GitHub
git push
```

### Полезные команды Git

```bash
# Просмотр истории коммитов
git log --oneline

# Просмотр изменений
git diff

# Отмена изменений в файле (до git add)
git checkout -- filename

# Отмена добавления файла (после git add, до git commit)
git reset HEAD filename

# Создание новой ветки
git checkout -b feature/new-feature

# Переключение между ветками
git checkout main

# Слияние веток
git merge feature/new-feature
```

---

## 🛠 Решение проблем

### Проблема: "remote origin already exists"

```bash
# Удалить существующий remote
git remote remove origin

# Добавить заново
git remote add origin https://github.com/YOUR_USERNAME/martial-arts-crm.git
```

### Проблема: "failed to push some refs"

Это происходит, если на GitHub уже есть коммиты (например, создали README при создании репозитория):

```bash
# Получить изменения с GitHub
git pull origin main --allow-unrelated-histories

# Разрешить конфликты, если они есть
# Затем попробовать снова
git push -u origin main
```

### Проблема: "Permission denied (publickey)"

SSH ключ не настроен или не добавлен в GitHub:

```bash
# Проверить подключение
ssh -T git@github.com

# Если ошибка, проверьте:
# 1. SSH ключ создан: ls ~/.ssh
# 2. Ключ добавлен в GitHub: Settings → SSH and GPG keys
# 3. Используется SSH URL: git remote -v
```

### Проблема: "Authentication failed" при HTTPS

1. Убедитесь, что используете Personal Access Token, а не пароль
2. Проверьте, что токен имеет права `repo`
3. Попробуйте создать новый токен

### Проблема: .env файл попал в репозиторий

**⚠️ КРИТИЧНО:** Если файл `.env` с секретными данными попал в репозиторий:

```bash
# 1. Удалить файл из Git (но оставить локально)
git rm --cached .env

# 2. Убедиться, что .env в .gitignore
echo ".env" >> .gitignore

# 3. Закоммитить изменения
git add .gitignore
git commit -m "Remove .env from repository"

# 4. Загрузить изменения
git push

# 5. ВАЖНО: Сменить все секретные ключи в .env!
# - JWT_SECRET
# - DATABASE_URL (пароль)
# - SMTP_PASS
# И любые другие секретные данные
```

### Проблема: Большой размер репозитория (node_modules попал в репозиторий)

```bash
# 1. Удалить node_modules из Git
git rm -r --cached node_modules
git rm -r --cached client/node_modules

# 2. Убедиться, что в .gitignore есть:
# node_modules/
# client/node_modules/

# 3. Закоммитить
git add .gitignore
git commit -m "Remove node_modules from repository"

# 4. Загрузить
git push
```

### Проблема: Изменение URL репозитория

```bash
# Изменить URL удаленного репозитория
git remote set-url origin https://github.com/NEW_USERNAME/NEW_REPO_NAME.git

# Проверить
git remote -v
```

---

## ✅ Чеклист загрузки

- [ ] Git установлен и настроен
- [ ] `.gitignore` файл создан и проверен
- [ ] Файл `.env` НЕ будет загружен (проверено через `git status`)
- [ ] Репозиторий создан на GitHub
- [ ] Git репозиторий инициализирован локально
- [ ] Все файлы добавлены в Git
- [ ] Первый коммит создан
- [ ] Remote репозиторий подключен
- [ ] Аутентификация настроена (Token или SSH)
- [ ] Код загружен на GitHub
- [ ] Репозиторий проверен в браузере

---

## 📚 Дополнительные ресурсы

- [Документация Git](https://git-scm.com/doc)
- [Документация GitHub](https://docs.github.com)
- [GitHub Guides](https://guides.github.com)
- [Создание Personal Access Token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [Настройка SSH ключей](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)

---

## 🎯 Быстрая справка

### Первая загрузка проекта:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/martial-arts-crm.git
git branch -M main
git push -u origin main
```

### Обновление проекта:
```bash
git add .
git commit -m "Описание изменений"
git push
```

### Клонирование проекта:
```bash
git clone https://github.com/YOUR_USERNAME/martial-arts-crm.git
cd martial-arts-crm
npm install
cd client && npm install && cd ..
```

---

**Готово!** Ваш проект теперь на GitHub 🎉

Если возникли проблемы, проверьте раздел [Решение проблем](#решение-проблем) или создайте Issue в репозитории.
