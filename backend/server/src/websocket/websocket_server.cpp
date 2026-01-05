#include "websocket/websocket_server.h"
#include "utils/logger.h"
#include "database/types.h"
#include "ai/gemini_client.h"
#include <uwebsockets/App.h>
#include <nlohmann/json.hpp>
#include <thread>
#include <filesystem>
#include <fstream>
#include <set>
#include <random>
#include <chrono>
#include <sstream>
#include <iomanip>
#include <functional>  // for std::hash

// Helper function to create canonical DM roomId
// Format: dm_<hash> - ensures consistent roomId regardless of who sends first
// Uses simple string hash for short roomId (fits in VARCHAR(64))
static std::string createCanonicalDmRoomId(const std::string& userId1, const std::string& userId2) {
    // Sort user IDs for consistency
    std::string first, second;
    if (userId1 < userId2) {
        first = userId1;
        second = userId2;
    } else {
        first = userId2;
        second = userId1;
    }
    
    // Create hash of combined sorted IDs
    std::string combined = first + "_" + second;
    std::hash<std::string> hasher;
    size_t hash1 = hasher(combined);
    size_t hash2 = hasher(second + "_" + first);  // Additional entropy
    
    // Convert to hex string (16 chars each = 32 chars total)
    std::stringstream ss;
    ss << std::hex << std::setfill('0') << std::setw(16) << hash1;
    ss << std::setfill('0') << std::setw(16) << hash2;
    
    return "dm_" + ss.str();  // dm_ + 32 hex chars = 35 chars total, fits in VARCHAR(64)
}

using json = nlohmann::json;

// Helper: URL Decode
std::string urlDecode(const std::string &SRC) {
    std::string ret;
    char ch;
    for (size_t i=0; i<SRC.length(); i++) {
        if (SRC[i]=='%') {
            if (i+2 < SRC.length()) {
                try {
                    int ii = std::stoi(SRC.substr(i+1, 2), nullptr, 16);
                    ret += static_cast<char>(ii);
                    i += 2;
                } catch(...) {
                    ret += SRC[i];
                }
            } else {
                ret += SRC[i];
            }
        } else if (SRC[i] == '+') {
            ret += ' ';
        } else {
            ret+=SRC[i];
        }
    }
    return ret;
}

// Real WebSocket implementation với ChatBox protocol support

// Per-socket user data
#include "socket_data.h"

WebSocketServer::WebSocketServer(int port,
                                   std::shared_ptr<PubSubBroker> broker,
                                   std::shared_ptr<AuthManager> authManager,
                                   std::shared_ptr<GeminiClient> geminiClient)
    : port_(port)
    , running_(false)
    , broker_(broker)
    , authManager_(authManager)
    , geminiClient_(geminiClient)
    , webrtcHandler_(std::make_shared<WebRTCHandler>(broker))
    , fileHandler_(std::make_shared<FileHandler>(nullptr, nullptr, broker))
    , dbClient_(authManager ? authManager->getDatabase() : nullptr) {
    
    // Set up WebRTC callback to use sendToUser for direct delivery
    webrtcHandler_->setSendToUserCallback([this](const std::string& userId, const std::string& message) {
        this->sendToUser(userId, message);
    });
    
    Logger::info("✓ WebSocket server khởi tạo với Protocol Support trên port " + std::to_string(port));
}

WebSocketServer::~WebSocketServer() {
    stop();
    Logger::info("WebSocket server destroyed");
}

