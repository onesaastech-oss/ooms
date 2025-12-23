-- ============================================
-- Email Broadcast System - Database Schema
-- ============================================
-- This schema supports scalable email broadcasting with:
-- - Batch processing
-- - Detailed tracking and reporting
-- - Template management
-- - SMTP configuration
-- - Future-proof design for SMS/WhatsApp
-- ============================================

-- Table 1: Email Configurations
-- Stores SMTP settings for sending emails
CREATE TABLE IF NOT EXISTS `email_configs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `config_id` VARCHAR(50) UNIQUE NOT NULL,
  `name` VARCHAR(100) NOT NULL COMMENT 'Friendly name for this config',
  `provider` VARCHAR(50) NOT NULL DEFAULT 'smtp' COMMENT 'Email provider type',
  `host` VARCHAR(255) NOT NULL,
  `port` INT NOT NULL DEFAULT 587,
  `username` VARCHAR(255) NOT NULL,
  `password` TEXT NOT NULL COMMENT 'Encrypted password',
  `from_name` VARCHAR(100) NOT NULL,
  `from_email` VARCHAR(255) NOT NULL,
  `is_default` TINYINT(1) DEFAULT 0 COMMENT 'Is this the default config',
  `is_enabled` TINYINT(1) DEFAULT 1 COMMENT 'Enable/disable globally',
  `rate_limit_per_minute` INT DEFAULT 60 COMMENT 'Max emails per minute',
  `created_at` BIGINT NOT NULL COMMENT 'Unix timestamp',
  `updated_at` BIGINT NOT NULL COMMENT 'Unix timestamp',
  `created_by` VARCHAR(100),
  `updated_by` VARCHAR(100),
  INDEX `idx_is_default` (`is_default`),
  INDEX `idx_is_enabled` (`is_enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 2: Email Templates
-- Stores reusable email templates with variable support
CREATE TABLE IF NOT EXISTS `email_templates` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `template_id` VARCHAR(50) UNIQUE NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `subject` VARCHAR(255) NOT NULL,
  `html_body` LONGTEXT NOT NULL,
  `plain_text` TEXT COMMENT 'Plain text fallback',
  `variables` JSON COMMENT 'Array of variable names like ["name", "email"]',
  `description` TEXT COMMENT 'Template description',
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` BIGINT NOT NULL COMMENT 'Unix timestamp',
  `updated_at` BIGINT NOT NULL COMMENT 'Unix timestamp',
  `created_by` VARCHAR(100),
  `updated_by` VARCHAR(100),
  INDEX `idx_is_active` (`is_active`),
  INDEX `idx_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 3: Email Broadcasts
-- Main broadcast table - stores broadcast metadata and stats
CREATE TABLE IF NOT EXISTS `email_broadcasts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `broadcast_id` VARCHAR(50) UNIQUE NOT NULL,
  `channel` VARCHAR(20) NOT NULL DEFAULT 'email' COMMENT 'Future: email, sms, whatsapp',
  `name` VARCHAR(255) NOT NULL COMMENT 'Broadcast campaign name',
  `subject` VARCHAR(255) NOT NULL,
  `html_body` LONGTEXT NOT NULL,
  `plain_text` TEXT COMMENT 'Plain text fallback',
  `template_id` VARCHAR(50) COMMENT 'If template was used',
  `config_id` VARCHAR(50) NOT NULL COMMENT 'Email config used',
  `recipient_type` VARCHAR(50) NOT NULL COMMENT 'all_users, role_based, uploaded_list',
  `recipient_filter` JSON COMMENT 'Filter criteria (roles, uploaded emails, etc)',
  `attachment_urls` JSON COMMENT 'Array of attachment file paths',
  `batch_size` INT NOT NULL DEFAULT 100,
  `batch_delay_seconds` INT NOT NULL DEFAULT 3,
  `total_recipients` INT DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'queued' COMMENT 'queued, processing, completed, failed',
  `queued_count` INT DEFAULT 0,
  `sent_count` INT DEFAULT 0,
  `failed_count` INT DEFAULT 0,
  `bounced_count` INT DEFAULT 0,
  `start_time` BIGINT COMMENT 'Unix timestamp when processing started',
  `end_time` BIGINT COMMENT 'Unix timestamp when completed',
  `duration_seconds` INT COMMENT 'Total duration',
  `error_message` TEXT COMMENT 'Error message if failed',
  `created_at` BIGINT NOT NULL COMMENT 'Unix timestamp',
  `updated_at` BIGINT NOT NULL COMMENT 'Unix timestamp',
  `created_by` VARCHAR(100),
  INDEX `idx_broadcast_id` (`broadcast_id`),
  INDEX `idx_channel` (`channel`),
  INDEX `idx_status` (`status`),
  INDEX `idx_created_at` (`created_at`),
  INDEX `idx_created_by` (`created_by`),
  FOREIGN KEY (`template_id`) REFERENCES `email_templates`(`template_id`) ON DELETE SET NULL,
  FOREIGN KEY (`config_id`) REFERENCES `email_configs`(`config_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 4: Email Broadcast Batches
