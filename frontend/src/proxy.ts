import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_API } from "@/lib/backend-url";

// Pages reachable without a session. Everything else, including /account/security,
// requires one.
const PUBLIC_PATHS = [
  "/",
  "/about",
  "/login",
  "/register",
  "/account/check-email",
  "/account/verify-email",
  "/account/password",
  "/account/two-factor",
  "/api",
];
const AUTH_ONLY_PATHS = ["/login", "/register"];

const matches = (pathname: string, paths: string[]) =>
  paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));

/**
 * Ask Django whether the session is real. A `sessionid` cookie alone proves
 * nothing: allauth also sets one while a sign-up is waiting for email
 * verification, and old cookies survive a database reset.
 */
async function isSignedIn(request: NextRequest): Promise<boolean> {
  if (!request.cookies.has("sessionid")) return false;
  try {
    const res = await fetch(`${AUTH_API}/session`, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthOnly = matches(pathname, AUTH_ONLY_PATHS);
  const isProtected = !matches(pathname, PUBLIC_PATHS);

  // Only pages whose behaviour depends on being signed in need the check.
  if (!isAuthOnly && !isProtected) return NextResponse.next();

  const signedIn = await isSignedIn(request);

  // Signed in and opening login/register → send to the dashboard.
  if (signedIn && isAuthOnly) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Protected page without a valid session → send to login.
  if (!signedIn && isProtected) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
