import json
import sqlite3
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from fastapi import HTTPException
from . import settings as s
from .plans import PLANS

@contextmanager
def connection():
    db = sqlite3.connect(s.DATA / 'editor.sqlite3', timeout=15)
    db.row_factory = sqlite3.Row
    try:
        yield db
        db.commit()
    except BaseException:
        db.rollback()
        raise
    finally:
        db.close()

def init():
    with connection() as db:
        db.execute('PRAGMA journal_mode=WAL')
        db.executescript('''
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY, owner TEXT NOT NULL, document TEXT NOT NULL,
            revision INTEGER NOT NULL, updated REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS operations (
            id TEXT PRIMARY KEY, owner TEXT NOT NULL, project TEXT NOT NULL,
            kind TEXT NOT NULL, fingerprint TEXT NOT NULL, cost INTEGER NOT NULL,
            day TEXT NOT NULL, created REAL NOT NULL, status TEXT NOT NULL,
            provider_id TEXT, result TEXT, input_tokens INTEGER DEFAULT 0,
            output_tokens INTEGER DEFAULT 0, provider_credits REAL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS login_attempts (client TEXT, created REAL);
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE,
            salt TEXT NOT NULL, password_hash TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS assets (filename TEXT PRIMARY KEY, owner TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS fonts (id TEXT PRIMARY KEY, owner TEXT NOT NULL, name TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS user_plans (owner TEXT PRIMARY KEY, plan TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS monthly_pages (
            owner TEXT NOT NULL, month TEXT NOT NULL, created INTEGER NOT NULL,
            PRIMARY KEY (owner, month)
        );
        CREATE TABLE IF NOT EXISTS saved_templates (
            id TEXT PRIMARY KEY, owner TEXT NOT NULL, name TEXT NOT NULL,
            document TEXT NOT NULL, created REAL NOT NULL
        );
        CREATE INDEX IF NOT EXISTS saved_templates_owner ON saved_templates(owner);
        CREATE INDEX IF NOT EXISTS operations_owner_day ON operations(owner, day);
        CREATE TABLE IF NOT EXISTS interests (
            email TEXT PRIMARY KEY, name TEXT NOT NULL, plan TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            consent_version TEXT NOT NULL DEFAULT 'launch-v1'
        );
        ''')

def get_project(pid, owner):
    with connection() as db:
        row = db.execute('SELECT * FROM projects WHERE id=? AND owner=?', (pid, owner)).fetchone()
    if not row:
        raise HTTPException(404, 'Proyecto no encontrado.')
    return json.loads(row['document'])

def save_project(pid, owner, project, create=False):
    data = project.model_dump()
    revision = 1 if create else data['revision'] + 1
    data['revision'] = revision
    with connection() as db:
        if create:
            if owner != 'workspace':
                db.execute('BEGIN IMMEDIATE')
                month = datetime.now(timezone.utc).strftime('%Y-%m')
                if pages_created(db, owner, month) >= PLANS[user_plan(db, owner)]['pages']:
                    raise HTTPException(429, 'Alcanzaste el límite mensual de páginas de tu plan.')
                db.execute('''INSERT INTO monthly_pages VALUES (?,?,1)
                    ON CONFLICT(owner,month) DO UPDATE SET created=created+1''', (owner, month))
            db.execute('INSERT INTO projects VALUES (?,?,?,?,?)', (pid, owner, json.dumps(data), revision, time.time()))
        else:
            result = db.execute('UPDATE projects SET document=?, revision=?, updated=? WHERE id=? AND owner=? AND revision=?',
                (json.dumps(data), revision, time.time(), pid, owner, project.revision))
            if result.rowcount != 1:
                raise HTTPException(409, 'Hay una versión más reciente. Recarga el proyecto antes de guardar.')
    return {'id': pid, **data}

def user_plan(db, owner):
    row = db.execute('SELECT plan FROM user_plans WHERE owner=?', (owner,)).fetchone()
    return row['plan'] if row else 'starter'

def pages_created(db, owner, month):
    row = db.execute('SELECT created FROM monthly_pages WHERE owner=? AND month=?', (owner, month)).fetchone()
    return row['created'] if row else 0

def template_count(db, owner):
    return db.execute('SELECT COUNT(*) FROM saved_templates WHERE owner=?', (owner,)).fetchone()[0]

def saved_template(owner, tid):
    with connection() as db:
        row = db.execute('SELECT document FROM saved_templates WHERE owner=? AND id=?', (owner, tid)).fetchone()
    if not row:
        raise HTTPException(404, 'Plantilla no encontrada.')
    return json.loads(row['document'])

def save_template(owner, name, *, pid=None, draft=None):
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        if draft is None:
            row = db.execute('SELECT document FROM projects WHERE owner=? AND id=?', (owner, pid)).fetchone()
            if not row:
                raise HTTPException(404, 'Web no encontrada.')
            document = json.loads(row['document'])
        else:
            document = draft.model_dump()
        if owner != 'workspace' and template_count(db, owner) >= PLANS[user_plan(db, owner)]['templates']:
            raise HTTPException(429, 'Alcanzaste el límite de plantillas guardadas de tu plan.')
        document.update(name=name, revision=0)
        tid = str(uuid.uuid4())
        db.execute('INSERT INTO saved_templates VALUES (?,?,?,?,?)', (tid, owner, name, json.dumps(document), time.time()))
        return {'id': tid, 'name': name}

def monthly_credits(db, owner, month):
    return db.execute('SELECT COALESCE(SUM(cost),0) FROM operations WHERE owner=? AND day>=? AND day<=?',
                      (owner, month + '-01', month + '-31')).fetchone()[0]

