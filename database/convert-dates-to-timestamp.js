/**
 * Convert ALL date-ish columns in the current MySQL database to TIMESTAMP.
 *
 * Why this exists:
 * - Your codebase historically used BIGINT unix timestamps (UNIX_TIMESTAMP()).
 * - You want ALL tables to use TIMESTAMP columns instead.
 *
 * What it does:
 * - Scans information_schema.columns for this DATABASE()
 * - Targets columns that look like dates:
 *   - common names: create_date, modify_date, created_at, updated_at, due_date, target_date, complete_date, etc.
 *   - or suffix patterns: *_date, *_at
 * - Runs ALTER TABLE ... MODIFY COLUMN ... TIMESTAMP ... (one column at a time)
 *
 * NOTE:
 * - This changes column TYPES. It does NOT attempt a perfect data migration for existing BIGINT values.
 * - Run this once during your schema cleanup, preferably off-peak.
 */

import pool from "../db.js";

const IMPORTANT_DEFAULTS = new Map([
  ["create_date", "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP"],
  ["created_at", "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP"],
  ["modify_date", "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"],
  ["updated_at", "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"],
]);

function isDateLikeColumn(name) {
  if (!name) return false;
  const n = String(name).toLowerCase();
  if (IMPORTANT_DEFAULTS.has(n)) return true;
  if (n.endsWith("_date")) return true;
  if (n.endsWith("_at")) return true;
  if (n === "start_time" || n === "end_time" || n === "sent_at" || n === "expire_date") return true;
  return false;
}

function desiredColumnSql(columnName) {
  const n = String(columnName).toLowerCase();
  if (IMPORTANT_DEFAULTS.has(n)) return IMPORTANT_DEFAULTS.get(n);
  return "TIMESTAMP NULL";
}

async function main() {
  const conn = await pool.getConnection();
  try {
    const [cols] = await conn.query(
      `
      SELECT table_name, column_name, data_type, column_type
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
      ORDER BY table_name, ordinal_position
      `
    );

    const targets = cols.filter((c) => isDateLikeColumn(c.column_name));

    console.log(`Found ${targets.length} date-like column(s) to convert to TIMESTAMP.`);

    let ok = 0;
    let fail = 0;

    for (const c of targets) {
      const table = c.table_name;
      const col = c.column_name;
      const desired = desiredColumnSql(col);

      // Skip if already timestamp
      if (String(c.data_type).toLowerCase() === "timestamp") {
        continue;
      }

      const sql = `ALTER TABLE \`${table}\` MODIFY \`${col}\` ${desired}`;

      try {
        await conn.query(sql);
        ok++;
        process.stdout.write(`✅ ${table}.${col} -> ${desired}\n`);
      } catch (e) {
        fail++;
        process.stdout.write(`❌ ${table}.${col} (${c.column_type}) -> TIMESTAMP failed: ${e.code || e.message}\n`);
      }
    }

    console.log(`\nDone. Successful: ${ok}, Failed: ${fail}`);
    process.exit(fail ? 1 : 0);
  } catch (e) {
    console.error("Fatal:", e);
    process.exit(1);
  } finally {
    conn.release();
  }
}

main();


