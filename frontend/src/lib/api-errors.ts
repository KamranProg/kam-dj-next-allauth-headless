type AllauthError = { message?: string };

/** Error messages from an allauth headless response, or the fallback. */
export function errorMessages(data: unknown, fallback: string): string {
  const errors = (data as { errors?: AllauthError[] } | null)?.errors;
  const messages = errors?.map((e) => e.message).filter(Boolean);
  return messages?.length ? messages.join("\n") : fallback;
}
