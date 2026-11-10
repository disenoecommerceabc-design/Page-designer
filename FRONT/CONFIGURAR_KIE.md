# Generaciones de Page Builder mediante Kie.ai

## Modelos y funciones

| Función | Modelo predeterminado |
| --- | --- |
| Mejorar títulos y descripciones | gpt-6-luna |
| Preparar prompts, encuadre y texto alternativo de imágenes | gpt-6-luna |
| Revisar títulos y descripciones del sitio | gpt-6-1-terra |
| Crear imágenes | gpt-image-2-5-flare-text-to-image |
| Editar imágenes usando una referencia propia | gpt-image-2-5-flare-image-to-image |

La elección inicial de imagen es Flare a 1K. Se puede seleccionar Sunburst y 2K mediante configuración del servidor. El modelo de texto y el de revisión también se configuran en el servidor. Confirma que los identificadores elegidos estén disponibles en tu cuenta de Kie.ai.

La revisión con Terra propone cambios en títulos y descripciones. El usuario decide si aplicarlos. La imagen terminada se coloca en su módulo solo cuando la imagen anterior sigue siendo la misma. Si el módulo cambió mientras se generaba, Page Builder conserva la edición y guarda la nueva imagen para utilizarla manualmente.

## Activación local

1. Instala las dependencias y prepara la base de datos siguiendo LEEME_PRIMERO.md.
2. Copia .dev.vars.example a .dev.vars en la raíz del proyecto.
3. Sustituye PEGA_TU_CLAVE_KIE por tu clave privada de Kie.ai.
4. Cambia AI_ENABLED a "true".
5. Para probar desde una sesión local de navegador, cambia AI_ALLOW_GUESTS a "true". Esta opción autoriza a esas sesiones a consumir el saldo configurado, dentro de los límites del servidor.
6. Inicia npm run dev o reinicia el proceso si ya estaba abierto.

El archivo .dev.vars debe permanecer en tu equipo y está excluido de Git. La clave nunca se solicita ni se entrega al navegador del visitante. Un saldo insuficiente o un modelo no disponible impiden generar, aunque la interfaz muestre que la conexión está habilitada.

En PowerShell puedes copiar el ejemplo con el siguiente comando.

```powershell
Copy-Item .dev.vars.example .dev.vars
```

## Servidor desplegado

Configura KIE_API_KEY como secreto del Worker y las demás opciones como variables de ejecución. El proveedor de alojamiento debe entregarlas a env, igual que DB y BUCKET. Aplica todas las migraciones de drizzle antes de usar la IA. Esta edición añade builder_ai_operations y conserva las tablas existentes.

AI_ALLOW_GUESTS permanece en false por defecto. La identidad chatgpt: que utiliza el backend debe provenir de la plataforma confiable de alojamiento. Al alojar por tu cuenta, adapta la autenticación y elimina los encabezados de identidad enviados directamente por visitantes. No habilites invitados en un sitio público sin asumir expresamente ese acceso al saldo.

## Límites iniciales configurables

| Variable | Predeterminado |
| --- | --- |
| AI_USER_DAILY_CREDITS | 30 |
| AI_GLOBAL_DAILY_CREDITS | 100 |
| AI_DAILY_REQUESTS | 20 por usuario |
| AI_COOLDOWN_SECONDS | 5 |
| KIE_IMAGE_VARIANT | flare |
| KIE_IMAGE_RESOLUTION | 1K |

Cada propuesta de texto reserva 1 crédito interno, cada revisión reserva 3 y cada generación de imagen reserva 10. La operación de imagen incluye la dirección con Luna y la generación con GPT Image 2.5.

Estos créditos internos sirven para limitar llamadas. No equivalen a dinero ni a créditos de Kie.ai. Las cuotas reinician a las 00:00 UTC y se reservan de forma atómica en la base de datos. Se conservan incluso cuando una llamada falla o queda incierta. El consumo real del proveedor, si viene informado, se registra en la operación. Comprueba el detalle en tu cuenta de Kie.ai antes de fijar precios comerciales.

Este control inicial se aplica por usuario y a todo el servicio. La conexión de estos límites con los planes de pago sigue pendiente.

## Generación de imágenes

El proceso utiliza los siguientes pasos.

1. Luna prepara el prompt y el encuadre.
2. Si hay referencia, el backend verifica que pertenezca al usuario y la sube a Kie.ai.
3. Kie.ai devuelve un identificador de tarea para GPT Image 2.5.
4. El editor consulta su estado con espera progresiva y permite retomarla desde «Consumo y actividad».
5. El backend descarga el resultado a R2, lo registra como recurso del usuario y comprueba si puede colocarlo en el módulo.

La referencia seleccionada y el contexto de generación se envían al proveedor. La interfaz lo informa antes de generar. Kie documenta que sus archivos subidos temporalmente se eliminan tras 24 horas y los resultados generados permanecen disponibles durante 14 días. Page Builder conserva su propia copia del resultado cuando la descarga finaliza.

Esta implementación usa consultas de estado autenticadas. No añade callbacks públicos. Si cierras el editor, la tarea continúa en Kie.ai, pero su descarga y colocación se completan al volver a consultarla desde la actividad.

## Errores y recuperación

Cada solicitud incluye un identificador de operación y una huella del contenido. Repetir el mismo identificador devuelve la operación existente y no crea otra generación. La aplicación no reintenta automáticamente solicitudes pagadas.

Las respuestas HTTP 200 también pueden contener errores de Kie.ai. El backend comprueba el contenido, además del estado HTTP. Las propuestas del modelo se validan antes de mostrarlas o aplicarlas.

Si una solicitud pierde conexión antes de recibir el identificador de tarea, la operación queda incierta y conserva el cupo. Revisa tu cuenta Kie.ai antes de crear una nueva solicitud. Las consultas a una tarea ya identificada se pueden repetir sin crear otra generación.

La lista de descargas permitidas es KIE_ASSET_HOSTS. Los hosts iniciales son file.aiquickdraw.com, static.aiquickdraw.com y tempfile.redpandaai.co. Si Kie devuelve otro host, comprueba que sea legítimo y añade su nombre exacto en el servidor. La aplicación exige HTTPS, comprueba cada redirección, limita el tamaño de descarga a 8 MB y acepta PNG, JPEG o WebP. La clave API no acompaña las descargas de imágenes.

## Verificación del paquete

```sh
npx tsc --noEmit
node scripts/checks/builder.mjs
node scripts/checks/builder-kie.mjs
```

Las pruebas de Kie simulan los endpoints. Cubren texto, revisión, imágenes nuevas, edición con referencia, consultas de tareas, errores de saldo con HTTP 200, timeouts, idempotencia, solicitudes simultáneas, cuotas, aislamiento de usuarios, URLs restringidas y preservación de ediciones posteriores.

El paquete se valida sin una clave real ni consumo de saldo. Antes de utilizarlo comercialmente, realiza una prueba controlada en tu cuenta para comprobar permisos, modelos, parámetros y precios efectivos.

## Documentación consultada

- Luna https://docs.kie.ai/market/chat/gpt-6-luna
- Terra https://docs.kie.ai/market/chat/gpt-6-1-terra
- GPT Image 2.5 Flare, texto a imagen https://docs.kie.ai/43283988e0
- GPT Image 2.5 Flare, imagen a imagen https://docs.kie.ai/43285205e0
- Estado de tareas https://docs.kie.ai/market/common/get-task-detail
- Subida de archivos https://docs.kie.ai/file-upload-api/upload-file-base-64
