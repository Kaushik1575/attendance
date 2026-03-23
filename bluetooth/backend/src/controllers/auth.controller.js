import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import supabase from '../config/supabase.js';
import { mockStudents, mockTeachers, mockBlockedLogs, otpStore } from '../config/mockData.js';
import { signToken } from '../middlewares/auth.middleware.js';
import { resend, SENDER_EMAIL } from '../services/notificationService.js';

export const sendOtp = async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes
    otpStore.set(email, { otp, expiry });

    const isResendConfigured = process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 're_YOUR_RESEND_KEY_HERE';

    console.log(`[AUTH] Sending OTP for ${email}: ${otp}`);

    if (isResendConfigured) {
        try {
            console.log(`[AUTH] Sending OTP to ${email} from ${SENDER_EMAIL}...`);
            const isFaculty = req.body.isTeacher === true || email.includes('faculty') || email.includes('teacher');
            const roleName = isFaculty ? 'Faculty/Staff' : 'Student';
            const subjectLine = isFaculty ? 'GeoAttend Faculty Authentication' : 'Verify your Student Account';

            const { data, error } = await resend.emails.send({
                from: `GeoAttend Authentication <${SENDER_EMAIL}>`,
                to: email,
                subject: subjectLine,
                html: `
                    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                        <div style="text-align: center; margin-bottom: 25px;">
                            <h1 style="color: #1e3a8a; margin: 0; font-size: 24px;">GeoAttend System</h1>
                        </div>
                        <h2 style="color: #334155; font-size: 18px; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px; margin-bottom: 20px;">${roleName} Verification</h2>
                        <p style="color: #475569; font-size: 15px; line-height: 1.6;">Hello,</p>
                        <p style="color: #475569; font-size: 15px; line-height: 1.6;">A registration attempt was made using this email address. To complete your account setup, please use the following secure verification code:</p>
                        <div style="background: #f8fafc; padding: 25px; text-align: center; border-radius: 8px; margin: 30px 0; border: 1px solid #e2e8f0;">
                            <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #4f46e5;">${otp}</span>
                        </div>
                        <p style="font-size: 13px; color: #ef4444; font-weight: bold; margin-top: 10px;">⚠️ This code will expire in exactly 10 minutes.</p>
                        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0 20px 0;" />
                        <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0;">
                            If you did not request this verification, please ignore this email. Your information remains secure.<br/><br/>
                            System generated transmission • Do not reply directly to this email.
                        </p>
                    </div>
                `
            });

            if (error) {
                console.error('[AUTH] Resend Error:', error);
                // Return detailed error if in dev, but generic message in prod
                return res.status(500).json({ 
                    error: `Email Service Error: ${error.message || 'Could not send verification code.'}`,
                    details: error
                });
            }

            console.log(`[AUTH] Email Success ID: ${data.id}`);
            res.json({ message: 'Verification code sent!' });
        } catch (err) {
            console.error('[AUTH] Unexpected Email Error:', err);
            res.status(500).json({ error: 'Unexpected error while sending email. Please check server logs.' });
        }
    } else {
        console.log(`[DEV MODE] OTP for ${email}: ${otp}`);
        res.json({ message: 'OTP generated (Mock Mode - check server console)', otp });
    }
};

