import type { NextRequest } from "next/server";
import { forwardToBackend } from "@/lib/backend-proxy";

// A successful reset also answers 401: the password changed, but nobody is signed in.
export function POST(req: NextRequest) {
  return forwardToBackend(req, { path: "password/reset", successAs200: [401] });
}
