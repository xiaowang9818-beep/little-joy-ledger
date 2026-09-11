param(
  [Parameter(Mandatory = $true)][string]$NodePath,
  [Parameter(Mandatory = $true)][string]$ProjectRoot,
  [Parameter(Mandatory = $true)][string]$StateDir
)

$ErrorActionPreference = 'Stop'
$project = [IO.Path]::GetFullPath($ProjectRoot).TrimEnd('\')
$serverDir = Join-Path $project 'server'
$staticScript = [IO.Path]::GetFullPath((Join-Path $serverDir 'static-server.js'))
$backendScript = [IO.Path]::GetFullPath((Join-Path $serverDir 'sync-server.js'))
$stateFile = Join-Path $StateDir 'local-service-pids.json'

function Stop-TrackedProcess([object]$entry, [string]$expectedScript) {
  if ($null -eq $entry -or -not $entry.pid) { return }
  $pidValue = [int]$entry.pid
  if ([string]$entry.script -ne $expectedScript -or -not $entry.nodePath -or -not $entry.startedAtUnixMs) {
    Write-Warning "未停止 PID $pidValue：状态文件缺少可验证的进程身份。"
    return
  }
  $process = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
  if ($null -eq $process) { return }
  $expectedNode = [IO.Path]::GetFullPath([string]$entry.nodePath)
  $actualNode = [IO.Path]::GetFullPath([string]$process.Path)
  $expectedStartMs = [int64]$entry.startedAtUnixMs
  $actualStartMs = [DateTimeOffset]::new($process.StartTime).ToUnixTimeMilliseconds()
  if ($actualNode -ne $expectedNode -or [Math]::Abs($actualStartMs - $expectedStartMs) -gt 2000) {
    Write-Warning "未停止 PID $pidValue：它不是本项目记录的服务进程。"
    return
  }
  Stop-Process -Id $pidValue -Force -ErrorAction Stop
}

if (Test-Path -LiteralPath $stateFile) {
  try {
    $oldState = Get-Content -LiteralPath $stateFile -Raw -Encoding UTF8 | ConvertFrom-Json
    Stop-TrackedProcess $oldState.static $staticScript
    Stop-TrackedProcess $oldState.backend $backendScript
  } catch {
    Write-Warning "旧服务状态文件无法读取，未据此结束任何进程：$($_.Exception.Message)"
  }
}

function Get-BusyPorts {
  $results = @()
  foreach ($line in (& netstat -ano -p tcp 2>$null)) {
    if ($line -match '^\s*TCP\s+\S+:(3000|8081)\s+\S+\s+LISTENING\s+(\d+)\s*$') {
      $results += [pscustomobject]@{ LocalPort = [int]$Matches[1]; OwningProcess = [int]$Matches[2] }
    }
  }
  return @($results)
}

$deadline = (Get-Date).AddSeconds(5)
do {
  $busy = @(Get-BusyPorts)
  if ($busy.Count -eq 0) { break }
  Start-Sleep -Milliseconds 200
} while ((Get-Date) -lt $deadline)

if ($busy.Count -gt 0) {
  $summary = ($busy | Sort-Object LocalPort -Unique | ForEach-Object { "端口 $($_.LocalPort)（PID $($_.OwningProcess)）" }) -join '、'
  throw "$summary 已被未登记的进程占用。请先关闭旧版记账服务，再重新运行启动器；本次没有显示假成功。"
}

$staticOutLog = Join-Path $StateDir 'static-service-output.log'
$staticErrorLog = Join-Path $StateDir 'static-service-error.log'
$backendOutLog = Join-Path $StateDir 'backend-service-output.log'
$backendErrorLog = Join-Path $StateDir 'backend-service-error.log'
Remove-Item -LiteralPath $staticOutLog, $staticErrorLog, $backendOutLog, $backendErrorLog -Force -ErrorAction SilentlyContinue

$staticProcess = Start-Process -FilePath $NodePath -ArgumentList @($staticScript) -WorkingDirectory $serverDir -WindowStyle Hidden -RedirectStandardOutput $staticOutLog -RedirectStandardError $staticErrorLog -PassThru
$backendProcess = Start-Process -FilePath $NodePath -ArgumentList @($backendScript) -WorkingDirectory $serverDir -WindowStyle Hidden -RedirectStandardOutput $backendOutLog -RedirectStandardError $backendErrorLog -PassThru

$state = @{
  projectRoot = $project
  startedAt = (Get-Date).ToUniversalTime().ToString('o')
  static = @{ pid = $staticProcess.Id; script = $staticScript; nodePath = [IO.Path]::GetFullPath($NodePath); startedAtUnixMs = [DateTimeOffset]::new($staticProcess.StartTime).ToUnixTimeMilliseconds() }
  backend = @{ pid = $backendProcess.Id; script = $backendScript; nodePath = [IO.Path]::GetFullPath($NodePath); startedAtUnixMs = [DateTimeOffset]::new($backendProcess.StartTime).ToUnixTimeMilliseconds() }
}
$state | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $stateFile -Encoding UTF8

$httpHandler = New-Object Net.Http.HttpClientHandler
$httpHandler.UseProxy = $false
$httpClient = New-Object Net.Http.HttpClient($httpHandler)
$httpClient.Timeout = [TimeSpan]::FromSeconds(2)

function Test-Endpoint([string]$url) {
  try {
    $response = $httpClient.GetAsync($url).GetAwaiter().GetResult()
    $ok = [int]$response.StatusCode -eq 200
    $response.Dispose()
    return $ok
  } catch { return $false }
}

$healthy = $false
$deadline = (Get-Date).AddSeconds(15)
do {
  if ((Test-Endpoint 'http://127.0.0.1:8081/index.html') -and (Test-Endpoint 'http://127.0.0.1:3000/health') -and (Test-Endpoint 'http://127.0.0.1:3000/api/admin/status')) {
    $healthy = $true
    break
  }
  Start-Sleep -Milliseconds 350
} while ((Get-Date) -lt $deadline)

if (-not $healthy) {
  $httpClient.Dispose()
  $httpHandler.Dispose()
  Stop-TrackedProcess $state.static $staticScript
  Stop-TrackedProcess $state.backend $backendScript
  throw "服务未通过启动健康检查。请查看 $staticErrorLog 和 $backendErrorLog"
}

$httpClient.Dispose()
$httpHandler.Dispose()
Write-Host '前台、同步服务和管理后台均已通过健康检查。'
