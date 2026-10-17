import { errorMessages } from "@/lib/api-errors";

export type AuthCallResult = {
  ok: boolean;
  /** Human-readable error when `ok` is false. */
  message: string;
  data: unknown;
};

/** POST JSON to one of the /api/proxy/auth/* routes. */
export async function postAuth(
  path: string,
  body: Record<string, string> = {}
): Promise<AuthCallResult> {
  try {
    const res = await fetch(`/api/proxy/auth/${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      message: res.ok ? "" : errorMessages(data, "Something went wrong. Please try again."),
      data,
    };
  } catch {
    return { ok: false, message: "Could not reach the server. Please try again.", data: {} };
  }
}
