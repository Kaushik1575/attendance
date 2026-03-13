import supabase from '../config/supabase.js';
import { mockStudents, mockSessions, mockRecords } from '../config/mockData.js';
import { getDistance } from '../utils/helpers.js';

export const markAttendance = async (req, res) => {
    const { session_id, otp, lat, lng, rssi, accuracy, deviceId } = req.body;
    const student_id = req.user.id;

    // --- Student Verification ---
    let studentInfo = null;
    const role = req.user.role;

    // Security: Only students can mark attendance
    if (role !== 'student') {
        return res.status(403).json({ error: 'Access Denied: Only students can mark attendance. You are logged in as a ' + role });
    }

    if (supabase) {
        const { data, error } = await supabase
            .from('students')
            .select('id, current_session_token, email, name, roll_no, branch, section, semester, blocked_until')
            .eq('id', student_id)
            .single();

        if (error) {
            console.error('Attendance lookup error for student_id:', student_id, error);
            return res.status(401).json({ error: 'Student record not found in database. Please log in again.' });
        }
        studentInfo = data;
    } else {
        studentInfo = mockStudents.find(s => s.id === student_id);
    }

    if (!studentInfo) {
        return res.status(401).json({ error: 'Student account not found. If the server recently restarted, please register again.' });
    }

    // 0. Security Block Check
    if (studentInfo.blocked_until) {
        const blockEnds = new Date(studentInfo.blocked_until).getTime();
        if (blockEnds > Date.now()) {
            const remaining = Math.ceil((blockEnds - Date.now()) / 60000);
            return res.status(403).json({
                error: `ACTION DENIED: Your account is blocked for ${remaining} more minutes due to a security violation.`
            });
        }
    }

    // 1. Fetch Session
    let session = null;
    if (supabase) {
        const { data, error } = await supabase.from('attendance_sessions').select('*').eq('id', session_id).single();
        if (error || !data) return res.status(404).json({ error: 'Session not found' });
        session = data;
        session.teacher_lat = session.teacher_lat || session.lat;
        session.teacher_lng = session.teacher_lng || session.lng;
    } else {
        session = mockSessions.find(s => s.id === session_id);
        if (!session) return res.status(404).json({ error: 'Session not found' });
        session.teacher_lat = session.teacher_lat || session.lat;
        session.teacher_lng = session.teacher_lng || session.lng;
    }

    // 2. Check Expiry
    if (new Date() > new Date(session.expiry_time)) {
        return res.status(400).json({ error: 'Session expired' });
    }

    // 3. Verify OTP
    if (String(session.otp) !== String(otp)) {
        return res.status(400).json({ error: 'Invalid OTP' });
    }

    // --- Build Payload Dynamically with Anti-Proxy Check ---
    const device_fingerprint = req.body.deviceFingerprint;
    const ip_address = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    console.log(`[ATTENDANCE] Incoming Request - Student: ${student_id}, Session: ${session_id}, Fingerprint: ${device_fingerprint}`);

    // Anti-Proxy Check
    if (device_fingerprint || ip_address) {
        if (supabase) {
            if (device_fingerprint) {
                const { data: fingerprintData } = await supabase
                    .from('attendance_records')
                    .select('student_id')
                    .eq('session_id', session_id)
                    .eq('device_fingerprint', device_fingerprint)
                    .neq('student_id', student_id)
                    .limit(1);

                if (fingerprintData && fingerprintData.length > 0) {
                    return res.status(403).json({
                        error: 'DEVICE ALREADY USED: This mobile device has already been used by another student for this session.'
                    });
                }
            }
            if (ip_address && ip_address !== '127.0.0.1' && ip_address !== '::1') {
                const { data: ipData } = await supabase
                    .from('attendance_records')
                    .select('student_id')
                    .eq('session_id', session_id)
                    .eq('ip_address', ip_address)
                    .neq('student_id', student_id)
                    .limit(1);

                if (ipData && ipData.length > 0) {
                    return res.status(403).json({
                        error: 'PROXY DETECTED: Another student has already marked attendance from this network connection.'
                    });
                }
            }
        } else {
            const usedByFp = mockRecords.find(r => r.session_id === session_id && r.device_fingerprint === device_fingerprint && r.student_id !== student_id);
            const usedByIp = mockRecords.find(r => r.session_id === session_id && r.ip_address === ip_address && r.student_id !== student_id);
            if (usedByFp || (usedByIp && ip_address !== '127.0.0.1')) {
                return res.status(403).json({ error: 'DEVICE/NETWORK ALREADY USED (Mock)' });
            }
        }
    }

    // 4.6. Verify Location (Accuracy-Aware Geo-fence)
    const GEOFENCE_RADIUS = 50;
    const HARD_LIMIT = 110; // Loosened from 80m to handle jitter in large classes
    
    const distance = getDistance(session.teacher_lat, session.teacher_lng, lat, lng);
    
    // Security: Cap the accuracy discount to prevent spoofing (Max 40m allowance)
    const studentAccuracy = Math.min(parseFloat(accuracy) || 0, 40);
    const teacherAccuracy = Math.min(parseFloat(session.teacher_accuracy) || 0, 40);
    
    const effectiveDistance = Math.max(0, distance - studentAccuracy - teacherAccuracy);

    // Security Block 1: Hard Limit Check
    if (distance > HARD_LIMIT) {
        return res.status(403).json({
            error: `LOCATION REJECTED: You are physically too far (${distance.toFixed(0)}m). You must be near the classroom to mark attendance.`,
            distance: distance.toFixed(2),
            allowed: false
        });
    }

    // Security Block 2: Effective Distance Check (Matches the 50m rule)
    if (effectiveDistance > GEOFENCE_RADIUS) {
        return res.status(400).json({
            error: `OUT OF RANGE: Real distance is ${distance.toFixed(0)}m. After accounting for GPS accuracy (±${studentAccuracy.toFixed(0)}m), you are still outside the 50m zone.`,
            distance: distance.toFixed(2),
            accuracy: studentAccuracy,
            teacherAccuracy,
            allowed: false
        });
    }

    // --- Build Payload Dynamically ---
    const payload = {
        session_id,
        student_id,
        status: 'present',
        device_fingerprint,
        ip_address,
        student_lat: 0,
        student_lng: 0,
        distance: 0,
        rssi: -100
    };

    const finalLat = parseFloat(lat);
    const finalLng = parseFloat(lng);
    if (!isNaN(finalLat) && !isNaN(finalLng)) {
        payload.student_lat = finalLat;
        payload.student_lng = finalLng;
    }

    let finalDistance = parseFloat(distance);
    if (!isNaN(finalDistance)) payload.distance = finalDistance;

    let finalRssi = parseInt(rssi);
    if (!isNaN(finalRssi)) payload.rssi = finalRssi;

    if (supabase) {
        let { error } = await supabase.from('attendance_records').insert(payload);
        if (error) {
            console.error("Supabase Insert Error:", error.message);
            if (error.code === '23505') return res.status(400).json({ error: 'Attendance already marked' });

            if (error.message.includes('column') || error.message.includes('schema cache') ||
                error.message.includes('rssi') || error.message.includes('fingerprint') || error.message.includes('ip_address')) {
                const fallbackPayload = {
                    session_id, student_id, status: 'present',
                    student_lat: payload.student_lat, student_lng: payload.student_lng, distance: payload.distance
                };
                const retry = await supabase.from('attendance_records').insert(fallbackPayload);
                if (retry.error) return res.status(400).json({ error: retry.error.message });
                return res.json({ message: 'Attendance marked present! (Fallback Payload)', record: fallbackPayload });
            }
            return res.status(400).json({ error: error.message });
        }
        return res.json({ message: 'Attendance marked present!', record: payload });
    } else {
        if (mockRecords.some(r => r.session_id === session_id && r.student_id === student_id)) {
            return res.status(400).json({ error: 'Attendance already marked' });
        }
        const mockRecord = { ...payload, id: Date.now().toString() };
        mockRecords.push(mockRecord);
        return res.json({ message: 'Attendance marked present! (Mock Mode)', record: mockRecord });
    }
};

