import express from 'express';
import { getStats, getUnauthorizedLogs, resetBlock, resetDevice, cronCleanup } from '../controllers/admin.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/stats', getStats);
router.get('/unauthorized-logs', verifyToken, getUnauthorizedLogs);
router.post('/reset-block/:studentId', verifyToken, resetBlock);
router.post('/reset-device/:studentId', verifyToken, resetDevice);
router.get('/cron/check-sessions', verifyToken, cronCleanup);

export default router;
