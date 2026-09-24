@echo off
title WhatsApp Bot Server & Online Tunnel Launcher
echo ====================================================
echo 🚀 Menjalankan WhatsApp Bot Server & Online Tunnel
echo ====================================================
echo.

:: Start Node Server in new window
start "WhatsApp Bot Server" cmd /k "node server.js"

echo Menunggu server siap...
timeout /t 3 /nobreak >nul

echo.
echo 🌐 Menghubungkan ke Internet (HTTPS Domain Gratis)...
echo.

npx --yes localtunnel --port 3000

pause