export const getAttendanceSummary = async (req, res) => {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Forbidden' });
    const student_id = req.user.id;
    const semester_filter = req.query.semester;
    const { branch, section } = req.user;

    if (supabase) {
        let sessionsQuery = supabase.from('attendance_sessions')
            .select('*').eq('branch', branch).eq('section', section);

        if (semester_filter) sessionsQuery = sessionsQuery.eq('semester', semester_filter);

        const { data: sessions, error: sError } = await sessionsQuery;
        if (sError) return res.status(400).json({ error: sError.message });

        const { data: records, error: rError } = await supabase.from('attendance_records')
            .select('session_id').eq('student_id', student_id);
        if (rError) return res.status(400).json({ error: rError.message });

        const attendedSessionIds = new Set(records.map(r => r.session_id));
        const summaryMap = {};

        sessions.forEach(session => {
            const subject = session.subject || 'General';
            if (!summaryMap[subject]) {
                summaryMap[subject] = {
                    subject, total: 0, attended: 0,
                    type: (subject.toLowerCase().includes('lab') || subject.toLowerCase().includes('practical')) ? 'PRACTICAL/LAB' : 'THEORY'
                };
            }
            summaryMap[subject].total += 1;
            if (attendedSessionIds.has(session.id)) summaryMap[subject].attended += 1;
        });

        const subjects = Object.values(summaryMap).map(s => ({
            ...s, percentage: s.total > 0 ? (s.attended / s.total * 100).toFixed(1) : "0.0"
        }));

        const stats = { total: { t: 0, a: 0 }, theory: { t: 0, a: 0 }, lab: { t: 0, a: 0 } };
        subjects.forEach(s => {
            stats.total.t += s.total;
            stats.total.a += s.attended;
            if (s.type === 'THEORY') {
                stats.theory.t += s.total; stats.theory.a += s.attended;
            } else {
                stats.lab.t += s.total; stats.lab.a += s.attended;
            }
        });

        const getPct = (o) => o.t > 0 ? (o.a / o.t * 100).toFixed(2) : "0.00";
        return res.json({ subjects, overall_pct: getPct(stats.total), theory_pct: getPct(stats.theory), lab_pct: getPct(stats.lab) });
    } else {
        return res.json({ subjects: [], overall_pct: "0.00", theory_pct: "0.00", lab_pct: "0.00" });
    }
};
