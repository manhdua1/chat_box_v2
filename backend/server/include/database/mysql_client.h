#pragma once

#include <string>
#include <optional>
#include <vector>
#include <memory>
#include <mysqlx/xdevapi.h>  // Full include needed for templates
#include "types.h"

class MySQLClient {
public:
    MySQLClient(const std::string& host,
                const std::string& user,
                const std::string& password,
                const std::string& database,
                int port = 33060);  // mysqlx port
    bool connect();
    void disconnect();
    bool isConnected() const;
    
    // Users
    bool createUser(const User& user);
    std::optional<User> getUser(const std::string& username);
    std::optional<User> getUserById(const std::string& userId);
    std::vector<User> getAllUsers();
    bool updateUserStatus(const std::string& userId, int status);
    bool updateUserAvatar(const std::string& userId, const std::string& avatarUrl);
    bool deleteUser(const std::string& userId);
    
    // Sessions
    bool createSession(const UserSession& UserSession);
    std::optional<UserSession> getSession(const std::string& sessionId);
    std::vector<UserSession> getUserSessions(const std::string& userId);
    bool updateSessionHeartbeat(const std::string& sessionId, uint64_t timestamp);
    bool deleteSession(const std::string& sessionId);
    
    // Messages
    bool createMessage(const Message& message);
    std::optional<Message> getMessage(const std::string& messageId);
    std::vector<Message> getMessagesByRoom(const std::string& roomId, int limit = 50);
    std::vector<Message> getRecentMessages(const std::string& roomId, int limit = 50, int offset = 0);
    std::vector<Message> getMessageReplies(const std::string& messageId, int limit = 50);
    std::vector<Message> searchMessages(const std::string& query, const std::string& roomId = "", int limit = 50);
    bool deleteMessage(const std::string& messageId);
    
    // Rooms
    bool createRoom(const Room& room);
    std::optional<Room> getRoom(const std::string& roomId);
    bool updateRoom(const Room& room);
    bool deleteRoom(const std::string& roomId);
    bool addRoomMember(const std::string& roomId, const std::string& userId);
    bool removeRoomMember(const std::string& roomId, const std::string& userId);
    std::vector<std::string> getRoomMembers(const std::string& roomId);
    
    // Room Roles & Permissions
    bool setMemberRole(const std::string& roomId, const std::string& userId, const std::string& role);
    std::string getMemberRole(const std::string& roomId, const std::string& userId);
    bool hasMemberPermission(const std::string& roomId, const std::string& userId, const std::string& action);
    bool isRoomOwner(const std::string& roomId, const std::string& userId);
    
    // Pin Messages
    bool pinMessage(const std::string& roomId, const std::string& messageId);
    bool unpinMessage(const std::string& roomId, const std::string& messageId);
    std::vector<std::string> getPinnedMessages(const std::string& roomId);
    
    // User Block/Unblock
    bool blockUser(const std::string& userId, const std::string& blockedUserId);
    bool unblockUser(const std::string& userId, const std::string& blockedUserId);
    bool isUserBlocked(const std::string& userId, const std::string& targetUserId);
    std::vector<std::string> getBlockedUsers(const std::string& userId);
    
    // Files (metadata only)
    bool createFile(const FileInfo& file);
    std::optional<FileInfo> getFile(const std::string& fileId);
    std::vector<FileInfo> getRoomFiles(const std::string& roomId);
    bool deleteFile(const std::string& fileId);
    
    // Polls
    bool createPoll(const Poll& poll);
    std::optional<Poll> getPoll(const std::string& pollId);
    std::vector<Poll> getRoomPolls(const std::string& roomId, bool activeOnly = false);
    bool votePoll(const PollVote& vote);
    bool closePoll(const std::string& pollId);
    bool deletePoll(const std::string& pollId);
    
    // DM Conversations (Discord/Telegram style)
    // Returns existing conversation_id or creates a new one
    std::string getOrCreateDmConversation(const std::string& userId1, const std::string& userId2);
    
    // Direct session access for custom queries
    std::shared_ptr<mysqlx::Session> getSession() { return session_; }
    
private:
    std::string host_;
    std::string user_;
    std::string password_;
    std::string database_;
    int port_;
    
    std::shared_ptr<mysqlx::Session> session_;
    
    void handleException(const std::exception& e, const std::string& context);
};
