@echo off
title WhatsApp Bot Server & Cloudflare Tunnel Launcher
echo ====================================================
echo 🚀 Menjalankan WhatsApp Bot Server & Cloudflare Tunnel
echo ====================================================
echo.

:: Start Node Server in new window
start "WhatsApp Bot Server" cmd /k "node server.js"

echo Menunggu server siap...
timeout /t 3 /nobreak >nul

echo.
echo 🌐 Menghubungkan ke Cloudflare Tunnel (HTTPS Domain Gratis & WebSocket)...
echo.

npx --yes cloudflared tunnel --url http://localhost:3000

pause
