"""Export the exact validated image; package only public deployment templates."""
import gzip
import hashlib
import json
import shutil
import subprocess
import zipfile
from pathlib import Path

root=Path(__file__).resolve().parent.parent
out=root/'entregables';out.mkdir(exist_ok=True)
tag='modulo-editor:1.1.0'
name='modulo-editor-1.1.0-linux-amd64.tar.gz'
archive=out/name
partial=out/(name+'.partial')
validation=json.loads((root/'artifacts/cloud-image-validation.json').read_text(encoding='utf-8'))

def docker(*args):
    return subprocess.check_output(['docker',*args],text=True).strip()

info=json.loads(docker('image','inspect',tag))[0]
if (info['Os'],info['Architecture'],info['Id'])!=('linux','amd64',validation['image_id']) or validation['status']!='passed':
    raise SystemExit('La etiqueta no coincide con la imagen que paso la verificacion.')

try:
    with partial.open('wb') as target:
        with gzip.GzipFile(filename='',mode='wb',fileobj=target,compresslevel=6,mtime=0) as stream:
            with subprocess.Popen(['docker','image','save',tag],stdout=subprocess.PIPE) as export:
                shutil.copyfileobj(export.stdout,stream,length=1024*1024)
                if export.wait():raise RuntimeError('Docker no pudo exportar la imagen.')
    partial.replace(archive)
finally:
    if partial.exists():partial.unlink()

print(docker('load','--input',str(archive)),flush=True)
assert json.loads(docker('image','inspect',tag))[0]['Id']==validation['image_id']
with archive.open('rb') as stream:
    sha=hashlib.file_digest(stream,'sha256').hexdigest()
checksum=out/(name+'.sha256')
checksum.write_text(f'{sha}  {name}\n',encoding='ascii')
manifest=out/'modulo-editor-1.1.0-imagen.json'
manifest.write_text(json.dumps({**validation,'archive':name,'archive_bytes':archive.stat().st_size,'archive_sha256':sha,'platform':'linux/amd64','docker_load_verified':True},indent=2,ensure_ascii=False),encoding='utf-8')

bundle=out/'modulo-editor-despliegue-1.1.0.zip'
with zipfile.ZipFile(bundle,'w',zipfile.ZIP_DEFLATED) as package:
    package.write(archive,name,compress_type=zipfile.ZIP_STORED)
    package.write(checksum,checksum.name)
    package.write(manifest,manifest.name)
    package.write(root/'docs/DESPLIEGUE.md','LEEME-DESPLIEGUE.md')
    for name in ('compose.production.yaml','Caddyfile','cloudrun.env.yaml.example'):
        package.write(root/'deploy'/name,'deploy/'+name)
    package.write(root/'.env.production.example','.env.production.example')
    package.write(root/'heroku.yml','heroku.yml')
print(json.dumps({'image':tag,'archive':str(archive),'archive_mib':round(archive.stat().st_size/2**20,1),'sha256':sha,'bundle':str(bundle)},ensure_ascii=False),flush=True)
