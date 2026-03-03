
const RETELL_API_KEY = process.env.RETELL_API_KEY || "key_47254fd3407901e9678eb9f05504";

export async function makeOutboundCall(toNumber, studentName, className, date, subject) {
    let formattedNumber = String(toNumber).trim();
    if (!formattedNumber.startsWith('+')) {
        formattedNumber = `+91${formattedNumber}`; // Default to India country code
    }

    // Format date for natural speech (e.g., "March 3rd, 2026")
    const speechDate = date || new Date().toLocaleDateString('en-US', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    const payload = {
        "from_number": "+12173933886",
        "to_number": formattedNumber,
        "call_type": "phone_call",
        "override_agent_id": "agent_3fdd36f861c6e96f3f424ba8cc",
        "end_call_after_speak": true,
        "retell_llm_dynamic_variables": {
            "student_name": studentName || "Student",
            "branch_year_sem": className || "Class",
            "date": speechDate,
            "subject_name": subject || "Lecture"
        }
    };

    try {
        const response = await fetch("https://api.retellai.com/v2/create-phone-call", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${RETELL_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();
        if (response.ok) {
            console.log(`📞 Outbound call launched successfully to ${formattedNumber}! Call ID:`, data.call_id || data.id);
        } else {
            console.error(`❌ Retell API Error for ${formattedNumber}:`, data);
        }
    } catch (error) {
        console.error(`⚠️ Retell Request Failed for ${formattedNumber}:`, error.message);
    }
}
