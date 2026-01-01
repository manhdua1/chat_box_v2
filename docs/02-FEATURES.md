# 📋 Tài Liệu Tính Năng - Hệ Thống Chat Pub/Sub

**Last Updated:** January 1, 2026

**Mục tiêu:** 9.5-10/10 điểm | **Timeline:** 7-8 tuần | **Team:** 2-4 người

---

## 🔐 FOUNDATION FEATURES (Included in Core)

### Authentication & User Management

#### 1. Registration
**Chức năng:**
- Username (unique, 3-20 chars)
- Password (min 8 chars, hashed with bcrypt)
- Email (optional, for recovery)
- Avatar upload (optional)
- Terms & Conditions acceptance

**Validation:**
- Check username availability
- Password strength indicator
- Email format validation

**Database:**
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email TEXT,
  avatar_path TEXT,
  created_at INTEGER,
  last_login INTEGER
);
```

#### 2. Login
**Chức năng:**
- Username + Password
- "Remember me" checkbox
- Session management (JWT or session token)
- Auto-login on startup (if remembered)

**Security:**
- bcrypt password verification
- Rate limiting (max 5 attempts/minute)
- Account lockout after 5 failed attempts
- Session timeout (24 hours idle)

**Pub/Sub:**
```
Topic: "auth.login.{user_id}"
Events: LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT
```

#### 3. User Profile
**Chức năng:**
- View/Edit profile
- Change avatar
- Update bio/status
- Change password
- Privacy settings

**Fields:**
- Username (display only)
- Display name (editable)
- Bio (max 200 chars)
- Status message
- Avatar image
- Online/Away/DND status

#### 4. Password Management
**Chức năng:**
- Change password (require old password)
- Forgot password (email reset)
- Password strength meter
- Password requirements display

**Security:**
- Require current password for change
- Hash all passwords with bcrypt (cost factor 12)
- Never store plain text

#### 5. Session Management
**Chức năng:**
- Active sessions list
- Device/location info
- "Log out all devices" button
- Session expiry

**Implementation:**
```cpp
class Session {
    QString sessionId;
    QString userId;
    QString deviceName;
    QDateTime createdAt;
    QDateTime lastActivity;
    QString ipAddress;
};
```

#### 6. Online Status
**Chức năng:**
- Online (green)
- Away (yellow - idle >5 min)
- Do Not Disturb (red)
- Offline (gray)
- Custom status message

**Pub/Sub:**
```
Topic: "presence.{user_id}"
Events: ONLINE, AWAY, DND, OFFLINE
```

**Độ ưu tiên:** 🔴 CRITICAL (Foundation)  
**Độ khó:** ⭐⭐

---

## ✅ YÊU CẦU BẮT BUỘC (80%)

### 1. Chat 1-1 (20%)
- Gửi/nhận tin nhắn real-time
- Lịch sử chat (SQLite)
- Status: delivered/seen
- Avatar, timestamp

**Pub/Sub:** `chat.private.{user1_id}.{user2_id}`

### 2. Chat Nhóm (20%)
- Tạo nhóm, thêm/xóa members
- Group admin/member roles
- Subscribe/Unsubscribe topics
- Broadcast messages

**Pub/Sub:** `chat.group.{group_id}`

### 3. File Transfer 1-1 (20%)
- Upload/Download files
- Chunked transfer (chia nhỏ)
- Progress bar
- Preview ảnh
- Limit: 100MB

**Pub/Sub:** `files.transfer.{transfer_id}`

### 4. File Transfer Group (20%)
- Broadcast file tới nhóm
- Multiple downloads
- Shared storage

**Pub/Sub:** `files.group.{group_id}`

---

## 🌟 TIER SSS - KILLER FEATURES (52%)

### 🤖 1. AI Chat Bot (12%) - GEMINI API
**Nguồn:** Innovation + Gemini API

AI assistant trong chat system:
- Chat với Gemini AI
- Trigger: @ai hoặc /ai
- Smart replies
- Context-aware responses
- Translate messages
- Summarize conversations
- Answer questions

**Implementation:**
```cpp
// Gemini API call
GET https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent
Headers: x-goog-api-key: YOUR_API_KEY
Body: {
  "contents": [{
    "parts": [{"text": "user question"}]
  }]
}
```

**Pub/Sub:**
- Topic: `ai.requests`
- AI bot subscribes
- Responds to mentions

**Use Cases:**
- `/ai translate to English: Xin chào`
- `/ai summarize last 10 messages`
- `@ai What's the weather today?`
- Auto-translate on demand

