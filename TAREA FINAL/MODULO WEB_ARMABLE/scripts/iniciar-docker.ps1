param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$projectPath = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectPath

function Test-DockerEngine {
    try {
        & $script:dockerPath info --format '{{.ServerVersion}}' 2>$null | Out-Null
        return ($LASTEXITCODE -eq 0)
    } catch { return $false }
}

try {
    $dockerCommand = Get-Command docker.exe -ErrorAction SilentlyContinue
    if ($dockerCommand) { $script:dockerPath = $dockerCommand.Source }
    else {
        $candidates = @(
            (Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin\docker.exe'),
            (Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin\docker.exe')
        )
        $script:dockerPath = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    }
    if (-not $script:dockerPath) { throw 'Docker Desktop no esta instalado. Instala Docker Desktop y vuelve a abrir este lanzador.' }

    if (-not (Test-DockerEngine)) {
        Write-Host 'Iniciando Docker Desktop...'
        $desktopCandidates = @(
            (Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\Docker Desktop.exe'),
            (Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe')
        )
        $desktopPath = $desktopCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
        if (-not $desktopPath) { throw 'Abre Docker Desktop manualmente y vuelve a ejecutar este lanzador.' }
        Start-Process -FilePath $desktopPath -WindowStyle Hidden
        $deadline = (Get-Date).AddSeconds(180)
        while (-not (Test-DockerEngine)) {
            if ((Get-Date) -gt $deadline) { throw 'Docker no termino de iniciar en 3 minutos. Revisa Docker Desktop y la configuracion de WSL.' }
            Start-Sleep -Seconds 2
        }
    }

    & $script:dockerPath compose version | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'No se encontro Docker Compose. Actualiza Docker Desktop.' }
    Write-Host 'Levantando Modulo y aplicando la configuracion de .env...'
    & $script:dockerPath compose --project-directory $projectPath -f (Join-Path $projectPath 'compose.yaml') up --build -d
    if ($LASTEXITCODE -ne 0) { throw 'Docker no pudo levantar la app. Revisa el error anterior; el puerto 8000 debe estar disponible.' }

    $ready = $false
    $deadline = (Get-Date).AddSeconds(90)
    Write-Host 'Esperando a que la aplicacion este lista...'
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri 'http://localhost:8000/health' -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -eq 200 -and ($response.Content | ConvertFrom-Json).status -eq 'ok') { $ready = $true; break }
        } catch { }
        Start-Sleep -Seconds 2
    }
    if (-not $ready) { throw 'La app no respondio a tiempo. Consulta docker compose logs en la carpeta del proyecto.' }
    Write-Host 'Modulo esta listo: http://localhost:8000' -ForegroundColor Green
    if (-not $NoBrowser) { Start-Process 'http://localhost:8000' }
    exit 0
} catch {
    Write-Host ('ERROR: ' + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
