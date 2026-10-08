# Smart Fire IoT - ESP-IDF 5.5

GPIO:
- LED: GPIO2
- DHT22 DATA: GPIO3
- MQ-2 AO: GPIO5 (ADC1_CH4)
- Flame Sensor AO: GPIO6 (ADC1_CH5)
- Buzzer: GPIO7
- Relay/Pump: GPIO16

Logic:
- Flame ADC < 2500 for 3 samples -> FIRE
- Flame ADC > 2500 for 5 samples -> NORMAL
- FIRE: buzzer ON, LED blink, pump 3s ON / 1s OFF
- DHT22 sampled every 2 seconds by default (valid configurable range: 2–60 seconds)
- Publish telemetry to MQTT topic: `fire/devices/esp32-s3-01/telemetry`
- Subscribe command topic: `fire/devices/esp32-s3-01/commands`
- Publish command ACK topic: `fire/devices/esp32-s3-01/commands/ack`
- Failed DHT22 reads publish `temperature_c` and `humidity_percent` as `null`; old readings are not reused.

The backend saves runtime settings in PostgreSQL. Updating `dhtSamplingPeriodMs` publishes a retained MQTT config message; the ESP32 validates the 2,000–60,000 ms range, saves it in NVS, and applies it immediately. Its GPIO3 pin and default interval are defined in `main/config.h`.

MQTT payload fields sent to backend:
- `device_code`, `area_code`, `area_name`
- `temperature_c`, `humidity_percent`, `dht22_error_code`
- `flame_adc`, `mq2_adc`
- `fire_state`: `normal` or `fire`
- `operating_mode`: `auto` or `manual`
- `pump_relay_state`, `buzzer_state`, `led_state`
- `firmware_version`

Before flashing:
1. Open `main/config.h`.
2. Set `WIFI_SSID` and `WIFI_PASSWORD`.
3. Set `MQTT_BROKER_URI` to the LAN IP of the computer running EMQX, for example:
   `mqtt://192.168.1.15:1883`

Do not use `localhost` for ESP32 MQTT. `localhost` on ESP32 means the ESP32 itself, not your computer.

Relay is configured active LOW in main/config.h:
#define RELAY_ON  0
#define RELAY_OFF 1

If your tested relay activates on HIGH, swap those two values.

Build:
idf.py set-target esp32s3
idf.py build

Flash:
idf.py -p COM7 flash monitor
