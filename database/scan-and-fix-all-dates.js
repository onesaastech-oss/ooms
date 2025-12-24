/**
 * Scan ALL tables and convert date columns to TIMESTAMP with proper defaults
 * Finds columns named: *_date, *_at, *_time and converts them to TIMESTAMP
 * Sets proper defaults: create_date/created_at -> DEFAULT CURRENT_TIMESTAMP
 *                      modify_date/updated_at -> DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
 */

import pool from '../db.js';

async function scanAndFixAllDates() {
  console.log('\n🔍 Scanning all tables for date columns...\n');
  
  try {
    // Get all tables in current database
    const [tables] = await pool.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);

    console.log(`Found ${tables.length} tables\n`);

    let totalFixed = 0;
    let totalScanned = 0;

    for (const table of tables) {
      const tableName = table.TABLE_NAME;
      console.log(`\n📋 Checking table: ${tableName}`);

      // Get all columns in this table
      const [columns] = await pool.query(`
        SELECT 
          COLUMN_NAME,
          DATA_TYPE,
          COLUMN_DEFAULT,
          IS_NULLABLE,
          EXTRA
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
      `, [tableName]);

      totalScanned += columns.length;

      for (const col of columns) {
        const colName = col.COLUMN_NAME;
        const dataType = col.DATA_TYPE;
        const colDefault = col.COLUMN_DEFAULT;
        const extra = col.EXTRA || '';

        // Check if this looks like a date column
        const isDateColumn = 
          colName.endsWith('_date') || 
          colName.endsWith('_at') || 
          colName.endsWith('_time') ||
          colName === 'create_date' ||
          colName === 'modify_date' ||
          colName === 'created_at' ||
          colName === 'updated_at' ||
          colName === 'deleted_at' ||
          colName === 'expire_date' ||
          colName === 'start_time' ||
          colName === 'end_time' ||
          colName === 'sent_at' ||
          colName === 'last_used_date' ||
          colName === 'complete_date' ||
          colName === 'target_date' ||
          colName === 'due_date';

        if (!isDateColumn) continue;

        // Skip if already TIMESTAMP or DATETIME with proper defaults
        if (dataType === 'timestamp' || dataType === 'datetime') {
          const hasDefault = colDefault && (
            colDefault.includes('CURRENT_TIMESTAMP') ||
            colDefault.includes('current_timestamp')
          );
          const hasOnUpdate = extra.toLowerCase().includes('on update current_timestamp');

          // Check if it needs fixing
          const isCreateColumn = colName.includes('create') || colName === 'created_at';
          const isModifyColumn = colName.includes('modify') || colName === 'updated_at';

          if (isCreateColumn && hasDefault && !hasOnUpdate) {
            console.log(`   ✅ ${colName} - already correct (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
            continue;
          }

          if (isModifyColumn && hasDefault && hasOnUpdate) {
            console.log(`   ✅ ${colName} - already correct (TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`);
            continue;
          }

          if (!isCreateColumn && !isModifyColumn && (dataType === 'timestamp' || dataType === 'datetime')) {
            console.log(`   ✅ ${colName} - already TIMESTAMP/DATETIME`);
            continue;
          }
        }

        // Need to convert this column
        console.log(`   🔧 Converting ${colName} (${dataType}) to TIMESTAMP...`);

        const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
        
        // Determine default based on column name
        let defaultClause = '';
        if (colName.includes('create') || colName === 'created_at') {
          defaultClause = 'DEFAULT CURRENT_TIMESTAMP';
        } else if (colName.includes('modify') || colName === 'updated_at') {
          defaultClause = 'DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP';
        } else {
          // Other date columns - just make them TIMESTAMP NULL (no default)
          defaultClause = '';
        }

        try {
          // Convert BIGINT unix timestamps to TIMESTAMP first (if needed)
          if (dataType === 'bigint' || dataType === 'int') {
            // Add temporary column
            await pool.query(`
              ALTER TABLE \`${tableName}\` 
              ADD COLUMN \`${colName}_temp\` TIMESTAMP NULL
            `);

            // Convert unix timestamp to TIMESTAMP (handle 0 and NULL)
            await pool.query(`
              UPDATE \`${tableName}\` 
              SET \`${colName}_temp\` = CASE 
                WHEN \`${colName}\` IS NULL OR \`${colName}\` = 0 THEN NULL
                ELSE FROM_UNIXTIME(\`${colName}\`)
              END
            `);

            // Drop old column
            await pool.query(`
              ALTER TABLE \`${tableName}\` 
              DROP COLUMN \`${colName}\`
            `);

            // Rename temp column
            await pool.query(`
              ALTER TABLE \`${tableName}\` 
              CHANGE COLUMN \`${colName}_temp\` \`${colName}\` TIMESTAMP ${nullable} ${defaultClause}
            `);
          } else {
            // Direct conversion for VARCHAR/other types
            await pool.query(`
              ALTER TABLE \`${tableName}\` 
              MODIFY COLUMN \`${colName}\` TIMESTAMP ${nullable} ${defaultClause}
            `);
          }

          console.log(`   ✅ Converted ${colName} to TIMESTAMP ${defaultClause}`);
          totalFixed++;
        } catch (error) {
          console.log(`   ⚠️  Could not convert ${colName}: ${error.message}`);
        }
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 Summary:`);
    console.log(`   Tables scanned: ${tables.length}`);
    console.log(`   Columns scanned: ${totalScanned}`);
    console.log(`   Columns fixed: ${totalFixed}`);
    console.log(`${'='.repeat(60)}\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

scanAndFixAllDates();

