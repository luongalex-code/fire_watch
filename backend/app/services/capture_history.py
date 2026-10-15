from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import String, case, cast, exists, func, literal, select

from app.models.vision_detection import VisionDetection
from app.schemas.vision import VisionDetectionOut


def capture_filters(day: date | None = None, label: str | None = None):
    filters = [VisionDetection.snapshot_path.is_not(None), VisionDetection.snapshot_path != ""]
    if day:
        start = datetime.combine(day, time.min, tzinfo=timezone(timedelta(hours=7)))
        filters.extend([VisionDetection.frame_at >= start, VisionDetection.frame_at < start + timedelta(days=1)])
    if label:
        entries = func.jsonb_array_elements(VisionDetection.detections).table_valued("value").alias("entry")
        filters.append(exists(select(1).select_from(entries).where(
            func.lower(func.trim(entries.c.value.op("->>")("label"))) == label
        )).correlate(VisionDetection))
    return filters


def capture_groups(db, *, day=None, label=None, limit=100):
    # Captures without an alert are independent; NULL must not merge unrelated images.
    key = case(
        (VisionDetection.alert_id.is_not(None), literal("alert:") + cast(VisionDetection.alert_id, String)),
        else_=literal("capture:") + cast(VisionDetection.id, String),
    )
    order = [VisionDetection.frame_at.desc(), VisionDetection.id.desc()]
    ranked = select(
        *VisionDetection.__table__.c,
        key.label("group_key"),
        func.count().over(partition_by=key).label("capture_count"),
        func.min(VisionDetection.frame_at).over(partition_by=key).label("first_at"),
        func.max(VisionDetection.frame_at).over(partition_by=key).label("last_at"),
        func.row_number().over(partition_by=key, order_by=order).label("rank"),
    ).where(*capture_filters(day, label)).subquery()
    rows = db.execute(select(ranked).where(ranked.c.rank == 1)
                      .order_by(ranked.c.frame_at.desc(), ranked.c.id.desc()).limit(limit + 1)).mappings().all()
    return {
        "has_more": len(rows) > limit,
        "groups": [{
            "key": row["group_key"], "count": row["capture_count"],
            "first_at": row["first_at"], "last_at": row["last_at"],
            "latest": VisionDetectionOut.model_validate(dict(row)).model_dump(mode="json"),
        } for row in rows[:limit]],
    }
