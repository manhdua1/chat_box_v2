# ChatBox Web - Real-time Chat Application

**Last Updated:** January 5, 2026

A full-featured real-time chat application with WebSocket communication, MySQL database, modern React UI, and AI-powered assistant.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MySQL Server 8.0+
- Visual Studio 2022 (for C++ backend)

### Run Backend
```powershell
cd backend\server\build\Release
.\chat_server.exe
```

### Run Frontend
```powershell
cd frontend
npm install
npm run dev
```

### Access
- **Frontend**: http://localhost:5173
- **Backend**: ws://localhost:8080
- **Test Account**: `test1` / `test123`

---

## ✨ Features

### Core Features (100% Working)
- ✅ User Authentication (JWT)
- ✅ Real-time Messaging (WebSocket)
- ✅ Edit & Delete Messages
- ✅ Emoji Reactions
- ✅ Room/Channel Management
- ✅ Dark/Light Theme
- ✅ Typing Indicators
- ✅ Online Status

### Advanced Features (In Testing)
- ⚠️ Video/Voice Calls (WebRTC)
- ⚠️ File Upload & Sharing
- ⚠️ Screen Sharing
- ⚠️ Polls & Voting
- ⚠️ Games (Tic-Tac-Toe)
- ⚠️ Watch Together
- ✅ AI Chat Assistant (Gemini API)

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Zustand |
| Backend | C++20, uWebSockets, MySQL Connector |
| Database | MySQL 8.0 |
| Protocol | WebSocket (JSON messages) |
| Auth | JWT + Bcrypt |

---

## 📁 Project Structure

```
ChatBox web/
├── README.md                 # This file
├── .gitignore
│
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/       # UI components
│   │   ├── hooks/            # useWebSocket, etc.
│   │   ├── stores/           # Zustand state
│   │   └── types/            # TypeScript types
│   └── package.json
│
├── backend/
│   ├── client/               # C++ client (optional)
│   └── server/
│       ├── src/              # C++ source
│       │   ├── auth/         # Authentication
│       │   ├── database/     # MySQL client
│       │   ├── handlers/     # Message handlers
│       │   └── websocket/    # WebSocket server
│       ├── include/          # Headers
│       ├── database/         # SQL schema
│       └── CMakeLists.txt
│
├── docs/                     # Documentation
│   ├── 01-QUICK_START.md
│   ├── 02-FEATURES.md
│   ├── 03-DEPLOYMENT.md
│   ├── 04-DATABASE.md
│   ├── 05-PROTOCOL.md
│   ├── 06-TESTING.md
│   └── FIXES_COMPLETED.md
│
├── scripts/                  # Build & setup scripts
│   ├── build_server.bat
│   ├── build_server.sh
│   ├── setup_mysql.ps1
│   └── install_dependencies.ps1
│
├── config/                   # Configuration
│   ├── .env
│   └── .env.example
│
├── test/                     # Test files
└── uploads/                  # File uploads directory
```

---

## 📖 Documentation

See the `docs/` folder for detailed documentation:
- [Quick Start Guide](docs/01-QUICK_START.md)
- [Features Overview](docs/02-FEATURES.md)
- [Deployment Guide](docs/03-DEPLOYMENT.md)
- [Database Schema](docs/04-DATABASE.md)
- [WebSocket Protocol](docs/05-PROTOCOL.md)
- [Testing Guide](docs/06-TESTING.md)
- [Fixes & Changelog](docs/FIXES_COMPLETED.md)

---

## 🔧 Configuration

Edit `config/.env` to customize:
```ini
# MySQL Configuration
MYSQL_HOST=localhost
MYSQL_PORT=33070
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=chatbox_db

# Server Configuration
SERVER_PORT=8080
JWT_SECRET=your_secret_key
```

---

## 📝 Recent Updates

**December 31, 2025**
- ✅ Fixed Edit/Delete message functionality
- ✅ Added database migrations for message columns
- ✅ Cleaned up unused files
- ✅ Reorganized project structure
- ✅ Updated documentation

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

---

## 📄 License

This project is for educational purposes.

---

**Happy Chatting! 💬**
