import express from "express";
const router = express.Router();
import pool from "../../db.js";
import { FUTURE_UNIX_TIMESTAMP, GENERATE_PASSWORD, IS_STRONG_PASSWORD, RANDOM_INTEGER, RANDOM_STRING, UNIX_TIMESTAMP } from "../../helpers/function.js";
import { Decrypt } from "../../helpers/Decrypt.js";
import { auth } from "../../middleware/auth.js";
import { APP_NAME, GOOGLE_CLIENT_ID } from "../../helpers/Config.js";
import { OAuth2Client } from "google-auth-library";
import { SendMail } from "../../helpers/Mail.js";
import moment from "moment";

router.post("/login/send-otp", async (req, res) => {
    // #swagger.tags = ['Authentication']
    // #swagger.summary = 'Send OTP for login'
    // #swagger.description = 'Send OTP to user email for login verification'
    /* #swagger.parameters['body'] = {
        in: 'body',
        description: 'Login credentials',
        required: true,
        schema: { $ref: '#/definitions/LoginRequest' }
    } */
    /* #swagger.responses[200] = {
        description: 'OTP sent successfully',
        schema: { $ref: '#/definitions/ApiResponse' }
    } */
    try {
        const { email, password } = req.body || {};

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Missing required parameters"
            });
        }

        const [rows] = await pool.query(
            "SELECT username FROM users WHERE login_id = ? AND password = ? AND status = ?",
            [email, password, '1']
        );

        if (!rows.length) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password"
            });
        }

        const { username } = rows[0];

        // OTP generation
        const otp_id = RANDOM_STRING();
        const otp = RANDOM_INTEGER();
        const create_date = UNIX_TIMESTAMP();
        const expire_date = FUTURE_UNIX_TIMESTAMP(3);

        await pool.query(
            `INSERT INTO otps 
            (otp_id, type, otp, username, create_date, expire_date, status, remark)
            VALUES (?,?,?,?,?,?,?,?)`,
            [otp_id, 'login', otp, username, create_date, expire_date, '0', 'Email login OTP']
        );

        await SendMail({
            to: email,
            subject: `Login OTP for ${APP_NAME}`,
            html: `<!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body {
                            margin: 0;
                            padding: 0;
                            background: #f3f4f6;
                            font-family: Arial, sans-serif;
                        }
                        .container {
                            max-width: 420px;
                            margin: 40px auto;
                            background: #ffffff;
                            border-radius: 10px;
                            padding: 24px;
                            text-align: center;
                            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                        }
                        h2 {
                            color: #111827;
                            margin-bottom: 8px;
                        }
                        p {
                            color: #6b7280;
                            font-size: 14px;
                        }
                        .otp {
                            margin: 20px 0;
                            font-size: 28px;
                            font-weight: bold;
                            letter-spacing: 8px;
                            color: #4f46e5;
                        }
                        .footer {
                            font-size: 12px;
                            color: #9ca3af;
                            margin-top: 24px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h2>OTP Verification</h2>
                        <p>Use the following OTP to complete your login</p>
                        <div class="otp">${otp}</div>
                        <p>This OTP is valid for a limited time. Please do not share it with anyone.</p>
                        <div class="footer">
                            © ${new Date().getFullYear()} ${APP_NAME}
                        </div>
                    </div>
                </body>
                </html>`
        })

        return res.status(200).json({
            success: true,
            message: "OTP sent successfully",
            expire: expire_date
        });

    } catch (err) {
        console.error("LOGIN OTP ERROR:", err);

        return res.status(500).json({
            success: false,
            message: "Failed to send OTP"
        });
    }
});


