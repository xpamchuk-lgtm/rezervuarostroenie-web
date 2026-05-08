from __future__ import annotations
import os
from pydantic import BaseModel

class Settings(BaseModel):
    app_name: str = "rezervuarostroenie"
    env: str = os.getenv("APP_ENV", "dev")
    data_dir: str = os.getenv("DATA_DIR", os.path.join(os.path.dirname(__file__), "..", "..", "data"))

settings = Settings()
