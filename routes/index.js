import express from "express";
import path from "path";
const router = express.Router();
import authRoutes from "./auth/auth.routes.js";
import clientRoutes from "./clients/client.routes.js";
import taskRoutes from "./tasks/task.routes.js";
import uploadRoutes from "./uploads/upload.routes.js";
import mediaRoutes from "./media/media.routes.js";
import settingsRoutes from "./settings/staff.routes.js";
import permissionRoutes from "./settings/permission.routes.js";
import webhookRoutes from "./webhook/webhook.routes.js";

router.use("/auth", authRoutes);
router.use("/clients", clientRoutes);
router.use("/tasks", taskRoutes);
router.use("/upload", uploadRoutes);
router.use("/media", mediaRoutes);
router.use("/settings/staff", settingsRoutes);
router.use("/settings/permission", permissionRoutes);
router.use("/webhook", webhookRoutes);
// Static chat media files
router.use("/chat-media", express.static(path.join(process.cwd(), "/media/chat")));

export default router;
