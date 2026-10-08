#include <stdio.h>
#include <stdint.h>
#include <stdbool.h>
#include <math.h>
#include <string.h>
#include <stdlib.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"
#include "freertos/portmacro.h"

#include "esp_log.h"
#include "esp_err.h"
#include "esp_timer.h"
#include "esp_rom_sys.h"
#include "esp_event.h"
#include "esp_netif.h"
#include "esp_wifi.h"
#include "mqtt_client.h"
#include "nvs_flash.h"

#include "driver/gpio.h"
#include "esp_adc/adc_oneshot.h"
#include "cJSON.h"

#include "config.h"


static const char *TAG = "SMART_FIRE";


// ======================================================
// SYSTEM STATE
// ======================================================

typedef enum
{
    STATE_NORMAL = 0,
    STATE_FIRE

} system_state_t;


static system_state_t system_state = STATE_NORMAL;


// ======================================================
// VARIABLES
// ======================================================

static int fire_counter = 0;
static int clear_counter = 0;

static bool led_state = false;
static bool buzzer_running = false;
static bool pump_running = false;
static bool auto_mode = true;

static int64_t last_led_toggle_ms = 0;
static int64_t last_pump_change_ms = 0;
static int64_t pump_off_deadline_ms = 0;
static int64_t last_dht_read_ms = 0;
static int64_t last_telemetry_publish_ms = 0;

static uint32_t dht_read_interval_ms = DHT_READ_INTERVAL_MS;
static float last_temperature = NAN;
static float last_humidity = NAN;
static int last_dht_error = 0;
static int wifi_retry_count = 0;
static portMUX_TYPE dht_mux = portMUX_INITIALIZER_UNLOCKED;

static adc_oneshot_unit_handle_t adc1_handle;
static esp_mqtt_client_handle_t mqtt_client = NULL;
static EventGroupHandle_t wifi_event_group;

#define WIFI_CONNECTED_BIT BIT0
#define WIFI_FAIL_BIT      BIT1


// ======================================================
// TIME
// ======================================================

static int64_t now_ms(void)
{
    return esp_timer_get_time() / 1000;
}


static void dht22_gpio_init(void)
{
    const gpio_config_t config =
    {
        .pin_bit_mask = 1ULL << DHT_GPIO,
        .mode = GPIO_MODE_INPUT_OUTPUT_OD,
        .pull_up_en = GPIO_PULLUP_ENABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE
    };

    ESP_ERROR_CHECK(gpio_config(&config));
    ESP_ERROR_CHECK(gpio_set_level(DHT_GPIO, 1));
    ESP_ERROR_CHECK(gpio_pullup_en(DHT_GPIO));
    ESP_ERROR_CHECK(gpio_pulldown_dis(DHT_GPIO));
}


static void load_runtime_config(void)
{
    nvs_handle_t handle;
    esp_err_t result = nvs_open("fire_config", NVS_READONLY, &handle);

    if (result == ESP_ERR_NVS_NOT_FOUND)
    {
        return;
    }

    if (result != ESP_OK)
    {
        ESP_LOGE(TAG, "Could not open runtime config in NVS: %s", esp_err_to_name(result));
        return;
    }

    uint32_t configured_interval_ms = DHT_READ_INTERVAL_MS;
    result = nvs_get_u32(handle, "dht_interval_ms", &configured_interval_ms);
    nvs_close(handle);

    if (result == ESP_ERR_NVS_NOT_FOUND)
    {
        return;
    }

    if (result != ESP_OK)
    {
        ESP_LOGE(TAG, "Could not read DHT22 interval from NVS: %s", esp_err_to_name(result));
        return;
    }

    if (configured_interval_ms < DHT_READ_INTERVAL_MIN_MS
        || configured_interval_ms > DHT_READ_INTERVAL_MAX_MS)
    {
        ESP_LOGW(TAG, "Ignoring invalid DHT22 interval stored in NVS: %lu ms",
                 (unsigned long)configured_interval_ms);
        return;
    }

    dht_read_interval_ms = configured_interval_ms;
}


static bool save_dht_read_interval(uint32_t interval_ms)
{
    nvs_handle_t handle;
    esp_err_t result = nvs_open("fire_config", NVS_READWRITE, &handle);

    if (result != ESP_OK)
    {
        ESP_LOGE(TAG, "Could not open runtime config in NVS: %s", esp_err_to_name(result));
        return false;
    }

    result = nvs_set_u32(handle, "dht_interval_ms", interval_ms);
    if (result == ESP_OK)
    {
        result = nvs_commit(handle);
    }
    nvs_close(handle);

    if (result != ESP_OK)
    {
        ESP_LOGE(TAG, "Could not save DHT22 interval to NVS: %s", esp_err_to_name(result));
        return false;
    }

    return true;
}


