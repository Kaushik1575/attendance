// Haversine formula to calculate distance between two coordinates in meters
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

    return R * c;
}

export function getCurrentLocation(options = { highAccuracy: true }) {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by your browser'));
            return;
        }

        const highAccuracy = options.highAccuracy !== false;

        const performRequest = (isHigh) => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    });
                },
                (error) => {
                    // If high accuracy failed and it wasn't a permission denial (code 1), 
                    // try a low accuracy fallback.
                    if (isHigh && error.code !== 1) {
                        performRequest(false);
                    } else {
                        reject(error);
                    }
                },
                {
                    enableHighAccuracy: isHigh,
                    timeout: isHigh ? 8000 : 5000,
                    maximumAge: 0
                }
            );
        };

        performRequest(highAccuracy);
    });
}
