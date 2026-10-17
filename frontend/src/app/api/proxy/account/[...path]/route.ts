import { NextResponse, type NextRequest } from "next/server";
import { forwardToBackend } from "@/lib/backend-proxy";

// Only the multi-factor endpoints are exposed through this catch-all.
const ALLOWED = /^authenticators(\/(totp|recovery-codes))?$/;

async function forward(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const path = (await ctx.params).path.join("/");
  if (!ALLOWED.test(path)) {
    return NextResponse.json({ status: 404 }, { status: 404 });
  }
  return forwardToBackend(req, {
    path: `account/${path}`,
    method: req.method as "GET" | "POST" | "DELETE",
  });
}

export { forward as GET, forward as POST, forward as DELETE };
