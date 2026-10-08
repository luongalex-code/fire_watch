import json
import os
import time
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

import cv2
import requests
from ultralytics import YOLO

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

try:
    import paho.mqtt.client as mqtt
except ImportError:
    mqtt = None

if load_dotenv is not None:
    load_dotenv()


# =====================================================
# CONFIG
# =====================================================

MODEL_PATH = os.getenv("FIRE_AI_MODEL_PATH", "models/best.pt")
PERSON_MODEL_PATH = os.getenv("FIRE_AI_PERSON_MODEL_PATH", "models/yolov8n.pt")
CAMERA_INDEX_SETTING = os.getenv("FIRE_AI_CAMERA_INDEX", "auto").strip()
CAMERA_CANDIDATES_SETTING = os.getenv("FIRE_AI_CAMERA_CANDIDATES", "").strip()
CAMERA_WIDTH = int(os.getenv("FIRE_AI_CAMERA_WIDTH", "1920"))
CAMERA_HEIGHT = int(os.getenv("FIRE_AI_CAMERA_HEIGHT", "1080"))
CAMERA_FPS = int(os.getenv("FIRE_AI_CAMERA_FPS", "30"))
SHOW_WINDOW = os.getenv("FIRE_AI_SHOW_WINDOW", "0") == "1"
STREAM_HOST = os.getenv("FIRE_AI_STREAM_HOST", "0.0.0.0")
STREAM_PORT = int(os.getenv("FIRE_AI_STREAM_PORT", "8090"))
ENABLE_STREAM = os.getenv("FIRE_AI_ENABLE_STREAM", "1") == "1"

CAMERA_CODE = os.getenv("FIRE_AI_CAMERA_CODE", "camera-01")
AREA_CODE = os.getenv("FIRE_AI_AREA_CODE", "default")
AREA_NAME = os.getenv("FIRE_AI_AREA_NAME", "Phòng Thủ Dầu Một")

BACKEND_URL = os.getenv("FIRE_AI_BACKEND_URL", "http://127.0.0.1:8000")
SEND_TO_BACKEND = os.getenv("FIRE_AI_SEND_BACKEND", "1") == "1"

ENABLE_MQTT = os.getenv("FIRE_AI_ENABLE_MQTT", "0") == "1"
MQTT_HOST = os.getenv("FIRE_AI_MQTT_HOST", "127.0.0.1")
MQTT_PORT = int(os.getenv("FIRE_AI_MQTT_PORT", "1883"))
MQTT_TOPIC_PREFIX = os.getenv("FIRE_AI_MQTT_TOPIC_PREFIX", "fire")

FIRE_CONF_THRESHOLD = float(os.getenv("FIRE_AI_FIRE_CONF_THRESHOLD", "0.55"))
SMOKE_CONF_THRESHOLD = float(os.getenv("FIRE_AI_SMOKE_CONF_THRESHOLD", "0.50"))
CONF_THRESHOLD = min(FIRE_CONF_THRESHOLD, SMOKE_CONF_THRESHOLD)
FIRE_CONFIRM_FRAMES = int(os.getenv("FIRE_AI_CONFIRM_FRAMES", "5"))
FIRE_CLEAR_FRAMES = int(os.getenv("FIRE_AI_CLEAR_FRAMES", "15"))
SETTINGS_REFRESH_SECONDS = float(os.getenv("FIRE_AI_SETTINGS_REFRESH_SECONDS", "5"))

PERSON_DETECTION_ENABLED = os.getenv("FIRE_AI_PERSON_ENABLED", "1") == "1"
PERSON_CONF_THRESHOLD = float(os.getenv("FIRE_AI_PERSON_CONF_THRESHOLD", "0.50"))
PERSON_INTERVAL_FRAMES = max(1, int(os.getenv("FIRE_AI_PERSON_INTERVAL_FRAMES", "3")))
PERSON_IMG_SIZE = int(os.getenv("FIRE_AI_PERSON_IMG_SIZE", "640"))
PERSON_CLASS_ID = 0

EVENT_COOLDOWN = float(os.getenv("FIRE_AI_EVENT_COOLDOWN", "5"))
CAPTURE_FOLDER = os.getenv("FIRE_AI_CAPTURE_FOLDER", "captures")
IMG_SIZE = int(os.getenv("FIRE_AI_IMG_SIZE", "960"))