**Độ khó:** ⭐⭐⭐ | **Wow:** 🔥🔥🔥🔥🔥

---

### 🎬 2. Watch Together (15%) - UNIQUE!
**Nguồn:** Messenger

Xem video cùng nhau với synchronized playback:
- Share video link/file
- Sync play/pause/seek
- Real-time chat
- Participant list

**Tech:** Qt WebEngine/Multimedia

**Pub/Sub:** `watch.session.{session_id}`
```json
{
  "type": "VIDEO_CONTROL",
  "action": "PLAY|PAUSE|SEEK",
  "timestamp": 125.5
}
```

**Độ khó:** ⭐⭐⭐⭐ | **Wow:** 🔥🔥🔥🔥🔥

---

### 🤖 2. Workflows/Automation (12%)
**Nguồn:** Slack

No-code automation builder:
- Visual workflow editor
- Trigger → Action chains
- Examples:
  - "help" → Auto-reply
  - New member → Welcome msg
  - File uploaded → Notify admins

**Pub/Sub:** Workflow engine subscribes tất cả topics, filter theo rules

**Độ khó:** ⭐⭐⭐⭐ | **Wow:** 🔥🔥🔥🔥🔥

---

### 👁️ 3. View-Once Media (10%)
**Nguồn:** Signal

Ảnh/video xem 1 lần rồi tự xóa:
- Mark as view-once
- Auto-delete after viewing
- Screenshot detection
- Privacy first

**Pub/Sub:** `media.viewonce.{media_id}`

**Độ khó:** ⭐⭐⭐ | **Wow:** 🔥🔥🔥🔥🔥

---

### 🎉 4. Message Effects (8%)
**Nguồn:** iMessage, Messenger

Hiệu ứng khi gửi tin nhắn:
- Keywords: "happy birthday" → 🎊 Confetti
- "love" → ❤️ Heart rain
- "celebration" → 🎆 Fireworks
- Full-screen animations

**Tech:** Qt Graphics, particle system

**Độ khó:** ⭐⭐⭐ | **Wow:** 🔥🔥🔥🔥🔥

---

## 🏆 TIER S - HIGH VALUE (50%)

### 5. Polls (12%)
**Nguồn:** Telegram

- Create poll với options
- Real-time voting
- Anonymous/Public
- Chart results

**Pub/Sub:** Perfect demo! `poll.{poll_id}`

**Độ khó:** ⭐⭐ | **ROI:** 🔥🔥🔥🔥🔥

---

### 6. Reactions (10%)
**Nguồn:** All platforms

- Quick reactions: 👍❤️😂🔥✨
- Multiple per message
- See who reacted

**Pub/Sub:** `reactions.message.{msg_id}`

**Độ khó:** ⭐⭐ | **ROI:** 🔥🔥🔥🔥🔥

---

### 7. Voice Messages (15%)
**Nguồn:** WhatsApp, Telegram, Zalo

- Record audio
- Waveform visualization
- Playback controls
- Opus compression

**Tech:** Qt Multimedia, Opus codec

**Độ khó:** ⭐⭐⭐ | **ROI:** 🔥🔥🔥🔥🔥

---

### 8. Roles & Permissions (12%)
**Nguồn:** Discord

Roles: Admin, Moderator, Member, Guest

