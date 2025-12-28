import express from 'express';
import { exec } from 'child_process';

const router = express.Router();

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

