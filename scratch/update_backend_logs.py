import os
import re

file_path = r'C:\Class\IOT\project_final_iot\backend\app\services\fire_monitoring.py'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add AuditLog to imports
if 'AuditLog' not in content:
    content = content.replace(
        'from app.models.telemetry import Telemetry',
        'from app.models.telemetry import Telemetry\nfrom app.models.audit_log import AuditLog'
    )

# 2. Add observational logging to create_command
create_cmd = """def create_command(db: Session, payload: CommandIn) -> tuple[Command, Device]:
    device = db.scalar(select(Device).where(Device.device_code == payload.device_code))
    if not device:
        raise ValueError(f"Device not found: {payload.device_code}")

    command = Command(
        command_uuid=str(uuid4()),
        device_id=device.id,
        target=payload.target,
        action=payload.action,
        requested_by=payload.requested_by,
        status="pending",
    )
    db.add(command)
    db.commit()
    db.refresh(command)
    
    try:
        db.add(AuditLog(
            action="command_created",
            entity_type="command",
            entity_id=command.command_uuid,
            change_details={
                "level": "INFO",
                "message": f"Yêu cầu lệnh {payload.action} cho {payload.target}",
                "command_uuid": command.command_uuid,
                "target": payload.target,
                "action": payload.action,
            }
        ))
        db.commit()
    except Exception:
        db.rollback()

    return command, device"""

content = re.sub(r'def create_command\(.*?\).*?return command, device', create_cmd, content, flags=re.DOTALL)


# 3. mark_command_sent
mark_cmd_sent = """def mark_command_sent(db: Session, command: Command) -> Command:
    command.status = "sent"
    command.sent_at = utcnow()
    db.commit()
    db.refresh(command)
    
    try:
        db.add(AuditLog(
            action="mqtt_command_sent",
            entity_type="command",
            entity_id=command.command_uuid,
            change_details={
                "level": "INFO",
                "message": f"Đã gửi lệnh tới thiết bị qua MQTT",
                "command_uuid": command.command_uuid,
                "target": command.target,
                "action": command.action,
            }
        ))
        db.commit()
    except Exception:
        db.rollback()

    return command"""

content = re.sub(r'def mark_command_sent\(.*?\).*?return command', mark_cmd_sent, content, flags=re.DOTALL)


# 4. acknowledge_command
ack_cmd = """def acknowledge_command(db: Session, command_uuid: str, payload: dict) -> Command | None:
    command = db.scalar(select(Command).where(Command.command_uuid == command_uuid))
    if not command:
        return None

    command.status = "acknowledged"
    command.acknowledged_at = utcnow()
    command.ack_payload = payload
    db.commit()
    db.refresh(command)

    try:
        db.add(AuditLog(
            action="command_acknowledged",
            entity_type="command",
            entity_id=command.command_uuid,
            change_details={
                "level": "INFO",
                "message": f"Thiết bị đã nhận và phản hồi lệnh",
                "command_uuid": command.command_uuid,
                "target": command.target,
                "action": command.action,
                "ack_payload": payload,
            }
        ))
        db.commit()
    except Exception:
        db.rollback()

    return command"""

content = re.sub(r'def acknowledge_command\(.*?\).*?return command', ack_cmd, content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
