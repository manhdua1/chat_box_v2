#ifndef WEBSOCKET_SERVER_H
#define WEBSOCKET_SERVER_H

#include <string>
#include <memory>
#include <unordered_map>
#include <mutex>
#include "pubsub/pubsub_broker.h"
#include "auth/auth_manager.h"
#include "handlers/webrtc_handler.h"
#include "handlers/file_handler.h"
#include "database/mysql_client.h"
#include "../protocol_chatbox1.h"

// Forward declarations
class GeminiClient;

/**
 * WebSocket Server using uWebSockets
 * 
 * Features:
 * - High-performance WebSocket connections
 * - Protocol parsing (ChatBox1 binary protocol)
 * - Integration with Pub/Sub broker
 * - Authentication via JWT tokens
 * - Per-connection state management
 */
class WebSocketServer {
public:
    WebSocketServer(int port, 
                     std::shared_ptr<PubSubBroker> broker,
                     std::shared_ptr<AuthManager> authManager,
                     std::shared_ptr<GeminiClient> geminiClient = nullptr);
    
    ~WebSocketServer();
    
    /**
     * Start the WebSocket server
     * This is a blocking call
     */
    void run();
    
    /**
     * Stop the server gracefully
     */
    void stop();
    
    /**
     * Get connection count
     */
    size_t getConnectionCount() const;
    
    /**
     * Broadcast message to all connected clients
     */
    void broadcast(const std::string& message);
    
    /**
     * Broadcast to all users in a room (except excludeUserId)
     */
    void broadcastToRoom(const std::string& roomId, const std::string& message, const std::string& excludeUserId = "");
    
    /**
     * Send message to specific UserSession
     */
    bool sendToSession(const std::string& sessionId, const std::string& message);
    
    /**
     * Send message to a specific user by userId
     */
    void sendToUser(const std::string& userId, const std::string& message);
    
private:
    // Connection state
    struct ConnectionState {
        std::string sessionId;
        std::string userId;
        std::string username;
        std::string currentRoom;  // Currently joined room
        bool authenticated;
        uint64_t connectedAt;
        void* wsPtr;  // WebSocket pointer for broadcasting
        
        ConnectionState() 
            : authenticated(false), connectedAt(0), wsPtr(nullptr) {}
    };
    
    int port_;
    bool running_;
    
    std::shared_ptr<PubSubBroker> broker_;
    std::shared_ptr<AuthManager> authManager_;
    std::shared_ptr<GeminiClient> geminiClient_;
    std::shared_ptr<WebRTCHandler> webrtcHandler_;
    std::shared_ptr<FileHandler> fileHandler_;
    std::shared_ptr<MySQLClient> dbClient_;  // Database client shortcut
    
    // WebSocket connections
    // Store connections by void* since we use lambdas
    std::unordered_map<void*, ConnectionState> connections_;
    mutable std::mutex connectionsMutex_;
    
    // Protocol message handlers (templates need to be in header or explicit instantiation)
    // We'll use type-erased helpers instead
    void handleRegisterJson(void* ws, const std::string& jsonStr);
    void handleLoginJson(void* ws, const std::string& jsonStr);
    void handleChatMessageJson(void* ws, const std::string& jsonStr);
    void handleTypingJson(void* ws, const std::string& jsonStr);
    void handleGetOnlineUsersJson(void* ws);
    void handleEditMessageJson(void* ws, const std::string& jsonStr);
    void handleDeleteMessageJson(void* ws, const std::string& jsonStr);
    void handleCreateRoomJson(void* ws, const std::string& jsonStr);
    void handleJoinRoomJson(void* ws, const std::string& jsonStr);
    void handleLeaveRoomJson(void* ws, const std::string& jsonStr);
    void handleGetRoomsJson(void* ws);
    void handleSearchMessagesJson(void* ws, const std::string& jsonStr);
    void handleMarkReadJson(void* ws, const std::string& jsonStr);
    void sendErrorJson(void* ws, const std::string& error);
    void sendJsonMessage(void* ws, const std::string& jsonStr);
};

#endif // WEBSOCKET_SERVER_H
