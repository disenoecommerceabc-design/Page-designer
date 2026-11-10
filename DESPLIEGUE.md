# Page Builder 1.3.5

La imagen integrada sirve la landing de `FRONT` en `/` y el editor del módulo FastAPI en `/builder`. Ambos usan el mismo origen. FastAPI también atiende el formulario de interés y guarda los registros en la misma base SQLite que los proyectos. Uvicorn escucha en `0.0.0.0:$PORT` y expone `GET /health`. Node se utiliza durante la compilación de la landing.

## Docker local

En Windows, haz doble clic en `Iniciar Page Builder.bat` en la raíz del proyecto. El lanzador usa Docker Desktop, carga la imagen incluida si hace falta y abre el editor cuando está listo. Usa `--sin-navegador` para iniciarlo desde una terminal sin abrir una pestaña.

Para compilar y levantar el servicio manualmente, ejecuta desde la raíz del proyecto.

```powershell
docker compose up -d --build
docker compose ps
```

Abre [la landing local](http://localhost:8088) o [el editor](http://localhost:8088/builder). El volumen `builder-data` mantiene los proyectos, las imágenes, las fuentes y el registro de interés. Para configurar la IA, copia `.env.example` a `.env`, completa `KIE_API_KEY` y establece `AI_ENABLED=true`. La imagen se puede cargar en otro equipo con `docker load -i page-builder-1.3.5-linux-amd64.tar`.

Si Kie.ai limita las solicitudes de Luna, puedes seleccionar Terra para textos y dirección de imágenes con `KIE_TEXT_MODEL=gpt-6.1-terra` y `KIE_IMAGE_DIRECTOR_MODEL=gpt-6.1-terra` en `.env`. Vuelve a ejecutar el lanzador para aplicar la configuración.

El editor requiere una cuenta con plan seleccionado. Si configuras `REGISTRATION_CODE`, el registro pide también una invitación. Los pagos y la verificación por correo siguen pendientes. Para acceder a los proyectos del antiguo espacio local compartido, configura `ADMIN_PASSWORD` e inicia sesión como `admin`.

Cada proyecto corresponde a una página. Crear desde una base, reutilizar una plantilla o importar un JSON consume una página. Las páginas y los créditos se renuevan el día 1 del mes en UTC. El límite de plantillas corresponde al total guardado. Cambiar de plan conserva el consumo y los archivos. Las solicitudes de IA también están sujetas al límite diario de solicitudes por cuenta y al límite global de créditos.

Para reconstruir la imagen Linux/AMD64 y probar el contrato de ejecución localmente, instala primero `requirements-dev.txt` del módulo en un entorno Python y ejecuta desde la raíz del proyecto.

```powershell
docker buildx build --platform linux/amd64 --provenance=false --sbom=false --load -t page-builder:1.3.5 .
python 'TAREA FINAL/MODULO WEB_ARMABLE/scripts/probar-imagen-cloud.py' --image page-builder:1.3.5 --integrated --output validacion-docker.json
```

La versión Cloudflare de `FRONT` conserva sus comandos y sus datos D1/R2. El contenedor integrado usa las cuentas y los datos SQLite del módulo. Para trasladar un diseño de Cloudflare, expórtalo como JSON, impórtalo en el editor y vuelve a subir las imágenes y fuentes propias. Si vas a trasladar una instalación del módulo FastAPI, respalda su directorio de datos con el servicio detenido y restaura una copia en el volumen del nuevo servicio antes de iniciarlo.

## Google Cloud Run

### Desde GitHub con Cloud Build

Selecciona la rama que quieres desplegar y usa `/Dockerfile` (el de la raíz del repositorio). La imagen de la raíz incluye la landing y el editor; `FRONT` por sí solo no construye esa imagen. En Cloud Run, deja vacíos los campos de comando y argumentos del contenedor para usar `python -m app.serve`, y deja el puerto del contenedor en `8080`. Cloud Run inyecta `PORT`; no lo agregues como variable manual.

Antes de implementar la revisión, agrega en **Variables y secretos** los valores de [`cloudrun.env.yaml.example`](cloudrun.env.yaml.example). Para una demo, `ALLOW_EPHEMERAL_DATA=true` autoriza el uso de almacenamiento temporal. Vincula también los siguientes secretos como variables de entorno:

| Variable | Secreto de ejemplo | Requisito |
| --- | --- | --- |
| `ADMIN_PASSWORD` | `page-builder-admin-password` | Contraseña de al menos 16 caracteres |
| `SESSION_SECRET` | `page-builder-session-secret` | Valor aleatorio estable de al menos 32 caracteres |

Da a la cuenta de servicio que **ejecuta la revisión** el rol `roles/secretmanager.secretAccessor` sobre ambos secretos. El archivo de ejemplo no se aplica automáticamente al compilar desde GitHub. [Despliegue continuo](https://docs.cloud.google.com/run/docs/continuous-deployment) · [Configurar secretos](https://docs.cloud.google.com/run/docs/configuring/services/secrets).

Para usar Kie.ai, crea un secreto `page-builder-kie-api-key` con tu clave de Kie.ai y da a la misma cuenta de servicio acceso de lectura a ese secreto. En Cloud Run, vincúlalo como variable `KIE_API_KEY` y cambia `AI_ENABLED` a `true`. Mantén tu `.env` fuera de Git: Docker Compose lo usa en local, pero Cloud Run recibe la clave desde Secret Manager al arrancar. Si no necesitas IA, deja `AI_ENABLED=false`; la clave de Kie.ai no es necesaria para el arranque.

Si Cloud Run indica que el contenedor no escuchó en `PORT=8080`, abre los logs de la revisión y busca el primer error del contenedor en `stderr`. Si falta la autorización de almacenamiento temporal, un secreto válido o `COOKIE_SECURE=true`, la aplicación se cierra antes de escuchar; ampliar el tiempo de inicio no corrige esa configuración. Si usas una sonda HTTP de inicio, configura `GET /health` en el puerto `8080`.

### Desde una imagen de Artifact Registry

Se necesita un proyecto, un repositorio Docker en Artifact Registry y una cuenta de servicio de Cloud Run con acceso a los secretos. Habilita Cloud Run, Artifact Registry y Secret Manager en tu proyecto. Crea `page-builder-admin-password` con una contraseña de al menos 16 caracteres y `page-builder-session-secret` con un valor aleatorio estable de al menos 32 caracteres. Para habilitar Kie.ai, crea también `page-builder-kie-api-key` en Secret Manager y cambia `AI_ENABLED` a `"true"` en una copia privada de `cloudrun.env.yaml.example`.

Ejecuta desde la raíz del repositorio en Bash. Sustituye el proyecto, el repositorio de Artifact Registry y la cuenta de servicio. Concede a esa cuenta acceso de lectura a los secretos requeridos.

```bash
export PROJECT_ID=TU_PROYECTO
export REGION=southamerica-west1
export SERVICE_ACCOUNT=CUENTA_DE_SERVICIO@TU_PROYECTO.iam.gserviceaccount.com
REPOSITORY=TU_REPOSITORIO
export IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/page-builder:1.3.5"

gcloud auth configure-docker "$REGION-docker.pkg.dev"
docker tag page-builder:1.3.5 "$IMAGE"
docker push "$IMAGE"
cp cloudrun.env.yaml.example cloudrun.env.yaml
bash scripts/deploy-cloudrun.sh
```

El script deja el servicio privado, comprueba el inicio en `/health` y usa `cloudrun.env.yaml` para la demo. Puedes pasar otro archivo mediante `ENV_FILE` y elegir los nombres o versiones de los secretos mediante `SECRETS`. Si activas la IA, agrega `KIE_API_KEY=page-builder-kie-api-key:1` al conjunto de secretos.

Mantén el acceso de Cloud Run privado para una prueba interna. Si la landing debe ser pública, habilita el acceso sin autenticación de Cloud Run. El editor conserva su propio inicio de sesión. Para un dominio personalizado, configura `ALLOWED_HOSTS` con el host correspondiente. Puedes usar `/health` como ruta de sonda HTTP. [Contrato del contenedor](https://docs.cloud.google.com/run/docs/container-contract) · [Secret Manager en Cloud Run](https://docs.cloud.google.com/run/docs/configuring/services/secrets).

## Heroku Cedar

Usa una app Cedar con stack `container` y un dyno `web`. Establece las siguientes Config Vars desde el panel. Heroku asigna `PORT`.

| Variable | Valor |
| --- | --- |
| `APP_ENV` | `production` |
| `ALLOW_EPHEMERAL_DATA` | `true` para una demo temporal |
| `COOKIE_SECURE` | `true` |
| `ALLOWED_HOSTS` | Host de la URL de tu app, sin `https://` |
| `FORWARDED_ALLOW_IPS` | `*` detrás del router de Heroku |
| `ADMIN_USERNAME` | `admin` o el usuario elegido |
| `ADMIN_PASSWORD` | Contraseña de 16 caracteres como mínimo |
| `SESSION_SECRET` | Secreto aleatorio estable de 32 caracteres como mínimo |
| `AI_ENABLED` | `false` |

```bash
APP=TU_APP_CEDAR
heroku stack:set container --app "$APP"
heroku container:login
docker tag page-builder:1.3.5 "registry.heroku.com/$APP/web"
docker push "registry.heroku.com/$APP/web"
heroku container:release web --app "$APP"
```

La IA se deja desactivada en Heroku porque las solicitudes al proveedor pueden superar el límite de 30 segundos del router. Para habilitarla allí, las tareas largas requieren una cola y un proceso de trabajo. [Registro de contenedores](https://devcenter.heroku.com/articles/container-registry-and-runtime) · [Tiempo límite del router](https://devcenter.heroku.com/articles/request-timeout).

## Persistencia

Cloud Run y Heroku usan almacenamiento temporal para esta imagen. Las cuentas, las webs, las plantillas, los recursos y los registros de interés se pueden perder al reemplazar una instancia. Para una instalación duradera, usa una VM de Google Compute Engine con un volumen persistente en `/data` y una sola réplica. El [manual del módulo](TAREA%20FINAL/MODULO%20WEB_ARMABLE/docs/DESPLIEGUE.md) incluye la configuración con Caddy y HTTPS. En su Compose de producción, selecciona `page-builder:1.3.5` mediante `MODULO_IMAGE` para servir también la landing. Para persistencia en plataformas administradas, migra SQLite y los archivos a servicios duraderos antes de ofrecer acceso a usuarios.