// ======================================================
// LED
// ======================================================

static void led_on(void)
{
    gpio_set_level(
        LED_GPIO,
        1
    );

    led_state = true;
}


static void led_off(void)
{
    gpio_set_level(
        LED_GPIO,
        0
    );

    led_state = false;
}


// ======================================================
// BUZZER
// ======================================================

static void buzzer_on(void)
{
    gpio_set_level(
        BUZZER_GPIO,
        BUZZER_ON
    );

    buzzer_running = true;
}


static void buzzer_off(void)
{
    gpio_set_level(
        BUZZER_GPIO,
        BUZZER_OFF
    );

    buzzer_running = false;
}


// ======================================================
// RELAY / PUMP
// ======================================================

static void pump_on(void)
{
    gpio_set_level(
        RELAY_GPIO,
        RELAY_ON
    );

    if (!pump_running)
    {
        pump_running = true;

        last_pump_change_ms =
            now_ms();

        ESP_LOGW(
            TAG,
            "PUMP ON"
        );
    }
}


static void pump_off(void)
{
    gpio_set_level(
        RELAY_GPIO,
        RELAY_OFF
    );

    if (pump_running)
    {
        pump_running = false;

        last_pump_change_ms =
            now_ms();

        ESP_LOGI(
            TAG,
            "PUMP OFF"
        );
    }
}


// ======================================================
// OUTPUT INITIALIZATION
// ======================================================

static void outputs_init(void)
{
    gpio_config_t cfg =
    {
        .pin_bit_mask =
            (1ULL << LED_GPIO) |
            (1ULL << BUZZER_GPIO) |
            (1ULL << RELAY_GPIO),

        .mode =
            GPIO_MODE_OUTPUT,

        .pull_up_en =
            GPIO_PULLUP_DISABLE,

        .pull_down_en =
            GPIO_PULLDOWN_DISABLE,

        .intr_type =
            GPIO_INTR_DISABLE
    };


    ESP_ERROR_CHECK(
        gpio_config(&cfg)
    );


    led_off();

    buzzer_off();

    gpio_set_level(
        RELAY_GPIO,
        RELAY_OFF
    );


    pump_running = false;
    pump_off_deadline_ms = 0;
}


// ======================================================
// ADC INITIALIZATION
// ======================================================

static void adc_init(void)
{
    adc_oneshot_unit_init_cfg_t unit_cfg =
    {
        .unit_id =
            ADC_UNIT_1,

        .ulp_mode =
            ADC_ULP_MODE_DISABLE
    };


    ESP_ERROR_CHECK(
        adc_oneshot_new_unit(
            &unit_cfg,
            &adc1_handle
        )
    );


    adc_oneshot_chan_cfg_t channel_cfg =
    {
        .atten =
            ADC_ATTEN_DB_12,

        .bitwidth =
            ADC_BITWIDTH_DEFAULT
    };


    // Flame - GPIO6
    ESP_ERROR_CHECK(
        adc_oneshot_config_channel(
            adc1_handle,
            FLAME_CHANNEL,
            &channel_cfg
        )
    );


    // MQ-2 - GPIO5
    ESP_ERROR_CHECK(
        adc_oneshot_config_channel(
            adc1_handle,
            GAS_CHANNEL,
            &channel_cfg
        )
    );
}


// ======================================================
// READ FLAME
// ======================================================

static int read_flame(void)
{
    int total = 0;


    for (int i = 0; i < 5; i++)
    {
        int value = 0;


        ESP_ERROR_CHECK(
            adc_oneshot_read(
                adc1_handle,
                FLAME_CHANNEL,
                &value
            )
        );


        total += value;


        vTaskDelay(
            pdMS_TO_TICKS(3)
        );
    }


    return total / 5;
}


// ======================================================
// READ GAS MQ-2
// ======================================================

static int read_gas(void)
{
    int total = 0;


    for (int i = 0; i < 5; i++)
    {
        int value = 0;


        ESP_ERROR_CHECK(
            adc_oneshot_read(
                adc1_handle,
                GAS_CHANNEL,
                &value
            )
        );


        total += value;


        vTaskDelay(
            pdMS_TO_TICKS(3)
        );
    }


    return total / 5;
}


// ======================================================
// DHT22
// ======================================================

static int wait_for_dht_level(
    int level,
    int timeout_us
)
{
    const int64_t started_us = esp_timer_get_time();

    while (gpio_get_level(DHT_GPIO) == level)
    {
        const int64_t elapsed_us = esp_timer_get_time() - started_us;
        if (elapsed_us >= timeout_us)
        {
            return -1;
        }
    }

    return (int)(esp_timer_get_time() - started_us);
}


