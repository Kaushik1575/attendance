import express from 'express';
import { sendReportEmail } from '../controllers/report.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/send-email', verifyToken, sendReportEmail);

export default router;
