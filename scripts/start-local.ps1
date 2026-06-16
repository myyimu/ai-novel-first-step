param(
	[int]$WebPort = 3000,
	[int]$ApiPort = 3001,
	[switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$ApiDir = Join-Path $Root "services/api"
$WebDir = Join-Path $Root "apps/web"
$LogsDir = Join-Path $Root ".local/run-logs"

New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null

function Test-Command($Name) {
	return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Test-PortInUse($Port) {
	return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

if (-not (Test-Command "pnpm.cmd")) {
	Write-Error "pnpm.cmd not found. Install pnpm first, then rerun this script."
}

if (Test-PortInUse $WebPort) {
	Write-Error "Web port $WebPort is already in use. Stop the existing process or run: .\scripts\start-local.ps1 -WebPort <port>"
}

if (Test-PortInUse $ApiPort) {
	Write-Error "API port $ApiPort is already in use. Stop the existing process or run: .\scripts\start-local.ps1 -ApiPort <port>"
}

$ApiBaseUrl = "http://127.0.0.1:$ApiPort/api/v1"
$AllowedOrigins = "http://localhost:$WebPort,http://127.0.0.1:$WebPort"
$ApiLog = Join-Path $LogsDir "api-dev.log"
$WebLog = Join-Path $LogsDir "web-dev.log"

$ApiCommand = @"
`$env:PORT="$ApiPort"
`$env:ALLOWED_ORIGINS="$AllowedOrigins"
pnpm run start:dev 2>&1 | Tee-Object -FilePath "$ApiLog"
"@

$WebCommand = @"
`$env:NEXT_PUBLIC_API_BASE_URL="$ApiBaseUrl"
pnpm run dev --hostname 127.0.0.1 --port $WebPort 2>&1 | Tee-Object -FilePath "$WebLog"
"@

Write-Host "Starting API on http://127.0.0.1:$ApiPort"
Start-Process -FilePath "powershell.exe" `
	-ArgumentList @("-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $ApiCommand) `
	-WorkingDirectory $ApiDir

Write-Host "Starting Web on http://127.0.0.1:$WebPort"
Start-Process -FilePath "powershell.exe" `
	-ArgumentList @("-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $WebCommand) `
	-WorkingDirectory $WebDir

if (-not $NoBrowser) {
	Start-Sleep -Seconds 3
	Start-Process "http://127.0.0.1:$WebPort"
}

Write-Host ""
Write-Host "Local app starting:"
Write-Host "  Web: $([string]::Format('http://127.0.0.1:{0}', $WebPort))"
Write-Host "  API: $ApiBaseUrl"
Write-Host "  Logs: $LogsDir"
Write-Host ""
Write-Host "Close the opened API/Web PowerShell windows to stop the dev servers."
