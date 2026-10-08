from fastapi import APIRouter

from app.mqtt.client import mqtt_service


router = APIRouter()


@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "mqtt_connected": mqtt_service.connected,
    }
