# Módulo — Constructor manual de páginas web

Aplicación local funcional para el trabajo final. Backend **FastAPI + Uvicorn**, interfaz HTML/CSS/JavaScript sin dependencias externas de navegador y persistencia en SQLite. Se entrega también una imagen Docker reproducible.

## Abrir la aplicación

En Windows, haz doble clic en **Módulo.lnk** o en **Iniciar Modulo.bat**. El lanzador inicia Docker Desktop si hace falta, construye/actualiza el contenedor, aplica `.env`, espera la respuesta de salud y abre `http://localhost:8000` en tu navegador. Cerrar la ventana del navegador deja la app funcionando en Docker. Si hay un error, la consola queda abierta para leerlo.

El acceso directo usa `assets/modulo.ico`, inspirado en el símbolo de módulos apilados de la app. Un `.bat` no admite icono propio: el icono personalizado se muestra en el acceso directo. Hay una copia del acceso directo en esta carpeta y otra en la carpeta que la contiene. Si mueves el proyecto o extraes el ZIP en otro equipo, ejecuta `scripts/crear-acceso-directo.ps1` para regenerar los accesos con las rutas correctas. El icono también se entrega en PNG y SVG.

El `.bat` usa una autorización de ejecución de PowerShell limitada a ese proceso; no modifica la política permanente de Windows. Para comprobar el inicio sin abrir el navegador: `"Iniciar Modulo.bat" --sin-navegador`. Se requiere Docker Desktop instalado.

Con Docker Desktop iniciado, desde esta carpeta:

```powershell
docker compose up --build -d
```

Abre **http://localhost:8000**. El contenedor conserva proyectos, cuentas, imágenes y consumo en el volumen `modulo-data`. `docker compose down` detiene la aplicación conservando los datos. No uses `down -v` si quieres conservarlos.

Sin Docker, con Python 3.14:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

En este equipo el entorno `.venv` ya está instalado. Puedes ejecutar `iniciar.ps1` cuando el puerto 8000 esté libre. Docker y la ejecución directa usan almacenes distintos: volumen Docker y carpeta `data`, respectivamente.

## Recorrido de uso

### Paneles de trabajo ajustables

El texto de estructura, edición y biblioteca tiene mayor tamaño y contraste. En escritorio puedes arrastrar la línea vertical entre cada panel lateral y el lienzo. El panel izquierdo admite entre 230 y 420 px y el derecho entre 250 y 460 px; el máximo disponible se reduce cuando es necesario para conservar al menos 440 px en el centro. Los valores iniciales son 240 y 280 px.

El ancho se recuerda en ese navegador y se adapta al reducir la ventana, conservando la preferencia para cuando haya espacio de nuevo. Haz doble clic sobre el separador para restablecer ese panel. También puedes enfocarlo con Tab y usar las flechas; Inicio/Fin van al mínimo/máximo, Enter restablece y Escape cancela un arrastre. En ventanas de hasta 960 px, los paneles se apilan y se ocultan los separadores. Las preferencias afectan al editor y no al diseño guardado ni a la web exportada.

### Colores, modo nocturno y edición desde el lienzo