void WebSocketServer::run() {
    running_ = true;
    
    Logger::info("========================================");
    Logger::info("Starting REAL WebSocket with Protocol...");
    Logger::info("Port: " + std::to_string(port_));
    Logger::info("========================================");
    
    try {
        // Create uWebSockets app
        uWS::App app;
        
        // Ensure "uploads" directory exists
        namespace fs = std::filesystem;
        if (!fs::exists("uploads")) {
            fs::create_directory("uploads");
            Logger::info("Created uploads directory");
        }
        
        // CORS helper
        auto addCors = [](auto* res) {
            res->writeHeader("Access-Control-Allow-Origin", "*");
            res->writeHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            res->writeHeader("Access-Control-Allow-Headers", "Content-Type, X-Filename");
        };

        // POST /upload - Streaming mode for LARGE files (1GB+)
        app.post("/upload", [addCors](auto* res, auto* req) {
            std::string rawFilename = std::string(req->getHeader("x-filename"));
            std::string originalFilename = urlDecode(rawFilename);
            
            if (originalFilename.empty()) {
                originalFilename = "file_" + std::to_string(std::time(nullptr));
            }
            
            // Sanitize filename
            size_t lastSlash = originalFilename.find_last_of("/\\");
            if (lastSlash != std::string::npos) {
                originalFilename = originalFilename.substr(lastSlash + 1);
            }

            // Generate unique filename for storage to avoid encoding issues and collisions
            auto now = std::chrono::system_clock::now();
            auto timestamp = std::chrono::duration_cast<std::chrono::seconds>(now.time_since_epoch()).count();
            
            std::string extension = "";
            size_t dotPos = originalFilename.find_last_of('.');
            if (dotPos != std::string::npos) {
                extension = originalFilename.substr(dotPos);
            }
            
            // Simple random number
            static std::random_device rd;
            static std::mt19937 gen(rd());
            static std::uniform_int_distribution<> dis(0, 9999);
            
            std::string storageFilename = "file_" + std::to_string(timestamp) + "_" + std::to_string(dis(gen)) + extension;
            std::string path = "uploads/" + storageFilename;
            
            // Use streaming write - open file once, append chunks
            struct UploadState {
                std::ofstream file;
                std::string filename; // Original filename
                std::string storageFilename; // Filename on disk
                std::string path;
                size_t totalBytes = 0;
            };
            
            UploadState* state = new UploadState();
            state->filename = originalFilename;
            state->storageFilename = storageFilename;
            state->path = path;
            state->file.open(path, std::ios::binary | std::ios::trunc);
            
            if (!state->file.is_open()) {
                Logger::error("Failed to create file: " + path);
                addCors(res);
                res->writeStatus("500 Internal Server Error");
                res->end("{\"error\":\"Failed to create file\"}");
                delete state;
                return;
            }
            
            Logger::info("Starting large file upload: " + originalFilename);

            res->onData([res, state, addCors](std::string_view chunk, bool isLast) {
                // Write chunk directly to disk (no RAM buffering)
                state->file.write(chunk.data(), chunk.size());
                state->totalBytes += chunk.size();
                
                if (isLast) {
                    state->file.close();
                    
                    // Format file size for logging
                    std::string sizeStr;
                    if (state->totalBytes >= 1024 * 1024 * 1024) {
                        sizeStr = std::to_string(state->totalBytes / (1024 * 1024 * 1024)) + " GB";
                    } else if (state->totalBytes >= 1024 * 1024) {
                        sizeStr = std::to_string(state->totalBytes / (1024 * 1024)) + " MB";
                    } else if (state->totalBytes >= 1024) {
                        sizeStr = std::to_string(state->totalBytes / 1024) + " KB";
                    } else {
                        sizeStr = std::to_string(state->totalBytes) + " bytes";
                    }

                    json response = {
                        {"status", "ok"},
                        {"url", "http://localhost:8080/uploads/" + state->storageFilename},
                        {"filename", state->filename},
                        {"size", state->totalBytes},
                        {"sizeFormatted", sizeStr}
                    };

                    addCors(res);
                    res->writeHeader("Content-Type", "application/json");
                    res->end(response.dump());
                    Logger::info("Large file uploaded: " + state->filename + " (" + sizeStr + ")");
                    delete state;
                }
            });

            res->onAborted([state]() {
                if (state->file.is_open()) {
                    state->file.close();
                }
                // Clean up partial file
                std::filesystem::remove(state->path);
                Logger::warning("Upload aborted: " + state->filename);
                delete state;
            });
        });
        
        // OPTIONS /upload
        app.options("/upload", [addCors](auto* res, auto* req) {
            addCors(res);
            res->end("");
        });

        // GET /uploads/:filename
        app.get("/uploads/:filename", [addCors](auto* res, auto* req) {
            std::string filename = std::string(req->getParameter(0));
            std::string path = "uploads/" + filename;
            
            if (std::filesystem::exists(path)) {
                std::ifstream is(path, std::ios::binary);
                if (is) {
                    std::string str((std::istreambuf_iterator<char>(is)), 
                                     std::istreambuf_iterator<char>());
                    addCors(res);
                    // Simple mimetype check based on extension could be added here
                    res->end(str);
                    return;
                }
            }
            addCors(res);
            res->writeStatus("404 Not Found")->end("File not found");
        });

        // POST /user/avatar (Update Profile Picture)
        app.post("/user/avatar", [this, addCors](auto* res, auto* req) {
            std::string authHeader = std::string(req->getHeader("authorization"));
            
            // Basic validation
            if (authHeader.empty() || authHeader.length() < 8) {
                addCors(res);
                res->writeStatus("401 Unauthorized")->end("Missing token");
                 return;
            }
            
            // Extract token (remove "Bearer ")
            std::string token = authHeader.substr(7);
            auto sessionInfo = authManager_->getSessionFromToken(token);
            
            if (!sessionInfo) {
                addCors(res);
                res->writeStatus("401 Unauthorized")->end("Invalid token");
                return;
            }

            res->onData([this, res, userId = sessionInfo->userId, addCors, buffer = std::make_shared<std::string>()](std::string_view chunk, bool isLast) mutable {
                // Buffer the JSON body
                buffer->append(chunk);
                
                if (isLast) {
                    try {
                        json j = json::parse(*buffer);
                        std::string avatarUrl = j["avatarUrl"];
                        
                        if (authManager_->updateAvatar(userId, avatarUrl)) {
                            json response = {
                                {"status", "ok"},
                                {"message", "Avatar updated"}
                            };
                            addCors(res);
                            res->writeHeader("Content-Type", "application/json");
                            res->end(response.dump());
                            Logger::info("Avatar updated for user: " + userId);
                        } else {
                            addCors(res);
                            res->writeStatus("500 Internal Server Error")->end("Failed to update avatar");
                        }
                    } catch (const std::exception& e) {
                        addCors(res);
                        res->writeStatus("400 Bad Request")->end("Invalid JSON");
                    }
                    buffer->clear();
                }
            });
            
            res->onAborted([]() {
                // Handle abortion
            });
        });

        // OPTIONS /user/avatar
        app.options("/user/avatar", [addCors](auto* res, auto* req) {
            addCors(res);
            res->end("");
        });

        // WebSocket route với PerSocketData
        app.ws<PerSocketData>("/*", {
            .maxPayloadLength = 16 * 1024 * 1024,
            .idleTimeout = 120,
            
            // Connection opened
            .open = [this](auto* ws) {
                PerSocketData* data = ws->getUserData();
                data->authenticated = false;
                
                Logger::info("✓ Client connected (WebSocket)");
                
                // Store connection - cast to void* and store websocket pointer
                {
                    std::lock_guard<std::mutex> lock(connectionsMutex_);
                    ConnectionState state;
                    state.wsPtr = (void*)ws;  // Store raw pointer for broadcast
                    connections_[(void*)ws] = state;
                    
                    Logger::info("  Total connections: " + std::to_string(connections_.size()));
                }
            },
            
            // Message received - PROTOCOL HANDLING
            .message = [this](auto* ws, std::string_view message, uWS::OpCode opCode) {
                PerSocketData* data = ws->getUserData();
                
                try {
                    // Convert string_view to string for JSON parsing
                    std::string msgStr(message.data(), message.size());
                    
                    // Parse JSON message
                    json msg = json::parse(msgStr);
                    std::string type = msg.value("type", "");
                    
                    Logger::info("📨 Message type: " + type);
                    
                    if (type == "register") {
                        handleRegisterJson((void*)ws, msgStr);
                    }
                    else if (type == "login") {
                        handleLoginJson((void*)ws, msgStr);
                    }
                    else if (type == "auth") {
                        // Authenticate WebSocket with existing JWT token
                        std::string token = msg.value("token", "");
                        if (!token.empty()) {
                            auto sessionInfo = authManager_->getSessionFromToken(token);
                            if (sessionInfo) {
                                data->authenticated = true;
                                data->userId = sessionInfo->userId;
                                data->username = sessionInfo->username;
                                data->sessionId = "ws-session-" + sessionInfo->userId;
                                
                                // IMPORTANT: Also update connections_ map for sendToUser to work
                                {
                                    std::lock_guard<std::mutex> lock(connectionsMutex_);
                                    connections_[(void*)ws].authenticated = true;
                                    connections_[(void*)ws].userId = sessionInfo->userId;
                                    connections_[(void*)ws].username = sessionInfo->username;
                                }
                                
                                json response = {
                                    {"type", "auth_response"},
                                    {"success", true},
                                    {"userId", sessionInfo->userId},
                                    {"username", sessionInfo->username}
                                };
                                sendJsonMessage((void*)ws, response.dump());
                                Logger::info("✓ WebSocket authenticated via token: " + sessionInfo->username);
                                
                                // Auto-send online users list after auth success
                                handleGetOnlineUsersJson((void*)ws);
                            } else {
                                sendErrorJson((void*)ws, "Invalid token");
                                Logger::warning("✗ WebSocket auth failed: invalid token");
                            }
                        } else {
                            sendErrorJson((void*)ws, "Token required");
                        }
                    }
                    else if (type == "chat") {
                        if (data->authenticated) {
                            handleChatMessageJson((void*)ws, msgStr);
                        } else {
                            sendErrorJson((void*)ws, "Not authenticated");
                        }
                    }
                    else if (type == "typing") {
                        if (data->authenticated) {
                            handleTypingJson((void*)ws, msgStr);
                        }
                    }
                    else if (type == "get_online_users") {
                        if (data->authenticated) {
                            handleGetOnlineUsersJson((void*)ws);
                        }
                    }
                    else if (type == "edit_message") {
                        if (data->authenticated) {
                            handleEditMessageJson((void*)ws, msgStr);
                        } else {
                            sendErrorJson((void*)ws, "Not authenticated");
                        }
                    }
                    else if (type == "delete_message") {
                        if (data->authenticated) {
                            handleDeleteMessageJson((void*)ws, msgStr);
                        } else {
                            sendErrorJson((void*)ws, "Not authenticated");
                        }
                    }
                    else if (type == "add_reaction") {
                        if (data->authenticated) {
                            std::string messageId = msg.value("messageId", "");
                            std::string emoji = msg.value("emoji", "");
                            std::string roomId = msg.value("roomId", "");
                            
                            json response = {
                                {"type", "reaction_added"},
                                {"messageId", messageId},
                                {"emoji", emoji},
                                {"roomId", roomId},
                                {"userId", data->userId},
                                {"username", data->username}
                            };
                            
                            // Send to sender
                            sendJsonMessage((void*)ws, response.dump());
                            // Broadcast to room
                            broadcastToRoom(roomId, response.dump(), data->sessionId);
                            Logger::info("👍 Reaction added by " + data->username + ": " + emoji);
                        }
                    }
                    else if (type == "pin_message") {
                        if (data->authenticated) {
                            std::string messageId = msg.value("messageId", "");
                            std::string roomId = msg.value("roomId", "");
                            
                            json response = {
                                {"type", "message_pinned"},
                                {"messageId", messageId},
                                {"roomId", roomId},
                                {"userId", data->userId},
                                {"username", data->username}
                            };
                            
                            sendJsonMessage((void*)ws, response.dump());
                            broadcastToRoom(roomId, response.dump(), data->sessionId);
                            Logger::info("📌 Message pinned by " + data->username);
                        }
                    }
                    else if (type == "unpin_message") {
                        if (data->authenticated) {
                            std::string messageId = msg.value("messageId", "");
                            std::string roomId = msg.value("roomId", "");
                            
                            json response = {
                                {"type", "message_unpinned"},
                                {"messageId", messageId},
                                {"roomId", roomId}
                            };
                            
                            sendJsonMessage((void*)ws, response.dump());
                            broadcastToRoom(roomId, response.dump(), data->sessionId);
                            Logger::info("📌 Message unpinned by " + data->username);
                        }
                    }
                    else if (type == "reply_message") {
                        if (data->authenticated) {
                            std::string content = msg.value("content", "");
                            std::string replyToId = msg.value("replyToId", "");
                            std::string roomId = msg.value("roomId", "");
                            
                            // Create message with replyToId
                            std::string messageId = "msg-" + std::to_string(std::time(nullptr)) + "-" + data->userId.substr(0, 8);
                            
                            json response = {
                                {"type", "chat"},
                                {"messageId", messageId},
                                {"roomId", roomId},
                                {"userId", data->userId},
                                {"username", data->username},
                                {"content", content},
                                {"replyToId", replyToId},
                                {"timestamp", std::time(nullptr) * 1000}
                            };
                            
                            sendJsonMessage((void*)ws, response.dump());
                            broadcastToRoom(roomId, response.dump(), data->sessionId);
                            Logger::info("↩️ Reply sent by " + data->username);
                        }
                    }
                    else if (type == "create_room") {
                        if (data->authenticated) {
                            handleCreateRoomJson((void*)ws, msgStr);
                        } else {
                            sendErrorJson((void*)ws, "Not authenticated");
                        }
                    }
                    else if (type == "join_room") {
                        if (data->authenticated) {
                            handleJoinRoomJson((void*)ws, msgStr);
                        } else {
                            sendErrorJson((void*)ws, "Not authenticated");
                        }
                    }
                    else if (type == "leave_room") {
                        if (data->authenticated) {
                            handleLeaveRoomJson((void*)ws, msgStr);
                        } else {
                            sendErrorJson((void*)ws, "Not authenticated");
                        }
                    }
                    else if (type == "get_rooms") {
                        if (data->authenticated) {
                            handleGetRoomsJson((void*)ws);
                        } else {
                            sendErrorJson((void*)ws, "Not authenticated");
                        }
                    }
                    else if (type == "search_messages") {
                        if (data->authenticated) {
                            handleSearchMessagesJson((void*)ws, msgStr);
                        } else {
                            sendErrorJson((void*)ws, "Not authenticated");
                        }
                    }
                    else if (type == "mark_read") {
                        if (data->authenticated) {
                            handleMarkReadJson((void*)ws, msgStr);
                        } else {
                            sendErrorJson((void*)ws, "Not authenticated");
                        }
                    }
                    else if (type == "ping") {
                        // Respond with pong
                        json response = {
                            {"type", "pong"},
                            {"timestamp", std::time(nullptr)}
                        };
                        std::string responseStr = response.dump();
                        ws->send(responseStr, opCode);
                    }
                    // ============== WebRTC Call Signaling ==============
                    else if (type == "call_init") {
                        if (data->authenticated) {
                            std::string targetId = msg.value("targetId", "");
                            std::string callType = msg.value("callType", "video");
                            
                            // Generate a simple call ID
                            std::string callId = "call-" + std::to_string(std::time(nullptr)) + "-" + data->userId.substr(0, 8);
                            
                            // Send call_incoming directly to target user
                            json incomingCall = {
                                {"type", "call_incoming"},
                                {"callId", callId},
                                {"callerId", data->userId},
                                {"callerName", data->username},
                                {"callType", callType}
                            };
                            sendToUser(targetId, incomingCall.dump());
                            
                            // Send confirmation to caller
                            json response = {
                                {"type", "call_init_response"},
                                {"success", true},
                                {"callId", callId},
                                {"message", "Calling " + targetId + "..."}
                            };
                            sendJsonMessage((void*)ws, response.dump());
                            Logger::info("📞 Call initiated by " + data->username + " to " + targetId + " (callId: " + callId + ")");
                        } else {
                            sendErrorJson((void*)ws, "Not authenticated");
                        }
                    }
                    else if (type == "call_accept") {
                        if (data->authenticated) {
                            std::string callId = msg.value("callId", "");
                            std::string callerId = msg.value("callerId", "");
                            
                            // Send call_accepted to caller
                            json acceptMsg = {
                                {"type", "call_accepted"},
                                {"callId", callId},
                                {"accepterId", data->userId},
                                {"accepterName", data->username}
                            };
                            sendToUser(callerId, acceptMsg.dump());
                            
                            json response = {
                                {"type", "call_accept_response"},
                                {"success", true},
                                {"message", "Call accepted"}
                            };
                            sendJsonMessage((void*)ws, response.dump());
                            Logger::info("✅ Call accepted: " + callId);
                        } else {
                            sendErrorJson((void*)ws, "Not authenticated");
                        }
                    }
                    else if (type == "call_reject") {
                        if (data->authenticated) {
                            std::string callId = msg.value("callId", "");
                            std::string callerId = msg.value("callerId", "");
                            std::string reason = msg.value("reason", "declined");
                            
                            // Send call_rejected to caller
                            json rejectMsg = {
                                {"type", "call_rejected"},
                                {"callId", callId},
                                {"rejecterId", data->userId},
                                {"reason", reason}
                            };
                            sendToUser(callerId, rejectMsg.dump());
                            
                            json response = {
                                {"type", "call_reject_response"},
                                {"success", true},
                                {"message", "Call rejected"}
                            };
                            sendJsonMessage((void*)ws, response.dump());
                            Logger::info("❌ Call rejected: " + callId);
                        } else {
                            sendErrorJson((void*)ws, "Not authenticated");
                        }
                    }
                    else if (type == "call_end") {
                        if (data->authenticated) {
                            std::string callId = msg.value("callId", "");
                            std::string targetId = msg.value("targetId", "");
                            
                            // Send call_ended to other party
                            json endMsg = {
                                {"type", "call_ended"},
                                {"callId", callId},
                                {"endedBy", data->userId}
                            };
                            sendToUser(targetId, endMsg.dump());
                            
                            json response = {
                                {"type", "call_end_response"},
                                {"success", true},
                                {"message", "Call ended"}
                            };
                            sendJsonMessage((void*)ws, response.dump());
                            Logger::info("📴 Call ended: " + callId);
                        } else {
                            sendErrorJson((void*)ws, "Not authenticated");
                        }
                    }
                    else if (type == "webrtc_offer") {
                        if (data->authenticated) {
                            std::string callId = msg.value("callId", "");
                            std::string targetId = msg.value("targetId", "");
                            std::string sdp = msg.value("sdp", "");
                            
                            webrtcHandler_->sendOffer(callId, data->userId, targetId, sdp);
                            Logger::info("📡 WebRTC Offer forwarded: " + callId);
                        }
                    }
                    else if (type == "webrtc_answer") {
                        if (data->authenticated) {
                            std::string callId = msg.value("callId", "");
                            std::string targetId = msg.value("targetId", "");
                            std::string sdp = msg.value("sdp", "");
                            
                            webrtcHandler_->sendAnswer(callId, data->userId, targetId, sdp);
                            Logger::info("📡 WebRTC Answer forwarded: " + callId);
                        }
                    }
                    else if (type == "webrtc_ice") {
                        if (data->authenticated) {
                            std::string callId = msg.value("callId", "");
                            std::string targetId = msg.value("targetId", "");
                            std::string candidate = msg.value("candidate", "");
                            
                            webrtcHandler_->sendIceCandidate(callId, data->userId, targetId, candidate);
                            Logger::debug("🧊 ICE Candidate forwarded: " + callId);
                        }
                    }
                    // ============== Presence Status ==============
                    else if (type == "presence_update") {
                        if (data->authenticated) {
                            std::string status = msg.value("status", "online");
                            Logger::info("👤 Presence update from " + data->username + ": " + status);
                            
                            // Broadcast to all connections
                            json broadcastMsg = {
                                {"type", "presence_update"},
                                {"userId", data->userId},
                                {"username", data->username},
                                {"status", status}
                            };
                            broadcast(broadcastMsg.dump());
                        }
                    }
                    // ============== Profile Update ==============
                    else if (type == "profile_update") {
                        if (data->authenticated) {
                            std::string displayName = msg.value("displayName", "");
                            std::string statusMessage = msg.value("statusMessage", "");
                            std::string avatar = msg.value("avatar", "");
                            
                            Logger::info("👤 Profile update from " + data->username);
                            
                            // Save to database
                            bool saved = false;
                            try {
                                auto session = dbClient_->getSession();
                                if (session) {
                                    session->sql(
                                        "UPDATE users SET "
                                        "display_name = COALESCE(NULLIF(?, ''), display_name), "
                                        "status_message = ?, "
                                        "avatar_url = COALESCE(NULLIF(?, ''), avatar_url) "
                                        "WHERE user_id = ?"
                                    ).bind(displayName, statusMessage, avatar, data->userId).execute();
                                    saved = true;
                                    Logger::info("✅ Profile saved to database");
                                }
                            } catch (const std::exception& e) {
                                Logger::warning("Failed to save profile: " + std::string(e.what()));
                            }
                            
                            // Broadcast the update
                            json broadcastMsg = {
                                {"type", "profile_updated"},
                                {"userId", data->userId},
                                {"displayName", displayName.empty() ? data->username : displayName},
                                {"statusMessage", statusMessage},
                                {"avatar", avatar}
                            };
                            broadcast(broadcastMsg.dump());
                            
                            // Confirm to sender
                            json response = {
                                {"type", "profile_update_response"},
                                {"success", saved},
                                {"message", saved ? "Profile updated successfully" : "Profile updated (broadcast only)"}
                            };
                            sendJsonMessage((void*)ws, response.dump());
                        } else {
                            sendErrorJson((void*)ws, "Not authenticated");
                        }
                    }
                    // ============== Change Password ==============
                    else if (type == "change_password") {
                        if (data->authenticated) {
                            std::string currentPassword = msg.value("currentPassword", "");
                            std::string newPassword = msg.value("newPassword", "");
                            
                            Logger::info("🔐 Change password request from " + data->username);
                            
                            // Use AuthManager's changePassword method
                            std::string error = authManager_->changePassword(data->userId, currentPassword, newPassword);
                            bool success = error.empty();
                            
                            if (success) {
                                Logger::info("✅ Password changed successfully for " + data->username);
                            } else {
                                Logger::warning("❌ Password change failed for " + data->username + ": " + error);
                            }
                            
                            json response = {
                                {"type", "change_password_response"},
                                {"success", success},
                                {"message", success ? "Password changed successfully" : error}
                            };
                            sendJsonMessage((void*)ws, response.dump());
                        } else {
                            sendErrorJson((void*)ws, "Not authenticated");
                        }
                    }
                    // ============== AI Chat (Gemini) ==============
                    else if (type == "ai_request") {
                        if (data->authenticated && geminiClient_) {
                            std::string message = msg.value("message", "");
                            Logger::info("🤖 AI request from " + data->username + ": " + message.substr(0, 50) + "...");
                            
                            // Call Gemini API asynchronously
                            std::thread([this, ws, message, userId = data->userId]() {
                                try {
                                    auto response = geminiClient_->sendMessage(message);
                                    if (response.has_value()) {
                                        Logger::info("✅ AI response received");
                                        
                                        json responseJson = {
                                            {"type", "ai_response"},
                                            {"response", response.value()}
                                        };
                                        
                                        // Send response back to client
                                        sendJsonMessage((void*)ws, responseJson.dump());
                                    } else {
                                        Logger::error("❌ AI request failed: No response");
                                        json errorJson = {
                                            {"type", "ai_error"},
                                            {"error", "Failed to get AI response"}
                                        };
                                        sendJsonMessage((void*)ws, errorJson.dump());
                                    }
                                } catch (const std::exception& e) {
                                    Logger::error("❌ AI request failed: " + std::string(e.what()));
                                    json errorJson = {
                                        {"type", "ai_error"},
                                        {"message", e.what()}
                                    };
                                    sendJsonMessage((void*)ws, errorJson.dump());
                                }
                            }).detach();
                        } else if (!geminiClient_) {
                            sendErrorJson((void*)ws, "AI service not available");
                        } else {
                            sendErrorJson((void*)ws, "Not authenticated");
                        }
                    }
                    // ============== Polls ==============
                    else if (type == "poll_create") {
                        if (data->authenticated) {
                            std::string roomId = msg.value("roomId", "global");
                            std::string question = msg.value("question", "");
                            auto options = msg.value("options", json::array());
                            
                            uint64_t now = static_cast<uint64_t>(std::time(nullptr));
                            std::string pollId = "poll-" + std::to_string(now) + "-" + data->userId.substr(0, 8);
                            
                            // Create poll struct for database
                            Poll pollData;
                            pollData.pollId = pollId;
                            pollData.roomId = roomId;
                            pollData.question = question;
                            pollData.createdBy = data->userId;
                            pollData.createdAt = now;
                            pollData.isClosed = false;
                            
                            json pollOptions = json::array();
                            int optIdx = 0;
                            for (const auto& opt : options) {
                                // Include pollId in optId to make it unique across polls
                                std::string optId = pollId + "-opt-" + std::to_string(optIdx);
                                PollOption optData;
                                optData.optionId = optId;
                                optData.text = opt.get<std::string>();
                                optData.index = optIdx;
                                optData.voteCount = 0;
                                pollData.options.push_back(optData);
                                
                                pollOptions.push_back({
                                    {"id", optId},
                                    {"text", opt.get<std::string>()},
                                    {"votes", 0},
                                    {"voters", json::array()}
                                });
                                optIdx++;
                            }
                            
                            // Save to database
                            auto db = authManager_->getDatabase();
                            if (db && db->createPoll(pollData)) {
                                Logger::info("✅ Poll saved to database: " + pollId);
                            }
                            
                            json poll = {
                                {"id", pollId},
                                {"question", question},
                                {"options", pollOptions},
                                {"createdBy", data->userId},
                                {"createdAt", now},
                                {"isClosed", false}
                            };
                            
                            json broadcastMsg = {
                                {"type", "poll_created"},
                                {"roomId", roomId},
                                {"poll", poll}
                            };
                            
                            // For DM rooms, send to both users
                            if (roomId.substr(0, 3) == "dm_") {
                                // Extract target user ID from dm_targetUserId format
                                std::string targetUserId = roomId.substr(3);
                                // Send to target user with their perspective roomId
                                std::string targetRoomId = "dm_" + data->userId;
                                json targetMsg = broadcastMsg;
                                targetMsg["roomId"] = targetRoomId;
                                sendToUser(targetUserId, targetMsg.dump());
                                // Send to sender
                                sendJsonMessage((void*)ws, broadcastMsg.dump());
                                Logger::info("📊 Poll sent to DM: " + roomId + " and " + targetRoomId);
                            } else {
                                // Broadcast to ALL users in room (including creator for confirmation)
                                broadcastToRoom(roomId, broadcastMsg.dump());
                            }
                            Logger::info("📊 Poll created by " + data->username + ": " + question);
                        }
                    }
                    else if (type == "poll_vote") {
                        if (data->authenticated) {
                            std::string pollId = msg.value("pollId", "");
                            std::string optionId = msg.value("optionId", "");
                            std::string roomId = msg.value("roomId", "");
                            
                            // Save vote to database
                            PollVote vote;
                            vote.pollId = pollId;
                            vote.optionId = optionId;
                            vote.userId = data->userId;
                            vote.username = data->username;
                            
                            auto db = authManager_->getDatabase();
                            if (db && db->votePoll(vote)) {
                                Logger::info("✅ Vote saved to database");
                            }
                            
                            json broadcastMsg = {
                                {"type", "poll_vote"},
                                {"pollId", pollId},
                                {"optionId", optionId},
                                {"roomId", roomId},
                                {"userId", data->userId},
                                {"username", data->username}
                            };
                            
                            // For DM rooms, send to both users
                            if (!roomId.empty() && roomId.substr(0, 3) == "dm_") {
                                std::string targetUserId = roomId.substr(3);
                                std::string targetRoomId = "dm_" + data->userId;
                                json targetMsg = broadcastMsg;
                                targetMsg["roomId"] = targetRoomId;
                                sendToUser(targetUserId, targetMsg.dump());
                                sendJsonMessage((void*)ws, broadcastMsg.dump());
                            } else if (!roomId.empty()) {
                                broadcastToRoom(roomId, broadcastMsg.dump());
                            } else {
                                sendJsonMessage((void*)ws, broadcastMsg.dump());
                            }
                            Logger::info("🗳️ Vote cast by " + data->username + " in room " + roomId);
                        }
                    }
                    else if (type == "poll_close") {
                        if (data->authenticated) {
                            std::string pollId = msg.value("pollId", "");
                            
                            auto db = authManager_->getDatabase();
                            if (db) {
                                auto poll = db->getPoll(pollId);
                                if (poll && poll->createdBy == data->userId) {
                                    db->closePoll(pollId);
                                    
                                    json broadcastMsg = {
                                        {"type", "poll_closed"},
                                        {"pollId", pollId}
                                    };
                                    broadcast(broadcastMsg.dump());
                                    Logger::info("📊 Poll closed: " + pollId);
                                } else {
                                    sendErrorJson((void*)ws, "Only poll creator can close the poll");
                                }
                            }
                        }
                    }
                    else if (type == "get_room_polls") {
                        if (data->authenticated) {
                            std::string roomId = msg.value("roomId", "global");
                            bool activeOnly = msg.value("activeOnly", false);
                            
                            auto db = authManager_->getDatabase();
                            if (db) {
                                auto polls = db->getRoomPolls(roomId, activeOnly);
                                json pollsJson = json::array();
                                
                                for (const auto& poll : polls) {
                                    json optionsJson = json::array();
                                    for (const auto& opt : poll.options) {
                                        json votersJson = json::array();
                                        for (size_t i = 0; i < opt.voterIds.size(); i++) {
                                            votersJson.push_back(opt.voterNames[i]);
                                        }
                                        optionsJson.push_back({
                                            {"id", opt.optionId},
                                            {"text", opt.text},
                                            {"votes", opt.voteCount},
                                            {"voters", votersJson}
                                        });
                                    }
                                    pollsJson.push_back({
                                        {"id", poll.pollId},
                                        {"question", poll.question},
                                        {"options", optionsJson},
                                        {"createdBy", poll.createdBy},
                                        {"createdAt", poll.createdAt},
                                        {"isClosed", poll.isClosed}
                                    });
                                }
                                
                                json response = {
                                    {"type", "room_polls"},
                                    {"roomId", roomId},
                                    {"polls", pollsJson}
                                };
                                sendJsonMessage((void*)ws, response.dump());
                            }
                        }
                    }
                    // ============== Games ==============
                    else if (type == "game_invite") {
                        if (data->authenticated) {
                            std::string gameType = msg.value("gameType", "tictactoe");
                            std::string opponentId = msg.value("opponentId", "");
                            std::string gameId = "game-" + std::to_string(std::time(nullptr)) + "-" + std::to_string(rand());
                            
                            // Store pending invite
                            json gameInfo = {
                                {"gameId", gameId},
                                {"gameType", gameType},
                                {"inviter", data->userId},
                                {"inviterName", data->username},
                                {"invitee", opponentId}
                            };
                            
                            json inviteMsg = {
                                {"type", "game_invite"},
                                {"gameId", gameId},
                                {"gameType", gameType},
                                {"fromUser", data->username},
                                {"fromUserId", data->userId}
                            };
                            
                            // Send to opponent
                            sendToUser(opponentId, inviteMsg.dump());
                            Logger::info("🎮 Game invite from " + data->username + " to " + opponentId);
                        }
                    }
                    else if (type == "game_accept") {
                        if (data->authenticated) {
                            std::string gameId = msg.value("gameId", "");
                            std::string inviterId = msg.value("fromUserId", "");
                            
                            // Create initial game state
                            json gameState = {
                                {"id", gameId},
                                {"type", "tictactoe"},
                                {"board", json::array({"", "", "", "", "", "", "", "", ""})},
                                {"currentTurn", "X"},
                                {"players", {{"X", inviterId}, {"O", data->userId}}},
                                {"winner", nullptr},
                                {"status", "playing"}
                            };
                            
                            json gameStartMsg = {
                                {"type", "game_start"},
                                {"gameId", gameId},
                                {"game", gameState}
                            };
                            
                            std::string gameMsg = gameStartMsg.dump();
                            
                            // Send to both players explicitly
                            sendToUser(inviterId, gameMsg);  // Send to inviter (X player)
                            sendToUser(data->userId, gameMsg);  // Send to accepter (O player)
                            
                            Logger::info("🎮 Game started: " + gameId + " between " + inviterId + " and " + data->userId);
                        }
                    }
                    else if (type == "game_reject") {
                        if (data->authenticated) {
                            std::string gameId = msg.value("gameId", "");
                            json rejectMsg = {
                                {"type", "game_rejected"},
                                {"gameId", gameId}
                            };
                            broadcast(rejectMsg.dump());
                            Logger::info("🎮 Game rejected: " + gameId);
                        }
                    }
                    else if (type == "game_move") {
                        if (data->authenticated) {
                            std::string gameId = msg.value("gameId", "");
                            int position = msg.value("position", -1);
                            
                            // Broadcast move to all connected users (they will filter by gameId)
                            json moveMsg = {
                                {"type", "game_move"},
                                {"gameId", gameId},
                                {"position", position},
                                {"playerId", data->userId}
                            };
                            broadcast(moveMsg.dump());
                            Logger::info("🎮 Game move in " + gameId + " at position " + std::to_string(position) + " by " + data->userId);
                        }
                    }
                    // ============== Watch Together ==============
                    else if (type == "watch_create") {
                        if (data->authenticated) {
                            std::string roomId = msg.value("roomId", "global");
                            std::string videoUrl = msg.value("videoUrl", "");
                            
                            json watchMsg = {
                                {"type", "watch_session_created"},
                                {"roomId", roomId},
                                {"videoUrl", videoUrl},
                                {"createdBy", data->username},
                                {"viewerCount", 1}
                            };
                            broadcastToRoom(roomId, watchMsg.dump(), "");
                            Logger::info("📺 Watch session created by " + data->username);
                        }
                    }
                    else if (type == "watch_sync") {
                        if (data->authenticated) {
                            std::string action = msg.value("action", "");
                            double time = msg.value("time", 0.0);
                            
                            json syncMsg = {
                                {"type", "watch_sync"},
                                {"action", action},
                                {"time", time},
                                {"syncedBy", data->username}
                            };
                            broadcast(syncMsg.dump());
                        }
                    }
                    else if (type == "watch_end") {
                        if (data->authenticated) {
                            json endMsg = {
                                {"type", "watch_ended"}
                            };
                            broadcast(endMsg.dump());
                            Logger::info("📺 Watch session ended");
                        }
                    }
                    // ============== Chunked File Upload ==============
                    else if (type == "upload_init") {
                        if (data->authenticated) {
                            std::string roomId = msg.value("roomId", "global");
                            Logger::info("📤 Upload init from " + data->username);
                            
                            // Call FileHandler to initialize upload
                            fileHandler_->handleUploadInit((void*)ws, msg, data->userId, roomId);
                        } else {
                            sendErrorJson((void*)ws, "Not authenticated");
                        }
                    }
                    else if (type == "upload_chunk") {
                        if (data->authenticated) {
                            std::string uploadId = msg.value("uploadId", "");
                            int chunkIndex = msg.value("chunkIndex", 0);
                            Logger::debug("📦 Upload chunk " + std::to_string(chunkIndex) + " from " + data->username);
                            
                            // Call FileHandler to process chunk
                            fileHandler_->handleUploadChunk((void*)ws, msg, data->userId);
                        } else {
                            sendErrorJson((void*)ws, "Not authenticated");
                        }
                    }
                    else if (type == "upload_finalize") {
                        if (data->authenticated) {
                            std::string uploadId = msg.value("uploadId", "");
                            Logger::info("✅ Upload finalize from " + data->username + " (" + uploadId + ")");
                            
                            // Call FileHandler to finalize upload
                            fileHandler_->handleUploadFinalize((void*)ws, msg, data->userId);
                        } else {
                            sendErrorJson((void*)ws, "Not authenticated");
                        }
                    }
                    // ============== Forward Message ==============
                    else if (type == "forward_message") {
                        if (data->authenticated) {
                            std::string messageId = msg.value("messageId", "");
                            std::string targetRoomId = msg.value("targetRoomId", "");
                            
                            if (messageId.empty() || targetRoomId.empty()) {
                                sendErrorJson((void*)ws, "messageId and targetRoomId required");
                            } else {
                                // Get original message from database
                                auto originalMsg = dbClient_->getMessage(messageId);
                                if (originalMsg) {
                                    // Create forwarded message
                                    uint64_t now = static_cast<uint64_t>(std::time(nullptr));
                                    std::string newMsgId = "msg-" + std::to_string(now) + "-" + data->userId.substr(0, 8);
                                    
                                    Message forwardedMsg;
                                    forwardedMsg.messageId = newMsgId;
                                    forwardedMsg.roomId = targetRoomId;
                                    forwardedMsg.senderId = data->userId;
                                    forwardedMsg.senderName = data->username;
                                    forwardedMsg.content = originalMsg->content;
                                    forwardedMsg.timestamp = now;
                                    forwardedMsg.metadata = "{\"forwarded_from\": \"" + messageId + "\", \"original_sender\": \"" + originalMsg->senderName + "\"}";
                                    
                                    if (dbClient_->createMessage(forwardedMsg)) {
                                        json response = {
                                            {"type", "message_forwarded"},
                                            {"messageId", newMsgId},
                                            {"originalMessageId", messageId},
                                            {"targetRoomId", targetRoomId},
                                            {"content", originalMsg->content},
                                            {"forwardedBy", data->username},
                                            {"originalSender", originalMsg->senderName},
                                            {"timestamp", now * 1000}
                                        };
                                        
                                        broadcastToRoom(targetRoomId, response.dump());
                                        sendJsonMessage((void*)ws, json({{"type", "forward_success"}, {"messageId", newMsgId}}).dump());
                                        Logger::info("↗️ Message forwarded by " + data->username);
                                    } else {
                                        sendErrorJson((void*)ws, "Failed to forward message");
                                    }
                                } else {
                                    sendErrorJson((void*)ws, "Original message not found");
                                }
                            }
                        } else {
                            sendErrorJson((void*)ws, "Not authenticated");
                        }
                    }
                    // ============== Block/Unblock User ==============
                    else if (type == "user_block") {
                        if (data->authenticated) {
                            std::string targetUserId = msg.value("targetUserId", "");
                            
                            if (targetUserId.empty()) {
                                sendErrorJson((void*)ws, "targetUserId required");
                            } else if (targetUserId == data->userId) {
                                sendErrorJson((void*)ws, "Cannot block yourself");
                            } else {
                                if (dbClient_->blockUser(data->userId, targetUserId)) {
                                    json response = {
                                        {"type", "user_blocked"},
                                        {"targetUserId", targetUserId},
                                        {"success", true}
                                    };
                                    sendJsonMessage((void*)ws, response.dump());
                                    Logger::info("🚫 User " + data->username + " blocked " + targetUserId);
                                } else {
                                    sendErrorJson((void*)ws, "Failed to block user");
                                }
                            }
                        } else {
                            sendErrorJson((void*)ws, "Not authenticated");
                        }
                    }
                    else if (type == "user_unblock") {
                        if (data->authenticated) {
                            std::string targetUserId = msg.value("targetUserId", "");
                            
                            if (targetUserId.empty()) {
                                sendErrorJson((void*)ws, "targetUserId required");
                            } else {
                                if (dbClient_->unblockUser(data->userId, targetUserId)) {
                                    json response = {
                                        {"type", "user_unblocked"},
                                        {"targetUserId", targetUserId},
                                        {"success", true}
                                    };
                                    sendJsonMessage((void*)ws, response.dump());
                                    Logger::info("✅ User " + data->username + " unblocked " + targetUserId);
                                } else {
                                    sendErrorJson((void*)ws, "Failed to unblock user");
                                }
                            }
                        } else {
                            sendErrorJson((void*)ws, "Not authenticated");
                        }
                    }
                    else if (type == "get_blocked_users") {
                        if (data->authenticated) {
                            auto blockedUsers = dbClient_->getBlockedUsers(data->userId);
                            json response = {
                                {"type", "blocked_users_list"},
                                {"blockedUsers", blockedUsers}
                            };
                            sendJsonMessage((void*)ws, response.dump());
                        } else {
                            sendErrorJson((void*)ws, "Not authenticated");
                        }
                    }
                    // ============== Kick User from Room ==============
                    else if (type == "kick_user") {
                        if (data->authenticated) {
                            std::string targetUserId = msg.value("targetUserId", "");
                            std::string roomId = msg.value("roomId", "");
                            
                            if (targetUserId.empty() || roomId.empty()) {
                                sendErrorJson((void*)ws, "targetUserId and roomId required");
                            } else {
                                // Check if user has permission (owner or admin)
                                std::string role = dbClient_->getMemberRole(roomId, data->userId);
                                if (role == "owner" || role == "admin") {
                                    // Remove user from room
                                    if (dbClient_->removeRoomMember(roomId, targetUserId)) {
                                        // Notify kicked user
                                        json kickNotify = {
                                            {"type", "kicked_from_room"},
                                            {"roomId", roomId},
                                            {"kickedBy", data->username}
                                        };
                                        sendToUser(targetUserId, kickNotify.dump());
                                        
                                        // Notify room
                                        json roomNotify = {
                                            {"type", "user_kicked"},
                                            {"roomId", roomId},
                                            {"targetUserId", targetUserId},
                                            {"kickedBy", data->username}
                                        };
                                        broadcastToRoom(roomId, roomNotify.dump());
                                        
                                        json response = {
                                            {"type", "kick_success"},
                                            {"targetUserId", targetUserId},
                                            {"roomId", roomId}
                                        };
                                        sendJsonMessage((void*)ws, response.dump());
                                        Logger::info("👢 User " + targetUserId + " kicked from " + roomId + " by " + data->username);
                                    } else {
                                        sendErrorJson((void*)ws, "Failed to kick user");
                                    }
                                } else {
                                    sendErrorJson((void*)ws, "No permission to kick users");
                                }
                            }
                        } else {
                            sendErrorJson((void*)ws, "Not authenticated");
                        }
                    }
                    // ============== Invite User to Room ==============
                    else if (type == "invite_user") {
                        if (data->authenticated) {
                            std::string targetUserId = msg.value("targetUserId", "");
                            std::string roomId = msg.value("roomId", "");
                            
                            if (targetUserId.empty() || roomId.empty()) {
                                sendErrorJson((void*)ws, "targetUserId and roomId required");
                            } else {
                                // Check if inviter is member of room
                                auto members = dbClient_->getRoomMembers(roomId);
                                bool isMember = std::find(members.begin(), members.end(), data->userId) != members.end();
                                
                                if (isMember) {
                                    // Add user to room
                                    if (dbClient_->addRoomMember(roomId, targetUserId)) {
                                        // Get room info
                                        auto room = dbClient_->getRoom(roomId);
                                        std::string roomName = room ? room->name : roomId;
                                        
                                        // Notify invited user
                                        json inviteNotify = {
                                            {"type", "room_invitation"},
                                            {"roomId", roomId},
                                            {"roomName", roomName},
                                            {"invitedBy", data->username}
                                        };
                                        sendToUser(targetUserId, inviteNotify.dump());
                                        
                                        // Notify room
                                        json roomNotify = {
                                            {"type", "user_invited"},
                                            {"roomId", roomId},
                                            {"targetUserId", targetUserId},
                                            {"invitedBy", data->username}
                                        };
                                        broadcastToRoom(roomId, roomNotify.dump());
                                        
                                        json response = {
                                            {"type", "invite_success"},
                                            {"targetUserId", targetUserId},
                                            {"roomId", roomId}
                                        };
                                        sendJsonMessage((void*)ws, response.dump());
                                        Logger::info("📨 User " + targetUserId + " invited to " + roomId + " by " + data->username);
                                    } else {
                                        sendErrorJson((void*)ws, "Failed to invite user (maybe already member)");
                                    }
                                } else {
                                    sendErrorJson((void*)ws, "You must be a room member to invite others");
                                }
                            }
                        } else {
                            sendErrorJson((void*)ws, "Not authenticated");
                        }
                    }
                    // ============== Sticker Message ==============
                    else if (type == "chat_sticker") {
                        if (data->authenticated) {
                            std::string sticker = msg.value("sticker", "");
                            std::string roomId = msg.value("roomId", "global");
                            
                            if (sticker.empty()) {
                                sendErrorJson((void*)ws, "sticker required");
                            } else {
                                uint64_t now = static_cast<uint64_t>(std::time(nullptr));
                                std::string messageId = "sticker-" + std::to_string(now) + "-" + data->userId.substr(0, 8);
                                
                                Message stickerMsg;
                                stickerMsg.messageId = messageId;
                                stickerMsg.roomId = roomId;
                                stickerMsg.senderId = data->userId;
                                stickerMsg.senderName = data->username;
                                stickerMsg.content = "[sticker:" + sticker + "]";
                                stickerMsg.timestamp = now;
                                stickerMsg.metadata = "{\"type\": \"sticker\", \"sticker\": \"" + sticker + "\"}";
                                
                                if (dbClient_->createMessage(stickerMsg)) {
                                    json response = {
                                        {"type", "chat"},
                                        {"messageType", "sticker"},
                                        {"messageId", messageId},
                                        {"roomId", roomId},
                                        {"userId", data->userId},
                                        {"username", data->username},
                                        {"sticker", sticker},
                                        {"timestamp", now * 1000}
                                    };
                                    std::string responseStr = response.dump();
                                    sendJsonMessage((void*)ws, responseStr);  // Echo to sender
                                    broadcastToRoom(roomId, responseStr, data->userId);  // Broadcast to others
                                    Logger::info("🎨 Sticker sent by " + data->username);
                                } else {
                                    sendErrorJson((void*)ws, "Failed to send sticker");
                                }
                            }
                        } else {
                            sendErrorJson((void*)ws, "Not authenticated");
                        }
                    }
                    // ============== Location Message ==============
                    else if (type == "chat_location") {
                        if (data->authenticated) {
                            double latitude = msg.value("latitude", 0.0);
                            double longitude = msg.value("longitude", 0.0);
                            std::string roomId = msg.value("roomId", "global");
                            
                            if (latitude == 0.0 && longitude == 0.0) {
                                sendErrorJson((void*)ws, "latitude and longitude required");
                            } else {
                                uint64_t now = static_cast<uint64_t>(std::time(nullptr));
                                std::string messageId = "loc-" + std::to_string(now) + "-" + data->userId.substr(0, 8);
                                
                                std::string locationStr = std::to_string(latitude) + "," + std::to_string(longitude);
                                
                                Message locMsg;
                                locMsg.messageId = messageId;
                                locMsg.roomId = roomId;
                                locMsg.senderId = data->userId;
                                locMsg.senderName = data->username;
                                locMsg.content = "[location:" + locationStr + "]";
                                locMsg.timestamp = now;
                                locMsg.metadata = "{\"type\": \"location\", \"latitude\": " + std::to_string(latitude) + ", \"longitude\": " + std::to_string(longitude) + "}";
                                
                                if (dbClient_->createMessage(locMsg)) {
                                    json response = {
                                        {"type", "chat"},
                                        {"messageType", "location"},
                                        {"messageId", messageId},
                                        {"roomId", roomId},
                                        {"userId", data->userId},
                                        {"username", data->username},
                                        {"latitude", latitude},
                                        {"longitude", longitude},
                                        {"timestamp", now * 1000}
                                    };
                                    std::string responseStr = response.dump();
                                    sendJsonMessage((void*)ws, responseStr);  // Echo to sender
                                    broadcastToRoom(roomId, responseStr, data->userId);  // Broadcast to others
                                    Logger::info("📍 Location sent by " + data->username);
                                } else {
                                    sendErrorJson((void*)ws, "Failed to send location");
                                }
                            }
                        } else {
                            sendErrorJson((void*)ws, "Not authenticated");
                        }
                    }
                    else {
                        Logger::warning("Unknown message type: " + type);
                        sendErrorJson((void*)ws, "Unknown message type");
                    }
                    
                } catch (const json::exception& e) {
                    Logger::error("JSON parse error: " + std::string(e.what()));
                    sendErrorJson((void*)ws, "Invalid JSON");
                } catch (const std::exception& e) {
                    Logger::error("Message handling error: " + std::string(e.what()));
                    sendErrorJson((void*)ws, "Internal error");
                }
            },
            
            .drain = [](auto* ws) {},
            .ping = [](auto* ws, std::string_view) {},
            .pong = [](auto* ws, std::string_view) {},
            
            // Connection closed
            .close = [this](auto* ws, int code, std::string_view message) {
                PerSocketData* data = ws->getUserData();
                
                if (data->authenticated) {
                    Logger::info("Client disconnected: " + data->username);
                    
                    // Update user status to offline in database
                    try {
                        dbClient_->updateUserStatus(data->userId, 0);  // 0 = offline
                        Logger::debug("Updated " + data->username + " status to offline");
                    } catch (const std::exception& e) {
                        Logger::warning("Failed to update offline status: " + std::string(e.what()));
                    }
                    
                    // Broadcast offline presence to other users
                    json offlineMsg = {
                        {"type", "presence_update"},
                        {"userId", data->userId},
                        {"username", data->username},
                        {"status", "offline"}
                    };
                    
                    // Broadcast to all other connections
                    {
                        std::lock_guard<std::mutex> lock(connectionsMutex_);
                        for (const auto& [key, state] : connections_) {
                            if (state.authenticated && state.wsPtr && state.userId != data->userId) {
                                auto* otherWs = (uWS::WebSocket<false, true, PerSocketData>*)state.wsPtr;
                                otherWs->send(offlineMsg.dump(), uWS::OpCode::TEXT);
                            }
                        }
                    }
                } else {
                    Logger::info("Client disconnected (not authenticated)");
                }
                
                // Remove connection
                {
                    std::lock_guard<std::mutex> lock(connectionsMutex_);
                    connections_.erase((void*)ws);
                }
            }
        });
        
        // HTTP health check
        app.get("/health", [](auto* res, auto* req) {
            res->writeStatus("200 OK")
               ->writeHeader("Content-Type", "application/json")
               ->end("{\"status\":\"ok\",\"service\":\"chatbox-websocket\"}");
        });
        
        // Listen
        app.listen(port_, [this](auto* listenSocket) {
            if (listenSocket) {
                Logger::info("========================================");
                Logger::info("✅ WebSocket server LIVE!");
                Logger::info("========================================"); 
                Logger::info("Listening on: 0.0.0.0:" + std::to_string(port_));
                Logger::info("WebSocket: ws://localhost:" + std::to_string(port_) + "/");
                Logger::info("Health: http://localhost:" + std::to_string(port_) + "/health");
                Logger::info("");
                Logger::info("Protocol: ChatBox v1");
                Logger::info("  - register: Create new account");
                Logger::info("  - login: Authenticate user");
                Logger::info("  - chat: Send message");
                Logger::info("  - ping: Keep-alive");
                Logger::info("========================================");
                Logger::info("");
                Logger::info("Ready for protocol messages! 🚀");
                Logger::info("");
            } else {
                Logger::error("❌ Failed to listen on port " + std::to_string(port_));
                running_ = false;
            }
        });
        
        app.run();
        
    } catch (const std::exception& e) {
        Logger::error("WebSocket server error: " + std::string(e.what()));
        running_ = false;
    }
    
    Logger::info("WebSocket server stopped");
}

