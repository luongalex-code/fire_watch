from contextlib import asynccontextmanager
import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.alerts import router as alerts_router
from app.api.commands import router as commands_router
from app.api.dashboard import router as dashboard_router
from app.api.health import router as health_router
from app.api.telemetry import router as telemetry_router
from app.api.tts import router as tts_router
from app.api.vision import router as vision_router
from app.api.websocket import router as websocket_router
from app.core.config import get_settings
from app.mqtt.client import mqtt_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    loop = asyncio.get_running_loop()
    mqtt_service.start(loop)
    yield
    mqtt_service.stop()


settings = get_settings()
app = FastAPI(title="Fire Monitoring AIoT Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(dashboard_router)
app.include_router(alerts_router)
app.include_router(telemetry_router)
app.include_router(tts_router)
app.include_router(vision_router)
app.include_router(commands_router)
app.include_router(websocket_router)
