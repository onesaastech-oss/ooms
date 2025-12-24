-- Optimization script for firms search performance
-- Run this to add indexes for faster search operations

-- CRITICAL: Primary search index for ultra-fast autocomplete
CREATE INDEX IF NOT EXISTS idx_firms_autocomplete_primary 
ON firms (is_deleted, status, firm_name(20));

-- Secondary search index for firm_id lookups
CREATE INDEX IF NOT EXISTS idx_firms_autocomplete_secondary 
ON firms (is_deleted, status, firm_id);

-- Composite index optimized for the most common search pattern
CREATE INDEX IF NOT EXISTS idx_firms_search_optimized 
ON firms (is_deleted, status, firm_name, firm_id, username);

-- Prefix index for firm names (faster LIKE 'term%' searches)
CREATE INDEX IF NOT EXISTS idx_firms_name_prefix 
ON firms (firm_name(10), is_deleted, status);

-- Branch-specific search index
CREATE INDEX IF NOT EXISTS idx_firms_branch_search 
ON firms (branch_id, is_deleted, status, firm_name(15));

-- Add index for branch filtering
CREATE INDEX IF NOT EXISTS idx_firms_branch 
ON firms (branch_id, is_deleted, status);

-- Add index for GST and PAN searches (commonly searched business identifiers)
CREATE INDEX IF NOT EXISTS idx_firms_gst 
ON firms (gst_no, is_deleted);

CREATE INDEX IF NOT EXISTS idx_firms_pan 
ON firms (pan_no, is_deleted);

-- Add index for location-based searches
CREATE INDEX IF NOT EXISTS idx_firms_location 
ON firms (city, state, is_deleted);

-- Add FULLTEXT index for advanced text search (MariaDB compatible)
-- This will significantly improve search performance for text fields
CREATE FULLTEXT INDEX IF NOT EXISTS idx_firms_fulltext 
ON firms (firm_name, username, firm_type);

-- Add index for sorting by creation date
CREATE INDEX IF NOT EXISTS idx_firms_create_date 
ON firms (create_date, is_deleted);
