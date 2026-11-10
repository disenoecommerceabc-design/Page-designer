# Page Builder

Editor web modular con una portada pública y un espacio de trabajo que requiere iniciar sesión y elegir un plan. Las webs completas y las plantillas personales se guardan por separado. El editor exporta webs estáticas como ZIP.

## Inicio local

Desde la raíz, con Docker y Compose instalados:

```sh
docker compose up -d --build
```

Abre [Page Builder](http://localhost:8088). En Windows también puedes ejecutar `Iniciar Page Builder.bat`. El volumen de Compose conserva los datos. Para habilitar la IA, configura la clave y `AI_ENABLED=true` en tu copia privada de `.env.example`.

El despliegue en Google Cloud Run está preparado para una demo con almacenamiento temporal. La guía también describe la instalación con datos persistentes en Compute Engine. [Guía de despliegue](DESPLIEGUE.md).
