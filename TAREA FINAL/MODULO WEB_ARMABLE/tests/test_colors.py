import pytest
from app.colors import contrast, ink, readable, secondary, module_style, palette
from app.models import Project

@pytest.mark.parametrize('primary',['#ff0000','#ffff00','#ffffff','#000000','#0011ff','#356657','#ab55ee'])
def test_palettes_keep_foreground_readable(primary):
    p=Project(accent=primary)
    for dark in (True,False):
        values=dict(item.split(':') for item in palette(p,dark).split(';'))
        assert contrast(values['--fg'],values['--surface'])>=4.5
        assert contrast(values['--muted'],values['--surface'])>=4.5
        assert contrast(values['--accent-ink'],values['--surface'])>=4.5
        assert contrast(values['--button-ink'],primary)>=4.5

def test_module_override_survives_save_and_export(client,project):
    pid=project.pop('id')
    project.update(accent='#ff0000',secondary='#ffbb00',color_mode='dark',harmony='triadic')
    project['modules'][0].update(tone='custom',background='#121212')
    saved=client.put('/api/projects/'+pid,json=project)
    assert saved.status_code==200
    data=client.get('/api/projects/'+pid).json()
    assert data['color_mode']=='dark'
    assert data['modules'][0]['background']=='#121212'
    html=client.post('/api/render',json={k:v for k,v in data.items() if k!='id'}).text
    assert '--surface:#121212' in html
    assert 'data-theme-toggle' in html and 'data-dark=' in html and 'data-light=' in html
    assert client.get('/api/projects/'+pid+'/export').status_code==200

def test_palette_api_and_css_injection_rejection(client,project):
    assert len(client.get('/api/palettes',params={'primary':'#ee4400'}).json())==4
    project.pop('id')
    project['modules'][0]['background']='red;display:none'
    assert client.post('/api/render',json=project).status_code==422

def test_image_edit_uses_uploaded_reference(client,project,monkeypatch):
    import io,uuid
    from PIL import Image
    from app import ai,settings
    monkeypatch.setattr(settings,'AI_ENABLED',True)
    out=io.BytesIO();Image.new('RGB',(20,20),'blue').save(out,'PNG')
    photo=client.post('/api/assets',files={'file':('bike.png',out.getvalue(),'image/png')}).json()['url']
    calls=[]
    async def provider(method,url,**kwargs):
        calls.append(kwargs['json'])
        if url.endswith('/responses'):
            from tests.director_helpers import director_response
            assert kwargs['json']['reasoning']['effort']=='high'
            assert kwargs['json']['input'][1]['content'][1]['image_url'].startswith('data:image/webp;base64,')
            return director_response()
        if 'base64-upload' in url:return {'data':{'downloadUrl':'https://tempfile.redpandaai.co/bike.webp'}}
        return {'data':{'taskId':'reference-task'}}
    monkeypatch.setattr(ai,'call',provider)
    result=client.post(f"/api/projects/{project['id']}/ai/image",json={'module_id':project['modules'][0]['id'],'prompt':'La misma bicicleta en una montaña al atardecer','image':photo},headers={'Idempotency-Key':str(uuid.uuid4())})
    assert result.status_code==200
    assert calls[2]['model']=='gpt-image-2-5-flare-image-to-image'
    assert calls[2]['input']['input_urls']==['https://tempfile.redpandaai.co/bike.webp']
