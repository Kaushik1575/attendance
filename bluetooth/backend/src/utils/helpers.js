// --- Utility: Haversine Formula ---
export function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // meters
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const dPhi = (lat2 - lat1) * Math.PI / 180;
    const dLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) *
        Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in meters
}

export function isMatch(s1, s2) {
    if (!s1 || !s2) return false
    const norm1 = s1.trim().toLowerCase()
    const norm2 = s2.trim().toLowerCase()
    if (norm1 === norm2) return true

    // Advanced fallbacks (e.g. \"5\" matches \"5th\", \"CSE-A\" matches \"csea\")
    const stripped1 = norm1.replace(/[^a-z0-9]/g, '')
    const stripped2 = norm2.replace(/[^a-z0-9]/g, '')
    return stripped1 === stripped2 || stripped1.startsWith(stripped2) || stripped2.startsWith(stripped1)
}