export const verifyOtp = async (req, res) => {
    const { email, otp } = req.body;
    const record = otpStore.get(email);

    if (!record || record.otp !== otp || Date.now() > record.expiry) {
        return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    res.json({ message: 'OTP verified successfully', success: true });
};

export const registerStudent = async (req, res) => {
    const { name, roll_no, mobile, branch, semester, section, email, parent_mobile, password, otp } = req.body;

    if (!name || !roll_no || !email || !password || !mobile || !branch || !semester || !section || !otp) {
        return res.status(400).json({ error: 'All fields including OTP are required' });
    }

    const record = otpStore.get(email);
    if (!record || record.otp !== otp || Date.now() > record.expiry) {
        return res.status(400).json({ error: 'Invalid or expired OTP. Please verify again.' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const studentData = {
        name, roll_no, mobile, branch, semester, section, email, parent_mobile, password_hash,
        role: 'student', current_session_token: null
    };

    if (supabase) {
        const { data, error } = await supabase.from('students').insert([studentData]).select();
        if (error) {
            if (error.code === '23505') return res.status(400).json({ error: 'Email or Roll Number already exists' });
            return res.status(400).json({ error: error.message });
        }
        otpStore.delete(email);
        return res.json({ message: 'Registration successful', student: data[0] });
    } else {
        const student = { id: Date.now().toString(), ...studentData };
        mockStudents.push(student);
        otpStore.delete(email);
        return res.json({ message: 'Registration successful (Mock Mode)', student });
    }
};

export const registerTeacher = async (req, res) => {
    const { name, username, mobile, email, password, securityToken, otp } = req.body;

    if (securityToken !== '157500') {
        return res.status(401).json({ error: 'Invalid Security Token. Access Denied.' });
    }

    if (!name || !username || !email || !password || !mobile || !otp) {
        return res.status(400).json({ error: 'All fields including OTP are required' });
    }

    const record = otpStore.get(email);
    if (!record || record.otp !== otp || Date.now() > record.expiry) {
        return res.status(400).json({ error: 'Invalid or expired OTP. Please verify again.' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const teacherData = { name, username, mobile, email, password_hash, role: 'teacher' };

    if (supabase) {
        const { data, error } = await supabase.from('teachers').insert([teacherData]).select();
        if (error) {
            if (error.code === '23505') return res.status(400).json({ error: 'Email or Username already exists' });
            return res.status(400).json({ error: error.message });
        }
        otpStore.delete(email);
        return res.json({ message: 'Teacher Registered successfully', teacher: data[0] });
    } else {
        const teacher = { id: Date.now().toString(), ...teacherData };
        mockTeachers.push(teacher);
        otpStore.delete(email);
        return res.json({ message: 'Teacher Registration successful (Mock Mode)', teacher });
    }
};

export const getMe = async (req, res) => {
    const { id, role } = req.user;
    let userData;

    if (supabase) {
        const table = role === 'teacher' ? 'teachers' : 'students';
        const { data } = await supabase.from(table).select('*').eq('id', id).single();
        userData = data;
    } else {
        const list = role === 'teacher' ? mockTeachers : mockStudents;
        userData = list.find(u => u.id === id);
    }

    if (!userData) return res.status(404).json({ error: 'User not found' });

    const { password_hash, ...safeUser } = userData;
    let remaining_block_seconds = 0;
    if (userData.blocked_until) {
        remaining_block_seconds = Math.max(0, Math.floor((new Date(userData.blocked_until).getTime() - Date.now()) / 1000));
    }

    res.json({ ...safeUser, remaining_block_seconds });
};

export const login = async (req, res) => {
    const { email, roll_no, password, role } = req.body;
    let user;

    if (supabase) {
        const table = role === 'teacher' ? 'teachers' : 'students';
        const identifier = role === 'teacher' ? 'email' : 'roll_no';
        const value = role === 'teacher' ? email : roll_no;

        const { data, error } = await supabase.from(table).select('*').eq(identifier, value).single();
        if (error || !data) return res.status(401).json({ error: `${role.charAt(0).toUpperCase() + role.slice(1)} account not found` });
        user = data;
    } else {
        if (role === 'teacher') user = mockTeachers.find(u => u.email === email);
        else user = mockStudents.find(u => u.roll_no === roll_no);
        if (!user) return res.status(401).json({ error: `${role.charAt(0).toUpperCase() + role.slice(1)} not found (Mock Mode)` });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid password' });

    if (user.blocked_until) {
        const blockEnds = new Date(user.blocked_until).getTime();
        const now = Date.now();
        if (blockEnds > now) {
            const minutes = Math.ceil((blockEnds - now) / 60000);
            return res.status(403).json({
                error: `SECURITY GAP: This account is restricted for ${minutes} more minutes. Please ask your Prof. to 'Reset Device Binding' if you have changed your phone.`
            });
        }
    }

    const session_token = crypto.randomUUID();
    const userRole = user.role || role;
    const token = signToken({
        id: user.id, email: user.email, role: userRole, branch: user.branch,
        section: user.section, semester: user.semester, session_token
    });

    let remaining_block_seconds = 0;
    if (user.blocked_until) {
        remaining_block_seconds = Math.max(0, Math.floor((new Date(user.blocked_until).getTime() - Date.now()) / 1000));
    }

    res.json({ token, user: { ...user, role: userRole, password_hash: undefined, remaining_block_seconds } });
};

export const logout = async (req, res) => {
    const { id, role } = req.user;
    if (role === 'student') {
        if (supabase) {
            await supabase.from('students').update({ current_session_token: null }).eq('id', id);
        } else {
            const student = mockStudents.find(s => s.id === id);
            if (student) student.current_session_token = null;
        }
    }
    res.json({ success: true, message: 'Logged out successfully' });
};
