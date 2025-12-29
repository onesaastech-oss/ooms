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

router.get("/ca/list", auth, async (req, res) => {
    try {
        const { branch_id, search, page = 1, limit = 20 } = req.query;

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
                c.username,
                c.branch_id,
                c.create_date,
                c.status,
                p.profile_id,
                p.name,
                p.guardian_name,
                p.date_of_birth,
                p.gender,
                p.mobile,
                p.country_code,
                p.email,
                p.state,
                p.district,
                p.city,
                p.village_town,
                p.address_line_1,
                p.address_line_2,
                p.pincode
            FROM clients c
            LEFT JOIN profile p ON c.username = p.username
            WHERE c.user_type = 'ca' 
            AND c.is_deleted = '0'
            AND c.branch_id = ?
        `;

        const queryParams = [branch_id];

        // Add search filter if provided
        if (search) {
            const searchPattern = `%${search}%`;
            query += ` AND (p.name LIKE ? OR p.mobile LIKE ? OR p.email LIKE ?)`;
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
        query += ` ORDER BY p.name ASC LIMIT ? OFFSET ?`;
        queryParams.push(limitNum, offset);

        const [rows] = await pool.query(query, queryParams);

        return res.status(200).json({
            success: true,
            message: "CA list retrieved successfully",
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
        console.error('Error fetching CA list:', error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch CA list",
            error: error.message
        });
    }
});

// ===================== AGENT APIs =====================

router.post("/agent/create", auth, async (req, res) => {
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

        // Check if Agent with same mobile already exists
        const [existingMobile] = await pool.query(
            "SELECT p.username FROM profile p JOIN clients c ON p.username = c.username WHERE p.mobile = ? AND c.user_type = 'agent' AND c.is_deleted = '0'",
            [mobile]
        );

        if (existingMobile.length > 0) {
            return res.status(409).json({
                success: false,
                message: "An Agent with this mobile number already exists"
            });
        }

        // Check if Agent with same email already exists (if email provided)
        if (email) {
            const [existingEmail] = await pool.query(
                "SELECT p.username FROM profile p JOIN clients c ON p.username = c.username WHERE p.email = ? AND c.user_type = 'agent' AND c.is_deleted = '0'",
                [email]
            );

            if (existingEmail.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: "An Agent with this email already exists"
                });
            }
        }

        await conn.beginTransaction();

        // Generate unique username and profile_id
        const username = RANDOM_STRING(20);
        const profile_id = RANDOM_STRING(30);

        // Insert into clients table
        await insertRow("clients", {
            username,
            user_type: "agent",
            branch_id,
            create_by: createdBy,
            status: "1",
            is_deleted: "0"
        });

        // Insert into profile table
        await insertRow("profile", {
            profile_id,
            username,
            create_by: createdBy,
            user_type: "agent",
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
            message: "Agent created successfully",
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
        console.error('Error creating Agent:', error);
        return res.status(500).json({
            success: false,
            message: "Failed to create Agent",
            error: error.message
        });
    } finally {
        conn.release();
    }
});

router.get("/agent/list", auth, async (req, res) => {
    try {
        const { branch_id, search, page = 1, limit = 20 } = req.query;

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
                c.username,
                c.branch_id,
                c.create_date,
                c.status,
                p.profile_id,
                p.name,
                p.guardian_name,
                p.date_of_birth,
                p.gender,
                p.mobile,
                p.country_code,
                p.email,
                p.state,
                p.district,
                p.city,
                p.village_town,
                p.address_line_1,
                p.address_line_2,
                p.pincode
            FROM clients c
            LEFT JOIN profile p ON c.username = p.username
            WHERE c.user_type = 'agent' 
            AND c.is_deleted = '0'
            AND c.branch_id = ?
        `;

        const queryParams = [branch_id];

        // Add search filter if provided
        if (search) {
            const searchPattern = `%${search}%`;
            query += ` AND (p.name LIKE ? OR p.mobile LIKE ? OR p.email LIKE ?)`;
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
        query += ` ORDER BY p.name ASC LIMIT ? OFFSET ?`;
        queryParams.push(limitNum, offset);

        const [rows] = await pool.query(query, queryParams);

        return res.status(200).json({
            success: true,
            message: "Agent list retrieved successfully",
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
        console.error('Error fetching Agent list:', error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch Agent list",
            error: error.message
        });
    }
});

// ===================== CLIENT APIs =====================

router.post("/client/create", auth, async (req, res) => {
    const conn = await pool.getConnection();
    
    try {
        const {
            // Personal details
            pan_number,
            full_name,
            care_of,
            guardian_name,
            mobile,
            country_code = "+91",
            email,
            date_of_birth,
            gender,
            image,
            
            // Address details
            state,
            district,
            town_or_village,
            pincode,
            address_line_1,
            address_line_2,
            
            // Business details
            business_type,
            business_pan,
            firm_name,
            gst_number,
            tan_number,
            vat_number,
            cin_number,
            file_number,
            business_state,
            business_district,
            business_town,
            business_pincode,
            business_address_line_1,
            business_address_line_2,
            
            // Other
            groups,
            opening_balance_amount,
            opening_balance_type,
            opening_balance_date,
            
            branch_id
        } = req.body || {};

        const createdBy = req.headers["username"] || "";

        // Validate required fields
        if (!pan_number || !full_name || !care_of || !guardian_name || !mobile || !email || !date_of_birth || !gender) {
            return res.status(400).json({
                success: false,
                message: "Missing required personal details"
            });
        }

        if (!state || !district || !town_or_village || !pincode) {
            return res.status(400).json({
                success: false,
                message: "Missing required address details"
            });
        }

        if (!business_type || !business_pan || !branch_id) {
            return res.status(400).json({
                success: false,
                message: "Missing required business details (business_type, business_pan, branch_id)"
            });
        }

        // For non-individual business types, validate additional required fields
        const isIndividual = business_type.toLowerCase() === 'individual';
        if (!isIndividual) {
            if (!firm_name || !business_state || !business_district || !business_town || !business_pincode) {
                return res.status(400).json({
                    success: false,
                    message: "Missing required business details for non-individual type"
                });
            }
        }

        // Check if client with same mobile already exists
        const [existingMobile] = await pool.query(
            "SELECT p.username FROM profile p JOIN clients c ON p.username = c.username WHERE p.mobile = ? AND c.user_type = 'client' AND c.is_deleted = '0'",
            [mobile]
        );

        if (existingMobile.length > 0) {
            return res.status(409).json({
                success: false,
                message: "A Client with this mobile number already exists"
            });
        }

        // Check if client with same email already exists
        const [existingEmail] = await pool.query(
            "SELECT p.username FROM profile p JOIN clients c ON p.username = c.username WHERE p.email = ? AND c.user_type = 'client' AND c.is_deleted = '0'",
            [email]
        );

        if (existingEmail.length > 0) {
            return res.status(409).json({
                success: false,
                message: "A Client with this email already exists"
            });
        }

        // Check if PAN already exists
        const [existingPan] = await pool.query(
            "SELECT p.username FROM profile p JOIN clients c ON p.username = c.username WHERE p.pan_number = ? AND c.user_type = 'client' AND c.is_deleted = '0'",
            [pan_number]
        );

        if (existingPan.length > 0) {
            return res.status(409).json({
                success: false,
                message: "A Client with this PAN number already exists"
            });
        }

        await conn.beginTransaction();

        // Generate unique IDs
        const username = RANDOM_STRING(20);
        const profile_id = RANDOM_STRING(30);
        const firm_id = RANDOM_STRING(30);

        // Insert into clients table
        await insertRow("clients", {
            username,
            user_type: "client",
            branch_id,
            create_by: createdBy,
            status: "1",
            is_deleted: "0"
        });

        // Insert into profile table
        await insertRow("profile", {
            profile_id,
            username,
            create_by: createdBy,
            user_type: "client",
            name: full_name,
            care_of: care_of || null,
            guardian_name: guardian_name || null,
            date_of_birth: date_of_birth || null,
            gender: gender || null,
            mobile,
            country_code,
            email,
            pan_number,
            state: state || null,
            district: district || null,
            city: district || null,
            village_town: town_or_village || null,
            pincode: pincode || null,
            address_line_1: address_line_1 || null,
            address_line_2: address_line_2 || null,
            image: image || null,
            status: "1"
        });

        // Insert into firms table
        // For individual: only PAN is saved, other business fields are null
        // For others: all business details are saved
        await insertRow("firms", {
            firm_id,
            branch_id,
            username,
            firm_name: isIndividual ? full_name : (firm_name || null),
            firm_type: business_type,
            pan_no: business_pan,
            gst_no: isIndividual ? null : (gst_number || null),
            tan_no: isIndividual ? null : (tan_number || null),
            vat_no: isIndividual ? null : (vat_number || null),
            cin_no: isIndividual ? null : (cin_number || null),
            file_no: isIndividual ? null : (file_number || null),
            state: isIndividual ? null : (business_state || null),
            district: isIndividual ? null : (business_district || null),
            city: isIndividual ? null : (business_town || null),
            pincode: isIndividual ? null : (business_pincode || null),
            address_line_1: isIndividual ? null : (business_address_line_1 || null),
            address_line_2: isIndividual ? null : (business_address_line_2 || null),
            create_by: createdBy,
            status: "1",
            is_deleted: "0"
        });

        await conn.commit();

        return res.status(200).json({
            success: true,
            message: "Client created successfully",
            data: {
                username,
                profile_id,
                firm_id,
                name: full_name,
                mobile,
                email,
                pan_number,
                business_type,
                branch_id
            }
        });

    } catch (error) {
        await conn.rollback();
        console.error('Error creating Client:', error);
        return res.status(500).json({
            success: false,
            message: "Failed to create Client",
            error: error.message
        });
    } finally {
        conn.release();
    }
});

router.get("/client/list", auth, async (req, res) => {
    try {
        const { branch_id, search, page = 1, limit = 20 } = req.query;

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
                c.username,
                c.branch_id,
                c.create_date,
                c.status,
                p.profile_id,
                p.name,
                p.care_of,
                p.guardian_name,
                p.date_of_birth,
                p.gender,
                p.mobile,
                p.country_code,
                p.email,
                p.pan_number,
                p.state,
                p.district,
                p.city,
                p.village_town,
                p.address_line_1,
                p.address_line_2,
                p.pincode,
                p.image,
                f.firm_id,
                f.firm_name,
                f.firm_type,
                f.pan_no as business_pan,
                f.gst_no as gst_number,
                f.tan_no as tan_number,
                f.vat_no as vat_number,
                f.cin_no as cin_number,
                f.file_no as file_number,
                f.state as business_state,
                f.district as business_district,
                f.city as business_town,
                f.pincode as business_pincode,
                f.address_line_1 as business_address_line_1,
                f.address_line_2 as business_address_line_2
            FROM clients c
            LEFT JOIN profile p ON c.username = p.username
            LEFT JOIN firms f ON c.username = f.username AND f.is_deleted = '0'
            WHERE c.user_type = 'client' 
            AND c.is_deleted = '0'
            AND c.branch_id = ?
        `;

        const queryParams = [branch_id];

        // Add search filter if provided
        if (search) {
            const searchPattern = `%${search}%`;
            query += ` AND (p.name LIKE ? OR p.mobile LIKE ? OR p.email LIKE ? OR p.pan_number LIKE ? OR f.firm_name LIKE ?)`;
            queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
        }

        // Get total count for pagination
        const countQuery = query.replace(
            /SELECT[\s\S]*?FROM/,
            'SELECT COUNT(*) as total FROM'
        );
        const [countResult] = await pool.query(countQuery, queryParams);
        const total = countResult[0]?.total || 0;

        // Add ordering and pagination
        query += ` ORDER BY p.name ASC LIMIT ? OFFSET ?`;
        queryParams.push(limitNum, offset);

        const [rows] = await pool.query(query, queryParams);

        return res.status(200).json({
            success: true,
            message: "Client list retrieved successfully",
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
        console.error('Error fetching Client list:', error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch Client list",
            error: error.message
        });
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
