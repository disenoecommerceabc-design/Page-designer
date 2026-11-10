# Page Builder integrado

Código fuente de la landing promocional y el constructor web en una misma aplicación.

Commit de origen
`f0489f94526c3dfb6cf67c85d3334c34faea0c96`

## Incluido

Landing con planes previstos, editor en `/builder`, tres plantillas, nueve tipos de módulos, arrastrar y soltar, edición de textos, duplicación, deshacer/rehacer, paletas, modos claro/nocturno, fuentes, imágenes, guardado, vistas previas, revisión de enlaces y exportación ZIP/JSON.

Backend TypeScript, migraciones D1, almacenamiento R2, recursos y pruebas de integración. La aplicación necesita un servidor. Abrir un HTML directamente desde Windows no la ejecuta.

## Inicio local

Instala Node.js 22.13 o posterior y npm. Usa una versión LTS mantenida compatible con el proyecto.

Extrae todo el ZIP y abre PowerShell o una terminal en la carpeta que contiene `package.json`. Ejecuta, uno por uno.

```sh
npm ci --include=dev --include=optional
node scripts/preparar-local.mjs
npm run dev
```

La preparación compila y aplica las migraciones a una base local. Puede repetirse sin volver a aplicar migraciones registradas. D1 y R2 se simulan localmente y no requieren contratar servicios para probar el paquete.

Abre la URL indicada por la terminal, normalmente `http://localhost:5173`.
Landing en `/`. Constructor en `/builder`.
Mantén la terminal abierta. Detén el servidor con Ctrl+C.

Los datos locales se guardan en `.wrangler/state`. Eliminar esa carpeta elimina tus proyectos y archivos locales. El paquete inicia una base vacía y no incluye datos privados del sitio publicado.

La instalación de dependencias y las fuentes de Google requieren internet. Las fuentes propias necesitan permiso de uso web.

## Verificación

Después de instalar las dependencias, ejecuta lo siguiente.

```sh
npx tsc --noEmit
node scripts/checks/builder.mjs
node scripts/checks/builder-kie.mjs
```

Las pruebas comprueban plantillas, renderizado, persistencia, conflictos de guardado, separación de usuarios, exportación con imágenes, validación de entradas y sesiones.

## Proyectos del prototipo original

Importa la estructura desde «Plantillas», «Importar diseño JSON». Vuelve a subir sus imágenes y fuentes propias. «Finalizar web» permite exportar el sitio y su diseño editable.

El backend Python del prototipo se adaptó a TypeScript para el entorno del sitio integrado. Este paquete contiene esa versión integrada.

## Despliegue

Se conserva la configuración del Site de origen en `.openai/hosting.json`. El ID identifica el proyecto y no constituye una credencial. Para actualizar ese Site se utiliza su flujo de repositorio, compilación y publicación.

El despliegue independiente requiere Cloudflare Workers, D1 y R2 o una adaptación equivalente. Crea recursos en tu cuenta, configura los enlaces `DB` y `BUCKET`, aplica las migraciones de `drizzle/` y configura el despliegue para tu entorno. `npm run build` genera el Worker en `dist/server` y los recursos del cliente. El README técnico original detalla la arquitectura.

El acceso privado y la autenticación de ChatGPT del Site publicado pertenecen a su plataforma de alojamiento. Para desplegar fuera de ella, configura autenticación confiable y elimina o reemplaza los encabezados `oai-authenticated-user-*` enviados por visitantes. El backend confía en la identidad que inyecta la plataforma original. La emulación local de inicio de sesión sirve únicamente para desarrollo.

## Pendiente en esta versión

La conexión con Kie.ai está implementada. Para activarla, sigue CONFIGURAR_KIE.md. La generación permanece desactivada hasta configurar una clave válida, habilitar AI_ENABLED y autorizar el acceso al espacio. Las pruebas incluidas usan respuestas simuladas y no consumen créditos.

Los pagos, suscripciones, límites comerciales por plan, dominios de clientes, publicación gestionada y formularios de los sitios generados siguen pendientes. Los módulos de productos y planes enlazan a canales de contacto. La landing sí incluye su formulario de interesados.

El ZIP contiene el código y los recursos del proyecto. `npm ci` instala las dependencias fijadas en `package-lock.json`. Se conservan los avisos de terceros. Las claves privadas, datos del servicio alojado, historial Git y dependencias instaladas quedan fuera de la distribución.

## Actualización Kie.ai

Este paquete incorpora Luna para textos y dirección de imágenes, Terra para revisión de contenido y GPT Image 2.5 para generación y edición de imágenes. Incluye una nueva migración de operaciones de IA. Las instrucciones de configuración, límites y recuperación están en CONFIGURAR_KIE.md. Los datos locales de una instalación anterior se conservan al mantener .wrangler/state y aplicar las migraciones pendientes.
