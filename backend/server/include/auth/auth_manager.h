#ifndef AUTH_MANAGER_H
#define AUTH_MANAGER_H

#include <string>
#include <memory>
#include <optional>
#include "../database/mysql_client.h"

struct UserRegistration {
    std::string username;
    std::string password;
    std::string email;
};

struct LoginResult {
    bool success;
    std::string token;
    std::string userId;
    std::string errorMessage;
};

struct SessionInfo {
    std::string sessionId;
    std::string userId;
    std::string username;
    uint64_t expiresAt;
};

class AuthManager {
public:
    AuthManager(std::shared_ptr<MySQLClient> db,
                const std::string& jwtSecret,
                int jwtExpirySeconds = 86400);
    
    // Registration
    bool registerUser(const UserRegistration& reg);
    
    // Login/Logout
    LoginResult login(const std::string& username, const std::string& password);
    void logout(const std::string& sessionId);
    
    // Token validation
    bool validateToken(const std::string& token);
    std::optional<SessionInfo> getSessionFromToken(const std::string& token);
    
    // UserSession management
    bool createSession(const std::string& userId, const std::string& username);
    void updateSessionHeartbeat(const std::string& sessionId);
    bool updateAvatar(const std::string& userId, const std::string& avatarUrl);
    
    /**
     * Change password for a user
     * @return empty string on success, error message on failure
     */
    std::string changePassword(const std::string& userId, 
                               const std::string& currentPassword, 
                               const std::string& newPassword);

    /**
     * Clean up expired sessions (periodic task)
     */
    void cleanupExpiredSessions();

    /**
     * Get database for direct access (e.g., saving messages)
     */
    std::shared_ptr<MySQLClient> getDatabase() { return db_; }
    
private:
    std::shared_ptr<MySQLClient> db_;
    std::string jwtSecret_;
    int jwtExpiry_;
    
    std::string hashPassword(const std::string& password);
    bool verifyPassword(const std::string& password, const std::string& hash);
    std::string generateToken(const std::string& userId, const std::string& username);
    std::string generateSessionId();
};

#endif // AUTH_MANAGER_H
