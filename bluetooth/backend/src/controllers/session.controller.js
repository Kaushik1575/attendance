import supabase from '../config/supabase.js';
import { mockSessions, mockRecords, sessionTimeouts, mockStudents } from '../config/mockData.js';
import { isMatch } from '../utils/helpers.js';
import { notifyAbsentees } from '../services/notificationService.js';

export const startSession = async (req, res) => {
    if (req.user.role !== 'teacher') {
        console.warn(`[AUTH] 403 Forbidden: User ${req.user.id} (${req.user.email}) tried to start session with role: ${req.user.role}`);
        return res.status(403).json({ error: 'Forbidden: Teacher privilege required.' });
    }

    const { branch, section, semester, subject, timeSlot, duration, lat, lng } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const startTime = new Date();
    const durationMins = parseInt(duration) || 5;
    const expiryTime = new Date(startTime.getTime() + durationMins * 60000);

    const session = {
        branch, section,
        teacher_id: req.user.id,
        teacher_lat: lat, teacher_lng: lng,
        teacher_accuracy: req.body.accuracy || 0,
        otp,
        start_time: startTime.toISOString(),
        expiry_time: expiryTime.toISOString(),
        status: 'active'
    };

    if (semester) session.semester = semester;
    if (subject) session.subject = subject;
    if (timeSlot) session.time_slot = timeSlot;

    if (supabase) {
        let { data, error } = await supabase.from('attendance_sessions').insert([session]).select();

        if (error) {
            console.warn(`[SESSION] Primary insert failed: ${error.message}. Retrying with minimal payload...`);
            const fallback_session = { ...session };
            if (error.message.includes('teacher_lat') || error.message.includes('lat')) {
                fallback_session.lat = lat;
                fallback_session.lng = lng;
                delete fallback_session.teacher_lat;
                delete fallback_session.teacher_lng;
            }

            delete fallback_session.teacher_accuracy;
            delete fallback_session.teacher_rssi;
            delete fallback_session.time_slot;
            delete fallback_session.status;

            let { data: retryData, error: retryError } = await supabase.from('attendance_sessions').insert([fallback_session]).select();

            if (retryError) {
                console.error('[SESSION] Critical insert failure:', retryError.message);
                const extreme_fallback = {
                    teacher_id: session.teacher_id,
                    branch: session.branch,
                    section: session.section,
                    subject: session.subject || 'Lecture',
                    lat: lat, lng: lng,
                    otp: session.otp,
                    expiry_time: session.expiry_time
                };
                const { data: lastData, error: lastError } = await supabase.from('attendance_sessions').insert([extreme_fallback]).select();
                if (lastError) return res.status(400).json({ error: lastError.message });
                retryData = lastData;
            }

            const row = retryData[0];
            const finalSession = {
                ...row,
                teacher_lat: row.teacher_lat || row.lat || lat,
                teacher_lng: row.teacher_lng || row.lng || lng,
                subject, semester, section
            };

            const delayInMs = (durationMins * 60 * 1000) + 10000;
            const timeoutHandle = setTimeout(() => {
                notifyAbsentees(row.id, branch, section, semester, subject);
                sessionTimeouts.delete(row.id);
            }, delayInMs);
            sessionTimeouts.set(row.id, timeoutHandle);

            return res.json(finalSession);
        }

        const row = data[0];
        const delayInMs = (durationMins * 60 * 1000) + 10000;
        const timeoutHandle = setTimeout(() => {
            notifyAbsentees(row.id, branch, section, semester, subject || 'Lecture');
            sessionTimeouts.delete(row.id);
        }, delayInMs);
        sessionTimeouts.set(row.id, timeoutHandle);

        return res.json({
            ...row,
            teacher_lat: row.teacher_lat || lat,
            teacher_lng: row.teacher_lng || lng,
            subject, semester, section
        });
    } else {
        const mockRow = {
            id: 'mock-sess-' + Date.now(),
            teacher_id: req.user.id,
            branch, section, semester, subject,
            otp,
            start_time: startTime.toISOString(),
            expiry_time: expiryTime.toISOString(),
            teacher_lat: lat, teacher_lng: lng,
            status: 'active'
        };
        mockSessions.push(mockRow);

        const delayInMs = (durationMins * 60 * 1000) + 5000;
        const timeoutHandle = setTimeout(() => {
            notifyAbsentees(mockRow.id, branch, section, semester, subject || 'Lecture');
            sessionTimeouts.delete(mockRow.id);
        }, delayInMs);
        sessionTimeouts.set(mockRow.id, timeoutHandle);

        return res.json(mockRow);
    }
};