void WebSocketServer::stop() {
    if (running_) {
        running_ = false;
        Logger::info("Stopping WebSocket server...");
    }
}

// Protocol message handlers

void WebSocketServer::sendJsonMessage(void* wsPtr, const std::string& jsonStr) {
    // Cast back to proper WebSocket type - we know it's non-SSL from our App setup
    auto* ws = (uWS::WebSocket<false, true, PerSocketData>*)wsPtr;
    ws->send(jsonStr, uWS::OpCode::TEXT);
}

void WebSocketServer::sendErrorJson(void* wsPtr, const std::string& error) {
    json response = {
        {"type", "error"},
        {"message", error}
    };
    sendJsonMessage(wsPtr, response.dump());
}

void WebSocketServer::handleRegisterJson(void* wsPtr, const std::string& jsonStr) {
    try {
        json msg = json::parse(jsonStr);
        
        std::string username = msg.value("username", "");
        std::string password = msg.value("password", "");
        std::string email = msg.value("email", "");
        
        if (username.empty() || password.empty()) {
            sendErrorJson(wsPtr, "Username and password required");
            return;
        }
        
        UserRegistration reg;
        reg.username = username;
        reg.password = password;
        reg.email = email.empty() ? (username + "@chatbox.local") : email;
        
        bool success = authManager_->registerUser(reg);
        
        json response = {
            {"type", "register_response"},
            {"success", success},
            {"message", success ? "Registration successful" : "Username already exists"}
        };
        
        sendJsonMessage(wsPtr, response.dump());
        Logger::info(success ? "✓ User registered: " + username : "✗ Registration failed: " + username);
        
    } catch (const std::exception& e) {
        Logger::error("Register error: " + std::string(e.what()));
        sendErrorJson(wsPtr, "Registration failed");
    }
}

