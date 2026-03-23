import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// Create Express app
const app = express();
const PORT = process.env.PORT || 5000;

// --- Middleware ---
const allowedOrigins = [
    'https://att-m1rz.vercel.app',
    'https://geoatnd-e6yi.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
];

app.use(cors({
    origin: (origin, callback) => {
        const isVercel = origin && origin.endsWith('.vercel.app');
        const isLocal = !origin || origin.startsWith('http://localhost:');
        const isCustomDomain = origin && origin.includes('qzz.io');

        if (isVercel || isLocal || isCustomDomain || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(null, origin || true);
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.sendStatus(200);
});

app.use((req, res, next) => {
    if (req.path.includes('//')) {
        const cleanPath = req.path.replace(/\/+/g, '/');
        req.url = cleanPath;
    }
    next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- Health Check ---
app.get('/', (req, res) => {
    res.json({
        status: '✅ GeoAttend Backend is running (Modular)',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// --- Mount Express Routers ---
import authRoutes from './src/routes/auth.routes.js';
import sessionRoutes from './src/routes/session.routes.js';
import attendanceRoutes from './src/routes/attendance.routes.js';
import adminRoutes from './src/routes/admin.routes.js';
import reportRoutes from './src/routes/report.routes.js';

app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportRoutes);

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`\n🚀 Geo-Fenced Smart Attendance API running at http://localhost:${PORT}`);
        console.log(`📍 Haversine geo-fence: 10m strict radius (anti-proxy enforced)`);
        console.log(`🔐 JWT auth enabled`);
    });
}

// Export the Express API for Vercel Serverless Functions
export default app;
