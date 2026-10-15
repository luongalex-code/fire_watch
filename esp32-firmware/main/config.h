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
#define FAN_RELAY_GPIO GPIO_NUM_15

#define LCD_I2C_SDA_GPIO GPIO_NUM_8
#define LCD_I2C_SCL_GPIO GPIO_NUM_9

// ESP32-S3
// GPIO5 = ADC1_CH4
// GPIO6 = ADC1_CH5
#define GAS_CHANNEL    ADC_CHANNEL_4
#define FLAME_CHANNEL  ADC_CHANNEL_5

// =========================
// FLAME
// =========================

#define FLAME_ON_THRESHOLD   1850
#define FLAME_OFF_THRESHOLD  2500
#define FIRE_CONFIRM_COUNT   3
#define FIRE_CLEAR_COUNT     5

// =========================
// MQ-2 SMOKE / GAS
// =========================

// MQ-2 AO is read as raw 12-bit ADC.
// Gia tri hien thi tren FE la so do tho 0 - 4095 ADC, khong suy dien ppm.
// Toan tu ba ngoi trong main.c se doi ADC thanh trang thai doc de bat/tat quat:
// ESP32-S3 ADC la 12-bit, gia tri hop le 0 - 4095.
//   ADC >= MQ2_SMOKE_ON_THRESHOLD  ? co khoi/khi ga : tiep tuc trang thai cu
//   ADC <= MQ2_SMOKE_OFF_THRESHOLD ? khong co       : tiep tuc trang thai cu
#define MQ2_SMOKE_ON_THRESHOLD    1200
#define MQ2_SMOKE_OFF_THRESHOLD   900
#define MQ2_SMOKE_CONFIRM_COUNT   5
#define MQ2_SMOKE_CLEAR_COUNT     10
#define MQ2_SAMPLE_COUNT          20
#define MQ2_SAMPLE_DELAY_MS       10

// =========================
// RELAY
// =========================

#define RELAY_ON   0
#define RELAY_OFF  1

#define FAN_RELAY_ON   1
#define FAN_RELAY_OFF  0

// =========================
// LCD I2C
// =========================

#define LCD_I2C_PORT          I2C_NUM_0
#define LCD_I2C_ADDR          0x27
#define LCD_I2C_FREQ_HZ       100000
#define LCD_COLS              16
#define LCD_UPDATE_MS         1000

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
