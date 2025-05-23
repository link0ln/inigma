# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV APP_HOME /app

# Set the working directory in the container
WORKDIR $APP_HOME

# Create a non-root user and group
# Ensure these UIDs/GIDs don't clash if running in environments like OpenShift that have restrictions
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Copy the dependencies file to the working directory
COPY requirements.txt .

# Install any needed dependencies specified in requirements.txt
# Using --no-cache-dir is good practice for image size
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code into the container
# This copies the 'app' directory from the repo root to '/app/app' inside the container
COPY ./app $APP_HOME/app

# Change ownership of the app directory and switch to the non-root user
# This ensures the application runs as non-root
RUN chown -R appuser:appuser $APP_HOME
USER appuser

# Expose the port the app runs on (should match the CMD)
EXPOSE 8000

# Define the command to run the application
# Uvicorn is the ASGI server for FastAPI
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
