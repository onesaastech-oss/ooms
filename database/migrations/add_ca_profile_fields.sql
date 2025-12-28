-- Migration: Add CA profile fields to profile table
-- Date: 2025-12-28
-- Description: Adds guardian_name, date_of_birth, gender, and district columns for CA profiles

-- Add guardian_name column if not exists
ALTER TABLE profile ADD COLUMN IF NOT EXISTS guardian_name VARCHAR(100) NULL AFTER name;

-- Add date_of_birth column if not exists
ALTER TABLE profile ADD COLUMN IF NOT EXISTS date_of_birth DATE NULL AFTER guardian_name;

-- Add gender column if not exists
ALTER TABLE profile ADD COLUMN IF NOT EXISTS gender ENUM('male', 'female', 'other') NULL AFTER date_of_birth;

-- Add district column if not exists
ALTER TABLE profile ADD COLUMN IF NOT EXISTS district VARCHAR(100) NULL AFTER city;

-- Add village_town column if not exists
ALTER TABLE profile ADD COLUMN IF NOT EXISTS village_town VARCHAR(100) NULL AFTER district;

