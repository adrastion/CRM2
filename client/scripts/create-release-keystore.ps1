# Создаёт release keystore + keystore.properties (если ещё нет).
# Запуск: powershell -ExecutionPolicy Bypass -File scripts/create-release-keystore.ps1

$ErrorActionPreference = "Stop"
$androidDir = Join-Path $PSScriptRoot "..\android" | Resolve-Path
$keystore = Join-Path $androidDir "profsportcrm-release.jks"
$props = Join-Path $androidDir "keystore.properties"

if (Test-Path $keystore) {
  Write-Host "Уже есть: $keystore"
  if (-not (Test-Path $props)) {
    Write-Host "Нет keystore.properties — создайте по образцу keystore.properties.example"
  }
  exit 0
}

$keytool = Get-Command keytool -ErrorAction SilentlyContinue
if (-not $keytool) {
  throw "keytool не найден. Установите JDK и добавьте в PATH."
}

$bytes = New-Object byte[] 24
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$pass = ([Convert]::ToBase64String($bytes) -replace '[+/=]', 'x').Substring(0, 24)

& keytool -genkeypair -v `
  -keystore $keystore `
  -alias profsportcrm `
  -keyalg RSA `
  -keysize 2048 `
  -validity 10000 `
  -storepass $pass `
  -keypass $pass `
  -dname "CN=ProfSportCRM, OU=Mobile, O=ProfSportCRM, L=Moscow, ST=Moscow, C=RU"

@"
storeFile=profsportcrm-release.jks
storePassword=$pass
keyAlias=profsportcrm
keyPassword=$pass
"@ | Set-Content -Path $props -Encoding UTF8

Write-Host ""
Write-Host "Готово."
Write-Host "  Keystore: $keystore"
Write-Host "  Properties: $props"
Write-Host "Сделайте резервную копию обоих файлов — без них нельзя обновлять приложение в магазине / поверх старого APK."
