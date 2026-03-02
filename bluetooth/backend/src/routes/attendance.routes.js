import express from 'express';
import { markAttendance, getAttendanceSummary } from '../controllers/attendance.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/mark', verifyToken, markAttendance);
router.get('/summary', verifyToken, getAttendanceSummary);

export default router;
