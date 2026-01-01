# 📋 Protocol Comparison - ChatBox1 vs ChatBox2

## 🎯 OVERVIEW

Workspace hiện có **2 PROTOCOLS**:

1. **`protocol.h`** - ChatBox2 (Basic, Original)
2. **`protocol_chatbox1.h`** - ChatBox1 (Advanced, Your System)

---

## 📊 COMPARISON TABLE

| Feature | ChatBox2<br>`protocol.h` | ChatBox1<br>`protocol_chatbox1.h` |
|---------|--------------------------|-----------------------------------|
| **Message Types** | 9 types | 255 types |
| **Port** | 8080 | 8080 (WebSocket) |
| **Buffer Size** | 4KB | 8KB |
| **Topic Length** | 32 chars | 128 chars |
| **Username Length** | 32 chars | 64 chars |
| **Protocol Version** | 0 (implicit) | 1 (explicit) |

---

## 📝 MESSAGE TYPES COMPARISON

### **ChatBox2 (9 types):**

```cpp
enum MessageType {
    MSG_LOGIN = 1,
    MSG_LOGOUT,
    MSG_SUBSCRIBE,
    MSG_UNSUBSCRIBE,
    MSG_PUBLISH_TEXT,
    MSG_PUBLISH_FILE,
    MSG_FILE_DATA,
    MSG_ERROR,
    MSG_ACK
};
```

**Features:**
- ✅ Basic authentication
- ✅ Pub/Sub (subscribe/unsubscribe)
- ✅ Text messages
- ✅ File transfer (basic)

---

### **ChatBox1 (255 types):**

```cpp
enum MessageType : uint32_t {
    // Authentication (1-19)
    MSG_REGISTER_REQUEST = 1,
    MSG_LOGIN_REQUEST = 3,
    MSG_HEARTBEAT = 6,
    
    // Pub/Sub (20-39)
    MSG_SUBSCRIBE = 20,
    MSG_PUBLISH = 22,
    
    // Chat (40-69)
    MSG_CHAT_TEXT = 40,
    MSG_CHAT_IMAGE,
    MSG_CHAT_VIDEO,
    MSG_TYPING_START = 52,
    MSG_MESSAGE_READ = 54,
    
    // Rooms (70-89)
    MSG_CREATE_ROOM = 70,
    MSG_JOIN_ROOM,
    
    // Reactions (90-99)
    MSG_ADD_REACTION = 90,
    
    // File Transfer (100-119)
    MSG_FILE_INIT = 100,
    MSG_FILE_CHUNK,
    
    // Voice/Video (120-139)
    MSG_CALL_OFFER = 121,
    MSG_CALL_ICE_CANDIDATE = 123,
    
    // Games (140-159)
    MSG_GAME_INVITE = 140,
    MSG_GAME_MOVE = 143,
    
    // Watch Together (160-179)
    MSG_WATCH_SYNC = 165,
    
    // Polls (180-189)
    MSG_POLL_CREATE = 180,
    MSG_POLL_VOTE,
    
    // Workflows (190-199)
    MSG_WORKFLOW_TRIGGER = 193,
    
    // AI Bot (200-219)
    MSG_AI_REQUEST = 200,
    MSG_AI_RESPONSE,
    
    // Presence (220-229)
    MSG_PRESENCE_UPDATE = 220,
    
    // System (250-255)
    MSG_ERROR = 250,
    MSG_ACK
};
```

**Features:**
- ✅ All ChatBox2 features +
- ✅ Advanced authentication (JWT, 2FA)
- ✅ Rich media (images, videos, audio)
- ✅ Read receipts, typing indicators
- ✅ Reactions (emoji)
- ✅ File chunking (large files)
- ✅ WebRTC voice/video calls
- ✅ Games (Tic-Tac-Toe, Chess)
- ✅ Watch Together
- ✅ Polls
- ✅ Workflows
- ✅ AI Chatbot
- ✅ Presence (online/offline/away)

---

## 🔧 USAGE GUIDE

### **Which protocol to use?**

**For ChatBox2 (legacy system):**
```cpp
#include "protocol.h"

// Use basic message types
sendMessage(MSG_LOGIN, ...);
sendMessage(MSG_PUBLISH_TEXT, ...);
```

**For ChatBox1 (your advanced system):**
```cpp
#include "protocol_chatbox1.h"

// Use full feature set
sendMessage(MSG_LOGIN_REQUEST, ...);
sendMessage(MSG_CHAT_TEXT, ...);
sendMessage(MSG_ADD_REACTION, ...);
sendMessage(MSG_GAME_INVITE, ...);
```