// ======================================================
// READ DHT22
// ======================================================

static int dht22_read(
    float *temperature,
    float *humidity
)
{
    uint8_t data[5] =
    {
        0
    };


    // --------------------------
    // Start signal
    // --------------------------

    ESP_ERROR_CHECK(gpio_set_direction(DHT_GPIO, GPIO_MODE_OUTPUT_OD));
    ESP_ERROR_CHECK(gpio_set_level(DHT_GPIO, 0));
    vTaskDelay(pdMS_TO_TICKS(18));

    // GPIO is open-drain: writing 1 releases DATA for the sensor response.
    ESP_ERROR_CHECK(gpio_set_level(DHT_GPIO, 1));
    esp_rom_delay_us(30);
    ESP_ERROR_CHECK(gpio_set_direction(DHT_GPIO, GPIO_MODE_INPUT));
    ESP_ERROR_CHECK(gpio_pullup_en(DHT_GPIO));
    ESP_ERROR_CHECK(gpio_pulldown_dis(DHT_GPIO));


    // --------------------------
    // Sensor response
    // --------------------------

    portENTER_CRITICAL(&dht_mux);

    if (
        wait_for_dht_level(
            1,
            250
        ) < 0
    )
    {
        portEXIT_CRITICAL(&dht_mux);
        ESP_LOGW(TAG, "No DHT22 response on GPIO%d (DATA level=%d)",
                 DHT_GPIO, gpio_get_level(DHT_GPIO));
        return -2;
    }


    if (
        wait_for_dht_level(
            0,
            250
        ) < 0
    )
    {
        portEXIT_CRITICAL(&dht_mux);
        return -3;
    }


    if (
        wait_for_dht_level(
            1,
            250
        ) < 0
    )
    {
        portEXIT_CRITICAL(&dht_mux);
        return -4;
    }


    // --------------------------
    // Read 40 bits
    // --------------------------

    for (
        int i = 0;
        i < 40;
        i++
    )
    {
        if (
            wait_for_dht_level(
                0,
                120
            ) < 0
        )
        {
            portEXIT_CRITICAL(&dht_mux);
            return -5;
        }


        int high_us =
            wait_for_dht_level(
                1,
                140
            );


        if (
            high_us < 0
        )
        {
            portEXIT_CRITICAL(&dht_mux);
            return -6;
        }


        data[i / 8] <<= 1;


        // bit 1 ~ 70us
        // bit 0 ~ 26us

        if (
            high_us > 40
        )
        {
            data[i / 8] |= 1;
        }
    }

    portEXIT_CRITICAL(&dht_mux);


    // --------------------------
    // Check checksum
    // --------------------------

    uint8_t checksum =
        (uint8_t)(
            data[0] +
            data[1] +
            data[2] +
            data[3]
        );


    if (
        checksum
        != data[4]
    )
    {
        return -7;
    }


    // --------------------------
    // Convert humidity
    // --------------------------

    uint16_t raw_humidity =
        (
            (uint16_t)data[0]
            << 8
        )
        |
        data[1];


    *humidity =
        raw_humidity
        /
        10.0f;


    // --------------------------
    // Convert temperature
    // --------------------------

    uint16_t raw_temperature =
        (
            (uint16_t)(
                data[2]
                & 0x7F
            )
            << 8
        )
        |
        data[3];


    *temperature =
        raw_temperature
        /
        10.0f;


    if (
        data[2]
        & 0x80
    )
    {
        *temperature =
            -*temperature;
    }


    return 0;
}


// ======================================================
// ENTER FIRE STATE
// ======================================================

static void enter_fire_state(
    int flame_adc
)
{
    system_state =
        STATE_FIRE;


    fire_counter = 0;

    clear_counter = 0;

    pump_off_deadline_ms = 0;


    ESP_LOGE(
        TAG,
        "================================"
    );


    ESP_LOGE(
        TAG,
        "FIRE DETECTED! Flame ADC = %d",
        flame_adc
    );


    ESP_LOGE(
        TAG,
        "================================"
    );


    buzzer_on();

    led_on();


    last_led_toggle_ms =
        now_ms();
}


// ======================================================
// LEAVE FIRE STATE
// ======================================================

static void leave_fire_state(void)
{
    system_state =
        STATE_NORMAL;


    fire_counter = 0;

    clear_counter = 0;


    buzzer_off();

    led_off();

    if (
        pump_running
    )
    {
        pump_off_deadline_ms =
            now_ms()
            +
            PUMP_STOP_DELAY_MS;

        ESP_LOGI(
            TAG,
            "PUMP OFF scheduled in %d ms",
            PUMP_STOP_DELAY_MS
        );
    }


    ESP_LOGI(
        TAG,
        "================================"
    );


    ESP_LOGI(
        TAG,
        "FIRE CLEARED -> SYSTEM NORMAL"
    );


    ESP_LOGI(
        TAG,
        "================================"
    );
}


