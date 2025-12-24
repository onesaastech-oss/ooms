import express from 'express';
const router = express.Router();

import pool from "../../db.js";

router.get('/', async (req, res) => {
    try {
        // Return a compact list for dropdowns and lookups: id, group_id, name
        const [rows] = await pool.query(
            `SELECT id, group_id, name
             FROM groups
             WHERE (is_deleted = ? OR is_deleted = 0)`,
            ['0']
        );
        res.status(200).json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
export default router;