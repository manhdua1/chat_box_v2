#include "storage/file_storage.h"
#include "utils/logger.h"
#include <fstream>
#include <sstream>
#include <iomanip>
#include <chrono>
#include <random>

FileStorage::FileStorage(const std::string& uploadDir, MySQLClient& dbClient)
    : uploadDir_(uploadDir), dbClient_(dbClient) {
    
    // Create upload directory if it doesn't exist
    if (!std::filesystem::exists(uploadDir_)) {
        std::filesystem::create_directories(uploadDir_);
        Logger::info("Created upload directory: " + uploadDir);
    }
}

std::optional<UploadedFile> FileStorage::saveFile(
    const std::string& userId,
    const std::string& roomId,
    const std::string& filename,
    const std::vector<char>& data,
    const std::string& mimeType) {
    
    try {
        // Check file size
        if (data.size() > MAX_FILE_SIZE) {
            Logger::error("File too large: " + std::to_string(data.size()) + " bytes");
            return std::nullopt;
        }
        
        // Check user quota
        if (!checkUserQuota(userId, data.size())) {
            Logger::error("User quota exceeded for: " + userId);
            return std::nullopt;
        }
        
        // Generate file ID and path
        std::string fileId = generateFileId();
        std::string datePath = getDatePath();
        std::string extension = getExtension(filename);
        std::string relativePath = datePath + "/" + fileId + extension;
        std::filesystem::path fullPath = uploadDir_ / relativePath;
        
        // Create date directories
        std::filesystem::create_directories(fullPath.parent_path());
        
        // Write file to disk
        std::ofstream file(fullPath, std::ios::binary);
        if (!file) {
            Logger::error("Failed to create file: " + fullPath.string());
            return std::nullopt;
        }
        
        file.write(data.data(), data.size());
        file.close();
        
        // Save metadata to MySQL
        FileInfo fileInfo;
        fileInfo.fileId = fileId;
        fileInfo.userId = userId;
        fileInfo.roomId = roomId;
        fileInfo.filename = filename;
        fileInfo.s3Key = relativePath;  // Reuse s3Key for stored path
        fileInfo.fileSize = data.size();
        fileInfo.mimeType = mimeType;
        
        if (!dbClient_.createFile(fileInfo)) {
            // Database save failed, delete file from disk
            std::filesystem::remove(fullPath);
            Logger::error("Failed to save file metadata to database");
            return std::nullopt;
        }
        
        Logger::info("File saved: " + fileId + " (" + std::to_string(data.size()) + " bytes)");
        
        return UploadedFile{
            fileId,
            "/files/" + fileId,
            relativePath,
            data.size()
        };
        
    } catch (const std::exception& e) {
        Logger::error("File save exception: " + std::string(e.what()));
        return std::nullopt;
    }
}

std::optional<std::vector<char>> FileStorage::getFile(const std::string& fileId) {
    try {
        // Get file metadata from database
        auto fileInfo = dbClient_.getFile(fileId);
        if (!fileInfo) {
            Logger::warning("File not found in database: " + fileId);
            return std::nullopt;
        }
        
        // Read file from disk
        std::filesystem::path fullPath = uploadDir_ / fileInfo->s3Key;
        
        if (!std::filesystem::exists(fullPath)) {
            Logger::error("File not found on disk: " + fullPath.string());
            return std::nullopt;
        }
        
        std::ifstream file(fullPath, std::ios::binary);
        if (!file) {
            Logger::error("Failed to open file: " + fullPath.string());
            return std::nullopt;
        }
        
        // Read file data
        std::vector<char> data(
            (std::istreambuf_iterator<char>(file)),
            std::istreambuf_iterator<char>()
        );
        
        Logger::debug("File retrieved: " + fileId + " (" + std::to_string(data.size()) + " bytes)");
        
        return data;
        
    } catch (const std::exception& e) {
        Logger::error("File get exception: " + std::string(e.what()));
        return std::nullopt;
    }
}

std::optional<FileInfo> FileStorage::getFileInfo(const std::string& fileId) {
    return dbClient_.getFile(fileId);
}

