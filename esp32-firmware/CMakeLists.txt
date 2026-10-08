cmake_minimum_required(VERSION 3.16)

# This project runs on ESP32-S3 hardware. Keep the target in the project so an
# old IDF_TARGET value from an IDE terminal cannot rebuild it for ESP32.
set(IDF_TARGET "esp32s3")

include($ENV{IDF_PATH}/tools/cmake/project.cmake)
project(smart_fire_iot_idf55)
