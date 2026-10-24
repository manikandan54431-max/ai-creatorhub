from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./creatorhub.db"

    # ── Aiven MySQL (optional) ────────────────────────────────────────────────
    # When MYSQL_HOST is set, the app connects to MySQL over verified TLS using
    # these discrete values instead of DATABASE_URL. Each is read from the
    # backend environment only; never hard-code or log them. Username and
    # database are independent values (Aiven's default database is "defaultdb",
    # which is NOT the same as the connecting user) — do not assume they match.
    MYSQL_HOST: Optional[str] = None
    MYSQL_PORT: Optional[int] = None          # Aiven assigns a non-default port
    MYSQL_USER: Optional[str] = None
    MYSQL_PASSWORD: Optional[str] = None
    MYSQL_DATABASE: Optional[str] = None
    MYSQL_SSL_CA: Optional[str] = None        # filesystem path to the Aiven CA (ca.pem)
    # Alternative to MYSQL_SSL_CA for hosts where you cannot commit a cert file
    # (e.g. Render). Paste the full PEM text of the Aiven CA into this env var;
    # at startup the app writes it to a temp file and uses that as the CA path.
    # If both are set, MYSQL_SSL_CA_CONTENT wins. Never commit the real value.
    MYSQL_SSL_CA_CONTENT: Optional[str] = None
    SECRET_KEY: str = "super-secret-key-change-in-production-32chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days
    
    ADMIN_EMAIL: str = "admin@aicreatorhub.com"
    ADMIN_PASSWORD: str = "Admin@1234"
    ADMIN_NAME: str = "Platform Admin"
    
    AUTO_RELEASE_HOURS: int = 24
    AUTO_RELEASE_INTERVAL_SECONDS: int = 60
    ENABLE_AUTO_RELEASE_SCHEDULER: bool = True

    CLOUDINARY_CLOUD_NAME: Optional[str] = None
    CLOUDINARY_API_KEY: Optional[str] = None
    CLOUDINARY_API_SECRET: Optional[str] = None
    
    PLATFORM_COMMISSION_PERCENT: int = 20

    REPORTING_TIMEZONE: str = "Asia/Kolkata"
    FRONTEND_URL: str = "http://localhost:5173"
    
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_PUBLISHABLE_KEY: Optional[str] = None
    
    RAZORPAY_KEY_ID: Optional[str] = None
    RAZORPAY_KEY_SECRET: Optional[str] = None
    ALLOW_SIMULATED_PAYMENTS: bool = True

    # PixVerse AI video generation (creator-only). Credentials live server-side only.
    PIXVERSE_API_KEY: Optional[str] = None
    PIXVERSE_API_BASE: str = "https://app-api.pixverse.ai"
    PIXVERSE_MODEL: str = "v5"                 # owner-configured; not chosen by creators
    PIXVERSE_DEFAULT_QUALITY: str = "540p"
    PIXVERSE_DEFAULT_DURATION: int = 5
    PIXVERSE_POLL_INTERVAL_SECONDS: int = 15   # provider-recommended polling cadence
    PIXVERSE_JOB_TIMEOUT_SECONDS: int = 900    # overall per-job timeout (15 min)
    PIXVERSE_MAX_CONCURRENT_PER_CREATOR: int = 2
    PIXVERSE_DAILY_LIMIT_PER_CREATOR: int = 30
    PIXVERSE_MAX_PROMPT_CHARS: int = 2000
    PIXVERSE_OUTPUT_MAX_MB: int = 200
    PIXVERSE_DEDUPE_WINDOW_SECONDS: int = 20   # reject identical resubmits within this window
    ENABLE_PIXVERSE_WORKER: bool = True

    ENVIRONMENT: str = "development"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

_DEFAULT_SECRET_KEYS = {
    "super-secret-key-change-in-production-32chars",
    "your-super-secret-key-change-in-production-min-32-chars",
}
_DEFAULT_ADMIN_PASSWORDS = {"Admin@1234"}

def insecure_settings(s: Settings) -> list[str]:
    """Return human-readable problems with security-sensitive settings (never the values)."""
    problems = []
    if s.SECRET_KEY in _DEFAULT_SECRET_KEYS or len(s.SECRET_KEY) < 32:
        problems.append("SECRET_KEY is a known default or shorter than 32 characters")
    if s.ADMIN_PASSWORD in _DEFAULT_ADMIN_PASSWORDS:
        problems.append("ADMIN_PASSWORD is the default value")
    if s.ALLOW_SIMULATED_PAYMENTS:
        problems.append("ALLOW_SIMULATED_PAYMENTS is enabled")
    return problems

def validate_security_settings(s: Settings) -> list[str]:
    """Raise in production if insecure settings are present; return them otherwise."""
    problems = insecure_settings(s)
    if problems and s.ENVIRONMENT.lower() == "production":
        raise RuntimeError("Refusing to start in production: " + "; ".join(problems))
    return problems
