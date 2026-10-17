type AllauthError = { message?: string };

/** Error messages from an allauth headless response, or the fallback. */
export function errorMessages(data: unknown, fallback: string): string {
  const errors = (data as { errors?: AllauthError[] } | null)?.errors;
  const messages = errors?.map((e) => e.message).filter(Boolean);
  return messages?.length ? messages.join("\n") : fallback;
}

type Flow = { id: string; is_pending?: boolean };

/** The unfinished steps allauth lists for a login, sign-up or sensitive action. */
export function flowIds(data: unknown): string[] {
  return (data as { data?: { flows?: Flow[] } } | null)?.data?.flows?.map((flow) => flow.id) ?? [];
}

function hasPendingFlow(data: unknown, id: string): boolean {
  const flows = (data as { data?: { flows?: Flow[] } } | null)?.data?.flows;
  return Boolean(flows?.some((flow) => flow.id === id && flow.is_pending));
}

/** True when allauth reports a sign-up or login waiting for email verification. */
export function isPendingEmailVerification(data: unknown): boolean {
  return hasPendingFlow(data, "verify_email");
}

/** True when the password was accepted but an authenticator or recovery code is still needed. */
export function isPendingMfa(data: unknown): boolean {
  return hasPendingFlow(data, "mfa_authenticate");
}