void WebSocketServer::handleLoginJson(void* wsPtr, const std::string& jsonStr) {
    try {
        auto* ws = (uWS::WebSocket<false, true, PerSocketData>*)wsPtr;
        PerSocketData* data = ws->getUserData();
        
        json msg = json::parse(jsonStr);
        
        std::string username = msg.value("username", "");
        std::string password = msg.value("password", "");
        
        if (username.empty() || password.empty()) {
            sendErrorJson(wsPtr, "Username and password required");
            return;
        }
        
        LoginResult result = authManager_->login(username, password);
        
        if (result.success) {
            // Mark socket as authenticated
            data->authenticated = true;
            data->userId = result.userId;
            data->username = username;
            data->sessionId = "ws-session-" + result.userId;
            
            // Update connection state in connections_ map for broadcast
            {
                std::lock_guard<std::mutex> lock(connectionsMutex_);
                if (connections_.find(wsPtr) != connections_.end()) {
                    connections_[wsPtr].authenticated = true;
                    connections_[wsPtr].userId = result.userId;
                    connections_[wsPtr].username = username;
                    Logger::info("📝 Updated connection state for: " + username);
                }
            }
            
            // Get user's display name and avatar from database
            std::string displayName = username;
            std::string avatar = "";
            try {
                auto session = dbClient_->getSession();
                if (session) {
                    auto userResult = session->sql(
                        "SELECT display_name, avatar_url FROM users WHERE user_id = ?"
                    ).bind(result.userId).execute();
                    auto row = userResult.fetchOne();
                    if (row) {
                        if (!row[0].isNull()) displayName = row[0].get<std::string>();
                        if (!row[1].isNull()) avatar = row[1].get<std::string>();
                    }
                }
            } catch (const std::exception& e) {
                Logger::warning("Failed to get user profile: " + std::string(e.what()));
            }

            json response = {
                {"type", "login_response"},
                {"success", true},
                {"token", result.token},
                {"userId", result.userId},
                {"username", displayName.empty() ? username : displayName},
                {"avatar", avatar},
                {"message", "Login successful"}
            };
            
            sendJsonMessage(wsPtr, response.dump());
            Logger::info("✓ User logged in: " + username + " (userId: " + result.userId + ")");
            
            // Send chat history for global room
            try {
                std::string defaultRoom = "global";
                auto messages = authManager_->getDatabase()->getRecentMessages(defaultRoom, 50, 0);
                
                if (!messages.empty()) {
                    Logger::info("📜 Sending " + std::to_string(messages.size()) + " history messages to " + username);
                    
                    json historyResponse = {
                        {"type", "history"},
                        {"roomId", defaultRoom},
                        {"messages", json::array()}
                    };
                    
                    for (const auto& msg : messages) {
                        json msgJson = {
                            {"messageId", msg.messageId},
                            {"roomId", msg.roomId},
                            {"userId", msg.senderId},
                            {"username", msg.senderName},
                            {"content", msg.content},
                            {"timestamp", msg.timestamp}
                        };
                        // Include metadata if present
                        if (!msg.metadata.empty()) {
                            try {
                                msgJson["metadata"] = json::parse(msg.metadata);
                            } catch (...) {
                                // Invalid JSON, skip metadata
                            }
                        }
                        historyResponse["messages"].push_back(msgJson);
                    }
                    
                    sendJsonMessage(wsPtr, historyResponse.dump());
                }
            } catch (const std::exception& e) {
                Logger::error("Failed to load history: " + std::string(e.what()));
            }
            
            // Broadcast user joined to all other users
            json userJoinedMsg = {
                {"type", "user_joined"},
                {"userId", result.userId},
                {"username", username}
            };
            broadcastToRoom("global", userJoinedMsg.dump(), result.userId);
            Logger::info("📢 Broadcast user_joined: " + username);
            
        } else {
            json response = {
                {"type", "login_response"},
                {"success", false},
                {"message", result.errorMessage}
            };
            
            sendJsonMessage(wsPtr, response.dump());
            Logger::warning("✗ Login failed: " + username);
        }
        
    } catch (const std::exception& e) {
        Logger::error("Login error: " + std::string(e.what()));
        sendErrorJson(wsPtr, "Login failed");
    }
}

