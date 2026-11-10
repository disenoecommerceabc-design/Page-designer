# Page Designer en Cloud Run

Esta carpeta contiene el código necesario para construir la landing y el editor con el Dockerfile de la raíz. Se puede usar como raíz de un repositorio. Cloud Run asigna `PORT` y el servidor escucha en `0.0.0.0`. El puerto por defecto de esta imagen es 8080 y la comprobación de arranque usa `/health`.

1. En el proyecto `page-designer-514313`, crea o reutiliza en Secret Manager `page-builder-admin-password` (mínimo 16 caracteres) y `page-builder-session-secret` (mínimo 32 caracteres aleatorios, con un valor estable entre revisiones). Concede a la cuenta de servicio de **Cloud Run** acceso a esos dos secretos. El script usa sus versiones `1` por defecto. Si ya usas otros nombres o versiones, indica las referencias con `ADMIN_SECRET_REF` y `SESSION_SECRET_REF`, en formato `nombre:versión`.
2. Abre Cloud Shell con esta carpeta como directorio de trabajo. Consulta la región del servicio existente con `gcloud run services list --project=page-designer-514313`.
3. Sustituye `REGION_DEL_SERVICIO` por esa región y ejecuta:

   ```bash
   REGION=REGION_DEL_SERVICIO bash deploy-cloudrun.sh
   ```

Cloud Build construye la imagen desde esta carpeta. El script actualiza el servicio `pagedesigner`, restablece el comando y los argumentos al valor del Dockerfile y vincula los secretos. Si usas despliegue continuo desde GitHub, pon esta carpeta en la raíz del repositorio y elige su `/Dockerfile` en el activador. Configura en Cloud Run los mismos valores del script para la primera revisión.

Este despliegue es para una demo: las cuentas, los proyectos y los archivos se guardan en el disco temporal de la instancia. La IA empieza desactivada. Para activarla, vincula `KIE_API_KEY` desde Secret Manager y configura `AI_ENABLED=true`.

Si falla la compilación, revisa el primer error en Cloud Build. Si la compilación termina y falla la revisión, revisa el primer error de `stderr` en los logs de Cloud Run. Un fallo al cargar los secretos o validar la configuración puede ocurrir antes de que el servidor abra el puerto.
