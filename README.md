# Inigma Next

Inigma Next is a secure secret sharing application built with FastAPI and modern Python technologies. This project is a revamp of the original Inigma application, focusing on a more robust and maintainable architecture.

## Project Overview

The goal of Inigma Next is to provide a secure platform for users to share sensitive information with end-to-end encryption.

## Tech Stack

*   **Backend:** FastAPI, Python 3.9+
*   **Database:** PostgreSQL (planned, initially SQLite for development)
*   **ORM:** SQLModel (which combines SQLAlchemy and Pydantic)
*   **Migrations:** Alembic
*   **Frontend:** (To be determined - likely a modern JavaScript framework like Vue.js or React, served via FastAPI templating or as a separate SPA)
*   **Containerization:** Docker
*   **Deployment:** Kubernetes (via Helm charts)

## Directory Structure

```
.
├── app/                    # Main application code
│   ├── api/                # API endpoint definitions
│   │   ├── __init__.py
│   │   └── endpoints.py    # Example API routes
│   ├── core/               # Core application logic, config, etc.
│   │   ├── __init__.py
│   │   └── config.py       # Application settings
│   ├── models/             # Pydantic models / SQLModel DB models
│   │   └── __init__.py
│   ├── services/           # Business logic services
│   │   └── __init__.py
│   ├── static/             # Static files (CSS, JS, images)
│   │   └── .gitkeep
│   ├── templates/          # Jinja2 HTML templates
│   │   └── .gitkeep
│   └── main.py             # FastAPI application entry point
├── helm/                   # Helm chart for Kubernetes deployment
│   ├── Chart.yaml
│   ├── templates/
│   └── values.yaml
├── .github/                # GitHub specific files (e.g., workflows)
│   └── workflows/
│       └── main.yml        # CI/CD pipeline
├── .gitignore              # Files and directories to ignore in git
├── Dockerfile              # Docker configuration for building the application image
├── README.md               # This file
└── requirements.txt        # Python package dependencies
```

## Getting Started (Development)

1.  **Clone the repository:**
    ```bash
    git clone <repository_url>
    cd inigma-next
    ```

2.  **Create and activate a virtual environment:**
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```

3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Set up environment variables:**
    *   Create a `.env` file in the root directory (this is ignored by git).
    *   Add necessary configurations, for example:
        ```env
        DATABASE_URL="sqlite:///./inigma_next.db"
        # For PostgreSQL (example):
        # DATABASE_URL="postgresql://user:password@host:port/dbname"
        ```

5.  **Run database migrations (if applicable):**
    ```bash
    # Assuming Alembic is configured
    # alembic upgrade head
    ```

6.  **Run the development server:**
    ```bash
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
    ```
    The application should now be accessible at `http://localhost:8000`.

## Docker

To build and run the application using Docker:

1.  **Build the Docker image:**
    ```bash
    docker build -t inigma-next .
    ```

2.  **Run the Docker container:**
    ```bash
    docker run -d -p 8000:80 --name inigma-app inigma-next
    ```
    The application will be accessible at `http://localhost:8000` (or port 80 if you map it directly in the `Dockerfile` and `docker run` command).

## Helm (Kubernetes)

The `helm/` directory contains charts for deploying to Kubernetes. This will be updated as the project progresses.

## Contributing

Contributions are welcome! Please follow standard practices like creating feature branches, writing tests, and submitting pull requests.

(Further details on contribution guidelines, code style, and testing will be added.)

## License

This project is licensed under the MIT License - see the `LICENSE` file for details (To be added).
```
