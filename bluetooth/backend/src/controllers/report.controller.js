import { resend, SENDER_EMAIL } from '../services/notificationService.js';

export const sendReportEmail = async (req, res) => {
    const { to, subject, body, pdfBase64, filename } = req.body;

    if (!to || !pdfBase64) {
        return res.status(400).json({ error: 'Missing recipient email or PDF data' });
    }

    const isResendConfigured = process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 're_YOUR_RESEND_KEY_HERE';

    if (isResendConfigured) {
        try {
            console.log(`[REPORTS] Sending PDF to ${to}`);
            const base64Data = pdfBase64.includes('base64,') ? pdfBase64.split('base64,')[1] : pdfBase64;

            const { data, error } = await resend.emails.send({
                from: `GeoAttend <${SENDER_EMAIL}>`,
                to,
                subject: subject || 'Attendance Report',
                html: body || '<p>Please find the attached attendance report.</p>',
                attachments: [
                    {
                        filename: filename || 'AttendanceReport.pdf',
                        content: base64Data
                    }
                ]
            });

            if (error) {
                console.error('[REPORTS] Resend API Error:', error);
                return res.status(500).json({ error: error.message });
            }

            console.log(`[REPORTS] Success: ${data.id}`);
            return res.json({ message: 'Email sent successfully!', id: data.id });
        } catch (err) {
            console.error('[REPORTS] Unhandled Error:', err);
            return res.status(500).json({ error: 'Internal server error sending email' });
        }
    } else {
        console.log(`[DEV MODE] Mock email with PDF attachment to ${to}`);
        return res.json({ message: 'Email sent in Mock Mode (check console).' });
    }
};
