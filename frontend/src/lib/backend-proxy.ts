import { NextResponse, type NextRequest } from "next/server";
import { AUTH_API, BACKEND_URL, BROWSER_API } from "@/lib/backend-url";

type ForwardOptions = {
  /** Path under the allauth browser API, e.g. "auth/login" or "account/authenticators". */
  path: string;
  method?: "GET" | "POST" | "DELETE";
  /** Upstream statuses that mean success but should reach the browser as 200. */
  successAs200?: number[];
};

/** Proves to Django that a request came from this server (see accounts/middleware.py). */
function proxyHeaders(req: NextRequest): Record<string, string> {
  const secret = process.env.PROXY_SHARED_SECRET;
  return {
    "X-Forwarded-Host": req.headers.get("host") ?? req.nextUrl.host,
    "X-Forwarded-Proto": req.nextUrl.protocol.replace(":", ""),
    ...(secret && { "X-Proxy-Secret": secret }),
  };
}

function cookieValue(setCookies: string[], name: string) {
  const match = setCookies.find((c) => c.startsWith(`${name}=`));
  return match?.slice(name.length + 1).split(";")[0];
}

/**
 * Forward an auth request to the Django (django-allauth headless) API on
 * behalf of the browser.
 *
 * Django's CSRF cookie is HttpOnly, so client code cannot read it. This runs
 * on the server, where the cookie can be copied into the X-CSRFToken header.
 * If the browser has no CSRF cookie yet, one is requested first and handed
 * back to the browser together with the response. The Origin header is
 * forwarded because Django requires it (or a Referer) over HTTPS, and
 * X-Forwarded-For lets Django rate-limit by the real client address.
 */
export async function forwardToBackend(
  req: NextRequest,
  { path, method = "POST", successAs200 = [] }: ForwardOptions
) {
  const incomingCookies = req.headers.get("cookie") ?? "";
  const forwardedFor = req.headers.get("x-forwarded-for");
  const origin = req.headers.get("origin") ?? req.nextUrl.origin;

  let cookieHeader = incomingCookies;
  let csrfToken = req.cookies.get("csrftoken")?.value ?? "";
  const bootstrapCookies: string[] = [];

  if (!csrfToken && method !== "GET") {
    const bootstrap = await fetch(`${AUTH_API}/session`, {
      cache: "no-store",
      headers: {
        Cookie: incomingCookies,
        ...(forwardedFor && { "X-Forwarded-For": forwardedFor }),
      },
    });
    bootstrapCookies.push(...bootstrap.headers.getSetCookie());
    csrfToken = cookieValue(bootstrapCookies, "csrftoken") ?? "";
    cookieHeader = [incomingCookies, `csrftoken=${csrfToken}`].filter(Boolean).join("; ");
  }

  const upstream = await fetch(`${BROWSER_API}/${path}`, {
    method,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      "X-CSRFToken": csrfToken,
      Origin: origin,
      ...proxyHeaders(req),
      ...(forwardedFor && { "X-Forwarded-For": forwardedFor }),
    },
    body: method === "POST" ? await req.text() : undefined,
  });

  const data = await upstream.json().catch(() => ({}));
  const status = successAs200.includes(upstream.status) ? 200 : upstream.status;
  const response = NextResponse.json(data, { status });

  // Pass every Set-Cookie (sessionid, csrftoken, ...) on to the browser.
  for (const cookie of [...bootstrapCookies, ...upstream.headers.getSetCookie()]) {
    response.headers.append("set-cookie", cookie);
  }

  return response;
}

/**
 * Start a Google (or other provider) sign-in. allauth answers with a redirect to the
 * provider; the browser has to follow it, so this returns the target as JSON, and
 * the session cookie that holds the OAuth state goes back to the browser.
 */
export async function startProviderRedirect(req: NextRequest) {
  const incoming = (await req.json()) as Record<string, string>;
  const form = new URLSearchParams({
    provider: incoming.provider ?? "",
    callback_url: incoming.callback_url ?? "",
    process: incoming.process ?? "login",
  });
  let cookieHeader = req.headers.get("cookie") ?? "";
  let csrfToken = req.cookies.get("csrftoken")?.value ?? "";
  const bootstrapCookies: string[] = [];
  if (!csrfToken) {
    // Same bootstrap as forwardToBackend: fetch a CSRF cookie before the POST.
    const bootstrap = await fetch(`${AUTH_API}/session`, {
      cache: "no-store",
      headers: { Cookie: cookieHeader },
    });
    bootstrapCookies.push(...bootstrap.headers.getSetCookie());
    csrfToken = cookieValue(bootstrapCookies, "csrftoken") ?? "";
    cookieHeader = [cookieHeader, `csrftoken=${csrfToken}`].filter(Boolean).join("; ");
  }

  const upstream = await fetch(`${BROWSER_API}/auth/provider/redirect`, {
    method: "POST",
    cache: "no-store",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieHeader,
      "X-CSRFToken": csrfToken,
      Origin: req.nextUrl.origin,
      ...proxyHeaders(req),
    },
    body: form.toString(),
  });

  const location = upstream.headers.get("location");
  const response = location
    ? NextResponse.json({ location })
    : NextResponse.json(
        { errors: [{ message: "Could not start Google sign-in." }] },
        { status: 400 }
      );
  for (const cookie of [...bootstrapCookies, ...upstream.headers.getSetCookie()]) {
    response.headers.append("set-cookie", cookie);
  }
  return response;
}

/**
 * Relay the provider's callback to Django. Django completes the sign-in (or records
 * an error) and answers with a redirect to our return page; cookies are passed on.
 */
export async function relayProviderCallback(req: NextRequest, backendPath: string) {
  const upstream = await fetch(`${BACKEND_URL}${backendPath}${req.nextUrl.search}`, {
    cache: "no-store",
    redirect: "manual",
    headers: {
      Cookie: req.headers.get("cookie") ?? "",
      ...proxyHeaders(req),
    },
  });

  // Django's location is absolute; the fallback is resolved against this request.
  const location = new URL(
    upstream.headers.get("location") ?? "/login?error=social_failed",
    req.nextUrl
  );
  const response = NextResponse.redirect(location, { status: 302 });
  for (const cookie of upstream.headers.getSetCookie()) {
    response.headers.append("set-cookie", cookie);
  }
  return response;
}
