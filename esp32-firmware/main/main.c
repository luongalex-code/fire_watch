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
#include "driver/i2c.h"
#include "esp_adc/adc_oneshot.h"
#include "cJSON.h"

#include "config.h"

typedef struct {
    int flame_on_threshold;
    int flame_off_threshold;
    int mq2_smoke_on_threshold;
    int mq2_smoke_off_threshold;
    uint32_t pump_start_delay_ms;
    uint32_t pump_stop_delay_ms;
} runtime_config_t;

static runtime_config_t runtime_config = {
    .flame_on_threshold = FLAME_ON_THRESHOLD,
    .flame_off_threshold = FLAME_OFF_THRESHOLD,
    .mq2_smoke_on_threshold = MQ2_SMOKE_ON_THRESHOLD,
    .mq2_smoke_off_threshold = MQ2_SMOKE_OFF_THRESHOLD,
    .pump_start_delay_ms = 300,
    .pump_stop_delay_ms = 3000,
};

static int64_t fire_condition_start_ms = 0;


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
static int smoke_counter = 0;
static int smoke_clear_counter = 0;
static bool led_state = false;
static bool buzzer_running = false;
static bool pump_running = false;
static bool fan_running = false;
static bool mq2_smoke_detected = false;
static bool lcd_ready = false;
static bool lcd_fire_latched = false;
static bool auto_mode = true;

static int64_t last_led_toggle_ms = 0;
static int64_t last_pump_change_ms = 0;
static int64_t last_lcd_update_ms = 0;
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
    if (nvs_get_u32(handle, "dht_interval_ms", &configured_interval_ms) == ESP_OK) {
        if (configured_interval_ms >= DHT_READ_INTERVAL_MIN_MS && configured_interval_ms <= DHT_READ_INTERVAL_MAX_MS) {
            dht_read_interval_ms = configured_interval_ms;
        }
    }

    int32_t val;
    if (nvs_get_i32(handle, "flame_on", &val) == ESP_OK) runtime_config.flame_on_threshold = val;
    if (nvs_get_i32(handle, "flame_off", &val) == ESP_OK) runtime_config.flame_off_threshold = val;
    if (nvs_get_i32(handle, "mq2_on", &val) == ESP_OK) runtime_config.mq2_smoke_on_threshold = val;
    if (nvs_get_i32(handle, "mq2_off", &val) == ESP_OK) runtime_config.mq2_smoke_off_threshold = val;
    if (nvs_get_i32(handle, "pump_start", &val) == ESP_OK) runtime_config.pump_start_delay_ms = val;
    if (nvs_get_i32(handle, "pump_stop", &val) == ESP_OK) runtime_config.pump_stop_delay_ms = val;

    nvs_close(handle);
}

