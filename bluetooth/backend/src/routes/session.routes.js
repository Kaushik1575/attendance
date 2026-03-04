import express from 'express';
import {
    startSession, cancelSession, resendAlerts,
    getActiveSessionStudent, getActiveSessionTeacher, closeSession, extendSession,
    getSessionHistory, getDetailedHistory, getSessionStudents, getSessionStats
} from '../controllers/session.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/start', verifyToken, startSession);
router.delete('/:id/cancel', verifyToken, cancelSession);
router.post('/:id/resend-alerts', verifyToken, resendAlerts);
router.get('/student/active', verifyToken, getActiveSessionStudent);
router.get('/teacher/active', verifyToken, getActiveSessionTeacher);
router.post('/:id/close', verifyToken, closeSession);
router.post('/:id/extend', verifyToken, extendSession);
router.get('/history', verifyToken, getSessionHistory);
router.get('/detailed-history', verifyToken, getDetailedHistory);
router.get('/:id/students', verifyToken, getSessionStudents);
router.get('/:id/stats', verifyToken, getSessionStats);

export default router;
