/** Base URL of the Django API. Server-side only. */
export const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

/** django-allauth headless endpoints used by the browser client. */
export const AUTH_API = `${BACKEND_URL}/_allauth/browser/v1/auth`;
