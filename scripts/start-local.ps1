param(
	[int]$WebPort = 3000,
	[int]$ApiPort = 3001,
	[int]$PortSearchLimit = 20,
	[switch]$NoBrowser,
	[switch]$Kill
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
if (Get-Command chcp.com -ErrorAction SilentlyContinue) {
	& chcp.com 65001 | Out-Null
}

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$RootPath = $Root.Path
$ApiDir = Join-Path $RootPath "services/api"
$WebDir = Join-Path $RootPath "apps/web"
$LogsDir = Join-Path $RootPath ".local/run-logs"
$PgliteDir = Join-Path $RootPath ".local/pglite-runtime"

New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null
New-Item -ItemType Directory -Force -Path $PgliteDir | Out-Null

$checkEnvScript = Join-Path $PSScriptRoot "check-env.ps1"
if ($env:START_LOCAL_ENV_CHECKED -ne "1" -and (Test-Path $checkEnvScript)) {
	& $checkEnvScript -AutoInstall
	if ($LASTEXITCODE -ne 0) {
		Write-Error "Environment check failed. Resolve Node.js/pnpm dependencies first."
	}
}

function Test-Command($Name) {
	return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-PnpmCommand {
	if (Test-Command "pnpm") {
		return "pnpm"
	}

	if (Test-Command "corepack") {
		try {
			$null = corepack pnpm --version 2>$null
			if ($LASTEXITCODE -eq 0) {
				return "corepack pnpm"
			}
		}
		catch {
			return $null
		}
	}

	return $null
}

function Test-PathExists($Path) {
	return Test-Path -LiteralPath $Path
}

function Test-WorkspaceDependenciesInstalled {
	if (-not (Test-PathExists (Join-Path $RootPath "node_modules"))) {
		return @{
			Ok      = $false
			Message = "Workspace root node_modules is missing."
		}
	}

	$checks = @(
		@{ Dir = $ApiDir; Command = "$script:PnpmCommand exec nest --version" },
		@{ Dir = $WebDir; Command = "$script:PnpmCommand exec next --version" }
	)

	foreach ($check in $checks) {
		$tempOutputPath = Join-Path $LogsDir ("dependency-check-" + [System.Guid]::NewGuid().ToString("N") + ".out.log")
		$tempErrorPath = Join-Path $LogsDir ("dependency-check-" + [System.Guid]::NewGuid().ToString("N") + ".err.log")
		try {
			$result = Start-Process -FilePath "powershell.exe" `
				-ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $check.Command) `
				-WorkingDirectory $check.Dir `
				-WindowStyle Hidden `
				-RedirectStandardOutput $tempOutputPath `
				-RedirectStandardError $tempErrorPath `
				-Wait `
				-PassThru
			if ($result.ExitCode -ne 0) {
				$messageParts = @()
				if (Test-PathExists $tempOutputPath) {
					$stdoutContent = (Get-Content $tempOutputPath -Raw -ErrorAction SilentlyContinue).Trim()
					if (-not [string]::IsNullOrWhiteSpace($stdoutContent)) {
						$messageParts += $stdoutContent
					}
				}
				if (Test-PathExists $tempErrorPath) {
					$stderrContent = (Get-Content $tempErrorPath -Raw -ErrorAction SilentlyContinue).Trim()
					if (-not [string]::IsNullOrWhiteSpace($stderrContent)) {
						$messageParts += $stderrContent
					}
				}
				$message = if ($messageParts.Count -gt 0) {
					$messageParts -join [Environment]::NewLine
				} else {
					"Command failed: $($check.Command)"
				}
				return @{
					Ok      = $false
					Message = $message
				}
			}
		}
		finally {
			if (Test-PathExists $tempOutputPath) {
				Remove-Item -LiteralPath $tempOutputPath -Force -ErrorAction SilentlyContinue
			}
			if (Test-PathExists $tempErrorPath) {
				Remove-Item -LiteralPath $tempErrorPath -Force -ErrorAction SilentlyContinue
			}
		}
	}

	return @{
		Ok      = $true
		Message = ""
	}
}

function Ensure-WorkspaceDependencies {
	$dependencyStatus = Test-WorkspaceDependenciesInstalled
	if ($dependencyStatus.Ok) {
		Write-Host "Workspace dependencies already installed"
		return
	}

	Write-Host "Workspace dependencies missing; running pnpm install..."
	Push-Location $RootPath
	try {
		if ($script:PnpmCommand -eq "pnpm") {
			& pnpm install
		}
		else {
			& corepack pnpm install
		}
		if ($LASTEXITCODE -ne 0) {
			Write-Error "pnpm install failed. Fix dependency installation errors and rerun the script."
		}
	}
	finally {
		Pop-Location
	}

	$dependencyStatus = Test-WorkspaceDependenciesInstalled
	if (-not $dependencyStatus.Ok) {
		if (-not [string]::IsNullOrWhiteSpace($dependencyStatus.Message)) {
			Write-Host "Dependency verification failed:" -ForegroundColor Yellow
			Write-Host $dependencyStatus.Message -ForegroundColor Yellow
		}
		Write-Error "Dependencies or runtime requirements are still incomplete after pnpm install. Check the message above and rerun."
	}
}

function Get-ListeningConnections($Port) {
	return @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Test-CanBindLocalPort($Port) {
	$listener = $null
	try {
		$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), $Port)
		$listener.Start()
		return $true
	} catch {
		return $false
	} finally {
		if ($listener) {
			$listener.Stop()
		}
	}
}

function Test-PortInUse($Port) {
	return (Get-ListeningConnections $Port).Count -gt 0 -or -not (Test-CanBindLocalPort $Port)
}

function Get-ProcessInfo($ProcessId) {
	return Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
}

function Test-ProjectProcess($ProcessId) {
	$proc = Get-ProcessInfo $ProcessId
	return [bool]($proc -and $proc.CommandLine -and $proc.CommandLine.Contains($RootPath))
}

function Test-ProjectServiceProcess($Proc, $Kind) {
	if (-not ($Proc -and $Proc.CommandLine -and $Proc.CommandLine.Contains($RootPath))) {
		return $false
	}

	if ($Kind -eq "api") {
		return $Proc.CommandLine.Contains("\services\api\") -or $Proc.CommandLine.Contains("/services/api/")
	}

	return $Proc.CommandLine.Contains("\apps\web\") -or
		$Proc.CommandLine.Contains("/apps/web/") -or
		$Proc.CommandLine.Contains("next\dist\server\lib\start-server")
}

function Get-ProjectServiceProcesses($Kind) {
	return @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
			Test-ProjectServiceProcess $_ $Kind
		})
}

function Get-PortOwnerDescriptions($Port) {
	$owners = @()
	foreach ($conn in Get-ListeningConnections $Port) {
		$ownerProcessId = $conn.OwningProcess
		$proc = Get-ProcessInfo $ownerProcessId
		if ($proc) {
			$owners += "$($proc.Name) (PID $ownerProcessId)"
		} else {
			$owners += "PID $ownerProcessId"
		}
	}
	return $owners
}

function Stop-ProcessTreeById($ProcessId) {
	$children = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.ParentProcessId -eq $ProcessId })
	foreach ($child in $children) {
		Stop-ProcessTreeById $child.ProcessId
	}

	$proc = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
	if ($proc) {
		Write-Host "Stopping $($proc.ProcessName) (PID $ProcessId)"
		Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
	}
}

function Stop-ProjectPortProcesses($Port) {
	$stopped = $false
	foreach ($conn in Get-ListeningConnections $Port) {
		$ownerProcessId = $conn.OwningProcess
		if (Test-ProjectProcess $ownerProcessId) {
			Stop-ProcessTreeById $ownerProcessId
			$stopped = $true
		}
	}
	if ($stopped) {
		Start-Sleep -Seconds 1
	}
	return $stopped
}

function Stop-ProjectServiceProcesses($Kind) {
	foreach ($proc in Get-ProjectServiceProcesses $Kind) {
		Stop-ProcessTreeById $proc.ProcessId
	}
	Start-Sleep -Seconds 1
}

function Test-ApiHealthy($Port) {
	try {
		$response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
		return $response.StatusCode -eq 200
	} catch {
		return $false
	}
}

function Test-WebHealthy($Port) {
	try {
		$response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
		return $response.StatusCode -eq 200
	} catch {
		return $false
	}
}

function Get-HealthyProjectServicePort($PreferredPort, $Kind) {
	$lastPort = $PreferredPort + $PortSearchLimit
	for ($port = $PreferredPort; $port -le $lastPort; $port++) {
		$projectOwned = $false
		foreach ($conn in Get-ListeningConnections $port) {
			if (Test-ProjectProcess $conn.OwningProcess) {
				$projectOwned = $true
				break
			}
		}
		if (-not $projectOwned) {
			continue
		}

		$healthy = if ($Kind -eq "api") { Test-ApiHealthy $port } else { Test-WebHealthy $port }
		if ($healthy) {
			return $port
		}
	}

	return $null
}

function Resolve-ServicePort($PreferredPort, $Kind, [switch]$ForceRestartProjectService) {
	if (-not $Kill -and -not $ForceRestartProjectService) {
		for ($attempt = 0; $attempt -lt 10; $attempt++) {
			$healthyPort = Get-HealthyProjectServicePort $PreferredPort $Kind
			if ($healthyPort) {
				Write-Host "Reusing existing $Kind service on port $healthyPort"
				return @{
					Port = $healthyPort
					Reuse = $true
				}
			}

			if ((Get-ProjectServiceProcesses $Kind).Count -eq 0) {
				break
			}

			Write-Host "Waiting for existing $Kind service to become ready..."
			Start-Sleep -Seconds 1
		}
	}

	if ((Get-ProjectServiceProcesses $Kind).Count -gt 0 -and ($Kill -or $ForceRestartProjectService)) {
		Write-Host "Restarting existing $Kind service for this project"
		Stop-ProjectServiceProcesses $Kind
	}

	$lastPort = $PreferredPort + $PortSearchLimit
	for ($port = $PreferredPort; $port -le $lastPort; $port++) {
		if (-not (Test-PortInUse $port)) {
			return @{
				Port = $port
				Reuse = $false
			}
		}

		$projectOwned = $false
		foreach ($conn in Get-ListeningConnections $port) {
			if (Test-ProjectProcess $conn.OwningProcess) {
				$projectOwned = $true
				break
			}
		}

		if ($projectOwned) {
			$healthy = if ($Kind -eq "api") { Test-ApiHealthy $port } else { Test-WebHealthy $port }
			if ($healthy -and -not $Kill -and -not $ForceRestartProjectService) {
				Write-Host "Reusing existing $Kind service on port $port"
				return @{
					Port = $port
					Reuse = $true
				}
			}

			Write-Host "Restarting stale $Kind service on port $port"
			Stop-ProjectPortProcesses $port | Out-Null
			if (-not (Test-PortInUse $port)) {
				return @{
					Port = $port
					Reuse = $false
				}
			}
		}

		$owners = (Get-PortOwnerDescriptions $port) -join ", "
		if (-not $owners) {
			$owners = "another local service"
		}
		Write-Host "Port $port is used by $owners; trying next port."
	}

	Write-Error "No available port found for $Kind from $PreferredPort to $lastPort. Close other local services or pass a different -WebPort/-ApiPort."
}

function Start-DevProcess($Name, $WorkingDirectory, $Command) {
	Write-Host "Starting $Name"
	$encodedCommand = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($Command))
	Start-Process -FilePath "powershell.exe" `
		-ArgumentList @("-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", $encodedCommand) `
		-WorkingDirectory $WorkingDirectory `
		-WindowStyle Normal
}

$script:PnpmCommand = Get-PnpmCommand
if (-not $script:PnpmCommand) {
	Write-Error "pnpm not found even after environment check. Reopen the terminal and run the script again."
}

Ensure-WorkspaceDependencies

$apiSelection = Resolve-ServicePort $ApiPort "api"
$ApiPort = [int]$apiSelection.Port
$restartWebForApiUrl = -not $apiSelection.Reuse
$webSelection = Resolve-ServicePort $WebPort "web" -ForceRestartProjectService:$restartWebForApiUrl
$WebPort = [int]$webSelection.Port

if ($WebPort -eq $ApiPort) {
	$webSelection = Resolve-ServicePort ($WebPort + 1) "web" -ForceRestartProjectService:$restartWebForApiUrl
	$WebPort = [int]$webSelection.Port
}

$ApiBaseUrl = "http://127.0.0.1:$ApiPort/api/v1"
$AllowedOrigins = "http://localhost:$WebPort,http://127.0.0.1:$WebPort"
$ApiLog = Join-Path $LogsDir "api-dev.log"
$WebLog = Join-Path $LogsDir "web-dev.log"

Get-ChildItem -Path $LogsDir -Filter "*.log" -File -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

$ChildEncodingSetup = @'
$ProgressPreference = "SilentlyContinue"
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
if (Get-Command chcp.com -ErrorAction SilentlyContinue) {
	& chcp.com 65001 | Out-Null
}
$env:NO_COLOR = "1"
$env:FORCE_COLOR = "0"
$env:TERM = "dumb"
$env:NEXT_TELEMETRY_DISABLED = "1"
$script:AnsiPattern = [regex]::new([string]([char]27) + '\[[0-9;?]*[ -/]*[@-~]')
function Write-Utf8LogLine {
	param(
		[string]$Path,
		[object]$Value
	)

	$line = if ($null -eq $Value) { "" } else { $Value.ToString() }
	Write-Host $line
	$cleanLine = $script:AnsiPattern.Replace($line, "")
	[System.IO.File]::AppendAllText($Path, $cleanLine + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
}
'@

if (-not $apiSelection.Reuse) {
	$apiPnpmCommand = if ($script:PnpmCommand -eq "pnpm") {
		"pnpm run start:dev"
	} else {
		"corepack pnpm run start:dev"
	}
	$ApiCommand = @"
${ChildEncodingSetup}
`$env:PORT="$ApiPort"
`$env:ALLOWED_ORIGINS="$AllowedOrigins"
`$env:PGLITE_DATA_DIR="$PgliteDir"
`$LogFile="$ApiLog"
$apiPnpmCommand 2>&1 | ForEach-Object { Write-Utf8LogLine `$LogFile `$_ }
"@
	Start-DevProcess "API on http://127.0.0.1:$ApiPort" $ApiDir $ApiCommand
}

if (-not $webSelection.Reuse) {
	$webPnpmCommand = if ($script:PnpmCommand -eq "pnpm") {
		"pnpm run dev --hostname 127.0.0.1 --port $WebPort"
	} else {
		"corepack pnpm run dev --hostname 127.0.0.1 --port $WebPort"
	}
	$WebCommand = @"
${ChildEncodingSetup}
`$env:NEXT_PUBLIC_API_BASE_URL="$ApiBaseUrl"
`$LogFile="$WebLog"
$webPnpmCommand 2>&1 | ForEach-Object { Write-Utf8LogLine `$LogFile `$_ }
"@
	Start-DevProcess "Web on http://127.0.0.1:$WebPort" $WebDir $WebCommand
}

Write-Host ""
Write-Host "Local app:"
Write-Host "  Web: http://127.0.0.1:$WebPort"
Write-Host "  API: $ApiBaseUrl"
Write-Host "  Logs: $LogsDir"
Write-Host ""

$maxWait = 45
$waited = 0
Write-Host "Waiting for API..." -NoNewline
while ($waited -lt $maxWait) {
	if (Test-ApiHealthy $ApiPort) {
		Write-Host " ready!"
		break
	}
	Start-Sleep -Seconds 1
	$waited++
	Write-Host "." -NoNewline
}
if ($waited -ge $maxWait) {
	Write-Host " timeout. Check $ApiLog"
}

if (-not $NoBrowser) {
	Start-Process "http://127.0.0.1:$WebPort"
}

Write-Host "Close the opened API/Web PowerShell windows to stop the dev servers."
