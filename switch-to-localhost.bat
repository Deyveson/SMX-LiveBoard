@echo off
echo ========================================
echo    SMX LiveBoard - Trocar para localhost
echo ========================================
echo.
echo Este script vai abrir o SMX LiveBoard em localhost:3002
echo para permitir a instalação como PWA.
echo.
echo URLs que funcionam para PWA:
echo ✅ http://localhost:3002
echo ✅ http://127.0.0.1:3002
echo.
echo URLs que NÃO funcionam para PWA:
echo ❌ http://smx:3002
echo ❌ http://SEU-IP:3002
echo.
echo Pressione qualquer tecla para abrir localhost:3002...
pause >nul

echo.
echo Abrindo http://localhost:3002...
start http://localhost:3002

echo.
echo ✅ Abra http://localhost:3002 no seu navegador
echo    O modal de instalação PWA deve aparecer automaticamente!
echo.
pause
