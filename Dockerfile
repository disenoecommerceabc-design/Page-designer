FROM node:22-bookworm-slim@sha256:5ec23b7c622b00547753bc6ffd78085dd868a68aeb41c8e0a1418f033e13d96d AS landing
WORKDIR /build/FRONT
COPY FRONT/package.json FRONT/package-lock.json FRONT/.npmrc ./
RUN npm ci --include=dev --include=optional --no-audit --no-fund
COPY FRONT/landing ./landing
COPY FRONT/app/page.tsx FRONT/app/globals.css ./app/
COPY FRONT/public/favicon.svg ./public/favicon.svg
RUN npm run build:landing

FROM python:3.14-slim@sha256:9aaa474097d094040649f2162a627c0049b408f52138d980916788d80f04802f
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 MODULO_CONTAINER=1 PORT=8000
WORKDIR /app
COPY ["TAREA FINAL/MODULO WEB_ARMABLE/requirements.txt", "./"]
RUN pip install --no-cache-dir -r requirements.txt \
    && useradd --create-home --uid 10001 editor \
    && install -d -o editor -g editor /data
COPY ["TAREA FINAL/MODULO WEB_ARMABLE/app", "./app"]
COPY --from=landing ["/build/TAREA FINAL/MODULO WEB_ARMABLE/app/landing_dist", "./app/landing_dist"]
USER editor
LABEL org.opencontainers.image.title="Page Builder" org.opencontainers.image.version="1.3.5"
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD ["python", "-m", "app.healthcheck"]
CMD ["python", "-m", "app.serve"]
