import type { NextRequest } from "next/server";
import { relayProviderCallback } from "@/lib/backend-proxy";

// Google redirects here after the user chooses an account. This must be the redirect
// URI registered in Google Cloud Console (http://localhost:3000/accounts/google/login/callback/).
export function GET(req: NextRequest) {
  return relayProviderCallback(req, "/accounts/google/login/callback/");
}
