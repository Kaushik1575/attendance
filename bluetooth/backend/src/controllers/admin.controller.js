import supabase from '../config/supabase.js';
import { mockStudents, mockRecords, mockBlockedLogs } from '../config/mockData.js';

export const getStats = async (req, res) => {
    if (supabase) {
        const { count: totalStudents } = await supabase.from('students').select('*', { count: 'exact', head: true });
        const { count: totalPresent } = await supabase.from('attendance_records').select('*', { count: 'exact', head: true }).eq('status', 'present');
        const totalAbsent = (totalStudents || 0) - (totalPresent || 0);

        return res.json({
            totalStudents: totalStudents || 0,
            studentsPresent: totalPresent || 0,
            studentsAbsent: totalAbsent < 0 ? 0 : totalAbsent,
            blockedAttempts: mockBlockedLogs.length,
            logs: mockBlockedLogs
        });
    } else {
        const totalStudents = mockStudents.length;
        const totalPresent = Array.from(new Set(mockRecords.filter(r => r.status === 'present').map(r => r.student_id))).length;
        const totalAbsent = totalStudents - totalPresent;
        return res.json({
            totalStudents,
            studentsPresent: totalPresent,
            studentsAbsent: totalAbsent,
            blockedAttempts: mockBlockedLogs.length,
            logs: mockBlockedLogs
        });
    }
};

export const getUnauthorizedLogs = async (req, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Only admins can view logs' });

    if (supabase) {
        const { data, error } = await supabase
            .from('unauthorized_attempts')
            .select(`*, students (name, roll_no, email)`)
            .order('timestamp', { ascending: false });
        if (error) return res.status(400).json({ error: error.message });
        return res.json(data);
    } else {
        return res.json(mockBlockedLogs);
    }
};

export const resetBlock = async (req, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Unauthorized' });
    const { studentId } = req.params;

    if (supabase) {
        const { error } = await supabase.from('students').update({ blocked_until: null }).eq('id', studentId);
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ message: 'Block reset successfully' });
    } else {
        const student = mockStudents.find(s => s.id === studentId);
        if (student) student.blocked_until = null;
        return res.json({ message: 'Block reset successfully (Mock)' });
    }
};

export const resetDevice = async (req, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Unauthorized' });
    const { studentId } = req.params;

    if (supabase) {
        const { error } = await supabase.from('students').update({ device_id: null, blocked_until: null }).eq('id', studentId);
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ message: 'Device binding reset successfully. Student can now link a new device.' });
    } else {
        const student = mockStudents.find(s => s.id === studentId);
        if (student) {
            student.device_id = null;
            student.blocked_until = null;
        }
        return res.json({ message: 'Device binding reset successfully (Mock)' });
    }
};
