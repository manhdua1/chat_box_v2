# Pub/Sub Broker Usage Guide

**Last Updated:** January 1, 2026

## Overview

The PubSub broker provides real-time message routing based on topics.

## Features

- ✅ Topic-based subscriptions
- ✅ Room message broadcasting
- ✅ Direct user-to-user messaging
- ✅ Thread-safe operations
- ✅ Automatic cleanup on disconnect

---

## Usage Examples

### 1. Subscribe to Room Messages

```cpp
#include "pubsub/pubsub_broker.h"

PubSubBroker broker;

// Subscribe to room
broker.subscribe("session123", "room:abc", 
    [](const std::string& topic, const std::string& msg, const std::string& sender) {
        // Handle incoming message
        std::cout << "Received in " << topic << ": " << msg << std::endl;
    });
```

### 2. Publish to Room

```cpp
// Send message to everyone in room
broker.publishToRoom("abc", "{\"text\":\"Hello room!\"}", "user123");

// Or use generic publish
broker.publish("room:abc", "{\"text\":\"Hello!\"}", "user123");
```

### 3. Direct Message

```cpp
// Subscribe to your own user topic
broker.subscribe("session123", "user:user456",
    [](const std::string& topic, const std::string& msg, const std::string& sender) {
        std::cout << "DM from " << sender << ": " << msg << std::endl;
    });

// Send DM
broker.publishToUser("user456", "{\"text\":\"Hey!\"}", "user123");
```

### 4. Broadcast to All

```cpp
// Send to everyone
broker.broadcast("{\"type\":\"announcement\",\"text\":\"Server restart in 5 min\"}");
```

### 5. Cleanup on Disconnect

```cpp
// When user disconnects
broker.unsubscribeAll("session123");
```

---

## Topic Naming

**Room topics:**
- Format: `room:<roomId>`
- Example: `room:abc123`

**User topics:**
- Format: `user:<userId>`
- Example: `user:john456`

**Custom topics:**
- Format: Any string
- Example: `presence`, `notifications`, `game:xyz`

---

## Integration with WebSocket

```cpp
// When WebSocket client connects
void onConnect(WebSocket* ws, std::string sessionId) {
    // Subscribe to user's personal topic
    broker.subscribe(sessionId, "user:" + userId,
        [ws](const std::string& topic, const std::string& msg, const std::string& sender) {
            // Send to WebSocket
            ws->send(msg);
        });
}

// When client joins room
void onJoinRoom(std::string sessionId, std::string roomId) {
    broker.subscribe(sessionId, "room:" + roomId,
        [ws](const std::string& topic, const std::string& msg, const std::string& sender) {
            ws->send(msg);
        });
}

// When message received from client
void onMessage(std::string roomId, std::string message, std::string userId) {
    // Save to database
    db->createMessage(...);
    
    // Broadcast to room
    broker.publishToRoom(roomId, message, userId);
}

// When client disconnects
void onDisconnect(std::string sessionId) {
    broker.unsubscribeAll(sessionId);
}
```

---

## Statistics

```cpp
// Get stats
size_t topics = broker.getTopicCount();
size_t subscribers = broker.getSubscriberCount();
size_t totalSubs = broker.getTotalSubscriptions();

broker.printStats();
// Output:
// Topics: 15
// Subscribers: 42
// Total subscriptions: 89
```

---

## Thread Safety

All methods are thread-safe. Multiple threads can:
- Subscribe/unsubscribe simultaneously
- Publish messages concurrently
- Access statistics safely

---

## Performance Notes

- **Fast**: O(1) subscription lookup
- **Scalable**: Handles thousands of topics
- **Memory efficient**: Automatic cleanup of empty topics
- **No message buffering**: Messages are delivered immediately

---

## Next: WebSocket Server

The Pub/Sub broker is the foundation for:
1. WebSocket server (real-time connections)
2. Message handlers (business logic)
3. Presence tracking (online/offline status)

Ready to implement WebSocket server!
