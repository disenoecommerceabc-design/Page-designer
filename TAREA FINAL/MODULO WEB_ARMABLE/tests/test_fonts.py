import io
import zipfile
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

def font_bytes():
    builder = FontBuilder(1000, isTTF=True)
    builder.setupGlyphOrder(['.notdef','A'])
    builder.setupCharacterMap({65:'A'})
    glyphs = {}
    for name in ['.notdef','A']:
        pen = TTGlyphPen(None)
        pen.moveTo((100,0)); pen.lineTo((500,800)); pen.lineTo((900,0)); pen.closePath()
        glyphs[name] = pen.glyph()
    builder.setupGlyf(glyphs)
    builder.setupHorizontalMetrics({name:(1000,0) for name in glyphs})
    builder.setupHorizontalHeader(ascent=800,descent=-200)
    builder.setupNameTable({'familyName':'TestFont','styleName':'Regular','uniqueFontIdentifier':'TestFont','fullName':'TestFont Regular','psName':'TestFont-Regular'})
    builder.setupOS2(sTypoAscender=800,sTypoDescender=-200,usWinAscent=800,usWinDescent=200)
    builder.setupPost()
    out=io.BytesIO();builder.save(out);return out.getvalue()

def test_upload_apply_export_font(client, project):
    result=client.post('/api/fonts',files={'file':('test.ttf',font_bytes(),'font/ttf')})
    assert result.status_code==200, result.text
    value=result.json()['value']
    assert any(f['value']==value for f in client.get('/api/fonts').json()['uploads'])
    project.pop('id')
    project['font']=value
    saved=client.post('/api/projects',json=project).json()
    name=value.split(':')[1]+'.woff2'
    assert client.get('/fonts/'+name).content.startswith(b'wOF2')
    html=client.post('/api/render',json=project).text
    assert '@font-face' in html and 'has-font' in html
    exported=client.get(f"/api/projects/{saved['id']}/export")
    with zipfile.ZipFile(io.BytesIO(exported.content)) as archive:
        assert 'fonts/'+name in archive.namelist()
        assert '/fonts/' not in archive.read('index.html').decode()

def test_google_and_invalid_font(client, project):
    project.pop('id')
    project['font']='Playfair Display'
    result=client.post('/api/render',json=project)
    assert 'fonts.googleapis.com/css2?family=Playfair+Display' in result.text
    project['font']="bad';}body{display:none}"
    assert client.post('/api/render',json=project).status_code==422
    assert client.post('/api/fonts',files={'file':('bad.ttf',b'not a font','font/ttf')}).status_code==422

def test_font_owned_by_account(client, project, monkeypatch):
    from app import settings
    value=client.post('/api/fonts',files={'file':('test.ttf',font_bytes(),'font/ttf')}).json()['value']
    monkeypatch.setattr(settings,'REGISTRATION_CODE','font-test-invite')
    client.post('/api/register',json={'username':'font-user','password':'password-test-1234','invitation':'font-test-invite'})
    assert client.put('/api/account/plan',json={'plan':'starter'}).status_code==200
    assert client.get('/fonts/'+value.split(':')[1]+'.woff2').status_code==404
    project.pop('id');project['font']=value
    assert client.post('/api/projects',json=project).status_code==403