**Permissions:**
- Admin: All rights
- Mod: Delete, mute, pin
- Member: Send, upload
- Guest: Read only

**Pub/Sub:** Topic-based access control

**Độ khó:** ⭐⭐⭐ | **ROI:** 🔥🔥🔥🔥

---

### 9. @Mentions (8%)
**Nguồn:** All

- @username autocomplete
- Highlight
- Notifications
- @everyone, @admins

**Pub/Sub:** `notifications.user.{user_id}`

**Độ khó:** ⭐⭐ | **ROI:** 🔥🔥🔥🔥

---

### 10. Message Threading (10%)
**Nguồn:** Slack, Discord

- Reply to specific message
- Nested display
- Follow/Unfollow thread
- Thread notifications

**Pub/Sub:** `chat.room.thread.{parent_msg_id}`

**Độ khó:** ⭐⭐⭐ | **ROI:** 🔥🔥🔥🔥

---

### 11. Bot Commands (10%)
**Nguồn:** Telegram

Built-in:
- `/help` - Show help
- `/poll "Q?" A B` - Quick poll
- `/remind 10m "text"` - Reminder
- `/calc 2+2` - Calculator

Extensible plugin system

**Pub/Sub:** `bot.commands`

**Độ khó:** ⭐⭐ | **ROI:** 🔥🔥🔥🔥🔥

---

## 🎯 TIER A - UX ESSENTIALS (15%)

### 12. Rich Text (5%)
Markdown: `**bold**` `*italic*` `` `code` ``

### 13. Typing Indicator (5%)
"User is typing..." - Auto-expire 3s

### 14. File Preview (5%)
Image thumbnails, video preview

---

## 🎨 UI/UX (10%)

**Layout:** Discord-style 3-panel
```
[Sidebar] [Channels] [Chat Area]
```

**Features:**
1. Dark/Light Mode (3%)
2. Message Bubbles (2%)
3. Smooth Animations (3%)
4. Modern Icons (2%)

**Tech:** Qt Widgets, Stylesheets

---

## 📚 DOCUMENTATION (20%)

1. **README.md** (5%) - Overview, screenshots, quick start
2. **ARCHITECTURE.md** (5%) - System design, diagrams
3. **PROTOCOL.md** (3%) - Message format spec
4. **WORKLOG.md** (3%) - Progress, contributions
5. **API.md** (2%) - API documentation
6. **Demo Video** (2%) - 3-5 min walkthrough

---

## 📊 SCORING PROJECTION

```
Core Features:          80%  ✅
Tier SSS (Unique):      45%  🏆
Tier S (High Value):    77%  ⭐
Tier A (UX):            15%  ✨
UI/UX:                  10%  🎨
Documentation:          20%  📚
───────────────────────────────
TOTAL:                 122%
Excellence Bonus:      +10%

FINAL SCORE: 9.5-10/10 🏆🏆🏆
```

---

---

## 🔥 CRITICAL IMPROVEMENTS (MUST-HAVE)

### 🔐 1. End-to-End Encryption (10%)
**Nguồn:** Signal, WhatsApp

**Tại sao CRITICAL:**
- Security professional standard
- Signal/WhatsApp level
- NOBODY else will have this!
- Showcase cryptography knowledge

**Implementation:**
- RSA-2048 for key exchange
- AES-256 for message encryption
- OpenSSL library
- Diffie-Hellman key agreement

**Flow:**
```
1. User A generates RSA key pair
2. User B generates RSA key pair
3. Exchange public keys via server
4. Generate shared AES key using DH
5. Encrypt messages with AES
6. Server only sees encrypted data
```

**Pub/Sub:**
- Metadata still visible (topics, sender_id)
- Content encrypted

**Tech:** OpenSSL, Qt Cryptographic Architecture

**Độ khó:** ⭐⭐⭐⭐ | **ROI:** 🔥🔥🔥🔥🔥

---

### 🔍 2. Message Search (5%)
**Nguồn:** All platforms

