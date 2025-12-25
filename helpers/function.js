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

const TODAY_DATE = () => {
    return moment().format("YYYY-MM-DD")
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


async function SET_OPENING_BALANCE({
    req = {},
    type = "0",
    party1_type = "",
    party1_id = "",
    amount = 0,
    remark = "",
    transaction_date = moment().format("YYYY-MM-DD")
}) {
    const username = req?.headers["username"] || "";
    const branch_id = req?.headers["branch_id"] || "";

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const transaction_id = RANDOM_STRING(30);
        const invoice_id = RANDOM_STRING(30);

        // CHECK INVOICE PREFIX (IF not exist then throw error)

        const [invoice_prefix] = await connection.query("SELECT * FROM `invoice_prefix` WHERE `branch_id` = ? AND `type` = ? AND `status` = ? AND `issue_date` <= ? AND `expire_date` >= ?", [branch_id, "opening balance", "1", TODAY_DATE(), TODAY_DATE()]);

        if (invoice_prefix.length == 0) {
            throw new Error("Invoice prefix not set.");
        }

        const invoice_data = invoice_prefix[0];
        const invoice_primary_id = invoice_data?.id;
        const serial = Number(invoice_data?.current || 0) + 1;

        const invoice_no = `${invoice_data?.prefix}${serial}`


        await connection.query("INSERT INTO `invoice` (`invoice_id`, `branch_id`, `invoice_no`, `create_by`, `modify_by`, `type`, `transaction_id`, `party1_type`, `party1_id`, `amount`, `total`, `remark`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", [invoice_id, branch_id, invoice_no, username, username, "opening balance", transaction_id, party1_type, party1_id, amount, amount, remark]);

        await connection.query("INSERT INTO `transactions` (`branch_id`, `transaction_id`, `create_by`, `modify_by`, `transaction_date`, `amount`, `type`, `transaction_type`, `invoice_id`, `invoice_no`, `party1_type`, `party1_id`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", [branch_id, transaction_id, username, username, transaction_date, amount, type, "opening balance", invoice_id, invoice_no, party1_type, party1_id]);

        await connection.query("UPDATE `invoice_prefix` SET `current`= ? WHERE `id` = ?", [serial, invoice_primary_id]);

        await connection.commit();
        return true;

    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function GET_BALANCE({
    branch_id = "",
    party_id = "",
    party_type = ""
}) {

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [total_0] = await connection.query("SELECT SUM(amount) AS value FROM transactions WHERE branch_id = ? AND type = ? AND party1_type = ? AND party1_id = ?", [branch_id, '0', party_type, party_id]);
        const debit = Number(total_0[0]?.value || 0);

        const [total_1] = await connection.query("SELECT SUM(amount) AS value FROM transactions WHERE branch_id = ? AND type = ? AND party1_type = ? AND party1_id = ?", [branch_id, '1', party_type, party_id]);
        const credit = Number(total_1[0]?.value || 0);

        const balance = debit - credit;

        await connection.commit();
        return balance;

    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}


export {
    RANDOM_STRING,
    GENERATE_PASSWORD,
    IS_STRONG_PASSWORD,
    USER_DATA,
    RANDOM_INTEGER,
    SET_OPENING_BALANCE,
    TODAY_DATE,
    GET_BALANCE
};