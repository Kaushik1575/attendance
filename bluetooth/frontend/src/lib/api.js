// Centralized API handler. 
// Uses relative paths ('/api') in production to leverage Vercel Rewrites/Proxies.
// Uses absolute localhost in development.
// This ELIMINATES CORS errors because the frontend always thinks it's talking to itself.

const isProduction = typeof window !== 'undefined' &&
    (window.location.hostname.endsWith('.vercel.app') ||
        window.location.hostname === 'geoattend.vercel.app');

const getBaseURL = () => {
    // 1. Manually set URL from .env if provided and not explicitly empty
    if (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.trim() !== '') {
        return import.meta.env.VITE_API_URL.replace(/\/+$/, '');
    }

    // 2. Production: Use relative paths (best for Vercel/proxies)
    if (isProduction) return '';

    // 3. Fallback: Local development
    return 'http://localhost:5000';
};

export const API = getBaseURL();
