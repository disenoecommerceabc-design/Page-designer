import io
import uuid
from fastapi import HTTPException
from fontTools.ttLib import TTFont
from . import settings as s, db

GOOGLE = ['Inter', 'Roboto', 'Lato', 'Montserrat', 'Poppins', 'Nunito', 'Playfair Display', 'Merriweather']

def typography(font):
    if font == 'default':
        return ''
    if font.startswith('upload:'):
        ident = font.split(':')[1]
        return f'''<style>@font-face{{font-family:'User{ident}';src:url('/fonts/{ident}.woff2') format('woff2');font-display:swap}}.site.has-font,.site.has-font h1,.site.has-font h2,.site.has-font h3,.site.has-font .site-brand,.site.has-font .site-footer>a{{font-family:'User{ident}',sans-serif}}</style>'''
    from urllib.parse import quote_plus
    return f'''<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family={quote_plus(font)}:wght@400;500;600;700&amp;display=swap"><style>.site.has-font,.site.has-font h1,.site.has-font h2,.site.has-font h3,.site.has-font .site-brand,.site.has-font .site-footer>a{{font-family:'{font}',sans-serif}}</style>'''

def upload_font(raw, owner, name):
    if len(raw) > 2 * 1024 * 1024:
        raise HTTPException(413, 'La fuente supera 2 MB.')
    try:
        with TTFont(io.BytesIO(raw), lazy=False) as font:
            if not {'name','head','cmap','maxp'} <= set(font.keys()):
                raise ValueError('Missing tables')
            # Re-encode to a single browser format; discard embedded SVG graphics.
            if 'SVG ' in font:
                del font['SVG ']
            for tag in list(font.keys()):
                if tag != 'GlyphOrder':
                    font[tag]
            font.flavor = 'woff2'
            output = io.BytesIO()
            font.save(output)
    except Exception:
        raise HTTPException(422, 'Archivo de fuente inválido. Usa TTF, OTF, WOFF o WOFF2.')
    ident = uuid.uuid4().hex
    filename = ident + '.woff2'
    (s.DATA / 'assets' / filename).write_bytes(output.getvalue())
    with db.connection() as conn:
        conn.execute('INSERT INTO assets VALUES (?,?)', (filename, owner))
        conn.execute('INSERT INTO fonts VALUES (?,?,?)', (ident, owner, name[:100]))
    return {'value':'upload:' + ident, 'name':name[:100]}
