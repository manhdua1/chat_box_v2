# 🔍 Database Schema Review - Complete DynamoDB Design

**Last Updated:** January 1, 2026

## ✅ CURRENT SCHEMA (4 Tables)

### 1. Users
### 2. Messages  
### 3. Rooms
### 4. Files

---

## 🚨 MISSING FIELDS & TABLES

### **Users Table - CẦN BỔ SUNG:**

```json
{
  "TableName": "Users",
  "Attributes": {
    "userId": "String (PK)",
    "username": "String",
    "passwordHash": "String",
    "email": "String",
    
    // ❌ THIẾU:
    "displayName": "String",
    "bio": "String",
    "statusMessage": "String", 
    "avatarUrl": "String (S3 path)",
    "onlineStatus": "String (online/away/dnd/offline)",
    "lastSeen": "Number (timestamp)",
    "createdAt": "Number",
    "updatedAt": "Number"
  }
}
```

---

### **Messages Table - CẦN BỔ SUNG:**

```json
{
  "TableName": "Messages",
  "Attributes": {
    "roomId": "String (PK)",
    "timestamp": "Number (SK)",
    "messageId": "String",
    "userId": "String",
    "content": "String",
    
    // ❌ THIẾU:
    "type": "String (text/file/image/voice/video)",
    "fileId": "String (nếu là file)",
    "replyToId": "String (message threading)",
    "mentions": "List<String> (user IDs)",
    "reactions": "Map<String, List<String>> (emoji -> [userIds])",
    "isEdited": "Boolean",
    "editedAt": "Number",
    "isDeleted": "Boolean",
    "deletedAt": "Number",
    "readBy": "List<String> (user IDs)",
    "deliveredTo": "List<String> (user IDs)"
  }
}
```

---

### **Rooms Table - CẦN BỔ SUNG:**

```json
{
  "TableName": "Rooms",
  "Attributes": {
    "roomId": "String (PK)",
    "name": "String",
    "type": "String (private/group)",
    "members": "List<String>",
    
    // ❌ THIẾU:
    "admins": "List<String> (user IDs)",
    "createdBy": "String (user ID)",
    "createdAt": "Number",
    "avatarUrl": "String",
    "description": "String",
    "pinnedMessages": "List<String> (message IDs)",
    "settings": "Map<String, Any> (notification, permissions)",
    "lastMessageId": "String",
    "lastMessageAt": "Number",
    "unreadCount": "Map<String, Number> (userId -> count)"
  }
}
```

---

### **❌ THIẾU TABLE 5: Sessions (Authentication)**

```json
{
  "TableName": "Sessions",
  "KeySchema": [
    { "AttributeName": "sessionId", "KeyType": "HASH" }
  ],
  "GSI": [
    {
      "IndexName": "userId-index",
      "KeySchema": [
        { "AttributeName": "userId", "KeyType": "HASH" }
      ]
    }
  ],
  "Attributes": {
    "sessionId": "String (PK)",
    "userId": "String (GSI)",
    "token": "String (JWT)",
    "deviceName": "String",
    "ipAddress": "String",
    "userAgent": "String",
    "createdAt": "Number",
    "lastActivity": "Number",
    "expiresAt": "Number",
    "isActive": "Boolean"
  }
}
```

---

### **❌ THIẾU TABLE 6: Reactions (Message Reactions)**

```json
{
  "TableName": "Reactions",
  "KeySchema": [
    { "AttributeName": "messageId", "KeyType": "HASH" },
    { "AttributeName": "userId", "KeyType": "RANGE" }
  ],
  "Attributes": {
    "messageId": "String (PK)",
    "userId": "String (SK)",
    "emoji": "String",
    "createdAt": "Number"
  }
}
```

---

### **❌ THIẾU TABLE 7: Polls**

```json
{
  "TableName": "Polls",
  "KeySchema": [
    { "AttributeName": "pollId", "KeyType": "HASH" }
  ],
  "Attributes": {
    "pollId": "String (PK)",
    "roomId": "String",
    "messageId": "String",
    "createdBy": "String (user ID)",
    "question": "String",
    "options": "List<Map> [{text, votes: [userIds]}]",
    "allowMultiple": "Boolean",
    "expiresAt": "Number",
    "createdAt": "Number"
  }
}
```

---

### **❌ THIẾU TABLE 8: GameSessions (Tic-Tac-Toe)**

```json
{
  "TableName": "GameSessions",
  "KeySchema": [
    { "AttributeName": "gameId", "KeyType": "HASH" }
  ],
  "Attributes": {
    "gameId": "String (PK)",
    "roomId": "String",
    "gameType": "String (tic-tac-toe)",
    "player1": "String (user ID)",
    "player2": "String (user ID)",
    "currentTurn": "String (user ID)",
    "boardState": "String (JSON)",
    "status": "String (waiting/playing/finished)",
    "winner": "String (user ID)",
    "createdAt": "Number",
    "finishedAt": "Number"
  }
}
```

---

### **❌ THIẾU TABLE 9: WatchTogetherSessions**

