# 腾讯云生产部署文件

目标环境：腾讯云轻量应用服务器或 CVM，Ubuntu 22.04/24.04，使用 Nginx 对外提供网页与 HTTPS，Node 同步服务只监听服务器内部的 3000 端口。

## 安全结构

- `/var/www/jizhang` 只放网页公开资源。
- 后端代码放在 `/opt/jizhang/server`。
- 同步数据放在 `/var/lib/jizhang/data.json`，不会被 Nginx 当作静态文件下载。
- systemd 使用独立的低权限 `jizhang` 用户运行服务。
- 正式环境限制 AI 上游域名，并将跨域来源固定为本站 HTTPS 域名。
- 正式环境要求先使用邮箱注册或登录后才能同步、共享和写入云端，游客模式只保存在浏览器本机，防止匿名请求占满服务器空间。
- 管理后台位于 `/admin/`，使用独立 HttpOnly Cookie、CSRF、角色权限和关键操作二次密码确认。
- 平台 AI Key 使用服务器主密钥加密，网页和接口只会看到 Key 末四位；安装脚本会生成主密钥和一次性管理员初始化口令。
- 升级时会复用原有 AI 主密钥；如果配置文件损坏或密钥缺失，安装会停止并要求恢复备份，不会静默换钥导致旧 Key 无法解密。
- 后端只信任本机 Nginx 传来的真实 IP，用于对注册和登录做独立限流，不会因为反向代理导致所有用户一起被锁定。
- 同步服务只监听 `127.0.0.1:3000`；腾讯云防火墙只需开放 22、80、443，不要开放 3000。

## 安装

将完整项目上传并解压后，在服务器执行：

```bash
sudo bash deploy/tencent-cloud/install-ubuntu.sh /上传后的项目目录 book.example.com
```

确认域名 A 记录已经指向服务器公网 IP，再按照腾讯云官方 Nginx SSL 文档安装证书并开启 HTTP 到 HTTPS 跳转。证书完成后访问：

```text
https://book.example.com
```

管理后台：

```text
https://book.example.com/admin/
```

安装结束时终端会显示一次“首次后台初始化口令”。第一次创建超级管理员时填写它，初始化完成后 `/api/admin/setup` 将永久拒绝再次创建首个管理员。请把 `/etc/jizhang/jizhang.env` 作为机密文件单独备份。

健康检查：

```bash
curl https://book.example.com/health
```

没有域名时，可以直接填写服务器公网 IP，例如：

```bash
sudo bash deploy/tencent-cloud/install-ubuntu.sh /上传后的项目目录 43.160.203.24
sudo bash deploy/tencent-cloud/enable-ip-https.sh 43.160.203.24
```

第二条命令会申请可自动续期的短期公网 IP HTTPS 证书。HTTPS 是浏览器系统通知、PWA 和页面关闭后云端计划提醒的必要条件。

查看服务：

```bash
sudo systemctl status jizhang-sync nginx
```

备份的数据文件为 `/var/lib/jizhang/data.json`。首次部署默认创建空数据文件；是否迁移本地 `server/data.json` 应由用户明确选择。

安装脚本会同时安装 `web-push`，用于个人规划在网页关闭后由服务器按时发送提醒。推送订阅、待提醒任务和自动生成的 VAPID 密钥都保存在同一数据文件中，请一并备份。

当前第一期仍以 `data.json` 兼容本地体验和小规模内测；准备正式大量收费前，应按 `server/schema-postgres.sql` 迁移到 PostgreSQL，并完成备份恢复演练。不要把 JSON 兼容存储当作长期收费数据库。

会员默认配置：新邮箱用户首次注册自动获得 3 天体验（整个体验期 AI 单张共 3 次、批量共 1 次、语音共 3 次和全部限定主题，跨自然月不重置）；首发内测价为月卡 12.9 元、季卡 35.9 元、年卡 118 元，升级后正式额度按自然月计算。备份与迁移时必须包含 `trialClaims`/`trial_claims`，账号注销也不能删除该领取记录，否则会重新开放同邮箱体验。人工开通/续费必须记录正金额、有效渠道和唯一付款参考号；赠送只能为 0 元且不生成收费流水。
