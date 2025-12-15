import moment from "moment";
import pool from "../db.js";

const RANDOM_STRING = (length = 30) => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789-_.~';
    let randomPart = '';

    for (let i = 0; i < length; i++) {
        randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const timestamp = new Date().getTime().toString();
    const final = randomPart + timestamp;

    const shuffled = final
        .split('')
        .sort(() => Math.random() - 0.5)
        .join('');

    return shuffled;
};

const RANDOM_INTEGER = (length = 6) => {
    if (!length || length < 1) return 0;

    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;

    return Math.floor(min + Math.random() * (max - min + 1));
}

const UNIX_TIMESTAMP = () => {
    return moment().unix();
}

const FUTURE_UNIX_TIMESTAMP = (minutes = 0) => {
    return moment().add(minutes, "minutes").unix();
}

const TIMESTAMP = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mi = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");

    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function GENERATE_PASSWORD(length = 8) {
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const special = "@#%";
    const allChars = upper + lower + numbers + special;

    let password = "";

    // Ensure at least one of each type
    password += upper[Math.floor(Math.random() * upper.length)];
    password += lower[Math.floor(Math.random() * lower.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    while (password.length < length) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    password = password.split("").sort(() => Math.random() - 0.5).join("");

    return password;
}

function IS_STRONG_PASSWORD(password) {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return regex.test(password);
}

async function USER_DATA(username = '') {
    const [row] = await pool.query("SELECT * FROM users WHERE username = ?", [username]);

    if (row.length == 1) {
        return row[0];
    } else {
        return {};
    }
}


export {
    RANDOM_STRING,
    TIMESTAMP,
    GENERATE_PASSWORD,
    IS_STRONG_PASSWORD,
    USER_DATA,
    RANDOM_INTEGER,
    UNIX_TIMESTAMP,
    FUTURE_UNIX_TIMESTAMP
};