bool FileStorage::deleteFile(const std::string& fileId) {
    try {
        // Get file info
        auto fileInfo = dbClient_.getFile(fileId);
        if (!fileInfo) {
            return false;
        }
        
        // Delete from filesystem
        std::filesystem::path fullPath = uploadDir_ / fileInfo->s3Key;
        if (std::filesystem::exists(fullPath)) {
            std::filesystem::remove(fullPath);
        }
        
        // Delete from database
        return dbClient_.deleteFile(fileId);
        
    } catch (const std::exception& e) {
        Logger::error("File delete exception: " + std::string(e.what()));
        return false;
    }
}

size_t FileStorage::getUserStorageUsed(const std::string& userId) {
    // This would require a custom SQL query to sum file sizes
    // For now, return 0 (implement later if needed)
    return 0;
}

bool FileStorage::checkUserQuota(const std::string& userId, size_t fileSize) {
    size_t used = getUserStorageUsed(userId);
    return (used + fileSize) <= USER_QUOTA;
}

void FileStorage::cleanupOldFiles(int daysOld) {
    try {
        // Get files older than daysOld
        auto session = dbClient_.getSession();
        if (!session) {
            Logger::warning("No database session for file cleanup");
            return;
        }
        
        auto now = std::chrono::system_clock::now();
        auto cutoffTime = now - std::chrono::hours(24 * daysOld);
        uint64_t cutoffTimestamp = std::chrono::duration_cast<std::chrono::seconds>(
            cutoffTime.time_since_epoch()
        ).count();
        
        // Query old files
        auto result = session->sql(
            "SELECT file_id, file_path FROM files WHERE uploaded_at < ? AND is_temp = 1"
        ).bind(cutoffTimestamp).execute();
        
        int deletedCount = 0;
        mysqlx::Row row;
        while ((row = result.fetchOne())) {
            std::string fileId = row[0].get<std::string>();
            std::string filePath = row[1].get<std::string>();
            
            // Delete from filesystem
            std::filesystem::path fullPath = uploadDir_ / filePath;
            if (std::filesystem::exists(fullPath)) {
                std::filesystem::remove(fullPath);
            }
            
            // Delete from database
            dbClient_.deleteFile(fileId);
            deletedCount++;
        }
        
        if (deletedCount > 0) {
            Logger::info("🧹 Cleaned up " + std::to_string(deletedCount) + " old temp files");
        }
        
        // Also cleanup empty directories
        try {
            for (const auto& entry : std::filesystem::recursive_directory_iterator(uploadDir_)) {
                if (entry.is_directory() && std::filesystem::is_empty(entry.path())) {
                    std::filesystem::remove(entry.path());
                }
            }
        } catch (const std::exception& e) {
            Logger::warning("Directory cleanup: " + std::string(e.what()));
        }
        
    } catch (const std::exception& e) {
        Logger::error("File cleanup error: " + std::string(e.what()));
    }
}

std::string FileStorage::generateFileId() {
    // Generate UUID-like ID
    static std::random_device rd;
    static std::mt19937_64 gen(rd());
    static std::uniform_int_distribution<uint64_t> dis;
    
    uint64_t id1 = dis(gen);
    uint64_t id2 = dis(gen);
    
    std::stringstream ss;
    ss << std::hex << std::setfill('0') << std::setw(16) << id1
       << std::setw(16) << id2;
    
    return ss.str();
}

std::string FileStorage::getDatePath() {
    auto now = std::chrono::system_clock::now();
    auto time = std::chrono::system_clock::to_time_t(now);
    std::tm tm = *std::localtime(&time);
    
    std::stringstream ss;
    ss << std::setfill('0')
       << std::setw(4) << (tm.tm_year + 1900) << "/"
       << std::setw(2) << (tm.tm_mon + 1) << "/"
       << std::setw(2) << tm.tm_mday;
    
    return ss.str();
}

std::string FileStorage::getExtension(const std::string& filename) {
    size_t dotPos = filename.find_last_of('.');
    if (dotPos != std::string::npos) {
        return filename.substr(dotPos);
    }
    return "";
}

std::string FileStorage::getMimeType(const std::string& filename) {
    std::string ext = getExtension(filename);
    
    // Basic mime type mapping
    if (ext == ".jpg" || ext == ".jpeg") return "image/jpeg";
    if (ext == ".png") return "image/png";
    if (ext == ".gif") return "image/gif";
    if (ext == ".pdf") return "application/pdf";
    if (ext == ".txt") return "text/plain";
    if (ext == ".json") return "application/json";
    
    return "application/octet-stream";
}
