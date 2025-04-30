import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api', // Fallback to relative path if env var is not set
});

// Add a request interceptor to include the appropriate token
api.interceptors.request.use(
  (config) => {
    let token: string | null = null;
    const url = config.url || '';
    console.log(`[Interceptor] Request URL: ${url}`);

    // Use ACTIVE SESSION TOKEN for chatbot actions
    if (url.startsWith('/api/v1/chatbot')) {
      const sessionInfoStr = localStorage.getItem('activeSessionInfo');
      if (sessionInfoStr) {
          try {
              const sessionInfo = JSON.parse(sessionInfoStr);
              token = sessionInfo?.token?.access_token;
              console.log(`[Interceptor] Using ACTIVE SESSION token (Chatbot): ${token ? token.substring(0, 10) + '...' : 'null'}`);
          } catch (e) { console.error("[Interceptor] Error parsing activeSessionInfo", e); }
      }
      if (!token) { console.error('[Interceptor] Active session token missing for chatbot request!'); }
    } 
    // Use USER TOKEN for listing/creating/deleting sessions, AND for fetching user details
    else if (url === '/api/v1/auth/me' ||                // GET /me
               url.startsWith('/api/v1/auth/sessions') || // GET /sessions
               url === '/api/v1/auth/session' ||        // POST /session
               url.startsWith('/api/v1/auth/session/')) { // DELETE /session/{id}
         // Exclude the PATCH rename endpoint from this block        
         if (config.method?.toLowerCase() !== 'patch') {       
            token = localStorage.getItem('authToken');
            console.log(`[Interceptor] Using USER token (Auth Action): ${token ? token.substring(0, 10) + '...' : 'null'}`);
         }
         // Note: PATCH /session/{id}/name requires a specific session token, handled by the caller (renameSession)
    } 
    // Add other conditions if needed

    // Only set Authorization header if it doesn't already exist
    if (token && !config.headers.Authorization) { 
      config.headers.Authorization = `Bearer ${token}`;
      console.log(`[Interceptor] Token SET by interceptor: ${token.substring(0, 10)}...`);
    } else if (config.headers.Authorization) {
        console.log(`[Interceptor] Authorization header already set by caller for ${url}.`);
    } else {
        console.warn(`[Interceptor] No token determined or set for ${url}`);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api; 