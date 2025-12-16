import pool from "../db.js";

async function checkToken(username, token) {
    try {
        const [rows] = await pool.query(
            "SELECT login_token.id,users.status AS user_status FROM login_token JOIN users ON users.username = login_token.username WHERE login_token.token = ? AND login_token.username = ?",
            [token, username]
        );

        if (rows.length == 1) {
            var user_status = rows[0]?.user_status;
            if (user_status == '1') {
                return true;
            } else {
                return false;
            }
        } else {
            return false;
        }

    } catch (err) {
        console.error("Token check error:", err);
        return false;
    }
}

// Express middleware
async function auth(req, res, next) {
    const token = req.headers["token"] ? req.headers["token"] : '';
    const username = req.headers["username"] ? req.headers["username"] : '';

    if (!token || !username) {
        return res.status(200).json({ error: "Session expired" });
    }

    const isValid = await checkToken(username, token);

    if (!isValid) {
        return res.status(200).json({ error: "Session expired" });
    }

    next();
}


export { auth }
