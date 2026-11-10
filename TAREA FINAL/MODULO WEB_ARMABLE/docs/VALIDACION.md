# Validación de la entrega

## Actualización de lectura y ancho de paneles

Se comprobó en navegador el aumento de tamaño y contraste de textos laterales, el arrastre real de ambos separadores y la reserva de 440 px para el lienzo central al alcanzar los límites. Se verificaron límites por teclado (panel izquierdo a 230 px y derecho a 460 px), restablecimiento con doble clic y persistencia del ancho tras recargar. La reducción a 1024 px ajusta los paneles manteniendo el centro en 440 px. A 390 px los paneles se apilan, desaparecen los separadores y no hay desbordamiento horizontal. Las verificaciones de sintaxis de los scripts pasan. Esta ampliación solo modifica la interfaz del editor; no realiza llamadas de IA ni cambia los componentes exportados.

## Actualización del agente de dirección de imagen

37 pruebas automatizadas aprobadas. Se verificaron el uso obligatorio de GPT‑6 Luna con razonamiento alto, el envío visual de la referencia, los contratos de relación de aspecto por módulo, el bloqueo de generación si el director falla, la colocación automática con metadatos de encuadre, la conservación de métricas al consultar la tarea, la protección de imágenes cambiadas por el usuario y el mensaje de error HTTP 503 con credenciales redactadas.

La prueba real con credencial temporal recibió HTTP 503 de Kie tanto en solicitudes completas como en una comprobación mínima a Luna. La consulta de saldo y catálogo respondieron correctamente. No se crearon tareas de imagen ni se aplicaron imágenes reales. Ver `docs/agente-imagen.md`. La validación inicial y la de paletas documentadas debajo son anteriores a esta ampliación.

## Actualización de colores y flujo manual

30 pruebas automatizadas aprobadas tras incorporar paletas y modo nocturno. Se añadieron pruebas de contraste para colores extremos y saturados, persistencia y exportación de colores por módulo, rechazo de CSS arbitrario y uso de la foto de referencia en el contrato de edición de imágenes de Kie.

Verificación real en navegador: vista previa de 390 px, alternancia nocturna dentro del iframe (confirmada con `data-mode=dark`), controles de paletas visibles, reordenamiento con las flechas del lienzo, eliminación y deshacer, y arrastre real de Contacto antes de Planes desde el asa del módulo. Se restauró el orden original. La carga de referencia dentro del diálogo de IA devolvió «Referencia lista» y seleccionó el modo de edición. No se hizo una generación facturable. Captura: `artifacts/preview-mobile-nocturno.jpg`.

El bloque siguiente documenta la validación inicial, anterior a estas ampliaciones.

Fecha: 8 de noviembre de 2026, America/Santiago.

## Resultado

- 17 pruebas automatizadas aprobadas.
- Imagen `modulo-editor:local` construida y contenedor con estado `healthy`.
- FastAPI devuelve `{"status":"ok"}` en `/health`.
- Aplicación local disponible en `http://localhost:8000`.

## Interacciones comprobadas en navegador

- Búsqueda de módulos por «precio» y «preguntas».
- Agregado de planes desde el botón de la biblioteca.
- Arrastre real de preguntas frecuentes desde la biblioteca al primer lugar del lienzo; la estructura cambió de cinco a siete módulos durante la prueba.
- Deshacer los cambios de prueba y volver a cinco módulos.
- Edición de un título desde el panel y directamente en el lienzo; guardado y recarga conservan el contenido.
- Carga de un PNG local de prueba, conversión a WebP y visualización en el módulo; posterior deshacer para restaurar la ilustración de ejemplo.
- Vista móvil del sitio y editor a 390 × 844; sin desbordamiento horizontal del documento.
- Revisión de entrega con advertencia de contacto pendiente en los datos de ejemplo.
- Descarga real del sitio ZIP desde la interfaz.
- Vista previa independiente con carrusel de tres imágenes; el botón siguiente modifica su posición de desplazamiento.

La vista final se conserva en `artifacts/editor-verificado.jpg` en la carpeta de trabajo.

## Controles verificados automáticamente

Las pruebas cubren los tres tipos de plantilla; guardado, orden y notas; conflictos de actualización; bloqueo de protocolos ejecutables, campos HTML arbitrarios e identificadores duplicados; escape de texto; autenticación, origen y hosts; decodificación de imágenes; recursos incluidos en ZIP; anclas rotas que bloquean entrega; IA desactivada sin reserva ni llamada; reserva concurrente sin sobrepasar el cupo; idempotencia; tareas asíncronas de imagen; dominios de descarga; separación de proyectos, imágenes, operaciones y cupos entre cuentas; carga grande sin Content-Length; fallos del proveedor sin reintento ni liberación insegura del cupo.

Hay una advertencia de deprecación de la integración de pruebas `Starlette TestClient` con `httpx`. Las pruebas pasan; esta advertencia no afecta a Uvicorn ni al cliente HTTP que utiliza la aplicación.

## Pendiente de configuración externa

No hay clave de Kie configurada. Los contratos de IA se probaron con respuestas simuladas; no se realizó generación pagada. Confirmar con una cuenta real el soporte de parámetros, disponibilidad de modelos, tratamiento de fallos y facturación antes de activar IA para clientes.

Los enlaces externos solo se revisan por formato. Los datos comerciales y de contacto son de ejemplo y deben reemplazarse. No se ha desplegado en la nube; Docker y las instrucciones de producción están preparados para ese siguiente paso.
