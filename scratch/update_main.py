import os

file_path = r'C:\Class\IOT\project_final_iot\esp32-firmware\main\main.c'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add runtime config definition
config_def = """
#include "config.h"

typedef struct {
    int flame_on_threshold;
    int flame_off_threshold;
    uint32_t pump_start_delay_ms;
    uint32_t pump_stop_delay_ms;
} runtime_config_t;

static runtime_config_t runtime_config = {
    .flame_on_threshold = 1850,
    .flame_off_threshold = 2500,
    .pump_start_delay_ms = 300,
    .pump_stop_delay_ms = 3000,
};

static int64_t fire_condition_start_ms = 0;
"""
content = content.replace('\n#include "config.h"\n', config_def)

# 2. Update load_runtime_config to read everything
load_runtime_config = """static void load_runtime_config(void)
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
    if (nvs_get_u32(handle, "dht_interval_ms", &configured_interval_ms) == ESP_OK) {
        if (configured_interval_ms >= DHT_READ_INTERVAL_MIN_MS && configured_interval_ms <= DHT_READ_INTERVAL_MAX_MS) {
            dht_read_interval_ms = configured_interval_ms;
        }
    }

    int32_t val;
    if (nvs_get_i32(handle, "flame_on", &val) == ESP_OK) runtime_config.flame_on_threshold = val;
    if (nvs_get_i32(handle, "flame_off", &val) == ESP_OK) runtime_config.flame_off_threshold = val;
    if (nvs_get_i32(handle, "pump_start", &val) == ESP_OK) runtime_config.pump_start_delay_ms = val;
    if (nvs_get_i32(handle, "pump_stop", &val) == ESP_OK) runtime_config.pump_stop_delay_ms = val;

    nvs_close(handle);
}

static bool save_runtime_config(uint32_t dht_interval_ms, int flame_on, int flame_off, uint32_t pump_start, uint32_t pump_stop)
{
    nvs_handle_t handle;
    esp_err_t result = nvs_open("fire_config", NVS_READWRITE, &handle);

    if (result != ESP_OK) return false;

    nvs_set_u32(handle, "dht_interval_ms", dht_interval_ms);
    nvs_set_i32(handle, "flame_on", flame_on);
    nvs_set_i32(handle, "flame_off", flame_off);
    nvs_set_i32(handle, "pump_start", pump_start);
    nvs_set_i32(handle, "pump_stop", pump_stop);

    result = nvs_commit(handle);
    nvs_close(handle);

    return result == ESP_OK;
}
"""
import re
content = re.sub(r'static void load_runtime_config\(void\).*?return true;\n}', load_runtime_config, content, flags=re.DOTALL)


# 3. Fix enter and leave fire state references to PUMP_STOP_DELAY_MS
enter_leave_regex = r'pump_off_deadline_ms =[\s\n]*now_ms\(\)[\s\n]*\+[\s\n]*PUMP_STOP_DELAY_MS;'
content = re.sub(enter_leave_regex, 'pump_off_deadline_ms =\n            now_ms()\n            +\n            runtime_config.pump_stop_delay_ms;', content)
content = content.replace('PUMP_STOP_DELAY_MS', 'runtime_config.pump_stop_delay_ms')

# 4. Fix update_fire_detection
update_fire = """static void update_fire_detection(
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
            <= runtime_config.flame_on_threshold
        )
        {
            if (fire_condition_start_ms == 0) {
                fire_condition_start_ms = now_ms();
            }

            int64_t elapsed = now_ms() - fire_condition_start_ms;

            ESP_LOGW(
                TAG,
                "Possible fire elapsed %lld/%lu ms | ADC=%d",
                (long long)elapsed,
                (unsigned long)runtime_config.pump_start_delay_ms,
                flame_adc
            );

            if (
                elapsed
                >= runtime_config.pump_start_delay_ms
            )
            {
                enter_fire_state(
                    flame_adc
                );
            }
        }
        else
        {
            fire_condition_start_ms = 0;
        }
    }


    // --------------------------
    // FIRE STATE
    // --------------------------

    else
    {
        if (
            flame_adc
            >= runtime_config.flame_off_threshold
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
}"""
content = re.sub(r'static void update_fire_detection\(\s*int flame_adc\s*\).*?    }\n}', update_fire, content, flags=re.DOTALL)

# 5. Fix handle_mqtt_command MQTT payload parsing
mqtt_parse = """    else if (
        strcmp(target, "config")
        == 0
    )
    {
        const cJSON *interval_value = cJSON_IsObject(configuration) ? cJSON_GetObjectItemCaseSensitive(configuration, "dht_sampling_period_ms") : NULL;
        const cJSON *flame_on_val = cJSON_IsObject(configuration) ? cJSON_GetObjectItemCaseSensitive(configuration, "flame_on_threshold") : NULL;
        const cJSON *flame_off_val = cJSON_IsObject(configuration) ? cJSON_GetObjectItemCaseSensitive(configuration, "flame_off_threshold") : NULL;
        const cJSON *pump_start_val = cJSON_IsObject(configuration) ? cJSON_GetObjectItemCaseSensitive(configuration, "pump_start_delay_ms") : NULL;
        const cJSON *pump_stop_val = cJSON_IsObject(configuration) ? cJSON_GetObjectItemCaseSensitive(configuration, "pump_stop_delay_ms") : NULL;

        if (
            strcmp(action, "set") != 0
            || !cJSON_IsNumber(interval_value)
            || !cJSON_IsNumber(flame_on_val)
            || !cJSON_IsNumber(flame_off_val)
            || !cJSON_IsNumber(pump_start_val)
            || !cJSON_IsNumber(pump_stop_val)
        )
        {
            accepted = false;
            message = "invalid config payload";
        }
        else
        {
            uint32_t interval_ms = (uint32_t)interval_value->valuedouble;
            int flame_on = (int)flame_on_val->valuedouble;
            int flame_off = (int)flame_off_val->valuedouble;
            uint32_t pump_start = (uint32_t)pump_start_val->valuedouble;
            uint32_t pump_stop = (uint32_t)pump_stop_val->valuedouble;

            if (save_runtime_config(interval_ms, flame_on, flame_off, pump_start, pump_stop))
            {
                dht_read_interval_ms = interval_ms;
                runtime_config.flame_on_threshold = flame_on;
                runtime_config.flame_off_threshold = flame_off;
                runtime_config.pump_start_delay_ms = pump_start;
                runtime_config.pump_stop_delay_ms = pump_stop;
                
                last_dht_read_ms = now_ms();
                ESP_LOGI(TAG, "Config updated & saved to NVS");
                message = "Config saved to NVS";
            }
            else
            {
                accepted = false;
                message = "could not save config to NVS";
            }
        }
    }"""
content = re.sub(r'    else if \(\s*strcmp\(target, "config"\)\s*== 0\s*\)\s*\{.*?    \}', mqtt_parse, content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
