@echo off
setlocal EnableExtensions DisableDelayedExpansion
title Page Builder

set "BUILDER_IMAGE=page-builder:1.3.5"
set "BUILDER_ARCHIVE=page-builder-1.3.5-linux-amd64.tar"
set "BUILDER_URL=http://localhost:8088/builder"

pushd "%~dp0" || goto error_carpeta

where docker.exe >nul 2>&1
if errorlevel 1 (
    if exist "%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\docker.exe" set "PATH=%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin;%PATH%"
    if exist "%ProgramFiles%\Docker\Docker\resources\bin\docker.exe" set "PATH=%ProgramFiles%\Docker\Docker\resources\bin;%PATH%"
)
where docker.exe >nul 2>&1
if errorlevel 1 (
    echo No se encontro Docker Desktop. Instalalo y vuelve a abrir este archivo.
    goto error
)

docker.exe info >nul 2>&1
if errorlevel 1 (
    echo Iniciando Docker Desktop...
    docker.exe desktop start --timeout 120
    if errorlevel 1 goto error_docker
    docker.exe info >nul 2>&1
    if errorlevel 1 goto error_docker
)

docker.exe compose version >nul 2>&1
if errorlevel 1 (
    echo No se encontro Docker Compose. Actualiza Docker Desktop.
    goto error
)

docker.exe image inspect "%BUILDER_IMAGE%" >nul 2>&1
if errorlevel 1 (
    if exist "%BUILDER_ARCHIVE%" (
        echo Cargando la imagen local de Page Builder...
        docker.exe image load --input "%BUILDER_ARCHIVE%"
    ) else (
        echo Construyendo Page Builder. La primera vez puede tardar unos minutos...
        docker.exe compose build builder
    )
    if errorlevel 1 goto error
)

echo Iniciando Page Builder y esperando la comprobacion de salud...
docker.exe compose up -d --no-build --pull never --wait --wait-timeout 90 builder
if errorlevel 1 (
    echo Revisa el mensaje anterior. El puerto local 8088 debe estar disponible.
    goto error
)

echo Page Builder listo en %BUILDER_URL%
if /I not "%~1"=="--sin-navegador" start "" "%BUILDER_URL%"
popd
exit /b 0

:error_docker
echo Abre Docker Desktop en modo de contenedores Linux y vuelve a intentarlo.
:error
popd
goto salir_con_error

:error_carpeta
echo No se pudo abrir la carpeta de Page Builder.
:salir_con_error
if /I not "%~1"=="--sin-navegador" pause
exit /b 1
