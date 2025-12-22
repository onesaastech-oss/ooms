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
 *                       route:
 *                         type: string
 *                         example: /settings/staff
 *       500:
 *         description: Internal server error
 */
router.get('/settings-list', (req, res) => {
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

router.post('/create', auth, async (req, res) => {
    // #swagger.tags = ['Settings']
    // #swagger.summary = 'Create staff mapping (assign existing user to a branch)'
    // #swagger.description = 'Resolves an existing user by username or email/login_id and creates an entry in branch_mapping (idempotent if already mapped and not deleted).'
    // #swagger.security = [{ "bearerAuth": [] }]
    /* #swagger.parameters['body'] = {
        in: 'body',
        required: true,
        schema: {
            type: 'object',
            required: ['branch_id'],
            properties: {
                username: { type: 'string', example: 'john.doe' },
                email: { type: 'string', example: 'john.doe@example.com' },
                branch_id: { type: 'string', example: '565655' },
                designation: { type: 'string', example: 'Manager' },
                permission: { type: 'string', example: 'admin' }
            },
            example: {
                username: 'john.doe',
                branch_id: '565655',
                designation: 'Manager',
                permission: 'admin'
            }
        }
    } */
    /* #swagger.responses[200] = {
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Staff assigned to branch successfully' },
                data: {
                    type: 'object',
                    properties: {
                        username: { type: 'string', example: 'john.doe' },
                        branch_id: { type: 'string', example: '565655' },
                        map_id: { type: 'string', example: 'abc123xyz456' }
                    }
                }
            }
        }
    } */
    /* #swagger.responses[400] = {
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: false },
                message: { type: 'string', example: 'Missing required parameters' }
            }
        }
    } */
    try {
        const { username, email, branch_id, designation, permission, type='staff' } = req.body || {};
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

router.get('/list', auth, async (req, res) => {
    // #swagger.tags = ['Settings']
    // #swagger.summary = 'Get staff list for a branch'
    // #swagger.description = 'Retrieve all staff members assigned to a specific branch'
    // #swagger.security = [{ "bearerAuth": [] }]
    /* #swagger.parameters['branch_id'] = {
        in: 'query',
        required: true,
        type: 'string',
        example: '565655'
    } */
    /* #swagger.responses[200] = {
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Staff list retrieved successfully' },
                data: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            map_id: { type: 'string', example: 'abc123xyz456' },
                            username: { type: 'string', example: 'john.doe' },
                            designation: { type: 'string', example: 'Manager' },
                            type: { type: 'string', example: 'admin' }
                        }
                    }
                }
            }
        }
    } */
    try {
        const { branch_id } = req.query;
        const [rows] = await pool.query(
            "SELECT map_id, username, designation, modify_date, modify_by, type, is_accepted, invitation_token, status, is_deleted, deleted_by FROM branch_mapping WHERE branch_id = ?",
            [branch_id]
        );

        return res.status(200).json({ success: true, message: 'Staff list retrieved successfully', data: rows });
    } catch (error) {
        console.error('Error fetching staff list:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch staff list', error: error.message });
    }
});

router.post('/delete', auth, async (req, res) => {
    // #swagger.tags = ['Settings']
    // #swagger.summary = 'Delete staff member'
    // #swagger.description = 'Soft delete a staff member by setting is_deleted flag to 1 in branch_mapping table'
    // #swagger.security = [{ "bearerAuth": [] }]
    /* #swagger.parameters['body'] = {
        in: 'body',
        required: true,
        schema: {
            type: 'object',
            required: ['map_id'],
            properties: {
                map_id: { type: 'string', example: 'abc123xyz456' }
            },
            example: {
                map_id: 'abc123xyz456'
            }
        }
    } */
    /* #swagger.responses[200] = {
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Staff deleted successfully' }
            }
        }
    } */
    /* #swagger.responses[500] = {
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: false },
                message: { type: 'string', example: 'Failed to delete staff' }
            }
        }
    } */
    try {
        const { map_id } = req.body;
        const [rows] = await pool.query("UPDATE branch_mapping SET is_deleted = '1', deleted_by = ? WHERE map_id = ?", [req.headers["username"], map_id]);
        return res.status(200).json({ success: true, message: 'Staff deleted successfully', data: rows });
    } catch (error) {
        console.error('Error deleting staff:', error);
        return res.status(500).json({ success: false, message: 'Failed to delete staff', error: error.message });
    }
});

router.get('/profile', auth, async (req, res) => {
    // #swagger.tags = ['Settings']
    // #swagger.summary = 'Get staff profile'
    // #swagger.description = 'Retrieve profile information for a staff member by username'
    // #swagger.security = [{ "bearerAuth": [] }]
    /* #swagger.parameters['username'] = {
        in: 'query',
        required: true,
        type: 'string',
        example: 'john.doe'
    } */
    /* #swagger.responses[200] = {
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Staff profile retrieved successfully' },
                data: { type: 'array', items: { type: 'object' } }
            }
        }
    } */
    /* #swagger.responses[500] = {
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: false },
                message: { type: 'string', example: 'Failed to fetch staff profile' }
            }
        }
    } */
    try {
        const { username } = req.query;
        const [rows] = await pool.query("SELECT * FROM profile WHERE username = ?", [username]);
        return res.status(200).json({ success: true, message: 'Staff profile retrieved successfully', data: rows });
    } catch (error) {
        console.error('Error fetching staff profile:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch staff profile', error: error.message });
    }
});


export default router;