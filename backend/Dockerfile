# syntax=docker/dockerfile:1

# Python 3.12 is pinned by the team (see design.md, "Stack").
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app

WORKDIR /app

# Dependencies are declared in pyproject.toml (work unit 3.2), application and development
# alike. The project is installed in editable mode so the source that docker-compose.yml
# bind-mounts at /app is the code that actually runs.
#
# The copy order matters: pyproject.toml and the package must be present before the
# editable install, otherwise the build backend has nothing to discover.
COPY pyproject.toml ./
COPY app ./app
RUN pip install -e ".[dev]"

# The application source itself arrives through the bind mount declared in
# docker-compose.yml. Nothing else is copied on purpose: alembic.ini, the migrations and
# the test package land in work unit 4 and in work unit 3 respectively.
EXPOSE 8000

# --reload watches the working directory, so a change on the host is picked up without
# restarting the environment.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]