// ======================================================
// FIRE DETECTION
// ======================================================

static void update_fire_detection(
    int flame_adc
)
{
    // --------------------------
    // NORMAL STATE
    // --------------------------

    if (
        system_state
        == STATE_NORMAL
    )
    {
        if (
            flame_adc
            < FLAME_ON_THRESHOLD
        )
        {
            fire_counter++;


            ESP_LOGW(
                TAG,
                "Possible fire %d/%d | ADC=%d",
                fire_counter,
                FIRE_CONFIRM_COUNT,
                flame_adc
            );


            if (
                fire_counter
                >= FIRE_CONFIRM_COUNT
            )
            {
                enter_fire_state(
                    flame_adc
                );
            }
        }

        else
        {
            fire_counter = 0;
        }
    }


    // --------------------------
    // FIRE STATE
    // --------------------------

    else
    {
        if (
            flame_adc
            > FLAME_OFF_THRESHOLD
        )
        {
            clear_counter++;


            ESP_LOGI(
                TAG,
                "Checking clear %d/%d | ADC=%d",
                clear_counter,
                FIRE_CLEAR_COUNT,
                flame_adc
            );


            if (
                clear_counter
                >= FIRE_CLEAR_COUNT
            )
            {
                leave_fire_state();
            }
        }

        else
        {
            clear_counter = 0;
        }
    }
}


// ======================================================
// FIRE OUTPUTS
// ======================================================

static void update_fire_outputs(void)
{
    int64_t now =
        now_ms();

    if (
        system_state
        != STATE_FIRE
    )
    {
        if (
            pump_running
            &&
            pump_off_deadline_ms
            > 0
            &&
            now
            >= pump_off_deadline_ms
        )
        {
            pump_off();

            pump_off_deadline_ms = 0;
        }

        return;
    }


    pump_off_deadline_ms = 0;


    // --------------------------
    // BUZZER
    // --------------------------

    buzzer_on();


    // --------------------------
    // PUMP
    // --------------------------

    pump_on();


    // --------------------------
    // LED BLINK
    // --------------------------

    if (
        now
        - last_led_toggle_ms
        >= LED_BLINK_MS
    )
    {
        if (
            led_state
        )
        {
            led_off();
        }

        else
        {
            led_on();
        }


        last_led_toggle_ms =
            now;
    }

}


// ======================================================
// MQTT PAYLOAD HELPERS
// ======================================================

static void json_add_float_or_null(
    cJSON *root,
    const char *name,
    float value
)
{
    if (
        isnan(value)
    )
    {
        cJSON_AddNullToObject(
            root,
            name
        );
    }

    else
    {
        cJSON_AddNumberToObject(
            root,
            name,
            value
        );
    }
}


static const char *json_get_string(
    cJSON *root,
    const char *name
)
{
    cJSON *item =
        cJSON_GetObjectItem(
            root,
            name
        );

    if (
        cJSON_IsString(item)
        && item->valuestring
    )
    {
        return item->valuestring;
    }

    return "";
}


static void mqtt_publish_json(
    const char *topic,
    cJSON *root,
    int qos
)
{
    if (
        mqtt_client
        == NULL
    )
    {
        return;
    }

    char *payload =
        cJSON_PrintUnformatted(
            root
        );

    if (
        payload
        == NULL
    )
    {
        return;
    }

    esp_mqtt_client_publish(
        mqtt_client,
        topic,
        payload,
        0,
        qos,
        0
    );

    cJSON_free(
        payload
    );
}


static void mqtt_publish_command_ack(
    const char *command_uuid,
    const char *target,
    const char *action,
    const char *status,
    const char *message
)
{
    char topic[128];

    snprintf(
        topic,
        sizeof(topic),
        "%s/devices/%s/commands/ack",
        MQTT_TOPIC_PREFIX,
        DEVICE_CODE
    );

    cJSON *root =
        cJSON_CreateObject();

    if (
        root
        == NULL
    )
    {
        return;
    }

    cJSON_AddStringToObject(root, "command_uuid", command_uuid);
    cJSON_AddStringToObject(root, "device_code", DEVICE_CODE);
    cJSON_AddStringToObject(root, "target", target);
    cJSON_AddStringToObject(root, "action", action);
    cJSON_AddStringToObject(root, "status", status);
    cJSON_AddStringToObject(root, "message", message);
    cJSON_AddBoolToObject(root, "pump_relay_state", pump_running);
    cJSON_AddBoolToObject(root, "buzzer_state", buzzer_running);
    cJSON_AddBoolToObject(root, "led_state", led_state);
    cJSON_AddStringToObject(root, "operating_mode", auto_mode ? "auto" : "manual");

    mqtt_publish_json(
        topic,
        root,
        1
    );

    cJSON_Delete(
        root
    );
}


