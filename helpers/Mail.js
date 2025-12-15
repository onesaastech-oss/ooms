import nodemailer from "nodemailer";
import { APP_NAME } from "./Config.js";

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: "souravadhikary1916@gmail.com",
        pass: "srsl kqdl pdpz upqo"
    }
});

export const SendMail = async ({ to, subject, html }) => {
    return await transporter.sendMail({
        from: `"${APP_NAME}" <souravadhikary1916@gmail.com>`,
        to,
        subject,
        html
    });
};
