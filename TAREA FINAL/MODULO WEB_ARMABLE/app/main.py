import hashlib
import hmac
import json
import re
import secrets
import sqlite3
import time
import uuid
from contextlib import asynccontextmanager
from urllib.parse import urlsplit
from fastapi import FastAPI, Request, UploadFile, File, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, Response, FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from . import settings as s, db, ai
from . import __version__
from .catalog import CATALOG, TEMPLATES, DEFAULTS, new_project
from .models import Project, AIRequest, Login, Registration, EmailRegistration, PlanSelection, SavedTemplate, TemplateDraft
from .plans import PLANS
from .render import render, review, export_zip
from .middleware import BodyLimitMiddleware, HostMiddleware, ProductionHTTPSMiddleware
from .fonts import GOOGLE, upload_font
from .colors import secondary, contrast, ink
from .interest import register_interest

LANDING = s.ROOT / 'app/landing_dist'
HAS_LANDING = (LANDING / 'index.html').is_file()

if s.SESSION_SECRET:
    SECRET = hashlib.sha256(s.SESSION_SECRET.encode()).digest()
else:
    key_path = s.DATA / 'session.key'
    if not key_path.exists():
        try:
            with key_path.open('xb') as key_file:
                key_file.write(secrets.token_bytes(32))
        except FileExistsError:
            pass
    SECRET = key_path.read_bytes()

@asynccontextmanager
async def lifespan(app):
    db.init()
    yield

app = FastAPI(title='Módulo — Editor web', version=__version__, lifespan=lifespan, docs_url='/docs' if not s.PRODUCTION else None, redoc_url=None, openapi_url='/openapi.json' if not s.PRODUCTION else None)
if s.PRODUCTION:
    app.add_middleware(ProductionHTTPSMiddleware)
app.add_middleware(HostMiddleware, allowed_hosts=s.HOSTS)
app.add_middleware(BodyLimitMiddleware)

def token(owner):
    subject = 'admin' if owner == 'workspace' else owner
    payload = subject + ':' + str(int(time.time()) + 86400)
    return payload + ':' + hmac.new(SECRET, payload.encode(), hashlib.sha256).hexdigest()

def authenticated(request):
    value = request.cookies.get('modulo_session', '')
    try:
        name, expires, signature = value.split(':')
        payload = name + ':' + expires
        valid = int(expires) > time.time() and hmac.compare_digest(signature, hmac.new(SECRET, payload.encode(), hashlib.sha256).hexdigest())
        if valid and name == 'admin' and s.PASSWORD:
            return 'workspace'
        if valid and re.fullmatch(r'[a-f0-9]{32}', name):
            with db.connection() as conn:
                row = conn.execute('SELECT 1 FROM users WHERE id=?', (name,)).fetchone()
            return name if row else None
        return None
    except (ValueError, TypeError):
        return None

def set_session(response, owner):
    response.set_cookie('modulo_session', token(owner), httponly=True, secure=s.SECURE, samesite='strict', max_age=86400)

@app.middleware('http')
async def security(request: Request, call_next):
    path = request.url.path
    interest = HAS_LANDING and path == '/api/interest' and request.method == 'POST'
    if request.method in ('POST', 'PUT', 'DELETE', 'PATCH'):
        origin = request.headers.get('origin')
        expected = f'{request.url.scheme}://{request.url.netloc}'
        if interest and origin != expected:
            return JSONResponse({'error': 'Solicitud no permitida.'}, status_code=403)
        if not interest and (request.headers.get('x-editor-request') != '1' or (origin is not None and origin != expected)):
            return JSONResponse({'detail': 'Origen de la solicitud no permitido.'}, status_code=403)
        try:
            if int(request.headers.get('content-length', '0')) > 9 * 1024 * 1024:
                return JSONResponse({'detail': 'Solicitud demasiado grande.'}, status_code=413)
        except ValueError:
            return JSONResponse({'detail': 'Tamaño inválido.'}, status_code=400)
    public = (path in ('/', '/builder', '/acceso', '/health', '/api/session', '/api/login', '/api/register', '/api/plans')
              or path.startswith('/static/') or interest or (HAS_LANDING and path.startswith('/landing/')))
    owner = request.state.owner = authenticated(request)
    request.state.plan = None
    if owner and owner != 'workspace':
        with db.connection() as conn:
            row = conn.execute('SELECT plan FROM user_plans WHERE owner=?', (owner,)).fetchone()
        if row and row['plan'] in PLANS:
            request.state.plan = row['plan']
    request.state.editor_access = owner == 'workspace' or request.state.plan is not None
    if not public and not owner:
        return JSONResponse({'detail': 'Inicia sesión para abrir tu espacio.'}, status_code=401)
    if not public and path not in ('/api/account/plan', '/api/logout') and not request.state.editor_access:
        return JSONResponse({'detail': 'Selecciona un plan para abrir el editor.'}, status_code=403)
    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'same-origin'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'"
    if path.startswith('/api/'):
        response.headers['Cache-Control'] = 'no-store'
    elif path in ('/static/editor.js', '/static/editor.css'):
        response.headers['Cache-Control'] = 'no-cache'
    return response

