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

В Android Studio: Run / Build APK. Готовый APK → SA «Мобильное приложение».

**На сервере** в CORS должны быть origins Capacitor (уже в коде `server.ts`):
`https://localhost`, `capacitor://localhost`. После деплоя backend — перезапуск PM2.
Без этого логин в APK даёт axios `Network Error`.

## Что уже в оболочке

- Status bar, Android back → history
- Deep link `appUrlOpen` → React Router
- FCM Capacitor → `POST /api/mobile/fcm/register`
- Offline IndexedDB: кэш календаря/контактов, очередь посещаемости, баннер sync

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
