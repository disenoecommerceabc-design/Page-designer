import os
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / '.env')
CLOUD_RUNTIME = bool(os.getenv('DYNO') or os.getenv('K_SERVICE'))
PRODUCTION = os.getenv('APP_ENV', 'local') == 'production' or CLOUD_RUNTIME
if CLOUD_RUNTIME and os.getenv('ALLOW_EPHEMERAL_DATA','false').lower()!='true':
    raise RuntimeError('Heroku/Cloud Run usan disco temporal. Esta version requiere una VM con volumen persistente, o ALLOW_EPHEMERAL_DATA=true exclusivamente para una demo sin persistencia.')
default_data = '/tmp/modulo-data' if CLOUD_RUNTIME else '/data' if os.getenv('MODULO_CONTAINER')=='1' else str(ROOT/'data')
DATA = Path(os.getenv('DATA_DIR', default_data)).resolve()
DATA.mkdir(parents=True, exist_ok=True)
(DATA / 'assets').mkdir(exist_ok=True)
USERNAME = os.getenv('ADMIN_USERNAME', 'admin')
PASSWORD = os.getenv('ADMIN_PASSWORD', '')
REGISTRATION_CODE = os.getenv('REGISTRATION_CODE', '')
SECURE = os.getenv('COOKIE_SECURE', 'false').lower() == 'true'
HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1,testserver').split(',')
HOSTS = [host.strip() for host in HOSTS if host.strip()]
SESSION_SECRET = os.getenv('SESSION_SECRET','')
if (CLOUD_RUNTIME or SESSION_SECRET) and len(SESSION_SECRET)<32:
    raise RuntimeError('Configura SESSION_SECRET con al menos 32 caracteres aleatorios.')
if PRODUCTION and (len(PASSWORD) < 16 or not SECURE):
    raise RuntimeError('Producción requiere ADMIN_PASSWORD de 16+ caracteres y COOKIE_SECURE=true.')
if not PRODUCTION and not PASSWORD and any(h not in ('localhost', '127.0.0.1', 'testserver') for h in HOSTS):
    raise RuntimeError('El modo local sin contraseña solo admite hosts locales.')
KIE_KEY = os.getenv('KIE_API_KEY', '')
AI_ENABLED = os.getenv('AI_ENABLED', 'false').lower() == 'true' and bool(KIE_KEY)
TEXT_MODEL = os.getenv('KIE_TEXT_MODEL', 'gpt-6-luna')
DESIGN_MODEL = os.getenv('KIE_DESIGN_MODEL', 'gpt-6.1-terra')
IMAGE_DIRECTOR_MODEL = os.getenv('KIE_IMAGE_DIRECTOR_MODEL', 'gpt-6-luna')
DIRECTOR_MAX_OUTPUT = min(int(os.getenv('AI_DIRECTOR_MAX_OUTPUT_TOKENS','6000')), 8000)
DAILY = int(os.getenv('AI_DAILY_CREDITS', '30'))
GLOBAL_DAILY = int(os.getenv('AI_GLOBAL_DAILY_CREDITS', '60'))
REQUESTS = int(os.getenv('AI_DAILY_REQUESTS', '15'))
COOLDOWN = int(os.getenv('AI_COOLDOWN_SECONDS', '5'))
MAX_OUTPUT = min(int(os.getenv('AI_MAX_OUTPUT_TOKENS', '1200')), 2400)
COSTS = {k: int(os.getenv(f'AI_{k.upper()}_CREDITS', str(v))) for k, v in [('text', 1), ('image', 5), ('design', 3)]}
if any(v <= 0 for v in COSTS.values()) or min(DAILY, GLOBAL_DAILY, REQUESTS, MAX_OUTPUT) <= 0:
    raise RuntimeError('Los límites y costos de IA deben ser positivos.')