static void mqtt_publish_telemetry(
    int flame_adc,
    int gas_adc
)
{
    char topic[128];

    snprintf(
        topic,
        sizeof(topic),
        "%s/devices/%s/telemetry",
        MQTT_TOPIC_PREFIX,
        DEVICE_CODE
    );

    cJSON *root =
        cJSON_CreateObject();

    if (
        root
        == NULL
    )
    {
        return;
    }

    cJSON_AddStringToObject(root, "device_code", DEVICE_CODE);
    cJSON_AddStringToObject(root, "area_code", AREA_CODE);
    cJSON_AddStringToObject(root, "area_name", AREA_NAME);
    cJSON_AddNumberToObject(root, "flame_adc", flame_adc);
    cJSON_AddNumberToObject(root, "mq2_adc", gas_adc);
    cJSON_AddStringToObject(root, "fire_state", system_state == STATE_FIRE ? "fire" : "normal");
    cJSON_AddStringToObject(root, "operating_mode", auto_mode ? "auto" : "manual");
    cJSON_AddBoolToObject(root, "pump_relay_state", pump_running);
    cJSON_AddBoolToObject(root, "buzzer_state", buzzer_running);
    cJSON_AddBoolToObject(root, "led_state", led_state);
    cJSON_AddStringToObject(root, "firmware_version", FIRMWARE_VERSION);

    json_add_float_or_null(
        root,
        "temperature_c",
        last_temperature
    );

    json_add_float_or_null(
        root,
        "humidity_percent",
        last_humidity
    );

    if (
        last_dht_error
        == 0
    )
    {
        cJSON_AddNullToObject(
            root,
            "dht22_error_code"
        );
    }

    else
    {
        cJSON_AddNumberToObject(
            root,
            "dht22_error_code",
            last_dht_error
        );
    }

    mqtt_publish_json(
        topic,
        root,
        1
    );

    cJSON_Delete(
        root
    );
}


// ======================================================
// MQTT COMMANDS
// ======================================================

static void apply_mqtt_command(
    const char *command_uuid,
    const char *target,
    const char *action,
    const cJSON *configuration
)
{
    bool accepted =
        true;

    const char *message =
        "command applied";

    if (
        strcmp(target, "mode")
        == 0
    )
    {
        if (
            strcmp(action, "auto")
            == 0
        )
        {
            auto_mode =
                true;
        }

        else if (
            strcmp(action, "manual")
            == 0
        )
        {
            auto_mode =
                false;
        }

        else if (
            strcmp(action, "reset")
            == 0
        )
        {
            auto_mode =
                true;

            if (
                system_state
                == STATE_NORMAL
            )
            {
                buzzer_off();
                led_off();
                pump_off();
            }
        }

        else
        {
            accepted =
                false;
            message =
                "unsupported mode action";
        }
    }

    else if (
        strcmp(target, "pump")
        == 0
    )
    {
        if (
            strcmp(action, "on")
            == 0
        )
        {
            if (
                system_state
                == STATE_FIRE
            )
            {
                pump_on();
            }

            else
            {
                pump_off();
                accepted =
                    false;
                message =
                    "pump on blocked: local fire state is normal";
            }
        }

        else if (
            strcmp(action, "toggle")
            == 0
        )
        {
            if (
                pump_running
            )
            {
                pump_off();
            }

            else
            {
                if (
                    system_state
                    == STATE_FIRE
                )
                {
                    pump_on();
                }

                else
                {
                    pump_off();
                    accepted =
                        false;
                    message =
                        "pump toggle blocked: local fire state is normal";
                }
            }
        }

        else if (
            strcmp(action, "off")
            == 0
        )
        {
            pump_off();
        }

        else
        {
            accepted =
                false;
            message =
                "unsupported pump action";
        }
    }

    else if (
        strcmp(target, "buzzer")
        == 0
    )
    {
        if (
            strcmp(action, "on")
            == 0
        )
        {
            buzzer_on();
        }

        else if (
            strcmp(action, "toggle")
            == 0
        )
        {
            if (
                buzzer_running
            )
            {
                buzzer_off();
            }

            else
            {
                buzzer_on();
            }
        }

        else if (
            strcmp(action, "off")
            == 0
            || strcmp(action, "silence")
            == 0
        )
        {
            buzzer_off();
        }

        else
        {
            accepted =
                false;
            message =
                "unsupported buzzer action";
        }
    }

    else if (
        strcmp(target, "led")
        == 0
    )
    {
        if (
            strcmp(action, "on")
            == 0
        )
        {
            led_on();
        }

        else if (
            strcmp(action, "toggle")
            == 0
        )
        {
            if (
                led_state
            )
            {
                led_off();
            }

            else
            {
                led_on();
            }
        }

        else if (
            strcmp(action, "off")
            == 0
        )
        {
            led_off();
        }

        else
        {
            accepted =
                false;
            message =
                "unsupported led action";
        }
    }

    else if (
        strcmp(target, "config")
        == 0
    )
    {
        const cJSON *interval_value =
            cJSON_IsObject(configuration)
                ? cJSON_GetObjectItemCaseSensitive(
                    configuration,
                    "dht_sampling_period_ms"
                )
                : NULL;

        if (
            strcmp(action, "set") != 0
            || !cJSON_IsNumber(interval_value)
            || !isfinite(interval_value->valuedouble)
            || interval_value->valuedouble < DHT_READ_INTERVAL_MIN_MS
            || interval_value->valuedouble > DHT_READ_INTERVAL_MAX_MS
            || interval_value->valuedouble != (double)(uint32_t)interval_value->valuedouble
        )
        {
            accepted = false;
            message = "invalid DHT22 sampling period";
        }
        else
        {
            uint32_t interval_ms = (uint32_t)interval_value->valuedouble;
            if (save_dht_read_interval(interval_ms))
            {
                dht_read_interval_ms = interval_ms;
                last_dht_read_ms = now_ms();
                ESP_LOGI(TAG, "DHT22 sampling period updated to %lu ms",
                         (unsigned long)dht_read_interval_ms);
                message = "DHT22 sampling period saved to NVS";
            }
            else
            {
                accepted = false;
                message = "could not save DHT22 sampling period to NVS";
            }
        }
    }

    else
    {
        accepted =
            false;
        message =
            "unsupported target";
    }

    ESP_LOGI(
        TAG,
        "MQTT command uuid=%s target=%s action=%s result=%s",
        command_uuid,
        target,
        action,
        accepted ? "acknowledged" : "failed"
    );

    mqtt_publish_command_ack(
        command_uuid,
        target,
        action,
        accepted ? "acknowledged" : "failed",
        message
    );
}


