import express from 'express';
const router = express.Router();

import pool from "../../db.js";
import { auth } from "../../middleware/auth.js";

router.get('/list', auth, async (req, res) => {
    try {
        const { branch_id, search, status, page = 1, limit = 20 } = req.query;

        // Validate required field
        if (!branch_id) {
            return res.status(400).json({
                success: false,
                message: "Missing required parameter (branch_id)"
            });
        }

        const pageNum = Number(page) || 1;
        const limitNum = Number(limit) || 20;
        const offset = (pageNum - 1) * limitNum;

        let query = `
            SELECT 
                id,
                branch_id,
                service_id,
                name,
                fees,
                sac_code,
                gst_rate,
                gst_value,
                has_ay,
                is_recurring,
                status,
                remark,
                create_by,
                create_date,
                modify_by,
                modify_date
            FROM services
            WHERE branch_id = ?
        `;

        const queryParams = [branch_id];

        // Filter by status if provided
        if (status !== undefined) {
            query += ` AND status = ?`;
            queryParams.push(status);
        }

        // Add search filter if provided
        if (search) {
            const searchPattern = `%${search}%`;
            query += ` AND (name LIKE ? OR remark LIKE ? OR sac_code LIKE ?)`;
            queryParams.push(searchPattern, searchPattern, searchPattern);
        }

        // Get total count for pagination
        const countQuery = query.replace(
            /SELECT[\s\S]*?FROM/,
            'SELECT COUNT(*) as total FROM'
        );
        const [countResult] = await pool.query(countQuery, queryParams);
        const total = countResult[0]?.total || 0;

        // Add ordering and pagination
        query += ` ORDER BY name ASC LIMIT ? OFFSET ?`;
        queryParams.push(limitNum, offset);

        const [rows] = await pool.query(query, queryParams);

        return res.status(200).json({
            success: true,
            message: "Services list retrieved successfully",
            data: rows,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                total_pages: Math.ceil(total / limitNum),
                is_last_page: offset + rows.length >= total
            }
        });

    } catch (error) {
        console.error('Error fetching services list:', error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch services list",
            error: error.message
        });
    }
});

export default router;

