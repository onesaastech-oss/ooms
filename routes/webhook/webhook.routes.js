import express from 'express';
import { exec } from 'child_process';

const router = express.Router();

/**
 * @swagger
 * /api/v1/webhook:
 *   post:
 *     tags: [Webhook]
 *     summary: Deployment webhook
 *     description: Executes deployment script to pull latest code and reload PM2
 *     responses:
 *       200:
 *         description: Deployment successful
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: Deploy success
 *       500:
 *         description: Deployment failed
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: Deploy failed
 * 
 * ignore it webhook test again another attempt
 */
router.post('/', (req, res) => {
    exec("sh /www/wwwroot/ooms-api/deploy.sh", (err, stdout, stderr) => {
        if (err) {
            console.error(stderr);
            return res.status(500).send("Deploy failed");
        }
        console.log(stdout);
        res.send("Deploy success");
    });
});

export default router;

