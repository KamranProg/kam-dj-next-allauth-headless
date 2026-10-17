import { expect, type Locator, type Page } from "@playwright/test";
import { linkPath, waitForEmail } from "./mailpit";

export const PASSWORD = "Str0ngPass!234";

/**
 * Fill inputs and click the submit button, retrying until the form accepts them.
 * A page that has not hydrated yet (common right after navigating in dev mode)
 * discards typed values, which leaves the submit button disabled.
 */
export async function fillAndSubmit(fields: [Locator, string][], submit: Locator) {
  await expect(async () => {
    for (const [input, value] of fields) await input.fill(value);
    await expect(submit).toBeEnabled({ timeout: 1000 });
  }).toPass({ timeout: 30_000 });
  await submit.click();
}

export const uniqueEmail = () => `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

export async function register(page: Page, email: string) {
  await page.goto("/register");
  await fillAndSubmit(
    [
      [page.getByPlaceholder("Email"), email],
      [page.getByPlaceholder("Password", { exact: true }), PASSWORD],
      [page.getByPlaceholder("Confirm Password"), PASSWORD],
    ],
    page.getByRole("button", { name: "Register" })
  );
  await expect(page.getByText("Check your email", { exact: true })).toBeVisible();
}

export async function confirmEmail(page: Page, email: string) {
  const body = await waitForEmail(email, "Confirm Your Email");
  await page.goto(linkPath(body, "/account/verify-email/"));
  await page.getByRole("button", { name: "Confirm email" }).click();
  await expect(page.getByText("Your email address is confirmed")).toBeVisible();
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await fillAndSubmit(
    [
      [page.getByPlaceholder("Email"), email],
      [page.getByPlaceholder("Password"), password],
    ],
    page.getByRole("button", { name: "Sign in", exact: true })
  );
}

/** Click Logout and wait until the app has finished signing out and moved to /login. */
export async function logout(page: Page) {
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/login/);
}
