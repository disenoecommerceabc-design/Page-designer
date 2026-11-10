import copy
import secrets
from .models import Project

CATALOG = [
    {'kind': 'hero', 'name': 'Portada principal', 'category': 'Esenciales', 'description': 'Una primera impresión que conecta.', 'icon': 'layout'},
    {'kind': 'carousel', 'name': 'Carrusel de imágenes', 'category': 'Contenido', 'description': 'Historias y productos en movimiento.', 'icon': 'gallery'},
    {'kind': 'products', 'name': 'Catálogo de productos', 'category': 'Ventas', 'description': 'Productos, precios y un clic para comprar.', 'icon': 'grid'},
    {'kind': 'features', 'name': 'Servicios y beneficios', 'category': 'Contenido', 'description': 'Lo que hace especial a tu negocio.', 'icon': 'spark'},
    {'kind': 'pricing', 'name': 'Planes y precios', 'category': 'Ventas', 'description': 'Suscripciones fáciles de comparar.', 'icon': 'price'},
    {'kind': 'testimonials', 'name': 'Testimonios', 'category': 'Confianza', 'description': 'Da espacio a las voces de tus clientes.', 'icon': 'quote'},
    {'kind': 'faq', 'name': 'Preguntas frecuentes', 'category': 'Confianza', 'description': 'Resuelve dudas antes del primer contacto.', 'icon': 'help'},
    {'kind': 'contact', 'name': 'Contacto', 'category': 'Esenciales', 'description': 'Correo, teléfono y una conversación.', 'icon': 'mail'},
    {'kind': 'cta', 'name': 'Llamada a la acción', 'category': 'Ventas', 'description': 'Convierte una visita en el siguiente paso.', 'icon': 'arrow'},
]

DEFAULTS = {
    'hero': {'eyebrow': 'DISEÑADO PARA TU DÍA A DÍA', 'title': 'Pequeños objetos.\nGrandes momentos.', 'description': 'Diseño consciente y detalles que importan. Descubre una colección creada para acompañarte todos los días.', 'button': 'Explorar la colección', 'url': '#productos', 'image': '/static/images/product.svg', 'alt': 'Composición de objetos de diseño en tonos cálidos'},
    'products': {'eyebrow': 'NUESTRA COLECCIÓN', 'title': 'Tus nuevos favoritos', 'description': 'Piezas simples, hechas para quedarse.', 'items': [
        {'title': 'Lámpara Aura', 'description': 'Luz cálida para tus espacios favoritos.', 'price': '$34.990', 'badge': 'Más vendido', 'image': '/static/images/desk.svg', 'alt': 'Lámpara de escritorio', 'button': 'Consultar', 'url': '#contacto'},
        {'title': 'Vasija Tierra', 'description': 'Cerámica con carácter y textura natural.', 'price': '$22.990', 'image': '/static/images/product.svg', 'alt': 'Vasija de cerámica', 'button': 'Consultar', 'url': '#contacto'},
        {'title': 'Set Esencial', 'description': 'Un pequeño ritual para cada mañana.', 'price': '$28.990', 'image': '/static/images/studio.svg', 'alt': 'Objetos de estudio', 'button': 'Consultar', 'url': '#contacto'}]},
    'features': {'eyebrow': 'CADA DETALLE CUENTA', 'title': 'Hecho con intención', 'description': 'Una experiencia que se siente bien, de principio a fin.', 'items': [
        {'title': 'Diseño cercano', 'description': 'Soluciones que se adaptan a tu vida.'},
        {'title': 'Calidad que dura', 'description': 'Materiales seleccionados y atención a cada detalle.'},
        {'title': 'Siempre contigo', 'description': 'Un equipo dispuesto a ayudarte en cada paso.'}]},
    'carousel': {'eyebrow': 'INSPÍRATE', 'title': 'Un lugar para tus ideas', 'description': 'Recorre nuestra selección.', 'items': [
        {'title': 'Calma en cada rincón', 'description': 'Espacios que invitan a quedarse.', 'image': '/static/images/product.svg', 'alt': 'Objetos de diseño'},
        {'title': 'Una nueva perspectiva', 'description': 'Ideas para tu próximo proyecto.', 'image': '/static/images/studio.svg', 'alt': 'Estudio creativo'},
        {'title': 'Tu espacio, tu ritmo', 'description': 'Detalles que cambian tu día.', 'image': '/static/images/desk.svg', 'alt': 'Escritorio con lámpara'}]},
    'pricing': {'eyebrow': 'CRECEMOS CONTIGO', 'title': 'Un plan para cada etapa', 'description': 'Elige la opción que mejor se adapta a ti.', 'items': [
        {'title': 'Esencial', 'price': '$9.990 / mes', 'description': 'Todo lo que necesitas para empezar.', 'features': ['Acceso a la colección', 'Soporte por correo', 'Actualizaciones mensuales'], 'button': 'Consultar plan', 'url': '#contacto'},
        {'title': 'Profesional', 'price': '$19.990 / mes', 'description': 'Más posibilidades para tus ideas.', 'badge': 'Recomendado', 'features': ['Todo lo del plan Esencial', 'Atención prioritaria', 'Contenido exclusivo'], 'button': 'Consultar plan', 'url': '#contacto'},
        {'title': 'Equipo', 'price': '$39.990 / mes', 'description': 'Una experiencia para compartir.', 'features': ['Todo lo del plan Profesional', 'Hasta 5 integrantes', 'Asesoría personalizada'], 'button': 'Hablemos', 'url': '#contacto'}]},
    'testimonials': {'eyebrow': 'HISTORIAS COMPARTIDAS', 'title': 'La experiencia de nuestros clientes', 'description': 'Ejemplos: reemplaza estas reseñas por testimonios autorizados.', 'items': [
        {'title': 'Nombre de cliente', 'description': 'Escribe aquí una reseña real de tu negocio.', 'badge': 'Cliente'},
        {'title': 'Nombre de cliente', 'description': 'Comparte una experiencia real y verificable.', 'badge': 'Cliente'}]},
    'faq': {'eyebrow': 'TE AYUDAMOS', 'title': 'Preguntas frecuentes', 'items': [
        {'title': '¿Cómo puedo hacer un pedido?', 'description': 'Escríbenos por nuestros canales de contacto para coordinar tu pedido.'},
        {'title': '¿Cuáles son los plazos de entrega?', 'description': 'Consulta la disponibilidad y los plazos antes de confirmar tu compra.'},
        {'title': '¿Puedo recibir asesoría?', 'description': 'Sí. Cuéntanos qué necesitas y te ayudaremos a encontrar una opción.'}]},
    'contact': {'eyebrow': 'HAGAMOS ALGO BUENO', 'title': 'Conversemos sobre tu próxima idea.', 'description': 'Cuéntanos qué tienes en mente. Nos encantará escucharte.', 'button': 'Escríbenos'},
    'cta': {'eyebrow': 'EL SIGUIENTE PASO', 'title': 'Tu próxima gran idea empieza aquí.', 'description': 'Estamos listos para acompañarte.', 'button': 'Conversemos', 'url': '#contacto'},
}