def usage(owner):
    day = datetime.now(timezone.utc).date().isoformat()
    with connection() as db:
        row = db.execute('SELECT COALESCE(SUM(cost),0) cost, COUNT(*) count FROM operations WHERE owner=? AND day=?', (owner, day)).fetchone()
        global_cost = db.execute('SELECT COALESCE(SUM(cost),0) FROM operations WHERE day=?', (day,)).fetchone()[0]
        result = {'used': row['cost'], 'limit': s.DAILY, 'requests': row['count'], 'request_limit': s.REQUESTS,
                  'global_remaining': max(0, s.GLOBAL_DAILY - global_cost), 'costs': s.COSTS, 'period': 'diario',
                  'resets': '00:00 UTC', 'unit': 'créditos internos', 'plan': None}
        if owner != 'workspace':
            month = day[:7]
            plan = user_plan(db, owner)
            limits = PLANS[plan]
            result.update(plan=plan, used=monthly_credits(db, owner, month), limit=limits['credits'],
                          period='mensual', resets='el día 1 a las 00:00 UTC',
                          pages_used=pages_created(db, owner, month), pages_limit=limits['pages'],
                          templates_used=template_count(db, owner), templates_limit=limits['templates'])
    return result

def reserve(owner, pid, kind, opid, fingerprint):
    day = datetime.now(timezone.utc).date().isoformat()
    now = time.time()
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        existing = db.execute('SELECT * FROM operations WHERE id=?', (opid,)).fetchone()
        if existing:
            if existing['owner'] != owner or existing['fingerprint'] != fingerprint:
                raise HTTPException(409, 'Identificador de operación ya utilizado.')
            return dict(existing), False
        budget = db.execute('SELECT COALESCE(SUM(cost),0), COUNT(*) FROM operations WHERE owner=? AND day=?', (owner, day)).fetchone()
        total = db.execute('SELECT COALESCE(SUM(cost),0) FROM operations WHERE day=?', (day,)).fetchone()[0]
        last = db.execute('SELECT MAX(created) FROM operations WHERE owner=?', (owner,)).fetchone()[0]
        cost = s.COSTS[kind]
        if owner != 'workspace' and monthly_credits(db, owner, day[:7]) + cost > PLANS[user_plan(db, owner)]['credits']:
            raise HTTPException(429, 'Alcanzaste los créditos mensuales de IA de tu plan.')
        if (owner == 'workspace' and budget[0] + cost > s.DAILY) or total + cost > s.GLOBAL_DAILY or budget[1] >= s.REQUESTS:
            raise HTTPException(429, 'Alcanzaste el límite diario de IA. Puedes seguir editando manualmente.')
        if last and now - last < s.COOLDOWN:
            raise HTTPException(429, f'Espera {s.COOLDOWN} segundos entre solicitudes de IA.')
        db.execute('INSERT INTO operations (id,owner,project,kind,fingerprint,cost,day,created,status) VALUES (?,?,?,?,?,?,?,?,?)',
                   (opid, owner, pid, kind, fingerprint, s.COSTS[kind], day, now, 'running'))
        return dict(db.execute('SELECT * FROM operations WHERE id=?', (opid,)).fetchone()), True

def operation(opid, owner):
    with connection() as db:
        row = db.execute('SELECT * FROM operations WHERE id=? AND owner=?', (opid, owner)).fetchone()
    if not row:
        raise HTTPException(404, 'Operación no encontrada.')
    return dict(row)

def finish(opid, status, result=None, provider_id=None, metrics=None):
    metrics = metrics if metrics is not None else {}
    with connection() as db:
        db.execute('UPDATE operations SET status=?,result=?,provider_id=COALESCE(?,provider_id),input_tokens=COALESCE(?,input_tokens),output_tokens=COALESCE(?,output_tokens),provider_credits=COALESCE(?,provider_credits) WHERE id=?',
                   (status, json.dumps(result or {}), provider_id, metrics.get('input_tokens'), metrics.get('output_tokens'), metrics.get('credits'), opid))

def apply_generated_image(opid, owner):
    """Apply once to the intended slot without overwriting newer user images."""
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        op=db.execute('SELECT * FROM operations WHERE id=? AND owner=?',(opid,owner)).fetchone()
        if not op or op['status']!='completed':
            return
        result=json.loads(op['result'] or '{}')
        if 'applied' in result or not result.get('image'):
            return
        row=db.execute('SELECT * FROM projects WHERE id=? AND owner=?',(op['project'],owner)).fetchone()
        target=None
        if row:
            document=json.loads(row['document'])
            module=next((m for m in document['modules'] if m['id']==result.get('module_id')),None)
            if module:
                content=module['content']
                parts=result.get('image_path','image').split('.')
                if parts==['image']:
                    target=content
                elif len(parts)==3 and parts[0]=='items' and parts[1].isdigit() and int(parts[1])<len(content.get('items',[])):
                    target=content['items'][int(parts[1])]
        if target is None or target.get('image','')!=result.get('previous_image',''):
            result.update(applied=False,apply_message='La imagen del módulo cambió o el módulo fue eliminado. La generación se conservó sin sobrescribir tu trabajo.')
        else:
            brief=result.get('brief',{})
            target.update(image=result['image'],alt=brief.get('alt','Imagen generada del producto'),focal_x=brief.get('focal_x',50),focal_y=brief.get('focal_y',50))
            revision=row['revision']+1
            document['revision']=revision
            db.execute('UPDATE projects SET document=?,revision=?,updated=? WHERE id=? AND owner=?',(json.dumps(document),revision,time.time(),op['project'],owner))
            result.update(applied=True,revision=revision,apply_message='Imagen colocada en el módulo con el encuadre del director.')
        db.execute('UPDATE operations SET result=? WHERE id=?',(json.dumps(result),opid))
