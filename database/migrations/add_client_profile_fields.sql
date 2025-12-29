-- Migration: Add client profile fields
-- Date: 2025-12-28
-- Description: Adds pan_number, care_of, image columns to profile table
--              and district column to firms table

-- Add to profile table
ALTER TABLE profile ADD COLUMN IF NOT EXISTS pan_number VARCHAR(20) NULL AFTER email;
ALTER TABLE profile ADD COLUMN IF NOT EXISTS care_of VARCHAR(100) NULL AFTER name;
ALTER TABLE profile ADD COLUMN IF NOT EXISTS image VARCHAR(500) NULL AFTER pincode;

-- Add to firms table
ALTER TABLE firms ADD COLUMN IF NOT EXISTS district VARCHAR(100) NULL AFTER city;


