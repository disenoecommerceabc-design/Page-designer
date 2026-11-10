"""Disposable local contract tests. Never uses cloud accounts or paid AI."""
import argparse
import io
import json
import re
import secrets
import socket
import subprocess
import time
import uuid
from pathlib import Path
import httpx
from PIL import Image

ROOT=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser()
parser.add_argument('--image', default='modulo-editor:1.1.0')
parser.add_argument('--integrated', action='store_true')
parser.add_argument('--output', type=Path, default=ROOT/'artifacts/cloud-image-validation.json')
args=parser.parse_args()
IMAGE=args.image
PREFIX='modulo-smoke-'+uuid.uuid4().hex[:12]
containers=[]
volumes=[]
checks=[]

def docker(*args):
    return subprocess.run(['docker',*args],check=True,capture_output=True,text=True).stdout.strip()

def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1',0))
        return sock.getsockname()[1]

def start(label, extra=None, user=None, volume=None, session=True):
    name=PREFIX+'-'+label
    port=free_port()
    env={'PORT':'51723','APP_ENV':'production','COOKIE_SECURE':'true','ADMIN_USERNAME':'admin',
         'ADMIN_PASSWORD':secrets.token_hex(24),'ALLOWED_HOSTS':'cloud.example','FORWARDED_ALLOW_IPS':'*','AI_ENABLED':'false'}
    if session:env['SESSION_SECRET']=secrets.token_hex(32)
    env.update(extra or {})
    args=['run','-d','--name',name,'-p',f'127.0.0.1:{port}:51723']
    if user:args+=['--user',user]
    if volume:args+=['--mount',f'type=volume,src={volume},dst=/data']
    for key,value in env.items():args+=['-e',key+'='+value]
    args+=[IMAGE]
    docker(*args)
    containers.append(name)
    client=httpx.Client(base_url=f'http://127.0.0.1:{port}',timeout=10,trust_env=False,
                        headers={'Host':'cloud.example','X-Editor-Request':'1','X-Forwarded-Proto':'https','Origin':'https://cloud.example'})
    for _ in range(100):
        try:
            if client.get('/health').status_code==200:break
        except httpx.HTTPError:pass
        time.sleep(.3)
    else:raise RuntimeError('La imagen no respondio: '+docker('logs',name)[-2000:])
    return name,client,env

def login(client,env):
    assert client.get('/api/projects').status_code==401
    result=client.post('/api/login',json={'username':'admin','password':env['ADMIN_PASSWORD']})
    assert result.status_code==200,result.text
    assert 'Secure' in result.headers['set-cookie'] and 'HttpOnly' in result.headers['set-cookie']
    # The local transport is HTTP, while cloud HTTPS terminates at its proxy.
    client.headers['Cookie']='modulo_session='+result.cookies['modulo_session']
    return client.headers['Cookie']

