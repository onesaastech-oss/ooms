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


router.post("/banks/create", auth, async (req, res) => {
    try {
        const username = req.headers["username"] || "";
        const branch_id = req.headers["branch_id"] || "";

        const {
            account_no,
            holder,
            ifsc,
            bank,
            branch,
            type,
            remark
        } = req.body || {};


        const bank_id = RANDOM_STRING(30);
        await pool.query(
            "INSERT INTO `banks` (`branch_id`, `bank_id`, `create_by`, `modify_by`, `account_no`, `holder`, `ifsc`, `bank`, `branch`, `type`, `remark`) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            [
                branch_id,
                bank_id,
                username,     // create_by
                username,     // modify_by
                account_no,
                holder,
                ifsc,
                bank,
                branch,
                type,
                remark
            ]
        );




        return res.status(200).json({
            success: true,
            msg: 'Bank created successfully'
        })

    } catch (error) {
        console.error("Create bank fatal error:", error);
        return res.status(500).json({ success: false, message: "Failed to create bank", error: error.message });
    }
});

export default router;