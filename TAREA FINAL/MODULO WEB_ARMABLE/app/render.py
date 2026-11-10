import io
import re
import zipfile
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from jinja2 import Environment, FileSystemLoader, select_autoescape
from markupsafe import Markup
from . import settings as s
from .models import Project
from .fonts import typography
from .colors import palette, module_style

env = Environment(loader=FileSystemLoader(s.ROOT / 'app/templates'), autoescape=select_autoescape(['html']))
ALIASES = {'products': 'productos', 'features': 'servicios', 'pricing': 'planes', 'contact': 'contacto', 'faq': 'preguntas', 'hero': 'inicio', 'carousel': 'galeria', 'testimonials': 'opiniones', 'cta': 'empezar'}

def render(project: Project, editing=False, full=False):
    seen = set()
    modules = []
    for m in project.modules:
        alias = ALIASES[m.kind] if m.kind not in seen else ''
        seen.add(m.kind)
        modules.append({'module': m, 'alias': alias, 'content': m.content, 'style':module_style(project,m), 'light':module_style(project,m,False),'dark':module_style(project,m,True)})
    body = typography(project.font) + env.get_template('site.html').render(project=project, modules=modules, editing=editing, palette=palette(project), light_palette=palette(project,False), dark_palette=palette(project,True))
    if not full:
        return body
    return env.get_template('document.html').render(project=project, body=Markup(body))

class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.links, self.images = [], [], []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        if tag == 'a':
            self.links.append(attrs.get('href', ''))
        if tag == 'img':
            self.images.append(attrs)

def review(project):
    parser = LinkParser()
    parser.feed(render(project))
    issues = []
    if project.font.startswith('upload:') and not (s.DATA / 'assets' / (project.font.split(':')[1] + '.woff2')).is_file():
        issues.append({'level':'error','message':'La fuente subida no está disponible. Selecciona otra fuente.'})
    for link in parser.links:
        if not link:
            issues.append({'level': 'error', 'message': 'Hay un botón sin destino.'})
        elif link.startswith('#') and link[1:] not in parser.ids:
            issues.append({'level': 'error', 'message': f'El enlace {link} no tiene un módulo de destino.'})
        elif link.startswith(('http:', 'https:')):
            issues.append({'level': 'notice', 'message': f'Enlace externo válido en formato; comprobar disponibilidad manualmente: {link}'})
    for img in parser.images:
        if not img.get('alt'):
            issues.append({'level': 'warning', 'message': 'Agrega una descripción alternativa a una imagen.'})
        src = img.get('src', '')
        if src.startswith('/assets/') and not (s.DATA / 'assets' / src.rsplit('/', 1)[-1]).exists():
            issues.append({'level': 'error', 'message': 'Una imagen subida ya no está disponible.'})
    if not project.business.email and not project.business.phone:
        issues.append({'level': 'warning', 'message': 'Agrega un correo o teléfono para activar los botones de contacto.'})
    for key, count in Counter(parser.ids).items():
        if count > 1:
            issues.append({'level': 'error', 'message': f'Identificador duplicado: {key}'})
    for m in project.modules:
        if not m.content.title:
            issues.append({'level': 'warning', 'message': f'El módulo {m.kind} no tiene título.'})
        if m.kind in ('carousel', 'products', 'pricing', 'features', 'faq', 'testimonials') and not m.content.items:
            issues.append({'level': 'warning', 'message': f'El módulo {m.kind} no tiene elementos.'})
    if not project.modules:
        issues.append({'level': 'error', 'message': 'Agrega al menos un módulo.'})
    return {'valid': not any(i['level'] == 'error' for i in issues), 'issues': issues,
            'checks': ['Estructura y anclas internas', 'Destinos y protocolos permitidos', 'Disponibilidad de imágenes locales', 'Textos alternativos', 'Identificadores únicos'],
            'external_links': 'Se valida el formato. No se realizan solicitudes a destinos arbitrarios desde el servidor.'}

def export_zip(project):
    result = review(project)
    if not result['valid']:
        from fastapi import HTTPException
        raise HTTPException(422, {'message': 'Corrige los enlaces o recursos antes de exportar.', 'review': result})
    html = render(project, full=True).replace('/static/site.css', 'site.css').replace('/static/site.js', 'site.js').replace('/static/images/', 'images/').replace('/assets/', 'assets/')
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as archive:
        if project.font.startswith('upload:'):
            name = project.font.split(':')[1] + '.woff2'
            html = html.replace('/fonts/' + name, 'fonts/' + name)
            archive.write(s.DATA / 'assets' / name, 'fonts/' + name)
        archive.writestr('index.html', html)
        archive.writestr('project.json', project.model_dump_json(indent=2))
        for name in ('site.css', 'site.js'):
            archive.write(s.ROOT / 'app/static' / name, name)
        for path in (s.ROOT / 'app/static/images').glob('*.svg'):
            archive.write(path, 'images/' + path.name)
        assets = set(re.findall(r'/assets/([a-f0-9]{32}\.webp)', project.model_dump_json()))
        for name in assets:
            path = s.DATA / 'assets' / name
            if path.is_file():
                archive.write(path, 'assets/' + name)
        archive.writestr('LEEME.txt', 'Abre index.html. Incluye todos los recursos locales. project.json permite reimportar el diseño en Módulo. Los enlaces externos se validan por formato; comprueba su disponibilidad antes de publicar. Los planes y productos enlazan al contacto: no incluye pagos ni gestión de pedidos.\n')
    return buffer.getvalue()
