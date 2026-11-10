import os
import subprocess
import sys
from pathlib import Path
import pytest
from app.serve import command

@pytest.mark.parametrize('port',['8080','51723'])
def test_runtime_respects_platform_port(monkeypatch,port):
    monkeypatch.setenv('PORT',port)
    args=command()
    assert args[args.index('--port')+1]==port
    assert args[args.index('--host')+1]=='0.0.0.0'
    assert args[args.index('--workers')+1]=='1'

@pytest.mark.parametrize('port',['0','65536','abc'])
def test_runtime_rejects_invalid_port(monkeypatch,port):
    monkeypatch.setenv('PORT',port)
    with pytest.raises(SystemExit): command()

def test_health_probe_can_use_platform_host_but_editor_cannot(client):
    assert client.get('/health',headers={'Host':'platform.internal'}).status_code==200
    assert client.get('/api/projects',headers={'Host':'platform.internal'}).status_code==400

def test_cloud_requires_ephemeral_data_acknowledgment(tmp_path):
    env={**os.environ,'K_SERVICE':'cloud-smoke','ALLOW_EPHEMERAL_DATA':'false','DATA_DIR':str(tmp_path)}
    result=subprocess.run([sys.executable,'-c','import app.settings'],env=env,capture_output=True,text=True)
    assert result.returncode!=0
    assert 'ALLOW_EPHEMERAL_DATA' in result.stderr
