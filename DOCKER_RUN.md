# iot_fire_watch - Docker Compose

He thong Docker Compose moi ten `iot_fire_watch`.

Services:

- PostgreSQL: `localhost:15432`
- EMQX MQTT: `localhost:1883`
- EMQX Dashboard: `http://localhost:18083`
- FastAPI Backend: `http://localhost:8000`
- React Dashboard: `http://localhost:3000`
- AI camera stream: `http://localhost:8090/stream`

## 1. Don container cu bi trung ten

Neu truoc do da chay stack cu `fire_monitoring_*`, chay:

```powershell
docker rm -f fire_monitoring_emqx fire_monitoring_postgres fire_monitoring_backend fire_monitoring_frontend
```

Neu muon don stack moi `iot_fire_watch`:

```powershell
cd C:\Class\IOT\project_final_iot
docker compose -p iot_fire_watch down
```

Lenh tren chi dung/xoa container cua stack, khong xoa thu muc data PostgreSQL/EMQX.

## 2. Build image moi

```powershell
cd C:\Class\IOT\project_final_iot
docker compose -p iot_fire_watch build
```

Image tao ra:

- `iot_fire_watch_backend:latest`
- `iot_fire_watch_frontend:latest`

## 3. Chay tat ca

```powershell
cd C:\Class\IOT\project_final_iot
docker compose -p iot_fire_watch up -d
```

Lan dau backend se tu chay migration:

```text
alembic upgrade head
```

Cấu hình trong trang Settings được lưu tại bảng `runtime_settings` của PostgreSQL. Chu kỳ DHT22 (GPIO3) được gửi retained qua MQTT và ESP32 lưu lại vào NVS; nếu broker chưa kết nối, backend sẽ gửi cấu hình đã lưu khi kết nối lại.

## 4. Xem log

```powershell
docker compose -p iot_fire_watch logs -f backend
docker compose -p iot_fire_watch logs -f frontend
docker compose -p iot_fire_watch logs -f emqx
```

## 5. Tat he thong

```powershell
docker compose -p iot_fire_watch down
```

## ESP32 MQTT

ESP32 dang cau hinh broker:

```c
#define MQTT_BROKER_URI "mqtt://192.168.1.211:1883"
```

Neu IP WiFi laptop thay doi, sua lai `esp32-firmware/main/config.h` roi flash lai ESP32.

Luồng bơm hiện tại là logic kép:

```text
ESP32 sensor thấy lửa -> gửi telemetry fire_state=fire
Camera AI thấy lửa -> gửi vision detection
Backend thấy cả sensor alert + AI alert cùng area -> gửi MQTT pump:on
ESP32 nhận command -> bật relay/bơm
```

ESP32 không tự bật bơm chỉ vì flame sensor thấy lửa. Flame sensor local chỉ bật còi/đèn và gửi telemetry.

## AI Camera Laptop

Camera laptop khong chay ben trong Docker Compose. Hay chay service AI rieng tren Windows de no mo webcam va phat stream MJPEG cho frontend:

```powershell
cd C:\Class\IOT\project_final_iot\fire_ai
.\.venv\Scripts\Activate.ps1
python detect_fire.py
```

Frontend se hien video tu:

```text
http://localhost:8090/stream
```

Neu doi port stream, sua bien build frontend:

```yaml
VITE_CAMERA_STREAM_URL: http://localhost:8090/stream
```
