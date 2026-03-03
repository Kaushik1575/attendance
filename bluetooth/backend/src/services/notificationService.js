import { Resend } from 'resend';
import supabase from '../config/supabase.js';
import { mockStudents, mockRecords } from '../config/mockData.js';
import { makeOutboundCall } from './aiCallService.js';

// Safe initialization
const resendApiKey = process.env.RESEND_API_KEY || 're_dummy_key_to_prevent_crash';
const resend = new Resend(resendApiKey);
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'onboarding@resend.dev';

export const notifyAbsentees = async (sessionId, branch, section, semester, subject) => {
    try {
        console.log(`\n[AUTO-NOTIFY] Session ${sessionId} ended. Checking for absentees...`);

        const isResendConfigured = process.env.RESEND_API_KEY &&
            process.env.RESEND_API_KEY !== 're_YOUR_RESEND_KEY_HERE';

        console.log(`[AUTO-NOTIFY] Config check: Resend Configured = ${isResendConfigured}, Supabase = ${!!supabase}`);
        console.log(`[AUTO-NOTIFY] Filtering students by: Branch=${branch}, Section=${section}, Sem=${semester}`);

        let absentees = [];
        let studentsList = [];

        if (supabase) {
            const { data: students, error: sErr } = await supabase.from('students').select('id, name, email, mobile, parent_mobile')
                .eq('branch', branch.trim()).eq('section', section.trim()).eq('semester', String(semester));

            if (sErr) console.log('[AUTO-NOTIFY] Error fetching students:', sErr);
            console.log(`[AUTO-NOTIFY] Found ${students?.length || 0} total students in this class.`);

            const { data: records, error: rErr } = await supabase.from('attendance_records').select('student_id').eq('session_id', sessionId);
            if (rErr) console.log('[AUTO-NOTIFY] Error fetching records:', rErr);
            console.log(`[AUTO-NOTIFY] Found ${records?.length || 0} attendance records for this session.`);

            const attendedIds = new Set((records || []).map(r => r.student_id));
            absentees = (students || []).filter(s => !attendedIds.has(s.id));
            console.log(`[AUTO-NOTIFY] Result: Identified ${absentees.length} absentees based on missing IDs.`);
        } else {
            studentsList = mockStudents.filter(s => s.branch === branch && s.section === section && s.semester == semester);
            const attendedIds = new Set(mockRecords.filter(r => r.session_id === sessionId).map(r => r.student_id));
            absentees = studentsList.filter(s => !attendedIds.has(s.id));
        }

        if (absentees.length === 0) {
            console.log(`[AUTO-NOTIFY] 100% attendance for ${subject}! No emails required.`);
            return;
        }

        const dateStr = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
        const className = `${branch} (Sec ${section}, Sem ${semester})`;

        if (!isResendConfigured) {
            console.log('--------------------------------------------------');
            console.log('[AUTO-NOTIFY] RESEND NOT CONFIGURED (EMAIL MOCKED)');
            console.log(`[AUTO-NOTIFY] Detected ${absentees.length} absentees for ${subject}:`);
            for (const s of absentees) {
                console.log(`   - ${s.name} (${s.email})`);
                const contactNumber = s.parent_mobile || s.mobile;
                if (contactNumber) {
                    console.log(`   [AUTO-NOTIFY] Initiating AI call to ${contactNumber}...`);
                    await makeOutboundCall(contactNumber, s.name, className, dateStr, subject);
                }
            }
            console.log('--------------------------------------------------');
            return;
        }

        console.log(`[AUTO-NOTIFY] Found ${absentees.length} absentees. Dispatching alerts...`);

        // 3. Send emails & AI calls
        for (const student of absentees) {
            const contactNumber = student.parent_mobile || student.mobile;
            if (contactNumber) {
                console.log(`[AUTO-NOTIFY] Initiating AI call to ${contactNumber}...`);
                await makeOutboundCall(contactNumber, student.name, className, dateStr, subject);
            }

            try {
                await resend.emails.send({
                    from: `Attendance Alert <${SENDER_EMAIL}>`,
                    to: student.email,
                    subject: `Absence Notification: ${subject}`,
                    html: `
                        <div style="font-family: 'Inter', sans-serif; max-width: 500px; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background: white;">
                            <div style="background: #fef2f2; padding: 20px; border-radius: 12px; margin-bottom: 20px; border-left: 6px solid #ef4444;">
                                <h1 style="margin: 0; font-size: 20px; color: #991b1b;">Absence Alert</h1>
                                <p style="margin: 5px 0 0 0; font-size: 14px; color: #dc2626;">Smart Attendance Verification System</p>
                            </div>
                            <p style="font-size: 15px; color: #1e293b;">Hello <b>${student.name}</b>,</p>
                            <p style="color: #475569; line-height: 1.5; font-size: 14px;">Our system has recorded you as <b>ABSENT</b> for the following session:</p>
                            
                            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #f1f5f9;">
                                <p style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a;">${subject}</p>
                                <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">Date: ${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })}</p>
                            </div>

                            <p style="font-size: 13px; color: #ef4444; font-weight: 600;">⚠️ Absence from lectures may impact your internal grades and exam eligibility.</p>
                            
                            <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 20px 0;">
                            <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">This is an automated notification. Please contact your HOD for corrections.</p>
                        </div>
                     `
                });
            } catch (emailErr) {
                console.error(`[AUTO-NOTIFY] Error mailing ${student.email}:`, emailErr.message);
            }
        }
        console.log(`[AUTO-NOTIFY] Monitoring complete for Session ${sessionId}`);
    } catch (err) {
        console.error('[AUTO-NOTIFY] Service Error:', err);
    }
};

export { resend, SENDER_EMAIL };
