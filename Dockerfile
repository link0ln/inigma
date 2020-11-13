# Dockerfile
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create necessary directories
RUN mkdir -p /app/keys /app/templates /app/static

# Copy application files
COPY main.py .
COPY templates/ ./templates/
COPY static/ ./static/

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER root

# Expose port
EXPOSE 8000

# Run the application
CMD ["python", "main.py"]