export const cancelSession = async (req, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Forbidden' });
    const { id } = req.params;

    if (sessionTimeouts.has(id)) {
        clearTimeout(sessionTimeouts.get(id));
        sessionTimeouts.delete(id);
    }

    if (supabase) {
        await supabase.from('attendance_records').delete().eq('session_id', id);
        const { error } = await supabase.from('attendance_sessions').delete().eq('id', id);
        if (error) return res.status(400).json({ error: error.message });
    } else {
        const index = mockSessions.findIndex(s => s.id === id);
        if (index > -1) mockSessions.splice(index, 1);
        const remainingRecords = mockRecords.filter(r => r.session_id !== id);
        mockRecords.length = 0;
        mockRecords.push(...remainingRecords);
    }
    return res.json({ success: true, message: 'Session cancelled successfully' });
};

export const resendAlerts = async (req, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Forbidden' });
    const { id } = req.params;

    let sessionData;
    if (supabase) {
        const { data } = await supabase.from('attendance_sessions').select('*').eq('id', id).single();
        sessionData = data;
    } else {
        sessionData = mockSessions.find(s => s.id === id);
    }

    if (!sessionData) return res.status(404).json({ error: 'Session not found' });

    notifyAbsentees(id, sessionData.branch, sessionData.section, sessionData.semester, sessionData.subject || 'Lecture');
    return res.json({ message: 'Absence alerts are being sent in the background' });
};

export const getActiveSessionStudent = async (req, res) => {
    const branch = req.query.branch || (req.user && req.user.branch);
    const section = req.query.section || (req.user && req.user.section);
    const semester = req.query.semester || (req.user && req.user.semester);
    const now = new Date();

    if (supabase) {
        const { data, error } = await supabase.from('attendance_sessions')
            .select('*')
            .eq('status', 'active')
            .gt('expiry_time', now.toISOString())
            .order('start_time', { ascending: false })
            .limit(50);

        if (error) return res.status(400).json({ error: error.message });

        const session = (data || []).find(s =>
            isMatch(s.branch, branch) &&
            isMatch(s.section, section) &&
            isMatch(s.semester, semester)
        );

        if (session) {
            session.teacher_lat = session.teacher_lat || session.lat;
            session.teacher_lng = session.teacher_lng || session.lng;
        }

        return res.json(session || null);
    } else {
        const session = mockSessions.find(s =>
            isMatch(s.branch, branch) &&
            isMatch(s.section, section) &&
            isMatch(s.semester, semester) &&
            s.status === 'active' &&
            new Date(s.expiry_time) > now
        );

        if (session) {
            session.teacher_lat = session.teacher_lat || session.lat;
            session.teacher_lng = session.teacher_lng || session.lng;
        }

        return res.json(session || null);
    }
};

export const getActiveSessionTeacher = async (req, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Forbidden' });
    const now = new Date();

    if (supabase) {
        const { data, error } = await supabase.from('attendance_sessions')
            .select('*')
            .eq('teacher_id', req.user.id)
            .eq('status', 'active')
            .gt('expiry_time', now.toISOString())
            .order('start_time', { ascending: false })
            .limit(1);

        if (error || !data || data.length === 0) return res.json(null);

        const session = data[0];
        session.teacher_lat = session.teacher_lat || session.lat;
        session.teacher_lng = session.teacher_lng || session.lng;
        return res.json(session);
    } else {
        const session = mockSessions.find(s =>
            s.teacher_id === req.user.id &&
            s.status === 'active' &&
            new Date(s.expiry_time) > now
        );
        if (session) {
            session.teacher_lat = session.teacher_lat || session.lat;
            session.teacher_lng = session.teacher_lng || session.lng;
        }
        return res.json(session || null);
    }
};

