@echo off
setlocal
title Modulo - Iniciar aplicacion
set "MODULO_NO_BROWSER="
if /I "%~1"=="--sin-navegador" set "MODULO_NO_BROWSER=-NoBrowser"
echo.
echo   MODULO - Constructor de paginas web
echo   Preparando la aplicacion...
echo.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\iniciar-docker.ps1" %MODULO_NO_BROWSER%
set "MODULO_RESULT=%ERRORLEVEL%"
if not "%MODULO_RESULT%"=="0" (
  echo.
  echo No se pudo iniciar Modulo. Revisa el mensaje anterior.
  pause
)
exit /b %MODULO_RESULT%
