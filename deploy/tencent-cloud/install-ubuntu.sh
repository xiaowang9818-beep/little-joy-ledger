#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "请使用 sudo 运行此脚本。" >&2
  exit 1
fi
if [[ $# -ne 2 ]]; then
  echo "用法：sudo bash install-ubuntu.sh <项目解压目录> <域名或公网IP>" >&2
  exit 1
fi

SOURCE_DIR="$(cd "$1" && pwd)"
DOMAIN="$2"
case "$DOMAIN" in
  *[!A-Za-z0-9.-]*|.*|*..*|*.) echo "域名格式不正确。" >&2; exit 1 ;;
esac
if [[ "$DOMAIN" =~ ^[0-9.]+$ ]]; then
  IFS='.' read -r -a IP_PARTS <<<"$DOMAIN"
  if [[ ${#IP_PARTS[@]} -ne 4 ]]; then
    echo "公网 IP 格式不正确。" >&2
    exit 1
  fi
  for part in "${IP_PARTS[@]}"; do
    if [[ -z "$part" || ! "$part" =~ ^[0-9]{1,3}$ ]]; then
      echo "公网 IP 格式不正确。" >&2
      exit 1
    fi
    if (( 10#$part > 255 )); then
      echo "公网 IP 格式不正确。" >&2
      exit 1
    fi
  done
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y nginx openssl ca-certificates curl gnupg

install -d -m 0755 /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" >/etc/apt/sources.list.d/nodesource.list
apt-get update
apt-get install -y nodejs
NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if (( NODE_MAJOR < 20 )); then
  echo "Node.js 版本过低，必须使用 Node.js 20 或更高版本。" >&2
  exit 1
fi

if ! id jizhang >/dev/null 2>&1; then
  useradd --system --home /var/lib/jizhang --shell /usr/sbin/nologin jizhang
fi

install -d -m 0755 /var/www/jizhang /var/www/jizhang/admin /var/www/jizhang/assets /var/www/jizhang/assets/payment /opt/jizhang/server /etc/jizhang
install -d -o jizhang -g jizhang -m 0750 /var/lib/jizhang

for file in index.html cute-themes.css payment.css growth.css ui-icons.css enhancements.js ui-icons.js manifest.webmanifest app-icon.svg sw.js; do
  install -m 0644 "$SOURCE_DIR/$file" "/var/www/jizhang/$file"
done
for file in wechat-pay.jpg alipay.jpg wechat-contact.jpg; do
  install -m 0644 "$SOURCE_DIR/assets/payment/$file" "/var/www/jizhang/assets/payment/$file"
done
for file in index.html admin.css admin.js; do
  install -m 0644 "$SOURCE_DIR/admin/$file" "/var/www/jizhang/admin/$file"
done
for file in sync-server.js paid-admin.js package.json schema-postgres.sql; do
  install -m 0644 "$SOURCE_DIR/server/$file" "/opt/jizhang/server/$file"
done
cd /opt/jizhang/server
npm install --omit=dev --no-audit --no-fund

ENV_FILE=/etc/jizhang/jizhang.env
AI_KEY_ENCRYPTION_KEY=""
ADMIN_SETUP_TOKEN=""
if [[ -f "$ENV_FILE" ]]; then
  AI_KEY_ENCRYPTION_KEY="$(sed -n 's/^AI_KEY_ENCRYPTION_KEY=//p' "$ENV_FILE" | head -n 1)"
  ADMIN_SETUP_TOKEN="$(sed -n 's/^ADMIN_SETUP_TOKEN=//p' "$ENV_FILE" | head -n 1)"
  if [[ ! "$AI_KEY_ENCRYPTION_KEY" =~ ^[A-Fa-f0-9]{64}$ ]]; then
    echo "现有 $ENV_FILE 中的 AI_KEY_ENCRYPTION_KEY 缺失或无效。为防止已保存的平台 API Key 永久无法解密，安装已停止；请先恢复该文件的备份。" >&2
    exit 1
  fi
  if [[ ! "$ADMIN_SETUP_TOKEN" =~ ^[A-Fa-f0-9]{64}$ ]]; then
    echo "现有 $ENV_FILE 中的 ADMIN_SETUP_TOKEN 缺失或无效。请先修复或恢复配置备份。" >&2
    exit 1
  fi
else
  AI_KEY_ENCRYPTION_KEY="$(openssl rand -hex 32)"
  ADMIN_SETUP_TOKEN="$(openssl rand -hex 32)"
fi
cat >"$ENV_FILE" <<EOF
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
DATA_FILE=/var/lib/jizhang/data.json
CORS_ORIGIN=https://$DOMAIN
COOKIE_SECURE=1
AI_KEY_ENCRYPTION_KEY=$AI_KEY_ENCRYPTION_KEY
ADMIN_SETUP_TOKEN=$ADMIN_SETUP_TOKEN
PLATFORM_AI_HOSTS=ark.cn-beijing.volces.com,api.openai.com,api.hunyuan.cloud.tencent.com,hunyuan.tencentcloudapi.com
VAPID_SUBJECT=https://$DOMAIN
MAX_JSON_BODY=2097152
MAX_AUDIO_BODY=26214400
MAX_UPSTREAM_BODY=5242880
TRUST_PROXY=1
REQUIRE_ACCOUNT=1
EOF
chmod 0640 /etc/jizhang/jizhang.env
chown root:jizhang /etc/jizhang/jizhang.env

install -m 0644 "$SOURCE_DIR/deploy/tencent-cloud/jizhang-sync.service" /etc/systemd/system/jizhang-sync.service
sed "s/__DOMAIN__/$DOMAIN/g" "$SOURCE_DIR/deploy/tencent-cloud/nginx.conf.template" >/etc/nginx/sites-available/jizhang
ln -sfn /etc/nginx/sites-available/jizhang /etc/nginx/sites-enabled/jizhang
rm -f /etc/nginx/sites-enabled/default

systemctl daemon-reload
systemctl enable jizhang-sync
systemctl restart jizhang-sync
nginx -t
systemctl enable --now nginx
systemctl reload nginx

HEALTHY=0
for _ in $(seq 1 30); do
  if curl --fail --silent --max-time 2 http://127.0.0.1:3000/health >/dev/null; then
    HEALTHY=1
    break
  fi
  sleep 1
done
if [[ "$HEALTHY" -ne 1 ]]; then
  echo "同步服务在 30 秒内未通过健康检查。请运行：sudo journalctl -u jizhang-sync -n 100 --no-pager" >&2
  exit 1
fi
echo "应用已启动：http://$DOMAIN"
echo "管理后台：https://$DOMAIN/admin/"
echo "首次后台初始化口令：$ADMIN_SETUP_TOKEN"
echo "请立即把初始化口令和 /etc/jizhang/jizhang.env 安全备份；不要发送给普通用户。"
echo "下一步：请配置 HTTPS。没有域名时，可运行 deploy/tencent-cloud/enable-ip-https.sh $DOMAIN。"
