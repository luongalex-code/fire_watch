#pragma once

#include "driver/gpio.h"
#include "hal/adc_types.h"

// =========================
// GPIO
// =========================

#define LED_GPIO       GPIO_NUM_2
#define DHT_GPIO       GPIO_NUM_3
#define GAS_GPIO       GPIO_NUM_5
#define FLAME_GPIO     GPIO_NUM_6
#define BUZZER_GPIO    GPIO_NUM_7
#define RELAY_GPIO     GPIO_NUM_16

// ESP32-S3
// GPIO5 = ADC1_CH4
// GPIO6 = ADC1_CH5
#define GAS_CHANNEL    ADC_CHANNEL_4
#define FLAME_CHANNEL  ADC_CHANNEL_5

// =========================
// FLAME
// =========================

// Giá trị bạn đã đo:
// Không lửa ~ 4095
// Có lửa mạnh ~ 100 - 200

#define FLAME_ON_THRESHOLD   1850
#define FLAME_OFF_THRESHOLD  2500

#define FIRE_CONFIRM_COUNT   (PUMP_START_DELAY_MS / SENSOR_LOOP_MS)
#define FIRE_CLEAR_COUNT     5

// =========================
// RELAY
// =========================

#define RELAY_ON   0
#define RELAY_OFF  1

// =========================
// BUZZER
// =========================


#define BUZZER_ON  1
#define BUZZER_OFF 0

// =========================
// TIMING
// =========================

#define SENSOR_LOOP_MS        100
#define DHT_READ_INTERVAL_MS  2000
#define DHT_READ_INTERVAL_MIN_MS 2000
#define DHT_READ_INTERVAL_MAX_MS 60000

#define LED_BLINK_MS          250

#define PUMP_START_DELAY_MS   300
#define PUMP_STOP_DELAY_MS    3000

// =========================
// WIFI / MQTT
// =========================

// Sua theo WiFi cua ban truoc khi flash ESP32.
#define WIFI_SSID             "Ben"
#define WIFI_PASSWORD         "23452345"
#define WIFI_MAX_RETRY        10

// EMQX dang chay tren may tinh thi dung IP LAN cua may tinh, khong dung localhost.
// Vi du: mqtt://192.168.1.15:1883
#define MQTT_BROKER_URI       "mqtt://172.20.10.8:1883"
#define MQTT_USERNAME         ""
#define MQTT_PASSWORD         ""

#define MQTT_TOPIC_PREFIX     "fire"
#define DEVICE_CODE           "esp32-s3-01"
#define AREA_CODE             "default"
#define AREA_NAME             "Phòng Thủ Dầu Một"
#define FIRMWARE_VERSION      "1.0.0-fire-aiot"
