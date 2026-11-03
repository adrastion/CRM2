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

## Уведомления (APK)

В WebView **не работают** браузерные Web Push. Нужны:

1. **Локальные** (уже в коде) — баннер, пока приложение запущено / в фоне.
2. **FCM** — доставка, когда приложение убито:
   - Firebase Console → Android app `ru.profsportcrm.app` → скачать `google-services.json` →  
     положить в `client/android/app/google-services.json`
   - На сервере env: `FIREBASE_SERVICE_ACCOUNT_JSON` (JSON сервисного аккаунта)  
     или `GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json`
   - `npm run build:mobile` сам включит FCM, если видит `google-services.json`
   - В настройках уведомлений кабинета нажать «Включить уведомления»

## Файлы в APK

- **Выбор** (чат, Excel, APK) — нативный File Picker, не браузер.
- **Скачивание** — `Filesystem` + системный Share («Сохранить в…»), без открытия Chrome.

## Если APK сразу закрывается

Частая причина: `Default FirebaseApp is not initialized` — FCM без `google-services.json`.

1. Уберите файл или не ставьте `REACT_APP_ENABLE_NATIVE_PUSH` без него.
2. Когда добавите `google-services.json` — пересоберите `build:mobile`.
3. Logcat: фильтр `AndroidRuntime` / `FirebaseApp`.
