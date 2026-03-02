/**
 * Device Identity Module
 * 
 * Generates and persists a stable device fingerprint for student attendance.
 * Adapted to be strictly browser-independent to prevent proxy attendance
 * (e.g., logging in via Edge, then Brave on the exact same phone).
 */

const DEVICE_ID_KEY = 'smartattend_device_id'

/**
 * Generate a stable unique device ID (used for UI labels natively, but NO LONGER used for proxy-blocking fingerprint)
 */
export function getDeviceId() {
    let id = localStorage.getItem(DEVICE_ID_KEY)
    if (!id) {
        id = generateUUID()
        localStorage.setItem(DEVICE_ID_KEY, id)
    }
    return id
}

/**
 * Get browser + device fingerprint components.
 * CRITICAL FIX: We remove `getDeviceId()` (localStorage), `navigator.userAgent`, and `preciseGpsHash`
 * from the proxy fingerprint. This ensures the fingerprint remains IDENTICAL 
 * even if the student switches from Chrome to Edge to Brave on the same phone.
 */
export function getDeviceFingerprint() {
    const nav = navigator

    // 1. Hardware Anchor: Stable across browsers on same device
    const hardwareAnchor = [
        (screen.width || 0) + 'x' + (screen.height || 0),
        screen.colorDepth || 0,
        nav.hardwareConcurrency || 0,
        Intl.DateTimeFormat().resolvedOptions().timeZone || '',
        nav.platform || '',
        nav.maxTouchPoints || 0
    ].join('|')

    // 2. Canvas Fingerprint: Rendering engine behavior (Stable across Chromium/Webkit)
    let canvasHash = '';
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 200;
        canvas.height = 30;
        ctx.textBaseline = "top";
        ctx.font = "14px 'Arial'";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "#f60";
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = "#069";
        ctx.fillText("GeoAttend-AntiProxy", 2, 15);
        ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
        ctx.fillText("GeoAttend-AntiProxy", 4, 17);
        canvasHash = canvas.toDataURL().slice(-100); // Take end of data URL for diversity
    } catch (e) {
        canvasHash = 'CanvasError';
    }

    // 3. WebGL Renderer string: Most stable hardware ID
    let webGL = '';
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            webGL = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : '';
        }
    } catch (e) { }

    const finalFingerprintString = `${hardwareAnchor}|${canvasHash}|${webGL}`;

    return {
        deviceId: getDeviceId(), // kept for UI only
        userAgent: nav.userAgent,
        platform: nav.platform || 'Unknown',
        screenRes: `${screen.width}×${screen.height}`,
        language: nav.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        fingerprint: hashString(finalFingerprintString),
    }
}

/**
 * Try to get a Web Location device ID (requires user gesture + Location on).
 * This is the closest to a real Location ID that web allows.
 * Returns null if Location is unavailable or user cancels.
 */
export async function getLocationDeviceId() {
    if (!navigator.geolocation?.getCurrentPosition) return null
    try {
        // High-precision GPS reading. The exact lat/lng floats cached by the OS 
        // will be identically shared across browsers at the same moment.
        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    // toFixed(6) gives ~11cm precision. Extremely unique per GPS antenna.
                    const coords = `${position.coords.latitude.toFixed(6)},${position.coords.longitude.toFixed(6)}`
                    resolve(btoa(coords).slice(0, 16)) // simple hash
                },
                () => resolve(null),
                { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
            )
        })
    } catch {
        return null
    }
}

/**
 * Format a device UUID to look like a MAC address (for display).
 */
export function formatAsMac(uuid) {
    if (!uuid) return 'Unknown'
    const hex = uuid.replace(/-/g, '').substring(0, 12).toUpperCase()
    const pairs = hex.match(/.{1,2}/g) || []
    return pairs.slice(0, 4).join(':') + ':★★:★★'
}

/**
 * Get a display-friendly device label
 */
export function getDeviceLabel() {
    const ua = navigator.userAgent
    if (/android/i.test(ua)) return '📱 Android'
    if (/iphone|ipad/i.test(ua)) return '📱 iOS'
    if (/windows/i.test(ua)) return '💻 Windows'
    if (/mac/i.test(ua)) return '💻 Mac'
    return '🖥️ Unknown Device'
}

// ── Helpers ──────────────────────────────────────────────────────────────
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
    })
}

function hashString(str) {
    let hash = 5381
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i)
        hash |= 0
    }
    return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')
}