```json
{
  "TableName": "WatchSessions",
  "KeySchema": [
    { "AttributeName": "sessionId", "KeyType": "HASH" }
  ],
  "Attributes": {
    "sessionId": "String (PK)",
    "roomId": "String",
    "videoUrl": "String",
    "currentTime": "Number (seconds)",
    "isPlaying": "Boolean",
    "host": "String (user ID)",
    "participants": "List<String> (user IDs)",
    "createdAt": "Number",
    "lastSyncAt": "Number"
  }
}
```

---

### **❌ THIẾU TABLE 10: Workflows (Automation)**

```json
{
  "TableName": "Workflows",
  "KeySchema": [
    { "AttributeName": "workflowId", "KeyType": "HASH" }
  ],
  "Attributes": {
    "workflowId": "String (PK)",
    "roomId": "String",
    "createdBy": "String (user ID)",
    "name": "String",
    "trigger": "Map (type, condition)",
    "actions": "List<Map> (action definitions)",
    "isActive": "Boolean",
    "lastRunAt": "Number",
    "createdAt": "Number"
  }
}
```

---

### **❌ THIẾU TABLE 11: VoiceMessages**

```json
{
  "TableName": "VoiceMessages",
  "KeySchema": [
    { "AttributeName": "voiceId", "KeyType": "HASH" }
  ],
  "Attributes": {
    "voiceId": "String (PK)",
    "messageId": "String",
    "s3Key": "String (audio file path)",
    "duration": "Number (seconds)",
    "waveform": "List<Number> (for visualization)",
    "transcription": "String (optional, from Speech-to-Text)",
    "createdAt": "Number"
  }
}
```

---

### **❌ THIẾU TABLE 12: Presence (Online Status)**

```json
{
  "TableName": "Presence",
  "KeySchema": [
    { "AttributeName": "userId", "KeyType": "HASH" }
  ],
  "TTL": "expiresAt",
  "Attributes": {
    "userId": "String (PK)",
    "status": "String (online/away/dnd/offline)",
    "lastSeen": "Number",
    "currentActivity": "String (typing in roomX)",
    "expiresAt": "Number (TTL - auto delete after 5 min)"
  }
}
```

---

## 📊 COMPLETE SCHEMA SUMMARY

```yaml
TABLES HIỆN TẠI (4):
  ✅ 1. Users (cần bổ sung fields)
  ✅ 2. Messages (cần bổ sung fields)
  ✅ 3. Rooms (cần bổ sung fields)
  ✅ 4. Files

TABLES CẦN THÊM (8):
  ❌ 5. Sessions (Auth)
  ❌ 6. Reactions
  ❌ 7. Polls
  ❌ 8. GameSessions
  ❌ 9. WatchSessions
  ❌ 10. Workflows
  ❌ 11. VoiceMessages
  ❌ 12. Presence

TOTAL: 12 TABLES
```

---

## 🎯 PRIORITY RECOMMENDATIONS

### **Phase 1 - CORE (BẮT BUỘC):**
```
✅ Update existing 4 tables với missing fields
✅ Add Sessions table (authentication critical!)
✅ Add Presence table (online status)
```

### **Phase 2 - FEATURES:**
```
✅ Add Reactions table
✅ Add Polls table
✅ Add VoiceMessages table
```

### **Phase 3 - ADVANCED:**
```
✅ Add GameSessions table
✅ Add WatchSessions table
✅ Add Workflows table
```

---

## 💻 UPDATED SCHEMA CODE

### **Complete Users Table**
```javascript
// AWS Console
{
  "TableName": "Users",
  "KeySchema": [
    { "AttributeName": "userId", "KeyType": "HASH" }
  ],
  "AttributeDefinitions": [
    { "AttributeName": "userId", "AttributeType": "S" },
    { "AttributeName": "username", "AttributeType": "S" }
  ],
  "GlobalSecondaryIndexes": [
    {
      "IndexName": "username-index",
      "KeySchema": [
        { "AttributeName": "username", "KeyType": "HASH" }
      ]
    }
  ],
  "BillingMode": "PAY_PER_REQUEST"
}
```

### **Complete Messages Table**
```javascript
{
  "TableName": "Messages",
  "KeySchema": [
    { "AttributeName": "roomId", "KeyType": "HASH" },
    { "AttributeName": "timestamp", "KeyType": "RANGE" }
  ],
  "AttributeDefinitions": [
    { "AttributeName": "roomId", "AttributeType": "S" },
    { "AttributeName": "timestamp", "AttributeType": "N" }
  ],
  "BillingMode": "PAY_PER_REQUEST"
}
```

---

## ✅ ACTION ITEMS

1. **Bổ sung fields vào 4 tables hiện tại** (có thể thêm fields động trong DynamoDB)
2. **Tạo 8 tables mới**
3. **Setup GSI (Global Secondary Indexes)** cho search
4. **Configure TTL** cho Presence table

---

## 📝 NOTES

**DynamoDB Flexibility:**
- NoSQL → Có thể thêm fields động (không cần schema fixed)
- Nhưng nên define trước để consistent
- GSI cần define khi tạo table

**Cost Considerations:**
- Mỗi table = FREE tier riêng (25GB mỗi table)
- GSI tính thêm cost
- TTL DELETE = FREE

**Implementation:**
- Có thể start với 4 tables + Sessions
- Thêm dần tables khác theo features

**TOTAL TABLES RECOMMENDED: 12** 🎯
