import os
import re

file_path = r'C:\Class\IOT\project_final_iot\backend\app\api\alerts.py'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

ack_alert = """@router.post("/{alert_id}/ack", response_model=AlertOut)
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
    return payload_resp"""

content = re.sub(r'@router\.post\("/\{alert_id\}/ack", response_model=AlertOut\).*?return payload', ack_alert, content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