static void handle_mqtt_command(
    const char *data,
    int len
)
{
    char *json =
        calloc(
            len + 1,
            sizeof(char)
        );

    if (
        json
        == NULL
    )
    {
        return;
    }

    memcpy(
        json,
        data,
        len
    );

    cJSON *root =
        cJSON_Parse(
            json
        );

    free(
        json
    );

    if (
        root
        == NULL
    )
    {
        ESP_LOGW(
            TAG,
            "Invalid MQTT command JSON"
        );

        return;
    }

    const char *command_uuid =
        json_get_string(
            root,
            "command_uuid"
        );

    const char *target =
        json_get_string(
            root,
            "target"
        );

    const char *action =
        json_get_string(
            root,
            "action"
        );

    const cJSON *configuration =
        cJSON_GetObjectItemCaseSensitive(
            root,
            "config"
        );

    if (
        strlen(command_uuid)
        == 0
        || strlen(target)
        == 0
        || strlen(action)
        == 0
    )
    {
        ESP_LOGW(
            TAG,
            "MQTT command missing command_uuid/target/action"
        );

        cJSON_Delete(
            root
        );

        return;
    }

    apply_mqtt_command(
        command_uuid,
        target,
        action,
        configuration
    );

    cJSON_Delete(
        root
    );
}


// ======================================================
// WIFI / MQTT
// ======================================================

static void mqtt_event_handler(
    void *handler_args,
    esp_event_base_t base,
    int32_t event_id,
    void *event_data
)
{
    esp_mqtt_event_handle_t event =
        event_data;

    switch (
        (esp_mqtt_event_id_t)event_id
    )
    {
        case MQTT_EVENT_CONNECTED:
        {
            char command_topic[128];

            snprintf(
                command_topic,
                sizeof(command_topic),
                "%s/devices/%s/commands",
                MQTT_TOPIC_PREFIX,
                DEVICE_CODE
            );

            ESP_LOGI(
                TAG,
                "MQTT connected, subscribe %s",
                command_topic
            );

            esp_mqtt_client_subscribe(
                mqtt_client,
                command_topic,
                1
            );

            break;
        }

        case MQTT_EVENT_DISCONNECTED:
            ESP_LOGW(
                TAG,
                "MQTT disconnected"
            );
            break;

        case MQTT_EVENT_DATA:
            handle_mqtt_command(
                event->data,
                event->data_len
            );
            break;

        default:
            break;
    }
}


