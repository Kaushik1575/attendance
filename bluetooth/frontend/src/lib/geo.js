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

        // Configuration for the request
        const geoOptions = {
            enableHighAccuracy: highAccuracy,
            timeout: highAccuracy ? 10000 : 5000,
            maximumAge: 0 // Force fresh reading
        };

        const successHandler = (position) => {
            resolve({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy
            });
        };

        const errorHandler = (error) => {
            // Case 1: If we tried High Accuracy and failed (but NOT because user clicked BLOCK on the browser)
            // try a low-accuracy fallback automatically.
            if (highAccuracy && error.code !== error.PERMISSION_DENIED) {
                console.warn("GPS High Accuracy failed, falling back to low accuracy...");
                navigator.geolocation.getCurrentPosition(successHandler, (err) => reject(err), {
                    enableHighAccuracy: false,
                    timeout: 5000,
                    maximumAge: 0
                });
            } else {
                // If it's a permission denial (code 1), the browser will block further attempts.
                reject(error);
            }
        };

        navigator.geolocation.getCurrentPosition(successHandler, errorHandler, geoOptions);
    });
}