router.post("/login/email", async (req, res) => {
    // #swagger.tags = ['Authentication']
    // #swagger.summary = 'Login with email and OTP'
    // #swagger.description = 'Complete login process with email, password and OTP'
    /* #swagger.parameters['body'] = {
        in: 'body',
        description: 'Login credentials with OTP',
        required: true,
        schema: { $ref: '#/definitions/LoginOTPRequest' }
    } */
    /* #swagger.responses[200] = {
        description: 'Login successful',
        schema: { $ref: '#/definitions/ApiResponse' }
    } */
    try {
        const { email, password, otp } = req.body || {};
        const IP = req?.ip;

        if (!email || !password || !otp) {
            return res.status(400).json({
                success: false,
                message: "Missing required parameters"
            });
        }

        const [rows] = await pool.query(
            "SELECT username FROM users WHERE login_id = ? AND password = ? AND status = ?",
            [email, password, '1']
        );

        if (!rows.length) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password"
            });
        }

        const { username } = rows[0];

        const max_expire_unix = FUTURE_UNIX_TIMESTAMP(3);

        const [check_row] = await pool.query("SELECT * FROM `otps` WHERE username = ? AND type = ? AND expire_date < ? AND status = ? AND otp = ?", [username, 'login', max_expire_unix, '0', otp]);

        if (check_row.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired OTP. Please try again."
            });
        }

        const token_id = RANDOM_STRING(30);
        const token = RANDOM_STRING(50);
        const expire_date = moment().add(30, 'days').unix();

        await pool.query("INSERT INTO `tokens` (`token_id`, `username`, `token`, `create_date`, `create_by`, `create_ip`, `last_used_date`, `last_ip`, `status`,`expire_date`) VALUES (?,?,?,?,?,?,?,?,?,?)", [token_id, username, token, UNIX_TIMESTAMP(), username, IP, UNIX_TIMESTAMP(), IP, '1', expire_date]);

        // Branch access list (owned + mapped)
        // - Owned: branches created/owned by this user in branch_list -> owned: true
        // - Mapped: branches assigned to this user in branch_mapping -> owned: false
        const [ownedRows] = await pool.query(
            "SELECT branch_id, name FROM branch_list WHERE username = ? AND (status = '1' OR status = 1)",
            [username]
        ).catch(async () => {
            // Fallback if status column differs/missing
            const [rows] = await pool.query("SELECT branch_id, name FROM branch_list WHERE username = ?", [username]);
            return [rows];
        });

        const [mappedRows] = await pool.query(
            `SELECT bm.branch_id, bl.name
             FROM branch_mapping bm
             LEFT JOIN branch_list bl ON bl.branch_id = bm.branch_id
             WHERE bm.username = ?
               AND (bm.is_deleted = '0' OR bm.is_deleted = 0)
               AND (bm.status = '1' OR bm.status = 1)`,
            [username]
        ).catch(async () => {
            // Fallback if is_deleted/status columns differ/missing
            const [rows] = await pool.query(
                `SELECT bm.branch_id, bl.name
                 FROM branch_mapping bm
                 LEFT JOIN branch_list bl ON bl.branch_id = bm.branch_id
                 WHERE bm.username = ?`,
                [username]
            );
            return [rows];
        });

        const branches = [];
        const ownedSet = new Set();

        (ownedRows || []).forEach((b) => {
            if (!b?.branch_id) return;
            ownedSet.add(String(b.branch_id));
            branches.push({
                branch_id: b.branch_id,
                name: b?.name ?? null,
                owned: true
            });
        });

        (mappedRows || []).forEach((b) => {
            if (!b?.branch_id) return;
            if (ownedSet.has(String(b.branch_id))) return; // If you own it, return only owned:true
            branches.push({
                branch_id: b.branch_id,
                name: b?.name ?? null,
                owned: false
            });
        });


        return res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            expire_date,
            branches
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to send OTP"
        });
    }
});


