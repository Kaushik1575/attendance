import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'geo-fence-secret-key';

export function signToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}

export function verifyToken(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        req.user = jwt.verify(auth.slice(7), JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'Token expired or invalid' });
    }
}
