import json
BRIEF={'prompt':'Photograph the complete product at the center with generous crop-safe margins, natural lighting and a clean background. Preserve every visible component and avoid added text or branding.',
       'summary':'Producto completo centrado con espacio para recorte móvil.','alt':'Producto completo sobre fondo claro','focal_x':50,'focal_y':48,'subject':'Producto de referencia'}
def director_response():
    return {'status':'completed','output':[{'type':'message','content':[{'type':'output_text','text':json.dumps(BRIEF)}]}],
            'usage':{'input_tokens':120,'output_tokens':240},'credits_consumed':.25}
