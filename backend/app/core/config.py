from __future__ import annotations
import os
from pydantic import BaseModel

def _csv_env(name: str, default: str) -> list[str]:
    raw = os.getenv(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]

class Settings(BaseModel):
    app_name: str = "rezervuarostroenie"
    env: str = os.getenv("APP_ENV", "dev")
    data_dir: str = os.getenv("DATA_DIR", os.path.join(os.path.dirname(__file__), "..", "..", "data"))
    cors_allow_origins: list[str] = _csv_env("CORS_ALLOW_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,https://rezervuarostroenie.ru")

settings = Settings()
