import io
import uuid
import zipfile

import pytest
from fastapi import HTTPException
from PIL import Image

from app import db, settings


def register(client, email='pruebas@example.com'):
    response = client.post('/api/register', json={
        'email': email, 'password': 'password-para-pruebas', 'plan': 'starter',
    })
    assert response.status_code == 201, response.text


def test_editor_requires_session_and_selected_plan(client, monkeypatch):
    client.cookies.clear()
    monkeypatch.setattr(settings, 'PASSWORD', '')
    guest = client.get('/api/session')
    assert not guest.json()['authenticated'] and not guest.json()['editor_access']
    assert 'set-cookie' not in guest.headers
    denied = client.get('/builder?plan=professional', follow_redirects=False)
    assert denied.status_code == 307 and denied.headers['location'] == '/acceso?plan=professional'
    assert 'id="canvas"' not in client.get('/builder').text
    assert client.get('/static/index.html').status_code == 404
    assert client.get('/api/projects').status_code == 401
    assert client.put('/api/account/plan', json={'plan': 'starter'}).status_code == 401

    register(client)
    with db.connection() as conn:
        conn.execute('DELETE FROM user_plans')
    account = client.get('/api/session').json()
    assert account['authenticated'] and not account['editor_access']
    assert client.get('/builder', follow_redirects=False).status_code == 307
    assert client.get('/api/projects').status_code == 403
    assert client.get('/api/templates/tienda').status_code == 403
    assert client.put('/api/account/plan', json={'plan': 'starter'}).status_code == 200
    assert client.get('/api/session').json()['editor_access']
    assert 'id="canvas"' in client.get('/builder').text
    assert client.get('/api/projects').status_code == 200
    assert client.post('/api/logout').status_code == 200
    assert client.get('/builder', follow_redirects=False).status_code == 307


def test_page_and_template_quotas_follow_account_and_plan(client):
    register(client)
    template = client.get('/api/templates/tienda').json()
    project_ids = []
    for _ in range(5):
        response = client.post('/api/projects', json=template)
        assert response.status_code == 201
        project_ids.append(response.json()['id'])
    assert client.post('/api/projects', json=template).status_code == 429
    snapshot = {'project_id': project_ids[0], 'name': 'Diseño guardado'}
    ids = []
    for _ in range(3):
        response = client.post('/api/saved-templates', json=snapshot)
        assert response.status_code == 201
        ids.append(response.json()['id'])
    assert client.post('/api/saved-templates', json=snapshot).status_code == 429
    saved = client.get('/api/saved-templates/' + ids[0]).json()
    assert saved['revision'] == 0 and saved['name'] == snapshot['name']
    usage = client.put('/api/account/plan', json={'plan': 'professional'}).json()
    assert (usage['pages_used'], usage['pages_limit'], usage['templates_used']) == (5, 30, 3)
    assert client.post('/api/projects', json=saved).status_code == 201
    assert client.delete('/api/saved-templates/' + ids[1]).status_code == 200
    register(client, 'otra@example.com')
    assert client.get('/api/projects/' + project_ids[0]).status_code == 404
    assert client.get('/api/saved-templates/' + ids[0]).status_code == 404
    assert client.delete('/api/saved-templates/' + ids[0]).status_code == 404
    assert client.get('/api/usage').json()['pages_used'] == 0
    assert client.post('/api/logout').status_code == 200
    assert client.post('/api/login', json={'username': 'PRUEBAS@example.com',
                                         'password': 'password-para-pruebas'}).status_code == 200
    assert client.get('/api/usage').json()['pages_used'] == 6


def test_monthly_credit_limit_and_replay(client, monkeypatch):
    register(client)
    monkeypatch.setattr(settings, 'COOLDOWN', 0)
    with db.connection() as conn:
        owner = conn.execute('SELECT id FROM users WHERE username=?', ('pruebas@example.com',)).fetchone()['id']
    for _ in range(4):
        op = str(uuid.uuid4())
        db.reserve(owner, 'test', 'image', op, 'fingerprint')
    assert db.reserve(owner, 'test', 'image', op, 'fingerprint')[1] is False
    assert client.get('/api/usage').json()['used'] == 20
    with pytest.raises(HTTPException, match='mensuales'):
        db.reserve(owner, 'test', 'text', str(uuid.uuid4()), 'fingerprint')
    assert client.put('/api/account/plan', json={'plan': 'professional'}).json()['used'] == 20
    assert db.reserve(owner, 'test', 'text', str(uuid.uuid4()), 'fingerprint')[1] is True


def test_transparent_logo_in_preview_and_zip(client, project):
    png = io.BytesIO()
    Image.new('RGBA', (24, 12), (30, 50, 70, 0)).save(png, format='PNG')
    asset = client.post('/api/assets', files={'file': ('logo.png', png.getvalue(), 'image/png')}).json()['url']
    document = {k: v for k, v in project.items() if k != 'id'}
    document['business']['logo'] = asset
    path = '/api/projects/' + project['id']
    assert client.put(path, json=document).status_code == 200
    assert f'class="site-logo" src="{asset}"' in client.get(path + '/preview').text
    with zipfile.ZipFile(io.BytesIO(client.get(path + '/export').content)) as archive:
        assert asset[1:] in archive.namelist()
        assert asset[1:] in archive.read('index.html').decode()
        assert Image.open(io.BytesIO(archive.read(asset[1:]))).getpixel((0, 0))[3] == 0


def test_template_draft_does_not_create_web_and_reuse_preserves_assets(client):
    register(client)
    document = client.get('/api/templates/tienda').json()
    png = io.BytesIO()
    Image.new('RGB', (24, 12), 'green').save(png, format='PNG')
    asset = client.post('/api/assets', files={'file': ('foto.png', png.getvalue(), 'image/png')}).json()['url']
    title = 'Un diseño propio'
    document['modules'][0]['content'].update(title=title, image=asset)
    response = client.post('/api/saved-templates', json={'name': 'Mi plantilla', 'document': document})
    assert response.status_code == 201
    assert client.get('/api/projects').json() == []
    assert client.get('/api/usage').json()['pages_used'] == 0
    template_path = '/api/saved-templates/' + response.json()['id']
    snapshot = client.get(template_path).json()
    web = client.post('/api/projects', json=snapshot).json()
    pid = web.pop('id')
    web['modules'][0]['content']['title'] = 'Mi web editada'
    path = '/api/projects/' + pid
    assert client.put(path, json=web).status_code == 200
    reopened = client.get(path).json()['modules'][0]['content']
    assert reopened['title'] == 'Mi web editada' and reopened['image'] == asset
    assert client.get(asset).status_code == 200
    assert client.get(template_path).json()['modules'][0]['content']['title'] == title
    assert client.get('/api/templates/tienda').json()['modules'][0]['content']['title'] != title
