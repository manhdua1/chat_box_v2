-- Migration: Add display_name column to users table
-- Date: 2026-01-03

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS display_name VARCHAR(100) DEFAULT NULL AFTER username;

-- Update existing users to have display_name same as username
UPDATE users SET display_name = username WHERE display_name IS NULL;
