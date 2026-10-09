from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.alert import Alert
from app.models.area import Area
from app.models.audit_log import AuditLog
from app.schemas.alerts import AlertOut, AlertUpdateIn
from app.websocket.manager import websocket_manager


router = APIRouter(prefix="/api/alerts", tags=["alerts"])


def _alert_payload(alert: Alert, area: Area | None = None) -> dict:
    data = AlertOut.model_validate(alert).model_dump(mode="json")
    if area:
        data["area_code"] = area.area_code
        data["area_name"] = area.name
    return data


@router.get("", response_model=list[AlertOut])
def list_alerts(
    status: str | None = Query(default=None),
    area_id: int | None = Query(default=None),
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
):
    query = select(Alert, Area).join(Area, Area.id == Alert.area_id).order_by(Alert.started_at.desc()).limit(limit)
    if status:
        query = query.where(Alert.status == status)
    if area_id:
        query = query.where(Alert.area_id == area_id)
    return [_alert_payload(alert, area) for alert, area in db.execute(query).all()]


@router.get("/{alert_id}", response_model=AlertOut)
def get_alert(alert_id: int, db: Session = Depends(get_db)):
    row = db.execute(select(Alert, Area).join(Area, Area.id == Alert.area_id).where(Alert.id == alert_id)).first()
    if not row:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert, area = row
    return _alert_payload(alert, area)


@router.post("/{alert_id}/ack", response_model=AlertOut)
async def acknowledge_alert(alert_id: int, payload: AlertUpdateIn, db: Session = Depends(get_db)):
    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    if alert.status == "acknowledged":
        area = db.get(Area, alert.area_id)
        return _alert_payload(alert, area)

    alert.status = "acknowledged"
    alert.acknowledged_by = payload.user_id
    alert.acknowledged_at = datetime.now(timezone.utc)
    details = dict(alert.details or {})
    if payload.operator_name:
        details["acknowledged_by_name"] = payload.operator_name
    alert.details = details
    db.add(
        AuditLog(
            actor_user_id=payload.user_id,
            action="alert_acknowledged",
            entity_type="alert",
            entity_id=str(alert.id),
            change_details={
                "level": "AUDIT",
                "message": "Alert acknowledged by operator.",
                "operator_name": payload.operator_name,
                "condition_cleared_at": alert.condition_cleared_at.isoformat()
                if alert.condition_cleared_at
                else None,
            },
        )
    )
    db.commit()
    db.refresh(alert)
    area = db.get(Area, alert.area_id)
    payload_resp = _alert_payload(alert, area)
    await websocket_manager.broadcast("alert_updated", payload_resp)
    return payload_resp