TARGET_CLASSES = {"fire", "smoke"}
CLASS_CONF_THRESHOLDS = {
    "fire": FIRE_CONF_THRESHOLD,
    "smoke": SMOKE_CONF_THRESHOLD,
}
latest_jpeg = None
latest_frame_at = None
latest_jpeg_lock = threading.Lock()
person_state_lock = threading.Lock()
latest_person_state = {
    "enabled": PERSON_DETECTION_ENABLED,
    "status": "disabled" if not PERSON_DETECTION_ENABLED else "loading",
    "area_code": AREA_CODE,
    "camera_code": CAMERA_CODE,
    "person_count": 0,
    "detections": [],
    "updated_at": None,
    "confidence_threshold": PERSON_CONF_THRESHOLD,
    "interval_frames": PERSON_INTERVAL_FRAMES,
    "model_name": os.path.basename(PERSON_MODEL_PATH),
    "model_path": PERSON_MODEL_PATH,
    "latency_ms": None,
    "error": None,
}

CAMERA_BACKENDS = [
    ("DSHOW", cv2.CAP_DSHOW),
    ("MSMF", cv2.CAP_MSMF),
    ("ANY", cv2.CAP_ANY),
]


# =====================================================
# SERVICE HELPERS
# =====================================================

def utc_now_iso():
    return datetime.now(timezone.utc).isoformat()


def set_stream_frame(frame):
    global latest_jpeg
    global latest_frame_at

    if not ENABLE_STREAM:
        return

    ok, buffer = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
    if not ok:
        return

    with latest_jpeg_lock:
        latest_jpeg = buffer.tobytes()
        latest_frame_at = time.time()


class StreamHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    def _send_json(self, payload, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()

    def do_POST(self):
        parsed_path = urlparse(self.path).path

        if parsed_path != "/person/settings":
            self._send_json({"error": "not_found"}, status=404)
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(content_length).decode("utf-8") if content_length else "{}"
            payload = json.loads(body or "{}")
            update_person_settings(payload)
            self._send_json({"ok": True, "person_detection": get_person_state()})
        except Exception as exc:
            self._send_json({"ok": False, "error": str(exc)}, status=400)

    def do_GET(self):
        if self.path in ("/", "/health"):
            with latest_jpeg_lock:
                has_frame = latest_jpeg is not None
                frame_age = time.time() - latest_frame_at if latest_frame_at is not None else None
            payload = {
                "status": "ok",
                "stream": "/stream",
                "camera_code": CAMERA_CODE,
                "area_code": AREA_CODE,
                "has_frame": has_frame,
                "frame_age_seconds": frame_age,
                "person_detection": get_person_state(),
            }
            self._send_json(payload)
            return

        if self.path == "/person/status":
            self._send_json({"person_detection": get_person_state()})
            return

        parsed_path = urlparse(self.path).path

        if parsed_path.startswith("/captures/"):
            capture_name = unquote(parsed_path.removeprefix("/captures/"))
            capture_path = (Path(CAPTURE_FOLDER) / capture_name).resolve()
            capture_root = Path(CAPTURE_FOLDER).resolve()

            try:
                capture_path.relative_to(capture_root)
            except ValueError:
                self.send_response(404)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                return

            if not capture_path.is_file():
                self.send_response(404)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                return

            self.send_response(200)
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(capture_path.read_bytes())
            return

        if self.path != "/stream":
            self.send_response(404)
            self.end_headers()
            return

        self.send_response(200)
        self.send_header("Age", "0")
        self.send_header("Cache-Control", "no-cache, private")
        self.send_header("Pragma", "no-cache")
        self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

        while True:
            with latest_jpeg_lock:
                frame = latest_jpeg

            if frame is None:
                time.sleep(0.1)
                continue

            try:
                self.wfile.write(b"--frame\r\n")
                self.wfile.write(b"Content-Type: image/jpeg\r\n\r\n")
                self.wfile.write(frame)
                self.wfile.write(b"\r\n")
                time.sleep(1 / max(CAMERA_FPS, 1))
            except (BrokenPipeError, ConnectionResetError):
                break


def start_stream_server():
    if not ENABLE_STREAM:
        return

    server = ThreadingHTTPServer((STREAM_HOST, STREAM_PORT), StreamHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    print(f"[STREAM] MJPEG http://127.0.0.1:{STREAM_PORT}/stream")


def parse_camera_candidates():
    if CAMERA_CANDIDATES_SETTING:
        values = CAMERA_CANDIDATES_SETTING
    else:
        values = CAMERA_INDEX_SETTING

    if values.lower() not in ("", "auto", "-1"):
        candidates = []
        for value in values.split(","):
            value = value.strip()
            if not value:
                continue
            try:
                candidates.append(int(value))
            except ValueError:
                print(f"[CAMERA] Bo qua camera index khong hop le: {value}")

        if candidates:
            return candidates

    return [1, 2, 0, 3, 4, 5]


def configure_camera(cap):
    cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, CAMERA_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, CAMERA_HEIGHT)
    cap.set(cv2.CAP_PROP_FPS, CAMERA_FPS)
    cap.set(cv2.CAP_PROP_AUTOFOCUS, 1)


def open_camera():
    candidates = parse_camera_candidates()
    print(f"[CAMERA] Dang thu camera index: {candidates}")

    for camera_index in candidates:
        for backend_name, backend in CAMERA_BACKENDS:
            cap = cv2.VideoCapture(camera_index, backend)

            if not cap.isOpened():
                cap.release()
                continue

            configure_camera(cap)
            ok, frame = cap.read()

            if ok and frame is not None:
                height, width = frame.shape[:2]
                print(
                    f"[CAMERA] Opened index={camera_index} backend={backend_name} "
                    f"frame={width}x{height}"
                )
                return cap, camera_index, backend_name

            cap.release()

    raise RuntimeError(
        "Khong mo duoc camera. Thu rut/cam lai USB camera hoac set "
        "FIRE_AI_CAMERA_INDEX=0/1/2."
    )


def connect_mqtt():
    if not ENABLE_MQTT:
        return None

    if mqtt is None:
        print("[MQTT] paho-mqtt chua duoc cai, bo qua MQTT")
        return None

    client = mqtt.Client(
        mqtt.CallbackAPIVersion.VERSION2,
        client_id=f"{CAMERA_CODE}-fire-ai",
    )

    try:
        client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
        client.loop_start()
        print(f"[MQTT] Connected {MQTT_HOST}:{MQTT_PORT}")
        return client
    except Exception as exc:
        print(f"[MQTT] Khong ket noi duoc: {exc}")
        return None


def save_event(frame):
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = os.path.join(CAPTURE_FOLDER, f"fire_{timestamp}.jpg")
    cv2.imwrite(filename, frame)
    print(f"[SAVE] {filename}")
    return filename


def get_person_state():
    with person_state_lock:
        return dict(latest_person_state)


def update_person_state(**changes):
    with person_state_lock:
        latest_person_state.update(changes)


def update_person_settings(payload):
    global PERSON_DETECTION_ENABLED
    global PERSON_CONF_THRESHOLD
    global PERSON_INTERVAL_FRAMES
    global person_model

    if "enabled" in payload:
        PERSON_DETECTION_ENABLED = bool(payload["enabled"])

    if "confidence_threshold" in payload:
        PERSON_CONF_THRESHOLD = max(0.0, min(1.0, float(payload["confidence_threshold"])))

    if "interval_frames" in payload:
        PERSON_INTERVAL_FRAMES = max(1, int(payload["interval_frames"]))

    if PERSON_DETECTION_ENABLED and person_model is None:
        person_model = load_person_model()

    status = "disabled" if not PERSON_DETECTION_ENABLED else (
        "online" if person_model is not None else "error"
    )
    update_person_state(
        enabled=PERSON_DETECTION_ENABLED,
        status=status,
        confidence_threshold=PERSON_CONF_THRESHOLD,
        interval_frames=PERSON_INTERVAL_FRAMES,
        person_count=latest_person_state["person_count"] if PERSON_DETECTION_ENABLED else 0,
        detections=latest_person_state["detections"] if PERSON_DETECTION_ENABLED else [],
        latency_ms=latest_person_state["latency_ms"] if PERSON_DETECTION_ENABLED else None,
        error=None if not PERSON_DETECTION_ENABLED or person_model is not None else latest_person_state["error"],
    )


def load_person_model():
    if not PERSON_DETECTION_ENABLED:
        update_person_state(status="disabled", error=None)
        return None

    try:
        model_instance = YOLO(PERSON_MODEL_PATH)
        update_person_state(status="online", error=None, model_name=os.path.basename(PERSON_MODEL_PATH))
        print(f"[PERSON] Model loaded: {PERSON_MODEL_PATH}")
        return model_instance
    except Exception as exc:
        update_person_state(status="error", error=str(exc), enabled=PERSON_DETECTION_ENABLED)
        print(f"[PERSON] Khong tai duoc model person: {exc}")
        return None


def read_person_detections(frame):
    if not PERSON_DETECTION_ENABLED or person_model is None:
        return []

    started = time.perf_counter()
    results = person_model.predict(
        source=frame,
        classes=[PERSON_CLASS_ID],
        conf=PERSON_CONF_THRESHOLD,
        imgsz=PERSON_IMG_SIZE,
        verbose=False,
    )
    latency_ms = (time.perf_counter() - started) * 1000
    detections = []

    for result in results:
        if result.boxes is None:
            continue

        for box in result.boxes:
            confidence = float(box.conf[0])
            x1, y1, x2, y2 = [float(value) for value in box.xyxy[0].tolist()]
            detections.append(
                {
                    "label": "person",
                    "confidence": confidence,
                    "bbox": {
                        "x1": x1,
                        "y1": y1,
                        "x2": x2,
                        "y2": y2,
                    },
                }
            )

    update_person_state(
        status="online",
        person_count=len(detections),
        detections=detections,
        updated_at=utc_now_iso(),
        confidence_threshold=PERSON_CONF_THRESHOLD,
        interval_frames=PERSON_INTERVAL_FRAMES,
        latency_ms=round(latency_ms, 1),
        error=None,
    )
    publish_person_state_to_backend()
    return detections


def draw_person_detections(frame, detections):
    color = (255, 180, 0)
    for item in detections:
        bbox = item.get("bbox", {})
        x1 = int(bbox.get("x1", 0))
        y1 = int(bbox.get("y1", 0))
        x2 = int(bbox.get("x2", 0))
        y2 = int(bbox.get("y2", 0))
        confidence = float(item.get("confidence", 0.0))

        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        cv2.putText(
            frame,
            f"Person {confidence:.2f}",
            (x1, max(y1 - 8, 18)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            color,
            2,
        )

    if PERSON_DETECTION_ENABLED:
        cv2.putText(
            frame,
            f"Person: {len(detections)}",
            (30, 135),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.75,
            color,
            2,
        )


def build_detection_payload(detections, snapshot_path=None, video_path=None):
    return {
        "camera_code": CAMERA_CODE,
        "area_code": AREA_CODE,
        "area_name": AREA_NAME,
        "frame_at": utc_now_iso(),
        "model_name": os.path.basename(MODEL_PATH),
        "model_version": MODEL_PATH,
        "detections": detections,
        "snapshot_path": snapshot_path,
        "video_path": video_path,
    }


def build_person_state_payload():
    state = get_person_state()
    return {
        "camera_id": CAMERA_CODE,
        "camera_code": CAMERA_CODE,
        "area_code": AREA_CODE,
        "area_name": AREA_NAME,
        "frame_at": state.get("updated_at") or utc_now_iso(),
        "status": state.get("status") or "unknown",
        "person_count": int(state.get("person_count") or 0),
        "detections": state.get("detections") or [],
    }


def publish_person_state_to_backend():
    if not SEND_TO_BACKEND:
        return

    payload = build_person_state_payload()
    url = f"{BACKEND_URL.rstrip('/')}/api/vision/person-state"

    def worker():
        try:
            response = requests.post(url, json=payload, timeout=1.5)
            response.raise_for_status()
        except Exception as exc:
            print(f"[BACKEND] Gui person state that bai: {exc}")

    threading.Thread(target=worker, daemon=True).start()


def send_to_backend(payload):
    if not SEND_TO_BACKEND:
        return

    url = f"{BACKEND_URL.rstrip('/')}/api/vision/detections"

    try:
        response = requests.post(url, json=payload, timeout=2.5)
        response.raise_for_status()
        print(f"[BACKEND] Sent detection event -> alert_id={response.json().get('alert_id')}")
    except Exception as exc:
        print(f"[BACKEND] Gui event that bai: {exc}")


def refresh_runtime_settings(force=False):
    global FIRE_CONF_THRESHOLD
    global SMOKE_CONF_THRESHOLD
    global CONF_THRESHOLD
    global FIRE_CONFIRM_FRAMES
    global CLASS_CONF_THRESHOLDS

    now = time.time()
    last_refresh = getattr(refresh_runtime_settings, "last_refresh", 0.0)
    if not force and now - last_refresh < SETTINGS_REFRESH_SECONDS:
        return

    refresh_runtime_settings.last_refresh = now
    url = f"{BACKEND_URL.rstrip('/')}/api/settings"

    try:
        response = requests.get(url, timeout=2.0)
        response.raise_for_status()
        settings = response.json()

        fire_conf = float(settings.get("aiConfidenceFireThreshold", FIRE_CONF_THRESHOLD))
        smoke_conf = float(settings.get("aiConfidenceSmokeThreshold", SMOKE_CONF_THRESHOLD))
        confirm_frames = int(settings.get("aiConsecutiveFrames", FIRE_CONFIRM_FRAMES))

        FIRE_CONF_THRESHOLD = max(0.0, min(1.0, fire_conf))
        SMOKE_CONF_THRESHOLD = max(0.0, min(1.0, smoke_conf))
        CONF_THRESHOLD = min(FIRE_CONF_THRESHOLD, SMOKE_CONF_THRESHOLD)
        FIRE_CONFIRM_FRAMES = max(1, confirm_frames)
        CLASS_CONF_THRESHOLDS = {
            "fire": FIRE_CONF_THRESHOLD,
            "smoke": SMOKE_CONF_THRESHOLD,
        }
    except Exception as exc:
        if force:
            print(f"[SETTINGS] Khong doc duoc runtime settings: {exc}")


def publish_mqtt(mqtt_client, payload):
    if mqtt_client is None:
        return

    topic = f"{MQTT_TOPIC_PREFIX.strip('/')}/ai/{CAMERA_CODE}/detections"

    try:
        mqtt_client.publish(topic, json.dumps(payload), qos=1)
        print(f"[MQTT] Published {topic}")
    except Exception as exc:
        print(f"[MQTT] Publish that bai: {exc}")


def read_fire_smoke_detections(result):
    detections = []
    current_hazard = False
    best_confidence = 0.0

    if result.boxes is None:
        return detections, current_hazard, best_confidence

    for box in result.boxes:
        class_id = int(box.cls[0])
        confidence = float(box.conf[0])
        class_name = str(result.names[class_id]).strip().lower()

        if class_name not in TARGET_CLASSES:
            continue

        if confidence < CLASS_CONF_THRESHOLDS[class_name]:
            continue

        current_hazard = True
        best_confidence = max(best_confidence, confidence)

        x1, y1, x2, y2 = [float(value) for value in box.xyxy[0].tolist()]
        detections.append(
            {
                "label": class_name,
                "confidence": confidence,
                "bbox": {
                    "x1": x1,
                    "y1": y1,
                    "x2": x2,
                    "y2": y2,
                },
            }
        )

    return detections, current_hazard, best_confidence


# =====================================================
# INIT
# =====================================================

os.makedirs(CAPTURE_FOLDER, exist_ok=True)

model = YOLO(MODEL_PATH)
person_model = load_person_model()
mqtt_client = connect_mqtt()
start_stream_server()
refresh_runtime_settings(force=True)

print("===================================")
print("SMART FIRE AI SERVICE")
print("===================================")
print("Model:", MODEL_PATH)
print("Classes:", model.names)
print("Person model:", PERSON_MODEL_PATH if PERSON_DETECTION_ENABLED else "disabled")
print("Person confidence:", PERSON_CONF_THRESHOLD)
print("Person interval frames:", PERSON_INTERVAL_FRAMES)
print("Fire confidence:", FIRE_CONF_THRESHOLD)
print("Smoke confidence:", SMOKE_CONF_THRESHOLD)
print("Confirm frames:", FIRE_CONFIRM_FRAMES)
print("Camera setting:", CAMERA_INDEX_SETTING)
print("Camera code:", CAMERA_CODE)
print("Area:", AREA_CODE)
print("Backend:", BACKEND_URL if SEND_TO_BACKEND else "disabled")
print("MQTT:", f"{MQTT_HOST}:{MQTT_PORT}" if mqtt_client else "disabled")
print("Stream:", f"http://127.0.0.1:{STREAM_PORT}/stream" if ENABLE_STREAM else "disabled")
print("Window:", "enabled, nhan Q de thoat" if SHOW_WINDOW else "disabled, xem tren frontend")
print("===================================")

try:
    cap, opened_camera_index, opened_camera_backend = open_camera()
except RuntimeError as exc:
    print(f"ERROR: {exc}")
    raise SystemExit(1)

print(f"Camera opened: index={opened_camera_index}, backend={opened_camera_backend}")


# =====================================================
# STATE
# =====================================================

hazard_counter = 0
hazard_clear_counter = 0
hazard_state = False
last_event_time = 0.0
frame_counter = 0
latest_person_detections = []


# =====================================================
# MAIN LOOP
# =====================================================

while True:
    refresh_runtime_settings()

    ret, frame = cap.read()

    if not ret:
        print("ERROR: Khong doc duoc frame")
        break

    frame_counter += 1

    results = model.predict(
        source=frame,
        conf=CONF_THRESHOLD,
        imgsz=IMG_SIZE,
        verbose=False,
    )

    result = results[0]
    detections, current_hazard, best_confidence = read_fire_smoke_detections(result)

    if current_hazard:
        hazard_counter += 1
        hazard_clear_counter = 0

        if hazard_counter >= FIRE_CONFIRM_FRAMES:
            if not hazard_state:
                print("[ALERT] FIRE/SMOKE CONFIRMED")
            hazard_state = True
    else:
        hazard_counter = 0

        if hazard_state:
            hazard_clear_counter += 1

            if hazard_clear_counter >= FIRE_CLEAR_FRAMES:
                hazard_state = False
                hazard_clear_counter = 0
                print("[INFO] FIRE/SMOKE CLEARED")
                clear_payload = build_detection_payload([])
                send_to_backend(clear_payload)
                publish_mqtt(mqtt_client, clear_payload)

    annotated_frame = result.plot()

    if PERSON_DETECTION_ENABLED and person_model is not None:
        if frame_counter % PERSON_INTERVAL_FRAMES == 0:
            try:
                latest_person_detections = read_person_detections(frame)
            except Exception as exc:
                latest_person_detections = []
                update_person_state(status="error", error=str(exc), updated_at=utc_now_iso())
                print(f"[PERSON] Loi nhan dien nguoi: {exc}")

        draw_person_detections(annotated_frame, latest_person_detections)
    elif PERSON_DETECTION_ENABLED and person_model is None:
        update_person_state(status="error")

    if hazard_state:
        status = "FIRE/SMOKE DETECTED"
        status_color = (0, 0, 255)
    else:
        status = "SYSTEM NORMAL"
        status_color = (0, 255, 0)

    cv2.putText(
        annotated_frame,
        status,
        (30, 50),
        cv2.FONT_HERSHEY_SIMPLEX,
        1.2,
        status_color,
        3,
    )

    if current_hazard:
        cv2.putText(
            annotated_frame,
            f"Hazard: {best_confidence:.2f}",
            (30, 95),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (0, 0, 255),
            2,
        )

    current_time = time.time()

    if hazard_state and current_time - last_event_time >= EVENT_COOLDOWN:
        snapshot_path = save_event(annotated_frame)
        payload = build_detection_payload(detections, snapshot_path=snapshot_path)
        send_to_backend(payload)
        publish_mqtt(mqtt_client, payload)
        last_event_time = current_time

    if current_hazard:
        print(f"Fire/Smoke detected | confidence={best_confidence:.2f}")

    set_stream_frame(annotated_frame)

    if SHOW_WINDOW:
        cv2.imshow("SMART FIRE AI SERVICE", annotated_frame)

        key = cv2.waitKey(1) & 0xFF

        if key == ord("q"):
            break


# =====================================================
# CLEANUP
# =====================================================

cap.release()

if SHOW_WINDOW:
    cv2.destroyAllWindows()

if mqtt_client is not None:
    mqtt_client.loop_stop()
    mqtt_client.disconnect()

print("SMART FIRE AI SERVICE STOPPED")
