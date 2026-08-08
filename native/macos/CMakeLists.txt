cmake_minimum_required(VERSION 3.16)
project(spartan_native_macos LANGUAGES CXX)

if(NOT APPLE)
  message(FATAL_ERROR "native-macos must be configured on macOS")
endif()

enable_language(OBJCXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(spartan_native_macos SHARED src/bindings.mm)
find_path(NODE_API_INCLUDE_DIR node_api.h
  PATHS
    ${CMAKE_CURRENT_SOURCE_DIR}/../../node_modules/node-api-headers/include
)
if(NOT NODE_API_INCLUDE_DIR)
  message(FATAL_ERROR "Node-API headers are required; install node-api-headers or set NODE_API_INCLUDE_DIR")
endif()
find_library(CORE_GRAPHICS_FRAMEWORK CoreGraphics REQUIRED)
find_library(CORE_FOUNDATION_FRAMEWORK CoreFoundation REQUIRED)
target_include_directories(spartan_native_macos PRIVATE ${NODE_API_INCLUDE_DIR})
target_link_libraries(spartan_native_macos PRIVATE ${CORE_GRAPHICS_FRAMEWORK} ${CORE_FOUNDATION_FRAMEWORK})
target_link_options(spartan_native_macos PRIVATE "-undefined" "dynamic_lookup")
set_target_properties(spartan_native_macos PROPERTIES PREFIX "" SUFFIX ".node" OUTPUT_NAME "spartan-native-macos")

install(TARGETS spartan_native_macos LIBRARY DESTINATION . RUNTIME DESTINATION . ARCHIVE DESTINATION .)
install(FILES index.mjs package.json ../desktop/reference-adapter.mjs DESTINATION .)
install(FILES ../../host/adapters.mjs ../../host/audio.mjs ../../host/media.mjs ../../host/process.mjs DESTINATION host)