---

## 🔄 COMPATIBILITY

### **Can they connect?**

**Option 1: Use Protocol Adapter**
```cpp
#include "protocol_adapter.h"

// Automatically convert between protocols
DualProtocolClient client;
client.connect(serverIP, port);
```

**Option 2: ChatBox2 uses ChatBox1 protocol**
- Copy `protocol_chatbox1.h` to ChatBox2 project
- Only use basic features (MSG_LOGIN_REQUEST, MSG_CHAT_TEXT, etc.)
- Ignore advanced features

---

## 📁 FILE STRUCTURE

```
ChatBox web/
├── protocol.h                    # ChatBox2 (basic, original)
├── protocol_chatbox1.h           # ChatBox1 (advanced, your system)
├── protocol_adapter.h            # Compatibility layer
└── PROTOCOL_COMPARISON.md        # This file
```

---

## 🎯 RECOMMENDATIONS

**For Your Project (ChatBox1):**
- ✅ Use `protocol_chatbox1.h`
- ✅ Implement all features
- ✅ DynamoDB + S3 backend

**If need to connect to ChatBox2:**
- ✅ Keep both protocol files
- ✅ Use `protocol_adapter.h`
- ✅ Feature detection at runtime

**If starting fresh:**
- ✅ Use `protocol_chatbox1.h` only
- ✅ Ignore `protocol.h` (legacy)

---

## 💡 MIGRATION PATH

**From ChatBox2 → ChatBox1:**

1. Keep `protocol.h` as reference
2. Migrate to `protocol_chatbox1.h`
3. Implement features incrementally:
   - Phase 1: Auth, Chat, Files (compatible with old)
   - Phase 2: Reactions, Presence
   - Phase 3: Games, AI, Advanced features

---

**Summary:**
- `protocol.h` = ChatBox2 (9 types, basic)
- `protocol_chatbox1.h` = ChatBox1 (255 types, full features)
- Use ChatBox1 for your system! 🚀

---

## 📨 JSON MESSAGE FORMAT (Current Implementation)

The WebSocket server uses **JSON messages** for easy debugging. Examples:

### Authentication
```json
// Login Request
{ "type": "login", "username": "user1", "password": "pass123" }

// Login Response
{ "type": "login_response", "success": true, "userId": "1", "username": "user1", "token": "jwt..." }

// Register Request
{ "type": "register", "username": "user1", "password": "pass123", "email": "user@example.com" }
```

### Chat Messages
```json
// Send Message
{ "type": "chat", "roomId": "general", "content": "Hello world!" }

// Receive Message
{ "type": "chat", "messageId": "123", "roomId": "general", "userId": "1", "username": "user1", "content": "Hello!", "timestamp": 1703936400000 }

// Edit Message
{ "type": "edit_message", "messageId": "123", "newContent": "Updated message" }

// Delete Message
{ "type": "delete_message", "messageId": "123" }
```

### Rooms
```json
// Create Room
{ "type": "create_room", "name": "My Room" }

// Join Room
{ "type": "join_room", "roomId": "room123" }

// Leave Room
{ "type": "leave_room", "roomId": "room123" }
```

### WebRTC Calls
```json
// Initiate Call
{ "type": "call_init", "targetId": "user2", "callType": "video" }

// Accept Call
{ "type": "call_accept", "callId": "call123", "callerId": "user1" }

// SDP Offer/Answer
{ "type": "webrtc_offer", "targetUserId": "user2", "sdp": "..." }
{ "type": "webrtc_answer", "targetUserId": "user1", "sdp": "..." }

// ICE Candidate
{ "type": "webrtc_ice", "targetUserId": "user2", "candidate": {...} }
```

### Games
```json
// Game Invite
{ "type": "game_invite", "gameType": "tictactoe", "opponentId": "user2" }

// Game Move
{ "type": "game_move", "gameId": "game123", "position": 4 }
```

### Polls
```json
// Create Poll
{ "type": "poll_create", "roomId": "general", "question": "Favorite color?", "options": ["Red", "Blue", "Green"] }

// Vote
{ "type": "poll_vote", "pollId": "poll123", "optionId": "opt1" }
```

### AI Bot
```json
// AI Request
{ "type": "ai_request", "content": "What's the weather today?" }

// AI Response
{ "type": "ai_response", "content": "I can help with that..." }
```

---

**Port:** `8080` | **Protocol Version:** 1 | **Last Updated:** January 2026

> **Note:** Đã bổ sung message types cho Polls, Watch Together, Game và các trạng thái phòng nâng cao.
