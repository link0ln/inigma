# Stage 1: Compile TailwindCSS
FROM node:20.19-alpine AS css-builder
WORKDIR /build/cloudflare-workers
COPY cloudflare-workers/tailwind.config.js cloudflare-workers/tailwind-input.css ./
COPY cloudflare-workers/package.json ./
COPY templates-modular/ /build/templates-modular/
RUN npm install --ignore-scripts tailwindcss@3.4.17
RUN npx tailwindcss -i tailwind-input.css -o /build/templates-modular/styles/tailwind-compiled.css --minify

# Stage 2: Python application
FROM python:3.11.14-slim

# Set working directory
WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY main.py .
COPY database.py .
COPY --from=css-builder /build/templates-modular/ ./templates-modular/

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8000

# Run the application
CMD ["python", "main.py"]
