import express from "express";
import pool from "../../db.js";
import { auth } from "../../middleware/auth.js";
import { RANDOM_STRING } from "../../helpers/function.js";

const router = express.Router();

async function getTableColumns(db, tableName) {
    const [rows] = await db.query(`SHOW COLUMNS FROM \`${tableName}\``);
    return new Set(rows.map(r => r.Field));
}

async function tableExists(db, tableName) {
    const [rows] = await db.query("SHOW TABLES LIKE ?", [tableName]);
    return rows.length > 0;
}

/**
 * Insert row but only with columns that exist in DB (prevents breaking when schemas differ)
 */
async function insertRow(db, tableName, data) {
    const columns = await getTableColumns(db, tableName);
    const entries = Object.entries(data).filter(([k]) => columns.has(k));

    if (entries.length === 0) {
        throw new Error(`No valid columns to insert into ${tableName}`);
    }

    const keys = entries.map(([k]) => `\`${k}\``).join(", ");
    const placeholders = entries.map(() => "?").join(", ");
    const values = entries.map(([, v]) => v);

    const [result] = await db.query(
        `INSERT INTO \`${tableName}\` (${keys}) VALUES (${placeholders})`,
        values
    );

    return result;
}

function isISODateString(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

// For DATE or TIMESTAMP columns, MySQL accepts 'YYYY-MM-DD' and will normalize as needed.

router.post("/create", auth, async (req, res) => {
    // #swagger.tags = ['Tasks']
    // #swagger.summary = 'Create task'
    // #swagger.description = 'Creates a task in tasks table and stores extended payload (subtasks, attachments, assignment, meta) into task_details if table exists.'
    // #swagger.security = [{ "bearerAuth": [] }]
    try {
        const username = req.headers["username"] || "";

        const {
            firm_id,
            service_id,
            service_category_id = null,
            fees = null,
            due_date,
            subtasks = [],
            assignment = {},
            notes = null,
            attachments = [],
            voice_note_id = null,
            meta = {}
        } = req.body || {};

        if (!firm_id || !service_id || !due_date) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields (firm_id, service_id, due_date)"
            });
        }

        if (!isISODateString(due_date)) {
            return res.status(400).json({
                success: false,
                message: "Invalid due_date. Expected YYYY-MM-DD"
            });
        }

        if (subtasks && !Array.isArray(subtasks)) {
            return res.status(400).json({ success: false, message: "subtasks must be an array" });
        }
        if (attachments && !Array.isArray(attachments)) {
            return res.status(400).json({ success: false, message: "attachments must be an array" });
        }

        // Basic validation for subtasks (best-effort)
        for (const st of subtasks || []) {
            if (!st?.subtask_type || !st?.description || !st?.due_date) {
                return res.status(400).json({
                    success: false,
                    message: "Each subtask requires subtask_type, description, due_date"
                });
            }
            if (!isISODateString(st.due_date)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid subtask due_date. Expected YYYY-MM-DD"
                });
            }
            if (st.assigned_staff_ids && !Array.isArray(st.assigned_staff_ids)) {
                return res.status(400).json({
                    success: false,
                    message: "subtask.assigned_staff_ids must be an array"
                });
            }
        }

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            // Pull firm context (branch_id, firm username) if available
            const [firmRows] = await conn.query(
                "SELECT branch_id, username FROM firms WHERE firm_id = ? AND (is_deleted = '0' OR is_deleted = 0) LIMIT 1",
                [firm_id]
            ).catch(async () => {
                // fallback if is_deleted doesn't exist
                const [rows] = await conn.query(
                    "SELECT branch_id, username FROM firms WHERE firm_id = ? LIMIT 1",
                    [firm_id]
                );
                return [rows];
            });

            if (!firmRows?.length) {
                await conn.rollback();
                return res.status(404).json({ success: false, message: "firm_id not found" });
            }

            const branch_id = firmRows[0]?.branch_id ?? null;
            const firm_username = firmRows[0]?.username ?? null;

            // Pull service tax context if available
            const [serviceRows] = await conn.query(
                "SELECT fees AS default_fees, gst_rate FROM services WHERE service_id = ? LIMIT 1",
                [service_id]
            );
            const gst_rate = Number(serviceRows?.[0]?.gst_rate ?? 0) || 0;
            const finalFees = Number(fees ?? serviceRows?.[0]?.default_fees ?? 0) || 0;
            const tax_value = Number(((finalFees * gst_rate) / 100).toFixed(2));
            const total = Number((finalFees + tax_value).toFixed(2));

            const task_id = RANDOM_STRING(30);
            const ca_id = assignment?.ca_id ?? null;
            const agent_id = assignment?.agent_id ?? null;

            const has_ca = ca_id ? "1" : "0";
            const has_agent = agent_id ? "1" : "0";

            // Let DB handle date parsing; do not compute unix/bigint values
            const dueValue = due_date;
            const targetValue = due_date;

            // Insert into tasks (schema-safe)
            await insertRow(conn, "tasks", {
                branch_id,
                task_id,
                username: firm_username || username, // keep existing behavior flexible
                firm_id,
                service_id,
                has_ca,
                ca_id,
                has_agent,
                agent_id,
                fees: finalFees,
                tax_rate: gst_rate,
                tax_value,
                total,
                create_by: username,
                is_recurring: "0",
                due_date: dueValue,
                target_date: targetValue,
                billing_status: "0",
                status: "1"
            });

            // Store extended payload into task_details if table exists (best-effort)
            if (await tableExists(conn, "task_details")) {
                await insertRow(conn, "task_details", {
                    task_id,
                    firm_id,
                    service_id,
                    service_category_id,
                    notes,
                    voice_note_id,
                    assignment_json: JSON.stringify(assignment ?? {}),
                    subtasks_json: JSON.stringify(subtasks ?? []),
                    attachments_json: JSON.stringify(attachments ?? []),
                    meta_json: JSON.stringify(meta ?? {}),
                    create_by: username
                });
            }

            await conn.commit();

            return res.status(200).json({
                success: true,
                message: "Task created successfully",
                data: {
                    task_id,
                    firm_id,
                    service_id,
                    service_category_id,
                    fees: finalFees,
                    tax_rate: gst_rate,
                    tax_value,
                    total,
                    due_date,
                    assignment,
                    subtasks,
                    attachments,
                    notes,
                    voice_note_id,
                    meta
                }
            });
        } catch (e) {
            try { await conn.rollback(); } catch { }
            console.error("Create task error:", e);
            return res.status(500).json({ success: false, message: "Failed to create task", error: e.message });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error("Create task fatal error:", error);
        return res.status(500).json({ success: false, message: "Failed to create task", error: error.message });
    }
});

export default router;