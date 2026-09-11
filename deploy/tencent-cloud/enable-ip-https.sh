#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "请使用 sudo 运行此脚本。" >&2
  exit 1
fi
if [[ $# -ne 1 || ! $1 =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
  echo "用法：sudo bash enable-ip-https.sh <服务器公网 IPv4>" >&2
  exit 1
fi

PUBLIC_IP="$1"
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y snapd
snap install core >/dev/null 2>&1 || true
snap refresh core >/dev/null 2>&1 || true
snap install --classic certbot
ln -sfn /snap/bin/certbot /usr/local/bin/certbot

install -d -m 0755 /var/www/jizhang/.well-known/acme-challenge
cat >/etc/nginx/sites-available/jizhang <<EOF
limit_req_zone \$binary_remote_addr zone=jizhang_api:10m rate=12r/s;

server {
    listen 80;
    listen [::]:80;
    server_name $PUBLIC_IP;
    root /var/www/jizhang;
    index index.html;
    location ^~ /.well-known/acme-challenge/ { root /var/www/jizhang; try_files \$uri =404; }
    location = /health { proxy_pass http://127.0.0.1:3000/health; }
    location /api/ { proxy_pass http://127.0.0.1:3000; }
    location / { try_files \$uri \$uri/ /index.html; }
    location ~ /\. { deny all; }
}
EOF
nginx -t
systemctl reload nginx

certbot certonly --preferred-profile shortlived --webroot --webroot-path /var/www/jizhang --ip-address "$PUBLIC_IP" --non-interactive --agree-tos --register-unsafely-without-email

cat >/etc/nginx/sites-available/jizhang <<EOF
limit_req_zone \$binary_remote_addr zone=jizhang_api:10m rate=12r/s;

server {
    listen 80;
    listen [::]:80;
    server_name $PUBLIC_IP;
    location ^~ /.well-known/acme-challenge/ { root /var/www/jizhang; }
    location / { return 301 https://\$host\$request_uri; }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $PUBLIC_IP;
    root /var/www/jizhang;
    index index.html;
    ssl_certificate /etc/letsencrypt/live/$PUBLIC_IP/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$PUBLIC_IP/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    location = /health { proxy_pass http://127.0.0.1:3000/health; }
    location /api/ {
        limit_req zone=jizhang_api burst=30 nodelay;
        client_max_body_size 26m;
        proxy_read_timeout 100s;
        proxy_send_timeout 100s;
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    location / { try_files \$uri \$uri/ /index.html; }
    location ~ /\. { deny all; }
}
EOF

nginx -t
systemctl reload nginx
install -d -m 0755 /etc/letsencrypt/renewal-hooks/deploy
cat >/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh <<'EOF'
#!/usr/bin/env bash
set -e
nginx -t
systemctl reload nginx
EOF
chmod 0755 /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
systemctl enable --now snap.certbot.renew.timer 2>/dev/null || true
echo "HTTPS 已启用：https://$PUBLIC_IP"
