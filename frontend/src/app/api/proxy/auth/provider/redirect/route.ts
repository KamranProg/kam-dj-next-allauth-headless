import type { NextRequest } from "next/server";
import { startProviderRedirect } from "@/lib/backend-proxy";

// Returns the provider's authorization URL for the browser to follow.
export function POST(req: NextRequest) {
  return startProviderRedirect(req);
}
