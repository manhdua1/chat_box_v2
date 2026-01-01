# ChatBox1 Frontend

**Last Updated:** January 1, 2026

## 📁 Structure

```
frontend/
├── public/           # Static files
├── src/              # Source code
│   ├── components/   # UI components
│   ├── pages/        # Pages
│   ├── api/          # WebSocket client
│   └── utils/        # Utilities
└── package.json      # Dependencies
```

## 🎨 Technology Stack

**Option 1: Web (React/Vue/Vite)**
```bash
npm create vite@latest . -- --template react
npm install
npm run dev
```

**Option 2: Desktop (Qt)**
- Qt 6 QML/Widgets
- WebSocket client
- Modern UI design

## 🔌 Server Connection

```javascript
// Web
const ws = new WebSocket('ws://47.129.136.101:8080');

// Qt C++
QWebSocket socket;
socket.open(QUrl("ws://47.129.136.101:8080"));
```

## 📚 Documentation

Protocol: `../backend/server/include/protocol_chatbox1.h`