**Tu negocio** permite definir el color principal, una armonía complementaria/análoga/triádica/monocromática y, opcionalmente, un secundario manual. La paleta modifica fondos, tarjetas, bordes, textos y botones en las tres plantillas. El módulo `app/colors.py` calcula armonías HSL y ajusta los colores de texto con luminancia relativa y una relación mínima de 4,5:1 para los fondos sólidos calculados, según la [referencia de contraste de W3C](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Esto no sustituye una auditoría completa de accesibilidad del contenido final.

El aspecto **Claro/Nocturno** se guarda en el proyecto. Cada módulo dispone de **Colores de este módulo**: seguir la paleta, claro, nocturno, principal, secundario o fondo personalizado. Los colores de texto se ajustan automáticamente. Las imágenes conservan sus colores originales. El sitio exportado incluye un interruptor claro/nocturno; las excepciones de fondo explícitas por módulo se conservan al alternar.

En **Vista previa**, selecciona escritorio, móvil de 390 px o móvil pequeño de 320 px. El interruptor nocturno de esa ventana permite probar ambas versiones sin modificar la configuración guardada. El ancho disponible puede limitar la vista en pantallas más pequeñas.

Al seleccionar o señalar un módulo en el lienzo aparece una barra con asa de arrastre, subir, bajar y eliminar. Arrastra desde el asa para cambiar el orden; funciona con eventos de puntero para mouse y táctil. Las flechas también permiten reordenar y eliminar se puede deshacer. Los controles no se incluyen en la web exportada.

En **Crear con IA**, la foto de referencia puede subirse dentro del mismo diálogo que contiene el prompt. Selecciona **Usar una foto de mi producto**, carga la foto y describe el escenario. La referencia queda separada del contenido visible del módulo hasta aceptar la propuesta. Si el módulo ya tiene una foto propia subida, se usa como referencia inicial. Una vez subida la referencia, se selecciona automáticamente el modo de edición. Kie recibe la foto solo al solicitar la generación; la carga y preparación local no consumen créditos de IA. Revisa que el resultado conserve las características del producto antes de aplicarlo.

1. Abre **Plantillas** y elige **Forma** (tienda), **Estudio** (servicios) o **Impulso** (suscripciones). Se crea un proyecto nuevo y se solicita la información del negocio. El anterior se conserva.
2. Completa nombre, rubro, público, descripción, correo, teléfono y color en **Tu negocio**. Los contenidos de ejemplo se editan por módulo; no se reemplazan automáticamente con estos datos.
3. Busca un módulo en el panel derecho y arrástralo sobre el lienzo. La línea verde señala dónde se insertará. También puedes usar **+**, útil en móvil o con teclado.
4. Haz clic sobre los títulos o textos para editarlos directamente. Selecciona una sección para editarla desde el panel izquierdo. En **Elementos** puedes editar tarjetas, precios, beneficios, imágenes y enlaces; añadir o quitar elementos.
5. Sube imágenes PNG/JPG/WebP de hasta 8 MB. El servidor comprueba su contenido real, elimina metadatos y las convierte a WebP. Las ilustraciones incluidas son ejemplos locales, reemplazables.
6. Reordena las secciones desde la estructura izquierda o arrástralas al lienzo. También hay botones de subir/bajar, duplicar, eliminar y deshacer/rehacer. El guardado automático es en el servidor; «Todo guardado» confirma la persistencia.
7. Usa **Móvil** y **Vista previa** para probar el diseño, carruseles y acordeones. En **Notas para el diseñador** explica los ajustes finales deseados.
8. **Finalizar web** revisa la estructura, recursos y enlaces. Puedes solicitar una revisión editorial de Terra, revisar las propuestas y aplicarlas. Después puedes seguir editando.
9. Descarga la web en ZIP: `index.html`, `site.css`, `site.js`, imágenes locales, `project.json` y un instructivo. El HTML final no incluye controles ni atributos de edición.

El diseño JSON puede importarse desde **Plantillas → Importar diseño JSON**. Para moverlo a otro servidor, también debes migrar las imágenes; el JSON conserva referencias, no los archivos. La forma más completa de respaldar el editor es copiar el volumen de datos.

## Plantillas y módulos limpios

### Fuentes

En **Tu negocio → Fuente del sitio**, selecciona la original de la plantilla, una Google Font (Inter, Roboto, Lato, Montserrat, Poppins, Nunito, Playfair Display o Merriweather), o sube tu archivo TTF/OTF/WOFF/WOFF2 de hasta 2 MB. Guarda para aplicar la fuente a títulos y textos. La selección persiste con el proyecto y puede deshacerse.

Las fuentes propias se validan con FontTools, se convierten a WOFF2, quedan protegidas por cuenta y se incluyen en la carpeta `fonts/` del ZIP. Debes contar con permiso de uso web de la fuente subida. Google Fonts se integra mediante su [API CSS2](https://developers.google.com/fonts/docs/css2), con `display=swap` y pesos 400–700; requiere conexión a Google tanto en el editor como en la web exportada. No consume créditos de IA.

Las tres plantillas HTML de ejemplo están en `plantillas/`. Comparten una hoja CSS y los mismos parciales del servidor; los estilos cambian mediante clases de tema y variables CSS.

- **Forma / tienda:** portada, beneficios, catálogo, carrusel y contacto.
- **Estudio / servicios:** portada, servicios, carrusel, precios, preguntas y contacto.
- **Impulso / suscripciones:** portada, beneficios, planes, preguntas, llamada a la acción y contacto.

El catálogo contiene nueve tipos: portada, carrusel, productos, beneficios, precios, testimonios, preguntas, contacto y llamada a la acción. Cada proyecto admite 30 módulos y cada colección hasta 8 elementos. Las reseñas de ejemplo están identificadas para reemplazarlas por testimonios autorizados.

Los datos pasan por esquemas Pydantic; Jinja escapa el contenido. La IA solo devuelve datos estructurados: nunca HTML, CSS o JavaScript ejecutable. Los mismos componentes generan el lienzo, las páginas de ejemplo y la exportación. Para regenerar los ejemplos:

```powershell
.\.venv\Scripts\python.exe scripts/generar_plantillas.py
```

## Activar Kie

Las imágenes pasan ahora por un **agente de dirección con GPT‑6 Luna y razonamiento alto** antes de enviarse a GPT Image 2.5. Define composición para el módulo y el recorte móvil, analiza la referencia cuando existe y devuelve un prompt estructurado. Al terminar, se guarda la imagen y se coloca automáticamente si el espacio no cambió. Puedes deshacerla. Consulta [el flujo, límites y resultado de la prueba real](docs/agente-imagen.md). La prueba real de esta ampliación se detuvo por HTTP 503 de Luna; no se ha generado una imagen real mediante esta cadena todavía.

Copia `.env.example` a `.env` y completa la clave **solo en tu equipo**:

```dotenv
KIE_API_KEY=tu_clave
AI_ENABLED=true
```

Después aplica la configuración:

```powershell
docker compose up -d --force-recreate
```

No guardes `.env` en Git ni pongas la clave en el navegador. El contenedor recibe los secretos por variables de entorno; en la nube utiliza el gestor de secretos del proveedor.

Integración basada en documentación consultada el **8 de noviembre de 2026**:

| Función | Modelo | Endpoint |
| --- | --- | --- |
| Mejora de un título o descripción | `gpt-6-luna` | `POST /codex/v1/responses` |
| Revisión editorial del sitio | `gpt-6.1-terra` | `POST /codex/v1/responses` |
| Generación de imagen | `gpt-image-2-5-flare-text-to-image` | `POST /api/v1/jobs/createTask` |
| Edición con foto de referencia | `gpt-image-2-5-flare-image-to-image` | `POST /api/v1/jobs/createTask` |
| Seguimiento de imágenes | El taskId persistido | `GET /api/v1/jobs/recordInfo` |

La edición de fotos sube una copia optimizada a `https://kieai.redpandaai.co/api/file-base64-upload` y usa `input_urls`. La interfaz informa de este envío antes de generar. Las imágenes terminadas se descargan a almacenamiento propio; no dependen de enlaces temporales de Kie. Los modelos de texto son configurables desde `.env`.

Fuentes: [Luna](https://docs.kie.ai/market/chat/gpt-6-luna), [Terra](https://docs.kie.ai/market/chat/gpt-6-1-terra), [GPT Image 2.5 creación](https://docs.kie.ai/market/gpt/gpt-image-2-5-flare-text-to-image), [GPT Image 2.5 edición](https://docs.kie.ai/market/gpt/gpt-image-2-5-flare-image-to-image), [carga de archivos](https://docs.kie.ai/file-upload-api/quickstart).

**Estado de validación:** pruebas automatizadas de los contratos con respuestas simuladas; no se han ejecutado generaciones facturables porque no hay una clave configurada. Antes de ofrecer IA pagada a clientes, comprueba con tu cuenta la disponibilidad de modelos, el formato de errores, la duración de tareas y la facturación real. El código solicita `max_output_tokens`; la página de Kie consultada no documenta expresamente ese parámetro. Debes confirmar que tu endpoint lo respeta. El límite interno de solicitudes funciona independientemente de ello.

## Cupos de IA y rentabilidad

Por defecto: 30 créditos internos diarios por cuenta, 60 globales, 15 solicitudes por cuenta y día, pausa de 5 segundos entre solicitudes. Texto: 1 crédito, imagen 1K: 5, revisión editorial: 3. Son unidades de producto, **no créditos de Kie ni dólares**. Se reinician a las 00:00 UTC.

- Reserva atómica en SQLite antes de llamar al proveedor, incluso con solicitudes simultáneas.
- Idempotencia por operación para no repetir una generación con el mismo identificador.
- Sin reintentos automáticos de solicitudes facturables. Los fallos o estados inciertos mantienen la reserva interna; el operador puede revisar la operación antes de compensar cupos.
- Prompts limitados a 1.000 caracteres, salida solicitada de 1.200 tokens, razonamiento bajo y salida JSON validada. Revisión editorial con contexto resumido y un máximo de 6 propuestas por ejecución.
- Imágenes fijadas en 1K y una tarea por solicitud. Las consultas de estado no crean nuevas tareas.
- Registro de tokens y créditos devueltos por el proveedor cuando están disponibles.

Estas medidas acotan uso, pero no garantizan rentabilidad ni un techo exacto de facturación del proveedor. Fija un límite de gasto también en Kie cuando esté disponible, contrasta sus tarifas y define tus planes con el margen real. Ver `docs/costos.md`.

## Cuentas y despliegue en nube

La imagen Docker preconstruida **`modulo-editor:1.1.0` para Linux/AMD64** y el paquete de despliegue están en `entregables/`. Consulta la [guía para Compute Engine, Cloud Run y Heroku](docs/DESPLIEGUE.md). Compute Engine conserva SQLite y archivos en un volumen persistente. Heroku y Cloud Run funcionan como demostración temporal explícita hasta migrar la persistencia.

El modo local sin contraseña se limita a `localhost`/`127.0.0.1` y abre un espacio de desarrollo compartido. Para un servidor configura:

```dotenv
APP_ENV=production
ADMIN_USERNAME=admin
ADMIN_PASSWORD=una_contraseña_unica_de_al_menos_16_caracteres
COOKIE_SECURE=true
ALLOWED_HOSTS=editor.tudominio.cl
REGISTRATION_CODE=un_codigo_de_invitacion_privado
```

La aplicación se niega a iniciar en producción sin contraseña larga y cookie segura. Cada cuenta de cliente tiene proyectos, imágenes y cupo propio. El registro está desactivado si no defines `REGISTRATION_CODE`. Las contraseñas de clientes se guardan con sal aleatoria y PBKDF2-SHA256 de 600.000 iteraciones. La cuenta administradora usa el secreto de entorno. El código de invitación es reutilizable; el techo global de IA limita el gasto agregado.

Instala un proxy HTTPS delante de Uvicorn, mantén el puerto del contenedor sin exposición directa y configura `ALLOWED_HOSTS`. Si el proxy envía cabeceras de protocolo, confía en ellas solo desde la IP de ese proxy (`--forwarded-allow-ips` apropiado). Sin el esquema HTTPS correcto, la comprobación de origen rechazará escrituras. Aplica un límite de cuerpo de 9 MB y límites de peticiones en el proxy. La imagen ya ejecuta un usuario sin privilegios, sistema de archivos de solo lectura, sin capacidades y con volumen de datos separado.

Esta versión usa SQLite y **un solo worker/réplica**. Para escalar a varias réplicas, migra proyectos, usuarios y reservas a PostgreSQL; tareas y bloqueo a una cola duradera; imágenes a un almacén de objetos privado. No compartas SQLite mediante un volumen de red. La recuperación tras un fallo entre el envío a Kie y la recepción del taskId exige revisión del operador: no se vuelve a generar automáticamente.

## Alcance de la revisión y la entrega

Se comprueban anclas internas, identificadores únicos, protocolos de enlaces, imágenes locales y textos alternativos. Los enlaces externos se validan por formato; **no se garantiza su disponibilidad HTTP** ni se visitan destinos arbitrarios desde el servidor. Antes de entregar al negocio, prueba sus enlaces externos en el navegador.

La revisión de Terra mejora títulos y descripciones; la composición y validación técnica son deterministas. Una ejecución propone hasta seis módulos. Las tarjetas, precios, imágenes y enlaces siguen bajo el control explícito del cliente. Las notas largas se resumen por truncamiento para acotar contexto (120 caracteres por módulo; descripción de contexto: 240).

La entrega es un sitio estático para presentación comercial. Los botones de producto y suscripción se conectan al destino elegido; **no incluye cobros, carrito, inventario ni gestión de suscripciones**. El contacto usa correo y teléfono, sin formularios falsos. La función automática completa no forma parte de este alcance.

## Pruebas

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest -q
```

Las pruebas usan almacenamiento temporal y proveedores simulados. Cubren las tres plantillas, edición y persistencia, conflictos de revisión, exportación, escape de contenido, protocolos, imágenes, sesiones, origen, aislamiento entre cuentas, reserva concurrente de cupos, idempotencia, fallos y tareas de imagen. Para estado del contenedor: `docker compose ps`. Salud: `GET /health`. Documentación API en modo local: `/docs`.
