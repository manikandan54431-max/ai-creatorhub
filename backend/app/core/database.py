import os
import tempfile

from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from app.core.config import settings


def _resolve_ca_path() -> str:
    """Return a filesystem path to the Aiven CA certificate.

    Two ways to supply it, path wins only when content is absent:
      1. MYSQL_SSL_CA_CONTENT — the PEM text itself (for hosts like Render where
         a cert file cannot be committed). Written to a temp file at startup.
      2. MYSQL_SSL_CA — a path to an existing ca.pem on disk (local dev).

    TLS verification is never disabled; a missing/empty cert raises.
    """
    content = (settings.MYSQL_SSL_CA_CONTENT or "").strip()
    if content:
        ca_path = os.path.join(tempfile.gettempdir(), "aiven-ca.pem")
        # Overwrite each boot so a rotated cert in the env var takes effect.
        with open(ca_path, "w", encoding="utf-8") as fh:
            fh.write(content + "\n")
        return ca_path

    ca_path = os.path.abspath(os.path.expanduser(settings.MYSQL_SSL_CA or ""))
    if not os.path.isfile(ca_path):
        raise RuntimeError(
            "No Aiven CA certificate available. Set MYSQL_SSL_CA to a readable "
            "ca.pem path, or paste the certificate text into MYSQL_SSL_CA_CONTENT. "
            "TLS verification will not be disabled as a workaround."
        )
    return ca_path


def _build_engine():
    """Build the SQLAlchemy engine.

    Priority:
      1. Aiven MySQL over verified TLS, when MYSQL_HOST is configured.
      2. Otherwise the existing DATABASE_URL behaviour (SQLite default).

    Credentials are read only from the environment-backed ``settings``. The
    connection URL and password are never placed in a loggable string: the URL
    is assembled with ``URL.create`` (which keeps the password in a structured
    object, URL-encoding special characters) and we never str() it.
    """
    if settings.MYSQL_HOST:
        # The CA may be supplied either as a path (MYSQL_SSL_CA) or as PEM text
        # (MYSQL_SSL_CA_CONTENT); require at least one of them, not the path.
        has_ca = bool((settings.MYSQL_SSL_CA_CONTENT or "").strip()) or bool(settings.MYSQL_SSL_CA)
        missing = [
            name for name, value in (
                ("MYSQL_PORT", settings.MYSQL_PORT),
                ("MYSQL_USER", settings.MYSQL_USER),
                ("MYSQL_PASSWORD", settings.MYSQL_PASSWORD),
                ("MYSQL_DATABASE", settings.MYSQL_DATABASE),
                ("MYSQL_SSL_CA or MYSQL_SSL_CA_CONTENT", has_ca),
            ) if not value
        ]
        if missing:
            # Names only — never the values.
            raise RuntimeError(
                "MySQL is configured (MYSQL_HOST is set) but these required "
                f"environment variables are missing: {', '.join(missing)}"
            )

        ca_path = _resolve_ca_path()

        url = URL.create(
            drivername="mysql+pymysql",
            username=settings.MYSQL_USER,
            password=settings.MYSQL_PASSWORD,
            host=settings.MYSQL_HOST,
            port=settings.MYSQL_PORT,
            database=settings.MYSQL_DATABASE,
        )

        # PyMySQL has no "ssl-mode" parameter. Supplying the CA path via the
        # "ssl" dict makes PyMySQL require a valid server certificate chained to
        # this CA (CERT_REQUIRED) AND verify the hostname by default. We do not
        # set check_hostname=False and do not disable verification.
        connect_args = {"ssl": {"ca": ca_path}}

        return create_engine(
            url,
            connect_args=connect_args,
            pool_pre_ping=True,   # recycle connections dropped by Aiven idle timeout
            pool_recycle=280,
        )

    if settings.DATABASE_URL.startswith("sqlite"):
        return create_engine(
            settings.DATABASE_URL, connect_args={"check_same_thread": False}
        )

    return create_engine(settings.DATABASE_URL)


engine = _build_engine()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def safe_db_descriptor() -> str:
    """A log/display-safe description of the DB target: dialect + host/db only.

    Never includes username or password.
    """
    if settings.MYSQL_HOST:
        return f"mysql @ {settings.MYSQL_HOST}:{settings.MYSQL_PORT}/{settings.MYSQL_DATABASE}"
    if settings.DATABASE_URL.startswith("sqlite"):
        return settings.DATABASE_URL  # sqlite URLs carry no credentials
    # For any other URL, strip anything before '@' so credentials never leak.
    return settings.DATABASE_URL.split("@")[-1]


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
