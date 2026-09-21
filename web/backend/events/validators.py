from datetime import datetime
from fastapi import HTTPException

def validate_payload(event_type: str, payload: dict) -> None:
    if not isinstance(payload, dict):
        raise HTTPException(status_code=422, detail="Payload must be a dictionary")

    valid_types = {"planted", "harvested", "weighed", "graded", "packed", "transferred"}
    if event_type not in valid_types:
        raise HTTPException(
            status_code=422,
            detail="Unknown event_type. Must be one of: planted, harvested, weighed, graded, packed, transferred"
        )

    if event_type == "planted":
        if "plot_id" not in payload or not payload["plot_id"]:
            raise HTTPException(status_code=422, detail="planted event requires plot_id")
        if "crop" not in payload or not isinstance(payload["crop"], str) or not payload["crop"].strip():
            raise HTTPException(status_code=422, detail="planted event requires crop (non-empty str)")
        if "season" not in payload or not isinstance(payload["season"], str) or not payload["season"].strip():
            raise HTTPException(status_code=422, detail="planted event requires season (non-empty str)")
        if "occurred_at" not in payload or not payload["occurred_at"]:
            raise HTTPException(status_code=422, detail="planted event requires occurred_at")

    elif event_type == "harvested":
        if "batch_id" not in payload or not payload["batch_id"]:
            raise HTTPException(status_code=422, detail="harvested event requires batch_id")
        weight = payload.get("weight_kg")
        if weight is None or type(weight) not in (int, float) or weight <= 0:
            raise HTTPException(status_code=422, detail="harvested event requires weight_kg (float > 0)")
        if "collector_id" not in payload or not isinstance(payload["collector_id"], str) or not payload["collector_id"].strip():
            raise HTTPException(status_code=422, detail="harvested event requires collector_id (str)")
        if "occurred_at" not in payload or not payload["occurred_at"]:
            raise HTTPException(status_code=422, detail="harvested event requires occurred_at")

    elif event_type == "weighed":
        if "batch_id" not in payload or not payload["batch_id"]:
            raise HTTPException(status_code=422, detail="weighed event requires batch_id")
        weight = payload.get("weight_kg")
        if weight is None or type(weight) not in (int, float) or weight <= 0:
            raise HTTPException(status_code=422, detail="weighed event requires weight_kg (float > 0)")
        if "facility_id" not in payload or not isinstance(payload["facility_id"], str) or not payload["facility_id"].strip():
            raise HTTPException(status_code=422, detail="weighed event requires facility_id (str)")
        if "occurred_at" not in payload or not payload["occurred_at"]:
            raise HTTPException(status_code=422, detail="weighed event requires occurred_at")

    elif event_type == "graded":
        if "batch_id" not in payload or not payload["batch_id"]:
            raise HTTPException(status_code=422, detail="graded event requires batch_id")
        if "grade" not in payload or not isinstance(payload["grade"], str) or not payload["grade"].strip():
            raise HTTPException(status_code=422, detail="graded event requires grade (str)")
        if "grader_id" not in payload or not isinstance(payload["grader_id"], str) or not payload["grader_id"].strip():
            raise HTTPException(status_code=422, detail="graded event requires grader_id (str)")
        if "occurred_at" not in payload or not payload["occurred_at"]:
            raise HTTPException(status_code=422, detail="graded event requires occurred_at")

    elif event_type == "packed":
        if "batch_id" not in payload or not payload["batch_id"]:
            raise HTTPException(status_code=422, detail="packed event requires batch_id")
        count = payload.get("package_count")
        if count is None or type(count) is not int or count <= 0:
            raise HTTPException(status_code=422, detail="packed event requires package_count (int > 0)")
        if "occurred_at" not in payload or not payload["occurred_at"]:
            raise HTTPException(status_code=422, detail="packed event requires occurred_at")

    elif event_type == "transferred":
        if "batch_id" not in payload or not payload["batch_id"]:
            raise HTTPException(status_code=422, detail="transferred event requires batch_id")
        if "from_user_id" not in payload or not isinstance(payload["from_user_id"], str) or not payload["from_user_id"].strip():
            raise HTTPException(status_code=422, detail="transferred event requires from_user_id (str)")
        if "to_user_id" not in payload or not isinstance(payload["to_user_id"], str) or not payload["to_user_id"].strip():
            raise HTTPException(status_code=422, detail="transferred event requires to_user_id (str)")
        if "occurred_at" not in payload or not payload["occurred_at"]:
            raise HTTPException(status_code=422, detail="transferred event requires occurred_at")