**Tại sao MUST:**
- User expectation
- Practical necessity
- Every major app has it

**Features:**
- Full-text search (SQLite FTS5)
- Filter by: user, date, type, room
- Highlight results
- Recent searches
- Search in all chats or specific chat

**Implementation:**
```sql
CREATE VIRTUAL TABLE messages_fts USING fts5(
  content, sender_id, room_id
);
```

**UI:**
- Ctrl+F shortcut
- Search bar at top
- Results list
- Jump to message

**Độ khó:** ⭐⭐⭐ | **ROI:** 🔥🔥🔥🔥

---

### ⚡ 3. Message Pagination (2%) - CRITICAL!
**Tại sao MUST:**
- App WILL lag without this!
- 1000+ messages = crash/freeze
- Professional requirement

**Implementation:**
```cpp
// Load messages in chunks
QList<Message> getMessages(QString roomId, int limit = 50, int offset = 0) {
    // Load only 50 at a time
    // User scrolls up → load more
}
```

**Features:**
- Initial load: 50 messages
- Scroll to top → load 50 more
- Infinite scroll
- Virtual scrolling for smooth UI
- Cache loaded messages

**Độ khó:** ⭐⭐ | **ROI:** 🔥🔥🔥🔥🔥

---

### ✏️ 4. Edit/Delete Messages (3%)
**Nguồn:** Telegram, WhatsApp

**Features:**
- Edit sent messages (5 min time limit)
- Delete for everyone
- Show "edited" label
- View edit history (optional)

**Pub/Sub:**
```
Topic: "message.updates.{msg_id}"
Events: MESSAGE_EDIT, MESSAGE_DELETE
```

**UI:**
- Right-click → Edit/Delete
- Strike-through for deleted
- "Edited" tag

**Độ khó:** ⭐⭐ | **ROI:** 🔥🔥🔥🔥

---

### 🎮 5. Tic-Tac-Toe Game (8%)
**Nguồn:** Classic game

**Features:**
- 2 players real-time
- Spectator mode
- Win/Lose/Draw tracking
- Simple leaderboard

**Pub/Sub:** Perfect demo!
```
Topic: "game.tictactoe.{game_id}"
Events: MOVE, WIN, DRAW, RESET
```

**Implementation:**
```cpp
class TicTacToeGame {
    char board[3][3];
    QString player1, player2;
    QString currentTurn;
    
    void makeMove(int row, int col);
    bool checkWin();
    bool checkDraw();
};
```

**Độ khó:** ⭐⭐ | **ROI:** 🔥🔥🔥🔥

---

## 🌟 ADVANCED IMPROVEMENTS (SHOULD-HAVE)

### 🌐 6. Web Client (8%)
**Nguồn:** Modern trend

**Tại sao IMPORTANT:**
- Cross-platform access
- No installation needed
- Showcase WebSocket
- Professional touch

**Architecture:**
```
Browser ←WebSocket→ Server (same pub/sub backend)
```

**Options:**
1. **Qt WebEngine** (easier)
   - Embed web view in Qt app
   - HTML/CSS/JS interface
   
2. **React/Vue.js** (better)
   - Separate web frontend
   - REST API + WebSocket
   - Modern responsive UI

**Độ khó:** ⭐⭐⭐⭐ | **ROI:** 🔥🔥🔥🔥🔥

---

### 📁 7. File Manager (5%)
**Nguồn:** Telegram, Discord

**Features:**
- View all shared files
- Filter by: type, date, sender, room
- Search files
- Bulk download
- Storage quota display
- Delete old files

**UI:**
```
┌─────────────────────────────┐
│ 📁 Files                    │
├─────────────────────────────┤
│ Filter: [All ▾] [This week]│
│                             │
│ 📄 document.pdf  (2.3 MB)  │
│    From: UserA  2d ago  ⬇️  │
│                             │
│ 🖼️ image.png    (1.1 MB)  │
│    From: UserB  3d ago  ⬇️  │
│                             │
│ Storage: 45.2/100 MB        │
└─────────────────────────────┘
```