router.post('/google-login', async (req, res) => {

    if (req.body && Object.keys(req.body).length > 0) {
        var data = req.body?.data || '';
        var key = req.body?.key || '';
    }

    const decrypt = Decrypt(data, key);
    const google_token = decrypt.google_token;

    const client = new OAuth2Client(GOOGLE_CLIENT_ID);

    try {
        const ticket = await client.verifyIdToken({
            idToken: google_token,
            audience: GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();

        const email = payload.email;

        const [check_row] = await pool.query("SELECT * FROM users WHERE email = ? AND status = ?", [email, '1']);

        if (check_row.length == 0) {
            return res.status(200).json({ error: 'Account not found on the google account' });
        }

        const user_data = check_row[0];
        const username = user_data?.username;
        const login_token = RANDOM_STRING(50);
        const name = user_data?.name;
        const country_code = user_data?.country_code;
        const mobile = user_data?.mobile;

        await pool.query("INSERT INTO `login_token`(`username`, `create_date`, `create_by`, `modify_date`, `modify_by`, `token`, `expire_date`, `status`) VALUES (?,?,?,?,?,?,?,?)", [username, TIMESTAMP(), username, TIMESTAMP(), username, login_token, FUTURE_TIMESTAMP(43200), '1']);

        const [project_row] = await pool.query("SELECT project_mapping.type, aisensy_projects.* FROM project_mapping JOIN aisensy_projects ON aisensy_projects.project_id = project_mapping.project_id WHERE project_mapping.username = ? AND project_mapping.is_deleted = ? AND aisensy_projects.status = ?", [username, '0', '1']);

        const projects = [];

        if (project_row.length > 0) {
            project_row.forEach(element => {
                var project_object = {
                    name: element.project_name,
                    project_id: element.project_id,
                }

                projects.push(project_object);
            });
        }

        const project_count = projects.length;


        return res.status(200).json(
            {
                error: false,
                username,
                token: login_token,
                profile: {
                    name,
                    country_code,
                    mobile,
                    email,
                },
                project_count,
                projects: projects
            }
        );

    } catch (error) {
        return res.status(200).json({
            error: 'Google authentication failed',
            e: error
        });
    }
});

router.post('/google-register', async (req, res) => {

    if (req.body && Object.keys(req.body).length > 0) {
        var data = req.body?.data || '';
        var key = req.body?.key || '';
    }

    const decrypt = Decrypt(data, key);
    const google_token = decrypt.google_token;

    const client = new OAuth2Client(GOOGLE_CLIENT_ID);


    const conn = await pool.getConnection();

    try {
        const ticket = await client.verifyIdToken({
            idToken: google_token,
            audience: GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();

        const email = payload.email;
        const name = payload.name;

        const [check_row] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);

        if (check_row.length > 0) {
            return res.status(200).json({ error: 'User already registered. Please signin with google' });
        }


        var username = RANDOM_STRING(20);
        var password = GENERATE_PASSWORD(8);
        await pool.query("INSERT INTO `users`(`username`, `password`, `email`, `name`, `create_date`, `create_by`, `modify_date`, `modify_by`, `status`) VALUES (?,?,?,?,?,?,?,?,?)", [username, password, email, name, TIMESTAMP(), username, TIMESTAMP(), username, '1']);


        const login_token = RANDOM_STRING(50);

        await pool.query("INSERT INTO `login_token`(`username`, `create_date`, `create_by`, `modify_date`, `modify_by`, `token`, `expire_date`, `status`) VALUES (?,?,?,?,?,?,?,?)", [username, TIMESTAMP(), username, TIMESTAMP(), username, login_token, FUTURE_TIMESTAMP(43200), '1']);


        // REMOVE THIS DEFAULT MAPPING ON PRODUCTION
        await pool.query("INSERT INTO `project_mapping`(`unique_id`, `project_id`, `username`, `type`, `create_by`, `create_date`, `modify_by`, `modify_date`, `permission_id`, `is_deleted`) VALUES (?,?,?,?,?,?,?,?,?,?)", [RANDOM_STRING(30), '689d783e207f0b0c309fa07c', username, 'agent', username, TIMESTAMP(), username, TIMESTAMP(), '123456', '0']);

        const [project_row] = await pool.query("SELECT project_mapping.type, aisensy_projects.* FROM project_mapping JOIN aisensy_projects ON aisensy_projects.project_id = project_mapping.project_id WHERE project_mapping.username = ? AND project_mapping.is_deleted = ? AND aisensy_projects.status = ?", [username, '0', '1']);

        await conn.commit();

        const projects = [];

        if (project_row.length > 0) {
            project_row.forEach(element => {
                var project_object = {
                    name: element.project_name,
                    project_id: element.project_id,
                }

                projects.push(project_object);
            });
        }

        const project_count = projects.length;

        return res.status(200).json(
            {
                error: false,
                username,
                token: login_token,
                profile: {
                    name,
                    country_code: null,
                    mobile: null,
                    email,
                },
                project_count,
                projects: projects
            }
        );

    } catch (error) {
        await conn.rollback();
        return res.status(200).json({
            error: 'Google authentication failed',
            e: error
        });
    }
});

export default router