TEMPLATES = [
    {'id': 'tienda', 'name': 'Forma', 'tag': 'Tienda & productos', 'description': 'Verde bosque y salvia para destacar tu colección.', 'color': '#214f3e', 'secondary': '#55866b', 'modules': ['hero', 'features', 'products', 'carousel', 'contact']},
    {'id': 'servicios', 'name': 'Estudio', 'tag': 'Servicios & profesionales', 'description': 'Violeta profundo y lavanda para presentar tus servicios.', 'color': '#58328a', 'secondary': '#8964bd', 'modules': ['hero', 'features', 'carousel', 'pricing', 'faq', 'contact']},
    {'id': 'suscripciones', 'name': 'Impulso', 'tag': 'Planes & suscripciones', 'description': 'Azul cobalto y celeste para mostrar planes y beneficios.', 'color': '#1e4fa5', 'secondary': '#5086cc', 'modules': ['hero', 'features', 'pricing', 'faq', 'cta', 'contact']},
]

def new_module(kind):
    return {'id': 'm-' + secrets.token_hex(6), 'kind': kind, 'content': copy.deepcopy(DEFAULTS[kind]), 'notes': ''}

def new_project(template='tienda'):
    t = next(t for t in TEMPLATES if t['id'] == template)
    p = {'name': 'Mi web · ' + t['name'], 'template': template, 'accent': t['color'],
         'secondary': t['secondary'], 'harmony': 'monochrome', 'modules': [new_module(k) for k in t['modules']]}
    p['modules'][0]['tone'] = 'panel'
    if template == 'servicios':
        p['business'] = {'name': 'Estudio Norte', 'industry': 'Diseño y servicios creativos'}
        p['modules'][0]['content'].update(title='Buenas ideas.\nResultados que se ven.', eyebrow='UN ESTUDIO PARA TU NEGOCIO', description='Transformamos tus desafíos en soluciones claras. Un equipo cercano para llevar tu próximo proyecto más lejos.', button='Conoce nuestros servicios', url='#servicios', image='/static/images/studio.svg')
    if template == 'suscripciones':
        p['business'] = {'name': 'Impulso', 'industry': 'Herramientas para crecer'}
        p['modules'][0]['content'].update(title='Tu siguiente nivel\nempieza hoy.', eyebrow='MÁS POSIBILIDADES, MENOS LÍMITES', description='Un espacio para aprender, crear y hacer crecer tus ideas. Elige tu plan y avanza a tu ritmo.', button='Ver los planes', url='#planes', image='/static/images/desk.svg')
    return Project.model_validate(p)
