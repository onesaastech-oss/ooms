import express from 'express';
const router = express.Router();

import pool from "../../db.js";
import { auth } from "../../middleware/auth.js";
import { RANDOM_STRING, UNIX_TIMESTAMP } from "../../helpers/function.js";

async function getTableColumns(tableName) {
    const [rows] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``);
    return new Set(rows.map(r => r.Field));
}

async function insertRow(tableName, data) {
    const columns = await getTableColumns(tableName);
    const entries = Object.entries(data).filter(([k]) => columns.has(k));

    if (entries.length === 0) {
        throw new Error(`No valid columns to insert into ${tableName}`);
    }

    const keys = entries.map(([k]) => `\`${k}\``).join(", ");
    const placeholders = entries.map(() => "?").join(", ");
    const values = entries.map(([, v]) => v);

    const [result] = await pool.query(
        `INSERT INTO \`${tableName}\` (${keys}) VALUES (${placeholders})`,
        values
    );

    return result;
}

router.post('/list', auth, async (req, res) => {
    // #swagger.tags = ['Settings']
    // #swagger.summary = 'Create staff mapping (assign existing user to a branch)'
    // #swagger.description = 'Resolves an existing user by username or email/login_id and creates an entry in branch_mapping (idempotent if already mapped and not deleted).'
    // #swagger.security = [{ "bearerAuth": [] }]
    /* #swagger.parameters['body'] = {
        in: 'body',
        description: 'Staff mapping payload',
        required: true,
        schema: { $ref: '#/definitions/CreateStaffRequest' }
    } */
    /* #swagger.responses[200] = {
        description: 'Staff assigned to branch successfully (or already assigned)',
        schema: { $ref: '#/definitions/ApiResponse' }
    } */
    try {
        const { username, email, branch_id, designation, permission, type = 'staff' } = req.body || {};
        const createdBy = req.headers["username"] || "";

        if ((!username && !email) || !branch_id) {
            return res.status(400).json({
                success: false,
                message: "Missing required parameters (username or email, branch_id)"
            });
        }

        // Resolve existing user (must exist in users table)
        let resolvedUsername = username;
        if (!resolvedUsername) {
            // Prefer login_id if present, else email
            const [rows] = await pool.query(
                "SELECT username FROM users WHERE login_id = ? OR email = ? LIMIT 1",
                [email, email]
            ).catch(async () => {
                const [fallback] = await pool.query("SELECT username FROM users WHERE email = ? LIMIT 1", [email]);
                return [fallback];
            });
            resolvedUsername = rows?.[0]?.username;
        }

        if (!resolvedUsername) {
            return res.status(404).json({
                success: false,
                message: "User not found. Create the user first, then assign to branch."
            });
        }

        // If already mapped (not deleted), return success
        const [existingMap] = await pool.query(
            "SELECT id, map_id FROM branch_mapping WHERE username = ? AND branch_id = ? AND (is_deleted = '0' OR is_deleted = 0) LIMIT 1",
            [resolvedUsername, branch_id]
        ).catch(async () => {
            // Fallback if is_deleted column doesn't exist
            const [rows] = await pool.query(
                "SELECT id, map_id FROM branch_mapping WHERE username = ? AND branch_id = ? LIMIT 1",
                [resolvedUsername, branch_id]
            );
            return [rows];
        });

        let map_id = existingMap?.[0]?.map_id;
        let mappedNow = false;

        if (!existingMap?.length) {
            // Insert into branch_mapping (schema-safe)
            map_id = RANDOM_STRING(30);
            const invitation_token = RANDOM_STRING(30);
            await insertRow("branch_mapping", {
                map_id,
                branch_id,
                username: resolvedUsername,
                designation: designation ?? null,
                create_date: UNIX_TIMESTAMP(),
                create_by: createdBy || resolvedUsername,
                modify_date: UNIX_TIMESTAMP(),
                modify_by: createdBy || resolvedUsername,
                type: permission || type || "staff",
                is_accepted: "1",
                invitation_token,
                status: "1",
                is_deleted: "0"
            });
            mappedNow = true;
        }

        return res.status(200).json({
            success: true,
            message: mappedNow ? "Staff assigned to branch successfully" : "Staff already assigned to this branch",
            data: { username: resolvedUsername, branch_id, map_id, mappedNow }
        });
    } catch (error) {
        console.error('Error creating staff:', error);
        return res.status(500).json({ success: false, message: 'Failed to create staff', error: error.message });
    }
});


export default router;