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

# Node-API is exported by node.exe rather than provided as a standalone
# library. Generate the small import library from the versioned API definition
# shipped by node-api-headers so MSVC links the addon without V8 internals.
get_filename_component(MSVC_BIN_DIR "${CMAKE_CXX_COMPILER}" DIRECTORY)
find_program(NODE_API_LIB_TOOL NAMES lib lib.exe PATHS "${MSVC_BIN_DIR}" NO_DEFAULT_PATH)
if(NOT NODE_API_LIB_TOOL)
  find_program(NODE_API_LIB_TOOL NAMES lib lib.exe)
endif()
if(NOT NODE_API_LIB_TOOL)
  message(FATAL_ERROR "MSVC lib.exe is required to generate the Node-API import library")
endif()
set(NODE_API_DEF_FILE ${CMAKE_CURRENT_SOURCE_DIR}/../../node_modules/node-api-headers/def/node_api.def)
set(NODE_API_IMPORT_LIBRARY ${CMAKE_CURRENT_BINARY_DIR}/node_api.lib)
if(CMAKE_SIZEOF_VOID_P EQUAL 8)
  set(NODE_API_MACHINE X64)
else()
  set(NODE_API_MACHINE X86)
endif()
add_custom_command(OUTPUT ${NODE_API_IMPORT_LIBRARY}
  COMMAND ${NODE_API_LIB_TOOL} /def:${NODE_API_DEF_FILE} /machine:${NODE_API_MACHINE} /out:${NODE_API_IMPORT_LIBRARY}
  DEPENDS ${NODE_API_DEF_FILE}
  VERBATIM
)
add_custom_target(spartan_node_api_import_library DEPENDS ${NODE_API_IMPORT_LIBRARY})
add_dependencies(spartan_native_windows spartan_node_api_import_library)
target_link_libraries(spartan_native_windows PRIVATE ${NODE_API_IMPORT_LIBRARY} xinput)
set_target_properties(spartan_native_windows PROPERTIES PREFIX "" SUFFIX ".node" OUTPUT_NAME "spartan-native-windows")

install(TARGETS spartan_native_windows RUNTIME DESTINATION . LIBRARY DESTINATION . ARCHIVE DESTINATION .)
install(FILES index.mjs package.json ../desktop/reference-adapter.mjs DESTINATION .)
install(FILES ../../host/adapters.mjs ../../host/audio.mjs ../../host/media.mjs ../../host/process.mjs DESTINATION host)
