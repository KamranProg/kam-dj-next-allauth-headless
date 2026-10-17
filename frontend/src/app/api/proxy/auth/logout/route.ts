import type { NextRequest } from "next/server";
import { forwardToBackend } from "@/lib/backend-proxy";

// allauth answers a successful logout with 401 ("no longer authenticated").
export function POST(req: NextRequest) {
  return forwardToBackend(req, { path: "session", method: "DELETE", successAs200: [401] });
}
