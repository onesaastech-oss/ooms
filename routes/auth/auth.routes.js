import express from "express";
const router = express.Router();
import pool from "../../db.js";
import { GENERATE_PASSWORD, IS_STRONG_PASSWORD, RANDOM_INTEGER, RANDOM_STRING } from "../../helpers/function.js";
import { Decrypt } from "../../helpers/Decrypt.js";
import { auth } from "../../middleware/auth.js";
import { APP_NAME, GOOGLE_CLIENT_ID } from "../../helpers/Config.js";
import { OAuth2Client } from "google-auth-library";
import { SendMail } from "../../helpers/Mail.js";

router.post("/login/send-otp", async (req, res) => {
    // #swagger.tags = ['Authentication']
    // #swagger.summary = 'Send OTP for login'
    // #swagger.description = 'Validates user credentials and sends an OTP to the registered email address for login verification.'
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
    /* #swagger.responses[400] = {
          description: 'Missing required parameters',
          schema: { $ref: '#/definitions/ApiResponse' }
    } */
    /* #swagger.responses[401] = {
          description: 'Invalid username or password',
          schema: { $ref: '#/definitions/ApiResponse' }
    } */
    /* #swagger.responses[500] = {
          description: 'Server error',
          schema: { $ref: '#/definitions/ApiResponse' }
    } */

    let conn;

    try {
        const { email, password } = req.body ?? {};

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Missing required parameters (email, password).",
            });
        }

        conn = await pool.getConnection();
        await conn.beginTransaction();

        // NOTE: Best practice is hashed password (bcrypt). Keeping your current DB design unchanged.
        const [rows] = await conn.execute(
            "SELECT username, login_id FROM users WHERE login_id = ? AND password = ? AND status = ? LIMIT 1",
            [email, password, "1"]
        );

        if (rows.length === 0) {
            await conn.rollback();
            return res.status(401).json({
                success: false,
                message: "Invalid username or password.",
            });
        }

        const { username, login_id } = rows[0];

        // OTP generation
        const otp_id = RANDOM_STRING();
        const otp = RANDOM_INTEGER(); // ensure this returns a numeric OTP (e.g., 6 digits)

        // Optional: invalidate previous active OTPs for this user/type to prevent confusion
        await conn.execute(
            "UPDATE otps SET status = ? WHERE username = ? AND type = ? AND status = ?",
            ["1", username, "login", "0"]
        );

        await conn.execute(
            `INSERT INTO otps 
        (otp_id, type, otp, username, create_date, expire_date, status, remark)
       VALUES (?,?,?,?,CURRENT_TIMESTAMP,DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 3 MINUTE),?,?)`,
            [otp_id, "login", otp, username, "0", "Email login OTP"]
        );

        // Fetch expire_date from DB (so backend doesn't calculate time)
        const [otpMeta] = await conn.query(
            "SELECT expire_date FROM otps WHERE otp_id = ? ORDER BY id DESC LIMIT 1",
            [otp_id]
        );

        await conn.commit();

        // Send email after DB commit (so OTP exists even if mail sending fails intermittently)
        await SendMail({
            to: login_id, // use the stored login email, not only the request email
            subject: `Login OTP for ${APP_NAME}`,
            html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { margin:0; padding:0; background:#f3f4f6; font-family: Arial, sans-serif; }
    .container { max-width:420px; margin:40px auto; background:#fff; border-radius:10px; padding:24px; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,.1); }
    h2 { color:#111827; margin-bottom:8px; }
    p { color:#6b7280; font-size:14px; }
    .otp { margin:20px 0; font-size:28px; font-weight:700; letter-spacing:8px; color:#4f46e5; }
    .footer { font-size:12px; color:#9ca3af; margin-top:24px; }
  </style>
</head>
<body>
  <div class="container">
    <h2>OTP Verification</h2>
    <p>Use the following OTP to complete your login</p>
    <div class="otp">${otp}</div>
    <p>This OTP is valid for a limited time. Please do not share it with anyone.</p>
    <div class="footer">© ${new Date().getFullYear()} ${APP_NAME}</div>
  </div>
</body>
</html>`,
        });

        return res.status(200).json({
            success: true,
            message: "OTP sent successfully",
            expire: otpMeta?.[0]?.expire_date ?? null,
        });
    } catch (err) {
        console.error("LOGIN OTP ERROR:", err);

        if (conn) {
            try {
                await conn.rollback();
            } catch (_) { }
        }

        return res.status(500).json({
            success: false,
            message: "Failed to send OTP",
        });
    } finally {
        if (conn) conn.release();
    }
});

router.post("/login/email", async (req, res) => {
    // #swagger.tags = ['Authentication']
    // #swagger.summary = 'Login with email and OTP'
    // #swagger.description = 'Validates email + password, verifies OTP, creates a session token, and returns mapped branches.'
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

    let conn;

    try {
        const { email, password, otp } = req.body || {};
        const IP = req.ip;

        if (!email || !password || !otp) {
            return res.status(400).json({
                success: false,
                message: "Missing required parameters (email, password, otp)",
            });
        }

        conn = await pool.getConnection();
        await conn.beginTransaction();

        // 1) Validate user
        const [users] = await conn.query(
            "SELECT username FROM users WHERE login_id = ? AND password = ? AND status = ? LIMIT 1",
            [email, password, "1"]
        );

        if (!users.length) {
            await conn.rollback();
            return res.status(401).json({
                success: false,
                message: "Invalid username or password",
            });
        }

        const username = users[0].username;

        // 2) Validate OTP (must be un-used AND not expired)
        const [otpRows] = await conn.query(
            `SELECT id, otp, expire_date, status
         FROM otps
        WHERE username = ?
          AND type = ?
          AND otp = ?
          AND status = ?
          AND expire_date >= CURRENT_TIMESTAMP
        ORDER BY id DESC
        LIMIT 1`,
            [username, "login", otp, "0"]
        );

        if (!otpRows.length) {
            await conn.rollback();
            return res.status(400).json({
                success: false,
                message: "Invalid or expired OTP. Please try again.",
            });
        }

        // Mark OTP as used (so it cannot be reused)
        await conn.query("UPDATE otps SET status = ? WHERE id = ?", ["1", otpRows[0].id]);

        // 3) Create token
        const token_id = RANDOM_STRING(30);
        const token = RANDOM_STRING(50);
        await conn.query(
            `INSERT INTO tokens
        (token_id, username, token, create_date, create_by, create_ip, last_used_date, last_ip, status, expire_date)
       VALUES (?,?,?,CURRENT_TIMESTAMP,?,?,CURRENT_TIMESTAMP,?,'1',DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 DAY))`,
            [token_id, username, token, username, IP, IP]
        );

        const [tokenMeta] = await conn.query(
            "SELECT expire_date FROM tokens WHERE token_id = ? LIMIT 1",
            [token_id]
        );

        // 4) Fetch branches
        const [map_row] = await conn.query(
            `SELECT branch_mapping.type, branch_list.name, branch_list.branch_id
         FROM branch_mapping
         LEFT JOIN branch_list ON branch_list.branch_id = branch_mapping.branch_id
        WHERE branch_mapping.username = ?
          AND branch_mapping.is_accepted = ?
          AND branch_mapping.status = ?
          AND branch_mapping.is_deleted = ?`,
            [username, 1, 1, 0]
        );

        await conn.commit();

        const branches = [];
        for (let i = 0; i < map_row.length; i++) {
            const element = map_row[i];
            branches.push({
                branch_id: element?.branch_id,
                name: element?.name,
                owned: element?.type === "admin",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Login successful",
            username,
            token,
            expire_date: tokenMeta?.[0]?.expire_date ?? null,
            branches,
        });
    } catch (err) {
        if (conn) {
            try {
                await conn.rollback();
            } catch (_) { }
        }

        console.error("LOGIN EMAIL ERROR:", err);

        return res.status(500).json({
            success: false,
            message: "Login failed",
        });
    } finally {
        if (conn) conn.release();
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

        await pool.query(
            "INSERT INTO `login_token`(`username`, `create_date`, `create_by`, `modify_date`, `modify_by`, `token`, `expire_date`, `status`) VALUES (?,CURRENT_TIMESTAMP,?,CURRENT_TIMESTAMP,?,?,DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 DAY),'1')",
            [username, username, username, login_token]
        );

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
        await pool.query(
            "INSERT INTO `users`(`username`, `password`, `email`, `name`, `create_date`, `create_by`, `modify_date`, `modify_by`, `status`) VALUES (?,?,?,?,CURRENT_TIMESTAMP,?,CURRENT_TIMESTAMP,?,'1')",
            [username, password, email, name, username, username]
        );


        const login_token = RANDOM_STRING(50);

        await pool.query(
            "INSERT INTO `login_token`(`username`, `create_date`, `create_by`, `modify_date`, `modify_by`, `token`, `expire_date`, `status`) VALUES (?,CURRENT_TIMESTAMP,?,CURRENT_TIMESTAMP,?,?,DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 DAY),'1')",
            [username, username, username, login_token]
        );


        // REMOVE THIS DEFAULT MAPPING ON PRODUCTION
        await pool.query(
            "INSERT INTO `project_mapping`(`unique_id`, `project_id`, `username`, `type`, `create_by`, `create_date`, `modify_by`, `modify_date`, `permission_id`, `is_deleted`) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP,?,CURRENT_TIMESTAMP,?,'0')",
            [RANDOM_STRING(30), '689d783e207f0b0c309fa07c', username, 'agent', username, username, '123456']
        );

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
