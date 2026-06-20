# Environment Check Helper Script
# This script checks if Node.js and pnpm are installed before starting the app
# Usage: .\scripts\check-env.ps1 [-AutoInstall]

param(
	[switch]$AutoInstall
)

$ErrorActionPreference = "Continue"
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

function Test-Command($Name) {
	return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-Version($Command) {
	try {
		$versionOutput = & $Command --version 2>&1
		if ($versionOutput) {
			$versionString = if ($versionOutput -is [array]) { $versionOutput[0] } else { $versionOutput }
			if ($versionString -match '(\d+)\.(\d+)\.(\d+)') {
				return @{
					Major = [int]$matches[1]
					Minor = [int]$matches[2]
					Patch = [int]$matches[3]
					Raw   = $versionString.Trim()
				}
			}
		}
	}
	catch {
		return $null
	}
	return $null
}

function Get-PnpmVersion {
	$pnpmVersion = Get-Version "pnpm"
	if ($pnpmVersion) {
		return $pnpmVersion
	}

	if (Test-Command "corepack") {
		try {
			$versionOutput = corepack pnpm --version 2>&1
			if ($versionOutput) {
				$versionString = if ($versionOutput -is [array]) { $versionOutput[0] } else { $versionOutput }
				if ($versionString -match '(\d+)\.(\d+)\.(\d+)') {
					return @{
						Major = [int]$matches[1]
						Minor = [int]$matches[2]
						Patch = [int]$matches[3]
						Raw   = $versionString.Trim()
					}
				}
			}
		}
		catch {
			return $null
		}
	}

	return $null
}

function Test-MinimumVersion($Version, $MinMajor, $MinMinor, $MinPatch) {
	if (-not $Version) { return $false }
	
	if ($Version.Major -gt $MinMajor) { return $true }
	if ($Version.Major -eq $MinMajor) {
		if ($Version.Minor -gt $MinMinor) { return $true }
		if ($Version.Minor -eq $MinMinor) {
			return $Version.Patch -ge $MinPatch
		}
	}
	return $false
}

function Get-VersionPartsFromText {
	param(
		[string]$Text
	)

	if ([string]::IsNullOrWhiteSpace($Text)) {
		return $null
	}

	if ($Text -match '(\d+)\.(\d+)\.(\d+)') {
		return @{
			Major = [int]$matches[1]
			Minor = [int]$matches[2]
			Patch = [int]$matches[3]
			Raw   = "$($matches[1]).$($matches[2]).$($matches[3])"
		}
	}

	if ($Text -match '(\d+)\.(\d+)') {
		return @{
			Major = [int]$matches[1]
			Minor = [int]$matches[2]
			Patch = 0
			Raw   = "$($matches[1]).$($matches[2]).0"
		}
	}

	if ($Text -match '(\d+)') {
		return @{
			Major = [int]$matches[1]
			Minor = 0
			Patch = 0
			Raw   = "$($matches[1]).0.0"
		}
	}

	return $null
}

function Get-ProjectPackageJson {
	$packageJsonPath = Join-Path $ProjectRoot "package.json"
	if (-not (Test-Path $packageJsonPath)) {
		return $null
	}

	try {
		return Get-Content $packageJsonPath -Raw | ConvertFrom-Json
	}
	catch {
		return $null
	}
}

function Get-ProjectNodeRequirement {
	$nvmrcPath = Join-Path $ProjectRoot ".nvmrc"
	if (Test-Path $nvmrcPath) {
		$nvmrcContent = (Get-Content $nvmrcPath -TotalCount 1 -ErrorAction SilentlyContinue).Trim()
		$nvmrcVersion = Get-VersionPartsFromText $nvmrcContent
		if ($nvmrcVersion) {
			return $nvmrcVersion
		}
	}

	$packageJson = Get-ProjectPackageJson
	if ($packageJson -and $packageJson.engines -and $packageJson.engines.node) {
		$engineVersion = Get-VersionPartsFromText ([string]$packageJson.engines.node)
		if ($engineVersion) {
			return $engineVersion
		}
	}

	return @{
		Major = 18
		Minor = 0
		Patch = 0
		Raw   = "18.0.0"
	}
}

function Get-ProjectPnpmTargetVersion {
	$packageJson = Get-ProjectPackageJson
	if ($packageJson -and $packageJson.packageManager -and ([string]$packageJson.packageManager) -match '^pnpm@(.+)$') {
		return $matches[1]
	}

	return "10.14.0"
}

function Test-AdminPrivilege {
	$currentUser = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
	return $currentUser.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Update-SessionPath {
	$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
	$machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
	$pathEntries = @()
	foreach ($pathValue in @($machinePath, $userPath)) {
		if ([string]::IsNullOrWhiteSpace($pathValue)) {
			continue
		}

		foreach ($entry in $pathValue.Split(';')) {
			$trimmedEntry = $entry.Trim()
			if (-not [string]::IsNullOrWhiteSpace($trimmedEntry) -and -not $pathEntries.Contains($trimmedEntry)) {
				$pathEntries += $trimmedEntry
			}
		}
	}

	if ($pathEntries.Count -gt 0) {
		$env:Path = ($pathEntries -join ';')
	}
}

function Prepend-SessionPathEntry {
	param(
		[string]$PathEntry
	)

	if ([string]::IsNullOrWhiteSpace($PathEntry) -or -not (Test-Path $PathEntry)) {
		return
	}

	$currentEntries = @()
	if (-not [string]::IsNullOrWhiteSpace($env:Path)) {
		$currentEntries = $env:Path.Split(';') | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
	}

	$normalizedEntry = $PathEntry.Trim()
	$filteredEntries = @($currentEntries | Where-Object { $_.Trim() -ne $normalizedEntry })
	$env:Path = (@($normalizedEntry) + $filteredEntries) -join ';'
}

function Get-NvmSettings {
	$nvmCommand = Get-Command "nvm" -ErrorAction SilentlyContinue
	if (-not $nvmCommand) {
		return $null
	}

	$settingsPath = Join-Path (Split-Path $nvmCommand.Source -Parent) "settings.txt"
	if (-not (Test-Path $settingsPath)) {
		return $null
	}

	$settings = @{}
	foreach ($line in Get-Content $settingsPath -ErrorAction SilentlyContinue) {
		if ($line -match '^\s*([^:]+):\s*(.+?)\s*$') {
			$settings[$matches[1].Trim().ToLowerInvariant()] = $matches[2].Trim()
		}
	}

	return $settings
}

function Get-NvmInstalledVersions {
	$settings = Get-NvmSettings
	if (-not $settings -or -not $settings.ContainsKey("root")) {
		return @()
	}

	$nvmRoot = $settings["root"]
	if (-not (Test-Path $nvmRoot)) {
		return @()
	}

	return @(Get-ChildItem -Path $nvmRoot -Directory -ErrorAction SilentlyContinue | ForEach-Object {
			if ($_.Name -match '^v?(\d+)\.(\d+)\.(\d+)$') {
				[PSCustomObject]@{
					Version = [version]"$($matches[1]).$($matches[2]).$($matches[3])"
					Raw     = $_.Name
					Path    = $_.FullName
				}
			}
		} | Where-Object { $_ } | Sort-Object Version -Descending)
}

function Use-NvmInstalledVersion {
	param(
		[int]$MinMajor,
		[int]$MinMinor,
		[int]$MinPatch
	)

	$minimumVersion = [version]"$MinMajor.$MinMinor.$MinPatch"
	$candidate = Get-NvmInstalledVersions | Where-Object { $_.Version -ge $minimumVersion } | Select-Object -First 1
	if (-not $candidate) {
		return $null
	}

	$nodeExecutable = Join-Path $candidate.Path "node.exe"
	if (-not (Test-Path $nodeExecutable)) {
		return $null
	}

	Prepend-SessionPathEntry $candidate.Path
	return $candidate
}

function Install-Pnpm {
	param(
		[string]$Version = "10.14.0"
	)

	if (-not (Test-Command "node")) {
		Write-Host "Cannot install pnpm without Node.js" -ForegroundColor Red
		return $false
	}

	if (Test-Command "corepack") {
		try {
			Write-Host "Installing pnpm via corepack..." -NoNewline
			corepack enable | Out-Null
			corepack prepare "pnpm@$Version" --activate | Out-Null
			if ($LASTEXITCODE -eq 0) {
				Update-SessionPath
				Write-Host " Done!" -ForegroundColor Green
				return $true
			}
			Write-Host " Failed (exit code: $LASTEXITCODE)" -ForegroundColor Red
		}
		catch {
			Write-Host " Failed" -ForegroundColor Red
			Write-Host "   Error: $_" -ForegroundColor Gray
		}
	}

	try {
		Write-Host "Installing pnpm via npm..." -NoNewline
		npm install -g "pnpm@$Version" | Out-Null
		if ($LASTEXITCODE -eq 0) {
			Update-SessionPath
			Write-Host " Done!" -ForegroundColor Green
			return $true
		}
		Write-Host " Failed (exit code: $LASTEXITCODE)" -ForegroundColor Red
	}
	catch {
		Write-Host " Failed" -ForegroundColor Red
		Write-Host "   Error: $_" -ForegroundColor Gray
	}

	return $false
}

function Install-NodeJS-MultiChannel {
	param(
		[int]$MinMajor = 18,
		[int]$MinMinor = 0,
		[int]$MinPatch = 0,
		[string]$PreferredVersion = "20.11.0"
	)

	Write-Host ""
	Write-Host "=== Start automatic installation ===" -ForegroundColor Cyan
	Write-Host ""

	$existingNvmVersion = Use-NvmInstalledVersion -MinMajor $MinMajor -MinMinor $MinMinor -MinPatch $MinPatch
	if ($existingNvmVersion) {
		Write-Host "0. Reusing existing Node.js via nvm: $($existingNvmVersion.Raw)" -ForegroundColor Green
		return $true
	}
	
	# Channel 1: winget (Windows 10 1709+ / Windows 11)
	Write-Host "1. Trying install via winget..." -NoNewline
	if (Test-Command "winget") {
		try {
			Write-Host " Available" -ForegroundColor Green
			Write-Host "   Installing Node.js $PreferredVersion via winget..." -NoNewline
			winget install OpenJS.NodeJS.20 --silent --accept-package-agreements --accept-source-agreements | Out-Null
			if ($LASTEXITCODE -eq 0) {
				Write-Host " Done!" -ForegroundColor Green
				Update-SessionPath
				return $true
			}
			else {
				Write-Host " Failed (exit code: $LASTEXITCODE)" -ForegroundColor Red
			}
		}
		catch {
			Write-Host " Failed" -ForegroundColor Red
			Write-Host "   Error: $_" -ForegroundColor Gray
		}
	}
	else {
		Write-Host " Not available on this system" -ForegroundColor Yellow
	}
	
	# Channel 2: Chocolatey
	Write-Host "2. Trying install via Chocolatey..." -NoNewline
	if (Test-Command "choco") {
		try {
			Write-Host " Available" -ForegroundColor Green
			if (-not (Test-AdminPrivilege)) {
				Write-Host "   Warning: Administrator privileges required for Chocolatey" -ForegroundColor Yellow
			}
			else {
				Write-Host "   Installing Node.js $PreferredVersion via choco..." -NoNewline
				choco install nodejs-lts -y --no-progress | Out-Null
				if ($LASTEXITCODE -eq 0) {
					Write-Host " Done!" -ForegroundColor Green
					Update-SessionPath
					return $true
				}
				else {
					Write-Host " Failed (exit code: $LASTEXITCODE)" -ForegroundColor Red
				}
			}
		}
		catch {
			Write-Host " Failed" -ForegroundColor Red
			Write-Host "   Error: $_" -ForegroundColor Gray
		}
	}
	else {
		Write-Host " Not detected" -ForegroundColor Yellow
	}
	
	# Channel 3: nvm-windows (recommended for version isolation)
	Write-Host "3. Trying install via nvm-windows (recommended, version isolation)..." -NoNewline
	if (Test-Command "nvm") {
		try {
			Write-Host " Available" -ForegroundColor Green
			Write-Host "   Installing Node.js $PreferredVersion via nvm..." -NoNewline
			nvm install $PreferredVersion | Out-Null
			if ($LASTEXITCODE -eq 0) {
				$installedNvmVersion = Use-NvmInstalledVersion -MinMajor $MinMajor -MinMinor $MinMinor -MinPatch $MinPatch
				if ($installedNvmVersion) {
					Write-Host " Done!" -ForegroundColor Green
					Write-Host "   Activating Node.js via session PATH: $($installedNvmVersion.Raw)" -ForegroundColor Green
					Write-Host "   Switching to Node.js $($installedNvmVersion.Raw)..." -NoNewline
					nvm use $installedNvmVersion.Raw | Out-Null
					if ($LASTEXITCODE -eq 0) {
						Update-SessionPath
						Prepend-SessionPathEntry $installedNvmVersion.Path
						Write-Host " Done!" -ForegroundColor Green
						return $true
					}
					Write-Host " Skipped (nvm use did not complete cleanly, but session PATH was updated)" -ForegroundColor Yellow
					return $true
				}
				Write-Host " Failed (Node.js $PreferredVersion directory not found after install)" -ForegroundColor Red
			}
			else {
				Write-Host " Failed (exit code: $LASTEXITCODE)" -ForegroundColor Red
			}
		}
		catch {
			Write-Host " Failed" -ForegroundColor Red
			Write-Host "   Error: $_" -ForegroundColor Gray
		}
	}
	else {
		Write-Host " Not found" -ForegroundColor Yellow
	}
	
	# All channels failed
	Write-Host ""
	Write-Host "All automatic installation channels unavailable." -ForegroundColor Red
	Write-Host ""
	Write-Host "=== Manual installation options ===" -ForegroundColor Cyan
	Write-Host "Option 1: Official installer: https://nodejs.org/" -ForegroundColor White
	Write-Host "Option 2: Use nvm-windows to manage multiple Node versions: https://github.com/coreybutler/nvm-windows" -ForegroundColor White
	Write-Host ""
	Write-Host "Quick manual command reference:" -ForegroundColor Yellow
	Write-Host "# Install nvm-windows first, then install the project Node version" -ForegroundColor Gray
	Write-Host "choco install nvm" -ForegroundColor Gray
	Write-Host "nvm install $PreferredVersion" -ForegroundColor Gray
	Write-Host "nvm use $PreferredVersion" -ForegroundColor Gray
	Write-Host ""

	return $false
}

Write-Host "Checking environment dependencies..." -ForegroundColor Cyan

$projectNodeRequirement = Get-ProjectNodeRequirement
$nodeMinVersion = @{
	Major = $projectNodeRequirement.Major
	Minor = $projectNodeRequirement.Minor
	Patch = $projectNodeRequirement.Patch
}
$pnpmMinVersion = @{ Major = 9; Minor = 0; Patch = 0 }
$pnpmTargetVersion = Get-ProjectPnpmTargetVersion
$preferredNodeVersion = $projectNodeRequirement.Raw

$envOk = $true

# Check Node.js
$nodeVersion = Get-Version "node"
if (-not $nodeVersion) {
	Write-Host "X Node.js not found" -ForegroundColor Red
	Write-Host ""
	
	# Interactive prompt for auto-install
	if (-not $AutoInstall) {
		Write-Host "Node.js is not installed on your system." -ForegroundColor Yellow
		$response = Read-Host "Do you want to automatically install the project Node.js version ($preferredNodeVersion) now? [Y/n]"
		
		if ($response -eq '' -or $response -eq 'Y' -or $response -eq 'y') {
			if (-not (Install-NodeJS-MultiChannel -MinMajor $nodeMinVersion.Major -MinMinor $nodeMinVersion.Minor -MinPatch $nodeMinVersion.Patch -PreferredVersion $preferredNodeVersion)) {
				exit 1
			}
			$nodeVersion = Get-Version "node"
		}
		else {
			Write-Host ""
			Write-Host "Installation cancelled. Please install Node.js manually." -ForegroundColor Yellow
			Write-Host "Download from: https://nodejs.org/" -ForegroundColor Cyan
			Write-Host ""
			exit 1
		}
	}
	else {
		# Auto-install mode (skip prompt)
		if (-not (Install-NodeJS-MultiChannel -MinMajor $nodeMinVersion.Major -MinMinor $nodeMinVersion.Minor -MinPatch $nodeMinVersion.Patch -PreferredVersion $preferredNodeVersion)) {
			exit 1
		}
		$nodeVersion = Get-Version "node"
	}
}
elseif (-not (Test-MinimumVersion $nodeVersion $nodeMinVersion.Major $nodeMinVersion.Minor $nodeMinVersion.Patch)) {
	Write-Host "X Node.js version too old (current: $($nodeVersion.Raw), required: >= $preferredNodeVersion)" -ForegroundColor Red
	Write-Host ""
	
	# Interactive prompt for auto-install
	if (-not $AutoInstall) {
		Write-Host "Detected Node.js $($nodeVersion.Raw), need >= $preferredNodeVersion for this project." -ForegroundColor Yellow
		$response = Read-Host "Do you want to automatically install the project Node.js version ($preferredNodeVersion) now? [Y/n]"
		
		if ($response -eq '' -or $response -eq 'Y' -or $response -eq 'y') {
			if (-not (Install-NodeJS-MultiChannel -MinMajor $nodeMinVersion.Major -MinMinor $nodeMinVersion.Minor -MinPatch $nodeMinVersion.Patch -PreferredVersion $preferredNodeVersion)) {
				exit 1
			}
			$nodeVersion = Get-Version "node"
		}
		else {
			Write-Host ""
			Write-Host "Installation cancelled. Please install Node.js manually." -ForegroundColor Yellow
			Write-Host "Download from: https://nodejs.org/" -ForegroundColor Cyan
			Write-Host ""
			exit 1
		}
	}
	else {
		# Auto-install mode (skip prompt)
		if (-not (Install-NodeJS-MultiChannel -MinMajor $nodeMinVersion.Major -MinMinor $nodeMinVersion.Minor -MinPatch $nodeMinVersion.Patch -PreferredVersion $preferredNodeVersion)) {
			exit 1
		}
		$nodeVersion = Get-Version "node"
	}
}

if (-not $nodeVersion) {
	Write-Host "X Node.js installation finished, but the current shell still cannot find 'node'." -ForegroundColor Red
	Write-Host "Please close this window and reopen it once, then run the script again." -ForegroundColor Yellow
	exit 1
}
elseif (-not (Test-MinimumVersion $nodeVersion $nodeMinVersion.Major $nodeMinVersion.Minor $nodeMinVersion.Patch)) {
	Write-Host "X Node.js is still below the required version after installation attempt (current: $($nodeVersion.Raw))." -ForegroundColor Red
	Write-Host "Please reopen the terminal and retry. If the problem persists, run 'nvm use $preferredNodeVersion' manually." -ForegroundColor Yellow
	exit 1
}
else {
	Write-Host "OK Node.js $($nodeVersion.Raw)" -ForegroundColor Green
}

# Check pnpm
if ($envOk) {
	$pnpmVersion = Get-PnpmVersion
	if (-not $pnpmVersion) {
		Write-Host "X pnpm not found" -ForegroundColor Red
		Write-Host "" -NoNewline
		Write-Host "Tips:" -ForegroundColor Yellow
		Write-Host "  1. Auto install (use -AutoInstall flag): .\scripts\start-local.cmd -a" -ForegroundColor Cyan
		Write-Host "  2. Manual install: https://pnpm.io/installation" -ForegroundColor Cyan
		Write-Host "  3. Or run: corepack enable && corepack prepare pnpm@$pnpmTargetVersion --activate" -ForegroundColor Cyan
		Write-Host ""
		if ($AutoInstall) {
			if (Install-Pnpm -Version $pnpmTargetVersion) {
				$pnpmVersion = Get-PnpmVersion
			}
			else {
				Write-Host "Please install pnpm manually from: https://pnpm.io/installation" -ForegroundColor Yellow
				$envOk = $false
			}
		}
		else {
			$response = Read-Host "Do you want to automatically install pnpm $pnpmTargetVersion now? [Y/n]"
			if ($response -eq '' -or $response -eq 'Y' -or $response -eq 'y') {
				if (Install-Pnpm -Version $pnpmTargetVersion) {
					$pnpmVersion = Get-PnpmVersion
				}
				else {
					Write-Host "Please install pnpm manually from: https://pnpm.io/installation" -ForegroundColor Yellow
					$envOk = $false
				}
			}
			else {
				Write-Host "Please install pnpm from: https://pnpm.io/installation" -ForegroundColor Yellow
				Write-Host "Or run with -AutoInstall flag to install automatically" -ForegroundColor Yellow
				Write-Host ""
				$envOk = $false
			}
		}
	}
	elseif (-not (Test-MinimumVersion $pnpmVersion $pnpmMinVersion.Major $pnpmMinVersion.Minor $pnpmMinVersion.Patch)) {
		Write-Host "X pnpm version too old (current: v$($pnpmVersion.Raw), required: v$($pnpmMinVersion.Major).x or higher)" -ForegroundColor Red
		Write-Host "" -NoNewline
		Write-Host "Tips:" -ForegroundColor Yellow
		Write-Host "  1. Upgrade: corepack enable && corepack prepare pnpm@$pnpmTargetVersion --activate" -ForegroundColor Cyan
		Write-Host "  2. Or use -AutoInstall flag for auto upgrade" -ForegroundColor Cyan
		Write-Host ""
		if ($AutoInstall) {
			if (Install-Pnpm -Version $pnpmTargetVersion) {
				$pnpmVersion = Get-PnpmVersion
				if (-not (Test-MinimumVersion $pnpmVersion $pnpmMinVersion.Major $pnpmMinVersion.Minor $pnpmMinVersion.Patch)) {
					$envOk = $false
				}
			}
			else {
				$envOk = $false
			}
		}
		else {
			$response = Read-Host "Do you want to automatically upgrade pnpm to $pnpmTargetVersion now? [Y/n]"
			if ($response -eq '' -or $response -eq 'Y' -or $response -eq 'y') {
				if (Install-Pnpm -Version $pnpmTargetVersion) {
					$pnpmVersion = Get-PnpmVersion
					if (-not (Test-MinimumVersion $pnpmVersion $pnpmMinVersion.Major $pnpmMinVersion.Minor $pnpmMinVersion.Patch)) {
						$envOk = $false
					}
				}
				else {
					$envOk = $false
				}
			}
			else {
				$envOk = $false
			}
		}
	}
	else {
		Write-Host "OK pnpm $($pnpmVersion.Raw)" -ForegroundColor Green
	}
}

if (-not $envOk) {
	Write-Host ""
	Write-Host "Environment check failed. Please install required dependencies and try again." -ForegroundColor Red
	exit 1
}

Write-Host ""
Write-Host "Environment check passed!" -ForegroundColor Green
Write-Host ""
