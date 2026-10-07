"""Runtime settings. Every value can be overridden with an ORACLE_* environment variable or a .env file."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="ORACLE_", env_file=".env", extra="ignore")

    # SQLite by default; any SQLAlchemy URL works (e.g. Azure SQL or Postgres) once the driver is installed.
    database_url: str = "sqlite:///./oracle.db"
    # Origins allowed to call the API directly from a browser. The Next.js app proxies /api, so it needs none.
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    # Load the synthetic Store 03 records into an empty database on startup.
    seed_on_startup: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
