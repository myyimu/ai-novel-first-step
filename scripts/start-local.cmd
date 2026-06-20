@echo off
setlocal
cd /d "%~dp0.."

rem Parse arguments for auto-install
set AUTO_INSTALL_ARG=
set START_LOCAL_ARGS=
if "%1"=="--auto-install" set AUTO_INSTALL_ARG=-AutoInstall
if "%1"=="-a" set AUTO_INSTALL_ARG=-AutoInstall
if not "%1"=="--auto-install" if not "%1"=="-a" set START_LOCAL_ARGS=%*

rem Check environment first
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0check-env.ps1" %AUTO_INSTALL_ARG%
if errorlevel 1 (
    echo.
    echo Environment check failed. Press any key to exit...
    pause >nul
    exit /b 1
)

rem Start the main script
set START_LOCAL_ENV_CHECKED=1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-local.ps1" %START_LOCAL_ARGS%

if errorlevel 1 (
    echo.
    echo Script execution error. Press any key to exit...
    pause >nul
) else (
    echo.
    echo Press any key to close this window...
    pause >nul
)
endlocal
