import json
import uuid
import pytest
from app import ai,db,settings
from app.models import AIRequest,Project
from app.image_director import image_slot
from tests.director_helpers import BRIEF,director_response

@pytest.mark.parametrize('kind,path,ratio',[('hero','image','2:3'),('products','items.1.image','1:1'),('carousel','items.0.image','16:9')])
def test_slot_contract(project,kind,path,ratio):
    p=Project.model_validate({k:v for k,v in project.items() if k!='id'})
    m=next(m for m in p.modules if m.kind==kind)
    _,_,slot=image_slot(p,AIRequest(module_id=m.id,prompt='Un producto completo',image_path=path))
    assert slot['aspect_ratio']==ratio
    assert slot['mobile'] and slot['safe_zone']

def test_director_failure_prevents_image_charge(client,project,monkeypatch):
    monkeypatch.setattr(settings,'AI_ENABLED',True)
    calls=[]
    async def invalid(method,url,**kw):
        calls.append(url)
        response=director_response()
        response['output'][0]['content'][0]['text']='{"prompt":"short"}'
        return response
    monkeypatch.setattr(ai,'call',invalid)
    opid=str(uuid.uuid4())
    result=client.post(f"/api/projects/{project['id']}/ai/image",json={'module_id':project['modules'][0]['id'],'prompt':'Nueva fotografía'},headers={'Idempotency-Key':opid})
    assert result.status_code==502
    assert len(calls)==1 and calls[0].endswith('/responses')
    assert 'directing'==client.get('/api/operations/'+opid).json()['result']['stage']

def test_no_overwrite_if_image_changed_while_generating(client,project):
    opid=str(uuid.uuid4())
    db.reserve('workspace',project['id'],'image',opid,'test-conflict')
    result={'module_id':project['modules'][0]['id'],'image_path':'image','previous_image':'/static/images/desk.svg',
            'image':'/assets/'+'a'*32+'.webp','brief':BRIEF}
    db.finish(opid,'completed',result)
    db.apply_generated_image(opid,'workspace')
    assert not json.loads(db.operation(opid,'workspace')['result'])['applied']
    assert client.get(f"/api/projects/{project['id']}").json()['modules'][0]['content']['image']==project['modules'][0]['content']['image']

def test_reject_invalid_target_before_reservation(client,project,monkeypatch):
    monkeypatch.setattr(settings,'AI_ENABLED',True)
    result=client.post(f"/api/projects/{project['id']}/ai/image",json={'module_id':project['modules'][0]['id'],'prompt':'Nueva foto','image_path':'items.0.image'},headers={'Idempotency-Key':str(uuid.uuid4())})
    assert result.status_code==422
    assert client.get('/api/usage').json()['used']==0

def test_upstream_503_is_actionable_and_secret_is_redacted(monkeypatch):
    import asyncio,httpx
    from fastapi import HTTPException
    monkeypatch.setattr(settings,'KIE_KEY','unit-test-secret')
    original=httpx.AsyncClient
    def handle(request):
        return httpx.Response(503,json={'error':{'type':'server_error','message':'Service temporarily unavailable unit-test-secret'}})
    monkeypatch.setattr(ai.httpx,'AsyncClient',lambda **kw:original(transport=httpx.MockTransport(handle)))
    with pytest.raises(HTTPException) as error:
        asyncio.run(ai.call('POST',ai.API+'/codex/v1/responses',json={}))
    assert '503' in error.value.detail and 'Service temporarily unavailable' in error.value.detail
    assert 'unit-test-secret' not in error.value.detail