void WebSocketServer::handleChatMessageJson(void* wsPtr, const std::string& jsonStr) {
    try {
        auto* ws = (uWS::WebSocket<false, true, PerSocketData>*)wsPtr;
        PerSocketData* data = ws->getUserData();
        
        json msg = json::parse(jsonStr);
        
        std::string content = msg.value("content", "");
        std::string roomId = msg.value("roomId", "global");
        
        if (content.empty()) {
            return;
        }
        
        Logger::info("💬 Chat from " + data->username + " in room '" + roomId + "': " + content);
        
        // ============================================================================
        // CHECK FOR @AI COMMAND
        // ============================================================================
        if (content.length() > 3 && content.substr(0, 3) == "@ai" && geminiClient_) {
            std::string question = content.substr(3);
            // Trim leading spaces
            size_t start = question.find_first_not_of(" \t");
            if (start != std::string::npos) {
                question = question.substr(start);
            }
            
            Logger::info("🤖 AI command detected: " + question);
            
            // Get AI response
            auto aiResponse = geminiClient_->sendMessage(question);
            
            if (aiResponse.has_value()) {
                Logger::info("✓ AI response received (" + std::to_string(aiResponse.value().length()) + " chars)");
                
                // Generate AI message ID
                std::string aiMessageId = "msg-ai-" + std::to_string(std::time(nullptr));
                
                // Create AI response message
                json aiMsg = {
                    {"type", "chat"},
                    {"messageId", aiMessageId},
                    {"roomId", roomId},
                    {"userId", "ai-assistant"},
                    {"username", "AI Assistant"},
                    {"content", aiResponse.value()},
                    {"timestamp", std::time(nullptr)}
                };
                
                // Save AI response to database
                try {
                    Message aiDbMessage;
                    aiDbMessage.messageId = aiMessageId;
                    aiDbMessage.roomId = roomId;
                    aiDbMessage.senderId = "ai-assistant";
                    aiDbMessage.senderName = "AI Assistant";
                    aiDbMessage.content = aiResponse.value();
                    aiDbMessage.messageType = 0;
                    aiDbMessage.replyToId = "";
                    aiDbMessage.timestamp = std::time(nullptr);
                    
                    authManager_->getDatabase()->createMessage(aiDbMessage);
                    Logger::info("💾 AI message saved to database");
                } catch (const std::exception& e) {
                    Logger::error("Failed to save AI message: " + std::string(e.what()));
                }
                
                // Broadcast AI response to all users in room (including sender)
                std::string aiResponseStr = aiMsg.dump();
                sendJsonMessage(wsPtr, aiResponseStr);
                broadcastToRoom(roomId, aiResponseStr);
                
                Logger::info("✅ AI response broadcasted to room");
                return; // Don't process as regular message
            } else {
                Logger::error("✗ Failed to get AI response");
                // Continue to process as regular message
            }
        }
        // ============================================================================
        
        // Generate message ID
        std::string messageId = "msg-" + std::to_string(std::time(nullptr)) + "-" + 
                                data->userId.substr(0, 8);
        
        // Check if message has metadata (file attachment)
        json metadata = nullptr;
        if (msg.contains("metadata") && msg["metadata"].is_object()) {
            metadata = msg["metadata"];
        }
        
        // Create message response
        json response = {
            {"type", "chat"},
            {"messageId", messageId},
            {"roomId", roomId},
            {"userId", data->userId},
            {"username", data->username},
            {"content", content},
            {"timestamp", std::time(nullptr) * 1000}  // Convert to milliseconds for JS
        };
        
        // Add metadata if present (for file attachments)
        if (!metadata.is_null()) {
            response["metadata"] = metadata;
            Logger::info("📎 Message has file attachment: " + metadata.value("fileName", "unknown"));
        }
        
        std::string responseStr = response.dump();
        
        // Save to database
        try {
            Logger::info("🔍 Preparing to save message to database...");
            
            // For DM, use conversation_id from database (Discord/Telegram style)
            std::string storageRoomId = roomId;
            if (roomId.rfind("dm_", 0) == 0) {
                std::string targetUserId = roomId.substr(3);
                // Get or create DM conversation (like Discord channel)
                storageRoomId = dbClient_->getOrCreateDmConversation(data->userId, targetUserId);
                Logger::info("📦 DM conversation roomId for storage: " + storageRoomId);
            }
            
            Message dbMessage;
            dbMessage.messageId = messageId;
            dbMessage.roomId = storageRoomId;  // Use conversation_id for DM
            dbMessage.senderId = data->userId;
            dbMessage.senderName = data->username;  // Add sender name
            dbMessage.content = content;
            dbMessage.messageType = 0;  // 0 = text message
            dbMessage.replyToId = "";   // No reply for now
            dbMessage.timestamp = std::time(nullptr);
            // Save metadata as JSON string
            if (!metadata.is_null()) {
                dbMessage.metadata = metadata.dump();
            }
            
            Logger::info("🔍 Calling authManager_->getDatabase()->createMessage()...");
            
            // Note: Will use DB default for created_at
            bool saved = authManager_->getDatabase()->createMessage(dbMessage);
            
            if (saved) {
                Logger::info("💾 Message saved to database");
            } else {
                Logger::error("✗ createMessage returned false!");
            }
            
        } catch (const std::exception& e) {
            Logger::error("Failed to save message to DB: " + std::string(e.what()));
            // Continue anyway - message still gets broadcast
        }
        
        // Check if this is a DM (format: dm_userId)
        if (roomId.rfind("dm_", 0) == 0) {
            // Extract target user ID from room ID
            std::string targetUserId = roomId.substr(3); // Remove "dm_" prefix
            Logger::info("📨 DM detected from " + data->userId + " to user: " + targetUserId);
            
            // Create response for sender with their perspective roomId
            json senderResponse = {
                {"type", "chat"},
                {"messageId", response["messageId"]},
                {"roomId", roomId},  // Sender sees dm_targetUserId
                {"userId", data->userId},
                {"username", data->username},
                {"content", content},
                {"timestamp", response["timestamp"]}
            };
            if (!metadata.is_null()) {
                senderResponse["metadata"] = metadata;
            }
            sendJsonMessage(wsPtr, senderResponse.dump());
            
            // Create response for receiver with their perspective roomId
            json receiverResponse = {
                {"type", "chat"},
                {"messageId", response["messageId"]},
                {"roomId", "dm_" + data->userId},  // Receiver sees dm_senderId
                {"userId", data->userId},
                {"username", data->username},
                {"content", content},
                {"timestamp", response["timestamp"]}
            };
            if (!metadata.is_null()) {
                receiverResponse["metadata"] = metadata;
            }
            
            // Send to target user with their perspective roomId
            sendToUser(targetUserId, receiverResponse.dump());
        } else {
            // Echo back to sender for non-DM messages
            sendJsonMessage(wsPtr, responseStr);
            // Broadcast to all other users in room
            broadcastToRoom(roomId, responseStr, data->userId);
        }
        
        // Publish to PubSub (for future multi-server support)
        broker_->publish("chat." + roomId, responseStr);
        
    } catch (const std::exception& e) {
        Logger::error("Chat message error: " + std::string(e.what()));
    }
}

