/** Base URL of the Django API. Server-side only. */
export const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

/** django-allauth headless API for the browser client (cookie session + CSRF). */
export const BROWSER_API = `${BACKEND_URL}/_allauth/browser/v1`;

/** Its authentication endpoints (login, signup, session, ...). */
export const AUTH_API = `${BROWSER_API}/auth`;
