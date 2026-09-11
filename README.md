# 小确幸记账本

一个本地优先的个人记账与成长规划应用，支持多账本、收支统计、借还款、还款计划、日程、目标、灵感、日记、番茄钟、AI 图片识票、会员主题和管理后台。

## 主要功能

- 收入、支出、账户转账和多账本管理
- 借款、还款明细与年度还款计划
- 预算、周期账单、统计图表和 PDF/Excel 报表
- 日程优先级、目标、灵感、日记和番茄专注
- 图片账单、借款和还款的 AI 自动识别分类
- 邮箱注册登录、会员权益、限定主题和人工收费后台
- 腾讯云部署脚本及本地同步服务

## Windows 本地运行

1. 安装 Node.js 18 或更高版本。
2. 双击 `启动记账服务.bat`。
3. 打开 `http://127.0.0.1:8081/index.html`。
4. 管理后台地址为 `http://127.0.0.1:8081/admin/`。

本地账本数据、管理员初始化口令和 AI 加密主密钥保存在 `%LOCALAPPDATA%\LittleJoyLedger`，不会提交到 Git 仓库。

## 测试

在项目根目录执行：

```powershell
node server/test-frontend.js
node server/test-paid-frontend.js
node server/test-regressions.js
node server/test-auth.js
node server/test-paid-admin.js
node server/test-push.js
node server/test-static-server.js
```

## 部署

腾讯云部署说明见 `server/README_部署到腾讯云.md`。

## 当前阶段

当前版本适合单实例、小规模内测。正式收费上线前，建议将运行数据迁移到 PostgreSQL，并补齐邮箱验证、密码找回和自动支付回调。

