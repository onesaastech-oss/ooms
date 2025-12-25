import express from "express";
import pool from "../../db.js";
import { auth } from "../../middleware/auth.js";
import { GET_BALANCE, RANDOM_STRING, SET_OPENING_BALANCE } from "../../helpers/function.js";

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
            remark,
            opening_balance = {}
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


        const amount = opening_balance?.amount;
        const transaction_date = opening_balance?.date;
        const transaction_type = opening_balance?.type;

        await SET_OPENING_BALANCE({
            req,
            type: transaction_type,
            party1_type: "bank",
            party1_id: bank_id,
            amount,
            remark: "",
            transaction_date
        })




        return res.status(200).json({
            success: true,
            msg: 'Bank created successfully'
        })

    } catch (error) {
        console.error("Create bank fatal error:", error);
        return res.status(500).json({ success: false, message: "Failed to create bank", error: error.message });
    }
});

router.get('/banks/list', auth, async (req, res) => {
    try {
        const username = req.headers["username"] || "";
        const branch_id = req.headers["branch_id"] || "";
        const { page_no = 1, query = "" } = req?.body || {};

        const limit = 20;
        const offset = (page_no - 1) * limit;
        const search_sql = `%${query}%`;

        const [rows] = await pool.query(
            "SELECT * FROM banks WHERE branch_id = ? AND (account_no LIKE ? OR holder LIKE ? OR ifsc LIKE ? OR bank LIKE ? OR branch LIKE ? OR remark LIKE ?) LIMIT ? OFFSET ?",
            [branch_id, search_sql, search_sql, search_sql, search_sql, search_sql, search_sql, limit, offset]
        );


        const bank_list = [];

        for (let index = 0; index < rows.length; index++) {
            const element = rows[index];

            const bank_id = element?.bank_id;
            const account_no = element?.account_no;
            const ifsc = element?.ifsc;
            const holder = element?.holder;
            const remark = element?.remark;
            const bank = element?.bank;
            const branch = element?.branch;
            const type = element?.type;
            const status = element?.status == '1' ? true : false;

            const balance = await GET_BALANCE({ party_type: "bank", party_id: bank_id, branch_id })


            const object = {
                bank_id,
                account_no,
                ifsc,
                holder,
                remark,
                bank,
                branch,
                status,
                type,
                balance
            }




            bank_list.push(object);


        }

        return res.status(200).json({
            success: true,
            data: bank_list,
            meta: {
                page_no,
                total: bank_list.length
            }
        })


    } catch (error) {
        console.error('Error fetching bank list:', error);
        return res.status(500).json({ success: false, message: "Failed to fetch bank list", error: error.message });
    }
});

export default router;