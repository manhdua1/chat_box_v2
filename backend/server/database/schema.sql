-- ChatBox Database Schema
-- MySQL 8.0+

-- Users table
CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status ENUM('online', 'offline', 'away', 'busy') DEFAULT 'offline',
    status_message VARCHAR(255) DEFAULT '',
    avatar_url VARCHAR(500) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_email (email)
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    session_id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    username VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_expires (expires_at)
);

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
    room_id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    room_type ENUM('public', 'private', 'dm') DEFAULT 'public',
    creator_id VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_creator (creator_id),
    INDEX idx_type (room_type)
);

-- Room members table
CREATE TABLE IF NOT EXISTS room_members (
    room_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    role ENUM('owner', 'admin', 'moderator', 'member') DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (room_id, user_id),
    FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE,
    INDEX idx_user (user_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    message_id VARCHAR(64) PRIMARY KEY,
    room_id VARCHAR(64) NOT NULL,
    sender_id VARCHAR(64) NOT NULL,
    sender_name VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    message_type INT DEFAULT 0,
    reply_to_id VARCHAR(64) DEFAULT NULL,
    metadata JSON DEFAULT NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP NULL,
    edited_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_room (room_id),
    INDEX idx_sender (sender_id),
    INDEX idx_created (created_at DESC)
);

-- Files table
CREATE TABLE IF NOT EXISTS files (
    file_id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    room_id VARCHAR(64) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_room (room_id),
    INDEX idx_user (user_id)
);

-- Pinned messages table
CREATE TABLE IF NOT EXISTS pinned_messages (
    room_id VARCHAR(64) NOT NULL,
    message_id VARCHAR(64) NOT NULL,
    pinned_by VARCHAR(64) NOT NULL,
    pinned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (room_id, message_id)
);

-- Blocked users table
CREATE TABLE IF NOT EXISTS blocked_users (
    user_id VARCHAR(64) NOT NULL,
    blocked_user_id VARCHAR(64) NOT NULL,
    blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, blocked_user_id)
);

-- Polls table
CREATE TABLE IF NOT EXISTS polls (
    poll_id VARCHAR(64) PRIMARY KEY,
    room_id VARCHAR(64) NOT NULL,
    question TEXT NOT NULL,
    created_by VARCHAR(64) NOT NULL,
    created_at BIGINT UNSIGNED NOT NULL,
    is_closed BOOLEAN DEFAULT FALSE,
    INDEX idx_room (room_id),
    INDEX idx_active (room_id, is_closed)
);

-- Poll options table
CREATE TABLE IF NOT EXISTS poll_options (
    option_id VARCHAR(64) PRIMARY KEY,
    poll_id VARCHAR(64) NOT NULL,
    option_text TEXT NOT NULL,
    option_index INT NOT NULL,
    FOREIGN KEY (poll_id) REFERENCES polls(poll_id) ON DELETE CASCADE,
    INDEX idx_poll (poll_id)
);

-- Poll votes table
CREATE TABLE IF NOT EXISTS poll_votes (
    poll_id VARCHAR(64),
    option_id VARCHAR(64),
    user_id VARCHAR(64) NOT NULL,
    username VARCHAR(50) NOT NULL,
    voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (poll_id, user_id),
    FOREIGN KEY (poll_id) REFERENCES polls(poll_id) ON DELETE CASCADE,
    FOREIGN KEY (option_id) REFERENCES poll_options(option_id) ON DELETE CASCADE,
    INDEX idx_option (option_id)
);