// Public methods
size_t WebSocketServer::getConnectionCount() const {
    std::lock_guard<std::mutex> lock(connectionsMutex_);
    return connections_.size();
}

void WebSocketServer::broadcast(const std::string& message) {
    std::lock_guard<std::mutex> lock(connectionsMutex_);
    
    int sent = 0;
    for (const auto& [key, state] : connections_) {
        if (state.authenticated && state.wsPtr) {
            auto* ws = (uWS::WebSocket<false, true, PerSocketData>*)state.wsPtr;
            ws->send(message, uWS::OpCode::TEXT);
            sent++;
        }
    }
    
    Logger::info("📢 Broadcast to " + std::to_string(sent) + " authenticated clients");
}

void WebSocketServer::broadcastToRoom(const std::string& roomId, const std::string& message, const std::string& excludeUserId) {
    std::lock_guard<std::mutex> lock(connectionsMutex_);
    
    // Special handling for "global" room - broadcast to ALL authenticated users
    if (roomId == "global") {
        int sent = 0;
        for (const auto& [key, state] : connections_) {
            if (state.authenticated && state.wsPtr && state.userId != excludeUserId) {
                auto* ws = (uWS::WebSocket<false, true, PerSocketData>*)state.wsPtr;
                ws->send(message, uWS::OpCode::TEXT);
                sent++;
            }
        }
        Logger::info("📢 Broadcast to global room: " + std::to_string(sent) + " users");
        return;
    }
    
    // For other rooms, send to all room members (not just currently viewing)
    std::vector<std::string> roomMembers;
    try {
        roomMembers = dbClient_->getRoomMembers(roomId);
    } catch (...) {
        Logger::warning("Could not get room members for: " + roomId);
    }
    
    int sent = 0;
    for (const auto& [key, state] : connections_) {
        // Skip excluded user (usually sender) and unauthenticated users
        if (!state.authenticated || !state.wsPtr || state.userId == excludeUserId) {
            continue;
        }
        
        bool shouldSend = false;
        
        // Check if user is a member of this room (from database)
        for (const auto& memberId : roomMembers) {
            if (memberId == state.userId) {
                shouldSend = true;
                break;
            }
        }
        
        // Also send if user is currently viewing this room
        if (!shouldSend && state.currentRoom == roomId) {
            shouldSend = true;
        }
        
        if (shouldSend) {
            auto* ws = (uWS::WebSocket<false, true, PerSocketData>*)state.wsPtr;
            ws->send(message, uWS::OpCode::TEXT);
            sent++;
        }
    }
    
    Logger::info("📢 Broadcast to room '" + roomId + "': " + std::to_string(sent) + " users");
}

