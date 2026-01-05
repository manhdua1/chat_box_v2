#include "handlers/webrtc_handler.h"
#include "pubsub/pubsub_broker.h"
#include "utils/logger.h"
#include <nlohmann/json.hpp>
#include <chrono>
#include <random>
#include <sstream>

using json = nlohmann::json;
using namespace std::chrono;

WebRTCHandler::WebRTCHandler(std::shared_ptr<PubSubBroker> broker)
    : broker_(broker) {
    Logger::info("WebRTC handler initialized");
}

WebRTCHandler::~WebRTCHandler() {
    Logger::info("WebRTC handler destroyed");
}

std::string WebRTCHandler::generateCallId() {
    auto now = duration_cast<milliseconds>(system_clock::now().time_since_epoch()).count();
    
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<> dis(1000, 9999);
    
    std::stringstream ss;
    ss << "call_" << now << "_" << dis(gen);
    
    return ss.str();
}

std::string WebRTCHandler::callStateToString(CallState state) {
    switch (state) {
        case CallState::IDLE: return "idle";
        case CallState::CALLING: return "calling";
        case CallState::RINGING: return "ringing";
        case CallState::CONNECTING: return "connecting";
        case CallState::CONNECTED: return "connected";
        case CallState::ENDED: return "ended";
        default: return "unknown";
    }
}

std::string WebRTCHandler::callTypeToString(CallType type) {
    switch (type) {
        case CallType::AUDIO: return "audio";
        case CallType::VIDEO: return "video";
        case CallType::SCREEN_SHARE: return "screen";
        default: return "unknown";
    }
}

// ============================================================================
// CALL MANAGEMENT
// ============================================================================

std::string WebRTCHandler::initiateCall(const std::string& callerId,
                                         const std::string& callerName,
                                         const std::string& targetId,
                                         CallType type,
                                         bool isGroupCall) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    // Check if caller already in a call
    if (userCalls_.count(callerId) > 0) {
        return "❌ You're already in a call! End it first.";
    }
    
    // Create call session
    CallSession session;
    session.callId = generateCallId();
    session.roomId = isGroupCall ? targetId : "";
    session.type = type;
    session.state = CallState::CALLING;
    session.initiatorId = callerId;
    session.startedAt = duration_cast<seconds>(
        system_clock::now().time_since_epoch()
    ).count();
    session.connectedAt = 0;
    
    // Add initiator as participant
    Participant caller;
    caller.userId = callerId;
    caller.hasVideo = (type == CallType::VIDEO);
    caller.hasAudio = true;
    caller.isMuted = false;
    caller.isScreenSharing = (type == CallType::SCREEN_SHARE);
    session.participants.push_back(caller);
    
    calls_[session.callId] = session;
    userCalls_[callerId] = session.callId;
    
    Logger::info("Call initiated: " + session.callId + " by " + callerId);
    
    // Send signal to target
    std::stringstream signalData;
    signalData << "{\"callId\":\"" << session.callId << "\","
               << "\"callerId\":\"" << callerId << "\","
               << "\"callerName\":\"" << callerName << "\","
               << "\"type\":\"" << callTypeToString(type) << "\","
               << "\"isGroup\":" << (isGroupCall ? "true" : "false") << "}";
    
    sendSignal(targetId, "call_incoming", signalData.str());
    
    std::stringstream ss;
    ss << "📞 **Calling...**\n\n";
    ss << "🎯 Target: " << targetId << "\n";
    ss << "📹 Type: " << (type == CallType::VIDEO ? "Video" : "Audio") << " Call\n";
    ss << "🆔 Call ID: `" << session.callId << "`\n\n";
    ss << "_Waiting for answer..._";
    
    return ss.str();
}

std::string WebRTCHandler::acceptCall(const std::string& callId,
                                       const std::string& userId) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    if (calls_.count(callId) == 0) {
        return "❌ Call not found!";
    }
    
    auto& session = calls_[callId];
    
    if (session.state != CallState::CALLING) {
        return "❌ Call is not in ringing state!";
    }
    
    // Add user as participant
    Participant participant;
    participant.userId = userId;
    participant.hasVideo = (session.type == CallType::VIDEO);
    participant.hasAudio = true;
    participant.isMuted = false;
    participant.isScreenSharing = false;
    session.participants.push_back(participant);
    
    userCalls_[userId] = callId;
    session.state = CallState::CONNECTING;
    
    Logger::info("Call accepted: " + callId + " by " + userId);
    
    // Notify initiator
    std::stringstream signalData;
    signalData << "{\"callId\":\"" << callId << "\","
               << "\"userId\":\"" << userId << "\","
               << "\"action\":\"accepted\"}";
    
    sendSignal(session.initiatorId, "call_accepted", signalData.str());
    
    return "✅ **Call Accepted!**\n\n"
           "🔗 Connecting...\n"
           "_Exchanging connection info..._";
}

