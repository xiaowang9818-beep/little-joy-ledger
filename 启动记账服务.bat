@echo off
setlocal EnableExtensions
chcp 65001 >nul
title 记账本本地服务

set "ROOT=%~dp0"
set "NODE="
set "SECRET_DIR=%LOCALAPPDATA%\LittleJoyLedger"
set "AI_KEY_FILE=%SECRET_DIR%\ai-master-key.txt"
set "ADMIN_TOKEN_FILE=%SECRET_DIR%\admin-setup-token.txt"
set "DATA_FILE=%SECRET_DIR%\data.json"

for /f "delims=" %%N in ('where node 2^>nul') do if not defined NODE set "NODE=%%N"
if not defined NODE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not defined NODE for /f "delims=" %%N in ('dir /b /s "%USERPROFILE%\.workbuddy\binaries\node\node.exe" 2^>nul') do if not defined NODE set "NODE=%%N"
if not defined NODE for /f "delims=" %%N in ('dir /b /s "%USERPROFILE%\.workbuddy\binaries\node\versions\*\node.exe" 2^>nul') do if not defined NODE set "NODE=%%N"

if not defined NODE (
  echo [错误] 未找到 Node.js。请安装 Node.js 18 或更高版本并加入 PATH。
  pause
  exit /b 1
)

if not exist "%SECRET_DIR%" mkdir "%SECRET_DIR%" >nul 2>nul
if not exist "%DATA_FILE%" if exist "%ROOT%server\data.json" copy /y "%ROOT%server\data.json" "%DATA_FILE%" >nul
if exist "%ROOT%server\data.json" if not exist "%DATA_FILE%" (
  echo [错误] 无法把现有账本数据迁移到本机安全目录。
  pause
  exit /b 1
)
if not exist "%AI_KEY_FILE%" powershell -NoProfile -Command "$b=New-Object byte[] 32;$r=[Security.Cryptography.RandomNumberGenerator]::Create();$r.GetBytes($b);$r.Dispose();$h=[BitConverter]::ToString($b).Replace('-','').ToLowerInvariant();[IO.File]::WriteAllText('%AI_KEY_FILE%',$h)"
set /p "AI_KEY_ENCRYPTION_KEY="<"%AI_KEY_FILE%"
if not defined AI_KEY_ENCRYPTION_KEY (
  echo [错误] 无法创建本机 AI 密钥保护文件。
  pause
  exit /b 1
)
if not exist "%ADMIN_TOKEN_FILE%" powershell -NoProfile -Command "$b=New-Object byte[] 32;$r=[Security.Cryptography.RandomNumberGenerator]::Create();$r.GetBytes($b);$r.Dispose();$h=[BitConverter]::ToString($b).Replace('-','').ToLowerInvariant();[IO.File]::WriteAllText('%ADMIN_TOKEN_FILE%',$h)"
set /p "ADMIN_SETUP_TOKEN="<"%ADMIN_TOKEN_FILE%"
if not defined ADMIN_SETUP_TOKEN (
  echo [错误] 无法创建管理员首次初始化口令。
  pause
  exit /b 1
)
set "NODE_ENV=development"
set "HOST=0.0.0.0"
set "PORT=3000"
set "STATIC_HOST=0.0.0.0"
set "STATIC_PORT=8081"
set "REQUIRE_ACCOUNT=0"
set "TRUST_PROXY=0"
set "ALLOW_PRIVATE_UPSTREAM=0"

set "LOCAL_IP="
for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "$x=Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object -First 1 -ExpandProperty IPAddress; if($x){$x}"`) do set "LOCAL_IP=%%I"

echo 正在启动记账本服务...
cd /d "%ROOT%server"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%server\start-local-services.ps1" -NodePath "%NODE%" -ProjectRoot "%ROOT%" -StateDir "%SECRET_DIR%"
if errorlevel 1 (
  echo.
  echo [错误] 记账本服务启动失败，上方已经给出原因。
  pause
  exit /b 1
)
start "" "http://127.0.0.1:8081/index.html"

echo.
echo ==============================
echo  记账本服务已启动
echo  本机访问：http://127.0.0.1:8081/index.html
echo  管理后台：http://127.0.0.1:8081/admin/
echo  首次初始化口令：%ADMIN_SETUP_TOKEN%
echo  口令也保存在：%ADMIN_TOKEN_FILE%
echo  账本数据保存在：%DATA_FILE%
if defined LOCAL_IP echo  手机访问：http://%LOCAL_IP%:8081/index.html
if not defined LOCAL_IP echo  未自动识别局域网 IP，请运行 ipconfig 后使用 IPv4 地址访问 8081 端口。
echo  手机需与电脑连接同一 Wi-Fi。
echo  本窗口 8 秒后自动关闭，服务会在后台继续运行。
echo ==============================
echo.
timeout /t 8 >nul
endlocal
