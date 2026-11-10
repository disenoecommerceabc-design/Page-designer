"""Package application source without credentials, user data or environments."""
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parent.parent
output = root / 'entregables'
output.mkdir(exist_ok=True)
directories = ['app', 'docs', 'tests', 'scripts', 'plantillas', 'assets', 'deploy']
files = ['README.md', 'requirements.txt', 'requirements-dev.txt', 'Dockerfile', 'compose.yaml', 'heroku.yml', '.env.example', '.env.production.example', '.gitignore', '.dockerignore', 'iniciar.ps1', 'Iniciar Modulo.bat']
with zipfile.ZipFile(output / 'modulo-editor.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in files:
        archive.write(root / name, 'modulo-editor/' + name)
    for directory in directories:
        for path in sorted((root / directory).rglob('*')):
            if path.is_file() and '__pycache__' not in path.parts and path.suffix != '.pyc' and ('.env' not in path.name or path.name.endswith('.example')):
                archive.write(path, 'modulo-editor/' + path.relative_to(root).as_posix())
    for name in ('editor-verificado.jpg', 'preview-mobile-nocturno.jpg', 'paneles-ajustables.jpg'):
        screenshot = root / 'artifacts' / name
        if screenshot.exists():
            archive.write(screenshot, 'modulo-editor/artifacts/' + name)
print(output / 'modulo-editor.zip')
