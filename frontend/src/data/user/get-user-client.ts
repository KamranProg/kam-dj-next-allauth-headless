export type SessionUser = {
  id: string;
  email: string;
  username?: string;
  /** False for accounts created through Google until a password is set. */
  hasPassword?: boolean;
};

export async function getUserClient(): Promise<SessionUser | null> {
  try {
    // Same-origin request; next.config.ts rewrites it to the allauth session
    // endpoint, which answers 401 when nobody is signed in.
    // A timeout keeps the nav bar from waiting forever if the API is slow or down.
    const res = await fetch("/api/auth/session", {
      credentials: "include",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const user = (await res.json())?.data?.user;
    if (!user) return null;
    return {
      id: String(user.id),
      email: user.email,
      username: user.username,
      hasPassword: user.has_usable_password,
    };
  } catch {
    return null;
  }
}
