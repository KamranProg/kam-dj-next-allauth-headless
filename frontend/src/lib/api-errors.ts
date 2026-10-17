type AllauthError = { message?: string };

/** Error messages from an allauth headless response, or the fallback. */
export function errorMessages(data: unknown, fallback: string): string {
  const errors = (data as { errors?: AllauthError[] } | null)?.errors;
  const messages = errors?.map((e) => e.message).filter(Boolean);
  return messages?.length ? messages.join("\n") : fallback;
}

type Flow = { id: string; is_pending?: boolean };

/** True when allauth reports a sign-up or login waiting for email verification. */
export function isPendingEmailVerification(data: unknown): boolean {
  const flows = (data as { data?: { flows?: Flow[] } } | null)?.data?.flows;
  return Boolean(flows?.some((flow) => flow.id === "verify_email" && flow.is_pending));
}
