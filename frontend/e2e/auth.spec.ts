import { expect, test, type Locator, type Page } from "@playwright/test";
import { linkPath, waitForEmail } from "./mailpit";

const PASSWORD = "Str0ngPass!234";

/**
 * Fill inputs and click the submit button, retrying until the form accepts them.
 * A page that has not hydrated yet (common right after navigating in dev mode)
 * discards typed values, which leaves the submit button disabled.
 */
async function fillAndSubmit(fields: [Locator, string][], submit: Locator) {
  await expect(async () => {
    for (const [input, value] of fields) await input.fill(value);
    await expect(submit).toBeEnabled({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await submit.click();
}

const uniqueEmail = () => `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

async function register(page: Page, email: string) {
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

async function confirmEmail(page: Page, email: string) {
  const body = await waitForEmail(email, "Confirm Your Email");
  await page.goto(linkPath(body, "/account/verify-email/"));
  await page.getByRole("button", { name: "Confirm email" }).click();
  await expect(page.getByText("Your email address is confirmed")).toBeVisible();
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await fillAndSubmit(
    [
      [page.getByPlaceholder("Email"), email],
      [page.getByPlaceholder("Password"), password],
    ],
    page.getByRole("button", { name: "Sign in", exact: true })
  );
}

test("register, confirm the email, sign in and out", async ({ page }) => {
  const email = uniqueEmail();
  await register(page, email);
  await confirmEmail(page, email);

  await signIn(page, email, PASSWORD);
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
});

test("an unverified account cannot sign in or reach the dashboard", async ({ page }) => {
  const email = uniqueEmail();
  await register(page, email);

  // The pending sign-up leaves a session cookie behind; it must not count as signed in.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);

  await signIn(page, email, PASSWORD);
  await expect(page).toHaveURL(/\/account\/check-email/);
});

test("reset a forgotten password", async ({ page }) => {
  const email = uniqueEmail();
  await register(page, email);
  await confirmEmail(page, email);

  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await fillAndSubmit(
    [[page.getByPlaceholder("Email"), email]],
    page.getByRole("button", { name: "Send reset link" })
  );
  await expect(page.getByText("If an account exists for that address")).toBeVisible();

  const body = await waitForEmail(email, "Password Reset");
  await page.goto(linkPath(body, "/account/password/reset/key/"));
  const newPassword = "NewStr0ngPass!567";
  await fillAndSubmit(
    [
      [page.getByPlaceholder("New password", { exact: true }), newPassword],
      [page.getByPlaceholder("Confirm new password"), newPassword],
    ],
    page.getByRole("button", { name: "Change password" })
  );
  await expect(page).toHaveURL(/\/login/);

  await signIn(page, email, PASSWORD);
  await expect(page.getByText("not correct")).toBeVisible();

  await signIn(page, email, newPassword);
  await expect(page).toHaveURL(/\/dashboard/);
});

test("a wrong password shows the server's error", async ({ page }) => {
  await signIn(page, "nobody@example.com", "whatever1");
  await expect(page.getByText("not correct")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
