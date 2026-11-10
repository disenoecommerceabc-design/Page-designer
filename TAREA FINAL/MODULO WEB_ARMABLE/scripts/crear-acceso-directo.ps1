$ErrorActionPreference = 'Stop'
$projectPath = Split-Path -Parent $PSScriptRoot
$launcherPath = Join-Path $projectPath 'Iniciar Modulo.bat'
$iconPath = Join-Path $projectPath 'assets\modulo.ico'
if (-not (Test-Path -LiteralPath $launcherPath)) { throw 'No se encontro el lanzador .bat.' }
if (-not (Test-Path -LiteralPath $iconPath)) { throw 'No se encontro el icono en assets\modulo.ico.' }
$shortcutName = 'M' + [char]0x00F3 + 'dulo.lnk'
$shell = New-Object -ComObject WScript.Shell
$destinations = @($projectPath, (Split-Path -Parent $projectPath))
foreach ($destination in $destinations) {
    $shortcutPath = Join-Path $destination $shortcutName
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $launcherPath
    $shortcut.WorkingDirectory = $projectPath
    $shortcut.IconLocation = $iconPath + ',0'
    $shortcut.Description = 'Abrir Modulo - Constructor de paginas web'
    $shortcut.WindowStyle = 1
    $shortcut.Save()
    Write-Output $shortcutPath
}
