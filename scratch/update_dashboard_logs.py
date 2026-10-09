import os
import re

file_path = r'C:\Class\IOT\project_final_iot\backend\app\api\dashboard.py'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# add config updated log to _save_runtime_settings
save_settings = """def _save_runtime_settings(db: Session, payload: dict[str, Any], actor_user_id: int | None = None) -> dict[str, Any]:
    _validate_runtime_settings(payload)
    
    # Check if there is an existing setting to diff against
    existing = db.scalars(select(RuntimeSetting).order_by(desc(RuntimeSetting.id)).limit(1)).first()
    old_payload = existing.payload if existing else {}

    setting = RuntimeSetting(
        setting_key=SETTINGS_KEY,
        payload=payload,
        checksum=payload["checksumSha256"],
    )
    db.add(setting)
    db.commit()
    db.refresh(setting)
    
    # Calculate diff
    changed_keys = {}
    for k, v in payload.items():
        if k != "checksumSha256" and k not in ("deviceConfigQueued",):
            if k not in old_payload or old_payload[k] != v:
                changed_keys[k] = {"from": old_payload.get(k), "to": v}
                
    if changed_keys:
        try:
            db.add(AuditLog(
                actor_user_id=actor_user_id,
                action="config_updated",
                entity_type="system",
                entity_id="runtime_config",
                change_details={
                    "level": "INFO",
                    "message": "Cấu hình hệ thống được cập nhật",
                    "changed_keys": changed_keys,
                }
            ))
            db.commit()
        except Exception:
            db.rollback()

    return payload"""

content = re.sub(r'def _save_runtime_settings\(db: Session, payload: dict\[str, Any\]\) -> dict\[str, Any\]:.*?    db\.refresh\(setting\)\n    return payload', save_settings, content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