app.mount('/static', StaticFiles(directory=s.ROOT / 'app/static'), name='static')
if HAS_LANDING:
    app.mount('/landing/assets', StaticFiles(directory=LANDING / 'assets'), name='landing-assets')
    app.add_api_route('/api/interest', register_interest, methods=['POST'])

@app.get('/')
def index():
    if HAS_LANDING:
        return FileResponse(LANDING / 'index.html', headers={'Cache-Control': 'no-cache'})
    return RedirectResponse('/builder', headers={'Cache-Control': 'no-store'})

@app.get('/builder')
def builder(request: Request):
    if not request.state.editor_access:
        plan = request.query_params.get('plan')
        target = '/acceso' + (f'?plan={plan}' if plan in PLANS else '')
        return RedirectResponse(target, headers={'Cache-Control': 'no-store'})
    return FileResponse(s.ROOT / 'app/templates/editor.html', headers={'Cache-Control': 'no-store'})

@app.get('/acceso')
def access(request: Request):
    if request.state.editor_access:
        return RedirectResponse('/builder', headers={'Cache-Control': 'no-store'})
    return FileResponse(s.ROOT / 'app/templates/access.html', headers={'Cache-Control': 'no-store'})

@app.get('/health')
def health():
    return {'status': 'ok'}

@app.get('/api/session')
def session(request: Request):
    local = not s.PRODUCTION and not s.PASSWORD
    owner = request.state.owner
    allowed = request.state.editor_access
    return {'authenticated': bool(owner), 'local': local, 'editor_access': allowed,
        'workspace': owner == 'workspace', 'plan': request.state.plan, 'invitation_required': bool(s.REGISTRATION_CODE),
        'ai_enabled': s.AI_ENABLED if allowed else False,
        'models': {'text': s.TEXT_MODEL, 'design': s.DESIGN_MODEL, 'image': 'GPT Image 2.5 Flare','image_director':s.IMAGE_DIRECTOR_MODEL,'image_reasoning':'high'} if allowed else {}}

def limit_auth_attempts(request: Request):
    client = request.client.host if request.client else 'unknown'
    with db.connection() as conn:
        conn.execute('BEGIN IMMEDIATE')
        conn.execute('DELETE FROM login_attempts WHERE created < ?', (time.time() - 900,))
        if conn.execute('SELECT COUNT(*) FROM login_attempts WHERE client=?', (client,)).fetchone()[0] >= 10:
            raise HTTPException(429, 'Demasiados intentos. Espera 15 minutos.')
        conn.execute('INSERT INTO login_attempts VALUES (?,?)', (client, time.time()))

@app.post('/api/login')
def login(data: Login, request: Request):
    limit_auth_attempts(request)
    owner = None
    if s.PASSWORD and hmac.compare_digest(data.username.encode(), s.USERNAME.encode()) and hmac.compare_digest(data.password.encode(), s.PASSWORD.encode()):
        owner = 'workspace'
    else:
        with db.connection() as conn:
            row = conn.execute('SELECT * FROM users WHERE username=?', (data.username.lower(),)).fetchone()
        if row:
            hashed = hashlib.pbkdf2_hmac('sha256', data.password.encode(), bytes.fromhex(row['salt']), 600000).hex()
            if hmac.compare_digest(hashed, row['password_hash']):
                owner = row['id']
    if not owner:
        raise HTTPException(401, 'Credenciales incorrectas.')
    response = JSONResponse({'authenticated': True})
    set_session(response, owner)
    return response

@app.post('/api/register', status_code=201)
def register(data: EmailRegistration | Registration, request: Request):
    legacy = isinstance(data, Registration)
    if legacy and not s.REGISTRATION_CODE:
        raise HTTPException(403, 'El registro por invitación está desactivado.')
    limit_auth_attempts(request)
    username = (data.username if legacy else data.email).lower()
    if (s.REGISTRATION_CODE and not hmac.compare_digest(data.invitation.encode(), s.REGISTRATION_CODE.encode())) or username == s.USERNAME.lower():
        raise HTTPException(403, 'No se pudo crear la cuenta con estos datos.')
    owner, salt = uuid.uuid4().hex, secrets.token_hex(32)
    password_hash = hashlib.pbkdf2_hmac('sha256', data.password.encode(), bytes.fromhex(salt), 600000).hex()
    try:
        with db.connection() as conn:
            conn.execute('INSERT INTO users VALUES (?,?,?,?)', (owner, username, salt, password_hash))
            if not legacy:
                conn.execute('INSERT INTO user_plans VALUES (?,?)', (owner, data.plan))
    except sqlite3.IntegrityError:
        raise HTTPException(409, 'Ya existe una cuenta con ese identificador.')
    response = JSONResponse({'authenticated': True}, status_code=201)
    set_session(response, owner)
    return response