def exercise(client,name,env):
    assert client.get('/api/session').json()['local'] is False
    redirect=client.get('/',headers={'X-Forwarded-Proto':'http'})
    assert redirect.status_code==307 and redirect.headers['location']=='https://cloud.example/'
    if args.integrated:
        landing=client.get('/')
        assert landing.status_code==200 and '<div id="root"></div>' in landing.text
        paths=re.findall(r'(?:href|src)="(/landing/assets/[^"]+)"',landing.text)
        assert len(paths)>=3
        for path in paths:
            assert client.get(path).status_code==200, path
        editor=client.get('/builder')
        assert editor.status_code==307 and editor.headers['location']=='/acceso'
        assert client.get('/acceso').status_code==200
        assert client.get('/static/editor.js').status_code==200
        lead={'email':'prueba@example.test','name':'Prueba local','plan':'Starter','consent':True}
        assert client.post('/api/interest',json=lead,headers={'Origin':'https://example.test'}).status_code==403
        assert client.post('/api/interest',json={**lead,'consent':False}).status_code==400
        assert client.post('/api/interest',json={**lead,'name':'x'*4096}).status_code==413
        assert client.post('/api/interest',json=lead).json()=={'ok':True}
        assert client.post('/api/interest',json=lead).json()=={'ok':True}
        count='import sqlite3; from app.settings import DATA; print(sqlite3.connect(DATA / "editor.sqlite3").execute("SELECT COUNT(*) FROM interests").fetchone()[0])'
        assert docker('exec',name,'python','-c',count)=='1'
    login(client,env)
    editor=client.get('/builder')
    assert editor.status_code==200 and 'id="canvas"' in editor.text
    assert client.get('/api/projects',headers={'Host':'attacker.example'}).status_code==400
    assert client.post('/api/projects',json={},headers={'Origin':'https://attacker.example'}).status_code==403
    template=client.get('/api/templates/tienda').json()
    result=client.post('/api/projects',json=template)
    assert result.status_code==201,result.text
    project=result.json()
    image=io.BytesIO();Image.new('RGB',(30,20),'green').save(image,'PNG')
    asset=client.post('/api/assets',files={'file':('smoke.png',image.getvalue(),'image/png')}).json()['url']
    assert client.get(asset).status_code==200
    project['modules'][0]['content'].update(title='Título guardado',image=asset)
    document={key:value for key,value in project.items() if key!='id'}
    assert client.put(f"/api/projects/{project['id']}",json=document).status_code==200
    assert client.put(f"/api/projects/{project['id']}",json=document).status_code==409
    preview=client.get(f"/api/projects/{project['id']}/preview")
    assert preview.status_code==200 and 'Título guardado' in preview.text
    exported=client.get(f"/api/projects/{project['id']}/export")
    assert exported.status_code==200 and exported.content.startswith(b'PK')
    docker('exec',name,'python','-m','app.healthcheck')
    return project,asset

def remove_container(name):
    if not name.startswith(PREFIX+'-'):raise RuntimeError('Nombre de prueba inesperado.')
    docker('rm','-f',name)
    containers.remove(name)

try:
    info=json.loads(docker('image','inspect',IMAGE))[0]
    assert info['Os']=='linux' and info['Architecture']=='amd64'
    assert info['Config']['User']=='editor'
    assert not any(value.startswith(('KIE_API_KEY=','ADMIN_PASSWORD=','SESSION_SECRET=')) for value in info['Config']['Env'])
    checks.append('Imagen Linux/AMD64 sin credenciales configuradas')
    for label,extra in [('heroku',{'DYNO':'web.1','ALLOW_EPHEMERAL_DATA':'true'}),('cloudrun',{'K_SERVICE':'modulo-smoke','ALLOW_EPHEMERAL_DATA':'true'})]:
        name,client,env=start(label,extra,user='23456:23456')
        try:
            exercise(client,name,env)
            assert docker('exec',name,'python','-c',"import os; print(os.getuid())")=='23456'
            assert docker('exec',name,'python','-c',"from pathlib import Path; print(Path('/app/.env').exists())")=='False'
            checks.append(label+': PORT variable, UID arbitrario, autenticacion, proxy HTTPS, edicion, imagenes y exportacion')
        finally:client.close();remove_container(name)
    if args.integrated:
        checks.append('Landing, recursos, editor /builder y registro de interés sin duplicados')
    volume=PREFIX+'-data';docker('volume','create',volume);volumes.append(volume)
    name,client,env=start('persistent',{'DATA_DIR':'/data'},volume=volume,session=False)
    try:
        project,asset=exercise(client,name,env)
        cookie=client.headers['Cookie']
    finally:client.close();remove_container(name)
    name,client,_=start('restart',{'DATA_DIR':'/data','ADMIN_PASSWORD':env['ADMIN_PASSWORD']},volume=volume,session=False)
    try:
        client.headers['Cookie']=cookie
        assert client.get('/api/projects/'+project['id']).status_code==200
        assert client.get(asset).status_code==200
        checks.append('Volumen persistente: proyecto, imagen y sesion sobreviven a recrear el contenedor')
        assert docker('exec',name,'python','-c',"import os; print(os.getuid())")=='10001'
    finally:client.close();remove_container(name)
    result={'image':IMAGE,'image_id':info['Id'],'status':'passed','checks':checks,'ai_requests':0}
    output=args.output;output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(result,indent=2,ensure_ascii=False),encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False),flush=True)
finally:
    for name in list(containers):remove_container(name)
    for volume in volumes:
        if not volume.startswith(PREFIX+'-'):raise RuntimeError('Volumen de prueba inesperado.')
        docker('volume','rm',volume)