static void mqtt_start(void)
{
    if (
        mqtt_client
        != NULL
    )
    {
        esp_mqtt_client_reconnect(
            mqtt_client
        );

        return;
    }

    esp_mqtt_client_config_t mqtt_cfg =
    {
        .broker.address.uri =
            MQTT_BROKER_URI,

        .credentials.username =
            strlen(MQTT_USERNAME) > 0 ? MQTT_USERNAME : NULL,

        .credentials.client_id =
            DEVICE_CODE,

        .credentials.authentication.password =
            strlen(MQTT_PASSWORD) > 0 ? MQTT_PASSWORD : NULL,
    };

    mqtt_client =
        esp_mqtt_client_init(
            &mqtt_cfg
        );

    if (
        mqtt_client
        == NULL
    )
    {
        ESP_LOGE(
            TAG,
            "MQTT init failed"
        );

        return;
    }

    esp_mqtt_client_register_event(
        mqtt_client,
        ESP_EVENT_ANY_ID,
        mqtt_event_handler,
        NULL
    );

    esp_mqtt_client_start(
        mqtt_client
    );
}


static void wifi_event_handler(
    void *arg,
    esp_event_base_t event_base,
    int32_t event_id,
    void *event_data
)
{
    if (
        event_base
        == WIFI_EVENT
        && event_id
        == WIFI_EVENT_STA_START
    )
    {
        esp_wifi_connect();
    }

    else if (
        event_base
        == WIFI_EVENT
        && event_id
        == WIFI_EVENT_STA_DISCONNECTED
    )
    {
        wifi_event_sta_disconnected_t *disconnect =
            (wifi_event_sta_disconnected_t *)event_data;

        xEventGroupClearBits(
            wifi_event_group,
            WIFI_CONNECTED_BIT
        );

        ESP_LOGW(
            TAG,
            "WiFi disconnected, reason=%d",
            disconnect ? disconnect->reason : -1
        );

        if (
            wifi_retry_count
            < WIFI_MAX_RETRY
        )
        {
            esp_wifi_connect();

            wifi_retry_count++;

            ESP_LOGW(
                TAG,
                "Retry WiFi connection %d/%d",
                wifi_retry_count,
                WIFI_MAX_RETRY
            );
        }

        else
        {
            xEventGroupSetBits(
                wifi_event_group,
                WIFI_FAIL_BIT
            );
        }
    }

    else if (
        event_base
        == IP_EVENT
        && event_id
        == IP_EVENT_STA_GOT_IP
    )
    {
        ip_event_got_ip_t *event =
            (ip_event_got_ip_t *)event_data;

        ESP_LOGI(
            TAG,
            "WiFi connected, IP=" IPSTR,
            IP2STR(&event->ip_info.ip)
        );

        wifi_retry_count =
            0;

        xEventGroupSetBits(
            wifi_event_group,
            WIFI_CONNECTED_BIT
        );

        mqtt_start();
    }
}


static void wifi_init_sta(void)
{
    wifi_event_group =
        xEventGroupCreate();

    ESP_ERROR_CHECK(
        esp_netif_init()
    );

    ESP_ERROR_CHECK(
        esp_event_loop_create_default()
    );

    esp_netif_create_default_wifi_sta();

    wifi_init_config_t cfg =
        WIFI_INIT_CONFIG_DEFAULT();

    ESP_ERROR_CHECK(
        esp_wifi_init(
            &cfg
        )
    );

    ESP_ERROR_CHECK(
        esp_event_handler_register(
            WIFI_EVENT,
            ESP_EVENT_ANY_ID,
            &wifi_event_handler,
            NULL
        )
    );

    ESP_ERROR_CHECK(
        esp_event_handler_register(
            IP_EVENT,
            IP_EVENT_STA_GOT_IP,
            &wifi_event_handler,
            NULL
        )
    );

    wifi_config_t wifi_config =
    {
        .sta =
        {
            .ssid = WIFI_SSID,
            .password = WIFI_PASSWORD,
            .scan_method = WIFI_ALL_CHANNEL_SCAN,
            .sort_method = WIFI_CONNECT_AP_BY_SIGNAL,
            .threshold.authmode = WIFI_AUTH_WPA2_PSK,
            .threshold.rssi = -90,
        },
    };

    ESP_ERROR_CHECK(
        esp_wifi_set_mode(
            WIFI_MODE_STA
        )
    );

    ESP_ERROR_CHECK(
        esp_wifi_set_config(
            WIFI_IF_STA,
            &wifi_config
        )
    );

    ESP_ERROR_CHECK(
        esp_wifi_set_ps(
            WIFI_PS_NONE
        )
    );

    ESP_ERROR_CHECK(
        esp_wifi_start()
    );

    ESP_LOGI(
        TAG,
        "WiFi init started, SSID=%s",
        WIFI_SSID
    );
}


