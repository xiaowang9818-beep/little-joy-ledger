# 记账本同步服务部署说明

`server/sync-server.js` 是同步与 AI 转发服务；基础功能只使用 Node.js 内置模块，页面关闭后的计划推送会可选使用 `web-push`。支持：

- 多设备数据备份与合并；
- 可同步的软删除，删除记录不会在下次同步时复活；
- 多人共享账本；
- 设备凭证校验和共享权限检查；
- 视觉模型、模型列表及语音转文字的安全代理。
- 个人私密日程同步，以及基于 Web Push 的云端到点提醒。

## 本地运行

在项目根目录双击 `启动记账服务.bat`，或分别执行：

```bash
python -m http.server 8081 --bind 0.0.0.0
node server/sync-server.js
```

需要测试页面关闭后的云端提醒时，先在 `server` 目录安装依赖：

```bash
npm install --omit=dev
```

浏览器打开 `http://127.0.0.1:8081/index.html`，同步服务器地址填写 `http://127.0.0.1:3000`。

设备 ID 和设备凭证由浏览器首次启动时自动生成。不要清除浏览器站点数据；否则该浏览器会被视为一台新设备。

## 部署到 Linux / 腾讯云

推荐使用 Node.js 20 或更高版本：

```bash
cd /home/ubuntu/jizhang/server
pm2 start sync-server.js --name jizhang-sync
pm2 save
pm2 startup
```

默认监听 `0.0.0.0:3000`，可通过环境变量修改：

```bash
PORT=8080 pm2 start sync-server.js --name jizhang-sync
```

健康检查：

```bash
curl http://127.0.0.1:3000/health
```

正式部署应使用 Nginx 和 HTTPS：

```nginx
server {
  listen 443 ssl;
  server_name sync.example.com;

  ssl_certificate     /path/fullchain.pem;
  ssl_certificate_key /path/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    client_max_body_size 25m;
  }
}
```

## 上游 AI 接口安全

默认只允许访问公网 HTTPS 地址，并阻止本机、局域网、链路本地及其他保留 IP，避免服务器被当作内网代理使用。

可选环境变量：

- `UPSTREAM_HOSTS=api.openai.com,example.com`：仅允许指定上游域名，正式环境推荐配置；
- `ALLOW_PRIVATE_UPSTREAM=1`：允许 HTTP 和内网地址，仅适合可信的本地开发环境；
- `MAX_JSON_BODY`：JSON 请求上限，默认 2 MiB；
- `MAX_AUDIO_BODY`：语音上传上限，默认 25 MiB；
- `MAX_UPSTREAM_BODY`：上游响应上限，默认 5 MiB；
- `CORS_ORIGIN`：允许的网页来源，默认 `*`，正式部署建议填写前端域名。

例如：

```bash
UPSTREAM_HOSTS=api.openai.com CORS_ORIGIN=https://book.example.com pm2 start sync-server.js --name jizhang-sync
```

## 数据与备份

服务数据保存在 `server/data.json`。写入时会先生成临时文件；如果原文件损坏，启动时会保留一个 `data.json.corrupt-时间戳` 副本。

仍建议定期备份 `data.json`：

```bash
cp data.json "data.json.$(date +%F-%H%M%S).bak"
```

同步采用按记录 `updatedAt` 的 last-write-wins 策略。客户端的新增、修改和删除都会刷新该时间；删除使用 `deleted` 墓碑记录传播到其他设备。

## 语音转文字

语音接口与视觉模型接口已分开配置。在网页设置中填写：

- 语音 API Key（留空时沿用视觉模型 Key）；
- 语音 Base URL，例如 `https://api.openai.com/v1`；
- 语音模型，例如 `whisper-1`。

不要把 `/responses` 或 `/chat/completions` 地址填入语音 Base URL。
# 会员、管理后台与平台 AI（第一期）

新版服务端已经包含会员权益、手动收费、限定主题目录和平台 AI 网关。正式环境至少需要增加以下环境变量：

首次邮箱注册会自动获得 3 天会员体验（限定主题、整个体验期 AI 单张共 3 次、批量共 1 次、语音共 3 次，跨自然月不重置）。默认公开套餐为首发内测价：月卡 12.9 元、季卡 35.9 元、年卡 118 元；升级正式会员后，AI 恢复按自然月计算，月额度分别为单张 60 次、批量 20 次、语音 60 次。体验领取使用规范化邮箱哈希防重复，账号注销后也不得清理 `trialClaims`。后台开通或续费必须登记正金额、有效渠道和唯一付款参考号；零元赠送不生成收费流水。

```bash
NODE_ENV=production
ADMIN_SETUP_TOKEN=请使用高强度随机字符串
AI_KEY_ENCRYPTION_KEY=64位十六进制随机密钥
CORS_ORIGIN=https://你的正式前端地址
PLATFORM_AI_HOSTS=需要额外放行的AI域名（可选，多个用逗号分隔）
```

`AI_KEY_ENCRYPTION_KEY` 必须长期稳定并单独备份；它只用于服务器端 AES-256-GCM 加密模型密钥，绝不能写入网页或提交到源码。后台接口永远只返回 Key 的末四位。正式环境不再接受浏览器提交的 API Key、接口地址和模型名。

首次管理员无论从服务器本机还是远程访问 `/api/admin/setup`，都必须提供 `ADMIN_SETUP_TOKEN`；未配置口令时服务会拒绝初始化。管理员登录使用独立的 HttpOnly Cookie、CSRF Token、角色权限和二次密码确认。

当前 `data.json` 仅用于本地预览和小规模内测。正式收费前应迁移 PostgreSQL，并继续通过反向代理、HTTPS、系统防火墙和定期备份保护数据。
