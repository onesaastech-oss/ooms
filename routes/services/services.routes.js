import express from 'express';
const router = express.Router();

import pool from "../../db.js";

router.get('/', async (req, res) => {
    try {
        // Return services list: id, service_id, name, fees, gst_rate, gst_value, status
        const [rows] = await pool.query(
            `SELECT id, service_id, name, fees, gst_rate, gst_value, status, sac_code, has_ay, is_recurring, remark
             FROM services
             `,
            
        );
        res.status(200).json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;

