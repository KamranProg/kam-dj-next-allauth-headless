import type { NextConfig } from "next";

// Server-side only. The browser never talks to Django directly: API calls go
// through this app (same origin), so no CORS setup is needed.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // Read-only call made from the browser. Writes go through /api/proxy/*
        // because they need the HttpOnly CSRF cookie.
        source: "/api/auth/session",
        destination: `${BACKEND_URL}/_allauth/browser/v1/auth/session`,
      },
    ];
  },
};

export default nextConfig;