static bool save_runtime_config(
    uint32_t dht_interval_ms,
    int flame_on,
    int flame_off,
    int mq2_on,
    int mq2_off,
    uint32_t pump_start,
    uint32_t pump_stop
)
{
    nvs_handle_t handle;
    esp_err_t result = nvs_open("fire_config", NVS_READWRITE, &handle);

    if (result != ESP_OK) return false;

    nvs_set_u32(handle, "dht_interval_ms", dht_interval_ms);
    nvs_set_i32(handle, "flame_on", flame_on);
    nvs_set_i32(handle, "flame_off", flame_off);
    nvs_set_i32(handle, "mq2_on", mq2_on);
    nvs_set_i32(handle, "mq2_off", mq2_off);
    nvs_set_i32(handle, "pump_start", pump_start);
    nvs_set_i32(handle, "pump_stop", pump_stop);

    result = nvs_commit(handle);
    nvs_close(handle);

    return result == ESP_OK;
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
// FAN RELAY
// ======================================================

static void fan_on(void)
{
    gpio_set_level(
        FAN_RELAY_GPIO,
        FAN_RELAY_ON
    );

    if (!fan_running)
    {
        fan_running = true;
        ESP_LOGW(TAG, "FAN ON");
    }
}


static void fan_off(void)
{
    gpio_set_level(
        FAN_RELAY_GPIO,
        FAN_RELAY_OFF
    );

    if (fan_running)
    {
        fan_running = false;
        ESP_LOGI(TAG, "FAN OFF");
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
            (1ULL << RELAY_GPIO) |
            (1ULL << FAN_RELAY_GPIO),

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

    gpio_set_level(
        FAN_RELAY_GPIO,
        FAN_RELAY_OFF
    );

    pump_running = false;
    fan_running = false;
    pump_off_deadline_ms = 0;
}


// ======================================================
// LCD I2C 16x2 / PCF8574
// ======================================================

#define LCD_BACKLIGHT 0x08
#define LCD_ENABLE    0x04
#define LCD_RS        0x01

static esp_err_t lcd_i2c_write(uint8_t data)
{
    return i2c_master_write_to_device(
        LCD_I2C_PORT,
        LCD_I2C_ADDR,
        &data,
        1,
        pdMS_TO_TICKS(50)
    );
}


static esp_err_t lcd_pulse_enable(uint8_t data)
{
    esp_err_t result = lcd_i2c_write(data | LCD_ENABLE);
    if (result != ESP_OK) return result;

    esp_rom_delay_us(1);

    result = lcd_i2c_write(data & ~LCD_ENABLE);
    esp_rom_delay_us(50);
    return result;
}


static esp_err_t lcd_write4(uint8_t value, uint8_t mode)
{
    uint8_t data = (value & 0xF0) | LCD_BACKLIGHT | mode;
    return lcd_pulse_enable(data);
}


static esp_err_t lcd_send(uint8_t value, uint8_t mode)
{
    esp_err_t result = lcd_write4(value & 0xF0, mode);
    if (result != ESP_OK) return result;

    return lcd_write4((value << 4) & 0xF0, mode);
}


static esp_err_t lcd_command(uint8_t value)
{
    return lcd_send(value, 0);
}


static esp_err_t lcd_char(char value)
{
    return lcd_send((uint8_t)value, LCD_RS);
}


static void lcd_set_cursor(uint8_t col, uint8_t row)
{
    static const uint8_t row_offsets[] = {0x00, 0x40};
    if (row > 1) row = 1;

    lcd_command(0x80 | (col + row_offsets[row]));
}


static void lcd_print_padded(uint8_t row, const char *text)
{
    lcd_set_cursor(0, row);
    size_t length = strlen(text);

    for (int index = 0; index < LCD_COLS; index++)
    {
        char ch = index < (int)length ? text[index] : ' ';
        lcd_char(ch);
    }
}


static void lcd_init(void)
{
    i2c_config_t config =
    {
        .mode = I2C_MODE_MASTER,
        .sda_io_num = LCD_I2C_SDA_GPIO,
        .scl_io_num = LCD_I2C_SCL_GPIO,
        .sda_pullup_en = GPIO_PULLUP_ENABLE,
        .scl_pullup_en = GPIO_PULLUP_ENABLE,
        .master.clk_speed = LCD_I2C_FREQ_HZ,
    };

    esp_err_t result = i2c_param_config(LCD_I2C_PORT, &config);
    if (result != ESP_OK)
    {
        ESP_LOGW(TAG, "LCD I2C config failed: %s", esp_err_to_name(result));
        return;
    }

    result = i2c_driver_install(LCD_I2C_PORT, I2C_MODE_MASTER, 0, 0, 0);
    if (result != ESP_OK && result != ESP_ERR_INVALID_STATE)
    {
        ESP_LOGW(TAG, "LCD I2C driver install failed: %s", esp_err_to_name(result));
        return;
    }

    vTaskDelay(pdMS_TO_TICKS(50));

    if (
        lcd_write4(0x30, 0) != ESP_OK ||
        lcd_write4(0x30, 0) != ESP_OK ||
        lcd_write4(0x30, 0) != ESP_OK ||
        lcd_write4(0x20, 0) != ESP_OK ||
        lcd_command(0x28) != ESP_OK ||
        lcd_command(0x0C) != ESP_OK ||
        lcd_command(0x06) != ESP_OK ||
        lcd_command(0x01) != ESP_OK
    )
    {
        ESP_LOGW(TAG, "LCD I2C not detected at addr 0x%02X", LCD_I2C_ADDR);
        return;
    }

    vTaskDelay(pdMS_TO_TICKS(2));

    lcd_ready = true;
    lcd_print_padded(0, "SMART FIRE IOT");
    lcd_print_padded(1, "LCD READY");

    ESP_LOGI(
        TAG,
        "LCD I2C ready SDA=GPIO%d SCL=GPIO%d addr=0x%02X",
        LCD_I2C_SDA_GPIO,
        LCD_I2C_SCL_GPIO,
        LCD_I2C_ADDR
    );
}


static void lcd_prepare_status(
    bool fire_detected,
    bool smoke_detected,
    char line1[LCD_COLS + 1],
    char line2[LCD_COLS + 1]
)
{
    const char *top;
    const char *bottom;

    if (fire_detected)
    {
        top = "!!! BAO CHAY !!!";
        bottom = "RA KHOI KHU VUC!";
    }
    else if (smoke_detected)
    {
        top = "!!! KHOI/KHI GA!";
        bottom = "RA KHOI KHU VUC!";
    }
    else
    {
        top = "HE THONG AN TOAN";
        bottom = "DANG GIAM SAT...";
    }

    memset(line1, ' ', LCD_COLS);
    memset(line2, ' ', LCD_COLS);
    line1[LCD_COLS] = '\0';
    line2[LCD_COLS] = '\0';

    size_t top_len = strlen(top);
    size_t bottom_len = strlen(bottom);
    if (top_len > LCD_COLS) top_len = LCD_COLS;
    if (bottom_len > LCD_COLS) bottom_len = LCD_COLS;

    memcpy(line1, top, top_len);
    memcpy(line2, bottom, bottom_len);
}


static void lcd_render_status(void)
{
    if (!lcd_ready) return;

    char line1[LCD_COLS + 1];
    char line2[LCD_COLS + 1];

    lcd_prepare_status(
        lcd_fire_latched,
        mq2_smoke_detected,
        line1,
        line2
    );

    lcd_print_padded(0, line1);
    lcd_print_padded(1, line2);
}


static void lcd_clear_fire_alert(void)
{
    lcd_fire_latched = false;
    last_lcd_update_ms = 0;
    lcd_render_status();
}


static void lcd_update_status(int flame_adc, int gas_adc)
{
    (void)flame_adc;
    (void)gas_adc;

    if (!lcd_ready) return;

    int64_t now = now_ms();
    if (now - last_lcd_update_ms < LCD_UPDATE_MS) return;
    last_lcd_update_ms = now;

    if (system_state == STATE_FIRE)
    {
        lcd_fire_latched = true;
    }

    lcd_render_status();
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
// READ GAS MQ-2 AO
// ======================================================

static int read_gas(void)
{
    int total = 0;
    int value = 0;

    // MQ-2 AO can be noisy, so read multiple samples like the standalone MQ2 test.
    for (int i = 0; i < MQ2_SAMPLE_COUNT; i++)
    {
        ESP_ERROR_CHECK(
            adc_oneshot_read(
                adc1_handle,
                GAS_CHANNEL,
                &value
            )
        );

        total += value;

        vTaskDelay(
            pdMS_TO_TICKS(MQ2_SAMPLE_DELAY_MS)
        );
    }

    return total / MQ2_SAMPLE_COUNT;
}


static const char *mq2_level_text(
    int gas_adc
)
{
    if (gas_adc < 1000)
    {
        return "LOW";
    }

    if (gas_adc < 2500)
    {
        return "MEDIUM";
    }

    return "HIGH";
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
            runtime_config.pump_stop_delay_ms;

        ESP_LOGI(
            TAG,
            "PUMP OFF scheduled in %d ms",
            runtime_config.pump_stop_delay_ms
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
// MQ-2 SMOKE / GAS DETECTION
// ======================================================

static void update_smoke_detection(
    int gas_adc
)
{
    const bool smoke_on_level = gas_adc >= runtime_config.mq2_smoke_on_threshold;
    const bool smoke_off_level = gas_adc <= runtime_config.mq2_smoke_off_threshold;
    // Toan tu ba ngoi de doc nhanh trang thai MQ-2 AO:
    // ADC >= nguong bat ? CO_KHOI_KHI_GA : CHUA_DAT_NGUONG.
    const char *smoke_status_text = smoke_on_level ? "CO_KHOI_KHI_GA" : "CHUA_DAT_NGUONG";

    if (!mq2_smoke_detected)
    {
        if (smoke_on_level)
        {
            smoke_counter++;
            smoke_clear_counter = 0;

            if (smoke_counter >= MQ2_SMOKE_CONFIRM_COUNT)
            {
                mq2_smoke_detected = true;
                smoke_counter = 0;
                ESP_LOGW(
                    TAG,
                    "MQ-2 SMOKE/GAS DETECTED | ADC=%d | ON_THRESHOLD=%d | STATUS=%s",
                    gas_adc,
                    runtime_config.mq2_smoke_on_threshold,
                    smoke_status_text
                );
                fan_on();
            }
        }
        else
        {
            smoke_counter = 0;
        }

        return;
    }

    if (smoke_off_level)
    {
        smoke_clear_counter++;
        smoke_counter = 0;

        if (smoke_clear_counter >= MQ2_SMOKE_CLEAR_COUNT)
        {
            mq2_smoke_detected = false;
            smoke_clear_counter = 0;
            ESP_LOGI(
                TAG,
                "MQ-2 SMOKE/GAS CLEARED | ADC=%d | OFF_THRESHOLD=%d | STATUS=KHONG_CO",
                gas_adc,
                runtime_config.mq2_smoke_off_threshold
            );
            fan_off();
        }
    }
    else
    {
        smoke_clear_counter = 0;
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
    cJSON_AddBoolToObject(root, "fan_state", fan_running);
    cJSON_AddBoolToObject(root, "mq2_smoke_detected", mq2_smoke_detected);
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
    cJSON_AddBoolToObject(root, "mq2_smoke_detected", mq2_smoke_detected);
    cJSON_AddStringToObject(root, "fire_state", system_state == STATE_FIRE ? "fire" : "normal");
    cJSON_AddStringToObject(root, "operating_mode", auto_mode ? "auto" : "manual");
    cJSON_AddBoolToObject(root, "pump_relay_state", pump_running);
    cJSON_AddBoolToObject(root, "fan_state", fan_running);
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
        strcmp(target, "fan")
        == 0
    )
    {
        if (
            strcmp(action, "on")
            == 0
        )
        {
            fan_on();
        }

        else if (
            strcmp(action, "toggle")
            == 0
        )
        {
            if (
                fan_running
            )
            {
                fan_off();
            }

            else
            {
                fan_on();
            }
        }

        else if (
            strcmp(action, "off")
            == 0
        )
        {
            fan_off();
        }

        else
        {
            accepted =
                false;
            message =
                "unsupported fan action";
        }
    }

    else if (
        strcmp(target, "lcd")
        == 0
    )
    {
        if (
            strcmp(action, "clear")
            == 0
            || strcmp(action, "reset")
            == 0
            || strcmp(action, "off")
            == 0
        )
        {
            lcd_clear_fire_alert();
            message =
                "lcd fire alert cleared";
        }

        else
        {
            accepted =
                false;
            message =
                "unsupported lcd action";
        }
    }

    else if (
        strcmp(target, "config")
        == 0
    )
    {
        const cJSON *interval_value = cJSON_IsObject(configuration) ? cJSON_GetObjectItemCaseSensitive(configuration, "dht_sampling_period_ms") : NULL;
        const cJSON *flame_on_val = cJSON_IsObject(configuration) ? cJSON_GetObjectItemCaseSensitive(configuration, "flame_on_threshold") : NULL;
        const cJSON *flame_off_val = cJSON_IsObject(configuration) ? cJSON_GetObjectItemCaseSensitive(configuration, "flame_off_threshold") : NULL;
        const cJSON *mq2_on_val = cJSON_IsObject(configuration) ? cJSON_GetObjectItemCaseSensitive(configuration, "mq2_smoke_on_threshold") : NULL;
        const cJSON *mq2_off_val = cJSON_IsObject(configuration) ? cJSON_GetObjectItemCaseSensitive(configuration, "mq2_smoke_off_threshold") : NULL;
        const cJSON *pump_start_val = cJSON_IsObject(configuration) ? cJSON_GetObjectItemCaseSensitive(configuration, "pump_start_delay_ms") : NULL;
        const cJSON *pump_stop_val = cJSON_IsObject(configuration) ? cJSON_GetObjectItemCaseSensitive(configuration, "pump_stop_delay_ms") : NULL;

        if (
            strcmp(action, "set") != 0
            || !cJSON_IsNumber(interval_value)
            || !cJSON_IsNumber(flame_on_val)
            || !cJSON_IsNumber(flame_off_val)
            || !cJSON_IsNumber(mq2_on_val)
            || !cJSON_IsNumber(mq2_off_val)
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
            int mq2_on = (int)mq2_on_val->valuedouble;
            int mq2_off = (int)mq2_off_val->valuedouble;
            uint32_t pump_start = (uint32_t)pump_start_val->valuedouble;
            uint32_t pump_stop = (uint32_t)pump_stop_val->valuedouble;

            if (
                mq2_off < 0 ||
                mq2_on < 0 ||
                mq2_on > 4095 ||
                mq2_off >= mq2_on
            )
            {
                accepted = false;
                message = "invalid MQ-2 thresholds";
            }
            else if (save_runtime_config(interval_ms, flame_on, flame_off, mq2_on, mq2_off, pump_start, pump_stop))
            {
                dht_read_interval_ms = interval_ms;
                runtime_config.flame_on_threshold = flame_on;
                runtime_config.flame_off_threshold = flame_off;
                runtime_config.mq2_smoke_on_threshold = mq2_on;
                runtime_config.mq2_smoke_off_threshold = mq2_off;
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

    ESP_LOGI(
        TAG,
        "Fan relay: GPIO%d",
        FAN_RELAY_GPIO
    );


    // ==================================================
    // INIT
    // ==================================================

    outputs_init();

    lcd_init();

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

        update_smoke_detection(
            gas_adc
        );

        const char *smoke_status_text =
            mq2_smoke_detected ? "CO_KHOI_KHI_GA" : "KHONG_CO";


        // --------------------------
        // Fire logic
        // --------------------------

        update_fire_detection(
            flame_adc
        );


        update_fire_outputs();

        lcd_update_status(
            flame_adc,
            gas_adc
        );


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

                    "Flame=%d | Gas ADC=%d | GasLevel=%s | Temp=%.1f C | Humidity=%.1f %% | Smoke=%s | State=%s | Pump=%s | Fan=%s",

                    flame_adc,

                    gas_adc,

                    mq2_level_text(gas_adc),

                    last_temperature,

                    last_humidity,

                    smoke_status_text,

                    system_state
                        == STATE_FIRE
                        ? "FIRE"
                        : "NORMAL",

                    pump_running
                        ? "ON"
                        : "OFF",

                    fan_running
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

                    "Flame=%d | Gas ADC=%d | GasLevel=%s | DHT22 error=%d | Smoke=%s | State=%s | Pump=%s | Fan=%s",

                    flame_adc,

                    gas_adc,

                    mq2_level_text(gas_adc),

                    dht_result,

                    smoke_status_text,

                    system_state
                        == STATE_FIRE
                        ? "FIRE"
                        : "NORMAL",

                    pump_running
                        ? "ON"
                        : "OFF",

                    fan_running
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
