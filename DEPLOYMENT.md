# Local container deployment

The Compose stack serves the Vite build through Nginx at `http://localhost:8080`. Nginx forwards `/api/` requests to the `backend` Compose service without changing their paths. PostgreSQL is reachable only on the private Compose network.

## Local configuration

The root `.env` is ignored by Git and is not copied into either image. Preserve existing local settings. Add the Compose variables `POSTGRES_PASSWORD` and `JWT_SECRET_KEY` to that file if they are not already present, or export them in the shell before invoking Compose. Use a long random JWT secret and a URL-safe database password (letters, numbers, underscore, or hyphen). The Compose backend receives a database URL using the service hostname `postgres`; a host-run backend continues to use its local `DATABASE_URL` setting.

`POSTGRES_PASSWORD` is used when PostgreSQL initializes a new data directory. Changing this variable does not change credentials inside an existing database volume. If a volume already exists, set the variable to the password that volume already uses; do not remove the volume or run a password reset as part of deployment setup.

## Build, migrate, and start

Build and start services after configuring the required variables:

```sh
docker compose build
docker compose up -d postgres
docker compose run --rm backend alembic -c alembic.ini upgrade head
docker compose up -d
docker compose ps
```

Migrations are a one-time operator action for a deployment/release, not part of backend startup. Before applying migrations to data that matters, take and verify a database backup and review the Alembic revisions. `alembic upgrade head` applies only pending revisions; never use `downgrade`, recreate the volume, or reset database credentials as a routine deployment step.

Check the frontend at `http://localhost:8080` and the API health endpoint through `http://localhost:8080/health`. Protected employee-list requests require a valid bearer token.
