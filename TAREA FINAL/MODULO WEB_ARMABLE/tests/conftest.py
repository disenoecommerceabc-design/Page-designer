import os
import tempfile
from pathlib import Path
import pytest

# Keep tests separate from user projects and disable paid requests.
_test_data = tempfile.TemporaryDirectory(prefix='modulo-tests-')
os.environ['DATA_DIR'] = _test_data.name
os.environ['AI_ENABLED'] = 'false'
os.environ['APP_ENV'] = 'local'
os.environ['ADMIN_PASSWORD'] = ''
os.environ['ALLOWED_HOSTS'] = 'testserver,localhost,127.0.0.1'

from fastapi.testclient import TestClient
from app.main import app
from app import db, settings

@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(settings, 'PASSWORD', 'a-long-admin-password')
    with TestClient(app) as client:
        client.headers['X-Editor-Request'] = '1'
        with db.connection() as conn:
            conn.execute('DELETE FROM operations')
            conn.execute('DELETE FROM projects')
            conn.execute('DELETE FROM users')
            conn.execute('DELETE FROM user_plans')
            conn.execute('DELETE FROM monthly_pages')
            conn.execute('DELETE FROM saved_templates')
            conn.execute('DELETE FROM assets')
            conn.execute('DELETE FROM login_attempts')
        assert client.post('/api/login', json={'username': settings.USERNAME, 'password': settings.PASSWORD}).status_code == 200
        yield client

@pytest.fixture
def project(client):
    data = client.get('/api/templates/tienda').json()
    return client.post('/api/projects', json=data).json()
