// OPTIMIZATION: Cache user data to avoid redundant API calls
// Cache user data in memory for the session

let cachedUserData = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function getCachedUser() {
    const now = Date.now();
    
    // Return cached data if it's still valid
    if (cachedUserData && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
        console.log('[USER CACHE] Returning cached user data');
        return cachedUserData;
    }
    
    // Fetch fresh data
    console.log('[USER CACHE] Fetching fresh user data');
    try {
        const response = await fetch('/auth/me', { credentials: 'include' });
        const data = await response.json();
        
        cachedUserData = data;
        cacheTimestamp = now;
        
        return data;
    } catch (error) {
        console.error('[USER CACHE] Error fetching user data:', error);
        return { authenticated: false };
    }
}

export function clearUserCache() {
    console.log('[USER CACHE] Clearing user cache');
    cachedUserData = null;
    cacheTimestamp = null;
}

export function getUserDataSync() {
    // Return cached data synchronously if available (may be stale)
    return cachedUserData;
}