@app.post('/api/logout')
def logout():
    response = JSONResponse({'ok': True})
    response.delete_cookie('modulo_session')
    return response

@app.get('/api/plans')
def plans():
    return PLANS

@app.put('/api/account/plan')
def change_plan(data: PlanSelection, request: Request):
    owner = request.state.owner
    if owner == 'workspace':
        raise HTTPException(403, 'Crea una cuenta para seleccionar un plan.')
    with db.connection() as conn:
        conn.execute('''INSERT INTO user_plans VALUES (?,?)
            ON CONFLICT(owner) DO UPDATE SET plan=excluded.plan''', (owner, data.plan))
    return db.usage(owner)

@app.get('/api/catalog')
def catalog():
    return {'modules': CATALOG, 'defaults': DEFAULTS, 'templates': TEMPLATES}

@app.get('/api/templates/{template}')
def template(template: str):
    if template not in ('tienda', 'servicios', 'suscripciones'):
        raise HTTPException(404, 'Plantilla no encontrada.')
    return new_project(template)

@app.get('/api/projects')
def projects(request: Request):
    with db.connection() as conn:
        rows = conn.execute('SELECT id,document,updated FROM projects WHERE owner=? ORDER BY updated DESC', (request.state.owner,)).fetchall()
    return [{'id': row['id'], 'name': json.loads(row['document'])['name'], 'updated': row['updated']} for row in rows]

def validate_asset_access(project, owner):
    if project.font.startswith('upload:'):
        with db.connection() as conn:
            font = conn.execute('SELECT owner FROM fonts WHERE id=?', (project.font.split(':')[1],)).fetchone()
        if not font or font['owner'] != owner:
            raise HTTPException(403, 'Selecciona una fuente de tu cuenta.')
    filenames = set(re.findall(r'/assets/([a-f0-9]{32}\.webp)', project.model_dump_json()))
    with db.connection() as conn:
        for filename in filenames:
            row = conn.execute('SELECT owner FROM assets WHERE filename=?', (filename,)).fetchone()
            if (row and row['owner'] != owner) or (not row and (s.DATA / 'assets' / filename).exists()):
                raise HTTPException(403, 'Una imagen no pertenece a tu cuenta.')

@app.post('/api/projects', status_code=201)
def create(project: Project, request: Request):
    validate_asset_access(project, request.state.owner)
    return db.save_project(str(uuid.uuid4()), request.state.owner, project, create=True)

@app.get('/api/projects/{pid}')
def get_project(pid: uuid.UUID, request: Request):
    return {'id': str(pid), **db.get_project(str(pid), request.state.owner)}

@app.put('/api/projects/{pid}')
def save(pid: uuid.UUID, project: Project, request: Request):
    validate_asset_access(project, request.state.owner)
    return db.save_project(str(pid), request.state.owner, project)

@app.get('/api/saved-templates')
def saved_templates(request: Request):
    with db.connection() as conn:
        rows = conn.execute('SELECT id,name FROM saved_templates WHERE owner=? ORDER BY created DESC', (request.state.owner,)).fetchall()
    return [dict(row) for row in rows]

@app.post('/api/saved-templates', status_code=201)
def save_template(data: SavedTemplate | TemplateDraft, request: Request):
    owner = request.state.owner
    if isinstance(data, TemplateDraft):
        validate_asset_access(data.document, owner)
        return db.save_template(owner, data.name, draft=data.document)
    return db.save_template(owner, data.name, pid=data.project_id)

@app.get('/api/saved-templates/{tid}')
def get_saved_template(tid: uuid.UUID, request: Request):
    return db.saved_template(request.state.owner, str(tid))

@app.delete('/api/saved-templates/{tid}')
def delete_saved_template(tid: uuid.UUID, request: Request):
    with db.connection() as conn:
        result = conn.execute('DELETE FROM saved_templates WHERE owner=? AND id=?', (request.state.owner, str(tid)))
        if not result.rowcount:
            raise HTTPException(404, 'Plantilla no encontrada.')
    return {'ok': True}

@app.post('/api/render', response_class=HTMLResponse)
def preview(project: Project, request: Request):
    validate_asset_access(project, request.state.owner)
    return render(project, editing=True)

@app.get('/api/projects/{pid}/preview', response_class=HTMLResponse)
def site_preview(pid: uuid.UUID, request: Request):
    return render(Project.model_validate(db.get_project(str(pid), request.state.owner)), full=True)

