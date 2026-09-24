#!/bin/bash

# ==============================================================================
# WhatsApp Bot & Scheduler - Automated VPS Ubuntu Installer
# ==============================================================================

set -e

DOMAIN=$1

if [ -z "$DOMAIN" ]; then
  echo "❌ ERROR: Harap masukkan nama domain Anda."
  echo "Penggunaan: bash setup-vps.sh bot.domainanda.com"
  exit 1
fi

echo "===================================================="
echo "🚀 Memulai Otomatisasi Setup WA Bot VPS di domain: $DOMAIN"
echo "===================================================="

# 1. Update System
echo "📦 1/5 Memperbarui sistem Ubuntu..."
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js & Essential Tools
echo "🟢 2/5 Menginstall Node.js, PM2, Nginx & Certbot..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx certbot python3-certbot-nginx build-essential

sudo npm install -g pm2

# 3. Install NPM Dependencies
echo "📚 3/5 Menginstall dependensi proyek..."
npm install --production

# Create logs directory
mkdir -p logs

# 4. Setup Nginx
echo "🌐 4/5 Mengonfigurasi Nginx Web Server untuk $DOMAIN..."
sudo cp nginx/wa-bot.conf /etc/nginx/sites-available/$DOMAIN
sudo sed -i "s/YOUR_DOMAIN_HERE/$DOMAIN/g" /etc/nginx/sites-available/$DOMAIN

sudo ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# 5. Start PM2 App
echo "⚡ 5/5 Menjalankan aplikasi dengan PM2..."
pm2 start ecosystem.config.js
pm2 save
sudo env PATH=$PATH:/usr/bin /usr/local/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME || true

# 6. Request SSL Certificate
echo "🔒 Mengaktifkan SSL HTTPS Gratis (Let's Encrypt)..."
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m admin@$DOMAIN || echo "⚠️ PERINGATAN: SSL belum dapat diaktifkan. Pastikan A Record DNS domain Anda sudah mengarah ke IP VPS ini."

echo "===================================================="
echo "✅ SETUP SELESAI!"
echo "Aplikasi WhatsApp Bot siap dibuka di: https://$DOMAIN"
echo "===================================================="
