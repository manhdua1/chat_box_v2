#include <iostream>
#include <memory>
#include <thread>
#include <chrono>
#include <signal.h>
#include "config/config_loader.h"
#include "websocket/websocket_server.h"  // Re-enabled!
#include "auth/auth_manager.h"
#include "ai/gemini_client.h"
#include "pubsub/pubsub_broker.h"
#include "database/mysql_client.h"
#include "utils/logger.h"

using namespace std;

// Global flag for graceful shutdown
volatile sig_atomic_t g_running = 1;

void signalHandler(int signum) {
    Logger::info("Received signal " + to_string(signum) + ", shutting down...");
    g_running = 0;
}

int main(int argc, char* argv[]) {
    try {
        // Setup signal handlers
        signal(SIGINT, signalHandler);
        signal(SIGTERM, signalHandler);
        
        Logger::info("=== ChatBox Server Starting ===");
        
        // Load configuration
        Logger::info("Loading configuration...");
        Config config = ConfigLoader::load("../../config/.env");
        
        // Initialize MySQL client
        Logger::info("Initializing MySQL database...");
        Logger::info("DB Config: " + config.mysqlHost + ":" + to_string(config.mysqlPort));
        auto mysqlClient = make_shared<MySQLClient>(
            config.mysqlHost,
            config.mysqlUser,
            config.mysqlPassword,
            config.mysqlDatabase,
            config.mysqlPort
        );
        
        if (!mysqlClient->connect()) {
            Logger::error("Failed to connect to MySQL database");
            return 1;
        }
        Logger::info("✓ MySQL database connected");
        
        Logger::info("Initializing Auth Manager...");
        auto authManager = make_shared<AuthManager>(
            mysqlClient,
            config.jwtSecret,
            config.jwtExpiry
        );
        
        Logger::info("Initializing Pub/Sub Broker...");
        auto pubsubBroker = make_shared<PubSubBroker>();
        
        // Initialize Gemini AI client (if API key is available)
        shared_ptr<GeminiClient> geminiClient = nullptr;
        if (!config.geminiApiKey.empty() && config.geminiApiKey != "your_gemini_api_key_here") {
            Logger::info("Initializing Gemini AI client...");
            Logger::info("API Key (first 10 chars): " + config.geminiApiKey.substr(0, 10) + "...");
            geminiClient = make_shared<GeminiClient>(config.geminiApiKey);
            Logger::info("✓ Gemini AI client initialized");
        } else {
            Logger::warning("⚠️ Gemini API key not configured - AI chatbot disabled");
        }
        
        // Create WebSocket server
        Logger::info("Starting WebSocket server on port " + to_string(config.serverPort) + "...");
        WebSocketServer server(config.serverPort, pubsubBroker, authManager, geminiClient);
        
        Logger::info("=== ChatBox Server Started Successfully! ===");
        Logger::info("Server IP: " + config.serverIP);
        Logger::info("Port: " + to_string(config.serverPort));
        Logger::info("WebSocket: ws://" + config.serverIP + ":" + to_string(config.serverPort));
        Logger::info("");
        Logger::info("✅ FULL WEBSOCKET SERVER RUNNING!");
        Logger::info("✅ MySQL Database Connected");
        Logger::info("");
        Logger::info("Press Ctrl+C to stop...");
        
        // Run server (blocking)
        server.run();
        
        Logger::info("=== ChatBox Server Stopped ===");
        return 0;
        
    } catch (const exception& e) {
        Logger::error("Fatal error: " + string(e.what()));
        return 1;
    }
}
