import type { NextRequest } from "next/server";
import { forwardToBackend } from "@/lib/backend-proxy";

// allauth answers a successful confirmation with 401 ("confirmed, but not signed in").
export function POST(req: NextRequest) {
  return forwardToBackend(req, { path: "email/verify", successAs200: [401] });
}
