#include "ai/gemini_client.h"
#include "utils/logger.h"
#include <curl/curl.h>
#include <nlohmann/json.hpp>
#include <sstream>

using json = nlohmann::json;

// Callback for CURL to write response
static size_t WriteCallback(void* contents, size_t size, size_t nmemb, std::string* output) {
    size_t totalSize = size * nmemb;
    output->append(static_cast<char*>(contents), totalSize);
    return totalSize;
}

GeminiClient::GeminiClient(const std::string& apiKey)
    : apiKey_(apiKey)
    , apiEndpoint_("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent") {
    Logger::info("Gemini AI client initialized");
}

GeminiClient::~GeminiClient() {
    Logger::info("Gemini AI client destroyed");
}

// ============================================================================
// SEND MESSAGE
// ============================================================================

std::optional<std::string> GeminiClient::sendMessage(const std::string& message,
                                                      const std::vector<std::string>& conversationHistory) {
    try {
        std::string payload = buildPayload(message, conversationHistory);
        return makeRequest(payload);
        
    } catch (const std::exception& e) {
        Logger::error("Gemini sendMessage error: " + std::string(e.what()));
        return std::nullopt;
    }
}

// ============================================================================
// GENERATE RESPONSE
// ============================================================================

std::optional<std::string> GeminiClient::generateResponse(const std::string& prompt,
                                                          const std::string& message) {
    try {
        std::string combinedMessage = prompt + "\n\nUser: " + message;
        return sendMessage(combinedMessage);
        
    } catch (const std::exception& e) {
        Logger::error("Gemini generateResponse error: " + std::string(e.what()));
        return std::nullopt;
    }
}

// ============================================================================
// MAKE REQUEST
// ============================================================================

std::optional<std::string> GeminiClient::makeRequest(const std::string& jsonPayload) {
    CURL* curl = curl_easy_init();
    if (!curl) {
        Logger::error("Failed to initialize CURL");
        return std::nullopt;
    }
    
    std::string responseData;
    std::string url = apiEndpoint_ + "?key=" + apiKey_;
    
    // Debug log
    Logger::info("Gemini URL: " + apiEndpoint_);
    Logger::info("Gemini Payload: " + jsonPayload.substr(0, 200));
    
    // Set CURL options
    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_POST, 1L);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, jsonPayload.c_str());
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &responseData);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 30L);  // 30 second timeout
    
    // Set headers
    struct curl_slist* headers = NULL;
    headers = curl_slist_append(headers, "Content-Type: application/json");
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    
    // Perform request
    CURLcode res = curl_easy_perform(curl);
    
    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);
    
    if (res != CURLE_OK) {
        Logger::error("CURL error: " + std::string(curl_easy_strerror(res)));
        return std::nullopt;
    }
    
    // Debug: Log the raw response
    Logger::info("Gemini API response: " + responseData.substr(0, 500));
    
    // Parse response
    try {
        auto jsonResponse = json::parse(responseData);
        
        if (jsonResponse.contains("candidates") && 
            jsonResponse["candidates"].is_array() &&
            !jsonResponse["candidates"].empty()) {
            
            auto candidate = jsonResponse["candidates"][0];
            if (candidate.contains("content") &&
                candidate["content"].contains("parts") &&
                candidate["content"]["parts"].is_array() &&
                !candidate["content"]["parts"].empty()) {
                
                std::string text = candidate["content"]["parts"][0]["text"];
                Logger::debug("Gemini response received (" + std::to_string(text.length()) + " chars)");
                return text;
            }
        }
        
        Logger::error("Unexpected Gemini response format");
        Logger::error("Response JSON: " + responseData.substr(0, 1000));
        return std::nullopt;
        
    } catch (const std::exception& e) {
        Logger::error("Failed to parse Gemini response: " + std::string(e.what()));
        Logger::error("Response was: " + responseData.substr(0, 500));
        return std::nullopt;
    }
}

// ============================================================================
// BUILD PAYLOAD
// ============================================================================

std::string GeminiClient::buildPayload(const std::string& message,
                                       const std::vector<std::string>& history) {
    json payload;
    json contents = json::array();
    
    // Add conversation history
    for (const auto& msg : history) {
        json part;
        part["parts"] = json::array({
            {{"text", msg}}
        });
        contents.push_back(part);
    }
    
    // Add current message
    json currentMessage;
    currentMessage["parts"] = json::array({
        {{"text", message}}
    });
    contents.push_back(currentMessage);
    
    payload["contents"] = contents;
    
    return payload.dump();
}


