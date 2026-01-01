# ChatBox Backend - Client

**Last Updated:** January 1, 2026

C++ client library cho ChatBox application.

## 📁 Structure

```
client/
├── include/          # Header files
│   └── (shared protocol files)
├── src/              # Source files
│   ├── main.cpp              # Entry point
│   ├── connection/           # Server connection
│   ├── handlers/             # Message handlers
│   └── storage/              # Local cache
└── CMakeLists.txt    # Build configuration
```

## 🎯 Features (Planned)

- Connect to server: ws://localhost:8080
- Protocol: protocol_chatbox1.h (255 message types)
- Authentication (JWT)
- Real-time chat (Pub/Sub)
- File transfer
- Games, AI integration

## 🔧 Dependencies

```bash
# Qt 6 (if desktop client)
# WebSocket client library
# protocol_chatbox1.h (shared with server)
```

## 🚀 Build

```bash
mkdir build && cd build
cmake ..
make -j4
./chat_client
```

## 📡 Configuration

Client connects to:
- Server: localhost (or production IP)
- Port: 8080
- Protocol: WebSocket

## 📚 Status

🚧 **In Development** - Structure prepared, implementation pending.

See [server README](../server/README.md) for backend server documentation.