std::string WebRTCHandler::rejectCall(const std::string& callId,
                                       const std::string& userId,
                                       const std::string& reason) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    if (calls_.count(callId) == 0) {
        return "❌ Call not found!";
    }
    
    auto& session = calls_[callId];
    
    Logger::info("Call rejected: " + callId + " by " + userId + " - " + reason);
    
    // Notify initiator
    std::stringstream signalData;
    signalData << "{\"callId\":\"" << callId << "\","
               << "\"userId\":\"" << userId << "\","
               << "\"reason\":\"" << reason << "\"}";
    
    sendSignal(session.initiatorId, "call_rejected", signalData.str());
    
    // Cleanup
    userCalls_.erase(session.initiatorId);
    calls_.erase(callId);
    
    return "📵 **Call Declined**";
}

std::string WebRTCHandler::endCall(const std::string& callId,
                                    const std::string& userId) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    if (calls_.count(callId) == 0) {
        return "❌ No active call!";
    }
    
    auto& session = calls_[callId];
    
    // Calculate duration
    uint64_t duration = 0;
    if (session.connectedAt > 0) {
        auto now = duration_cast<seconds>(
            system_clock::now().time_since_epoch()
        ).count();
        duration = now - session.connectedAt;
    }
    
    Logger::info("Call ended: " + callId + " by " + userId);
    
    // Notify all participants
    std::stringstream signalData;
    signalData << "{\"callId\":\"" << callId << "\","
               << "\"endedBy\":\"" << userId << "\","
               << "\"duration\":" << duration << "}";
    
    for (const auto& p : session.participants) {
        if (p.userId != userId) {
            sendSignal(p.userId, "call_ended", signalData.str());
        }
        userCalls_.erase(p.userId);
    }
    
    calls_.erase(callId);
    
    // Format duration
    int mins = duration / 60;
    int secs = duration % 60;
    
    std::stringstream ss;
    ss << "📴 **Call Ended**\n\n";
    if (duration > 0) {
        ss << "⏱️ Duration: " << mins << ":" << (secs < 10 ? "0" : "") << secs;
    }
    
    return ss.str();
}

// ============================================================================
// WEBRTC SIGNALING
// ============================================================================

void WebRTCHandler::sendOffer(const std::string& callId,
                               const std::string& fromUserId,
                               const std::string& toUserId,
                               const std::string& sdpOffer) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    // Use nlohmann::json for proper escaping
    json signalData = {
        {"callId", callId},
        {"from", fromUserId},
        {"sdp", sdpOffer}
    };
    
    sendSignal(toUserId, "webrtc_offer", signalData.dump());
    
    Logger::info("SDP Offer sent: " + callId + " -> " + toUserId);
}

void WebRTCHandler::sendAnswer(const std::string& callId,
                                const std::string& fromUserId,
                                const std::string& toUserId,
                                const std::string& sdpAnswer) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    // Mark call as connected
    if (calls_.count(callId) > 0) {
        calls_[callId].state = CallState::CONNECTED;
        calls_[callId].connectedAt = duration_cast<seconds>(
            system_clock::now().time_since_epoch()
        ).count();
    }
    
    // Use nlohmann::json for proper escaping
    json signalData = {
        {"callId", callId},
        {"from", fromUserId},
        {"sdp", sdpAnswer}
    };
    
    sendSignal(toUserId, "webrtc_answer", signalData.dump());
    
    Logger::info("SDP Answer sent: " + callId + " -> " + toUserId);
}

void WebRTCHandler::sendIceCandidate(const std::string& callId,
                                      const std::string& fromUserId,
                                      const std::string& toUserId,
                                      const std::string& candidate) {
    // Use nlohmann::json for proper escaping
    json signalData = {
        {"callId", callId},
        {"from", fromUserId},
        {"candidate", candidate}
    };
    
    sendSignal(toUserId, "webrtc_ice", signalData.dump());
    
    Logger::debug("ICE Candidate sent: " + callId + " -> " + toUserId);
}

// ============================================================================
// MEDIA CONTROLS
// ============================================================================

std::string WebRTCHandler::toggleMute(const std::string& callId, const std::string& userId) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    if (calls_.count(callId) == 0) {
        return "❌ No active call!";
    }
    
    auto& session = calls_[callId];
    
    for (auto& p : session.participants) {
        if (p.userId == userId) {
            p.isMuted = !p.isMuted;
            
            std::stringstream signalData;
            signalData << "{\"callId\":\"" << callId << "\","
                       << "\"userId\":\"" << userId << "\","
                       << "\"muted\":" << (p.isMuted ? "true" : "false") << "}";
            
            broadcastToParticipants(session, "media_mute", signalData.str(), userId);
            
            return p.isMuted ? "🔇 **Muted**" : "🔊 **Unmuted**";
        }
    }
    
    return "❌ You're not in this call!";
}

