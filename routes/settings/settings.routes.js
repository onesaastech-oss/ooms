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

/**
 * @swagger
 * /api/v1/settings:
 *   get:
 *     tags: [Settings]
 *     summary: Get all settings options
 *     description: Returns a list of all available settings with their titles and descriptions
 *     responses:
 *       200:
 *         description: List of settings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Settings list retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: staff-list
 *                       title:
 *                         type: string
 *                         example: Staff List
 *                       description:
 *                         type: string
 *                         example: Add, edit & delete staff members
 *                       icon:
 *                         type: string
 *                         example: users
 *                       category:
 *                         type: string
 *                         example: user-management
 *                       route:
 *                         type: string
 *                         example: /settings/staff
 *       500:
 *         description: Internal server error
 */
router.get('/', (req, res) => {
    try {
        const settingsList = [
            {
                id: 'staff-list',
                title: 'Staff List',
                description: 'Add, edit & delete staff members',
                icon: 'users',
                route: '/settings/staff'
            },
            {
                id: 'staff-permissions',
                title: 'Staff Permissions',
                description: 'Add, edit & delete staff permissions and roles',
                icon: 'shield-check',
                route: '/settings/permissions'
            },
            {
                id: 'invoice-setting',
                title: 'Invoice Setting',
                description: 'Voucher configuration and invoice templates',
                icon: 'file-text',
                route: '/settings/invoice'
            },
            {
                id: 'app-settings',
                title: 'App Settings',
                description: 'Configure your app preferences and general settings',
                icon: 'settings',
                route: '/settings/app'
            },
            {
                id: 'email-configuration',
                title: 'Email Configuration',
                description: 'Set your own SMTP server and email settings',
                icon: 'mail',
                route: '/settings/email'
            },
            {
                id: 'whatsapp-ooms',
                title: 'WhatsApp OOMS',
                description: 'Scan to connect WhatsApp with OOMS system',
                icon: 'message-circle',
                route: '/settings/whatsapp-ooms'
            },
            {
                id: 'whatsapp-w1chat',
                title: 'WhatsApp W1Chat',
                description: 'Connect W1Chat with OOMS for enhanced messaging',
                icon: 'message-square',
                route: '/settings/whatsapp-w1chat'
            },
            {
                id: 'default-daterange',
                title: 'Default Daterange',
                description: 'Edit default date range for reports and filters',
                icon: 'calendar',
                route: '/settings/daterange'
            },
            {
                id: 'google-2fa',
                title: 'Google 2FA',
                description: 'Google authenticator two-factor authentication setup',
                icon: 'shield',
                route: '/settings/2fa'
            },
            {
                id: 'gateway',
                title: 'Gateway',
                description: 'Configure payment gateway settings and options',
                icon: 'credit-card',
                route: '/settings/gateway'
            },
            {
                id: 'branch-list',
                title: 'Branch List',
                description: 'Add, edit & view branch locations and details',
                icon: 'map-pin',
                route: '/settings/branches'
            },
            {
                id: 'manage-admin',
                title: 'Manage Admin',
                description: 'Add, edit & view admin users and their privileges',
                icon: 'user-check',
                route: '/settings/admins'
            }
        ];

        res.status(200).json({
            success: true,
            message: 'Settings list retrieved successfully',
            data: settingsList,
            total: settingsList.length,
            categories: {
                'user-management': 'User Management',
                'financial': 'Financial Settings',
                'general': 'General Settings',
                'communication': 'Communication',
                'security': 'Security',
                'organization': 'Organization'
            }
        });
    } catch (error) {
        console.error('Error fetching settings list:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve settings list',
            error: error.message
        });
    }
});

// Assigns an existing user as staff to a branch (branch_mapping only)
router.post('/create-staff', auth, async (req, res) => {
    try {
        const { username, email, branch_id, designation, permission, type } = req.body || {};
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

// Maps an existing staff (username) to a branch in branch_mapping (idempotent-ish)
router.post('/assign-staff', auth, async (req, res) => {
    try {
        const { username, branch_id, designation, type } = req.body || {};
        const createdBy = req.headers["username"] || "";

        if (!username || !branch_id) {
            return res.status(400).json({
                success: false,
                message: "Missing required parameters (username, branch_id)"
            });
        }

        const [userRows] = await pool.query("SELECT username FROM users WHERE username = ? LIMIT 1", [username]);
        if (!userRows.length) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // If already mapped (not deleted), return success
        const [existingMap] = await pool.query(
            "SELECT id, map_id FROM branch_mapping WHERE username = ? AND branch_id = ? AND (is_deleted = '0' OR is_deleted = 0) LIMIT 1",
            [username, branch_id]
        ).catch(async () => {
            // Fallback if is_deleted column doesn't exist
            const [rows] = await pool.query(
                "SELECT id, map_id FROM branch_mapping WHERE username = ? AND branch_id = ? LIMIT 1",
                [username, branch_id]
            );
            return [rows];
        });

        if (existingMap?.length) {
            return res.status(200).json({
                success: true,
                message: "Staff already mapped to this branch",
                data: { id: existingMap[0]?.id, map_id: existingMap[0]?.map_id, username, branch_id }
            });
        }

        const map_id = RANDOM_STRING(30);
        const invitation_token = RANDOM_STRING(30);
        await insertRow("branch_mapping", {
            map_id,
            branch_id,
            username,
            designation: designation ?? null,
            create_date: UNIX_TIMESTAMP(),
            create_by: createdBy || username,
            modify_date: UNIX_TIMESTAMP(),
            modify_by: createdBy || username,
            type: type || "staff",
            is_accepted: "1",
            invitation_token,
            status: "1",
            is_deleted: "0"
        });

        return res.status(200).json({
            success: true,
            message: "Staff mapped to branch successfully",
            data: { username, branch_id, map_id }
        });
    } catch (error) {
        console.error("Error assigning staff:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to assign staff",
            error: error.message
        });
    }
});

export default router;