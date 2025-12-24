import express from "express";
import pool from "../../db.js";
import { auth, CheckUserProjectMaping } from "../../middleware/auth.js";
import { RANDOM_STRING, USER_DATA } from "../../helpers/function.js";
import { Decrypt } from "../../helpers/Decrypt.js";

const router = express.Router();

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