-- Tracks each batch within a broadcast
CREATE TABLE IF NOT EXISTS `email_broadcast_batches` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `batch_id` VARCHAR(50) UNIQUE NOT NULL,
  `broadcast_id` VARCHAR(50) NOT NULL,
  `batch_number` INT NOT NULL,
  `batch_size` INT NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending, processing, completed, failed',
  `sent_count` INT DEFAULT 0,
  `failed_count` INT DEFAULT 0,
  `start_time` BIGINT COMMENT 'Unix timestamp',
  `end_time` BIGINT COMMENT 'Unix timestamp',
  `processing_time_ms` INT COMMENT 'Processing time in milliseconds',
  `error_message` TEXT,
  `created_at` BIGINT NOT NULL COMMENT 'Unix timestamp',
  `updated_at` BIGINT NOT NULL COMMENT 'Unix timestamp',
  INDEX `idx_batch_id` (`batch_id`),
  INDEX `idx_broadcast_id` (`broadcast_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_batch_number` (`batch_number`),
  FOREIGN KEY (`broadcast_id`) REFERENCES `email_broadcasts`(`broadcast_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 5: Email Broadcast Logs
-- Detailed per-recipient logs
CREATE TABLE IF NOT EXISTS `email_broadcast_logs` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `log_id` VARCHAR(50) UNIQUE NOT NULL,
  `broadcast_id` VARCHAR(50) NOT NULL,
  `batch_id` VARCHAR(50) NOT NULL,
  `recipient_email` VARCHAR(255) NOT NULL,
  `recipient_name` VARCHAR(255),
  `status` VARCHAR(20) NOT NULL DEFAULT 'queued' COMMENT 'queued, sent, failed, bounced',
  `error_message` TEXT,
  `sent_at` BIGINT COMMENT 'Unix timestamp',
  `retry_count` INT DEFAULT 0,
  `max_retries` INT DEFAULT 3,
  `message_id` VARCHAR(255) COMMENT 'Email provider message ID',
  `created_at` BIGINT NOT NULL COMMENT 'Unix timestamp',
  `updated_at` BIGINT NOT NULL COMMENT 'Unix timestamp',
  INDEX `idx_log_id` (`log_id`),
  INDEX `idx_broadcast_id` (`broadcast_id`),
  INDEX `idx_batch_id` (`batch_id`),
  INDEX `idx_recipient_email` (`recipient_email`),
  INDEX `idx_status` (`status`),
  INDEX `idx_sent_at` (`sent_at`),
  FOREIGN KEY (`broadcast_id`) REFERENCES `email_broadcasts`(`broadcast_id`) ON DELETE CASCADE,
  FOREIGN KEY (`batch_id`) REFERENCES `email_broadcast_batches`(`batch_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Insert Default Email Configuration
-- ============================================
INSERT INTO `email_configs` (
  `config_id`,
  `name`,
  `provider`,
  `host`,
  `port`,
  `username`,
  `password`,
  `from_name`,
  `from_email`,
  `is_default`,
  `is_enabled`,
  `rate_limit_per_minute`,
  `created_at`,
  `updated_at`,
  `created_by`
) VALUES (
  'default_smtp',
  'Default SMTP Configuration',
  'smtp',
  'smtp.gmail.com',
  587,
  'souravadhikary1916@gmail.com',
  'srsl kqdl pdpz upqo',
  'OOMS',
  'souravadhikary1916@gmail.com',
  1,
  1,
  60,
  UNIX_TIMESTAMP(),
  UNIX_TIMESTAMP(),
  'system'
) ON DUPLICATE KEY UPDATE
  `updated_at` = UNIX_TIMESTAMP();

-- ============================================
-- Insert Sample Email Template
-- ============================================
INSERT INTO `email_templates` (
  `template_id`,
  `name`,
  `subject`,
  `html_body`,
  `plain_text`,
  `variables`,
  `description`,
  `is_active`,
  `created_at`,
  `updated_at`,
  `created_by`
) VALUES (
  'welcome_email',
  'Welcome Email',
  'Welcome to {{app_name}}, {{name}}!',
  '<html><body><h1>Welcome {{name}}!</h1><p>Thank you for joining {{app_name}}. We are excited to have you on board.</p><p>Your email: {{email}}</p><p>Best regards,<br>The {{app_name}} Team</p></body></html>',
  'Welcome {{name}}! Thank you for joining {{app_name}}. Your email: {{email}}',
  '["name", "email", "app_name"]',
  'Default welcome email template',
  1,
  UNIX_TIMESTAMP(),
  UNIX_TIMESTAMP(),
  'system'
) ON DUPLICATE KEY UPDATE
  `updated_at` = UNIX_TIMESTAMP();

