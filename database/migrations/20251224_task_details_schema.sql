-- Task Details (stores extended task payload like subtasks/attachments/assignment/meta)
-- Safe to run multiple times because of CREATE TABLE IF NOT EXISTS

CREATE TABLE IF NOT EXISTS `task_details` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `task_id` VARCHAR(120) NOT NULL,
  `firm_id` VARCHAR(120) NULL,
  `service_id` VARCHAR(120) NULL,
  `service_category_id` VARCHAR(120) NULL,
  `notes` TEXT NULL,
  `voice_note_id` VARCHAR(120) NULL,
  `assignment_json` LONGTEXT NULL,
  `subtasks_json` LONGTEXT NULL,
  `attachments_json` LONGTEXT NULL,
  `meta_json` LONGTEXT NULL,
  `create_date` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `modify_date` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `create_by` VARCHAR(255) NULL,
  `status` TINYINT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_task_details_task_id` (`task_id`),
  KEY `idx_task_details_firm_id` (`firm_id`),
  KEY `idx_task_details_service_id` (`service_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


