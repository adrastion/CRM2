# Capacitor mobile client (primary)

Мобильный APK = тот же React-кабинет (`client/`), упакованный через Capacitor.
Flutter-репозиторий `CRM2-mobile` **deprecated** как UI (не наращивать фичи).

## Сборка Android

```bash
cd client
npm install
npm run build:mobile   # PUBLIC_URL=./ + API прод + cap sync
npx cap open android
```

**Важно:** и сайт, и APK — абсолютные пути `/static/...` (`PUBLIC_URL=/`).
`PUBLIC_URL=./` ломает lazy-chunks после логина (`/dashboard`, `/admin/...`) → белый экран.
Capacitor отдаёт файлы с корня `https://localhost/`, поэтому `/static` в APK корректен.

В Android Studio: **Build → Generate Signed Bundle / APK** или Gradle `assembleRelease`.
Готовый APK → SA «Мобильное приложение».

### Подпись release

1. Один раз на машине (если нет файлов):
   ```powershell
   cd client
   powershell -ExecutionPolicy Bypass -File scripts/create-release-keystore.ps1
   ```
2. Появятся `android/profsportcrm-release.jks` и `android/keystore.properties` (**не в git**).
3. `app/build.gradle` подхватывает их автоматически для `release`.
4. Сборка:
   ```bash
   cd android
   .\gradlew.bat assembleRelease
   ```
   APK: `android/app/build/outputs/apk/release/app-release.apk`

**Важно:** сохраните `.jks` + `keystore.properties` в надёжном месте. Потеря = нельзя подписать обновление тем же applicationId.

### Иконка приложения

Берётся с сайта (`public/logo512.png`). Перегенерация mipmap:

```bash
python scripts/generate-android-icons.py
```

**На сервере** в CORS должны быть origins Capacitor (уже в коде `server.ts`):
`https://localhost`, `capacitor://localhost`. После деплоя backend — перезапуск PM2.
Без этого логин в APK даёт axios `Network Error`.

## Что уже в оболочке

- Status bar, Android back → history
- Deep link `appUrlOpen` → React Router
- FCM Capacitor → `POST /api/mobile/fcm/register`
- Offline IndexedDB: кэш календаря/контактов, очередь посещаемости, баннер sync
- Pull-to-refresh (свайп вниз) на вкладках кабинета школы и портала (кроме чатов)

## Локальная отладка WebView без APK

`npm start` в браузере — обычный сайт.
Для проверки native-веток нужен Android emulator после `build:mobile`.

## Если APK сразу закрывается

Частая причина: `Default FirebaseApp is not initialized` — вызов FCM без Firebase.

1. `homepage: "./"` + `npm run build:mobile` (относительные ассеты).
2. **Пока нет** `android/app/google-services.json` — нативный push **выключен** (не вызывать register).
3. Когда добавите `google-services.json` из Firebase Console:
   ```bash
   # положить файл в client/android/app/google-services.json
   set REACT_APP_ENABLE_NATIVE_PUSH=true
   npm run build:mobile
   ```
4. Logcat: фильтр `AndroidRuntime` / `FirebaseApp`.
