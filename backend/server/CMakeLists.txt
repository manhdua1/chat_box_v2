cmake_minimum_required(VERSION 3.15)

project(ChatServer VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find packages  
find_package(unofficial-mysql-connector-cpp CONFIG REQUIRED)
find_package(OpenSSL REQUIRED)
find_package(ZLIB REQUIRED)
find_package(Threads REQUIRED)
find_package(unofficial-usockets CONFIG REQUIRED)
find_package(CURL REQUIRED)
find_package(nlohmann_json CONFIG REQUIRED)
find_package(jwt-cpp CONFIG REQUIRED)

# Include directories
include_directories(
    ${CMAKE_SOURCE_DIR}/include
    ${OPENSSL_INCLUDE_DIR}
)

# WebSocket Server sources
set(SERVER_SOURCES
    src/utils/logger.cpp
    src/config/config_loader.cpp
    src/database/mysql_client.cpp
    src/auth/auth_manager.cpp
    src/auth/jwt_handler.cpp
    src/pubsub/pubsub_broker.cpp
    src/websocket/websocket_server.cpp
    src/ai/gemini_client.cpp
    src/handlers/webrtc_handler.cpp
    src/handlers/file_handler.cpp
)

# Server executable
add_executable(chat_server src/main.cpp ${SERVER_SOURCES})

# Link libraries
target_link_libraries(chat_server
    PRIVATE
    unofficial::mysql-connector-cpp::connector
    unofficial::usockets::usockets
    OpenSSL::SSL
    OpenSSL::Crypto
    ZLIB::ZLIB
    Threads::Threads
    CURL::libcurl
    nlohmann_json::nlohmann_json
    jwt-cpp::jwt-cpp
)

if(WIN32)
    target_link_libraries(chat_server PRIVATE ws2_32)
endif()

message(STATUS "========================================")
message(STATUS "ChatBox - WebSocket Server Build")
message(STATUS "Components: Config + Logger + MySQL(stub) + Auth + PubSub + WebSocket")
message(STATUS "========================================")
# MySQL test executable

