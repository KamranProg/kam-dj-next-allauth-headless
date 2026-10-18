import { expect, test } from "@playwright/test";

test("a browser extension adding attributes to <body> does not cause a hydration error", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  // Extensions such as ColorZilla add attributes to <body> before React hydrates.
  await page.addInitScript(() => {
    const observer = new MutationObserver(() => {
      if (document.body) {
        document.body.setAttribute("cz-shortcut-listen", "true");
        observer.disconnect();
      }
    });
    observer.observe(document, { childList: true, subtree: true });
  });

  await page.goto("/about", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "About" })).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("cz-shortcut-listen", "true");

  expect(errors.filter((text) => /hydrat/i.test(text))).toEqual([]);
});
