from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://postgres:postgrespassword@localhost:15432/fire_monitoring"
    api_cors_origins: str = "http://localhost:5173,http://localhost:5174"

    mqtt_host: str = "localhost"
    mqtt_port: int = 1883
    mqtt_username: str | None = None
    mqtt_password: str | None = None
    mqtt_client_id: str = "fire-monitoring-backend"
    mqtt_topic_prefix: str = "fire"
    esp32_device_code: str = "esp32-s3-01"
    auto_pump_on_ai_fire: bool = False
    dual_confirmed_pump_enabled: bool = True
    dual_confirmed_pump_cooldown_seconds: int = 30
    piper_tts_enabled: bool = False
    piper_tts_executable: str = "piper"
    piper_tts_model_path: str | None = None
    piper_tts_timeout_seconds: int = 15
    piper_tts_length_scale: float = 1.15
    piper_tts_sentence_silence: float = 0.6
    piper_tts_cache_dir: str = "/data/tts_cache"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.api_cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
