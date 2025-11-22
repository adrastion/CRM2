# Скрипт для проверки подключения к PostgreSQL

Write-Host "Проверка подключения к PostgreSQL..." -ForegroundColor Cyan

# Попробуем подключиться с разными вариантами
$passwords = @("0408", "postgres", "admin", "")

foreach ($pass in $passwords) {
    Write-Host "`nПопытка подключения с паролем: $pass" -ForegroundColor Yellow
    try {
        $env:PGPASSWORD = $pass
        $result = psql -U postgres -h localhost -c "SELECT version();" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Успешное подключение!" -ForegroundColor Green
            Write-Host "Правильный пароль: $pass" -ForegroundColor Green
            break
        }
    } catch {
        Write-Host "✗ Не удалось подключиться" -ForegroundColor Red
    }
}

Write-Host "`nЕсли подключение не удалось, попробуйте:" -ForegroundColor Cyan
Write-Host "1. Откройте pgAdmin 4" -ForegroundColor White
Write-Host "2. Подключитесь к серверу PostgreSQL" -ForegroundColor White
Write-Host "3. Посмотрите, какой пароль вы использовали при установке" -ForegroundColor White
Write-Host "`nИли сбросьте пароль через командную строку:" -ForegroundColor Cyan
Write-Host "psql -U postgres" -ForegroundColor White
Write-Host "ALTER USER postgres WITH PASSWORD 'новый_пароль';" -ForegroundColor White

