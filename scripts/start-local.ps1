param(
	[int]$WebPort = 3000,
	[int]$ApiPort = 3001,
	[int]$PortSearchLimit = 20,
	[switch]$NoBrowser,
	[Alias("a")]
	[switch]$AutoInstall,
	[switch]$Kill,
	[switch]$Reuse,
	[switch]$ResetPglite,
	[switch]$RecoveryRetry,
	[switch]$ElevatedInstall
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
$script:UsePortablePnpmInstall = $false
$OriginalBoundParameters = @{}
foreach ($key in $PSBoundParameters.Keys) {
	$OriginalBoundParameters[$key] = $PSBoundParameters[$key]
}

if ($Reuse -and $Kill) {
	Write-Error "Use either -Reuse or -Kill, not both."
}

if (-not $Reuse) {
	$Kill = $true
}

function Test-PathExists($Path) {
	return Test-Path -LiteralPath $Path
}

New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null

if ($ResetPglite) {
	Write-Host "Resetting local PGlite runtime data directory: $PgliteDir"
	if (Test-PathExists $PgliteDir) {
		Remove-Item -LiteralPath $PgliteDir -Recurse -Force -ErrorAction SilentlyContinue
	}
}

New-Item -ItemType Directory -Force -Path $PgliteDir | Out-Null

$script:StartLocalMutex = [System.Threading.Mutex]::new($false, "Local\AiNovelDiagnosisStartLocal")
$script:StartLocalMutexAcquired = $false
try {
	$script:StartLocalMutexAcquired = $script:StartLocalMutex.WaitOne([TimeSpan]::FromSeconds(60))
}
catch [System.Threading.AbandonedMutexException] {
	$script:StartLocalMutexAcquired = $true
}
if (-not $script:StartLocalMutexAcquired) {
	Write-Error "Another start-local launcher is still preparing services. Close it or retry after it finishes."
}

function Release-StartLocalMutex {
	if ($script:StartLocalMutexAcquired) {
		$script:StartLocalMutex.ReleaseMutex() | Out-Null
		$script:StartLocalMutexAcquired = $false
	}
	if ($script:StartLocalMutex) {
		$script:StartLocalMutex.Dispose()
		$script:StartLocalMutex = $null
	}
}

trap {
	Release-StartLocalMutex
	break
}

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

function Test-AdminPrivilege {
	$currentUser = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
	return $currentUser.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-PnpmCommand {
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

	if (Test-Command "pnpm") {
		return "pnpm"
	}

	return $null
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
		@{ Dir = $WebDir; Command = "$script:PnpmCommand exec next --version" },
		@{ Dir = $ApiDir; Command = 'if (Test-Path -LiteralPath ".\node_modules\@ai-novel-diagnosis\ai-core\package.json") { exit 0 } else { exit 1 }' },
		@{ Dir = $WebDir; Command = 'if (Test-Path -LiteralPath ".\node_modules\@ai-novel-diagnosis\ai-core\package.json") { exit 0 } else { exit 1 }' }
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
					$stdoutContent = Get-Content $tempOutputPath -Raw -ErrorAction SilentlyContinue
					if (-not [string]::IsNullOrWhiteSpace($stdoutContent)) {
						$messageParts += $stdoutContent.Trim()
					}
				}
				if (Test-PathExists $tempErrorPath) {
					$stderrContent = Get-Content $tempErrorPath -Raw -ErrorAction SilentlyContinue
					if (-not [string]::IsNullOrWhiteSpace($stderrContent)) {
						$messageParts += $stderrContent.Trim()
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

function Invoke-PnpmInstall {
	Push-Location $RootPath
	try {
		$installArgs = @("install")
		if ($script:UsePortablePnpmInstall) {
			$installArgs += @(
				"--config.node-linker=hoisted",
				"--config.package-import-method=copy",
				"--config.link-workspace-packages=false"
			)
		}

		if ($script:PnpmCommand -eq "pnpm") {
			& pnpm @installArgs
		}
		else {
			& corepack pnpm @installArgs
		}

		return $LASTEXITCODE
	}
	finally {
		Pop-Location
	}
}

function Test-DirectorySymlinkSupported {
	$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("ai-novel-symlink-test-" + [System.Guid]::NewGuid().ToString("N"))
	try {
		New-Item -ItemType Directory -Force -Path (Join-Path $tempRoot "target") | Out-Null
		$script = "const fs=require('fs'); const path=require('path'); const root=process.argv[1]; fs.symlinkSync(path.join(root,'target'), path.join(root,'link'));"
		& node -e $script $tempRoot *> $null
		return $LASTEXITCODE -eq 0
	}
	catch {
		return $false
	}
	finally {
		if (Test-PathExists $tempRoot) {
			Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
		}
	}
}

function Test-DirectoryJunctionSupported {
	$tempRoot = Join-Path $LogsDir ("junction-test-" + [System.Guid]::NewGuid().ToString("N"))
	try {
		$target = Join-Path $tempRoot "target"
		$link = Join-Path $tempRoot "link"
		New-Item -ItemType Directory -Force -Path $target | Out-Null
		& cmd.exe /d /c "mklink /J `"$link`" `"$target`"" *> $null
		return $LASTEXITCODE -eq 0 -and (Test-PathExists $link)
	}
	catch {
		return $false
	}
	finally {
		if (Test-PathExists $tempRoot) {
			Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
		}
	}
}

function ConvertTo-StartLocalArgumentList {
	$args = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $PSCommandPath)
	$knownSwitches = @("NoBrowser", "AutoInstall", "Kill", "Reuse", "ResetPglite", "RecoveryRetry", "ElevatedInstall")

	foreach ($entry in $OriginalBoundParameters.GetEnumerator()) {
		if ($entry.Key -eq "ElevatedInstall") {
			continue
		}

		$args += "-$($entry.Key)"
		if (-not $knownSwitches.Contains($entry.Key)) {
			$args += [string]$entry.Value
		}
	}

	$args += "-ElevatedInstall"
	return $args
}

function Start-ElevatedStartLocal {
	Write-Host "Current Windows session cannot create directory symlinks." -ForegroundColor Yellow
	Write-Host "Opening an Administrator PowerShell window to finish pnpm install and startup..." -ForegroundColor Yellow
	Release-StartLocalMutex
	$process = Start-Process -FilePath "powershell.exe" `
		-ArgumentList (ConvertTo-StartLocalArgumentList) `
		-WorkingDirectory $RootPath `
		-Verb RunAs `
		-Wait `
		-PassThru
	exit $process.ExitCode
}

function Build-AiCorePackage {
	if (Test-PathExists (Join-Path $RootPath "packages/ai-core/dist/index.mjs")) {
		return $true
	}

	Push-Location (Join-Path $RootPath "packages/ai-core")
	try {
		if ($script:PnpmCommand -eq "pnpm") {
			& pnpm run build
		}
		else {
			& corepack pnpm run build
		}
		return $LASTEXITCODE -eq 0
	}
	finally {
		Pop-Location
	}
}

function Remove-OrQuarantineGeneratedDirectory($Path) {
	$resolvedPath = (Resolve-Path -LiteralPath $Path).Path
	if (-not ($resolvedPath -eq $RootPath -or $resolvedPath.StartsWith($RootPath + [System.IO.Path]::DirectorySeparatorChar))) {
		Write-Error "Refusing to remove generated directory outside workspace: $resolvedPath"
	}

	Write-Host "Removing generated dependency directory: $resolvedPath"
	try {
		Remove-Item -LiteralPath $resolvedPath -Recurse -Force -ErrorAction Stop
		return
	}
	catch {
		$parent = Split-Path -Parent $resolvedPath
		$name = Split-Path -Leaf $resolvedPath
		$quarantineName = "$name.failed-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
		Write-Host "Remove failed; renaming to $quarantineName so install can continue." -ForegroundColor Yellow
		$cmd = "cd /d `"$parent`" && ren `"$name`" `"$quarantineName`""
		& cmd.exe /d /c $cmd
		if ($LASTEXITCODE -ne 0 -or (Test-PathExists $resolvedPath)) {
			Write-Error "Could not remove or rename generated dependency directory: $resolvedPath"
		}
	}
}

function Sync-AiCorePackageCopy($Destination) {
	$source = Join-Path $RootPath "packages/ai-core"
	$sourceDist = Join-Path $source "dist"
	if (-not (Test-PathExists (Join-Path $source "package.json")) -or -not (Test-PathExists $sourceDist)) {
		return $false
	}

	$destinationParent = Split-Path -Parent $Destination
	New-Item -ItemType Directory -Force -Path $destinationParent | Out-Null
	if (Test-PathExists $Destination) {
		Remove-OrQuarantineGeneratedDirectory $Destination
	}
	New-Item -ItemType Directory -Force -Path $Destination | Out-Null

	foreach ($file in @("package.json", "README.md", "LICENSE")) {
		$sourceFile = Join-Path $source $file
		if (Test-PathExists $sourceFile) {
			Copy-Item -LiteralPath $sourceFile -Destination (Join-Path $Destination $file) -Force
		}
	}
	Copy-Item -LiteralPath $sourceDist -Destination (Join-Path $Destination "dist") -Recurse -Force
	return Test-PathExists (Join-Path $Destination "package.json")
}

function Sync-WorkspacePackageCopies {
	Write-Host "Falling back to copied workspace packages because this drive does not support dependency links." -ForegroundColor Yellow
	if (-not (Build-AiCorePackage)) {
		return $false
	}

	$destinations = @(
		(Join-Path $ApiDir "node_modules/@ai-novel-diagnosis/ai-core"),
		(Join-Path $WebDir "node_modules/@ai-novel-diagnosis/ai-core")
	)
	foreach ($destination in $destinations) {
		if (-not (Sync-AiCorePackageCopy $destination)) {
			return $false
		}
	}

	return $true
}

function Remove-GeneratedNodeModules {
	$paths = @(
		(Join-Path $RootPath "node_modules"),
		(Join-Path $ApiDir "node_modules"),
		(Join-Path $WebDir "node_modules"),
		(Join-Path $RootPath "packages/ai-core/node_modules")
	)

	foreach ($path in ($paths | Sort-Object Length -Descending)) {
		if (-not (Test-PathExists $path)) {
			continue
		}

		Remove-OrQuarantineGeneratedDirectory $path
	}
}

function Ensure-WorkspaceDependencies {
	$dependencyStatus = Test-WorkspaceDependenciesInstalled
	if ($dependencyStatus.Ok) {
		Write-Host "Workspace dependencies already installed"
		return
	}

	Write-Host "Workspace dependencies missing; running pnpm install..."
	$copyFallbackRequired = $false
	if (-not (Test-DirectorySymlinkSupported)) {
		$junctionSupported = Test-DirectoryJunctionSupported
		if ($junctionSupported -and -not $ElevatedInstall -and -not (Test-AdminPrivilege)) {
			Start-ElevatedStartLocal
		}

		if ($junctionSupported) {
			Write-Host "This Windows session still cannot create directory symlinks." -ForegroundColor Yellow
			Write-Host "Fix one of these, then run scripts/start-local.cmd again:" -ForegroundColor Yellow
			Write-Host "  1. Enable Windows Developer Mode." -ForegroundColor Yellow
			Write-Host "  2. Or open PowerShell as Administrator and run: corepack pnpm install" -ForegroundColor Yellow
			Write-Error "Stopped before pnpm install to avoid corrupting node_modules."
		}

		Write-Host "This drive does not support dependency links; install will use a copy fallback after pnpm finishes." -ForegroundColor Yellow
		$copyFallbackRequired = $true
		$script:UsePortablePnpmInstall = $true
	}

	$installExitCode = Invoke-PnpmInstall
	if ($installExitCode -ne 0) {
		if (Sync-WorkspacePackageCopies) {
			$dependencyStatus = Test-WorkspaceDependenciesInstalled
			if ($dependencyStatus.Ok) {
				Write-Host "Workspace dependencies installed with copied local packages"
				return
			}
		}

		if ($copyFallbackRequired) {
			Write-Error "pnpm install could not finish on this non-linking drive, and the copied package fallback did not produce a complete install."
		}

		Write-Host "pnpm install failed. Cleaning generated node_modules and retrying once..." -ForegroundColor Yellow
		Remove-GeneratedNodeModules
		$installExitCode = Invoke-PnpmInstall
		if ($installExitCode -ne 0) {
			if (Sync-WorkspacePackageCopies) {
				$dependencyStatus = Test-WorkspaceDependenciesInstalled
				if ($dependencyStatus.Ok) {
					Write-Host "Workspace dependencies installed with copied local packages"
					return
				}
			}
			Write-Error "pnpm install failed after a clean retry. Fix dependency installation errors and rerun the script."
		}
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

function Test-CanBindSocket($Address, $Port, [switch]$DualMode) {
	$socket = $null
	try {
		$socket = [System.Net.Sockets.Socket]::new($Address.AddressFamily, [System.Net.Sockets.SocketType]::Stream, [System.Net.Sockets.ProtocolType]::Tcp)
		if ($DualMode -and $Address.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetworkV6) {
			$socket.DualMode = $true
		}
		$socket.Bind([System.Net.IPEndPoint]::new($Address, $Port))
		$socket.Listen(1)
		return $true
	} catch {
		return $false
	} finally {
		if ($socket) {
			$socket.Close()
			$socket.Dispose()
		}
	}
}

function Test-CanBindLocalPort($Port) {
	return (Test-CanBindSocket ([System.Net.IPAddress]::Any) $Port) -and
		(Test-CanBindSocket ([System.Net.IPAddress]::IPv6Any) $Port -DualMode)
}

function Test-PortInUse($Port) {
	return (Get-ListeningConnections $Port).Count -gt 0 -or -not (Test-CanBindLocalPort $Port)
}

function Wait-ForPortRelease($Port, $TimeoutSeconds = 10) {
	$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
	while ((Get-Date) -lt $deadline) {
		if (-not (Test-PortInUse $Port)) {
			Start-Sleep -Milliseconds 250
			if (-not (Test-PortInUse $Port)) {
				return $true
			}
		}
		Start-Sleep -Milliseconds 250
	}

	return -not (Test-PortInUse $Port)
}

function Test-PortReadyForStart($Port) {
	if (Test-PortInUse $Port) {
		return $false
	}

	Start-Sleep -Milliseconds 250
	return -not (Test-PortInUse $Port)
}

function Get-ProcessInfo($ProcessId) {
	return Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
}

function Get-DecodedEncodedCommand($CommandLine) {
	if ([string]::IsNullOrWhiteSpace($CommandLine)) {
		return ""
	}

	$match = [regex]::Match($CommandLine, "(?i)(?:-|/)enc(?:odedcommand)?\s+`"?(?<value>[A-Za-z0-9+/=]+)`"?")
	if (-not $match.Success) {
		return ""
	}

	try {
		return [System.Text.Encoding]::Unicode.GetString([Convert]::FromBase64String($match.Groups["value"].Value))
	} catch {
		return ""
	}
}

function Test-ProcessCommandContains($Proc, $Text) {
	if (-not ($Proc -and $Text)) {
		return $false
	}

	if ($Proc.CommandLine -and $Proc.CommandLine.Contains($Text)) {
		return $true
	}

	$decodedCommand = Get-DecodedEncodedCommand $Proc.CommandLine
	return $decodedCommand.Contains($Text)
}

function Test-ProjectProcess($ProcessId) {
	$current = Get-ProcessInfo $ProcessId
	$visited = @{}
	while ($current -and -not $visited.ContainsKey($current.ProcessId)) {
		$visited[$current.ProcessId] = $true
		if (Test-ProcessCommandContains $current $RootPath) {
			return $true
		}
		if (-not $current.ParentProcessId) {
			break
		}
		$current = Get-ProcessInfo $current.ParentProcessId
	}

	return $false
}

function Test-ProjectServiceProcess($Proc, $Kind) {
	if (-not (Test-ProcessCommandContains $Proc $RootPath)) {
		return $false
	}

	if ($Kind -eq "api") {
		return (Test-ProcessCommandContains $Proc "\services\api\") -or (Test-ProcessCommandContains $Proc "/services/api/")
	}

	return (Test-ProcessCommandContains $Proc "\apps\web\") -or
		(Test-ProcessCommandContains $Proc "/apps/web/") -or
		(Test-ProcessCommandContains $Proc "next\dist\server\lib\start-server")
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

function Test-StartLocalHostProcess($Proc) {
	if (-not ($Proc -and $Proc.CommandLine)) {
		return $false
	}

	if ($Proc.ProcessId -eq $PID) {
		return $false
	}

	$name = if ($Proc.Name) { $Proc.Name.ToLowerInvariant() } else { "" }
	return ($name -eq "powershell.exe" -or $name -eq "pwsh.exe") -and
		$Proc.CommandLine.Contains("-EncodedCommand") -and
		($Proc.CommandLine.Contains("-NoExit") -or (Test-ProcessCommandContains $Proc $RootPath))
}

function Get-StartLocalHostProcessId($ProcessId) {
	$current = Get-ProcessInfo $ProcessId
	$visited = @{}

	while ($current -and $current.ParentProcessId -and -not $visited.ContainsKey($current.ProcessId)) {
		$visited[$current.ProcessId] = $true
		$parent = Get-ProcessInfo $current.ParentProcessId
		if (Test-StartLocalHostProcess $parent) {
			return $parent.ProcessId
		}
		$current = $parent
	}

	return $null
}

function Stop-ProjectServiceProcessTree($ProcessId) {
	$hostProcessId = Get-StartLocalHostProcessId $ProcessId
	if ($hostProcessId) {
		Write-Host "Closing old service window (PID $hostProcessId)"
		Stop-ProcessTreeById $hostProcessId
		return
	}

	Stop-ProcessTreeById $ProcessId
}

function Stop-ProjectPortProcesses($Port) {
	$stopped = $false
	foreach ($conn in Get-ListeningConnections $Port) {
		$ownerProcessId = $conn.OwningProcess
		if (Test-ProjectProcess $ownerProcessId) {
			Stop-ProjectServiceProcessTree $ownerProcessId
			$stopped = $true
		}
	}
	if ($stopped) {
		Wait-ForPortRelease $Port | Out-Null
	}
	return $stopped
}

function Stop-ProjectServiceProcesses($Kind) {
	$ports = @{}
	foreach ($proc in Get-ProjectServiceProcesses $Kind) {
		foreach ($conn in Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -eq $proc.ProcessId }) {
			$ports[[int]$conn.LocalPort] = $true
		}
		Stop-ProjectServiceProcessTree $proc.ProcessId
	}
	if ($ports.Count -gt 0) {
		foreach ($port in $ports.Keys) {
			Wait-ForPortRelease $port | Out-Null
		}
	} else {
		Start-Sleep -Seconds 1
	}
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
		if (Test-PortReadyForStart $port) {
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
			if (Test-PortReadyForStart $port) {
				return @{
					Port = $port
					Reuse = $false
				}
			}

			Write-Host "Port $port is still releasing after stopping this project's $Kind service; trying next port."
			continue
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
`$env:API_INTERNAL_BASE_URL="$ApiBaseUrl"
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
	Write-Host " timeout."
	if (-not $RecoveryRetry) {
		Write-Host "Retrying with a fresh PGlite runtime because the API is not answering /health ..."
		Stop-ProjectServiceProcesses "api" | Out-Null
		$restartArgs = @(
			"-Kill",
			"-ResetPglite",
			"-RecoveryRetry",
			"-WebPort",
			$WebPort,
			"-ApiPort",
			$ApiPort,
			"-PortSearchLimit",
			$PortSearchLimit
		)
		if ($NoBrowser) {
			$restartArgs += "-NoBrowser"
		}
		powershell.exe -NoProfile -ExecutionPolicy Bypass -File $PSCommandPath @restartArgs
		Exit $LASTEXITCODE
	}

	Write-Host " still unreachable after recovery retry. Check $ApiLog"
	Exit 1
}

if (-not $NoBrowser) {
	Start-Process "http://127.0.0.1:$WebPort"
}

Write-Host "Close the opened API/Web PowerShell windows to stop the dev servers."

Release-StartLocalMutex
