# ChatBox1 Backend - Server

**Last Updated:** January 1, 2026

## 📁 Structure

```
server/
├── include/          # Header files
│   ├── protocol_chatbox1.h    # Main protocol (255 message types)
│   ├── protocol.h             # Legacy protocol (ChatBox2)
│   └── protocol_adapter.h     # Cross-compatibility
├── src/              # Source files
│   ├── main.cpp              # Entry point
│   ├── auth/                 # Authentication (bcrypt + JWT)
│   ├── pubsub/               # Pub/Sub broker
│   ├── websocket/            # WebSocket server (uWebSockets)
│   ├── handlers/             # Message handlers
│   ├── database/             # DynamoDB client
│   ├── storage/              # S3 client
│   └── ai/                   # Gemini integration
└── CMakeLists.txt    # Build configuration
```

## 🔧 Dependencies

```bash
# AWS SDK C++
# uWebSockets
# bcrypt
# jwt-cpp
# OpenSSL
# nlohmann/json
```

## 🚀 Build

```bash
mkdir build && cd build
cmake ..
make -j4
./chat_server
```

## 📡 Configuration

Server configuration is in `../../config/.env`:
- Server IP: 47.129.136.101
- Port: 8080
- AWS credentials
- Gemini API key

## 📚 Documentation

See `../../docs/` for:
- DEPLOYMENT_READY.md
- FINAL_TECH_STACK.md
- DATABASE_SCHEMA_COMPLETE.md
