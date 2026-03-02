import express from 'express';
import { sendOtp, verifyOtp, registerStudent, registerTeacher, login, getMe, logout } from '../controllers/auth.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/register', registerStudent);
router.post('/register-teacher', registerTeacher);
router.post('/login', login);
router.get('/me', verifyToken, getMe);
router.post('/logout', verifyToken, logout);

export default router;
