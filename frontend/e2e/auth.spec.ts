import { expect, test } from "@playwright/test";
import { PASSWORD, confirmEmail, register, signIn, uniqueEmail, fillAndSubmit } from "./helpers";
import { waitForEmail, linkPath } from "./mailpit";

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

test("a wrong password shows the server's error and a hint for Google accounts", async ({
  page,
}) => {
  await signIn(page, uniqueEmail(), "whatever1");
  await expect(page.getByText("not correct")).toBeVisible();
  await expect(page.getByText("Signed up with Google?")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("signing up again with an existing address looks like a new sign-up", async ({ page }) => {
  const email = uniqueEmail();
  await register(page, email);
  await confirmEmail(page, email);

  // Same page and wording as a brand new sign-up, so addresses cannot be probed.
  // (The "account already exists" email is rate-limited per address and is covered by a
  // backend test; here the address just received a confirmation email.)
  await register(page, email);
  await expect(page.getByText("If you already have an account with this address")).toBeVisible();

  // There is nothing to confirm, so resending says so instead of failing vaguely.
  await page.getByRole("button", { name: "Send the email again" }).click();
  await expect(page.getByText("There is no confirmation email to resend")).toBeVisible();
});
