-- Migration: Add polls tables
-- Date: 2025-12-18
-- Description: Create tables for poll persistence

-- =============================================================================
-- POLLS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS polls (
    poll_id VARCHAR(36) PRIMARY KEY,
    room_id VARCHAR(36) NOT NULL,
    question TEXT NOT NULL,
    created_by VARCHAR(36) NOT NULL,
    created_at BIGINT UNSIGNED NOT NULL,
    is_closed BOOLEAN DEFAULT FALSE,
    INDEX idx_room (room_id),
    INDEX idx_creator (created_by),
    INDEX idx_created (created_at),
    INDEX idx_active (room_id, is_closed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- POLL OPTIONS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS poll_options (
    option_id VARCHAR(36) PRIMARY KEY,
    poll_id VARCHAR(36) NOT NULL,
    option_text TEXT NOT NULL,
    option_index INT NOT NULL,
    FOREIGN KEY (poll_id) REFERENCES polls(poll_id) ON DELETE CASCADE,
    INDEX idx_poll (poll_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- POLL VOTES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS poll_votes (
    poll_id VARCHAR(36),
    option_id VARCHAR(36),
    user_id VARCHAR(36) NOT NULL,
    username VARCHAR(50) NOT NULL,
    voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (poll_id, user_id),  -- One vote per user per poll
    FOREIGN KEY (poll_id) REFERENCES polls(poll_id) ON DELETE CASCADE,
    FOREIGN KEY (option_id) REFERENCES poll_options(option_id) ON DELETE CASCADE,
    INDEX idx_option (option_id),
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
