import type { NextRequest } from "next/server";
import { forwardToBackend } from "@/lib/backend-proxy";

export function POST(req: NextRequest) {
  return forwardToBackend(req, { path: "auth/login" });
}
