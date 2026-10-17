const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";

type Message = { ID: string; Subject: string };

/** Wait for an email to `address` whose subject contains `subject`; return its text body. */
export async function waitForEmail(address: string, subject: string): Promise<string> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const search = await fetch(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`
    );
    const { messages = [] } = (await search.json()) as { messages?: Message[] };
    const match = messages.find((m) => m.Subject.includes(subject));
    if (match) {
      const full = await fetch(`${MAILPIT}/api/v1/message/${match.ID}`);
      return ((await full.json()) as { Text: string }).Text;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No "${subject}" email for ${address} arrived in Mailpit`);
}

/** First URL in a text body that contains `fragment`, as a path relative to the site. */
export function linkPath(body: string, fragment: string): string {
  const match = body.match(new RegExp(`https?://\\S*${fragment}\\S*`));
  if (!match) throw new Error(`No link containing "${fragment}" in:\n${body}`);
  const url = new URL(match[0]);
  return url.pathname + url.search;
}
