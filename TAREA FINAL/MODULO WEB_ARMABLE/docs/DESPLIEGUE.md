# Módulo 1.1.0 — Paquete Docker para despliegue

El paquete contiene `modulo-editor-1.1.0-linux-amd64.tar.gz`, una imagen Docker ya construida y cargable, con la etiqueta `modulo-editor:1.1.0`. El archivo `.sha256` y el manifiesto JSON identifican exactamente la imagen probada. No se incluyen claves, `.env` activo, proyectos, sesiones ni imágenes de usuarios.

La imagen escucha en `0.0.0.0:$PORT` (8000 si no se indica), ejecuta un solo proceso de Uvicorn y expone `GET /health`. En producción exige contraseña de administrador de al menos 16 caracteres, cookies seguras y HTTPS delante del contenedor. Las peticiones de salud no necesitan sesión ni HTTPS dentro de la red del contenedor.

| Destino | Uso con esta versión | Estado |
| --- | --- | --- |
| Google Cloud Compute Engine | Instalación con persistencia en una VM Linux | Configuración incluida: Docker Compose, volumen y Caddy con HTTPS |
| Google Cloud Run | Demostración temporal, una instancia | Imagen compatible con puerto dinámico; requiere aceptar el almacenamiento temporal |
| Heroku Cedar, stack `container` | Demostración temporal del editor manual | Imagen compatible con puerto dinámico y UID no privilegiado asignado por la plataforma |

La compatibilidad se probó localmente con los contratos de ejecución, sin publicar la aplicación ni crear recursos en cuentas de nube.

## Cargar y comprobar la imagen

Extrae el ZIP y ejecuta en la carpeta extraída:

```sh
docker load --input modulo-editor-1.1.0-linux-amd64.tar.gz
docker image inspect modulo-editor:1.1.0 --format '{{.Os}}/{{.Architecture}}'
docker run --rm --name modulo-release -p 127.0.0.1:18000:8000 -v modulo-release-data:/data modulo-editor:1.1.0
```

Abre `http://localhost:18000` o `http://localhost:18000/health`. Es una prueba local, sin credenciales ni IA, y usa un volumen separado. Para comprobar el archivo antes de cargarlo, en Linux ejecuta `sha256sum -c modulo-editor-1.1.0-linux-amd64.tar.gz.sha256`; en PowerShell, compara `Get-FileHash -Algorithm SHA256 modulo-editor-1.1.0-linux-amd64.tar.gz` con el valor de ese archivo.

## Google Cloud con persistencia: Compute Engine