@app.post('/api/projects/{pid}/review')
def site_review(pid: uuid.UUID, request: Request):
    return review(Project.model_validate(db.get_project(str(pid), request.state.owner)))

@app.get('/api/projects/{pid}/export')
def export(pid: uuid.UUID, request: Request):
    project = Project.model_validate(db.get_project(str(pid), request.state.owner))
    return Response(export_zip(project), media_type='application/zip', headers={'Content-Disposition': 'attachment; filename="mi-sitio.zip"'})

@app.post('/api/assets')
async def upload(request: Request, file: UploadFile = File(...)):
    raw = await file.read(8 * 1024 * 1024 + 1)
    await file.close()
    return {'url': ai.store_image(raw, request.state.owner)}

@app.get('/assets/{filename}')
def asset(filename: str, request: Request):
    if not re.fullmatch(r'[a-f0-9]{32}\.webp', filename):
        raise HTTPException(404, 'Imagen no encontrada.')
    path = s.DATA / 'assets' / filename
    with db.connection() as conn:
        row = conn.execute('SELECT owner FROM assets WHERE filename=?', (filename,)).fetchone()
    if not row or row['owner'] != request.state.owner:
        raise HTTPException(404, 'Imagen no encontrada.')
    if not path.is_file():
        raise HTTPException(404, 'Imagen no encontrada.')
    return FileResponse(path, media_type='image/webp')

@app.get('/api/usage')
def usage(request: Request):
    return db.usage(request.state.owner)

@app.get('/api/fonts')
def fonts(request: Request):
    with db.connection() as conn:
        rows = conn.execute('SELECT id,name FROM fonts WHERE owner=? ORDER BY name', (request.state.owner,)).fetchall()
    return {'google':GOOGLE, 'uploads':[{'value':'upload:' + row['id'], 'name':row['name']} for row in rows]}

@app.get('/api/palettes')
def palettes(primary: str = '#356657'):
    if not re.fullmatch(r'#[a-fA-F0-9]{6}',primary):
        raise HTTPException(422,'Color inválido.')
    return [{'harmony':h,'secondary':secondary(primary,h),'primary':primary,'contrast':round(contrast(primary,ink(primary)),2)} for h in ('complementary','analogous','triadic','monochrome')]

@app.post('/api/fonts')
async def font_upload(request: Request, file: UploadFile = File(...)):
    raw = await file.read(2 * 1024 * 1024 + 1)
    name = file.filename or 'Mi fuente'
    await file.close()
    return upload_font(raw, request.state.owner, name)

@app.get('/fonts/{filename}')
def font_file(filename: str, request: Request):
    if not re.fullmatch(r'[a-f0-9]{32}\.woff2', filename):
        raise HTTPException(404, 'Fuente no encontrada.')
    with db.connection() as conn:
        row = conn.execute('SELECT owner FROM fonts WHERE id=?', (filename[:-6],)).fetchone()
    path = s.DATA / 'assets' / filename
    if not row or row['owner'] != request.state.owner or not path.is_file():
        raise HTTPException(404, 'Fuente no encontrada.')
    return FileResponse(path, media_type='font/woff2')

@app.get('/api/operations')
def operations(request: Request):
    with db.connection() as conn:
        rows = conn.execute('SELECT * FROM operations WHERE owner=? ORDER BY created DESC LIMIT 30', (request.state.owner,)).fetchall()
    return [{**ai.public_operation(dict(row)), 'project_id': row['project'], 'created': row['created']} for row in rows]

def operation_id(request):
    try:
        return str(uuid.UUID(request.headers.get('idempotency-key', '')))
    except ValueError:
        raise HTTPException(422, 'Falta un identificador único de operación.')

@app.post('/api/projects/{pid}/ai/{kind}')
async def generate(pid: uuid.UUID, kind: str, request: Request, data: AIRequest | None = None):
    if kind not in ('text', 'image', 'design'):
        raise HTTPException(404, 'Operación no disponible.')
    project = Project.model_validate(db.get_project(str(pid), request.state.owner))
    if kind != 'design' and (data is None or data.module_id not in {m.id for m in project.modules}):
        raise HTTPException(422, 'Selecciona un módulo válido.')
    if data and data.image:
        with db.connection() as conn:
            row = conn.execute('SELECT owner FROM assets WHERE filename=?', (data.image.rsplit('/',1)[-1],)).fetchone()
        if not row or row['owner'] != request.state.owner:
            raise HTTPException(403, 'Selecciona una foto subida a tu cuenta.')
    return await ai.generate(request.state.owner, str(pid), kind, operation_id(request), project, data)

@app.get('/api/operations/{opid}')
async def operation(opid: uuid.UUID, request: Request):
    return await ai.poll(str(opid), request.state.owner)
