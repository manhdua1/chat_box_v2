// WebSocket Server utility functions for better organization

#pragma once

#include <string>
#include <vector>
#include <functional>
#include <memory>
#include <uwebsockets/App.h>

namespace chatbox {
namespace websocket {

/**
 * Message validation utilities
 */
class MessageValidator {
public:
    static bool isValidJson(const std::string& message);
    static bool hasRequiredFields(const std::string& json, const std::vector<std::string>& fields);
    static bool isValidMessageType(const std::string& type);
    static size_t getMessageSize(const std::string& message);
    static bool exceedsMaxSize(const std::string& message, size_t maxSize = 1024 * 1024);
};

/**
 * Connection management utilities
 */
class ConnectionManager {
public:
    struct ConnectionInfo {
        std::string userId;
        std::string sessionId;
        std::string ipAddress;
        long long connectedAt;
        bool isAuthenticated;
    };
    
    static std::string generateSessionId();
    static std::string getClientIp(uWS::HttpRequest* req);
    static bool isRateLimited(const std::string& userId, int maxRequestsPerMinute = 60);
    static void trackRequest(const std::string& userId);
};

/**
 * Broadcast helpers
 */
class BroadcastHelper {
public:
    using WebSocket = uWS::WebSocket<false, true, void*>;
    
    // Broadcast to all connections
    static void broadcastToAll(
        uWS::App* app,
        const std::string& message,
        const std::string& excludeUserId = ""
    );
    
    // Broadcast to room
    static void broadcastToRoom(
        uWS::App* app,
        const std::string& roomId,
        const std::string& message,
        const std::string& excludeUserId = ""
    );
    
    // Send to specific user
    static void sendToUser(
        uWS::App* app,
        const std::string& userId,
        const std::string& message
    );
    
    // Send to multiple users
    static void sendToUsers(
        uWS::App* app,
        const std::vector<std::string>& userIds,
        const std::string& message
    );
};

/**
 * Error response creators
 */
class ErrorResponse {
public:
    static std::string create(const std::string& message, const std::string& code = "ERROR");
    static std::string createAuthError(const std::string& message = "Authentication required");
    static std::string createValidationError(const std::string& field, const std::string& message);
    static std::string createRateLimitError();
    static std::string createNotFoundError(const std::string& resource);
};

/**
 * Success response creators
 */
class SuccessResponse {
public:
    static std::string create(const std::string& type, const std::string& data);
    static std::string createAuthSuccess(const std::string& userId, const std::string& token);
    static std::string createRoomCreated(const std::string& roomId, const std::string& roomName);
    static std::string createMessageSent(const std::string& messageId);
};

/**
 * WebSocket lifecycle hooks
 */
class WebSocketHooks {
public:
    using OnOpenCallback = std::function<void(uWS::WebSocket<false, true, void*>*)>;
    using OnMessageCallback = std::function<void(uWS::WebSocket<false, true, void*>*, std::string_view, uWS::OpCode)>;
    using OnCloseCallback = std::function<void(uWS::WebSocket<false, true, void*>*, int, std::string_view)>;
    
    static void setupLifecycle(
        uWS::App::WebSocketBehavior<void*>& behavior,
        OnOpenCallback onOpen,
        OnMessageCallback onMessage,
        OnCloseCallback onClose
    );
};

} // namespace websocket
} // namespace chatbox