Usa una VM Linux x86‑64 con Docker Engine y el complemento Compose. Reserva un disco persistente para el almacenamiento de Docker y conserva ese disco si reemplazas la VM. Apunta un nombre DNS propio a la IP externa de la VM. Permite TCP 80 y 443 para Caddy, y restringe SSH a tus accesos autorizados. La app no publica el puerto 8000 al exterior; Caddy termina HTTPS y reenvía las peticiones por la red privada de Compose. Consulta los [requisitos de HTTPS de Caddy](https://caddyserver.com/docs/automatic-https).

1. Copia el ZIP a la VM, extráelo y carga la imagen con `docker load --input modulo-editor-1.1.0-linux-amd64.tar.gz`.
2. Copia `.env.production.example` a `.env.production`. Completa `DOMAIN` con el nombre DNS sin `https://`, `ADMIN_PASSWORD` con una contraseña única y `SESSION_SECRET` con un secreto aleatorio estable. Para generar el secreto, puedes ejecutar `python3 -c 'import secrets; print(secrets.token_hex(32))'` en tu equipo. Protege el archivo privado (por ejemplo, `chmod 600 .env.production`).
3. Inicia el servicio:

```sh
docker compose --env-file .env.production -f deploy/compose.production.yaml up -d
docker compose --env-file .env.production -f deploy/compose.production.yaml ps
```

Abre `https://TU_DOMINIO` e inicia sesión con las credenciales configuradas. Caddy obtiene un certificado automáticamente cuando DNS y los puertos están accesibles. Para revisar la app, abre `https://TU_DOMINIO/health`.

El volumen `modulo-data` conserva proyectos, usuarios, imágenes, fuentes y reservas de IA al recrear el contenedor. Los volúmenes de Caddy conservan certificados. Mantén **una VM y una réplica** de la app; no uses una base SQLite compartida entre varias máquinas. Respalda el volumen (incluidos sus archivos SQLite y recursos) mediante un respaldo consistente, idealmente con el servicio detenido. El volumen sobrevive a `docker compose down`; no uses `down -v` si deseas mantener los datos. La pérdida del disco de la VM requiere restaurar el respaldo.

Para activar Kie posteriormente, configura `KIE_API_KEY` y `AI_ENABLED=true` en tu archivo privado y vuelve a ejecutar `up -d`. Verifica primero disponibilidad de Luna y costos reales. El paquete no activa servicios pagados de IA automáticamente.

## Heroku Cedar: demostración

Necesitas una app **Cedar** con stack `container` y Heroku CLI. El [registro de contenedores de Heroku](https://devcenter.heroku.com/articles/container-registry-and-runtime) acepta la imagen etiquetada como `registry.heroku.com/APP/web`. El sistema de archivos del dyno es temporal y el registro no admite volúmenes persistentes para este tipo de despliegue.

En Config Vars del Dashboard establece:

| Variable | Valor |
| --- | --- |
| `APP_ENV` | `production` |
| `ALLOW_EPHEMERAL_DATA` | `true`, solo aceptando que los datos de demo pueden desaparecer |
| `COOKIE_SECURE` | `true` |
| `ALLOWED_HOSTS` | Host real de la URL Heroku, sin esquema |
| `FORWARDED_ALLOW_IPS` | `*` en este dyno accesible solo por el router de Heroku |
| `ADMIN_USERNAME` | Tu usuario, por ejemplo `admin` |
| `ADMIN_PASSWORD` | Contraseña única de al menos 16 caracteres |
| `SESSION_SECRET` | Secreto aleatorio estable, recomendado 64 caracteres hexadecimales |
| `AI_ENABLED` | `false` para la demo manual |

Heroku asigna `PORT`; no lo fijes. Se escribe bajo `/tmp/modulo-data`, que funciona incluso con el usuario arbitrario del dyno. Usa un único dyno web. Sustituye `TU_APP_CEDAR` y ejecuta desde una terminal compatible con shell:

```sh
APP=TU_APP_CEDAR
heroku login
heroku stack:set container --app "$APP"
heroku container:login
docker load --input modulo-editor-1.1.0-linux-amd64.tar.gz
docker tag modulo-editor:1.1.0 "registry.heroku.com/$APP/web"
docker push "registry.heroku.com/$APP/web"
heroku container:release web --app "$APP"
heroku open --app "$APP"
```

El código fuente también incluye `heroku.yml` si prefieres [construir desde el repositorio](https://devcenter.heroku.com/articles/build-docker-images-heroku-yml). Esta entrega no migra SQLite ni los recursos a servicios externos. Para uso duradero en Heroku, primero migra a PostgreSQL y almacenamiento de objetos. Además, el [límite de espera del router de Heroku](https://devcenter.heroku.com/articles/request-timeout) requiere mover solicitudes largas de IA a una cola antes de activarlas allí.

## Cloud Run: demostración

Necesitas un proyecto de Google Cloud con facturación, Cloud Run, Artifact Registry, un repositorio Docker y permisos para publicar en él. El servicio usa `PORT` asignado por Cloud Run, redirección HTTPS en producción y un directorio temporal. El [contrato de ejecución de Cloud Run](https://docs.cloud.google.com/run/docs/container-contract) indica que el disco local no se conserva al detenerse la instancia. **No montes un bucket Cloud Storage como base SQLite**: [Cloud Storage FUSE no proporciona bloqueo de archivos](https://docs.cloud.google.com/run/docs/configuring/services/cloud-storage-volume-mounts#limitations).

Copia `deploy/cloudrun.env.yaml.example` a `deploy/cloudrun.env.yaml`, completa `ADMIN_PASSWORD` y `SESSION_SECRET` y conserva `AI_ENABLED=false` para la demo. El archivo completado queda privado y excluido del repositorio. Para una instalación definitiva usa [Secret Manager](https://cloud.google.com/run/docs/configuring/services/secrets) para secretos y migra la persistencia antes de ofrecer cuentas duraderas.

Este ejemplo publica la URL del servicio; la aplicación protege los proyectos con su propio inicio de sesión. Sustituye proyecto y repositorio; la región es un ejemplo.

```sh
PROJECT=TU_PROYECTO
REGION=southamerica-west1
REPOSITORY=TU_REPOSITORIO_DOCKER
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/${REPOSITORY}/modulo-editor:1.1.0"

gcloud auth login
gcloud auth configure-docker "${REGION}-docker.pkg.dev"
docker load --input modulo-editor-1.1.0-linux-amd64.tar.gz
docker tag modulo-editor:1.1.0 "$IMAGE"
docker push "$IMAGE"
gcloud run deploy modulo --project "$PROJECT" --region "$REGION" --image "$IMAGE" \
  --port 8080 --max-instances 1 --concurrency 4 --memory 768Mi --timeout 420s \
  --env-vars-file deploy/cloudrun.env.yaml --allow-unauthenticated
```

Tras [desplegar la imagen](https://docs.cloud.google.com/run/docs/deploying), entra por la URL HTTPS que devuelve Cloud Run. El tope de una instancia no hace persistente el disco, y una revisión nueva puede iniciar otra instancia. Para clientes con datos persistentes, usa la configuración de Compute Engine incluida o migra a servicios gestionados antes de usar Cloud Run.

## Reconstrucción desde el código fuente

```sh
docker buildx build --platform linux/amd64 --provenance=false --sbom=false --load -t modulo-editor:1.1.0 .
python scripts/probar-imagen-cloud.py
python scripts/empaquetar-imagen-cloud.py
```

El exportador exige que la imagen coincida con la que pasó las pruebas. Verifica `docker load`, conserva el identificador de la imagen y calcula SHA‑256 del archivo. Solo se incluyeron plantillas de configuración vacías. No publiques una imagen que se haya armado copiando `.env` o el volumen de datos.
