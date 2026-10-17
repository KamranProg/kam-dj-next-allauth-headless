import type { NextRequest } from "next/server";
import { forwardToBackend } from "@/lib/backend-proxy";

// Confirms the password again before sensitive changes such as multi-factor settings.
export function POST(req: NextRequest) {
  return forwardToBackend(req, { path: "auth/reauthenticate" });
}
