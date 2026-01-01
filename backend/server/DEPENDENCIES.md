# Backend Server - Dependencies Installation Guide

**Last Updated:** January 1, 2026

## 📦 Required Dependencies

### **1. AWS SDK C++**
```bash
# Clone AWS SDK
git clone --recurse-submodules https://github.com/aws/aws-sdk-cpp
cd aws-sdk-cpp

# Build (only DynamoDB + S3 + Core)
mkdir build && cd build
cmake .. -DBUILD_ONLY="dynamodb;s3;core" \
         -DCMAKE_BUILD_TYPE=Release \
         -DCMAKE_INSTALL_PREFIX=/usr/local
make -j$(nproc)
sudo make install
sudo ldconfig
```

### **2. uWebSockets**
```bash
git clone https://github.com/uNetworking/uWebSockets
cd uWebSockets
git clone https://github.com/uNetworking/uSockets
cd uSockets
make
sudo make install
```

### **3. OpenSSL** (usually pre-installed)
```bash
# Ubuntu/Debian
sudo apt install libssl-dev

# Verify
openssl version
```

### **4. libcurl**
```bash
# Ubuntu/Debian
sudo apt install libcurl4-openssl-dev
```

### **5. JSON for Modern C++** (header-only)
```bash
cd backend/server
mkdir -p third_party
cd third_party

# Download nlohmann/json
git clone https://github.com/nlohmann/json
```

### **6. jwt-cpp** (header-only)
```bash
cd backend/server/third_party
git clone https://github.com/Thalhammer/jwt-cpp
```

### **7. bcrypt**
```bash
cd backend/server/third_party
git clone https://github.com/hilch/Bcrypt.cpp bcrypt
```

---

## 🔧 Build Instructions

### **Local Build:**
```bash
cd backend/server
mkdir build && cd build

# Configure
cmake ..

# Build
make -j$(nproc)

# Run
./chat_server
```

### **Debug Build:**
```bash
cmake .. -DCMAKE_BUILD_TYPE=Debug
make -j$(nproc)
gdb ./chat_server
```

---

## 📁 Folder Structure Created

```
backend/server/
├── CMakeLists.txt        ✅ Created
├── include/
│   ├── protocol_chatbox1.h  ✅ Exists
│   ├── config/
│   │   └── config_loader.h  ✅ Created
│   ├── utils/
│   │   └── logger.h         ✅ Created
│   ├── auth/          (TODO)
│   ├── pubsub/        (TODO)
│   ├── websocket/     (TODO)
│   ├── database/      (TODO)
│   ├── storage/       (TODO)
│   ├── handlers/      (TODO)
│   ├── ai/            (TODO)
│   └── game/          (TODO)
├── src/
│   ├── main.cpp              ✅ Created
│   ├── config/
│   │   └── config_loader.cpp ✅ Created
│   └── utils/
│       └── logger.cpp        ✅ Created
└── third_party/       (TODO: clone dependencies)
```

---

## ✅ Next Steps

1. Install dependencies (see above)
2. Create remaining modules:
   - Authentication (auth/)
   - Pub/Sub (pubsub/)
   - WebSocket Server (websocket/)
   - Database Clients (database/)
   - File Storage (storage/)
   - Message Handlers (handlers/)
   - AI Client (ai/)
   - Game Logic (game/)
3. Build and test

Ready to continue? 🚀
