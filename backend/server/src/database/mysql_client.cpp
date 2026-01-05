#include "database/mysql_client.h"
#include "utils/logger.h"
#include <mysqlx/xdevapi.h>
#include <chrono>
#include <sstream>
#include <iomanip>
#include <functional>
#include <algorithm>

// Real MySQL implementation using UserSession.sql() - cleaner than Table API

MySQLClient::MySQLClient(const std::string& host,
                         const std::string& user,
                         const std::string& password,
                         const std::string& database,
                         int port)
    : host_(host), user_(user), password_(password), 
      database_(database), port_(port), session_(nullptr) {
    Logger::info("MySQL Client created");
}

MySQLClient::~MySQLClient() {
    disconnect();
}

bool MySQLClient::connect() {
    try {
        // Create session using SessionSettings (proper mysqlx way)
        mysqlx::SessionSettings settings(
            mysqlx::SessionOption::HOST, host_,
            mysqlx::SessionOption::PORT, port_,
            mysqlx::SessionOption::USER, user_,
            mysqlx::SessionOption::PWD, password_
        );
        
        session_ = std::make_shared<mysqlx::Session>(settings);
        session_->sql("USE " + database_).execute();
        
        // Migration: Check if avatar_url column exists
        try {
            session_->sql("SELECT avatar_url FROM users LIMIT 1").execute();
        } catch (...) {
            Logger::info("Migration: Adding avatar_url column to users table");
            try {
                session_->sql("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(255) DEFAULT ''").execute();
                Logger::info("✓ Migration successful");
            } catch (const std::exception& e) {
                Logger::error("Migration failed: " + std::string(e.what()));
            }
        }
        
        // Migration: Create room_members table for roles
        try {
            session_->sql("SELECT 1 FROM room_members LIMIT 1").execute();
        } catch (...) {
            Logger::info("Migration: Creating room_members table for roles");
            try {
                session_->sql(
                    "CREATE TABLE IF NOT EXISTS room_members ("
                    "room_id VARCHAR(64) NOT NULL,"
                    "user_id VARCHAR(64) NOT NULL,"
                    "role ENUM('owner', 'admin', 'moderator', 'member') DEFAULT 'member',"
                    "joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
                    "PRIMARY KEY (room_id, user_id)"
                    ")"
                ).execute();
                Logger::info("✓ room_members table created");
            } catch (const std::exception& e) {
                Logger::error("Migration failed: " + std::string(e.what()));
            }
        }
        
        // Migration: Create pinned_messages table
        try {
            session_->sql("SELECT 1 FROM pinned_messages LIMIT 1").execute();
        } catch (...) {
            Logger::info("Migration: Creating pinned_messages table");
            try {
                session_->sql(
                    "CREATE TABLE IF NOT EXISTS pinned_messages ("
                    "room_id VARCHAR(64) NOT NULL,"
                    "message_id VARCHAR(64) NOT NULL,"
                    "pinned_by VARCHAR(64) NOT NULL,"
                    "pinned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
                    "PRIMARY KEY (room_id, message_id)"
                    ")"
                ).execute();
                Logger::info("✓ pinned_messages table created");
            } catch (const std::exception& e) {
                Logger::error("Migration failed: " + std::string(e.what()));
            }
        }
        
        // Migration: Create blocked_users table
        try {
            session_->sql("SELECT 1 FROM blocked_users LIMIT 1").execute();
        } catch (...) {
            Logger::info("Migration: Creating blocked_users table");
            try {
                session_->sql(
                    "CREATE TABLE IF NOT EXISTS blocked_users ("
                    "user_id VARCHAR(64) NOT NULL,"
                    "blocked_user_id VARCHAR(64) NOT NULL,"
                    "blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
                    "PRIMARY KEY (user_id, blocked_user_id)"
                    ")"
                ).execute();
                Logger::info("✓ blocked_users table created");
            } catch (const std::exception& e) {
                Logger::error("Migration failed: " + std::string(e.what()));
            }
        }

        // Migration: Create polls tables
        try {
            session_->sql("SELECT 1 FROM polls LIMIT 1").execute();
        } catch (...) {
            Logger::info("Migration: Creating polls tables");
            try {
                session_->sql(
                    "CREATE TABLE IF NOT EXISTS polls ("
                    "poll_id VARCHAR(64) PRIMARY KEY,"
                    "room_id VARCHAR(64) NOT NULL,"
                    "question TEXT NOT NULL,"
                    "created_by VARCHAR(64) NOT NULL,"
                    "created_at BIGINT UNSIGNED NOT NULL,"
                    "is_closed BOOLEAN DEFAULT FALSE,"
                    "INDEX idx_room (room_id),"
                    "INDEX idx_active (room_id, is_closed)"
                    ")"
                ).execute();
                
                session_->sql(
                    "CREATE TABLE IF NOT EXISTS poll_options ("
                    "option_id VARCHAR(64) PRIMARY KEY,"
                    "poll_id VARCHAR(64) NOT NULL,"
                    "option_text TEXT NOT NULL,"
                    "option_index INT NOT NULL,"
                    "FOREIGN KEY (poll_id) REFERENCES polls(poll_id) ON DELETE CASCADE,"
                    "INDEX idx_poll (poll_id)"
                    ")"
                ).execute();
                
                session_->sql(
                    "CREATE TABLE IF NOT EXISTS poll_votes ("
                    "poll_id VARCHAR(64),"
                    "option_id VARCHAR(64),"
                    "user_id VARCHAR(64) NOT NULL,"
                    "username VARCHAR(50) NOT NULL,"
                    "voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
                    "PRIMARY KEY (poll_id, user_id),"
                    "FOREIGN KEY (poll_id) REFERENCES polls(poll_id) ON DELETE CASCADE,"
                    "FOREIGN KEY (option_id) REFERENCES poll_options(option_id) ON DELETE CASCADE,"
                    "INDEX idx_option (option_id)"
                    ")"
                ).execute();
                
                Logger::info("✓ polls tables created");
            } catch (const std::exception& e) {
                Logger::error("Migration failed: " + std::string(e.what()));
            }
        }

        // Migration: Add metadata column to messages table
        try {
            // Check if metadata column exists
            auto result = session_->sql(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS "
                "WHERE table_schema = ? AND table_name = 'messages' AND column_name = 'metadata'"
            ).bind(database_).execute();
            auto row = result.fetchOne();
            int count = row[0].get<int>();
            
            if (count == 0) {
                Logger::info("Migration: Adding metadata column to messages table");
                session_->sql("ALTER TABLE messages ADD COLUMN metadata JSON").execute();
                Logger::info("✓ metadata column added to messages table");
            }
        } catch (const std::exception& e) {
            Logger::error("Migration (metadata) failed: " + std::string(e.what()));
        }

        // Migration: Add is_deleted and deleted_at columns to messages table
        try {
            auto result = session_->sql(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS "
                "WHERE table_schema = ? AND table_name = 'messages' AND column_name = 'is_deleted'"
            ).bind(database_).execute();
            auto row = result.fetchOne();
            int count = row[0].get<int>();
            
            if (count == 0) {
                Logger::info("Migration: Adding is_deleted and deleted_at columns to messages table");
                session_->sql("ALTER TABLE messages ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE").execute();
                session_->sql("ALTER TABLE messages ADD COLUMN deleted_at TIMESTAMP NULL").execute();
                Logger::info("✓ is_deleted and deleted_at columns added to messages table");
            }
        } catch (const std::exception& e) {
            Logger::error("Migration (is_deleted) failed: " + std::string(e.what()));
        }

        // Migration: Add edited_at column to messages table
        try {
            auto result = session_->sql(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS "
                "WHERE table_schema = ? AND table_name = 'messages' AND column_name = 'edited_at'"
            ).bind(database_).execute();
            auto row = result.fetchOne();
            int count = row[0].get<int>();
            
            if (count == 0) {
                Logger::info("Migration: Adding edited_at column to messages table");
                session_->sql("ALTER TABLE messages ADD COLUMN edited_at TIMESTAMP NULL").execute();
                Logger::info("✓ edited_at column added to messages table");
            }
        } catch (const std::exception& e) {
            Logger::error("Migration (edited_at) failed: " + std::string(e.what()));
        }

        // Migration: Create message_reads table for read receipts
        try {
            session_->sql("SELECT 1 FROM message_reads LIMIT 1").execute();
        } catch (...) {
            Logger::info("Migration: Creating message_reads table");
            try {
                session_->sql(
                    "CREATE TABLE IF NOT EXISTS message_reads ("
                    "message_id VARCHAR(64) NOT NULL,"
                    "user_id VARCHAR(64) NOT NULL,"
                    "read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
                    "PRIMARY KEY (message_id, user_id),"
                    "INDEX idx_user (user_id),"
                    "INDEX idx_message (message_id)"
                    ")"
                ).execute();
                Logger::info("✓ message_reads table created");
            } catch (const std::exception& e) {
                Logger::error("Migration (message_reads) failed: " + std::string(e.what()));
            }
        }

        // Migration: Add display_name and status_message columns to users table
        try {
            auto result = session_->sql(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS "
                "WHERE table_schema = ? AND table_name = 'users' AND column_name = 'display_name'"
            ).bind(database_).execute();
            auto row = result.fetchOne();
            int count = row[0].get<int>();
            
            if (count == 0) {
                Logger::info("Migration: Adding display_name column to users table");
                session_->sql("ALTER TABLE users ADD COLUMN display_name VARCHAR(100) DEFAULT ''").execute();
                Logger::info("✓ display_name column added to users table");
            }
        } catch (const std::exception& e) {
            Logger::error("Migration (display_name) failed: " + std::string(e.what()));
        }

        // Migration: Add status_message column to users table
        try {
            auto result = session_->sql(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS "
                "WHERE table_schema = ? AND table_name = 'users' AND column_name = 'status_message'"
            ).bind(database_).execute();
            auto row = result.fetchOne();
            int count = row[0].get<int>();
            
            if (count == 0) {
                Logger::info("Migration: Adding status_message column to users table");
                session_->sql("ALTER TABLE users ADD COLUMN status_message VARCHAR(255) DEFAULT ''").execute();
                Logger::info("✓ status_message column added to users table");
            }
        } catch (const std::exception& e) {
            Logger::error("Migration (status_message) failed: " + std::string(e.what()));
        }

        Logger::info("✓ MySQL connected: " + database_);
        return true;
    } catch (const std::exception& e) {
        handleException(e, "connect");
        return false;
    }
}

