import os

from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from app.core.config import settings


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
        missing = [
            name for name, value in (
                ("MYSQL_PORT", settings.MYSQL_PORT),
                ("MYSQL_USER", settings.MYSQL_USER),
                ("MYSQL_PASSWORD", settings.MYSQL_PASSWORD),
                ("MYSQL_DATABASE", settings.MYSQL_DATABASE),
                ("MYSQL_SSL_CA", settings.MYSQL_SSL_CA),
            ) if not value
        ]
        if missing:
            # Names only — never the values.
            raise RuntimeError(
                "MySQL is configured (MYSQL_HOST is set) but these required "
                f"environment variables are missing: {', '.join(missing)}"
            )

        ca_path = os.path.abspath(os.path.expanduser(settings.MYSQL_SSL_CA or ""))
        if not os.path.isfile(ca_path):
            raise RuntimeError(
                "MYSQL_SSL_CA does not point to a readable CA certificate file. "
                "Download the Aiven service CA certificate (ca.pem) from the "
                "service Overview page and set MYSQL_SSL_CA to its path. "
                "TLS verification will not be disabled as a workaround."
            )

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
