@echo off
call "%~dp0start-local.cmd" -Kill -ResetPglite
exit /b %ERRORLEVEL%