// ======================================================
// MAIN
// ======================================================

void app_main(void)
{
    ESP_LOGI(
        TAG,
        "ESP32-S3 SMART FIRE SYSTEM"
    );


    ESP_LOGI(
        TAG,
        "LED      : GPIO%d",
        LED_GPIO
    );


    ESP_LOGI(
        TAG,
        "DHT22    : GPIO%d",
        DHT_GPIO
    );


    ESP_LOGI(
        TAG,
        "MQ-2 AO  : GPIO%d / ADC1_CH4",
        GAS_GPIO
    );


    ESP_LOGI(
        TAG,
        "Flame AO : GPIO%d / ADC1_CH5",
        FLAME_GPIO
    );


    ESP_LOGI(
        TAG,
        "Buzzer   : GPIO%d",
        BUZZER_GPIO
    );


    ESP_LOGI(
        TAG,
        "Relay    : GPIO%d",
        RELAY_GPIO
    );


    // ==================================================
    // INIT
    // ==================================================

    outputs_init();

    adc_init();

    esp_err_t nvs_ret =
        nvs_flash_init();

    if (
        nvs_ret
        == ESP_ERR_NVS_NO_FREE_PAGES
        || nvs_ret
        == ESP_ERR_NVS_NEW_VERSION_FOUND
    )
    {
        ESP_ERROR_CHECK(
            nvs_flash_erase()
        );

        nvs_ret =
            nvs_flash_init();
    }

    ESP_ERROR_CHECK(
        nvs_ret
    );

    load_runtime_config();
    ESP_LOGI(TAG, "DHT22 sampling period: %lu ms",
             (unsigned long)dht_read_interval_ms);

    wifi_init_sta();


    dht22_gpio_init();
    ESP_LOGI(TAG, "DHT22 DATA GPIO%d initialized open-drain, idle level=%d",
             DHT_GPIO, gpio_get_level(DHT_GPIO));


    // DHT22 cần thời gian ổn định
    vTaskDelay(
        pdMS_TO_TICKS(2000)
    );


    last_dht_read_ms =
        now_ms()
        -
        dht_read_interval_ms;


    // ==================================================
    // MAIN LOOP
    // ==================================================

    while (1)
    {
        // --------------------------
        // Read ADC sensors
        // --------------------------

        int flame_adc =
            read_flame();


        int gas_adc =
            read_gas();


        // --------------------------
        // Fire logic
        // --------------------------

        update_fire_detection(
            flame_adc
        );


        update_fire_outputs();


        // --------------------------
        // DHT22 theo chu ky runtime: mac dinh trong config.h, co the cap nhat qua MQTT/NVS
        // --------------------------

        int64_t now =
            now_ms();


        if (
            now
            - last_dht_read_ms
            >= dht_read_interval_ms
        )
        {
            float temperature =
                0.0f;


            float humidity =
                0.0f;


            int dht_result =
                dht22_read(
                    &temperature,
                    &humidity
                );


            // ----------------------
            // DHT OK
            // ----------------------

            if (
                dht_result
                == 0
            )
            {
                last_temperature =
                    temperature;


                last_humidity =
                    humidity;

                last_dht_error =
                    0;


                ESP_LOGI(
                    TAG,

                    "Flame=%d | Gas=%d | Temp=%.1f C | Humidity=%.1f %% | State=%s | Pump=%s",

                    flame_adc,

                    gas_adc,

                    last_temperature,

                    last_humidity,

                    system_state
                        == STATE_FIRE
                        ? "FIRE"
                        : "NORMAL",

                    pump_running
                        ? "ON"
                        : "OFF"
                );
            }


            // ----------------------
            // DHT ERROR
            // ----------------------

            else
            {
                last_temperature = NAN;
                last_humidity = NAN;
                last_dht_error =
                    dht_result;

                ESP_LOGW(
                    TAG,

                    "Flame=%d | Gas=%d | DHT22 error=%d | State=%s | Pump=%s",

                    flame_adc,

                    gas_adc,

                    dht_result,

                    system_state
                        == STATE_FIRE
                        ? "FIRE"
                        : "NORMAL",

                    pump_running
                        ? "ON"
                        : "OFF"
                );
            }


            last_dht_read_ms =
                now_ms();


            if (
                now_ms()
                - last_telemetry_publish_ms
                >= dht_read_interval_ms
            )
            {
                mqtt_publish_telemetry(
                    flame_adc,
                    gas_adc
                );

                last_telemetry_publish_ms =
                    now_ms();
            }
        }


        vTaskDelay(
            pdMS_TO_TICKS(
                SENSOR_LOOP_MS
            )
        );
    }
}
