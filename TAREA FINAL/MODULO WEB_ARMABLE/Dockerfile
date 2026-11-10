FROM python:3.14-slim@sha256:9aaa474097d094040649f2162a627c0049b408f52138d980916788d80f04802f
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 MODULO_CONTAINER=1 PORT=8000
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && useradd --create-home --uid 10001 editor && mkdir /data && chown editor:editor /data
COPY --chown=editor:editor app ./app
USER editor
LABEL org.opencontainers.image.title="Modulo Editor" org.opencontainers.image.version="1.1.0" org.opencontainers.image.description="FastAPI modular website editor; configurable PORT; persistent-volume deployment or explicit ephemeral demo."
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD ["python", "-m", "app.healthcheck"]
CMD ["python", "-m", "app.serve"]
