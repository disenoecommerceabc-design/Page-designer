# Agente de dirección de imagen

Toda solicitud de imagen pasa obligatoriamente por `app/image_director.py`, con instrucciones versionadas en `app/prompts/image_director.txt`.

## Flujo

1. El servidor valida cuenta, foto de referencia, módulo y espacio exacto (`image` o `items.N.image`). Reserva el cupo una sola vez, con idempotencia.
2. GPT‑6 Luna recibe el prompt del cliente, el contexto comercial, la paleta, las notas y las restricciones reales del componente. Si existe una foto propia, la recibe como entrada visual, no como nombre de archivo. Se solicita siempre `reasoning.effort=high`.
3. El agente devuelve JSON con prompt afinado, resumen en español, sujeto, descripción alternativa y ancla visual X/Y. El servidor valida su formato, longitud y coordenadas antes de continuar. No se expone el razonamiento interno.
4. El servidor fija la relación de aspecto: portada **2:3**, producto **1:1**, carrusel **16:9**. Estas decisiones no se delegan al texto libre del cliente. La resolución se mantiene en 1K.
5. Se envía el prompt afinado a GPT Image 2.5 Flare. Con referencia se usa `image-to-image` y `input_urls`; sin referencia se usa `text-to-image`. Si Luna falla, no se envía ninguna tarea de imagen.
6. Se conserva el taskId y se consulta la tarea sin volver a crearla. El resultado se descarga a almacenamiento propio, se valida y se optimiza a WebP.
7. Una transacción coloca la imagen, su texto alternativo y el punto focal en el espacio solicitado. El componente usa `object-position` para el encuadre. Si la imagen de ese espacio cambió o el módulo ya no existe, se conserva la generación sin sobrescribir cambios. El guardado usa una revisión nueva.
8. El editor muestra el resultado colocado, el resumen y el prompt afinado. Permite conservar o deshacer. Las operaciones terminadas pueden recuperarse después de recargar; repetir la consulta no vuelve a generar ni colocar la misma imagen.

## Criterios visuales

La dirección prioriza preservar geometría, colores, componentes y marcas visibles del producto de referencia; evitar ruedas u otras partes recortadas; separar producto y fondo; definir iluminación y perspectiva coherentes; respetar el ambiente solicitado y dejar márgenes para recortes móviles. En carrusel evita colocar detalles esenciales en la franja inferior del texto y mantiene el sujeto dentro del centro recortable. No se añaden tipografías, precios ni marcas inventadas a la imagen.

El agente prepara una composición, pero no certifica que un modelo de imagen conserve todos los detalles. No hay una segunda generación automática ni un ciclo ilimitado de revisión. El cliente debe inspeccionar el resultado y puede deshacerlo.

## Costos y límites

Una operación de imagen incluye una llamada de dirección y una tarea de imagen. Ambas comparten la reserva interna de imagen ya configurada; no se cobran unidades internas dos veces. El proveedor factura ambas etapas según su tarifa. Ajusta `AI_IMAGE_CREDITS` con mediciones reales antes de comercializarlo.

El director solicita hasta 6.000 tokens de salida, incluyendo el presupuesto que el proveedor gestione para razonamiento; el máximo configurable es 8.000. El prompt final admite hasta 5.000 caracteres. La consulta de texto dispone de 180 segundos. Los límites generales de texto siguen siendo independientes. Debe comprobarse en la cuenta real que Kie respete `max_output_tokens`: la documentación consultada no lo define expresamente. No hay reintentos automáticos ante rechazo, timeout o error incierto. Los tokens y créditos informados por Luna se conservan al consultar y colocar la imagen; el costo real de la imagen debe conciliarse con Kie.

## Configuración

```dotenv
KIE_IMAGE_DIRECTOR_MODEL=gpt-6-luna
AI_DIRECTOR_MAX_OUTPUT_TOKENS=6000
```

El razonamiento alto está fijado en el servicio. Se utiliza `/codex/v1/responses`; para las imágenes, `/api/v1/jobs/createTask` y `/api/v1/jobs/recordInfo`. Referencias oficiales: [Luna](https://docs.kie.ai/market/chat/gpt-6-luna) y [GPT Image 2.5 edición](https://docs.kie.ai/market/gpt/gpt-image-2-5-flare-image-to-image).

## Prueba real de esta entrega

Se utilizó la credencial temporal recibida únicamente por stdin, en memoria del proceso de prueba. No se incluyó en código, archivos de configuración, instrucciones, imágenes ni ZIP entregable.

La consulta autenticada de saldo fue exitosa y la lista de modelos incluye `gpt-6-luna`. Sin embargo, las dos solicitudes de dirección y una comprobación mínima al endpoint de Luna devolvieron **HTTP 503, `Service temporarily unavailable`**. No se creó ninguna tarea de imagen porque la dirección previa es obligatoria. La generación real, descarga y colocación quedan pendientes de que el servicio de Luna vuelva a responder; no se ha verificado una imagen real en esta entrega.

Las pruebas acotadas crearon proyectos de demostración separados de los del usuario. Los fallos conservan su reserva interna conforme a la política conservadora de la app. La clave temporal no quedó activada en el servidor del editor. Para retomar una prueba, `python -m app.live_image_check --stage create` lee una credencial de stdin y realiza una sola cadena de dirección + imagen; `--stage edit` solo procede si la primera imagen ya terminó. Nunca añade variantes ni reintenta una generación fallida automáticamente.
