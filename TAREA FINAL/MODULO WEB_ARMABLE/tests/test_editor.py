import asyncio
import io
import json
import uuid
import zipfile
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
import pytest
from app import ai, db, settings
from app.models import Project

def document(project):
    return {k:v for k,v in project.items() if k != 'id'}

@pytest.mark.parametrize('template', ['tienda', 'servicios', 'suscripciones'])
def test_templates_use_valid_shared_components(client, template):
    p = client.get('/api/templates/' + template).json()
    r = client.post('/api/render', json=p)
    assert r.status_code == 200
    assert r.text.count('data-module=') == len(p['modules'])
    saved = client.post('/api/projects', json=p).json()
    review = client.post(f"/api/projects/{saved['id']}/review").json()
    assert review['valid'], review

def test_save_reload_order_text_notes_and_conflict(client, project):
    p = document(project)
    p['modules'].reverse()
    p['modules'][0]['content']['title'] = 'Mi título nuevo'
    p['modules'][0]['notes'] = 'Quiero un tono cercano'
    result = client.put(f"/api/projects/{project['id']}", json=p)
    assert result.status_code == 200
    loaded = client.get(f"/api/projects/{project['id']}").json()
    assert loaded['modules'] == p['modules']
    assert loaded['revision'] == p['revision'] + 1
    assert client.put(f"/api/projects/{project['id']}", json=p).status_code == 409

def test_blocks_script_links_extra_code_and_duplicate_ids(client, project):
    p = document(project)
    for url in ['javascript:alert(1)', 'data:text/html,hi', '//evil.example', 'file:///etc/passwd', '#x\" onclick=alert(1)']:
        p['modules'][0]['content']['url'] = url
        assert client.post('/api/render', json=p).status_code == 422
    p = document(project)
    p['modules'][0]['html'] = '<script>alert(1)</script>'
    assert client.post('/api/render', json=p).status_code == 422
    p = document(project)
    p['modules'].append(p['modules'][0])
    assert client.post('/api/render', json=p).status_code == 422

def test_escapes_user_content(client, project):
    p = document(project)
    p['modules'][0]['content']['title'] = '<img src=x onerror=alert(1)>'
    html = client.post('/api/render', json=p).text
    assert '<img src=x onerror' not in html
    assert '&lt;img src=x' in html

def test_auth_csrf_and_host_validation(client):
    client.cookies.clear()
    assert client.get('/api/projects').status_code == 401
    client.get('/api/session')
    assert client.post('/api/projects', json={}, headers={'Origin':'https://evil.example'}).status_code == 403
    del client.headers['X-Editor-Request']
    assert client.post('/api/projects', json={}).status_code == 403
    assert client.get('/builder', headers={'Host':'evil.example'}).status_code == 400

def test_image_decoding_validation_and_export_assets(client, project):
    assert client.post('/api/assets', files={'file':('evil.svg',b'<svg onload="alert(1)"/>','image/svg+xml')}).status_code == 422
    image = io.BytesIO()
    Image.new('RGB', (20,20), 'green').save(image,'PNG')
    result = client.post('/api/assets', files={'file':('../../unsafe.png',image.getvalue(),'image/png')})
    assert result.status_code == 200
    asset = result.json()['url']
    assert asset.startswith('/assets/') and asset.endswith('.webp')
    p = document(project)
    p['modules'][0]['content']['image'] = asset
    assert client.put(f"/api/projects/{project['id']}", json=p).status_code == 200
    result = client.get(f"/api/projects/{project['id']}/export")
    assert result.status_code == 200
    with zipfile.ZipFile(io.BytesIO(result.content)) as archive:
        assert {'index.html','site.css','site.js','project.json',asset.lstrip('/')} <= set(archive.namelist())
        html = archive.read('index.html').decode()
        assert 'contenteditable' not in html
        assert '/static/' not in html
        assert 'data-module=' not in html

def test_missing_anchor_prevents_delivery(client, project):
    p = document(project)
    p['modules'] = [p['modules'][0]]
    assert client.put(f"/api/projects/{project['id']}", json=p).status_code == 200
    result = client.post(f"/api/projects/{project['id']}/review").json()
    assert not result['valid']
    assert client.get(f"/api/projects/{project['id']}/export").status_code == 422

def test_disabled_ai_never_reserves_or_calls_provider(client, project):
    result = client.post(f"/api/projects/{project['id']}/ai/text", json={'module_id':project['modules'][0]['id'],'prompt':'Más cercano'}, headers={'Idempotency-Key':str(uuid.uuid4())})
    assert result.status_code == 503
    assert client.get('/api/usage').json()['used'] == 0

def test_atomic_budget_prevents_parallel_overspend(client, monkeypatch):
    monkeypatch.setattr(settings,'DAILY',5)
    monkeypatch.setattr(settings,'GLOBAL_DAILY',5)
    monkeypatch.setattr(settings,'COOLDOWN',0)
    def reserve(i):
        try:
            db.reserve('workspace','project','text',str(uuid.uuid4()),str(i))
            return True
        except Exception:
            return False
    with ThreadPoolExecutor(max_workers=12) as pool:
        results = list(pool.map(reserve,range(20)))
    assert sum(results) == 5
    assert db.usage('workspace')['used'] == 5

