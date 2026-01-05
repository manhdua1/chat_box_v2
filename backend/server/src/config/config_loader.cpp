#include "config/config_loader.h"
#include <fstream>
#include <sstream>
#include <stdexcept>
#include <algorithm>
#include <cstdlib>  // for getenv

Config ConfigLoader::load(const std::string& envFile) {
    auto env = parseEnvFile(envFile);
    
    Config config;
    
    // MySQL Configuration
    config.mysqlHost = getEnv(env, "MYSQL_HOST", "localhost");
    config.mysqlPort = getEnvInt(env, "MYSQL_PORT", 3306);
    config.mysqlUser = getEnv(env, "MYSQL_USER", "chatbox");
    config.mysqlPassword = getEnv(env, "MYSQL_PASSWORD");
    config.mysqlDatabase = getEnv(env, "MYSQL_DATABASE", "chatbox_db");
    
    // AWS Configuration (optional)
    config.awsAccessKey = getEnv(env, "AWS_ACCESS_KEY_ID");
    config.awsSecretKey = getEnv(env, "AWS_SECRET_ACCESS_KEY");
    config.awsRegion = getEnv(env, "AWS_REGION", "ap-southeast-1");
    config.s3Bucket = getEnv(env, "S3_BUCKET");
    
    // Server Configuration
    config.serverIP = getEnv(env, "SERVER_IP", "0.0.0.0");
    config.serverPort = getEnvInt(env, "SERVER_PORT", 8080);
    config.serverHost = getEnv(env, "SERVER_HOST", "0.0.0.0");
    
    // JWT Configuration
    config.jwtSecret = getEnv(env, "JWT_SECRET");
    config.jwtExpiry = getEnvInt(env, "JWT_EXPIRY", 86400);  // 24 hours default
    
    // Gemini AI
    config.geminiApiKey = getEnv(env, "GEMINI_API_KEY");
    
    // Debug
    config.debug = getEnvBool(env, "DEBUG", false);
    config.logLevel = getEnv(env, "LOG_LEVEL", "info");
    
    // Validation - only require JWT secret now
    if (config.jwtSecret.empty()) {
        throw std::runtime_error("JWT_SECRET not set");
    }
    
    return config;
}

std::map<std::string, std::string> ConfigLoader::parseEnvFile(const std::string& filename) {
    std::map<std::string, std::string> env;
    
    // Try to read from file if it exists
    std::ifstream file(filename);
    if (file.is_open()) {
        std::string line;
        while (std::getline(file, line)) {
            // Skip empty lines and comments
            if (line.empty() || line[0] == '#') {
                continue;
            }
            
            // Find '=' separator
            size_t pos = line.find('=');
            if (pos == std::string::npos) {
                continue;
            }
            
            std::string key = line.substr(0, pos);
            std::string value = line.substr(pos + 1);
            
            // Trim whitespace
            key.erase(0, key.find_first_not_of(" \t\r\n"));
            key.erase(key.find_last_not_of(" \t\r\n") + 1);
            value.erase(0, value.find_first_not_of(" \t\r\n"));
            value.erase(value.find_last_not_of(" \t\r\n") + 1);
            
            env[key] = value;
        }
    }
    
    // Override with environment variables if they exist
    const char* envVars[] = {
        "MYSQL_HOST", "MYSQL_PORT", "MYSQL_USER", "MYSQL_PASSWORD", "MYSQL_DATABASE",
        "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION", "S3_BUCKET",
        "SERVER_IP", "SERVER_PORT", "SERVER_HOST", "WS_PORT",
        "JWT_SECRET", "JWT_EXPIRY",
        "GEMINI_API_KEY",
        "DEBUG", "LOG_LEVEL"
    };
    
    for (const char* varName : envVars) {
        const char* value = std::getenv(varName);
        if (value != nullptr && value[0] != '\0') {
            env[varName] = value;
        }
    }
    
    return env;
}

std::string ConfigLoader::getEnv(const std::map<std::string, std::string>& env,
                                 const std::string& key,
                                 const std::string& defaultValue) {
    auto it = env.find(key);
    return (it != env.end()) ? it->second : defaultValue;
}

int ConfigLoader::getEnvInt(const std::map<std::string, std::string>& env,
                           const std::string& key,
                           int defaultValue) {
    auto it = env.find(key);
    if (it == env.end()) {
        return defaultValue;
    }
    try {
        return std::stoi(it->second);
    } catch (...) {
        return defaultValue;
    }
}

bool ConfigLoader::getEnvBool(const std::map<std::string, std::string>& env,
                             const std::string& key,
                             bool defaultValue) {
    auto it = env.find(key);
    if (it == env.end()) {
        return defaultValue;
    }
    std::string value = it->second;
    std::transform(value.begin(), value.end(), value.begin(), ::tolower);
    return (value == "true" || value == "1" || value == "yes");
}