std::string WebRTCHandler::toggleVideo(const std::string& callId, const std::string& userId) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    if (calls_.count(callId) == 0) {
        return "❌ No active call!";
    }
    
    auto& session = calls_[callId];
    
    for (auto& p : session.participants) {
        if (p.userId == userId) {
            p.hasVideo = !p.hasVideo;
            
            std::stringstream signalData;
            signalData << "{\"callId\":\"" << callId << "\","
                       << "\"userId\":\"" << userId << "\","
                       << "\"video\":" << (p.hasVideo ? "true" : "false") << "}";
            
            broadcastToParticipants(session, "media_video", signalData.str(), userId);
            
            return p.hasVideo ? "📹 **Camera On**" : "📷 **Camera Off**";
        }
    }
    
    return "❌ You're not in this call!";
}

std::string WebRTCHandler::startScreenShare(const std::string& callId, const std::string& userId) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    if (calls_.count(callId) == 0) {
        return "❌ No active call!";
    }
    
    auto& session = calls_[callId];
    
    for (auto& p : session.participants) {
        if (p.userId == userId) {
            p.isScreenSharing = true;
            
            std::stringstream signalData;
            signalData << "{\"callId\":\"" << callId << "\","
                       << "\"userId\":\"" << userId << "\","
                       << "\"sharing\":true}";
            
            broadcastToParticipants(session, "media_screen", signalData.str(), userId);
            
            return "🖥️ **Screen Sharing Started**";
        }
    }
    
    return "❌ You're not in this call!";
}

std::string WebRTCHandler::stopScreenShare(const std::string& callId, const std::string& userId) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    if (calls_.count(callId) == 0) {
        return "❌ No active call!";
    }
    
    auto& session = calls_[callId];
    
    for (auto& p : session.participants) {
        if (p.userId == userId) {
            p.isScreenSharing = false;
            
            std::stringstream signalData;
            signalData << "{\"callId\":\"" << callId << "\","
                       << "\"userId\":\"" << userId << "\","
                       << "\"sharing\":false}";
            
            broadcastToParticipants(session, "media_screen", signalData.str(), userId);
            
            return "🖥️ **Screen Sharing Stopped**";
        }
    }
    
    return "❌ You're not in this call!";
}

// ============================================================================
// QUERIES
// ============================================================================

bool WebRTCHandler::hasActiveCall(const std::string& userId) {
    std::lock_guard<std::mutex> lock(mutex_);
    return userCalls_.count(userId) > 0;
}

std::string WebRTCHandler::getCallStatus(const std::string& callId) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    if (calls_.count(callId) == 0) {
        return "No active call.";
    }
    
    auto& session = calls_[callId];
    
    std::stringstream ss;
    ss << "📞 **Call Status**\n\n";
    ss << "🆔 ID: " << callId << "\n";
    ss << "📹 Type: " << callTypeToString(session.type) << "\n";
    ss << "🔄 State: " << callStateToString(session.state) << "\n";
    ss << "👥 Participants: " << session.participants.size() << "\n";
    
    for (const auto& p : session.participants) {
        ss << "  • " << p.userId;
        if (p.isMuted) ss << " 🔇";
        if (!p.hasVideo) ss << " 📷";
        if (p.isScreenSharing) ss << " 🖥️";
        ss << "\n";
    }
    
    return ss.str();
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

void WebRTCHandler::broadcastToParticipants(const CallSession& session,
                                             const std::string& signalType,
                                             const std::string& data,
                                             const std::string& excludeUserId) {
    for (const auto& p : session.participants) {
        if (p.userId != excludeUserId) {
            sendSignal(p.userId, signalType, data);
        }
    }
}

void WebRTCHandler::sendSignal(const std::string& targetUserId,
                                const std::string& signalType,
                                const std::string& data) {
    // Build signal message
    json signalMsg = {
        {"type", signalType},
        {"data", json::parse(data)}
    };
    
    std::string message = signalMsg.dump();
    
    // Use callback if available (direct WebSocket delivery)
    if (sendToUserCallback_) {
        sendToUserCallback_(targetUserId, message);
        Logger::info("Signal sent via callback: " + signalType + " -> " + targetUserId);
    } else {
        // Fallback to PubSub (won't work without subscribers)
        std::string topic = "user:" + targetUserId;
        broker_->publish(topic, message);
        Logger::info("Signal sent via PubSub (may not be delivered): " + signalType + " -> " + targetUserId);
    }
}
