cmake_minimum_required(VERSION 3.16)
project(spartan_native_windows LANGUAGES CXX)

if(NOT WIN32)
  message(FATAL_ERROR "native-windows must be configured on Windows")
endif()

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(spartan_native_windows SHARED src/bindings.cpp)
find_path(NODE_API_INCLUDE_DIR node_api.h
  PATHS
    ${CMAKE_CURRENT_SOURCE_DIR}/../../node_modules/node-api-headers/include
)
if(NOT NODE_API_INCLUDE_DIR)
  message(FATAL_ERROR "Node-API headers are required; install node-api-headers or set NODE_API_INCLUDE_DIR")
endif()
target_include_directories(spartan_native_windows PRIVATE ${NODE_API_INCLUDE_DIR})
target_compile_definitions(spartan_native_windows PRIVATE WIN32_LEAN_AND_MEAN NOMINMAX)
set_target_properties(spartan_native_windows PROPERTIES PREFIX "" SUFFIX ".node" OUTPUT_NAME "spartan-native-windows")

install(TARGETS spartan_native_windows RUNTIME DESTINATION . LIBRARY DESTINATION . ARCHIVE DESTINATION .)
install(FILES index.mjs package.json DESTINATION .)