void WebSocketServer::sendToUser(const std::string& userId, const std::string& message) {
    std::lock_guard<std::mutex> lock(connectionsMutex_);
    
    Logger::info("🔍 sendToUser looking for userId: " + userId);
    Logger::info("🔍 Total connections: " + std::to_string(connections_.size()));
    
    for (const auto& [key, state] : connections_) {
        Logger::debug("🔍 Checking connection: userId=" + state.userId + ", authenticated=" + std::to_string(state.authenticated));
        if (state.authenticated && state.wsPtr && state.userId == userId) {
            auto* ws = (uWS::WebSocket<false, true, PerSocketData>*)state.wsPtr;
            ws->send(message, uWS::OpCode::TEXT);
            Logger::info("📤 Message sent to user: " + userId);
            return;
        }
    }
    
    Logger::warning("User not found or not connected: " + userId);
}

void WebSocketServer::handleTypingJson(void* wsPtr, const std::string& jsonStr) {
    try {
        auto* ws = (uWS::WebSocket<false, true, PerSocketData>*)wsPtr;
        PerSocketData* data = ws->getUserData();
        
        json msg = json::parse(jsonStr);
        bool isTyping = msg.value("isTyping", false);
        
        json response = {
            {"type", "typing"},
            {"userId", data->userId},
            {"username", data->username},
            {"isTyping", isTyping}
        };
        
        // Broadcast to room, excluding sender
        broadcastToRoom("global", response.dump(), data->userId);
        
    } catch (const std::exception& e) {
        Logger::error("Typing handler error: " + std::string(e.what()));
    }
}

void WebSocketServer::handleGetOnlineUsersJson(void* wsPtr) {
    try {
        auto* ws = (uWS::WebSocket<false, true, PerSocketData>*)wsPtr;
        PerSocketData* currentUser = ws->getUserData();
        
        // Get online user IDs from connections
        std::set<std::string> onlineUserIds;
        {
            std::lock_guard<std::mutex> lock(connectionsMutex_);
            for (const auto& [ptr, state] : connections_) {
                if (state.authenticated && !state.userId.empty()) {
                    onlineUserIds.insert(state.userId);
                }
            }
        }
        
        // Get all users from database and mark online status
        json usersArray = json::array();
        auto db = authManager_->getDatabase();
        if (db) {
            auto allUsers = db->getAllUsers();
            for (const auto& user : allUsers) {
                // Don't include current user in the list
                if (user.userId == currentUser->userId) continue;
                
                bool isOnline = onlineUserIds.find(user.userId) != onlineUserIds.end();
                usersArray.push_back({
                    {"userId", user.userId},
                    {"username", user.username},
                    {"online", isOnline},
                    {"status", isOnline ? "online" : "offline"}
                });
            }
        }
        
        json response = {
            {"type", "online_users"},
            {"users", usersArray},
            {"count", usersArray.size()}
        };
        
        sendJsonMessage(wsPtr, response.dump());
        Logger::info("📋 Sent users list: " + std::to_string(usersArray.size()) + " users (" + std::to_string(onlineUserIds.size()) + " online)");
        
    } catch (const std::exception& e) {
        Logger::error("Get online users error: " + std::string(e.what()));
    }
}

void WebSocketServer::handleEditMessageJson(void* wsPtr, const std::string& jsonStr) {
    try {
        auto* ws = (uWS::WebSocket<false, true, PerSocketData>*)wsPtr;
        PerSocketData* data = ws->getUserData();
        
        json msg = json::parse(jsonStr);
        std::string messageId = msg.value("messageId", "");
        std::string newContent = msg.value("newContent", "");
        std::string roomId = msg.value("roomId", "global");
        
        if (messageId.empty() || newContent.empty()) {
            sendErrorJson(wsPtr, "Missing messageId or newContent");
            return;
        }
        
        Logger::info("✏️ Edit message request: " + messageId + " by " + data->username);
        
        // Verify user owns this message
        auto db = authManager_->getDatabase();
        if (db) {
            auto message = db->getMessage(messageId);
            if (message.has_value()) {
                if (message->senderId != data->userId) {
                    sendErrorJson(wsPtr, "You can only edit your own messages");
                    return;
                }
                roomId = message->roomId;
            }
        }
        
        // Update in database
        if (db) {
            try {
                db->getSession()->sql(
                    "UPDATE messages SET content = ?, edited_at = NOW() WHERE message_id = ? AND sender_id = ?"
                ).bind(newContent, messageId, data->userId).execute();
            } catch (...) {
                Logger::warning("Could not update message in database");
            }
        }
        
        json response = {
            {"type", "message_edited"},
            {"messageId", messageId},
            {"newContent", newContent},
            {"editedAt", std::time(nullptr)},
            {"userId", data->userId}
        };
        
        // Send to sender first
        sendJsonMessage(wsPtr, response.dump());
        // Broadcast to room (excluding sender)
        broadcastToRoom(roomId, response.dump(), data->sessionId);
        Logger::info("✅ Message edited and broadcasted");
        
    } catch (const std::exception& e) {
        Logger::error("Edit message error: " + std::string(e.what()));
        sendErrorJson(wsPtr, "Failed to edit message");
    }
}

void WebSocketServer::handleDeleteMessageJson(void* wsPtr, const std::string& jsonStr) {
    try {
        auto* ws = (uWS::WebSocket<false, true, PerSocketData>*)wsPtr;
        PerSocketData* data = ws->getUserData();
        
        json msg = json::parse(jsonStr);
        std::string messageId = msg.value("messageId", "");
        std::string roomId = msg.value("roomId", "global");
        
        if (messageId.empty()) {
            sendErrorJson(wsPtr, "Missing messageId");
            return;
        }
        
        Logger::info("🗑️ Delete message request: " + messageId + " by " + data->username);
        
        // Verify user owns this message
        auto db = authManager_->getDatabase();
        if (db) {
            auto message = db->getMessage(messageId);
            if (message.has_value()) {
                if (message->senderId != data->userId) {
                    // Check if user is room admin/owner
                    bool isAdmin = db->hasMemberPermission(message->roomId, data->userId, "kick");
                    if (!isAdmin) {
                        sendErrorJson(wsPtr, "You can only delete your own messages");
                        return;
                    }
                }
                roomId = message->roomId;
            }
        }
        
        // Soft delete in database (set is_deleted=1)
        if (db) {
            try {
                db->getSession()->sql(
                    "UPDATE messages SET is_deleted = 1, deleted_at = NOW() WHERE message_id = ?"
                ).bind(messageId).execute();
            } catch (...) {
                Logger::warning("Could not mark message as deleted in database");
            }
        }
        
        json response = {
            {"type", "message_deleted"},
            {"messageId", messageId},
            {"userId", data->userId}
        };
        
        // Send to sender first
        sendJsonMessage(wsPtr, response.dump());
        // Broadcast to room (excluding sender)
        broadcastToRoom(roomId, response.dump(), data->sessionId);
        Logger::info("✅ Message deleted and broadcasted");
        
    } catch (const std::exception& e) {
        Logger::error("Delete message error: " + std::string(e.what()));
        sendErrorJson(wsPtr, "Failed to delete message");
    }
}

// Room management handlers

void WebSocketServer::handleCreateRoomJson(void* wsPtr, const std::string& jsonStr) {
    try {
        auto* ws = (uWS::WebSocket<false, true, PerSocketData>*)wsPtr;
        PerSocketData* data = ws->getUserData();
        
        json msg = json::parse(jsonStr);
        // Support both 'name' and 'roomName' for compatibility
        std::string roomName = msg.value("name", msg.value("roomName", ""));
        std::string roomType = msg.value("roomType", "public");
        
        if (roomName.empty()) {
            sendErrorJson(wsPtr, "Room name required");
            return;
        }
        
        // Generate room ID
        std::string roomId = "room-" + std::to_string(std::time(nullptr)) + "-" + data->userId.substr(0, 8);
        
        Logger::info("🏠 Creating room: " + roomName + " (" + roomId + ") by " + data->username);
        
        // Save to database
        auto db = authManager_->getDatabase();
        if (db) {
            Room room;
            room.roomId = roomId;
            room.name = roomName;
            room.creatorId = data->userId;
            
            if (db->createRoom(room)) {
                Logger::info("✅ Room saved to database: " + roomId);
            } else {
                Logger::warning("⚠️ Failed to save room to database");
            }
        }
        
        json response = {
            {"type", "room_created"},
            {"roomId", roomId},
            {"roomName", roomName},
            {"roomType", roomType}
        };
        
        sendJsonMessage(wsPtr, response.dump());
        Logger::info("✅ Room created: " + roomId);
        
    } catch (const std::exception& e) {
        Logger::error("Create room error: " + std::string(e.what()));
        sendErrorJson(wsPtr, "Failed to create room");
    }
}