**Độ khó:** ⭐⭐⭐ | **ROI:** 🔥🔥🔥🔥

---

### 🔔 8. Smart Notifications (5%)
**Nguồn:** All platforms

**Features:**
- DND mode (Do Not Disturb)
- Quiet hours (11PM - 7AM)
- Per-channel settings
- Keyword triggers
- Priority notifications (VIP contacts)
- **Desktop notifications** (Qt System Tray)
- Sound alerts
- Badge counts

**Settings UI:**
```
Notifications:
├─ 🔕 Do Not Disturb
├─ ⏰ Quiet Hours: 11PM - 7AM
├─ 📱 Desktop Notifications: ON
├─ 🔊 Sound: Default
├─ 🔑 Keywords: urgent, @myname
└─ ⭐ VIP Contacts: [UserA, UserB]
```

**Độ khó:** ⭐⭐⭐ | **ROI:** 🔥🔥🔥🔥

---

### 😀 9. Emoji Picker (3%)
**Nguồn:** All platforms

**Features:**
- Built-in emoji selector
- Categories (Smileys, People, etc.)
- Search emojis
- Recent emojis
- Keyboard shortcut (Ctrl+E)

**UI:**
- Popup window
- Grid layout
- Click to insert

**Độ khó:** ⭐⭐ | **ROI:** 🔥🔥🔥

---

### 📊 10. User Activity Dashboard (5%)
**Nguồn:** Analytics

**For users:**
- Messages sent today/week
- Most active hours (chart)
- Top contacts
- Files shared
- Reactions received

**Simple charts:** Qt Charts module

**Độ khó:** ⭐⭐⭐ | **ROI:** 🔥🔥🔥

---

### 📌 11. Pin Messages (3%)
**Nguồn:** Telegram, Discord

**Features:**
- Pin important messages (max 5 per channel)
- Admins/Mods only
- Pinned messages bar at top
- Quick access
- Unpin

**Pub/Sub:**
```
Topic: "channel.pins.{channel_id}"
Events: PIN_ADD, PIN_REMOVE
```

**Độ khó:** ⭐⭐ | **ROI:** 🔥🔥🔥

---

### 🖼️ 12. Image Gallery View (3%)
**Nguồn:** Telegram

**Features:**
- Grid view of all images
- Lightbox viewer (click to enlarge)
- Swipe to next/previous
- Download button
- Share to chat

**Độ khó:** ⭐⭐⭐ | **ROI:** 🔥🔥🔥

---

### 🎨 13. Themes & Customization (3%)
**Features:**
- Pre-made themes:
  * Discord Dark
  * Slack Light
  * Telegram Blue
  * Custom colors
- Color picker
- Per-chat backgrounds
- Font size adjustment
- Compact/Comfortable mode

**Độ khó:** ⭐⭐ | **ROI:** 🔥🔥🔥

---

### 📤 14. Drag & Drop Upload (2%)
**Features:**
- Drag file from desktop/browser
- Show preview before send
- Multiple files at once
- Progress bars

**Độ khó:** ⭐⭐ | **ROI:** 🔥🔥🔥

---

### 🖱️ 15. Image Lazy Loading (2%)
**Performance optimization:**
- Load thumbnails first
- Full image on click
- Cache images
- Compress large images

**Độ khó:** ⭐⭐ | **ROI:** 🔥🔥🔥

---

## 🏆 UPDATED SCORING PROJECTION

### New Feature Set:

