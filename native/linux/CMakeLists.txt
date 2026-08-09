cmake_minimum_required(VERSION 3.16)
project(spartan_native_linux LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(spartan_native_linux SHARED src/bindings.cpp)
find_path(NODE_API_INCLUDE_DIR node_api.h
  PATHS
    /usr/include/node
    /usr/local/include/node
    ${CMAKE_CURRENT_SOURCE_DIR}/../../node_modules/node-api-headers/include
)
if(NOT NODE_API_INCLUDE_DIR)
  message(FATAL_ERROR "Node-API headers are required; install node-api-headers or set NODE_API_INCLUDE_DIR")
endif()
target_include_directories(spartan_native_linux PRIVATE ${NODE_API_INCLUDE_DIR})
set_target_properties(spartan_native_linux PROPERTIES PREFIX "" SUFFIX ".node" OUTPUT_NAME "spartan-native-linux")

install(TARGETS spartan_native_linux LIBRARY DESTINATION . RUNTIME DESTINATION . ARCHIVE DESTINATION .)
install(FILES index.mjs package.json reference-adapter.mjs DESTINATION .)
install(FILES ../../host/adapters.mjs ../../host/audio.mjs ../../host/media.mjs ../../host/ogg-opus.mjs ../../host/process.mjs DESTINATION host)
