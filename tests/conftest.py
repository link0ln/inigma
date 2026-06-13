import os
import subprocess
import time

import httpx
import pytest

from tests.crypto_client import InigmaCryptoClient


@pytest.fixture(scope="session")
def docker_backend():
    """Start the Python backend via Docker Compose, yield base URL, tear down on exit."""
    tests_dir = os.path.dirname(os.path.abspath(__file__))
    compose_file = os.path.join(tests_dir, "docker-compose.test.yaml")

    compose_cmd = ["docker", "compose", "-f", compose_file, "-p", "inigma-test"]

    subprocess.run([*compose_cmd, "up", "-d", "--build", "app"], check=True)

    test_port = os.environ.get("TEST_PORT", "8000")
    base_url = f"http://localhost:{test_port}"

    for _ in range(60):
        try:
            r = httpx.get(f"{base_url}/health", timeout=1)
            if r.status_code == 200:
                break
        except httpx.HTTPError:
            pass
        time.sleep(0.5)
    else:
        # Dump logs before failing
        subprocess.run([*compose_cmd, "logs", "app"], check=False)
        subprocess.run([*compose_cmd, "down", "-v"], check=False)
        raise RuntimeError("Backend did not become healthy within 30 seconds")

    yield base_url

    subprocess.run([*compose_cmd, "down", "-v"], check=True)


@pytest.fixture(scope="session")
def crypto_client():
    return InigmaCryptoClient()


@pytest.fixture(scope="session")
def http_client(docker_backend):
    with httpx.Client(base_url=docker_backend, timeout=10) as client:
        yield client
