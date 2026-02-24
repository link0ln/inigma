# Stage 1: Compile TailwindCSS
FROM node:20.19-alpine AS css-builder
WORKDIR /build/cloudflare-workers
COPY cloudflare-workers/tailwind.config.js cloudflare-workers/tailwind-input.css ./
COPY cloudflare-workers/package.json ./
COPY templates-modular/ /build/templates-modular/
RUN npm install --ignore-scripts tailwindcss@3.4.17
RUN npx tailwindcss -i tailwind-input.css -o /build/templates-modular/styles/tailwind-compiled.css --minify

# Stage 2: Build Python dependencies and prepare app layout
FROM python:3.11.14-slim AS python-builder
WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --target=/build/site-packages -r requirements.txt
# Pre-create the data directory for SQLite (nonroot uid=65534 needs write access)
RUN mkdir -p /build/app/data && chown -R 65534:65534 /build/app/data

# Stage 3: Distroless runtime — no shell, no package manager, no coreutils
FROM gcr.io/distroless/python3-debian12:nonroot

# Copy Python dependencies
COPY --chown=nonroot:nonroot --from=python-builder /build/site-packages /app/site-packages

# Copy application files
COPY --chown=nonroot:nonroot main.py /app/
COPY --chown=nonroot:nonroot database.py /app/
COPY --chown=nonroot:nonroot --from=css-builder /build/templates-modular/ /app/templates-modular/

# Copy pre-created writable data directory for SQLite
COPY --chown=nonroot:nonroot --from=python-builder /build/app/data/ /app/data/

WORKDIR /app
ENV PYTHONPATH=/app/site-packages
ENV PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

ENTRYPOINT ["python3", "main.py"]
