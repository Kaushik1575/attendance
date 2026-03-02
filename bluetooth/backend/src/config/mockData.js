import bcrypt from 'bcryptjs';

const MOCK_STUDENT_HASH = bcrypt.hashSync('student123', 10);
const MOCK_ADMIN_HASH = bcrypt.hashSync('admin123', 10)

export let mockStudents = [
    {
        id: 's1',
        name: 'Arjun Sharma',
        roll_no: '101',
        mobile: '9876543210',
        branch: 'CSE',
        semester: '5',
        section: 'A',
        email: 'arjun@student.edu',
        parent_mobile: '9876543211',
        password_hash: MOCK_STUDENT_HASH,
        role: 'student',
        current_session_token: null
    },
    {
        id: 's2',
        name: 'Priya Patel',
        roll_no: '102',
        mobile: '9876543212',
        branch: 'CSE',
        semester: '5',
        section: 'A',
        email: 'priya@student.edu',
        parent_mobile: '9876543213',
        password_hash: MOCK_STUDENT_HASH,
        role: 'student',
        current_session_token: null
    },
    {
        id: 's3',
        name: 'Rohan Verma',
        roll_no: '103',
        mobile: '9876543214',
        branch: 'CSE',
        semester: '5',
        section: 'A',
        email: 'rohan@student.edu',
        parent_mobile: '9876543215',
        password_hash: MOCK_STUDENT_HASH,
        role: 'student',
        current_session_token: null
    }
];

export let mockTeachers = [
    {
        id: 't1',
        name: 'Admin',
        username: 'admin',
        mobile: '9000000000',
        email: 'admin@college.edu',
        password_hash: MOCK_ADMIN_HASH,
        role: 'teacher'
    },
    {
        id: 't2',
        name: 'Demo Teacher',
        username: 'teacher',
        mobile: '9000000001',
        email: 'teacher@college.edu',
        password_hash: bcrypt.hashSync('teacher123', 10),
        role: 'teacher'
    }
];

export let mockSessions = [];
export let mockRecords = [];
export let mockBlockedLogs = [];

export const otpStore = new Map(); // email -> { otp, expiry }
export const sessionTimeouts = new Map(); // sessionId -> timeoutHandle