void WebSocketServer::handleJoinRoomJson(void* wsPtr, const std::string& jsonStr) {
    try {
        auto* ws = (uWS::WebSocket<false, true, PerSocketData>*)wsPtr;
        PerSocketData* data = ws->getUserData();
        
        json msg = json::parse(jsonStr);
        std::string roomId = msg.value("roomId", "");
        
        if (roomId.empty()) {
            sendErrorJson(wsPtr, "Room ID required");
            return;
        }
        
        Logger::info("🚪 User joining room: " + data->username + " → " + roomId);
        
        // Update currentRoom in PerSocketData
        data->currentRoom = roomId;
        
        // Update currentRoom in connections_ map
        {
            std::lock_guard<std::mutex> lock(connectionsMutex_);
            if (connections_.count(wsPtr)) {
                connections_[wsPtr].currentRoom = roomId;
            }
        }
        
        // Save to room_members table
        bool added = dbClient_->addRoomMember(roomId, data->userId);
        if (!added) {
            Logger::warning("User already member or failed to add to room");
        }
        
        // For DM, use conversation_id from database (Discord/Telegram style)
        std::string queryRoomId = roomId;
        if (roomId.rfind("dm_", 0) == 0) {
            std::string targetUserId = roomId.substr(3);
            Logger::info("📦 DM join - user=" + data->userId + ", target=" + targetUserId);
            // Get or create DM conversation (like Discord channel)
            queryRoomId = dbClient_->getOrCreateDmConversation(data->userId, targetUserId);
            Logger::info("📦 DM conversation roomId for query: " + queryRoomId);
        }
        
        // Load room history using conversation_id
        Logger::info("📚 Loading history for queryRoomId: " + queryRoomId);
        auto historyMessages = dbClient_->getMessagesByRoom(queryRoomId, 50);
        Logger::info("📚 Got " + std::to_string(historyMessages.size()) + " messages from DB for roomId=" + queryRoomId);
        json history = json::array();
        for (const auto& m : historyMessages) {
            // For DM history, convert roomId back to user's perspective
            std::string displayRoomId = m.roomId;
            if (m.roomId.rfind("dm_", 0) == 0) {
                // This is a DM conversation_id
                // Convert to user's perspective (dm_otherUserId)
                displayRoomId = roomId;  // Use the roomId the user requested
            }
            json msgJson = {
                {"messageId", m.messageId},
                {"roomId", displayRoomId},
                {"userId", m.senderId},
                {"username", m.senderName},
                {"content", m.content},
                {"timestamp", m.timestamp * 1000}
            };
            // Add metadata if present
            if (!m.metadata.empty()) {
                try {
                    msgJson["metadata"] = json::parse(m.metadata);
                } catch (...) {}
            }
            history.push_back(msgJson);
        }
        
        // Get room members
        auto members = dbClient_->getRoomMembers(roomId);
        
        // Build members array with user info
        json membersJson = json::array();
        for (const auto& memberId : members) {
            auto userOpt = dbClient_->getUserById(memberId);
            if (userOpt) {
                json memberObj = {
                    {"userId", userOpt->userId},
                    {"username", userOpt->username},
                    {"avatar", userOpt->avatarUrl}
                };
                membersJson.push_back(memberObj);
            }
        }
        
        // Load active polls for this room (try both roomId and queryRoomId for DM)
        auto roomPolls = dbClient_->getRoomPolls(roomId, false);
        if (roomPolls.empty() && roomId != queryRoomId) {
            roomPolls = dbClient_->getRoomPolls(queryRoomId, false);
        }
        json pollsJson = json::array();
        for (const auto& poll : roomPolls) {
            json optionsJson = json::array();
            for (const auto& opt : poll.options) {
                optionsJson.push_back({
                    {"id", opt.optionId},
                    {"text", opt.text},
                    {"votes", opt.voteCount},
                    {"voters", opt.voterIds}
                });
            }
            pollsJson.push_back({
                {"id", poll.pollId},
                {"question", poll.question},
                {"options", optionsJson},
                {"createdBy", poll.createdBy},
                {"createdAt", poll.createdAt},
                {"isClosed", poll.isClosed},
                {"roomId", roomId}
            });
        }
        Logger::info("📊 Loaded " + std::to_string(roomPolls.size()) + " polls for room " + roomId);
        
        json response = {
            {"type", "room_joined"},
            {"roomId", roomId},
            {"userId", data->userId},
            {"username", data->username},
            {"history", history},
            {"memberCount", members.size()},
            {"members", membersJson},
            {"polls", pollsJson}
        };
        
        // Send to user who joined
        sendJsonMessage(wsPtr, response.dump());
        
        // Broadcast to others in room
        json broadcast = {
            {"type", "user_joined_room"},
            {"roomId", roomId},
            {"userId", data->userId},
            {"username", data->username}
        };
        broadcastToRoom(roomId, broadcast.dump(), data->userId);
        
        Logger::info("✅ User joined room: " + roomId + " (loaded " + std::to_string(historyMessages.size()) + " messages)");
        
    } catch (const std::exception& e) {
        Logger::error("Join room error: " + std::string(e.what()));
        sendErrorJson(wsPtr, "Failed to join room");
    }
}

void WebSocketServer::handleLeaveRoomJson(void* wsPtr, const std::string& jsonStr) {
    try {
        auto* ws = (uWS::WebSocket<false, true, PerSocketData>*)wsPtr;
        PerSocketData* data = ws->getUserData();
        
        json msg = json::parse(jsonStr);
        std::string roomId = msg.value("roomId", "");
        
        if (roomId.empty()) {
            sendErrorJson(wsPtr, "Room ID required");
            return;
        }
        
        Logger::info("🚪 User leaving room: " + data->username + " ← " + roomId);
        
        // Broadcast to others BEFORE clearing room (so they still get the message)
        json broadcast = {
            {"type", "user_left_room"},
            {"roomId", roomId},
            {"userId", data->userId},
            {"username", data->username}
        };
        broadcastToRoom(roomId, broadcast.dump(), data->userId);
        
        // Clear currentRoom in PerSocketData
        data->currentRoom = "";
        
        // Clear currentRoom in connections_ map
        {
            std::lock_guard<std::mutex> lock(connectionsMutex_);
            if (connections_.count(wsPtr)) {
                connections_[wsPtr].currentRoom = "";
            }
        }
        
        // Remove from room_members table
        bool removed = dbClient_->removeRoomMember(roomId, data->userId);
        if (!removed) {
            Logger::warning("User was not member of room or failed to remove");
        }
        
        json response = {
            {"type", "room_left"},
            {"roomId", roomId},
            {"success", removed}
        };
        sendJsonMessage(wsPtr, response.dump());
        
        Logger::info("✅ User left room: " + roomId);
        
    } catch (const std::exception& e) {
        Logger::error("Leave room error: " + std::string(e.what()));
        sendErrorJson(wsPtr, "Failed to leave room");
    }
}

void WebSocketServer::handleGetRoomsJson(void* wsPtr) {
    try {
        auto* ws = (uWS::WebSocket<false, true, PerSocketData>*)wsPtr;
        PerSocketData* data = ws->getUserData();
        
        json rooms = json::array();
        
        // Always include global room
        rooms.push_back({
            {"roomId", "global"},
            {"roomName", "Global Chat"},
            {"roomType", "public"},
            {"unread", 0}
        });
        
        // Query user's rooms from database
        try {
            auto session = dbClient_->getSession();
            if (session) {
                auto result = session->sql(
                    "SELECT r.room_id, r.room_name, r.room_type, rm.role "
                    "FROM rooms r "
                    "JOIN room_members rm ON r.room_id = rm.room_id "
                    "WHERE rm.user_id = ? ORDER BY r.created_at DESC"
                ).bind(data->userId).execute();
                
                mysqlx::Row row;
                while ((row = result.fetchOne())) {
                    rooms.push_back({
                        {"roomId", row[0].get<std::string>()},
                        {"roomName", row[1].get<std::string>()},
                        {"roomType", row[2].get<std::string>()},
                        {"role", row[3].get<std::string>()},
                        {"unread", 0}
                    });
                }
            }
        } catch (const std::exception& e) {
            Logger::warning("Failed to query user rooms: " + std::string(e.what()));
            // Continue with just global room
        }
        
        json response = {
            {"type", "room_list"},
            {"rooms", rooms},
            {"count", rooms.size()}
        };
        
        sendJsonMessage(wsPtr, response.dump());
        Logger::info("📋 Sent room list: " + std::to_string(rooms.size()) + " rooms");
        
    } catch (const std::exception& e) {
        Logger::error("Get rooms error: " + std::string(e.what()));
        sendErrorJson(wsPtr, "Failed to get rooms");
    }
}

void WebSocketServer::handleSearchMessagesJson(void* wsPtr, const std::string& jsonStr) {
    try {
        auto* ws = (uWS::WebSocket<false, true, PerSocketData>*)wsPtr;
        
        json msg = json::parse(jsonStr);
        std::string query = msg.value("query", "");
        std::string roomId = msg.value("roomId", "");
        int limit = msg.value("limit", 50);
        
        if (query.empty()) {
            sendErrorJson(wsPtr, "Search query required");
            return;
        }
        
        Logger::info("🔍 Search request: '" + query + "' in room: " + (roomId.empty() ? "all" : roomId));
        
        json results = json::array();
        
        // Query database with LIKE search
        auto db = authManager_->getDatabase();
        if (db) {
            auto messages = db->searchMessages(query, roomId, limit);
            
            for (const auto& m : messages) {
                results.push_back({
                    {"messageId", m.messageId},
                    {"roomId", m.roomId},
                    {"senderId", m.senderId},
                    {"senderName", m.senderName},
                    {"content", m.content},
                    {"messageType", m.messageType},
                    {"timestamp", m.timestamp}
                });
            }
        }
        
        json response = {
            {"type", "search_results"},
            {"query", query},
            {"results", results},
            {"count", results.size()}
        };
        
        sendJsonMessage(wsPtr, response.dump());
        Logger::info("✅ Search completed: " + std::to_string(results.size()) + " results");
        
    } catch (const std::exception& e) {
        Logger::error("Search error: " + std::string(e.what()));
        sendErrorJson(wsPtr, "Search failed");
    }
}

void WebSocketServer::handleMarkReadJson(void* wsPtr, const std::string& jsonStr) {
    try {
        auto* ws = (uWS::WebSocket<false, true, PerSocketData>*)wsPtr;
        PerSocketData* data = ws->getUserData();
        
        json msg = json::parse(jsonStr);
        std::string messageId = msg.value("messageId", "");
        std::string roomId = msg.value("roomId", "global");
        
        if (messageId.empty()) {
            sendErrorJson(wsPtr, "Message ID required");
            return;
        }
        
        Logger::info("✓✓ Mark read: " + messageId + " by " + data->username);
        
        // Update read status in database
        try {
            auto session = dbClient_->getSession();
            if (session) {
                // Create/update message_reads table entry
                session->sql(
                    "INSERT INTO message_reads (message_id, user_id, read_at) "
                    "VALUES (?, ?, NOW()) "
                    "ON DUPLICATE KEY UPDATE read_at = NOW()"
                ).bind(messageId, data->userId).execute();
                Logger::debug("Read status saved to database");
            }
        } catch (const std::exception& e) {
            Logger::warning("Failed to save read status: " + std::string(e.what()));
            // Continue anyway - still broadcast the read receipt
        }
        
        json response = {
            {"type", "message_read"},
            {"messageId", messageId},
            {"roomId", roomId},
            {"readBy", data->userId},
            {"username", data->username},
            {"timestamp", std::time(nullptr) * 1000}
        };
        
        // Broadcast to room (sender will update their UI)
        broadcastToRoom(roomId, response.dump());
        Logger::info("✅ Read receipt sent");
        
    } catch (const std::exception& e) {
        Logger::error("Mark read error: " + std::string(e.what()));
        sendErrorJson(wsPtr, "Failed to mark message as read");
    }
}

bool WebSocketServer::sendToSession(const std::string& sessionId, const std::string& message) {
    std::lock_guard<std::mutex> lock(connectionsMutex_);
    
    for (const auto& [key, state] : connections_) {
        if (state.authenticated && state.wsPtr && state.sessionId == sessionId) {
            auto* ws = (uWS::WebSocket<false, true, PerSocketData>*)state.wsPtr;
            ws->send(message, uWS::OpCode::TEXT);
            Logger::debug("📤 Sent to session: " + sessionId);
            return true;
        }
    }
    
    Logger::warning("Session not found: " + sessionId);
    return false;
}