def test_idempotency_and_provider_contract(client, project, monkeypatch):
    monkeypatch.setattr(settings,'AI_ENABLED',True)
    calls=[]
    async def fake_call(method,url,**kwargs):
        calls.append((method,url,kwargs))
        return {'status':'completed','output':[{'type':'message','content':[{'type':'output_text','text':'{"text":"Una propuesta mejor"}'}]}],'usage':{'input_tokens':100,'output_tokens':20},'credits_consumed':0.1}
    monkeypatch.setattr(ai,'call',fake_call)
    opid=str(uuid.uuid4())
    args={'json':{'module_id':project['modules'][0]['id'],'prompt':'Más cercano'},'headers':{'Idempotency-Key':opid}}
    first=client.post(f"/api/projects/{project['id']}/ai/text",**args)
    again=client.post(f"/api/projects/{project['id']}/ai/text",**args)
    assert first.status_code == 200 and again.status_code == 200
    assert first.json() == again.json()
    assert len(calls) == 1
    assert calls[0][1].endswith('/codex/v1/responses')
    assert calls[0][2]['json']['max_output_tokens'] == settings.MAX_OUTPUT
    assert client.get('/api/usage').json()['used'] == 1
    assert client.get(f"/api/projects/{project['id']}").json()['modules'][0]['content']['title'] == project['modules'][0]['content']['title']

def test_image_task_is_stored_and_polled_without_resubmitting(client, project, monkeypatch):
    monkeypatch.setattr(settings,'AI_ENABLED',True)
    calls=[]
    async def fake_call(method,url,**kwargs):
        calls.append(url)
        if url.endswith('/responses'):
            from tests.director_helpers import director_response
            assert kwargs['json']['model']=='gpt-6-luna'
            assert kwargs['json']['reasoning']['effort']=='high'
            return director_response()
        if url.endswith('createTask'):
            assert kwargs['json']['model'] == 'gpt-image-2-5-flare-text-to-image'
            assert kwargs['json']['input']['resolution'] == '1K'
            return {'code':200,'data':{'taskId':'provider-task'}}
        return {'code':200,'data':{'state':'success','resultJson':json.dumps({'resultUrls':['https://tempfile.aiquickdraw.com/image.png']})}}
    async def fake_download(url, owner='workspace'):
        return '/assets/'+'a'*32+'.webp'
    monkeypatch.setattr(ai,'call',fake_call)
    monkeypatch.setattr(ai,'download_image',fake_download)
    opid=str(uuid.uuid4())
    result=client.post(f"/api/projects/{project['id']}/ai/image",json={'module_id':project['modules'][0]['id'],'prompt':'Un producto sobre fondo blanco'},headers={'Idempotency-Key':opid})
    assert result.json()['status']=='running'
    assert client.get('/api/operations/'+opid).json()['status']=='completed'
    assert client.get('/api/operations/'+opid).json()['status']=='completed'
    assert len(calls)==3
    applied=client.get(f"/api/projects/{project['id']}").json()
    assert applied['modules'][0]['content']['image']=='/assets/'+'a'*32+'.webp'
    assert client.get('/api/operations/'+opid).json()['usage']['output_tokens']==240

def test_generated_image_download_rejects_untrusted_hosts():
    from fastapi import HTTPException
    for url in ['http://127.0.0.1/a','https://evil.example/a','https://aiquickdraw.com.evil.example/a','file:///etc/passwd']:
        with pytest.raises(HTTPException):
            asyncio.run(ai.download_image(url))

def test_accounts_isolate_projects_images_operations_and_quota(client, project, monkeypatch):
    monkeypatch.setattr(settings,'REGISTRATION_CODE','invitation-for-tests')
    monkeypatch.setattr(settings,'PASSWORD','a-long-admin-password')
    original_cookie=client.cookies.get('modulo_session')
    image=io.BytesIO()
    Image.new('RGB',(20,20),'red').save(image,'PNG')
    asset=client.post('/api/assets',files={'file':('photo.png',image.getvalue(),'image/png')}).json()['url']
    opid=str(uuid.uuid4())
    db.reserve('workspace',project['id'],'text',opid,'fingerprint')
    registered=client.post('/api/register',json={'username':'cliente','password':'password-de-prueba-123','invitation':'invitation-for-tests'})
    assert registered.status_code==201
    assert client.put('/api/account/plan',json={'plan':'starter'}).status_code==200
    assert client.get('/api/projects').json()==[]
    assert client.get(f"/api/projects/{project['id']}").status_code==404
    assert client.get(asset).status_code==404
    assert client.get('/api/operations/'+opid).status_code==404
    assert client.get('/api/usage').json()['used']==0
    p=document(project)
    p['modules'][0]['content']['image']=asset
    assert client.post('/api/projects',json=p).status_code==403
    client.post('/api/logout')
    assert not client.get('/api/session').json()['authenticated']
    assert client.post('/api/login',json={'username':'cliente','password':'password-de-prueba-123'}).status_code==200
    assert client.get('/api/projects').json()==[]

def test_body_limit_handles_chunked_requests(client):
    def chunks():
        for i in range(10):
            yield b'x' * 1024 * 1024
    result=client.post('/api/render',content=chunks(),headers={'Content-Type':'application/json'})
    assert result.status_code==413

def test_provider_timeout_does_not_retry_or_release_budget(client, project, monkeypatch):
    from fastapi import HTTPException
    monkeypatch.setattr(settings,'AI_ENABLED',True)
    calls=[]
    async def fake_call(*args,**kwargs):
        calls.append(1)
        raise HTTPException(502,'Provider timeout')
    monkeypatch.setattr(ai,'call',fake_call)
    opid=str(uuid.uuid4())
    args={'json':{'module_id':project['modules'][0]['id'],'prompt':'Mejorar el título'},'headers':{'Idempotency-Key':opid}}
    assert client.post(f"/api/projects/{project['id']}/ai/text",**args).status_code==502
    second=client.post(f"/api/projects/{project['id']}/ai/text",**args)
    assert second.json()['status']=='uncertain'
    assert len(calls)==1
    assert client.get('/api/usage').json()['used']==1