export const closeSession = async (req, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Forbidden' });
    const sessionId = req.params.id;

    if (sessionTimeouts.has(sessionId)) {
        clearTimeout(sessionTimeouts.get(sessionId));
        sessionTimeouts.delete(sessionId);
    }

    let sessionData = null;

    if (supabase) {
        const { data: fetchSession } = await supabase.from('attendance_sessions').select('*').eq('id', sessionId).single();
        sessionData = fetchSession;

        const { error } = await supabase.from('attendance_sessions')
            .update({ status: 'closed' })
            .eq('id', sessionId);
        if (error) return res.status(400).json({ error: error.message });
    } else {
        const s = mockSessions.find(s => s.id === sessionId);
        if (s) {
            s.status = 'closed';
            sessionData = s;
        }
    }

    if (sessionData) {
        console.log(`[SESSION] Manual closure triggered for ${sessionId}. Sending alerts in background...`);
        // Do NOT await so the teacher gets an immediate response
        notifyAbsentees(sessionData.id, sessionData.branch, sessionData.section, sessionData.semester, sessionData.subject || 'Lecture')
            .catch(err => console.error('[SESSION] Background alert error:', err));
    }

    return res.json({ success: true, message: 'Session closed successfully' });
};

export const extendSession = async (req, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Forbidden' });
    const { id } = req.params;
    const { duration } = req.body; // duration in minutes to add

    const addMins = parseInt(duration) || 5;

    if (supabase) {
        // Get current expiry
        const { data: session, error: fetchError } = await supabase.from('attendance_sessions').select('*').eq('id', id).single();
        if (fetchError || !session) return res.status(404).json({ error: 'Session not found' });

        const currentExpiry = new Date(session.expiry_time);
        const newExpiry = new Date(currentExpiry.getTime() + addMins * 60000);

        const { data, error } = await supabase.from('attendance_sessions')
            .update({ expiry_time: newExpiry.toISOString() })
            .eq('id', id)
            .select();

        if (error) return res.status(400).json({ error: error.message });

        const row = data[0];

        // Update timeout if it exists
        if (sessionTimeouts.has(id)) {
            clearTimeout(sessionTimeouts.get(id));
            const remainingMs = newExpiry.getTime() - new Date().getTime();
            const timeoutHandle = setTimeout(() => {
                notifyAbsentees(id, row.branch, row.section, row.semester, row.subject || 'Lecture');
                sessionTimeouts.delete(id);
            }, remainingMs + 5000);
            sessionTimeouts.set(id, timeoutHandle);
        }

        return res.json(row);
    } else {
        const session = mockSessions.find(s => s.id === id);
        if (!session) return res.status(404).json({ error: 'Session not found' });

        const currentExpiry = new Date(session.expiry_time);
        const newExpiry = new Date(currentExpiry.getTime() + addMins * 60000);
        session.expiry_time = newExpiry.toISOString();

        if (sessionTimeouts.has(id)) {
            clearTimeout(sessionTimeouts.get(id));
            const remainingMs = newExpiry.getTime() - new Date().getTime();
            const timeoutHandle = setTimeout(() => {
                notifyAbsentees(id, session.branch, session.section, session.semester, session.subject || 'Lecture');
                sessionTimeouts.delete(id);
            }, remainingMs + 5000);
            sessionTimeouts.set(id, timeoutHandle);
        }

        return res.json(session);
    }
};

