"""Explicit, bounded operator test. Credential is read only from stdin.

Run inside the existing Docker service with --stage create, then optionally edit.
No automatic retries or additional variations. Not an HTTP endpoint.
"""
import argparse
import asyncio
import json
import sys
import time
import uuid
from fastapi import HTTPException
from . import settings as s, ai, db
from .catalog import new_project,new_module
from .models import Project,AIRequest

def report(**data):
    print(json.dumps(data,ensure_ascii=False),flush=True)

async def run(stage):
    s.KIE_KEY=sys.stdin.readline().strip()
    if not s.KIE_KEY:
        raise RuntimeError('Falta la credencial en stdin.')
    s.AI_ENABLED=True
    db.init()
    metadata=s.DATA/'live-image-check.json'
    if stage=='create':
        project=new_project('tienda')
        project.name='Prueba IA · Dirección de fotografía'
        project.business.name='Ciclo Norte · Demo'
        project.business.industry='Bicicletas urbanas — sitio de prueba'
        project.business.description='Demostración de fotografía de producto para una web de bicicletas.'
        project.modules=[project.modules[0],project.modules[-1]]
        project.modules[0].content.title='Tu próxima ruta empieza aquí.'
        project.modules[0].content.description='Una demostración del encuadre para productos en escritorio y móvil.'
        project.modules[0].content.url='#contacto'
        project.modules[0].notes='La bicicleta debe verse completa, incluidas ambas ruedas. Marco de portada vertical con recorte en móvil.'
        pid=str(uuid.uuid4())
        saved=db.save_project(pid,'workspace',project,create=True)
        document=Project.model_validate({k:v for k,v in saved.items() if k!='id'})
        request=AIRequest(module_id=document.modules[0].id,prompt='Fotografía comercial de una bicicleta urbana roja de cuadro diamante completo en un parque arbolado al amanecer. Sin personas ni texto. La bicicleta completa, ambas ruedas y manillar deben ser visibles, con luz natural cálida y fondo suave.')
        state={'project_id':pid,'operations':[]}
    else:
        state=json.loads(metadata.read_text())
        pid=state['project_id']
        document=Project.model_validate(db.get_project(pid,'workspace'))
        first=db.operation(state['operations'][0]['id'],'workspace')
        reference=json.loads(first['result'] or '{}').get('image')
        if first['status']!='completed' or not reference:
            raise RuntimeError('La primera imagen no se completó. No se envía otra generación.')
        raw=document.model_dump()
        raw['modules'].insert(1,new_module('products'))
        document=Project.model_validate(raw)
        product=document.modules[1]
        product.content.title='La misma bicicleta, otro escenario.'
        product.content.description='Prueba de imagen con referencia, encuadre cuadrado.'
        product.content.items=product.content.items[:1]
        product.content.items[0].title='Bicicleta urbana · Demo'
        product.content.items[0].description='Imagen generada para pruebas; no representa un producto real a la venta.'
        product.content.items[0].price='Demostración'
        product.notes='Preservar exactamente la bicicleta de la foto, cuadro rojo, componentes y ambas ruedas; usarla en catálogo cuadrado.'
        saved=db.save_project(pid,'workspace',document)
        document=Project.model_validate({k:v for k,v in saved.items() if k!='id'})
        request=AIRequest(module_id=product.id,image_path='items.0.image',image=reference,prompt='Mantén exactamente la bicicleta de la imagen de referencia y colócala en un sendero de montaña con cielo claro, luz de tarde y montañas suaves al fondo. Fotografía comercial, bicicleta completa y protagonista, sin personas ni texto.')
    opid=str(uuid.uuid4())
    state['operations'].append({'id':opid,'stage':stage})
    metadata.write_text(json.dumps(state,indent=2),encoding='utf-8')
    report(stage=stage,phase='directing',project_id=pid,operation_id=opid)
    try:
        result=await ai.generate('workspace',pid,'image',opid,document,request)
        report(phase=result['result'].get('stage'),status=result['status'],usage=result['usage'])
        start=time.monotonic()
        while result['status']=='running' and time.monotonic()-start<600:
            await asyncio.sleep(5)
            result=await ai.poll(opid,'workspace')
        report(phase='finished',**result)
        state['operations'][-1]['result']=result
        metadata.write_text(json.dumps(state,indent=2,ensure_ascii=False),encoding='utf-8')
    except HTTPException as error:
        report(phase='stopped',status_code=error.status_code,message=str(error.detail))
        raise SystemExit(1)
    finally:
        s.KIE_KEY=''

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--stage',choices=['create','edit'],required=True)
    asyncio.run(run(parser.parse_args().stage))
