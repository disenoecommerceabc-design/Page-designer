import re
from typing import Literal
from urllib.parse import urlsplit
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from .plans import PlanId

KINDS = Literal['hero', 'carousel', 'products', 'features', 'pricing', 'testimonials', 'faq', 'contact', 'cta']

def safe_link(value: str) -> str:
    if not value:
        return ''
    if any(c.isspace() or ord(c) < 32 or c in '<>"\\' for c in value):
        raise ValueError('El enlace contiene caracteres no permitidos.')
    if re.fullmatch(r'#[a-zA-Z][a-zA-Z0-9_-]{0,70}', value):
        return value
    try:
        parsed = urlsplit(value)
        if parsed.port is not None and not 1 <= parsed.port <= 65535:
            raise ValueError('Puerto inválido.')
    except ValueError:
        raise ValueError('El enlace no tiene un formato válido.')
    if parsed.scheme in ('http', 'https') and parsed.hostname and not parsed.username and not parsed.password:
        return value
    if re.fullmatch(r'mailto:[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}', value):
        return value
    if re.fullmatch(r'tel:\+?[0-9()-]{6,20}', value):
        return value
    raise ValueError('Usa https://, mailto:, tel: o un ancla #modulo.')

def safe_image(value: str) -> str:
    if value == '' or re.fullmatch(r'/assets/[a-f0-9]{32}\.webp', value) or re.fullmatch(r'/static/images/(product|studio|desk)\.svg', value):
        return value
    raise ValueError('Selecciona una imagen subida al proyecto.')

class Strict(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)

class Card(Strict):
    focal_x: int = Field(default=50, ge=0, le=100)
    focal_y: int = Field(default=50, ge=0, le=100)
    title: str = Field(default='', max_length=150)
    description: str = Field(default='', max_length=1200)
    price: str = Field(default='', max_length=60)
    badge: str = Field(default='', max_length=50)
    image: str = Field(default='', max_length=150)
    alt: str = Field(default='', max_length=200)
    button: str = Field(default='Conocer más', max_length=60)
    url: str = Field(default='#contacto', max_length=600)
    features: list[str] = Field(default_factory=list, max_length=8)
    _image = field_validator('image')(safe_image)
    _url = field_validator('url')(safe_link)

    @field_validator('features')
    @classmethod
    def short_features(cls, value):
        if any(len(item) > 160 for item in value):
            raise ValueError('Cada beneficio admite hasta 160 caracteres.')
        return value

class Content(Strict):
    focal_x: int = Field(default=50, ge=0, le=100)
    focal_y: int = Field(default=50, ge=0, le=100)
    eyebrow: str = Field(default='', max_length=100)
    title: str = Field(default='', max_length=180)
    description: str = Field(default='', max_length=1800)
    button: str = Field(default='Hablemos', max_length=60)
    url: str = Field(default='#contacto', max_length=600)
    image: str = Field(default='', max_length=150)
    alt: str = Field(default='', max_length=200)
    items: list[Card] = Field(default_factory=list, max_length=8)
    _image = field_validator('image')(safe_image)
    _url = field_validator('url')(safe_link)

class Module(Strict):
    tone: Literal['inherit','panel','light','dark','primary','secondary','custom'] = 'inherit'
    background: str = Field(default='#ffffff', pattern=r'^#[a-fA-F0-9]{6}$')
    id: str = Field(pattern=r'^m-[a-f0-9]{12}$')
    kind: KINDS
    content: Content
    notes: str = Field(default='', max_length=1500)

class Business(Strict):
    logo: str = Field(default='', max_length=150)
    _logo = field_validator('logo')(safe_image)
    name: str = Field(default='Forma Studio', min_length=1, max_length=80)
    industry: str = Field(default='Objetos para vivir mejor', max_length=120)
    audience: str = Field(default='', max_length=300)
    description: str = Field(default='', max_length=1200)
    email: str = Field(default='', max_length=180)
    phone: str = Field(default='', max_length=30)

    @field_validator('email')
    @classmethod
    def email_ok(cls, value):
        if value and not re.fullmatch(r'[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}', value):
            raise ValueError('Correo inválido.')
        return value

    @field_validator('phone')
    @classmethod
    def phone_ok(cls, value):
        if value and not re.fullmatch(r'\+?[0-9 ()-]{6,25}', value):
            raise ValueError('Teléfono inválido.')
        return value

class Project(Strict):
    secondary: str = Field(default='', pattern=r'^(#[a-fA-F0-9]{6})?$')
    harmony: Literal['complementary','analogous','triadic','monochrome'] = 'complementary'
    color_mode: Literal['light','dark'] = 'light'
    font: str = Field(default='default', max_length=100)

    @field_validator('font')
    @classmethod
    def valid_font(cls, value):
        if value not in ('default', 'Inter', 'Roboto', 'Lato', 'Montserrat', 'Poppins', 'Nunito', 'Playfair Display', 'Merriweather') and not re.fullmatch(r'upload:[a-f0-9]{32}', value):
            raise ValueError('Selecciona una fuente del catálogo o una fuente subida.')
        return value
    name: str = Field(default='Mi primera web', min_length=1, max_length=100)
    template: Literal['tienda', 'servicios', 'suscripciones'] = 'tienda'
    business: Business = Field(default_factory=Business)
    accent: str = Field(default='#356657', pattern=r'^#[a-fA-F0-9]{6}$')
    modules: list[Module] = Field(default_factory=list, max_length=30)
    revision: int = Field(default=0, ge=0)

    @model_validator(mode='after')
    def unique_ids(self):
        if len({m.id for m in self.modules}) != len(self.modules):
            raise ValueError('Los identificadores de los módulos deben ser únicos.')
        return self

class AIRequest(Strict):
    image_path: str = Field(default='image', pattern=r'^(image|items\.[0-7]\.image)$')
    module_id: str = Field(pattern=r'^m-[a-f0-9]{12}$')
    prompt: str = Field(min_length=3, max_length=1000)
    field: Literal['title', 'description'] = 'description'
    image: str = Field(default='', max_length=150)
    _image = field_validator('image')(safe_image)

class Login(Strict):
    username: str = Field(max_length=254)
    password: str = Field(max_length=200)

class Registration(Login):
    username: str = Field(pattern=r'^[a-zA-Z0-9_.-]{3,60}$')
    password: str = Field(min_length=12, max_length=200)
    invitation: str = Field(min_length=1, max_length=200)

class PlanSelection(Strict):
    plan: PlanId

class EmailRegistration(PlanSelection):
    email: str = Field(max_length=254, pattern=r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
    password: str = Field(min_length=12, max_length=200)
    invitation: str = Field(default='', max_length=200)

class SavedTemplate(Strict):
    project_id: str = Field(pattern=r'^[a-f0-9-]{36}$')
    name: str = Field(min_length=1, max_length=100)

class TemplateDraft(Strict):
    name: str = Field(min_length=1, max_length=100)
    document: Project
