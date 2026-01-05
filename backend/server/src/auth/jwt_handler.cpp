#include "auth/jwt_handler.h"
#include "utils/logger.h"
#include <jwt-cpp/jwt.h>
#include <jwt-cpp/traits/nlohmann-json/traits.h>
#include <chrono>

// Real JWT implementation using jwt-cpp library

std::string JWTHandler::create(const std::map<std::string, std::string>& claims,
                                const std::string& secret) {
    try {
        auto now = std::chrono::system_clock::now();
        
        auto builder = jwt::create<jwt::traits::nlohmann_json>()
            .set_issuer("chatbox")
            .set_type("JWT");
        
        // Add claims
        for (const auto& [key, value] : claims) {
            if (key == "sub") {
                builder.set_subject(value);
            } else if (key == "exp") {
                auto exp_time = std::chrono::system_clock::from_time_t(std::stoll(value));
                builder.set_expires_at(exp_time);
            } else if (key == "iat") {
                auto iat_time = std::chrono::system_clock::from_time_t(std::stoll(value));
                builder.set_issued_at(iat_time);
            } else {
                // Custom string claims
                builder.set_payload_claim(key, jwt::basic_claim<jwt::traits::nlohmann_json>(value));
            }
        }
        
        // Sign with HS256
        return builder.sign(jwt::algorithm::hs256{secret});
        
    } catch (const std::exception& e) {
        Logger::error("JWT create error: " + std::string(e.what()));
        return "";
    }
}

bool JWTHandler::verify(const std::string& token, const std::string& secret) {
    try {
        auto verifier = jwt::verify<jwt::traits::nlohmann_json>()
            .allow_algorithm(jwt::algorithm::hs256{secret})
            .with_issuer("chatbox");
        
        auto decoded = jwt::decode<jwt::traits::nlohmann_json>(token);
        verifier.verify(decoded);
        
        // Check expiration
        if (decoded.has_expires_at()) {
            auto exp = decoded.get_expires_at();
            auto now = std::chrono::system_clock::now();
            if (exp < now) {
                return false;  // Expired
            }
        }
        
        return true;
        
    } catch (const std::exception&) {
        return false;
    }
}

std::map<std::string, std::string> JWTHandler::decode(const std::string& token,
                                                       const std::string& secret) {
    std::map<std::string, std::string> claims;
    
    if (!verify(token, secret)) {
        return claims;  // Empty if invalid
    }
    
    try {
        auto decoded = jwt::decode<jwt::traits::nlohmann_json>(token);
        
        // Get standard claims
        if (decoded.has_subject()) {
            claims["sub"] = decoded.get_subject();
        }
        if (decoded.has_issued_at()) {
            claims["iat"] = std::to_string(std::chrono::system_clock::to_time_t(decoded.get_issued_at()));
        }
        if (decoded.has_expires_at()) {
            claims["exp"] = std::to_string(std::chrono::system_clock::to_time_t(decoded.get_expires_at()));
        }
        
        // Get custom payload claims
        if (decoded.has_payload_claim("username")) {
            claims["username"] = decoded.get_payload_claim("username").as_string();
        }
        if (decoded.has_payload_claim("sid")) {
            claims["sid"] = decoded.get_payload_claim("sid").as_string();
        }
        
    } catch (const std::exception& e) {
        Logger::error("JWT decode error: " + std::string(e.what()));
        claims.clear();
    }
    
    return claims;
}

std::string JWTHandler::base64Encode(const std::string& input) {
    return jwt::base::encode<jwt::alphabet::base64url>(input);
}

std::string JWTHandler::base64Decode(const std::string& input) {
    return jwt::base::decode<jwt::alphabet::base64url>(input);
}

std::string JWTHandler::hmacSha256(const std::string& data, const std::string& key) {
    // Not needed - jwt-cpp handles this internally
    return "";
}