```
🔐 FOUNDATION:
✅ Authentication & User Management ...... Included in Core

✅ CORE (80%):
   - Chat 1-1 (20%)
   - Group chat (20%)
   - File transfer 1-1 (20%)
   - File to group (20%)

🏆 TIER SSS (52%):
   - AI Chat Bot (12%) .................. GEMINI!
   - Watch Together (15%) ............... UNIQUE!
   - Workflows (12%) .................... Enterprise!
   - View-Once Media (10%) .............. Signal!
   - Message Effects (8%) ............... Fun!

⭐ TIER S (77%):
   - Polls (12%)
   - Reactions (10%)
   - Voice Messages (15%)
   - Roles & Permissions (12%)
   - @Mentions (8%)
   - Threading (10%)
   - Bot Commands (10%)

🔥 CRITICAL (28%):
   - E2E Encryption (10%) ............... Signal-level!
   - Message Search (5%) ................ Essential!
   - Pagination (2%) .................... Performance!
   - Edit/Delete (3%) ................... Basic!
   - Tic-Tac-Toe (8%) ................... Game!

🌟 ADVANCED (41%):
   - Web Client (8%)
   - File Manager (5%)
   - Smart Notifications (5%)
   - Emoji Picker (3%)
   - Dashboard (5%)
   - Pin Messages (3%)
   - Gallery View (3%)
   - Themes (3%)
   - Drag & Drop (2%)
   - Lazy Loading (2%)
   - Rich Text (5%)
   - Typing Indicator (5%)
   - File Preview (5%)

🎨 UI/UX:                           10%
📚 Documentation:                   20%
────────────────────────────────────────
TOTAL FEATURES:                    198%
Excellence Bonus:                  +25%

FINAL SCORE: 10/10 PERFECT! 🏆🏆🏆
```

---

## 🎯 RECOMMENDED STRATEGIES

### Strategy 1: "Complete Excellence" (10/10 - Ambitious)
```
✅ Core (80%)
✅ Watch Together (15%) ........ UNIQUE!
✅ Workflows (12%) ............. Enterprise!
✅ View-Once (10%) ............. Privacy!
✅ Effects (8%) ................ Fun!
✅ Polls (12%)
✅ Reactions (10%)
✅ Voice Messages (15%)
✅ UI (10%) + Docs (20%)
```

### Option 2: Best Practices (9.5/10)
```
✅ Core (80%)
✅ All Tier S (77%)
✅ Rich Text, Typing, Preview (15%)
✅ UI (10%) + Docs (20%)
```

### Option 3: Balanced (9/10)
```
✅ Core (80%)
✅ Top 7 Tier S (59%):
   - Polls, Reactions, Voice msg
   - Roles, Mentions, Threading, Bots
✅ UI (10%) + Docs (20%)
```

---

## 🛠️ TECH STACK

```
Language:   C++17
GUI:        Qt 6
Network:    QTcpSocket
Database:   SQLite3
Audio:      Qt Multimedia + Opus
Build:      CMake
VCS:        Git + GitHub
```

---

## 📅 TIMELINE (8 tuần)

```
Week 1-2: Core (80%)
Week 3:   UI/UX (10%)
Week 4:   Reactions + Polls + Mentions (25%)
Week 5:   Voice + View-Once + Effects (25%)
Week 6:   Watch Together + Threading + Roles (30%)
Week 7:   Bots + Workflows (Optional) (20%)
Week 8:   Docs + Polish (20%)
```

---

## 🔑 UNIQUE SELLING POINTS

1. 🏆 **Watch Together** - Nobody else will have!
2. 🏆 **View-Once Media** - Signal-level privacy
3. 🏆 **Message Effects** - Fun & engaging
4. 🏆 **Workflows** - Enterprise-grade
5. 🏆 **Pub/Sub Architecture** - Perfect pattern demo

---

## 💡 WHY THIS WINS

**Best of ALL platforms:**
- Messenger: Watch Together, Effects
- Signal: View-Once, Privacy
- Slack: Workflows, Threading
- Telegram: Polls, Bots, Voice msg
- Discord: Roles, Organization
- WhatsApp: Voice messages
- All: Reactions, Mentions

**Result:** Unprecedented feature set! 🚀

---

**Last Updated:** 2025-12-03  
**Version:** 1.0  
**Status:** Ready to Implement
