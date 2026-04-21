from pathlib import Path
from pydantic_settings import BaseSettings

# Resolve .env relative to this file's parent (NomadAI/ root), not cwd
_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    GROQ_API_KEY: str = ""
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3"
    OSRM_BASE_URL: str = "https://router.project-osrm.org"
    NOMINATIM_BASE_URL: str = "https://nominatim.openstreetmap.org"
    CACHE_DIR: str = "data/cache"
    ROUTE_CACHE_TTL_SECONDS: int = 3600
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    class Config:
        env_file = str(_ENV_FILE)


settings = Settings()

# Legacy flat exports
DEBUG = True
FRONTEND_URL = "http://localhost:5173"
