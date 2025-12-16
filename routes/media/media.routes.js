import express from "express";
import path from "path";
import fs from "fs";
import mime from "mime";
import { fileURLToPath } from "url";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve uploaded files
router.get("/upload/:filename", (req, res) => {
    const filePath = path.join(path.join(__dirname, "../../media/upload/temp"), req.params.filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send("File not found");
    }

    const type = mime.getType(filePath);

    if (type && type.startsWith("video")) {
        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

            const chunkSize = end - start + 1;
            const file = fs.createReadStream(filePath, { start, end });

            res.writeHead(206, {
                "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                "Accept-Ranges": "bytes",
                "Content-Length": chunkSize,
                "Content-Type": type
            });

            file.pipe(res);
        } else {
            res.writeHead(200, {
                "Content-Length": fileSize,
                "Content-Type": type
            });
            fs.createReadStream(filePath).pipe(res);
        }
    } else {
        res.setHeader("Content-Type", type || "application/octet-stream");
        res.setHeader("Content-Disposition", "inline");
        fs.createReadStream(filePath).pipe(res);
    }
});

// Serve error files
router.get("/error/:filename", (req, res) => {
    const filePath = path.join(path.join(__dirname, "../../media/error"), req.params.filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send("File not found");
    }

    const type = mime.getType(filePath);

    if (type && type.startsWith("video")) {
        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

            const chunkSize = end - start + 1;
            const file = fs.createReadStream(filePath, { start, end });

            res.writeHead(206, {
                "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                "Accept-Ranges": "bytes",
                "Content-Length": chunkSize,
                "Content-Type": type
            });

            file.pipe(res);
        } else {
            res.writeHead(200, {
                "Content-Length": fileSize,
                "Content-Type": type
            });
            fs.createReadStream(filePath).pipe(res);
        }
    } else {
        res.setHeader("Content-Type", type || "application/octet-stream");
        res.setHeader("Content-Disposition", "inline");
        fs.createReadStream(filePath).pipe(res);
    }
});

export default router;