void MySQLClient::disconnect() {
    if (session_) {
        session_->close();
        session_ = nullptr;
        Logger::info("MySQL disconnected");
    }
}

bool MySQLClient::isConnected() const {
    return session_ != nullptr;
}

// Helper: Convert UserStatus enum to string for DB
std::string userStatusToString(UserStatus status) {
    switch (status) {
        case STATUS_OFFLINE: return "offline";
        case STATUS_ONLINE: return "online";
        case STATUS_AWAY: return "away";
        case STATUS_DND: return "dnd";
        case STATUS_INVISIBLE: return "invisible";
        default: return "offline";
    }
}

// Users
bool MySQLClient::createUser(const User& user) {
    try {
        std::string statusStr = userStatusToString(user.status);
        session_->sql("INSERT INTO users (user_id, username, email, password_hash, status, status_message, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .bind(user.userId, user.username, user.email, user.passwordHash, statusStr, user.statusMessage, user.avatarUrl)
            .execute();
        Logger::info("✓ User created: " + user.username);
        return true;
    } catch (const std::exception& e) {
        handleException(e, "createUser");
        return false;
    }
}

std::optional<User> MySQLClient::getUser(const std::string& username) {
    try {
        auto result = session_->sql("SELECT user_id, username, email, password_hash, status, status_message, avatar_url FROM users WHERE username = ?")
            .bind(username).execute();
        auto row = result.fetchOne();
        if (!row) return std::nullopt;
        
        User user;
        user.userId = row[0].get<std::string>();
        user.username = row[1].get<std::string>();
        user.email = row[2].get<std::string>();
        user.passwordHash = row[3].get<std::string>();
        
        // Status is stored as ENUM string in database
        std::string statusStr = row[4].get<std::string>();
        if (statusStr == "online") user.status = UserStatus::STATUS_ONLINE;
        else if (statusStr == "offline") user.status = UserStatus::STATUS_OFFLINE;
        else if (statusStr == "away") user.status = UserStatus::STATUS_AWAY;
        else if (statusStr == "busy") user.status = UserStatus::STATUS_DND;
        else user.status = UserStatus::STATUS_OFFLINE;
        
        user.statusMessage = row[5].get<std::string>();
        // Handle potentially null avatar_url
        user.avatarUrl = row[6].isNull() ? "" : row[6].get<std::string>();
        user.createdAt = 0;
        return user;
    } catch (const std::exception& e) {
        handleException(e, "getUser");
        return std::nullopt;
    }
}

std::optional<User> MySQLClient::getUserById(const std::string& userId) {
    try {
        auto result = session_->sql("SELECT user_id, username, email, password_hash, status, status_message, avatar_url FROM users WHERE user_id = ?")
            .bind(userId).execute();
        auto row = result.fetchOne();
        if (!row) return std::nullopt;
        
        User user;
        user.userId = row[0].get<std::string>();
        user.username = row[1].get<std::string>();
        user.email = row[2].get<std::string>();
        user.passwordHash = row[3].get<std::string>();
        
        // Status is stored as ENUM string in database
        std::string statusStr = row[4].get<std::string>();
        if (statusStr == "online") user.status = UserStatus::STATUS_ONLINE;
        else if (statusStr == "offline") user.status = UserStatus::STATUS_OFFLINE;
        else if (statusStr == "away") user.status = UserStatus::STATUS_AWAY;
        else if (statusStr == "busy") user.status = UserStatus::STATUS_DND;
        else user.status = UserStatus::STATUS_OFFLINE;
        
        user.statusMessage = row[5].get<std::string>();
        // Handle potentially null avatar_url
        user.avatarUrl = row[6].isNull() ? "" : row[6].get<std::string>();
        user.createdAt = 0;
        return user;
    } catch (const std::exception& e) {
        handleException(e, "getUserById");
        return std::nullopt;
    }
}

std::vector<User> MySQLClient::getAllUsers() {
    std::vector<User> users;
    try {
        auto result = session_->sql("SELECT user_id, username, email, status, status_message, avatar_url FROM users ORDER BY username")
            .execute();
        
        for (auto row : result) {
            User user;
            user.userId = row[0].get<std::string>();
            user.username = row[1].get<std::string>();
            user.email = row[2].get<std::string>();
            
            std::string statusStr = row[3].get<std::string>();
            if (statusStr == "online") user.status = UserStatus::STATUS_ONLINE;
            else if (statusStr == "offline") user.status = UserStatus::STATUS_OFFLINE;
            else if (statusStr == "away") user.status = UserStatus::STATUS_AWAY;
            else if (statusStr == "busy") user.status = UserStatus::STATUS_DND;
            else user.status = UserStatus::STATUS_OFFLINE;
            
            user.statusMessage = row[4].isNull() ? "" : row[4].get<std::string>();
            user.avatarUrl = row[5].isNull() ? "" : row[5].get<std::string>();
            users.push_back(user);
        }
        
        Logger::info("✓ Loaded " + std::to_string(users.size()) + " users from database");
    } catch (const std::exception& e) {
        handleException(e, "getAllUsers");
    }
    return users;
}

bool MySQLClient::updateUserStatus(const std::string& userId, int status) {
    try {
        // Convert int status to string enum value (database uses ENUM)
        std::string statusStr;
        switch(status) {
            case 1: statusStr = "online"; break;
            case 2: statusStr = "away"; break;
            case 3: statusStr = "busy"; break;
            case 0: 
            default: statusStr = "offline"; break;
        }
        session_->sql("UPDATE users SET status = ? WHERE user_id = ?")
            .bind(statusStr, userId).execute();
        return true;
    } catch (const std::exception& e) {
        handleException(e, "updateUserStatus");
        return false;
    }
}

bool MySQLClient::updateUserAvatar(const std::string& userId, const std::string& avatarUrl) {
    try {
        session_->sql("UPDATE users SET avatar_url = ? WHERE user_id = ?")
            .bind(avatarUrl, userId).execute();
        Logger::info("Updated avatar for user: " + userId);
        return true;
    } catch (const std::exception& e) {
        handleException(e, "updateUserAvatar");
        return false;
    }
}

bool MySQLClient::deleteUser(const std::string& userId) {
    try {
        session_->sql("DELETE FROM users WHERE user_id = ?")
            .bind(userId).execute();
        return true;
    } catch (const std::exception& e) {
        handleException(e, "deleteUser");
        return false;
    }
}

// Sessions
bool MySQLClient::createSession(const UserSession& UserSession) {
    try {
        session_->sql("INSERT INTO sessions (session_id, user_id, username, expires_at) VALUES (?, ?, ?, FROM_UNIXTIME(?))")
            .bind(UserSession.sessionId, UserSession.userId, UserSession.username, UserSession.expiresAt).execute();
        Logger::info("✓ UserSession created: " + UserSession.sessionId);
        return true;
    } catch (const std::exception& e) {
        handleException(e, "createSession");
        return false;
    }
}

std::optional<UserSession> MySQLClient::getSession(const std::string& sessionId) {
    try {
        auto result = session_->sql("SELECT session_id, user_id, username, UNIX_TIMESTAMP(created_at), UNIX_TIMESTAMP(expires_at) FROM sessions WHERE session_id = ?")
            .bind(sessionId).execute();
        auto row = result.fetchOne();
        if (!row) return std::nullopt;
        
        UserSession sess;
        sess.sessionId = row[0].get<std::string>();
        sess.userId = row[1].get<std::string>();
        sess.username = row[2].get<std::string>();
        sess.createdAt = row[3].get<uint64_t>();
        sess.expiresAt = row[4].get<uint64_t>();
        return sess;
    } catch (const std::exception& e) {
        handleException(e, "getSession");
        return std::nullopt;
    }
}

std::vector<UserSession> MySQLClient::getUserSessions(const std::string& userId) {
    std::vector<UserSession> sessions;
    try {
        auto result = session_->sql("SELECT session_id, user_id, username, UNIX_TIMESTAMP(created_at), UNIX_TIMESTAMP(expires_at) FROM sessions WHERE user_id = ?")
            .bind(userId).execute();
        for (auto row : result) {
            UserSession sess;
            sess.sessionId = row[0].get<std::string>();
            sess.userId = row[1].get<std::string>();
            sess.username = row[2].get<std::string>();
            sess.createdAt = row[3].get<uint64_t>();
            sess.expiresAt = row[4].get<uint64_t>();
            sessions.push_back(sess);
        }
    } catch (const std::exception& e) {
        handleException(e, "getUserSessions");
    }
    return sessions;
}

bool MySQLClient::updateSessionHeartbeat(const std::string& sessionId, uint64_t timestamp) {
    try {
        session_->sql("UPDATE sessions SET last_heartbeat = FROM_UNIXTIME(?) WHERE session_id = ?")
            .bind(timestamp, sessionId).execute();
        return true;
    } catch (const std::exception& e) {
        handleException(e, "updateSessionHeartbeat");
        return false;
    }
}

bool MySQLClient::deleteSession(const std::string& sessionId) {
    try {
        session_->sql("DELETE FROM sessions WHERE session_id = ?")
            .bind(sessionId).execute();
        return true;
    } catch (const std::exception& e) {
        handleException(e, "deleteSession");
        return false;
    }
}

// Messages
bool MySQLClient::createMessage(const Message& message) {
    Logger::info("📝 START createMessage");
    
    if (!session_) {
        Logger::error("✗ MySQL session is NULL!");
        return false;
    }
    
    try {
        Logger::info("  Attempting to save message: " + message.messageId);
        Logger::info("  Room: " + message.roomId + ", Sender: " + message.senderName + " (" + message.senderId + ")");
        Logger::info("  Content: " + message.content);
        Logger::info("  MessageType: " + std::to_string(message.messageType) + ", ReplyTo: " + message.replyToId);
        
    } catch(...) {
        Logger::error("Exception during logging!");
    }
    
    try {
        Logger::info("📝 Preparing SQL statement...");
        
        // Database has DEFAULT CURRENT_TIMESTAMP for created_at, so don't need to specify it
        // Include metadata column for file attachments
        // Use INSERT IGNORE to silently skip duplicate message IDs (can happen with frontend retries)
        auto statement = session_->sql("INSERT IGNORE INTO messages (message_id, room_id, sender_id, sender_name, content, message_type, reply_to_id, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        
        Logger::info("📝 Binding parameters...");
        statement.bind(message.messageId, message.roomId, message.senderId, message.senderName, 
                      message.content, message.messageType, message.replyToId.empty() ? "" : message.replyToId,
                      message.metadata.empty() ? mysqlx::nullvalue : mysqlx::Value(message.metadata));
        
        Logger::info("📝 Executing INSERT...");
        statement.execute();
        
        Logger::info("✓ Message SQL executed successfully");
        
        // Verify it was inserted
        Logger::info("📝 Verifying insert...");
        auto result = session_->sql("SELECT COUNT(*) FROM messages WHERE message_id = ?")
            .bind(message.messageId).execute();
        auto row = result.fetchOne();
        int count = row[0];
        
        if (count > 0) {
            Logger::info("✓✓ Message VERIFIED in database (count=" + std::to_string(count) + ")");
            return true;
        } else {
            Logger::error("✗ Message NOT found after insert!");
            return false;
        }
    } catch (const std::exception& e) {
        Logger::error("✗ Exception in createMessage: " + std::string(e.what()));
        // Try to get more details
        try {
            std::string type = typeid(e).name();
            Logger::error("   Exception type: " + type);
        } catch(...) {}
        handleException(e, "createMessage");
        return false;
    } catch (...) {
        Logger::error("✗ Unknown exception in createMessage!");
        return false;
    }
}

std::optional<Message> MySQLClient::getMessage(const std::string& messageId) {
    try {
        auto result = session_->sql("SELECT message_id, room_id, sender_id, sender_name, content, COALESCE(message_type, 0), reply_to_id, UNIX_TIMESTAMP(created_at), CAST(metadata AS CHAR) FROM messages WHERE message_id = ?")
            .bind(messageId).execute();
        auto row = result.fetchOne();
        if (!row) return std::nullopt;
        
        Message msg;
        msg.messageId = row[0].get<std::string>();
        msg.roomId = row[1].get<std::string>();
        msg.senderId = row[2].get<std::string>();
        msg.senderName = row[3].get<std::string>();
        msg.content = row[4].get<std::string>();
        // Handle possible NULL or invalid message_type
        try {
            msg.messageType = row[5].isNull() ? 0 : static_cast<int>(row[5].get<int64_t>());
        } catch (...) {
            msg.messageType = 0;
        }
        msg.replyToId = row[6].isNull() ? "" : row[6].get<std::string>();
        msg.timestamp = row[7].get<uint64_t>();
        try {
            msg.metadata = row[8].isNull() ? "" : row[8].get<std::string>();
        } catch (...) {
            msg.metadata = "";
        }
        return msg;
    } catch (const std::exception& e) {
        handleException(e, "getMessage");
        return std::nullopt;
    }
}

std::vector<Message> MySQLClient::getMessagesByRoom(const std::string& roomId, int limit) {
    std::vector<Message> messages;
    try {
        auto result = session_->sql("SELECT message_id, room_id, sender_id, sender_name, content, COALESCE(message_type, 0), reply_to_id, UNIX_TIMESTAMP(created_at), CAST(metadata AS CHAR) FROM messages WHERE room_id = ? ORDER BY created_at DESC LIMIT ?")
            .bind(roomId, limit).execute();
        
        for (auto row : result) {
            Message msg;
            msg.messageId = row[0].get<std::string>();
            msg.roomId = row[1].get<std::string>();
            msg.senderId = row[2].get<std::string>();
            msg.senderName = row[3].get<std::string>();
            msg.content = row[4].get<std::string>();
            // Handle possible NULL or invalid message_type
            try {
                msg.messageType = row[5].isNull() ? 0 : static_cast<int>(row[5].get<int64_t>());
            } catch (...) {
                msg.messageType = 0;
            }
            msg.replyToId = row[6].isNull() ? "" : row[6].get<std::string>();
            msg.timestamp = row[7].get<uint64_t>();
            try {
                msg.metadata = row[8].isNull() ? "" : row[8].get<std::string>();
            } catch (...) {
                msg.metadata = "";
            }
            messages.push_back(msg);
        }
        // Reverse to get oldest first (for chat display - old on top, new on bottom)
        std::reverse(messages.begin(), messages.end());
    } catch (const std::exception& e) {
        handleException(e, "getMessagesByRoom");
    }
    return messages;
}

std::vector<Message> MySQLClient::getRecentMessages(const std::string& roomId, int limit, int offset) {
    std::vector<Message> messages;
    try {
        Logger::info("📚 Loading recent messages for room: " + roomId + " (limit=" + std::to_string(limit) + ", offset=" + std::to_string(offset) + ")");
        
        auto result = session_->sql(
            "SELECT message_id, room_id, sender_id, sender_name, content, COALESCE(message_type, 0), reply_to_id, UNIX_TIMESTAMP(created_at), CAST(metadata AS CHAR) "
            "FROM messages WHERE room_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?")
            .bind(roomId, limit, offset).execute();
        
        for (auto row : result) {
            Message msg;
            msg.messageId = row[0].get<std::string>();
            msg.roomId = row[1].get<std::string>();
            msg.senderId = row[2].get<std::string>();
            msg.senderName = row[3].get<std::string>();
            msg.content = row[4].get<std::string>();
            // Handle possible NULL or invalid message_type
            try {
                msg.messageType = row[5].isNull() ? 0 : static_cast<int>(row[5].get<int64_t>());
            } catch (...) {
                msg.messageType = 0;
            }
            msg.replyToId = row[6].isNull() ? "" : row[6].get<std::string>();
            msg.timestamp = row[7].get<uint64_t>();
            // JSON metadata - cast to string
            try {
                msg.metadata = row[8].isNull() ? "" : row[8].get<std::string>();
            } catch (...) {
                msg.metadata = "";
            }
            messages.push_back(msg);
        }
        
        Logger::info("✓ Loaded " + std::to_string(messages.size()) + " messages");
        
    } catch (const std::exception& e) {
        Logger::error("Error loading messages: " + std::string(e.what()));
        handleException(e, "getRecentMessages");
    }
    
    // Reverse to get chronological order (oldest first)
    std::reverse(messages.begin(), messages.end());
    return messages;
}

std::vector<Message> MySQLClient::getMessageReplies(const std::string& messageId, int limit) {
    std::vector<Message> replies;
    try {
        Logger::info("Loading replies for message: " + messageId);
        
        auto result = session_->sql(
            "SELECT message_id, room_id, sender_id, sender_name, content, COALESCE(message_type, 0), reply_to_id, UNIX_TIMESTAMP(created_at), CAST(metadata AS CHAR) "
            "FROM messages WHERE reply_to_id = ? ORDER BY created_at ASC LIMIT ?")
            .bind(messageId, limit).execute();
        
        for (auto row : result) {
            Message msg;
            msg.messageId = row[0].get<std::string>();
            msg.roomId = row[1].get<std::string>();
            msg.senderId = row[2].get<std::string>();
            msg.senderName = row[3].get<std::string>();
            msg.content = row[4].get<std::string>();
            try {
                msg.messageType = row[5].isNull() ? 0 : static_cast<int>(row[5].get<int64_t>());
            } catch (...) {
                msg.messageType = 0;
            }
            msg.replyToId = row[6].isNull() ? "" : row[6].get<std::string>();
            msg.timestamp = row[7].get<uint64_t>();
            try {
                msg.metadata = row[8].isNull() ? "" : row[8].get<std::string>();
            } catch (...) {
                msg.metadata = "";
            }
            replies.push_back(msg);
        }
        
        Logger::info("✓ Loaded " + std::to_string(replies.size()) + " replies");
        
    } catch (const std::exception& e) {
        Logger::error("Error loading replies: " + std::string(e.what()));
        handleException(e, "getMessageReplies");
    }
    
    return replies;
}

std::vector<Message> MySQLClient::searchMessages(const std::string& query, const std::string& roomId, int limit) {
    std::vector<Message> results;
    try {
        Logger::info("Searching messages: '" + query + "' in room: " + (roomId.empty() ? "all" : roomId));
        
        // Use LIKE for simple text search
        // For production, consider FULLTEXT search or external search engine
        std::string searchPattern = "%" + query + "%";
        
        mysqlx::SqlResult result;
        if (roomId.empty()) {
            // Search all rooms
            result = session_->sql(
                "SELECT message_id, room_id, sender_id, sender_name, content, message_type, reply_to_id, UNIX_TIMESTAMP(created_at) "
                "FROM messages WHERE content LIKE ? ORDER BY created_at DESC LIMIT ?"
            ).bind(searchPattern, limit).execute();
        } else {
            // Search specific room
            result = session_->sql(
                "SELECT message_id, room_id, sender_id, sender_name, content, message_type, reply_to_id, UNIX_TIMESTAMP(created_at) "
                "FROM messages WHERE room_id = ? AND content LIKE ? ORDER BY created_at DESC LIMIT ?"
            ).bind(roomId, searchPattern, limit).execute();
        }
        
        for (auto row : result) {
            Message msg;
            msg.messageId = row[0].get<std::string>();
            msg.roomId = row[1].get<std::string>();
            msg.senderId = row[2].get<std::string>();
            msg.senderName = row[3].get<std::string>();
            msg.content = row[4].get<std::string>();
            msg.messageType = row[5].get<int>();
            msg.replyToId = row[6].isNull() ? "" : row[6].get<std::string>();
            msg.timestamp = row[7].get<uint64_t>();
            results.push_back(msg);
        }
        
        Logger::info("✓ Search found " + std::to_string(results.size()) + " messages");
        
    } catch (const std::exception& e) {
        Logger::error("Error searching messages: " + std::string(e.what()));
        handleException(e, "searchMessages");
    }
    
    return results;
}

bool MySQLClient::deleteMessage(const std::string& messageId) {
    try {
        session_->sql("DELETE FROM messages WHERE message_id = ?")
            .bind(messageId).execute();
        return true;
    } catch (const std::exception& e) {
        handleException(e, "deleteMessage");
        return false;
    }
}

// ============================================================================
// ROOMS
// ============================================================================

bool MySQLClient::createRoom(const Room& room) {
    try {
        session_->sql(
            "INSERT INTO rooms (room_id, name, creator_id, room_type, description) "
            "VALUES (?, ?, ?, 'public', '')"
        ).bind(room.roomId, room.name, room.creatorId).execute();
        
        // Also add creator as owner member
        session_->sql(
            "INSERT INTO room_members (room_id, user_id, role) VALUES (?, ?, 'owner')"
        ).bind(room.roomId, room.creatorId).execute();
        
        Logger::info("✓ Room created: " + room.roomId + " (" + room.name + ")");
        return true;
    } catch (const std::exception& e) {
        handleException(e, "createRoom");
        return false;
    }
}

std::optional<Room> MySQLClient::getRoom(const std::string& roomId) {
    try {
        auto result = session_->sql(
            "SELECT room_id, name, creator_id FROM rooms WHERE room_id = ?"
        ).bind(roomId).execute();
        
        auto row = result.fetchOne();
        if (!row) return std::nullopt;
        
        Room room;
        room.roomId = row[0].get<std::string>();
        room.name = row[1].get<std::string>();
        room.creatorId = row[2].get<std::string>();
        
        // Get members
        auto members = getRoomMembers(roomId);
        room.memberIds = members;
        
        return room;
    } catch (const std::exception& e) {
        handleException(e, "getRoom");
        return std::nullopt;
    }
}

bool MySQLClient::updateRoom(const Room& room) {
    try {
        session_->sql(
            "UPDATE rooms SET name = ? WHERE room_id = ?"
        ).bind(room.name, room.roomId).execute();
        return true;
    } catch (const std::exception& e) {
        handleException(e, "updateRoom");
        return false;
    }
}

bool MySQLClient::deleteRoom(const std::string& roomId) {
    try {
        // Delete members first (cascade should handle this, but being explicit)
        session_->sql("DELETE FROM room_members WHERE room_id = ?").bind(roomId).execute();
        // Delete messages in room
        session_->sql("DELETE FROM messages WHERE room_id = ?").bind(roomId).execute();
        // Delete room
        session_->sql("DELETE FROM rooms WHERE room_id = ?").bind(roomId).execute();
        Logger::info("✓ Room deleted: " + roomId);
        return true;
    } catch (const std::exception& e) {
        handleException(e, "deleteRoom");
        return false;
    }
}

bool MySQLClient::addRoomMember(const std::string& roomId, const std::string& userId) {
    try {
        session_->sql(
            "INSERT IGNORE INTO room_members (room_id, user_id, role) VALUES (?, ?, 'member')"
        ).bind(roomId, userId).execute();
        Logger::info("✓ User " + userId + " added to room " + roomId);
        return true;
    } catch (const std::exception& e) {
        handleException(e, "addRoomMember");
        return false;
    }
}

bool MySQLClient::removeRoomMember(const std::string& roomId, const std::string& userId) {
    try {
        session_->sql(
            "DELETE FROM room_members WHERE room_id = ? AND user_id = ?"
        ).bind(roomId, userId).execute();
        Logger::info("✓ User " + userId + " removed from room " + roomId);
        return true;
    } catch (const std::exception& e) {
        handleException(e, "removeRoomMember");
        return false;
    }
}

std::vector<std::string> MySQLClient::getRoomMembers(const std::string& roomId) {
    std::vector<std::string> members;
    try {
        auto result = session_->sql(
            "SELECT user_id FROM room_members WHERE room_id = ?"
        ).bind(roomId).execute();
        
        for (auto row : result) {
            members.push_back(row[0].get<std::string>());
        }
    } catch (const std::exception& e) {
        handleException(e, "getRoomMembers");
    }
    return members;
}

// ============================================================================
// FILES
// ============================================================================

bool MySQLClient::createFile(const FileInfo& file) {
    try {
        session_->sql(
            "INSERT INTO files (file_id, user_id, room_id, file_name, file_size, mime_type, storage_path) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(file.fileId, file.userId, file.roomId, file.filename, (int64_t)file.fileSize, file.mimeType, file.s3Key).execute();
        Logger::info("✓ File metadata saved: " + file.fileId);
        return true;
    } catch (const std::exception& e) {
        handleException(e, "createFile");
        return false;
    }
}

std::optional<FileInfo> MySQLClient::getFile(const std::string& fileId) {
    try {
        auto result = session_->sql(
            "SELECT file_id, user_id, room_id, file_name, file_size, mime_type, storage_path, UNIX_TIMESTAMP(uploaded_at) "
            "FROM files WHERE file_id = ?"
        ).bind(fileId).execute();
        
        auto row = result.fetchOne();
        if (!row) return std::nullopt;
        
        FileInfo file;
        file.fileId = row[0].get<std::string>();
        file.userId = row[1].get<std::string>();
        file.roomId = row[2].get<std::string>();
        file.filename = row[3].get<std::string>();
        file.fileSize = row[4].get<uint64_t>();
        file.mimeType = row[5].get<std::string>();
        file.s3Key = row[6].get<std::string>();
        file.uploadedAt = row[7].get<uint64_t>();
        return file;
    } catch (const std::exception& e) {
        handleException(e, "getFile");
        return std::nullopt;
    }
}

std::vector<FileInfo> MySQLClient::getRoomFiles(const std::string& roomId) {
    std::vector<FileInfo> files;
    try {
        auto result = session_->sql(
            "SELECT file_id, user_id, room_id, file_name, file_size, mime_type, storage_path, UNIX_TIMESTAMP(uploaded_at) "
            "FROM files WHERE room_id = ? ORDER BY uploaded_at DESC"
        ).bind(roomId).execute();
        
        for (auto row : result) {
            FileInfo file;
            file.fileId = row[0].get<std::string>();
            file.userId = row[1].get<std::string>();
            file.roomId = row[2].get<std::string>();
            file.filename = row[3].get<std::string>();
            file.fileSize = row[4].get<uint64_t>();
            file.mimeType = row[5].get<std::string>();
            file.s3Key = row[6].get<std::string>();
            file.uploadedAt = row[7].get<uint64_t>();
            files.push_back(file);
        }
    } catch (const std::exception& e) {
        handleException(e, "getRoomFiles");
    }
    return files;
}

bool MySQLClient::deleteFile(const std::string& fileId) {
    try {
        session_->sql("DELETE FROM files WHERE file_id = ?").bind(fileId).execute();
        return true;
    } catch (const std::exception& e) {
        handleException(e, "deleteFile");
        return false;
    }
}

// ============================================================================
// ROOM ROLES & PERMISSIONS
// ============================================================================

bool MySQLClient::setMemberRole(const std::string& roomId, const std::string& userId, const std::string& role) {
    try {
        // Use INSERT ON DUPLICATE KEY UPDATE for upsert
        session_->sql(
            "INSERT INTO room_members (room_id, user_id, role) VALUES (?, ?, ?) "
            "ON DUPLICATE KEY UPDATE role = ?"
        ).bind(roomId, userId, role, role).execute();
        
        Logger::info("Set role for " + userId + " in " + roomId + " to " + role);
        return true;
    } catch (const std::exception& e) {
        handleException(e, "setMemberRole");
        return false;
    }
}

std::string MySQLClient::getMemberRole(const std::string& roomId, const std::string& userId) {
    try {
        auto result = session_->sql(
            "SELECT role FROM room_members WHERE room_id = ? AND user_id = ?"
        ).bind(roomId, userId).execute();
        
        auto row = result.fetchOne();
        if (row) {
            return row[0].get<std::string>();
        }
        return "member"; // Default role
    } catch (const std::exception& e) {
        handleException(e, "getMemberRole");
        return "member";
    }
}

bool MySQLClient::hasMemberPermission(const std::string& roomId, const std::string& userId, const std::string& action) {
    std::string role = getMemberRole(roomId, userId);
    
    // Permission matrix
    // owner: all actions
    // admin: kick, mute, pin
    // moderator: mute, pin
    // member: send messages only
    
    if (role == "owner") {
        return true; // Owner can do everything
    }
    
    if (action == "kick" || action == "ban" || action == "delete_room") {
        return role == "owner" || role == "admin";
    }
    
    if (action == "mute" || action == "pin" || action == "edit_settings") {
        return role == "owner" || role == "admin" || role == "moderator";
    }
    
    if (action == "send_message") {
        return true; // All members can send messages
    }
    
    return false;
}

bool MySQLClient::isRoomOwner(const std::string& roomId, const std::string& userId) {
    return getMemberRole(roomId, userId) == "owner";
}

// ============================================================================
// PIN MESSAGES
// ============================================================================

bool MySQLClient::pinMessage(const std::string& roomId, const std::string& messageId) {
    try {
        session_->sql(
            "INSERT INTO pinned_messages (room_id, message_id, pinned_by) VALUES (?, ?, 'system') "
            "ON DUPLICATE KEY UPDATE pinned_at = CURRENT_TIMESTAMP"
        ).bind(roomId, messageId).execute();
        
        Logger::info("Pinned message " + messageId + " in room " + roomId);
        return true;
    } catch (const std::exception& e) {
        handleException(e, "pinMessage");
        return false;
    }
}

bool MySQLClient::unpinMessage(const std::string& roomId, const std::string& messageId) {
    try {
        session_->sql(
            "DELETE FROM pinned_messages WHERE room_id = ? AND message_id = ?"
        ).bind(roomId, messageId).execute();
        
        Logger::info("Unpinned message " + messageId + " in room " + roomId);
        return true;
    } catch (const std::exception& e) {
        handleException(e, "unpinMessage");
        return false;
    }
}

std::vector<std::string> MySQLClient::getPinnedMessages(const std::string& roomId) {
    std::vector<std::string> pinnedIds;
    try {
        auto result = session_->sql(
            "SELECT message_id FROM pinned_messages WHERE room_id = ? ORDER BY pinned_at DESC"
        ).bind(roomId).execute();
        
        for (auto row : result) {
            pinnedIds.push_back(row[0].get<std::string>());
        }
        
        Logger::debug("Found " + std::to_string(pinnedIds.size()) + " pinned messages in room " + roomId);
    } catch (const std::exception& e) {
        handleException(e, "getPinnedMessages");
    }
    return pinnedIds;
}

// ============================================================================
// USER BLOCK/UNBLOCK
// ============================================================================

bool MySQLClient::blockUser(const std::string& userId, const std::string& blockedUserId) {
    try {
        session_->sql(
            "INSERT INTO blocked_users (user_id, blocked_user_id) VALUES (?, ?) "
            "ON DUPLICATE KEY UPDATE blocked_at = CURRENT_TIMESTAMP"
        ).bind(userId, blockedUserId).execute();
        
        Logger::info("User " + userId + " blocked " + blockedUserId);
        return true;
    } catch (const std::exception& e) {
        handleException(e, "blockUser");
        return false;
    }
}

bool MySQLClient::unblockUser(const std::string& userId, const std::string& blockedUserId) {
    try {
        session_->sql(
            "DELETE FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?"
        ).bind(userId, blockedUserId).execute();
        
        Logger::info("User " + userId + " unblocked " + blockedUserId);
        return true;
    } catch (const std::exception& e) {
        handleException(e, "unblockUser");
        return false;
    }
}

bool MySQLClient::isUserBlocked(const std::string& userId, const std::string& targetUserId) {
    try {
        auto result = session_->sql(
            "SELECT 1 FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?"
        ).bind(userId, targetUserId).execute();
        
        return result.count() > 0;
    } catch (const std::exception& e) {
        handleException(e, "isUserBlocked");
        return false;
    }
}

std::vector<std::string> MySQLClient::getBlockedUsers(const std::string& userId) {
    std::vector<std::string> blockedIds;
    try {
        auto result = session_->sql(
            "SELECT blocked_user_id FROM blocked_users WHERE user_id = ?"
        ).bind(userId).execute();
        
        for (auto row : result) {
            blockedIds.push_back(row[0].get<std::string>());
        }
        
        Logger::debug("User " + userId + " has " + std::to_string(blockedIds.size()) + " blocked users");
    } catch (const std::exception& e) {
        handleException(e, "getBlockedUsers");
    }
    return blockedIds;
}

// ============== Polls ==============

bool MySQLClient::createPoll(const Poll& poll) {
    try {
        // Insert poll
        session_->sql(
            "INSERT INTO polls (poll_id, room_id, question, created_by, created_at, is_closed) "
            "VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(poll.pollId, poll.roomId, poll.question, poll.createdBy, 
               static_cast<int64_t>(poll.createdAt), poll.isClosed ? 1 : 0).execute();
        
        // Insert options
        for (const auto& opt : poll.options) {
            session_->sql(
                "INSERT INTO poll_options (option_id, poll_id, option_text, option_index) "
                "VALUES (?, ?, ?, ?)"
            ).bind(opt.optionId, poll.pollId, opt.text, opt.index).execute();
        }
        
        Logger::info("Created poll: " + poll.pollId + " with " + std::to_string(poll.options.size()) + " options");
        return true;
    } catch (const std::exception& e) {
        handleException(e, "createPoll");
        return false;
    }
}

std::optional<Poll> MySQLClient::getPoll(const std::string& pollId) {
    try {
        auto pollResult = session_->sql(
            "SELECT poll_id, room_id, question, created_by, created_at, is_closed "
            "FROM polls WHERE poll_id = ?"
        ).bind(pollId).execute();
        
        auto row = pollResult.fetchOne();
        if (!row) {
            return std::nullopt;
        }
        
        Poll poll;
        poll.pollId = row[0].get<std::string>();
        poll.roomId = row[1].get<std::string>();
        poll.question = row[2].get<std::string>();
        poll.createdBy = row[3].get<std::string>();
        poll.createdAt = row[4].get<int64_t>();
        poll.isClosed = row[5].get<int64_t>() != 0;
        
        // Get options with vote counts
        auto optResult = session_->sql(
            "SELECT o.option_id, o.option_text, o.option_index, "
            "COUNT(v.user_id) as vote_count "
            "FROM poll_options o "
            "LEFT JOIN poll_votes v ON o.poll_id = v.poll_id AND o.option_id = v.option_id "
            "WHERE o.poll_id = ? "
            "GROUP BY o.option_id, o.option_text, o.option_index "
            "ORDER BY o.option_index"
        ).bind(pollId).execute();
        
        mysqlx::Row optRow;
        while ((optRow = optResult.fetchOne())) {
            PollOption opt;
            opt.optionId = optRow[0].get<std::string>();
            opt.text = optRow[1].get<std::string>();
            opt.index = static_cast<int>(optRow[2].get<int64_t>());
            opt.voteCount = static_cast<int>(optRow[3].get<int64_t>());
            
            // Get voters for this option
            auto voterResult = session_->sql(
                "SELECT user_id, username FROM poll_votes WHERE poll_id = ? AND option_id = ?"
            ).bind(pollId, opt.optionId).execute();
            
            mysqlx::Row voterRow;
            while ((voterRow = voterResult.fetchOne())) {
                opt.voterIds.push_back(voterRow[0].get<std::string>());
                opt.voterNames.push_back(voterRow[1].get<std::string>());
            }
            
            poll.options.push_back(opt);
        }
        
        return poll;
    } catch (const std::exception& e) {
        handleException(e, "getPoll");
        return std::nullopt;
    }
}

std::vector<Poll> MySQLClient::getRoomPolls(const std::string& roomId, bool activeOnly) {
    std::vector<Poll> polls;
    try {
        std::string sql = "SELECT poll_id FROM polls WHERE room_id = ?";
        if (activeOnly) {
            sql += " AND is_closed = 0";
        }
        sql += " ORDER BY created_at DESC";
        
        auto result = session_->sql(sql).bind(roomId).execute();
        
        mysqlx::Row row;
        while ((row = result.fetchOne())) {
            std::string pollId = row[0].get<std::string>();
            auto poll = getPoll(pollId);
            if (poll) {
                polls.push_back(*poll);
            }
        }
        
        Logger::debug("Found " + std::to_string(polls.size()) + " polls for room " + roomId);
    } catch (const std::exception& e) {
        handleException(e, "getRoomPolls");
    }
    return polls;
}

bool MySQLClient::votePoll(const PollVote& vote) {
    try {
        // Check if poll is closed
        auto pollResult = session_->sql(
            "SELECT is_closed FROM polls WHERE poll_id = ?"
        ).bind(vote.pollId).execute();
        
        auto row = pollResult.fetchOne();
        if (!row) {
            Logger::warning("Poll not found: " + vote.pollId);
            return false;
        }
        if (row[0].get<int64_t>() != 0) {
            Logger::warning("Cannot vote on closed poll: " + vote.pollId);
            return false;
        }
        
        // Use REPLACE to update vote if user already voted (changes their vote)
        session_->sql(
            "REPLACE INTO poll_votes (poll_id, option_id, user_id, username) "
            "VALUES (?, ?, ?, ?)"
        ).bind(vote.pollId, vote.optionId, vote.userId, vote.username).execute();
        
        Logger::info("User " + vote.username + " voted in poll " + vote.pollId);
        return true;
    } catch (const std::exception& e) {
        handleException(e, "votePoll");
        return false;
    }
}

bool MySQLClient::closePoll(const std::string& pollId) {
    try {
        auto result = session_->sql(
            "UPDATE polls SET is_closed = 1 WHERE poll_id = ?"
        ).bind(pollId).execute();
        
        Logger::info("Closed poll: " + pollId);
        return result.getAffectedItemsCount() > 0;
    } catch (const std::exception& e) {
        handleException(e, "closePoll");
        return false;
    }
}

bool MySQLClient::deletePoll(const std::string& pollId) {
    try {
        // CASCADE will delete options and votes
        auto result = session_->sql(
            "DELETE FROM polls WHERE poll_id = ?"
        ).bind(pollId).execute();
        
        Logger::info("Deleted poll: " + pollId);
        return result.getAffectedItemsCount() > 0;
    } catch (const std::exception& e) {
        handleException(e, "deletePoll");
        return false;
    }
}

// DM Conversations - Discord/Telegram style
// Returns existing conversation_id or creates a new one
std::string MySQLClient::getOrCreateDmConversation(const std::string& userId1, const std::string& userId2) {
    try {
        // Sort user IDs for consistency (user1_id < user2_id)
        std::string smallerId = userId1 < userId2 ? userId1 : userId2;
        std::string largerId = userId1 < userId2 ? userId2 : userId1;
        
        Logger::info("🔍 getOrCreateDmConversation: " + smallerId + " <-> " + largerId);
        
        // First, try to find existing conversation
        auto result = session_->sql(
            "SELECT conversation_id FROM dm_conversations WHERE user1_id = ? AND user2_id = ?"
        ).bind(smallerId).bind(largerId).execute();
        
        auto row = result.fetchOne();
        if (row) {
            std::string existingId = row[0].get<std::string>();
            Logger::info("✓ Found existing DM conversation: " + existingId);
            return existingId;
        }
        
        // No existing conversation, create new one
        // Generate conversation_id using hash (like Discord snowflake but simpler)
        std::hash<std::string> hasher;
        size_t hash1 = hasher(smallerId + "_" + largerId);
        size_t hash2 = hasher(largerId + "_" + smallerId + "_" + std::to_string(std::time(nullptr)));
        
        std::stringstream ss;
        ss << "dm_" << std::hex << std::setfill('0') << std::setw(8) << (hash1 & 0xFFFFFFFF);
        ss << std::setw(8) << (hash2 & 0xFFFFFFFF);
        std::string newConversationId = ss.str();  // dm_ + 16 hex chars = 19 chars
        
        // Insert new conversation
        session_->sql(
            "INSERT INTO dm_conversations (conversation_id, user1_id, user2_id) VALUES (?, ?, ?)"
        ).bind(newConversationId).bind(smallerId).bind(largerId).execute();
        
        Logger::info("✓ Created new DM conversation: " + newConversationId);
        return newConversationId;
        
    } catch (const std::exception& e) {
        // Table might not exist yet, fall back to hash-based ID
        Logger::warning("DM conversation table not ready, using hash fallback: " + std::string(e.what()));
        
        std::string smallerId = userId1 < userId2 ? userId1 : userId2;
        std::string largerId = userId1 < userId2 ? userId2 : userId1;
        
        std::hash<std::string> hasher;
        size_t hash1 = hasher(smallerId + "_" + largerId);
        size_t hash2 = hasher(largerId + "_" + smallerId);
        
        std::stringstream ss;
        ss << "dm_" << std::hex << std::setfill('0') << std::setw(8) << (hash1 & 0xFFFFFFFF);
        ss << std::setw(8) << (hash2 & 0xFFFFFFFF);
        return ss.str();
    }
}

void MySQLClient::handleException(const std::exception& e, const std::string& context) {
    Logger::error("MySQL error in " + context + ": " + std::string(e.what()));
}