export const getSessionHistory = async (req, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Forbidden' });
    const teacher_id = req.user.id;
    if (supabase) {
        let query = supabase.from('attendance_sessions')
            .select(`*, attendance_records(count)`)
            .eq('teacher_id', teacher_id)
            .order('start_time', { ascending: false })
            .limit(20);

        const { data, error } = await query;
        if (error) {
            console.error("Session History query failed, trying fallback:", error);
            const { data: all } = await supabase.from('attendance_sessions').select('*').order('start_time', { ascending: false }).limit(50);
            if (all) {
                const formatted = all.filter(s => s.teacher_id == null || s.teacher_id === teacher_id).map(s => ({ ...s, present_count: 0 }));
                return res.json(formatted);
            }
            return res.json([]);
        }

        const formattedData = data.map(s => ({ ...s, present_count: s.attendance_records?.[0]?.count || 0 }));
        return res.json(formattedData);
    } else {
        const history = [...mockSessions].reverse().slice(0, 20).map(s => ({
            ...s, present_count: mockRecords.filter(r => r.session_id === s.id).length
        }));
        return res.json(history);
    }
};

export const getDetailedHistory = async (req, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Forbidden' });

    const { branch, section, semester, date } = req.query;
    const teacher_id = req.user.id;

    try {
        if (supabase) {
            let query = supabase.from('attendance_sessions')
                .select(`*, attendance_records(*, students(id, name, roll_no))`)
                .eq('teacher_id', teacher_id);

            if (branch) query = query.eq('branch', branch);
            if (section) query = query.eq('section', section);
            if (semester) query = query.eq('semester', semester);
            if (date) {
                const startDate = new Date(date);
                const endDate = new Date(date);
                endDate.setDate(endDate.getDate() + 1);
                query = query.gte('start_time', startDate.toISOString()).lt('start_time', endDate.toISOString());
            }

            const { data, error } = await query.order('start_time', { ascending: false });
            if (error) throw error;

            const sessionsWithTotals = await Promise.all(data.map(async (s) => {
                const { count } = await supabase.from('students').select('*', { count: 'exact', head: true })
                    .eq('branch', s.branch).eq('section', s.section).eq('semester', s.semester);
                return { ...s, total_students: count || 0, records: s.attendance_records || [] };
            }));

            return res.json({ sessions: sessionsWithTotals });
        } else {
            let filteredSessions = mockSessions.filter(s => s.teacher_id === teacher_id);
            if (branch) filteredSessions = filteredSessions.filter(s => s.branch === branch);
            if (section) filteredSessions = filteredSessions.filter(s => s.section === section);
            if (semester) filteredSessions = filteredSessions.filter(s => s.semester === semester);
            if (date) filteredSessions = filteredSessions.filter(s => s.start_time.startsWith(date));

            const sessionsWithRecords = filteredSessions.map(s => {
                const records = mockRecords.filter(r => r.session_id === s.id).map(r => {
                    const student = mockStudents.find(st => st.id === r.student_id);
                    return { ...r, students: student };
                });
                const studentCount = mockStudents.filter(st => st.branch === s.branch && st.section === s.section && st.semester === s.semester).length;
                return { ...s, total_students: studentCount, records };
            });

            return res.json({ sessions: sessionsWithRecords });
        }
    } catch (error) {
        console.error('Detailed History Error:', error);
        res.status(500).json({ error: 'Failed to fetch detailed history' });
    }
};

export const getSessionStudents = async (req, res) => {
    const sessionId = req.params.id;
    if (supabase) {
        const { data, error } = await supabase.from('attendance_records')
            .select('*, students(name, roll_no, branch, section, semester)')
            .eq('session_id', sessionId).order('timestamp', { ascending: true });
        if (error) return res.status(400).json({ error: error.message });
        return res.json(data || []);
    } else {
        const records = mockRecords.filter(r => r.session_id === sessionId);
        const studentsWithDetails = records.map(record => {
            const student = mockStudents.find(s => s.id === record.student_id);
            return {
                ...record,
                students: student ? { name: student.name, roll_no: student.roll_no, branch: student.branch, section: student.section, semester: student.semester } : null
            };
        });
        return res.json(studentsWithDetails);
    }
};

export const getSessionStats = async (req, res) => {
    const sessionId = req.params.id;
    if (supabase) {
        const { count, error } = await supabase.from('attendance_records')
            .select('*', { count: 'exact', head: true }).eq('session_id', sessionId);
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ presentCount: count });
    } else {
        const count = mockRecords.filter(r => r.session_id === sessionId).length;
        return res.json({ presentCount: count });
    }
};
