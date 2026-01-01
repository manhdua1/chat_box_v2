-- Migration: Add rooms tables
-- Date: 2025-12-18
-- Description: Create tables for multiple chat rooms support

-- Create rooms table
CREATE TABLE IF NOT EXISTS rooms (
    room_id VARCHAR(255) PRIMARY KEY,
    room_name VARCHAR(255) NOT NULL,
    room_type ENUM('public', 'private', 'dm') DEFAULT 'public',
    created_by VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_room_type (room_type),
    INDEX idx_created_by (created_by)
);

-- Create room_members table for tracking who's in which room
CREATE TABLE IF NOT EXISTS room_members (
    room_id VARCHAR(255),
    user_id VARCHAR(255),
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (room_id, user_id),
    FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE
);

-- Insert default 'global' room if not exists
INSERT IGNORE INTO rooms (room_id, room_name, room_type, created_by) 
VALUES ('global', 'Global Chat', 'public', 'system');

-- Verify tables
SHOW TABLES LIKE 'room%';
DESCRIBE rooms;
DESCRIBE room_members;
