import type { NextRequest } from "next/server";
import { forwardToBackend } from "@/lib/backend-proxy";

// Second step of sign-in: an authenticator-app code or a recovery code.
export function POST(req: NextRequest) {
  return forwardToBackend(req, { path: "auth/2fa/authenticate" });
}
