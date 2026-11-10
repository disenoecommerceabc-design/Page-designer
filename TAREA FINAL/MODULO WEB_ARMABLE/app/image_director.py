"""Bounded art-direction agent. Plans content; never generates executable code."""
from pathlib import Path
from pydantic import BaseModel, ConfigDict, Field
from fastapi import HTTPException
from . import settings as s

class ImageBrief(BaseModel):
    model_config = ConfigDict(extra='forbid')
    prompt: str = Field(min_length=30, max_length=5000)
    summary: str = Field(min_length=5, max_length=600)
    alt: str = Field(min_length=5, max_length=200)
    focal_x: int = Field(ge=25, le=75)
    focal_y: int = Field(ge=25, le=75)
    subject: str = Field(min_length=3, max_length=300)

def image_slot(project, request):
    module = next((m for m in project.modules if m.id == request.module_id), None)
    if not module or module.kind not in ('hero','products','carousel'):
        raise HTTPException(422, 'Este módulo no tiene un espacio de imagen compatible.')
    parts = request.image_path.split('.')
    if module.kind == 'hero' and parts == ['image']:
        content = module.content
        ratio, desktop, mobile = '2:3', 'Retrato en columna lateral, ancho aproximado 45%; esquinas superiores redondeadas.', 'Imagen bajo el texto; marco cercano a cuadrado, recorte cover.'
    elif module.kind in ('products','carousel') and len(parts)==3 and parts[0]=='items' and parts[2]=='image' and int(parts[1]) < len(module.content.items):
        content = module.content.items[int(parts[1])]
        ratio = '1:1' if module.kind=='products' else '16:9'
        desktop = 'Tarjeta de producto cuadrada con texto debajo.' if module.kind=='products' else 'Carrusel ancho con título y descripción superpuestos en franja inferior.'
        mobile = 'Tarjeta en una columna; marco cuadrado.' if module.kind=='products' else 'Marco cercano a cuadrado; recorte horizontal del centro de una imagen panorámica.'
    else:
        raise HTTPException(422, 'Selecciona una imagen válida dentro del módulo.')
    return module, content, {'module_kind':module.kind, 'target':request.image_path, 'aspect_ratio':ratio,
        'desktop':desktop,'mobile':mobile,'object_fit':'cover','safe_zone':'Mantén el producto completo en el centro y deja margen generoso. En carrusel, el sujeto debe sobrevivir al recorte central cuadrado.',
        'title':content.title,'description':content.description[:600], 'notes':module.notes[:800]}

async def direct_image(project, request, response_json):
    module, content, slot = image_slot(project,request)
    reference = None
    if request.image:
        import base64
        path=s.DATA/'assets'/request.image.rsplit('/',1)[-1]
        if not request.image.startswith('/assets/') or not path.is_file():
            raise HTTPException(422,'La foto de referencia no está disponible.')
        reference='data:image/webp;base64,'+base64.b64encode(path.read_bytes()).decode()
    instructions=(Path(__file__).parent/'prompts/image_director.txt').read_text(encoding='utf-8')
    raw, metrics=await response_json(s.IMAGE_DIRECTOR_MODEL,instructions,
        {'client_prompt':request.prompt,'reference_attached':bool(reference),'slot':slot,
         'business':project.business.model_dump(),'brand':{'primary':project.accent,'secondary':project.secondary,'mode':project.color_mode}},
        ImageBrief.model_json_schema(), effort='high', max_output=s.DIRECTOR_MAX_OUTPUT, reference=reference)
    try:
        brief=ImageBrief.model_validate(raw)
    except ValueError:
        raise HTTPException(502,'El director de imagen devolvió un plan inválido. No se envió la generación de imagen.')
    return brief, slot, metrics
