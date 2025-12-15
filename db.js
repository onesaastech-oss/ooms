import mysql from "mysql2/promise";

const pool = mysql.createPool({
    host: "193.203.184.226",
    user: "u245990328_ooms_v4",
    password: "/+|07vs6d*Z",
    database: "u245990328_ooms_v4",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: "utf8mb4"
});

export default pool;
