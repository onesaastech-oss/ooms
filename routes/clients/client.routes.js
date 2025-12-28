import express from "express";
import pool from "../../db.js";
import { auth, CheckUserProjectMaping } from "../../middleware/auth.js";
import { RANDOM_STRING, USER_DATA } from "../../helpers/function.js";
import { Decrypt } from "../../helpers/Decrypt.js";

const router = express.Router();

// Helper function to get table columns
async function getTableColumns(tableName) {
    const [rows] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``);
    return new Set(rows.map(r => r.Field));
}

// Helper function to insert row with only valid columns
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

router.post("/ca/create", auth, async (req, res) => {
    const conn = await pool.getConnection();
    
    try {
        const {
            name,
            guardian_name,
            mobile,
            country_code = "+91",
            date_of_birth,
            gender,
            email,
            state,
            district,
            village_town,
            pincode,
            address_line_1,
            address_line_2,
            branch_id
        } = req.body || {};

        const createdBy = req.headers["username"] || "";

        // Validate required fields
        if (!name || !mobile || !branch_id) {
            return res.status(400).json({
                success: false,
                message: "Missing required parameters (name, mobile, branch_id)"
            });
        }

        // Check if CA with same mobile already exists (check in profile table)
        const [existingMobile] = await pool.query(
            "SELECT p.username FROM profile p JOIN clients c ON p.username = c.username WHERE p.mobile = ? AND c.user_type = 'ca' AND c.is_deleted = '0'",
            [mobile]
        );

        if (existingMobile.length > 0) {
            return res.status(409).json({
                success: false,
                message: "A CA with this mobile number already exists"
            });
        }

        // Check if CA with same email already exists (if email provided)
        if (email) {
            const [existingEmail] = await pool.query(
                "SELECT p.username FROM profile p JOIN clients c ON p.username = c.username WHERE p.email = ? AND c.user_type = 'ca' AND c.is_deleted = '0'",
                [email]
            );

            if (existingEmail.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: "A CA with this email already exists"
                });
            }
        }

        await conn.beginTransaction();

        // Generate unique username and profile_id
        const username = RANDOM_STRING(20);
        const profile_id = RANDOM_STRING(30);

        // Insert into clients table (only client-specific fields, no profile data)
        await insertRow("clients", {
            username,
            user_type: "ca",
            branch_id,
            create_by: createdBy,
            status: "1",
            is_deleted: "0"
        });

        // Insert into profile table (all personal/contact details go here)
        await insertRow("profile", {
            profile_id,
            username,
            create_by: createdBy,
            user_type: "ca",
            name,
            guardian_name: guardian_name || null,
            date_of_birth: date_of_birth || null,
            gender: gender || null,
            mobile,
            country_code,
            email: email || null,
            state: state || null,
            district: district || null,
            city: district || null,
            village_town: village_town || null,
            pincode: pincode || null,
            address_line_1: address_line_1 || null,
            address_line_2: address_line_2 || null,
            status: "1"
        });

        await conn.commit();

        return res.status(200).json({
            success: true,
            message: "CA created successfully",
            data: {
                username,
                profile_id,
                name,
                mobile,
                email,
                branch_id
            }
        });

    } catch (error) {
        await conn.rollback();
        console.error('Error creating CA:', error);
        return res.status(500).json({
            success: false,
            message: "Failed to create CA",
            error: error.message
        });
    } finally {
        conn.release();
    }
});

router.post("/contact-list", auth, async (req, res) => {
    if (req.body && Object.keys(req.body).length > 0) {
        var data = req.body?.data || '';
        var key = req.body?.key || '';
    }

    const decrypt = Decrypt(data, key);

    if (!decrypt) {
        return res.status(200).json({ error: 'Failed to decrypt data' });
    }

    const username = req.headers["username"] ? req.headers["username"] : '';
    const project_id = decrypt?.project_id;
    const query = decrypt?.query;
    const page_no = Number(decrypt?.page_no) || 1;

    if (!CheckUserProjectMaping(username, project_id)) {
        return res.status(200).json({ error: 'User is not assigned on the project' })
    }

    const search = `%${query}%`;

    const limit = 20;
    const offset = (page_no - 1) * limit;

    var [rows] = await pool.query("SELECT * FROM contacts WHERE project_id = ? AND (name LIKE ? OR number LIKE ? OR email LIKE ? OR firm_name LIKE ? OR website LIKE ? OR remark LIKE ?) ORDER BY contacts.name ASC LIMIT ?, ?", [project_id, search, search, search, search, search, search, offset, limit]);

    var data = [];

    if (rows.length > 0) {
        for (let i = 0; i < rows.length; i++) {
            let element = rows[i];

            let contact_id = element.contact_id;
            let name = element.name;
            let number = element.number;
            let email = element.email;
            let website = element.website;
            let firm_name = element.firm_name;
            let remark = element.remark;


            const [assigned_row] = await pool.query("SELECT * FROM `chat_assigned` WHERE number = ? AND project_id = ? ORDER BY id DESC LIMIT 1", [number, project_id]);
            const agent_id = assigned_row[0]?.username;

            let obj = {
                name,
                number,
                email,
                assign_to_me: agent_id == username ? true : false,
                website,
                firm_name,
                remark,
                contact_id
            };

            data.push(obj);
        }

    }

    res.json({
        data: data,
        count: rows.length,
        page_no,
        is_last_page: rows.length < limit ? true : false
    });
});

export default router;
