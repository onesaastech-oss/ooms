-- Convert common *_date fields to TIMESTAMP with sane defaults.
-- This file is SAFE to run on DBs where some tables/columns do not exist (it uses dynamic SQL).
-- NOTE: Converting from BIGINT unix -> TIMESTAMP is NOT done here (no data migration), only type change.

-- -----------------------
-- permission_role
-- -----------------------
SET @tbl := 'permission_role';
SET @col := 'create_date';
SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = @tbl AND column_name = @col
    ),
    CONCAT('ALTER TABLE `', @tbl, '` MODIFY `', @col, '` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @tbl := 'permission_role';
SET @col := 'modify_date';
SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = @tbl AND column_name = @col
    ),
    CONCAT('ALTER TABLE `', @tbl, '` MODIFY `', @col, '` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- -----------------------
-- tasks
-- -----------------------
SET @tbl := 'tasks';
SET @col := 'create_date';
SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = @tbl AND column_name = @col
    ),
    CONCAT('ALTER TABLE `', @tbl, '` MODIFY `', @col, '` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @tbl := 'tasks';
SET @col := 'due_date';
SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = @tbl AND column_name = @col
    ),
    CONCAT('ALTER TABLE `', @tbl, '` MODIFY `', @col, '` TIMESTAMP NULL'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @tbl := 'tasks';
SET @col := 'target_date';
SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = @tbl AND column_name = @col
    ),
    CONCAT('ALTER TABLE `', @tbl, '` MODIFY `', @col, '` TIMESTAMP NULL'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @tbl := 'tasks';
SET @col := 'complete_date';
SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = @tbl AND column_name = @col
    ),
    CONCAT('ALTER TABLE `', @tbl, '` MODIFY `', @col, '` TIMESTAMP NULL'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- -----------------------
-- task_details
-- -----------------------
SET @tbl := 'task_details';
SET @col := 'create_date';
SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = @tbl AND column_name = @col
    ),
    CONCAT('ALTER TABLE `', @tbl, '` MODIFY `', @col, '` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @tbl := 'task_details';
SET @col := 'modify_date';
SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = @tbl AND column_name = @col
    ),
    CONCAT('ALTER TABLE `', @tbl, '` MODIFY `', @col, '` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


