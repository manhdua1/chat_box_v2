#ifndef WEBRTC_HANDLER_H
#define WEBRTC_HANDLER_H

#include <memory>
#include <string>
#include <unordered_map>
#include <vector>
#include <mutex>
#include <functional>

class PubSubBroker;

/**
 * WebRTC Signaling Handler
 * 
 * Implements WebRTC signaling for Voice/Video calls:
 * - Offer/Answer SDP exchange
 * - ICE Candidate exchange
 * - Call state management (ringing, connected, ended)
 * - Room-based group calls
 * 
 * Call Flow:
 * 1. Caller sends CALL_INIT -> callee receives CALL_INCOMING
 * 2. Callee sends CALL_ACCEPT/REJECT
 * 3. Exchange SDP Offer/Answer
 * 4. Exchange ICE Candidates
 * 5. Connection established
 * 6. Either party can CALL_END
 */
class WebRTCHandler {
public:
    enum class CallState {
        IDLE,
        CALLING,      // Initiator waiting for answer
        RINGING,      // Receiver ringing
        CONNECTING,   // SDP/ICE exchange in progress
        CONNECTED,    // Call active
        ENDED
    };
    
    enum class CallType {
        AUDIO,
        VIDEO,
        SCREEN_SHARE
    };
    
    struct Participant {
        std::string userId;
        bool hasVideo;
        bool hasAudio;
        bool isMuted;
        bool isScreenSharing;
    };
    
    struct CallSession {
        std::string callId;
        std::string roomId;          // For group calls
        CallType type;
        CallState state;
        std::string initiatorId;
        std::vector<Participant> participants;
        uint64_t startedAt;
        uint64_t connectedAt;
    };
    
    // Callback types for async responses
    using SignalCallback = std::function<void(const std::string& targetUserId, 
                                               const std::string& signalData)>;
    
    WebRTCHandler(std::shared_ptr<PubSubBroker> broker);
    
    // Set callback for sending messages to users (called by WebSocketServer)
    void setSendToUserCallback(SignalCallback callback) { sendToUserCallback_ = callback; }
    ~WebRTCHandler();
    
    // ========== Call Management ==========
    
    // Initiate a call (1-1 or group)
    std::string initiateCall(const std::string& callerId,
                              const std::string& callerName,
                              const std::string& targetId,  // userId or roomId
                              CallType type,
                              bool isGroupCall = false);
    
    // Accept incoming call
    std::string acceptCall(const std::string& callId,
                            const std::string& userId);
    
    // Reject incoming call
    std::string rejectCall(const std::string& callId,
                            const std::string& userId,
                            const std::string& reason = "declined");
    
    // End call
    std::string endCall(const std::string& callId,
                         const std::string& userId);
    
    // ========== WebRTC Signaling ==========
    
    // Send SDP Offer
    void sendOffer(const std::string& callId,
                   const std::string& fromUserId,
                   const std::string& toUserId,
                   const std::string& sdpOffer);
    
    // Send SDP Answer
    void sendAnswer(const std::string& callId,
                    const std::string& fromUserId,
                    const std::string& toUserId,
                    const std::string& sdpAnswer);
    
    // Send ICE Candidate
    void sendIceCandidate(const std::string& callId,
                          const std::string& fromUserId,
                          const std::string& toUserId,
                          const std::string& candidate);
    
    // ========== Media Controls ==========
    
    std::string toggleMute(const std::string& callId, const std::string& userId);
    std::string toggleVideo(const std::string& callId, const std::string& userId);
    std::string startScreenShare(const std::string& callId, const std::string& userId);
    std::string stopScreenShare(const std::string& callId, const std::string& userId);
    
    // ========== Queries ==========
    
    bool hasActiveCall(const std::string& userId);
    std::string getCallStatus(const std::string& callId);
    
private:
    std::shared_ptr<PubSubBroker> broker_;
    SignalCallback sendToUserCallback_;  // Direct WebSocket delivery
    std::unordered_map<std::string, CallSession> calls_;     // callId -> session
    std::unordered_map<std::string, std::string> userCalls_; // userId -> callId
    std::mutex mutex_;
    
    std::string generateCallId();
    void broadcastToParticipants(const CallSession& session, 
                                  const std::string& signalType,
                                  const std::string& data,
                                  const std::string& excludeUserId = "");
    void sendSignal(const std::string& targetUserId,
                    const std::string& signalType,
                    const std::string& data);
    std::string callStateToString(CallState state);
    std::string callTypeToString(CallType type);
};

#endif // WEBRTC_HANDLER_H
