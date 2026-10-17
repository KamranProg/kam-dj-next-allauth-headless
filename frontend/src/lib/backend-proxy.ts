import { NextResponse, type NextRequest } from "next/server";
import { AUTH_API } from "@/lib/backend-url";

type ForwardOptions = {
  /** Path under the allauth browser auth API, e.g. "login". */
  path: string;
  method?: "POST" | "DELETE";
  /** Upstream statuses that mean success but should reach the browser as 200. */
  successAs200?: number[];
};

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

  if (!csrfToken) {
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

  const upstream = await fetch(`${AUTH_API}/${path}`, {
    method,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      "X-CSRFToken": csrfToken,
      Origin: origin,
      ...(forwardedFor && { "X-Forwarded-For": forwardedFor }),
    },
    body: method === "DELETE" ? undefined : await req.text(),
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
