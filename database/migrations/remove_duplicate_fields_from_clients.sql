-- Migration: Remove duplicate fields from clients table
-- Date: 2025-12-28
-- Description: Removes name, mobile, email, country_code from clients table
--              as these fields already exist in the shared profile table

-- Remove duplicate columns from clients table
ALTER TABLE clients DROP COLUMN IF EXISTS name;
ALTER TABLE clients DROP COLUMN IF EXISTS mobile;
ALTER TABLE clients DROP COLUMN IF EXISTS email;
ALTER TABLE clients DROP COLUMN IF EXISTS country_code;

-- Note: After this migration, the clients table structure will be:
-- id, username, user_type, branch_id, create_by, create_date, 
-- modify_by, modify_date, status, is_deleted, deleted_by
--
-- All personal/contact details should be stored in the profile table
-- and linked via the username field.

