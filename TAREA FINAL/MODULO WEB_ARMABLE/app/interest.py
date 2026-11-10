import json
import re
import sqlite3

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from . import db

PLANS = {'Por definir', 'Starter', 'Professional', 'Business', 'Agency'}


def save_interest(email, name, plan):
    with db.connection() as conn:
        conn.execute(
            'INSERT INTO interests (email, name, plan) VALUES (?, ?, ?) ON CONFLICT(email) DO NOTHING',
            (email, name, plan),
        )


async def register_interest(request: Request):
    raw = await request.body()
    if len(raw) > 4096:
        return JSONResponse({'error': 'Solicitud demasiado grande.'}, status_code=413)
    try:
        data = json.loads(raw)
    except (ValueError, RecursionError):
        data = None
    if not isinstance(data, dict):
        return JSONResponse({'error': 'Datos inválidos.'}, status_code=400)
    if data.get('website'):
        return JSONResponse({'ok': True})
    email = data['email'].strip().lower() if isinstance(data.get('email'), str) else ''
    name = data['name'].strip() if isinstance(data.get('name'), str) else ''
    plan = data.get('plan')
    if (len(email) > 254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email)
            or not 0 < len(name) <= 100 or not isinstance(plan, str) or plan not in PLANS
            or data.get('consent') is not True):
        return JSONResponse({'error': 'Revisa tus datos y acepta el uso de tu correo para el lanzamiento.'}, status_code=400)
    try:
        await run_in_threadpool(save_interest, email, name, plan)
    except (sqlite3.Error, UnicodeError):
        return JSONResponse({'error': 'No pudimos guardar tu solicitud. Inténtalo de nuevo en unos minutos.'}, status_code=503)
    return JSONResponse({'ok': True})
