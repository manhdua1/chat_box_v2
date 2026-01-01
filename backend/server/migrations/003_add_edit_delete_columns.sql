-- Migration: Add edit/delete columns to messages
-- Date: 2025-12-18
-- Description: Add columns to support message editing and deletion

ALTER TABLE messages 
ADD COLUMN edited_at DATETIME NULL AFTER created_at,
ADD COLUMN is_deleted TINYINT(1) DEFAULT 0 AFTER edited_at,
ADD COLUMN deleted_at DATETIME NULL AFTER is_deleted;

-- Add index for better query performance
CREATE INDEX idx_is_deleted ON messages(is_deleted);

-- Verify changes
DESCRIBE messages;
